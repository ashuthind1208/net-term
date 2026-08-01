# QA / UAT Report — Net Term Solutions Project Management App

**Date:** 2026-03-24  
**Reviewed by:** Senior QA Engineer (AI-assisted static analysis + code walkthrough)  
**Scope:** Full codebase review across all 8 pages + shared layout  
**Version:** Current main branch

---

## Executive Summary

The application is **functionally solid** with well-structured role-based access control, resilient data fetching, and clean UI patterns. However, several **medium-to-high severity issues** were identified that should be addressed before a production go-live. No critical security vulnerabilities were found at the platform level (Base44 handles auth), but there are logic bugs, UX gaps, and missing input validations that need attention.

**Go-Live Readiness: ⚠️ CONDITIONAL PASS**  
Resolve all Critical and High severity items before production launch.

---

## Bug Registry

### 🔴 CRITICAL

---

#### BUG-001 — Timesheets: `loadData()` called without arguments causes stale closure

**Page:** `Timesheets.jsx`  
**Severity:** Critical  
**Steps to reproduce:**
1. Submit a timesheet (triggers `handleSave`)
2. After submission, `loadData()` is called with no arguments
3. `me` and `admin` are both `undefined` inside `loadData`
4. `currentUser` from state may still be `null` at that point (React state batching)
5. Non-admin users see ALL timesheets instead of only their own

**Code location:**
```js
// handleSave() line 105:
setSaving(false); setShowDialog(false); loadData(); // ← no args!

// handleApprove / handleReject also:
setShowApproveDialog(false); loadData(); // ← no args!
```

**Fix:**
```js
// Store refs or pass captured values:
setSaving(false); setShowDialog(false); loadData(currentUser, isAdmin);
// Same for handleApprove and handleReject
```

---

#### BUG-002 — Dashboard: Uses `Promise.all` instead of `Promise.allSettled`

**Page:** `Dashboard.jsx` line 35  
**Severity:** Critical  
**Impact:** If ANY single entity fetch fails (e.g. `User.list()` for a non-admin, or a network blip), the entire dashboard crashes with an unhandled rejection — the catch only prevents UI rendering, leaving a blank screen.

**Code:**
```js
const [allProjects, allTasks, allExpenses, allTimesheets, u] = await Promise.all([...]);
```

**Fix:**
```js
const [allProjects, allTasks, allExpenses, allTimesheets, u] = await Promise.allSettled([...]);
// Then check .status === "fulfilled" for each before using .value
```

---

#### BUG-003 — Expenses: `loadData()` also called without arguments after save/approve/reject

**Page:** `Expenses.jsx` lines 118, 125, 133  
**Severity:** Critical  
**Same root cause as BUG-001.** Non-admin users risk seeing all expenses after any CRUD action.

**Fix:** Pass `(currentUser, isAdmin)` to every `loadData()` call in Expenses.jsx.

---

### 🟠 HIGH

---

#### BUG-004 — Timesheets: Admin called with `User.filter()` which may not exist in SDK

**Page:** `Timesheets.jsx` line 97  
**Severity:** High  
**Code:**
```js
const adminUsers = await base44.entities.User.filter({ role: "admin" });
```
The documented SDK uses `.list()` and `.filter()` differently — `.filter()` takes `(query, sort, limit)` which is correct, but this is called from within `handleSave` which runs for ALL users including non-admins. A regular user calling `User.filter()` will fail due to the platform's built-in User entity security rules (only admins can list users).

**Impact:** Non-admin users cannot submit timesheets — the call will throw and block the submission.

**Fix:** Wrap in try/catch, or move admin notification to a backend function. Short-term fix:
```js
const adminUsers = isAdmin ? [] : await base44.entities.User.filter({ role: "admin" }).catch(() => []);
// Or simply suppress the email for non-admins if User.filter is restricted
```

---

#### BUG-005 — Expenses: Same `User.filter({ role: "admin" })` issue as BUG-004

