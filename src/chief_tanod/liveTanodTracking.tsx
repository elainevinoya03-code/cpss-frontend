import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Map,
  Users,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  BatteryCharging,
  Clock,
  MapPin,
  Navigation,
  ChevronRight,
  RefreshCw,
  Send,
  MessageSquare,
  History,
  Shield,
  Info,
  Locate,
  Timer,
  Target,
  Waypoints,
  UserCheck,
} from "lucide-react";
import { PUROK_ZONES } from "../constants/purok";
import {
  getTanods,
  subscribeTanods,
  TANOD_STATUS_META,
  retaskTanod,
  sendMessageToTanod,
  type Tanod,
  type TanodStatus,
  type TanodMessage,
} from "../desk_officer/tanodStore";
import { Modal } from "../components/ui";
import { useToast } from "../hooks/useToast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zoneByName(name: string) {
  return PUROK_ZONES.find((z) => z.name === name);
}

function formatTimeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTimeFull(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDutyDuration(isoStr?: string) {
  if (!isoStr) return "N/A";
  const diff = Date.now() - new Date(isoStr).getTime();
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

const SIGNAL_META: Record<string, { icon: typeof Wifi; label: string; color: string; bg: string }> = {
  strong: { icon: Wifi, label: "Strong", color: "text-emerald-500", bg: "bg-emerald-50" },
  weak: { icon: WifiOff, label: "Weak", color: "text-amber-500", bg: "bg-amber-50" },
  offline: { icon: WifiOff, label: "Offline", color: "text-rose-500", bg: "bg-rose-50" },
};

const BATTERY_META: Record<string, { icon: typeof Battery; label: string; color: string }> = {
  high: { icon: Battery, label: "Good", color: "text-emerald-500" },
  medium: { icon: BatteryLow, label: "Medium", color: "text-amber-500" },
  low: { icon: BatteryLow, label: "Low", color: "text-rose-500" },
  dead: { icon: BatteryCharging, label: "Critical", color: "text-rose-600" },
};

function batteryTier(level: number) {
  if (level >= 60) return "high";
  if (level >= 30) return "medium";
  if (level >= 10) return "low";
  return "dead";
}

function batteryColor(level: number) {
  if (level >= 60) return "#10b981";
  if (level >= 30) return "#f59e0b";
  return "#ef4444";
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  available: "text-emerald-700",
  en_route: "text-amber-700",
  on_scene: "text-sky-700",
  off_duty: "text-stone-500",
};

const QUICK_MESSAGES = [
  "Request status update",
  "Confirm your ETA",
  "Hold position",
  "Return to station",
  "Proceed to assigned area",
  "Check in with dispatch",
];

// ---------------------------------------------------------------------------
// Live Clock
// ---------------------------------------------------------------------------

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[11px] tabular-nums text-stone-400">
      {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Signal / Battery bar (inline SVG mini-bar)
// ---------------------------------------------------------------------------

function SignalBar({ level, height = 12 }: { level: number; height?: number }) {
  const bars = 5;
  const filled = Math.round((level / 100) * bars);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="rounded-sm transition-all duration-300"
          style={{
            width: 3,
            height: `${((i + 1) / bars) * 100}%`,
            backgroundColor: i < filled ? batteryColor(level) : "#e5e7eb",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}/10 ${color}`}>
          <Icon size={13} />
        </div>
      </div>
      <div className={`mt-1.5 text-[22px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map Section
// ---------------------------------------------------------------------------

function LiveTrackingMap({
  tanods,
  hoveredZone,
  setHoveredZone,
  onSelectTanod,
  selectedTanodId,
}: {
  tanods: Tanod[];
  hoveredZone: string | null;
  setHoveredZone: (id: string | null) => void;
  onSelectTanod: (t: Tanod) => void;
  selectedTanodId: string | null;
}) {
  return (
    <div className="relative mx-auto max-w-[640px]">
      <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-auto w-full">
        {PUROK_ZONES.map((zone) => {
          const zoneTanods = tanods.filter((t) => t.purok === zone.name && t.status !== "off_duty");
          const isHovered = hoveredZone === zone.id;
          return (
            <g
              key={zone.id}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              className="cursor-pointer"
            >
              <path
                d={zone.path}
                fill={isHovered ? "#dbe3fb" : zoneTanods.length > 0 ? "#ecfdf5" : "#F8FAFC"}
                stroke={zone.color}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeOpacity={isHovered ? 1 : 0.6}
                className="transition-colors duration-200"
              />
              <text
                x={zone.labelX}
                y={zone.labelY}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize="10"
                fontWeight="500"
                fill={zone.color}
                opacity={0.85}
              >
                {zone.name}
              </text>
              {zoneTanods.length > 0 && (
                <g className="pointer-events-none">
                  <circle cx={zone.labelX + 32} cy={zone.labelY - 8} r={8} fill="#10b981" opacity={0.9} />
                  <text x={zone.labelX + 32} y={zone.labelY - 4.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
                    {zoneTanods.length}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {tanods
          .filter((t) => t.status !== "off_duty" && t.gps)
          .map((tanod) => {
            const zone = zoneByName(tanod.purok);
            if (!zone || !tanod.gps) return null;
            const dotColor = tanod.markerColor ?? (tanod.status === "available" ? "#10b981" : tanod.status === "en_route" ? "#f59e0b" : "#0ea5e9");
            const offsetIdx = Math.abs(tanod.name.charCodeAt(tanod.name.length - 1)) % 5;
            const ox = offsetIdx === 0 ? 0 : (offsetIdx - 2) * 6;
            const oy = offsetIdx % 2 === 0 ? -14 : 14;
            const isSelected = selectedTanodId === tanod.id;
            return (
              <g key={tanod.id} onClick={() => onSelectTanod(tanod)} className="cursor-pointer">
                {isSelected && (
                  <circle cx={zone.labelX + ox} cy={zone.labelY + 18 + oy} r={14} fill="none" stroke={dotColor} strokeWidth={2} opacity={0.5} className="animate-ping" />
                )}
                {tanod.status === "en_route" && (
                  <circle cx={zone.labelX + ox} cy={zone.labelY + 18 + oy} r={10} fill="none" stroke="#f59e0b" strokeWidth={1} opacity={0.4} className="animate-ping" />
                )}
                <circle cx={zone.labelX + ox} cy={zone.labelY + 18 + oy} r={isSelected ? 7 : 5.5} fill={dotColor} stroke="white" strokeWidth={1.5} className="drop-shadow" />
                <text x={zone.labelX + ox} y={zone.labelY + 18 + oy + 2} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">
                  {tanod.name.charAt(tanod.name.length - 1)}
                </text>
                {tanod.signal === "offline" && (
                  <text x={zone.labelX + ox + 7} y={zone.labelY + 18 + oy - 5} fontSize="6" fill="#ef4444">
                    !
                  </text>
                )}
                <title>{`${tanod.name} — ${TANOD_STATUS_META[tanod.status].label} · ${tanod.purok}\nBattery: ${tanod.battery ?? "?"}% · Signal: ${tanod.signal ?? "unknown"}`}</title>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tanod Roster Sidebar
// ---------------------------------------------------------------------------

function TanodRoster({
  tanods,
  filterStatus,
  setFilterStatus,
  selectedTanodId,
  onSelectTanod,
}: {
  tanods: Tanod[];
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  selectedTanodId: string | null;
  onSelectTanod: (t: Tanod) => void;
}) {
  const onDuty = useMemo(() => tanods.filter((t) => t.status !== "off_duty"), [tanods]);
  const filtered = useMemo(
    () => (filterStatus === "all" ? onDuty : onDuty.filter((t) => t.status === filterStatus)),
    [onDuty, filterStatus]
  );

  return (
    <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0038A8]" />
            <h3 className="text-[14px] font-semibold text-[#334155]">Tanod Roster</h3>
            <span className="rounded-full bg-[#0038A8]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0038A8]">
              {filtered.length}
            </span>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-600 outline-none focus:border-[#0038A8]/50"
          >
            <option value="all">All On Duty</option>
            <option value="available">Available</option>
            <option value="en_route">En Route</option>
            <option value="on_scene">On Scene</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 420 }}>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users size={24} className="mx-auto text-stone-300" />
            <p className="mt-2 text-[12px] text-stone-400">No tanods found</p>
          </div>
        ) : (
          filtered.map((t) => {
            const meta = TANOD_STATUS_META[t.status];
            const isSelected = selectedTanodId === t.id;
            const sigMeta = SIGNAL_META[t.signal ?? "strong"];
            const batTier = batteryTier(t.battery ?? 100);
            const BatIcon = BATTERY_META[batTier].icon;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTanod(t)}
                className={`flex w-full items-center gap-3 border-b border-black/5 px-5 py-3 text-left transition last:border-0 hover:bg-stone-50/50 ${isSelected ? "bg-[#E9EDFB]/60" : ""}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-semibold text-stone-800">{t.name}</p>
                    {t.assignment && (
                      <span className="truncate rounded bg-[#0038A8]/10 px-1.5 py-px text-[8px] font-semibold text-[#0038A8]">
                        {t.incidentId ?? "Assigned"}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500">{t.purok} · {meta.label}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <SignalBar level={t.signal === "offline" ? 0 : t.signal === "weak" ? 30 : 90} height={10} />
                    <span className={`text-[9px] font-medium ${sigMeta.color}`}>{sigMeta.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BatIcon size={10} className={BATTERY_META[batTier].color} />
                    <span className="text-[9px] text-stone-400">{t.battery ?? "?"}%</span>
                  </div>
                </div>
                <ChevronRight size={12} className="text-stone-300" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selected Tanod Detail Panel
// ---------------------------------------------------------------------------

function TanodDetailPanel({
  tanod,
  onClose,
  flash,
}: {
  tanod: Tanod;
  onClose: () => void;
  flash: (msg: string, opts?: { title?: string; type?: "info" | "success" | "warning" | "error" }) => void;
}) {
  const [activeTab, setActiveTab] = useState<"info" | "history" | "message">("info");
  const [messageText, setMessageText] = useState("");
  const [showRetask, setShowRetask] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = tanod.messages ?? [];

  useEffect(() => {
    if (activeTab === "message" && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, activeTab]);

  function handleSendMessage() {
    const text = messageText.trim();
    if (!text) return;
    sendMessageToTanod(tanod.id, text, "chief");
    setMessageText("");
    flash(`Message sent to ${tanod.name}`, { type: "success" });
  }

  function handleQuickMessage(text: string) {
    sendMessageToTanod(tanod.id, text, "chief");
    flash(`Quick message sent to ${tanod.name}`, { type: "success" });
  }

  const meta = TANOD_STATUS_META[tanod.status];
  const sigMeta = SIGNAL_META[tanod.signal ?? "strong"];
  const batTier = batteryTier(tanod.battery ?? 100);
  const BatIcon = BATTERY_META[batTier].icon;
  const SigIcon = sigMeta.icon;

  const tabs = [
    { id: "info" as const, label: "Details", icon: Info },
    { id: "history" as const, label: "History", icon: History },
    { id: "message" as const, label: "Message", icon: MessageSquare, badge: messages.length },
  ];

  return (
    <section className="mt-6 rounded-xl border border-[#0038A8]/20 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold text-white"
            style={{ backgroundColor: tanod.markerColor ?? "#0038A8" }}
          >
            {tanod.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-stone-900">{tanod.name}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${meta.chip}`}>{meta.label}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <MapPin size={10} /> {tanod.purok}
              {tanod.assignment && (
                <>
                  <span>·</span>
                  <span className="font-medium text-[#0038A8]">{tanod.assignment}</span>
                </>
              )}
              {tanod.incidentId && (
                <>
                  <span>·</span>
                  <span className="rounded bg-[#0038A8]/10 px-1.5 py-px text-[9px] font-semibold text-[#0038A8]">{tanod.incidentId}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRetask(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
          >
            <Navigation size={12} /> Re-task
          </button>
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50">
            Close
          </button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-stone-100 bg-stone-50/50 px-5 py-2.5">
        <div className="flex items-center gap-1.5">
          <SigIcon size={12} className={sigMeta.color} />
          <span className={`text-[11px] font-medium ${sigMeta.color}`}>GPS: {sigMeta.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BatIcon size={12} className={BATTERY_META[batTier].color} />
          <span className={`text-[11px] font-medium ${BATTERY_META[batTier].color}`}>{tanod.battery ?? "?"}%</span>
          <SignalBar level={tanod.battery ?? 50} height={8} />
        </div>
        <div className="flex items-center gap-1.5">
          <Timer size={11} className="text-stone-400" />
          <span className="text-[10px] text-stone-500">Duty: {formatDutyDuration(tanod.dutyStarted)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={11} className="text-stone-400" />
          <span className="text-[10px] text-stone-500">{tanod.members} members</span>
        </div>
        {tanod.lastStatusChange && (
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-stone-400" />
            <span className="text-[10px] text-stone-500">Last change: {formatTimeAgo(tanod.lastStatusChange)}</span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-stone-100 px-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 border-b-2 px-4 py-3 text-[11px] font-medium transition ${
                isActive
                  ? "border-[#0038A8] text-[#0038A8]"
                  : "border-transparent text-stone-400 hover:text-stone-600"
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-0.5 rounded-full bg-[#0038A8] px-1.5 py-px text-[8px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="px-5 py-4" style={{ maxHeight: 320, overflowY: "auto" }}>
        {activeTab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">STATUS</p>
                <p className={`mt-0.5 text-[12px] font-semibold ${STATUS_TEXT_COLOR[tanod.status]}`}>{meta.label}</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">PUROK</p>
                <p className="mt-0.5 text-[12px] font-semibold text-stone-800">{tanod.purok}</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">TEAM SIZE</p>
                <p className="mt-0.5 text-[12px] font-semibold text-stone-800">{tanod.members} members</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">BATTERY</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <BatIcon size={14} className={BATTERY_META[batTier].color} />
                  <span className={`text-[12px] font-semibold ${BATTERY_META[batTier].color}`}>{tanod.battery ?? "?"}%</span>
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">GPS SIGNAL</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <SigIcon size={14} className={sigMeta.color} />
                  <span className={`text-[12px] font-semibold ${sigMeta.color}`}>{sigMeta.label}</span>
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">DUTY DURATION</p>
                <p className="mt-0.5 text-[12px] font-semibold text-stone-800">{formatDutyDuration(tanod.dutyStarted)}</p>
              </div>
            </div>

            {tanod.assignment && (
              <div className="rounded-lg border border-[#0038A8]/15 bg-[#E9EDFB]/40 px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Target size={13} className="text-[#0038A8]" />
                  <p className="text-[11px] font-semibold text-[#0038A8]">Current Assignment</p>
                </div>
                <p className="text-[12px] font-medium text-stone-800">{tanod.assignment}</p>
                {tanod.incidentId && (
                  <p className="mt-1 text-[10px] text-stone-500">
                    Linked to <span className="font-semibold text-[#0038A8]">{tanod.incidentId}</span>
                  </p>
                )}
              </div>
            )}

            {tanod.gps && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Locate size={13} className="text-stone-500" />
                  <p className="text-[11px] font-semibold text-stone-500">Last Known Position</p>
                </div>
                <p className="text-[11px] text-stone-600">
                  X: {tanod.gps.lat} · Y: {tanod.gps.lng}
                </p>
                <p className="mt-0.5 text-[10px] text-stone-400">
                  Within {tanod.purok} patrol zone
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-0">
            {tanod.statusHistory.length === 0 ? (
              <div className="py-8 text-center">
                <History size={24} className="mx-auto text-stone-300" />
                <p className="mt-2 text-[12px] text-stone-400">No status changes recorded this duty period</p>
              </div>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-stone-200" />
                {tanod.statusHistory.map((entry, idx) => {
                  const entryMeta = TANOD_STATUS_META[entry.status];
                  return (
                    <div key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                      <div className={`relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ${entryMeta.ring} bg-white`}>
                        <span className={`h-2 w-2 rounded-full ${entryMeta.dot}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${entryMeta.chip}`}>{entryMeta.label}</span>
                          <span className="text-[10px] text-stone-400">{formatTimeFull(entry.at)}</span>
                          <span className="text-[10px] text-stone-400">({formatTimeAgo(entry.at)})</span>
                        </div>
                        {entry.note && (
                          <p className="mt-0.5 text-[10px] text-stone-500 italic">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "message" && (
          <div className="flex flex-col gap-3">
            {/* Quick Actions */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">QUICK ACTIONS</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MESSAGES.map((qm) => (
                  <button
                    key={qm}
                    onClick={() => handleQuickMessage(qm)}
                    className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] text-stone-600 transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50 hover:text-[#0038A8]"
                  >
                    {qm}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Thread */}
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3" style={{ minHeight: 120, maxHeight: 180, overflowY: "auto" }}>
              {messages.length === 0 ? (
                <div className="py-4 text-center">
                  <MessageSquare size={20} className="mx-auto text-stone-300" />
                  <p className="mt-1.5 text-[11px] text-stone-400">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.from === "chief" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-[11px] ${
                          msg.from === "chief"
                            ? "bg-[#0038A8] text-white"
                            : "border border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        <p>{msg.text}</p>
                        <p className={`mt-0.5 text-[9px] ${msg.from === "chief" ? "text-blue-200" : "text-stone-400"}`}>
                          {formatTimeFull(msg.at)} · {msg.from === "chief" ? "You" : tanod.name}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Compose */}
            <div className="flex items-center gap-2">
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder={`Message ${tanod.name}...`}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0038A8] text-white transition hover:bg-[#002A8C] disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Re-task Modal */}
      {showRetask && (
        <RetaskModal
          tanod={tanod}
          onClose={() => setShowRetask(false)}
          onRetasked={() => {
            setShowRetask(false);
            flash(`${tanod.name} re-tasked successfully`, { type: "success" });
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Re-task Modal
// ---------------------------------------------------------------------------

function RetaskModal({
  tanod,
  onClose,
  onRetasked,
}: {
  tanod: Tanod;
  onClose: () => void;
  onRetasked: () => void;
}) {
  const [newPurok, setNewPurok] = useState(tanod.purok);
  const [newAssignment, setNewAssignment] = useState("");
  const [newIncidentId, setNewIncidentId] = useState("");

  function submit() {
    if (!newAssignment.trim()) return;
    retaskTanod(tanod.id, newAssignment.trim(), newPurok, newIncidentId.trim() || undefined);
    onRetasked();
  }

  return (
    <Modal
      onClose={onClose}
      title="Re-task Unit"
      subtitle={`Reassign ${tanod.name} to a different location or incident`}
      icon={<Navigation size={18} />}
      iconClass="bg-amber-100 text-amber-600"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!newAssignment.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
          >
            <Navigation size={13} /> Confirm Re-task
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">CURRENT ASSIGNMENT</p>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[11px] font-medium text-stone-700">
              {tanod.assignment ?? "No active assignment"} · {tanod.purok}
            </p>
            {tanod.incidentId && (
              <p className="mt-0.5 text-[10px] text-stone-500">Incident: {tanod.incidentId}</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">NEW PUROK / LOCATION</p>
          <select
            value={newPurok}
            onChange={(e) => setNewPurok(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          >
            {PUROK_ZONES.map((z) => (
              <option key={z.id} value={z.name}>{z.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">NEW ASSIGNMENT DESCRIPTION</p>
          <input
            value={newAssignment}
            onChange={(e) => setNewAssignment(e.target.value)}
            placeholder="e.g. Perimeter security, Crowd control, Evidence collection"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">INCIDENT ID (optional)</p>
          <input
            value={newIncidentId}
            onChange={(e) => setNewIncidentId(e.target.value)}
            placeholder="e.g. INC-2071"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LiveTanodTracking({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { flash, ToastPortal } = useToast();
  const [tanods, setTanods] = useState<Tanod[]>(() => getTanods());
  const [selectedTanod, setSelectedTanod] = useState<Tanod | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  // Subscribe to store updates
  useEffect(() => {
    return subscribeTanods(() => {
      const updated = getTanods();
      setTanods([...updated]);
      setSelectedTanod((prev) => (prev ? updated.find((t) => t.id === prev.id) ?? null : null));
    });
  }, []);

  // Simulated real-time signal/battery fluctuation
  useEffect(() => {
    const t = setInterval(() => {
      setTanods((prev) =>
        prev.map((t) => {
          if (t.status === "off_duty") return t;
          const batDelta = Math.random() > 0.7 ? (Math.random() > 0.5 ? -1 : 1) : 0;
          const newBattery = Math.max(5, Math.min(100, (t.battery ?? 80) + batDelta));
          const signalRoll = Math.random();
          let newSignal = t.signal ?? "strong";
          if (signalRoll > 0.95) newSignal = newSignal === "strong" ? "weak" : "strong";
          if (signalRoll > 0.99) newSignal = "offline";
          if (signalRoll < 0.01 && newSignal === "offline") newSignal = "weak";
          if (signalRoll < 0.03 && newSignal === "weak") newSignal = "strong";
          return { ...t, battery: newBattery, signal: newSignal };
        })
      );
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const onDuty = useMemo(() => tanods.filter((t) => t.status !== "off_duty"), [tanods]);
  const availableCount = onDuty.filter((t) => t.status === "available").length;
  const deployedCount = onDuty.filter((t) => t.status === "en_route" || t.status === "on_scene").length;
  const offlineCount = tanods.filter((t) => t.status === "off_duty").length;
  const avgBattery = useMemo(() => {
    const active = tanods.filter((t) => t.status !== "off_duty" && t.battery != null);
    if (active.length === 0) return 0;
    return Math.round(active.reduce((sum, t) => sum + (t.battery ?? 0), 0) / active.length);
  }, [tanods]);

  function handleRefresh() {
    setTanods([...getTanods()]);
    setLastRefresh(new Date());
    flash("Tanod positions refreshed", { type: "info" });
  }

  function handleSelectTanod(t: Tanod) {
    setSelectedTanod((prev) => (prev?.id === t.id ? null : t));
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-stone-900">Live Tanod Tracking</h1>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Real-time positions, status &amp; connectivity of authorized on-duty tanods
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LiveClock />
              <button
                onClick={handleRefresh}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label="ON DUTY" value={onDuty.length} color="text-[#0038A8]" icon={Users} />
          <KpiCard label="AVAILABLE" value={availableCount} color="text-emerald-600" icon={UserCheck} />
          <KpiCard label="DEPLOYED" value={deployedCount} color="text-amber-600" icon={Waypoints} />
          <KpiCard label="OFF DUTY" value={offlineCount} color="text-stone-400" icon={Shield} />
          <KpiCard label="AVG BATTERY" value={avgBattery} color="text-sky-600" icon={Battery} />
        </section>

        {/* Map + Roster */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Map */}
          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Map size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Live Map</h3>
                  <p className="text-[11px] text-[#94A3B8]">Tanod GPS positions across purok zones — authorized duty periods only</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-stone-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> En Route
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> On Scene
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Signal Lost
                </span>
              </div>
            </div>
            <div className="p-4">
              <LiveTrackingMap
                tanods={tanods}
                hoveredZone={hoveredZone}
                setHoveredZone={setHoveredZone}
                onSelectTanod={handleSelectTanod}
                selectedTanodId={selectedTanod?.id ?? null}
              />
              {hoveredZone && (
                <p className="mt-3 text-center text-[11px] text-[#94A3B8]">
                  {PUROK_ZONES.find((z) => z.id === hoveredZone)?.name} — {tanods.filter((t) => t.purok === PUROK_ZONES.find((z) => z.id === hoveredZone)?.name && t.status !== "off_duty").length} on-duty tanods
                </p>
              )}
            </div>
          </div>

          {/* Roster */}
          <TanodRoster
            tanods={tanods}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            selectedTanodId={selectedTanod?.id ?? null}
            onSelectTanod={handleSelectTanod}
          />
        </section>

        {/* Selected Tanod Detail Panel */}
        {selectedTanod && (
          <TanodDetailPanel
            tanod={selectedTanod}
            onClose={() => setSelectedTanod(null)}
            flash={flash}
          />
        )}

        {/* Footer note */}
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-stone-200 bg-white/60 px-4 py-2.5">
          <Info size={13} className="shrink-0 text-stone-400" />
          <p className="text-[10px] text-stone-400">
            All location data and status updates shown on this page are limited to authorized duty periods only.
            GPS positions reflect the last reported coordinates from each Tanod's device during active duty.
          </p>
        </div>
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
