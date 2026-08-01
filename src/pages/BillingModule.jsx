import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, Download, Printer, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { localDateKey } from "@/lib/dateUtils";
import { exportInvoicePDF, printInvoicePDF } from "@/lib/pdfUtils";

const STATUS_C = { draft:"bg-gray-100 text-gray-600", sent:"bg-blue-100 text-blue-700", paid:"bg-green-100 text-green-700", overdue:"bg-red-100 text-red-700", cancelled:"bg-gray-100 text-gray-400" };

export default function BillingModule() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ project_id:"", client_name:"", client_email:"", amount:0, tax_rate:0, total_amount:0, due_date:"", notes:"", currency:"USD", status:"draft" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [inv, p, ts, ex] = await Promise.all([base44.entities.Invoice.list('-created_date'), base44.entities.Project.list(), base44.entities.Timesheet.list(), base44.entities.Expense.list()]);
    setInvoices(inv); setProjects(p); setTimesheets(ts); setExpenses(ex); setLoading(false);
  }

  function autoPopulate(projectId) {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const projTs = timesheets.filter(t => t.project_id === projectId && t.status === "approved");
    const laborCost = projTs.reduce((s, t) => s + (t.hours * (proj.billing_rate || 75)), 0);
    const projEx = expenses.filter(e => e.project_id === projectId && e.status === "approved").reduce((s, e) => s + e.amount, 0);
    const amount = laborCost + projEx;
    setForm(f => ({ ...f, project_id: projectId, client_name: proj.client_name || "", client_email: proj.client_email || "", amount, total_amount: amount * (1 + (f.tax_rate || 0) / 100) }));
  }

  function updateTax(tax) {
    setForm(f => ({ ...f, tax_rate: tax, total_amount: f.amount * (1 + tax / 100) }));
  }

  async function handleSave() {
    setSaving(true);
    const proj = projects.find(p => p.id === form.project_id);
    const num = `INV-${Date.now().toString().slice(-6)}`;
    await base44.entities.Invoice.create({ ...form, project_name: proj?.name || "", invoice_number: num });
    await loadData(); setSaving(false); setShowDialog(false);
    setForm({ project_id:"", client_name:"", client_email:"", amount:0, tax_rate:0, total_amount:0, due_date:"", notes:"", currency:"USD", status:"draft" });
  }

  async function updateStatus(id, status) {
    await base44.entities.Invoice.update(id, { status, ...(status === "paid" ? { paid_date: localDateKey() } : {}) });
    setInvoices(inv => inv.map(i => i.id === id ? { ...i, status } : i));
  }

  function downloadPDF(inv) {
    exportInvoicePDF(inv);
  }

  const filtered = filterStatus === "all" ? invoices : invoices.filter(i => i.status === filterStatus);
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total_amount || 0), 0);
  const pending = invoices.filter(i => i.status === "sent").reduce((s, i) => s + (i.total_amount || 0), 0);
  const overdue = invoices.filter(i => i.status === "overdue").length;
  const draft = invoices.filter(i => i.status === "draft").length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#210F37] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-[#210F37]">Billing & Invoicing</h2><p className="text-gray-500 text-sm">{invoices.length} invoices · Generate from timesheets & expenses</p></div>
        <Button onClick={() => setShowDialog(true)} className="bg-[#210F37] hover:bg-[#4F1C51] text-white"><Plus className="w-4 h-4 mr-1" /> New Invoice</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Collected", value: `$${(totalRevenue/1000).toFixed(1)}k`, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pending Payment", value: `$${(pending/1000).toFixed(1)}k`, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Overdue Invoices", value: overdue, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
          { label: "Draft Invoices", value: draft, icon: FileText, color: "text-gray-500", bg: "bg-gray-50" },
        ].map(k => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div><p className="text-xl font-bold text-[#210F37]">{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all","draft","sent","paid","overdue","cancelled"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filterStatus === s ? "bg-[#210F37] text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-[#210F37]"}`}>{s}</button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        {filtered.map(inv => (
          <div key={inv.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-sm text-[#210F37]">{inv.invoice_number || "Draft"}</p>
                  <Badge className={`text-xs ${STATUS_C[inv.status]}`}>{inv.status}</Badge>
                </div>
                <p className="text-xs text-gray-500">{inv.client_name} · {inv.project_name}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                  {inv.due_date && <span>Due: {inv.due_date}</span>}
                  {inv.paid_date && <span>Paid: {inv.paid_date}</span>}
                  {inv.currency && <span>{inv.currency}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-[#210F37]">${(inv.total_amount || inv.amount || 0).toLocaleString()}</p>
                {inv.tax_rate > 0 && <p className="text-xs text-gray-400">incl. {inv.tax_rate}% tax</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              {inv.status === "draft" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(inv.id, "sent")}>Mark Sent</Button>}
              {inv.status === "sent" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(inv.id, "paid")}>Mark Paid</Button>}
              {inv.status === "sent" && <Button size="sm" variant="outline" className="h-7 text-xs text-red-500" onClick={() => updateStatus(inv.id, "overdue")}>Mark Overdue</Button>}
              <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => downloadPDF(inv)}><Download className="w-3.5 h-3.5 mr-1" /> PDF</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => printInvoicePDF(inv)}><Printer className="w-3.5 h-3.5 mr-1" /> Print</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No invoices found</p></div>}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-[#210F37]">Create Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => { setForm(f=>({...f,project_id:v})); autoPopulate(v); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Client Name</Label><Input value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))} className="mt-1" /></div>
              <div><Label>Client Email</Label><Input value={form.client_email} onChange={e=>setForm(f=>({...f,client_email:e.target.value}))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount ($)</Label><Input type="number" value={form.amount} onChange={e=>{ const v=+e.target.value; setForm(f=>({...f,amount:v,total_amount:v*(1+f.tax_rate/100)})); }} className="mt-1" /></div>
              <div><Label>Tax Rate (%)</Label><Input type="number" value={form.tax_rate} onChange={e=>updateTax(+e.target.value)} className="mt-1" /></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm"><span className="font-semibold">Total: </span><span className="text-[#210F37] font-bold">${(form.total_amount||form.amount||0).toLocaleString()}</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} className="mt-1" /></div>
              <div><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v=>setForm(f=>({...f,currency:v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","EUR","GBP","AED","SAR"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving||!form.project_id} className="bg-[#210F37] hover:bg-[#4F1C51] text-white">{saving?"Saving…":"Create Invoice"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}