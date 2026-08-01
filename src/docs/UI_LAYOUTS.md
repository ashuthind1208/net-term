# UI Layouts & Page Structure

This document describes the visual layout of every page in the app.

---

## Global Shell (Layout.js)

Every page is wrapped in this shell:

```
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR (w-64, fixed on desktop, slide-in on mobile)   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Logo: [icon] Net Term Solutions                │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  NAV LINKS (filtered by role):                  │    │
│  │   • Dashboard          (admin only)             │    │
│  │   • Projects                                    │    │
│  │   • Tasks                                       │    │
│  │   • Expenses                                    │    │
│  │   • Timesheets                                  │    │
│  │   • Employees          (admin only)             │    │
│  │   • Task Assignment    (admin only)             │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  USER AVATAR + name + role dropdown             │    │
│  │  (My Profile / Logout)                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  MAIN AREA (flex-1, scrollable)                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  TOP HEADER (sticky)                            │    │
│  │  [☰ menu] [Page Title]    [Admin badge] [avatar]│    │
│  ├─────────────────────────────────────────────────┤    │
│  │  PAGE CONTENT (rendered here)                   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Colors**: Sidebar uses a `#210F37 → #4F1C51` vertical gradient. Background is `#F5F0FF`.

---

## Dashboard (`/`)

> Admin only. Shows company-wide KPIs and charts.

```
┌─── Page Header ──────────────────────────────────────┐
│  "Dashboard"  subtitle: "Welcome back, {name}"       │
└──────────────────────────────────────────────────────┘

┌─── KPI Cards Row (4 cards) ─────────────────────────┐
│  [Total Projects]  [Active Tasks]  [Hours This Month] [Pending Approvals] │
└─────────────────────────────────────────────────────┘

┌─── Charts Row (2 columns) ──────────────────────────┐
│  [Bar Chart: Project Status Distribution]            │
│  [Pie Chart: Task Status Breakdown]                  │
└─────────────────────────────────────────────────────┘

┌─── Bottom Row (2 columns) ──────────────────────────┐
│  [Project Progress List]     [Pending Approvals List] │
│  (each project with          (timesheets + expenses   │
│   progress bar)               needing review)         │
└─────────────────────────────────────────────────────┘
```

---

## Projects (`/Projects`)

```
┌─── Page Header ──────────────────────────────────────┐
│  "Projects"  "{n} projects total"    [+ New Project] (admin) │
└──────────────────────────────────────────────────────┘

┌─── Filter Bar ───────────────────────────────────────┐
│  [🔍 Search input]  [Status dropdown]  [Grid|List toggle] │
└──────────────────────────────────────────────────────┘

── GRID VIEW ──
┌──────────────────────────────────────────────────────┐
│  3-column responsive card grid                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ [color bar] │  │ [color bar] │  │ [color bar] │  │
│  │ Name        │  │ Name        │  │ Name        │  │
│  │ Client      │  │ ...         │  │ ...         │  │
│  │ 📍 Location │  │             │  │             │  │
│  │ [badges]    │  │             │  │             │  │
│  │ Progress ██ │  │             │  │             │  │
│  │ Due | $cost │  │             │  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────┘

── LIST VIEW ──
┌──────────────────────────────────────────────────────┐
│  Table header: [color] [Project] [Status] [Priority] [Progress] [Due] [⋮] │
│  Row per project (compact, single line)               │
└──────────────────────────────────────────────────────┘

── VIEW PROJECT MODAL ──
┌──────────────────────────────────────────────────────┐
│  [color strip] Project Name / Client                  │
│  [status badge] [priority badge]                      │
│  Description text                                     │
│  Details grid: Start | End | Budget | Client Email    │
│  📍 Location + embedded Google Maps iframe (h-48)    │
│  Tasks table: Task | Status | Assigned To             │
│  Footer: [Close] [Edit Project] (admin)               │
└──────────────────────────────────────────────────────┘

── CREATE/EDIT PROJECT MODAL ──
┌──────────────────────────────────────────────────────┐
│  [Project Name*]                                      │
│  [Description textarea]                               │
│  [📍 Location input]                                  │
│  [Status] [Priority]                                  │
│  [Start Date] [End Date]                              │
│  [Budget] [Color picker: 7 circle swatches]           │
│  [Client Name] [Client Email]                         │
│  Footer: [Cancel] [Create/Save]                       │
└──────────────────────────────────────────────────────┘
```

---

## Tasks (`/Tasks`)

```
┌─── Page Header ──────────────────────────────────────┐
│  "Tasks"  "{n} tasks"    [+ New Task] (admin)         │
└──────────────────────────────────────────────────────┘

┌─── Filter Bar ───────────────────────────────────────┐
│  [🔍 Search]  [Status dropdown]  [Project dropdown]  [List|Board toggle] │
└──────────────────────────────────────────────────────┘

── LIST VIEW ──
┌──────────────────────────────────────────────────────┐
│  Table header: [●] [Task] [Status] [Priority] [Assignees] [Due] [⋮] │
│  Each row: status icon (clickable dropdown to change) │
│  Admin sees ⋮ menu: Edit / Close Task                 │
└──────────────────────────────────────────────────────┘

── BOARD VIEW ──
┌──────────────────────────────────────────────────────┐
│  Horizontal scroll, one column per status:            │
│  [To Do] [In Progress] [In Review] [Completed] [Blocked] │
│  Each column: badge header + count, task cards below  │
│  Task card: status icon, title, badges, assignee avatars, due date │
└──────────────────────────────────────────────────────┘

── CREATE/EDIT TASK MODAL ──
┌──────────────────────────────────────────────────────┐
│  [Title*]                                             │
│  [Description textarea]                               │
│  [Project* dropdown]  [Status dropdown]               │
│  [Priority dropdown]  [Estimated Hours]               │
│  [Start Date]  [Due Date]                             │
│  Assign To: pill buttons (toggle per user)            │
│  Footer: [Cancel] [Create/Save]                       │
└──────────────────────────────────────────────────────┘
```

