import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";

function formatDateTime(date: Date) {
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("en-US", { hour12: true });
  return `${dateStr} \u00b7 ${timeStr}`;
}

interface HeaderProps {
  onToggleSidebar?: () => void;
  initials?: string;
  label?: string;
  sublabel?: string;
  onLogout?: () => void;
}

export default function Header({ onToggleSidebar = () => {}, initials = "BA", label = "System Admin", sublabel = "Barangay Admin", onLogout = () => window.location.reload() }: HeaderProps) {
  const [now, setNow] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function close() {
      setMenuOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between border-b border-black/5 bg-[#DCFCE7] px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-1.5 text-[#64748B] hover:bg-stone-200/60"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
      </div>
      <div className="flex items-center gap-2 sm:gap-5">
        <span className="hidden sm:inline text-[12px] text-[#94A3B8]">{formatDateTime(now)}</span>
        <button className="relative rounded-full p-1.5 text-[#64748B] hover:bg-stone-100" aria-label="Notifications">
          <Bell size={16} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-400" />
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-stone-200/60"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#15803D]/10 text-[11px] font-semibold text-[#15803D]">
              {initials}
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <div className="text-[12px] font-medium text-[#334155]">{label}</div>
              <div className="text-[10px] text-[#94A3B8]">{sublabel}</div>
            </div>
            <ChevronDown size={14} className={`text-[#94A3B8] transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-black/5 bg-white text-[12px] font-medium shadow-lg">
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
