import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, X, CheckCheck, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

const TYPE_COLORS = {
  task: "bg-blue-100 text-blue-700",
  expense: "bg-orange-100 text-orange-700",
  timesheet: "bg-purple-100 text-purple-700",
  procurement: "bg-yellow-100 text-yellow-700",
  project: "bg-green-100 text-green-700",
  blocker: "bg-red-100 text-red-700",
  general: "bg-gray-100 text-gray-700",
};

export default function NotificationBell({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    if (!userEmail) return;
    const all = await base44.entities.Notification.filter(
      { recipient_email: userEmail },
      "-created_date",
      50
    );
    setNotifications(all || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [userEmail]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter(n => !n.is_read);

  const markAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.is_read);
    await Promise.all(unreadItems.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = async (n) => {
    if (!n.is_read) {
      await base44.entities.Notification.update(n.id, { is_read: true });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    if (n.link_page) navigate(createPageUrl(n.link_page));
    setOpen(false);
  };

  const dismiss = async (e, n) => {
    e.stopPropagation();
    await base44.entities.Notification.delete(n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-[#210F37]" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#A55B4B] text-white text-[9px] flex items-center justify-center font-bold leading-none">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#210F37] to-[#4F1C51]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#DCA06D]" />
              <span className="text-white font-semibold text-sm">Notifications</span>
              {unread.length > 0 && (
                <Badge className="bg-[#A55B4B] text-white text-[10px] px-1.5 py-0">{unread.length} new</Badge>
              )}
            </div>
            {unread.length > 0 && (
              <button onClick={markAllRead} className="text-[#DCA06D] hover:text-white text-xs flex items-center gap-1 transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Inbox className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 group ${!n.is_read ? "bg-blue-50/40" : ""}`}
                >
                  <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${!n.is_read ? "bg-[#A55B4B]" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[n.type] || TYPE_COLORS.general}`}>
                        {n.type}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                        {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-xs font-semibold truncate ${!n.is_read ? "text-[#210F37]" : "text-gray-600"}`}>{n.title}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>
                  </div>
                  <button
                    onClick={(e) => dismiss(e, n)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 hover:text-red-500 text-gray-400 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}