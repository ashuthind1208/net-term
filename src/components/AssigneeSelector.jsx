import { useState, useRef, useEffect } from "react";
import { Search, X, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function AssigneeSelector({ users = [], selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = users.filter(u =>
    (u.full_name || u.email).toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (email) => {
    onChange(selected.includes(email) ? selected.filter(e => e !== email) : [...selected, email]);
  };

  const selectedUsers = users.filter(u => selected.includes(u.email));

  return (
    <div ref={ref} className="relative">
      {/* Trigger box */}
      <div
        className="min-h-9 w-full border border-input rounded-md px-3 py-1.5 flex flex-wrap gap-1.5 items-center cursor-pointer bg-white"
        onClick={() => setOpen(v => !v)}
      >
        {selectedUsers.length === 0 && (
          <span className="text-muted-foreground text-sm">Select assignees…</span>
        )}
        {selectedUsers.map(u => (
          <Badge key={u.email} className="bg-[#A55B4B] text-white flex items-center gap-1 pr-1">
            <Avatar className="w-4 h-4">
              <AvatarImage src={u.photo_url} />
              <AvatarFallback className="bg-[#4F1C51] text-white text-xs">{(u.full_name || u.email)[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{u.full_name || u.email}</span>
            <button
              onClick={e => { e.stopPropagation(); toggle(u.email); }}
              className="ml-0.5 hover:bg-[#4F1C51] rounded-full p-0.5"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-input rounded-md shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                className="pl-7 h-8 text-sm"
                placeholder="Search employees…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">No users found</p>
            )}
            {filtered.map(u => {
              const isSelected = selected.includes(u.email);
              return (
                <div
                  key={u.email}
                  onClick={() => toggle(u.email)}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-[#FFF5F3]" : ""}`}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={u.photo_url} />
                    <AvatarFallback className="bg-[#A55B4B] text-white text-xs">{(u.full_name || u.email)[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#210F37] truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#A55B4B] flex-shrink-0" />}
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="p-2 border-t">
              <button onClick={() => onChange([])} className="text-xs text-red-500 hover:underline">Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}