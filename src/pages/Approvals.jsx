import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, Clock, Receipt, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const TAB_CONFIG = [
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "timesheets", label: "Timesheets", icon: Clock },
];

export default function Approvals() {
  const [tab, setTab] = useState("expenses");
  const [expenses, setExpenses] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [rejectionNote, setRejectionNote] = useState({});
  const [showReject, setShowReject] = useState({});
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [eR, tsR] = await Promise.allSettled([
      base44.entities.Expense.filter({ status: "pending" }),
      base44.entities.Timesheet.filter({ status: "pending" }),
    ]);
    setExpenses(eR.status === "fulfilled" ? eR.value : []);
    setTimesheets(tsR.status === "fulfilled" ? tsR.value : []);
    setLoading(false);
  };

  const handleExpense = async (id, action) => {
    setProcessing(p => ({ ...p, [id]: true }));
    const now = new Date().toISOString();
    const data = action === "approve"
      ? { status: "approved", reviewed_by: user?.email, reviewed_at: now }
      : { status: "rejected", reviewed_by: user?.email, reviewed_at: now, rejection_reason: rejectionNote[id] || "" };
    await base44.entities.Expense.update(id, data);
    setExpenses(prev => prev.filter(e => e.id !== id));
    setProcessing(p => ({ ...p, [id]: false }));
    setShowReject(r => ({ ...r, [id]: false }));
  };

  const handleTimesheet = async (id, action) => {
    setProcessing(p => ({ ...p, [id]: true }));
    const now = new Date().toISOString();
    const data = action === "approve"
      ? { status: "approved", reviewed_by: user?.email, reviewed_at: now }
      : { status: "rejected", reviewed_by: user?.email, reviewed_at: now, rejection_reason: rejectionNote[id] || "" };
    await base44.entities.Timesheet.update(id, data);
    setTimesheets(prev => prev.filter(t => t.id !== id));
    setProcessing(p => ({ ...p, [id]: false }));
    setShowReject(r => ({ ...r, [id]: false }));
  };

  const pendingCounts = { expenses: expenses.length, timesheets: timesheets.length };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-[#210F37] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#A55B4B]" /> Approvals
        </h2>
        <p className="text-gray-500 text-sm mt-1">Review and approve pending expenses & timesheets</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-[#A55B4B] text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-[#A55B4B]"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
            {pendingCounts[key] > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${tab === key ? "bg-white/20" : "bg-[#A55B4B] text-white"}`}>
                {pendingCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* EXPENSES */}
          {tab === "expenses" && (
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-16 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No pending expenses — all clear!</p>
                  </CardContent>
                </Card>
              ) : expenses.map(e => (
                <Card key={e.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#210F37]">{e.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.project_name} · {e.category} · {e.date}</p>
                        <p className="text-xs text-gray-400">Submitted by: {e.submitted_by_name || e.submitted_by}</p>
                        {e.description && <p className="text-xs text-gray-500 mt-1">{e.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-[#A55B4B]">${Number(e.amount).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{e.currency || "USD"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Button size="sm" onClick={() => handleExpense(e.id, "approve")} disabled={processing[e.id]}
                        className="bg-green-500 hover:bg-green-600 text-white text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowReject(r => ({ ...r, [e.id]: !r[e.id] }))}
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                    {showReject[e.id] && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          placeholder="Reason for rejection (optional)"
                          rows={2}
                          className="text-xs"
                          value={rejectionNote[e.id] || ""}
                          onChange={ev => setRejectionNote(n => ({ ...n, [e.id]: ev.target.value }))}
                        />
                        <Button size="sm" onClick={() => handleExpense(e.id, "reject")} disabled={processing[e.id]}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs">
                          Confirm Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* TIMESHEETS */}
          {tab === "timesheets" && (
            <div className="space-y-3">
              {timesheets.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-16 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No pending timesheets — all clear!</p>
                  </CardContent>
                </Card>
              ) : timesheets.map(ts => (
                <Card key={ts.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#210F37]">{ts.employee_name || ts.employee_email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ts.project_name} · {ts.date}</p>
                        {ts.task_title && <p className="text-xs text-gray-400">Task: {ts.task_title}</p>}
                        {ts.description && <p className="text-xs text-gray-500 mt-1">{ts.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-[#4F1C51]">{ts.hours}h</p>
                        <p className="text-xs text-gray-400">logged</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Button size="sm" onClick={() => handleTimesheet(ts.id, "approve")} disabled={processing[ts.id]}
                        className="bg-green-500 hover:bg-green-600 text-white text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowReject(r => ({ ...r, [ts.id]: !r[ts.id] }))}
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                    {showReject[ts.id] && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          placeholder="Reason for rejection (optional)"
                          rows={2}
                          className="text-xs"
                          value={rejectionNote[ts.id] || ""}
                          onChange={ev => setRejectionNote(n => ({ ...n, [ts.id]: ev.target.value }))}
                        />
                        <Button size="sm" onClick={() => handleTimesheet(ts.id, "reject")} disabled={processing[ts.id]}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs">
                          Confirm Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}