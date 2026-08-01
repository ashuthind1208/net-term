import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  MessageSquare, AlertTriangle, Send, Plus, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Bell, Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";

const BLOCKER_TYPES = [
  { value: "technical", label: "Technical Issue", color: "bg-red-100 text-red-700" },
  { value: "dependency", label: "Waiting on Someone", color: "bg-orange-100 text-orange-700" },
  { value: "access", label: "Access / Permissions", color: "bg-yellow-100 text-yellow-700" },
  { value: "clarity", label: "Need Clarification", color: "bg-blue-100 text-blue-700" },
  { value: "resource", label: "Resource Unavailable", color: "bg-purple-100 text-purple-700" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-600" },
];

function AdminFeedbackForm({ blocker, onUpdate, loading }) {
  const [note, setNote] = useState(blocker.resolution_note || "");
  const [status, setStatus] = useState(blocker.status || "open");
  return (
    <div className="space-y-2 pt-2 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500">Admin Actions</p>
      <div className="flex gap-2 flex-wrap">
        {["open", "in_progress", "resolved"].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              status === s ? "bg-[#4F1C51] text-white border-[#4F1C51]" : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      <textarea
        className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#4F1C51]"
        rows={2}
        placeholder="Add feedback or resolution note…"
        value={note}
        onChange={e => setNote(e.target.value)}
      />
      <button
        onClick={() => onUpdate(blocker.id, status, note)}
        disabled={loading}
        className="px-3 py-1.5 bg-[#4F1C51] text-white text-xs rounded-lg hover:bg-[#210F37] transition-colors disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save & Update Status"}
      </button>
    </div>
  );
}

export default function TeamConnect() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [tab, setTab] = useState("blockers"); // blockers | message
  const [showNewBlocker, setShowNewBlocker] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [expandedBlocker, setExpandedBlocker] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const handleStatusUpdate = async (blockerId, newStatus, feedbackNote) => {
    setUpdatingStatus(blockerId);
    await base44.entities.Blocker.update(blockerId, {
      status: newStatus,
      ...(feedbackNote ? { resolution_note: feedbackNote } : {}),
      ...(newStatus === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    });
    const fresh = await base44.entities.Blocker.list("-created_date");
    setBlockers(isAdmin ? fresh : fresh.filter(b => b.reporter_email === user?.email));
    setUpdatingStatus(null);
  };

  const [blockerForm, setBlockerForm] = useState({
    type: "technical", project_id: "", task_id: "", description: "", urgency: "medium"
  });

  const [messageForm, setMessageForm] = useState({
    to: "", subject: "", body: ""
  });

  useEffect(() => {
    base44.auth.me().then(async me => {
      setUser(me);
      const admin = me?.role === "admin";
      setIsAdmin(admin);
      const [pR, tR, uR, bR] = await Promise.allSettled([
        base44.entities.Project.list(),
        base44.entities.Task.list(),
        base44.entities.User.list(),
        base44.entities.Blocker.list("-created_date"),
      ]);
      const allP = pR.status === "fulfilled" ? pR.value : [];
      const allT = tR.status === "fulfilled" ? tR.value : [];
      const allU = uR.status === "fulfilled" ? uR.value : [];
      const allB = bR.status === "fulfilled" ? bR.value : [];

      const myTasks = allT.filter(t => t.assigned_to?.includes(me.email));
      const assignedProjectIds = new Set(myTasks.map(t => t.project_id));

      // For employees: projects where they're a member, manager, OR have assigned tasks
      const myProjects = allP.filter(p =>
        p.team_members?.includes(me.email) ||
        p.manager_email === me.email ||
        assignedProjectIds.has(p.id)
      );

      setProjects(admin ? allP : myProjects);
      setTasks(admin ? allT : myTasks);
      setAdminUsers(allU.filter(u => u.role === "admin"));
      setBlockers(admin ? allB : allB.filter(b => b.reporter_email === me.email));
    });
  }, []);

  const handleSendBlocker = async () => {
    setSending(true);
    const proj = projects.find(p => p.id === blockerForm.project_id);
    const task = tasks.find(t => t.id === blockerForm.task_id);
    const typeLabel = BLOCKER_TYPES.find(b => b.value === blockerForm.type)?.label;

    // Store as a Blocker entity (falls back gracefully if entity doesn't exist yet)
    try {
      await base44.entities.Blocker.create({
        type: blockerForm.type,
        project_id: blockerForm.project_id,
        project_name: proj?.name || "",
        task_id: blockerForm.task_id || undefined,
        task_title: task?.title || undefined,
        description: blockerForm.description,
        urgency: blockerForm.urgency,
        status: "open",
        reporter_name: user?.full_name || user?.email,
        reporter_email: user?.email,
      });
    } catch (e) {}

    // Email all admins
    for (const admin of adminUsers) {
      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `🚨 Blocker Reported [${blockerForm.urgency.toUpperCase()}]: ${typeLabel}`,
        body: `${user?.full_name || user?.email} has reported a blocker.\n\nType: ${typeLabel}\nUrgency: ${blockerForm.urgency}\nProject: ${proj?.name || "N/A"}\nTask: ${task?.title || "N/A"}\n\nDescription:\n${blockerForm.description}\n\nPlease review and respond as soon as possible.`
      }).catch(() => {});
    }

    setSending(false);
    setSent(true);
    setShowNewBlocker(false);
    setBlockerForm({ type: "technical", project_id: "", task_id: "", description: "", urgency: "medium" });
    setTimeout(() => setSent(false), 3000);

    // Reload blockers
    try {
      const fresh = await base44.entities.Blocker.list("-created_date");
      setBlockers(isAdmin ? fresh : fresh.filter(b => b.created_by === user?.email));
    } catch (e) {}
  };

  const handleSendMessage = async () => {
    setSending(true);
    await base44.integrations.Core.SendEmail({
      to: messageForm.to,
      subject: messageForm.subject,
      body: `${messageForm.body}\n\n— Sent via Net Term Solutions by ${user?.full_name || user?.email}`
    }).catch(() => {});
    setSending(false);
    setSent(true);
    setShowMessageDialog(false);
    setMessageForm({ to: "", subject: "", body: "" });
    setTimeout(() => setSent(false), 3000);
  };

  const urgencyColor = { low: "bg-gray-100 text-gray-600", medium: "bg-orange-100 text-orange-600", high: "bg-red-100 text-red-700" };
  const statusColor = { open: "bg-red-100 text-red-700", in_progress: "bg-yellow-100 text-yellow-700", resolved: "bg-green-100 text-green-700" };

  const tasksForProject = blockerForm.project_id
    ? tasks.filter(t => t.project_id === blockerForm.project_id)
    : tasks;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#210F37] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#A55B4B]" /> Team Connect
          </h2>
          <p className="text-gray-500 text-sm mt-1">Report blockers, escalate issues, and message your team</p>
        </div>
        {sent && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4" /> Sent successfully
          </div>
        )}
      </div>

      {/* Quick Actions — employees only */}
      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setShowNewBlocker(true)}
            className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-transparent hover:border-red-300 hover:shadow-md transition-all text-left"
          >
            <div className="p-3 rounded-xl bg-red-50">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-[#210F37]">Report a Blocker</p>
              <p className="text-xs text-gray-400 mt-0.5">Alert your manager to an issue holding you back</p>
            </div>
          </button>
          <button
            onClick={() => setShowMessageDialog(true)}
            className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-transparent hover:border-[#A55B4B]/40 hover:shadow-md transition-all text-left"
          >
            <div className="p-3 rounded-xl bg-[#F5F0FF]">
              <Send className="w-6 h-6 text-[#4F1C51]" />
            </div>
            <div>
              <p className="font-semibold text-[#210F37]">Send Quick Message</p>
              <p className="text-xs text-gray-400 mt-0.5">Email a teammate or manager directly</p>
            </div>
          </button>
        </div>
      )}

      {/* Admins directory — employees only */}
      {!isAdmin && adminUsers.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#210F37] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4F1C51]" /> Your Managers / Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {adminUsers.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={a.photo_url} />
                    <AvatarFallback className="bg-[#4F1C51] text-white text-xs">{(a.full_name || a.email)[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-medium text-[#210F37]">{a.full_name || a.email}</p>
                    <p className="text-xs text-gray-400">{a.job_title || "Admin"}</p>
                  </div>
                  <button
                    onClick={() => { setMessageForm({ to: a.email, subject: "", body: "" }); setShowMessageDialog(true); }}
                    className="ml-1 p-1 rounded hover:bg-[#F5F0FF] text-gray-400 hover:text-[#4F1C51] transition-colors"
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blockers list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#210F37] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#A55B4B]" />
            {isAdmin ? "All Reported Blockers" : "My Blockers"}
          </h3>
          {!isAdmin && (
            <Button size="sm" onClick={() => setShowNewBlocker(true)} className="bg-[#A55B4B] hover:bg-[#4F1C51] text-white">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Blocker
            </Button>
          )}
        </div>

        {blockers.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No blockers reported — all clear!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {blockers.map(b => {
              const typeInfo = BLOCKER_TYPES.find(t => t.value === b.type);
              const expanded = expandedBlocker === b.id;
              return (
                <Card key={b.id} className="border-0 shadow-sm overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedBlocker(expanded ? null : b.id)}
                  >
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${b.urgency === "high" ? "text-red-500" : b.urgency === "medium" ? "text-orange-400" : "text-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#210F37] truncate">
                        {typeInfo?.label} {b.project_name ? `— ${b.project_name}` : ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        {b.reporter_name || b.created_by} · {b.created_date ? formatDistanceToNow(new Date(b.created_date), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs ${urgencyColor[b.urgency]}`}>{b.urgency}</Badge>
                      <Badge className={`text-xs ${statusColor[b.status] || "bg-gray-100 text-gray-600"}`}>{b.status || "open"}</Badge>
                      {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {expanded && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                      <p className="text-sm text-gray-700">{b.description}</p>
                      {b.task_title && <p className="text-xs text-gray-400">Related task: {b.task_title}</p>}
                      {b.resolution_note && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                          <p className="text-xs font-medium text-green-700">Admin feedback:</p>
                          <p className="text-xs text-green-600 mt-0.5">{b.resolution_note}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <AdminFeedbackForm
                          blocker={b}
                          onUpdate={handleStatusUpdate}
                          loading={updatingStatus === b.id}
                        />
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Blocker Dialog */}
      <Dialog open={showNewBlocker} onOpenChange={setShowNewBlocker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#210F37] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Report a Blocker
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Blocker Type *</Label>
              <Select value={blockerForm.type} onValueChange={v => setBlockerForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCKER_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urgency *</Label>
              <Select value={blockerForm.urgency} onValueChange={v => setBlockerForm(f => ({ ...f, urgency: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — Can wait a day or two</SelectItem>
                  <SelectItem value="medium">Medium — Needs attention today</SelectItem>
                  <SelectItem value="high">High — Blocking me right now</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project</Label>
              <Select value={blockerForm.project_id} onValueChange={v => setBlockerForm(f => ({ ...f, project_id: v, task_id: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {tasksForProject.length > 0 && (
              <div>
                <Label>Related Task</Label>
                <Select value={blockerForm.task_id} onValueChange={v => setBlockerForm(f => ({ ...f, task_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select task (optional)" /></SelectTrigger>
                  <SelectContent>
                    {tasksForProject.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Description *</Label>
              <Textarea
                className="mt-1" rows={4}
                placeholder="Describe what's blocking you and what you've already tried…"
                value={blockerForm.description}
                onChange={e => setBlockerForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBlocker(false)}>Cancel</Button>
            <Button
              onClick={handleSendBlocker}
              disabled={!blockerForm.description || sending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {sending ? "Sending…" : <><AlertTriangle className="w-4 h-4 mr-1" /> Report Blocker</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#210F37] flex items-center gap-2">
              <Send className="w-4 h-4 text-[#4F1C51]" /> Send Quick Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>To *</Label>
              <Select value={messageForm.to} onValueChange={v => setMessageForm(f => ({ ...f, to: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select recipient" /></SelectTrigger>
                <SelectContent>
                  {adminUsers.map(a => (
                    <SelectItem key={a.email} value={a.email}>
                      {a.full_name || a.email} ({a.job_title || "Admin"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input className="mt-1" placeholder="e.g. Question about project timeline" value={messageForm.subject} onChange={e => setMessageForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea className="mt-1" rows={5} placeholder="Write your message here…" value={messageForm.body} onChange={e => setMessageForm(f => ({ ...f, body: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSendMessage}
              disabled={!messageForm.to || !messageForm.subject || !messageForm.body || sending}
              className="bg-[#4F1C51] hover:bg-[#210F37] text-white"
            >
              {sending ? "Sending…" : <><Send className="w-4 h-4 mr-1" /> Send Message</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}