**Page:** `Expenses.jsx` line 110  
**Severity:** High  
**Same root cause.** Non-admin users submitting expenses will hit a permission error when trying to list admin users for the notification email.

**Fix:** Same as BUG-004.

---

#### BUG-006 — Tasks: `loadData()` called without arguments on status change and deactivate

**Page:** `Tasks.jsx` lines 132, 138, 124  
**Severity:** High  
**Code:**
```js
const handleStatusChange = async (task, newStatus) => {
  await base44.entities.Task.update(...);
  loadData(); // ← no args, isAdmin from closure may be stale
};
```
Non-admin users changing a task status could reload and see no tasks if `isAdmin` is stale `false` but the filter still runs as if they're an admin (or vice versa).

**Fix:** `loadData(isAdmin)` — or better, use a `useRef` for isAdmin.

---

#### BUG-007 — Projects: No validation on `end_date` being before `start_date`

**Page:** `Projects.jsx`  
**Severity:** High  
**Impact:** A project can be created with an end date earlier than its start date, causing confusing UI state and incorrect timeline displays.

**Fix:** Add validation in `handleSave`:
```js
if (form.end_date && form.start_date && form.end_date < form.start_date) {
  alert("End date cannot be before start date");
  setSaving(false); return;
}
```

---

#### BUG-008 — Timesheets: Hours input has no server-side-style validation beyond HTML `min/max`

**Page:** `Timesheets.jsx` line 385  
**Severity:** High  
**Details:** `min="0.5" max="24"` is only enforced by the browser. A user can type `-5` or `999` directly and it will be submitted and stored. The `Number(form.hours)` conversion will happily accept negative values.

**Fix:**
```js
const handleSave = async () => {
  const hrs = Number(form.hours);
  if (!hrs || hrs <= 0 || hrs > 24) { alert("Hours must be between 0.5 and 24"); return; }
  ...
}
```

---

#### BUG-009 — Expenses: Amount input accepts negative numbers and zero

**Page:** `Expenses.jsx` — `handleSave`  
**Severity:** High  
**Details:** `Number(form.amount)` is stored directly. A user can submit `amount: -500` or `amount: 0`.

**Fix:**
```js
if (!form.amount || Number(form.amount) <= 0) { alert("Amount must be greater than 0"); return; }
```

---

### 🟡 MEDIUM

---

#### BUG-010 — Profile: `location` field shown in `docs/DATABASE.md` but missing from Profile form

**Page:** `Profile.jsx`  
**Severity:** Medium  
**Details:** The Profile page saves `phone`, `job_title`, and `department` but the User entity supports a `location` field. The field is referenced in the Employees edit dialog but not editable from the Profile page itself.

**Fix:** Add a Location input field to the Profile form.

---

#### BUG-011 — Dashboard: Title hardcoded as "Admin Dashboard" for all users

**Page:** `Dashboard.jsx` line 128  
**Severity:** Medium  
**Details:** Non-admin users who can access the dashboard see "Admin Dashboard" as the heading, which is misleading and incorrect.

**Fix:**
```jsx
<h2>...{isAdmin ? "Admin Dashboard" : "My Dashboard"}</h2>
```
Note: The `isAdmin` variable is scoped inside the `useEffect` callback — it needs to be promoted to state.

---

#### BUG-012 — Employees: `ROLE_CONFIG` includes "manager" role but invite dialog only offers "user" and "admin"

**Page:** `Employees.jsx`  
**Severity:** Medium  
**Details:** `ROLE_CONFIG` defines `manager` as a valid role with its own badge/icon, but the Invite dialog only lets you assign `"user"` or `"admin"`. If a user is somehow assigned `manager`, it displays correctly but can never be assigned via invite.

**Fix:** Add `<SelectItem value="manager">Manager</SelectItem>` to the invite dialog role select.

---

#### BUG-013 — Expenses: Calendar day modal only opens if 2+ expenses exist (`>= 2`)

