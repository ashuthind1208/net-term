import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { localDateKey } from "@/lib/dateUtils";
import {
  Users, Search, Mail, Phone, Briefcase, Shield, UserCheck,
  MoreVertical, Edit2, Star as StarIcon, TrendingUp, Clock, CheckCircle2,
  LayoutGrid, List, Building2, DollarSign, Award, Target,
  ChevronDown, Brain, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 as b44 } from "@/api/base44Client";

const ROLE_CONFIG = {
  admin: { label: "Admin", color: "bg-purple-100 text-purple-700", icon: Shield },
  manager: { label: "Manager", color: "bg-blue-100 text-blue-700", icon: UserCheck },
  user: { label: "Employee", color: "bg-green-100 text-green-700", icon: Users },
};

const STAR_COLORS = ["text-gray-300", "text-red-400", "text-orange-400", "text-yellow-400", "text-green-500", "text-emerald-500"];

export default function Employees() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [view, setView] = useState("grid");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ role: "user", job_title: "", department: "", phone: "", hourly_rate: "" });
  const [saving, setSaving] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 4, review_period: "", strengths: "", areas_for_improvement: "", goals: "", comments: "" });
  const [savingReview, setSavingReview] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== "admin") { window.location.href = "/"; return; }
      loadData();
    }).catch(() => {});
  }, []);

  const loadData = async () => {
    const [u, t, ts, e, rv] = await Promise.allSettled([
      base44.entities.User.list(),
      base44.entities.Task.list(),
      base44.entities.Timesheet.list(),
      base44.entities.Expense.list(),
      base44.entities.EmployeeReview.list(),
    ]);
    setUsers(u.status === "fulfilled" ? u.value : []);
    setTasks(t.status === "fulfilled" ? t.value : []);
    setTimesheets(ts.status === "fulfilled" ? ts.value : []);
    setExpenses(e.status === "fulfilled" ? e.value : []);
    setReviews(rv.status === "fulfilled" ? rv.value : []);
    setLoading(false);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({ role: user.role || "user", job_title: user.job_title || "", department: user.department || "", phone: user.phone || "", hourly_rate: user.hourly_rate || "" });
    setShowEditDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.User.update(editUser.id, form);
    setSaving(false);
    setShowEditDialog(false);
    setEditUser(null);
    loadData();
  };

  const handleInvite = async () => {
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    setShowInviteDialog(false);
    setInviteEmail("");
    setInviteRole("user");
  };

  const openReview = (user) => {
    setEditUser(user);
    setAiSummary("");
    setReviewForm({ rating: 4, review_period: `Q${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}`, strengths: "", areas_for_improvement: "", goals: "", comments: "" });
    setShowReviewDialog(true);
  };

  const handleSaveReview = async () => {
    setSavingReview(true);
    const me = await base44.auth.me();
    await base44.entities.EmployeeReview.create({
      ...reviewForm,
      employee_email: editUser.email,
      employee_name: editUser.full_name,
      reviewer_email: me.email,
      reviewer_name: me.full_name,
    });
    setSavingReview(false);
    setShowReviewDialog(false);
    loadData();
  };

  const generateAISummary = async (user) => {
    setAiLoading(true);
    setAiSummary("");
    const userTasks = tasks.filter(t => t.assigned_to?.includes(user.email));
    const completedTasks = userTasks.filter(t => t.status === "completed").length;
    const userHours = timesheets.filter(ts => ts.employee_email === user.email && ts.status === "approved").reduce((s, ts) => s + (ts.hours || 0), 0);
    const overdue = userTasks.filter(t => t.due_date && t.due_date < localDateKey() && t.status !== "completed").length;
    const userReviews = reviews.filter(r => r.employee_email === user.email);
    const avgRating = userReviews.length > 0 ? (userReviews.reduce((s, r) => s + (r.rating || 0), 0) / userReviews.length).toFixed(1) : "N/A";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a concise professional performance summary for an employee with the following data:
Name: ${user.full_name || user.email}
Job Title: ${user.job_title || "Not specified"}
Department: ${user.department || "Not specified"}
Skills: ${(user.skills || []).join(", ") || "None listed"}
Total Tasks: ${userTasks.length} (${completedTasks} completed, ${overdue} overdue)
Hours Logged: ${userHours}h (approved)
Average Manager Rating: ${avgRating}/5
Previous reviews: ${userReviews.length}

Write a 3-4 sentence performance summary highlighting strengths, areas to watch, and potential next steps. Keep it professional and constructive.`
    });
    setAiSummary(result);
    setAiLoading(false);
  };

  const getUserStats = (user) => {
    const userTasks = tasks.filter(t => t.assigned_to?.includes(user.email));
    const completedTasks = userTasks.filter(t => t.status === "completed").length;
    const totalHours = timesheets.filter(t => t.employee_email === user.email && t.status === "approved").reduce((s, t) => s + (t.hours || 0), 0);
    const totalExpenses = expenses.filter(e => e.submitted_by === user.email && e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
    const completionRate = userTasks.length > 0 ? Math.round((completedTasks / userTasks.length) * 100) : 0;
    const userReviews = reviews.filter(r => r.employee_email === user.email);
    const avgRating = userReviews.length > 0 ? (userReviews.reduce((s, r) => s + (r.rating || 0), 0) / userReviews.length) : 0;
    return { totalTasks: userTasks.length, completedTasks, totalHours, totalExpenses, completionRate, avgRating: Math.round(avgRating * 10) / 10, reviewCount: userReviews.length };
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.department || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const EmployeeCard = ({ user }) => {
    const stats = getUserStats(user);
    const RoleIcon = ROLE_CONFIG[user.role]?.icon || Users;
    return (
      <Card className="hover:shadow-lg transition-all border-0 shadow-sm cursor-pointer" onClick={() => setSelectedUser(user)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-[#A55B4B]">
                <AvatarImage src={user.photo_url} />
                <AvatarFallback className="bg-gradient-to-br from-[#A55B4B] to-[#4F1C51] text-white text-lg">
                  {user.full_name?.[0] || user.email?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-[#210F37]">{user.full_name || "—"}</p>
                <p className="text-xs text-gray-400">{user.job_title || user.email}</p>
                {stats.avgRating > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(s => (
                    <StarIcon key={s} className={`w-3 h-3 ${s <= Math.round(stats.avgRating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                  ))}
                    <span className="text-xs text-gray-400 ml-1">{stats.avgRating}</span>
                  </div>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(user); }}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); openReview(user); }}>
                  <Award className="w-4 h-4 mr-2" /> Add Review
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge className={`text-xs ${ROLE_CONFIG[user.role]?.color || "bg-gray-100 text-gray-600"}`}>
              <RoleIcon className="w-3 h-3 mr-1" />{ROLE_CONFIG[user.role]?.label || user.role}
            </Badge>
            {user.department && <Badge className="text-xs bg-gray-100 text-gray-600"><Building2 className="w-3 h-3 mr-1" />{user.department}</Badge>}
          </div>

          {/* Completion rate bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Task Completion</span>
              <span className="font-medium text-[#210F37]">{stats.completionRate}%</span>
            </div>
            <Progress value={stats.completionRate} className="h-1.5" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            <div>
              <p className="text-xs text-gray-400">Tasks</p>
              <p className="font-bold text-[#210F37] text-sm">{stats.completedTasks}/{stats.totalTasks}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Hours</p>
              <p className="font-bold text-[#4F1C51] text-sm">{stats.totalHours}h</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Reviews</p>
              <p className="font-bold text-[#A55B4B] text-sm">{stats.reviewCount}</p>
            </div>
          </div>

          {(user.skills || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {(user.skills || []).slice(0, 3).map(s => (
                <span key={s} className="text-xs bg-[#4F1C51]/10 text-[#4F1C51] rounded-full px-2 py-0.5">{s}</span>
              ))}
              {(user.skills || []).length > 3 && <span className="text-xs text-gray-400">+{user.skills.length - 3}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // 360 Profile Modal
  const ProfileModal = ({ user, onClose }) => {
    if (!user) return null;
    const stats = getUserStats(user);
    const userReviews = reviews.filter(r => r.employee_email === user.email).sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""));

    return (
      <Dialog open={!!user} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">Employee 360° Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 bg-gradient-to-r from-[#210F37] to-[#4F1C51] rounded-xl p-4">
              <Avatar className="w-16 h-16 border-2 border-[#DCA06D]">
                <AvatarImage src={user.photo_url} />
                <AvatarFallback className="bg-[#A55B4B] text-white text-2xl">{user.full_name?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-white font-bold text-lg">{user.full_name || user.email}</h3>
                <p className="text-[#DCA06D] text-sm">{user.job_title || "Employee"} · {user.department || "—"}</p>
                <p className="text-white/60 text-xs mt-1">{user.email}</p>
                {stats.avgRating > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {[1,2,3,4,5].map(s => <StarIcon key={s} className={`w-3.5 h-3.5 ${s <= Math.round(stats.avgRating) ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`} />)}
                    <span className="text-white/80 text-xs ml-1">{stats.avgRating}/5 ({stats.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Tasks Completed", value: `${stats.completedTasks}/${stats.totalTasks}`, color: "text-green-600" },
                { label: "Completion Rate", value: `${stats.completionRate}%`, color: stats.completionRate > 70 ? "text-green-600" : "text-orange-500" },
                { label: "Hours Logged", value: `${stats.totalHours}h`, color: "text-[#4F1C51]" },
                { label: "Avg Rating", value: stats.avgRating > 0 ? `${stats.avgRating}/5` : "—", color: "text-yellow-500" },
              ].map((k, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-0.5">{k.label}</p>
                  <p className={`font-bold text-base ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Skills */}
            {(user.skills || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {(user.skills || []).map(s => (
                    <span key={s} className="bg-[#4F1C51]/10 text-[#4F1C51] text-xs rounded-full px-3 py-1 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {(user.certifications || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {(user.certifications || []).map(c => (
                    <span key={c} className="bg-yellow-50 text-yellow-700 text-xs rounded-full px-3 py-1 font-medium border border-yellow-200">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            <div className="border border-dashed border-[#DCA06D] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#210F37] flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#DCA06D]" /> AI Performance Summary
                </p>
                <Button size="sm" variant="outline" onClick={() => generateAISummary(user)} disabled={aiLoading} className="h-7 text-xs">
                  {aiLoading ? "Generating..." : "Generate"}
                </Button>
              </div>
              {aiSummary ? (
                <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">Click "Generate" to create an AI-powered performance summary based on data.</p>
              )}
            </div>

            {/* Manager reviews */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Manager Reviews</p>
                <Button size="sm" variant="ghost" onClick={() => { onClose(); openReview(user); }} className="h-7 text-xs text-[#A55B4B]">
                  <Plus className="w-3 h-3 mr-1" /> Add Review
                </Button>
              </div>
              {userReviews.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No reviews yet</p>
              ) : (
                <div className="space-y-3">
                  {userReviews.slice(0, 3).map(r => (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(s => <StarIcon key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />)}
                          <span className="text-xs font-medium text-[#210F37] ml-1">{r.rating}/5</span>
                        </div>
                        <span className="text-xs text-gray-400">{r.review_period} · {r.reviewer_name}</span>
                      </div>
                      {r.comments && <p className="text-xs text-gray-600 mt-1">{r.comments}</p>}
                      {r.strengths && <p className="text-xs text-green-700 mt-1">✓ {r.strengths}</p>}
                      {r.areas_for_improvement && <p className="text-xs text-orange-600 mt-1">△ {r.areas_for_improvement}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">Employee 360° Profiles</h2>
          <p className="text-gray-500 text-sm">{filteredUsers.length} members · Performance · Skills · Reviews</p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)} className="bg-[#210F37] hover:bg-[#4F1C51] text-white">
          <Mail className="w-4 h-4 mr-1" /> Invite
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search employees…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(ROLE_CONFIG).map(([r, cfg]) => <SelectItem key={r} value={r}>{cfg.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setView("grid")} className={`px-3 py-1.5 ${view === "grid" ? "bg-[#210F37] text-white" : "bg-white text-gray-500"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("list")} className={`px-3 py-1.5 ${view === "list" ? "bg-[#210F37] text-white" : "bg-white text-gray-500"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#210F37] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(u => <EmployeeCard key={u.id} user={u} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(u => {
            const stats = getUserStats(u);
            return (
              <div key={u.id} className="flex items-center gap-4 bg-white rounded-lg px-4 py-3 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedUser(u)}>
                <Avatar className="w-9 h-9 border-2 border-[#A55B4B] flex-shrink-0">
                  <AvatarImage src={u.photo_url} />
                  <AvatarFallback className="bg-[#A55B4B] text-white text-sm">{u.full_name?.[0] || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[#210F37] truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <Badge className={`text-xs hidden sm:flex ${ROLE_CONFIG[u.role]?.color || "bg-gray-100 text-gray-600"}`}>{ROLE_CONFIG[u.role]?.label || u.role}</Badge>
                {u.department && <span className="text-xs text-gray-400 hidden md:block">{u.department}</span>}
                <div className="text-xs text-gray-500 hidden lg:flex items-center gap-1"><Clock className="w-3 h-3" /> {stats.totalHours}h</div>
                <div className="text-xs hidden lg:flex items-center gap-1">
                  <Progress value={stats.completionRate} className="h-1.5 w-16" />
                  <span className="text-gray-500">{stats.completionRate}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 360 Profile Modal */}
      <ProfileModal user={selectedUser} onClose={() => { setSelectedUser(null); setAiSummary(""); }} />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Edit Employee</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <Avatar className="w-10 h-10"><AvatarFallback className="bg-[#A55B4B] text-white">{editUser.full_name?.[0] || "U"}</AvatarFallback></Avatar>
                <div>
                  <p className="font-semibold text-[#210F37]">{editUser.full_name}</p>
                  <p className="text-xs text-gray-400">{editUser.email}</p>
                </div>
              </div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ROLE_CONFIG).map(([r, cfg]) => <SelectItem key={r} value={r}>{cfg.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Job Title</Label><Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="e.g. Software Engineer" className="mt-1" /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Engineering" className="mt-1" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" className="mt-1" /></div>
              <div>
                <Label>Hourly Rate ($/hr)</Label>
                <Input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value ? Number(e.target.value) : "" }))} placeholder="e.g. 45.00" className="mt-1" />
                <p className="text-xs text-gray-400 mt-1">Used for labour cost calculations in project finance</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#210F37] hover:bg-[#4F1C51] text-white">{saving ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Add Performance Review — {editUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Review Period</Label><Input value={reviewForm.review_period} onChange={e => setReviewForm(f => ({ ...f, review_period: e.target.value }))} placeholder="e.g. Q1 2026" className="mt-1" /></div>
            <div>
              <Label>Rating (1–5)</Label>
              <div className="flex gap-2 mt-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                    className={`w-9 h-9 rounded-lg border-2 font-bold text-sm transition-all ${reviewForm.rating >= n ? "border-yellow-400 bg-yellow-50 text-yellow-600" : "border-gray-200 text-gray-400"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Strengths</Label><textarea value={reviewForm.strengths} onChange={e => setReviewForm(f => ({ ...f, strengths: e.target.value }))} rows={2} placeholder="Key strengths..." className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" /></div>
            <div><Label>Areas for Improvement</Label><textarea value={reviewForm.areas_for_improvement} onChange={e => setReviewForm(f => ({ ...f, areas_for_improvement: e.target.value }))} rows={2} placeholder="What to improve..." className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" /></div>
            <div><Label>Goals</Label><textarea value={reviewForm.goals} onChange={e => setReviewForm(f => ({ ...f, goals: e.target.value }))} rows={2} placeholder="Next period goals..." className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" /></div>
            <div><Label>Comments</Label><textarea value={reviewForm.comments} onChange={e => setReviewForm(f => ({ ...f, comments: e.target.value }))} rows={2} placeholder="Additional comments..." className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveReview} disabled={savingReview} className="bg-[#210F37] hover:bg-[#4F1C51] text-white">{savingReview ? "Saving…" : "Save Review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#210F37]">Invite Employee</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Email *</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="employee@company.com" className="mt-1" /></div>
            <div><Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="bg-[#210F37] hover:bg-[#4F1C51] text-white">{inviting ? "Inviting…" : "Send Invite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}