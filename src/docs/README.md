# Net Term Solutions — Project Management App

A full-stack project management web application built with **React + Vite + Tailwind CSS**, backed by the **Base44 BaaS** platform.

---

## Overview

This app enables a company to manage projects, tasks, timesheets, and expenses across a team. It has two user roles:

| Role | Capabilities |
|------|-------------|
| **Admin** | Full CRUD on all data, approve/reject timesheets & expenses, manage employees, assign tasks |
| **User** | View only their assigned projects & tasks, submit timesheets & expenses |

---

## Features

### Pages

| Page | Route | Access | Description |
|------|-------|--------|-------------|
| Dashboard | `/` | Admin only | KPI cards, charts, pending approvals |
| Projects | `/Projects` | All users | List/grid view of projects; admin can create/edit |
| Tasks | `/Tasks` | All users | List/board view; non-admins see only assigned tasks |
| Timesheets | `/Timesheets` | All users | Log hours; admin can approve/reject |
| Expenses | `/Expenses` | All users | Submit expenses with receipts; admin can approve/reject |
| Employees | `/Employees` | Admin only | View team, stats, invite users |
| Task Assignment | `/TaskAssignment` | Admin only | Drag-and-drop task assignment board |
| Profile | `/Profile` | All users | Edit own profile & photo |

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Drag & Drop**: `@hello-pangea/dnd`
- **Charts**: Recharts
- **Date Utilities**: date-fns
- **HTTP / State**: TanStack Query v5
- **Routing**: React Router DOM v6
- **Backend / DB / Auth**: Base44 BaaS (entities, auth, integrations)

---

## Design System

Brand colors (defined in `index.css` and used inline in components):

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#210F37` | Text, headers, dark backgrounds |
| `--color-secondary` | `#4F1C51` | Sidebar gradient, hover states |
| `--color-accent` | `#A55B4B` | Primary buttons, active states |
| `--color-gold` | `#DCA06D` | Sidebar icon tints, accents |
| Background | `#F5F0FF` | App body background |

Font: **Inter** (system default or loaded via CSS)

---

## Access Control Logic

- **Admin** check: `user.role === "admin"` (set via Base44 invite flow)
- Non-admin users only see:
  - Projects where their email is in `team_members[]` or equals `manager_email`
  - Tasks where their email is in `assigned_to[]`
  - Their own timesheets and expenses
- `User.list()` is restricted to admin-role users only (enforced client-side)

---

## Data Loading Pattern

All pages use `Promise.allSettled` for resilient parallel data fetching:

```js
const [tRes, pRes, uRes] = await Promise.allSettled([
  base44.entities.Task.list("-created_date"),
  base44.entities.Project.list(),
  isAdmin ? base44.entities.User.list() : Promise.resolve([]),
]);
setTasks(tRes.status === "fulfilled" ? tRes.value : []);
```

This prevents a single failed request from blocking the entire page.

---

## Deactivation vs Deletion Policy

To preserve audit trails, **no entities are ever deleted**. Instead:

- Projects → set `status: "cancelled"` or `"completed"`
- Tasks → set `status: "completed"` with `completed_at` timestamp
- Expenses / Timesheets → set `status: "rejected"`

---

## Email Notifications

When a new task is created with assignees, all admin users receive an email notification via `base44.integrations.Core.SendEmail`.

---

## Getting Started (rebuilding from scratch)

1. Create a new Base44 app
2. Create entities as defined in `docs/DATABASE.md`
3. Copy pages and components from `src/`
4. Set up the layout and routing in `Layout.js` and `pages.config.js`
5. Invite your first admin user via the Base44 dashboard