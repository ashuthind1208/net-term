import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, X, FolderKanban, CheckSquare, Receipt, ShoppingCart, Users, Loader2 } from "lucide-react";

const CATEGORY_CONFIG = {
  project:     { icon: FolderKanban, color: "text-purple-600 bg-purple-50",  label: "Project",     path: "/Projects" },
  task:        { icon: CheckSquare,  color: "text-blue-600 bg-blue-50",      label: "Task",        path: "/Tasks" },
  expense:     { icon: Receipt,      color: "text-orange-600 bg-orange-50",  label: "Expense",     path: "/Expenses" },
  procurement: { icon: ShoppingCart, color: "text-green-600 bg-green-50",    label: "Procurement", path: "/Procurement" },
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const lq = q.toLowerCase();
    try {
      const [projects, tasks, expenses, procurements] = await Promise.allSettled([
        base44.entities.Project.list(),
        base44.entities.Task.list(),
        base44.entities.Expense.list(),
        base44.entities.Procurement.list(),
      ]);

      const hits = [];

      (projects.value || []).filter(p =>
        p.name?.toLowerCase().includes(lq) ||
        p.client_name?.toLowerCase().includes(lq) ||
        p.description?.toLowerCase().includes(lq)
      ).slice(0, 4).forEach(p => hits.push({ type: "project", id: p.id, title: p.name, subtitle: p.client_name || p.status }));

      (tasks.value || []).filter(t =>
        t.title?.toLowerCase().includes(lq) ||
        t.project_name?.toLowerCase().includes(lq) ||
        t.description?.toLowerCase().includes(lq)
      ).slice(0, 4).forEach(t => hits.push({ type: "task", id: t.id, title: t.title, subtitle: t.project_name || t.status }));

      (expenses.value || []).filter(e =>
        e.title?.toLowerCase().includes(lq) ||
        e.project_name?.toLowerCase().includes(lq) ||
        e.category?.toLowerCase().includes(lq)
      ).slice(0, 3).forEach(e => hits.push({ type: "expense", id: e.id, title: e.title, subtitle: `$${e.amount} · ${e.project_name || ""}` }));

      (procurements.value || []).filter(p =>
        p.title?.toLowerCase().includes(lq) ||
        p.vendor_supplier?.toLowerCase().includes(lq) ||
        p.category?.toLowerCase().includes(lq) ||
        p.project_name?.toLowerCase().includes(lq)
      ).slice(0, 4).forEach(p => hits.push({ type: "procurement", id: p.id, title: p.title, subtitle: `${p.vendor_supplier || p.category} · ${p.project_name || ""}` }));

      setResults(hits);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSelect = (item) => {
    navigate(CATEGORY_CONFIG[item.type].path);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm transition-colors"
    >
      <Search className="w-4 h-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-400">⌘K</kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#210F37]/65 px-4 pt-[8vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-[#DCA06D]/35 bg-white shadow-[0_28px_90px_rgba(33,15,55,0.32)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-between border-b border-[#DCA06D]/35 bg-gradient-to-r from-[#F8F4FA] via-white to-[#FFF8F2] px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-gradient-to-r after:from-[#A55B4B] after:via-[#DCA06D] after:to-transparent">
          <div>
            <p className="text-[17px] font-bold leading-snug text-[#210F37]">Search workspace</p>
            <p className="mt-0.5 text-xs text-[#766A7A]">Projects, tasks, expenses, and procurement</p>
          </div>
          <button onClick={() => setOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCA06D]/40 bg-white/90 text-[#4F1C51] shadow-sm transition-colors hover:bg-[#FFF8F2] hover:text-[#A55B4B]" title="Close search">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 border-b border-[#DCA06D]/20 px-4 py-3">
          {loading ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin shrink-0" /> : <Search className="w-5 h-5 text-gray-400 shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tasks, expenses, procurements..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <p className="text-center text-gray-400 text-sm py-8">No results found for "{query}"</p>
          )}
          {results.length === 0 && !query.trim() && (
            <p className="text-center text-gray-400 text-sm py-8">Start typing to search across the platform</p>
          )}
          {results.map((item, i) => {
            const cfg = CATEGORY_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <button
                key={`${item.type}-${item.id}-${i}`}
                onClick={() => handleSelect(item)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex gap-4 border-t border-[#DCA06D]/30 bg-[#FBF9FB] px-4 py-2.5 text-xs text-gray-400">
          <span><kbd className="bg-gray-100 px-1 rounded">↵</kbd> to navigate</span>
          <span><kbd className="bg-gray-100 px-1 rounded">esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}