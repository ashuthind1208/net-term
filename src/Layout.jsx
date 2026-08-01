import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Receipt,
  Clock, Users, Menu, ChevronDown, LogOut,
  User, Trello, FileText, MessageSquare, Calendar, ShoppingCart, DollarSign,
  Shield, UserCheck, Building2, BookOpen, CreditCard,
  Bell, Trophy
} from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

// Admin nav items (shown only to admins)
const ADMIN_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { label: "Projects", icon: FolderKanban, page: "Projects" },
  { label: "Tasks", icon: CheckSquare, page: "Tasks" },
  { label: "Expenses", icon: Receipt, page: "Expenses" },
  { label: "Timesheets", icon: Clock, page: "Timesheets" },
  { label: "Employees", icon: Users, page: "Employees" },
  { label: "Task Assignment", icon: Trello, page: "TaskAssignment" },
  { label: "Procurement", icon: ShoppingCart, page: "Procurement" },
  { label: "Billing & Invoicing", icon: CreditCard, page: "BillingModule" },
  { label: "Resource Planning", icon: UserCheck, page: "ResourcePlanning" },
  { label: "Performance", icon: Trophy, page: "PerformanceRewards" },
  { label: "Reports", icon: FileText, page: "Reports" },
  { label: "Gantt / Scheduler", icon: Calendar, page: "GanttScheduler" },
  { label: "Document Hub", icon: BookOpen, page: "DocumentHub" },
  { label: "Notifications", icon: Bell, page: "NotificationCenter" },
  { label: "Compliance & Audit", icon: Shield, page: "ComplianceAudit" },
  { label: "Team Connect", icon: MessageSquare, page: "TeamConnect" },
];

// Employee nav items (shown only to non-admins)
const EMPLOYEE_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, page: "MyWork" },
  { label: "Projects", icon: FolderKanban, page: "Projects" },
  { label: "Tasks", icon: CheckSquare, page: "Tasks" },
  { label: "Expenses", icon: Receipt, page: "Expenses" },
  { label: "Timesheets", icon: Clock, page: "Timesheets" },
  { label: "Performance", icon: Trophy, page: "PerformanceRewards" },
  { label: "Notifications", icon: Bell, page: "NotificationCenter" },
  { label: "Team Connect", icon: MessageSquare, page: "TeamConnect" },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setIsAdmin(u?.role === "admin");
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const filteredNav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#4F1C51]/30">
        <img src="/netterm-logo.svg" alt="Net Term Solutions" className="w-full h-12 object-contain object-left" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map(({ label, icon: Icon, page }) => {
          const path = createPageUrl(page);
          const active = location.pathname === path || location.pathname === `/${page}`;
          return (
            <Link
              key={page}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                active
                  ? "bg-[#A55B4B] text-white shadow-lg"
                  : "text-[#DCA06D]/70 hover:bg-[#4F1C51] hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm flex-1">{label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-[#DCA06D]" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-4 border-t border-[#4F1C51]/30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#4F1C51] transition-colors">
                <Avatar className="w-8 h-8 border-2 border-[#A55B4B]">
                  <AvatarImage src={user.photo_url} />
                  <AvatarFallback className="bg-[#A55B4B] text-white text-xs">
                    {user.full_name?.[0] || user.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.full_name || "User"}</p>
                  <p className="text-[#DCA06D]/60 text-xs truncate">{user.role || "user"}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-[#DCA06D]/60 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to={createPageUrl("Profile")} className="flex items-center gap-2">
                  <User className="w-4 h-4" /> My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-[#F5F0FF] flex overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        :root {
          --color-primary: #210F37;
          --color-secondary: #4F1C51;
          --color-accent: #A55B4B;
          --color-gold: #DCA06D;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #4F1C51; border-radius: 2px; }
      `}</style>

      <style>{`
        .sidebar-full { height: 100vh; height: 100dvh; }
      `}</style>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 sidebar-full w-64 z-50 transition-transform duration-300
        bg-gradient-to-b from-[#210F37] to-[#4F1C51]
        lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:self-start
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-[#210F37]" />
            </button>
            <h1 className="text-[#210F37] font-semibold text-base hidden sm:block">
              {currentPageName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            {user && <NotificationBell userEmail={user.email} />}
            {isAdmin && (
              <Badge className="bg-[#A55B4B] text-white text-xs">Admin</Badge>
            )}
            {user && (
              <Avatar className="w-8 h-8 border-2 border-[#A55B4B] cursor-pointer">
                <AvatarImage src={user.photo_url} />
                <AvatarFallback className="bg-[#A55B4B] text-white text-xs">
                  {user.full_name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}