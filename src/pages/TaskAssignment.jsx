import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, Search, GripVertical, Clock, Receipt, AlertCircle, Circle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

const STATUS_CONFIG = {
  todo:        { label: "To Do",      color: "bg-gray-100 text-gray-600",    header: "bg-gray-200",   icon: Circle },
  in_progress: { label: "In Progress",color: "bg-blue-100 text-blue-700",    header: "bg-blue-100",   icon: Clock },
  blocked:     { label: "Blocked",    color: "bg-red-100 text-red-700",      header: "bg-red-100",    icon: AlertCircle },
  completed:   { label: "Completed",  color: "bg-green-100 text-green-700",  header: "bg-green-100",  icon: CheckCircle2 },
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

// RichTaskCard: shows task, project, status, assignee icons, accumulated expenses & hours
// Must be outside parent to avoid re-creation on render (breaks dnd ref tracking)
function RichTaskCard({ task, index, saving, users, expenses, timesheets }) {
  const taskExpenses = expenses.filter(e => e.project_id === task.project_id || e.submitted_by);
  // filter expenses tied to this task's project that are approved
  const approvedExp = expenses.filter(e =>
    (e.project_id === task.project_id) && e.status === "approved"
  ).reduce((s, e) => s + (e.amount || 0), 0);
  // hours logged against this task
  const loggedHours = timesheets.filter(t => t.task_id === task.id && t.status === "approved")
    .reduce((s, t) => s + (t.hours || 0), 0);

  const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={`bg-white rounded-xl border shadow-sm p-3 mb-2 select-none ${
            snapshot.isDragging
              ? "shadow-xl ring-2 ring-[#A55B4B]/40 rotate-1 scale-[1.02]"
              : "border-gray-100 hover:border-gray-200"
          } ${saving === task.id ? "opacity-50" : ""}`}
        >
          <div className="flex items-start gap-2">
            <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" />
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Title */}
              <p className="text-sm font-semibold text-[#210F37] leading-tight">{task.title}</p>
              {/* Project */}
              {task.project_name && (
                <p className="text-xs text-gray-400 truncate">{task.project_name}</p>
              )}
              {/* Status + Priority */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={`text-xs ${STATUS_CONFIG[task.status]?.color}`}>
                  <StatusIcon className="w-2.5 h-2.5 mr-0.5" />{STATUS_CONFIG[task.status]?.label}
                </Badge>
                <Badge className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
              </div>
              {/* Due date */}
              {task.due_date && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {format(parseLocalDate(task.due_date), "MMM d, yyyy")}
                </div>
              )}
              {/* Assignee avatars */}
              {(task.assigned_to || []).length > 0 && (
                <div className="flex -space-x-1.5 items-center">
                  {(task.assigned_to || []).map((email, i) => {
                    const u = users.find(u => u.email === email);
                    return (
                      <Avatar key={i} className="w-5 h-5 border-2 border-white" title={u?.full_name || email}>
                        <AvatarImage src={u?.photo_url} />
                        <AvatarFallback className="bg-[#A55B4B] text-white" style={{ fontSize: 8 }}>
                          {(u?.full_name || email)[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                  <span className="text-xs text-gray-400 ml-1.5">
                    {(task.assigned_to || []).length === 1
                      ? users.find(u => u.email === task.assigned_to[0])?.full_name || task.assigned_to[0]
                      : `${(task.assigned_to || []).length} people`}
                  </span>
                </div>
              )}
              {/* Expenses & Hours */}
              {(loggedHours > 0 || approvedExp > 0) && (
                <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
                  {loggedHours > 0 && (
                    <span className="flex items-center gap-1 text-xs text-[#4F1C51] font-medium">
                      <Clock className="w-3 h-3" />{loggedHours}h
                    </span>
                  )}
                  {approvedExp > 0 && (
                    <span className="flex items-center gap-1 text-xs text-[#A55B4B] font-medium">
                      <Receipt className="w-3 h-3" />${approvedExp.toFixed(0)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function TaskAssignment() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [filterProject, setFilterProject] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== "admin") { window.location.href = "/"; return; }
      loadData();
    }).catch(() => {});
  }, []);

  const loadData = async () => {
    const [tRes, uRes, pRes, eRes, tsRes] = await Promise.allSettled([
      base44.entities.Task.list("-created_date"),
      base44.entities.User.list(),
      base44.entities.Project.list(),
      base44.entities.Expense.list(),
      base44.entities.Timesheet.list(),
    ]);
    setTasks(tRes.status === "fulfilled" ? tRes.value : []);
    setUsers(uRes.status === "fulfilled" ? uRes.value : []);
    setProjects(pRes.status === "fulfilled" ? pRes.value : []);
    setExpenses(eRes.status === "fulfilled" ? eRes.value : []);
    setTimesheets(tsRes.status === "fulfilled" ? tsRes.value : []);
    setLoading(false);
  };

  const filteredTasks = tasks.filter(t => {
    const matchProject = filterProject === "all" || t.project_id === filterProject;
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase());
    return matchProject && matchSearch;
  });

  // Group tasks by status
  const tasksByStatus = Object.keys(STATUS_CONFIG).reduce((acc, status) => {
    acc[status] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {});

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;
    const task = tasks.find(t => t.id === draggableId);
    if (!task || task.status === newStatus) return;

    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));
    setSaving(draggableId);
    await base44.entities.Task.update(draggableId, {
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : undefined
    });
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#210F37]">Task Board</h2>
        <p className="text-gray-500 text-sm">Drag tasks between status columns to update their progress</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search tasks…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pb-4 items-start">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
            const col = tasksByStatus[status] || [];
            const Icon = cfg.icon;
            return (
              <div key={status} className="min-w-0">
                {/* Column header */}
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${cfg.header}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold text-[#210F37]">{cfg.label}</span>
                  <span className="ml-auto text-xs bg-white/60 text-gray-600 rounded-full px-2 py-0.5 font-medium">{col.length}</span>
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-24 rounded-xl p-2 transition-colors ${
                        snapshot.isDraggingOver ? "bg-[#A55B4B]/10 ring-2 ring-[#A55B4B]/30" : "bg-gray-50"
                      }`}
                    >
                      {col.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-xs text-gray-400 italic text-center py-6">No tasks</p>
                      )}
                      {col.map((task, i) => (
                        <RichTaskCard
                          key={task.id}
                          task={task}
                          index={i}
                          saving={saving}
                          users={users}
                          expenses={expenses}
                          timesheets={timesheets}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}