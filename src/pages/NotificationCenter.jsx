import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCheck, Trash2, Clock, CheckCircle2, AlertTriangle, FileText, ShoppingCart, FolderKanban } from "lucide-react";

const TYPE_ICONS = { task: CheckCircle2, expense: FileText, timesheet: Clock, procurement: ShoppingCart, project: FolderKanban, blocker: AlertTriangle, general: Bell };
const TYPE_COLORS = { task:"text-blue-500", expense:"text-green-600", timesheet:"text-purple-500", procurement:"text-orange-500", project:"text-[#A55B4B]", blocker:"text-red-500", general:"text-gray-500" };
const TYPE_BG = { task:"bg-blue-50", expense:"bg-green-50", timesheet:"bg-purple-50", procurement:"bg-orange-50", project:"bg-[#A55B4B]/10", blocker:"bg-red-50", general:"bg-gray-50" };

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      loadNotifications(u.email);
      // Subscribe to real-time notification updates
      const unsub = base44.entities.Notification.subscribe((event) => {
        if (event.type === "create" && event.data?.recipient_email === u.email) {
          setNotifications(prev => [event.data, ...prev]);
        } else if (event.type === "update") {
          setNotifications(prev => prev.map(x => x.id === event.id ? event.data : x));
        } else if (event.type === "delete") {
          setNotifications(prev => prev.filter(x => x.id !== event.id));
        }
      });
      return unsub;
    }).catch(() => setLoading(false));
  }, []);

  async function loadNotifications(email) {
    const n = await base44.entities.Notification.filter({ recipient_email: email }, '-created_date', 100);
    setNotifications(n); setLoading(false);
  }

  async function markRead(id) {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
  }

  async function deleteNotif(id) {
    await base44.entities.Notification.delete(id);
    setNotifications(n => n.filter(x => x.id !== id));
  }

  async function clearAll() {
    const read = notifications.filter(n => n.is_read);
    await Promise.all(read.map(n => base44.entities.Notification.delete(n.id)));
    setNotifications(n => n.filter(x => !x.is_read));
  }

  let filtered = notifications;
  if (filter === "unread") filtered = filtered.filter(n => !n.is_read);
  if (filter === "read") filtered = filtered.filter(n => n.is_read);
  if (typeFilter !== "all") filtered = filtered.filter(n => n.type === typeFilter);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Group by date
  const grouped = filtered.reduce((acc, n) => {
    const d = n.created_date ? new Date(n.created_date).toLocaleDateString() : "Unknown";
    if (!acc[d]) acc[d] = [];
    acc[d].push(n);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#210F37] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-7 h-7 text-[#210F37]" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>}
          </div>
          <div><h2 className="text-xl font-bold text-[#210F37]">Notification Center</h2><p className="text-gray-500 text-sm">{unreadCount} unread · {notifications.length} total</p></div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && <Button size="sm" variant="outline" onClick={markAllRead}><CheckCheck className="w-4 h-4 mr-1" /> Mark All Read</Button>}
          <Button size="sm" variant="ghost" className="text-gray-400" onClick={clearAll}><Trash2 className="w-4 h-4 mr-1" /> Clear Read</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex border rounded-lg overflow-hidden">
          {["all","unread","read"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === f ? "bg-[#210F37] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{f}</button>
          ))}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["task","expense","timesheet","procurement","project","blocker","general"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Notifications grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Bell className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>No notifications</p></div>
      ) : (
        Object.entries(grouped).map(([date, notifs]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{date}</p>
            <div className="space-y-2">
              {notifs.map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (
                  <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${n.is_read ? "bg-white border border-gray-100" : "bg-white border border-[#210F37]/20 shadow-sm"}`} onClick={() => !n.is_read && markRead(n.id)}>
                    <div className={`w-9 h-9 rounded-xl ${TYPE_BG[n.type] || "bg-gray-50"} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${TYPE_COLORS[n.type] || "text-gray-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${n.is_read ? "text-gray-600" : "text-[#210F37]"}`}>{n.title}</p>
                        {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#A55B4B] flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      {n.sender_name && <p className="text-xs text-gray-400 mt-1">From: {n.sender_name}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!n.is_read && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); markRead(n.id); }}><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></Button>}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}