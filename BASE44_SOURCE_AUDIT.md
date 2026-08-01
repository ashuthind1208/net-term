# Base44 Source Audit

Source application: Net Term Solutions
Base44 app ID: `6997a32ce6374c33f6068ac0`
Captured: 2026-08-01 from the authenticated Base44 code workspace
Scope: source structure, entity schemas, routes, role behavior, links, queries, mutations, computed data, integrations, defects, and local-clone parity

## 1. Snapshot Summary

The authenticated `/sandbox/files` response contained **125 files** and **772,917 source characters**.

| Area | Count | Notes |
|---|---:|---|
| Entity schemas | 17 | `base44/entities/*.jsonc` |
| Page modules | 22 | `src/pages/*.jsx` |
| UI primitives | 49 | Radix/shadcn components under `src/components/ui/` |
| Application components | 6 | Search, notifications, pagination, auth guard, assignee selection, registration error |
| Internal documents | 5 | Database, file structure, UI layouts, QA/UAT, README |
| Library modules | 7 | Auth, query client, routing helpers, exports, app parameters, navigation tracking, 404 |
| Hooks | 1 | Mobile viewport detection |

The runtime is React 18 + Vite 6 + React Router 6. Data and authentication use `@base44/sdk`. The application also uses TanStack Query, Recharts, date-fns, jsPDF, Radix/shadcn, Lucide, and `@hello-pangea/dnd`.

The source tree contains documentation that predates later features. For example, `src/docs/FILE_STRUCTURE.md` documents eight pages and five entities, while the current source contains 22 pages and 17 entities. The code and JSONC schemas are authoritative where documentation conflicts.

## 2. Runtime Architecture

- `src/api/base44Client.js` creates the Base44 SDK client.
- `src/lib/AuthContext.jsx` calls `base44.auth.me()`, redirects unauthenticated users, and distinguishes unregistered users.
- `src/App.jsx` wraps the app in auth, query-client, router, navigation tracking, and toast providers.
- `src/pages.config.js` auto-registers eight original pages and declares `Dashboard` as `/`.
- `src/App.jsx` explicitly registers 14 later pages in addition to the generated route loop.
- `src/Layout.jsx` selects one of two sidebar definitions after calling `base44.auth.me()`.
- Most pages fetch complete entity lists and apply role scoping, search, filters, grouping, and aggregation in the browser.
- Base44 relationships are application-enforced IDs, email strings, arrays, and denormalized labels. The JSON schemas do not declare relational foreign-key constraints.

## 3. Routes and Navigation

### Generated routes

`pages.config.js` registers:

| Route | Page | Navigation |
|---|---|---|
| `/` | Dashboard | Root landing page for every role |
| `/Dashboard` | Dashboard | Admin sidebar |
| `/Employees` | Employees | Admin sidebar |
| `/Expenses` | Expenses | Both sidebars |
| `/Profile` | Profile | Account menu |
| `/Projects` | Projects | Both sidebars |
| `/Tasks` | Tasks | Both sidebars |
| `/Timesheets` | Timesheets | Both sidebars |
| `/TaskAssignment` | Task Assignment | Admin sidebar |

### Explicit routes

| Route | Page | Navigation |
|---|---|---|
| `/Activity` | Activity | Hidden/direct only |
| `/Reports` | Reports | Admin sidebar |
| `/MyWork` | My Work | Employee sidebar |
| `/BudgetTracker` | Budget Tracker | Hidden/direct only |
| `/TeamConnect` | Team Connect | Both sidebars |
| `/GanttScheduler` | Gantt Scheduler | Admin sidebar |
| `/Approvals` | Approvals | Hidden/direct only |
| `/Procurement` | Procurement | Admin sidebar |
| `/ComplianceAudit` | Compliance & Audit | Admin sidebar |
| `/ResourcePlanning` | Resource Planning | Admin sidebar |
| `/DocumentHub` | Document Hub | Admin sidebar |
| `/BillingModule` | Billing & Invoicing | Admin sidebar |
| `/NotificationCenter` | Notification Center | Both sidebars |
| `/PerformanceRewards` | Performance & Rewards | Both sidebars |
| `*` | Page Not Found | Fallback |

