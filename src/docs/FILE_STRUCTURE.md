# File Structure

```
src/
├── api/
│   └── base44Client.js          # Pre-initialized Base44 SDK singleton
│
├── components/
│   ├── ui/                      # shadcn/ui components (do not edit)
│   │   ├── avatar.jsx
│   │   ├── badge.jsx
│   │   ├── button.jsx
│   │   ├── calendar.jsx
│   │   ├── card.jsx
│   │   ├── checkbox.jsx
│   │   ├── dialog.jsx
│   │   ├── dropdown-menu.jsx
│   │   ├── input.jsx
│   │   ├── label.jsx
│   │   ├── progress.jsx
│   │   ├── select.jsx
│   │   ├── separator.jsx
│   │   ├── skeleton.jsx
│   │   ├── tabs.jsx
│   │   ├── textarea.jsx
│   │   ├── toast.jsx
│   │   ├── toaster.jsx
│   │   └── ... (other radix primitives)
│   │
│   └── UserNotRegisteredError.jsx  # Shown when user exists but isn't registered in app
│
├── entities/                    # JSON schema definitions for Base44 database
│   ├── Project.json
│   ├── Task.json
│   ├── Timesheet.json
│   ├── Expense.json
│   └── ExpenseCategory.json
│
├── hooks/
│   └── use-mobile.jsx           # Detects mobile viewport
│
├── lib/
│   ├── app-params.js            # Base44 app ID and config
│   ├── AuthContext.jsx          # Auth state provider
│   ├── NavigationTracker.jsx    # Tracks page views
│   ├── PageNotFound.jsx         # 404 page
│   ├── query-client.js          # TanStack Query client instance
│   └── utils.js                 # createPageUrl() helper
│
├── pages/
│   ├── Dashboard.jsx            # Admin KPI dashboard
│   ├── Projects.jsx             # Project management (list + grid views)
│   ├── Tasks.jsx                # Task management (list + board views)
│   ├── Timesheets.jsx           # Timesheet logging and approval
│   ├── Expenses.jsx             # Expense submission and approval
│   ├── Employees.jsx            # Employee directory (admin)
│   ├── TaskAssignment.jsx       # Drag-and-drop task assignment (admin)
│   └── Profile.jsx              # User profile editor
│
├── docs/                        # This documentation folder
│   ├── README.md
│   ├── DATABASE.md
│   └── FILE_STRUCTURE.md
│
├── App.jsx                      # Root: providers + routing
├── Layout.js                    # Sidebar + header shell wrapper
├── index.css                    # Tailwind base + CSS custom properties
├── main.jsx                     # React DOM entry point
├── pages.config.js              # Page → component mapping + layout config
└── tailwind.config.js           # Tailwind theme extending CSS variables
```

---

## Routing

Routes are defined in two places:

1. **`pages.config.js`** — maps page names to components, sets the default landing page and layout wrapper
2. **`App.jsx`** — reads `pagesConfig` and generates `<Route>` elements; new pages added outside the config loop need explicit `<Route>` entries

### Route Pattern
```
/           → Dashboard (main page)
/Projects   → Projects
/Tasks      → Tasks
/Timesheets → Timesheets
/Expenses   → Expenses
/Employees  → Employees
/TaskAssignment → TaskAssignment
/Profile    → Profile
*           → PageNotFound
```

---

## Layout

`Layout.js` wraps every page. It provides:
- **Sidebar** with brand logo, navigation links (filtered by role), and user dropdown
- **Top header** with page title, admin badge, and avatar
- **Mobile support**: collapsible sidebar with overlay

Navigation items are defined in a `NAV_ITEMS` array. Items with `adminOnly: true` are hidden from non-admin users.

---

## Key Patterns

### Auth + Role Check
```js
useEffect(() => {
  base44.auth.me().then(u => {
    setCurrentUser(u);
    setIsAdmin(u?.role === "admin");
    loadData(u); // pass user directly to avoid stale state
  }).catch(() => setLoading(false));
}, []);
```

### Resilient Data Fetching
```js
const [aRes, bRes] = await Promise.allSettled([
  base44.entities.EntityA.list(),
  base44.entities.EntityB.list(),
]);
setA(aRes.status === "fulfilled" ? aRes.value : []);
setB(bRes.status === "fulfilled" ? bRes.value : []);
```

### Update User Profile
```js
await base44.auth.updateMe({ phone, department, position, location });
```

### File Upload (for expense receipts / profile photos)
```js
const { file_url } = await base44.integrations.Core.UploadFile({ file: fileObject });
```

### Send Email
```js
await base44.integrations.Core.SendEmail({
  to: "user@example.com",
  subject: "Subject here",
  body: "Email body text"
});
``