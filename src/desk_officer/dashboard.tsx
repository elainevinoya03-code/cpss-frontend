import { useState, useEffect, useRef } from "react";
import {
  ClipboardList,
  Radio,
  Map,
  FileText,
  MessageSquare,
  AlertTriangle,
  Flame,
  Volume2,
  Siren,
  MapPin,
  Users,
  CheckCircle2,
  Send,
  Zap,
  Eye,
  X,
  Clock,
  Shield,
  Activity,
  ChevronRight,
  ImageIcon,
  Megaphone,
  Star,
  Camera,
  Flag,
  Smartphone,
  Wifi,
  WifiOff,
  CalendarClock,
  BellRing,
  UserCheck,
  UserX,
  KeyRound,
  Timer,
  ArrowUpRight,
  Link2,
  Search,
  ShieldCheck,
  Info,
  Globe,
  Save,
  Archive,
  Tag,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal } from "../components/ui";
import {
  usePurokIncidents,
  nextEscalationStatus,
} from "../purok_leader/incidentStore";
import type { EscalatedCase, EscalationStatus } from "../purok_leader/incidentStore";
import { addPendingBroadcast } from "../utils/broadcastStore";
import { addCaptainInboxItem } from "../utils/captainInboxStore";
import {
  seedSafetyNotices,
  getSafetyNotices,
  subscribeSafetyNotices,
  addSafetyNotice,
  setSafetyNoticeState,
} from "../utils/safetyNoticeStore";
import type { NoticeCategory, NoticeTarget, SafetyNotice } from "../utils/safetyNoticeStore";

type IncidentStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "closed_false_alarm";
// §10.3.1 — canonical Incident.source enum. "Anonymous" is not a source: it is a
// boolean/token modifier on a `resident` report (§6.1.5). Purok Leader validation/esc
// escalation is modeled separately (IncidentValidation), not as an incident source.
type IncidentSource = "resident" | "tanod" | "desk_officer" | "cctv" | "iot" | "sos";

const DESK_PRIORITIES = ["Low", "Medium", "High"] as const;
type DeskPriority = (typeof DESK_PRIORITIES)[number];