`createPageUrl(pageName)` returns `"/" + pageName.replace(/ /g, "-")`. The sidebar uses keys without spaces, so its paths match the registered routes. Notification `link_page` values are converted with the same helper.

### Admin sidebar: 17 links

Dashboard, Projects, Tasks, Expenses, Timesheets, Employees, Task Assignment, Procurement, Billing & Invoicing, Resource Planning, Performance, Reports, Gantt / Scheduler, Document Hub, Notifications, Compliance & Audit, Team Connect.

### Employee sidebar: 8 links

Dashboard (`/MyWork`), Projects, Tasks, Expenses, Timesheets, Performance, Notifications, Team Connect.

### Route protection caveat

Authentication is enforced globally, but `ProtectedRoute.jsx` is not used by `App.jsx`. Sidebar hiding is not route authorization. Several pages perform their own admin check, but protection is inconsistent. A non-admin can attempt direct navigation to every registered URL, including admin routes.

The root route always renders `Dashboard`, despite the employee sidebar treating `/MyWork` as the employee dashboard. This creates a second path into dashboard behavior for employees.

## 4. Exact Entity Model

Every Base44 record also has system fields `id`, `created_date`, `updated_date`, and `created_by`.

Legend: `*` means required. Defaults are shown after `=`. Enums are shown in braces.

### Project

`name*`; `description`; `location`; `status=planning {planning, active, on_hold, completed, cancelled}`; `priority=medium {low, medium, high, critical}`; `start_date`; `end_date`; `budget`; `billing_rate`; `client_name`; `client_email`; `tags[]`; `team_members[]`; `manager_email`; `color`; `completion_percentage=0`.

Primary relationships: Tasks, Timesheets, Expenses, Procurement, Invoices, Goals, Documents, Risks, and Blockers use `project_id`. Access and ownership also use `team_members[]` and `manager_email` email values.

### Task

`title*`; `description`; `project_id*`; `project_name`; `assigned_to[]`; `assignee_rates[]`; `status=todo {todo, in_progress, in_review, completed, blocked}`; `priority=medium {low, medium, high, critical}`; `due_date`; `start_date`; `estimated_hours`; `actual_hours`; `tags[]`; `attachments[]`; `comments[]`; `completed_at`.

`project_name` is denormalized. Assignees are user emails. `assignee_rates` stores per-assignee objects used by project-finance calculations.

### Timesheet

`employee_email`; `employee_name`; `project_id*`; `project_name`; `task_id`; `task_title`; `date*`; `hours*`; `overtime_hours=0`; `overtime_reason`; `description`; `status=pending {pending, approved, rejected}`; `reviewed_by`; `reviewed_at`; `rejection_reason`.

### Expense

`title*`; `amount*`; `currency=USD`; `category*`; `project_id*`; `project_name`; `description`; `date*`; `receipt_url`; `status=pending {pending, approved, rejected}`; `submitted_by`; `submitted_by_name`; `reviewed_by`; `reviewed_at`; `rejection_reason`.

`category` links to `ExpenseCategory.name`, not an ID.

### ExpenseCategory

`name*`; `icon`; `color`.

The Expense page can create categories dynamically. Documented examples are Travel, Equipment, Software, Meals, Office Supplies, Marketing, and Other.

### User

`role=user {admin, user, manager}`; `photo_url`; `department`; `phone`; `job_title`; `is_active=true`; `hourly_rate`.

Base44 also provides built-in identity fields such as `id`, `full_name`, and `email`. The current schema does **not** declare the richer Profile page fields `location`, `bio`, `employment_type`, `start_date`, `emergency_contact`, or `skills`; code that persists them depends on Base44 accepting undeclared fields. Older documentation calls `job_title` `position`.