**Page:** `Expenses.jsx` line 172  
**Severity:** Medium  
**Details:**
```js
const openDayModal = (day, dayExps) => {
  if (dayExps.length >= 2) { ... } // ← single expense days are not clickable
};
```
This means a day with exactly 1 expense shows the total but is not clickable/inspectable by the user. The user cannot see the expense details from the calendar for single-expense days.

**Fix:** Change condition to `if (dayExps.length >= 1)` or always open the modal.

---

#### BUG-014 — Task Assignment: No access guard — non-admins can navigate directly to `/TaskAssignment`

**Page:** `TaskAssignment.jsx`  
**Severity:** Medium  
**Details:** The sidebar hides "Task Assignment" for non-admins, but there is no route-level guard. A non-admin user who knows the URL can navigate directly to `/TaskAssignment` and see the full board.

**Fix:** Add an early return check:
```jsx
useEffect(() => {
  base44.auth.me().then(u => {
    if (u?.role !== "admin") { window.location.href = "/"; }
    loadData();
  });
}, []);
```

---

#### BUG-015 — Employees: No access guard — same issue as BUG-014

**Page:** `Employees.jsx`  
**Severity:** Medium  
**Details:** No `role === "admin"` check inside the component. A non-admin user accessing `/Employees` directly will see all employee data.

**Fix:** Same pattern as BUG-014.

---

#### BUG-016 — Expenses: Duplicate import of `eachDayOfInterval`

**Page:** `Expenses.jsx` line 24  
**Severity:** Medium (code quality / potential confusion)  
**Details:**
```js
import {
  ...
  eachDayOfInterval,
  ...
  eachDayOfInterval as eachDay   // ← imported twice, `eachDay` never used
} from "date-fns";
```
`eachDay` is never referenced in the component. This could cause linting errors and is dead code.

**Fix:** Remove `eachDayOfInterval as eachDay` from the import.

---

#### BUG-017 — Projects: No guard on `new Date(p.end_date)` when date string is malformed

**Page:** `Projects.jsx` lines 231, 267, 383, 386, 389  
**Severity:** Medium  
**Details:** `format(new Date(p.end_date), "MMM d, yyyy")` will throw `Invalid Date` or render "Invalid Date" if the stored date string is malformed or in an unexpected format (e.g. from a manual DB entry).

**Fix:** Wrap with a guard:
```js
const safeFormat = (dateStr, fmt) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : format(d, fmt);
};
```

---

#### BUG-018 — Timesheets: Chart shows ALL timesheet entries regardless of status filter

**Page:** `Timesheets.jsx` line 141  
**Severity:** Medium  
**Details:** The 30-day chart sums `filteredTimesheets` hours but doesn't distinguish between pending/approved/rejected — all statuses are mixed into the bars. A user may think they see approved hours when rejected entries are included.

**Fix:** Optionally filter chart data by approved only, or add a legend.

---

### 🔵 LOW

---

#### BUG-019 — Layout: Sidebar `lg:sticky lg:top-0 lg:self-start` causes sidebar not to fill full height on tall pages

**Page:** `Layout.js`  
**Severity:** Low  
**Details:** On large screens, the sidebar uses `sticky` + `self-start` which means it only occupies as much height as its content and stops scrolling with the page. The gradient background does not extend to the bottom of very long pages.

**Fix:** Use `lg:h-screen lg:overflow-y-auto` or replace with `lg:fixed` + matching left margin on the main content area.

---

#### BUG-020 — Profile: `isEmployee` state is set but never used

**Page:** `Profile.jsx` line 14  
**Severity:** Low  
**Details:**
```js
const [isEmployee, setIsEmployee] = useState(false);
setIsEmployee(u?.role === "user"); // set but never read
```
Dead code that adds confusion.

**Fix:** Remove both lines.

---

#### BUG-021 — Tasks: Email notification sent to admins even when editing an existing task

**Page:** `Tasks.jsx` lines 110–119  
**Severity:** Low  
**Details:** The email block is inside the `else` branch of `if (editTask)` ... `else { ... sendEmail }`, so it correctly only fires on create. However, **re-saving** the same task (e.g. changing priority) with existing assignees still sends a "New Task Assigned" email, because the `else` branch runs on any non-edit call. This is actually correct — but the email subject says "New Task Assigned" even if you're just updating a description on a newly created task. Low impact but confusing for admins.

