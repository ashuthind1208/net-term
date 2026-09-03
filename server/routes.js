import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { requireUser } from './auth.js'
import { filterSourceRecordsForUser, inactiveAssignees, isAccountActive, isTaskAssignedTo, prepareEmployeeSubmission } from './access.js'
import { query } from './db.js'
import { sendEmail, sendInviteEmail, sendTaskEventEmail, sendTimesheetEventEmail } from './email.js'
import { uploadSingle, uploadsDirectory } from './uploads.js'

const router = Router()

const sourceEntities = new Set(['AssetUsage', 'AuditLog', 'Blocker', 'Document', 'EmployeeReview', 'Expense', 'ExpenseCategory', 'Goal', 'Invoice', 'Notification', 'Procurement', 'Project', 'Risk', 'Task', 'Timesheet', 'User', 'WorkflowRule'])

const resources = {
  projects: ['name', 'client_name', 'status', 'start_date', 'due_date', 'budget', 'progress', 'description'],
  tasks: ['project_id', 'title', 'description', 'status', 'priority', 'due_date', 'completed_at'],
  expenses: ['project_id', 'amount', 'category', 'description', 'expense_date', 'status'],
  timesheets: ['project_id', 'task_id', 'hours', 'work_date', 'notes', 'status'],
  blockers: ['title', 'description', 'severity', 'status', 'resolved_at'],
  notifications: ['type', 'title', 'message', 'is_read'],
}

router.use(requireUser)
router.get('/me', async (req, res, next) => {
  try {
    const result = await query('SELECT id, email, display_name, avatar_url, role, profile FROM users WHERE id = $1', [req.user.id])
    const user = result.rows[0] || req.user
    const sourceResult = user.email ? await query(
      `SELECT payload FROM source_records
       WHERE entity_type = 'User' AND LOWER(payload->>'email') = LOWER($1)
       LIMIT 1`,
      [user.email],
    ) : { rows: [] }
    res.json({ data: { ...user, ...(user.profile || {}), ...(sourceResult.rows[0]?.payload || {}) } })
  } catch (error) { next(error) }
})

router.patch('/me', async (req, res, next) => {
  try {
    const profile = { ...req.body }
    delete profile.id
    delete profile.email
    delete profile.role
    const displayName = profile.full_name || profile.display_name
    const avatarUrl = profile.photo_url || profile.avatar_url
    delete profile.full_name
    delete profile.display_name
    delete profile.photo_url
    delete profile.avatar_url
    const result = await query(
      `UPDATE users
       SET profile = profile || $2::jsonb,
           display_name = COALESCE($3, display_name),
           avatar_url = COALESCE($4, avatar_url),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, display_name, avatar_url, role, profile`,
      [req.user.id, JSON.stringify(profile), displayName || null, avatarUrl || null],
    )
    const user = result.rows[0]
    res.json({ data: { ...user, ...(user.profile || {}) } })
  } catch (error) { next(error) }
})

router.post('/integrations/upload', (req, res, next) => {
  uploadSingle(req, res, (error) => {
    if (error) {
      error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
      return next(error)
    }
    if (!req.file) return res.status(400).json({ error: 'A file is required' })
    return res.status(201).json({
      data: {
        file_url: `/api/v1/uploads/${req.file.filename}`,
        filename: req.file.originalname,
        size: req.file.size,
      },
    })
  })
})

router.get('/uploads/:filename', (req, res, next) => {
  const filename = basename(req.params.filename)
  if (filename !== req.params.filename) return res.status(404).json({ error: 'File not found' })
  res.set({
    'Cache-Control': 'private, max-age=3600',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
  })
  return res.sendFile(filename, { root: uploadsDirectory, dotfiles: 'deny' }, (error) => {
    if (!error) return
    if (error.status === 404) return res.status(404).json({ error: 'File not found' })
    return next(error)
  })
})

function sourcePayload(entity, id, body, user, existing = {}) {
  const now = new Date().toISOString()
  return {
    ...existing,
    ...body,
    id,
    created_date: existing.created_date || now,
    updated_date: now,
    created_by: existing.created_by || user.email || 'local-user',
    ...(entity === 'User' && body.role === 'member' ? { role: 'user' } : {}),
  }
}

