import { useState, useMemo, useEffect, useRef } from "react";
import {
  Shield,
  Users,
  AlertTriangle,
  Radio,
  MapPin,
  Clock,
  Activity,
  Navigation,
  ChevronUp,
  ChevronDown,
  Megaphone,
  ArrowUpRight,
  CalendarDays,
  Eye,
  CheckCircle2,
  Send,
  Info,
  Siren,
  Map,
  Zap,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  RefreshCw,
  FileText,
  AlertOctagon,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import {
  useIncidentStore,
  getIncidents,
  getDispatches,
  type Incident,
  type DispatchItem,
} from "../desk_officer/incidentStore";
import {
  getTanods,
  subscribeTanods,
  TANOD_STATUS_META,
  type Tanod,
  type TanodStatus,
} from "../desk_officer/tanodStore";
import {
  getSafetyNotices,
  subscribeSafetyNotices,
  type SafetyNotice,
} from "../utils/safetyNoticeStore";
import {
  getActivity,
  subscribeActivity,
  activityActionLabel,
  type ActivityEvent,
} from "../utils/recentActivityStore";
import { PUROK_ZONES } from "../constants/purok";
import { SHIFT_SCHEDULE } from "../desk_officer/constants";
import { Modal } from "../components/ui";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INCIDENT_STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  new: { label: "New", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  in_progress: { label: "In Progress", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  closed_false_alarm: { label: "Closed", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

const ACTIVITY_ICON: Record<ActivityEvent["kind"], typeof Clock> = {
  incident: AlertTriangle,
  tanod: Users,
  cctv: Eye,
  request: FileText,
  alert: Megaphone,
  closure: CheckCircle2,
};

const ACTIVITY_KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  incident: "bg-[#0038A8]/10 text-[#0038A8]",
  tanod: "bg-emerald-100 text-emerald-700",
  cctv: "bg-sky-100 text-sky-700",
  request: "bg-violet-100 text-violet-700",
  alert: "bg-amber-100 text-amber-700",
  closure: "bg-stone-100 text-stone-600",
};

function zoneByName(name: string) {
  return PUROK_ZONES.find((z) => z.name === name);
}

function formatTimeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatElapsed(isoStr?: string) {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ---------------------------------------------------------------------------
// Section Title helper
// ---------------------------------------------------------------------------

function SectionTitle({
  title,
  sub,
  onAction,
  actionLabel = "View All",
}: {
  title: string;
  sub?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#334155]">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[11px] text-[#94A3B8]">{sub}</p>}
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-[11px] font-medium text-[#0038A8] hover:underline"
        >
          {actionLabel}
          <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  const block = "animate-pulse rounded-xl border border-black/5 bg-white/80";
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 border-b border-stone-200 pb-5">
          <div className={`${block} h-7 w-72`} />
          <div className={`${block} mt-3 h-4 w-96 max-w-full`} />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-20`} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className={`${block} h-80 xl:col-span-2`} />
          <div className={`${block} h-80`} />
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Operations Map component
// ---------------------------------------------------------------------------

function LiveOperationsMap({
  tanods,
  openIncidents,
  activeDispatches,
  hoveredZone,
  setHoveredZone,
  onSelectIncident,
}: {
  tanods: Tanod[];
  openIncidents: Incident[];
  activeDispatches: DispatchItem[];
  hoveredZone: string | null;
  setHoveredZone: (id: string | null) => void;
  onSelectIncident: (inc: Incident) => void;
}) {
  return (
    <div className="relative mx-auto max-w-[640px]">
      <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-auto w-full">
        {PUROK_ZONES.map((zone) => {
          const zoneIncidents = openIncidents.filter((i) => i.purok === zone.name);
          const zoneTanods = tanods.filter((t) => t.purok === zone.name && t.status !== "off_duty");
          const hasActiveIncidents =
            zoneIncidents.some(
              (i) => i.severity === "critical" || i.source === "sos" || i.priority === "High"
            );
          const isHovered = hoveredZone === zone.id;
          const hasTanods = zoneTanods.length > 0;
          return (
            <g
              key={zone.id}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              className="cursor-pointer"
            >
              <path
                d={zone.path}
                fill={isHovered ? "#dbe3fb" : hasActiveIncidents ? "#fef2f2" : hasTanods ? "#ecfdf5" : "#F8FAFC"}
                stroke={hasActiveIncidents ? "#dc2626" : zone.color}
                strokeWidth={hasActiveIncidents ? 2 : 1.5}
                strokeOpacity={isHovered ? 1 : 0.6}
                className="transition-colors duration-200"
              />
              {/* Patrol beat label */}
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
              {/* Incident count badge */}
              {zoneIncidents.length > 0 && (
                <g className="pointer-events-none">
                  <circle cx={zone.labelX + 32} cy={zone.labelY - 8} r={8} fill="#0038A8" opacity={0.9} />
                  <text x={zone.labelX + 32} y={zone.labelY - 4.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
                    {zoneIncidents.length}
                  </text>
                </g>
              )}
              {/* Tanod presence indicator */}
              {hasTanods && (
                <g className="pointer-events-none">
                  <circle cx={zone.labelX - 28} cy={zone.labelY - 8} r={7} fill="#10b981" opacity={0.9} />
                  <text x={zone.labelX - 28} y={zone.labelY - 4.5} textAnchor="middle" fontSize="7" fontWeight="700" fill="white">
                    T
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Tanod position markers */}
        {tanods
          .filter((t) => t.status !== "off_duty")
          .map((tanod) => {
            const zone = zoneByName(tanod.purok);
            if (!zone) return null;
            const statusMeta = TANOD_STATUS_META[tanod.status];
            const dotColor =
              tanod.status === "available"
                ? "#10b981"
                : tanod.status === "en_route"
                  ? "#f59e0b"
                  : "#0ea5e9";
            const offsetIdx = Math.abs(tanod.name.charCodeAt(tanod.name.length - 1)) % 5;
            const ox = offsetIdx === 0 ? 0 : (offsetIdx - 2) * 6;
            const oy = offsetIdx % 2 === 0 ? -14 : 14;
            return (
              <g key={tanod.id}>
                {tanod.status === "en_route" && (
                  <circle cx={zone.labelX + ox} cy={zone.labelY + 18 + oy} r={10} fill="none" stroke="#f59e0b" strokeWidth={1} opacity={0.4} className="animate-ping" />
                )}
                <circle cx={zone.labelX + ox} cy={zone.labelY + 18 + oy} r={5} fill={dotColor} stroke="white" strokeWidth={1.5} className="drop-shadow" />
                <text x={zone.labelX + ox} y={zone.labelY + 18 + oy + 2} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">
                  {tanod.name.charAt(tanod.name.length - 1)}
                </text>
                <title>{`${tanod.name} — ${statusMeta.label} · ${tanod.purok}`}</title>
              </g>
            );
          })}

        {/* Incident markers */}
        {openIncidents.slice(0, 14).map((inc, idx) => {
          const zone = zoneByName(inc.purok);
          if (!zone) return null;
          const others = openIncidents.filter((i) => i.purok === inc.purok && i.id !== inc.id).length;
          const slot = others > 0 ? idx % 5 : 0;
          const ox = slot === 0 ? 0 : (slot - 1) * 8;
          const oy = slot === 1 ? -10 : slot === 2 ? 10 : slot === 3 ? -18 : 18;
          const cx = zone.labelX + ox;
          const cy = zone.labelY + 8 + oy;
          const isSos = inc.source === "sos";
          const emergency = isSos || inc.severity === "critical";
          const color = emergency
            ? "#dc2626"
            : inc.priority === "High"
              ? "#f43f5e"
              : inc.priority === "Medium"
                ? "#f59e0b"
                : "#0ea5e9";
          return (
            <g key={inc.id} onClick={() => onSelectIncident(inc)} className="cursor-pointer">
              <title>
                {`${inc.id} — ${inc.category}\n${inc.purok} · ${INCIDENT_STATUS_META[inc.status]?.label ?? inc.status}`}
              </title>
              {emergency && (
                <circle cx={cx} cy={cy} r={10} fill="none" stroke="#dc2626" strokeWidth={1.5} opacity={0.5} className="animate-ping" />
              )}
              <circle cx={cx} cy={cy} r={emergency ? 7 : 5.5} fill={color} stroke="white" strokeWidth={1.5} className="drop-shadow" />
              <text x={cx} y={cy + 2} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">
                {isSos ? "!" : emergency ? "E" : ""}
              </text>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="7" fontWeight="600" fill="#334155">
                {inc.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident detail modal
// ---------------------------------------------------------------------------

function IncidentDetailModal({
  incident,
  onClose,
  onNavigate,
}: {
  incident: Incident;
  onClose: () => void;
  onNavigate?: (page: string) => void;
}) {
  const status = INCIDENT_STATUS_META[incident.status] ?? INCIDENT_STATUS_META.new;
  const isEmergency = incident.severity === "critical" || incident.source === "sos";
  return (
    <Modal
      onClose={onClose}
      title={`${incident.id} — ${incident.category}`}
      subtitle={`${incident.purok} · ${formatTimeAgo(incident.time)}`}
      icon={<AlertTriangle size={18} />}
      iconClass={isEmergency ? "bg-rose-100 text-rose-600" : "bg-[#0038A8]/10 text-[#0038A8]"}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
          {onNavigate && incident.status !== "resolved" && (
            <button
              onClick={() => {
                onNavigate("incident_triage");
                onClose();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
            >
              Open in Incident Triage <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${status.badge}`}>
            {status.label}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            incident.priority === "High" ? "bg-rose-100 text-rose-700" : incident.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
          }`}>
            {incident.priority}
          </span>
          {isEmergency && (
            <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600">
              <Siren size={10} /> Emergency
            </span>
          )}
        </div>
        <p className="text-[12px] leading-relaxed text-stone-600">{incident.description}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">LOCATION</p>
            <p className="mt-0.5 text-[12px] font-medium text-stone-800">{incident.purok}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">SOURCE</p>
            <p className="mt-0.5 text-[12px] font-medium text-stone-800 capitalize">{incident.source.replace("_", " ")}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">REPORTER</p>
            <p className="mt-0.5 text-[12px] font-medium text-stone-800">{incident.reporter}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">ASSIGNED TEAM</p>
            <p className="mt-0.5 text-[12px] font-medium text-stone-800">{incident.assignedTeam ?? "Unassigned"}</p>
          </div>
        </div>
        {incident.escalatedToCaptain && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-violet-700">Escalated to Captain</p>
            {incident.escalatedReason && <p className="mt-0.5 text-[10px] text-violet-600">{incident.escalatedReason}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Zone Notice modal (for Neighborhood Watch)
// ---------------------------------------------------------------------------

function ZoneNoticeModal({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"barangay" | "purok">("barangay");
  const [purok, setPurok] = useState("Purok 1");

  function submit() {
    if (!title.trim() || !message.trim()) return;
    onPublished();
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Issue Zone Notice"
      subtitle="Send a vigilance notice to Neighborhood Watch volunteers"
      icon={<Eye size={18} />}
      iconClass="bg-[#0f766e]/10 text-[#0f766e]"
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
            disabled={!title.trim() || !message.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#115e59] disabled:opacity-40"
          >
            <Send size={13} /> Publish Notice
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTarget("barangay")}
              className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                target === "barangay"
                  ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                  : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              Entire Barangay
            </button>
            <button
              onClick={() => setTarget("purok")}
              className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                target === "purok"
                  ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                  : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              Specific Purok
            </button>
          </div>
          {target === "purok" && (
            <div className="mt-2">
              <input
                value={purok}
                onChange={(e) => setPurok(e.target.value)}
                list="purok-list"
                className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
              />
              <datalist id="purok-list">
                {PUROK_ZONES.map((z) => (
                  <option key={z.id} value={z.name} />
                ))}
              </datalist>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TITLE</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Zone awareness notice"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">MESSAGE</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Instruct volunteers to observe and report without approaching situations"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Re-task Unit modal
// ---------------------------------------------------------------------------

function RetaskUnitModal({
  tanods,
  openIncidents,
  onClose,
  onRetask,
}: {
  tanods: Tanod[];
  openIncidents: Incident[];
  onClose: () => void;
  onRetask: () => void;
}) {
  const [selectedTanod, setSelectedTanod] = useState<string>("");
  const [selectedIncident, setSelectedIncident] = useState<string>("");

  const availableTanods = tanods.filter((t) => t.status === "available" || t.status === "en_route");

  function submit() {
    if (!selectedTanod || !selectedIncident) return;
    onRetask();
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Re-task Unit"
      subtitle="Reassign a tanod unit to a different incident"
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
            disabled={!selectedTanod || !selectedIncident}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
          >
            <Navigation size={13} /> Re-task Unit
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">SELECT TANOD UNIT</p>
          <div className="grid grid-cols-1 gap-2">
            {availableTanods.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTanod(t.id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  selectedTanod === t.id
                    ? "border-amber-400 bg-amber-50"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${TANOD_STATUS_META[t.status].dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-stone-800">{t.name}</p>
                  <p className="text-[10px] text-stone-500">{t.purok} · {TANOD_STATUS_META[t.status].label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">ASSIGN TO INCIDENT</p>
          <div className="grid grid-cols-1 gap-2">
            {openIncidents.slice(0, 5).map((inc) => {
              const isEmergency = inc.severity === "critical" || inc.source === "sos";
              return (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc.id)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    selectedIncident === inc.id
                      ? "border-amber-400 bg-amber-50"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  {isEmergency ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 text-rose-600">
                      <Siren size={12} />
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E9EDFB] text-[#0038A8]">
                      <AlertTriangle size={12} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-stone-800">{inc.id}</p>
                    <p className="text-[10px] text-stone-500">{inc.category} · {inc.purok}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${INCIDENT_STATUS_META[inc.status]?.badge ?? ""}`}>
                    {INCIDENT_STATUS_META[inc.status]?.label ?? inc.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function ChiefTanodDashboard({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const { incidents, dispatches } = useIncidentStore();
  const { flash, ToastPortal } = useToast();
  const [tanods, setTanods] = useState<Tanod[]>(() => getTanods());
  const [notices, setNotices] = useState<SafetyNotice[]>(() => getSafetyNotices());
  const [activity, setActivity] = useState<ActivityEvent[]>(() => getActivity());
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showZoneNotice, setShowZoneNotice] = useState(false);
  const [showRetask, setShowRetask] = useState(false);
  const [shiftExpanded, setShiftExpanded] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 650);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return subscribeTanods(() => setTanods([...getTanods()]));
  }, []);

  useEffect(() => {
    return subscribeSafetyNotices(() => setNotices([...getSafetyNotices()]));
  }, []);

  useEffect(() => {
    return subscribeActivity(() => setActivity([...getActivity()]));
  }, []);

  const openIncidents = useMemo(
    () =>
      incidents.filter(
        (i) => i.status !== "resolved" && i.status !== "closed_false_alarm"
      ),
    [incidents]
  );

  const activeDispatches = useMemo(
    () => dispatches.filter((d) => d.status !== "resolved"),
    [dispatches]
  );

  // KPI calculations
  const onDutyTanods = useMemo(
    () => tanods.filter((t) => t.status !== "off_duty"),
    [tanods]
  );
  const activeIncidentsCount = openIncidents.length;
  const pendingReferrals = useMemo(
    () => openIncidents.filter((i) => i.escalatedToCaptain || i.status === "acknowledged").length,
    [openIncidents]
  );
  const neighborhoodWatchActivations = useMemo(
    () =>
      notices.filter(
        (n) =>
          n.state === "published" &&
          (n.category === "Safety Alert" || n.category === "Event Notice") &&
          (n.audience?.includes("neighborhood_watch") || n.audience?.includes("all"))
      ).length,
    [notices]
  );

  // Compliance rate (mock: based on active dispatches vs tanods on duty)
  const complianceRate = useMemo(() => {
    const total = onDutyTanods.length;
    if (total === 0) return 100;
    const active = activeDispatches.length;
    return Math.min(100, Math.round((Math.min(active, total) / total) * 100 + 30));
  }, [onDutyTanods, activeDispatches]);

  // Shift roster from SHIFT_SCHEDULE
  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
  const todaySchedule = useMemo(() => {
    return SHIFT_SCHEDULE.find((s) => s.day === todayDay) ?? SHIFT_SCHEDULE[0];
  }, [todayDay]);

  function go(page: string) {
    if (onNavigate) onNavigate(page);
  }

  if (!booted) return <LoadingSkeleton />;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Chief Tanod Dashboard</h1>
              <p className="mt-1 text-sm text-stone-500">
                Tanod operations &amp; team management — live oversight
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => go("patrol_scheduler_routes")}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <CalendarDays size={13} />
                <span className="hidden sm:inline">Patrol Schedule</span>
              </button>
              <button
                onClick={() => go("incident_triage")}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <Layers size={13} />
                <span className="hidden sm:inline">Incidents</span>
              </button>
            </div>
          </div>
        </header>

        {/* A. High-Level KPI Summary (Top Header Cards) */}
        <section className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Tanods On Duty */}
            <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  TANODS ON DUTY
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Users size={13} />
                </div>
              </div>
              <div className="mt-1.5 text-[24px] font-bold text-[#0038A8]">
                {onDutyTanods.length}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {onDutyTanods.filter((t) => t.status === "available").length} available
                </span>
                <span>·</span>
                <span>
                  {onDutyTanods.filter((t) => t.status === "en_route" || t.status === "on_scene").length} deployed
                </span>
              </div>
            </div>

            {/* Active Incidents */}
            <div
              onClick={() => go("incident_triage")}
              className="group cursor-pointer rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  ACTIVE INCIDENTS
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <AlertTriangle size={13} />
                </div>
              </div>
              <div className="mt-1.5 text-[24px] font-bold text-[#0038A8]">
                {activeIncidentsCount}
              </div>
              <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                {openIncidents.filter((i) => i.priority === "High" || i.severity === "critical").length} high/urgent
              </div>
              <ArrowUpRight size={12} className="mt-1 text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
            </div>

            {/* Pending Referrals */}
            <div
              onClick={() => go("incident_triage")}
              className="group cursor-pointer rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/30"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  PENDING REFERRALS
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <ArrowUpRight size={13} />
                </div>
              </div>
              <div className="mt-1.5 text-[24px] font-bold text-amber-600">
                {pendingReferrals}
              </div>
              <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                awaiting review / handoff
              </div>
            </div>

            {/* Neighborhood Watch Activations */}
            <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  N WATCH ACTIVATIONS
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
                  <Eye size={13} />
                </div>
              </div>
              <div className="mt-1.5 text-[24px] font-bold text-[#0f766e]">
                {neighborhoodWatchActivations}
              </div>
              <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                active vigilance alerts
              </div>
            </div>
          </div>
        </section>

        {/* B + C: Live Map (left/center) + Activity Feed (right) */}
        <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* B. Interactive Live Operations Map */}
          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Map size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Live Operations Map</h3>
                  <p className="text-[11px] text-[#94A3B8]">Tanod positions, incidents &amp; patrol coverage</p>
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
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Low
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> High
                </span>
              </div>
            </div>
            <div className="p-4">
              <LiveOperationsMap
                tanods={tanods}
                openIncidents={openIncidents}
                activeDispatches={activeDispatches}
                hoveredZone={hoveredZone}
                setHoveredZone={setHoveredZone}
                onSelectIncident={setSelectedIncident}
              />
              {selectedIncident ? (
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-[#0038A8]/20 bg-[#E9EDFB]/40 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0038A8]/10 text-[#0038A8]">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-[12px] font-semibold text-[#334155]">{selectedIncident.id}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${INCIDENT_STATUS_META[selectedIncident.status]?.badge ?? ""}`}>
                        {INCIDENT_STATUS_META[selectedIncident.status]?.label ?? selectedIncident.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">{selectedIncident.category} · {selectedIncident.purok}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {}}
                        className="inline-flex items-center gap-1 rounded-md bg-[#0038A8] px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-[#002A8C]"
                      >
                        Details <ArrowUpRight size={10} />
                      </button>
                      <button
                        onClick={() => setSelectedIncident(null)}
                        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-center text-[11px] text-[#94A3B8]">
                  Hover a purok to highlight · click pins for incident details
                </p>
              )}
            </div>
          </div>

          {/* C. Operational Activity Feed & Quick Actions */}
          <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
            {/* Quick Actions */}
            <div className="border-b border-stone-100 px-5 py-4">
              <SectionTitle title="Quick Actions" sub="Direct operational shortcuts" />
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => go("patrol_scheduler_routes")}
                  className="group flex items-center gap-3 rounded-lg border border-black/5 bg-[#E9EDFB]/40 px-3.5 py-2.5 transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/80"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                    <CalendarDays size={14} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[11px] font-semibold text-[#334155]">Publish Patrol Schedule</p>
                    <p className="truncate text-[9px] text-[#94A3B8]">Push schedule to tanod apps</p>
                  </div>
                  <ArrowUpRight size={12} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
                </button>
                <button
                  onClick={() => setShowZoneNotice(true)}
                  className="group flex items-center gap-3 rounded-lg border border-black/5 bg-[#E9EDFB]/40 px-3.5 py-2.5 transition hover:border-[#0f766e]/30 hover:bg-[#f0fdfa]/60"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
                    <Megaphone size={14} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[11px] font-semibold text-[#334155]">Issue Zone Notice</p>
                    <p className="truncate text-[9px] text-[#94A3B8]">Alert Neighborhood Watch volunteers</p>
                  </div>
                  <ArrowUpRight size={12} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
                </button>
                <button
                  onClick={() => setShowRetask(true)}
                  className="group flex items-center gap-3 rounded-lg border border-black/5 bg-[#E9EDFB]/40 px-3.5 py-2.5 transition hover:border-amber-300 hover:bg-amber-50/40"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Navigation size={14} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[11px] font-semibold text-[#334155]">Re-task Unit</p>
                    <p className="truncate text-[9px] text-[#94A3B8]">Reassign tanod to incident</p>
                  </div>
                  <ArrowUpRight size={12} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
                </button>
              </div>
            </div>

            {/* Live Activity Stream */}
            <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-3">
              <Activity size={14} className="text-[#0038A8]" />
              <h3 className="text-[13px] font-semibold text-[#334155]">Live Activity Feed</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activity.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Activity size={24} className="mx-auto text-stone-300" />
                  <p className="mt-2 text-[12px] text-stone-400">No activity recorded</p>
                </div>
              ) : (
                activity.slice(0, 12).map((ev) => {
                  const Icon = ACTIVITY_ICON[ev.kind];
                  const color = ACTIVITY_KIND_COLOR[ev.kind];
                  return (
                    <div
                      key={ev.id}
                      className="border-b border-black/5 px-5 py-2.5 last:border-0"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color}`}>
                          <Icon size={11} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-1.5">
                            <span className="text-[11px] font-medium text-stone-800">
                              {activityActionLabel(ev.action)}
                            </span>
                            {ev.incidentId && (
                              <span className="rounded bg-[#0038A8]/10 px-1 py-px text-[8px] font-semibold text-[#0038A8]">
                                {ev.incidentId}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-[#64748B]">{ev.title}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#94A3B8]">
                            <Clock size={8} /> {formatTimeAgo(ev.at)}
                            <span>·</span>
                            <span>{ev.actor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* D. Shift Overview & Performance Progress (Bottom Collapsible Bar) */}
        <section className="mb-6 rounded-xl border border-black/5 bg-white shadow-sm">
          <button
            onClick={() => setShiftExpanded(!shiftExpanded)}
            className="flex w-full items-center justify-between border-b border-stone-100 px-5 py-4 text-left transition hover:bg-stone-50/50"
          >
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Shift Overview &amp; Performance</h3>
                <p className="text-[11px] text-[#94A3B8]">
                  {shiftExpanded ? "Click to collapse" : "Click to expand — compliance rate &amp; roster"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-bold text-[#0038A8]">{complianceRate}% compliance</span>
              {shiftExpanded ? (
                <ChevronUp size={16} className="text-stone-400" />
              ) : (
                <ChevronDown size={16} className="text-stone-400" />
              )}
            </div>
          </button>

          {shiftExpanded && (
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Compliance Rate */}
                <div>
                  <SectionTitle title="Patrol Check-in Compliance" sub="Current shift checkpoint completion" />
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-stone-800">Compliance Rate</span>
                      <span className={`text-[14px] font-bold ${complianceRate >= 80 ? "text-emerald-600" : complianceRate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                        {complianceRate}%
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          complianceRate >= 80 ? "bg-emerald-500" : complianceRate >= 50 ? "bg-amber-400" : "bg-rose-500"
                        }`}
                        style={{ width: `${complianceRate}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[18px] font-bold text-emerald-600">{activeDispatches.length}</p>
                        <p className="text-[9px] text-stone-500">Active</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-bold text-amber-600">
                          {onDutyTanods.filter((t) => t.status === "available").length}
                        </p>
                        <p className="text-[9px] text-stone-500">Available</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-bold text-stone-500">
                          {tanods.filter((t) => t.status === "off_duty").length}
                        </p>
                        <p className="text-[9px] text-stone-500">Off Duty</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shift Roster Summary */}
                <div>
                  <SectionTitle title="Shift Roster" sub={`Today's assignment — ${todayDay}`} />
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 border border-stone-200">
                        <div>
                          <p className="text-[11px] font-semibold text-stone-800">Morning Shift</p>
                          <p className="text-[9px] text-stone-500">{todaySchedule.morning} Team · 06:00–14:00</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                          <CheckCircle2 size={9} /> Active
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 border border-stone-200">
                        <div>
                          <p className="text-[11px] font-semibold text-stone-800">Night Shift</p>
                          <p className="text-[9px] text-stone-500">{todaySchedule.night} Team · 14:00–22:00</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-semibold text-sky-700">
                          <Clock size={9} /> Scheduled
                        </span>
                      </div>
                    </div>

                    {/* Tanod Status Summary */}
                    <div className="mt-3 border-t border-stone-200 pt-3">
                      <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">TANOD STATUS</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tanods.map((t) => (
                          <span
                            key={t.id}
                            className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-1 text-[9px] font-medium text-stone-600"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${TANOD_STATUS_META[t.status].dot}`} />
                            {t.name}
                            <span className="text-[8px] text-stone-400">{TANOD_STATUS_META[t.status].label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Incident detail modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onNavigate={go}
        />
      )}

      {/* Zone Notice modal */}
      {showZoneNotice && (
        <ZoneNoticeModal
          onClose={() => setShowZoneNotice(false)}
          onPublished={() => {
            flash("Zone notice published to Neighborhood Watch volunteers.", { title: "Notice Published" });
          }}
        />
      )}

      {/* Re-task Unit modal */}
      {showRetask && (
        <RetaskUnitModal
          tanods={tanods}
          openIncidents={openIncidents}
          onClose={() => setShowRetask(false)}
          onRetask={() => {
            flash("Unit re-tasked successfully. New assignment sent to the tanod's mobile app.", { title: "Unit Re-tasked" });
          }}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
