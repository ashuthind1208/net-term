# Database Schema

All entities are managed by the Base44 BaaS platform. Every record automatically includes:
- `id` (string, auto-generated)
- `created_date` (ISO timestamp)
- `updated_date` (ISO timestamp)
- `created_by` (email of the creating user)

---

## Entity: Project

Represents a client project or internal initiative.

| Field | Type | Enum Values | Required | Notes |
|-------|------|-------------|----------|-------|
| `name` | string | — | ✅ | Project display name |
| `description` | string | — | — | Free-text description |
| `location` | string | — | — | Physical address; rendered in Google Maps iframe |
| `status` | string | `planning`, `active`, `on_hold`, `completed`, `cancelled` | — | Default: `planning` |
| `priority` | string | `low`, `medium`, `high`, `critical` | — | Default: `medium` |
| `start_date` | string (date) | — | — | ISO date string |
| `end_date` | string (date) | — | — | ISO date string |
| `budget` | number | — | — | USD value |
| `client_name` | string | — | — | — |
| `client_email` | string | — | — | — |
| `tags` | array of strings | — | — | — |
| `team_members` | array of strings | — | — | Array of user emails |
| `manager_email` | string | — | — | Email of project manager |
| `color` | string | — | — | Hex color for UI card stripe |
| `completion_percentage` | number | — | — | Default: 0 (currently computed from tasks) |

**Access Rule**: Non-admin users only see projects where their email is in `team_members` or equals `manager_email`.

---

## Entity: Task

Represents a unit of work within a project.

| Field | Type | Enum Values | Required | Notes |
|-------|------|-------------|----------|-------|
| `title` | string | — | ✅ | — |
| `description` | string | — | — | — |
| `project_id` | string | — | ✅ | Foreign key to Project.id |
| `project_name` | string | — | — | Denormalized for display |
| `assigned_to` | array of strings | — | — | Array of user emails |
| `status` | string | `todo`, `in_progress`, `in_review`, `completed`, `blocked` | — | Default: `todo` |
| `priority` | string | `low`, `medium`, `high`, `critical` | — | Default: `medium` |
| `due_date` | string (date) | — | — | — |
| `start_date` | string (date) | — | — | — |
| `estimated_hours` | number | — | — | — |
| `actual_hours` | number | — | — | — |
| `tags` | array of strings | — | — | — |
| `attachments` | array of strings | — | — | File URLs |
| `comments` | array of objects | — | — | `{ author, text, timestamp }` |
| `completed_at` | string | — | — | ISO timestamp, set on completion |

**Access Rule**: Non-admin users only see tasks where their email is in `assigned_to`.

---

## Entity: Timesheet

Records hours worked by an employee on a project/task.

| Field | Type | Enum Values | Required | Notes |
|-------|------|-------------|----------|-------|
| `employee_email` | string | — | — | Set to current user's email |
| `employee_name` | string | — | — | Denormalized |
| `project_id` | string | — | ✅ | Foreign key to Project.id |
| `project_name` | string | — | — | Denormalized |
| `task_id` | string | — | — | Optional foreign key to Task.id |
| `task_title` | string | — | — | Denormalized |
| `date` | string (date) | — | ✅ | Work date |
| `hours` | number | — | ✅ | Hours worked |
| `description` | string | — | — | Work notes |
| `status` | string | `pending`, `approved`, `rejected` | — | Default: `pending` |
| `reviewed_by` | string | — | — | Admin email |
| `reviewed_at` | string | — | — | ISO timestamp |
| `rejection_reason` | string | — | — | — |

---

## Entity: Expense

Tracks a monetary expense tied to a project.

| Field | Type | Enum Values | Required | Notes |
|-------|------|-------------|----------|-------|
| `title` | string | — | ✅ | — |
| `amount` | number | — | ✅ | — |
| `currency` | string | — | — | Default: `USD` |
| `category` | string | — | ✅ | References ExpenseCategory.name |
| `project_id` | string | — | ✅ | Foreign key to Project.id |
| `project_name` | string | — | — | Denormalized |
| `description` | string | — | — | — |
| `date` | string (date) | — | ✅ | — |
| `receipt_url` | string | — | — | Uploaded file URL |
| `status` | string | `pending`, `approved`, `rejected` | — | Default: `pending` |
| `submitted_by` | string | — | — | User email |
| `submitted_by_name` | string | — | — | Denormalized |
| `reviewed_by` | string | — | — | Admin email |
| `reviewed_at` | string | — | — | ISO timestamp |
| `rejection_reason` | string | — | — | — |

---

## Entity: ExpenseCategory

Lookup table for expense category options.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | ✅ | Display name (e.g. "Travel", "Equipment") |
| `icon` | string | — | Lucide icon name |
| `color` | string | — | Hex or Tailwind color |

**Sample categories**: Travel, Equipment, Software, Meals, Office Supplies, Marketing, Other

---

## Built-in Entity: User

Managed by Base44 auth. Read-only fields: `id`, `created_date`, `full_name`, `email`.

| Field | Type | Notes |
|-------|------|-------|
| `role` | string | `"admin"` or `"user"` — controls all access |
| `photo_url` | string | Profile photo URL |
| `phone` | string | — |
| `department` | string | — |
| `position` | string | — |
| `location` | string | — |

**Note**: Only admins can call `User.list()`. Regular users can only read/update their own record via `base44.auth.me()` and `base44.auth.updateMe()`.

---

## Entity Relationships

```
User (1) ──────────────────────── (N) Project    [via team_members[], manager_email]
Project (1) ──────── (N) Task                   [via project_id]
Project (1) ──────── (N) Timesheet              [via project_id]
Project (1) ──────── (N) Expense                [via project_id]
Task (1) ──────────── (N) Timesheet             [via task_id, optional]
User (1) ──────────── (N) Task                  [via assigned_to[]]
User (1) ──────────── (N) Timesheet             [via employee_email]
User (1) ──────────── (N) Expense               [via submitted_by]
ExpenseCategory (1) ── (N) Expense              [via category name]
``