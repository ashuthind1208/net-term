# Net Term Solutions Rebuild Plan

## Scope and fidelity baseline

The rebuild targets the publicly observable Net Term Solutions application at `https://netterm-solutions.base44.app/` as of August 1, 2026. The reference currently exposes empty-state data. Protected or private records cannot be copied without authorized source access; the PostgreSQL application will reproduce the visible zero state and support equivalent records created by authenticated users.

## Epic 1: Foundation and environments

### Story 1.1: React application foundation
As a developer, I need a React application with client-side routing so every reference route can be reproduced.

**Acceptance criteria**
- Vite runs the React application locally.
- Routes exist for Dashboard, Projects, Tasks, Expenses, Timesheets, Performance, Notifications, Team Connect, and the observed Project Finance 404.
- Unknown URLs show the same Page Not Found behavior.
- Runtime configuration is read from environment variables.

### Story 1.2: PostgreSQL service foundation
As a developer, I need an API connected to PostgreSQL so application data is durable.

**Acceptance criteria**
- Express exposes versioned health and application APIs.
- Database connection details come only from `.env`.
- Migrations create users, sessions, projects, tasks, expenses, timesheets, blockers, and notifications.
- Queries are scoped to the authenticated user.

## Epic 2: Authentication and authorization

### Story 2.1: Google sign-in
As a user, I want to sign in with Google so I can securely access my workspace.

**Acceptance criteria**
- Google OAuth client ID, client secret, callback URL, and session secret are environment variables.
- Successful sign-in creates or updates the local user and establishes a PostgreSQL-backed session.
- Sign-out destroys the session.
- Unauthenticated API calls return HTTP 401.

### Story 2.2: Development authentication
As a developer, I need an explicit local-only bypass so the cloned interface can be evaluated before Google credentials are configured.

**Acceptance criteria**
- The bypass is disabled unless `DEV_AUTH_BYPASS=true`.
- Production mode never enables the bypass implicitly.
- The interface clearly exposes Google sign-in when authentication is required.

## Epic 3: Shared application shell

### Story 3.1: Navigation shell
As a user, I want consistent navigation across every page.

**Acceptance criteria**
- Desktop shows the branded left sidebar and active route.
- Compact view uses the observed hamburger control and slide-out navigation.
- Header displays the current page and a Search control with the Command-K hint.
- Colors, spacing, typography, borders, shadows, and responsive behavior visually match the reference.

### Story 3.2: Global search
As a user, I want to search application records from the header.

**Acceptance criteria**
- Clicking Search or pressing Command/Ctrl-K opens search.
- Search returns matching projects and tasks owned by the user.
- Selecting a result navigates to the corresponding page.
- Empty and loading states are represented.

## Epic 4: Dashboard

### Story 4.1: Overview metrics
As a user, I want a summary of my work and finances.

**Acceptance criteria**
- The four primary cards display active projects, task completion, net profit, and hours.
- The four secondary cards display on-track projects, overdue tasks, budget used, and daily burn.
- Empty database values match the reference: zero counts, zero percentages, `$0`, and `0h`.
- View-all actions navigate to the observed destinations, including the reference Project Finance 404.

### Story 4.2: Dashboard analytics
As a user, I want recent trends and task status at a glance.

**Acceptance criteria**
- A 30-day activity chart displays hours and expenses.
- Task status summarizes the user's task data.
- Overview and Projects tabs match the reference interaction.
- Data refreshes after related records change.

## Epic 5: Projects and tasks

### Story 5.1: Project workspace
As a user, I want to view and manage projects.

**Acceptance criteria**
- Projects page shows total count, Overview/Client View switch, status filter, and view controls.
- The empty state says `No projects found`.
- Authenticated users can create, view, update, and archive their projects.
- Project records include status, client, dates, budget, and progress.

### Story 5.2: Task workspace
As a user, I want to track and filter tasks.

**Acceptance criteria**
- Tasks page shows count, CSV/PDF actions, status/project/date filters, and view controls.
- Empty state and zero count match the reference.
- Authenticated users can create, update, complete, and delete their tasks.
- CSV export contains the filtered records; PDF opens a printable filtered view.

## Epic 6: Expenses and timesheets

### Story 6.1: Expense management
As a user, I want to record and review expenses.

**Acceptance criteria**
- Expenses page matches the reference timeline, approved/pending/count summaries, filters, exports, and empty state.
- Add Expense validates amount, date, project, status, category, and description.
- Records persist in PostgreSQL and update dashboard metrics.

### Story 6.2: Time tracking
As a user, I want to log and review work time.

**Acceptance criteria**
- Timesheets page matches the reference timeline, approved/pending/entry summaries, filters, exports, and empty state.
- Log Time validates hours, date, project, task, status, and notes.
- Records persist in PostgreSQL and update dashboard metrics.

## Epic 7: Performance, notifications, and collaboration

### Story 7.1: Performance and rewards
As a user, I want a performance view consistent with the source application.

**Acceptance criteria**
- The route title and shell match `Performance & Rewards`.
- Empty-state presentation matches the publicly observable reference.
- Metrics are derived from project, task, and timesheet records when data exists.

### Story 7.2: Notification center
As a user, I want to filter and manage notifications.

**Acceptance criteria**
- Header shows unread and total counts.
- All/Unread/Read and type filters work.
- Read-all and clear-read actions persist.
- The empty state says `No notifications`.

### Story 7.3: Team Connect
As a user, I want to report blockers and contact teammates.

**Acceptance criteria**
- Hero copy, Report a Blocker, Send Quick Message, and My Blockers match the reference.
- Users can create and resolve their blockers.
- Empty state says `No blockers reported — all clear!`.
- Email/message delivery settings are environment-driven.

## Epic 8: Quality and delivery

### Story 8.1: Visual fidelity
As a product owner, I want the rebuild to match the reference across viewport sizes.

**Acceptance criteria**
- Desktop and mobile screenshots are compared route by route.
- No text overlaps, layout shifts, missing icons, or broken responsive states remain.
- Color tokens are sampled from the reference and reused consistently.
- The interface does not include the Base44 editor badge.

### Story 8.2: Verification and operations
As an operator, I need a repeatable deployment and validation path.

**Acceptance criteria**
- Frontend build, backend tests, API tests, and linting pass.
- `.env.example` documents every required variable without secrets.
- Database migration and seed commands are documented.
- README contains local setup, Google OAuth configuration, and deployment instructions.

## Delivery order

1. Foundation, route shell, and environment contract.
2. PostgreSQL schema and Google authentication.
3. Dashboard and all public zero-state pages.
4. CRUD workflows, filters, search, and exports.
5. Responsive visual comparison and release verification.