const DESK_PRIORITY_META: Record<DeskPriority, { chip: string; dot: string }> = {
  Low: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  Medium: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  High: { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
};

interface Incident {
  id: string;
  category: string;
  severity: string;
  purok: string;
  description: string;
  source: IncidentSource;
  reporter: string;
  time: string;
  status: IncidentStatus;
  photos: number;
  lat: number;
  lng: number;
  priority: DeskPriority;
  notes?: string[];
  rating?: number;
  anonymous?: boolean;
  trackingToken?: string;
  acknowledgedAt?: string;
  slaBreached?: boolean;
  duplicateResolved?: boolean;
  relatedTo?: string[];
  escalatedToCaptain?: boolean;
  escalatedReason?: string;
  escalatedAt?: string;
  reporterSafe?: boolean;
  reporterSafeAt?: string;
  validationLabel?: string;
  relatedAlertId?: string;
  closedReason?: string;
}

interface Sensor {
  id: string;
  name: string;
  type: "smoke" | "noise";
  purok: string;
  status: "online" | "warning" | "offline";
  value: number;
  threshold: number;
}

const INCIDENT_STATUS_META: Record<IncidentStatus, { label: string; action: string | null; next?: IncidentStatus; badge: string; dot: string }> = {
  new: { label: "New", action: "Acknowledge", next: "acknowledged", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", action: "Start Work", next: "in_progress", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  in_progress: { label: "In Progress", action: "Resolve", next: "resolved", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  resolved: { label: "Resolved", action: null, badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  closed_false_alarm: { label: "Closed (False Alarm)", action: null, badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

const SOURCE_META: Record<IncidentSource, { label: string; badge: string; icon: typeof Smartphone }> = {
  resident: { label: "Resident", badge: "bg-sky-100 text-sky-700", icon: Smartphone },
  tanod: { label: "Tanod", badge: "bg-emerald-100 text-emerald-700", icon: UserCheck },
  desk_officer: { label: "Desk Officer", badge: "bg-stone-200 text-stone-700", icon: ClipboardList },
  cctv: { label: "CCTV", badge: "bg-violet-100 text-violet-700", icon: Camera },
  iot: { label: "IoT Sensor", badge: "bg-amber-100 text-amber-700", icon: Zap },
  sos: { label: "SOS", badge: "bg-rose-100 text-rose-700", icon: Siren },
};

const SLA_TARGETS: Record<DeskPriority, { minutes: number; label: string }> = {
  High: { minutes: 15, label: "15 min" },
  Medium: { minutes: 60, label: "1 hr" },
  Low: { minutes: 240, label: "4 hr" },
};

const PUROK_LEADERS = [
  { id: "pl1", name: "Purok 1 Leader", initials: "P1", purok: "Purok 1" },
  { id: "pl2", name: "Purok 2 Leader", initials: "P2", purok: "Purok 2" },
  { id: "pl3", name: "Purok 3 Leader", initials: "P3", purok: "Purok 3" },
  { id: "pl4", name: "Purok 4 Leader", initials: "P4", purok: "Purok 4" },
  { id: "pl5", name: "Purok 5 Leader", initials: "P5", purok: "Purok 5" },
  { id: "pl6", name: "Purok 6 Leader", initials: "P6", purok: "Purok 6" },
];

const ANONYMOUS_REGISTRY = [
  { trackingToken: "TK-8842", category: "Noise Disturbance", purok: "Purok 5", status: "resolved", priority: "Low", time: "2026-07-18T21:40:00" },
  { trackingToken: "TK-7719", category: "Fire/Smoke", purok: "Purok 2", status: "resolved", priority: "Medium", time: "2026-07-17T13:20:00" },
];

const CATEGORY_ICON: Record<string, typeof Flame> = { "Fire/Smoke": Flame, "Noise Disturbance": Volume2 };
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
};

const SENSOR_STATUS = {
  online: { label: "Online", hex: "#10b981", pill: "bg-emerald-50 text-emerald-700" },
  warning: { label: "Warning", hex: "#fbbf24", pill: "bg-amber-50 text-amber-700" },
  offline: { label: "Offline", hex: "#f43f5e", pill: "bg-rose-50 text-rose-600" },
} as const;

const DISPATCH_META: Record<string, { label: string; action: string | null; next?: string; badge: string; dot: string }> = {
  responding: { label: "Responding", action: "On-Scene", next: "on_scene", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  on_scene: { label: "On-Scene", action: "Resolving", next: "resolving", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  resolving: { label: "Resolving", action: "Resolved", next: "resolved", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400" },
  resolved: { label: "Resolved", action: null, badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
};

const ESCALATION_META: Record<EscalationStatus, { label: string; badge: string; dot: string }> = {
  in_triage: { label: "In Triage", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  priority_adjusted: { label: "Priority Adjusted", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400" },
  dispatched: { label: "Dispatched", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  blotter: { label: "Blotter", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
};

// §10.3.5 — canonical IncidentValidation.label enum applied by Purok Leaders.
type ValidationLabel = "locally_confirmed" | "unverified" | "likely_duplicate" | "event_related" | "unable_to_verify";

const VALIDATION_LABEL_META: Record<ValidationLabel, { label: string; badge: string }> = {
  locally_confirmed: { label: "Locally Confirmed", badge: "bg-emerald-100 text-emerald-700" },
  unverified: { label: "Unverified", badge: "bg-stone-100 text-stone-600" },
  likely_duplicate: { label: "Likely Duplicate", badge: "bg-amber-100 text-amber-800" },
  event_related: { label: "Event-Related", badge: "bg-sky-100 text-sky-700" },
  unable_to_verify: { label: "Unable to Verify", badge: "bg-rose-100 text-rose-700" },
};

// The shared incident store still seeds the legacy label strings; normalize them to
// the canonical §10.3.5 vocabulary when rendering, and pass canonical values through.
function displayValidationLabel(label: string): { label: string; badge: string } {
  const legacyToCanonical: Record<string, ValidationLabel> = {
    Confirmed: "locally_confirmed",
    "False Information": "unable_to_verify",
    "Event-Related": "event_related",
  };
  const canonical = (VALIDATION_LABEL_META as Record<string, { label: string; badge: string }>)[label]
    ? (label as ValidationLabel)
    : legacyToCanonical[label];
  return canonical ? VALIDATION_LABEL_META[canonical] : { label, badge: "bg-stone-100 text-stone-600" };
}

// §10.6.5 — canonical SafetyBroadcast.severity. Only `high` requires Captain sign-off (§6.5.10).
type BroadcastSeverity = "info" | "warning" | "high";

const BROADCAST_SEVERITY_META: Record<BroadcastSeverity, { label: string; badge: string; desc: string }> = {
  info: { label: "Info", badge: "bg-sky-100 text-sky-700", desc: "General heads-up · quiet push, no approval" },
  warning: { label: "Warning", badge: "bg-amber-100 text-amber-700", desc: "Heads-up · quiet push, no approval" },
  high: { label: "High", badge: "bg-rose-100 text-rose-700", desc: "Emergency · Captain 1-tap authorization required" },
};

// §6.5.3–6.5.4 — SecurityAlert lifecycle, independent of any spawned incident. Alerts stay
// labelled "Sensor Alert Pending Verification" until the Desk Officer verifies or marks false;
// the raw sensor event (device, value, threshold, trigger time) is preserved either way.
type AlertStatus = "received" | "acknowledged" | "verification_in_progress" | "verified" | "false_or_unverified" | "closed";

interface SensorAlert {
  id: string;
  sensorId: string;
  device: string;
  type: "smoke" | "noise";
  purok: string;
  value: number;
  threshold: number;
  status: AlertStatus;
  triggeredAt: string;
  acknowledgedAt?: string;
  verifiedAt?: string;
  relatedIncidentId?: string;
}

const ALERT_STATUS_META: Record<AlertStatus, { label: string; badge: string; dot: string; actions: { label: string; next: AlertStatus }[] }> = {
  received: {
    label: "Received",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
    actions: [{ label: "Acknowledge", next: "acknowledged" }],
  },
  acknowledged: {
    label: "Acknowledged",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-400",
    actions: [{ label: "Start Verification", next: "verification_in_progress" }],
  },
  verification_in_progress: {
    label: "Verification in Progress",
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-400",
    actions: [
      { label: "Verify — Confirmed", next: "verified" },
      { label: "Mark False / Unverified", next: "false_or_unverified" },
    ],
  },
  verified: {
    label: "Verified",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-400",
    actions: [{ label: "Close", next: "closed" }],
  },
  false_or_unverified: {
    label: "False / Unverified",
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-400",
    actions: [{ label: "Close", next: "closed" }],
  },
  closed: {
    label: "Closed",
    badge: "bg-stone-100 text-stone-500",
    dot: "bg-stone-400",
    actions: [],
  },
};

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const INITIAL_INCIDENTS: Incident[] = [
  { id: "INC-2071", category: "Fire/Smoke", severity: "critical", purok: "Purok 3", description: "Heavy smoke column spotted near market residential row — SM-PUROK3-01 offline, unverified", source: "resident", reporter: "Maria Santos", time: isoAgo(26), status: "new", photos: 2, lat: 100, lng: 200, priority: "High", notes: [] },
  { id: "INC-2072", category: "Fire/Smoke", severity: "warning", purok: "Purok 3", description: "Grey smoke drifting above market row — identical area to an earlier report this hour", source: "resident", reporter: "Anonymous", time: isoAgo(19), status: "new", photos: 1, lat: 103, lng: 198, priority: "High", notes: [], anonymous: true, trackingToken: "TK-4823" },
  { id: "INC-2070", category: "Public Disturbance", severity: "critical", purok: "Purok 6", description: "SOS held for 3 seconds — live GPS locked at commercial strip, possible altercation", source: "sos", reporter: "Ana Lim", time: isoAgo(6), status: "new", photos: 0, lat: 330, lng: 240, priority: "High", notes: [] },
  { id: "INC-2069", category: "Noise Disturbance", severity: "warning", purok: "Purok 4", description: "Manual clip escalated — sustained loud disturbance at hall, DB-HALL-01 at 78 dB", source: "cctv", reporter: "CCTV Op. Santos", time: isoAgo(68), status: "acknowledged", acknowledgedAt: isoAgo(52), photos: 1, lat: 210, lng: 170, priority: "Medium", notes: [] },
  { id: "INC-2068", category: "Fire/Smoke", severity: "warning", purok: "Purok 1", description: "IoT threshold breach — smoke density 512/500 ppm at gate sensor", source: "iot", reporter: "SM-GATE-01", time: isoAgo(150), status: "in_progress", acknowledgedAt: isoAgo(140), photos: 0, lat: 110, lng: 65, priority: "High", notes: [], relatedAlertId: "ALT-118" },
  { id: "INC-2067", category: "Noise Disturbance", severity: "low", purok: "Purok 2", description: "Tanod field report — group gathered near the basketball court, advised and dispersed", source: "tanod", reporter: "Tanod B. Cruz", time: isoAgo(220), status: "acknowledged", acknowledgedAt: isoAgo(40), photos: 1, lat: 225, lng: 60, priority: "Low", notes: [] },
  { id: "INC-2065", category: "Fire/Smoke", severity: "low", purok: "Purok 5", description: "Cooking smoke false alarm — verified within acceptable limits", source: "resident", reporter: "Rosa Garcia", time: "2026-07-19T20:30:00", status: "resolved", photos: 3, lat: 85, lng: 310, rating: 5, priority: "Low", notes: [] },
];

const INITIAL_ALERTS: SensorAlert[] = [
  { id: "ALT-118", sensorId: "s1", device: "SM-GATE-01", type: "smoke", purok: "Purok 1", value: 512, threshold: 500, status: "received", triggeredAt: isoAgo(150), relatedIncidentId: "INC-2068" },
  { id: "ALT-119", sensorId: "s4", device: "SM-PUROK3-01", type: "smoke", purok: "Purok 3", value: 0, threshold: 500, status: "received", triggeredAt: isoAgo(120) },
];

const SENSORS: Sensor[] = [
  { id: "s1", name: "SM-GATE-01", type: "smoke", purok: "Purok 1", status: "online", value: 512, threshold: 500 },
  { id: "s2", name: "SM-PLAZA-02", type: "smoke", purok: "Purok 2", status: "online", value: 85, threshold: 500 },
  { id: "s3", name: "DB-HALL-01", type: "noise", purok: "Purok 4", status: "warning", value: 78, threshold: 85 },
  { id: "s4", name: "SM-PUROK3-01", type: "smoke", purok: "Purok 3", status: "offline", value: 0, threshold: 500 },
  { id: "s5", name: "DB-MARKET-01", type: "noise", purok: "Purok 6", status: "online", value: 62, threshold: 85 },
  { id: "s6", name: "SM-CHAPEL-01", type: "smoke", purok: "Purok 5", status: "online", value: 45, threshold: 500 },
];

interface DispatchItem {
  id: string;
  incident: string;
  team: string;
  status: string;
  purok: string;
  eta: string;
  photos: number;
  assigneeType?: "tanod" | "purok_leader";
}

const INITIAL_DISPATCHES: DispatchItem[] = [
  { id: "DP-1181", incident: "INC-2070", team: "Team Bravo", status: "responding", purok: "Purok 6", eta: "ETA 3 min", photos: 0 },
  { id: "DP-1180", incident: "INC-2068", team: "Team Alpha", status: "on_scene", purok: "Purok 1", eta: "On scene", photos: 1 },
  { id: "DP-1182", incident: "INC-2067", team: "Team Charlie", status: "resolving", purok: "Purok 2", eta: "ETA 10 min", photos: 2 },
  { id: "DP-1178", incident: "INC-2065", team: "Team Delta", status: "resolved", purok: "Purok 5", eta: "Closed", photos: 3 },
];

const TANOD_TEAMS = [
  { id: "t1", name: "Team Alpha", members: 4, status: "on_patrol", purok: "Purok 1", checkpoint: "3/4" },
  { id: "t2", name: "Team Bravo", members: 3, status: "dispatched", purok: "Purok 6", checkpoint: "0/3" },
  { id: "t3", name: "Team Charlie", members: 4, status: "on_patrol", purok: "Purok 2", checkpoint: "2/3" },
  { id: "t4", name: "Team Delta", members: 3, status: "standby", purok: "HQ", checkpoint: "—" },
];

const SHIFT_WEEK = [
  { day: "Mon", morning: "Alpha", night: "Bravo" },
  { day: "Tue", morning: "Bravo", night: "Charlie" },
  { day: "Wed", morning: "Charlie", night: "Delta" },
  { day: "Thu", morning: "Delta", night: "Alpha" },
  { day: "Fri", morning: "Alpha", night: "Charlie" },
  { day: "Sat", morning: "Bravo", night: "Delta" },
  { day: "Sun", morning: "Charlie", night: "Alpha" },
];

const PUROK_COVERAGE = [
  { zone: "Purok 1", pct: 100, checkpoints: "2/2" },
  { zone: "Purok 2", pct: 75, checkpoints: "3/4" },
  { zone: "Purok 3", pct: 50, checkpoints: "2/4" },
  { zone: "Purok 4", pct: 100, checkpoints: "3/3" },
  { zone: "Purok 5", pct: 33, checkpoints: "1/3" },
  { zone: "Purok 6", pct: 66, checkpoints: "2/3" },
];

const INITIAL_BLOTTERS = [
  { id: "B-2026-0142", incident: "INC-2043", title: "Fire/Smoke — False Alarm", purok: "Purok 2", filed: "2026-07-20T10:00:00", officer: "D.O. Ramos" },
  { id: "B-2026-0141", incident: "INC-2042", title: "Noise Disturbance — Verified", purok: "Purok 5", filed: "2026-07-19T21:05:00", officer: "D.O. Ramos" },
];

const CHAT_CONTACTS = [
  { id: "c1", name: "Team Alpha", role: "Tanod Unit", status: "online", unread: 2, initials: "TA" },
  { id: "c2", name: "Team Bravo", role: "Tanod Unit", status: "online", unread: 0, initials: "TB" },
  { id: "c3", name: "Purok 3 Leader", role: "Purok Leader", status: "online", unread: 1, initials: "P3" },
  { id: "c4", name: "Purok 5 Leader", role: "Purok Leader", status: "away", unread: 0, initials: "P5" },
];

const INITIAL_NOTICES: SafetyNotice[] = [
  {
    id: "NTC-003",
    title: "Water interruption advisory — Purok 3",
    category: "Event Notice",
    message: "Scheduled line maintenance by the water district tomorrow 8:00 AM – 12:00 NN. Please store enough water in advance.",
    target: { kind: "purok", purok: "Purok 3" },
    state: "published",
    author: "Desk Officer",
    createdAt: "2026-07-20T09:10:00",
    publishedAt: "2026-07-20T09:10:00",
  },
  {
    id: "NTC-002",
    title: "Community cleanup drive this Saturday",
    category: "Event Notice",
    message: "Barangay-wide cleanup drive this Saturday 6:00 AM starting at the covered court. Bags and gloves will be provided.",
    target: { kind: "barangay" },
    state: "published",
    author: "Desk Officer",
    createdAt: "2026-07-19T15:40:00",
    publishedAt: "2026-07-19T15:40:00",
  },
  {
    id: "NTC-001",
    title: "Tricycle route reblocking notice",
    category: "General",
    message: "DPWH reblocking along the market access road starts Monday. Tricycle operators should plan alternate routes.",
    target: { kind: "purok", purok: "Purok 5" },
    state: "draft",
    author: "Desk Officer",
    createdAt: "2026-07-18T11:20:00",
  },
];

const NOTICE_CATEGORIES: NoticeCategory[] = ["General", "Safety Alert", "Event Notice", "Weather Warning"];

function SafetyNoticeCompose({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (state: "draft" | "published", title: string, category: NoticeCategory, message: string, target: NoticeTarget) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<NoticeCategory>("General");
  const [targetKind, setTargetKind] = useState<"barangay" | "purok">("barangay");
  const [purok, setPurok] = useState("Purok 1");

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title="Publish Safety Notice"
      subtitle="Routine informational notice — no severity grading, no Captain approval"
      icon={<Info size={18} className="text-teal-600" />}
      iconClass="bg-teal-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => { onSave("draft", title, category, message, targetKind === "barangay" ? { kind: "barangay" } : { kind: "purok", purok }); onClose(); }}
            disabled={!title.trim() || !message.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            <Save size={13} />
            Save as Draft
          </button>
          <button
            onClick={() => { onSave("published", title, category, message, targetKind === "barangay" ? { kind: "barangay" } : { kind: "purok", purok }); onClose(); }}
            disabled={!title.trim() || !message.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            <Send size={13} />
            Publish Now
          </button>
        </div>
      }
    >
      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TITLE</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Water interruption advisory"
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
        />
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">MESSAGE</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Write the routine notice residents will read..."
          className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
        />
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CATEGORY</p>
        <div className="flex flex-wrap gap-1.5">
          {NOTICE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                category === c ? "border-teal-500 bg-teal-600 text-white" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              <Tag size={9} />
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TARGET AUDIENCE</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={() => setTargetKind("barangay")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
              targetKind === "barangay" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            <Globe size={14} />
            <div>
              <p className="text-[11px] font-semibold">Entire Barangay</p>
              <p className="text-[9px] opacity-80">All six puroks</p>
            </div>
          </button>
          <button
            onClick={() => setTargetKind("purok")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
              targetKind === "purok" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            <MapPin size={14} />
            <div>
              <p className="text-[11px] font-semibold">Specific Purok</p>
              <p className="text-[9px] opacity-80">Zone-targeted notice</p>
            </div>
          </button>
        </div>
        {targetKind === "purok" && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6"].map((p) => (
              <button
                key={p}
                onClick={() => setPurok(p)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  purok === p ? "border-teal-500 bg-teal-600 text-white" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function sensorRisk(s: Sensor) {
  if (s.status === "offline") return "critical";
  if (s.value >= s.threshold) return "critical";
  if (s.status === "warning") return "warning";
  return "online";
}

function sensorBarColor(pct: number, risk: string) {
  if (risk === "critical") return "bg-rose-500";
  if (pct > 50) return "bg-amber-400";
  return "bg-emerald-500";
}

function coverageColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-rose-500";
}

function nextBlotterId(blotters: { id: string }[]) {
  const max = blotters.reduce((acc, b) => {
    const n = parseInt(b.id.replace(/^B-\d+-/, ""), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `B-2026-${max + 1}`;
}

function isSlaBreached(inc: Incident): boolean {
  if (inc.status !== "new" || inc.acknowledgedAt) return false;
  const target = SLA_TARGETS[inc.priority].minutes * 60_000;
  return Date.now() - new Date(inc.time).getTime() > target;
}

function slaOverrunLabel(inc: Incident): string {
  if (inc.status !== "new") return "";
  const target = SLA_TARGETS[inc.priority].minutes * 60_000;
  const elapsed = Date.now() - new Date(inc.time).getTime();
  if (elapsed <= target) return "";
  const overMin = Math.max(1, Math.round((elapsed - target) / 60_000));
  return `${SLA_TARGETS[inc.priority].label} target exceeded by ${overMin} min`;
}

// §6.1.11 / §14.9 — SMS is reserved for high-priority / emergency events. Push + in-app
// fires on EVERY status transition; SMS is only layered on for High-priority incidents on
// the Acknowledge and Resolve milestones (the two transitions where a text is meaningful),
// never on routine Start-Work or per-transition chatter. Lower-priority incidents are
// push-only throughout.
function statusChangeUsesSms(inc: Incident, next: IncidentStatus): boolean {
  return inc.priority === "High" && (next === "acknowledged" || next === "resolved");
}

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

function possibleDuplicateOf(inc: Incident, all: Incident[]): Incident[] {
  if (inc.status === "resolved" || inc.status === "closed_false_alarm" || inc.duplicateResolved) return [];
  const incTime = new Date(inc.time).getTime();
  return all.filter((other) => {
    if (other.id === inc.id) return false;
    if (other.status === "resolved" || other.status === "closed_false_alarm") return false;
    if (other.duplicateResolved) return false;
    if (other.category !== inc.category) return false;
    if (other.purok !== inc.purok) return false;
    const dt = Math.abs(incTime - new Date(other.time).getTime());
    return dt <= DUPLICATE_WINDOW_MS;
  });
}

function EmergencyPopUp({ alert, onAcknowledge, onSilence, onBroadcast }) {
  if (!alert) return null;
  const isSOS = alert.kind === "sos";
  const source = alert.sensor ? alert.sensor : null;

  return (
    <Modal
      onClose={onSilence}
      size="md"
      panelClass="border-rose-400/60 overflow-hidden"
      title={isSOS ? "Distress Signal Received" : `${source.name} Triggered`}
      subtitle={isSOS ? "EMERGENCY SOS SIGNAL" : "IOT THRESHOLD BREACH"}
      icon={
        <>
          <span className="absolute inset-0 animate-ping rounded-xl bg-rose-400 opacity-30" />
          {isSOS ? <Siren size={22} /> : <BellRing size={22} />}
        </>
      }
      iconClass="relative bg-rose-100 text-rose-600"
      footer={
        <>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
            <button onClick={onSilence} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
              Silence Alert
            </button>
            <button
              onClick={onAcknowledge}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700"
            >
              <Send size={13} />
              Acknowledge &amp; Dispatch
            </button>
          </div>
          <button
            onClick={onBroadcast}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <Megaphone size={13} />
            Escalate to Captain — Mass Alert
          </button>
        </>
      }
    >
      <div className="absolute inset-x-0 top-0 h-1.5 animate-pulse bg-rose-500" />
      <div className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-2xl ring-4 ring-rose-500/30" />
      {isSOS ? (
        <div className="mb-5 space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <MapPin size={15} className="text-rose-600" />
            <p className="text-[13px] font-semibold text-rose-800">
              Ana Lim — Purok 6, Commercial Strip
            </p>
          </div>
          <p className="text-[12px] leading-relaxed text-stone-500">
            SOS button held for 3 seconds. Live GPS coordinates locked and streamed to dispatch.
            Top-priority distress ticket INC-2070 created.
          </p>
        </div>
      ) : (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-stone-500">
              {source.type === "smoke" ? "Smoke Density" : "Decibel Level"}
            </span>
            <span className="text-[14px] font-bold text-rose-600">
              {source.value}{source.type === "smoke" ? " ppm" : " dB"} / {source.threshold}{source.type === "smoke" ? " ppm" : " dB"}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full animate-pulse rounded-full bg-rose-500" style={{ width: `${Math.min(100, (source.value / source.threshold) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">Breach bypassed the standard queue — instant pop-up alert.</p>
        </div>
      )}
    </Modal>
  );
}

function ReporterSafeReviewModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (note: string) => void }) {
  if (!incident) return null;
  const [note, setNote] = useState("");
  return (
    <Modal
      size="md"
      onClose={onClose}
      title="Desk Officer Review — Reporter Indicates Safe"
      subtitle={`${incident.id} · ${incident.purok}`}
      icon={<ShieldCheck size={18} className="text-emerald-600" />}
      iconClass="bg-emerald-100"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 transition hover:bg-stone-50">
            Keep Open
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
          >
            <CheckCircle2 size={13} />
            Confirm Review &amp; Close
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-800">
          <ShieldCheck size={13} />
          Reporter Indicates Safe
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
          {incident.reporter} confirmed safe via the “I'm Safe” response{incident.reporterSafeAt ? ` (${formatTime(incident.reporterSafeAt)})` : ""}. The incident was deliberately kept open — an explicit Desk Officer review is required before it may be Resolved or Closed.
        </p>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REVIEW NOTE (OPTIONAL)</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="e.g. Verified with the resident — situation safe, field unit confirming…"
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-emerald-400"
      />
      <p className="mt-2 text-[10px] text-stone-400">
        Confirming closes the incident as Resolved and records the review in its notes.
      </p>
    </Modal>
  );
}

function IncidentDetail({ incident, onClose, onAdvance, onSetPriority, onAddNote, onCloseFalseAlarm, possibleDuplicates, onKeepSeparate, onLinkRelated, onEscalateToCaptain, onAssign, onMarkReporterSafe, onReviewReporterSafe }) {
  if (!incident) return null;
  const sev = SEVERITY_MAP[incident.severity];
  const CatIcon = CATEGORY_ICON[incident.category] || AlertTriangle;
  const catColors = CATEGORY_COLORS[incident.category] || { bg: "bg-stone-100", text: "text-stone-600" };
  const statusMeta = INCIDENT_STATUS_META[incident.status];
  const sourceMeta = SOURCE_META[incident.source];
  const SourceIcon = sourceMeta.icon;
  const [noteDraft, setNoteDraft] = useState("");
  const [dupAction, setDupAction] = useState<"keep_separate" | null>(null);
  const [dupNote, setDupNote] = useState("");
  const isClosed = incident.status === "resolved" || incident.status === "closed_false_alarm";
  const breached = isSlaBreached(incident);
  const reporterLabel = incident.anonymous ? (incident.trackingToken ?? "Anonymous") : incident.reporter;

  function submitNote() {
    if (!noteDraft.trim()) return;
    onAddNote(incident, noteDraft.trim());
    setNoteDraft("");
  }

  function submitKeepSeparate() {
    if (!dupNote.trim()) return;
    onKeepSeparate(incident, dupNote.trim());
    setDupAction(null);
    setDupNote("");
  }

  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={incident.id}
      subtitle={`${incident.purok} &middot; ${formatTime(incident.time)}`}
      aside={
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${sev.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
          {sev.label}
        </span>
      }
      footer={
        isClosed ? (
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-stone-600 hover:bg-stone-50"
          >
            <CheckCircle2 size={14} />
            Close
          </button>
        ) : (
          <>
            {incident.reporterSafe ? (
              <button
                onClick={() => onReviewReporterSafe(incident)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-emerald-700"
              >
                <ShieldCheck size={14} />
                Review &amp; Close — Reporter Safe
              </button>
            ) : (
              statusMeta.action && (
                <button
                  onClick={() => onAdvance(incident)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#002A8C]"
                >
                  {statusMeta.action}
                </button>
              )
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => onAssign(incident)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <Radio size={12} className="text-[#0038A8]" />
                Assign
              </button>
              <button
                onClick={() => onEscalateToCaptain(incident)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <ArrowUpRight size={12} />
                Escalate to Captain
              </button>
            </div>
            {incident.source === "sos" && !incident.reporterSafe && (
              <button
                onClick={() => onMarkReporterSafe(incident)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <ShieldCheck size={13} />
                Simulate Resident “I'm Safe”
              </button>
            )}
            {incident.reporterSafe ? (
              <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] font-medium text-emerald-600">
                <ShieldCheck size={10} />
                Reporter safe — incident stays open until the Desk Officer confirms closure
              </p>
            ) : (
              <button
                onClick={() => onCloseFalseAlarm(incident)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                <X size={13} />
                Close as False Alarm / Duplicate
              </button>
            )}
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-stone-400">
              <Send size={10} />
              {incident.anonymous
                ? `Real-time status push sent on each change — tracking token ${reporterLabel}, identity never stored`
                : incident.priority === "High"
                  ? `Real-time push on each change — SMS also sent on Acknowledge &amp; Resolve to ${reporterLabel}`
                  : `Real-time push sent to ${reporterLabel} on each change — SMS reserved for high-priority / emergency`}
            </p>
          </>
        )
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${sourceMeta.badge}`}>
          <SourceIcon size={12} />
          {sourceMeta.label}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusMeta.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
          {statusMeta.label}
        </span>
        {incident.anonymous && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700">
            <UserX size={11} />
            Anonymous
          </span>
        )}
        {breached && (
          <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Timer size={11} />
            SLA Breached
          </span>
        )}
        {incident.escalatedToCaptain && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
            <ArrowUpRight size={11} />
            Escalated to Captain
          </span>
        )}
        {incident.reporterSafe && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck size={11} />
            Reporter Indicates Safe
          </span>
        )}
      </div>

      {incident.reporterSafe && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-emerald-700">REPORTER INDICATES SAFE — DESK OFFICER REVIEW REQUIRED</p>
          <p className="mt-1 text-[11px] leading-snug text-emerald-800">
            The resident confirmed they are safe via the “I'm Safe” response. This does <span className="font-semibold">not</span> auto-close the incident — the Desk Officer must explicitly review and close it before it can move to Resolved or Closed.
          </p>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">DESK OFFICER PRIORITY</p>
        <div className="flex flex-wrap gap-1.5">
          {DESK_PRIORITIES.map((p) => {
            const meta = DESK_PRIORITY_META[p];
            const active = incident.priority === p;
            return (
              <button
                key={p}
                disabled={incident.status === "resolved" || incident.status === "closed_false_alarm"}
                onClick={() => onSetPriority(incident, p)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  active ? meta.chip : "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? meta.dot : "bg-stone-300"}`} />
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${catColors.bg} ${catColors.text}`}>
            <CatIcon size={16} />
          </div>
          <span className="text-[12px] font-semibold text-stone-900">{incident.category}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-stone-500">{incident.description}</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">REPORTED BY</p>
          {incident.anonymous ? (
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-stone-700">
              <KeyRound size={11} className="text-stone-400" />
              Anonymous · Tracking {reporterLabel}
            </p>
          ) : (
            <p className="mt-1 text-[12px] font-medium text-stone-900">{incident.reporter}</p>
          )}
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">CITIZEN RATING</p>
          <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-stone-900">
            {incident.rating ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className={i < incident.rating ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
                ))}
                <span className="ml-1 text-stone-400">({incident.rating}.0)</span>
              </>
            ) : (
              <span className="text-stone-400">Pending</span>
            )}
          </p>
        </div>
      </div>

      {breached && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-wider text-rose-700">ACKNOWLEDGMENT SLA — BREACHED</p>
            <span className="flex items-center gap-1 text-[10px] font-medium text-rose-700">
              <Timer size={10} />
              {SLA_TARGETS[incident.priority].label} target
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-rose-800">
            {slaOverrunLabel(incident)}. Priority unchanged — the Desk Officer has been alerted and the Captain has been
            notified for visibility. Acknowledge the incident to clear the breach.
          </p>
        </div>
      )}

      {possibleDuplicates.length > 0 && !incident.duplicateResolved && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-wider text-amber-700">POSSIBLE DUPLICATE</p>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
                Matches another open incident by location, category &amp; submission window — no action was taken automatically.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {possibleDuplicates.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700">
                    <Link2 size={9} className="text-amber-600" />
                    {d.id} · {d.category} · {d.purok}
                  </span>
                ))}
              </div>
              {!dupAction && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setDupAction("keep_separate")}
                    className="flex h-7 items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 text-[10px] font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    <X size={10} />
                    Keep Separate
                  </button>
                  <button
                    onClick={() => onLinkRelated(incident, possibleDuplicates.map((d) => d.id))}
                    className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                  >
                    <Link2 size={10} />
                    Link as Related
                  </button>
                  <button
                    onClick={() => onCloseFalseAlarm(incident)}
                    className="flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-rose-100 px-2.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200"
                  >
                    <CheckCircle2 size={10} />
                    Close as Duplicate
                  </button>
                </div>
              )}
              {dupAction === "keep_separate" && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    value={dupNote}
                    onChange={(e) => setDupNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitKeepSeparate()}
                    placeholder="Required — why keep separate?"
                    className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] text-stone-900 placeholder:text-stone-400 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                  />
                  <button
                    onClick={submitKeepSeparate}
                    disabled={!dupNote.trim()}
                    className="flex h-7 items-center gap-1 rounded-md bg-[#0038A8] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
                  >
                    <CheckCircle2 size={10} />
                    Confirm
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(incident.relatedTo ?? []).length > 0 && (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-sky-700">LINKED RELATED INCIDENTS</p>
          <p className="mt-1 text-[11px] text-sky-800">{(incident.relatedTo ?? []).join(", ")}</p>
        </div>
      )}

      {incident.escalatedToCaptain && (
        <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-violet-700">ESCALATED TO CAPTAIN</p>
          <p className="mt-1 text-[11px] leading-snug text-violet-900">
            {incident.escalatedAt ? `${formatTime(incident.escalatedAt)} — ` : ""}
            "{incident.escalatedReason}". The Captain has been notified; this incident was <span className="font-semibold">not</span> forwarded to any external agency.
          </p>
        </div>
      )}

      {incident.validationLabel && (
        <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-teal-600">INCIDENT VALIDATION (Purok Leader)</p>
          <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${displayValidationLabel(incident.validationLabel).badge}`}>
            <Shield size={11} />
            {displayValidationLabel(incident.validationLabel).label}
          </div>
          <p className="mt-1 text-[12px] text-teal-800">Field validation recorded by the Purok Leader (§10.3.5).</p>
        </div>
      )}

      {incident.photos > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold text-stone-900">Attached Evidence ({incident.photos})</p>
          <div className="flex gap-2">
            {Array.from({ length: incident.photos }).map((_, i) => (
              <div key={i} className="flex h-20 w-20 items-center justify-center rounded-lg border border-stone-200 bg-stone-100">
                <ImageIcon size={18} className="text-stone-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">GEOTAG &amp; BOUNDARY PARSING</p>
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-[#0038A8]" />
          <span className="font-mono text-[11px] text-stone-900">{incident.lat}, {incident.lng}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span className="text-[11px] text-stone-500">Coordinates verified within {incident.purok} boundary</span>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">INTERNAL NOTES (Desk Officer Only)</p>
        {(incident.notes ?? []).length === 0 ? (
          <p className="mb-2 text-[11px] text-stone-400">No internal notes yet — record observations before dispatch.</p>
        ) : (
          <div className="mb-2 space-y-1.5">
            {(incident.notes ?? []).map((n, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Shield size={11} className="mt-0.5 shrink-0 text-[#0038A8]" />
                <p className="text-[11px] leading-snug text-stone-700">{n}</p>
              </div>
            ))}
          </div>
        )}
        {incident.status !== "resolved" && incident.status !== "closed_false_alarm" && (
          <div className="flex items-center gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNote()}
              placeholder="Add an internal note…"
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            />
            <button
              onClick={submitNote}
              disabled={!noteDraft.trim()}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:opacity-40"
            >
              <FileText size={12} />
              Add
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AnonymousLookupModal({ incidents, onClose }) {
  const [token, setToken] = useState("");
  const [searched, setSearched] = useState(false);
  const query = token.trim().toUpperCase().replace(/^ANON-/, "TK-");

  const liveMatch = incidents.find((i) => i.anonymous && i.trackingToken?.toUpperCase() === query);
  const archiveMatch = ANONYMOUS_REGISTRY.find((r) => r.trackingToken.toUpperCase() === query);
  const found = liveMatch || archiveMatch;

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Anonymous Report Lookup"
      subtitle="Limited status view tied to a tracking token — reporter identity is never exposed"
      icon={<UserX size={18} className="text-stone-600" />}
      iconClass="bg-stone-100"
      footer={
        <button onClick={onClose} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
          Close
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <KeyRound size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={token}
            onChange={(e) => { setToken(e.target.value); setSearched(false); }}
            onKeyDown={(e) => e.key === "Enter" && setSearched(true)}
            placeholder="Enter tracking token (e.g. TK-4823)"
            className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          />
        </div>
        <button
          onClick={() => setSearched(true)}
          disabled={!token.trim()}
          className="flex h-9 items-center gap-1 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
        >
          <Search size={12} />
          Lookup
        </button>
      </div>

      {searched && !found && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-6 text-center">
          <KeyRound size={18} className="mx-auto text-stone-300" />
          <p className="mt-2 text-[12px] font-medium text-stone-600">No record found for {query}</p>
          <p className="mt-0.5 text-[10px] text-stone-400">Check the token and try again — anonymous records are keyed by tracking token only.</p>
        </div>
      )}

      {searched && found && (
        <div className="space-y-2">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">TRACKING TOKEN</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] font-semibold text-stone-900">
              <KeyRound size={11} className="text-stone-400" />
              {found.trackingToken}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">CATEGORY</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{found.category}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">PUROK</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{found.purok}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">STATUS</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{found.status === "new" ? "In triage" : found.status}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">PRIORITY</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{found.priority}</p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">SUBMITTED</p>
            <p className="mt-1 text-[12px] font-medium text-stone-900">{formatTime(found.time)}</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <Shield size={12} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-[10px] leading-snug text-emerald-700">
              Identity-safe lookup — no reporter name, phone number or device info is returned.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EscalateToCaptainModal({ incident, onClose, onConfirm }) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Escalate to Captain"
      subtitle={`${incident.id} · ${incident.category} · ${incident.purok}`}
      icon={<ArrowUpRight size={18} className="text-rose-600" />}
      iconClass="bg-rose-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(incident, reason.trim()); onClose(); }}
            disabled={!reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            <ArrowUpRight size={13} />
            Escalate
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[11px] leading-snug text-stone-600">{incident.description}</p>
        <p className="mt-1 text-[10px] text-stone-400">
          Current status: {INCIDENT_STATUS_META[incident.status].label} · Priority {incident.priority}
        </p>
      </div>

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REASON (REQUIRED)</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder="Explain why the Captain needs visibility on this incident…"
        className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
      />

      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <Shield size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <p className="text-[10px] leading-snug text-stone-500">
          The Captain is notified and a status note is logged. The incident record and its current state are preserved —
          this is <span className="font-semibold">not</span> forwarded to any external agency.
        </p>
      </div>
    </Modal>
  );
}

function CloseFalseAlarmModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, reason: string) => void }) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Close as False Alarm / Duplicate"
      subtitle={`${incident.id} · ${incident.category} · ${incident.purok}`}
      icon={<X size={18} className="text-stone-600" />}
      iconClass="bg-stone-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(incident, reason.trim()); onClose(); }}
            disabled={!reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
          >
            <X size={13} />
            Confirm Closure
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[11px] leading-snug text-stone-600">{incident.description}</p>
        <p className="mt-1 text-[10px] text-stone-400">
          Current status: {INCIDENT_STATUS_META[incident.status].label} · Priority {incident.priority}
        </p>
      </div>

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CLOSURE REASON (REQUIRED)</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder="Explain why this report is a false alarm or duplicate — e.g. sensor triggered by cooking smoke, already covered by INC-xxxx…"
        className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
      />

      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <Shield size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <p className="text-[10px] leading-snug text-stone-500">
          §6.1.7 — a closure reason is <span className="font-semibold">mandatory</span> for Closed – False Alarm.
          The reason is recorded on the record and the reporter is notified.
        </p>
      </div>
    </Modal>
  );
}

function AssignIncidentModal({ incident, onClose, onAssign }) {
  const [tab, setTab] = useState<"tanod" | "purok_leader">("tanod");
  const [selected, setSelected] = useState("");

  const tanodTeams = TANOD_TEAMS.filter((t) => t.status !== "standby");
  const leaders = PUROK_LEADERS;
  const list = tab === "tanod" ? tanodTeams : leaders;
  const effectiveSelected = selected || list[0]?.id || "";

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Assign Incident"
      subtitle={`${incident.id} · ${incident.category} · ${incident.purok}`}
      icon={<Radio size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onAssign(incident, tab, effectiveSelected)}
            disabled={!effectiveSelected}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
          >
            <Send size={13} />
            {tab === "tanod" ? "Dispatch Now" : "Assign to Leader"}
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-stone-900">{incident.category}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_MAP[incident.severity].badge}`}>
            {SEVERITY_MAP[incident.severity].label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-stone-600">{incident.description}</p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-stone-400">
          <MapPin size={9} />
          {incident.purok}
          <span className="mx-0.5">&middot;</span>
          {incident.anonymous ? `Anonymous · ${incident.trackingToken}` : incident.reporter}
        </p>
      </div>

      <div className="mb-4 flex gap-1.5 rounded-lg border border-stone-200 bg-stone-100 p-1">
        <button
          onClick={() => setTab("tanod")}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${tab === "tanod" ? "bg-white text-[#0038A8] shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
        >
          Tanod Dispatch
        </button>
        <button
          onClick={() => setTab("purok_leader")}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${tab === "purok_leader" ? "bg-white text-teal-700 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
        >
          Purok Leader
        </button>
      </div>

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">
        {tab === "tanod" ? "AVAILABLE ON-DUTY TANOD TEAMS" : "PUROK LEADERS"}
      </p>
      <div className="mb-4 space-y-2">
        {list.map((item) => {
          const id = item.id;
          const name = (item as any).name;
          const sub = tab === "tanod" ? `${(item as any).members} members · ${(item as any).purok}` : (item as any).purok;
          const initials = tab === "tanod" ? name.replace("Team ", "") : (item as any).initials;
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 transition ${
                effectiveSelected === id ? "border-[#0038A8]/40 bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${tab === "tanod" ? "bg-[#0038A8]" : "bg-teal-600"}`}>
                  {initials}
                </span>
                <span className="text-left">
                  <span className="block text-[12px] font-semibold text-stone-900">{name}</span>
                  <span className="block text-[10px] text-stone-400">{sub}</span>
                </span>
              </span>
              {effectiveSelected === id && <CheckCircle2 size={15} className={tab === "tanod" ? "text-[#0038A8]" : "text-teal-600"} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        {tab === "tanod" ? (
          <BellRing size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        ) : (
          <Flag size={12} className="mt-0.5 shrink-0 text-teal-600" />
        )}
        <p className="text-[10px] leading-snug text-stone-500">
          {tab === "tanod"
            ? "High-priority vibration + audio push fires on assignment; a dispatch entry is created and tracked in Active Dispatches."
            : "The Purok Leader is notified through their portal and assigned local responsibility for the incident; a tracking entry appears in Active Dispatches."}
        </p>
      </div>
    </Modal>
  );
}

function BroadcastCompose({ onClose, onSend, hint }) {
  const [message, setMessage] = useState(
    hint ? `EMERGENCY ALERT: ${hint} — high severity. Take immediate precaution.` : ""
  );
  const [severity, setSeverity] = useState<BroadcastSeverity>("high");

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title="Mass Broadcast"
      subtitle="Community-wide SMS &amp; push — high severity requires Captain 1-tap authorization (§6.5.10)"
      icon={<Megaphone size={18} className="text-rose-600" />}
      iconClass="bg-rose-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => { onSend(severity, message.trim()); onClose(); }}
            disabled={!message.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
          >
            <Send size={13} />
            {severity === "high" ? "Send for Captain Authorization" : "Send Quiet Push"}
          </button>
        </div>
      }
    >
      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SEVERITY</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(BROADCAST_SEVERITY_META) as BroadcastSeverity[]).map((sev) => {
            const meta = BROADCAST_SEVERITY_META[sev];
            return (
              <button
                key={sev}
                onClick={() => setSeverity(sev)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  severity === sev ? `${meta.badge} border-current` : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className="block text-[11px] font-semibold capitalize">{meta.label}</span>
                <span className="mt-0.5 block text-[9px] leading-snug opacity-80">{meta.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">MESSAGE</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Type mass alert message..."
          className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
        />
      </div>
    </Modal>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { flash, ToastPortal } = useToast();
  const { escalatedCases, updateCase } = usePurokIncidents();

  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [sensors, setSensors] = useState(SENSORS);
  const [alerts, setAlerts] = useState<SensorAlert[]>(INITIAL_ALERTS);
  const [dispatches, setDispatches] = useState<DispatchItem[]>(INITIAL_DISPATCHES);
  const [blotters, setBlotters] = useState(INITIAL_BLOTTERS);
  const [popAlert, setPopAlert] = useState<{ kind: "iot" | "sos"; sensor?: Sensor } | null>(null);
  const triggeredRef = useRef<string[]>(
    SENSORS.filter((s) => sensorRisk(s) === "critical").map((s) => s.id)
  );

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastHint, setBroadcastHint] = useState("");
  const [broadcastDone, setBroadcastDone] = useState<string | null>(null);
  const [noticeComposeOpen, setNoticeComposeOpen] = useState(false);
  const [notices, setNotices] = useState<SafetyNotice[]>(getSafetyNotices());
  const [blotterSuccess, setBlotterSuccess] = useState<any>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [escalateTarget, setEscalateTarget] = useState<Incident | null>(null);
  const [assignTarget, setAssignTarget] = useState<Incident | null>(null);
  const [safeReviewTarget, setSafeReviewTarget] = useState<Incident | null>(null);
  const [closeTarget, setCloseTarget] = useState<Incident | null>(null);
  const slaNotifiedRef = useRef<string[]>([]);

  const sensorsRef = useRef(sensors);
  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);

  const alertsRef = useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    seedSafetyNotices(INITIAL_NOTICES);
    setNotices(getSafetyNotices());
    return subscribeSafetyNotices(() => setNotices(getSafetyNotices()));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = sensorsRef.current.map((s) => {
        if (s.status === "offline") return s;
        const jitter = Math.floor(Math.random() * 7) - 3;
        return { ...s, value: Math.max(0, Math.min(s.threshold + 80, s.value + jitter)) };
      });
      setSensors(next);
      const breached = next.find((s) => sensorRisk(s) === "critical" && !triggeredRef.current.includes(s.id));
      if (breached) {
        triggeredRef.current.push(breached.id);
        const alertId = `ALT-${120 + alertsRef.current.length}`;
        setAlerts((prev) => [
          {
            id: alertId,
            sensorId: breached.id,
            device: breached.name,
            type: breached.type,
            purok: breached.purok,
            value: breached.value,
            threshold: breached.threshold,
            status: "received",
            triggeredAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setPopAlert((p) => p ?? { kind: "iot", sensor: breached });
      }
    }, 4000);

    const sosTimer = setTimeout(() => {
      setPopAlert((p) => p ?? { kind: "sos" });
    }, 9000);

    return () => {
      clearInterval(interval);
      clearTimeout(sosTimer);
    };
  }, []);

  useEffect(() => {
    const breached = incidents.filter((i) => isSlaBreached(i) && !slaNotifiedRef.current.includes(i.id));
    if (breached.length === 0) return;
    slaNotifiedRef.current = [...slaNotifiedRef.current, ...breached.map((i) => i.id)];
    setIncidents((prev) =>
      prev.map((i) =>
        breached.some((b) => b.id === i.id)
          ? { ...i, slaBreached: true, notes: [...(i.notes ?? []), `SLA breach: ${slaOverrunLabel(i)} — Desk Officer & Captain notified. Priority unchanged.`] }
          : i
      )
    );
    breached.forEach((i) => {
      addCaptainInboxItem({
        type: "sla_breach",
        incidentId: i.id,
        title: `${i.category} — acknowledgment SLA breached in ${i.purok}`,
        purok: i.purok,
        priority: i.priority,
        submittedBy: "Desk Officer",
      });
      flash(`${i.id} acknowledgment SLA breached — ${slaOverrunLabel(i)} (${SLA_TARGETS[i.priority].label})`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  function advanceIncident(incident: Incident) {
    const next = INCIDENT_STATUS_META[incident.status].next;
    if (!next) return;
    if (incident.reporterSafe && next === "resolved") {
      setSafeReviewTarget(incident);
      flash(`${incident.id} — Reporter indicates safe; explicit Desk Officer review required before close`);
      return;
    }
    const patch: Partial<Incident> = { status: next };
    if (next === "acknowledged") patch.acknowledgedAt = new Date().toISOString();
    setIncidents((prev) => prev.map((i) => (i.id === incident.id ? { ...i, ...patch } : i)));
    setSelectedIncident(null);
    const usesSms = statusChangeUsesSms(incident, next);
    flash(`${incident.id} moved to ${INCIDENT_STATUS_META[next].label} — ${usesSms ? "push + SMS sent to reporter" : "push notification sent to reporter"}`);
  }

  function markReporterSafe(incident: Incident) {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? {
              ...i,
              reporterSafe: true,
              reporterSafeAt: new Date().toISOString(),
              notes: [...(i.notes ?? []), "Reporter indicates safe (I'm Safe) — incident NOT auto-closed; Desk Officer review required before close"],
            }
          : i
      )
    );
    setSelectedIncident(null);
    flash(`${incident.id} — Reporter indicates safe. Incident kept open; Desk Officer review required before closing.`);
  }

  function confirmReporterSafeClose(incident: Incident, note: string) {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? { ...i, status: "resolved", notes: [...(i.notes ?? []), `Reporter safe — Desk Officer review & close: ${note || "No additional note"}`] }
          : i
      )
    );
    setSafeReviewTarget(null);
    setSelectedIncident(null);
    flash(`${incident.id} closed after Desk Officer review — reporter indicated safe`);
  }

  function setPriority(incident: Incident, priority: DeskPriority) {
    setIncidents((prev) => prev.map((i) => (i.id === incident.id ? { ...i, priority } : i)));
    flash(`${incident.id} priority set to ${priority}`);
  }

  function addNote(incident: Incident, note: string) {
    setIncidents((prev) => prev.map((i) => (i.id === incident.id ? { ...i, notes: [...(i.notes ?? []), note] } : i)));
    flash(`Internal note added to ${incident.id}`);
  }

  function requestCloseFalseAlarm(incident: Incident) {
    if (incident.reporterSafe) {
      setSafeReviewTarget(incident);
      flash(`${incident.id} — Reporter indicates safe; Desk Officer review required before closing`);
      return;
    }
    setCloseTarget(incident);
  }

  function closeFalseAlarm(incident: Incident, reason: string) {
    if (incident.reporterSafe) {
      setSafeReviewTarget(incident);
      flash(`${incident.id} — Reporter indicates safe; Desk Officer review required before closing`);
      return;
    }
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? { ...i, status: "closed_false_alarm", closedReason: reason, notes: [...(i.notes ?? []), `Closed as false alarm / duplicate — ${reason}`] }
          : i
      )
    );
    setCloseTarget(null);
    setSelectedIncident(null);
    flash(incident.anonymous ? `${incident.id} closed as false alarm / duplicate — closure reason recorded, tracking token notified` : `${incident.id} closed as false alarm / duplicate — closure reason recorded, reporter notified`);
  }

  function advanceAlert(alert: SensorAlert, next: AlertStatus) {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alert.id
          ? {
              ...a,
              status: next,
              acknowledgedAt: next === "acknowledged" ? (a.acknowledgedAt ?? new Date().toISOString()) : a.acknowledgedAt,
              verifiedAt: next === "verified" ? new Date().toISOString() : a.verifiedAt,
            }
          : a
      )
    );
    flash(`${alert.id} marked ${ALERT_STATUS_META[next].label}`);
  }

  function keepSeparate(incident: Incident, note: string) {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? { ...i, duplicateResolved: true, notes: [...(i.notes ?? []), `Kept separate from possible duplicate — ${note}`] }
          : i
      )
    );
    flash(`${incident.id} kept separate from possible duplicate — note logged`);
  }

  function linkRelated(incident: Incident, otherIds: string[]) {
    setIncidents((prev) =>
      prev.map((i) => {
        if (i.id === incident.id) {
          return { ...i, duplicateResolved: true, relatedTo: [...new Set([...(i.relatedTo ?? []), ...otherIds])], notes: [...(i.notes ?? []), `Linked as related to ${otherIds.join(", ")} — no auto-merge`] };
        }
        if (otherIds.includes(i.id)) {
          return { ...i, duplicateResolved: true, relatedTo: [...new Set([...(i.relatedTo ?? []), incident.id])] };
        }
        return i;
      })
    );
    flash(`${incident.id} linked as related to ${otherIds.join(", ")} — no auto-merge`);
  }

  function escalateToCaptain(incident: Incident, reason: string) {
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? { ...i, escalatedToCaptain: true, escalatedReason: reason, escalatedAt: new Date().toISOString(), notes: [...(i.notes ?? []), `Escalated to Captain — ${reason}`] }
          : i
      )
    );
    addCaptainInboxItem({
      type: "escalation",
      incidentId: incident.id,
      title: `${incident.category} escalated by Desk Officer in ${incident.purok}`,
      purok: incident.purok,
      priority: incident.priority,
      reason,
      submittedBy: "Desk Officer",
    });
    flash(`${incident.id} escalated to Captain — record preserved, no external forward`);
  }

  function assignIncident(incident: Incident, tab: "tanod" | "purok_leader", selectedId: string) {
    const isTanod = tab === "tanod";
    const assignee = isTanod
      ? TANOD_TEAMS.find((t) => t.id === selectedId)?.name ?? "Team Alpha"
      : PUROK_LEADERS.find((l) => l.id === selectedId)?.name ?? "Purok Leader";
    const dispatchId = `DP-${1183 + dispatches.length}`;
    setDispatches((prev) => [
      {
        id: dispatchId,
        incident: incident.id,
        team: assignee,
        status: "responding",
        purok: incident.purok,
        eta: isTanod ? "ETA 5 min" : "Awaiting leader report",
        photos: 0,
        ...(isTanod ? {} : { assigneeType: "purok_leader" }),
      },
      ...prev,
    ]);
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? { ...i, notes: [...(i.notes ?? []), `${isTanod ? "Dispatched" : "Assigned"} to ${assignee} (${isTanod ? "Tanod" : "Purok Leader"})`] }
          : i
      )
    );
    setAssignTarget(null);
    setSelectedIncident(null);
    flash(isTanod ? `${incident.id} dispatched to ${assignee} — dispatch ${dispatchId} created` : `${incident.id} assigned to ${assignee} — ${dispatchId} created`);
  }

  function advanceDispatch(id: string) {
    const dp = dispatches.find((d) => d.id === id);
    if (!dp) return;
    const next = DISPATCH_META[dp.status].next;
    if (!next) return;
    setDispatches((prev) => prev.map((d) => (d.id === id ? { ...d, status: next } : d)));
    flash(`${dp.id} marked ${DISPATCH_META[next].label}`);
  }

  function convertToBlotter() {
    const inc = incidents.find((i) => i.id === "INC-2065");
    if (!inc) return;
    const existing = blotters.some((b) => b.incident === inc.id);
    if (existing) return;
    const nextId = nextBlotterId(blotters);
    setBlotters((prev) => [
      { id: nextId, incident: inc.id, title: `${inc.category} — ${inc.severity}`, purok: inc.purok, filed: new Date().toISOString(), officer: "D.O. Ramos" },
      ...prev,
    ]);
    setBlotterSuccess({ id: nextId, incident: inc.id });
  }

  function advanceEscalation(c: EscalatedCase) {
    const next = nextEscalationStatus(c.status);
    if (!next) return;
    const patch: Partial<EscalatedCase> = { status: next };

    if (next === "priority_adjusted") {
      patch.adjustedPriority = c.adjustedPriority ?? c.suggestedPriority;
      patch.statusNote = "Priority reviewed by the Desk Officer during triage.";
    } else if (next === "dispatched") {
      const team = TANOD_TEAMS.find((t) => t.status !== "standby")?.name ?? "Team Alpha";
      patch.tanodUnit = team;
      patch.statusNote = `Dispatched to ${team} for field response.`;
      setDispatches((prev) => [
        { id: `DP-${1183 + Math.floor(Math.random() * 20)}`, incident: c.id, team, status: "responding", purok: c.purok, eta: "ETA 5 min", photos: 0 },
        ...prev,
      ]);
    } else if (next === "blotter") {
      const existing = blotters.some((b) => b.incident === c.id);
      if (!existing) {
        const nextId = nextBlotterId(blotters);
        setBlotters((prev) => [
          { id: nextId, incident: c.id, title: `${c.category} — ${SEVERITY_MAP[c.suggestedPriority].label}`, purok: c.purok, filed: new Date().toISOString(), officer: c.deskOfficer },
          ...prev,
        ]);
        patch.blottedId = nextId;
      }
      patch.statusNote = "Archived into the digital barangay blotter.";
    }

    updateCase(c.id, patch);
    flash(`${c.id} advanced to ${next.replace("_", " ")}`);
  }

  function adjustEscalationPriority(c: EscalatedCase, priority: EscalatedCase["suggestedPriority"]) {
    updateCase(c.id, {
      adjustedPriority: priority,
      status: "priority_adjusted",
      statusNote: `Priority adjusted to ${priority} by the Desk Officer.`,
    });
    flash(`${c.id} priority adjusted to ${priority}`);
  }

  function submitBroadcast(severity: BroadcastSeverity, message: string) {
    const draft = addPendingBroadcast({
      title: message.split(":")[0].replace(/^EMERGENCY ALERT:\s*/, "").slice(0, 60) || message.slice(0, 60),
      severity,
      purok: "All Puroks",
      message,
      category: "General",
      deliveryMethod: severity === "high" ? "push+sms" : "push",
      createdAt: new Date().toISOString(),
      submittedBy: "Desk Officer",
    });
    setBroadcastDone(draft.id);
    flash(severity === "high" ? `${draft.id} queued for Captain authorization` : `${draft.id} sent as quiet push — no approval required`);
  }

  function submitSafetyNotice(state: "draft" | "published", title: string, category: NoticeCategory, message: string, target: NoticeTarget) {
    const notice = addSafetyNotice({
      title,
      category,
      message,
      target,
      state,
      author: "Desk Officer",
      createdAt: new Date().toISOString(),
      publishedAt: state === "published" ? new Date().toISOString() : undefined,
    });
    flash(`${notice.id} saved as ${state}`);
  }

  const activeIncidents = incidents
    .filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm")
    .sort((a, b) => {
      const aBreached = isSlaBreached(a) ? 1 : 0;
      const bBreached = isSlaBreached(b) ? 1 : 0;
      if (aBreached !== bBreached) return bBreached - aBreached;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
  const breachedCount = incidents.filter((i) => isSlaBreached(i)).length;
  const sosCount = incidents.filter((i) => i.source === "sos" && i.status !== "resolved").length;
  const openAlerts = sensors.filter((s) => sensorRisk(s) !== "online").length;
  const pendingVerificationCount = alerts.filter((a) => a.status !== "verified" && a.status !== "false_or_unverified" && a.status !== "closed").length;
  const activeDispatches = dispatches.filter((d) => d.status !== "resolved").length;
  const onDutyTeams = TANOD_TEAMS.filter((t) => t.status !== "standby").length;

  const kpis = [
    { label: "ACTIVE INCIDENTS", value: activeIncidents.length, sub: `${sosCount} SOS · ${activeIncidents.filter((i) => i.status === "new").length} new${breachedCount ? ` · ${breachedCount} SLA breached` : ""}`, icon: ClipboardList },
    { label: "IOT ALERTS", value: openAlerts, sub: `${sensors.filter((s) => sensorRisk(s) === "critical").length} critical / ${sensors.filter((s) => sensorRisk(s) === "warning").length} warning${pendingVerificationCount ? ` · ${pendingVerificationCount} pending verification` : ""}`, icon: BellRing, pulse: !!popAlert },
    { label: "ACTIVE DISPATCHES", value: activeDispatches, sub: `${dispatches.filter((d) => d.status === "responding").length} responding`, icon: Radio },
    { label: "TANODS ON DUTY", value: `${onDutyTeams}/${TANOD_TEAMS.length}`, sub: `${TANOD_TEAMS.reduce((a, t) => a + t.members, 0)} field personnel`, icon: Users },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Barangay Desk Officer Dashboard</h1>
              <p className="mt-1 text-sm text-stone-500">
                Central hub for triage, IoT alerts, field dispatch &amp; official logs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLookupOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <KeyRound size={13} />
                Anonymous Report Lookup
              </button>
              <button
                onClick={() => { setBroadcastHint(""); setBroadcastOpen(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Megaphone size={13} />
                Mass Broadcast
              </button>
              <button
                onClick={() => setNoticeComposeOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                <Info size={13} />
                Publish Safety Notice
              </button>
            </div>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon, pulse }) => (
            <div
              key={label}
              className={`rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm transition-all duration-300 ${pulse ? "ring-2 ring-rose-300 animate-pulse" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 480 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Incident Triage Desk</h3>
                  <p className="text-[11px] text-[#94A3B8]">Intake from resident app, tanod field reports, CCTV escalation, IoT sensors &amp; SOS</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-600">{sosCount} SOS</span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{activeIncidents.length} open</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {activeIncidents.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[12px] text-stone-400">No open incidents in the triage queue</p>
                </div>
              ) : (
                activeIncidents.map((inc, i) => {
                  const sev = SEVERITY_MAP[inc.severity];
                  const statusMeta = INCIDENT_STATUS_META[inc.status];
                  const sourceMeta = SOURCE_META[inc.source];
                  const prioMeta = DESK_PRIORITY_META[inc.priority];
                  const SourceIcon = sourceMeta.icon;
                  const CatIcon = CATEGORY_ICON[inc.category] || AlertTriangle;
                  const catColors = CATEGORY_COLORS[inc.category] || { bg: "bg-stone-100", text: "text-stone-600" };
                  const isSOS = inc.source === "sos";
                  const breached = isSlaBreached(inc);
                  const dupMatches = possibleDuplicateOf(inc, incidents);
                  return (
                    <div
                      key={inc.id}
                      className={`px-5 py-3 ${i < activeIncidents.length - 1 ? "border-b border-black/5" : ""} ${breached ? "bg-rose-50/50 ring-1 ring-inset ring-rose-200" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${catColors.bg} ${catColors.text}`}>
                          {isSOS && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-rose-500" />}
                          <CatIcon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-semibold text-stone-900">{inc.id}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                              {sev.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${prioMeta.chip}`}>
                              <span className={`h-1 w-1 rounded-full ${prioMeta.dot}`} />
                              {inc.priority}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sourceMeta.badge}`}>
                              <SourceIcon size={9} />
                              {sourceMeta.label}
                            </span>
                            {inc.anonymous && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-stone-800 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                <UserX size={9} />
                                Anonymous
                              </span>
                            )}
                            {dupMatches.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                <AlertTriangle size={9} />
                                Possible Duplicate
                              </span>
                            )}
                            {breached && (
                              <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                <Timer size={9} />
                                SLA Breached
                              </span>
                            )}
                            {inc.escalatedToCaptain && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                                <ArrowUpRight size={9} />
                                Escalated
                              </span>
                            )}
                            {inc.reporterSafe && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                <ShieldCheck size={9} />
                                Reporter Safe
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-stone-500">{inc.description}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                            <MapPin size={9} />
                            {inc.purok}
                            <span className="mx-0.5">&middot;</span>
                            <Clock size={9} />
                            {formatTime(inc.time)}
                            {inc.anonymous && inc.trackingToken && (
                              <>
                                <span className="mx-0.5">&middot;</span>
                                <KeyRound size={9} />
                                {inc.trackingToken}
                              </>
                            )}
                            {inc.photos > 0 && (
                              <>
                                <span className="mx-0.5">&middot;</span>
                                <ImageIcon size={9} />
                                {inc.photos}
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
                        {statusMeta.action && (
                          <button
                            onClick={() => advanceIncident(inc)}
                            className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                          >
                            <CheckCircle2 size={11} />
                            {statusMeta.action}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <BellRing size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">IoT Alert Command</h3>
                  <p className="text-[11px] text-[#94A3B8]">Live ESP32 telemetry via MQTT / WebSocket</p>
                </div>
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate("iot_alerts")} className="flex items-center gap-0.5 text-[11px] font-medium text-[#0038A8] hover:underline">
                  Open <ChevronRight size={11} />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {sensors.map((s) => {
                const risk = sensorRisk(s);
                const st = SENSOR_STATUS[s.status];
                const pct = Math.min(100, (s.value / s.threshold) * 100);
                const alert = alerts.find((a) => a.sensorId === s.id);
                const alertMeta = alert ? ALERT_STATUS_META[alert.status] : null;
                const pendingVerification = alert && alert.status !== "verified" && alert.status !== "false_or_unverified" && alert.status !== "closed";
                return (
                  <div key={s.id} className={`rounded-lg border px-3.5 py-3 ${risk === "critical" ? "border-rose-200 bg-rose-50/60" : "border-stone-200 bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-stone-900">
                          <span className={`h-2 w-2 rounded-full ${risk === "critical" ? "bg-rose-500" : risk === "warning" ? "bg-amber-400" : "bg-emerald-500"}`} />
                          {s.name}
                        </span>
                        <span className="text-[10px] text-stone-400">{s.purok}</span>
                      </div>
                      <span className="text-[11px] font-bold text-stone-900">
                        {s.value}<span className="text-[10px] font-normal text-stone-400">{s.type === "smoke" ? " ppm" : " dB"}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                        <div className={`h-full rounded-full transition-all duration-500 ${sensorBarColor(pct, risk)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${st.pill}`}>
                        {s.status === "online" ? <Wifi size={9} /> : s.status === "offline" ? <WifiOff size={9} /> : <Zap size={9} />}
                        {risk === "critical" ? "Breach" : st.label}
                      </span>
                    </div>

                    {alert && alertMeta && (
                      <div className="mt-2.5 border-t border-stone-100 pt-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pendingVerification && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                              <AlertTriangle size={9} />
                              Sensor Alert Pending Verification
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${alertMeta.badge}`}>
                            <span className={`h-1 w-1 rounded-full ${alertMeta.dot}`} />
                            {alert.id} · {alertMeta.label}
                          </span>
                          <span className="text-[9px] text-stone-400">
                            {alert.value}/{alert.threshold} {alert.type === "smoke" ? "ppm" : "dB"} · {formatTime(alert.triggeredAt)}
                          </span>
                        </div>
                        {alertMeta.actions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {alertMeta.actions.map((a) => (
                              <button
                                key={a.next}
                                onClick={() => advanceAlert(alert, a.next)}
                                className={`flex h-6 items-center gap-1 rounded-md px-2 text-[9px] font-semibold transition ${
                                  a.next === "verified"
                                    ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : a.next === "false_or_unverified"
                                      ? "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                      : "border border-[#0038A8]/20 bg-[#0038A8]/5 text-[#0038A8] hover:bg-[#0038A8] hover:text-white"
                                }`}
                              >
                                {a.next === "verified" ? <CheckCircle2 size={9} /> : a.next === "false_or_unverified" ? <X size={9} /> : <ChevronRight size={9} />}
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Purok Leader Escalations — Triage Desk</h3>
                <p className="text-[11px] text-[#94A3B8]">Live escalations from the shared incident store, handled in the transfer stage flow</p>
              </div>
            </div>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700">
              {escalatedCases.filter((c) => c.status !== "blotter").length} in transfer
            </span>
          </div>

          <div className="min-h-0 space-y-2 overflow-y-auto px-5 pb-5">
            {escalatedCases.length === 0 ? (
              <p className="px-2 py-8 text-center text-[12px] text-stone-400">No Purok Leader escalations yet</p>
            ) : (
              escalatedCases.map((c) => {
                const stage = ESCALATION_META[c.status];
                const sev = SEVERITY_MAP[c.adjustedPriority ?? c.suggestedPriority];
                const next = nextEscalationStatus(c.status);
                return (
                  <div key={c.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-stone-900">{c.id}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${stage.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                          {stage.label}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>Priority: {sev.label}</span>
                        {c.label && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${displayValidationLabel(c.label).badge}`}>
                            <Shield size={9} />
                            {displayValidationLabel(c.label).label}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-stone-400">
                        <UserCheck size={10} />
                        {c.deskOfficer}
                      </span>
                    </div>
                    <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{c.title}</h4>
                    <p className="mt-0.5 text-[10px] text-stone-400">
                      {c.category} · reported by {c.reporter} · {c.purok}
                    </p>
                    <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                      <p className="text-[10px] font-semibold text-stone-500">Leader Notes</p>
                      <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600">"{c.notes}"</p>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2.5">
                      {(c.status === "in_triage" || c.status === "priority_adjusted") && (
                        <div className="flex items-center gap-1">
                          {(["critical", "warning", "low"] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => adjustEscalationPriority(c, p)}
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-medium capitalize transition ${
                                (c.adjustedPriority ?? c.suggestedPriority) === p
                                  ? "border-[#0038A8] bg-[#0038A8] text-white"
                                  : "border-stone-200 text-stone-500 hover:bg-stone-50"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                      {next && (
                        <button
                          onClick={() => advanceEscalation(c)}
                          className="flex h-7 items-center gap-1 rounded-md bg-[#0038A8] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                        >
                          <CheckCircle2 size={11} />
                          Advance to {ESCALATION_META[next].label}
                        </button>
                      )}
                      {blotters.some((b) => b.incident === c.id) && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                          <FileText size={10} />
                          {c.blottedId ?? "Blotter created"}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-stone-500">
                        <Shield size={10} />
                        {c.statusNote}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Active Dispatches</h3>
                  <p className="text-[11px] text-[#94A3B8]">Field response tracked Responding → On-Scene → Resolving → Resolved</p>
                </div>
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate("dispatches")} className="flex items-center gap-0.5 text-[11px] font-medium text-[#0038A8] hover:underline">
                  Open <ChevronRight size={11} />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {dispatches.map((dp, i) => {
                const meta = DISPATCH_META[dp.status];
                const inc = incidents.find((x) => x.id === dp.incident);
                return (
                  <div key={dp.id} className={`px-5 py-3 ${i < dispatches.length - 1 ? "border-b border-black/5" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-semibold text-stone-900">{dp.id}</span>
                        <span className="text-[10px] text-stone-400">{dp.incident} · {dp.purok}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dp.assigneeType === "purok_leader" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">
                            <Flag size={9} />
                            Purok Leader
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-stone-600">{dp.team}</span>
                        <span className="text-[10px] text-stone-400">{dp.eta}</span>
                        {dp.photos > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                            <ImageIcon size={10} />
                            {dp.photos}
                          </span>
                        )}
                        {inc?.rating && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                            <Star size={10} className="fill-amber-400 text-amber-400" />
                            {inc.rating}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 pl-0">
                      <p className="truncate text-[11px] text-stone-500">{inc?.description}</p>
                      {meta.action && (
                        <button
                          onClick={() => advanceDispatch(dp.id)}
                          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                        >
                          <CheckCircle2 size={11} />
                          {meta.action}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Operations Chat Center</h3>
                  <p className="text-[11px] text-[#94A3B8]">Direct line to Tanods &amp; Purok Leaders</p>
                </div>
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate("chat")} className="flex items-center gap-0.5 text-[11px] font-medium text-[#0038A8] hover:underline">
                  Open <ChevronRight size={11} />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-5 pb-5">
              {CHAT_CONTACTS.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                    {c.initials}
                    <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white ${c.status === "online" ? "bg-emerald-500" : "bg-stone-300"}`} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[12px] font-semibold text-stone-900">{c.name}</span>
                    <span className="block text-[10px] text-stone-400">{c.role}</span>
                  </span>
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Patrol Scheduler &amp; Routes</h3>
                  <p className="text-[11px] text-[#94A3B8]">Shift calendar &amp; geofence checkpoint coverage</p>
                </div>
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate("patrol")} className="flex items-center gap-0.5 text-[11px] font-medium text-[#0038A8] hover:underline">
                  Open <ChevronRight size={11} />
                </button>
              )}
            </div>

            <div className="space-y-3 px-5 pb-5">
              <div className="grid grid-cols-7 gap-1">
                {SHIFT_WEEK.map((d) => (
                  <div key={d.day} className="rounded-lg border border-stone-200 bg-stone-50 p-1.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-stone-400">{d.day}</p>
                    <p className="mt-1 text-[10px] font-semibold text-stone-900">{d.morning}</p>
                    <p className="text-[9px] text-stone-400">{d.night}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {TANOD_TEAMS.map((t) => (
                  <span key={t.id} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${
                    t.status === "standby" ? "bg-stone-100 text-stone-500" : t.status === "dispatched" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    <Users size={10} />
                    {t.name} · {t.members}
                  </span>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                {PUROK_COVERAGE.map((p) => (
                  <div key={p.zone}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-stone-600">{p.zone}</span>
                      <span className="text-[10px] text-stone-400">{p.checkpoints} checkpoints</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                      <div className={`h-full rounded-full ${coverageColor(p.pct)}`} style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Map size={12} className="text-[#0038A8]" />
                <p className="text-[10px] text-stone-500">Live Force Heatmap driven by background GPS pings from Tanod apps</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Digital Barangay Blotter</h3>
                  <p className="text-[11px] text-[#94A3B8]">Archival conversion of resolved incident lifecycles</p>
                </div>
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate("blotter")} className="flex items-center gap-0.5 text-[11px] font-medium text-[#0038A8] hover:underline">
                  Open <ChevronRight size={11} />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-stone-900">INC-2065 ready for archival</p>
                    <p className="text-[10px] text-stone-500">Resolved · 5.0 rating · 3 evidence photos</p>
                  </div>
                  <button
                    onClick={convertToBlotter}
                    disabled={blotters.some((b) => b.incident === "INC-2065")}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <FileText size={11} />
                    Convert
                  </button>
                </div>
              </div>

              {blotters.map((b) => (
                <div key={b.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#0038A8]">{b.id}</span>
                    <span className="text-[10px] text-stone-400">{formatTime(b.filed)}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-stone-900">{b.title}</p>
                  <p className="text-[10px] text-stone-500">{b.incident} · {b.purok} · Filed by {b.officer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Recent Activity</h3>
                  <p className="text-[11px] text-[#94A3B8]">Latest operational events</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <Activity size={11} />
                Live
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-0 overflow-y-auto">
              {[
                { time: "2026-07-20T10:12:00", text: "INC-2069 acknowledged from CCTV escalation", type: "triage" },
                { time: "2026-07-20T10:05:00", text: "Emergency SOS received from Ana Lim (Purok 6)", type: "sos" },
                { time: "2026-07-20T10:03:00", text: "Team Alpha uploaded on-scene photo for INC-2068", type: "dispatch" },
                { time: "2026-07-20T09:58:00", text: "SM-GATE-01 breached 500 ppm — pop-up dispatched", type: "iot" },
                { time: "2026-07-20T09:32:00", text: "INC-2071 filed via Citizen App with geotag", type: "triage" },
                { time: "2026-07-20T09:15:00", text: "Weekly shift calendar published for next week", type: "patrol" },
              ].map((item, i, arr) => {
                const dot = { triage: "bg-sky-400", sos: "bg-rose-500", dispatch: "bg-emerald-400", iot: "bg-amber-400", patrol: "bg-violet-400" }[item.type] ?? "bg-stone-300";
                return (
                  <div key={i} className={`flex items-start gap-3 px-5 py-3 ${i < arr.length - 1 ? "border-b border-black/5" : ""}`}>
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-snug text-[#334155]">{item.text}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#94A3B8]">
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

        <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-teal-600" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Recent Notices</h3>
                <p className="text-[11px] text-[#94A3B8]">Routine safety notices — separate from the severity-graded Mass Broadcast queue</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700">
                {notices.filter((n) => n.state !== "archived").length} active
              </span>
              <button
                onClick={() => setNoticeComposeOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                <Info size={11} />
                New Notice
              </button>
            </div>
          </div>

          <div className="space-y-2 px-5 pb-5">
            {notices.length === 0 ? (
              <p className="px-2 py-8 text-center text-[12px] text-stone-400">No safety notices yet — publish one from the header.</p>
            ) : (
              notices.map((n) => {
                const stateMeta =
                  n.state === "published"
                    ? { label: "Published", cls: "bg-emerald-100 text-emerald-700" }
                    : n.state === "draft"
                      ? { label: "Draft", cls: "bg-amber-100 text-amber-700" }
                      : { label: "Archived", cls: "bg-stone-200 text-stone-600" };
                const targetLabel = n.target.kind === "barangay" ? "Entire Barangay" : n.target.purok;
                return (
                  <div key={n.id} className={`rounded-xl border border-stone-200 px-4 py-3 ${n.state === "archived" ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-teal-700">{n.id}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${stateMeta.cls}`}>{stateMeta.label}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
                          <Tag size={9} />
                          {n.category}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-600">
                          {n.target.kind === "barangay" ? <Globe size={9} /> : <MapPin size={9} />}
                          {targetLabel}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-stone-400">
                        <Clock size={10} />
                        {formatTime(n.state === "published" && n.publishedAt ? n.publishedAt : n.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-stone-900">{n.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-stone-500">{n.message}</p>
                      </div>
                      {n.state !== "archived" && (
                        <div className="flex items-center gap-1.5">
                          {n.state === "draft" && (
                            <button
                              onClick={() => { setSafetyNoticeState(n.id, "published"); flash(`${n.id} published`); }}
                              className="flex h-7 items-center gap-1 rounded-md border border-teal-300 bg-white px-2 text-[10px] font-medium text-teal-700 transition hover:bg-teal-50"
                            >
                              <Send size={10} />
                              Publish
                            </button>
                          )}
                          <button
                            onClick={() => { setSafetyNoticeState(n.id, "archived"); flash(`${n.id} archived`); }}
                            className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                          >
                            <Archive size={10} />
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <EmergencyPopUp
        alert={popAlert}
        onAcknowledge={() => {
          const sensor = popAlert?.sensor;
          if (sensor) {
            const matchingAlert = alertsRef.current.find((a) => a.sensorId === sensor.id && a.status === "received");
            if (matchingAlert) {
              setAlerts((prev) =>
                prev.map((a) =>
                  a.id === matchingAlert.id
                    ? { ...a, status: "acknowledged", acknowledgedAt: new Date().toISOString() }
                    : a
                )
              );
            }
            setIncidents((prev) =>
              prev.some((i) => i.id === "INC-2068")
                ? prev
                : [{ id: "INC-2068", category: "Fire/Smoke", severity: "warning", purok: "Purok 1", description: `IoT threshold breach — smoke density ${sensor.value}/${sensor.threshold} ppm`, source: "iot", reporter: sensor.name, time: new Date().toISOString(), status: "in_progress", photos: 0, lat: 110, lng: 65, priority: "High", notes: [], relatedAlertId: matchingAlert ? matchingAlert.id : undefined }, ...prev]
            );
          }
          setPopAlert(null);
          flash("Alert acknowledged — linked incident routed to triage & dispatch");
        }}
        onSilence={() => {
          setPopAlert(null);
          flash("Alert silenced");
        }}
        onBroadcast={() => {
          setPopAlert(null);
          setBroadcastHint("HIGH SEVERITY ALERT — take immediate precaution. Verify surroundings and await instructions.");
          setBroadcastOpen(true);
        }}
      />

      <IncidentDetail
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onAdvance={advanceIncident}
        onSetPriority={setPriority}
        onAddNote={addNote}
        onCloseFalseAlarm={requestCloseFalseAlarm}
        possibleDuplicates={selectedIncident ? possibleDuplicateOf(selectedIncident, incidents) : []}
        onKeepSeparate={keepSeparate}
        onLinkRelated={linkRelated}
        onEscalateToCaptain={(inc) => setEscalateTarget(inc)}
        onAssign={(inc) => setAssignTarget(inc)}
        onMarkReporterSafe={markReporterSafe}
        onReviewReporterSafe={(inc) => setSafeReviewTarget(inc)}
      />

      {safeReviewTarget && (
        <ReporterSafeReviewModal
          incident={safeReviewTarget}
          onClose={() => setSafeReviewTarget(null)}
          onConfirm={(note) => confirmReporterSafeClose(safeReviewTarget, note)}
        />
      )}

      {lookupOpen && <AnonymousLookupModal incidents={incidents} onClose={() => setLookupOpen(false)} />}

      {escalateTarget && (
        <EscalateToCaptainModal
          incident={escalateTarget}
          onClose={() => setEscalateTarget(null)}
          onConfirm={escalateToCaptain}
        />
      )}

      {assignTarget && (
        <AssignIncidentModal
          incident={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={assignIncident}
        />
      )}

      {closeTarget && (
        <CloseFalseAlarmModal
          incident={closeTarget}
          onClose={() => setCloseTarget(null)}
          onConfirm={closeFalseAlarm}
        />
      )}

      {broadcastOpen && (
        <BroadcastCompose
          onClose={() => setBroadcastOpen(false)}
          onSend={submitBroadcast}
          hint={broadcastHint}
        />
      )}

      {noticeComposeOpen && (
        <SafetyNoticeCompose
          onClose={() => setNoticeComposeOpen(false)}
          onSave={submitSafetyNotice}
        />
      )}

      {broadcastDone && (
        <ConfirmModal
          type="success"
          title="Queued for Authorization"
          message={`${broadcastDone} submitted. High-severity community blasts are routed to the Captain for 1-tap approval — medium/low severities may be delivered as quiet push.`}
          onClose={() => setBroadcastDone(null)}
        />
      )}

      {blotterSuccess && (
        <ConfirmModal
          type="success"
          title="Blotter Created"
          message={`${blotterSuccess.id} archived — incident ${blotterSuccess.incident} converted into the permanent Digital Barangay Blotter.`}
          onClose={() => setBlotterSuccess(null)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