### Invoice

`invoice_number`; `project_id*`; `project_name`; `client_name*`; `client_email`; `amount*`; `tax_rate=0`; `total_amount`; `status=draft {draft, sent, paid, overdue, cancelled}`; `due_date`; `paid_date`; `notes`; `currency=USD`; `line_items[]`.

### Procurement

`title*`; `type=purchase {purchase, sale, rental, service}`; `category=equipment* {tools, equipment, networking, wiring, hardware, software, consumables, other}`; `project_id*`; `project_name`; `vendor_supplier`; `quantity=1*`; `unit`; `unit_price*`; `total_amount`; `currency=USD`; `status=draft {draft, pending_approval, approved, ordered, delivered, cancelled}`; `priority=medium {low, medium, high, critical}`; `order_date`; `expected_delivery`; `actual_delivery`; `description`; `notes`; `receipt_url`; `requested_by`; `requested_by_name`; `approved_by`; `approved_at`; `rejection_reason`; `serial_numbers[]`; `warranty_until`; `location_assigned`.

The UI also refers to `reorder_threshold` and `quantity_available`, but neither is declared in `Procurement.jsonc`.

### AssetUsage

`procurement_id*`; `procurement_title`; `project_id`; `project_name`; `quantity_used*`; `unit`; `used_by`; `used_by_name`; `usage_date`; `notes`.

### Notification

`recipient_email*`; `title*`; `message*`; `type=general {task, expense, timesheet, procurement, project, blocker, general}`; `link_page`; `is_read=false`; `sender_name`; `sender_email`.

### Blocker

`type* {technical, dependency, access, clarity, resource, other}`; `urgency=medium {low, medium, high}`; `status=open {open, in_progress, resolved}`; `project_id`; `project_name`; `task_id`; `task_title`; `description*`; `reporter_name`; `reporter_email`; `resolved_at`; `resolution_note`.

### Document

`title*`; `category=other* {sop, contract, meeting_notes, report, specification, other}`; `project_id`; `project_name`; `task_id`; `file_url`; `version=1.0`; `description`; `tags[]`; `uploaded_by`; `uploaded_by_name`.

### EmployeeReview

`employee_email*`; `employee_name`; `reviewer_email*`; `reviewer_name`; `review_period`; `rating*`; `strengths`; `areas_for_improvement`; `goals`; `comments`; `skills[]`; `certifications[]`.

### AuditLog

`action*`; `entity_type* {Expense, Timesheet, Procurement, Task, Project, User}`; `entity_id`; `entity_title`; `actor_email*`; `actor_name`; `project_id`; `project_name`; `changes`; `ip_address`.

The Compliance page can synthesize activity from other entities if native audit records are unavailable. Those fallback records are not a true write-time audit trail.

### Goal

`title*`; `description`; `type=individual* {company, team, individual}`; `owner_email`; `owner_name`; `project_id`; `progress=0`; `target_value`; `current_value`; `due_date`; `status=active {active, completed, at_risk, paused}`; `key_results[]`.

Goal is declared but has no active page-level CRUD in this snapshot.

### Risk

`title*`; `description`; `project_id`; `project_name`; `category=technical* {technical, financial, resource, schedule, external, other}`; `severity=medium {low, medium, high, critical}`; `probability=medium {low, medium, high}`; `impact=medium {low, medium, high, critical}`; `status=open {open, mitigating, resolved, accepted}`; `mitigation_plan`; `owner_email`; `owner_name`; `due_date`.

Risk is declared but there is no routed Risk page. Dashboard risk is instead computed from projects, tasks, and budget state.

### WorkflowRule

`name*`; `description`; `trigger=task_overdue* {task_overdue, expense_threshold, project_delay, resource_overload, approval_pending, task_completed}`; `trigger_value`; `action=notify* {notify, reassign, auto_approve, create_alert, send_email}`; `action_target`; `is_active=true`; `project_id`; `run_count=0`.

