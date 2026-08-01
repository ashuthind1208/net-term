import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  FolderKanban, CheckSquare, Users, Calendar, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  format, addDays, startOfWeek, differenceInDays,
  isToday, isWeekend, addWeeks, subWeeks, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval, parseISO
} from "date-fns";

const STATUS_COLORS = {
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  in_review: "#f59e0b",
  completed: "#22c55e",
  blocked: "#ef4444",
  planning: "#94a3b8",
  active: "#3b82f6",
  on_hold: "#f59e0b",
  cancelled: "#ef4444",
};

const PRIORITY_BORDER = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f97316",
  critical: "#ef4444",
};

export default function GanttScheduler() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("week"); // week | month
  const [viewStart, setViewStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filterProject, setFilterProject] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [tab, setTab] = useState("tasks"); // tasks | projects
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const DAYS = viewMode === "week" ? 14 : differenceInDays(endOfMonth(viewStart), startOfMonth(viewStart)) + 1;
  const days = Array.from({ length: DAYS }, (_, i) => addDays(viewMode === "week" ? viewStart : startOfMonth(viewStart), i));
  const COL_W = viewMode === "week" ? 48 : 28;
  const ROW_H = 36;
  const LABEL_W = 220;

  useEffect(() => {
    Promise.allSettled([
      base44.entities.Project.list(),
      base44.entities.Task.list("-due_date"),
      base44.entities.User.list(),
    ]).then(([pR, tR, uR]) => {
      setProjects(pR.status === "fulfilled" ? pR.value : []);
      setTasks(tR.status === "fulfilled" ? tR.value : []);
      setUsers(uR.status === "fulfilled" ? uR.value : []);
      setLoading(false);
    });
  }, []);

  const navigate = (dir) => {
    if (viewMode === "week") setViewStart(d => dir > 0 ? addWeeks(d, 2) : subWeeks(d, 2));
    else setViewStart(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const goToday = () => {
    setViewStart(viewMode === "week" ? startOfWeek(new Date(), { weekStartsOn: 1 }) : startOfMonth(new Date()));
  };

  const getBar = (startDate, endDate) => {
    if (!startDate && !endDate) return null;
    const rangeStart = viewMode === "week" ? viewStart : startOfMonth(viewStart);
    const rangeEnd = days[days.length - 1];

    const s = startDate ? parseISO(startDate) : parseISO(endDate);
    const e = endDate ? parseISO(endDate) : parseISO(startDate);

    if (e < rangeStart || s > rangeEnd) return null;

    const clampedS = s < rangeStart ? rangeStart : s;
    const clampedE = e > rangeEnd ? rangeEnd : e;

    const left = differenceInDays(clampedS, rangeStart) * COL_W;
    const width = Math.max((differenceInDays(clampedE, clampedS) + 1) * COL_W, COL_W);
    return { left, width };
  };

  // Filter tasks
  const visibleTasks = tasks.filter(t => {
    if (filterProject !== "all" && t.project_id !== filterProject) return false;
    if (filterAssignee !== "all" && !t.assigned_to?.includes(filterAssignee)) return false;
    return t.start_date || t.due_date;
  });

  // Filter projects
  const visibleProjects = projects.filter(p => {
    if (filterProject !== "all" && p.id !== filterProject) return false;
    return p.start_date || p.end_date;
  });

  const getUser = (email) => users.find(u => u.email === email);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const GanttGrid = ({ rows, renderLabel, renderBar }) => (
    <div className="overflow-auto border rounded-xl bg-white shadow-sm" style={{ maxHeight: "65vh" }}>
      <div style={{ minWidth: LABEL_W + days.length * COL_W }}>
        {/* Header */}
        <div className="flex sticky top-0 z-10 bg-[#210F37] text-white">
          <div className="flex-shrink-0 flex items-center px-3 text-xs font-semibold border-r border-white/10" style={{ width: LABEL_W, height: 40 }}>
            {tab === "tasks" ? "Task" : "Project"}
          </div>
          {days.map((d, i) => (
            <div
              key={i}
              className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-white/10 text-xs ${isToday(d) ? "bg-[#A55B4B]" : isWeekend(d) ? "bg-[#2d1447]" : ""}`}
              style={{ width: COL_W, height: 40 }}
            >
              {viewMode === "week" ? (
                <>
                  <span className="font-medium">{format(d, "EEE")}</span>
                  <span className="text-white/60">{format(d, "d")}</span>
                </>
              ) : (
                <span>{format(d, "d")}</span>
              )}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No items with dates in this range
          </div>
        ) : rows.map((row, ri) => {
          const bar = renderBar(row);
          return (
            <div
              key={row.id}
              className={`flex border-b border-gray-100 hover:bg-gray-50 transition-colors ${ri % 2 === 0 ? "" : "bg-gray-50/50"}`}
              style={{ height: ROW_H }}
            >
              {/* Label */}
              <div className="flex-shrink-0 flex items-center gap-2 px-3 border-r border-gray-200 overflow-hidden" style={{ width: LABEL_W }}>
                {renderLabel(row)}
              </div>

              {/* Grid cells + bar */}
              <div className="relative flex" style={{ flex: 1 }}>
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={`flex-shrink-0 border-r border-gray-100 ${isToday(d) ? "bg-blue-50" : isWeekend(d) ? "bg-gray-100/60" : ""}`}
                    style={{ width: COL_W, height: ROW_H }}
                  />
                ))}
                {bar && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-md cursor-pointer flex items-center px-2 text-white text-xs font-medium overflow-hidden shadow-sm hover:brightness-110 transition-all"
                    style={{
                      left: bar.left,
                      width: bar.width,
                      height: ROW_H - 10,
                      background: STATUS_COLORS[row.status] || "#A55B4B",
                      borderLeft: `3px solid ${PRIORITY_BORDER[row.priority] || "#A55B4B"}`,
                      minWidth: 8,
                    }}
                    onMouseEnter={(e) => setTooltip({ row, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span className="truncate">{bar.width > 60 ? row.title || row.name : ""}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#A55B4B]" /> Gantt / Resource Scheduler
          </h2>
          <p className="text-gray-500 text-sm mt-1">Visual timeline of all projects and tasks</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tab */}
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setTab("tasks")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${tab === "tasks" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-600"}`}>
            <CheckSquare className="w-3.5 h-3.5" /> Tasks
          </button>
          <button onClick={() => setTab("projects")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${tab === "projects" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-600"}`}>
            <FolderKanban className="w-3.5 h-3.5" /> Projects
          </button>
        </div>

        {/* View mode */}
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("week")} className={`px-3 py-1.5 text-sm ${viewMode === "week" ? "bg-[#4F1C51] text-white" : "bg-white text-gray-600"}`}>2 Weeks</button>
          <button onClick={() => setViewMode("month")} className={`px-3 py-1.5 text-sm ${viewMode === "month" ? "bg-[#4F1C51] text-white" : "bg-white text-gray-600"}`}>Month</button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
          <button onClick={() => navigate(-1)} className="px-2 py-1.5 bg-white hover:bg-gray-50 text-gray-600 border-r">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600 bg-white min-w-32 text-center">
            {viewMode === "week"
              ? `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`
              : format(viewStart, "MMMM yyyy")}
          </span>
          <button onClick={() => navigate(1)} className="px-2 py-1.5 bg-white hover:bg-gray-50 text-gray-600 border-l">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>

        {/* Filters */}
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {tab === "tasks" && (
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Assignees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {users.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).slice(0, tab === "tasks" ? 5 : 5).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-gray-500 capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-4 text-gray-400">
          <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded-sm" /> Today
          <div className="w-3 h-3 bg-gray-200 rounded-sm ml-2" /> Weekend
        </div>
      </div>

      {/* Gantt Chart */}
      {tab === "tasks" ? (
        <GanttGrid
          rows={visibleTasks}
          renderLabel={(t) => (
            <>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[t.status] }} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#210F37] truncate">{t.title}</p>
                <p className="text-xs text-gray-400 truncate">{t.project_name}</p>
              </div>
              <div className="ml-auto flex -space-x-1 flex-shrink-0">
                {(t.assigned_to || []).slice(0, 2).map((email, i) => {
                  const u = getUser(email);
                  return (
                    <Avatar key={i} className="w-5 h-5 border border-white">
                      <AvatarImage src={u?.photo_url} />
                      <AvatarFallback className="text-white text-xs bg-[#A55B4B]" style={{ fontSize: 8 }}>{email[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
            </>
          )}
          renderBar={(t) => getBar(t.start_date, t.due_date)}
        />
      ) : (
        <GanttGrid
          rows={visibleProjects}
          renderLabel={(p) => (
            <>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || STATUS_COLORS[p.status] || "#A55B4B" }} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#210F37] truncate">{p.name}</p>
                <p className="text-xs text-gray-400 truncate">{p.client_name || p.status}</p>
              </div>
              <Badge className={`ml-auto text-xs flex-shrink-0 ${
                p.status === "active" ? "bg-blue-100 text-blue-700" :
                p.status === "completed" ? "bg-green-100 text-green-700" :
                "bg-gray-100 text-gray-600"
              }`}>{p.status}</Badge>
            </>
          )}
          renderBar={(p) => getBar(p.start_date, p.end_date)}
        />
      )}

      {/* Resource view — who is working on what this period */}
      {tab === "tasks" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#210F37] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4F1C51]" /> Resource Load (active tasks per person)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.filter(u => tasks.some(t => t.assigned_to?.includes(u.email) && t.status !== "completed")).map(u => {
                const myTasks = tasks.filter(t => t.assigned_to?.includes(u.email) && t.status !== "completed");
                const byStatus = ["in_progress", "todo", "in_review", "blocked"].reduce((acc, s) => {
                  acc[s] = myTasks.filter(t => t.status === s).length;
                  return acc;
                }, {});
                return (
                  <div key={u.id} className="flex items-center gap-3">
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarImage src={u.photo_url} />
                      <AvatarFallback className="bg-[#A55B4B] text-white text-xs">{(u.full_name || u.email)[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="w-32 min-w-0">
                      <p className="text-xs font-medium text-[#210F37] truncate">{u.full_name || u.email}</p>
                      <p className="text-xs text-gray-400">{myTasks.length} active</p>
                    </div>
                    <div className="flex-1 flex gap-1 flex-wrap">
                      {Object.entries(byStatus).map(([s, cnt]) => cnt > 0 && (
                        <div key={s} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[s] + "20", color: STATUS_COLORS[s] }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                          {cnt} {s.replace("_", " ")}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60, minWidth: 180 }}
        >
          <p className="font-semibold text-[#210F37]">{tooltip.row.title || tooltip.row.name}</p>
          {tooltip.row.project_name && <p className="text-gray-400 mt-0.5">{tooltip.row.project_name}</p>}
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {tooltip.row.status && <Badge className="text-xs" style={{ background: STATUS_COLORS[tooltip.row.status] + "20", color: STATUS_COLORS[tooltip.row.status] }}>{tooltip.row.status}</Badge>}
            {tooltip.row.priority && <Badge className="text-xs bg-gray-100 text-gray-600">{tooltip.row.priority}</Badge>}
          </div>
          {(tooltip.row.start_date || tooltip.row.due_date) && (
            <p className="text-gray-500 mt-1.5">
              {tooltip.row.start_date && `Start: ${tooltip.row.start_date}`}
              {tooltip.row.start_date && tooltip.row.due_date && " · "}
              {(tooltip.row.due_date || tooltip.row.end_date) && `End: ${tooltip.row.due_date || tooltip.row.end_date}`}
            </p>
          )}
          {tooltip.row.assigned_to?.length > 0 && (
            <p className="text-gray-500 mt-1">Assigned: {tooltip.row.assigned_to.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}