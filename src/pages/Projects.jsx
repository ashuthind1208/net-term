import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { parseLocalDate } from "@/lib/dateUtils";
import { format } from "date-fns";
import {
  Plus, Search, MoreVertical, FolderKanban,
  Edit2, Eye, DollarSign, LayoutGrid, List,
  MapPin, CheckCircle2, Clock, AlertCircle, Circle, XCircle, Users,
  Package, Printer, Download, TrendingUp, TrendingDown, Receipt, ExternalLink, Building2
} from "lucide-react";
import { exportProjectInvoicePDF } from "@/lib/pdfUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  planning: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};
const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};
const TASK_STATUS_CONFIG = {
  todo:        { label: "To Do",       color: "bg-gray-100 text-gray-600",    icon: Circle },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700",    icon: Clock },
  in_review:   { label: "In Review",   color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  completed:   { label: "Completed",   color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  blocked:     { label: "Blocked",     color: "bg-red-100 text-red-700",      icon: AlertCircle },
};
const PROJECT_COLORS = ["#A55B4B", "#4F1C51", "#DCA06D", "#210F37", "#7B3F6E", "#2D6A4F", "#1A759F"];
const PIE_COLORS = ["#A55B4B", "#4F1C51", "#DCA06D", "#210F37", "#7B3F6E", "#5B8FA5"];
const PREVIEW_LIMIT = 5;
const DEFAULT_PROJECT = {
  name: "", description: "", location: "", status: "planning", priority: "medium",
  start_date: "", end_date: "", budget: "", billing_rate: "", client_name: "", client_email: "",
  team_members: [], color: "#A55B4B"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeFormat(dateStr, fmt) {
  if (!dateStr) return "—";
  const d = parseLocalDate(dateStr);
  return isNaN(d.getTime()) ? "—" : format(d, fmt);
}

function initials(nameOrEmail) {
  if (!nameOrEmail) return "?";
  const parts = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0].split(/[._-]/)
    : nameOrEmail.split(" ");
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
}

function MiniAvatar({ label, color = "#A55B4B" }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white shrink-0 text-[9px] font-bold" style={{ background: color }} title={label}>
      {initials(label)}
    </span>
  );
}

function getUserColor(email) {
  const colors = ["#A55B4B", "#4F1C51", "#DCA06D", "#210F37", "#5B8FA5", "#7B3F6E"];
  let hash = 0;
  for (let i = 0; i < (email || "").length; i++) hash = (hash + email.charCodeAt(i)) % colors.length;
  return colors[hash];
}

// ─── ViewAllModal (Finance) ────────────────────────────────────────────────────
function ViewAllModal({ open, onClose, title, items, renderRow, renderHeader }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="text-[#210F37]">{title}</DialogTitle></DialogHeader>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-gray-500 border-b">{renderHeader()}</tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id || i} className="border-b last:border-0 hover:bg-gray-50/50">{renderRow(item)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Overview tab
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [viewProject, setViewProject] = useState(null);
  const [form, setForm] = useState(DEFAULT_PROJECT);
  const [saving, setSaving] = useState(false);

  // Finance tab
  const [financeProject, setFinanceProject] = useState("all");
  const [finModal, setFinModal] = useState(null);

  // Client tab
  const [clientProject, setClientProject] = useState("all");

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      setIsAdmin(u?.role === "admin");
      loadData(u);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async (me) => {
    const user = me || currentUser;
    const admin = me ? me.role === "admin" : isAdmin;
    const [allProjects, t, e, prResult, uResult, tsResult] = await Promise.allSettled([
      base44.entities.Project.list("-created_date"),
      base44.entities.Task.list(),
      base44.entities.Expense.list(),
      base44.entities.Procurement.list(),
      admin ? base44.entities.User.list() : Promise.resolve([]),
      admin ? base44.entities.Timesheet.list() : Promise.resolve([]),
    ]);
    const allP = allProjects.status === "fulfilled" ? allProjects.value : [];
    const allTasks = t.status === "fulfilled" ? t.value : [];
    const assignedProjectIds = new Set(allTasks.filter(tk => tk.assigned_to?.includes(user?.email)).map(tk => tk.project_id));
    const filteredP = admin ? allP : allP.filter(p =>
      p.team_members?.includes(user?.email) || p.manager_email === user?.email || assignedProjectIds.has(p.id)
    );
    setProjects(filteredP);
    setTasks(t.status === "fulfilled" ? t.value : []);
    setExpenses(e.status === "fulfilled" ? e.value : []);
    setProcurements(prResult.status === "fulfilled" ? prResult.value : []);
    setUsers(uResult.status === "fulfilled" ? uResult.value : []);
    setTimesheets(tsResult.status === "fulfilled" ? tsResult.value : []);
    setLoading(false);
  };

  // ── CRUD ──
  const openCreate = () => { setEditProject(null); setForm(DEFAULT_PROJECT); setShowFormDialog(true); };
  const openEdit = (p) => { setEditProject(p); setForm({ ...DEFAULT_PROJECT, ...p, budget: p.budget || "", team_members: p.team_members || [] }); setShowFormDialog(true); };
  const openView = (p) => { setViewProject(p); setShowViewDialog(true); };

  const handleSave = async () => {
    if (form.end_date && form.start_date && form.end_date < form.start_date) { alert("End date cannot be before start date"); return; }
    setSaving(true);
    const data = { ...form, budget: form.budget ? Number(form.budget) : undefined, billing_rate: form.billing_rate ? Number(form.billing_rate) : undefined };
    if (editProject) await base44.entities.Project.update(editProject.id, data);
    else await base44.entities.Project.create(data);
    setSaving(false); setShowFormDialog(false); loadData(currentUser);
  };

  const handleDeactivate = async (project) => {
    const hasTasks = tasks.some(t => t.project_id === project.id);
    if (hasTasks) {
      if (!confirm("This project has tasks. It will be marked as 'completed' for audit purposes. Continue?")) return;
      await base44.entities.Project.update(project.id, { status: "completed" });
    } else {
      if (!confirm("Mark this project as cancelled?")) return;
      await base44.entities.Project.update(project.id, { status: "cancelled" });
    }
    loadData(currentUser);
  };

  // ── Stats helpers ──
  const getProjectStats = (p) => {
    const pTasks = tasks.filter(t => t.project_id === p.id);
    const done = pTasks.filter(t => t.status === "completed").length;
    const totalExp = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
    return { totalTasks: pTasks.length, completedTasks: done, pct: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0, totalExpenses: totalExp };
  };

  const getUserByEmail = (email) => users.find(u => u.email === email);

  // ── Finance calculation ──
  const calcProjectFinance = (p) => {
    const projExpenses = expenses.filter(e => e.project_id === p.id && e.status === "approved");
    const expenseTotal = projExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const projProcurement = procurements.filter(pr => pr.project_id === p.id && !["cancelled", "draft"].includes(pr.status));
    const procurementTotal = projProcurement.reduce((s, pr) => s + (pr.total_amount || 0), 0);
    const projTimesheets = timesheets.filter(ts => ts.project_id === p.id && ts.status === "approved");
    const projTasks = tasks.filter(t => t.project_id === p.id);
    let labourCost = 0;
    projTimesheets.forEach(ts => {
      let rate = 0;
      projTasks.forEach(t => {
        if (t.assigned_to?.includes(ts.employee_email)) {
          const ro = (t.assignee_rates || []).find(r => r.email === ts.employee_email);
          if (ro?.hourly_rate) rate = Math.max(rate, ro.hourly_rate);
        }
      });
      if (!rate) rate = p.billing_rate || 0;
      labourCost += (ts.hours || 0) * rate;
    });
    const totalCost = expenseTotal + procurementTotal + labourCost;
    const revenue = p.budget || 0;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const totalHours = projTimesheets.reduce((s, ts) => s + (ts.hours || 0), 0);
    return { expenseTotal, procurementTotal, labourCost, totalCost, revenue, profit, margin, totalHours, projExpenses, projProcurement, projTimesheets };
  };

  const getRate = (ts, projTasks, proj) => {
    let rate = 0;
    projTasks.forEach(t => {
      if (t.assigned_to?.includes(ts.employee_email)) {
        const ro = (t.assignee_rates || []).find(r => r.email === ts.employee_email);
        if (ro?.hourly_rate) rate = Math.max(rate, ro.hourly_rate);
      }
    });
    if (!rate) rate = proj.billing_rate || 0;
    return rate;
  };

  const downloadProjectInvoice = (proj, fin) => {
    const invoiceNumber = `INV-${proj.id.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const projectTasks = tasks.filter(task => task.project_id === proj.id);
    const labourRows = fin.projTimesheets.map(timesheet => {
      const rate = getRate(timesheet, projectTasks, proj);
      return { name: timesheet.employee_name || timesheet.employee_email, date: timesheet.date || "", hours: timesheet.hours, rate, amount: (timesheet.hours || 0) * rate };
    });
    const expenseRows = fin.projExpenses.map(expense => ({ name: expense.title, category: expense.category, date: expense.date || "", amount: expense.amount || 0 }));
    const procurementRows = fin.projProcurement.map(item => ({ name: item.title, vendor: item.vendor_supplier || "", qty: item.quantity, unit: item.unit || "", unitPrice: item.unit_price || 0, amount: item.total_amount || 0, date: item.order_date || "" }));
    exportProjectInvoicePDF({
      invoiceNumber,
      project: proj,
      labourRows,
      expenseRows,
      procurementRows,
      labourTotal: labourRows.reduce((sum, row) => sum + row.amount, 0),
      expenseTotal: expenseRows.reduce((sum, row) => sum + row.amount, 0),
      procurementTotal: procurementRows.reduce((sum, row) => sum + row.amount, 0),
      totalCost: fin.totalCost,
      revenue: fin.revenue,
      profit: fin.profit,
      margin: fin.margin,
    });
  };

  // ── Invoice generation ──
  const generateInvoice = (proj, fin) => {
    const now = format(new Date(), "yyyy-MM-dd");
    const invoiceNum = `INV-${proj.id.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const projTasks2 = tasks.filter(t => t.project_id === proj.id);
    const labourRows = fin.projTimesheets.map(ts => { const rate = getRate(ts, projTasks2, proj); return { name: ts.employee_name || ts.employee_email, date: ts.date || "", hours: ts.hours, rate, amount: (ts.hours || 0) * rate }; });
    const labourTotal = labourRows.reduce((s, r) => s + r.amount, 0);
    const expenseRows = fin.projExpenses.map(e => ({ name: e.title, category: e.category, date: e.date || "", amount: e.amount || 0 }));
    const expenseTotal = expenseRows.reduce((s, r) => s + r.amount, 0);
    const procRows = fin.projProcurement.map(pr => ({ name: pr.title, vendor: pr.vendor_supplier || "", qty: pr.quantity, unit: pr.unit || "", unitPrice: pr.unit_price || 0, amount: pr.total_amount || 0, date: pr.order_date || "" }));
    const procTotal = procRows.reduce((s, r) => s + r.amount, 0);
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoiceNum}</title>
    <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Arial, sans-serif; color: #210F37; background: white; } .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 14mm; page-break-after: always; } .page:last-child { page-break-after: auto; } .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; } .company { font-size: 22px; font-weight: bold; color: #210F37; } .sub { font-size: 11px; color: #888; margin-top: 3px; } .invoice-num { font-size: 14px; font-weight: bold; color: #A55B4B; text-align: right; } hr { border: none; border-top: 2px solid #A55B4B; margin: 14px 0; } .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; } .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; } .value { font-size: 13px; font-weight: 600; } .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; } .summary-box { border: 1px solid #eee; border-radius: 8px; padding: 12px; text-align: center; } .summary-box .amt { font-size: 18px; font-weight: bold; margin-top: 4px; } .totals { margin-top: 28px; border-top: 2px solid #210F37; } .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; } .total-row.bold { font-weight: bold; font-size: 15px; } .profit { color: ${fin.profit >= 0 ? "#16a34a" : "#dc2626"}; } .section-title { font-size: 12px; font-weight: bold; color: #210F37; background: #f5f0ff; padding: 6px 10px; border-radius: 4px; margin: 16px 0 8px; } table { width: 100%; border-collapse: collapse; font-size: 10px; } th { background: #210F37; color: white; padding: 5px 8px; text-align: left; font-size: 10px; } td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; } tr:nth-child(even) td { background: #fafafa; } .text-right { text-align: right; } @media print { button { display: none !important; } } .print-btn { position: fixed; bottom: 24px; right: 24px; background: #A55B4B; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }</style></head><body>
    <div class="page"><div class="header"><div><div class="company">Net Term Solutions</div><div class="sub">Project Finance Invoice</div></div><div style="text-align:right"><div class="invoice-num">${invoiceNum}</div><div class="sub">Date: ${now}</div><div class="sub">Due: ${proj.end_date || "Upon receipt"}</div></div></div><hr/>
    <div class="grid2"><div><div class="label">Bill To</div><div class="value">${proj.client_name || "Client"}</div><div style="font-size:11px;color:#888;margin-top:3px">${proj.client_email || ""}</div></div><div><div class="label">Project</div><div class="value">${proj.name}</div><div style="font-size:11px;color:#888;margin-top:3px">${proj.location ? `${proj.location} · ` : ""}${proj.start_date || "—"} → ${proj.end_date || "—"}</div><div style="font-size:11px;color:#888;">Status: ${proj.status || "—"}</div></div></div>
    <div class="label" style="margin-bottom:8px">Cost Summary</div><div class="summary-grid"><div class="summary-box"><div class="label">Labour</div><div class="amt" style="color:#4F1C51">$${labourTotal.toFixed(2)}</div></div><div class="summary-box"><div class="label">Expenses</div><div class="amt" style="color:#A55B4B">$${expenseTotal.toFixed(2)}</div></div><div class="summary-box"><div class="label">Procurement</div><div class="amt" style="color:#DCA06D">$${procTotal.toFixed(2)}</div></div></div>
    <div class="totals"><div class="total-row"><span>Labour Cost</span><span>$${labourTotal.toFixed(2)}</span></div><div class="total-row"><span>Expenses</span><span>$${expenseTotal.toFixed(2)}</span></div><div class="total-row"><span>Procurement</span><span>$${procTotal.toFixed(2)}</span></div><div class="total-row bold" style="border-top:2px solid #210F37;margin-top:4px;padding-top:10px"><span>Total Cost</span><span>$${fin.totalCost.toFixed(2)}</span></div><div class="total-row bold"><span>Contract / Budget</span><span>$${fin.revenue.toFixed(2)}</span></div><div class="total-row bold profit"><span>Net Profit / Loss</span><span>$${fin.profit.toFixed(2)} (${fin.margin.toFixed(1)}%)</span></div></div>
    <div style="margin-top:40px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px">Net Term Solutions · Generated ${now}</div></div>
    <div class="page"><div style="font-size:14px;font-weight:bold;color:#A55B4B;margin-bottom:20px">Itemized Details — ${proj.name}</div>
    ${labourRows.length > 0 ? `<div class="section-title">⏱ Labour — ${labourRows.length} entries · Total $${labourTotal.toFixed(2)}</div><table><thead><tr><th>Employee</th><th>Date</th><th>Hours</th><th>Rate</th><th class="text-right">Amount</th></tr></thead><tbody>${labourRows.map(r => `<tr><td>${r.name}</td><td>${r.date}</td><td>${r.hours}h</td><td>$${r.rate}</td><td class="text-right">$${r.amount.toFixed(2)}</td></tr>`).join("")}<tr><td colspan="4" style="font-weight:bold;text-align:right">Subtotal</td><td class="text-right" style="font-weight:bold">$${labourTotal.toFixed(2)}</td></tr></tbody></table>` : ""}
    ${expenseRows.length > 0 ? `<div class="section-title">🧾 Expenses — ${expenseRows.length} items · Total $${expenseTotal.toFixed(2)}</div><table><thead><tr><th>Title</th><th>Category</th><th>Date</th><th class="text-right">Amount</th></tr></thead><tbody>${expenseRows.map(r => `<tr><td>${r.name}</td><td>${r.category}</td><td>${r.date}</td><td class="text-right">$${r.amount.toFixed(2)}</td></tr>`).join("")}<tr><td colspan="3" style="font-weight:bold;text-align:right">Subtotal</td><td class="text-right" style="font-weight:bold">$${expenseTotal.toFixed(2)}</td></tr></tbody></table>` : ""}
    ${procRows.length > 0 ? `<div class="section-title">📦 Procurement — ${procRows.length} items · Total $${procTotal.toFixed(2)}</div><table><thead><tr><th>Item</th><th>Vendor</th><th>Qty</th><th>Unit Price</th><th>Date</th><th class="text-right">Total</th></tr></thead><tbody>${procRows.map(r => `<tr><td>${r.name}</td><td>${r.vendor}</td><td>${r.qty} ${r.unit}</td><td>$${r.unitPrice}</td><td>${r.date}</td><td class="text-right">$${r.amount.toFixed(2)}</td></tr>`).join("")}<tr><td colspan="5" style="font-weight:bold;text-align:right">Subtotal</td><td class="text-right" style="font-weight:bold">$${procTotal.toFixed(2)}</td></tr></tbody></table>` : ""}
    <div style="margin-top:32px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px">End of invoice ${invoiceNum} · Net Term Solutions</div></div>
    <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button></body></html>`);
    w.document.close();
    w.onload = () => {
      w.onafterprint = () => w.close();
      w.print();
    };
  };

  // ── Filters ──
  const filteredProjects = projects.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ── Finance aggregation ──
  const financeProjects = financeProject === "all" ? projects : projects.filter(p => p.id === financeProject);
  const aggregated = financeProjects.map(p => ({ p, ...calcProjectFinance(p) }));
  const totRevenue = aggregated.reduce((s, a) => s + a.revenue, 0);
  const totCost = aggregated.reduce((s, a) => s + a.totalCost, 0);
  const totProfit = totRevenue - totCost;
  const totMargin = totRevenue > 0 ? (totProfit / totRevenue) * 100 : 0;
  const barData = aggregated.slice(0, 8).map(a => ({ name: a.p.name.length > 10 ? a.p.name.slice(0, 10) + "…" : a.p.name, Expenses: Math.round(a.expenseTotal), Procurement: Math.round(a.procurementTotal), Labour: Math.round(a.labourCost), Revenue: Math.round(a.revenue) }));
  const pieData = [
    { name: "Expenses", value: Math.round(aggregated.reduce((s, a) => s + a.expenseTotal, 0)) },
    { name: "Procurement", value: Math.round(aggregated.reduce((s, a) => s + a.procurementTotal, 0)) },
    { name: "Labour", value: Math.round(aggregated.reduce((s, a) => s + a.labourCost, 0)) },
  ].filter(d => d.value > 0);

  // ── Finance modal data ──
  const getFinModalData = () => {
    if (!finModal) return null;
    const agg = aggregated.find(a => a.p.id === finModal.projectId);
    if (!agg) return null;
    const projTasks = tasks.filter(t => t.project_id === agg.p.id);
    if (finModal.section === "labour") return { items: agg.projTimesheets, proj: agg.p, projTasks };
    if (finModal.section === "expenses") return { items: agg.projExpenses, proj: agg.p };
    if (finModal.section === "procurement") return { items: agg.projProcurement, proj: agg.p };
    return null;
  };

  // ── Client view ──
  const clientProjects = clientProject === "all" ? projects : projects.filter(p => p.id === clientProject);
  const getClientStats = (p) => {
    const projTasks = tasks.filter(t => t.project_id === p.id);
    const completed = projTasks.filter(t => t.status === "completed").length;
    const projExpenses = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + e.amount, 0);
    const completion = projTasks.length ? Math.round(completed / projTasks.length * 100) : p.completion_percentage || 0;
    const milestones = projTasks.filter(t => t.priority === "critical" || t.tags?.includes("milestone"));
    return { projTasks, completed, projExpenses, completion, milestones };
  };
  const totalBudget = clientProjects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = clientProjects.reduce((s, p) => s + expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((a, e) => a + e.amount, 0), 0);
  const avgCompletion = clientProjects.length ? Math.round(clientProjects.reduce((s, p) => s + getClientStats(p).completion, 0) / clientProjects.length) : 0;

  // ── Cards / Rows ──
  const ProjectActions = ({ p }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="w-4 h-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openView(p)}><Eye className="w-4 h-4 mr-2" /> View</DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => openEdit(p)}><Edit2 className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
            {p.status !== "completed" && p.status !== "cancelled" && (
              <DropdownMenuItem onClick={() => handleDeactivate(p)} className="text-orange-600">
                <XCircle className="w-4 h-4 mr-2" /> Deactivate
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const EmployeeProjectCard = ({ p }) => {
    const stats = getProjectStats(p);
    const myTasks = tasks.filter(t => t.project_id === p.id && t.assigned_to?.includes(currentUser?.email));
    return (
      <Card className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: p.color || "#A55B4B" }} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#210F37] truncate">{p.name}</h3>
              {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
              {p.location && <div className="flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3 text-gray-400" /><p className="text-xs text-gray-400 truncate">{p.location}</p></div>}
            </div>
            <ProjectActions p={p} />
          </div>
          {p.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.description}</p>}
          <div className="flex gap-2 mb-3 flex-wrap">
            <Badge className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status?.replace("_", " ")}</Badge>
            {p.end_date && <Badge variant="outline" className="text-xs text-gray-500">Due {p.end_date}</Badge>}
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Overall Progress</span><span>{stats.pct}%</span></div>
            <Progress value={stats.pct} className="h-1.5" />
            <p className="text-xs text-gray-400 mt-1">{stats.completedTasks}/{stats.totalTasks} tasks done</p>
          </div>
          {myTasks.length > 0 ? (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="text-xs font-semibold text-[#4F1C51] mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> My Tasks ({myTasks.length})</p>
              <div className="space-y-1.5">
                {myTasks.slice(0, 4).map(t => { const cfg = TASK_STATUS_CONFIG[t.status]; return (<div key={t.id} className="flex items-center gap-2"><Badge className={`text-xs shrink-0 ${cfg?.color}`}>{cfg?.label}</Badge><p className={`text-xs truncate flex-1 ${t.status === "completed" ? "line-through text-gray-400" : "text-[#210F37]"}`}>{t.title}</p>{t.due_date && <span className="text-xs text-gray-400 shrink-0">{t.due_date}</span>}</div>); })}
                {myTasks.length > 4 && <p className="text-xs text-gray-400 mt-1">+{myTasks.length - 4} more tasks</p>}
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-2 mt-2"><p className="text-xs text-gray-400 italic">No tasks assigned to you yet</p></div>
          )}
        </CardContent>
      </Card>
    );
  };

  const AdminProjectCard = ({ p }) => {
    const stats = getProjectStats(p);
    return (
      <Card className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: p.color || "#A55B4B" }} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#210F37] truncate">{p.name}</h3>
              {p.client_name && <p className="text-xs text-gray-400 mt-0.5">{p.client_name}</p>}
              {p.location && <div className="flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3 text-gray-400" /><p className="text-xs text-gray-400 truncate">{p.location}</p></div>}
            </div>
            <ProjectActions p={p} />
          </div>
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.description}</p>
          <div className="flex gap-2 flex-wrap mb-3">
            <Badge className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status?.replace("_", " ")}</Badge>
            <Badge className={`text-xs ${PRIORITY_COLORS[p.priority]}`}>{p.priority}</Badge>
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Progress</span><span>{stats.pct}%</span></div>
            <Progress value={stats.pct} className="h-1.5" />
            <p className="text-xs text-gray-400 mt-1">{stats.completedTasks}/{stats.totalTasks} tasks done</p>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            {p.end_date && <span>Due: {safeFormat(p.end_date, "MMM d, yyyy")}</span>}
            {stats.totalExpenses > 0 && <div className="flex items-center gap-1 text-[#A55B4B]"><DollarSign className="w-3 h-3" />{stats.totalExpenses.toFixed(0)}</div>}
          </div>
          {p.budget && <p className="text-xs text-gray-400 mt-1">Budget: ${Number(p.budget).toLocaleString()}</p>}
        </CardContent>
      </Card>
    );
  };

  const ProjectRow = ({ p }) => {
    const stats = getProjectStats(p);
    return (
      <div className="grid grid-cols-12 items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm hover:shadow-md transition-all text-sm">
        <div className="col-span-1"><div className="w-1 h-8 rounded-full" style={{ background: p.color || "#A55B4B" }} /></div>
        <div className="col-span-3 min-w-0"><p className="font-semibold text-[#210F37] truncate text-xs">{p.name}</p><p className="text-xs text-gray-400 truncate">{p.client_name || "—"}</p></div>
        <div className="col-span-2 hidden sm:block"><Badge className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status?.replace("_", " ")}</Badge></div>
        {isAdmin && <div className="col-span-2 hidden md:block"><Badge className={`text-xs ${PRIORITY_COLORS[p.priority]}`}>{p.priority}</Badge></div>}
        <div className={`${isAdmin ? "col-span-2" : "col-span-4"} hidden md:flex items-center gap-1.5`}>
          <Progress value={stats.pct} className="h-1 flex-1" />
          <span className="text-xs text-gray-400 whitespace-nowrap">{stats.pct}%</span>
        </div>
        {isAdmin && <div className="col-span-1 hidden lg:block text-xs text-gray-400 text-right">{p.end_date ? safeFormat(p.end_date, "MMM d") : "—"}</div>}
        <div className="col-span-1 flex justify-end"><ProjectActions p={p} /></div>
      </div>
    );
  };

  const viewTasks = viewProject ? tasks.filter(t => t.project_id === viewProject.id) : [];
  const finModalData = getFinModalData();

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="overview">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#210F37]">Projects</h2>
            <p className="text-gray-500 text-sm">{projects.length} projects total</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              {isAdmin && <TabsTrigger value="finance" className="text-xs">Finance & Billing</TabsTrigger>}
              {isAdmin && <TabsTrigger value="client" className="text-xs">Client View</TabsTrigger>}
            </TabsList>
            {isAdmin && (
              <Button onClick={openCreate} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
                <Plus className="w-4 h-4 mr-1" /> New Project
              </Button>
            )}
          </div>
        </div>

        {/* ── TAB: Overview ── */}
        <TabsContent value="overview" className="mt-0">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search projects…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["planning", "active", "on_hold", "completed", "cancelled"].map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex border rounded-lg overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-1.5 ${view === "grid" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setView("list")} className={`px-3 py-1.5 ${view === "list" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}><List className="w-4 h-4" /></button>
            </div>
          </div>
          {view === "list" && filteredProjects.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
              <div className="col-span-1" /><div className="col-span-3">Project</div>
              <div className="col-span-2 hidden sm:block">Status</div>
              {isAdmin && <div className="col-span-2 hidden md:block">Priority</div>}
              <div className={`${isAdmin ? "col-span-2" : "col-span-4"} hidden md:block`}>Progress</div>
              {isAdmin && <div className="col-span-1 hidden lg:block text-right">Due</div>}
              <div className="col-span-1" />
            </div>
          )}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-16"><FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No projects found</p>{isAdmin && <Button onClick={openCreate} className="mt-4 bg-[#A55B4B] text-white">Create First Project</Button>}</div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(p => isAdmin ? <AdminProjectCard key={p.id} p={p} /> : <EmployeeProjectCard key={p.id} p={p} />)}
            </div>
          ) : (
            <div className="space-y-1">{filteredProjects.map(p => <ProjectRow key={p.id} p={p} />)}</div>
          )}
        </TabsContent>

        {/* ── TAB: Finance & Billing ── */}
        {isAdmin && (
          <TabsContent value="finance" className="mt-0 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Expenses · Procurement · Labour · Profit & Billing</p>
              <Select value={financeProject} onValueChange={setFinanceProject}>
                <SelectTrigger className="w-52"><SelectValue placeholder="All Projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Revenue", value: `$${totRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "text-[#210F37]" },
                { label: "Total Cost", value: `$${totCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingDown, color: "text-red-500" },
                { label: "Net Profit", value: `$${totProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: totProfit >= 0 ? "text-green-600" : "text-red-500" },
                { label: "Avg Margin", value: `${totMargin.toFixed(1)}%`, icon: CheckCircle2, color: totMargin >= 0 ? "text-green-600" : "text-red-500" },
              ].map(k => (
                <Card key={k.label} className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><k.icon className={`w-5 h-5 ${k.color}`} /></div>
                  <div><p className="text-xs text-gray-400">{k.label}</p><p className={`text-xl font-bold ${k.color}`}>{k.value}</p></div>
                </CardContent></Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#210F37]">Cost vs Revenue by Project</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={v => `$${v.toLocaleString()}`} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Labour" stackId="cost" fill="#4F1C51" />
                      <Bar dataKey="Expenses" stackId="cost" fill="#A55B4B" />
                      <Bar dataKey="Procurement" stackId="cost" fill="#DCA06D" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#210F37]">Cost Breakdown</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (<>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={55} dataKey="value" paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie><Tooltip formatter={v => `$${v.toLocaleString()}`} /></PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">{pieData.map((d, i) => (<div key={d.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="text-gray-600">{d.name}</span></div><span className="font-bold text-[#210F37]">${d.value.toLocaleString()}</span></div>))}</div>
                  </>) : <p className="text-gray-400 text-sm text-center py-8">No cost data yet</p>}
                </CardContent>
              </Card>
            </div>

            {/* Per-project breakdown */}
            <div className="space-y-4">
              {aggregated.map(({ p, expenseTotal, procurementTotal, labourCost, totalCost, revenue, profit, margin, totalHours, projExpenses, projProcurement, projTimesheets }) => {
                const projTasks = tasks.filter(t => t.project_id === p.id);
                return (
                  <Card key={p.id} className="border-0 shadow-sm overflow-hidden">
                    <div className="h-1" style={{ background: p.color || "#A55B4B" }} />
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold text-[#210F37]">{p.name}</CardTitle>
                          {p.client_name && <p className="text-xs text-gray-400 mt-0.5">{p.client_name} {p.client_email ? `· ${p.client_email}` : ""}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                            {p.location && <span>📍 {p.location}</span>}
                            {p.start_date && <span>Start: {p.start_date}</span>}
                            {p.end_date && <span>End: {p.end_date}</span>}
                            {p.billing_rate && <span>Rate: ${p.billing_rate}/hr</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${profit >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{profit >= 0 ? "Profitable" : "Over Budget"}</Badge>
                          <Button size="sm" variant="outline" onClick={() => downloadProjectInvoice(p, { projTimesheets, projExpenses, projProcurement, totalCost, revenue, profit, margin })} className="gap-1.5 h-7 text-xs">
                            <Download className="w-3.5 h-3.5" /> PDF
                          </Button>
                          <Button size="sm" onClick={() => generateInvoice(p, { projTimesheets, projExpenses, projProcurement, totalCost, revenue, profit, margin })} className="bg-[#210F37] hover:bg-[#4F1C51] text-white gap-1.5 h-7 text-xs">
                            <Printer className="w-3.5 h-3.5" /> Print
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        {[
                          { label: "Budget", value: `$${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-[#210F37]" },
                          { label: "Labour", value: `$${labourCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-purple-600" },
                          { label: "Expenses", value: `$${expenseTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-orange-600" },
                          { label: "Procurement", value: `$${procurementTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-blue-600" },
                          { label: "Total Cost", value: `$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-red-500" },
                          { label: "Net Profit", value: `$${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: profit >= 0 ? "text-green-600" : "text-red-500" },
                        ].map(m => (<div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-400 mb-0.5">{m.label}</p><p className={`font-bold text-sm ${m.color}`}>{m.value}</p></div>))}
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Cost utilization</span><span className={`font-semibold ${totalCost > revenue ? "text-red-500" : "text-green-600"}`}>{revenue > 0 ? Math.min(200, Math.round((totalCost / revenue) * 100)) : 0}% of budget</span></div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div className={`h-2 rounded-full ${totalCost > revenue ? "bg-red-500" : totalCost / revenue > 0.8 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${Math.min(100, revenue > 0 ? (totalCost / revenue) * 100 : 0)}%` }} /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Labour */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-[#210F37] flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-purple-500" /> Labour ({totalHours}h)</p>
                            {projTimesheets.length > PREVIEW_LIMIT && <button onClick={() => setFinModal({ projectId: p.id, section: "labour" })} className="text-[10px] text-[#A55B4B] hover:underline flex items-center gap-0.5">View all {projTimesheets.length} <ExternalLink className="w-2.5 h-2.5" /></button>}
                          </div>
                          {projTimesheets.length === 0 ? <p className="text-xs text-gray-400 italic">No approved timesheets</p> : (
                            <div className="space-y-1">
                              {projTimesheets.slice(0, PREVIEW_LIMIT).map(ts => { const rate = getRate(ts, projTasks, p); return (<div key={ts.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5"><MiniAvatar label={ts.employee_name || ts.employee_email} color={getUserColor(ts.employee_email)} /><div className="flex-1 min-w-0"><p className="truncate text-gray-700 font-medium">{ts.employee_name || ts.employee_email?.split("@")[0]}</p><p className="text-gray-400 text-[10px]">{ts.date ? safeFormat(ts.date, "MMM d, yyyy") : "—"}</p></div><span className="text-gray-500 shrink-0">{ts.hours}h × ${rate}</span><span className="font-bold text-[#210F37] shrink-0">${((ts.hours || 0) * rate).toFixed(0)}</span></div>); })}
                              {projTimesheets.length > PREVIEW_LIMIT && <button onClick={() => setFinModal({ projectId: p.id, section: "labour" })} className="text-xs text-[#A55B4B] hover:underline w-full text-center py-1">+{projTimesheets.length - PREVIEW_LIMIT} more →</button>}
                            </div>
                          )}
                        </div>
                        {/* Expenses */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-[#210F37] flex items-center gap-1"><Receipt className="w-3.5 h-3.5 text-orange-500" /> Expenses ({projExpenses.length})</p>
                            {projExpenses.length > PREVIEW_LIMIT && <button onClick={() => setFinModal({ projectId: p.id, section: "expenses" })} className="text-[10px] text-[#A55B4B] hover:underline flex items-center gap-0.5">View all {projExpenses.length} <ExternalLink className="w-2.5 h-2.5" /></button>}
                          </div>
                          {projExpenses.length === 0 ? <p className="text-xs text-gray-400 italic">No approved expenses</p> : (
                            <div className="space-y-1">
                              {projExpenses.slice(0, PREVIEW_LIMIT).map(e => { const u = users.find(u => u.email === e.submitted_by); return (<div key={e.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5"><MiniAvatar label={u?.full_name || e.submitted_by_name || e.submitted_by} color={getUserColor(e.submitted_by)} /><div className="flex-1 min-w-0"><p className="truncate text-gray-700 font-medium">{e.title}</p><p className="text-gray-400 text-[10px]">{e.date ? safeFormat(e.date, "MMM d, yyyy") : "—"} · {e.category}</p></div><span className="font-bold text-[#210F37] shrink-0">${e.amount?.toFixed(0)}</span></div>); })}
                              {projExpenses.length > PREVIEW_LIMIT && <button onClick={() => setFinModal({ projectId: p.id, section: "expenses" })} className="text-xs text-[#A55B4B] hover:underline w-full text-center py-1">+{projExpenses.length - PREVIEW_LIMIT} more →</button>}
                            </div>
                          )}
                        </div>
                        {/* Procurement */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-[#210F37] flex items-center gap-1"><Package className="w-3.5 h-3.5 text-blue-500" /> Procurement ({projProcurement.length})</p>
                            {projProcurement.length > PREVIEW_LIMIT && <button onClick={() => setFinModal({ projectId: p.id, section: "procurement" })} className="text-[10px] text-[#A55B4B] hover:underline flex items-center gap-0.5">View all {projProcurement.length} <ExternalLink className="w-2.5 h-2.5" /></button>}
                          </div>
                          {projProcurement.length === 0 ? <p className="text-xs text-gray-400 italic">No procurement items</p> : (
                            <div className="space-y-1">
                              {projProcurement.slice(0, PREVIEW_LIMIT).map(pr => (<div key={pr.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><Package className="w-3 h-3 text-blue-500" /></div><div className="flex-1 min-w-0"><p className="truncate text-gray-700 font-medium">{pr.title}</p><p className="text-gray-400 text-[10px]">{pr.order_date ? safeFormat(pr.order_date, "MMM d, yyyy") : "—"} · {pr.vendor_supplier || "N/A"}</p></div><span className="font-bold text-[#210F37] shrink-0">${(pr.total_amount || 0).toFixed(0)}</span></div>))}
                              {projProcurement.length > PREVIEW_LIMIT && <button onClick={() => setFinModal({ projectId: p.id, section: "procurement" })} className="text-xs text-[#A55B4B] hover:underline w-full text-center py-1">+{projProcurement.length - PREVIEW_LIMIT} more →</button>}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {aggregated.length === 0 && <div className="text-center py-16 text-gray-400"><DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>No project finance data available yet.</p></div>}
            </div>
          </TabsContent>
        )}

        {/* ── TAB: Client View ── */}
        {isAdmin && <TabsContent value="client" className="mt-0 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#210F37] to-[#4F1C51] rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm text-gray-500">Simplified client & stakeholder view — progress, milestones & financials</p>
            </div>
            <Select value={clientProject} onValueChange={setClientProject}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Projects", value: clientProjects.length, color: "text-[#A55B4B]", bg: "bg-[#A55B4B]/10" },
              { label: "Avg Completion", value: `${avgCompletion}%`, color: "text-green-600", bg: "bg-green-50" },
              { label: "Budget Allocated", value: `$${(totalBudget / 1000).toFixed(1)}k`, color: "text-[#210F37]", bg: "bg-purple-50" },
              { label: "Total Spent", value: `$${(totalSpent / 1000).toFixed(1)}k`, color: "text-orange-500", bg: "bg-orange-50" },
            ].map(k => (
              <Card key={k.label} className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}><DollarSign className={`w-5 h-5 ${k.color}`} /></div>
                <div><p className="text-xl font-bold text-[#210F37]">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
              </CardContent></Card>
            ))}
          </div>
          <div className="space-y-4">
            {clientProjects.map(p => {
              const stats = getClientStats(p);
              return (
                <Card key={p.id} className="border-0 shadow-sm overflow-hidden">
                  <div className="h-1.5" style={{ background: p.color || "#A55B4B" }} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <CardTitle className="text-base text-[#210F37]">{p.name}</CardTitle>
                          <Badge className={`text-xs ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>{p.status?.replace("_", " ")}</Badge>
                          {p.priority && <Badge className={`text-xs ${PRIORITY_COLORS[p.priority]}`}>{p.priority}</Badge>}
                        </div>
                        {p.client_name && <p className="text-sm text-gray-500">Client: <span className="font-medium">{p.client_name}</span>{p.client_email ? ` · ${p.client_email}` : ""}</p>}
                        {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
                        {p.location && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location}</p>}
                      </div>
                      <div className="text-right flex-shrink-0"><p className="text-2xl font-bold text-[#210F37]">{stats.completion}%</p><p className="text-xs text-gray-400">complete</p></div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Overall Progress</span><span>{stats.completed}/{stats.projTasks.length} tasks</span></div>
                      <Progress value={stats.completion} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-[#210F37]">{stats.projTasks.length}</p><p className="text-xs text-gray-500">Total Tasks</p></div>
                      <div className="bg-green-50 rounded-lg p-2"><p className="text-lg font-bold text-green-600">{stats.completed}</p><p className="text-xs text-gray-500">Completed</p></div>
                      <div className="bg-orange-50 rounded-lg p-2"><p className="text-lg font-bold text-orange-600">${(stats.projExpenses / 1000).toFixed(1)}k</p><p className="text-xs text-gray-500">Spent</p></div>
                      <div className="bg-blue-50 rounded-lg p-2"><p className="text-lg font-bold text-blue-600">${((p.budget || 0) / 1000).toFixed(1)}k</p><p className="text-xs text-gray-500">Budget</p></div>
                    </div>
                    {stats.milestones.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Milestones</p>
                        <div className="space-y-1">
                          {stats.milestones.slice(0, 4).map(m => (<div key={m.id} className="flex items-center gap-2 text-xs"><CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${m.status === "completed" ? "text-green-500" : "text-gray-300"}`} /><span className={m.status === "completed" ? "line-through text-gray-400" : "text-gray-700"}>{m.title}</span>{m.due_date && <span className="ml-auto text-gray-400">{m.due_date}</span>}</div>))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400 pt-1 border-t border-gray-100">
                      {p.start_date && <span>Start: {p.start_date}</span>}
                      {p.end_date && <span>End: {p.end_date}</span>}
                      {p.manager_email && <span>PM: {p.manager_email}</span>}
                      {p.billing_rate && <span>Billing Rate: ${p.billing_rate}/hr</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {clientProjects.length === 0 && <div className="text-center py-16 text-gray-400"><Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No projects found</p></div>}
          </div>
        </TabsContent>}
      </Tabs>

      {/* ── View Project Modal ── */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewProject && (<>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 rounded-full" style={{ background: viewProject.color || "#A55B4B" }} />
                <div><DialogTitle className="text-[#210F37] text-xl">{viewProject.name}</DialogTitle>{viewProject.client_name && <p className="text-sm text-gray-400">{viewProject.client_name}</p>}</div>
              </div>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="flex flex-wrap gap-2">
                <Badge className={STATUS_COLORS[viewProject.status]}>{viewProject.status?.replace("_", " ")}</Badge>
                {isAdmin && <Badge className={PRIORITY_COLORS[viewProject.priority]}>{viewProject.priority} priority</Badge>}
              </div>
              {viewProject.description && <p className="text-sm text-gray-600">{viewProject.description}</p>}
              {isAdmin && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {viewProject.start_date && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">Start Date</p><p className="text-sm font-semibold text-[#210F37]">{safeFormat(viewProject.start_date, "MMM d, yyyy")}</p></div>}
                  {viewProject.end_date && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">End Date</p><p className="text-sm font-semibold text-[#210F37]">{safeFormat(viewProject.end_date, "MMM d, yyyy")}</p></div>}
                  {viewProject.budget && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">Budget</p><p className="text-sm font-semibold text-[#210F37]">${Number(viewProject.budget).toLocaleString()}</p></div>}
                  {viewProject.billing_rate && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">Billing Rate</p><p className="text-sm font-semibold text-[#210F37]">${viewProject.billing_rate}/hr</p></div>}
                  {viewProject.client_email && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-0.5">Client Email</p><p className="text-sm font-semibold text-[#210F37] truncate">{viewProject.client_email}</p></div>}
                </div>
              )}
              {viewProject.location && (
                <div>
                  <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-[#A55B4B]" /><span className="text-sm font-semibold text-[#210F37]">{viewProject.location}</span></div>
                  <div className="rounded-xl overflow-hidden border border-gray-200 h-48">
                    <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(viewProject.location)}&output=embed`} className="w-full h-full" loading="lazy" title="Project Location" />
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-[#210F37] mb-2">Tasks <span className="text-xs text-gray-400 font-normal">({viewTasks.length})</span></h4>
                {viewTasks.length === 0 ? <p className="text-sm text-gray-400 italic">No tasks yet</p> : (
                  <div className="space-y-1.5">
                    {viewTasks.map(task => { const cfg = TASK_STATUS_CONFIG[task.status]; return (<div key={task.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"><Badge className={`text-xs ${cfg?.color} flex-shrink-0`}>{cfg?.label}</Badge><p className={`text-xs font-medium flex-1 truncate ${task.status === "completed" ? "line-through text-gray-400" : "text-[#210F37]"}`}>{task.title}</p>{isAdmin && (task.assigned_to || []).length > 0 && (<div className="flex -space-x-1 flex-shrink-0">{(task.assigned_to || []).slice(0, 3).map((email, i) => { const u = getUserByEmail(email); return (<Avatar key={i} className="w-5 h-5 border border-white" title={u?.full_name || email}><AvatarImage src={u?.photo_url} /><AvatarFallback className="text-xs bg-[#A55B4B] text-white" style={{ fontSize: 8 }}>{email[0]?.toUpperCase()}</AvatarFallback></Avatar>); })}</div>)}</div>); })}
                  </div>
                )}
              </div>
              {isAdmin && (() => { const projProc = procurements.filter(pr => pr.project_id === viewProject.id); return projProc.length > 0 ? (<div><h4 className="text-sm font-semibold text-[#210F37] mb-2 flex items-center gap-1"><Package className="w-4 h-4 text-blue-500" /> Procurement <span className="text-xs text-gray-400 font-normal ml-1">({projProc.length})</span></h4><div className="space-y-1.5">{projProc.slice(0, 6).map(pr => (<div key={pr.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"><div><p className="text-xs font-medium text-[#210F37]">{pr.title}</p><p className="text-xs text-gray-400 capitalize">{pr.category} · {pr.vendor_supplier || "—"}</p></div><div className="text-right"><p className="text-xs font-bold text-[#210F37]">${(pr.total_amount || 0).toFixed(0)}</p><p className="text-xs text-gray-400">{pr.quantity} {pr.unit}</p></div></div>))}{projProc.length > 6 && <p className="text-xs text-gray-400">+{projProc.length - 6} more</p>}</div></div>) : null; })()}
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
              {isAdmin && <Button onClick={() => { setShowViewDialog(false); openEdit(viewProject); }} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white"><Edit2 className="w-4 h-4 mr-1" /> Edit Project</Button>}
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      {isAdmin && (
        <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-[#210F37]">{editProject ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="sm:col-span-2"><Label>Project Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Project name" className="mt-1" /></div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Project description" className="mt-1" rows={3} /></div>
              <div className="sm:col-span-2"><Label>Location</Label><div className="relative mt-1"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. 123 Main St, New York, NY" className="pl-9" /></div></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["planning","active","on_hold","completed","cancelled"].map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Priority</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" /></div>
              <div><Label>Budget / Contract Value (USD)</Label><Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" className="mt-1" /></div>
              <div><Label>Default Billing Rate ($/hr)</Label><Input type="number" value={form.billing_rate} onChange={e => setForm(f => ({ ...f, billing_rate: e.target.value }))} placeholder="0.00" className="mt-1" /></div>
              <div><Label>Client Name</Label><Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Client name" className="mt-1" /></div>
              <div><Label>Client Email</Label><Input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="client@email.com" className="mt-1" /></div>
              <div><Label>Color</Label><div className="flex gap-2 mt-1 flex-wrap">{PROJECT_COLORS.map(c => (<button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-[#210F37] scale-110" : "border-transparent"}`} style={{ background: c }} />))}</div></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name || saving} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">{saving ? "Saving…" : editProject ? "Save Changes" : "Create Project"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Finance ViewAll Modals ── */}
      {finModal && finModalData && (() => {
        const proj = finModalData.proj;
        const projTasks = tasks.filter(t => t.project_id === proj.id);
        if (finModal.section === "labour") return (<ViewAllModal open onClose={() => setFinModal(null)} title={`Labour — ${proj.name}`} items={finModalData.items} renderHeader={() => (<><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Employee</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Date</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Hours</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Rate</th><th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Amount</th></>)} renderRow={(ts) => { const rate = getRate(ts, projTasks, proj); return (<><td className="px-3 py-2"><div className="flex items-center gap-2"><MiniAvatar label={ts.employee_name || ts.employee_email} color={getUserColor(ts.employee_email)} /><span className="text-gray-700">{ts.employee_name || ts.employee_email?.split("@")[0]}</span></div></td><td className="px-3 py-2 text-gray-500">{ts.date ? safeFormat(ts.date, "MMM d, yyyy") : "—"}</td><td className="px-3 py-2 text-gray-700">{ts.hours}h</td><td className="px-3 py-2 text-gray-500">${rate}/hr</td><td className="px-3 py-2 text-right font-bold text-[#210F37]">${((ts.hours || 0) * rate).toFixed(2)}</td></>); }} />);
        if (finModal.section === "expenses") return (<ViewAllModal open onClose={() => setFinModal(null)} title={`Expenses — ${proj.name}`} items={finModalData.items} renderHeader={() => (<><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Title</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Category</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Date</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">By</th><th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Amount</th></>)} renderRow={(e) => { const u = users.find(u => u.email === e.submitted_by); return (<><td className="px-3 py-2 text-gray-700 font-medium">{e.title}</td><td className="px-3 py-2 text-gray-500">{e.category}</td><td className="px-3 py-2 text-gray-500">{e.date ? safeFormat(e.date, "MMM d, yyyy") : "—"}</td><td className="px-3 py-2"><div className="flex items-center gap-2"><MiniAvatar label={u?.full_name || e.submitted_by_name || e.submitted_by} color={getUserColor(e.submitted_by)} /><span className="text-gray-600">{u?.full_name || e.submitted_by_name || e.submitted_by?.split("@")[0] || "—"}</span></div></td><td className="px-3 py-2 text-right font-bold text-[#210F37]">${(e.amount || 0).toFixed(2)}</td></>); }} />);
        if (finModal.section === "procurement") return (<ViewAllModal open onClose={() => setFinModal(null)} title={`Procurement — ${proj.name}`} items={finModalData.items} renderHeader={() => (<><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Item</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Vendor</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Qty</th><th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Status</th><th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Total</th></>)} renderRow={(pr) => (<><td className="px-3 py-2 text-gray-700 font-medium">{pr.title}</td><td className="px-3 py-2 text-gray-500">{pr.vendor_supplier || "—"}</td><td className="px-3 py-2 text-gray-500">{pr.quantity} {pr.unit}</td><td className="px-3 py-2"><Badge className="text-[10px] bg-blue-100 text-blue-700">{pr.status}</Badge></td><td className="px-3 py-2 text-right font-bold text-[#210F37]">${(pr.total_amount || 0).toFixed(2)}</td></>)} />);
        return null;
      })()}
    </div>
  );
}