WorkflowRule is declared but has no routed automation-builder page or active CRUD in this snapshot.

## 5. Relationship Map

| Parent/context | Child/entity | Join or ownership field |
|---|---|---|
| Project | Task | `Task.project_id` |
| Project | Timesheet | `Timesheet.project_id` |
| Task | Timesheet | `Timesheet.task_id` (optional) |
| Project | Expense | `Expense.project_id` |
| Project | Procurement | `Procurement.project_id` |
| Procurement | AssetUsage | `AssetUsage.procurement_id` |
| Project | Invoice | `Invoice.project_id` |
| Project | Document | `Document.project_id` |
| Task | Document | `Document.task_id` |
| Project | Blocker | `Blocker.project_id` |
| Task | Blocker | `Blocker.task_id` |
| Project | Risk | `Risk.project_id` |
| Project | Goal | `Goal.project_id` |
| User | Project | `team_members[]`, `manager_email` |
| User | Task | `assigned_to[]` |
| User | Timesheet | `employee_email` |
| User | Expense | `submitted_by` |
| User | Procurement | `requested_by`, `approved_by` |
| User | EmployeeReview | `employee_email`, `reviewer_email` |
| User | Notification | `recipient_email` |
| ExpenseCategory | Expense | category name string |

Names such as `project_name`, `task_title`, `employee_name`, and `requested_by_name` are copied into records for display. Renaming the parent can leave these denormalized values stale.

## 6. Active SDK Operations

Actively used entities are Project, Task, Timesheet, Expense, ExpenseCategory, User, Invoice, Procurement, AssetUsage, Notification, Blocker, Document, EmployeeReview, and AuditLog.

Declared but not used by page CRUD: Goal, Risk, WorkflowRule.

Observed operation coverage:

- Project: list, create, update.
- Task: list, create, update.
- Timesheet: list, filter, create, update.
- Expense: list, filter, create, update.
- ExpenseCategory: list, create.
- User: list, filter, update plus current-user auth methods.
- Invoice: list, create, update.
- Procurement: list, create, update, delete.
- AssetUsage: list, create.
- Notification: filter, create, update, delete, subscribe.
- Blocker: list, create, update.
- Document: list, create, delete.
- EmployeeReview: list, create.
- AuditLog: list.

Core platform calls:

- `base44.auth.me()`, `updateMe()`, `logout()`, `redirectToLogin()`.
- `base44.users.inviteUser()`.
- `base44.integrations.Core.UploadFile()` for receipts, profile images, and documents.
- `base44.integrations.Core.SendEmail()` for submissions, blockers, and direct messages.
- `base44.integrations.Core.InvokeLLM()` for employee performance summaries.
- `base44.appLogs.logUserInApp()` for navigation tracking.

## 7. Page-by-Page Behavior

### Dashboard

Admin and employee variants aggregate Projects, Tasks, Expenses, Timesheets, Users, and Procurement. It computes completion, total approved cost, budget utilization, net profit, utilization, overdue/blocked work, projects at risk, daily burn, and projected budget runway. Admin tabs are Overview, Risk, Profitability, Forecast, and Team; employee tabs are Overview and Projects. Charts use real entity aggregates, but future burn projection assumes a constant burn rate rather than a forecasting model.

### My Work

Personal dashboard scoped to the current user's assigned tasks, timesheets, expenses, and projects. Shows time-of-day greeting, weekly hours, in-progress tasks, pending submissions, overdue alert, today's tasks, and project progress. Includes a real Log Time dialog that creates a pending Timesheet.

### Projects

Full project create/edit/view workflow with grid/list views and Overview, Finance, and Clients tabs. Fields include dates, budget, billing rate, client details, team, status, priority, color, description, and location. Finance combines approved expenses, approved timesheets, task assignee rates/project billing rate, and non-draft procurement. Non-admin visibility is based on team membership, manager email, or assigned tasks. Project completion is derived from completed task ratio.

