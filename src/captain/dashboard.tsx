import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  RefreshCw,
  Clock,
  Shield,
  AlertTriangle,
  Flame,
  Volume2,
  Filter,
  MapPin,
  Eye,
  Send,
  Activity,
  Zap,
  ChevronDown,
  ImageIcon,
  Megaphone,
  Map,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Inbox,
  ArrowUpRight,
  Check,
  AlertOctagon,
} from "lucide-react";
import PurokAnalyticsPage from "./purok_analytics";
import OperationalReports from "./operational_reports";
import { ComposeBroadcastModal } from "./emergency_broadcast";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_ZONES } from "../constants/purok";
import { SEVERITY_MAP } from "../constants/severity";
import { addPendingBroadcast } from "../utils/broadcastStore";
import {
  seedCaptainInbox,
  getCaptainInboxItems,
  subscribeCaptainInbox,
  markCaptainInboxRead,
  markAllCaptainInboxRead,
  type CaptainInboxItem,
} from "../utils/captainInboxStore";
import { Modal } from "../components/ui";

const MOCK_CAPTAIN_INBOX: CaptainInboxItem[] = [
  {
    id: "CAP-001",
    type: "sla_breach",
    incidentId: "INC-2071",
    title: "SLA breach — INC-2071 unacknowledged 26+ min after filing",
    purok: "Purok 3",
    priority: "High",
    submittedBy: "System",
    createdAt: "2026-07-20T10:31:00",
    read: false,
  },
  {
    id: "CAP-002",
    type: "escalation",
    incidentId: "INC-2070",
    title: "Desk Officer escalated INC-2070 — Emergency SOS, no response confirmation",
    purok: "Purok 6",
    priority: "High",
    reason: "SOS from Ana Lim (Purok 6); no tanod acknowledgment received within target.",
    submittedBy: "Desk Officer",
    createdAt: "2026-07-20T10:12:00",
    read: true,
  },
];

const SENSORS = [
  { id: "s1", name: "SM-GATE-01", type: "smoke", lat: 110, lng: 65, status: "online", value: 120, threshold: 500, purok: "p1" },
  { id: "s2", name: "SM-PLAZA-02", type: "smoke", lat: 225, lng: 60, status: "online", value: 85, threshold: 500, purok: "p2" },
  { id: "s3", name: "DB-HALL-01", type: "noise", lat: 210, lng: 170, status: "warning", value: 78, threshold: 85, purok: "p4", verification: "verification_in_progress" },
  { id: "s4", name: "SM-PUROK3-01", type: "smoke", lat: 100, lng: 200, status: "offline", value: 0, threshold: 500, purok: "p3", verification: "received" },
  { id: "s5", name: "DB-MARKET-01", type: "noise", lat: 330, lng: 240, status: "online", value: 62, threshold: 85, purok: "p6" },
  { id: "s6", name: "SM-CHAPEL-01", type: "smoke", lat: 85, lng: 310, status: "online", value: 45, threshold: 500, purok: "p5" },
];

const TANOD_UNITS = [
  { id: "t1", name: "Team Alpha", lat: 90, lng: 180, heading: "Purok 3 sweep", purok: "p3" },
  { id: "t2", name: "Team Bravo", lat: 230, lng: 150, heading: "Market response", purok: "p4" },
  { id: "t3", name: "Team Charlie", lat: 75, lng: 295, heading: "Chapel patrol", purok: "p5" },
  { id: "t4", name: "Team Delta", lat: 310, lng: 300, heading: "Commercial strip standby", purok: "p6" },
];

