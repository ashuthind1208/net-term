import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Shield, Search, Download, Eye, Clock, User, FileText,
  Receipt, ShoppingCart, CheckCircle2, XCircle, Edit2, Plus, Filter
} from "lucide-react";

const ENTITY_COLORS = {
  Expense: "bg-orange-100 text-orange-700",
  Timesheet: "bg-purple-100 text-purple-700",
  Procurement: "bg-blue-100 text-blue-700",
  Task: "bg-green-100 text-green-700",
  Project: "bg-indigo-100 text-indigo-700",
  User: "bg-gray-100 text-gray-700",
};

const ENTITY_ICONS = {
  Expense: Receipt,
  Timesheet: Clock,
  Procurement: ShoppingCart,
  Task: CheckCircle2,
  Project: FileText,
  User: User,
};

const ACTION_COLORS = {
  created: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  deleted: "bg-gray-100 text-gray-600",
  submitted: "bg-yellow-100 text-yellow-700",
};

export default function ComplianceAudit() {
  const [logs, setLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [viewLog, setViewLog] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async me => {
      if (me?.role !== "admin") { setLoading(false); return; }
      setIsAdmin(true);
      const [lR, eR, tsR, prR, tR] = await Promise.allSettled([
        base44.entities.AuditLog.list("-created_date", 500),
        base44.entities.Expense.list(),
        base44.entities.Timesheet.list(),
        base44.entities.Procurement.list(),
        base44.entities.Task.list(),
      ]);
      setLogs(lR.value || []);
      setExpenses(eR.value || []);
      setTimesheets(tsR.value || []);
      setProcurements(prR.value || []);
      setTasks(tR.value || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Generate synthetic activity from existing data if no audit logs
  const generateActivity = () => {
    const activities = [];

    expenses.forEach(e => {
      activities.push({
        id: `exp-${e.id}`,
        action: e.status === "approved" ? "approved" : e.status === "rejected" ? "rejected" : "submitted",
        entity_type: "Expense",
        entity_id: e.id,
        entity_title: e.title,
        actor_email: e.reviewed_by || e.submitted_by,
        actor_name: e.submitted_by_name || e.submitted_by,
        project_name: e.project_name,
        changes: `Amount: $${e.amount} | Category: ${e.category}`,
        created_date: e.reviewed_at || e.created_date,
      });
    });

    timesheets.forEach(ts => {
      activities.push({
        id: `ts-${ts.id}`,
        action: ts.status === "approved" ? "approved" : ts.status === "rejected" ? "rejected" : "submitted",
        entity_type: "Timesheet",
        entity_id: ts.id,
        entity_title: `${ts.employee_name || ts.employee_email} – ${ts.hours}h`,
        actor_email: ts.reviewed_by || ts.employee_email,
        actor_name: ts.employee_name || ts.employee_email,
        project_name: ts.project_name,
        changes: `Hours: ${ts.hours} | Date: ${ts.date} | Task: ${ts.task_title || "—"}`,
        created_date: ts.reviewed_at || ts.created_date,
      });
    });

    procurements.forEach(pr => {
      activities.push({
        id: `pr-${pr.id}`,
        action: pr.status === "approved" ? "approved" : pr.status === "delivered" ? "updated" : "created",
        entity_type: "Procurement",
        entity_id: pr.id,
        entity_title: pr.title,
        actor_email: pr.approved_by || pr.requested_by,
        actor_name: pr.requested_by_name || pr.requested_by,
        project_name: pr.project_name,
        changes: `Qty: ${pr.quantity} ${pr.unit} | $${pr.total_amount} | Status: ${pr.status}`,
        created_date: pr.approved_at || pr.created_date,
      });
    });

    tasks.filter(t => t.status === "completed").forEach(t => {
      activities.push({
        id: `task-${t.id}`,
        action: "updated",
        entity_type: "Task",
        entity_id: t.id,
        entity_title: t.title,
        actor_email: t.assigned_to?.[0] || "",
        actor_name: t.assigned_to?.[0]?.split("@")[0] || "Team",
        project_name: t.project_name,
        changes: `Status changed to: completed`,
        created_date: t.completed_at || t.updated_date,
      });
    });

    return activities.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""));
  };

  const allActivity = logs.length > 0 ? logs : generateActivity();

  const cutoff = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
  const filtered = allActivity.filter(a => {
    const matchSearch = !search || (a.entity_title || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.actor_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.actor_email || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.project_name || "").toLowerCase().includes(search.toLowerCase());
    const matchEntity = filterEntity === "all" || a.entity_type === filterEntity;
    const matchAction = filterAction === "all" || a.action === filterAction;
    const matchDate = !a.created_date || a.created_date >= cutoff;
    return matchSearch && matchEntity && matchAction && matchDate;
  });

  const exportCSV = () => {
    const headers = ["Date", "Action", "Entity Type", "Entity", "Actor", "Project", "Changes"];
    const rows = filtered.map(a => [
      a.created_date ? format(new Date(a.created_date), "yyyy-MM-dd HH:mm") : "—",
      a.action, a.entity_type, a.entity_title || "—", a.actor_name || a.actor_email || "—",
      a.project_name || "—", (a.changes || "").replace(/,/g, ";")
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  const entityStats = ["Expense", "Timesheet", "Procurement", "Task", "Project"].map(e => ({
    type: e,
    count: allActivity.filter(a => a.entity_type === e).length,
    icon: ENTITY_ICONS[e] || FileText,
    color: ENTITY_COLORS[e],
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
          <h2 className="text-xl font-bold text-[#210F37] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#A55B4B]" /> Compliance & Audit Log
          </h2>
          <p className="text-gray-500 text-sm">Full activity trail — who did what, when, and on what</p>
        </div>
        <Button onClick={exportCSV} className="bg-[#210F37] hover:bg-[#4F1C51] text-white gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Entity type stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {entityStats.map(s => (
          <Card key={s.type} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() => setFilterEntity(filterEntity === s.type ? "all" : s.type)}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.type}s</p>
                <p className="font-bold text-[#210F37]">{s.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by entity, actor, project..." className="pl-9" />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Entity Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["Expense","Timesheet","Procurement","Task","Project","User"].map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {["created","updated","approved","rejected","submitted","deleted"].map(a => (
              <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">{filtered.length} records</span>
      </div>

      {/* Audit timeline */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No audit records found for the selected filters</p>
            </CardContent>
          </Card>
        ) : (
          filtered.slice(0, 200).map((a, i) => {
            const Icon = ENTITY_ICONS[a.entity_type] || FileText;
            const actionColor = ACTION_COLORS[a.action] || "bg-gray-100 text-gray-600";
            return (
              <div key={a.id || i} className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => setViewLog(a)}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${ENTITY_COLORS[a.entity_type] || "bg-gray-100 text-gray-500"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[#210F37]">{a.actor_name || a.actor_email?.split("@")[0] || "System"}</span>
                    <Badge className={`text-xs capitalize ${actionColor}`}>{a.action}</Badge>
                    <span className="text-sm text-gray-500">{a.entity_type}:</span>
                    <span className="text-sm text-gray-700 font-medium truncate max-w-[200px]">{a.entity_title || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {a.project_name && <span>📁 {a.project_name}</span>}
                    {a.created_date && (
                      <span>{format(new Date(a.created_date), "MMM d, yyyy · h:mm a")}</span>
                    )}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-300 hover:text-gray-600 shrink-0 mt-1" />
              </div>
            );
          })
        )}
      </div>

      {/* Detail modal */}
      {viewLog && (
        <Dialog open={!!viewLog} onOpenChange={() => setViewLog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#210F37] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#A55B4B]" /> Audit Detail
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
                {[
                  ["Action", <Badge className={`capitalize ${ACTION_COLORS[viewLog.action] || "bg-gray-100 text-gray-600"}`}>{viewLog.action}</Badge>],
                  ["Entity Type", viewLog.entity_type],
                  ["Entity", viewLog.entity_title || "—"],
                  ["Actor", viewLog.actor_name || viewLog.actor_email || "—"],
                  ["Email", viewLog.actor_email || "—"],
                  ["Project", viewLog.project_name || "—"],
                  ["Timestamp", viewLog.created_date ? format(new Date(viewLog.created_date), "MMM d, yyyy HH:mm") : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400">{k}</p>
                    <div className="font-medium text-[#210F37] mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              {viewLog.changes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Changes / Details</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 whitespace-pre-wrap">{viewLog.changes}</div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}