### Tasks

Creates and edits tasks, assigns multiple users, manages status/priority/dates/hours/tags, supports list and board views, search, status/project/date filters, pagination, and detail view. Completion sets `completed_at`. New tasks generate in-app notifications for admins and assignees. Employees are filtered to tasks containing their email in `assigned_to[]`.

### Timesheets

Real submission and approval workflow with list, month/week calendar, and chart views. Form fields are project, optional task, date, hours, description, overtime hours, and overtime reason. New entries are pending and identify the current user. Admin approval/rejection writes reviewer and timestamp fields. Submissions create in-app notifications and try to email administrators.

### Expenses

Real submission and approval workflow with list, calendar, and chart views. Form fields are title, amount, currency, existing/new category, project, description, date, and optional receipt. Uploads use Base44 managed files. New categories are created as needed. Submissions are pending and try to email administrators. Admins approve or reject with reviewer metadata and optional reason.

### Employees

Admin directory sourced from User, Task, Timesheet, Expense, and EmployeeReview. Computes completion rate, approved hours, approved expenses, and average rating per employee. Supports role/profile editing, invitation, and performance reviews. The AI summary calls `InvokeLLM` with employee metrics but is not itself a declared EmployeeReview field or durable cache.

### Task Assignment

Admin drag-and-drop board with To Do, In Progress, Blocked, and Completed columns. Moving a card updates Task status and sets `completed_at` when appropriate. Cards show project, priority, assignees, approved task hours, and project-level approved expenses. Supports search and project filtering.

### Procurement

Items, Inventory, and Usage Log tabs. Supports procurement create/update/delete, approval/status progression, totals, low-stock alerts, warranty/location metadata, and AssetUsage creation. Inventory availability is computed from purchased quantity minus logged usage. The UI uses undeclared `quantity_available` and `reorder_threshold` fields.

### Billing & Invoicing

Creates invoices from project data, approved timesheets, and approved expenses. Form fields include project, client details, amount, tax, due date, currency, and notes. Invoice number is generated from a timestamp fragment. Status can move through draft, sent, paid, overdue, and cancelled. PDF generation is client-side with jsPDF; there is no invoice-email delivery workflow.

### Resource Planning

Admin-only capacity, skills-matrix, and by-project views. Capacity assumes 40 hours per week and derives estimated remaining work, overdue/blocked tasks, approved current-week hours, project assignments, and completion rate. It classifies employees as overloaded, optimal, or underutilized.

### Performance & Rewards

Uses Users, Tasks, and approved Timesheets to build a leaderboard. Score is completed tasks times 10, total hours times 2, plus on-time rate. Badges include streak, task master, 100-hour milestone, on-time hero, team player, and top performer.

### Reports

Admin reports by project, employee, and selected month. Aggregates budget, approved expense, approved hours, task totals, and completion. Produces browser-generated CSV files and expandable detail rows.

### Gantt Scheduler

Read-only 14-day or month timeline for Projects and Tasks. Bars are derived from start/end or due dates, with colors for status and borders for priority. Supports project and assignee filters. It does not support drag-to-reschedule or dependencies.

### Document Hub

Creates and deletes Document records. Upload form includes title, category, optional project, description, version, tags, and file. Managed upload returns `file_url`. Search and filters use title, description, tags, category, and project. No true version history or per-document access rules are implemented.

### Notification Center

Filters the current user's notifications, subscribes to real-time Notification events, groups records by date, filters by read state/type, and supports mark-one-read, mark-all-read, delete, and clear-read actions.

### Notification Bell

Polls every 30 seconds for the current user's last 50 notifications. Badge caps at `9+`. Clicking marks a notification read and navigates through `link_page`; dismiss deletes it.

### Global Search

Debounced client-side search across Projects, Tasks, Expenses, and Procurement. It fetches full lists, searches selected text fields, and caps results per type. Results navigate only to the entity's list page, not a specific record.

