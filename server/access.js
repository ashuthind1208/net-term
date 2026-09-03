const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const sensitiveProjectFields = [
  'budget',
  'billing_rate',
  'actual_cost',
  'estimated_cost',
  'labour_cost',
  'labor_cost',
  'total_cost',
  'revenue',
  'profit',
  'profit_margin',
]

export function isAccountActive(user) {
  return user?.is_active !== false && user?.profile?.is_active !== false
}

export function isTaskAssignedTo(task, email) {
  const normalizedEmail = normalizeEmail(email)
  return (task?.assigned_to || []).some((assignee) => normalizeEmail(assignee) === normalizedEmail)
}

export function isProjectAssignedTo(project, email, tasks = []) {
  const normalizedEmail = normalizeEmail(email)
  return (project?.team_members || []).some((member) => normalizeEmail(member) === normalizedEmail)
    || normalizeEmail(project?.manager_email) === normalizedEmail
    || tasks.some((task) => task.project_id === project?.id && isTaskAssignedTo(task, normalizedEmail))
}

export function sanitizeProjectForEmployee(project) {
  const sanitized = { ...project }
  sensitiveProjectFields.forEach((field) => delete sanitized[field])
  return sanitized
}

export function filterSourceRecordsForUser(entity, records, user, tasks = []) {
  if (user?.role === 'admin') return records
  const email = normalizeEmail(user?.email)

  if (entity === 'Project') {
    return records
      .filter((project) => isProjectAssignedTo(project, email, tasks))
      .map(sanitizeProjectForEmployee)
  }
  if (entity === 'Task') return records.filter((task) => isTaskAssignedTo(task, email))
  if (entity === 'Timesheet') return records.filter((entry) => normalizeEmail(entry.employee_email) === email)
  if (entity === 'Expense') {
    return records.filter((entry) => normalizeEmail(entry.submitted_by_email || entry.submitted_by) === email)
  }
  if (entity === 'Notification') return records.filter((entry) => normalizeEmail(entry.recipient_email) === email)
  if (entity === 'User') {
    return records.filter(isAccountActive).map((record) => ({
      id: record.id,
      email: record.email,
      full_name: record.full_name,
      photo_url: record.photo_url,
      role: record.role,
      job_title: record.job_title,
      department: record.department,
      is_active: record.is_active !== false,
    }))
  }
  return records
}

export function prepareEmployeeSubmission(entity, body, user, projects, tasks) {
  if (!['Timesheet', 'Expense'].includes(entity)) return body
  const project = projects.find((record) => record.id === body.project_id)
  if (!project || !isProjectAssignedTo(project, user.email, tasks)) {
    const error = new Error('You can only submit records for projects assigned to you')
    error.status = 403
    throw error
  }

  if (entity === 'Timesheet' && body.task_id) {
    const task = tasks.find((record) => record.id === body.task_id)
    if (!task || task.project_id !== project.id || !isTaskAssignedTo(task, user.email)) {
      const error = new Error('You can only log time against tasks assigned to you')
      error.status = 403
      throw error
    }
  }

  if (entity === 'Timesheet') {
    return { ...body, employee_email: user.email, employee_name: user.display_name || user.email }
  }
  return { ...body, submitted_by: user.email, submitted_by_email: user.email, submitted_by_name: user.display_name || user.email }
}

export function inactiveAssignees(assignedTo, users) {
  const activeEmails = new Set(users.filter(isAccountActive).map((user) => normalizeEmail(user.email)))
  return [...new Set((assignedTo || []).map(normalizeEmail).filter((email) => email && !activeEmails.has(email)))]
}