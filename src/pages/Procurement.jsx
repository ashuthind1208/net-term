import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Search, ShoppingCart, Package, Wrench, Network,
  CheckCircle2, Clock, XCircle, Truck, DollarSign, AlertTriangle,
  Edit2, Trash2, FileText, Eye, BarChart3, Layers, MinusCircle
} from "lucide-react";

const CATEGORY_ICONS = {
  tools: Wrench, equipment: Package, networking: Network, wiring: Network,
  hardware: Package, software: FileText, consumables: ShoppingCart, other: Package
};
const CATEGORY_COLORS = {
  tools: "bg-orange-100 text-orange-700", equipment: "bg-blue-100 text-blue-700",
  networking: "bg-purple-100 text-purple-700", wiring: "bg-yellow-100 text-yellow-700",
  hardware: "bg-indigo-100 text-indigo-700", software: "bg-cyan-100 text-cyan-700",
  consumables: "bg-green-100 text-green-700", other: "bg-gray-100 text-gray-700"
};
const STATUS_CONFIG = {
  draft:            { label: "Draft",            color: "bg-gray-100 text-gray-600",     icon: FileText },
  pending_approval: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved:         { label: "Approved",         color: "bg-blue-100 text-blue-700",     icon: CheckCircle2 },
  ordered:          { label: "Ordered",          color: "bg-indigo-100 text-indigo-700", icon: ShoppingCart },
  delivered:        { label: "Delivered",        color: "bg-green-100 text-green-700",   icon: Truck },
  cancelled:        { label: "Cancelled",        color: "bg-red-100 text-red-700",       icon: XCircle },
};
const TYPE_COLORS = {
  purchase: "bg-blue-100 text-blue-700", sale: "bg-green-100 text-green-700",
  rental: "bg-purple-100 text-purple-700", service: "bg-orange-100 text-orange-700"
};
const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600", medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700"
};

const DEFAULT_FORM = {
  title: "", type: "purchase", category: "equipment", project_id: "", project_name: "",
  vendor_supplier: "", quantity: 1, unit: "pcs", unit_price: "", total_amount: "",
  currency: "USD", status: "draft", priority: "medium",
  order_date: "", expected_delivery: "", description: "", notes: "",
  location_assigned: "", warranty_until: "", reorder_threshold: "", quantity_available: ""
};