const INITIAL_INCIDENTS = [
  { id: "INC-2047", category: "Fire/Smoke", severity: "critical", purok: "Purok 3", description: "Smoke detected near residential area â€” SM-PUROK3-01 offline, unverified", reportedBy: "Maria Santos", time: "2026-07-20T09:32:00", status: "active", photos: 2, lat: 100, lng: 200, source: "IoT Sensor", verification: "received" },
  { id: "INC-2046", category: "Noise Disturbance", severity: "warning", purok: "Purok 4", description: "Sustained high decibel readings from DB-HALL-01 exceeding 78 dB", reportedBy: "Juan Dela Cruz", time: "2026-07-20T10:05:00", status: "active", photos: 1, lat: 210, lng: 170, source: "IoT Sensor", verification: "verification_in_progress" },
  { id: "INC-2045", category: "Fire/Smoke", severity: "low", purok: "Purok 1", description: "Minor smoke report near market entrance â€” sensor readings normal", reportedBy: "Pedro Reyes", time: "2026-07-20T08:45:00", status: "investigating", photos: 0, lat: 110, lng: 65, source: "Resident Report" },
  { id: "INC-2044", category: "Noise Disturbance", severity: "low", purok: "Purok 6", description: "Late-night noise complaint near commercial strip", reportedBy: "Ana Lim", time: "2026-07-20T07:20:00", status: "investigating", photos: 1, lat: 330, lng: 240, source: "Resident Report" },
  { id: "INC-2043", category: "Fire/Smoke", severity: "resolved", purok: "Purok 2", description: "False alarm â€” cooking smoke triggered sensor", reportedBy: "System Auto", time: "2026-07-19T22:15:00", status: "resolved", photos: 0, lat: 225, lng: 60, isFalseAlarm: true, source: "IoT Sensor", verification: "false_or_unverified" },
  { id: "INC-2041", category: "Fire/Smoke", severity: "resolved", purok: "Purok 4", description: "Candle flame near window triggered sensor â€” no fire found", reportedBy: "System Auto", time: "2026-07-18T19:10:00", status: "resolved", photos: 0, lat: 210, lng: 170, isFalseAlarm: true, source: "IoT Sensor", verification: "false_or_unverified" },
  { id: "INC-2042", category: "Noise Disturbance", severity: "resolved", purok: "Purok 5", description: "Event noise reported and verified within acceptable limits", reportedBy: "Rosa Garcia", time: "2026-07-19T20:30:00", status: "resolved", photos: 3, lat: 85, lng: 310, source: "IoT Sensor", verification: "verified" },
];

const CATEGORY_ICON = { "Fire/Smoke": Flame, "Noise Disturbance": Volume2 };
const CATEGORY_COLORS = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
};

const SENSOR_STATUS = {
  online: { color: "bg-emerald-500", hex: "#10b981", label: "Online" },
  warning: { color: "bg-amber-400", hex: "#fbbf24", label: "Warning" },
  offline: { color: "bg-rose-500", hex: "#f43f5e", label: "Offline" },
};

const VERIFICATION_SOURCES = ["IoT Sensor", "CCTV", "CCTV Escalation"];

