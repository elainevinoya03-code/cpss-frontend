import {
  LayoutGrid,
  Users,
  Settings,
  Map,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  LayoutDashboard,
  BarChart3,
  Radio,
  Archive,
  MessageSquare,
  Camera,
  Flag,
  Video,
  Play,
  ClipboardList,
  Megaphone,
  ArrowUpRight,
  Route,
  FileSearch,
  Shield,
  BellRing,
  CalendarClock,
  AlertTriangle,
  Eye,
} from "lucide-react";
import logo from "../../assets/logo.png";

const ADMIN_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "users", label: "User Management", icon: Users },
  { key: "iot", label: "IoT Provisioning", icon: Settings },
  { key: "cctv", label: "CCTV Placement", icon: Camera },
  { key: "boundaries", label: "Digital Boundaries", icon: Map },
  { key: "logs", label: "Audit Logs", icon: FileText },
  { key: "data_requests", label: "Data Requests", icon: FileSearch },
  { key: "settings", label: "System Settings", icon: SlidersHorizontal },
];

const CAPTAIN_NAV_ITEMS = [
  { key: "dashboard", label: "Executive Safety Dashboard", icon: LayoutDashboard },
  { key: "analytics", label: "Purok Analytics & Reports", icon: BarChart3 },
  { key: "broadcasts", label: "Emergency Broadcasts", icon: Radio },
  { key: "patrol", label: "Patrol Coverage Map", icon: Map },
  { key: "evidence", label: "CCTV Evidence Viewer", icon: Video },
  { key: "bulletins", label: "News & Bulletins", icon: Megaphone },
  { key: "cases", label: "Closed Incidents", icon: Archive },
];

const DESK_OFFICER_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "incident_triage", label: "Incident Triage", icon: ClipboardList },
  { key: "alert_management", label: "Alert Management", icon: BellRing },
  { key: "dispatches", label: "Active Dispatches", icon: Radio },
  { key: "patrol", label: "Patrol Operations", icon: Map },
  { key: "blotter", label: "Digital Barangay Blotter", icon: FileText },
  { key: "chat", label: "Operations Chat Center", icon: MessageSquare },
  { key: "footage_requests", label: "Video Clip Requests", icon: Video },
];

const CCTV_OPERATOR_NAV_ITEMS = [
  { key: "surveillance", label: "Surveillance Matrix", icon: LayoutGrid },
  { key: "live_monitoring", label: "Live Monitoring", icon: Eye },
  { key: "camera_map", label: "Camera Map", icon: Map },
  { key: "recorded_footage", label: "Recorded Footage & Evidence", icon: Camera },
  { key: "footage_requests", label: "Footage Requests", icon: FileSearch },
];

const PUROK_LEADER_NAV_ITEMS = [
  { key: "reports", label: "Local Reports", icon: ClipboardList },
  { key: "escalated", label: "Escalated Cases", icon: ArrowUpRight },
  { key: "announcements", label: "Purok Announcements", icon: Megaphone },
  { key: "contacts", label: "Contacts", icon: Users },
];

const CHIEF_TANOD_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "patrol_scheduling", label: "Patrol Scheduling", icon: CalendarClock },
  { key: "live_tracking", label: "Live Tanod Tracking", icon: Map },
  { key: "incidents", label: "Incident Oversight", icon: AlertTriangle },
  { key: "referred_cases", label: "Referred Cases", icon: ArrowUpRight },
  { key: "team_performance", label: "Team Performance", icon: Users },
  { key: "neighborhood_watch", label: "Neighborhood Watch", icon: Shield },
  { key: "reports_analytics", label: "Reports & Analytics", icon: FileText },
];

const TANOD_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "patrol_scheduling", label: "Patrol Scheduling", icon: CalendarClock },
  { key: "live_tracking", label: "Live Tanod Tracking", icon: Map },
  { key: "incidents", label: "Incident Oversight", icon: AlertTriangle },
];

const EX_O_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "patrol", label: "Patrol Routes", icon: Route },
];

interface SidebarProps {
  activeKey?: string;
  onNavigate?: (key: string) => void;
  collapsed?: boolean;
  role?: string;
  onClose?: () => void;
}

function SidebarContent({ items, sectionLabel, activeKey, onNavigate, collapsed }: { items: typeof ADMIN_NAV_ITEMS; sectionLabel: string; activeKey: string; onNavigate: (key: string) => void; collapsed: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <img src={logo} alt="Logo" className="h-6 w-6 object-contain" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">Community Policing</div>
            <div className="text-[10px] tracking-wide text-white/50">
              SURVEILLANCE SYSTEM
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <div className="mb-3 px-2 text-[10px] font-semibold tracking-wider text-white/30">
            {sectionLabel}
          </div>
        )}
        <nav className="flex flex-col gap-1">
          {items.map(({ key, label, icon: Icon }) => {
            const isActive = key === activeKey;
            return (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                title={collapsed ? label : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
                  isActive
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight size={14} className="text-white/60" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export default function Sidebar({ activeKey = "dashboard", onNavigate = () => {}, collapsed = false, role = "admin", onClose }: SidebarProps) {
  const items = role === "captain" ? CAPTAIN_NAV_ITEMS : role === "desk_officer" ? DESK_OFFICER_NAV_ITEMS : role === "cctv_operator" ? CCTV_OPERATOR_NAV_ITEMS : role === "purok_leader" ? PUROK_LEADER_NAV_ITEMS : role === "chief_tanod" ? CHIEF_TANOD_NAV_ITEMS : role === "tanod" ? TANOD_NAV_ITEMS : role === "ex_o" ? EX_O_NAV_ITEMS : ADMIN_NAV_ITEMS;
  const sectionLabel = role === "captain" ? "EXECUTIVE OVERSIGHT" : role === "desk_officer" ? "DESK OFFICER MENU" : role === "cctv_operator" ? "CCTV OPERATIONS" : role === "purok_leader" ? "PUROK LEADER MENU" : role === "chief_tanod" ? "CHIEF TANOD MENU" : role === "tanod" ? "TANOD MENU" : role === "ex_o" ? "EXECUTIVE OFFICER MENU" : "NAVIGATION";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`relative hidden md:flex md:flex-col md:h-screen md:flex-shrink-0 bg-[#06122B] text-white transition-all duration-300 ${collapsed ? "md:w-[68px]" : "md:w-[260px]"}`}>
        <SidebarContent items={items} sectionLabel={sectionLabel} activeKey={activeKey} onNavigate={onNavigate} collapsed={collapsed} />
      </aside>

      {/* Mobile overlay sidebar */}
      <div className={`fixed inset-0 z-50 transition-opacity md:hidden ${!collapsed ? "visible opacity-100" : "invisible opacity-0"}`}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <aside className={`relative h-screen w-[260px] bg-[#06122B] text-white transition-transform duration-300 ${!collapsed ? "translate-x-0" : "-translate-x-full"}`}>
          <SidebarContent items={items} sectionLabel={sectionLabel} activeKey={activeKey} onNavigate={onNavigate} collapsed={false} />
        </aside>
      </div>
    </>
  );
}