export default function Procurement() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("items");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  // Usage log form
  const [showUsageForm, setShowUsageForm] = useState(false);
  const [usageItem, setUsageItem] = useState(null);
  const [usageForm, setUsageForm] = useState({ quantity_used: 1, usage_date: format(new Date(), "yyyy-MM-dd"), notes: "", project_id: "", project_name: "" });
  const [savingUsage, setSavingUsage] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async me => {
      setUser(me);
      setIsAdmin(me?.role === "admin");
      const [pR, prR, uR] = await Promise.allSettled([
        base44.entities.Project.list(),
        base44.entities.Procurement.list("-created_date"),
        base44.entities.AssetUsage.list("-created_date"),
      ]);
      setProjects(pR.value || []);
      setItems(prR.value || []);
      setUsageLogs(uR.value || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const [prR, uR] = await Promise.allSettled([
      base44.entities.Procurement.list("-created_date"),
      base44.entities.AssetUsage.list("-created_date"),
    ]);
    setItems(prR.value || []);
    setUsageLogs(uR.value || []);
  };

  const getUsedQty = (itemId) => usageLogs.filter(u => u.procurement_id === itemId).reduce((s, u) => s + (u.quantity_used || 0), 0);
  const getAvailableQty = (item) => {
    const used = getUsedQty(item.id);
    const base = item.quantity_available !== undefined && item.quantity_available !== "" ? parseFloat(item.quantity_available) : item.quantity;
    return Math.max(0, base - used);
  };
  const isLowStock = (item) => {
    const avail = getAvailableQty(item);
    const threshold = item.reorder_threshold ? parseFloat(item.reorder_threshold) : null;
    return threshold !== null && avail <= threshold;
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...DEFAULT_FORM, requested_by: user?.email, requested_by_name: user?.full_name });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...DEFAULT_FORM, ...item });
    setShowForm(true);
    setViewItem(null);
  };

  const handleProjectChange = (pid) => {
    const p = projects.find(p => p.id === pid);
    setForm(f => ({ ...f, project_id: pid, project_name: p?.name || "" }));
  };

  const handleQtyOrPrice = (field, value) => {
    const updated = { ...form, [field]: parseFloat(value) || "" };
    updated.total_amount = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
    setForm(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };
    if (!payload.total_amount) payload.total_amount = (parseFloat(payload.quantity) || 0) * (parseFloat(payload.unit_price) || 0);
    if (editItem) await base44.entities.Procurement.update(editItem.id, payload);
    else await base44.entities.Procurement.create(payload);
    setSaving(false);
    setShowForm(false);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Procurement.delete(id);
    setViewItem(null);
    refresh();
  };

  const handleStatusChange = async (id, status) => {
    const extra = {};
    if (status === "approved") { extra.approved_by = user?.email; extra.approved_at = new Date().toISOString(); }
    await base44.entities.Procurement.update(id, { status, ...extra });
    refresh();
  };

  const openUsageForm = (item) => {
    setUsageItem(item);
    setUsageForm({ quantity_used: 1, usage_date: format(new Date(), "yyyy-MM-dd"), notes: "", project_id: item.project_id || "", project_name: item.project_name || "" });
    setShowUsageForm(true);
  };

  const handleSaveUsage = async () => {
    setSavingUsage(true);
    await base44.entities.AssetUsage.create({
      ...usageForm,
      procurement_id: usageItem.id,
      procurement_title: usageItem.title,
      used_by: user?.email,
      used_by_name: user?.full_name,
      unit: usageItem.unit,
    });
    setSavingUsage(false);
    setShowUsageForm(false);
    refresh();
  };

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const matchQ = !q || (i.title || "").toLowerCase().includes(q) || (i.vendor_supplier || "").toLowerCase().includes(q) || (i.project_name || "").toLowerCase().includes(q);
    const matchS = filterStatus === "all" || i.status === filterStatus;
    const matchC = filterCategory === "all" || i.category === filterCategory;
    return matchQ && matchS && matchC;
  });

  const lowStockItems = items.filter(i => i.status === "delivered" && isLowStock(i));
  const totalValue = items.reduce((s, i) => s + (i.total_amount || 0), 0);
  const pendingCount = items.filter(i => i.status === "pending_approval").length;
  const deliveredCount = items.filter(i => i.status === "delivered").length;
  const criticalCount = items.filter(i => i.priority === "critical" && !["delivered", "cancelled"].includes(i.status)).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#A55B4B] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#210F37]">Inventory & Asset Management</h2>
          <p className="text-gray-500 text-sm">Procurement · Asset usage tracking · Inventory levels · Vendor management</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[{ id: "items", label: "Items" }, { id: "inventory", label: "Inventory" }, { id: "usage", label: "Usage Log" }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? "bg-white text-[#210F37] shadow-sm" : "text-gray-500 hover:text-[#210F37]"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <Button onClick={openCreate} className="bg-[#A55B4B] hover:bg-[#8a4a3b] text-white gap-2">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-500 bg-orange-50/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-orange-700 text-sm">Low Stock Alert — {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} below reorder threshold</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(i => (
                <Badge key={i.id} className="bg-orange-100 text-orange-700 text-xs">
                  {i.title}: {getAvailableQty(i).toFixed(0)} {i.unit} left (threshold: {i.reorder_threshold})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Value", value: `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "text-[#210F37]" },
          { label: "Pending Approval", value: pendingCount, icon: Clock, color: "text-yellow-600" },
          { label: "Delivered", value: deliveredCount, icon: Truck, color: "text-green-600" },
          { label: "Low Stock", value: lowStockItems.length, icon: AlertTriangle, color: lowStockItems.length > 0 ? "text-orange-500" : "text-gray-400" },
        ].map(k => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== ITEMS TAB ===== */}
      {activeTab === "items" && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {["tools","equipment","networking","wiring","hardware","software","consumables","other"].map(c =>
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Item", "Project", "Category", "Qty Ordered", "Used", "Available", "Status", "Priority", "Delivery", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="text-center text-gray-400 py-12">No procurement items found</td></tr>
                  )}
                  {filtered.map(item => {
                    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                    const CatIcon = CATEGORY_ICONS[item.category] || Package;
                    const usedQty = getUsedQty(item.id);
                    const availQty = getAvailableQty(item);
                    const lowStock = item.status === "delivered" && isLowStock(item);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${CATEGORY_COLORS[item.category] || "bg-gray-100 text-gray-500"}`}>
                              <CatIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <p className="font-medium text-[#210F37] truncate max-w-[140px]">{item.title}</p>
                                {lowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" title="Low stock" />}
                              </div>
                              <p className="text-xs text-gray-400 truncate max-w-[140px]">{item.vendor_supplier || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[100px] truncate">{item.project_name || "—"}</td>
                        <td className="px-4 py-3"><Badge className={`text-xs capitalize ${CATEGORY_COLORS[item.category]}`}>{item.category}</Badge></td>
                        <td className="px-4 py-3 text-gray-700">{item.quantity} {item.unit || ""}</td>
                        <td className="px-4 py-3 text-orange-600 font-medium">{usedQty > 0 ? `${usedQty} ${item.unit || ""}` : "—"}</td>
                        <td className="px-4 py-3">
                          {item.status === "delivered" ? (
                            <span className={`font-semibold ${lowStock ? "text-orange-500" : "text-green-600"}`}>
                              {availQty.toFixed(0)} {item.unit || ""}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3"><Badge className={`text-xs ${sc.color}`}>{sc.label}</Badge></td>
                        <td className="px-4 py-3"><Badge className={`text-xs capitalize ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</Badge></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{item.expected_delivery || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewItem(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#210F37]"><Eye className="w-4 h-4" /></button>
                            {item.status === "delivered" && (
                              <button onClick={() => openUsageForm(item)} className="p-1.5 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-500" title="Log Usage">
                                <MinusCircle className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#210F37]"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ===== INVENTORY TAB ===== */}
      {activeTab === "inventory" && (
        <div className="space-y-3">
          {items.filter(i => i.status === "delivered").length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center text-gray-400">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No delivered items in inventory yet</p>
              </CardContent>
            </Card>
          ) : (
            items.filter(i => i.status === "delivered").map(item => {
              const usedQty = getUsedQty(item.id);
              const totalQty = parseFloat(item.quantity_available !== undefined && item.quantity_available !== "" ? item.quantity_available : item.quantity) || 0;
              const availQty = Math.max(0, totalQty - usedQty);
              const usedPct = totalQty > 0 ? Math.min(100, Math.round((usedQty / totalQty) * 100)) : 0;
              const low = isLowStock(item);
              const CatIcon = CATEGORY_ICONS[item.category] || Package;
              return (
                <Card key={item.id} className={`border-0 shadow-sm ${low ? "border-l-4 border-l-orange-400" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${CATEGORY_COLORS[item.category]}`}>
                        <CatIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <h4 className="font-semibold text-[#210F37]">{item.title}</h4>
                            <p className="text-xs text-gray-400">{item.vendor_supplier || "—"} · {item.project_name || "—"}</p>
                          </div>
                          <div className="flex gap-2 items-center">
                            {low && <Badge className="bg-orange-100 text-orange-700 text-xs">Low Stock — Reorder</Badge>}
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openUsageForm(item)}>
                              <MinusCircle className="w-3 h-3 mr-1" /> Log Usage
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
                          {[
                            { label: "Total", value: `${totalQty} ${item.unit || ""}` },
                            { label: "Used", value: `${usedQty} ${item.unit || ""}`, color: "text-orange-600" },
                            { label: "Available", value: `${availQty.toFixed(0)} ${item.unit || ""}`, color: low ? "text-orange-500 font-bold" : "text-green-600" },
                            { label: "Reorder At", value: item.reorder_threshold ? `${item.reorder_threshold} ${item.unit || ""}` : "—" },
                            { label: "Location", value: item.location_assigned || "—" },
                          ].map(s => (
                            <div key={s.label} className="bg-gray-50 rounded-lg p-2">
                              <p className="text-xs text-gray-400">{s.label}</p>
                              <p className={`text-xs font-semibold mt-0.5 ${s.color || "text-[#210F37]"}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Usage progress</span>
                            <span className={usedPct > 80 ? "text-orange-500 font-medium" : "text-gray-500"}>{usedPct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full ${usedPct > 80 ? "bg-orange-400" : "bg-[#4F1C51]"}`} style={{ width: `${usedPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ===== USAGE LOG TAB ===== */}
      {activeTab === "usage" && (
        <div className="space-y-2">
          {usageLogs.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center text-gray-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No usage logged yet. Use "Log Usage" on a delivered item.</p>
              </CardContent>
            </Card>
          ) : (
            usageLogs.map(u => {
              const item = items.find(i => i.id === u.procurement_id);
              return (
                <div key={u.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item ? CATEGORY_COLORS[item.category] : "bg-gray-100 text-gray-500"}`}>
                    <MinusCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#210F37] truncate">{u.procurement_title}</p>
                    <p className="text-xs text-gray-400">
                      {u.project_name || "—"} · by {u.used_by_name || u.used_by?.split("@")[0] || "—"} · {u.usage_date ? format(parseLocalDate(u.usage_date), "MMM d, yyyy") : "—"}
                    </p>
                    {u.notes && <p className="text-xs text-gray-500 mt-0.5">{u.notes}</p>}
                  </div>
                  <span className="font-bold text-orange-600 shrink-0">{u.quantity_used} {u.unit || ""}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== Create/Edit Modal ===== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">{editItem ? "Edit Procurement Item" : "New Procurement Request"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Cat6 Ethernet Cable Roll" /></div>
            <div><Label>Project *</Label>
              <Select value={form.project_id} onValueChange={handleProjectChange}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["purchase","sale","rental","service"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["tools","equipment","networking","wiring","hardware","software","consumables","other"].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low","medium","high","critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Vendor / Supplier</Label><Input value={form.vendor_supplier} onChange={e => setForm(f => ({ ...f, vendor_supplier: e.target.value }))} placeholder="Supplier name" /></div>
            <div><Label>Location / Site</Label><Input value={form.location_assigned} onChange={e => setForm(f => ({ ...f, location_assigned: e.target.value }))} placeholder="e.g. Server Room A" /></div>
            <div><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={e => handleQtyOrPrice("quantity", e.target.value)} /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs / meters / rolls..." /></div>
            <div><Label>Unit Price ($)</Label><Input type="number" min={0} step="0.01" value={form.unit_price} onChange={e => handleQtyOrPrice("unit_price", e.target.value)} placeholder="0.00" /></div>
            <div><Label>Total Amount ($)</Label><Input readOnly value={form.total_amount ? Number(form.total_amount).toFixed(2) : ""} className="bg-gray-50" /></div>
            <div><Label>Reorder Threshold ({form.unit || "units"})</Label><Input type="number" min={0} value={form.reorder_threshold} onChange={e => setForm(f => ({ ...f, reorder_threshold: e.target.value }))} placeholder="Alert when stock falls below..." /></div>
            <div><Label>Initial Available Qty</Label><Input type="number" min={0} value={form.quantity_available} onChange={e => setForm(f => ({ ...f, quantity_available: e.target.value }))} placeholder="Defaults to ordered qty" /></div>
            <div><Label>Order Date</Label><Input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} /></div>
            <div><Label>Expected Delivery</Label><Input type="date" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} /></div>
            <div><Label>Warranty Until</Label><Input type="date" value={form.warranty_until} onChange={e => setForm(f => ({ ...f, warranty_until: e.target.value }))} /></div>
            {isAdmin && (
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2"><Label>Description</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the item..." className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="sm:col-span-2"><Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional notes..." className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.project_id} className="bg-[#A55B4B] hover:bg-[#8a4a3b] text-white">
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Usage Modal */}
      <Dialog open={showUsageForm} onOpenChange={setShowUsageForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#210F37]">Log Usage — {usageItem?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {usageItem && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Available: <strong className="text-[#210F37]">{getAvailableQty(usageItem).toFixed(0)} {usageItem.unit}</strong>
              </p>
            )}
            <div><Label>Quantity Used *</Label>
              <Input type="number" min={0.1} step="0.1" value={usageForm.quantity_used} onChange={e => setUsageForm(f => ({ ...f, quantity_used: parseFloat(e.target.value) || 1 }))} className="mt-1" />
            </div>
            <div><Label>Project</Label>
              <Select value={usageForm.project_id} onValueChange={v => { const p = projects.find(p => p.id === v); setUsageForm(f => ({ ...f, project_id: v, project_name: p?.name || "" })); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent><SelectItem value={null}>No project</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={usageForm.usage_date} onChange={e => setUsageForm(f => ({ ...f, usage_date: e.target.value }))} className="mt-1" /></div>
            <div><Label>Notes</Label><Input value={usageForm.notes} onChange={e => setUsageForm(f => ({ ...f, notes: e.target.value }))} placeholder="Where/how used..." className="mt-1" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowUsageForm(false)}>Cancel</Button>
            <Button onClick={handleSaveUsage} disabled={savingUsage} className="bg-[#A55B4B] hover:bg-[#8a4a3b] text-white">
              {savingUsage ? "Saving..." : "Log Usage"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Detail Modal */}
      {viewItem && (
        <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#210F37] flex items-center gap-2">
                <Package className="w-5 h-5 text-[#A55B4B]" /> {viewItem.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge className={`capitalize ${CATEGORY_COLORS[viewItem.category]}`}>{viewItem.category}</Badge>
                <Badge className={`capitalize ${TYPE_COLORS[viewItem.type]}`}>{viewItem.type}</Badge>
                <Badge className={STATUS_CONFIG[viewItem.status]?.color}>{STATUS_CONFIG[viewItem.status]?.label}</Badge>
                <Badge className={`capitalize ${PRIORITY_COLORS[viewItem.priority]}`}>{viewItem.priority}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 bg-gray-50 rounded-xl p-4">
                {[
                  ["Project", viewItem.project_name || "—"],
                  ["Vendor", viewItem.vendor_supplier || "—"],
                  ["Quantity", `${viewItem.quantity} ${viewItem.unit || ""}`],
                  ["Used", `${getUsedQty(viewItem.id)} ${viewItem.unit || ""}`],
                  ["Available", `${getAvailableQty(viewItem).toFixed(0)} ${viewItem.unit || ""}`],
                  ["Reorder At", viewItem.reorder_threshold ? `${viewItem.reorder_threshold} ${viewItem.unit || ""}` : "—"],
                  ["Unit Price", `$${viewItem.unit_price || 0}`],
                  ["Total", `$${(viewItem.total_amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
                  ["Location", viewItem.location_assigned || "—"],
                  ["Warranty Until", viewItem.warranty_until || "—"],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-medium text-[#210F37]">{v}</p></div>
                ))}
              </div>
              {isAdmin && !["delivered","cancelled"].includes(viewItem.status) && (
                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  <p className="text-xs text-gray-400 w-full">Update Status:</p>
                  {Object.entries(STATUS_CONFIG).filter(([k]) => k !== viewItem.status).map(([k, v]) => (
                    <button key={k} onClick={() => { handleStatusChange(viewItem.id, k); setViewItem(p => ({ ...p, status: k })); }}
                      className={`text-xs px-3 py-1.5 rounded-lg ${v.color} hover:opacity-80 transition font-medium`}>{v.label}</button>
                  ))}
                </div>
              )}
              {isAdmin && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(viewItem)}><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(viewItem.id)}><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}