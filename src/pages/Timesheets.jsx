import { useState, useEffect, useRef } from "react";
import Pagination from "@/components/Pagination";
import { base44 } from "@/api/base44Client";
import {
  Plus, Clock, CheckCircle2, XCircle, Search, List,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, Download, Printer
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
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks
} from "date-fns";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
};

const DEFAULT_FORM = {
  project_id: "", project_name: "", task_id: "", task_title: "",
  date: format(new Date(), "yyyy-MM-dd"), hours: "", description: "",
  overtime_hours: "", overtime_reason: ""
};

export default function Timesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [calMode, setCalMode] = useState("month");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [chartDays, setChartDays] = useState(30);
  const [chartOffset, setChartOffset] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [dayEntries, setDayEntries] = useState([]);
  const [dayLabel, setDayLabel] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTs, setSelectedTs] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const handledTimesheetLink = useRef(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      const admin = u?.role === "admin";
      setIsAdmin(admin);
      loadData(u, admin, u);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (handledTimesheetLink.current || !timesheets.length || !currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const timesheetId = params.get("timesheet");
    if (!timesheetId) return;
    const timesheet = timesheets.find(entry => entry.id === timesheetId);
    handledTimesheetLink.current = true;
    if (!timesheet) return;
    setSelectedTs(timesheet);
    if (currentUser.role === "admin" && timesheet.status === "pending" && params.get("review") === "1") {
      setShowApproveDialog(true);
    } else {
      setShowDetailDialog(true);
    }
  }, [timesheets, currentUser]);

  const loadData = async (me, admin, meOverride) => {
    const user = meOverride || me || currentUser;
    const isAdminUser = admin !== undefined ? admin : isAdmin;
    const [ts, allProjects, t] = await Promise.allSettled([
      base44.entities.Timesheet.list("-date"),
      base44.entities.Project.list(),
      base44.entities.Task.list(),
    ]);
    const allP = allProjects.status === "fulfilled" ? allProjects.value : [];
    const allT = t.status === "fulfilled" ? t.value : [];
    // For employees: include projects where they are a team member, manager, OR have tasks assigned
    const assignedProjectIds = new Set(
      allT.filter(task => task.assigned_to?.includes(user?.email)).map(task => task.project_id)
    );
    const filteredP = isAdminUser ? allP : allP.filter(p =>
      p.team_members?.includes(user?.email) ||
      p.manager_email === user?.email ||
      assignedProjectIds.has(p.id)
    );
    setTimesheets(ts.status === "fulfilled" ? ts.value : []);
    setProjects(filteredP);
    setTasks(isAdminUser ? allT : allT.filter(task => task.assigned_to?.includes(user?.email)));
    setLoading(false);
  };

  const handleSave = async () => {
    const hrs = Number(form.hours);
    if (!hrs || hrs <= 0 || hrs > 24) {
      alert("Hours must be between 0.5 and 24");
      return;
    }
    setSaving(true);
    const proj = projects.find(p => p.id === form.project_id);
    const task = tasks.find(t => t.id === form.task_id);
    await base44.entities.Timesheet.create({
      ...form,
      hours: Number(form.hours),
      overtime_hours: form.overtime_hours ? Number(form.overtime_hours) : 0,
      overtime_reason: form.overtime_reason || "",
      project_name: proj?.name || "", task_title: task?.title || "",
      employee_email: currentUser?.email,
      employee_name: currentUser?.full_name || currentUser?.email,
      status: "pending"
    });
    // Create in-app notification for admins
    const adminUsers = await base44.entities.User.filter({ role: "admin" }).catch(() => []);
    for (const admin of adminUsers) {
      await base44.entities.Notification.create({
        recipient_email: admin.email,
        title: "Timesheet Submitted",
        message: `${currentUser?.full_name || currentUser?.email} logged ${form.hours}h${form.overtime_hours ? ` + ${form.overtime_hours}h OT` : ""} on ${form.date} for "${proj?.name || ""}"`,
        type: "timesheet",
        sender_name: currentUser?.full_name || currentUser?.email,
        sender_email: currentUser?.email,
        is_read: false
      }).catch(() => {});
    }
    setSaving(false);
    setShowDialog(false);
    loadData(currentUser, isAdmin);
  };

  const handleApprove = async () => {
    await base44.entities.Timesheet.update(selectedTs.id, {
      status: "approved", reviewed_by: currentUser?.email, reviewed_at: new Date().toISOString()
    });
    setShowApproveDialog(false); loadData(currentUser, isAdmin);
  };

  const handleReject = async () => {
    await base44.entities.Timesheet.update(selectedTs.id, {
      status: "rejected", reviewed_by: currentUser?.email,
      reviewed_at: new Date().toISOString(), rejection_reason: rejectionReason
    });
    setShowApproveDialog(false); setRejectionReason(""); loadData(currentUser, isAdmin);
  };

  const filteredTimesheets = timesheets.filter(ts => {
    if (!isAdmin && currentUser && ts.employee_email !== currentUser.email) return false;
    const matchSearch = ts.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      ts.employee_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || ts.status === filterStatus;
    const matchProject = filterProject === "all" || ts.project_id === filterProject;
    const matchFrom = !filterDateFrom || (ts.date && ts.date >= filterDateFrom);
    const matchTo = !filterDateTo || (ts.date && ts.date <= filterDateTo);
    return matchSearch && matchStatus && matchProject && matchFrom && matchTo;
  });

  const totalApprovedHours = filteredTimesheets.filter(t => t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
  const totalPendingHours = filteredTimesheets.filter(t => t.status === "pending").reduce((s, t) => s + (t.hours || 0), 0);

  // Reset offset when chartDays changes
  useEffect(() => { setChartOffset(0); }, [chartDays]);

  const PERSON_COLORS = ["#4F1C51", "#A55B4B", "#DCA06D", "#2D6A4F", "#1A759F", "#7B3F6E", "#E07B54"];
  const allEmployees = [...new Set(filteredTimesheets.map(ts => ts.employee_email).filter(Boolean))];

  // Build stacked chart data per employee (offset shifts the window back in time)
  const chartData = Array.from({ length: chartDays }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (chartDays - 1) + i - chartOffset * chartDays);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayTs = filteredTimesheets.filter(ts => ts.date === dateStr);
    const entry = { day: chartDays === 7 ? format(d, "EEE") : format(d, "M/d") };
    allEmployees.forEach(email => {
      entry[email] = dayTs.filter(ts => ts.employee_email === email).reduce((s, ts) => s + (ts.hours || 0), 0);
    });
    entry.hours = dayTs.reduce((s, ts) => s + (ts.hours || 0), 0);
    return entry;
  });

  const CustomTsTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-xs min-w-36">
        <p className="font-semibold text-[#210F37] mb-1">{label}</p>
        {payload.filter(p => p.value > 0).map((p, i) => {
          const name = filteredTimesheets.find(ts => ts.employee_email === p.dataKey)?.employee_name || p.dataKey;
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <span style={{ color: p.fill }} className="truncate max-w-24">{name}</span>
              <span className="font-bold">{p.value}h</span>
            </div>
          );
        })}
      </div>
    );
  };

  const monthDays = eachDayOfInterval({ start: startOfMonth(calendarDate), end: endOfMonth(calendarDate) });
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 0 }) });
  const getTimesheetsForDay = (day) => filteredTimesheets.filter(ts => ts.date && isSameDay(parseLocalDate(ts.date), day));

  const TimesheetRow = ({ ts }) => {
    const StatusIcon = STATUS_CONFIG[ts.status]?.icon || Clock;
    return (
      <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm hover:shadow-md transition-all">
        <div className="p-1.5 rounded-lg bg-[#F5F0FF] flex-shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#4F1C51]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-[#210F37] truncate">{ts.project_name}</p>
          <p className="text-xs text-gray-400">{ts.task_title || "—"} · {ts.employee_name || ts.employee_email}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-[#210F37] text-sm">
            {ts.hours}h{ts.overtime_hours > 0 ? <span className="text-orange-500 text-xs ml-1">+{ts.overtime_hours}h OT</span> : ""}
          </p>
          <p className="text-xs text-gray-400">{ts.date}</p>
        </div>
        <Badge className={`text-xs hidden sm:flex ${STATUS_CONFIG[ts.status]?.color}`}>
          <StatusIcon className="w-3 h-3 mr-1" />{STATUS_CONFIG[ts.status]?.label}
        </Badge>
        <button
          onClick={() => { setSelectedTs(ts); setShowDetailDialog(true); }}
          className="p-1.5 rounded-lg hover:bg-[#F5F0FF] text-gray-400 hover:text-[#4F1C51] transition-colors flex-shrink-0"
          title="View details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {isAdmin && ts.status === "pending" && (
          <Button size="sm" onClick={() => { setSelectedTs(ts); setShowApproveDialog(true); }}
            className="bg-[#4F1C51] text-white text-xs h-7">Review</Button>
        )}
      </div>
    );
  };

  const handleExportCSV = () => {
    exportCSV(
      `timesheets_${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Date", "Employee", "Email", "Project", "Task", "Hours", "Status", "Reviewed By", "Description"],
      filteredTimesheets.map(ts => [ts.date, ts.employee_name || ts.employee_email, ts.employee_email || "", ts.project_name, ts.task_title || "", ts.hours, ts.status, ts.reviewed_by || "", ts.description || ""])
    );
  };

  const pdfReport = () => [
      "Timesheets Report",
      ["Date", "Employee", "Project", "Hours", "Status", "Reviewed By"],
      filteredTimesheets.map(ts => [ts.date, ts.employee_name || ts.employee_email, ts.project_name, `${ts.hours}h`, ts.status, ts.reviewed_by || "—"]),
      [
        { label: "Total Entries", value: filteredTimesheets.length },
        { label: "Approved Hours", value: `${totalApprovedHours}h` },
        { label: "Pending Hours", value: `${totalPendingHours}h` },
      ]
  ];
  const handleExportPDF = () => exportPDF(...pdfReport());
  const handlePrint = () => printPDF(...pdfReport());

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">Timesheets</h2>
          <p className="text-gray-500 text-sm">{filteredTimesheets.length} entries</p>
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
          <Button onClick={() => { setForm(DEFAULT_FORM); setShowDialog(true); }} className="bg-[#4F1C51] hover:bg-[#210F37] text-white">
            <Plus className="w-4 h-4 mr-1" /> Log Time
          </Button>
        </div>
      </div>

      {/* Timeline bar chart */}
      <Card className="border-0 shadow-sm mb-4">
        <CardHeader className="pb-1 pt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours Timeline</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => { setChartDays(7); setChartOffset(0); }} className={`px-3 py-1 text-xs ${chartDays === 7 ? "bg-[#4F1C51] text-white" : "bg-white text-gray-500"}`}>7 Days</button>
                <button onClick={() => { setChartDays(30); setChartOffset(0); }} className={`px-3 py-1 text-xs ${chartDays === 30 ? "bg-[#4F1C51] text-white" : "bg-white text-gray-500"}`}>30 Days</button>
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
              <Tooltip content={<CustomTsTooltip />} />
              {allEmployees.length > 0
                ? allEmployees.map((email, i) => (
                    <Bar key={email} dataKey={email} stackId="a" fill={PERSON_COLORS[i % PERSON_COLORS.length]} radius={i === allEmployees.length - 1 ? [3,3,0,0] : [0,0,0,0]} />
                  ))
                : <Bar dataKey="hours" fill="#4F1C51" radius={[3,3,0,0]} />
              }
            </BarChart>
          </ResponsiveContainer>
          {allEmployees.length > 1 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {allEmployees.map((email, i) => {
                const name = filteredTimesheets.find(ts => ts.employee_email === email)?.employee_name || email;
                return (
                  <div key={email} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PERSON_COLORS[i % PERSON_COLORS.length] }} />
                    {name}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-lg font-bold text-green-600">{totalApprovedHours}h</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-bold text-yellow-600">{totalPendingHours}h</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Entries</p>
            <p className="text-lg font-bold text-[#210F37]">{filteredTimesheets.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search timesheets…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
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
          <button onClick={() => setView("list")} className={`px-3 py-1.5 ${view === "list" ? "bg-[#4F1C51] text-white" : "bg-white text-gray-500"}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setView("calendar")} className={`px-3 py-1.5 ${view === "calendar" ? "bg-[#4F1C51] text-white" : "bg-white text-gray-500"}`}>
            <CalendarIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#4F1C51] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === "list" ? (
        <div className="space-y-1.5">
          {filteredTimesheets.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No timesheets found</p>
              <Button onClick={() => { setForm(DEFAULT_FORM); setShowDialog(true); }} className="mt-4 bg-[#4F1C51] text-white">Log First Entry</Button>
            </div>
          ) : filteredTimesheets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(ts => <TimesheetRow key={ts.id} ts={ts} />)}
          <Pagination total={filteredTimesheets.length} page={page} perPage={PAGE_SIZE} onChange={p => { setPage(p); window.scrollTo(0, 0); }} />
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
                  <button onClick={() => setCalMode("month")} className={`px-2 py-1 text-xs ${calMode === "month" ? "bg-[#4F1C51] text-white" : "bg-white text-gray-500"}`}>Month</button>
                  <button onClick={() => setCalMode("week")} className={`px-2 py-1 text-xs ${calMode === "week" ? "bg-[#4F1C51] text-white" : "bg-white text-gray-500"}`}>Week</button>
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
                {monthDays.map(day => {
                  const dayTs = getTimesheetsForDay(day);
                  const totalHrs = dayTs.reduce((s, t) => s + (t.hours || 0), 0);
                  return (
                    <div key={day.toISOString()}
                      onClick={() => { if (dayTs.length > 0) { setDayEntries(dayTs); setDayLabel(format(day, "MMMM d, yyyy")); setShowDayDialog(true); } }}
                      className={`min-h-14 rounded-lg p-1 border transition-all ${isSameDay(day, new Date()) ? "border-[#4F1C51] bg-[#F5F0FF]" : "border-gray-100 bg-white"} ${dayTs.length > 0 ? "cursor-pointer hover:border-[#4F1C51] hover:shadow-sm" : ""}`}>
                      <p className="text-xs text-gray-500 mb-1">{format(day, "d")}</p>
                      {dayTs.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#4F1C51]">{totalHrs}h</p>
                          <p className="text-xs text-[#4F1C51] underline">{dayTs.length} {dayTs.length === 1 ? "entry →" : "entries →"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayTs = getTimesheetsForDay(day);
                  const totalHrs = dayTs.reduce((s, t) => s + (t.hours || 0), 0);
                  return (
                    <div key={day.toISOString()}
                      onClick={() => { if (dayTs.length > 0) { setDayEntries(dayTs); setDayLabel(format(day, "MMMM d, yyyy")); setShowDayDialog(true); } }}
                      className={`rounded-xl p-3 border min-h-28 flex flex-col gap-1 ${isSameDay(day, new Date()) ? "border-[#4F1C51] bg-[#F5F0FF]" : "border-gray-100 bg-white"} ${dayTs.length > 0 ? "cursor-pointer hover:shadow-sm hover:border-[#4F1C51]" : ""}`}>
                      <p className="text-xs text-center font-semibold text-gray-600">{format(day, "EEE d")}</p>
                      {dayTs.length > 0 ? (
                        <>
                          <p className="text-sm font-bold text-[#4F1C51] text-center">{totalHrs}h</p>
                          {dayTs.slice(0, 2).map((ts, i) => (
                            <div key={i} className="text-xs bg-[#F5F0FF] text-[#4F1C51] rounded px-1 py-0.5 truncate">{ts.project_name}</div>
                          ))}
                          {dayTs.length > 2 && <p className="text-xs text-[#4F1C51] underline text-center">+{dayTs.length - 2} more</p>}
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

      {/* Calendar Day Detail Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-[#210F37]">Timesheets on {dayLabel}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            {dayEntries.map((ts, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-[#210F37]">{ts.project_name}</p>
                  <Badge className={`text-xs ${STATUS_CONFIG[ts.status]?.color}`}>{STATUS_CONFIG[ts.status]?.label}</Badge>
                </div>
                <p className="text-xs text-gray-600">Hours: <span className="font-bold text-[#4F1C51]">{ts.hours}h</span></p>
                {ts.task_title && <p className="text-xs text-gray-600">Task: {ts.task_title}</p>}
                <p className="text-xs text-gray-600">By: {ts.employee_name || ts.employee_email}</p>
                {ts.description && <p className="text-xs text-gray-500 italic">{ts.description}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDayDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Timesheet Details</DialogTitle></DialogHeader>
          {selectedTs && (
            <div className="py-2 space-y-3">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#210F37]">{selectedTs.project_name}</p>
                  <Badge className={`text-xs ${STATUS_CONFIG[selectedTs.status]?.color}`}>{STATUS_CONFIG[selectedTs.status]?.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-gray-400">Employee</p><p className="font-medium text-[#210F37]">{selectedTs.employee_name || selectedTs.employee_email}</p></div>
                  <div><p className="text-xs text-gray-400">Regular Hours</p><p className="font-bold text-[#4F1C51]">{selectedTs.hours}h</p></div>
                  {selectedTs.overtime_hours > 0 && <div><p className="text-xs text-gray-400">Overtime Hours</p><p className="font-bold text-orange-500">{selectedTs.overtime_hours}h</p></div>}
                  <div><p className="text-xs text-gray-400">Date</p><p className="font-medium text-[#210F37]">{selectedTs.date}</p></div>
                  {selectedTs.task_title && <div><p className="text-xs text-gray-400">Task</p><p className="font-medium text-[#210F37]">{selectedTs.task_title}</p></div>}
                </div>
                {selectedTs.overtime_reason && (
                  <div><p className="text-xs text-gray-400 mb-1">Overtime Reason</p><p className="text-sm text-orange-700 bg-orange-50 rounded p-2 border border-orange-100">{selectedTs.overtime_reason}</p></div>
                )}
                {selectedTs.description && (
                  <div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-600 bg-white rounded p-2 border">{selectedTs.description}</p></div>
                )}
                {selectedTs.reviewed_by && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-400">Reviewed by: {selectedTs.reviewed_by}</p>
                    {selectedTs.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {selectedTs.rejection_reason}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            {isAdmin && selectedTs?.status === "pending" && (
              <Button onClick={() => { setShowDetailDialog(false); setShowApproveDialog(true); }} className="bg-[#4F1C51] text-white">Review</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Time Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Log Time</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => {
                const proj = projects.find(p => p.id === v);
                setForm(f => ({ ...f, project_id: v, project_name: proj?.name || "", task_id: "", task_title: "" }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.project_id && (
              <div>
                <Label>Task (optional)</Label>
                <Select value={form.task_id} onValueChange={v => {
                  const task = tasks.find(t => t.id === v);
                  setForm(f => ({ ...f, task_id: v, task_title: task?.title || "" }));
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select task" /></SelectTrigger>
                  <SelectContent>
                    {tasks.filter(t => t.project_id === form.project_id).map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Regular Hours *</Label>
                <Input type="number" step="0.5" min="0.5" max="24" value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="e.g. 8" className="mt-1" />
              </div>
            </div>
            {/* Overtime section */}
            <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
              <p className="text-xs font-semibold text-orange-700 mb-2">Overtime / Extra Hours (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Overtime Hours</Label>
                  <Input type="number" step="0.5" min="0" max="12" value={form.overtime_hours || ""}
                    onChange={e => setForm(f => ({ ...f, overtime_hours: e.target.value }))} placeholder="e.g. 2" className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Reason</Label>
                  <Input value={form.overtime_reason || ""} onChange={e => setForm(f => ({ ...f, overtime_reason: e.target.value }))}
                    placeholder="e.g. Urgent deadline" className="mt-1 h-8 text-xs" />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What did you work on?" className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.project_id || !form.hours || saving} className="bg-[#4F1C51] hover:bg-[#210F37] text-white">
              {saving ? "Submitting…" : "Submit Timesheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Review Timesheet</DialogTitle></DialogHeader>
          {selectedTs && (
            <div className="py-2 space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-[#210F37]">{selectedTs.project_name}</p>
                <p className="text-sm text-gray-600">Hours: <span className="font-bold">{selectedTs.hours}h</span></p>
                <p className="text-sm text-gray-600">Date: {selectedTs.date}</p>
                <p className="text-sm text-gray-600">By: {selectedTs.employee_name || selectedTs.employee_email}</p>
                {selectedTs.task_title && <p className="text-sm text-gray-600">Task: {selectedTs.task_title}</p>}
                {selectedTs.description && <p className="text-sm text-gray-500">{selectedTs.description}</p>}
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