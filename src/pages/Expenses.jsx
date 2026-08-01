import { useState, useEffect } from "react";
import Pagination from "@/components/Pagination";
import { base44 } from "@/api/base44Client";
import {
  Plus, Search, Receipt, CheckCircle2, XCircle, Clock,
  Upload, List, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, Download, Printer
} from "lucide-react";
import { exportCSV } from "@/lib/exportUtils";
import { exportPDF, printPDF } from "@/lib/pdfUtils";
import { parseLocalDate } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks
} from "date-fns";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
};

const DEFAULT_EXPENSE = {
  title: "", amount: "", currency: "USD", category: "",
  project_id: "", project_name: "", description: "", date: format(new Date(), "yyyy-MM-dd"),
  receipt_url: ""
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [calMode, setCalMode] = useState("month"); // "month" | "week"
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [chartDays, setChartDays] = useState(30);
  const [chartOffset, setChartOffset] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showDialog, setShowDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [dayExpenses, setDayExpenses] = useState([]);
  const [dayLabel, setDayLabel] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [form, setForm] = useState(DEFAULT_EXPENSE);
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      const admin = u?.role === "admin";
      setIsAdmin(admin);
      loadData(u, admin);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async (me, admin) => {
    const user = me || currentUser;
    const isAdminUser = admin !== undefined ? admin : isAdmin;
    const [e, allProjects, c, allTasks] = await Promise.allSettled([
      base44.entities.Expense.list("-date"),
      base44.entities.Project.list(),
      base44.entities.ExpenseCategory.list(),
      base44.entities.Task.list(),
    ]);
    const allP = allProjects.status === "fulfilled" ? allProjects.value : [];
    const allT = allTasks.status === "fulfilled" ? allTasks.value : [];
    // For employees: include projects where they are a team member, manager, OR have tasks assigned
    const assignedProjectIds = new Set(
      allT.filter(t => t.assigned_to?.includes(user?.email)).map(t => t.project_id)
    );
    const filteredP = isAdminUser ? allP : allP.filter(p =>
      p.team_members?.includes(user?.email) ||
      p.manager_email === user?.email ||
      assignedProjectIds.has(p.id)
    );
    setExpenses(e.status === "fulfilled" ? e.value : []);
    setProjects(filteredP);
    setCategories(c.status === "fulfilled" ? c.value : []);
    setLoading(false);
  };

  const openCreate = () => { setForm(DEFAULT_EXPENSE); setNewCategory(""); setShowDialog(true); };

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      alert("Amount must be greater than 0");
      return;
    }
    setSaving(true);
    const proj = projects.find(p => p.id === form.project_id);
    let cat = form.category;
    if (newCategory.trim()) {
      const existing = categories.find(c => c.name.toLowerCase() === newCategory.trim().toLowerCase());
      if (!existing) await base44.entities.ExpenseCategory.create({ name: newCategory.trim() });
      cat = newCategory.trim();
    }
    await base44.entities.Expense.create({
      ...form, category: cat, amount: Number(form.amount),
      project_name: proj?.name || "",
      submitted_by: currentUser?.email,
      submitted_by_name: currentUser?.full_name || currentUser?.email,
      status: "pending"
    });
    if (isAdmin) {
      const adminUsers = await base44.entities.User.filter({ role: "admin" }).catch(() => []);
      for (const admin of adminUsers) {
        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: `New Expense Submitted: ${form.title}`,
          body: `${currentUser?.full_name || currentUser?.email} submitted an expense: "${form.title}" for $${form.amount} (${cat}) in project "${proj?.name || ""}". Please review.`
        }).catch(() => {});
      }
    }
    setSaving(false); setShowDialog(false); loadData(currentUser, isAdmin);
  };

  const handleApprove = async () => {
    await base44.entities.Expense.update(selectedExpense.id, {
      status: "approved", reviewed_by: currentUser?.email, reviewed_at: new Date().toISOString()
    });
    setShowApproveDialog(false); loadData(currentUser, isAdmin);
  };

  const handleReject = async () => {
    await base44.entities.Expense.update(selectedExpense.id, {
      status: "rejected", reviewed_by: currentUser?.email,
      reviewed_at: new Date().toISOString(), rejection_reason: rejectionReason
    });
    setShowApproveDialog(false); setRejectionReason(""); loadData(currentUser, isAdmin);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, receipt_url: file_url }));
    setUploading(false);
  };

  const filteredExpenses = expenses.filter(e => {
    if (!isAdmin && currentUser && e.submitted_by !== currentUser.email) return false;
    const matchSearch = e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    const matchProject = filterProject === "all" || e.project_id === filterProject;
    const matchFrom = !filterDateFrom || (e.date && e.date >= filterDateFrom);
    const matchTo = !filterDateTo || (e.date && e.date <= filterDateTo);
    return matchSearch && matchStatus && matchProject && matchFrom && matchTo;
  });

  const totalApproved = filteredExpenses.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
  const totalPending = filteredExpenses.filter(e => e.status === "pending").reduce((s, e) => s + (e.amount || 0), 0);

  // Get all unique submitters visible in filteredExpenses
  // Reset offset when chartDays changes
  useEffect(() => { setChartOffset(0); }, [chartDays]);

  const PERSON_COLORS = ["#A55B4B", "#4F1C51", "#DCA06D", "#2D6A4F", "#1A759F", "#7B3F6E", "#E07B54"];
  const allSubmitters = [...new Set(filteredExpenses.map(e => e.submitted_by).filter(Boolean))];

  // Build stacked chart data per person (offset shifts the window back in time)
  const chartData = Array.from({ length: chartDays }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (chartDays - 1) + i - chartOffset * chartDays);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayExps = filteredExpenses.filter(e => e.date === dateStr);
    const entry = { day: chartDays === 7 ? format(d, "EEE") : format(d, "M/d") };
    allSubmitters.forEach(email => {
      entry[email] = dayExps.filter(e => e.submitted_by === email).reduce((s, e) => s + (e.amount || 0), 0);
    });
    // also total for single-person fallback
    entry.amount = dayExps.reduce((s, e) => s + (e.amount || 0), 0);
    return entry;
  });

  const CustomExpenseTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-xs min-w-36">
        <p className="font-semibold text-[#210F37] mb-1">{label}</p>
        {payload.filter(p => p.value > 0).map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span style={{ color: p.fill }} className="truncate max-w-24">{p.dataKey}</span>
            <span className="font-bold">${Number(p.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Calendar helpers
  const monthDays = eachDayOfInterval({ start: startOfMonth(calendarDate), end: endOfMonth(calendarDate) });
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 0 }) });
  const getExpensesForDay = (day) => filteredExpenses.filter(e => e.date && isSameDay(parseLocalDate(e.date), day));

  const openDayModal = (day, dayExps) => {
    if (dayExps.length >= 1) {
      setDayExpenses(dayExps);
      setDayLabel(format(day, "MMMM d, yyyy"));
      setShowDayDialog(true);
    }
  };

  const CalendarDayCell = ({ day }) => {
    const dayExps = getExpensesForDay(day);
    const total = dayExps.reduce((s, e) => s + (e.amount || 0), 0);
    const isToday = isSameDay(day, new Date());
    return (
      <div
        className={`min-h-14 rounded-lg p-1 border transition-all ${isToday ? "border-[#A55B4B] bg-[#FFF8F5]" : "border-gray-100 bg-white"}
          ${dayExps.length >= 1 ? "cursor-pointer hover:border-[#A55B4B] hover:shadow-sm" : ""}`}
        onClick={() => openDayModal(day, dayExps)}
      >
        <p className="text-xs text-gray-500 mb-1">{format(day, "d")}</p>
        {dayExps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#A55B4B]">${total.toFixed(0)}</p>
            <p className="text-xs text-[#4F1C51] underline font-medium cursor-pointer">
                {dayExps.length} {dayExps.length === 1 ? "expense →" : "expenses →"}
            </p>
          </div>
        )}
      </div>
    );
  };

  const ExpenseRow = ({ expense }) => {
    const StatusIcon = STATUS_CONFIG[expense.status]?.icon || Clock;
    return (
      <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm hover:shadow-md transition-all">
        <div className="p-1.5 rounded-lg bg-[#F5F0FF] flex-shrink-0">
          <Receipt className="w-3.5 h-3.5 text-[#A55B4B]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-[#210F37] truncate">{expense.title}</p>
          <p className="text-xs text-gray-400">{expense.category} · {expense.project_name} · {expense.submitted_by_name || expense.submitted_by}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-[#210F37] text-sm">${Number(expense.amount).toFixed(2)}</p>
          <p className="text-xs text-gray-400">{expense.date}</p>
        </div>
        <Badge className={`text-xs hidden sm:flex ${STATUS_CONFIG[expense.status]?.color}`}>
          <StatusIcon className="w-3 h-3 mr-1" />{STATUS_CONFIG[expense.status]?.label}
        </Badge>
        <button
          onClick={() => { setSelectedExpense(expense); setShowDetailDialog(true); }}
          className="p-1.5 rounded-lg hover:bg-[#F5F0FF] text-gray-400 hover:text-[#A55B4B] transition-colors flex-shrink-0"
          title="View details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {isAdmin && expense.status === "pending" && (
          <Button size="sm" onClick={() => { setSelectedExpense(expense); setShowApproveDialog(true); }}
            className="bg-[#A55B4B] text-white text-xs h-7">Review</Button>
        )}
      </div>
    );
  };

  const allCategories = [...new Set(categories.map(c => c.name))];

  const handleExportCSV = () => {
    exportCSV(
      `expenses_${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Date", "Title", "Category", "Project", "Amount", "Currency", "Status", "Submitted By", "Reviewed By"],
      filteredExpenses.map(e => [e.date, e.title, e.category, e.project_name, Number(e.amount).toFixed(2), e.currency, e.status, e.submitted_by_name || e.submitted_by || "", e.reviewed_by || ""])
    );
  };

  const pdfReport = () => [
      "Expenses Report",
      ["Date", "Title", "Project", "Amount", "Status", "Submitted By"],
      filteredExpenses.map(e => [e.date, e.title, e.project_name, `$${Number(e.amount).toFixed(2)}`, e.status, e.submitted_by_name || e.submitted_by || "—"]),
      [
        { label: "Total Entries", value: filteredExpenses.length },
        { label: "Approved", value: `$${totalApproved.toFixed(2)}` },
        { label: "Pending", value: `$${totalPending.toFixed(2)}` },
      ]
  ];
  const handleExportPDF = () => exportPDF(...pdfReport());
  const handlePrint = () => printPDF(...pdfReport());

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">Expenses</h2>
          <p className="text-gray-500 text-sm">{filteredExpenses.length} expenses</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-gray-600">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-gray-600">
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-gray-600">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button onClick={openCreate} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Timeline bar chart */}
      <Card className="border-0 shadow-sm mb-4">
        <CardHeader className="pb-1 pt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Timeline</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => { setChartDays(7); setChartOffset(0); }} className={`px-3 py-1 text-xs ${chartDays === 7 ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>7 Days</button>
                <button onClick={() => { setChartDays(30); setChartOffset(0); }} className={`px-3 py-1 text-xs ${chartDays === 30 ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>30 Days</button>
              </div>
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button onClick={() => setChartOffset(o => o + 1)} className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-500 text-xs border-r">‹</button>
                <span className="px-2 py-1 text-xs text-gray-500 bg-white min-w-12 text-center">
                  {chartOffset === 0 ? "Now" : `-${chartOffset * chartDays}d`}
                </span>
                <button onClick={() => setChartOffset(o => Math.max(0, o - 1))} disabled={chartOffset === 0} className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-500 text-xs border-l disabled:opacity-30">›</button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={chartDays === 30 ? 4 : 0} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip content={<CustomExpenseTooltip />} />
              {allSubmitters.length > 0
                ? allSubmitters.map((email, i) => (
                    <Bar key={email} dataKey={email} stackId="a" fill={PERSON_COLORS[i % PERSON_COLORS.length]} radius={i === allSubmitters.length - 1 ? [3,3,0,0] : [0,0,0,0]} />
                  ))
                : <Bar dataKey="amount" fill="#A55B4B" radius={[3,3,0,0]} />
              }
            </BarChart>
          </ResponsiveContainer>
          {allSubmitters.length > 1 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {allSubmitters.map((email, i) => (
                <div key={email} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PERSON_COLORS[i % PERSON_COLORS.length] }} />
                  {email}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-lg font-bold text-green-600">${totalApproved.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-bold text-yellow-600">${totalPending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Count</p>
            <p className="text-lg font-bold text-[#210F37]">{filteredExpenses.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search expenses…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([s, cfg]) => <SelectItem key={s} value={s}>{cfg.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 text-xs" title="From date" />
          <span className="text-gray-400 text-xs">to</span>
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 text-xs" title="To date" />
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setView("list")} className={`px-3 py-1.5 ${view === "list" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setView("calendar")} className={`px-3 py-1.5 ${view === "calendar" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>
            <CalendarIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === "list" ? (
        <div className="space-y-1.5">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No expenses found</p>
              <Button onClick={openCreate} className="mt-4 bg-[#A55B4B] text-white">Add First Expense</Button>
            </div>
          ) : filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(e => <ExpenseRow key={e.id} expense={e} />)}
          <Pagination total={filteredExpenses.length} page={page} perPage={PAGE_SIZE} onChange={p => { setPage(p); window.scrollTo(0, 0); }} />
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base text-[#210F37]">
                  {calMode === "month" ? format(calendarDate, "MMMM yyyy") : `Week of ${format(weekStart, "MMM d")}`}
                </CardTitle>
                <div className="flex border rounded-lg overflow-hidden ml-2">
                  <button onClick={() => setCalMode("month")} className={`px-2 py-1 text-xs ${calMode === "month" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>Month</button>
                  <button onClick={() => setCalMode("week")} className={`px-2 py-1 text-xs ${calMode === "week" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>Week</button>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => calMode === "month" ? setCalendarDate(d => subMonths(d, 1)) : setWeekStart(d => subWeeks(d, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => calMode === "month" ? setCalendarDate(d => addMonths(d, 1)) : setWeekStart(d => addWeeks(d, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-xs text-gray-400 font-medium py-1">{d}</div>
              ))}
            </div>
            {calMode === "month" ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: monthDays[0].getDay() }).map((_, i) => <div key={`e-${i}`} />)}
                {monthDays.map(day => <CalendarDayCell key={day.toISOString()} day={day} />)}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayExps = getExpensesForDay(day);
                  const total = dayExps.reduce((s, e) => s + (e.amount || 0), 0);
                  return (
                    <div key={day.toISOString()}
                      className={`rounded-xl p-3 border min-h-28 flex flex-col gap-1 ${isSameDay(day, new Date()) ? "border-[#A55B4B] bg-[#FFF8F5]" : "border-gray-100 bg-white"}
                        ${dayExps.length >= 2 ? "cursor-pointer hover:shadow-sm" : ""}`}
                      onClick={() => openDayModal(day, dayExps)}>
                      <p className="text-xs text-center font-semibold text-gray-600">{format(day, "EEE d")}</p>
                      {dayExps.length > 0 ? (
                        <>
                          <p className="text-sm font-bold text-[#A55B4B] text-center">${total.toFixed(0)}</p>
                          {dayExps.slice(0, 2).map((exp, i) => (
                            <div key={i} className="text-xs bg-[#F5F0FF] text-[#4F1C51] rounded px-1 py-0.5 truncate">{exp.title}</div>
                          ))}
                          {dayExps.length > 2 && (
                            <p className="text-xs text-[#A55B4B] underline text-center">+{dayExps.length - 2} more</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-300 text-center mt-2">—</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expense Detail Modal */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Expense Details</DialogTitle></DialogHeader>
          {selectedExpense && (
            <div className="py-2 space-y-3">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#210F37]">{selectedExpense.title}</p>
                  <Badge className={`text-xs ${STATUS_CONFIG[selectedExpense.status]?.color}`}>{STATUS_CONFIG[selectedExpense.status]?.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-gray-400">Amount</p><p className="font-bold text-[#A55B4B]">${Number(selectedExpense.amount).toFixed(2)} {selectedExpense.currency}</p></div>
                  <div><p className="text-xs text-gray-400">Date</p><p className="font-medium text-[#210F37]">{selectedExpense.date}</p></div>
                  <div><p className="text-xs text-gray-400">Category</p><p className="font-medium text-[#210F37]">{selectedExpense.category}</p></div>
                  <div><p className="text-xs text-gray-400">Project</p><p className="font-medium text-[#210F37]">{selectedExpense.project_name}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-400">Submitted by</p><p className="font-medium text-[#210F37]">{selectedExpense.submitted_by_name || selectedExpense.submitted_by}</p></div>
                </div>
                {selectedExpense.description && (
                  <div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-600 bg-white rounded p-2 border">{selectedExpense.description}</p></div>
                )}
                {selectedExpense.receipt_url && (
                  <a href={selectedExpense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#A55B4B] underline flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" /> View Receipt
                  </a>
                )}
                {selectedExpense.reviewed_by && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-400">Reviewed by: {selectedExpense.reviewed_by}</p>
                    {selectedExpense.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {selectedExpense.rejection_reason}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            {isAdmin && selectedExpense?.status === "pending" && (
              <Button onClick={() => { setShowDetailDialog(false); setShowApproveDialog(true); }} className="bg-[#A55B4B] text-white">Review</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Detail Modal */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">Expenses on {dayLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {dayExpenses.map((exp, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm text-[#210F37]">{exp.title}</p>
                <p className="text-xs text-gray-600">Amount: <span className="font-bold text-[#A55B4B]">${Number(exp.amount).toFixed(2)}</span></p>
                <p className="text-xs text-gray-600">Category: {exp.category}</p>
                <p className="text-xs text-gray-600">Project: {exp.project_name}</p>
                <p className="text-xs text-gray-600">By: {exp.submitted_by_name || exp.submitted_by}</p>
                <Badge className={`text-xs ${STATUS_CONFIG[exp.status]?.color}`}>{STATUS_CONFIG[exp.status]?.label}</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDayDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Expense title" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "CAD", "AUD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Or type a new category…" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add notes…" className="mt-1" rows={2} />
            </div>
            <div>
              <Label>Receipt</Label>
              <div className="mt-1 flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading…" : "Upload Receipt"}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
                </label>
                {form.receipt_url && <span className="text-xs text-green-600">✓ Uploaded</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.amount || (!form.category && !newCategory.trim()) || !form.project_id || saving}
              className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
              {saving ? "Submitting…" : "Submit Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Review Expense</DialogTitle></DialogHeader>
          {selectedExpense && (
            <div className="py-2 space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-[#210F37]">{selectedExpense.title}</p>
                <p className="text-sm text-gray-600">Amount: <span className="font-bold">${Number(selectedExpense.amount).toFixed(2)}</span></p>
                <p className="text-sm text-gray-600">Category: {selectedExpense.category}</p>
                <p className="text-sm text-gray-600">Project: {selectedExpense.project_name}</p>
                <p className="text-sm text-gray-600">By: {selectedExpense.submitted_by_name || selectedExpense.submitted_by}</p>
                {selectedExpense.receipt_url && (
                  <a href={selectedExpense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#A55B4B] underline">View Receipt</a>
                )}
              </div>
              <div>
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Reason…" className="mt-1" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleReject} className="bg-red-500 hover:bg-red-600 text-white"><XCircle className="w-4 h-4 mr-1" /> Reject</Button>
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="w-4 h-4 mr-1" /> Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}