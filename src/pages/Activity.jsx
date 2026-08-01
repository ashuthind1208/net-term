import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Bell, CheckCircle2, XCircle, Clock, Receipt, CheckSquare,
  FolderKanban, TrendingUp, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

function getEventIcon(type) {
  if (type === "expense_approved") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (type === "expense_rejected") return <XCircle className="w-4 h-4 text-red-500" />;
  if (type === "expense_pending") return <Receipt className="w-4 h-4 text-orange-500" />;
  if (type === "timesheet_approved") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (type === "timesheet_rejected") return <XCircle className="w-4 h-4 text-red-500" />;
  if (type === "timesheet_pending") return <Clock className="w-4 h-4 text-blue-500" />;
  if (type === "task_completed") return <CheckSquare className="w-4 h-4 text-green-600" />;
  if (type === "task_created") return <CheckSquare className="w-4 h-4 text-[#A55B4B]" />;
  if (type === "project_created") return <FolderKanban className="w-4 h-4 text-[#4F1C51]" />;
  return <Bell className="w-4 h-4 text-gray-400" />;
}

function getEventColor(type) {
  if (type.includes("approved")) return "bg-green-50 border-green-100";
  if (type.includes("rejected")) return "bg-red-50 border-red-100";
  if (type.includes("pending")) return "bg-orange-50 border-orange-100";
  if (type.includes("completed")) return "bg-blue-50 border-blue-100";
  return "bg-gray-50 border-gray-100";
}

export default function Activity() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async me => {
      setCurrentUser(me);
      setIsAdmin(me?.role === "admin");
      const [eRes, tsRes, tRes, pRes] = await Promise.allSettled([
        base44.entities.Expense.list("-updated_date", 100),
        base44.entities.Timesheet.list("-updated_date", 100),
        base44.entities.Task.list("-updated_date", 100),
        base44.entities.Project.list("-created_date", 50),
      ]);

      const expenses = eRes.status === "fulfilled" ? eRes.value : [];
      const timesheets = tsRes.status === "fulfilled" ? tsRes.value : [];
      const tasks = tRes.status === "fulfilled" ? tRes.value : [];
      const projects = pRes.status === "fulfilled" ? pRes.value : [];

      const isAdminUser = me?.role === "admin";
      const myEmail = me?.email;

      const allEvents = [
        ...expenses
          .filter(e => isAdminUser || e.submitted_by === myEmail)
          .map(e => ({
            id: `exp-${e.id}`,
            type: `expense_${e.status}`,
            title: e.status === "pending" ? `Expense submitted: ${e.title}` :
              e.status === "approved" ? `Expense approved: ${e.title}` :
              `Expense rejected: ${e.title}`,
            subtitle: `$${Number(e.amount).toFixed(2)} • ${e.project_name || ""}`,
            actor: e.status === "pending" ? (e.submitted_by_name || e.submitted_by) : (e.reviewed_by || ""),
            date: e.reviewed_at || e.updated_date || e.created_date,
            category: "expense",
          })),
        ...timesheets
          .filter(t => isAdminUser || t.employee_email === myEmail)
          .map(t => ({
            id: `ts-${t.id}`,
            type: `timesheet_${t.status}`,
            title: t.status === "pending" ? `Timesheet logged: ${t.hours}h on ${t.project_name}` :
              t.status === "approved" ? `Timesheet approved: ${t.project_name}` :
              `Timesheet rejected: ${t.project_name}`,
            subtitle: `${t.hours}h • ${t.date} • ${t.employee_name || t.employee_email}`,
            actor: t.status === "pending" ? (t.employee_name || t.employee_email) : (t.reviewed_by || ""),
            date: t.reviewed_at || t.updated_date || t.created_date,
            category: "timesheet",
          })),
        ...tasks
          .filter(t => isAdminUser || t.assigned_to?.includes(myEmail))
          .filter(t => t.status === "completed" || t.created_date)
          .map(t => ({
            id: `task-${t.id}`,
            type: t.status === "completed" ? "task_completed" : "task_created",
            title: t.status === "completed" ? `Task completed: ${t.title}` : `Task created: ${t.title}`,
            subtitle: t.project_name || "",
            actor: t.created_by || "",
            date: t.completed_at || t.updated_date || t.created_date,
            category: "task",
          })),
        ...(isAdminUser ? projects.map(p => ({
          id: `proj-${p.id}`,
          type: "project_created",
          title: `Project created: ${p.name}`,
          subtitle: `Status: ${p.status}`,
          actor: p.created_by || "",
          date: p.created_date,
          category: "project",
        })) : []),
      ];

      allEvents.sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
      setEvents(allEvents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const FILTER_OPTIONS = [
    { value: "all", label: "All Activity" },
    { value: "expense", label: "Expenses" },
    { value: "timesheet", label: "Timesheets" },
    { value: "task", label: "Tasks" },
    { value: "project", label: "Projects" },
  ];

  const filtered = filter === "all" ? events : events.filter(e => e.category === filter);

  // Group by date
  const grouped = filtered.reduce((acc, ev) => {
    const day = ev.date ? format(parseLocalDate(ev.date), "yyyy-MM-dd") : "unknown";
    if (!acc[day]) acc[day] = [];
    acc[day].push(ev);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const summary = {
    expenses: events.filter(e => e.category === "expense").length,
    timesheets: events.filter(e => e.category === "timesheet").length,
    tasks: events.filter(e => e.category === "task").length,
    pending: events.filter(e => e.type.includes("pending")).length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#210F37]">Activity Feed</h2>
        <p className="text-gray-500 text-sm">Recent activity across projects, tasks, expenses and timesheets</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Expense Events", value: summary.expenses, color: "bg-orange-100 text-orange-700" },
          { label: "Timesheet Events", value: summary.timesheets, color: "bg-blue-100 text-blue-700" },
          { label: "Task Events", value: summary.tasks, color: "bg-[#F5F0FF] text-[#4F1C51]" },
          { label: "Pending Actions", value: summary.pending, color: "bg-red-100 text-red-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-[#210F37] mt-1">{s.value}</p>
              <Badge className={`mt-2 text-xs ${s.color}`}>{s.value > 0 ? "Active" : "None"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-400">{filtered.length} events</span>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No activity to show</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDays.map(day => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                  {day === format(new Date(), "yyyy-MM-dd") ? "Today" :
                   day === format(new Date(Date.now() - 86400000), "yyyy-MM-dd") ? "Yesterday" :
                   format(parseLocalDate(day), "MMMM d, yyyy")}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="space-y-2">
                {grouped[day].map(ev => (
                  <div key={ev.id} className={`flex items-start gap-3 p-3 rounded-xl border ${getEventColor(ev.type)}`}>
                    <div className="mt-0.5 p-1.5 rounded-full bg-white border border-gray-100 flex-shrink-0">
                      {getEventIcon(ev.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#210F37]">{ev.title}</p>
                      {ev.subtitle && <p className="text-xs text-gray-500 mt-0.5">{ev.subtitle}</p>}
                      {ev.actor && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Avatar className="w-4 h-4">
                            <AvatarFallback className="bg-[#4F1C51] text-white text-xs">{ev.actor[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-400">{ev.actor}</span>
                        </div>
                      )}
                    </div>
                    {ev.date && (
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                        {formatDistanceToNow(parseLocalDate(ev.date), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}