---

## Timesheets (`/Timesheets`)

```
┌─── KPI Cards (4) ────────────────────────────────────┐
│  [Total Hours] [This Week] [Pending Review] [Approved] │
└──────────────────────────────────────────────────────┘

┌─── Filter Bar ───────────────────────────────────────┐
│  [🔍 Search]  [Status]  [Project]  [List|Calendar toggle]  [+ Log Hours] │
└──────────────────────────────────────────────────────┘

── LIST VIEW ──
Table: Date | Employee | Project | Task | Hours | Status | Actions

── CALENDAR VIEW ──
Monthly calendar grid; days with entries show hour totals as dots/badges.
Click a day → modal showing all entries for that day.

── SUBMIT TIMESHEET MODAL ──
[Project*] [Task (optional)] [Date*] [Hours*] [Description]

── ADMIN REVIEW MODAL ──
Shows entry details + [Approve] / [Reject with reason] buttons
```

---

## Expenses (`/Expenses`)

```
┌─── KPI Cards (3) ────────────────────────────────────┐
│  [Total Approved $]  [Pending $]  [This Month $]      │
└──────────────────────────────────────────────────────┘

┌─── Filter Bar ───────────────────────────────────────┐
│  [🔍 Search]  [Status]  [Project]  [Category]  [+ Submit Expense] │
└──────────────────────────────────────────────────────┘

── EXPENSE LIST ──
Table: Date | Title | Category | Project | Amount | Status | Receipt | Actions

── SUBMIT EXPENSE MODAL ──
[Title*] [Amount*] [Currency] [Category*] [Project*] [Date*]
[Description] [Upload Receipt button]

── ADMIN REVIEW MODAL ──
Full expense details + receipt preview + [Approve] / [Reject] buttons
```

---

## Employees (`/Employees`)

> Admin only.

```
┌─── Page Header ──────────────────────────────────────┐
│  "Employees"  "{n} team members"  [+ Invite Employee] │
└──────────────────────────────────────────────────────┘

┌─── Filter Bar ───────────────────────────────────────┐
│  [🔍 Search]  [Role filter]  [Grid|List toggle]       │
└──────────────────────────────────────────────────────┘

── GRID VIEW ──
Cards: avatar, name, email, role badge, department, task/timesheet stats, ⋮ menu

── LIST VIEW ──
Table: Avatar+Name | Email | Role | Department | Tasks | Hours | Actions

── EDIT EMPLOYEE MODAL ──
[Role dropdown] [Department] [Position] [Phone] [Location]

── INVITE MODAL ──
[Email input] [Role dropdown] [Send Invite button]
```

---

## Task Assignment (`/TaskAssignment`)

> Admin only. Drag-and-drop board.

```
┌─── Page Header ──────────────────────────────────────┐
│  "Task Assignment"  "Drag tasks from the pool..."     │
└──────────────────────────────────────────────────────┘

┌─── Filter Bar ───────────────────────────────────────┐
│  [🔍 Search tasks]  [Project dropdown]               │
└──────────────────────────────────────────────────────┘

┌─── Drag Board (horizontal scroll) ──────────────────┐
│                                                      │
│  [Unassigned Pool]  │  [User 1]  [User 2]  [User 3]… │
│  ┌──────────────┐   │  ┌──────┐  ┌──────┐           │
│  │ ⠿ Task A     │   │  │ ⠿ B  │  │      │           │
│  │ ⠿ Task C     │   │  │      │  │      │           │
│  │ ...          │   │  │      │  │      │           │
│  └──────────────┘   │  └──────┘  └──────┘           │
│  (gray bg)          │  (purple bg)                   │
│                                                      │
│  • Drag task → user column to assign                 │
│  • Drag task → unassigned to unassign                │
│  • Hover assigned task → [×] button to remove        │
└──────────────────────────────────────────────────────┘

Task cards show: grip handle, title, project name, priority badge, due date
```

---

## Profile (`/Profile`)

```
┌─── Profile Card (centered, max-w-2xl) ──────────────┐
│                                                      │
│  [Avatar - click to upload photo]                    │
│  Full Name (read-only)                               │
│  Email (read-only)                                   │
│  Role badge                                          │
│                                                      │
│  ┌── Editable Fields ─────────────────────────────┐ │
│  │  [Phone]  [Department]                         │ │
│  │  [Position]  [Location]                        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Save Changes button]                               │
└──────────────────────────────────────────────────────┘
```

---

## Component Conventions

| Pattern | Implementation |
|---------|---------------|
| Loading state | Centered spinning circle `border-[#A55B4B]` |
| Empty state | Centered icon + gray message + optional CTA button |
| Status badges | `<Badge>` with color class from a `STATUS_COLORS` map |
| Action menus | `<DropdownMenu>` with `⋮` trigger |
| Forms | Inside `<Dialog>` modals, 2-column grid on sm+ screens |
| Confirm destructive actions | Native `window.confirm()` dialog |
| Dates | Formatted with `date-fns` `format(new Date(val), "MMM d, yyyy")` |
| Currency | `Number(val).toLocaleString()` or `.toFixed(0)` |
| Avatars | `<Avatar>` with `AvatarFallback` showing first letter of email |