**Fix:** Only send the email if `data.assigned_to.length > 0 && there were no previous assignees`.

---

#### BUG-022 — Expenses: Receipt link opens in new tab with no security `rel` attribute

**Page:** `Expenses.jsx` line 507  
**Severity:** Low  
**Details:**
```jsx
<a href={selectedExpense.receipt_url} target="_blank" className="...">View Receipt</a>
```
Missing `rel="noopener noreferrer"` — a minor security best practice for external links.

**Fix:** Add `rel="noopener noreferrer"`.

---

#### BUG-023 — All Pages: No "loading failed" error state shown to users

**Severity:** Low  
**Details:** When `Promise.allSettled` returns `status: "rejected"` for an entity, the page silently falls back to an empty array. Users see empty lists with no indication of a fetch failure.

**Fix:** Track a `loadError` state and show a banner: `"Some data could not be loaded. Please refresh."` when any settled result is rejected.

---

#### BUG-024 — Dashboard: Non-admin users' Dashboard is not a dedicated route (only accessible at `/`)

**Severity:** Low  
**Details:** The Dashboard is always the main page at `/`. Non-admin users who are redirected here see admin-labeled widgets and charts with potentially empty data. There is no non-admin-specific landing page.

**Recommendation:** Consider a personalized "My Work" landing page for non-admin users, or at minimum, fix BUG-011.

---

## UI/UX Findings

| # | Finding | Severity | Recommendation |
|---|---------|----------|----------------|
| UX-01 | Timesheet "Log Time" button is available to all users, but `User.filter()` inside `handleSave` will fail for non-admins (BUG-004) | High | Fix BUG-004 first |
| UX-02 | Expense form has both a category dropdown AND a free-text "new category" field — the relationship between them is unclear. If both are filled, only `newCategory` is used. | Medium | Add helper text: "Select existing OR type new below" |
| UX-03 | Calendar view in Timesheets does not allow clicking a day to see entries. In Expenses it works only for 2+ items (BUG-013). | Medium | Make all calendar days clickable |
| UX-04 | On mobile, the Timesheets and Expenses status badge is hidden (`hidden sm:flex`). On small screens, there's no status indicator at all. | Low | Show a colored dot or abbreviated badge on mobile |
| UX-05 | Task board view columns have no minimum height indicator — an empty column looks broken | Low | Add a "No tasks" placeholder in each empty column |
| UX-06 | Project form: `team_members` array field is in the entity schema but there is no UI to manage it in the create/edit form | Medium | Add a team member selector (similar to task assignees) |
| UX-07 | `manager_email` field is in the schema but not exposed in the project form UI | Low | Add as a dropdown of existing users |
| UX-08 | After successfully inviting a user, the dialog closes but there's no success toast/notification | Low | Show `"Invitation sent to {email}"` feedback |
| UX-09 | Profile page warns "Photo required — please upload one" but photo is not actually required by any schema rule | Low | Change to a softer suggestion: "Add a profile photo" |
| UX-10 | Dashboard "Pending Approvals" card only appears if there are pending items — on a fresh install this section is invisible. New admins may not know the workflow exists. | Low | Show the section always with a "No pending approvals" state |

---

## Performance Observations

| Area | Finding | Severity |
|------|---------|----------|
| Data fetching | Every page fetches all tasks and all projects on load regardless of pagination — this will degrade as data grows | Medium |
| No query caching | Each page manages its own state; navigating away and back re-fetches everything. TanStack Query is installed but unused on most pages. | Low |
| Email on every submission | `handleSave` on Timesheets/Expenses loops through all admin users and sends individual emails synchronously — this blocks the save button for a long time with many admins | Medium |
| Task Assignment board | Loads ALL non-completed tasks at once with no virtualization — could be slow with 500+ tasks | Low |
| Dashboard `Promise.all` | One slow entity fetch blocks all others (see BUG-002) | Critical |

