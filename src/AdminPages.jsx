import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  FolderKanban,
  Gauge,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Upload,
  Users,
  WalletCards,
} from 'lucide-react'

function PageFrame({ title, subtitle, actions, children }) {
  return (
    <div className="page admin-page">
      <div className="admin-heading">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {actions && <div className="admin-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

function PrimaryButton({ children }) { return <button className="primary-button">{children}</button> }
function SelectButton({ children }) { return <button className="select-like">{children}</button> }
function Status({ children, tone = 'green' }) { return <span className={`status status-${tone}`}>{children}</span> }

function StatGrid({ items }) {
  return <div className="admin-stat-grid">{items.map(({ label, value, note, icon: Icon, tone }) => <article className="admin-stat" key={label}><div className={`stat-icon ${tone || ''}`}><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></article>)}</div>
}

function Panel({ title, action, children, className = '' }) {
  return <section className={`data-panel ${className}`}><div className="data-panel-head"><h3>{title}</h3>{action && <button>{action} ↗</button>}</div>{children}</section>
}

const tasks = [
  ['Design Secure API Integration Architecture for Customer Portal', '', 'In Progress', 'Overdue'],
  ['sdfsdfs', 'to secure the AMD process', 'In Progress', ''],
]

export function MyWorkDashboard() {
  return (
    <PageFrame title="Good morning, aashoodeep 👋" subtitle="Saturday, August 1, 2026" actions={<PrimaryButton><Clock3 size={15} />Log Time</PrimaryButton>}>
      <StatGrid items={[
        { label: 'Hours This Week', value: '0h', note: 'logged', icon: Clock3, tone: 'purple' },
        { label: 'Tasks In Progress', value: '2', note: 'active', icon: Activity, tone: 'red' },
        { label: 'Pending Timesheets', value: '0', note: 'awaiting review', icon: Clock3, tone: 'orange' },
        { label: 'Pending Expenses', value: '0', note: 'awaiting review', icon: WalletCards, tone: 'gold' },
      ]} />
      <div className="attention-banner"><AlertTriangle size={16} /><strong>2 overdue tasks need attention</strong><button>View Tasks ↗</button></div>
      <div className="work-grid">
        <Panel title="Today's Tasks" action="All tasks"><div className="row-list">{tasks.map(([name, project, state, overdue]) => <div className="data-row" key={name}><Clock3 size={15} /><div><strong>{name}</strong>{project && <small>{project}</small>}</div><Status tone="blue">{state}</Status>{overdue && <span className="overdue">{overdue}</span>}</div>)}</div></Panel>
        <Panel title="My Projects" action="All projects"><div className="panel-empty">No projects assigned yet</div></Panel>
        <Panel title="Recent Timesheets" action="View all"><div className="row-list"><div className="data-row"><div><strong>Internal HR Portal</strong><small>2026-02-24 · 6h</small></div><Status>approved</Status></div><div className="data-row"><div><strong>Mobile App Redesign</strong><small>2026-02-19 · 4h</small></div><Status>approved</Status></div></div></Panel>
        <Panel title="Upcoming Deadlines"><div className="panel-empty">No upcoming deadlines</div></Panel>
      </div>
    </PageFrame>
  )
}

export function ExecutiveDashboard() {
  return (
    <PageFrame title="Executive Dashboard" subtitle="Company-wide performance and operations">
      <StatGrid items={[
        { label: 'Active Projects', value: '2', note: '4 total projects', icon: FolderKanban, tone: 'purple' },
        { label: 'Active Tasks', value: '8', note: '2 overdue', icon: ClipboardList, tone: 'red' },
        { label: 'Total Budget', value: '$254k', note: '$449 spent', icon: CircleDollarSign, tone: 'gold' },
        { label: 'Team Members', value: '5', note: '4 currently active', icon: Users, tone: 'orange' },
      ]} />
      <div className="work-grid">
        <Panel title="Active Project Timelines"><ProjectRows /></Panel>
        <Panel title="Projects at Risk"><div className="panel-empty"><CheckCircle2 size={23} />No projects at risk</div></Panel>
        <Panel title="Team Capacity vs Estimated Work"><CapacityRows /></Panel>
        <Panel title="Cost vs Revenue by Project"><div className="bar-placeholder"><span style={{ height: '25%' }} /><span style={{ height: '48%' }} /><span style={{ height: '74%' }} /><span style={{ height: '38%' }} /></div></Panel>
      </div>
    </PageFrame>
  )
}

function ProjectRows() {
  return <div className="row-list">{[['Mobile App Redesign','TechCorp Ltd','active'],['E-Commerce Platform','RetailMax Inc','active'],['Data Analytics Dashboard','DataVis Corp','completed'],['to secure the AMD process','AMD tech','planning']].map(([name,client,state])=><div className="data-row" key={name}><FolderKanban size={16}/><div><strong>{name}</strong><small>{client}</small></div><Status tone={state === 'completed' ? 'green' : 'blue'}>{state}</Status></div>)}</div>
}

function CapacityRows() {
  return <div className="capacity-list">{[['aashoodeep singh thind',3],['Manjot Kaur',2],['steve.evans1208',1],['test account',1],['Mohit Josan',1]].map(([name,count])=><div key={name}><span>{name}</span><div className="progress-track"><i style={{width:`${count * 22}%`}} /></div><strong>{count}</strong></div>)}</div>
}

export function EmployeesPage() {
  return <PageFrame title="Employee 360° Profiles" subtitle="0 members · Performance · Skills · Reviews" actions={<><SelectButton>All Roles</SelectButton><PrimaryButton><Plus size={15}/>Invite</PrimaryButton></>}><StatGrid items={[{label:'Employees',value:'0',note:'registered members',icon:Users,tone:'purple'},{label:'Active Projects',value:'4',note:'across the team',icon:FolderKanban,tone:'red'},{label:'Tasks Completed',value:'10',note:'all time',icon:CheckCircle2,tone:'orange'},{label:'Hours Logged',value:'10h',note:'approved',icon:Clock3,tone:'gold'}]}/><div className="large-empty"><Users size={30}/><strong>No users found</strong><span>Invite employees to build your team directory.</span></div></PageFrame>
}

export function TaskAssignmentPage() {
  return <PageFrame title="Task Assignment" subtitle="Assign work and balance team capacity" actions={<PrimaryButton><Plus size={15}/>New Task</PrimaryButton>}><div className="assignment-layout"><Panel title="Unassigned Tasks"><div className="row-list"><div className="data-row"><ClipboardList size={16}/><div><strong>new test task</strong><small>Data Analytics Dashboard</small></div><Status tone="gray">Todo</Status></div></div></Panel><Panel title="Team Workload"><CapacityRows /></Panel></div></PageFrame>
}

export function ProcurementPage() {
  return <PageFrame title="Inventory & Asset Management" subtitle="Procurement · Asset usage tracking · Inventory levels · Vendor management" actions={<PrimaryButton><Plus size={15}/>New Request</PrimaryButton>}><div className="pill-tabs"><button className="active">Items</button><button>Inventory</button><button>Usage Log</button></div><StatGrid items={[{label:'Total Value',value:'$0',icon:CircleDollarSign,tone:'purple'},{label:'Pending Approval',value:'0',icon:Clock3,tone:'orange'},{label:'Delivered',value:'0',icon:PackageCheck,tone:'green'},{label:'Low Stock',value:'0',icon:AlertTriangle,tone:'red'}]}/><div className="table-toolbar"><SelectButton>All Statuses</SelectButton><SelectButton>All Categories</SelectButton></div><div className="large-empty"><ShoppingCart size={30}/><strong>No procurement items found</strong></div></PageFrame>
}

export function BillingPage() {
  return <PageFrame title="Billing & Invoicing" subtitle="1 invoices · Generate from timesheets & expenses" actions={<PrimaryButton><Plus size={15}/>New Invoice</PrimaryButton>}><StatGrid items={[{label:'Total Collected',value:'$0.6k',icon:CircleDollarSign,tone:'green'},{label:'Pending Payment',value:'$0.0k',icon:Clock3,tone:'orange'},{label:'Overdue Invoices',value:'0',icon:AlertTriangle,tone:'red'},{label:'Draft Invoices',value:'0',icon:FileText,tone:'purple'}]}/><div className="pill-tabs"><button className="active">All</button><button>Draft</button><button>Sent</button><button>Paid</button><button>Overdue</button><button>Cancelled</button></div><section className="invoice-card"><div><div className="invoice-title"><strong>INV-570083</strong><Status>paid</Status></div><p>AMD tech · to secure the AMD process</p><small>Due: 2026-04-23 · Paid: 2026-04-09 · USD</small></div><div className="invoice-total"><strong>$627.15</strong><small>incl. 13% tax</small><button>PDF</button></div></section></PageFrame>
}

export function ResourcePlanningPage() {
  return <PageFrame title="Resource Planning" subtitle="Team capacity, workload and project allocation"><StatGrid items={[{label:'Team Members',value:'5',note:'available resources',icon:Users,tone:'purple'},{label:'Active Assignments',value:'8',note:'across 4 projects',icon:ClipboardCheck,tone:'blue'},{label:'Overloaded',value:'0',note:'team members',icon:AlertTriangle,tone:'red'},{label:'Available Capacity',value:'72%',note:'this week',icon:Gauge,tone:'green'}]}/><div className="work-grid"><Panel title="Team Capacity vs Estimated Work"><CapacityRows /></Panel><Panel title="Project Allocation"><ProjectRows /></Panel></div></PageFrame>
}

export function ReportsPage() {
  return <PageFrame title="Reports" subtitle="Project, task, expense and timesheet analytics"><div className="report-grid">{[['Projects Report','4 projects','Portfolio status, budgets and progress',FolderKanban],['Tasks Report','8 active tasks','Completion, priority and overdue analysis',ClipboardList],['Expenses Report','$449 approved','Spend by project and category',WalletCards],['Timesheets Report','10h logged','Hours by employee and project',Clock3],['Cost vs Revenue','Finance','Margin and profitability trends',TrendingUp],['Team Utilization','Resources','Capacity and workload reporting',Users]].map(([name,value,note,Icon])=><article className="report-card" key={name}><Icon size={22}/><h3>{name}</h3><strong>{value}</strong><p>{note}</p><button>Open report ↗</button></article>)}</div></PageFrame>
}

const ganttTasks = [
  ['new test task','Data Analytics Dashboard','M',18,32],['fix wires in amd','to secure the AMD process','M',10,45],['task for steve','Data Analytics Dashboard','S',38,26],['new task for test account','E-Commerce Platform','N',53,31],['Test','Data Analytics Dashboard','M',63,20],['Design Secure API Integration Architecture for Customer Portal','','AM',14,70],['test','Mobile App Redesign','A',73,18],
]

export function GanttPage() {
  return <PageFrame title="Gantt / Resource Scheduler" subtitle="Visual timeline of all projects and tasks"><div className="scheduler-controls"><div className="pill-tabs"><button className="active">Tasks</button><button>Projects</button></div><div className="pill-tabs"><button className="active">2 Weeks</button><button>Month</button></div><strong>Jul 27 – Aug 9, 2026</strong><button className="secondary-button">Today</button><SelectButton>All Projects</SelectButton><SelectButton>All Assignees</SelectButton></div><section className="gantt-board"><div className="gantt-days"><strong>Task</strong>{['Mon 27','Tue 28','Wed 29','Thu 30','Fri 31','Sat 1','Sun 2','Mon 3','Tue 4','Wed 5','Thu 6','Fri 7','Sat 8','Sun 9'].map(day=><span key={day}>{day}</span>)}</div>{ganttTasks.map(([name,project,person,left,width])=><div className="gantt-row" key={name}><div><strong>{name}</strong><small>{project}</small></div><div className="gantt-track"><i style={{left:`${left}%`,width:`${width}%`}}>{person}</i></div></div>)}</section><Panel title="Resource Load (active tasks per person)"><CapacityRows /></Panel></PageFrame>
}

export function DocumentHubPage() {
  return <PageFrame title="Document & Knowledge Hub" subtitle="0 documents · SOPs, Contracts, Reports & more" actions={<PrimaryButton><Upload size={15}/>Upload Doc</PrimaryButton>}><div className="document-types">{[['Sop',0],['Contract',0],['Report',0],['Meeting Notes',0]].map(([label,count])=><article key={label}><FileText size={19}/><strong>{count}</strong><span>{label}</span></article>)}</div><div className="table-toolbar"><SelectButton>All Categories</SelectButton><SelectButton>All Projects</SelectButton></div><div className="large-empty"><BookOpen size={30}/><strong>No documents found</strong></div></PageFrame>
}

export function CompliancePage() {
  return <PageFrame title="Compliance & Audit" subtitle="Security, policy and operational audit trail"><StatGrid items={[{label:'Compliance Score',value:'100%',note:'all controls healthy',icon:ShieldCheck,tone:'green'},{label:'Open Findings',value:'0',note:'requires action',icon:AlertTriangle,tone:'red'},{label:'Audit Events',value:'0',note:'in selected period',icon:Activity,tone:'purple'},{label:'Policies',value:'0',note:'documents tracked',icon:BookOpen,tone:'gold'}]}/><Panel title="Recent Audit Activity"><div className="panel-empty"><ShieldCheck size={25}/>No audit events recorded</div></Panel></PageFrame>
}

export function ActivityPage() {
  return <PageFrame title="Activity Feed" subtitle="Recent activity across projects, tasks, expenses and timesheets"><StatGrid items={[{label:'Expense Events',value:'0',note:'None',icon:WalletCards,tone:'gold'},{label:'Timesheet Events',value:'0',note:'None',icon:Clock3,tone:'purple'},{label:'Task Events',value:'0',note:'None',icon:ClipboardList,tone:'blue'},{label:'Pending Actions',value:'0',note:'None',icon:AlertTriangle,tone:'red'}]}/><div className="table-toolbar"><SelectButton>All Activity</SelectButton><span>0 events</span></div><div className="large-empty"><Activity size={30}/><strong>No activity to show</strong></div></PageFrame>
}

export function ApprovalsPage() {
  const [tab,setTab]=useState('Expenses')
  return <PageFrame title="Approvals" subtitle="Review and approve pending expenses & timesheets"><div className="pill-tabs approval-tabs"><button className={tab==='Expenses'?'active':''} onClick={()=>setTab('Expenses')}><WalletCards size={15}/>Expenses</button><button className={tab==='Timesheets'?'active':''} onClick={()=>setTab('Timesheets')}><Clock3 size={15}/>Timesheets</button></div><div className="large-empty"><ClipboardCheck size={30}/><strong>No pending {tab.toLowerCase()}</strong><span>Everything has been reviewed.</span></div></PageFrame>
}

const budgets = [
  ['to secure the AMD process','AMD tech','planning','$34,000','$30','$33,970','Mar 25, 2026'],
  ['Data Analytics Dashboard','DataVis Corp','completed','$55,000','$243','$54,757','Jan 30, 2026'],
  ['E-Commerce Platform','RetailMax Inc','active','$120,000','$23','$119,977','Jun 14, 2026'],
  ['Mobile App Redesign','TechCorp Ltd','active','$45,000','$153','$44,847','Apr 29, 2026'],
]

export function BudgetPage() {
  return <PageFrame title="Budget Tracker" subtitle="Real-time budget vs. actual spend across all projects"><StatGrid items={[{label:'Total Budget',value:'$254,000',note:'4 projects',icon:CircleDollarSign,tone:'purple'},{label:'Total Spent',value:'$449',note:'0% of budget',icon:WalletCards,tone:'red'},{label:'Pending',value:'$0',note:'awaiting approval',icon:Clock3,tone:'orange'},{label:'At Risk',value:'0',note:'0 over budget',icon:AlertTriangle,tone:'green'}]}/><Panel title="Overall Portfolio Budget"><div className="portfolio-budget"><strong>0% used</strong><div className="progress-track"><i style={{width:'1%'}}/></div><span>Approved $449 · Pending $0 · Remaining $253,551</span></div></Panel><div className="budget-toolbar"><SelectButton>All Projects</SelectButton><SelectButton>Sort: % Used</SelectButton><span>4 projects with budget</span></div><div className="budget-projects">{budgets.map(([name,client,state,total,spent,remaining,end])=><article className="budget-card" key={name}><div className="budget-title"><div><h3>{name}</h3><p>{client} · {state}</p></div><Status>on track</Status></div><div className="budget-util"><span>Budget utilization</span><strong>0%</strong></div><div className="budget-values"><div><span>Total Budget</span><strong>{total}</strong></div><div><span>Approved Spend</span><strong>{spent}</strong></div><div><span>Pending</span><strong>$0</strong></div><div><span>Remaining</span><strong>{remaining}</strong></div></div><small>Daily burn rate: $0/day · Project ends: {end}</small></article>)}</div></PageFrame>
}