### Compliance & Audit

Admin audit view with search, entity/action/date filters, breakdown counts, and CSV export. It first loads AuditLog. If native logs are missing/unavailable, it synthesizes events from Expense, Timesheet, Procurement, and Task records. Synthetic events cannot prove the actual actor, before/after values, or write time.

### Team Connect

Employees create Blocker records with type, project, optional task, description, and urgency. Administrators can change blocker state and add a resolution note. Submission emails all admins. Quick Message sends a one-off email to a selected admin; there is no stored message thread.

### Activity

Builds a chronological feed from updated Expenses, Timesheets, Tasks, and Projects. Employees see their own relevant records; admins see all. Events are derived from current record state, not immutable event records.

### Approvals

Admin queue for pending Expenses and Timesheets. Approve/reject mutations update status, reviewer, timestamp, and optional rejection reason. This is a functional workflow despite being absent from the sidebar.

### Budget Tracker

Computes approved, pending, committed, remaining, daily burn, and projected exhaustion per project. Health thresholds are on-track, warning at 70%, critical at 85%, and over budget at 100%. Includes budget/spend bars and approved category breakdown. It is functional but absent from the sidebar.

### Profile

Updates the current user with profile/contact/employment/skills/rate fields, uploads a profile image, and computes task/hour/tenure/admin badges. Several fields used by this page are absent from `User.jsonc`, so they require schema expansion or a permissive Base44 record model.

## 8. Data: Real, Computed, Synthetic, and Static

### Real persisted data

Projects, Tasks, Timesheets, Expenses, Categories, Users, Invoices, Procurement, AssetUsage, Notifications, Blockers, Documents, EmployeeReviews, and any native AuditLogs.

### Computed from persisted data

- Project completion: completed tasks divided by total tasks.
- Approved spend and pending spend by project/category/user/date.
- Labour cost: approved hours multiplied by task assignee rate or project billing rate.
- Procurement total: quantity times unit price.
- Available inventory: purchased/available quantity minus AssetUsage totals.
- Profit: budget/revenue minus labour, approved expense, and procurement cost.
- Capacity: remaining estimated hours divided by a fixed 40-hour week.
- Performance score and achievement badges.
- Risk score, burn rate, budget runway, over-budget and schedule warnings.
- Activity feed and fallback audit events reconstructed from current records.

### Synthetic or assumption-based

- Dashboard forecast extends current burn as a constant.
- Compliance fallback is reconstructed, not a real audit log.
- Activity is reconstructed from updated records, not event-sourced.
- Task Assignment attributes all approved project expenses to each task card in that project.

### Static configuration

Navigation definitions, status/priority/category options, colors/icons, 40-hour weekly capacity, badge thresholds, chart ranges, pagination sizes, and currency choices.

## 9. Links and Actions

- Sidebar and Profile links are React Router links generated by `createPageUrl`.
- Dashboard/My Work/project detail affordances navigate among Projects, Tasks, Timesheets, Expenses, and related pages.
- Search links target category pages only.
- Notification links target the page named by `link_page`.
- Receipt/document URLs are managed-file links and may open in a new tab.
- Logout delegates to `base44.auth.logout()`.
- There are no ordinary public documentation/support links in the application shell.
- Google Maps rendering is based on the free-text Project `location` value.

## 10. Role and Data Scoping

The UI recognizes `admin` versus every other role for navigation. The schema also permits `manager`, but Layout treats managers as employees.

Intended non-admin scoping in page code:

- Projects: team member, manager, or assigned task's project.
- Tasks: current email in `assigned_to[]`.
- Timesheets: `employee_email` equals current email.
- Expenses: `submitted_by` equals current email.
- Blockers: `reporter_email` equals current email.
- Notifications: `recipient_email` equals current email.

