import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  BarChart3, Download, Filter, TrendingUp, Clock, Receipt,
  CheckSquare, FolderKanban, Users, ChevronDown, ChevronUp, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const COLORS = ["#A55B4B", "#4F1C51", "#DCA06D", "#210F37", "#7B3F6E", "#2D9CDB"];

export default function Reports() {
  // Admin-only guard
  const [isAdmin, setIsAdmin] = useState(null);
  useEffect(() => {
    base44.auth.me().then(u => setIsAdmin(u?.role === "admin")).catch(() => setIsAdmin(false));
  }, []);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("project"); // project | employee | monthly
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    Promise.allSettled([
      base44.entities.Project.list(),
      base44.entities.Task.list(),
      base44.entities.Expense.list(),
      base44.entities.Timesheet.list(),
      base44.entities.User.list(),
    ]).then(([pR, tR, eR, tsR, uR]) => {
      setProjects(pR.status === "fulfilled" ? pR.value : []);
      setTasks(tR.status === "fulfilled" ? tR.value : []);
      setExpenses(eR.status === "fulfilled" ? eR.value : []);
      setTimesheets(tsR.status === "fulfilled" ? tsR.value : []);
      setUsers(uR.status === "fulfilled" ? uR.value : []);
      setLoading(false);
    });
  }, []);

  const toggleRow = (id) => setExpandedRows(r => ({ ...r, [id]: !r[id] }));

  // --- PROJECT REPORT ---
  const projectRows = projects
    .filter(p => selectedProject === "all" || p.id === selectedProject)
    .map(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id);
      const pExpenses = expenses.filter(e => e.project_id === p.id);
      const pTimesheets = timesheets.filter(t => t.project_id === p.id);
      const approvedExpenses = pExpenses.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
      const approvedHours = pTimesheets.filter(t => t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
      const completedTasks = pTasks.filter(t => t.status === "completed").length;
      const budgetUsed = p.budget > 0 ? Math.round((approvedExpenses / p.budget) * 100) : null;
      return { ...p, pTasks, pExpenses, pTimesheets, approvedExpenses, approvedHours, completedTasks, budgetUsed };
    });

  // --- EMPLOYEE REPORT ---
  const employeeRows = users
    .filter(u => selectedEmployee === "all" || u.id === selectedEmployee)
    .map(u => {
      const uTasks = tasks.filter(t => t.assigned_to?.includes(u.email));
      const uTimesheets = timesheets.filter(t => t.employee_email === u.email);
      const uExpenses = expenses.filter(e => e.submitted_by === u.email);
      const approvedHours = uTimesheets.filter(t => t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
      const approvedExpenses = uExpenses.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
      const completedTasks = uTasks.filter(t => t.status === "completed").length;
      return { ...u, uTasks, uTimesheets, uExpenses, approvedHours, approvedExpenses, completedTasks };
    });

  // --- MONTHLY REPORT ---
  const [year, month] = selectedMonth.split("-").map(Number);
  const monthStart = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(year, month, 0), "yyyy-MM-dd");
  const monthExpenses = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
  const monthTimesheets = timesheets.filter(t => t.date >= monthStart && t.date <= monthEnd);
  const monthTasks = tasks.filter(t => t.due_date >= monthStart && t.due_date <= monthEnd);

  const monthlyByProject = projects.map(p => ({
    name: p.name?.substring(0, 14) + (p.name?.length > 14 ? "…" : ""),
    hours: monthTimesheets.filter(t => t.project_id === p.id && t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0),
    expenses: monthExpenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0),
  })).filter(p => p.hours > 0 || p.expenses > 0);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const handleExport = () => {
    let csv = "";
    if (reportType === "project") {
      csv = "Project,Status,Budget,Approved Expenses,Budget Used %,Approved Hours,Total Tasks,Completed Tasks\n";
      projectRows.forEach(p => {
        csv += `"${p.name}","${p.status}","${p.budget || 0}","${p.approvedExpenses.toFixed(2)}","${p.budgetUsed ?? "N/A"}","${p.approvedHours}","${p.pTasks.length}","${p.completedTasks}"\n`;
      });
    } else if (reportType === "employee") {
      csv = "Employee,Email,Role,Approved Hours,Approved Expenses,Total Tasks,Completed Tasks\n";
      employeeRows.forEach(u => {
        csv += `"${u.full_name || ""}","${u.email}","${u.role}","${u.approvedHours}","${u.approvedExpenses.toFixed(2)}","${u.uTasks.length}","${u.completedTasks}"\n`;
      });
    } else {
      csv = "Project,Approved Hours,Approved Expenses\n";
      monthlyByProject.forEach(p => {
        csv += `"${p.name}","${p.hours}","${p.expenses.toFixed(2)}"\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report_${reportType}_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (isAdmin === false) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Access restricted to admins only.</p>
    </div>
  );

  if (loading || isAdmin === null) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#A55B4B]" /> Reports
          </h2>
          <p className="text-gray-500 text-sm mt-1">Exportable summaries by project, employee, or month</p>
        </div>
        <Button onClick={handleExport} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "project", icon: FolderKanban, label: "By Project" },
          { key: "employee", icon: Users, label: "By Employee" },
          { key: "monthly", icon: BarChart3, label: "Monthly Summary" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setReportType(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              reportType === key
                ? "bg-[#A55B4B] text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:border-[#A55B4B]"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        {reportType === "project" && (
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {reportType === "employee" && (
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {reportType === "monthly" && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* PROJECT REPORT */}
      {reportType === "project" && (
        <div className="space-y-3">
          {projectRows.length === 0 && <p className="text-gray-400 text-center py-12">No projects found</p>}
          {projectRows.map(p => (
            <Card key={p.id} className="border-0 shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleRow(p.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: p.color || "#A55B4B" }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#210F37] truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.client_name || "No client"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-gray-400">Hours</p>
                    <p className="font-bold text-[#4F1C51]">{p.approvedHours}h</p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-gray-400">Expenses</p>
                    <p className="font-bold text-[#A55B4B]">${p.approvedExpenses.toFixed(0)}</p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-xs text-gray-400">Tasks</p>
                    <p className="font-bold text-[#210F37]">{p.completedTasks}/{p.pTasks.length}</p>
                  </div>
                  <Badge className={`text-xs ${
                    p.status === "active" ? "bg-green-100 text-green-700" :
                    p.status === "completed" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{p.status}</Badge>
                  {expandedRows[p.id] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {expandedRows[p.id] && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Budget</p>
                      <p className="font-bold text-[#210F37]">${(p.budget || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Spent</p>
                      <p className="font-bold text-[#A55B4B]">${p.approvedExpenses.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pending Expenses</p>
                      <p className="font-bold text-orange-500">{p.pExpenses.filter(e => e.status === "pending").length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pending Timesheets</p>
                      <p className="font-bold text-blue-500">{p.pTimesheets.filter(t => t.status === "pending").length}</p>
                    </div>
                  </div>
                  {p.budget > 0 && p.budgetUsed !== null && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Budget used</span>
                        <span className={`font-medium ${p.budgetUsed > 90 ? "text-red-600" : p.budgetUsed > 70 ? "text-orange-500" : "text-green-600"}`}>
                          {p.budgetUsed}%
                        </span>
                      </div>
                      <Progress value={Math.min(p.budgetUsed, 100)} className="h-2" />
                    </div>
                  )}
                  {p.pTasks.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Task Breakdown</p>
                      <div className="flex flex-wrap gap-2">
                        {["todo","in_progress","in_review","completed","blocked"].map(s => {
                          const cnt = p.pTasks.filter(t => t.status === s).length;
                          if (!cnt) return null;
                          return <Badge key={s} className="bg-white text-gray-600 border text-xs">{s.replace("_"," ")}: {cnt}</Badge>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* EMPLOYEE REPORT */}
      {reportType === "employee" && (
        <div className="space-y-3">
          {employeeRows.length === 0 && <p className="text-gray-400 text-center py-12">No employees found</p>}
          {employeeRows.map(u => (
            <Card key={u.id} className="border-0 shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleRow(u.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarFallback className="bg-[#A55B4B] text-white text-sm">{(u.full_name || u.email)[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#210F37] truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-gray-400">Hours</p>
                    <p className="font-bold text-[#4F1C51]">{u.approvedHours}h</p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-gray-400">Expenses</p>
                    <p className="font-bold text-[#A55B4B]">${u.approvedExpenses.toFixed(0)}</p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-xs text-gray-400">Tasks Done</p>
                    <p className="font-bold text-[#210F37]">{u.completedTasks}/{u.uTasks.length}</p>
                  </div>
                  <Badge className="text-xs bg-[#F5F0FF] text-[#4F1C51]">{u.role}</Badge>
                  {expandedRows[u.id] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {expandedRows[u.id] && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div><p className="text-xs text-gray-400">Pending Timesheets</p><p className="font-bold text-orange-500">{u.uTimesheets.filter(t => t.status === "pending").length}</p></div>
                    <div><p className="text-xs text-gray-400">Rejected Timesheets</p><p className="font-bold text-red-500">{u.uTimesheets.filter(t => t.status === "rejected").length}</p></div>
                    <div><p className="text-xs text-gray-400">Pending Expenses</p><p className="font-bold text-orange-500">{u.uExpenses.filter(e => e.status === "pending").length}</p></div>
                    <div><p className="text-xs text-gray-400">Rejected Expenses</p><p className="font-bold text-red-500">{u.uExpenses.filter(e => e.status === "rejected").length}</p></div>
                  </div>
                  {u.uTasks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Task Status</p>
                      <div className="flex flex-wrap gap-2">
                        {["todo","in_progress","in_review","completed","blocked"].map(s => {
                          const cnt = u.uTasks.filter(t => t.status === s).length;
                          if (!cnt) return null;
                          return <Badge key={s} className="bg-white text-gray-600 border text-xs">{s.replace("_"," ")}: {cnt}</Badge>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* MONTHLY REPORT */}
      {reportType === "monthly" && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Hours", value: `${monthTimesheets.filter(t => t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0)}h`, icon: Clock, color: "bg-[#4F1C51]" },
              { label: "Total Expenses", value: `$${monthExpenses.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0).toFixed(0)}`, icon: Receipt, color: "bg-[#A55B4B]" },
              { label: "Tasks Due", value: monthTasks.length, icon: CheckSquare, color: "bg-[#DCA06D]" },
              { label: "Pending Reviews", value: monthExpenses.filter(e => e.status === "pending").length + monthTimesheets.filter(t => t.status === "pending").length, icon: TrendingUp, color: "bg-[#210F37]" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${color}`}><Icon className="w-4 h-4 text-white" /></div>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-bold text-[#210F37] text-lg">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          {monthlyByProject.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[#210F37]">Hours by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyByProject}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                        {monthlyByProject.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[#210F37]">Expenses by Project ($)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyByProject}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={v => [`$${v.toFixed(2)}`, "Amount"]} />
                      <Bar dataKey="expenses" radius={[4, 4, 0, 0]}>
                        {monthlyByProject.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center text-gray-400">No approved data for this month</CardContent>
            </Card>
          )}

          {/* Expense breakdown table */}
          {monthExpenses.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#210F37]">Expense Entries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Date", "Title", "Project", "Amount", "Status", "Submitted By"].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthExpenses.slice(0, 20).map(e => (
                        <tr key={e.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs text-gray-500">{e.date}</td>
                          <td className="px-4 py-2 font-medium text-[#210F37]">{e.title}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{e.project_name}</td>
                          <td className="px-4 py-2 font-medium">${Number(e.amount).toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <Badge className={`text-xs ${e.status === "approved" ? "bg-green-100 text-green-700" : e.status === "rejected" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                              {e.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{e.submitted_by_name || e.submitted_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}