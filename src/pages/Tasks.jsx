import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Plus, Search, CheckSquare, Circle, AlertCircle,
  Clock, CheckCircle2, MoreVertical, Edit2, XCircle,
  User, Calendar, LayoutGrid, List, Download, Printer
} from "lucide-react";
import AssigneeSelector from "@/components/AssigneeSelector";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { format } from "date-fns";
import { exportCSV } from "@/lib/exportUtils";
import { exportPDF, printPDF } from "@/lib/pdfUtils";
import { parseLocalDate } from "@/lib/dateUtils";

const STATUS_CONFIG = {
  todo: { label: "To Do", color: "bg-gray-100 text-gray-600", icon: Circle },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-700", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const DEFAULT_TASK = {
  title: "", description: "", project_id: "", project_name: "",
  assigned_to: [], status: "todo", priority: "medium",
  due_date: "", start_date: "", estimated_hours: "", tags: []
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [form, setForm] = useState(DEFAULT_TASK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      const admin = u?.role === "admin";
      setIsAdmin(admin);
      loadData(admin, u);
    });
  }, []);

  useEffect(() => {
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (taskId && tasks.length) setSelectedTask(tasks.find(task => task.id === taskId) || null);
  }, [tasks]);

  const loadData = async (adminFlag, meOverride) => {
    const admin = adminFlag !== undefined ? adminFlag : isAdmin;
    const me = meOverride || currentUser;
    const [tRes, pRes, uRes] = await Promise.allSettled([
      base44.entities.Task.list("-created_date"),
      base44.entities.Project.list(),
      admin ? base44.entities.User.list() : Promise.resolve([]),
    ]);
    const allP = pRes.status === "fulfilled" ? pRes.value : [];
    const filteredP = admin ? allP : allP.filter(p =>
      p.team_members?.includes(me?.email) || p.manager_email === me?.email
    );
    setTasks(tRes.status === "fulfilled" ? tRes.value.map(task => (
      task.status === "in_review" ? { ...task, status: "in_progress" } : task
    )) : []);
    setProjects(filteredP);
    setUsers(uRes.status === "fulfilled" ? uRes.value : []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditTask(null);
    setForm(DEFAULT_TASK);
    setShowDialog(true);
  };

  const openEdit = (t) => {
    setSelectedTask(null);
    setEditTask(t);
    setForm({ ...DEFAULT_TASK, ...t, estimated_hours: t.estimated_hours || "", assigned_to: t.assigned_to || [], tags: t.tags || [], assignee_rates: t.assignee_rates || [] });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const proj = projects.find(p => p.id === form.project_id);
    const data = {
      ...form,
      project_name: proj?.name || "",
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
      completed_at: form.status === "completed" ? new Date().toISOString() : undefined
    };
    if (editTask) {
      await base44.entities.Task.update(editTask.id, data);
    } else {
      await base44.entities.Task.create(data);
      // Notify assignees and admins
      if (data.assigned_to?.length > 0) {
        const adminUsers = users.filter(u => u.role === "admin");
        for (const admin of adminUsers) {
          await base44.entities.Notification.create({
            recipient_email: admin.email,
            title: "New Task Created",
            message: `Task "${data.title}" assigned to ${data.assigned_to.join(", ")} in "${proj?.name || ""}". Due: ${data.due_date || "N/A"}`,
            type: "task",
            sender_name: currentUser?.full_name || currentUser?.email,
            sender_email: currentUser?.email,
            is_read: false
          }).catch(() => {});
        }
        for (const assignee of data.assigned_to) {
          if (assignee !== currentUser?.email) {
            await base44.entities.Notification.create({
              recipient_email: assignee,
              title: "Task Assigned to You",
              message: `You have been assigned to "${data.title}" in "${proj?.name || ""}". Due: ${data.due_date || "N/A"}`,
              type: "task",
              sender_name: currentUser?.full_name || currentUser?.email,
              sender_email: currentUser?.email,
              is_read: false
            }).catch(() => {});
          }
        }
      }
    }
    setSaving(false);
    setShowDialog(false);
    setEditTask(null);
    loadData(isAdmin);
  };

  const handleStatusChange = async (task, newStatus) => {
    await base44.entities.Task.update(task.id, {
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : undefined
    });
    loadData(isAdmin);
  };

  const handleDeactivate = async (task) => {
    if (!confirm("Mark this task as completed? (Data is preserved for audit)")) return;
    await base44.entities.Task.update(task.id, { status: "completed", completed_at: new Date().toISOString() });
    setSelectedTask(null);
    loadData(isAdmin);
  };

  const toggleAssignee = (email) => {
    setForm(f => ({
      ...f,
      assigned_to: f.assigned_to.includes(email)
        ? f.assigned_to.filter(e => e !== email)
        : [...f.assigned_to, email]
    }));
  };

  const filteredTasks = tasks.filter(t => {
    if (!isAdmin && currentUser && !t.assigned_to?.includes(currentUser.email)) return false;
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchProject = filterProject === "all" || t.project_id === filterProject;
    const matchFrom = !filterDateFrom || (t.due_date && t.due_date >= filterDateFrom);
    const matchTo = !filterDateTo || (t.due_date && t.due_date <= filterDateTo);
    return matchSearch && matchStatus && matchProject && matchFrom && matchTo;
  });

  const pagedTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groupedByStatus = Object.keys(STATUS_CONFIG).reduce((acc, status) => {
    acc[status] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {});

  const getUserByEmail = (email) => users.find(u => u.email === email);

  // Compact row for list view
  const TaskRow = ({ task }) => {
    const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
    return (
      <div onClick={() => setSelectedTask(task)} className="grid grid-cols-12 items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm hover:shadow-md transition-all cursor-pointer">
        <div className="col-span-1 flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={e => e.stopPropagation()}>
                <StatusIcon className={`w-4 h-4 ${
                  task.status === "completed" ? "text-green-500" :
                  task.status === "in_progress" ? "text-blue-500" :
                  task.status === "blocked" ? "text-red-500" : "text-gray-400"
                }`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                <DropdownMenuItem key={s} onClick={() => handleStatusChange(task, s)}>{cfg.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={`${isAdmin ? "col-span-3" : "col-span-4"} min-w-0`}>
          <p className={`text-xs font-medium truncate ${task.status === "completed" ? "line-through text-gray-400" : "text-[#210F37]"}`}>
            {task.title}
          </p>
          {task.project_name && <p className="text-xs text-gray-400 truncate">{task.project_name}</p>}
        </div>
        <div className="col-span-2 hidden sm:block">
          <Badge className={`text-xs ${STATUS_CONFIG[task.status]?.color}`}>{STATUS_CONFIG[task.status]?.label}</Badge>
        </div>
        <div className="col-span-2 hidden md:block">
          <Badge className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
        </div>
        <div className="col-span-2 hidden md:flex -space-x-1">
          {(task.assigned_to || []).slice(0, 3).map((email, i) => {
            const u = getUserByEmail(email);
            return (
              <Avatar key={i} className="w-5 h-5 border border-white">
                <AvatarImage src={u?.photo_url} />
                <AvatarFallback className="bg-[#A55B4B] text-white" style={{ fontSize: 8 }}>{email[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            );
          })}
        </div>
        <div className="col-span-1 hidden lg:block text-xs text-gray-400 text-right">
          {task.due_date ? format(parseLocalDate(task.due_date), "MMM d") : "—"}
        </div>
        {isAdmin && (
          <div className="col-span-1 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button onClick={e => e.stopPropagation()} variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreVertical className="w-3 h-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(task)}><Edit2 className="w-3 h-3 mr-2" /> Edit</DropdownMenuItem>
                {task.status !== "completed" && (
                  <DropdownMenuItem onClick={() => handleDeactivate(task)} className="text-orange-600"><XCircle className="w-3 h-3 mr-2" /> Close Task</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  };

  // Card for board view (unchanged)
  const TaskCard = ({ task }) => {
    const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
    return (
      <Card onClick={() => setSelectedTask(task)} className="hover:shadow-md transition-all border-0 shadow-sm cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button onClick={e => e.stopPropagation()}>
                    <StatusIcon className={`w-4 h-4 flex-shrink-0 ${
                      task.status === "completed" ? "text-green-500" :
                      task.status === "in_progress" ? "text-blue-500" :
                      task.status === "blocked" ? "text-red-500" : "text-gray-400"
                    }`} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                    <DropdownMenuItem key={s} onClick={() => handleStatusChange(task, s)}>{cfg.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <h4 className={`font-medium text-sm truncate ${task.status === "completed" ? "line-through text-gray-400" : "text-[#210F37]"}`}>
                {task.title}
              </h4>
            </div>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button onClick={e => e.stopPropagation()} variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreVertical className="w-3 h-3" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(task)}><Edit2 className="w-3 h-3 mr-2" /> Edit</DropdownMenuItem>
                  {task.status !== "completed" && (
                    <DropdownMenuItem onClick={() => handleDeactivate(task)} className="text-orange-600"><XCircle className="w-3 h-3 mr-2" /> Close Task</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {task.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge className={`text-xs ${STATUS_CONFIG[task.status]?.color}`}>{STATUS_CONFIG[task.status]?.label}</Badge>
            <Badge className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
            {task.project_name && <Badge className="text-xs bg-[#F5F0FF] text-[#4F1C51]">{task.project_name}</Badge>}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex -space-x-1">
              {(task.assigned_to || []).slice(0, 3).map((email, i) => {
                const u = getUserByEmail(email);
                return (
                  <Avatar key={i} className="w-6 h-6 border-2 border-white">
                    <AvatarImage src={u?.photo_url} />
                    <AvatarFallback className="text-xs bg-[#A55B4B] text-white">{email[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                );
              })}
            </div>
            {task.due_date && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />{format(parseLocalDate(task.due_date), "MMM d")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleExportCSV = () => {
    exportCSV(
      `tasks_${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Title", "Project", "Status", "Priority", "Assigned To", "Due Date", "Est. Hours", "Created By"],
      filteredTasks.map(t => [t.title, t.project_name, t.status, t.priority, (t.assigned_to || []).join("; "), t.due_date || "", t.estimated_hours || "", t.created_by || ""])
    );
  };

  const pdfReport = () => [
      "Tasks Report",
      ["Title", "Project", "Status", "Priority", "Due Date", "Created By"],
      filteredTasks.map(t => [t.title, t.project_name, t.status, t.priority, t.due_date || "—", t.created_by || "—"]),
      [
        { label: "Total Tasks", value: filteredTasks.length },
        { label: "Completed", value: filteredTasks.filter(t => t.status === "completed").length },
        { label: "In Progress", value: filteredTasks.filter(t => t.status === "in_progress").length },
        { label: "Blocked", value: filteredTasks.filter(t => t.status === "blocked").length },
      ]
  ];
  const handleExportPDF = () => exportPDF(...pdfReport());
  const handlePrint = () => printPDF(...pdfReport());

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">Tasks</h2>
          <p className="text-gray-500 text-sm">{filteredTasks.length} tasks</p>
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
          {isAdmin && (
            <Button onClick={openCreate} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
              <Plus className="w-4 h-4 mr-1" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search tasks…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
              <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 text-xs" title="Due date from" />
          <span className="text-gray-400 text-xs">to</span>
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 text-xs" title="Due date to" />
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setView("list")} className={`px-3 py-1.5 ${view === "list" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setView("board")} className={`px-3 py-1.5 ${view === "board" ? "bg-[#A55B4B] text-white" : "bg-white text-gray-500"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start pb-4">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
            <div key={status} className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                <span className="text-xs text-gray-400">{groupedByStatus[status]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {(groupedByStatus[status] || []).map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tasks found</p>
              {isAdmin && <Button onClick={openCreate} className="mt-4 bg-[#A55B4B] text-white">Create First Task</Button>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">
                <div className="col-span-1"></div>
                <div className={isAdmin ? "col-span-3" : "col-span-4"}>Task</div>
                <div className="col-span-2 hidden sm:block">Status</div>
                <div className="col-span-2 hidden md:block">Priority</div>
                <div className="col-span-2 hidden md:block">Assignees</div>
                <div className="col-span-1 hidden lg:block text-right">Due</div>
                {isAdmin && <div className="col-span-1"></div>}
              </div>
              {pagedTasks.map(t => <TaskRow key={t.id} task={t} />)}
            </>
          )}
          <Pagination total={filteredTasks.length} page={page} perPage={PAGE_SIZE} onChange={p => { setPage(p); window.scrollTo(0,0); }} />
        </div>
      )}

      <Dialog open={Boolean(selectedTask)} onOpenChange={open => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-xl">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#210F37] pr-8">{selectedTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={`text-xs ${STATUS_CONFIG[selectedTask.status]?.color}`}>{STATUS_CONFIG[selectedTask.status]?.label}</Badge>
                  <Badge className={`text-xs ${PRIORITY_COLORS[selectedTask.priority]}`}>{selectedTask.priority}</Badge>
                  {selectedTask.project_name && <Badge className="text-xs bg-[#F5F0FF] text-[#4F1C51]">{selectedTask.project_name}</Badge>}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTask.description || "No description provided."}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-400">Start date</p>
                    <p className="mt-1 text-[#210F37]">{selectedTask.start_date ? format(parseLocalDate(selectedTask.start_date), "MMM d, yyyy") : "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-400">Due date</p>
                    <p className="mt-1 text-[#210F37]">{selectedTask.due_date ? format(parseLocalDate(selectedTask.due_date), "MMM d, yyyy") : "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-400">Estimated hours</p>
                    <p className="mt-1 text-[#210F37]">{selectedTask.estimated_hours ? `${selectedTask.estimated_hours}h` : "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-400">Created by</p>
                    <p className="mt-1 text-[#210F37] break-all">{selectedTask.created_by || "Unknown"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400 mb-2">Assigned to</p>
                  <div className="space-y-2">
                    {(selectedTask.assigned_to || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No assignees</p>
                    ) : (selectedTask.assigned_to || []).map(email => {
                      const user = getUserByEmail(email);
                      return (
                        <div key={email} className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={user?.photo_url} />
                            <AvatarFallback className="bg-[#A55B4B] text-white text-xs">{(user?.full_name || email)[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#210F37] truncate">{user?.full_name || email}</p>
                            {user?.full_name && <p className="text-xs text-gray-400 truncate">{email}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTask(null)}>Close</Button>
                {isAdmin && selectedTask.status !== "completed" && (
                  <Button variant="outline" onClick={() => handleDeactivate(selectedTask)} className="text-orange-700 border-orange-200 hover:bg-orange-50">
                    <XCircle className="w-4 h-4 mr-2" /> Close Task
                  </Button>
                )}
                {isAdmin && (
                  <Button onClick={() => openEdit(selectedTask)} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
                    <Edit2 className="w-4 h-4 mr-2" /> Edit Task
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">{editTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Task description…" className="mt-1" rows={3} />
            </div>
            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => {
                const proj = projects.find(p => p.id === v);
                setForm(f => ({ ...f, project_id: v, project_name: proj?.name || "" }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                    <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "critical"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated Hours</Label>
              <Input type="number" value={form.estimated_hours} onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))} placeholder="Hours" className="mt-1" />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Assign To</Label>
              <div className="mt-1">
                <AssigneeSelector
                  users={users}
                  selected={form.assigned_to}
                  onChange={vals => setForm(f => ({
                    ...f,
                    assigned_to: vals,
                    assignee_rates: vals.map(email => {
                      const existing = (f.assignee_rates || []).find(r => r.email === email);
                      return existing || { email, hourly_rate: "" };
                    })
                  }))}
                />
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.project_id || saving} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
              {saving ? "Saving…" : editTask ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}