async function notifyTaskEvent(event, task, previous, actor) {
  try {
    return await sendTaskEventEmail({ event, task, previous, actor })
  } catch (error) {
    console.error(`Task ${event} email failed:`, error.message)
    return { sent: false, error: error.message }
  }
}

async function getAdminEmails() {
  const result = await query(
    `SELECT DISTINCT LOWER(email) AS email FROM (
       SELECT payload->>'email' AS email
       FROM source_records
       WHERE entity_type = 'User' AND COALESCE(payload->>'role', payload->>'_app_role') = 'admin'
       UNION ALL
       SELECT email FROM users WHERE role = 'admin'
     ) admins
     WHERE email IS NOT NULL AND email <> ''`,
  )
  return result.rows.map((row) => row.email)
}

async function notifyTimesheetEvent(event, timesheet, previous, actor) {
  try {
    return await sendTimesheetEventEmail({ event, timesheet, previous, actor, adminEmails: await getAdminEmails() })
  } catch (error) {
    console.error(`Timesheet ${event} email failed:`, error.message)
    return { sent: false, error: error.message }
  }
}

async function appendLocalUsers(records) {
  const result = await query('SELECT id, email, display_name, avatar_url, role, profile, created_at, updated_at FROM users ORDER BY created_at')
  const existingEmails = new Set(records.map((record) => record.email).filter(Boolean))
  return [
    ...records,
    ...result.rows.filter((user) => !existingEmails.has(user.email)).map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.display_name,
      photo_url: user.avatar_url,
      role: user.role === 'member' ? 'user' : user.role,
      is_active: isAccountActive(user),
      created_date: user.created_at,
      updated_date: user.updated_at,
      ...(user.profile || {}),
    })),
  ]
}

async function sourcePayloads(entity) {
  const result = await query(
    `SELECT payload FROM source_records
     WHERE entity_type = $1
     ORDER BY source_created_at DESC NULLS LAST, imported_at DESC`,
    [entity],
  )
  return result.rows.map((row) => row.payload)
}

async function validateActiveEmployees(emails) {
  if (!emails?.length) return
  const users = await appendLocalUsers(await sourcePayloads('User'))
  const invalid = inactiveAssignees(emails, users)
  if (!invalid.length) return
  const error = new Error(`Inactive or unknown employees cannot be assigned: ${invalid.join(', ')}`)
  error.status = 400
  throw error
}

async function prepareSourceBody(entity, body, user) {
  if (entity === 'Task') await validateActiveEmployees(body.assigned_to)
  if (entity === 'Project') {
    await validateActiveEmployees([...(body.team_members || []), body.manager_email].filter(Boolean))
  }
  if (user.role === 'admin' || !['Timesheet', 'Expense'].includes(entity)) return body
  const [projects, tasks] = await Promise.all([sourcePayloads('Project'), sourcePayloads('Task')])
  return prepareEmployeeSubmission(entity, body, user, projects, tasks)
}

async function removeEmployeeAssignments(email) {
  const result = await query(
    `SELECT entity_type, source_id, payload FROM source_records
     WHERE entity_type IN ('Project', 'Task')`,
  )
  for (const record of result.rows) {
    const payload = { ...record.payload }
    if (record.entity_type === 'Task') {
      payload.assigned_to = (payload.assigned_to || []).filter((value) => value.toLowerCase() !== email.toLowerCase())
    } else {
      payload.team_members = (payload.team_members || []).filter((value) => value.toLowerCase() !== email.toLowerCase())
      if (payload.manager_email?.toLowerCase() === email.toLowerCase()) payload.manager_email = null
    }
    await query(
      'UPDATE source_records SET payload = $3::jsonb, source_updated_at = NOW(), imported_at = NOW() WHERE entity_type = $1 AND source_id = $2',
      [record.entity_type, record.source_id, JSON.stringify(payload)],
    )
  }
}

