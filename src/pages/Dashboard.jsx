import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FolderKanban, CheckSquare, Receipt, Clock, Users,
  TrendingUp, AlertCircle, CheckCircle2, XCircle,
  ArrowUpRight, BarChart3, Target, Zap, Activity as ActivityIcon,
  TrendingDown, Award, DollarSign, UserCheck, TimerOff,
  AlertTriangle, Gauge, ShieldAlert, Flame
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line
} from "recharts";
import { format, subDays, subMonths, startOfWeek, differenceInDays, addDays } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

const COLORS = ["#A55B4B", "#4F1C51", "#DCA06D", "#210F37", "#7B3F6E"];
const TODAY = format(new Date(), "yyyy-MM-dd");

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [users, setUsers] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      if (!me) return;
      const admin = me?.role === "admin";
      setIsAdmin(admin);
      const [pRes, tRes, eRes, tsRes, uRes, prRes] = await Promise.allSettled([
        base44.entities.Project.list(),
        base44.entities.Task.list(),
        base44.entities.Expense.list(),
        base44.entities.Timesheet.list(),
        admin ? base44.entities.User.list() : Promise.resolve([]),
        admin ? base44.entities.Procurement.list() : Promise.resolve([]),
      ]);
      const allProjects = pRes.status === "fulfilled" ? pRes.value : [];
      const allTasks = tRes.status === "fulfilled" ? tRes.value : [];
      const allExpenses = eRes.status === "fulfilled" ? eRes.value : [];
      const allTimesheets = tsRes.status === "fulfilled" ? tsRes.value : [];
      const u = uRes.status === "fulfilled" ? uRes.value : [];
      const procs = prRes.status === "fulfilled" ? prRes.value : [];

      const myProjects = admin ? allProjects : allProjects.filter(p =>
        p.team_members?.includes(me.email) || p.manager_email === me.email
      );
      const myTasks = admin ? allTasks : allTasks.filter(t => t.assigned_to?.includes(me.email));
      const myExpenses = admin ? allExpenses : allExpenses.filter(e => e.submitted_by === me.email);
      const myTimesheets = admin ? allTimesheets : allTimesheets.filter(ts => ts.employee_email === me.email);

      setProjects(myProjects); setTasks(myTasks); setExpenses(myExpenses);
      setTimesheets(myTimesheets); setUsers(u); setProcurements(procs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // --- Core KPIs ---
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < TODAY && t.status !== "completed");
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  const pendingExpenses = expenses.filter(e => e.status === "pending");
  const approvedExpenses = expenses.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
  const pendingTimesheets = timesheets.filter(t => t.status === "pending");
  const approvedHours = timesheets.filter(t => t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
  const thisWeekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const thisWeekHours = timesheets.filter(t => t.date >= thisWeekStart && t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
  const activeProjects = projects.filter(p => p.status === "active");
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const procurementTotal = procurements.filter(p => !["cancelled","draft"].includes(p.status)).reduce((s, p) => s + (p.total_amount || 0), 0);
  const totalCost = approvedExpenses + procurementTotal;
  const budgetUtilization = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
  const employees = users.filter(u => u.role !== "admin");

  // --- Utilization rate ---
  const totalPossibleHours = employees.length * 40 * 4; // 4-week baseline
  const utilizationRate = totalPossibleHours > 0 ? Math.min(100, Math.round((approvedHours / totalPossibleHours) * 100)) : 0;

  // --- Profitability ---
  const totalRevenue = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const netProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // --- Daily burn rate ---
  const last30Expenses = expenses.filter(e => {
    const d = subDays(new Date(), 30);
    return e.status === "approved" && e.date >= format(d, "yyyy-MM-dd");
  }).reduce((s, e) => s + (e.amount || 0), 0);
  const dailyBurnRate = Math.round(last30Expenses / 30);

  // --- Projected months to exhaust budget ---
  const remainingBudget = Math.max(0, totalBudget - totalCost);
  const monthlyBurn = dailyBurnRate * 30;
  const monthsRemaining = monthlyBurn > 0 ? Math.round(remainingBudget / monthlyBurn) : null;

  // --- Projects at risk ---
  const projectsAtRisk = activeProjects.filter(p => {
    const pExpenses = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
    const isOverBudget = p.budget > 0 && pExpenses > p.budget * 0.85;
    const isOverdue = p.end_date && p.end_date < TODAY;
    const hasBlockers = tasks.filter(t => t.project_id === p.id && t.status === "blocked").length > 0;
    return isOverBudget || isOverdue || hasBlockers;
  });

  // --- Overloaded team members (>40h in last 2 weeks) ---
  const twoWeeksAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const overloadedMembers = employees.filter(u => {
    const hours = timesheets.filter(ts => ts.employee_email === u.email && ts.date >= twoWeeksAgo && ts.status === "approved")
      .reduce((s, ts) => s + (ts.hours || 0), 0);
    return hours > 80;
  });

  // --- Risk score ---
  const riskScore = Math.min(100, (projectsAtRisk.length * 15) + (overdueTasks.length * 5) + (blockedTasks.length * 10) + (budgetUtilization > 90 ? 20 : 0));

  // --- 30-day trend ---
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    return {
      day: format(d, "M/d"),
      expenses: expenses.filter(e => e.date === dateStr && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0),
      hours: timesheets.filter(t => t.date === dateStr && t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0),
    };
  });

  // --- Forecasting: next 90 days projection ---
  const forecastData = Array.from({ length: 13 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    if (i < 3) {
      // past 3 months actual
      d.setMonth(d.getMonth() - (2 - i));
      const month = format(d, "yyyy-MM");
      const actual = expenses.filter(e => e.status === "approved" && e.date?.startsWith(month)).reduce((s, e) => s + (e.amount || 0), 0);
      return { label: format(d, "MMM yy"), actual, forecast: null, type: "actual" };
    } else {
      // future months forecast
      d.setMonth(d.getMonth() + (i - 2));
      return { label: format(d, "MMM yy"), actual: null, forecast: monthlyBurn || 0, type: "forecast" };
    }
  });

  // --- Top performers ---
  const topPerformers = employees
    .map(u => ({
      ...u,
      tasksCompleted: tasks.filter(t => t.assigned_to?.includes(u.email) && t.status === "completed").length,
      hoursLogged: timesheets.filter(ts => ts.employee_email === u.email && ts.status === "approved").reduce((s, ts) => s + (ts.hours || 0), 0),
    }))
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 5);

  // --- Project health ---
  const projectHealth = activeProjects.map(p => {
    const pTasks = tasks.filter(t => t.project_id === p.id);
    const done = pTasks.filter(t => t.status === "completed").length;
    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
    const pExpenses = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
    const daysLeft = p.end_date ? differenceInDays(parseLocalDate(p.end_date), new Date()) : null;
    const isAtRisk = (p.budget > 0 && pExpenses > p.budget * 0.85) || (p.end_date && p.end_date < TODAY);
    return { ...p, pct, pTasks: pTasks.length, doneCount: done, pExpenses, daysLeft, isAtRisk };
  }).slice(0, 6);

  // --- Task status ---
  const taskStatusData = ["todo", "in_progress", "in_review", "completed", "blocked"].map(s => ({
    name: s.replace("_", " "), value: tasks.filter(t => t.status === s).length
  })).filter(d => d.value > 0);

  // --- Expense category ---
  const expenseCategoryData = Object.entries(
    expenses.filter(e => e.status === "approved").reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tabs = isAdmin
    ? [
        { id: "overview", label: "Overview" },
        { id: "risk", label: "Risk & Alerts" },
        { id: "profitability", label: "Profitability" },
        { id: "forecast", label: "Forecast" },
        { id: "team", label: "Team" },
      ]
    : [{ id: "overview", label: "Overview" }, { id: "projects", label: "Projects" }];

  const RiskGauge = ({ score }) => {
    const color = score > 66 ? "#ef4444" : score > 33 ? "#f97316" : "#22c55e";
    const label = score > 66 ? "High Risk" : score > 33 ? "Moderate" : "Healthy";
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 120 120" className="transform -rotate-90 w-full h-full">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="14" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="14"
              strokeDasharray={`${(score / 100) * 314} 314`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold" style={{ color }}>{score}</p>
            <p className="text-xs text-gray-400">/ 100</p>
          </div>
        </div>
        <p className="text-xs font-semibold mt-1" style={{ color }}>{label}</p>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">
            {isAdmin ? "Executive Dashboard" : "My Dashboard"}
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === t.id ? "bg-white text-[#210F37] shadow-sm" : "text-gray-500 hover:text-[#210F37]"
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ========== OVERVIEW ========== */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Top KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: "Active Projects", value: activeProjects.length, sub: `${projects.length} total`, icon: FolderKanban, color: "bg-[#4F1C51]", link: "Projects" },
              { title: "Task Completion", value: `${taskCompletionRate}%`, sub: `${completedTasks}/${tasks.length} done`, icon: CheckSquare, color: "bg-[#A55B4B]", link: "Tasks" },
              { title: "Net Profit", value: `$${netProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}`, sub: `${profitMargin}% margin`, icon: TrendingUp, color: netProfit >= 0 ? "bg-green-600" : "bg-red-500", link: "ProjectFinance" },
              isAdmin
                ? { title: "Team Utilization", value: `${utilizationRate}%`, sub: `${employees.length} employees`, icon: Gauge, color: "bg-[#210F37]", link: "Employees" }
                : { title: "Hours This Week", value: `${thisWeekHours}h`, sub: `${approvedHours}h all time`, icon: Clock, color: "bg-[#210F37]", link: "Timesheets" },
            ].map((card, i) => (
              <Card key={i} className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{card.title}</p>
                      <p className="text-2xl font-bold text-[#210F37] mt-1">{card.value}</p>
                      {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
                    </div>
                    <div className={`p-2.5 rounded-xl ${card.color}`}>
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <Link to={createPageUrl(card.link)}>
                    <Button variant="ghost" size="sm" className="mt-3 text-[#A55B4B] p-0 h-auto text-xs">
                      View all <ArrowUpRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Secondary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">On Track</p>
                  <Target className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">{activeProjects.length - projectsAtRisk.length}</p>
                <p className="text-xs text-gray-400 mt-1">projects healthy</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Overdue</p>
                  <TimerOff className="w-4 h-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-orange-500">{overdueTasks.length}</p>
                <p className="text-xs text-gray-400 mt-1">tasks need attention</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Budget Used</p>
                  <DollarSign className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-600">{budgetUtilization}%</p>
                <Progress value={budgetUtilization} className="h-1 mt-2" />
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Daily Burn</p>
                  <Flame className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-600">${dailyBurnRate.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">per day (30d avg)</p>
              </CardContent>
            </Card>
          </div>

          {/* Activity + Task Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
                  <ActivityIcon className="w-4 h-4 text-[#4F1C51]" /> 30-Day Activity Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={last30Days} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F1C51" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4F1C51" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DCA06D" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#DCA06D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={6} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="hours" stroke="#4F1C51" strokeWidth={2} fill="url(#colorHours)" name="Hours" />
                    <Area type="monotone" dataKey="expenses" stroke="#DCA06D" strokeWidth={2} fill="url(#colorExp)" name="Expenses ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#210F37]">Task Status</CardTitle>
              </CardHeader>
              <CardContent>
                {taskStatusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                          {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {taskStatusData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="capitalize text-gray-600">{d.name}</span>
                          </div>
                          <span className="font-medium text-[#210F37]">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-gray-400 text-sm text-center py-8">No tasks yet</p>}
              </CardContent>
            </Card>
          </div>

          {/* Pending approvals */}
          {(pendingExpenses.length > 0 || pendingTimesheets.length > 0) && (
            <Card className="border-0 shadow-sm border-l-4 border-l-[#A55B4B]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-[#A55B4B]" />
                  <span className="font-semibold text-[#210F37] text-sm">Pending Approvals</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {pendingExpenses.length > 0 && (
                    <Link to={createPageUrl("Expenses")}>
                      <Button size="sm" className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
                        {pendingExpenses.length} Expense{pendingExpenses.length > 1 ? "s" : ""} to Review
                      </Button>
                    </Link>
                  )}
                  {pendingTimesheets.length > 0 && (
                    <Link to={createPageUrl("Timesheets")}>
                      <Button size="sm" className="bg-[#4F1C51] hover:bg-[#210F37] text-white">
                        {pendingTimesheets.length} Timesheet{pendingTimesheets.length > 1 ? "s" : ""} to Review
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== RISK & ALERTS ========== */}
      {activeTab === "risk" && isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm flex flex-col items-center justify-center p-6">
              <p className="text-sm font-semibold text-[#210F37] mb-4">Overall Risk Score</p>
              <RiskGauge score={riskScore} />
              <p className="text-xs text-gray-400 mt-3 text-center">Based on overdue tasks, blockers, at-risk projects, and budget burn</p>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                {[
                  { label: "Projects at Risk", value: projectsAtRisk.length, color: "text-red-500", icon: AlertTriangle },
                  { label: "Overloaded Team Members", value: overloadedMembers.length, color: "text-orange-500", icon: Users },
                  { label: "Overdue Tasks", value: overdueTasks.length, color: "text-orange-500", icon: TimerOff },
                  { label: "Blocked Tasks", value: blockedTasks.length, color: "text-red-500", icon: XCircle },
                  { label: "Budget Utilization", value: `${budgetUtilization}%`, color: budgetUtilization > 85 ? "text-red-500" : "text-green-600", icon: DollarSign },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <r.icon className={`w-4 h-4 ${r.color}`} />
                    </div>
                    <span className="text-sm text-gray-600 flex-1">{r.label}</span>
                    <span className={`font-bold text-sm ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#210F37]">Risk Breakdown</CardTitle></CardHeader>
              <CardContent>
                {projectsAtRisk.length > 0 ? (
                  <div className="space-y-2">
                    {projectsAtRisk.map(p => {
                      const pExpenses = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
                      return (
                        <div key={p.id} className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="font-semibold text-[#210F37] text-sm">{p.name}</p>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {p.end_date && p.end_date < TODAY && <Badge className="text-xs bg-red-100 text-red-700">Overdue</Badge>}
                            {p.budget > 0 && pExpenses > p.budget * 0.85 && <Badge className="text-xs bg-orange-100 text-orange-700">Budget Critical</Badge>}
                            {tasks.filter(t => t.project_id === p.id && t.status === "blocked").length > 0 && <Badge className="text-xs bg-yellow-100 text-yellow-700">Has Blockers</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-green-600">
                    <CheckCircle2 className="w-10 h-10 mb-2" />
                    <p className="text-sm font-semibold">All projects healthy!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Overloaded members */}
          {overloadedMembers.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-orange-600 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Overloaded Team Members ({overloadedMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overloadedMembers.map(u => {
                  const hours = timesheets.filter(ts => ts.employee_email === u.email && ts.date >= twoWeeksAgo && ts.status === "approved").reduce((s, ts) => s + (ts.hours || 0), 0);
                  return (
                    <div key={u.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#210F37]">{u.full_name || u.email}</span>
                      <Badge className="bg-orange-100 text-orange-700">{hours}h in 2 weeks</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Overdue tasks */}
          {overdueTasks.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
                  <TimerOff className="w-4 h-4 text-orange-500" /> Overdue Tasks ({overdueTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {overdueTasks.slice(0, 10).map(t => (
                  <div key={t.id} className="flex items-start justify-between gap-2 text-sm py-1 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#210F37] truncate">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.project_name || "No project"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className="text-xs bg-red-100 text-red-700">{Math.abs(differenceInDays(parseLocalDate(t.due_date), new Date()))}d overdue</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== PROFITABILITY ========== */}
      {activeTab === "profitability" && isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue", value: `$${totalRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}`, color: "text-[#210F37]", bg: "from-slate-50" },
              { label: "Total Cost", value: `$${totalCost.toLocaleString(undefined, {maximumFractionDigits:0})}`, color: "text-red-500", bg: "from-red-50" },
              { label: "Net Profit", value: `$${netProfit.toLocaleString(undefined, {maximumFractionDigits:0})}`, color: netProfit >= 0 ? "text-green-600" : "text-red-500", bg: "from-green-50" },
              { label: "Profit Margin", value: `${profitMargin}%`, color: profitMargin >= 20 ? "text-green-600" : profitMargin >= 0 ? "text-orange-500" : "text-red-500", bg: "from-purple-50" },
            ].map((c, i) => (
              <Card key={i} className={`border-0 shadow-sm bg-gradient-to-br ${c.bg} to-white`}>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{c.label}</p>
                  <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cost vs Revenue per project */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#210F37]">Cost vs Revenue per Project</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activeProjects.slice(0, 8).map(p => {
                  const spent = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
                  return { name: p.name.slice(0, 12), Revenue: p.budget || 0, Cost: Math.round(spent) };
                })} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => `$${v.toLocaleString()}`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Revenue" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="Cost" fill="#A55B4B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Budget utilization per project */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#210F37]">Budget Utilization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.filter(p => p.budget > 0).map(p => {
                const spent = expenses.filter(e => e.project_id === p.id && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
                const pct = Math.min(100, Math.round((spent / p.budget) * 100));
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#210F37] truncate max-w-[50%]">{p.name}</span>
                      <span className={pct > 90 ? "text-red-500 font-semibold" : pct > 70 ? "text-orange-500 font-semibold" : "text-green-600 font-semibold"}>
                        {pct}% · ${spent.toLocaleString()} / ${p.budget.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
              {projects.filter(p => p.budget > 0).length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">No project budgets set</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== FORECAST ========== */}
      {activeTab === "forecast" && isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Daily Burn Rate", value: `$${dailyBurnRate.toLocaleString()}/day`, sub: "30-day average" },
              { label: "Monthly Burn", value: `$${(dailyBurnRate * 30).toLocaleString()}/mo`, sub: "projected" },
              { label: "Budget Runway", value: monthsRemaining !== null ? `~${monthsRemaining} months` : "∞", sub: `$${remainingBudget.toLocaleString()} remaining` },
            ].map((c, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{c.label}</p>
                  <p className="text-xl font-bold text-[#210F37]">{c.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#210F37]">90-Day Spend Forecast</CardTitle>
              <p className="text-xs text-gray-400">Past 3 months actual spend + next 3 months projected at current burn rate</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={forecastData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => `$${(v || 0).toLocaleString()}`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="actual" fill="#4F1C51" radius={[4,4,0,0]} name="Actual Spend" />
                  <Bar dataKey="forecast" fill="#DCA06D" radius={[4,4,0,0]} name="Forecasted Spend" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project timeline forecasts */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#210F37]">Active Project Timelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectHealth.map(p => (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#210F37]">{p.name}</span>
                    <div className="flex items-center gap-2">
                      {p.daysLeft !== null && (
                        <span className={`font-medium ${p.daysLeft < 0 ? "text-red-500" : p.daysLeft < 14 ? "text-orange-500" : "text-gray-500"}`}>
                          {p.daysLeft < 0 ? `${Math.abs(p.daysLeft)}d overdue` : `${p.daysLeft}d left`}
                        </span>
                      )}
                      {p.isAtRisk && <Badge className="text-xs bg-red-100 text-red-700">At Risk</Badge>}
                    </div>
                  </div>
                  <Progress value={p.pct} className="h-2" />
                  <p className="text-xs text-gray-400">{p.doneCount}/{p.pTasks} tasks · {p.pct}% complete</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== TEAM ========== */}
      {activeTab === "team" && isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Employees", value: employees.length, color: "text-[#210F37]" },
              { label: "Utilization Rate", value: `${utilizationRate}%`, color: utilizationRate < 50 ? "text-orange-500" : "text-green-600" },
              { label: "Approved Hours", value: `${approvedHours}h`, color: "text-[#4F1C51]" },
              { label: "Overloaded", value: overloadedMembers.length, color: overloadedMembers.length > 0 ? "text-red-500" : "text-green-600" },
            ].map((c, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase font-medium tracking-wide mb-1">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#DCA06D]" /> Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topPerformers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No employee data yet</p>
              ) : (
                <div className="space-y-3">
                  {topPerformers.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-[#DCA06D]" : "text-gray-400"}`}>#{i + 1}</span>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-[#4F1C51] text-white text-xs">{u.full_name?.[0] || u.email?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#210F37] truncate">{u.full_name || u.email}</p>
                        <Progress value={topPerformers[0].tasksCompleted > 0 ? Math.round((u.tasksCompleted / topPerformers[0].tasksCompleted) * 100) : 0} className="h-1.5 mt-1" />
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-[#210F37]">{u.tasksCompleted} tasks</p>
                        <p className="text-xs text-gray-400">{u.hoursLogged}h</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#4F1C51]" /> Team Workload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={employees.map(u => ({
                    name: u.full_name?.split(" ")[0] || u.email?.split("@")[0],
                    active: tasks.filter(t => t.assigned_to?.includes(u.email) && !["completed", "blocked"].includes(t.status)).length,
                    completed: tasks.filter(t => t.assigned_to?.includes(u.email) && t.status === "completed").length,
                  })).filter(u => u.active + u.completed > 0).slice(0, 8)}
                  margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="active" fill="#4F1C51" radius={[4,4,0,0]} name="Active" stackId="a" />
                  <Bar dataKey="completed" fill="#A55B4B" radius={[4,4,0,0]} name="Completed" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employee overview tab */}
      {activeTab === "projects" && !isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectHealth.map(p => (
              <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-[#210F37] text-sm">{p.name}</h4>
                      {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                    </div>
                    {p.isAtRisk
                      ? <Badge className="text-xs bg-red-100 text-red-700">At Risk</Badge>
                      : <Badge className="text-xs bg-green-100 text-green-700">Healthy</Badge>}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Task Progress</span><span>{p.pct}%</span>
                    </div>
                    <Progress value={p.pct} className="h-2" />
                    <p className="text-xs text-gray-400 mt-0.5">{p.doneCount}/{p.pTasks} tasks</p>
                  </div>
                  {p.daysLeft !== null && (
                    <p className={`text-xs font-medium mt-2 ${p.daysLeft < 0 ? "text-red-500" : p.daysLeft < 7 ? "text-orange-500" : "text-gray-500"}`}>
                      {p.daysLeft < 0 ? `${Math.abs(p.daysLeft)} days overdue` : `${p.daysLeft} days remaining`}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}