Important caveat: much of this filtering occurs **after** broad `.list()` calls in the browser. Correct security depends on Base44's server-side entity rules, not these client filters. Hiding navigation or filtering arrays client-side is not sufficient authorization.

## 11. Source-Confirmed Risks and Defects

The bundled QA/UAT report identifies these high-priority problems, which are consistent with the source patterns:

1. Timesheets and Expenses call `loadData()` without the current user/admin arguments after mutations, risking incorrect post-save scoping due to stale state.
2. Dashboard uses `Promise.all()`, so one rejected entity request can blank the whole dashboard.
3. Employee Timesheet/Expense submission tries to query admin Users for email recipients even though non-admin User listing may be forbidden.
4. Tasks also reload after mutations without consistently passing role context.
5. Route-level role guards are not wired into App routing.
6. Project date ordering, timesheet hours, expense amount, and several numeric fields lack reliable application-level validation.
7. `User.jsonc` and `Procurement.jsonc` omit fields actively used by their pages.
8. Audit and Activity fallback records are inferred from mutable state.
9. Invoice numbering uses a timestamp suffix and is not a durable sequence.
10. Most pages fetch full entity lists and filter client-side, which will degrade as data volume grows.
11. Global search also fetches complete lists and returns category-level rather than record-level links.
12. Document versioning is only a string field; there is no version history.
13. Gantt is read-only and has no dependency model.
14. Goal, Risk, and WorkflowRule schemas are unused by routed workflows.

The bundled docs themselves contain stale or conflicting statements. They should not be copied into the clone without checking the current schemas and page source.

## 12. Local Clone Parity Priorities

### P0: preserve semantics and authorization

1. Enforce admin routes server-side and in React routing, not only in sidebar visibility.
2. Implement PostgreSQL ownership/assignment rules matching `team_members`, `manager_email`, `assigned_to`, `employee_email`, `submitted_by`, `reporter_email`, and `recipient_email`.
3. Replace broad source-record reads with user-scoped API queries.
4. Add validation for dates, positive amounts, hours, tax, quantity, rates, and progress.
5. Resolve schema mismatches before copying Profile and Procurement forms.

### P1: replace current hardcoded admin modules

1. Dashboard from Project/Task/Expense/Timesheet/User/Procurement aggregates.
2. Employees from User and EmployeeReview with invitations, role edits, and review workflow.
3. Task Assignment with real task status mutation.
4. Procurement + AssetUsage with inventory calculations and status transitions.
5. Billing from Invoice with real project cost calculations and PDF generation.
6. Resource Planning from users, assignments, estimated hours, and approved timesheets.
7. Reports, Gantt, Document Hub, Compliance, Approvals, and Budget Tracker from PostgreSQL-backed queries.

### P2: shared behavior

1. Functional global search over four entity types.
2. Notification polling/subscription, read/delete actions, and `link_page` navigation.
3. File upload storage for receipts, documents, and profile photos.
4. Email delivery abstraction for approvals/blockers/messages.
5. CSV/PDF export helpers.
6. Audit writes at mutation time rather than synthetic reconstruction.

### P3: source features that are currently declared but unfinished

1. Goal/OKR tracking.
2. Risk register and issue management.
3. Workflow automation rules.
4. True document versioning.
5. Record-specific global search links.
6. Scalable server-side pagination, search, and aggregation.

## 13. Fidelity Rules for Further Implementation

- Treat JSONC entity schemas and current JSX as authoritative over bundled markdown docs.
- Preserve exact enum values; several local normalized tables currently use different names.
- Preserve Base44's denormalized display fields only when needed, but make IDs the canonical PostgreSQL relationship.
- Keep computed values computed unless the source explicitly persists them.
- Label synthetic analytics as estimates; do not present reconstructed audit data as immutable history.
- Implement source behavior, not only the source page's appearance: forms, mutations, filters, exports, polling, and role scoping are part of parity.
- Do not replicate known source bugs where PostgreSQL/server enforcement can provide the intended behavior safely.