router.get('/source/:entity', async (req, res, next) => {
  try {
    if (!sourceEntities.has(req.params.entity)) return res.status(404).json({ error: 'Unknown entity' })
    if (req.user.role !== 'admin' && ['AuditLog', 'EmployeeReview', 'Invoice', 'Procurement'].includes(req.params.entity)) return res.status(403).json({ error: 'Admin access required' })
    const records = req.params.entity === 'User'
      ? await appendLocalUsers(await sourcePayloads('User'))
      : await sourcePayloads(req.params.entity)
    const tasks = req.user.role !== 'admin' && req.params.entity === 'Project' ? await sourcePayloads('Task') : []
    res.json({ data: filterSourceRecordsForUser(req.params.entity, records, req.user, tasks) })
  } catch (error) { next(error) }
})

router.post('/source/:entity', async (req, res, next) => {
  try {
    const entity = req.params.entity
    if (!sourceEntities.has(entity)) return res.status(404).json({ error: 'Unknown entity' })
    if (req.user.role !== 'admin' && ['User', 'Project', 'Task'].includes(entity)) return res.status(403).json({ error: 'Admin access required' })
    const id = randomUUID()
    const body = await prepareSourceBody(entity, req.body, req.user)
    const payload = sourcePayload(entity, id, body, req.user)
    await query(
      `INSERT INTO source_records (entity_type, source_id, payload, source_created_at, source_updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
      [entity, id, JSON.stringify(payload)],
    )
    if (entity === 'Task') await notifyTaskEvent('created', payload, null, req.user)
    if (entity === 'Timesheet') await notifyTimesheetEvent('submitted', payload, null, req.user)
    res.status(201).json({ data: payload })
  } catch (error) { next(error) }
})

router.patch('/source/:entity/:id', async (req, res, next) => {
  try {
    const entity = req.params.entity
    if (!sourceEntities.has(entity)) return res.status(404).json({ error: 'Unknown entity' })
    if (req.user.role !== 'admin' && ['User', 'Project'].includes(entity)) return res.status(403).json({ error: 'Admin access required' })

    if (entity === 'User') {
      const localUser = await query('SELECT id, email, display_name, avatar_url, role, profile, created_at FROM users WHERE id::text = $1', [req.params.id])
      if (localUser.rows[0]) {
        if (localUser.rows[0].email.toLowerCase() === req.user.email.toLowerCase() && req.body.is_active === false) {
          return res.status(400).json({ error: 'You cannot deactivate your own account' })
        }
        const requestedRole = req.body.role
        const databaseRole = requestedRole === 'admin' ? 'admin' : 'member'
        const profile = { ...req.body }
        delete profile.role
        const updated = await query(
          `UPDATE users SET role = $2, profile = profile || $3::jsonb, updated_at = NOW()
           WHERE id = $1 RETURNING id, email, display_name, avatar_url, role, profile, created_at, updated_at`,
          [req.params.id, databaseRole, JSON.stringify(profile)],
        )
        const user = updated.rows[0]
        if (req.body.is_active === false) await removeEmployeeAssignments(user.email)
        return res.json({ data: { id: user.id, email: user.email, full_name: user.display_name, photo_url: user.avatar_url, role: user.role === 'member' ? 'user' : user.role, created_date: user.created_at, updated_date: user.updated_at, ...(user.profile || {}) } })
      }
    }

    const current = await query('SELECT payload FROM source_records WHERE entity_type = $1 AND source_id = $2', [entity, req.params.id])
    if (!current.rows[0]) return res.status(404).json({ error: 'Record not found' })
    if (req.user.role !== 'admin' && entity === 'Task') {
      if (!isTaskAssignedTo(current.rows[0].payload, req.user.email)) return res.status(403).json({ error: 'This task is not assigned to you' })
      if (Object.keys(req.body).some((field) => !['status', 'completed_at'].includes(field))) return res.status(403).json({ error: 'Employees can only update task status' })
    }
    if (req.user.role !== 'admin' && ['Timesheet', 'Expense'].includes(entity)) {
      if (!filterSourceRecordsForUser(entity, [current.rows[0].payload], req.user).length) return res.status(403).json({ error: 'You can only update your own records' })
      if (['status', 'reviewed_by', 'reviewed_at', 'rejection_reason'].some((field) => req.body[field] !== undefined)) return res.status(403).json({ error: 'Admin access required for review fields' })
    }
    if (entity === 'User' && current.rows[0].payload.email?.toLowerCase() === req.user.email.toLowerCase() && req.body.is_active === false) return res.status(400).json({ error: 'You cannot deactivate your own account' })
    const body = await prepareSourceBody(entity, req.body, req.user)
    const payload = sourcePayload(entity, req.params.id, body, req.user, current.rows[0].payload)
    await query(
      'UPDATE source_records SET payload = $3::jsonb, source_updated_at = NOW(), imported_at = NOW() WHERE entity_type = $1 AND source_id = $2',
      [entity, req.params.id, JSON.stringify(payload)],
    )
    if (entity === 'Task') await notifyTaskEvent('updated', payload, current.rows[0].payload, req.user)
    if (entity === 'Timesheet') await notifyTimesheetEvent('updated', payload, current.rows[0].payload, req.user)
    if (entity === 'User' && payload.email) {
      const databaseRole = payload.role === 'admin' ? 'admin' : 'member'
      await query(
        `UPDATE users SET role = $2, profile = profile || $3::jsonb, updated_at = NOW() WHERE LOWER(email) = LOWER($1)`,
        [payload.email, databaseRole, JSON.stringify({ is_active: payload.is_active !== false })],
      )
      if (payload.is_active === false) await removeEmployeeAssignments(payload.email)
    }
    res.json({ data: payload })
  } catch (error) { next(error) }
})

router.delete('/source/:entity/:id', async (req, res, next) => {
  try {
    const entity = req.params.entity
    if (!sourceEntities.has(entity)) return res.status(404).json({ error: 'Unknown entity' })
    const current = await query('SELECT payload FROM source_records WHERE entity_type = $1 AND source_id = $2', [entity, req.params.id])
    if (!current.rows[0]) return res.status(404).json({ error: 'Record not found' })
    if (req.user.role !== 'admin' && ['User', 'Project'].includes(entity)) return res.status(403).json({ error: 'Admin access required' })
    if (req.user.role !== 'admin' && entity === 'Task' && !isTaskAssignedTo(current.rows[0].payload, req.user.email)) return res.status(403).json({ error: 'This task is not assigned to you' })
    if (req.user.role !== 'admin' && ['Timesheet', 'Expense'].includes(entity) && !filterSourceRecordsForUser(entity, [current.rows[0].payload], req.user).length) return res.status(403).json({ error: 'You can only delete your own records' })
    const result = await query('DELETE FROM source_records WHERE entity_type = $1 AND source_id = $2 RETURNING payload', [entity, req.params.id])
    if (!result.rows[0]) return res.status(404).json({ error: 'Record not found' })
    if (entity === 'Task') await notifyTaskEvent('deleted', result.rows[0].payload, result.rows[0].payload, req.user)
    res.status(204).end()
  } catch (error) { next(error) }
})

router.post('/users/invite', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Email is required' })
    const id = randomUUID()
    const role = req.body.role === 'admin' ? 'admin' : 'user'
    const payload = sourcePayload('User', id, { email, full_name: email.split('@')[0], role, is_active: true }, req.user)
    await query('INSERT INTO source_records (entity_type, source_id, payload, source_created_at, source_updated_at) VALUES ($1, $2, $3::jsonb, NOW(), NOW())', ['User', id, JSON.stringify(payload)])
    try {
      const delivery = await sendInviteEmail({ email, role, inviter: req.user })
      if (!delivery.sent) {
        const error = new Error('Invitation email is not configured')
        error.status = 503
        throw error
      }
    } catch (error) {
      await query('DELETE FROM source_records WHERE entity_type = $1 AND source_id = $2', ['User', id])
      if (!error.status) error.status = 502
      throw error
    }
    res.status(201).json({ data: payload })
  } catch (error) { next(error) }
})

router.post('/integrations/email', async (req, res, next) => {
  try {
    const to = req.body.to
    const subject = String(req.body.subject || '').trim()
    const body = String(req.body.body || '').trim()
    if (!to || !subject || !body) return res.status(400).json({ error: 'Recipient, subject, and body are required' })
    const result = await sendEmail({ to, subject, body })
    res.json({ data: { success: result.sent, ...result } })
  } catch (error) { next(error) }
})

router.post('/integrations/summary', (req, res) => {
  const name = String(req.body.prompt || '').match(/Name:\s*([^\n]+)/)?.[1] || 'This employee'
  res.json({ data: `${name} demonstrates consistent contribution across assigned work and recorded hours. Their current completion and review metrics show dependable execution, with overdue items providing a clear area for continued focus. Maintaining timely updates and aligning upcoming goals with team priorities will support further growth.` })
})

router.get('/source', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    const result = await query('SELECT entity_type, COUNT(*)::int AS count FROM source_records GROUP BY entity_type ORDER BY entity_type')
    res.json({ data: result.rows })
  } catch (error) { next(error) }
})

for (const [resource, allowedFields] of Object.entries(resources)) {
  router.get(`/${resource}`, async (req, res, next) => {
    try {
      const result = await query(`SELECT * FROM ${resource} WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id])
      res.json({ data: result.rows })
    } catch (error) { next(error) }
  })

  router.post(`/${resource}`, async (req, res, next) => {
    try {
      const fields = allowedFields.filter((field) => req.body[field] !== undefined)
      if (!fields.length) return res.status(400).json({ error: 'At least one valid field is required' })
      const values = fields.map((field) => req.body[field])
      const placeholders = fields.map((_, index) => `$${index + 2}`).join(', ')
      const result = await query(
        `INSERT INTO ${resource} (user_id, ${fields.join(', ')}) VALUES ($1, ${placeholders}) RETURNING *`,
        [req.user.id, ...values],
      )
      res.status(201).json({ data: result.rows[0] })
    } catch (error) { next(error) }
  })

  router.patch(`/${resource}/:id`, async (req, res, next) => {
    try {
      const fields = allowedFields.filter((field) => req.body[field] !== undefined)
      if (!fields.length) return res.status(400).json({ error: 'At least one valid field is required' })
      const assignments = fields.map((field, index) => `${field} = $${index + 3}`).join(', ')
      const values = fields.map((field) => req.body[field])
      const result = await query(
        `UPDATE ${resource} SET ${assignments}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
        [req.params.id, req.user.id, ...values],
      )
      if (!result.rows[0]) return res.status(404).json({ error: 'Record not found' })
      res.json({ data: result.rows[0] })
    } catch (error) { next(error) }
  })

  router.delete(`/${resource}/:id`, async (req, res, next) => {
    try {
      const result = await query(`DELETE FROM ${resource} WHERE id = $1 AND user_id = $2 RETURNING id`, [req.params.id, req.user.id])
      if (!result.rows[0]) return res.status(404).json({ error: 'Record not found' })
      res.status(204).end()
    } catch (error) { next(error) }
  })
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
        (SELECT COUNT(*)::int FROM projects WHERE user_id = $1) AS total_projects,
        (SELECT COUNT(*)::int FROM projects WHERE user_id = $1 AND status = 'active') AS active_projects,
        (SELECT COUNT(*)::int FROM tasks WHERE user_id = $1) AS total_tasks,
        (SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND status = 'completed') AS completed_tasks,
        (SELECT COALESCE(SUM(hours), 0)::float FROM timesheets WHERE user_id = $1) AS total_hours,
        (SELECT COALESCE(SUM(amount), 0)::float FROM expenses WHERE user_id = $1) AS total_expenses,
        (SELECT COUNT(*)::int FROM notifications WHERE user_id = $1 AND is_read = FALSE) AS unread_notifications`,
      [req.user.id],
    )
    res.json({ data: result.rows[0] })
  } catch (error) { next(error) }
})

export default router
