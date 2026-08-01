import nodemailer from 'nodemailer'

const smtpConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD,
)

const transporter = smtpConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
}) : null

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalizeRecipients(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(values.filter(Boolean).map((email) => String(email).trim().toLowerCase()).filter(Boolean))]
}

function headerPill(label, tone = 'gold') {
  const tones = {
    gold: 'background:#f1bd8c;color:#210f37;border:1px solid #dca06d',
    plum: 'background:#4f1c51;color:#ffffff;border:1px solid #8d6790',
  }
  return `<span style="display:inline-block;margin:0 0 4px 6px;padding:4px 8px;border-radius:999px;${tones[tone] || tones.gold};font:700 9px Arial,sans-serif;letter-spacing:.4px;text-transform:uppercase">${escapeHtml(label)}</span>`
}

export function emailShell({ eyebrow, title, intro, content, actionLabel, actionUrl, headerAction, headerActor, recordTitle }) {
  const titleFontSize = String(title).length > 56 ? 14 : 16
  const hasStructuredHeader = Boolean(recordTitle || headerAction || headerActor)
  const normalizedEyebrow = String(eyebrow || '').trim()
  const normalizedTitle = String(title || '').trim()
  const showEyebrow = normalizedEyebrow
    && normalizedTitle.toLowerCase() !== normalizedEyebrow.toLowerCase()
    && !normalizedTitle.toLowerCase().startsWith(`${normalizedEyebrow.toLowerCase()}:`)
  const eyebrowHtml = showEyebrow
    ? `<div style="margin-top:22px;color:#f1bd8c;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(normalizedEyebrow)}</div>`
    : ''
  const structuredHeaderHtml = hasStructuredHeader ? `
    <div data-email-meta style="text-align:right;line-height:1.5">
      ${headerAction ? headerPill(headerAction, 'gold') : ''}
      ${headerActor ? headerPill(`By ${headerActor}`, 'plum') : ''}
    </div>` : ''
  const visualTitleHtml = hasStructuredHeader
    ? `<div data-email-record-title style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(241,189,140,.35);color:#ffffff;font:700 20px/1.35 Arial,sans-serif;letter-spacing:0;overflow-wrap:anywhere">${escapeHtml(recordTitle || title)}</div>`
    : `<div data-email-title style="margin:${showEyebrow ? '5px' : '2px'} 0 0 auto;max-width:390px;color:#ffffff;font:700 ${titleFontSize}px/1.35 Arial,sans-serif;letter-spacing:0;overflow-wrap:anywhere;text-align:right">${escapeHtml(title)}</div>`
  const button = actionUrl ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 4px;border-top:1px solid #eee8ef;padding-top:18px">
      <tr><td align="right" style="border-radius:6px">
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:6px;background:#a55b4b;padding:14px 22px;color:#ffffff;text-decoration:none;font:700 14px Arial,sans-serif">${escapeHtml(actionLabel || 'View details')} &rarr;</a>
      </td></tr>
    </table>` : ''

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f2f6;color:#210f37">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(intro)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2f6;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e8e0e8;border-radius:8px;overflow:hidden">
          <tr><td style="padding:24px 34px;background:#210f37;color:#ffffff">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td valign="top" style="white-space:nowrap">
                  <div style="font:800 18px Arial,sans-serif"><span style="color:#f1bd8c">NET</span><span style="color:#dca06d"> TERM</span></div>
                  <div style="margin-top:2px;color:#f1bd8c;font:700 8px Arial,sans-serif;letter-spacing:2.6px">SOLUTIONS</div>
                </td>
                <td valign="top" align="right" style="padding-left:24px;text-align:right">
                  ${hasStructuredHeader ? structuredHeaderHtml : eyebrowHtml}
                  ${hasStructuredHeader ? '' : visualTitleHtml}
                </td>
              </tr>
            </table>
            ${hasStructuredHeader ? visualTitleHtml : ''}
          </td></tr>
          <tr><td style="padding:32px 34px;font:14px/1.65 Arial,sans-serif;color:#493b4f">
            <p style="margin:0 0 24px;font-size:16px;color:#493b4f">${escapeHtml(intro)}</p>
            ${content}
            ${button}
          </td></tr>
          <tr><td style="padding:18px 34px;border-top:1px solid #eee8ef;color:#8a7c8d;font:12px/1.5 Arial,sans-serif">
            This automated message was sent by Net Term Solutions. Please do not share workspace links outside your organization.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export function prepareEmailContent(body, html) {
  const text = String(body || '').trim()
  const textLines = text.split('\n')
  const intro = textLines.find((line) => line.trim())?.trim() || ''
  const introIndex = textLines.findIndex((line) => line.trim())
  const remainingText = introIndex >= 0
    ? [...textLines.slice(0, introIndex), ...textLines.slice(introIndex + 1)].join('\n').trim()
    : ''
  const content = html || (remainingText
    ? `<div style="white-space:pre-line">${escapeHtml(remainingText).replaceAll('\n', '<br>')}</div>`
    : '')
  return { text, intro, content }
}

export function getStructuredSubject(subject) {
  const normalizedSubject = String(subject || '').trim()
  const separatorIndex = normalizedSubject.indexOf(':')
  if (separatorIndex < 1 || separatorIndex === normalizedSubject.length - 1) return {}
  return {
    headerAction: `${normalizedSubject.slice(0, separatorIndex).trim()}:`,
    recordTitle: normalizedSubject.slice(separatorIndex + 1).trim(),
  }
}

export async function sendEmail({ to, subject, body, html, eyebrow = 'Workspace notification', actionLabel, actionUrl, headerAction, headerActor, recordTitle }) {
  const recipients = normalizeRecipients(to)
  if (!recipients.length) return { sent: false, skipped: true, reason: 'no_recipients' }
  if (!transporter) return { sent: false, skipped: true, reason: 'smtp_not_configured' }

  const prepared = prepareEmailContent(body, html)
  const intro = prepared.intro || subject
  const inferredHeader = getStructuredSubject(subject)
  const messageHtml = emailShell({
    eyebrow,
    title: subject,
    intro,
    content: prepared.content,
    actionLabel,
    actionUrl,
    headerAction: headerAction || inferredHeader.headerAction,
    headerActor,
    recordTitle: recordTitle || inferredHeader.recordTitle,
  })
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER
  const fromName = process.env.EMAIL_FROM_NAME || 'Net Term Solutions'

  const info = await transporter.sendMail({
    from: { name: fromName, address: fromAddress },
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    to: recipients,
    subject,
    text: prepared.text || subject,
    html: messageHtml,
  })

  return { sent: true, messageId: info.messageId, recipients }
}

const fieldLabels = {
  title: 'Title',
  description: 'Description',
  project_name: 'Project',
  status: 'Status',
  priority: 'Priority',
  assigned_to: 'Assignees',
  start_date: 'Start date',
  due_date: 'Due date',
  estimated_hours: 'Estimated hours',
}

function displayValue(field, value) {
  if (Array.isArray(value)) return value.join(', ') || 'None'
  if (field === 'status') return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  return value === undefined || value === null || value === '' ? 'Not set' : String(value)
}

function taskDetails(task) {
  const rows = [
    ['Project', task.project_name || 'Not set'],
    ['Status', displayValue('status', task.status)],
    ['Priority', displayValue('priority', task.priority)],
    ['Due date', task.due_date || 'Not set'],
    ['Assigned to', displayValue('assigned_to', task.assigned_to)],
  ]
  return `<div style="margin:0 0 7px;color:#4f1c51;font:800 11px Arial,sans-serif;letter-spacing:.8px;text-transform:uppercase">Task details</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #eee8ef">
    ${rows.map(([label, value]) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;background:#faf8fa;color:#8a7c8d;width:30%;font-size:12px">${escapeHtml(label)}</td><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;color:#210f37;font-size:12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join('')}
  </table>${task.description ? `<div style="margin-top:16px;padding:10px 12px;border-left:3px solid #dca06d;background:#fbf9fb"><strong style="color:#4f1c51;font-size:11px;text-transform:uppercase;letter-spacing:.6px">Description</strong><p style="margin:5px 0 0;white-space:pre-line;font-size:13px">${escapeHtml(task.description)}</p></div>` : ''}`
}

function taskChanges(previous, task) {
  return Object.entries(fieldLabels).flatMap(([field, label]) => {
    const before = JSON.stringify(previous?.[field] ?? null)
    const after = JSON.stringify(task?.[field] ?? null)
    if (before === after) return []
    return [{ label, before: displayValue(field, previous?.[field]), after: displayValue(field, task?.[field]) }]
  })
}

function changeTable(changes) {
  if (!changes.length) return '<p style="margin:0;color:#8a7c8d">Task metadata was refreshed.</p>'
  return `<div style="margin:0 0 7px;color:#4f1c51;font:800 11px Arial,sans-serif;letter-spacing:.8px;text-transform:uppercase">Changes made</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #eee8ef">
    <tr><th align="left" style="padding:7px 10px;background:#4f1c51;color:#ffffff;font-size:10px;text-transform:uppercase">Field</th><th align="left" style="padding:7px 10px;background:#4f1c51;color:#ffffff;font-size:10px;text-transform:uppercase">Before</th><th align="left" style="padding:7px 10px;background:#4f1c51;color:#ffffff;font-size:10px;text-transform:uppercase">After</th></tr>
    ${changes.map(({ label, before, after }) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;font-size:12px;font-weight:700;color:#210f37">${escapeHtml(label)}</td><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;font-size:12px;color:#8a7c8d">${escapeHtml(before)}</td><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;font-size:12px;color:#4f1c51;font-weight:600">${escapeHtml(after)}</td></tr>`).join('')}
  </table>`
}

export function buildTaskEventEmail({ event, task, previous, actor }) {
  const actorName = actor?.display_name || actor?.email || 'A team member'
  const eventConfig = {
    created: { label: 'Task added', intro: `${actorName} created this task and assigned it to the listed team members.` },
    updated: task?.status === 'completed' && previous?.status !== 'completed'
      ? { label: 'Task completed', intro: `${actorName} marked this task as completed.` }
      : { label: 'Task updated', intro: `${actorName} updated this task. Review the changes below.` },
    deleted: { label: 'Task deleted', intro: `${actorName} deleted this task. This record is no longer available.` },
  }
  const eventDetails = eventConfig[event] || { label: 'Task updated', intro: `${actorName} updated this task. Review the changes below.` }
  const eventLabel = eventDetails.label
  const taskTitle = task.title || previous?.title || 'Task'
  const appUrl = String(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '')
  const actionUrl = event === 'deleted' ? `${appUrl}/Tasks` : `${appUrl}/Tasks?task=${encodeURIComponent(task.id)}`
  const content = event === 'updated'
    ? `${changeTable(taskChanges(previous, task))}<div style="margin-top:24px">${taskDetails(task)}</div>`
    : taskDetails(task)

  return {
    subject: `${eventLabel}: ${taskTitle}`,
    body: `${eventDetails.intro}\nTask: ${taskTitle}\nProject: ${task.project_name || previous?.project_name || 'Not set'}\nStatus: ${displayValue('status', task.status || previous?.status)}`,
    html: content,
    headerAction: `${eventLabel}:`,
    headerActor: actorName,
    recordTitle: taskTitle,
    actionLabel: event === 'deleted' ? 'Open task list' : 'Open this task',
    actionUrl,
  }
}

export async function sendTaskEventEmail({ event, task, previous, actor }) {
  const auditRecipients = normalizeRecipients(process.env.EMAIL_AUDIT_TO)
  const recipients = normalizeRecipients([
    ...(previous?.assigned_to || []),
    ...(task?.assigned_to || []),
    previous?.created_by,
    task?.created_by,
    ...auditRecipients,
  ])
  if (!recipients.length) return { sent: false, skipped: true, reason: 'no_recipients' }

  return sendEmail({
    to: recipients,
    ...buildTaskEventEmail({ event, task, previous, actor }),
  })
}

function timesheetDetails(timesheet) {
  const rows = [
    ['Employee', timesheet.employee_name || timesheet.employee_email || 'Not set'],
    ['Project', timesheet.project_name || 'Not set'],
    ['Task', timesheet.task_title || 'Not set'],
    ['Work date', timesheet.date || 'Not set'],
    ['Regular hours', `${timesheet.hours || 0}h`],
    ['Overtime hours', `${timesheet.overtime_hours || 0}h`],
    ['Status', displayValue('status', timesheet.status)],
  ]
  return `<div style="margin:0 0 7px;color:#4f1c51;font:800 11px Arial,sans-serif;letter-spacing:.8px;text-transform:uppercase">Timesheet details</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #eee8ef">
    ${rows.map(([label, value]) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;background:#faf8fa;color:#8a7c8d;width:30%;font-size:12px">${escapeHtml(label)}</td><td style="padding:7px 10px;border-bottom:1px solid #eee8ef;color:#210f37;font-size:12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join('')}
  </table>${timesheet.description ? `<div style="margin-top:16px;padding:10px 12px;border-left:3px solid #dca06d;background:#fbf9fb"><strong style="color:#4f1c51;font-size:11px;text-transform:uppercase;letter-spacing:.6px">Work summary</strong><p style="margin:5px 0 0;white-space:pre-line;font-size:13px">${escapeHtml(timesheet.description)}</p></div>` : ''}${timesheet.rejection_reason ? `<div style="margin-top:16px;padding:10px 12px;background:#fff1f2;border-left:3px solid #ef4056"><strong style="color:#9f1239;font-size:11px;text-transform:uppercase;letter-spacing:.6px">Rejection reason</strong><p style="margin:5px 0 0;color:#881337;font-size:13px">${escapeHtml(timesheet.rejection_reason)}</p></div>` : ''}`
}

export function buildTimesheetEventEmail({ event, timesheet, previous, actor }) {
  const isSubmission = event === 'submitted'
  const actorName = actor?.display_name || actor?.email || timesheet.employee_name || timesheet.employee_email || 'A team member'
  const statusChanged = previous?.status !== timesheet.status
  const eventLabel = isSubmission ? 'Timesheet submitted' : statusChanged && timesheet.status === 'approved' ? 'Timesheet approved' : statusChanged && timesheet.status === 'rejected' ? 'Timesheet rejected' : 'Timesheet updated'
  const appUrl = String(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '')
  const reviewUrl = `${appUrl}/Timesheets?timesheet=${encodeURIComponent(timesheet.id)}${timesheet.status === 'pending' ? '&review=1' : ''}`
  const intro = isSubmission ? `${actorName} submitted this timesheet for review.`
    : timesheet.status === 'approved' && statusChanged ? `${actorName} approved this timesheet.`
      : timesheet.status === 'rejected' && statusChanged ? `${actorName} rejected this timesheet.`
        : `${actorName} updated this timesheet.`
  const recordTitle = timesheet.project_name || timesheet.task_title || 'Timesheet'

  return {
    subject: `${eventLabel}: ${recordTitle}`,
    body: `${intro}\nEmployee: ${timesheet.employee_name || timesheet.employee_email || 'Not set'}\nDate: ${timesheet.date || 'Not set'}\nHours: ${timesheet.hours || 0}\nStatus: ${displayValue('status', timesheet.status)}`,
    html: timesheetDetails(timesheet),
    headerAction: `${eventLabel}:`,
    headerActor: actorName,
    recordTitle,
    actionLabel: timesheet.status === 'pending' ? 'Review timesheet' : 'View timesheet',
    actionUrl: reviewUrl,
  }
}

export async function sendTimesheetEventEmail({ event, timesheet, previous, actor, adminEmails = [] }) {
  const isSubmission = event === 'submitted'
  const auditRecipients = normalizeRecipients(process.env.EMAIL_AUDIT_TO)
  const recipients = normalizeRecipients([
    ...adminEmails,
    ...auditRecipients,
    ...(isSubmission ? [] : [timesheet.employee_email, previous?.employee_email]),
  ])
  if (!recipients.length) return { sent: false, skipped: true, reason: 'no_recipients' }

  return sendEmail({
    to: recipients,
    ...buildTimesheetEventEmail({ event, timesheet, previous, actor }),
  })
}

export { smtpConfigured }