const VERIFICATION_META: Record<string, { short: string; label: string; badge: string; dot: string }> = {
  received: { short: "Pending Verification", label: "Received — awaiting Desk Officer verification", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  acknowledged: { short: "Pending Verification", label: "Acknowledged — Desk Officer verification pending", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  verification_in_progress: { short: "Pending Verification", label: "Verification in progress by Desk Officer", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  verified: { short: "Verified", label: "Verified by Desk Officer", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  false_or_unverified: { short: "False / Unverified", label: "Closed as false / unverified", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  closed: { short: "Closed", label: "Closed", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

function isIoTOrCCTVSource(source?: string) {
  return !!source && VERIFICATION_SOURCES.includes(source);
}

function isPendingVerification(item: { source?: string; verification?: string }) {
  return isIoTOrCCTVSource(item.source) && item.verification !== "verified";
}

function sensorIsPending(sensor: { status: string; verification?: string }) {
  return (sensor.status === "warning" || sensor.status === "offline") && sensor.verification !== "verified";
}

function VerificationBadge({ verification, size = "sm" }: { verification?: string; size?: "sm" | "lg" }) {
  if (!verification) return null;
  const meta = VERIFICATION_META[verification] ?? VERIFICATION_META.received;
  const pending = verification !== "verified";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${meta.badge} ${size === "lg" ? "px-2.5 py-1 text-[11px]" : "px-1.5 py-0.5 text-[9px]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${pending ? "animate-pulse" : ""}`} />
      {pending ? "Pending Verification" : meta.short}
    </span>
  );
}

const TIME_RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "all", label: "All Time" },
];

function purokBarWidth(count, max) {
  return max > 0 ? `${(count / max) * 100}%` : "0%";
}

function HazardMap({ sensors, tanodUnits, showPatrol, onTogglePatrol, onSensorClick }) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [hoveredSensor, setHoveredSensor] = useState<string | null>(null);
  const [hoveredTanod, setHoveredTanod] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Map size={16} className="text-[#0038A8]" />
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">Sensor &amp; Hazard Map</h3>
            <p className="text-[11px] text-stone-400">Geofenced purok boundaries with live IoT markers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePatrol}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
              showPatrol ? "border-sky-200 bg-sky-50 text-sky-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            {showPatrol ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            Tanod Units
          </button>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Warning
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Offline
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5">
        <div className="relative h-full rounded-lg border border-stone-200 bg-stone-50">
          <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            <defs>
              <radialGradient id="heatGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>

            {PUROK_ZONES.map((zone) => {
              const isHazard = sensors.some((s) => s.purok === zone.id && (s.status === "warning" || s.status === "offline"));
              const isHovered = hoveredZone === zone.id;
              const incidentCount = sensors.filter((s) => s.purok === zone.id && (s.status === "warning" || s.status === "offline")).length;
              return (
                <g
                  key={zone.id}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  <path
                    d={zone.path}
                    fill={isHovered ? "#fde8e8" : isHazard ? "#fef2f2" : "#F8FAFC"}
                    stroke={isHazard ? "#dc2626" : zone.color}
                    strokeWidth={isHazard ? 2 : 1.5}
                    strokeOpacity={isHovered ? 1 : 0.6}
                    className="transition-colors duration-200"
                  />
                  {showPatrol && tanodUnits.some((t) => t.purok === zone.id) && (
                    <circle cx={zone.labelX} cy={zone.labelY - 15} r={20} fill="url(#heatGlow)" />
                  )}
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
                  {incidentCount > 0 && (
                    <g>
                      <circle cx={zone.labelX + 30} cy={zone.labelY - 8} r={8} fill="#dc2626" opacity={0.9} />
                      <text x={zone.labelX + 30} y={zone.labelY - 4.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">{incidentCount}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {showPatrol && tanodUnits.map((unit) => (
              <g
                key={unit.id}
                onMouseEnter={() => setHoveredTanod(unit.id)}
                onMouseLeave={() => setHoveredTanod(null)}
              >
                <circle cx={unit.lat} cy={unit.lng} r={12} fill="#0038A8" opacity={0.12} />
                <circle cx={unit.lat} cy={unit.lng} r={5} fill="#0038A8" stroke="white" strokeWidth={1.5} />
                <text x={unit.lat} y={unit.lng + 1.5} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">T</text>
              </g>
            ))}

            {sensors.map((sensor) => {
              const hex = SENSOR_STATUS[sensor.status].hex;
              const pct = Math.min(100, (sensor.value / sensor.threshold) * 100);
              const isDanger = pct > 80;
              return (
                <g
                  key={sensor.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredSensor(sensor.id)}
                  onMouseLeave={() => setHoveredSensor(null)}
                  onClick={() => onSensorClick(sensor)}
                >
                  {isDanger && (
                    <circle
                      cx={sensor.lat}
                      cy={sensor.lng}
                      r={hoveredSensor === sensor.id ? 18 : 14}
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth={1.5}
                      opacity={0.4}
                      className="animate-ping"
                    />
                  )}
                  <circle
                    cx={sensor.lat}
                    cy={sensor.lng}
                    r={hoveredSensor === sensor.id ? 10 : 7}
                    fill={hex}
                    stroke="white"
                    strokeWidth={2}
                    className="transition-all duration-200 drop-shadow"
                  />
                  <circle
                    cx={sensor.lat}
                    cy={sensor.lng}
                    r={3}
                    fill="white"
                    opacity={0.9}
                  />
                  {sensorIsPending(sensor) && (
                    <g className="pointer-events-none">
                      <circle cx={sensor.lat + 9} cy={sensor.lng - 9} r={4} fill="#f59e0b" stroke="white" strokeWidth={1} />
                      <text x={sensor.lat + 9} y={sensor.lng - 6.5} textAnchor="middle" fontSize="5.5" fontWeight="700" fill="white">!</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {hoveredSensor && (() => {
            const sensor = sensors.find((s) => s.id === hoveredSensor);
            if (!sensor) return null;
            const st = SENSOR_STATUS[sensor.status];
            return (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg"
                style={{ left: Math.min(sensor.lat + 14, 340), top: Math.max(sensor.lng - 40, 10) }}
              >
                <p className="text-[11px] font-semibold text-stone-900">{sensor.name}</p>
                <p className="text-[10px] text-stone-500">
                  {sensor.type === "smoke" ? "Smoke" : "Noise"}: {sensor.value}{sensor.type === "smoke" ? " ppm" : " dB"}
                  {" "}/ {sensor.threshold}{sensor.type === "smoke" ? " ppm" : " dB"}
                </p>
                <p className={`text-[10px] font-medium ${st.hex === "#10b981" ? "text-emerald-600" : st.hex === "#fbbf24" ? "text-amber-600" : "text-rose-600"}`}>
                  {st.label}
                </p>
                {sensorIsPending(sensor) && (
                  <div className="mt-1">
                    <VerificationBadge verification={sensor.verification} />
                  </div>
                )}
              </div>
            );
          })()}

          {hoveredTanod && (() => {
            const unit = tanodUnits.find((t) => t.id === hoveredTanod);
            if (!unit) return null;
            return (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg"
                style={{ left: Math.min(unit.lat + 14, 340), top: Math.max(unit.lng - 40, 10) }}
              >
                <p className="text-[11px] font-semibold text-stone-900">{unit.name}</p>
                <p className="text-[10px] text-stone-500">{unit.heading}</p>
                <p className="text-[10px] font-medium text-sky-600">On Patrol</p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function PurokAnalytics({ incidents }) {
  const counts = PUROK_ZONES.map((z) => ({
    ...z,
    total: incidents.filter((i) => i.purok === z.name).length,
    critical: incidents.filter((i) => i.purok === z.name && i.severity === "critical").length,
    warning: incidents.filter((i) => i.purok === z.name && i.severity === "warning").length,
    low: incidents.filter((i) => i.purok === z.name && i.severity === "low").length,
    resolved: incidents.filter((i) => i.purok === z.name && i.severity === "resolved").length,
  }));
  const maxCount = Math.max(...counts.map((c) => c.total), 1);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#0038A8]" />
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">Purok Incident Breakdown</h3>
            <p className="text-[11px] text-stone-400">Distribution by zone and severity</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-5 pb-5">
        {counts.map((p) => (
          <div key={p.id}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-stone-900">{p.name}</span>
              <span className="text-[11px] font-semibold text-[#0038A8]">{p.total}</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded bg-stone-100">
              <div
                className="bg-rose-400 transition-all duration-500"
                style={{ width: purokBarWidth(p.critical, maxCount) }}
                title={`${p.critical} critical`}
              />
              <div
                className="bg-amber-400 transition-all duration-500"
                style={{ width: purokBarWidth(p.warning, maxCount) }}
                title={`${p.warning} warning`}
              />
              <div
                className="bg-sky-300 transition-all duration-500"
                style={{ width: purokBarWidth(p.low, maxCount) }}
                title={`${p.low} low`}
              />
              <div
                className="bg-emerald-300 transition-all duration-500"
                style={{ width: purokBarWidth(p.resolved, maxCount) }}
                title={`${p.resolved} resolved`}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-4 pt-2">
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-rose-400" /> Critical
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-amber-400" /> Warning
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-sky-300" /> Low
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-emerald-300" /> Resolved
          </span>
        </div>
      </div>
    </div>
  );
}

function IncidentDetail({ incident, onClose, onBroadcast }) {
  if (!incident) return null;
  const sev = SEVERITY_MAP[incident.severity];
  const CatIcon = CATEGORY_ICON[incident.category] || AlertTriangle;
  const catColors = CATEGORY_COLORS[incident.category] || { bg: "bg-stone-100", text: "text-stone-600" };

  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={incident.id}
      subtitle={`${incident.purok} · ${formatTime(incident.time)}`}
      aside={
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${sev.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
          {isIoTOrCCTVSource(incident.source) && <VerificationBadge verification={incident.verification} size="lg" />}
        </div>
      }
      footer={
        incident.status !== "resolved" ? (
          <button
            onClick={() => onBroadcast(incident)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Send size={14} />
            Draft Emergency Broadcast
          </button>
        ) : null
      }
    >
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${catColors.bg} ${catColors.text}`}>
            <CatIcon size={16} />
          </div>
          <span className="text-[12px] font-semibold text-stone-900">{incident.category}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-stone-500">{incident.description}</p>
      </div>

      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">REPORTED BY</p>
          <p className="mt-1 text-[12px] font-medium text-stone-900">{incident.reportedBy}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">STATUS</p>
          <p className="mt-1 text-[12px] font-medium text-stone-900 capitalize">{incident.status}</p>
        </div>
      </div>

      {isIoTOrCCTVSource(incident.source) && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">VERIFICATION</p>
            {isPendingVerification(incident) ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Pending Verification
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 size={12} />
                Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-stone-500">
            {VERIFICATION_META[incident.verification].label} · IoT/CCTV sourced
          </p>
        </div>
      )}

      {incident.photos > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold text-stone-900">Attached Evidence ({incident.photos})</p>
          <div className="flex gap-2">
            {Array.from({ length: incident.photos }).map((_, i) => (
              <div
                key={i}
                className="flex h-20 w-20 items-center justify-center rounded-lg border border-stone-200 bg-stone-100"
              >
                <ImageIcon size={18} className="text-stone-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">LOCATION COORDINATES</p>
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-[#0038A8]" />
          <span className="font-mono text-[11px] text-stone-900">{incident.lat}, {incident.lng}</span>
        </div>
      </div>
    </Modal>
  );
}

function SensorDetail({ sensor, onClose }) {
  if (!sensor) return null;
  const s = SENSOR_STATUS[sensor.status];
  const pct = Math.min(100, (sensor.value / sensor.threshold) * 100);
  const isDanger = pct > 80;
  const zoneName = PUROK_ZONES.find((z) => z.id === sensor.purok)?.name ?? sensor.purok;

  return (
    <Modal onClose={onClose} title={sensor.name} subtitle={`${zoneName} · ${sensor.type === "smoke" ? "MQ-2 Smoke Sensor" : "KY-037 Noise Sensor"}`}>
      <div className="mb-5 flex items-center gap-3">
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.hex === "#10b981" ? "bg-emerald-100 text-emerald-700" : s.hex === "#fbbf24" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600"}`}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.hex }} />
          {s.label}
        </span>
        <span className="text-[11px] text-stone-400">Last ping 2 min ago</span>
      </div>

      {sensorIsPending(sensor) && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[12px] font-semibold text-amber-700">Pending Verification</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500">{VERIFICATION_META[sensor.verification].label}</p>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-stone-500">
            {sensor.type === "smoke" ? "Smoke Density" : "Decibel Level"}
          </span>
          <span className={`text-[12px] font-bold ${isDanger ? "text-rose-600" : "text-stone-900"}`}>
            {sensor.value}{sensor.type === "smoke" ? " ppm" : " dB"}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isDanger ? "bg-rose-500" : pct > 50 ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-stone-400">
          <span>0</span>
          <span>Threshold: {sensor.threshold}{sensor.type === "smoke" ? " ppm" : " dB"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
          <Zap size={13} />
          Ping Device
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
          <Eye size={13} />
          Telemetry Logs
        </button>
      </div>
    </Modal>
  );
}

export default function CaptainDashboard({ activeKey = "dashboard" }) {
  const { ToastPortal } = useToast();

  const incidents = INITIAL_INCIDENTS;
  const [sensors, setSensors] = useState(SENSORS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSensors((prev) =>
        prev.map((s) => {
          if (s.status === "offline") return s;
          const jitter = Math.floor(Math.random() * 7) - 3;
          const newVal = Math.max(0, Math.min(s.threshold + 50, s.value + jitter));
          return { ...s, value: newVal };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const [timeRange, setTimeRange] = useState("today");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [purokFilter, setPurokFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showPatrol, setShowPatrol] = useState(true);

  const filteredIncidents = incidents.filter((inc) => {
    if (categoryFilter !== "all" && inc.category !== categoryFilter) return false;
    if (purokFilter !== "all" && inc.purok !== purokFilter) return false;
    return true;
  });

  const activeIncidents = filteredIncidents.filter((i) => i.status === "active" || i.status === "investigating");

  const totalActive = incidents.filter((i) => i.status === "active").length;
  const totalInvestigating = incidents.filter((i) => i.status === "investigating").length;
  const totalResolved = incidents.filter((i) => i.status === "resolved").length;
  const falseAlarms = incidents.filter((i) => i.status === "resolved" && i.isFalseAlarm).length;
  const falseAlarmRatio = totalResolved > 0 ? Math.round((falseAlarms / totalResolved) * 100) : 0;
  const avgResponse = "4.2 min";
  const onlineSensors = sensors.filter((s) => s.status === "online").length;

  const kpis = [
    { label: "ACTIVE INCIDENTS", value: totalActive + totalInvestigating, sub: `${totalActive} critical / ${totalInvestigating} investigating`, icon: AlertTriangle },
    { label: "AVG RESPONSE TIME", value: avgResponse, sub: "Last 24 hours", icon: Clock },
    { label: "RESOLVED CASES", value: totalResolved, sub: `${timeRange === "today" ? "Today" : timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "All time"}`, icon: Shield },
    { label: "FALSE ALARM RATIO", value: `${falseAlarmRatio}%`, sub: `${falseAlarms} of ${totalResolved} resolved were false`, icon: CheckCircle2 },
    { label: "SENSORS ONLINE", value: `${onlineSensors}/${sensors.length}`, sub: `${sensors.length - onlineSensors} require attention`, icon: Activity },
  ];

  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [selectedSensor, setSelectedSensor] = useState<any>(null);
  const [broadcastTarget, setBroadcastTarget] = useState<any>(null);
  const [showBroadcastCompose, setShowBroadcastCompose] = useState(false);
  const [dashTab, setDashTab] = useState<"overview" | "reports">("overview");
  const [inboxItems, setInboxItems] = useState<CaptainInboxItem[]>([]);

  useEffect(() => {
    seedCaptainInbox(MOCK_CAPTAIN_INBOX);
    setInboxItems(getCaptainInboxItems());
    return subscribeCaptainInbox(() => {
      setInboxItems(getCaptainInboxItems());
    });
  }, []);

  const unreadInbox = inboxItems.filter((i) => !i.read).length;

  function handleBroadcast(incident) {
    setSelectedIncident(null);
    setShowBroadcastCompose(true);
    setBroadcastTarget(incident);
  }

  function handleMassAlert() {
    setBroadcastTarget(null);
    setShowBroadcastCompose(true);
  }

  function handleDraftSubmit(alert) {
    addPendingBroadcast({
      title: alert.title,
      severity: alert.severity,
      purok: alert.purok,
      message: alert.message,
      category: alert.category ?? "General",
      deliveryMethod: alert.deliveryMethod,
      createdAt: new Date().toISOString(),
      submittedBy: "Capt. Reyes",
    });
  }

  const [alertFlash, setAlertFlash] = useState(false);
  const prevActiveRef = useRef(totalActive);

  useEffect(() => {
    if (totalActive > prevActiveRef.current) {
      setAlertFlash(true);
      setTimeout(() => setAlertFlash(false), 2000);
    }
    prevActiveRef.current = totalActive;
  }, [totalActive]);

  const isDashboardView = activeKey === "dashboard";

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto bg-[#E9EDFB] px-3 py-4 sm:px-6 sm:py-6">
        {activeKey === "analytics" ? (
          <PurokAnalyticsPage />
        ) : isDashboardView ? (
          <>
            <header className="mb-6 border-b border-stone-200 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">Executive Safety Dashboard</h1>
                  <p className="mt-1 text-sm text-stone-500">Real-time community safety, patrol &amp; hazard oversight</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMassAlert}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                  >
                    <Megaphone size={13} />
                    Mass Alert
                  </button>
                </div>
              </div>
              <div className="mt-4 flex w-fit items-center gap-1.5 rounded-lg border border-black/10 bg-white p-1">
                {[{ key: "overview", label: "Overview" }, { key: "reports", label: "Operational Reports" }].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDashTab(t.key as "overview" | "reports")}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
                      dashTab === t.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </header>

            {dashTab === "overview" ? (
            <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
                {TIME_RANGES.map((tr) => (
                  <button
                    key={tr.key}
                    onClick={() => setTimeRange(tr.key)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      timeRange === tr.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setFilterOpen(!filterOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-900 hover:bg-stone-50"
                  >
                    <Filter size={12} />
                    Filters
                    <ChevronDown size={12} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                  </button>
                  {filterOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
                      <div className="mb-3">
                        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CATEGORY</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ key: "all", label: "All" }, { key: "Fire/Smoke", label: "Fire/Smoke" }, { key: "Noise Disturbance", label: "Noise" }].map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setCategoryFilter(opt.key)}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                                categoryFilter === opt.key ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">PUROK</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ key: "all", label: "All" }, ...PUROK_ZONES.map((z) => ({ key: z.name, label: z.name }))].map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setPurokFilter(opt.key)}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                                purokFilter === opt.key ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { setCategoryFilter("all"); setPurokFilter("all"); setTimeRange("today"); }}
                  className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50"
                >
                  <RefreshCw size={11} />
                  Reset
                </button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {kpis.map(({ label, value, sub, icon: Icon }, idx) => (
                <div
                  key={label}
                  className={`rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm transition-all duration-300 ${
                    idx === 0 && alertFlash ? "ring-2 ring-rose-300 animate-pulse" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-medium tracking-wider text-stone-400">{label}</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                      <Icon size={15} />
                    </div>
                  </div>
                  <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
                  <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
                </div>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 460 }}>
              <div className="xl:col-span-2 min-h-0">
                <HazardMap
                  sensors={sensors}
                  tanodUnits={TANOD_UNITS}
                  showPatrol={showPatrol}
                  onTogglePatrol={() => setShowPatrol((p) => !p)}
                  onSensorClick={setSelectedSensor}
                />
              </div>

              <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-[#0038A8]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-stone-900">Active Incident Queue</h3>
                      <p className="text-[11px] text-stone-400">{activeIncidents.length} open</p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
                  {activeIncidents.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-[12px] text-stone-400">No active incidents</p>
                    </div>
                  ) : (
                    activeIncidents.map((inc, i) => {
                      const sev = SEVERITY_MAP[inc.severity];
                      const CatIcon = CATEGORY_ICON[inc.category] || AlertTriangle;
                      const catColors = CATEGORY_COLORS[inc.category] || { bg: "bg-stone-100", text: "text-stone-600" };
                      return (
                        <div
                          key={inc.id}
                          className={`px-5 py-3 ${
                            i < activeIncidents.length - 1 ? "border-b border-black/5" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${catColors.bg} ${catColors.text}`}>
                              <CatIcon size={13} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-stone-900">{inc.id}</span>
                                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                                  {sev.label}
                                </span>
                                {isIoTOrCCTVSource(inc.source) && <VerificationBadge verification={inc.verification} />}
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-stone-500">{inc.description}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                                <Clock size={9} />
                                {formatTime(inc.time)}
                                {inc.photos > 0 && (
                                  <>
                                    {" "}&middot; <ImageIcon size={9} /> {inc.photos}
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 pl-10">
                            <button
                              onClick={() => setSelectedIncident(inc)}
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Eye size={11} />
                              View
                            </button>
                            <button
                              onClick={() => handleBroadcast(inc)}
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Send size={11} />
                              Broadcast
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="xl:col-span-1">
                <PurokAnalytics incidents={incidents} />
              </div>

              <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Inbox size={16} className="text-[#0038A8]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-stone-900">Desk Officer Inbox</h3>
                      <p className="text-[11px] text-stone-400">Escalations &amp; SLA breaches from the Desk</p>
                    </div>
                  </div>
                  {unreadInbox > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                        {unreadInbox}
                      </span>
                      <button
                        onClick={() => markAllCaptainInboxRead()}
                        className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium text-stone-500 transition hover:bg-stone-50"
                      >
                        <Check size={10} />
                        Mark all read
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <Check size={11} />
                      Up to date
                    </span>
                  )}
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
                  {inboxItems.length === 0 ? (
                    <div className="px-2 py-8 text-center">
                      <p className="text-[12px] text-stone-400">No items from the Desk Officer yet</p>
                    </div>
                  ) : (
                    inboxItems.map((item) => {
                      const isEsc = item.type === "escalation";
                      const chip = isEsc ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700";
                      const chipLabel = isEsc ? "Escalation" : "SLA Breach";
                      return (
                        <div
                          key={item.id}
                          onClick={() => markCaptainInboxRead(item.id)}
                          className={`cursor-pointer rounded-lg border px-3.5 py-3 transition hover:bg-stone-50 ${
                            isEsc ? "border-violet-200" : "border-rose-200"
                          } ${item.read ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${chip}`}>
                                {isEsc ? <ArrowUpRight size={9} /> : <AlertOctagon size={9} />}
                                {chipLabel}
                              </span>
                              <span className="text-[12px] font-semibold text-stone-900">{item.incidentId}</span>
                              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">{item.priority}</span>
                            </div>
                            {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                          </div>
                          <p className="mt-1.5 text-[11px] leading-snug text-stone-600">{item.title}</p>
                          {item.reason && <p className="mt-1 text-[10px] italic leading-snug text-stone-400">“{item.reason}”</p>}
                          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-stone-400">
                            <MapPin size={9} />
                            {item.purok}
                            <span className="mx-0.5">&middot;</span>
                            <Clock size={9} />
                            {formatTime(item.createdAt)}
                            <span className="mx-0.5">&middot;</span>
                            {item.submittedBy}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="xl:col-span-1 rounded-xl border border-black/5 bg-white shadow-sm">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#0038A8]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-stone-900">Recent Activity</h3>
                      <p className="text-[11px] text-stone-400">Latest system and field events</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-0">
                  {[
                    { time: "2026-07-20T10:42:00", text: "Patrol Team Alpha completed sweep of Purok 3", type: "patrol" },
                    { time: "2026-07-20T10:15:00", text: "Broadcast sent: Community meeting reminder", type: "broadcast" },
                    { time: "2026-07-20T09:58:00", text: "INC-2047 assigned to Patrol Team Bravo", type: "incident" },
                    { time: "2026-07-20T09:30:00", text: "Patrol Team Charlie checked in at Chapel area", type: "patrol" },
                    { time: "2026-07-20T09:05:00", text: "INC-2043 marked as resolved", type: "resolved" },
                    { time: "2026-07-20T08:45:00", text: "SM-PUROK3-01 heartbeat missed", type: "alert" },
                  ].map((item, i, arr) => {
                    const dotColor = { patrol: "bg-sky-400", broadcast: "bg-violet-400", incident: "bg-amber-400", resolved: "bg-emerald-400", alert: "bg-rose-400" }[item.type] ?? "bg-stone-300";
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 px-5 py-3 ${
                          i < arr.length - 1 ? "border-b border-black/5" : ""
                        }`}
                      >
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] leading-snug text-stone-900">{item.text}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                            <Clock size={10} />
                            {formatTime(item.time)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </>
            ) : (
              <OperationalReports />
            )}
          </>
        ) : null}
      </main>

      <IncidentDetail incident={selectedIncident} onClose={() => setSelectedIncident(null)} onBroadcast={handleBroadcast} />
      <SensorDetail sensor={selectedSensor} onClose={() => setSelectedSensor(null)} />
      {showBroadcastCompose && (
        <ComposeBroadcastModal
          onClose={() => setShowBroadcastCompose(false)}
          onSend={handleDraftSubmit}
          incidentHint={broadcastTarget}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </>
  );
}