---

## Security & Data Validation Summary

| Check | Status | Notes |
|-------|--------|-------|
| Authentication | ✅ Pass | Handled by Base44 platform |
| Admin-only route protection | ⚠️ Partial | Sidebar hides links but no route-level guards (BUG-014, BUG-015) |
| Role-based data filtering | ✅ Pass | Correctly filters projects/tasks/timesheets/expenses by user |
| Input validation — forms | ⚠️ Partial | Missing negative amount, negative hours, date range checks (BUG-007, BUG-008, BUG-009) |
| XSS protection | ✅ Pass | React renders text as text nodes by default |
| File upload | ✅ Pass | Via Base44 `UploadFile` integration; accepts `image/*,application/pdf` |
| External link security | ⚠️ Minor | Missing `rel="noopener noreferrer"` (BUG-022) |
| `User.list()` permission | ⚠️ Partial | Guarded client-side, but `User.filter()` called for non-admins in email notification flow (BUG-004, BUG-005) |

---

## Prioritized Fix List

| Priority | Bug ID | Description |
|----------|--------|-------------|
| 🔴 P0 | BUG-002 | Replace `Promise.all` with `Promise.allSettled` on Dashboard |
| 🔴 P0 | BUG-001 | Pass user/admin args to `loadData()` in Timesheets after mutations |
| 🔴 P0 | BUG-003 | Pass user/admin args to `loadData()` in Expenses after mutations |
| 🟠 P1 | BUG-004 | Guard `User.filter()` call in Timesheets `handleSave` for non-admins |
| 🟠 P1 | BUG-005 | Guard `User.filter()` call in Expenses `handleSave` for non-admins |
| 🟠 P1 | BUG-006 | Fix `loadData()` call args in Tasks after status change / deactivate |
| 🟠 P1 | BUG-008 | Validate hours > 0 and ≤ 24 before submitting timesheet |
| 🟠 P1 | BUG-009 | Validate amount > 0 before submitting expense |
| 🟠 P1 | BUG-007 | Validate end_date >= start_date in Projects |
| 🟡 P2 | BUG-014 | Add admin route guard to TaskAssignment |
| 🟡 P2 | BUG-015 | Add admin route guard to Employees |
| 🟡 P2 | BUG-013 | Allow single-expense days to open detail modal in Expenses calendar |
| 🟡 P2 | BUG-011 | Fix Dashboard title for non-admin users |
| 🟡 P2 | BUG-012 | Add "manager" role to Invite dialog |
| 🟡 P2 | UX-06 | Add team_members selector to Project form |
| 🔵 P3 | BUG-016 | Remove duplicate import in Expenses |
| 🔵 P3 | BUG-020 | Remove unused `isEmployee` state in Profile |
| 🔵 P3 | BUG-022 | Add `rel="noopener noreferrer"` to receipt link |
| 🔵 P3 | BUG-017 | Add safe date formatting helper across all pages |
| 🔵 P3 | BUG-023 | Add error state feedback when data loading fails |

---

## Go-Live Readiness Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| Core Functionality | 🟡 75% | Functional but BUG-001/003 can show wrong data to wrong users |
| Security | 🟡 70% | No route-level admin guards; non-admin email API calls will fail |
| Input Validation | 🟠 60% | Missing amount/hours/date range validation |
| UI/UX | 🟢 85% | Clean, consistent design; minor gaps |
| Performance | 🟡 75% | Acceptable for small teams; needs optimization at scale |
| Code Quality | 🟡 80% | Good overall; some dead code and repeated patterns |

### **Final Verdict: ⚠️ CONDITIONAL PASS**

The application is well-architected and production-ready in terms of design and feature completeness. Fix the **7 P0/P1 critical and high items** before go-live, particularly the data-leakage risk from incorrect `loadData()` arguments (BUG-001, BUG-003) and the `User.filter()` permission failures for non-admins (BUG-004, BUG-005). These can cause visible failures for regular users on their primary workflows (logging time and submitting expenses).