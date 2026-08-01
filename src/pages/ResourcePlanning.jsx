import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format, subDays, addDays, startOfWeek, endOfWeek, differenceInDays } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users, Search, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, Calendar, Zap, UserCheck, BarChart3, Target
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from "recharts";

const TODAY = format(new Date(), "yyyy-MM-dd");
const CAPACITY_HOURS_PER_WEEK = 40;

function getCapacityColor(pct) {
  if (pct > 100) return "text-red-500";
  if (pct > 85) return "text-orange-500";
  if (pct < 40) return "text-blue-500";
  return "text-green-600";
}

function getCapacityBg(pct) {
  if (pct > 100) return "bg-red-500";
  if (pct > 85) return "bg-orange-400";
  if (pct < 40) return "bg-blue-400";
  return "bg-green-500";
}

export default function ResourcePlanning() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("capacity");
  const [capacityView, setCapacityView] = useState("grid"); // grid | week | list
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = prev, 1 = next

  useEffect(() => {
    base44.auth.me().then(async me => {
      if (me?.role !== "admin") { setLoading(false); return; }
      setIsAdmin(true);
      const [uR, tR, pR, tsR] = await Promise.allSettled([
        base44.entities.User.list(),
        base44.entities.Task.list(),
        base44.entities.Project.list(),
        base44.entities.Timesheet.list(),
      ]);
      setUsers(uR.value || []);
      setTasks(tR.value || []);
      setProjects(pR.value || []);
      setTimesheets(tsR.value || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const employees = users.filter(u => u.role !== "admin");
  const activeProjects = projects.filter(p => p.status === "active");

  // Calculate week ranges
  const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date()), "yyyy-MM-dd");
  const twoWeeksAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");

  const getEmployeeData = (user) => {
    const myTasks = tasks.filter(t => t.assigned_to?.includes(user.email));
    const activeTasks = myTasks.filter(t => !["completed", "blocked"].includes(t.status));
    const completedTasks = myTasks.filter(t => t.status === "completed").length;
    const overdueTasks = myTasks.filter(t => t.due_date && t.due_date < TODAY && t.status !== "completed");
    const blockedTasks = myTasks.filter(t => t.status === "blocked");

    // Estimated hours remaining from active tasks
    const estimatedHours = activeTasks.reduce((s, t) => s + ((t.estimated_hours || 4) - (t.actual_hours || 0)), 0);
    const capacityPct = CAPACITY_HOURS_PER_WEEK > 0 ? Math.round((estimatedHours / CAPACITY_HOURS_PER_WEEK) * 100) : 0;

    // Hours logged this week
    const hoursThisWeek = timesheets.filter(ts => ts.employee_email === user.email && ts.date >= weekStart && ts.date <= weekEnd && ts.status === "approved")
      .reduce((s, ts) => s + (ts.hours || 0), 0);

    // Total hours (all time)
    const totalHours = timesheets.filter(ts => ts.employee_email === user.email && ts.status === "approved")
      .reduce((s, ts) => s + (ts.hours || 0), 0);

    // Skills from user profile
    const skills = user.skills || [];

    // Projects assigned to
    const assignedProjects = activeProjects.filter(p => p.team_members?.includes(user.email) || activeTasks.some(t => t.project_id === p.id));

    const completionRate = myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0;

    return {
      myTasks, activeTasks, completedTasks, overdueTasks, blockedTasks,
      estimatedHours, capacityPct, hoursThisWeek, totalHours, skills, assignedProjects, completionRate
    };
  };

  const filtered = employees.filter(u =>
    !search || (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.job_title || "").toLowerCase().includes(search.toLowerCase())
  );

  // Summary stats
  const allData = employees.map(u => ({ u, ...getEmployeeData(u) }));
  const overloaded = allData.filter(d => d.capacityPct > 100);
  const underutilized = allData.filter(d => d.capacityPct < 40 && d.activeTasks.length > 0);
  const optimal = allData.filter(d => d.capacityPct >= 40 && d.capacityPct <= 100);
  const totalEstimatedHours = allData.reduce((s, d) => s + d.estimatedHours, 0);
  const totalCapacity = employees.length * CAPACITY_HOURS_PER_WEEK;
  const overallUtilization = totalCapacity > 0 ? Math.round((totalEstimatedHours / totalCapacity) * 100) : 0;

  // Chart data
  const capacityChartData = allData.slice(0, 10).map(d => ({
    name: d.u.full_name?.split(" ")[0] || d.u.email?.split("@")[0],
    capacity: CAPACITY_HOURS_PER_WEEK,
    estimated: Math.round(d.estimatedHours),
    actual: Math.round(d.hoursThisWeek),
  }));

  // Skills matrix
  const allSkills = [...new Set(employees.flatMap(u => u.skills || []))].slice(0, 12);
  const skillMatrix = allSkills.map(skill => ({
    skill,
    count: employees.filter(u => (u.skills || []).includes(skill)).length,
    people: employees.filter(u => (u.skills || []).includes(skill)).map(u => u.full_name?.split(" ")[0] || u.email?.split("@")[0]),
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Admin access required.</div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">Resource Planning & Allocation</h2>
          <p className="text-gray-500 text-sm">Capacity tracking · Skill-based assignment · Over/under allocation alerts</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: "capacity", label: "Capacity" },
            { id: "skills", label: "Skills Matrix" },
            { id: "projects", label: "By Project" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === t.id ? "bg-white text-[#210F37] shadow-sm" : "text-gray-500 hover:text-[#210F37]"
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Overall Utilization", value: `${overallUtilization}%`, sub: `${employees.length} team members`, color: getCapacityColor(overallUtilization) },
          { label: "Overloaded", value: overloaded.length, sub: ">100% capacity", color: "text-red-500" },
          { label: "Optimal Load", value: optimal.length, sub: "40–100% capacity", color: "text-green-600" },
          { label: "Under-utilized", value: underutilized.length, sub: "<40% capacity", color: "text-blue-500" },
        ].map((k, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase font-medium tracking-wide mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {overloaded.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500 bg-red-50/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-red-700 text-sm">Over-allocation Alert — {overloaded.length} member{overloaded.length > 1 ? "s" : ""} overloaded</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overloaded.map(d => (
                <Badge key={d.u.id} className="bg-red-100 text-red-700 text-xs">
                  {d.u.full_name || d.u.email?.split("@")[0]} — {d.capacityPct}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== CAPACITY TAB ===== */}
      {activeTab === "capacity" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#210F37]">Team Capacity vs Estimated Work</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={capacityChartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="capacity" fill="#e5e7eb" name="Capacity (40h)" radius={[4,4,0,0]} />
                  <Bar dataKey="estimated" fill="#A55B4B" name="Estimated Work" radius={[4,4,0,0]} />
                  <Bar dataKey="actual" fill="#4F1C51" name="Hours This Week" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Search + View Toggle */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." className="pl-9" />
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              {[
                { id: "grid", label: "Grid" },
                { id: "week", label: "By Week" },
                { id: "list", label: "List" },
              ].map(v => (
                <button key={v.id} onClick={() => setCapacityView(v.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-all ${capacityView === v.id ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid view */}
          {capacityView === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(u => {
                const d = getEmployeeData(u);
                return (
                  <Card key={u.id} className="border-0 shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="w-10 h-10 border-2 border-[#A55B4B]">
                          <AvatarFallback className="bg-gradient-to-br from-[#A55B4B] to-[#4F1C51] text-white text-sm">
                            {u.full_name?.[0] || u.email?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#210F37] text-sm truncate">{u.full_name || u.email?.split("@")[0]}</p>
                          <p className="text-xs text-gray-400">{u.job_title || u.department || "Employee"}</p>
                        </div>
                        <Badge className={`text-xs ${d.capacityPct > 100 ? "bg-red-100 text-red-700" : d.capacityPct > 85 ? "bg-orange-100 text-orange-700" : d.capacityPct < 40 ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {d.capacityPct > 100 ? "Overloaded" : d.capacityPct > 85 ? "Near Full" : d.capacityPct < 40 ? "Available" : "Optimal"}
                        </Badge>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Capacity</span>
                          <span className={`font-semibold ${getCapacityColor(d.capacityPct)}`}>{d.capacityPct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-2 rounded-full ${getCapacityBg(d.capacityPct)} transition-all`} style={{ width: `${Math.min(100, d.capacityPct)}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{Math.round(d.estimatedHours)}h est / {CAPACITY_HOURS_PER_WEEK}h cap</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-2 text-center text-xs">
                        <div><p className="text-gray-400">Active Tasks</p><p className="font-bold text-[#210F37]">{d.activeTasks.length}</p></div>
                        <div><p className="text-gray-400">This Week</p><p className="font-bold text-[#4F1C51]">{d.hoursThisWeek}h</p></div>
                        <div><p className="text-gray-400">Completion</p><p className={`font-bold ${d.completionRate > 70 ? "text-green-600" : "text-orange-500"}`}>{d.completionRate}%</p></div>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {d.overdueTasks.length > 0 && <Badge className="text-xs bg-red-100 text-red-700">{d.overdueTasks.length} overdue</Badge>}
                        {d.blockedTasks.length > 0 && <Badge className="text-xs bg-yellow-100 text-yellow-700">{d.blockedTasks.length} blocked</Badge>}
                        {d.assignedProjects.length > 0 && <Badge className="text-xs bg-gray-100 text-gray-600">{d.assignedProjects.length} project{d.assignedProjects.length > 1 ? "s" : ""}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Week view — hours logged per employee for each day this week */}
          {capacityView === "week" && (() => {
            const today = new Date();
            const baseWeekStart = startOfWeek(today);
            const ws = addDays(baseWeekStart, weekOffset * 7);
            const we = addDays(ws, 6);
            const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
            const wsStr = format(ws, "yyyy-MM-dd");
            const weStr = format(we, "yyyy-MM-dd");
            return (
              <Card className="border-0 shadow-sm overflow-x-auto">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <button onClick={() => setWeekOffset(o => o - 1)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#A55B4B] transition-colors px-2 py-1 rounded border border-gray-200 hover:border-[#A55B4B]">
                    ‹ Prev Week
                  </button>
                  <span className="text-sm font-semibold text-[#210F37]">
                    {format(ws, "MMM d")} – {format(we, "MMM d, yyyy")}
                    {weekOffset === 0 && <span className="ml-2 text-xs text-[#A55B4B] font-normal">Current Week</span>}
                  </span>
                  <button onClick={() => setWeekOffset(o => o + 1)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#A55B4B] transition-colors px-2 py-1 rounded border border-gray-200 hover:border-[#A55B4B]">
                    Next Week ›
                  </button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="text-left text-gray-500 font-medium py-2 pr-4 w-40">Employee</th>
                        {weekDays.map(d => (
                          <th key={d.toISOString()} className={`text-center font-medium py-2 px-2 ${format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd") ? "text-[#A55B4B]" : "text-gray-500"}`}>
                            {format(d, "EEE")}<br /><span className="font-bold">{format(d, "d")}</span>
                          </th>
                        ))}
                        <th className="text-center text-gray-500 font-medium py-2 px-2">Total</th>
                        <th className="text-center text-gray-500 font-medium py-2 px-2">Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => {
                        const d = getEmployeeData(u);
                        const weekHours = timesheets.filter(ts => ts.employee_email === u.email && ts.date >= wsStr && ts.date <= weStr && ts.status === "approved").reduce((s, ts) => s + (ts.hours || 0), 0);
                        return (
                          <tr key={u.id} className="border-t border-gray-100">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-7 h-7"><AvatarFallback className="bg-[#A55B4B] text-white text-xs">{u.full_name?.[0] || "U"}</AvatarFallback></Avatar>
                                <div>
                                  <p className="font-medium text-[#210F37] truncate max-w-28">{u.full_name?.split(" ")[0] || u.email?.split("@")[0]}</p>
                                  <p className="text-gray-400 text-[10px]">{u.job_title || u.department || ""}</p>
                                </div>
                              </div>
                            </td>
                            {weekDays.map(day => {
                              const dayStr = format(day, "yyyy-MM-dd");
                              const dayHours = timesheets.filter(ts => ts.employee_email === u.email && ts.date === dayStr && ts.status === "approved").reduce((s, ts) => s + (ts.hours || 0), 0);
                              return (
                                <td key={dayStr} className={`text-center py-2 px-2 ${dayStr === format(today, "yyyy-MM-dd") ? "bg-[#A55B4B]/5" : ""}`}>
                                  {dayHours > 0 ? <span className="font-semibold text-[#4F1C51]">{dayHours}h</span> : <span className="text-gray-300">—</span>}
                                </td>
                              );
                            })}
                            <td className="text-center py-2 px-2 font-bold text-[#210F37]">{weekHours}h</td>
                            <td className="text-center py-2 px-2">
                              <span className={`font-semibold ${getCapacityColor(d.capacityPct)}`}>{d.capacityPct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })()}

          {/* List view */}
          {capacityView === "list" && (
            <div className="space-y-2">
              {filtered.map(u => {
                const d = getEmployeeData(u);
                return (
                  <div key={u.id} className="bg-white rounded-lg shadow-sm px-4 py-3 flex items-center gap-4">
                    <Avatar className="w-9 h-9 border-2 border-[#A55B4B] flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-[#A55B4B] to-[#4F1C51] text-white text-sm">{u.full_name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#210F37] text-sm">{u.full_name || u.email?.split("@")[0]}</p>
                        <p className="text-xs text-gray-400">{u.job_title || u.department || "Employee"}</p>
                        <Badge className={`text-xs ${d.capacityPct > 100 ? "bg-red-100 text-red-700" : d.capacityPct > 85 ? "bg-orange-100 text-orange-700" : d.capacityPct < 40 ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {d.capacityPct > 100 ? "Overloaded" : d.capacityPct > 85 ? "Near Full" : d.capacityPct < 40 ? "Available" : "Optimal"}
                        </Badge>
                        {d.overdueTasks.length > 0 && <Badge className="text-xs bg-red-100 text-red-700">{d.overdueTasks.length} overdue</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full ${getCapacityBg(d.capacityPct)}`} style={{ width: `${Math.min(100, d.capacityPct)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${getCapacityColor(d.capacityPct)} w-10 text-right`}>{d.capacityPct}%</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex gap-6 text-center text-xs flex-shrink-0">
                      <div><p className="text-gray-400">Active</p><p className="font-bold text-[#210F37]">{d.activeTasks.length}</p></div>
                      <div><p className="text-gray-400">This Week</p><p className="font-bold text-[#4F1C51]">{d.hoursThisWeek}h</p></div>
                      <div><p className="text-gray-400">Done</p><p className={`font-bold ${d.completionRate > 70 ? "text-green-600" : "text-orange-500"}`}>{d.completionRate}%</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== SKILLS MATRIX ===== */}
      {activeTab === "skills" && (
        <div className="space-y-4">
          {allSkills.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center text-gray-400">
                <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No skills data yet. Employees can add skills in their profile.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#210F37]">Skill Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={skillMatrix} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="skill" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#4F1C51" radius={[0, 4, 4, 0]} name="People" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {skillMatrix.map(s => (
                  <Card key={s.skill} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-[#210F37] text-sm">{s.skill}</p>
                        <Badge className="bg-[#4F1C51]/10 text-[#4F1C51] text-xs">{s.count} people</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {s.people.map(p => (
                          <span key={p} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{p}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== BY PROJECT ===== */}
      {activeTab === "projects" && (
        <div className="space-y-3">
          {activeProjects.map(p => {
            const projectTasks = tasks.filter(t => t.project_id === p.id && !["completed"].includes(t.status));
            const assignedEmails = [...new Set(projectTasks.flatMap(t => t.assigned_to || []))];
            const assignedUsers = employees.filter(u => assignedEmails.includes(u.email) || p.team_members?.includes(u.email));
            const daysLeft = p.end_date ? differenceInDays(parseLocalDate(p.end_date), new Date()) : null;

            return (
              <Card key={p.id} className="border-0 shadow-sm">
                <div className="h-1" style={{ background: p.color || "#A55B4B" }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-semibold text-[#210F37]">{p.name}</h4>
                      {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {daysLeft !== null && (
                        <Badge className={`text-xs ${daysLeft < 0 ? "bg-red-100 text-red-700" : daysLeft < 14 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                        </Badge>
                      )}
                      <Badge className="text-xs bg-gray-100 text-gray-600">{assignedUsers.length} members</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No team members assigned</p>
                    ) : (
                      assignedUsers.map(u => {
                        const d = getEmployeeData(u);
                        const activeProjTasks = projectTasks.filter(t => t.assigned_to?.includes(u.email));
                        return (
                          <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <Avatar className="w-7 h-7 border border-[#A55B4B]">
                              <AvatarFallback className="bg-[#A55B4B] text-white text-xs">{u.full_name?.[0] || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium text-[#210F37]">{u.full_name?.split(" ")[0] || u.email?.split("@")[0]}</p>
                              <p className="text-xs text-gray-400">{activeProjTasks.length} tasks</p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${getCapacityBg(d.capacityPct)}`} title={`${d.capacityPct}% capacity`} />
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {activeProjects.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center text-gray-400">No active projects</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}