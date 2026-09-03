import test from 'node:test'
import assert from 'node:assert/strict'
import { filterSourceRecordsForUser, inactiveAssignees, prepareEmployeeSubmission } from './access.js'

const employee = { email: 'employee@example.com', display_name: 'Employee', role: 'member' }
const projects = [
  { id: 'assigned', name: 'Assigned', team_members: ['employee@example.com'], budget: 50000, billing_rate: 150, profit: 9000 },
  { id: 'other', name: 'Other', team_members: ['someone@example.com'], budget: 10000 },
]
const tasks = [
  { id: 'mine', project_id: 'assigned', assigned_to: ['employee@example.com'] },
  { id: 'not-mine', project_id: 'assigned', assigned_to: ['someone@example.com'] },
]

test('employees receive only assigned projects with finance fields removed', () => {
  const records = filterSourceRecordsForUser('Project', projects, employee, tasks)
  assert.deepEqual(records.map((project) => project.id), ['assigned'])
  assert.equal(records[0].budget, undefined)
  assert.equal(records[0].billing_rate, undefined)
  assert.equal(records[0].profit, undefined)
})

test('employees receive only tasks assigned to their email', () => {
  assert.deepEqual(filterSourceRecordsForUser('Task', tasks, employee).map((task) => task.id), ['mine'])
})

test('employees receive only their own timesheets and expenses', () => {
  const timesheets = [
    { id: 'mine', employee_email: employee.email },
    { id: 'other', employee_email: 'someone@example.com' },
  ]
  const expenses = [
    { id: 'mine', submitted_by: employee.email },
    { id: 'other', submitted_by_email: 'someone@example.com' },
  ]
  assert.deepEqual(filterSourceRecordsForUser('Timesheet', timesheets, employee).map((record) => record.id), ['mine'])
  assert.deepEqual(filterSourceRecordsForUser('Expense', expenses, employee).map((record) => record.id), ['mine'])
})

test('employee timesheets reject unassigned tasks and overwrite identity', () => {
  assert.throws(
    () => prepareEmployeeSubmission('Timesheet', { project_id: 'assigned', task_id: 'not-mine' }, employee, projects, tasks),
    /tasks assigned to you/,
  )
  assert.equal(
    prepareEmployeeSubmission('Timesheet', { project_id: 'assigned', task_id: 'mine', employee_email: 'spoof@example.com' }, employee, projects, tasks).employee_email,
    employee.email,
  )
})

test('inactive and unknown users cannot be assigned', () => {
  const users = [
    { email: 'active@example.com', is_active: true },
    { email: 'inactive@example.com', is_active: false },
  ]
  assert.deepEqual(inactiveAssignees(['active@example.com', 'inactive@example.com', 'missing@example.com'], users), [
    'inactive@example.com',
    'missing@example.com',
  ])
})