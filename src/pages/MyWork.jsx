import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  CheckSquare, Clock, Receipt, Circle, AlertCircle,
  CheckCircle2, Plus, ArrowUpRight, Calendar, Target,
  TrendingUp, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, isToday, isTomorrow, isPast } from "date-fns";

const STATUS_CONFIG = {
  todo: { label: "To Do", color: "bg-gray-100 text-gray-600", icon: Circle },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  in_review: { label: "In Review", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export default function MyWork() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogTime, setShowLogTime] = useState(false);
  const [logForm, setLogForm] = useState({ project_id: "", task_id: "", date: format(new Date(), "yyyy-MM-dd"), hours: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async me => {
      setUser(me);
      const [tR, tsR, eR, pR] = await Promise.allSettled([
        base44.entities.Task.list("-due_date"),
        base44.entities.Timesheet.list("-date"),
        base44.entities.Expense.list("-date"),
        base44.entities.Project.list(),
      ]);
      const allTasks = tR.status === "fulfilled" ? tR.value : [];
      const allTS = tsR.status === "fulfilled" ? tsR.value : [];
      const allExp = eR.status === "fulfilled" ? eR.value : [];
      const allProj = pR.status === "fulfilled" ? pR.value : [];

      setTasks(allTasks.filter(t => t.assigned_to?.includes(me.email)));
      setTimesheets(allTS.filter(t => t.employee_email === me.email));
      setExpenses(allExp.filter(e => e.submitted_by === me.email));
      setProjects(allProj.filter(p => p.team_members?.includes(me.email) || p.manager_email === me.email));
      setLoading(false);
    });
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");

  const todayTasks = tasks.filter(t => t.due_date === today && t.status !== "completed");
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "completed");
  const upcomingTasks = tasks.filter(t => t.due_date && t.due_date > today && t.status !== "completed").slice(0, 5);
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");

  const weekHours = timesheets.filter(t => t.date >= weekStart && t.status !== "rejected")
    .reduce((s, t) => s + (t.hours || 0), 0);
  const pendingTimesheets = timesheets.filter(t => t.status === "pending").length;
  const pendingExpenses = expenses.filter(e => e.status === "pending").length;
  const completedThisWeek = tasks.filter(t => t.status === "completed" && t.completed_at?.startsWith(weekStart.substring(0, 7))).length;

  const myProjectTasks = (projectId) => tasks.filter(t => t.project_id === projectId);

  const handleLogTime = async () => {
    setSaving(true);
    const proj = projects.find(p => p.id === logForm.project_id);
    const task = tasks.find(t => t.id === logForm.task_id);
    await base44.entities.Timesheet.create({
      employee_email: user.email,
      employee_name: user.full_name || user.email,
      project_id: logForm.project_id,
      project_name: proj?.name || "",
      task_id: logForm.task_id || undefined,
      task_title: task?.title || undefined,
      date: logForm.date,
      hours: Number(logForm.hours),
      description: logForm.description,
      status: "pending",
    });
    setSaving(false);
    setShowLogTime(false);
    setLogForm({ project_id: "", task_id: "", date: format(new Date(), "yyyy-MM-dd"), hours: "", description: "" });
    // Refresh timesheets
    base44.entities.Timesheet.list("-date").then(all =>
      setTimesheets(all.filter(t => t.employee_email === user.email))
    );
  };

  const getDueLabel = (dueDate) => {
    if (!dueDate) return null;
    const d = new Date(dueDate + "T00:00:00");
    if (isToday(d)) return { text: "Due today", cls: "text-orange-500" };
    if (isTomorrow(d)) return { text: "Due tomorrow", cls: "text-yellow-600" };
    if (isPast(d)) return { text: "Overdue", cls: "text-red-600" };
    return { text: `Due ${format(d, "MMM d")}`, cls: "text-gray-400" };
  };

  const projectsForLog = projects;
  const tasksForLog = logForm.project_id ? tasks.filter(t => t.project_id === logForm.project_id && t.status !== "completed") : [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.full_name?.split(" ")[0] || "there"} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Button onClick={() => setShowLogTime(true)} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
          <Clock className="w-4 h-4 mr-1" /> Log Time
        </Button>
      </div>

      {/* Quick stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Hours This Week", value: `${weekHours}h`, icon: Clock, color: "bg-[#4F1C51]", sub: "logged" },
          { label: "Tasks In Progress", value: inProgressTasks.length, icon: Zap, color: "bg-[#A55B4B]", sub: "active" },
          { label: "Pending Timesheets", value: pendingTimesheets, icon: Target, color: "bg-orange-500", sub: "awaiting review" },
          { label: "Pending Expenses", value: pendingExpenses, icon: Receipt, color: "bg-[#DCA06D]", sub: "awaiting review" },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${color} flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-bold text-[#210F37] text-xl">{value}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueTasks.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500 bg-red-50">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-700">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""} need attention</span>
            </div>
            <Link to={createPageUrl("Tasks")}>
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">View Tasks <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's tasks */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#A55B4B]" /> Today's Tasks
            </CardTitle>
            <Link to={createPageUrl("Tasks")}>
              <Button variant="ghost" size="sm" className="text-[#A55B4B] h-6 p-0 text-xs">All tasks <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 && inProgressTasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No tasks due today — great job!</p>
            ) : (
              [...todayTasks, ...inProgressTasks.filter(t => t.due_date !== today)].slice(0, 6).map(t => {
                const StatusIcon = STATUS_CONFIG[t.status]?.icon || Circle;
                const due = getDueLabel(t.due_date);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <StatusIcon className={`w-4 h-4 flex-shrink-0 ${
                      t.status === "completed" ? "text-green-500" :
                      t.status === "in_progress" ? "text-blue-500" :
                      t.status === "blocked" ? "text-red-500" : "text-gray-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#210F37] truncate">{t.title}</p>
                      <p className="text-xs text-gray-400 truncate">{t.project_name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs ${STATUS_CONFIG[t.status]?.color}`}>{STATUS_CONFIG[t.status]?.label}</Badge>
                      {due && <span className={`text-xs ${due.cls}`}>{due.text}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* My Projects */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#4F1C51]" /> My Projects
            </CardTitle>
            <Link to={createPageUrl("Projects")}>
              <Button variant="ghost" size="sm" className="text-[#A55B4B] h-6 p-0 text-xs">All projects <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No projects assigned yet</p>}
            {projects.slice(0, 4).map(p => {
              const pTasks = myProjectTasks(p.id);
              const done = pTasks.filter(t => t.status === "completed").length;
              const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
              const myTasks = pTasks.filter(t => t.status !== "completed").length;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || "#A55B4B" }} />
                      <span className="text-sm font-medium text-[#210F37] truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {myTasks > 0 && <span className="text-xs text-[#A55B4B] font-medium">{myTasks} open</span>}
                      <Badge className={`text-xs ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-xs text-gray-400 w-8">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Timesheets */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#4F1C51]" /> Recent Timesheets
            </CardTitle>
            <Link to={createPageUrl("Timesheets")}>
              <Button variant="ghost" size="sm" className="text-[#A55B4B] h-6 p-0 text-xs">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {timesheets.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No timesheets yet</p>}
            {timesheets.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#210F37] truncate">{t.project_name}</p>
                  <p className="text-xs text-gray-400">{t.date} • {t.hours}h</p>
                </div>
                <Badge className={`text-xs flex-shrink-0 ${
                  t.status === "approved" ? "bg-green-100 text-green-700" :
                  t.status === "rejected" ? "bg-red-100 text-red-700" :
                  "bg-orange-100 text-orange-700"
                }`}>{t.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#A55B4B]" /> Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingTasks.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No upcoming deadlines</p>}
            {upcomingTasks.map(t => {
              const due = getDueLabel(t.due_date);
              return (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#210F37] truncate">{t.title}</p>
                    <p className="text-xs text-gray-400 truncate">{t.project_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs ${STATUS_CONFIG[t.status]?.color}`}>{STATUS_CONFIG[t.status]?.label}</Badge>
                    {due && <span className={`text-xs ${due.cls}`}>{due.text}</span>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Log Time Dialog */}
      <Dialog open={showLogTime} onOpenChange={setShowLogTime}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">Log Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Project *</Label>
              <Select value={logForm.project_id} onValueChange={v => setLogForm(f => ({ ...f, project_id: v, task_id: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projectsForLog.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {tasksForLog.length > 0 && (
              <div>
                <Label>Task (optional)</Label>
                <Select value={logForm.task_id} onValueChange={v => setLogForm(f => ({ ...f, task_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select task" /></SelectTrigger>
                  <SelectContent>
                    {tasksForLog.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <Input type="date" className="mt-1" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Hours *</Label>
                <Input type="number" step="0.5" min="0.5" max="24" className="mt-1" placeholder="e.g. 4" value={logForm.hours} onChange={e => setLogForm(f => ({ ...f, hours: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={3} placeholder="What did you work on?" value={logForm.description} onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogTime(false)}>Cancel</Button>
            <Button
              onClick={handleLogTime}
              disabled={!logForm.project_id || !logForm.hours || saving}
              className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white"
            >
              {saving ? "Saving…" : "Log Time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}