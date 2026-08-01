# Rebuild Postmortem

## What was incomplete

The first implementation audited the reference while unauthenticated and treated its eight-link public/member sidebar as the complete product. It also mixed desktop observations with a compact viewport, producing the wrong shell dimensions and a neutral theme instead of the authenticated admin theme.

Consequences:

- Admin navigation and role-gated pages were omitted.
- Member and admin experiences were not separated.
- Direct URLs had no role guard.
- The initial shell used a white sidebar instead of the authenticated plum gradient.
- Several pages were represented only by generic empty states.

## Root causes

1. The route inventory was inferred from visible anonymous navigation rather than the authenticated route manifest.
2. The first visual baseline was not fixed to a desktop viewport.
3. Authentication was treated only as a gate, not as a source of role-specific information architecture.
4. Hidden workflow routes were not extracted from the application bundle.

## Corrected desktop baseline

- Viewport used for comparison: `1440 x 1000`.
- Sidebar: `256px`, plum gradient, compact navigation, account footer.
- Header: `59px`, white, search, notifications, role badge, avatar.
- Workspace: lavender canvas with dense white operational panels.
- Typography: native system sans-serif.

## Complete route inventory

### Admin sidebar

1. `/Dashboard` - Dashboard
2. `/Projects` - Projects
3. `/Tasks` - Tasks
4. `/Expenses` - Expenses
5. `/Timesheets` - Timesheets
6. `/Employees` - Employees
7. `/TaskAssignment` - Task Assignment
8. `/Procurement` - Procurement
9. `/BillingModule` - Billing & Invoicing
10. `/ResourcePlanning` - Resource Planning
11. `/PerformanceRewards` - Performance
12. `/Reports` - Reports
13. `/GanttScheduler` - Gantt / Scheduler
14. `/DocumentHub` - Document Hub
15. `/NotificationCenter` - Notifications
16. `/ComplianceAudit` - Compliance & Audit
17. `/TeamConnect` - Team Connect

### Member sidebar

1. `/MyWork` - Dashboard
2. `/Projects` - Projects
3. `/Tasks` - Tasks
4. `/Expenses` - Expenses
5. `/Timesheets` - Timesheets
6. `/PerformanceRewards` - Performance
7. `/NotificationCenter` - Notifications
8. `/TeamConnect` - Team Connect

### Hidden workflows

- `/Activity` - Activity Feed
- `/Approvals` - Approvals
- `/BudgetTracker` - Budget Tracker
- `/MyWork` - Personal work dashboard, also available to admins

## Remediation

- Rebuilt the desktop shell from the authenticated reference.
- Added every discovered route with page-specific controls and data states.
- Added PostgreSQL-backed `admin` and `member` roles.
- Made the first account an administrator and subsequent accounts members by default.
- Added Google OAuth plus email/password member registration and login.
- Enforced admin-only routes at the router boundary.
- Added desktop route scanning for content and horizontal overflow.

## Verification

- All 21 routes render nonempty page content.
- Admin navigation contains 17 links.
- Member navigation contains 8 links.
- Member direct access to admin pages is rejected.
- No route overflows horizontally at `1440 x 1000`.
- PostgreSQL, Google OAuth, lint, API tests, syntax checks, and production build pass.
