import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInviteEmail, buildTaskEventEmail, buildTimesheetEventEmail, emailShell, getStructuredSubject, prepareEmailContent } from './email.js'

const duplicateEventLabels = [
  'Timesheet submitted',
  'Timesheet approved',
  'Timesheet rejected',
  'Timesheet updated',
  'Task assigned',
  'Task updated',
  'Task completed',
  'Task deleted',
]

test('event labels are not repeated above matching email titles', () => {
  duplicateEventLabels.forEach((eventLabel) => {
    const html = emailShell({
      eyebrow: eventLabel,
      title: `${eventLabel}: Example record`,
      intro: 'An event occurred.',
      content: '<p>Details</p>',
    })
    assert.equal((html.match(new RegExp(eventLabel, 'gi')) || []).length, 1)
    assert.match(html, /data-email-title/)
    assert.match(html, /text-align:right/)
    assert.match(html, /font:700 16px\/1\.35 Arial/)
  })
})

test('long email titles use the smaller masthead font', () => {
  const html = emailShell({
    eyebrow: 'Workspace notification',
    title: 'Task updated: A deliberately long task title for a detailed customer deployment',
    intro: 'A task changed.',
    content: '<p>Details</p>',
  })
  assert.match(html, /font:700 14px\/1\.35 Arial/)
})

test('distinct email eyebrows remain visible', () => {
  const html = emailShell({
    eyebrow: 'Workspace notification',
    title: 'Expense requires review',
    intro: 'A new expense was submitted.',
    content: '<p>Details</p>',
  })
  assert.match(html, /Workspace notification/)
  assert.match(html, /Expense requires review/)
})

test('generic email intro is removed from repeated body content', () => {
  const prepared = prepareEmailContent('A new expense was submitted.\nProject: Office retrofit\nAmount: $125')
  assert.equal(prepared.intro, 'A new expense was submitted.')
  assert.doesNotMatch(prepared.content, /A new expense was submitted/)
  assert.match(prepared.content, /Project: Office retrofit/)
  assert.match(prepared.content, /Amount: \$125/)
})

test('workspace invitation identifies the inviter, recipient, role, and join action', () => {
  const payload = buildInviteEmail({
    email: 'new.employee@example.com',
    role: 'user',
    inviter: { display_name: 'Workspace Admin' },
  })

  assert.equal(payload.subject, 'You are invited to Net Term Solutions')
  assert.match(payload.body, /Workspace Admin invited you/)
  assert.match(payload.html, /new\.employee@example\.com/)
  assert.match(payload.html, /Team member/)
  assert.equal(payload.actionLabel, 'Join the workspace')
  assert.match(payload.actionUrl, /^https?:\/\//)
})

function renderTaskEmail(event, overrides = {}) {
  const previous = {
    id: 'task-123',
    title: 'New test task for someone',
    project_name: 'AMD Process securing',
    status: 'todo',
    priority: 'medium',
    assigned_to: ['person@example.com'],
    due_date: '2026-08-15',
    ...overrides.previous,
  }
  const task = {
    ...previous,
    status: event === 'deleted' ? previous.status : 'in_progress',
    priority: 'high',
    description: 'Secure and validate the assigned process.',
    ...overrides.task,
  }
  const payload = buildTaskEventEmail({
    event,
    task,
    previous,
    actor: { display_name: 'Aashoodeep Singh Thind', email: 'admin@example.com' },
  })
  const prepared = prepareEmailContent(payload.body, payload.html)
  return {
    payload,
    html: emailShell({ ...payload, intro: prepared.intro, content: prepared.content }),
  }
}

test('updated task email separates action, actor, and task title in the header', () => {
  const { payload, html } = renderTaskEmail('updated')
  assert.equal(payload.subject, 'Task updated: New test task for someone')
  assert.match(html, /data-email-meta/)
  assert.match(html, />Task updated:</)
  assert.match(html, />By Aashoodeep Singh Thind</)
  assert.match(html, /data-email-record-title/)
  assert.match(html, /font:700 20px\/1\.35 Arial/)
  assert.match(html, />New test task for someone</)
  assert.match(html, /Aashoodeep Singh Thind updated this task\. Review the changes below\./)
  assert.match(html, /Changes made/)
  assert.match(html, /Task details/)
  assert.match(html, /Open this task/)
  assert.match(html, /\/Tasks\?task=task-123/)
})

test('task event wording and CTA reflect added, completed, and deleted actions', () => {
  const added = renderTaskEmail('created')
  assert.match(added.html, />Task added:</)
  assert.match(added.html, /created this task and assigned it to the listed team members/)

  const completed = renderTaskEmail('updated', { task: { status: 'completed' } })
  assert.match(completed.html, />Task completed:</)
  assert.match(completed.html, /marked this task as completed/)

  const deleted = renderTaskEmail('deleted')
  assert.match(deleted.html, />Task deleted:</)
  assert.match(deleted.html, /deleted this task\. This record is no longer available/)
  assert.match(deleted.html, /Open task list/)
  assert.match(deleted.html, /\/Tasks"/)
})

test('generic action subjects split into an action pill and record title', () => {
  assert.deepEqual(getStructuredSubject('New Expense Submitted: Server rack'), {
    headerAction: 'New Expense Submitted:',
    recordTitle: 'Server rack',
  })
  assert.deepEqual(getStructuredSubject('A message without a record title'), {})
})

test('timesheet email uses the structured header, condensed details, and exact CTA', () => {
  const payload = buildTimesheetEventEmail({
    event: 'updated',
    previous: { status: 'pending' },
    timesheet: {
      id: 'time-456',
      employee_name: 'Jordan Lee',
      employee_email: 'jordan@example.com',
      project_name: 'Network rollout',
      task_title: 'Site validation',
      date: '2026-08-15',
      hours: 7.5,
      status: 'approved',
      description: 'Validated the installation.',
    },
    actor: { display_name: 'Aashoodeep Singh Thind' },
  })
  const prepared = prepareEmailContent(payload.body, payload.html)
  const html = emailShell({ ...payload, intro: prepared.intro, content: prepared.content })
  assert.match(html, />Timesheet approved:</)
  assert.match(html, />By Aashoodeep Singh Thind</)
  assert.match(html, />Network rollout</)
  assert.match(html, /approved this timesheet/)
  assert.match(html, /Timesheet details/)
  assert.match(html, /padding:7px 10px/)
  assert.match(html, /View timesheet/)
  assert.match(html, /\/Timesheets\?timesheet=time-456/)
})