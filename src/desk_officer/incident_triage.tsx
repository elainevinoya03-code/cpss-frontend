import { useState, useEffect, useRef } from "react";
import {
  ClipboardList,
  Radio,
  MapPin,
  Users,
  CheckCircle2,
  Send,
  AlertTriangle,
  X,
  Clock,
  Shield,
  ChevronRight,
  ImageIcon,
  Camera,
  Smartphone,
  Zap,
  CalendarClock,
  BellRing,
  UserCheck,
  Timer,
  ArrowUpRight,
  Link2,
  Search,
  MessageCircleQuestion,
  Tag,
  Flag,
  Navigation,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Flame,
  Volume2,
  Siren,
  Activity,
  Star,
  Wifi,
  WifiOff,
  MapPinOff,
  FileText,
  Video,
  Map,
  Play,
  Info,
  MessageSquare,
  Megaphone,
  FileSearch,
  Landmark,
  FileCheck2,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { consumeDeskTriageTarget } from "../utils/deskTriageTarget";
import { consumeDeskCaseTarget } from "../utils/deskCaseTarget";import { SEVERITY_MAP } from "../constants/severity";
import { Modal } from "../components/ui";
import {
  getFootageRequests,
  subscribeFootageRequests,
  addFootageRequest,
  REQUEST_STATUS_META,
  type FootageRequest,
} from "../utils/footageRequestStore";
import {
  getTanods,
  subscribeTanods,
  TANOD_STATUS_META,
  type Tanod,
} from "./tanodStore";
import {
  addSafetyNotice,
  type NoticeSeverity,
  type NoticeAudience,
  type SafetyNotice,
} from "../utils/safetyNoticeStore";
import { recordActivity } from "../utils/recentActivityStore";
import {
  useIncidentStore as useSharedIncidentStore,
  getIncidents as getSharedIncidents,
  getDispatches as getSharedDispatches,
  setIncidents as setSharedIncidents,
  setDispatches as setSharedDispatches,
  convertIncidentToBlotter,
  type Incident as SharedIncident,
  type DispatchItem as SharedDispatchItem,
  type IncidentStatus,
  type IncidentSource,
  type VerificationStatus,
  type DeskPriority,
  type ClosureHistoryEntry,
} from "./incidentStore";
import { CATEGORY_ICON, CATEGORY_COLORS, DISPATCH_META, ON_DUTY_TANODS, type DispatchStatus } from "./constants";

// ---------------------------------------------------------------------------
// §T.1 — Status metadata maps (matching dashboard conventions)
// ---------------------------------------------------------------------------

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
  iot_cctv: { label: "IoT via CCTV", badge: "bg-orange-100 text-orange-700", icon: Wifi },
  sos: { label: "SOS", badge: "bg-rose-100 text-rose-700", icon: Siren },
};

const DESK_PRIORITIES = ["Low", "Medium", "High"] as const;

const DESK_PRIORITY_META: Record<DeskPriority, { chip: string; dot: string }> = {
  Low: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  Medium: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  High: { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
};

const SLA_TARGETS: Record<DeskPriority, { minutes: number; label: string }> = {
  High: { minutes: 15, label: "15 min" },
  Medium: { minutes: 60, label: "1 hr" },
  Low: { minutes: 240, label: "4 hr" },
};

const INCIDENT_CATEGORIES = [
  "Fire or Smoke",
  "Noise Disturbance",
  "Public Disturbance",
  "Hazard or Obstruction",
  "Suspicious Activity",
  "Medical or Welfare Concern",
  "Other",
] as const;

const CLOSURE_REASONS = ["False Alarm", "Unverified", "Invalid Report", "Outside Barangay Jurisdiction", "No Further Action Required", "Other"] as const;
type ClosureReason = (typeof CLOSURE_REASONS)[number];

const CLOSURE_REASON_META: Record<ClosureReason, { label: string; badge: string }> = {
  "False Alarm": { label: "False Alarm", badge: "bg-stone-100 text-stone-600" },
  "Unverified": { label: "Unverified", badge: "bg-amber-100 text-amber-700" },
  "Invalid Report": { label: "Invalid Report", badge: "bg-rose-100 text-rose-700" },
  "Outside Barangay Jurisdiction": { label: "Outside Jurisdiction", badge: "bg-violet-100 text-violet-700" },
  "No Further Action Required": { label: "No Further Action", badge: "bg-sky-100 text-sky-700" },
  "Other": { label: "Other", badge: "bg-stone-100 text-stone-500" },
};

type ValidationLabel = "locally_confirmed" | "unverified" | "likely_duplicate" | "event_related" | "unable_to_verify";

const VALIDATION_LABEL_META: Record<ValidationLabel, { label: string; badge: string }> = {
  locally_confirmed: { label: "Locally Confirmed", badge: "bg-emerald-100 text-emerald-700" },
  unverified: { label: "Unverified", badge: "bg-stone-100 text-stone-600" },
  likely_duplicate: { label: "Likely Duplicate", badge: "bg-amber-100 text-amber-800" },
  event_related: { label: "Event-Related", badge: "bg-sky-100 text-sky-700" },
  unable_to_verify: { label: "Unable to Verify", badge: "bg-rose-100 text-rose-700" },
};

function displayValidationLabel(label: string): { label: string; badge: string } {
  const legacyToCanonical: Record<string, ValidationLabel> = {
    Confirmed: "locally_confirmed",
    "Marked Invalid": "unable_to_verify",
    "False Information": "unable_to_verify",
    "Event-Related": "event_related",
  };
  const canonical = (VALIDATION_LABEL_META as Record<string, { label: string; badge: string }>)[label]
    ? (label as ValidationLabel)
    : legacyToCanonical[label];
  return canonical ? VALIDATION_LABEL_META[canonical] : { label, badge: "bg-stone-100 text-stone-600" };
}

// ---------------------------------------------------------------------------
// §T.2 — Local incident type (mirrors shared store)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §T.2a — Progressive workflow stage. Drives which Desk Officer actions are
// revealed. Future actions are hidden until reached (progressive disclosure).
// ---------------------------------------------------------------------------

type FlowStage =
  | "received"          // new — only ACKNOWLEDGE is shown
  | "acknowledged"      // ACK done — only TRIAGE is shown
  | "triage"            // entering triage — only triage tools shown
  | "decision"          // response decision — DISPATCH NOW / MARK RESOLVED (no response)
  | "monitoring"        // dispatched — MONITOR, ESCALATE, MARK RESOLVED
  | "resolved"          // marked resolved — NOTIFY REPORTER
  | "notified"          // reporter notified — CLOSE (archive)
  | "closed_false_alarm";

type TimelineKind =
  | "submitted"
  | "acknowledged"
  | "verified"
  | "unverified"
  | "priority"
  | "assigned"
  | "notified"
  | "cctv_review"
  | "cctv_clip_requested"
  | "cctv_clip_linked"
  | "escalated"
  | "note"
  | "status"
  | "resolved"
  | "closed"
  | "reporter_notified"
  | "info_requested"
  | "urgency"
  | "alert"
  | "referred";

interface TimelineEntry {
  time: string;
  title: string;
  detail?: string;
  kind: TimelineKind;
}

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
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  unverifiedReason?: string;
  categoryHistory?: { from: string; to: string; changedBy: string; changedAt: string }[];
  assignedTeam?: string;
  dispatchId?: string;
  closureHistory?: ClosureHistoryEntry[];
  resolvedAt?: string;
  timeline?: TimelineEntry[];
  cctvCameraID?: string;
  cctvCameraName?: string;
  cctvNotes?: string[];
  cctvRequest?: {
    id: string;
    requestedAt: string;
    requestedBy: string;
    camera: string;
    cameraId: string;
    startTime: string;
    endTime: string;
    reason: string;
    status: "pending" | "provided" | "reviewed";
    provided?: {
      clipId: string;
      cameraId: string;
      camera: string;
      recordedDate: string;
      startTime: string;
      endTime: string;
      duration: string;
      providedAt: string;
      providedBy: string;
      remarks?: string;
    };
    review?: {
      reviewedAt: string;
      reviewedBy: string;
      finding: string;
    };
  };
  reporterNotified?: { notifiedAt: string; channel: string; stage: string };
  flowStage?: FlowStage;
  dispatch?: {
    responders: { type: ResponderType; label: string }[];
    status: DispatchStatus;
    dispatchedAt: string;
    overrideReason?: string;
  };
  iotData?: {
    sensorType: string;
    sensorId: string;
    reading: string;
    unit: string;
    thresholdState: "normal" | "elevated" | "critical";
    threshold: string;
    timestamp: string;
    location: string;
  };
  referral?: {
    agency: string;
    agencyType: "pnp" | "bfp" | "doh" | "lgu" | "ngo" | "other";
    remarks: string;
    referredAt: string;
    referredBy: string;
    evidenceAttached: boolean;
    evidenceCount: number;
  };
  infoRequests?: {
    id: string;
    requestedAt: string;
    detail: string;
    channel: string;
    sender: string;
  }[];
}

// ---------------------------------------------------------------------------
// §T.3 — Helpers
// ---------------------------------------------------------------------------

function formatClock(isoStr?: string) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(isoStr?: string) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const CCTV_FINDINGS = ["No relevant activity", "Incident confirmed", "Person/vehicle identified", "Additional evidence found", "Unable to verify"];

type CctvRequestStatus = "not_requested" | "pending" | "provided" | "reviewed";

function cctvStatus(inc: Incident): CctvRequestStatus {
  if (!inc.cctvRequest) return "not_requested";
  return inc.cctvRequest.status;
}

// ---------------------------------------------------------------------------
// §T.3b — Scenario-based dispatch recommendation (severity + incident type)
// ---------------------------------------------------------------------------

type ResponderType = "purok_leader" | "tanod" | "bdrrmo" | "pnp";

interface DispatchResponder {
  type: ResponderType;
  label: string;
  role: string;
  external?: boolean;
}

const RESPONDER_META: Record<ResponderType, { label: string; badge: string; short: string }> = {
  purok_leader: { label: "Purok Leader", badge: "bg-teal-100 text-teal-700", short: "PL" },
  tanod: { label: "Barangay Tanod", badge: "bg-[#0038A8]/10 text-[#0038A8]", short: "TN" },
  bdrrmo: { label: "BDRRMO / Health Worker", badge: "bg-emerald-100 text-emerald-700", short: "BD" },
  pnp: { label: "PNP (External)", badge: "bg-rose-100 text-rose-700", short: "PNP" },
};

const ALL_RESPONDERS = Object.keys(RESPONDER_META) as ResponderType[];

interface DispatchRecommendation {
  severityLabel: string;
  incidentLabel: string;
  responders: DispatchResponder[];
  reason: string;
}

function recommendDispatch(inc: Incident): DispatchRecommendation {
  const sev = inc.severity;
  const cat = inc.category.toLowerCase();

  // Critical — Crime / Violence (Physical Assault / Law Violation)
  if (sev === "critical") {
    return {
      severityLabel: "Critical",
      incidentLabel: "Crime / Violence",
      responders: [
        { type: "tanod", label: "Barangay Tanod", role: "Initial on-scene response · secure the immediate area · provide assistance while waiting for PNP." },
        { type: "pnp", label: "PNP (External)", role: "Law enforcement · arrest when legally appropriate · formal handling of the incident.", external: true },
      ],
      reason: "Critical crime/violence needs a Barangay Tanod as the initial barangay responder while PNP handles law enforcement, arrest, and formal legal procedures.",
    };
  }

  // High — Urgent / Disaster (Flood / Fire)
  if ((cat.includes("fire") || cat.includes("smoke") || cat.includes("flood")) && sev === "warning") {
    return {
      severityLabel: "High",
      incidentLabel: "Urgent / Disaster",
      responders: [
        { type: "purok_leader", label: "Purok Leader", role: "Headcount · identify seniors/PWDs · coordinate with affected residents." },
        { type: "tanod", label: "Barangay Tanod", role: "Evacuation assistance · crowd control · secure the area." },
        { type: "bdrrmo", label: "BDRRMO / Health Worker", role: "Emergency response · medical first aid when applicable." },
      ],
      reason: "Urgent disaster response uses the Purok Leader for headcount and resident coordination, the Tanod for evacuation and crowd control, and BDRRMO/Health for emergency or medical support.",
    };
  }

  // Medium — Potential Escalation (Neighbor Dispute / Shouting Match)
  if (sev === "warning") {
    return {
      severityLabel: "Medium",
      incidentLabel: "Potential Escalation",
      responders: [
        { type: "purok_leader", label: "Purok Leader", role: "Community mediation and communication with the involved residents." },
        { type: "tanod", label: "Barangay Tanod", role: "Security backup if the situation becomes physical or unsafe." },
      ],
      reason: "The incident has potential to escalate from a verbal dispute into a physical confrontation. The Purok Leader mediates because they know the residents, while the Tanod provides security backup.",
    };
  }

  // Low — Minor / Informational (Noise Complaint)
  if (cat.includes("noise")) {
    return {
      severityLabel: "Low",
      incidentLabel: "Noise Complaint",
      responders: [
        { type: "purok_leader", label: "Purok Leader", role: "Approach the resident and address the complaint through communication." },
      ],
      reason: "Minor community concern. No force is needed — a Purok Leader can approach the resident and handle it through communication.",
    };
  }

  // Low — Routine Enforcement (Curfew Warning / Roving Patrol)
  return {
    severityLabel: "Low",
    incidentLabel: "Routine Enforcement",
    responders: [
      { type: "tanod", label: "Barangay Tanod", role: "Standard security/patrol enforcement activity." },
    ],
    reason: "Routine security enforcement or patrol activity. No specific community mediation is required.",
  };
}


function pushTimeline(inc: Incident, entry: Omit<TimelineEntry, "time">): Incident {
  return { ...inc, timeline: [...(inc.timeline ?? []), { ...entry, time: new Date().toISOString() }] };
}

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
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

function slaElapsed(inc: Incident): { elapsed: number; target: number; pct: number } {
  const target = SLA_TARGETS[inc.priority].minutes * 60_000;
  const elapsed = Date.now() - new Date(inc.time).getTime();
  return { elapsed, target, pct: Math.min(100, (elapsed / target) * 100) };
}

function slaState(inc: Incident): "normal" | "approaching" | "breached" {
  const { elapsed, target } = slaElapsed(inc);
  if (elapsed > target) return "breached";
  if (elapsed > target * 0.8) return "approaching";
  return "normal";
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

// ---------------------------------------------------------------------------
// §T.3b — Progressive workflow stage helpers
// ---------------------------------------------------------------------------

const FLOW_STAGE_ORDER: FlowStage[] = ["received", "acknowledged", "triage", "decision", "monitoring", "resolved", "notified"];

function stageIndex(stage: FlowStage): number {
  return FLOW_STAGE_ORDER.indexOf(stage);
}

// Determine the current workflow stage, honoring an explicitly stored
// flowStage but gracefully deriving one from legacy / seed incidents.
function deriveFlowStage(inc: Incident, hasDispatch: boolean): FlowStage {
  if (inc.status === "resolved") return inc.reporterNotified ? "notified" : "resolved";
  if (inc.status === "closed_false_alarm") return "closed_false_alarm";
  if (inc.flowStage) return inc.flowStage as FlowStage;
  if (inc.status === "new") return "received";
  if (inc.status === "in_progress") return hasDispatch || inc.assignedTeam || inc.dispatchId ? "monitoring" : "decision";
  if (inc.status === "acknowledged") return "acknowledged";
  return "decision";
}

const FLOW_STAGE_META: Record<FlowStage, { label: string; hint: string }> = {
  received: { label: "Received", hint: "Confirm reception to advance." },
  acknowledged: { label: "Acknowledged", hint: "Begin triage to assess the incident." },
  triage: { label: "Triage", hint: "Assess duplicates, priority, and CCTV needs." },
  decision: { label: "Response Decision", hint: "Choose to dispatch field response or resolve without response." },
  monitoring: { label: "Monitor Dispatch", hint: "Track the response, escalate if needed, or mark resolved." },
  resolved: { label: "Resolved", hint: "Notify the reporter of the resolution." },
  notified: { label: "Reporter Notified", hint: "All done — close (archive) the incident." },
  closed_false_alarm: { label: "Closed", hint: "" },
};

// ---------------------------------------------------------------------------
// §T.4 — Seed data reference (teams & leaders for assignment)
// ---------------------------------------------------------------------------

const TANOD_TEAMS = [
  { id: "t1", name: "Team Alpha", members: 4, leader: "J. Ramos", status: "on_patrol" as const, purok: "Purok 1", distance: "1.2 km", eta: "3 min", route: "R1 Market Perimeter", assignmentCount: 1 },
  { id: "t2", name: "Team Bravo", members: 3, leader: "S. Torres", status: "dispatched" as const, purok: "Purok 6", distance: "2.1 km", eta: "8 min", route: "R2 Commercial Strip", assignmentCount: 1 },
  { id: "t3", name: "Team Charlie", members: 4, leader: "K. Lim", status: "on_patrol" as const, purok: "Purok 2", distance: "0.9 km", eta: "4 min", route: "R3 Chapel Loop", assignmentCount: 1 },
  { id: "t4", name: "Team Delta", members: 3, leader: "C. Navarro", status: "standby" as const, purok: "HQ", distance: "—", eta: "—", route: "R2 Commercial Strip", assignmentCount: 0 },
];

const PUROK_LEADERS = [
  { id: "pl1", name: "Purok 1 Leader", initials: "P1", purok: "Purok 1" },
  { id: "pl2", name: "Purok 2 Leader", initials: "P2", purok: "Purok 2" },
  { id: "pl3", name: "Purok 3 Leader", initials: "P3", purok: "Purok 3" },
  { id: "pl4", name: "Purok 4 Leader", initials: "P4", purok: "Purok 4" },
  { id: "pl5", name: "Purok 5 Leader", initials: "P5", purok: "Purok 5" },
  { id: "pl6", name: "Purok 6 Leader", initials: "P6", purok: "Purok 6" },
];

const PUROK_OPTIONS = ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6"];

// ---------------------------------------------------------------------------
// §T.5 — Sub-components: Modals
// ---------------------------------------------------------------------------

function CategoryChangeModal({
  incident,
  onClose,
  onConfirm,
}: {
  incident: Incident;
  onClose: () => void;
  onConfirm: (incident: Incident, newCategory: string) => void;
}) {
  const [selected, setSelected] = useState(incident.category);

  return (
    <Modal
      onClose={onClose}
      size="md"
      title={`Change Category — ${incident.id}`}
      subtitle="Confirm or update the incident category during review"
      icon={<Tag size={18} className="text-violet-600" />}
      iconClass="bg-violet-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Cancel</button>
          <button onClick={() => onConfirm(incident, selected)} disabled={selected === incident.category} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
            <Tag size={13} /> Confirm Category
          </button>
        </div>
      }
    >
      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CURRENT CATEGORY</p>
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <span className="text-[12px] font-semibold text-stone-900">{incident.category}</span>
        </div>
      </div>
      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SELECT NEW CATEGORY</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {INCIDENT_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setSelected(cat)} className={`rounded-lg border px-3 py-2 text-left text-[11px] font-medium transition ${selected === cat ? "border-violet-500 bg-violet-50 text-violet-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      {incident.categoryHistory && incident.categoryHistory.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CATEGORY HISTORY</p>
          <div className="space-y-1.5">
            {incident.categoryHistory.map((h, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <span className="text-[10px] text-stone-400">{formatTime(h.changedAt)}</span>
                <span className="text-[11px] text-stone-600">{h.from}</span>
                <span className="text-[11px] text-stone-400">&rarr;</span>
                <span className="text-[11px] font-medium text-stone-900">{h.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
        <p className="text-[10px] text-violet-700">Category changes are recorded in the audit trail with the responsible Desk Officer and timestamp.</p>
      </div>
    </Modal>
  );
}

function EscalateToCaptainModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, reason: string) => void }) {
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
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Cancel</button>
          <button onClick={() => { onConfirm(incident, reason.trim()); onClose(); }} disabled={!reason.trim()} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
            <ArrowUpRight size={13} /> Escalate
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[11px] leading-snug text-stone-600">{incident.description}</p>
        <p className="mt-1 text-[10px] text-stone-400">Current status: {INCIDENT_STATUS_META[incident.status].label} · Priority {incident.priority}</p>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REASON (REQUIRED)</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Explain why the Captain needs visibility on this incident…" className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30" />
      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <Shield size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <p className="text-[10px] leading-snug text-stone-500">The Captain is notified and a status note is logged. The incident record and its current state are preserved — this is <span className="font-semibold">not</span> forwarded to any external agency.</p>
      </div>
    </Modal>
  );
}

function CloseFalseAlarmModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, reason: ClosureReason, explanation: string) => void }) {
  const [reason, setReason] = useState<ClosureReason>("False Alarm");
  const [explanation, setExplanation] = useState("");
  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Close Incident — Invalid / False Alarm"
      subtitle={`${incident.id} · ${incident.category} · ${incident.purok}`}
      icon={<X size={18} className="text-stone-600" />}
      iconClass="bg-stone-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Cancel</button>
          <button onClick={() => { onConfirm(incident, reason, explanation.trim()); onClose(); }} disabled={!explanation.trim()} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-stone-700 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50">
            <X size={13} /> Confirm Closure
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[11px] leading-snug text-stone-600">{incident.description}</p>
        <p className="mt-1 text-[10px] text-stone-400">Current status: {INCIDENT_STATUS_META[incident.status].label} · Priority {incident.priority} · {incident.purok}</p>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CLOSURE REASON (REQUIRED)</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CLOSURE_REASONS.map((r) => {
          const meta = CLOSURE_REASON_META[r];
          return (
            <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${reason === r ? "border-stone-600 bg-stone-600 text-white" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
              {meta.label}
            </button>
          );
        })}
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">EXPLANATION (REQUIRED)</p>
      <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={4} placeholder={reason === "False Alarm" ? "e.g. Sensor triggered by cooking smoke, no actual fire detected…" : reason === "Unverified" ? "e.g. Reporter could not be reached, no corroborating evidence…" : "Provide additional context for this closure…"} className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30" />
      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <Shield size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <p className="text-[10px] leading-snug text-stone-500">A closure reason is <span className="font-semibold">mandatory</span>. The reason and explanation are recorded on the closure history. The reporter is notified of the closure with a generic message — <span className="font-semibold">no internal notes or operational details are exposed</span>.</p>
      </div>
    </Modal>
  );
}

function ResolutionSummaryModal({ incident, onClose, onResolve }: { incident: Incident; onClose: () => void; onResolve: (incident: Incident, summary: string, responseCompleted: boolean, evidenceAttached: boolean, note: string) => void }) {
  const [summary, setSummary] = useState("");
  const [responseCompleted, setResponseCompleted] = useState(false);
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [note, setNote] = useState("");
  const canSubmit = summary.trim() && responseCompleted;
  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Resolve Incident"
      subtitle={`${incident.id} · ${incident.category} · ${incident.purok}`}
      icon={<CheckCircle2 size={18} className="text-emerald-600" />}
      iconClass="bg-emerald-50"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Cancel</button>
          <button onClick={() => onResolve(incident, summary.trim(), responseCompleted, evidenceAttached, note.trim())} disabled={!canSubmit} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 size={13} /> Confirm Resolution
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[11px] leading-snug text-stone-600">{incident.description}</p>
        <p className="mt-1 text-[10px] text-stone-400">Status: {INCIDENT_STATUS_META[incident.status].label} · Priority {incident.priority} · {incident.assignedTeam ? `Assigned to ${incident.assignedTeam}` : "No team assigned"}</p>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">RESOLUTION SUMMARY (REQUIRED)</p>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Summarize the resolution — e.g. Fire confirmed and extinguished, scene secured, no injuries reported…" className="mb-3 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" />
      <div className="mb-3 space-y-2">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={responseCompleted} onChange={(e) => setResponseCompleted(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
          <span className="text-[12px] font-medium text-stone-700">Response completed</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={evidenceAttached} onChange={(e) => setEvidenceAttached(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
          <span className="text-[12px] font-medium text-stone-700">Evidence attached ({incident.photos} file{incident.photos === 1 ? "" : "s"} on record)</span>
        </label>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">INTERNAL NOTE (OPTIONAL)</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional internal note — not visible to the reporter or resident portal…" className="mb-3 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30" />
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <Shield size={12} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-[10px] leading-snug text-stone-600">The resolution summary and closure history are recorded on the incident record. The reporter receives a generic "Your report has been resolved" push notification — <span className="font-semibold">no internal notes or operational details are exposed</span>.</p>
      </div>
    </Modal>
  );
}

function DispatchModal({
  incident,
  recommendation,
  onClose,
  onConfirm,
}: {
  incident: Incident;
  recommendation: DispatchRecommendation;
  onClose: () => void;
  onConfirm: (incident: Incident, responders: DispatchResponder[], overrideReason?: string) => void;
}) {
  const [override, setOverride] = useState(false);
  const [selected, setSelected] = useState<ResponderType[]>(recommendation.responders.map((r) => r.type));
  const [overrideReason, setOverrideReason] = useState("");
  const isCritical = incident.severity === "critical";

  function toggleResponder(type: ResponderType) {
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  const finalResponders = recommendation.responders.filter((r) => selected.includes(r.type));
  const noSelection = finalResponders.length === 0;

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title={isCritical ? "Critical Dispatch" : "Recommended Dispatch"}
      subtitle={`${incident.id} · ${incident.purok}`}
      icon={<Radio size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Cancel</button>
          {!override ? (
            <button onClick={() => onConfirm(incident, finalResponders)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"><Send size={13} /> Confirm Dispatch</button>
          ) : (
            <button onClick={() => onConfirm(incident, finalResponders, overrideReason.trim() || undefined)} disabled={noSelection || !overrideReason.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"><UserCheck size={13} /> Confirm Override</button>
          )}
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-stone-900">{incident.category}</p>
            <p className="text-[10px] text-stone-500">{incident.purok} · {incident.reporter}</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${SEVERITY_MAP[incident.severity].badge}`}>{SEVERITY_MAP[incident.severity].label}</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-stone-600">{incident.description}</p>
      </div>

      <div className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <p className="text-[10px] font-semibold tracking-wider text-stone-400">DISPATCH RECOMMENDATION</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">Severity: {recommendation.severityLabel}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">Incident: {recommendation.incidentLabel}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">Responders: {finalResponders.length}</span>
        </div>

        <div className="mt-3 space-y-2">
          {finalResponders.map((r) => (
            <div key={r.type} className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white bg-[#0038A8]">{RESPONDER_META[r.type].short}</span>
              <div>
                <p className="text-[11px] font-semibold text-stone-900">{r.label}{r.external ? <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-semibold text-rose-700">EXTERNAL</span> : null}</p>
                <p className="text-[10px] leading-snug text-stone-500">{r.role}</p>
              </div>
            </div>
          ))}
          {noSelection && <p className="text-[10px] font-medium text-rose-600">No responders selected — add at least one before dispatch.</p>}
        </div>

        <div className="mt-3 rounded-lg border border-stone-200 bg-amber-50/60 px-3 py-2">
          <p className="text-[10px] font-semibold text-amber-700">WHY</p>
          <p className="mt-0.5 text-[10px] leading-snug text-stone-600">{recommendation.reason}</p>
        </div>
      </div>

      {!override ? (
        <button onClick={() => setOverride(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-50"><UserCheck size={13} /> Modify Dispatch</button>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4">
          <p className="text-[10px] font-semibold tracking-wider text-amber-700">MODIFY DISPATCH — OVERRIDE</p>
          <p className="mt-0.5 text-[10px] leading-snug text-stone-600">Adjust the recommended team. Adding or removing responders requires a reason, which is recorded in the incident timeline.</p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {ALL_RESPONDERS.map((type) => {
              const meta = RESPONDER_META[type];
              const active = selected.includes(type);
              return (
                <button key={type} onClick={() => toggleResponder(type)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[11px] font-medium transition ${active ? "border-amber-500 bg-white text-amber-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>
                  {active ? <CheckCircle2 size={13} className="text-amber-600" /> : <span className="h-3 w-3 rounded-full border border-stone-300" />}
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="mb-1 mt-3 text-[10px] font-semibold tracking-wider text-amber-700">REASON FOR OVERRIDE (REQUIRED)</p>
          <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} placeholder="e.g. Additional tanod requested due to size of crowd…" className="w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] text-stone-700 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none" />
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// §T.5b — Sub-components: Timeline, CCTV Review, View Map, Notify Reporter
// ---------------------------------------------------------------------------

function ViewTimelineModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const fallback: TimelineEntry[] = [
    { time: incident.time, title: "Incident submitted", detail: `Source: ${SOURCE_META[incident.source].label}`, kind: "submitted" as TimelineKind },
    ...(incident.acknowledgedAt ? [{ time: incident.acknowledgedAt, title: "Desk Officer acknowledged", kind: "acknowledged" as TimelineKind }] : []),
    ...(incident.resolvedAt ? [{ time: incident.resolvedAt, title: "Incident marked resolved", kind: "resolved" as TimelineKind }] : []),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const entries: TimelineEntry[] = (incident.timeline ?? []).length > 0
    ? [...incident.timeline!].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    : fallback;

  const KIND_DOT: Record<TimelineKind, string> = {
    submitted: "bg-stone-400",
    acknowledged: "bg-amber-400",
    verified: "bg-emerald-400",
    unverified: "bg-rose-400",
    priority: "bg-orange-400",
    assigned: "bg-[#0038A8]",
    notified: "bg-sky-400",
    cctv_review: "bg-violet-400",
    cctv_clip_requested: "bg-violet-400",
    cctv_clip_linked: "bg-violet-400",
    escalated: "bg-rose-500",
    note: "bg-stone-400",
    status: "bg-sky-400",
    resolved: "bg-emerald-500",
    closed: "bg-stone-500",
    reporter_notified: "bg-teal-400",
    info_requested: "bg-teal-400",
    urgency: "bg-orange-400",
    alert: "bg-rose-500",
    referred: "bg-violet-500",
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title="Incident Timeline"
      subtitle={`${incident.id} · ${incident.category} · ${incident.purok}`}
      icon={<Clock size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
      footer={
        <button onClick={onClose} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
          Close
        </button>
      }
    >
      {entries.length === 0 ? (
        <p className="text-[12px] text-stone-500">No timeline events recorded yet for this incident.</p>
      ) : (
        <div className="relative pl-5">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-stone-200" />
          <div className="space-y-4">
            {entries.map((entry, idx) => (
              <div key={idx} className="relative">
                <span className={`absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${KIND_DOT[entry.kind] ?? "bg-stone-400"}`} />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{formatClock(entry.time)}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-stone-900">{entry.title}</p>
                {entry.detail && <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{entry.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function CctvReviewModal({
  incident,
  onClose,
  onRequestClip,
  onProvideClip,
  onConfirmReview,
  onAddNote,
}: {
  incident: Incident;
  onClose: () => void;
  onRequestClip: (incident: Incident, req: { camera: string; cameraId: string; startTime: string; endTime: string; reason: string }) => void;
  onProvideClip: (incident: Incident) => void;
  onConfirmReview: (incident: Incident, finding: string) => void;
  onAddNote: (incident: Incident, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const status = cctvStatus(incident);
  const req = incident.cctvRequest;
  const cameraId = incident.cctvCameraID ?? `CAM-${incident.purok.replace("Purok ", "").padStart(3, "0")}`;
  const cameraName = incident.cctvCameraName ?? `${incident.purok} Entrance`;

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const cameraOptions = [
    { id: cameraId, name: cameraName },
    { id: `CAM-${String(Number((incident.purok.replace("Purok ", "") || "1"))).padStart(3, "0")}`, name: `${incident.purok} Main Road` },
    { id: "CAM-001", name: "Barangay Hall Main" },
  ];
  const [selectedCam, setSelectedCam] = useState(cameraId);

  const nowMs = new Date().getTime();
  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const endMs = endTime ? new Date(endTime).getTime() : 0;
  const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const timeError = (!endTime || !startTime)
    ? ""
    : endMs > nowMs
      ? "End time cannot be beyond the current date and time."
      : startMs > endMs
        ? "Start time must be before the end time."
        : startMs < nowMs - WINDOW_MS
          ? "Footage is only available within the last 7 days."
          : "";
  const canRequest = selectedCam && startTime && endTime && reason.trim() && !timeError;

  const [finding, setFinding] = useState("");

  function submitNote() {
    if (!note.trim()) return;
    onAddNote(incident, note.trim());
    setNote("");
  }

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title="CCTV Review"
      subtitle={status === "not_requested" ? `${incident.id} · ${cameraId} — ${cameraName}` : `${incident.id} · Request ${req?.id ?? "—"}`}
      icon={<Camera size={18} className="text-violet-600" />}
      iconClass="bg-violet-100"
      footer={
        <button onClick={() => (status === "provided" ? onConfirmReview(incident, finding || "No relevant activity") : onClose())} className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-violet-700">
          {status === "provided" ? "Confirm Review" : "Return to Incident"}
        </button>
      }
    >
      {/* Incident event context */}
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[10px] font-semibold tracking-wider text-stone-400">EVENT</p>
        <p className="mt-1 text-[12px] font-semibold text-stone-900">{incident.category}</p>
        <p className="mt-0.5 text-[10px] text-stone-500">Reported {formatClock(incident.time)} · {incident.purok} · Ref {incident.id}</p>
      </div>

      {status === "not_requested" && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <p className="text-[10px] font-semibold tracking-wider text-violet-700">CCTV CLIP REQUEST</p>
          <p className="mt-0.5 text-[10px] text-violet-600">Request only the details the CCTV Operator needs to locate the footage.</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-medium text-violet-700">LOCATION</p>
              <select value={selectedCam} onChange={(e) => setSelectedCam(e.target.value)} className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-700 outline-none focus:border-violet-400">
                {cameraOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium text-violet-700">REASON FOR CCTV REQUEST</p>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Verify ongoing disturbance" className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-700 placeholder:text-stone-400 outline-none focus:border-violet-400" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium text-violet-700">APPROX. START TIME</p>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-700 outline-none focus:border-violet-400" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium text-violet-700">APPROX. END TIME</p>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-700 outline-none focus:border-violet-400" />
              <p className="mt-1 text-[9px] text-violet-500">Within last 7 days · no future times</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-violet-200 bg-white px-3 py-2">
            <p className="text-[10px] text-stone-500">Location: <span className="font-medium text-stone-700">{incident.purok}</span> · Incident: {incident.time ? formatDate(incident.time) : "—"} · Ref {incident.id}</p>
          </div>
          {timeError ? <p className="mt-2 flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-semibold text-red-600"><AlertTriangle size={12} /> {timeError}</p> : null}
          <button onClick={() => onRequestClip(incident, { camera: cameraOptions.find((c) => c.id === selectedCam)?.name ?? cameraName, cameraId: selectedCam, startTime, endTime, reason: reason.trim() })} disabled={!canRequest} className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-[11px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40">
            <Send size={12} /> Request CCTV Review
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <p className="text-[10px] font-semibold tracking-wider text-violet-700">CCTV REVIEW</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Clock size={10} /> PENDING</span>
            <span className="text-[10px] text-stone-500">No duplicate request allowed — waiting for the CCTV Operator.</span>
          </div>
          {req && (
            <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-[10px] text-stone-600">
              <p><span className="font-semibold text-stone-800">Requested by:</span> {req.requestedBy}</p>
              <p><span className="font-semibold text-stone-800">Requested at:</span> {new Date(req.requestedAt).toLocaleString()}</p>
              <p><span className="font-semibold text-stone-800">Camera:</span> {req.cameraId} — {req.camera}</p>
              <p><span className="font-semibold text-stone-800">Range:</span> {formatClock(req.startTime)} – {formatClock(req.endTime)}</p>
              <p><span className="font-semibold text-stone-800">Reason:</span> {req.reason}</p>
              <p className="mt-1 text-[10px] font-medium text-violet-700">CCTV Operator has been notified.</p>
            </div>
          )}
          <button onClick={() => onProvideClip(incident)} className="mt-2 flex h-7 items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-2 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"><Download size={10} /> CCTV Operator Provided the Clip (simulate)</button>
        </div>
      )}

      {status === "provided" && req?.provided && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-[10px] font-semibold tracking-wider text-emerald-700">CCTV REVIEW</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={10} /> PROVIDED</span>
            <span className="text-[10px] text-stone-500">CCTV footage is available — the clip you requested is here.</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-stone-600">
            <p><span className="font-semibold text-stone-800">Camera:</span> {req.provided.cameraId} — {req.provided.camera}</p>
            <p><span className="font-semibold text-stone-800">Recorded:</span> {formatDate(req.provided.recordedDate)}</p>
            <p><span className="font-semibold text-stone-800">Time:</span> {formatClock(req.provided.startTime)} – {formatClock(req.provided.endTime)}</p>
            <p><span className="font-semibold text-stone-800">Duration:</span> {req.provided.duration}</p>
          </div>
          <div className="mt-3 flex aspect-video items-center justify-center rounded-lg border border-emerald-300 bg-stone-900 text-white">
            <div className="text-center">
              <button className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"><Play size={22} className="ml-0.5 text-white" /></button>
              <p className="mt-2 text-[10px] text-stone-300">▶ 00:00 / {req.provided.duration} · {req.provided.clipId}.mp4</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-stone-500">Provided by: <span className="font-medium text-stone-700">{req.provided.providedBy}</span> · Provided at: <span className="font-medium text-stone-700">{new Date(req.provided.providedAt).toLocaleString()}</span></p>
            <span className="text-[10px] text-stone-500">{req.provided.remarks ?? ""}</span>
          </div>
          <div className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-500">CCTV FINDING</p>
            <div className="flex flex-wrap gap-1.5">
              {CCTV_FINDINGS.map((f) => (
                <button key={f} onClick={() => setFinding(f)} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${finding === f ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>{f}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-stone-400">Select a finding, or confirm review directly (defaults to "No relevant activity").</p>
          </div>
        </div>
      )}

      {status === "reviewed" && req?.review && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <p className="text-[10px] font-semibold tracking-wider text-violet-700">CCTV REVIEW</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700"><CheckCircle2 size={10} /> REVIEWED</span>
            <span className="text-[10px] text-stone-500">Review completed — footage has been assessed.</span>
          </div>
          <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-[10px] text-stone-600">
            <p><span className="font-semibold text-stone-800">Reviewed by:</span> {req.review.reviewedBy}</p>
            <p><span className="font-semibold text-stone-800">Reviewed at:</span> {new Date(req.review.reviewedAt).toLocaleString()}</p>
            <p><span className="font-semibold text-stone-800">Clip:</span> {req.provided?.clipId ?? "—"}.mp4</p>
            <p><span className="font-semibold text-stone-800">Finding:</span> {req.review.finding}</p>
            <p className="mt-1.5 text-[10px] font-medium text-violet-700">Footage reviewed — you can still replay the clip or continue with the incident workflow.</p>
          </div>
          {req.provided && (
            <div className="mt-3">
              <div className="flex aspect-video items-center justify-center rounded-lg border border-violet-300 bg-stone-900 text-white">
                <div className="text-center">
                  <button className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"><Play size={22} className="ml-0.5 text-white" /></button>
                  <p className="mt-2 text-[10px] text-stone-300">▶ 00:00 / {req.provided.duration} · {req.provided.clipId}.mp4</p>
                </div>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-violet-600"><Video size={11} /> Clip {req.provided.clipId}.mp4 · {formatDate(req.provided.recordedDate)} · {formatClock(req.provided.startTime)} – {formatClock(req.provided.endTime)} · {req.provided.duration}</p>
            </div>
          )}
        </div>
      )}

      {/* CCTV notes */}
      <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">CCTV NOTES (Desk Officer)</p>
        {(incident.cctvNotes ?? []).length === 0 ? (
          <p className="mb-2 text-[11px] text-stone-400">No CCTV observations yet — e.g. "May tatlong tao pa rin sa area."</p>
        ) : (
          <div className="mb-2 space-y-1.5">
            {(incident.cctvNotes ?? []).map((n, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"><Video size={11} className="mt-0.5 shrink-0 text-violet-600" /><p className="text-[11px] leading-snug text-stone-700">{n}</p></div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNote()} placeholder="Add CCTV observation…" className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-900 placeholder:text-stone-300 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/30" />
          <button onClick={submitNote} disabled={!note.trim()} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-600/10 px-2.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-600 hover:text-white disabled:opacity-40"><BellRing size={12} /> Add</button>
        </div>
      </div>
    </Modal>
  );
}

function ViewMapModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  return (
    <Modal
      onClose={onClose}
      size="lg"
      title="Incident Map"
      subtitle={`${incident.id} · ${incident.purok}`}
      icon={<MapPin size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
      footer={<button onClick={onClose} className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Close</button>}
    >
      <div className="relative mb-4 h-64 overflow-hidden rounded-xl border border-stone-200 bg-[#E9EDFB]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#d4dcf7_0%,#e9edfb_60%)]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center">
            <span className="relative flex h-10 w-10">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0038A8]/30" />
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0038A8] text-white"><MapPin size={18} /></span>
            </span>
            <span className="mt-2 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-stone-700 shadow">{incident.purok}</span>
          </div>
        </div>
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 font-mono text-[10px] text-stone-600 shadow">{incident.lat}, {incident.lng}</span>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">INCIDENT LOCATION</p>
          <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-stone-900"><MapPin size={11} className="text-[#0038A8]" /> {incident.purok}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">CATEGORY / STATUS</p>
          <p className="mt-1 text-[12px] font-medium text-stone-900">{incident.category} · {INCIDENT_STATUS_META[incident.status].label}</p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <Navigation size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <p className="text-[10px] leading-snug text-stone-500">
          Nearest responder for situational awareness: <span className="font-semibold text-stone-800">{incident.assignedTeam ?? "Awaiting dispatch"}</span>. Coordinates verified within the {incident.purok} boundary.
        </p>
      </div>
    </Modal>
  );
}

function NotifyReporterModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, channel: string) => void }) {
  const [channel, setChannel] = useState<string>("push");
  const target = incident.reporter;
  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Notify Reporter"
      subtitle={`${incident.id} · ${incident.category}`}
      icon={<BellRing size={18} className="text-teal-600" />}
      iconClass="bg-teal-50"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">Cancel</button>
          <button onClick={() => { onConfirm(incident, channel); onClose(); }} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-teal-700">
            <BellRing size={13} /> Send Notification
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-[10px] font-semibold tracking-wider text-stone-400">RESOLUTION UPDATE FOR</p>
        <p className="mt-1 text-[12px] font-medium text-stone-900">{target}</p>
        <p className="mt-1 text-[11px] leading-snug text-stone-500">The reporter is notified that their report has been <span className="font-semibold">resolved</span> and thanked for informing the barangay. Only information the reporter is authorized to receive is included — no internal notes or operational details.</p>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CHANNEL</p>
      <div className="mb-4 space-y-1.5">
        <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition ${channel === "push" ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}>
          <input type="radio" name="channel" checked={channel === "push"} onChange={() => setChannel("push")} className="accent-teal-600" /> Push notification (real-time)
        </label>
        <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition ${channel === "sms" ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}>
          <input type="radio" name="channel" checked={channel === "sms"} onChange={() => setChannel("sms")} className="accent-teal-600" /> SMS
        </label>
        <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition ${channel === "callback" ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}>
          <input type="radio" name="channel" checked={channel === "callback"} onChange={() => setChannel("callback")} className="accent-teal-600" /> Phone callback
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// §T.6 — Incident Detail Drawer (right-side)
// ---------------------------------------------------------------------------

const WORKFLOW_STAGES: FlowStage[] = ["received", "acknowledged", "triage", "decision", "monitoring", "resolved", "notified"];
const WORKFLOW_STAGE_LABELS: Record<FlowStage, string> = {
  received: "Received",
  acknowledged: "Acknowledge",
  triage: "Triage",
  decision: "Response",
  monitoring: "Monitor",
  resolved: "Resolve",
  notified: "Notify",
  closed_false_alarm: "Closed",
};

// Part 11 — case action helpers & shared option sets
const NOTICE_SEVERITIES: NoticeSeverity[] = ["Info", "Warning", "High"];
const NOTICE_AUDIENCES: { value: NoticeAudience; label: string }[] = [
  { value: "tanods", label: "Barangay Tanods" },
  { value: "neighborhood_watch", label: "Neighborhood Watch" },
  { value: "residents", label: "Residents" },
  { value: "all", label: "All" },
];
const AGENCY_OPTIONS: { value: string; type: "pnp" | "bfp" | "doh" | "lgu" | "ngo" | "other"; label: string }[] = [
  { value: "PNP", type: "pnp", label: "Philippine National Police (PNP)" },
  { value: "BFP", type: "bfp", label: "Bureau of Fire Protection (BFP)" },
  { value: "RHU", type: "doh", label: "Rural Health Unit (RHU)" },
  { value: "LGU-Purok", type: "lgu", label: "Barangay / LGU Office" },
  { value: "NGO", type: "ngo", label: "Partner NGO / Agency" },
  { value: "Other", type: "other", label: "Other Agency" },
];

// Part 11 — Request Additional Information
function RequestInfoModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, detail: string, channel: string) => void }) {
  const hasContact = !incident.anonymous;
  const [detail, setDetail] = useState("");
  const [channel, setChannel] = useState<"push" | "sms" | "callback">("push");
  const valid = hasContact && detail.trim().length >= 3;
  return (
    <Modal
      onClose={onClose}
      title="Request Additional Information"
      subtitle={`${incident.id} · follow-up to reporter`}
      icon={<MessageSquare size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => valid && onConfirm(incident, detail.trim(), channel)} disabled={!valid} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"><Send size={13} /> Send Request</button>
        </div>
      }
    >
      <div className="space-y-4">
        {hasContact ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
            <CheckCircle2 size={13} /> Contact available — request can be delivered to {incident.reporter}.
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
            Reporter submitted anonymously — no contact on file. The request will only be recorded to the timeline.
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">WHAT IS NEEDED</p>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Describe the missing information…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10" />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">DELIVERY CHANNEL</p>
          <div className="flex gap-2">
            {(["push", "sms", "callback"] as const).map((c) => (
              <button key={c} onClick={() => setChannel(c)} className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition ${channel === c ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>{c}</button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Part 11 — Change Urgency (requires a reason, persists to timeline + dashboard)
function ChangeUrgencyModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, next: DeskPriority, reason: string) => void }) {
  const [next, setNext] = useState<DeskPriority>(incident.priority);
  const [reason, setReason] = useState("");
  const changed = next !== incident.priority;
  const elevated = (next === "High") && incident.priority !== "High";
  const valid = changed && reason.trim().length >= 3;
  return (
    <Modal
      onClose={onClose}
      title="Change Urgency"
      subtitle={`${incident.id} · current: ${incident.priority}`}
      icon={<Activity size={18} />}
      iconClass="bg-amber-100 text-amber-700"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => valid && onConfirm(incident, next, reason.trim())} disabled={!valid} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"><CheckCircle2 size={13} /> Save Change</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">NEW URGENCY</p>
          <div className="grid grid-cols-3 gap-2">
            {DESK_PRIORITIES.map((p) => (
              <button key={p} onClick={() => setNext(p)} className={`rounded-lg border px-3 py-2.5 text-[12px] font-semibold transition ${next === p ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>{p}</button>
            ))}
          </div>
        </div>
        {elevated && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="text-[11px] leading-relaxed text-rose-800">Escalating to <span className="font-semibold">High</span> activates priority behavior — the incident will rank at the top of the priority queue and trigger an immediate field response.</p>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">REASON (REQUIRED)</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is the urgency changing?" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10" />
        </div>
        {!changed && <p className="text-[11px] text-amber-600">Choose a different urgency to enable saving.</p>}
      </div>
    </Modal>
  );
}

// Part 11 — Create Security Alert linked to this incident
function CreateAlertModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, severity: NoticeSeverity, audience: NoticeAudience[], message: string) => void }) {
  const [severity, setSeverity] = useState<NoticeSeverity>("Warning");
  const [audience, setAudience] = useState<NoticeAudience[]>(["residents"]);
  const [message, setMessage] = useState("");
  const valid = message.trim().length >= 3;
  function toggleAudience(a: NoticeAudience) {
    setAudience((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : prev.includes("all") ? [a] : prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }
  return (
    <Modal
      onClose={onClose}
      title="Create Security Alert"
      subtitle={`Linked to ${incident.id} · ${incident.category}`}
      icon={<Megaphone size={18} />}
      iconClass="bg-rose-100 text-rose-700"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => valid && onConfirm(incident, severity, audience, message.trim())} disabled={!valid} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"><Megaphone size={13} /> Create Alert</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">SEVERITY</p>
          <div className="grid grid-cols-3 gap-2">
            {NOTICE_SEVERITIES.map((s) => (
              <button key={s} onClick={() => setSeverity(s)} className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${severity === s ? (s === "High" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]") : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>{s}</button>
            ))}
          </div>
          {severity === "High" && <p className="mt-1.5 text-[10px] text-rose-600">High-severity alerts require Punong Barangay approval before distribution.</p>}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET AUDIENCE</p>
          <div className="flex flex-wrap gap-1.5">
            {NOTICE_AUDIENCES.map((a) => (
              <button key={a.value} onClick={() => toggleAudience(a.value)} className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition ${audience.includes(a.value) ? "border-[#0038A8]/30 bg-[#0038A8]/5 text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>{a.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">MESSAGE</p>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Alert message to field units & residents…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10" />
        </div>
        <p className="text-[10px] text-[#94A3B8]">Target zone: {incident.purok}. Incident ID {incident.id} will be auto-linked on the alert.</p>
      </div>
    </Modal>
  );
}

// Part 11 — Mark Referred / Endorsed to an external agency
function ReferralModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, agency: string, type: "pnp" | "bfp" | "doh" | "lgu" | "ngo" | "other", remarks: string, evidenceAttached: boolean, evidenceCount: number) => void }) {
  const [agency, setAgency] = useState(AGENCY_OPTIONS[0].value);
  const [remarks, setRemarks] = useState("");
  const [attachEvidence, setAttachEvidence] = useState(true);
  const selected = AGENCY_OPTIONS.find((a) => a.value === agency)!;
  const valid = remarks.trim().length >= 3;
  return (
    <Modal
      onClose={onClose}
      title="Mark Referred / Endorsed"
      subtitle={`${incident.id} · endorse to an external agency`}
      icon={<Landmark size={18} />}
      iconClass="bg-violet-100 text-violet-700"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => valid && onConfirm(incident, agency, selected.type, remarks.trim(), attachEvidence, incident.photos)} disabled={!valid} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"><Landmark size={13} /> Submit Referral</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">REFERRING AGENCY</p>
          <select value={agency} onChange={(e) => setAgency(e.target.value)} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50">
            {AGENCY_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">REMARKS (REQUIRED)</p>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Reason for referral, context, and any coordination notes…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10" />
        </div>
        <label className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2.5">
          <span className="flex items-center gap-2 text-[12px] font-medium text-stone-700"><Download size={13} className="text-[#0038A8]" /> Attach evidence package ({incident.photos} media)</span>
          <input type="checkbox" checked={attachEvidence} onChange={(e) => setAttachEvidence(e.target.checked)} className="h-4 w-4 accent-[#0038A8]" />
        </label>
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-[11px] text-violet-800">
          Referral endorses {incident.id} to {selected.label}. It is removed from active response queues while the complete record is preserved for audit and future reference.
        </div>
      </div>
    </Modal>
  );
}

// Part 11 — Request Video Clip (auto-links the incident ID)
function RequestVideoClipModal({ incident, onClose, onConfirm }: { incident: Incident; onClose: () => void; onConfirm: (incident: Incident, cam: string, date: string, start: string, end: string) => void }) {
  const [cam, setCam] = useState("Main Gate");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:10");
  return (
    <Modal
      onClose={onClose}
      title="Request Video Clip"
      subtitle={`${incident.id} · auto-linked to footage request`}
      icon={<Video size={18} />}
      iconClass="bg-violet-100 text-violet-700"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => onConfirm(incident, cam, date, start, end)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"><Video size={13} /> Submit Request</button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">CAMERA</p>
            <select value={cam} onChange={(e) => setCam(e.target.value)} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50">
              {["Main Gate", "Plaza & Court", "Public Market", "Crossing Road", "Cathedral Road"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">DATE</p>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">FROM</p>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50" />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TO</p>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50" />
          </div>
        </div>
        <p className="text-[10px] text-[#94A3B8]">Incident ID {incident.id} will populate the linked Video Clip Request on the dashboard &amp; CCTV operator queue.</p>
      </div>
    </Modal>
  );
}

function WorkflowStepper({ stage }: { stage: FlowStage }) {
  if (stage === "closed_false_alarm") return null;
  const activeIdx = WORKFLOW_STAGES.indexOf(stage);
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">WORKFLOW PROGRESS</p>
      <ol className="flex flex-wrap items-center gap-y-2">
        {WORKFLOW_STAGES.map((stageKey, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={stageKey} className="flex items-center">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                  active ? "bg-[#0038A8] text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"
                }`}
              >
                {done ? <CheckCircle2 size={11} /> : active ? <Navigation size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />}
                {WORKFLOW_STAGE_LABELS[stageKey]}
              </span>
              {i < WORKFLOW_STAGES.length - 1 && (
                <ChevronRight size={12} className={`mx-0.5 ${done || active ? "text-[#0038A8]" : "text-stone-300"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WorkflowActions({
  incident,
  stage,
  dispatchInfo,
  possibleDuplicates,
  onAcknowledge,
  onBeginTriage,
  onCompleteTriage,
  onSetPriority,
  onCloseFalseAlarm,
  onEscalateToCaptain,
  onAssign,
  onCctvReview,
  onAdvance,
  onResolveNoResponse,
  onNotifyReporter,
  onCloseResolved,
  onClose,
}: {
  incident: Incident;
  stage: FlowStage;
  dispatchInfo?: SharedDispatchItem;
  possibleDuplicates: Incident[];
  onAcknowledge: (inc: Incident) => void;
  onBeginTriage: (inc: Incident) => void;
  onCompleteTriage: (inc: Incident) => void;
  onSetPriority: (inc: Incident, p: DeskPriority) => void;
  onCloseFalseAlarm: (inc: Incident) => void;
  onEscalateToCaptain: (inc: Incident) => void;
  onAssign: (inc: Incident) => void;
  onCctvReview: (inc: Incident) => void;
  onAdvance: (inc: Incident) => void;
  onResolveNoResponse: (inc: Incident) => void;
  onNotifyReporter: (inc: Incident) => void;
  onCloseResolved: (inc: Incident) => void;
  onClose: () => void;
}) {
  const meta = FLOW_STAGE_META[stage];
  const reporterLabel = incident.reporter;
  const cctvState = cctvStatus(incident);

  const primaryBtn = "flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#002A8C]";
  const secondaryBtn = "flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-stone-600 transition hover:bg-stone-50";
  const greenBtn = "flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-emerald-700";
  const violetBtn = "flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-[12px] font-semibold text-violet-700 transition hover:bg-violet-100";

  return (
    <div className="space-y-2">
      {stage === "received" && (
        <>
          <button onClick={() => onAcknowledge(incident)} className={primaryBtn}><CheckCircle2 size={14} /> Acknowledge Incident</button>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[10px] leading-snug text-stone-500"><span className="font-semibold text-stone-700">What can I do right now?</span> Confirm you received this report. Acknowledging records reception and clears any SLA warning.</p>
          </div>
        </>
      )}

      {stage === "acknowledged" && (
        <>
          <button onClick={() => onBeginTriage(incident)} className={primaryBtn}><MessageCircleQuestion size={14} /> Begin Triage</button>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-[10px] leading-snug text-stone-500"><span className="font-semibold text-stone-700">What should I do next?</span> Begin triage to assess duplicates, priority, and whether a CCTV review is needed.</p>
          </div>
        </>
      )}

      {stage === "triage" && (
        <>
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2">
            <p className="text-[10px] font-semibold text-violet-700">TRIAGE TOOLS</p>
            <p className="mt-0.5 text-[10px] leading-snug text-stone-600">Set priority above, handle any duplicate match, and request a CCTV review if the situation requires verification.</p>
          </div>
          {possibleDuplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-700"><AlertTriangle size={11} /> Possible duplicate matched ({possibleDuplicates.length})</p>
              <p className="mt-0.5 text-[10px] leading-snug text-amber-700">Handle the duplicate in the panel above, or continue — it will remain tracked.</p>
            </div>
          ) : null}
          {cctvState === "not_requested" && (
            <button onClick={() => onCctvReview(incident)} className={violetBtn}><Video size={13} /> Request CCTV Review</button>
          )}
          {cctvState === "pending" && (
            <button onClick={() => onCctvReview(incident)} className={violetBtn}><Clock size={13} /> CCTV Request Pending — View</button>
          )}
          {cctvState === "provided" && (
            <button onClick={() => onCctvReview(incident)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100"><Play size={13} /> View CCTV — Footage Ready</button>
          )}
          {cctvState === "reviewed" && (
            <button onClick={() => onCctvReview(incident)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-[12px] font-semibold text-violet-700 transition hover:bg-violet-100"><CheckCircle2 size={13} /> View CCTV Review</button>
          )}
          <button onClick={() => onCompleteTriage(incident)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"><ClipboardList size={13} /> Complete Triage</button>
          <button onClick={() => onCloseFalseAlarm(incident)} className={secondaryBtn}><X size={13} /> Close as False Alarm / Duplicate</button>
        </>
      )}

      {stage === "decision" && (
        <>
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2">
            <p className="text-[10px] font-semibold text-violet-700">DISPATCH RECOMMENDATION READY</p>
            <p className="mt-0.5 text-[10px] leading-snug text-stone-600"><span className="font-semibold text-stone-700">{recommendDispatch(incident).severityLabel}</span> · {recommendDispatch(incident).incidentLabel} → {recommendDispatch(incident).responders.length} responder{recommendDispatch(incident).responders.length === 1 ? "" : "s"}: {recommendDispatch(incident).responders.map((r) => r.label.split(" (")[0]).join(" + ")}</p>
          </div>
          <button onClick={() => onAssign(incident)} className={primaryBtn}><Radio size={14} /> Review Dispatch</button>
          <button onClick={() => onResolveNoResponse(incident)} className={secondaryBtn}><CheckCircle2 size={13} /> Mark Resolved — No Field Response</button>
        </>
      )}

      {stage === "monitoring" && (
        <>
          {(dispatchInfo || incident.assignedTeam) && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-sky-700">ACTIVE DISPATCH · {incident.dispatchId ?? "—"}</p>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${dispatchInfo ? (DISPATCH_META as any)[dispatchInfo.status]?.badge ?? "bg-stone-100 text-stone-600" : "bg-stone-100 text-stone-600"}`}>
                  {dispatchInfo ? DISPATCH_META[dispatchInfo.status as keyof typeof DISPATCH_META]?.label ?? dispatchInfo.status : "Responding"}
                </span>
              </div>
              {(incident.dispatch?.responders ?? []).length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {incident.dispatch!.responders.map((r) => (
                    <div key={r.type} className="flex items-center justify-between rounded-md border border-sky-200 bg-white px-2.5 py-1.5">
                      <span className="flex items-center gap-2 text-[11px] font-semibold text-stone-800">
                        <span className="flex h-5 w-5 items-center justify-center rounded text-[8px] font-bold text-white bg-[#0038A8]">{RESPONDER_META[r.type].short}</span>
                        {r.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${r.type === "pnp" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{r.type === "pnp" ? "REQUESTED" : "RESPONDING"}</span>
                    </div>
                  ))}
                  {incident.dispatch!.overrideReason && <p className="mt-1 text-[9px] text-amber-600">Override: {incident.dispatch!.overrideReason}</p>}
                </div>
              ) : (
                dispatchInfo && <p className="mt-0.5 text-[10px] leading-snug text-sky-700">{dispatchInfo.id} · {dispatchInfo.eta}</p>
              )}
            </div>
          )}
          <button onClick={() => onEscalateToCaptain(incident)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100"><ArrowUpRight size={13} /> Escalate to Captain</button>
          <button onClick={() => onAdvance(incident)} className={greenBtn}><CheckCircle2 size={14} /> Mark Resolved</button>
        </>
      )}

      {stage === "resolved" && (
        <>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-emerald-700">INCIDENT RESOLVED</p>
            <p className="mt-0.5 text-[10px] leading-snug text-emerald-700">The incident has been marked resolved. Notify the reporter of the outcome before closing.</p>
          </div>
          <button onClick={() => onNotifyReporter(incident)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-teal-700"><BellRing size={14} /> Notify Reporter</button>
        </>
      )}

      {stage === "notified" && (
        <>
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-teal-700">REPORTER NOTIFIED</p>
            <p className="mt-0.5 text-[10px] leading-snug text-teal-700">Notification sent. All required steps are complete — close (archive) the incident to finalize it.</p>
          </div>
          <button onClick={() => onCloseResolved(incident)} className={primaryBtn}><FileText size={14} /> Close & Archive to Blotter</button>
        </>
      )}

      <p className="flex items-center justify-center gap-1 text-center text-[10px] text-stone-400"><Send size={10} /> {incident.priority === "High" ? `Real-time push on each change — SMS also sent on Acknowledge & Resolve to ${reporterLabel}` : `Real-time push sent to ${reporterLabel} on each change — SMS reserved for high-priority / emergency`}</p>
    </div>
  );
}

const TIMELINE_DOT: Record<TimelineKind, string> = {
  submitted: "bg-stone-400",
  acknowledged: "bg-amber-400",
  verified: "bg-emerald-400",
  unverified: "bg-rose-400",
  priority: "bg-orange-400",
  assigned: "bg-[#0038A8]",
  notified: "bg-sky-400",
  cctv_review: "bg-violet-400",
  cctv_clip_requested: "bg-violet-400",
  cctv_clip_linked: "bg-violet-400",
  escalated: "bg-rose-500",
  note: "bg-stone-400",
  status: "bg-sky-400",
  resolved: "bg-emerald-500",
  closed: "bg-stone-500",
  reporter_notified: "bg-teal-400",
  info_requested: "bg-teal-400",
  urgency: "bg-orange-400",
  alert: "bg-rose-500",
  referred: "bg-violet-500",
};

function IncidentDetail({
  incident,
  stage,
  onClose,
  onAcknowledge,
  onBeginTriage,
  onCompleteTriage,
  onSetPriority,
  onCloseFalseAlarm,
  possibleDuplicates,
  onKeepSeparate,
  onLinkRelated,
  onEscalateToCaptain,
  onAssign,
  onCctvReview,
  onAdvance,
  onResolveNoResponse,
  onNotifyReporter,
  onCloseResolved,
  onAddNote,
  onChangeCategory,
  onRequestInfo,
  onChangeUrgency,
  onCreateAlert,
  onRefer,
  onRequestVideo,
  onTimeline,
  dispatchInfo,
}: {
  incident: Incident;
  stage: FlowStage;
  onClose: () => void;
  onAcknowledge: (inc: Incident) => void;
  onBeginTriage: (inc: Incident) => void;
  onCompleteTriage: (inc: Incident) => void;
  onSetPriority: (inc: Incident, p: DeskPriority) => void;
  onCloseFalseAlarm: (inc: Incident) => void;
  possibleDuplicates: Incident[];
  onKeepSeparate: (inc: Incident, note: string) => void;
  onLinkRelated: (inc: Incident, ids: string[]) => void;
  onEscalateToCaptain: (inc: Incident) => void;
  onAssign: (inc: Incident) => void;
  onCctvReview: (inc: Incident) => void;
  onAdvance: (inc: Incident) => void;
  onResolveNoResponse: (inc: Incident) => void;
  onNotifyReporter: (inc: Incident) => void;
  onCloseResolved: (inc: Incident) => void;
  onAddNote: (inc: Incident, note: string) => void;
  onChangeCategory: (inc: Incident) => void;
  onRequestInfo: (inc: Incident) => void;
  onChangeUrgency: (inc: Incident) => void;
  onCreateAlert: (inc: Incident) => void;
  onRefer: (inc: Incident) => void;
  onRequestVideo: (inc: Incident) => void;
  onTimeline: (inc: Incident) => void;
  dispatchInfo?: SharedDispatchItem;
}) {
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
  const reporterLabel = incident.reporter;
  const canCaptureDetails = stage === "triage" || stage === "decision";

  // Part 11 — live data from shared stores (tanod roster, footage requests)
  const [tanods, setTanods] = useState<Tanod[]>(getTanods());
  useEffect(() => {
    const unsub = subscribeTanods(() => setTanods(getTanods()));
    return unsub;
  }, []);
  const [footageRequests, setFootageRequests] = useState<FootageRequest[]>(getFootageRequests());
  useEffect(() => {
    const unsub = subscribeFootageRequests(() => setFootageRequests(getFootageRequests()));
    return unsub;
  }, []);
  const caseRequests = footageRequests.filter((r) => r.incidentId === incident.id);
  const assignedTeamKey = (incident.assignedTeam ?? "").toLowerCase();
  const assignedTanods = tanods.filter((t) => assignedTeamKey && (t.id.toLowerCase() === assignedTeamKey || t.name.toLowerCase().includes(assignedTeamKey)));
  const IoT = incident.iotData;

  function submitNote() {
    if (!noteDraft.trim() || !incident) return;
    onAddNote(incident, noteDraft.trim());
    setNoteDraft("");
  }

  function submitKeepSeparate() {
    if (!dupNote.trim() || !incident) return;
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
      aside={<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${sev.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />{sev.label}</span>}
      footer={
        stage === "closed_false_alarm" ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <p className="text-center text-[11px] font-medium text-stone-500">Incident closed as inactive — no record is archived to the blotter.</p>
            </div>
            <button onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-stone-500 transition hover:bg-stone-50"><X size={13} /> Close</button>
          </div>
        ) : (
          <WorkflowActions
            incident={incident}
            stage={stage}
            dispatchInfo={dispatchInfo}
            possibleDuplicates={possibleDuplicates}
            onAcknowledge={onAcknowledge}
            onBeginTriage={onBeginTriage}
            onCompleteTriage={onCompleteTriage}
            onSetPriority={onSetPriority}
            onCloseFalseAlarm={onCloseFalseAlarm}
            onEscalateToCaptain={onEscalateToCaptain}
            onAssign={onAssign}
            onCctvReview={onCctvReview}
            onAdvance={onAdvance}
            onResolveNoResponse={onResolveNoResponse}
            onNotifyReporter={onNotifyReporter}
            onCloseResolved={onCloseResolved}
            onClose={onClose}
          />
        )
      }
    >
      {/* Workflow stepper — what happened, what is next */}
      <WorkflowStepper stage={stage} />

      {/* Badges row */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${sourceMeta.badge}`}><SourceIcon size={12} /> {sourceMeta.label}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusMeta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} /> {statusMeta.label}</span>
        {breached && <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white"><Timer size={11} /> SLA Breached</span>}
        {incident.escalatedToCaptain && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700"><ArrowUpRight size={11} /> Escalated to Captain</span>}
      </div>

      {/* Priority — editable only during triage; read-only otherwise */}
      <div className="mb-5">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">DESK OFFICER PRIORITY</p>
        {canCaptureDetails ? (
          <div className="flex flex-wrap gap-1.5">
            {DESK_PRIORITIES.map((p) => {
              const meta = DESK_PRIORITY_META[p];
              const active = incident.priority === p;
              return (
                <button key={p} disabled={isClosed} onClick={() => onSetPriority(incident, p)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${active ? meta.chip : "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? meta.dot : "bg-stone-300"}`} /> {p}
                </button>
              );
            })}
          </div>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${DESK_PRIORITY_META[incident.priority].chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${DESK_PRIORITY_META[incident.priority].dot}`} /> {incident.priority}
          </span>
        )}
      </div>

      {/* Category & Description */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${catColors.bg} ${catColors.text}`}><CatIcon size={16} /></div>
          <span className="text-[12px] font-semibold text-stone-900">{incident.category}</span>
          {stage === "triage" && (
            <button onClick={() => onChangeCategory(incident)} className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"><Tag size={9} /> Change</button>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-stone-500">{incident.description}</p>
      </div>

      {/* Category history context (kept on record) */}
      {(incident.categoryHistory ?? []).length > 0 && (
        <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-400">CATEGORY HISTORY</p>
          {incident.categoryHistory!.map((h, idx) => (
            <p key={idx} className="mt-1 text-[10px] text-stone-500">{formatTime(h.changedAt)} — {h.from} &rarr; {h.to} by {h.changedBy}</p>
          ))}
        </div>
      )}

      {/* Reporter & Rating */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">REPORTED BY</p>
          <p className="mt-1 text-[12px] font-medium text-stone-900">{incident.reporter}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">CITIZEN RATING</p>
          <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-stone-900">
            {incident.rating ? (
              <>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className={i < incident.rating! ? "fill-amber-400 text-amber-400" : "text-stone-300"} />)}<span className="ml-1 text-stone-400">({incident.rating}.0)</span></>
            ) : <span className="text-stone-400">Pending</span>}
          </p>
        </div>
      </div>

      {/* SLA breach */}
      {breached && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-wider text-rose-700">ACKNOWLEDGMENT SLA — BREACHED</p>
            <span className="flex items-center gap-1 text-[10px] font-medium text-rose-700"><Timer size={10} /> {SLA_TARGETS[incident.priority].label} target</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-rose-800">{slaOverrunLabel(incident)}. Priority unchanged — the Desk Officer has been alerted. Acknowledge the incident to clear the breach.</p>
        </div>
      )}

      {/* Duplicate warning — shown as a triage tool only */}
      {possibleDuplicates.length > 0 && !incident.duplicateResolved && stage === "triage" && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-wider text-amber-700">POSSIBLE DUPLICATE</p>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-800">Matches another open incident by category, location & submission window — no action was taken automatically.</p>
              <div className="mt-2 space-y-1.5">
                {possibleDuplicates.map((d) => {
                  const timeDiff = Math.abs(new Date(incident.time).getTime() - new Date(d.time).getTime());
                  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
                  const minsAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                  const timeLabel = hoursAgo > 0 ? `${hoursAgo}h ${minsAgo}m apart` : `${minsAgo}m apart`;
                  return (
                    <div key={d.id} className="rounded-md border border-amber-200 bg-white px-3 py-2">
                      <div className="flex items-center gap-1.5"><Link2 size={9} className="text-amber-600" /><span className="text-[10px] font-bold text-stone-900">{d.id}</span><span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">{timeLabel}</span></div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500"><span>Category: <span className="font-medium text-stone-700">{d.category}</span></span><span>Purok: <span className="font-medium text-stone-700">{d.purok}</span></span></div>
                    </div>
                  );
                })}
              </div>
              {!dupAction && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button onClick={() => setDupAction("keep_separate")} className="flex h-7 items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 text-[10px] font-semibold text-stone-700 transition hover:bg-stone-100"><X size={10} /> Keep Separate</button>
                  <button onClick={() => onLinkRelated(incident, possibleDuplicates.map((d) => d.id))} className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"><Link2 size={10} /> Link as Related</button>
                  <button onClick={() => onCloseFalseAlarm(incident)} className="flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-rose-100 px-2.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200"><CheckCircle2 size={10} /> Close as Duplicate</button>
                </div>
              )}
              {dupAction === "keep_separate" && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input value={dupNote} onChange={(e) => setDupNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitKeepSeparate()} placeholder="Required — why keep separate?" className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] text-stone-900 placeholder:text-stone-400 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30" />
                  <button onClick={submitKeepSeparate} disabled={!dupNote.trim()} className="flex h-7 items-center gap-1 rounded-md bg-[#0038A8] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"><CheckCircle2 size={10} /> Confirm</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Linked incidents */}
      {(incident.relatedTo ?? []).length > 0 && (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-sky-700">LINKED RELATED INCIDENTS</p>
          <p className="mt-1 text-[11px] text-sky-800">{(incident.relatedTo ?? []).join(", ")}</p>
        </div>
      )}

      {/* Closure history */}
      {(incident.closureHistory ?? []).length > 0 && (
        <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-500">CLOSURE HISTORY</p>
          {incident.closureHistory!.map((entry, idx) => (
            <div key={idx} className="mt-2 rounded-md border border-stone-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-stone-900">{entry.closureReason}</span><span className="text-[9px] text-stone-400">{formatTime(entry.closedAt)}</span></div>
              <p className="mt-0.5 text-[10px] text-stone-500">{entry.previousStatus} &rarr; {entry.finalStatus} · by {entry.closedBy}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-stone-600">{entry.closureNote}</p>
            </div>
          ))}
        </div>
      )}

      {/* Escalation */}
      {incident.escalatedToCaptain && (
        <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-violet-700">ESCALATED TO CAPTAIN</p>
          <p className="mt-1 text-[11px] leading-snug text-violet-900">{incident.escalatedAt ? `${formatTime(incident.escalatedAt)} — ` : ""}"{incident.escalatedReason}".</p>
        </div>
      )}

      {/* Purok Leader validation */}
      {incident.validationLabel && (
        <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-teal-600">INCIDENT VALIDATION (Purok Leader)</p>
          <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${displayValidationLabel(incident.validationLabel).badge}`}><Shield size={11} /> {displayValidationLabel(incident.validationLabel).label}</div>
          <p className="mt-1 text-[12px] text-teal-800">Field validation recorded by the Purok Leader.</p>
        </div>
      )}

      {/* Media */}
      {incident.photos > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold text-stone-900">Attached Evidence ({incident.photos})</p>
          <div className="flex gap-2">
            {Array.from({ length: incident.photos }).map((_, i) => (
              <div key={i} className="flex h-20 w-20 items-center justify-center rounded-lg border border-stone-200 bg-stone-100"><ImageIcon size={18} className="text-stone-300" /></div>
            ))}
          </div>
        </div>
      )}

      {/* Geotag */}
      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">GEOTAG &amp; BOUNDARY PARSING</p>
        <div className="flex items-center gap-1.5"><MapPin size={12} className="text-[#0038A8]" /><span className="font-mono text-[11px] text-stone-900">{incident.lat}, {incident.lng}</span></div>
        <div className="mt-1.5 flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-[11px] text-stone-500">Coordinates verified within {incident.purok} boundary</span></div>
      </div>

      {/* Internal notes — supporting detail captured during triage */}
      {canCaptureDetails && (
        <div className="mb-5 rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">INTERNAL NOTES (Desk Officer Only)</p>
          {(incident.notes ?? []).length === 0 ? (
            <p className="mb-2 text-[11px] text-stone-400">No internal notes yet — record observations during triage.</p>
          ) : (
            <div className="mb-2 space-y-1.5">
              {(incident.notes ?? []).map((n, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"><Shield size={11} className="mt-0.5 shrink-0 text-[#0038A8]" /><p className="text-[11px] leading-snug text-stone-700">{n}</p></div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNote()} placeholder="Add an internal note…" className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30" />
            <button onClick={submitNote} disabled={!noteDraft.trim()} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:opacity-40"><FileText size={12} /> Add</button>
          </div>
        </div>
      )}

      {/* Part 11 — IOT SENSOR DATA */}
      {IoT && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <Zap size={13} className="text-amber-600" />
            <p className="text-[10px] font-semibold tracking-wider text-amber-700">IOT SENSOR DATA</p>
            <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${IoT.thresholdState === "critical" ? "bg-rose-100 text-rose-700" : IoT.thresholdState === "elevated" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${IoT.thresholdState === "critical" ? "bg-rose-500" : IoT.thresholdState === "elevated" ? "bg-amber-500" : "bg-emerald-500"}`} /> {IoT.thresholdState.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <div className="text-stone-500">Sensor <span className="font-mono font-medium text-stone-900">{IoT.sensorType}</span></div>
            <div className="text-stone-500">ID <span className="font-mono font-medium text-stone-900">{IoT.sensorId}</span></div>
            <div className="text-stone-500">Reading <span className="font-semibold text-stone-900">{IoT.reading} {IoT.unit}</span></div>
            <div className="text-stone-500">Threshold <span className="font-medium text-stone-900">{IoT.threshold} {IoT.unit}</span></div>
            <div className="text-stone-500">Detected <span className="font-medium text-stone-900">{formatTime(IoT.timestamp)}</span></div>
            <div className="text-stone-500">Zone <span className="font-medium text-stone-900">{IoT.location}</span></div>
          </div>
        </div>
      )}

      {/* Part 11 — RESPONSE (assigned tanod teams & live status) */}
      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <UserCheck size={13} className="text-[#0038A8]" />
          <p className="text-[10px] font-semibold tracking-wider text-stone-600">FIELD RESPONSE — ASSIGNED TANOD TEAMS</p>
        </div>
        {!dispatchInfo && assignedTanods.length === 0 ? (
          <p className="text-[11px] text-stone-400">No field team assigned yet. Use <span className="font-medium text-[#0038A8]">Assign</span> to dispatch a response.</p>
        ) : (
          <div className="space-y-2">
            {(assignedTanods.length > 0 ? assignedTanods : []).map((t) => {
              const meta = TANOD_STATUS_META[t.status];
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0038A8]/10 text-[10px] font-bold text-[#0038A8]">{t.name.split(" ")[1]?.[0] ?? t.name[0]}</span>
                    <div>
                      <p className="text-[11px] font-semibold text-stone-900">{t.name} <span className="font-normal text-stone-400">· {t.members} members</span></p>
                      <p className="text-[10px] text-stone-400">{t.purok}{t.assignment ? ` — ${t.assignment}` : ""}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}</span>
                </div>
              );
            })}
            {dispatchInfo && (
              <div className="mt-2 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-[#0038A8]">ACTIVE DISPATCH {dispatchInfo.id}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${DISPATCH_META[dispatchInfo.status as keyof typeof DISPATCH_META]?.badge ?? "bg-stone-100 text-stone-600"}`}>{DISPATCH_META[dispatchInfo.status as keyof typeof DISPATCH_META]?.label ?? dispatchInfo.status}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-stone-500">{dispatchInfo.team} · ETA {dispatchInfo.eta}{dispatchInfo.dispatchedAt ? ` · dispatched ${formatTime(dispatchInfo.dispatchedAt)}` : ""}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Part 11 — CCTV EVIDENCE */}
      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Camera size={13} className="text-violet-600" />
          <p className="text-[10px] font-semibold tracking-wider text-stone-600">CCTV EVIDENCE &amp; VIDEO CLIP REQUESTS</p>
          <button onClick={() => onCctvReview(incident)} className="ml-auto flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"><FileSearch size={10} /> Review</button>
        </div>
        {caseRequests.length === 0 && !incident.cctvRequest ? (
          <p className="text-[11px] text-stone-400">No CCTV review or video clip request yet for this incident.</p>
        ) : (
          <div className="space-y-2">
            {caseRequests.map((r) => {
              const meta = REQUEST_STATUS_META[r.status];
              return (
                <div key={r.id} className="rounded-md border border-stone-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-stone-900">{r.id}</p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta?.badge ?? "bg-stone-100 text-stone-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${meta?.dot ?? "bg-stone-400"}`} /> {meta?.label ?? r.status}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-stone-500">{r.cameraName ?? "Camera"} · {r.startTime ?? "–"} to {r.endTime ?? "–"} · {r.purpose}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(r.clips ?? []).length > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700"><Download size={9} className="mr-0.5 inline" /> {r.clips!.length} clip(s)</span>}
                    {(r.stills ?? []).length > 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-semibold text-sky-700">{r.stills!.length} still(s)</span>}
                  </div>
                </div>
              );
            })}
            {incident.cctvRequest && caseRequests.length === 0 && (
              <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-stone-900">CCTV Review — {incident.cctvRequest.status}</p>
                  <span className="text-[10px] capitalize text-stone-500">{incident.cctvRequest.camera}</span>
                </div>
                {incident.cctvRequest.review && (
                  <p className="mt-1 text-[10px] leading-snug text-stone-500">Review found: {incident.cctvRequest.review.finding} (by {incident.cctvRequest.review.reviewedBy})</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Part 11 — INLINE TIMELINE */}
      <div className="mb-5 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Clock size={13} className="text-[#0038A8]" />
          <p className="text-[10px] font-semibold tracking-wider text-stone-600">CASE TIMELINE</p>
          <button onClick={() => onTimeline(incident)} className="ml-auto flex items-center gap-1 rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-100"><ExternalLink size={9} /> Full View</button>
        </div>
        {(incident.timeline ?? []).length === 0 ? (
          <p className="text-[11px] text-stone-400">No timeline events recorded yet.</p>
        ) : (
          <div className="relative pl-4">
            <div className="absolute bottom-2 left-[5px] top-2 w-px bg-stone-200" />
            <div className="space-y-2">
              {[...(incident.timeline ?? [])].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6).map((entry, idx) => (
                <div key={idx} className="relative">
                  <span className={`absolute -left-4 top-1 h-2 w-2 rounded-full ring-2 ring-white ${TIMELINE_DOT[entry.kind] ?? "bg-stone-400"}`} />
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">{formatClock(entry.time)}</p>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-stone-800">{entry.title}</p>
                  {entry.detail && <p className="text-[10px] leading-snug text-stone-500">{entry.detail}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Part 11 — ADDITIONAL CASE ACTIONS */}
      {!isClosed && (
        <div className="mb-1 rounded-lg border border-[#0038A8]/10 bg-[#E9EDFB]/60 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#0038A8]"><ClipboardCheck size={12} /> ADDITIONAL CASE ACTIONS</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => onRequestInfo(incident)} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-stone-700 transition hover:border-[#0038A8]/30 hover:text-[#0038A8]"><MessageSquare size={11} /> Request Info</button>
            <button onClick={() => onChangeUrgency(incident)} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-stone-700 transition hover:border-[#0038A8]/30 hover:text-[#0038A8]"><Activity size={11} /> Change Urgency</button>
            <button onClick={() => onCreateAlert(incident)} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100"><Megaphone size={11} /> Create Alert</button>
            <button onClick={() => onRequestVideo(incident)} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-stone-700 transition hover:border-violet-300 hover:text-violet-700"><Video size={11} /> Request Video</button>
            <button onClick={() => onRefer(incident)} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"><Landmark size={11} /> Refer / Endorse</button>
          </div>
        </div>
      )}

      {/* Part 11 — Referral record */}
      {incident.referral && (
        <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Landmark size={13} className="text-violet-700" />
            <p className="text-[10px] font-semibold tracking-wider text-violet-700">REFERRED TO {incident.referral.agency.toUpperCase()}</p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-violet-900">"{incident.referral.remarks}".</p>
          <p className="mt-1 text-[10px] text-violet-700">Referred by {incident.referral.referredBy} · {formatTime(incident.referral.referredAt)} · {incident.referral.evidenceAttached ? `${incident.referral.evidenceCount} media attached` : "no evidence attached"}</p>
        </div>
      )}

      {/* Part 11 — Info request records */}
      {(incident.infoRequests ?? []).length > 0 && (
        <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wider text-teal-700">INFORMATION REQUESTS SENT</p>
          {(incident.infoRequests ?? []).map((r) => (
            <div key={r.id} className="mt-1.5 rounded-md border border-teal-100 bg-white px-3 py-2">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-stone-900">{r.id}</span><span className="text-[9px] text-stone-400">{formatTime(r.requestedAt)} · {r.channel}</span></div>
              <p className="mt-0.5 text-[10px] leading-snug text-stone-600">{r.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// §T.7 — Main Incident Triage Page
// ---------------------------------------------------------------------------

export default function IncidentTriage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { flash, ToastPortal } = useToast();
  const { incidents: storeIncidents, dispatches: storeDispatches } = useSharedIncidentStore();

  const [incidents, setIncidents] = useState<Incident[]>(getSharedIncidents() as unknown as Incident[]);
  const [dispatches, setDispatches] = useState<SharedDispatchItem[]>(getSharedDispatches());

  // UI state — selected incident is tracked by id so the open drawer always reflects the latest live state
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const selectedIncident = selectedIncidentId ? incidents.find((i) => i.id === selectedIncidentId) ?? null : null;
  const [dispatchTarget, setDispatchTarget] = useState<Incident | null>(null);
  const [escalateTarget, setEscalateTarget] = useState<Incident | null>(null);
  const [closeTarget, setCloseTarget] = useState<Incident | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Incident | null>(null);
  const [categoryChangeTarget, setCategoryChangeTarget] = useState<Incident | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);

  // New workflow modals: CCTV review / timeline / map / notify reporter
  const [cctvTarget, setCctvTarget] = useState<Incident | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<Incident | null>(null);
  const [mapTarget, setMapTarget] = useState<Incident | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<Incident | null>(null);

  // Part 11 — additional case action targets
  const [requestInfoTarget, setRequestInfoTarget] = useState<Incident | null>(null);
  const [urgencyTarget, setUrgencyTarget] = useState<Incident | null>(null);
  const [createAlertTarget, setCreateAlertTarget] = useState<Incident | null>(null);
  const [referralTarget, setReferralTarget] = useState<Incident | null>(null);
  const [videoRequestTarget, setVideoRequestTarget] = useState<Incident | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterPurok, setFilterPurok] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");

  const slaNotifiedRef = useRef<string[]>([]);

  // SLA breach detection
  useEffect(() => {
    const breached = incidents.filter((i) => isSlaBreached(i) && !slaNotifiedRef.current.includes(i.id));
    if (breached.length === 0) return;
    slaNotifiedRef.current = [...slaNotifiedRef.current, ...breached.map((i) => i.id)];
    setIncidents((prev) =>
      prev.map((i) =>
        breached.some((b) => b.id === i.id)
          ? { ...i, slaBreached: true, notes: [...(i.notes ?? []), `SLA breach: ${slaOverrunLabel(i)} — Desk Officer notified`] }
          : i
      )
    );
    breached.forEach((i) => flash(`${i.id} acknowledgment SLA breached — ${slaOverrunLabel(i)}`));
  }, [incidents, flash]);

  // Deep-link: dashboard summary cards open Incident Triage pre-filtered
  useEffect(() => {
    const target = consumeDeskTriageTarget();
    if (!target) return;
    applyQuickFilter(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link: Live Incident Map opens a specific incident case view, and
  // optionally the Dispatch & Assignment modal pre-selected on that incident.
  useEffect(() => {
    const target = consumeDeskCaseTarget();
    if (!target) return;
    const inc = incidents.find((i) => i.id === target.incidentId);
    if (!inc) return;
    setSelectedIncidentId(inc.id);
    if (target.openDispatch) {
      setDispatchTarget(inc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data freshness timer
  useEffect(() => {
    const timer = setInterval(() => setLastUpdated(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Sync from store when store changes (e.g. from other pages)
  useEffect(() => {
    setIncidents(getSharedIncidents() as unknown as Incident[]);
    setDispatches(getSharedDispatches());
  }, [storeIncidents, storeDispatches]);

  // ---------------------------------------------------------------------------
  // §T.8 — Event handlers
  // ---------------------------------------------------------------------------

  function persistIncidents(next: Incident[]) {
    setIncidents(next);
    setSharedIncidents(next as unknown as SharedIncident[]);
  }

  function persistDispatches(next: SharedDispatchItem[]) {
    setDispatches(next);
    setSharedDispatches(next);
  }

  function acknowledgeIncident(incident: Incident) {
    const now = new Date().toISOString();
    persistIncidents(
      incidents.map((i) =>
        i.id === incident.id
          ? pushTimeline({ ...i, status: "acknowledged" as IncidentStatus, acknowledgedAt: now, flowStage: "acknowledged", slaBreached: false }, { title: "Desk Officer acknowledged", detail: `Priority ${i.priority}`, kind: "acknowledged" })
          : i
      )
    );
    flash(`${incident.id} acknowledged — reception confirmed`);
  }

  function beginTriage(incident: Incident) {
    persistIncidents(
      incidents.map((i) =>
        i.id === incident.id
          ? pushTimeline({ ...i, flowStage: "triage" }, { title: "Triage started", detail: "Assessing duplicates, priority, and CCTV needs", kind: "status" })
          : i
      )
    );
    flash(`${incident.id} — triage started`);
  }

  function completeTriage(incident: Incident) {
    persistIncidents(
      incidents.map((i) =>
        i.id === incident.id
          ? pushTimeline({ ...i, flowStage: "decision" }, { title: "Triage completed", detail: `Priority ${i.priority} — deciding response`, kind: "priority" })
          : i
      )
    );
    flash(`${incident.id} — triage complete, decide the response`);
  }

  function resolveNoResponse(incident: Incident) {
    setResolveTarget(incident);
  }

  function closeResolved(incident: Incident) {
    if (incident.status !== "resolved") return;
    const blotter = convertIncidentToBlotter(incident.id);
    if (!blotter) {
      flash(`${incident.id} could not be closed/archived — not eligible or still has an active dispatch`);
      return;
    }
    setSelectedIncidentId(null);
    flash(`${incident.id} closed and archived to Digital Barangay Blotter as ${blotter.id}`);
  }

  function advanceIncident(incident: Incident) {
    if (incident.status === "in_progress") {
      setResolveTarget(incident);
      return;
    }
    if (incident.status === "new") {
      acknowledgeIncident(incident);
    }
  }

  function confirmResolve(incident: Incident, summary: string, responseCompleted: boolean, evidenceAttached: boolean, note: string) {
    const now = new Date().toISOString();
    const closureEntry: ClosureHistoryEntry = {
      previousStatus: incident.status,
      finalStatus: "resolved",
      closureReason: "Normal Resolution",
      closureNote: summary + (note ? ` — Internal: ${note}` : ""),
      closedBy: "Desk Officer",
      closedAt: now,
    };
    persistIncidents(
      incidents.map((i) =>
        i.id === incident.id
          ? pushTimeline(
              { ...i, status: "resolved" as IncidentStatus, flowStage: "resolved", resolvedAt: now, closureHistory: [...(i.closureHistory ?? []), closureEntry], notes: [...(i.notes ?? []), `Resolved — ${summary}`, ...(note ? [`Internal note: ${note}`] : []), `Response completed: ${responseCompleted ? "Yes" : "No"} · Evidence attached: ${evidenceAttached ? "Yes" : "No"}`] },
              { title: "Incident marked resolved", detail: summary, kind: "resolved" }
            )
          : i
      )
    );
    setResolveTarget(null);
    flash(`${incident.id} resolved — closure history recorded`);
  }

  function setPriority(incident: Incident, priority: DeskPriority) {
    persistIncidents(incidents.map((i) => (i.id === incident.id ? pushTimeline({ ...i, priority }, { title: "Priority changed", detail: `${incident.priority} → ${priority}`, kind: "priority" }) : i)));
    flash(`${incident.id} priority set to ${priority}`);
  }

  function addNote(incident: Incident, note: string) {
    persistIncidents(incidents.map((i) => (i.id === incident.id ? pushTimeline({ ...i, notes: [...(i.notes ?? []), note] }, { title: "Internal note added", detail: note, kind: "note" }) : i)));
    flash(`Internal note added to ${incident.id}`);
  }

  function requestCloseFalseAlarm(incident: Incident) {
    setCloseTarget(incident);
  }

  function closeFalseAlarm(incident: Incident, reason: ClosureReason, explanation: string) {
    const now = new Date().toISOString();
    const closureEntry: ClosureHistoryEntry = {
      previousStatus: incident.status,
      finalStatus: "closed_false_alarm",
      closureReason: reason,
      closureNote: explanation,
      closedBy: "Desk Officer",
      closedAt: now,
    };
    persistIncidents(
      incidents.map((i) =>
        i.id === incident.id
          ? pushTimeline(
              { ...i, status: "closed_false_alarm" as IncidentStatus, closedReason: `${reason}: ${explanation}`, closureHistory: [...(i.closureHistory ?? []), closureEntry], notes: [...(i.notes ?? []), `Closed — ${reason}: ${explanation}`] },
              { title: "Incident closed", detail: `${reason} — ${explanation}`, kind: "closed" }
            )
          : i
      )
    );
    setCloseTarget(null);
    setSelectedIncidentId(null);
    flash(`${incident.id} closed (${reason}) — closure history recorded`);
  }

  function changeCategory(incident: Incident, newCategory: string) {
    const oldCategory = incident.category;
    if (oldCategory === newCategory) return;
    persistIncidents(incidents.map((i) => (i.id === incident.id ? { ...i, category: newCategory, categoryHistory: [...(i.categoryHistory ?? []), { from: oldCategory, to: newCategory, changedBy: "Desk Officer", changedAt: new Date().toISOString() }], notes: [...(i.notes ?? []), `Category changed: ${oldCategory} → ${newCategory}`] } : i)));
    setCategoryChangeTarget(null);
    flash(`${incident.id} — Category changed: ${oldCategory} → ${newCategory}`);
  }

  function keepSeparate(incident: Incident, note: string) {
    persistIncidents(incidents.map((i) => (i.id === incident.id ? { ...i, duplicateResolved: true, notes: [...(i.notes ?? []), `Kept separate from possible duplicate — ${note}`] } : i)));
    flash(`${incident.id} kept separate from possible duplicate — note logged`);
  }

  function linkRelated(incident: Incident, otherIds: string[]) {
    persistIncidents(
      incidents.map((i) => {
        if (i.id === incident.id) return { ...i, duplicateResolved: true, relatedTo: [...new Set([...(i.relatedTo ?? []), ...otherIds])], notes: [...(i.notes ?? []), `Linked as related to ${otherIds.join(", ")} — no auto-merge`] };
        if (otherIds.includes(i.id)) return { ...i, duplicateResolved: true, relatedTo: [...new Set([...(i.relatedTo ?? []), incident.id])] };
        return i;
      })
    );
    flash(`${incident.id} linked as related to ${otherIds.join(", ")} — no auto-merge`);
  }

  function escalateToCaptain(incident: Incident, reason: string) {
    persistIncidents(incidents.map((i) => (i.id === incident.id ? pushTimeline({ ...i, escalatedToCaptain: true, escalatedReason: reason, escalatedAt: new Date().toISOString(), notes: [...(i.notes ?? []), `Escalated to Captain — ${reason}`] }, { title: "Escalated to Captain", detail: reason, kind: "escalated" }) : i)));
    flash(`${incident.id} escalated to Captain — record preserved`);
  }

  function confirmDispatch(incident: Incident, responders: DispatchResponder[], overrideReason?: string) {
    const dispatchId = `DP-${1183 + dispatches.length}`;
    const now = new Date().toISOString();
    const first = responders[0];
    const assignee = first?.label ?? "Responder";
    const isPurokLeader = first?.type === "purok_leader";
    const internal = responders.filter((r) => !r.external).length;
    const external = responders.length - internal;
    const detail = responders.map((r) => r.label).join(" + ");
    persistDispatches([
      { id: dispatchId, incident: incident.id, team: assignee, status: "responding", purok: incident.purok, eta: isPurokLeader ? "Awaiting leader report" : "ETA 5 min", photos: 0, ...(isPurokLeader ? { assigneeType: "purok_leader" as const } : {}) },
      ...dispatches,
    ]);
    persistIncidents(
      incidents.map((i) =>
        i.id === incident.id
          ? pushTimeline(
              { ...i, status: "in_progress" as IncidentStatus, flowStage: "monitoring", assignedTeam: assignee, dispatchId, dispatch: { responders: responders.map((r) => ({ type: r.type, label: r.label })), status: "responding", dispatchedAt: now, overrideReason }, acknowledgedAt: i.acknowledgedAt ?? now, notes: [...(i.notes ?? []), `Dispatch created — ${detail}${overrideReason ? ` (override: ${overrideReason})` : ""}`] },
              { title: "Responders dispatched", detail: `${detail} · ${dispatchId}${external ? ` · ${external} external requested` : ""}`, kind: "assigned" }
            )
          : i
      )
    );
    setDispatchTarget(null);
    flash(`${incident.id} dispatched — ${responders.length} responder${responders.length === 1 ? "" : "s"} (${detail})${overrideReason ? " · override recorded" : ""}`);
  }

  function requestCctvClip(incident: Incident, req: { camera: string; cameraId: string; startTime: string; endTime: string; reason: string }) {
    const existingCount = incidents.filter((i) => i.cctvRequest).length;
    const reqId = `CR-${String(existingCount + 1).padStart(4, "0")}`;
    const updated = pushTimeline(
      { ...incident, cctvRequest: { id: reqId, requestedAt: new Date().toISOString(), requestedBy: "Desk Officer", camera: req.camera, cameraId: req.cameraId, startTime: req.startTime, endTime: req.endTime, reason: req.reason, status: "pending" } },
      { title: "CCTV clip request submitted", detail: `Request ${reqId} sent to the CCTV Operator — ${req.camera} · ${formatClock(req.startTime)} – ${formatClock(req.endTime)} · ${req.reason}`, kind: "cctv_clip_requested" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    setCctvTarget(updated);
    flash(`${incident.id} — CCTV request ${reqId} submitted; awaiting the CCTV Operator to provide the footage`);
  }

  function provideCctvClip(incident: Incident) {
    if (!incident.cctvRequest || incident.cctvRequest.status !== "pending") return;
    const req = incident.cctvRequest;
    const clipId = `cctv_clip_${incident.id.replace("INC-", "")}`;
    const now = new Date().toISOString();
    const duration = `${Math.max(1, Math.round((new Date(req.endTime).getTime() - new Date(req.startTime).getTime()) / 60_000))} min`;
    const updated = pushTimeline(
      {
        ...incident,
        cctvRequest: {
          ...req,
          status: "provided",
          provided: {
            clipId,
            cameraId: req.cameraId,
            camera: req.camera,
            recordedDate: req.startTime,
            startTime: req.startTime,
            endTime: req.endTime,
            duration,
            providedAt: now,
            providedBy: "CCTV Operator",
            remarks: "Footage processed and verified",
          },
        },
      },
      { title: "CCTV footage provided by CCTV Operator", detail: `${clipId}.mp4 delivered for ${req.camera}`, kind: "cctv_clip_linked" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    setCctvTarget(updated);
    flash(`${incident.id} — CCTV footage provided by CCTV Operator; clip now available to review`);
  }

  function confirmCctvReview(incident: Incident, finding: string) {
    if (!incident.cctvRequest || incident.cctvRequest.status !== "provided") return;
    const req = incident.cctvRequest;
    const updated = pushTimeline(
      {
        ...incident,
        cctvRequest: { ...req, status: "reviewed", review: { reviewedAt: new Date().toISOString(), reviewedBy: "Desk Officer", finding } },
        cctvNotes: [...(incident.cctvNotes ?? []), `CCTV finding: ${finding}`],
      },
      { title: "CCTV footage reviewed by Desk Officer", detail: `Finding recorded: ${finding}`, kind: "cctv_review" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    setCctvTarget(updated);
    flash(`${incident.id} — CCTV review recorded: ${finding}`);
  }

  function addCctvNote(incident: Incident, note: string) {
    const updated = pushTimeline(
      { ...incident, cctvNotes: [...(incident.cctvNotes ?? []), note] },
      { title: "CCTV observation recorded", detail: note, kind: "cctv_review" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    setCctvTarget(updated);
    flash(`CCTV note added to ${incident.id}`);
  }

  function confirmNotifyReporter(incident: Incident, channel: string) {
    const stage = incident.status === "resolved" ? "resolved" : incident.status;
    const channelLabel = channel === "push" ? "push notification" : channel === "sms" ? "SMS" : "phone callback";
    const updated = pushTimeline(
      { ...incident, flowStage: "notified", reporterNotified: { notifiedAt: new Date().toISOString(), channel, stage } },
      { title: "Reporter notified", detail: `${channelLabel} sent (${INCIDENT_STATUS_META[incident.status].label})`, kind: "reporter_notified" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    setNotifyTarget(null);
    flash(`${incident.id} — reporter notified via ${channelLabel}; only authorized information included`);
  }

  function openCctvReview(incident: Incident) {
    setCctvTarget(incident);
  }

  // ---------------------------------------------------------------------------
  // §T.11 — Part 11: additional case actions
  // ---------------------------------------------------------------------------

  function requestInfo(incident: Incident, detail: string, channel: string) {
    const req = { id: `IRQ-${String((incident.infoRequests?.length ?? 0) + 1).padStart(2, "0")}`, requestedAt: new Date().toISOString(), detail, channel, sender: "Desk Officer" };
    const updated = pushTimeline(
      { ...incident, infoRequests: [...(incident.infoRequests ?? []), req] },
      { title: "Additional information requested", detail: `${channel === "callback" ? "callback" : `${channel} to reporter`}${incident.anonymous ? " (reporter anonymous — recorded only)" : ""} — ${detail}`, kind: "info_requested" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    setRequestInfoTarget(null);
    flash(`${incident.id} — information request ${incident.anonymous ? "recorded" : `sent via ${channel}`}`);
  }

  function changeUrgency(incident: Incident, next: DeskPriority, reason: string) {
    const updated = pushTimeline(
      { ...incident, priority: next, notes: [...(incident.notes ?? []), `Urgency changed to ${next} — ${reason}`] },
      { title: "Urgency changed", detail: `${incident.priority} → ${next} (${reason})`, kind: "urgency" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    recordActivity({ action: "urgency_changed", kind: "incident", incidentId: incident.id, actor: "Desk Officer", state: next, target: `triage/${incident.id}`, severity: next === "High" ? "high" : "normal" });
    setUrgencyTarget(null);
    flash(`${incident.id} urgency changed to ${next}${next === "High" ? " — now top of priority queue" : ""}`);
  }

  function createAlert(incident: Incident, severity: NoticeSeverity, audience: NoticeAudience[], message: string) {
    const notice = addSafetyNotice({
      title: `${severity} — ${incident.category}`,
      category: "Safety Alert",
      message,
      target: { kind: "purok", purok: incident.purok },
      state: "draft",
      author: "Desk Officer",
      createdAt: new Date().toISOString(),
      incidentId: incident.id,
      severity,
      audience,
      approvalStatus: severity === "High" ? "pending" : undefined,
    });
    const updated = pushTimeline(incident, { title: `Security alert created (${severity})`, detail: `${message}${severity === "High" ? " — awaiting Punong Barangay approval" : ""}`, kind: "alert" });
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    recordActivity({ action: "alert_created", kind: "alert", incidentId: incident.id, refId: notice.id, actor: "Desk Officer", state: severity === "High" ? "pending_approval" : "draft", target: "security_alerts", severity: severity === "High" ? "high" : severity === "Warning" ? "normal" : "low" });
    setCreateAlertTarget(null);
    flash(`${notice.id} security alert created for ${incident.id}${severity === "High" ? " — pending Captain approval" : ""}`);
  }

  function referCase(incident: Incident, agency: string, agencyType: NonNullable<Incident["referral"]>["agencyType"], remarks: string, evidenceAttached: boolean, evidenceCount: number) {
    const referral: Incident["referral"] = { agency, agencyType, remarks, referredAt: new Date().toISOString(), referredBy: "Desk Officer", evidenceAttached, evidenceCount };
    const updated = pushTimeline(
      { ...incident, referral, notes: [...(incident.notes ?? []), `Referred to ${agency} — ${remarks}`] },
      { title: `Referred to ${agency}`, detail: `${remarks}${evidenceAttached ? ` (${evidenceCount} media attached)` : ""}`, kind: "referred" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    recordActivity({ action: "incident_referred", kind: "incident", incidentId: incident.id, actor: "Desk Officer", state: agency, target: `triage/${incident.id}` });
    setReferralTarget(null);
    setSelectedIncidentId(null);
    flash(`${incident.id} referred to ${agency} — record preserved for audit`);
  }

  function requestVideo(incident: Incident, cam: string, date: string, start: string, end: string) {
    const req = addFootageRequest({
      incidentId: incident.id,
      cameraId: cam,
      cameraName: cam,
      date,
      startTime: start,
      endTime: end,
      purpose: `Video clip request for ${incident.id} — ${incident.category}`,
      priority: incident.priority === "High" ? "urgent" : "standard",
      requestedBy: "Desk Officer",
      requestedByRole: "Barangay Desk Officer",
    });
    const nowIso = new Date().toISOString();
    const updated = pushTimeline(
      {
        ...incident,
        cctvRequest: {
          id: incident.cctvRequest?.id ?? `CR-${incident.id.replace(/\D/g, "")}`,
          requestedAt: nowIso,
          requestedBy: "Desk Officer",
          camera: cam,
          cameraId: cam,
          startTime: start,
          endTime: end,
          reason: `Video clip request for ${incident.id} — ${cam} ${date} ${start}–${end}`,
          status: "pending",
        },
      },
      { title: "Video clip requested", detail: `${cam} ${date} ${start}–${end} (${req.id})`, kind: "cctv_clip_requested" }
    );
    persistIncidents(incidents.map((i) => (i.id === incident.id ? updated : i)));
    recordActivity({ action: "video_request_submitted", kind: "request", incidentId: incident.id, refId: req.id, actor: "Desk Officer", state: "pending", target: "cctv" });
    setVideoRequestTarget(null);
    flash(`${req.id} submitted for ${incident.id} — ${cam} ${date} ${start}–${end}`);
  }

  // ---------------------------------------------------------------------------
  // §T.9 — Derived data
  // ---------------------------------------------------------------------------

  const activeIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm");

  const newCount = activeIncidents.filter((i) => i.status === "new").length;
  const highPriorityCount = activeIncidents.filter((i) => i.priority === "High").length;
  const slaBreachedCount = incidents.filter((i) => isSlaBreached(i)).length;
  const inProgressCount = activeIncidents.filter((i) => i.status === "in_progress").length;

  // Search + filter + sort
  const filteredIncidents = activeIncidents
    .filter((inc) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = inc.id.toLowerCase().includes(q) || inc.category.toLowerCase().includes(q) || inc.description.toLowerCase().includes(q) || inc.purok.toLowerCase().includes(q) || inc.source.toLowerCase().includes(q) || (inc.reporter && inc.reporter.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (filterStatus !== "all" && inc.status !== filterStatus) return false;
      if (filterSource !== "all" && inc.source !== filterSource) return false;
      if (filterCategory !== "all" && inc.category !== filterCategory) return false;
      if (filterPriority !== "all" && inc.priority !== filterPriority) return false;
      if (filterPurok !== "all" && inc.purok !== filterPurok) return false;
      if (filterDateFrom) {
        const fromTime = new Date(filterDateFrom).getTime();
        if (new Date(inc.time).getTime() < fromTime) return false;
      }
      if (filterDateTo) {
        const toTime = new Date(filterDateTo).getTime() + 24 * 60 * 60 * 1000;
        if (new Date(inc.time).getTime() > toTime) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.time).getTime() - new Date(a.time).getTime();
      if (sortBy === "oldest") return new Date(a.time).getTime() - new Date(b.time).getTime();
      if (sortBy === "priority") {
        const order = { High: 0, Medium: 1, Low: 2 };
        return order[a.priority] - order[b.priority];
      }
      if (sortBy === "sla") {
        const aBreached = isSlaBreached(a) ? 0 : 1;
        const bBreached = isSlaBreached(b) ? 0 : 1;
        if (aBreached !== bBreached) return aBreached - bBreached;
        return slaElapsed(a).pct - slaElapsed(b).pct;
      }
      if (sortBy === "purok") return a.purok.localeCompare(b.purok);
      return 0;
    });

  const hasActiveFilters = filterStatus !== "all" || filterSource !== "all" || filterCategory !== "all" || filterPriority !== "all" || filterPurok !== "all" || filterDateFrom || filterDateTo || searchQuery;

  function clearFilters() {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterSource("all");
    setFilterCategory("all");
    setFilterPriority("all");
    setFilterPurok("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  // Quick filter: clicking a summary card
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  function applyQuickFilter(type: string) {
    if (quickFilter === type) {
      setQuickFilter(null);
      clearFilters();
      return;
    }
    setQuickFilter(type);
    clearFilters();
    if (type === "new") setFilterStatus("new");
    if (type === "in_progress") setFilterStatus("in_progress");
    if (type === "high") setFilterPriority("High");
    if (type === "sla") setFilterStatus("new");
    if (type === "acknowledged") setFilterStatus("acknowledged");
  }

  // Summary cards: when quickFilter is active, filter to that subset for count display
  function getCount(type: string) {
    if (type === "new") return activeIncidents.filter((i) => i.status === "new").length;
    if (type === "acknowledged") return activeIncidents.filter((i) => i.status === "acknowledged").length;
    if (type === "in_progress") return activeIncidents.filter((i) => i.status === "in_progress").length;
    if (type === "high") return activeIncidents.filter((i) => i.priority === "High").length;
    if (type === "sla") return incidents.filter((i) => isSlaBreached(i)).length;
    return 0;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* §T.10 — Page Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Incident Triage</h1>
              <p className="mt-1 text-sm text-stone-500">Review, validate, prioritize, and assign incoming community incidents.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-stone-400">Last updated: {formatTime(lastUpdated.toISOString())}</span>
              <button onClick={() => { setLastUpdated(new Date()); flash("Incident queue refreshed"); }} className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"><RefreshCw size={13} /> Refresh</button>
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${showFilters ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}><Filter size={13} /> Filter</button>
            </div>
          </div>
        </header>

        {/* §T.11 — Summary Cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { type: "new", label: "New", icon: ClipboardList, color: "text-rose-600", bg: "bg-rose-50" },
            { type: "acknowledged", label: "Acknowledged", icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50" },
            { type: "in_progress", label: "In Progress", icon: Activity, color: "text-sky-600", bg: "bg-sky-50" },
            { type: "high", label: "High Priority", icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
            { type: "sla", label: "SLA Breached", icon: Timer, color: "text-rose-600", bg: "bg-rose-50" },
          ].map(({ type, label, icon: Icon, color, bg }) => (
            <button
              key={type}
              onClick={() => applyQuickFilter(type)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${quickFilter === type ? `border-[#0038A8] bg-[#0038A8]/5 ring-1 ring-[#0038A8]/30` : "border-black/5 bg-white hover:bg-stone-50 shadow-sm"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wider text-stone-400">{label}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg} ${color}`}><Icon size={13} /></div>
              </div>
              <div className="mt-1.5 text-[22px] font-bold text-stone-900">{getCount(type)}</div>
            </button>
          ))}
        </div>

        {/* §T.12 — Filters Bar */}
        {showFilters && (
          <div className="mb-5 rounded-xl border border-black/5 bg-white px-5 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider text-stone-400">FILTERS</span>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]">
                <option value="all">Status</option>
                <option value="new">New</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed_false_alarm">Closed – False Alarm</option>
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]">
                <option value="all">Source</option>
                <option value="resident">Resident</option>
                <option value="purok_leader">Purok Leader</option>
                <option value="tanod">Tanod</option>
                <option value="cctv">CCTV</option>
                <option value="iot">IoT</option>
                <option value="iot_cctv">IoT via CCTV</option>
                <option value="sos">SOS</option>
              </select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]">
                <option value="all">Category</option>
                {INCIDENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]">
                <option value="all">Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select value={filterPurok} onChange={(e) => setFilterPurok(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]">
                <option value="all">Purok</option>
                {PUROK_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]" placeholder="From" />
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]" placeholder="To" />
              {hasActiveFilters && (
                <button onClick={() => { clearFilters(); setQuickFilter(null); }} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50"><X size={11} /> Clear</button>
              )}
            </div>
          </div>
        )}

        {/* §T.13 — Incident Queue */}
        <div className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Incident Queue</h3>
                <p className="text-[11px] text-[#94A3B8]">{filteredIncidents.length} incident{filteredIncidents.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, description, location..."
                  className="w-56 rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-[11px] text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 outline-none focus:border-[#0038A8]">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="priority">Highest Priority</option>
                <option value="sla">SLA Deadline</option>
                <option value="purok">Purok</option>
              </select>
            </div>
          </div>

          <div className="min-h-0">
            {filteredIncidents.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ClipboardList size={24} className="mx-auto text-stone-300" />
                <p className="mt-3 text-[13px] font-medium text-stone-600">No incidents require triage.</p>
                <p className="mt-1 text-[11px] text-stone-400">All incoming reports have been reviewed.</p>
                {hasActiveFilters && (
                  <button onClick={() => { clearFilters(); setQuickFilter(null); }} className="mt-3 text-[11px] font-medium text-[#0038A8] hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              filteredIncidents.map((inc, i) => {
                const sev = SEVERITY_MAP[inc.severity];
                const statusMeta = INCIDENT_STATUS_META[inc.status];
                const sourceMeta = SOURCE_META[inc.source];
                const prioMeta = DESK_PRIORITY_META[inc.priority];
                const SourceIcon = sourceMeta.icon;
                const CatIcon = CATEGORY_ICON[inc.category] || AlertTriangle;
                const catColors = CATEGORY_COLORS[inc.category] || { bg: "bg-stone-100", text: "text-stone-600" };
                const isSOS = inc.source === "sos";
                const breached = isSlaBreached(inc);
                const { elapsed, target } = slaElapsed(inc);
                const remaining = inc.status === "new" && !inc.acknowledgedAt ? Math.max(0, Math.round((target - elapsed) / 60_000)) : null;
                const dupMatches = possibleDuplicateOf(inc, incidents);

                return (
                  <div key={inc.id} className={`px-5 py-3.5 ${i < filteredIncidents.length - 1 ? "border-b border-black/5" : ""} ${breached ? "bg-rose-50/50 ring-1 ring-inset ring-rose-200" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catColors.bg} ${catColors.text}`}>
                        {isSOS && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-rose-500" />}
                        <CatIcon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-bold text-stone-900">{inc.id}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusMeta.badge}`}><span className={`h-1 w-1 rounded-full ${statusMeta.dot}`} />{statusMeta.label}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${prioMeta.chip}`}><span className={`h-1 w-1 rounded-full ${prioMeta.dot}`} />{inc.priority}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sourceMeta.badge}`}><SourceIcon size={9} /> {sourceMeta.label}</span>
                          {dupMatches.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800"><AlertTriangle size={9} /> Possible Duplicate</span>}
                          {breached && <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-semibold text-white"><Timer size={9} /> SLA Breached</span>}
                          {inc.escalatedToCaptain && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700"><ArrowUpRight size={9} /> Escalated</span>}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-stone-500">{inc.description}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                          <MapPin size={9} /> {inc.purok}
                          <span className="mx-0.5">&middot;</span>
                          <Clock size={9} /> {formatTime(inc.time)}
                          {inc.assignedTeam && <><span className="mx-0.5">&middot;</span><UserCheck size={9} /> {inc.assignedTeam}</>}
                        </p>
                      </div>
                      {/* SLA indicator */}
                      <div className="shrink-0 text-right">
                        {breached ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700"><Timer size={9} /> SLA BREACHED</span>
                        ) : remaining !== null ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${remaining <= 3 ? "bg-rose-100 text-rose-700" : remaining <= 10 ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}><Timer size={9} /> {remaining} min remaining</span>
                        ) : inc.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-medium text-sky-700"><Activity size={9} /> Responding</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5 pl-11">
                      <button onClick={() => setSelectedIncidentId(inc.id)} className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50"><Eye size={11} /> Review</button>
                      {inc.status === "new" && (
                        <button onClick={() => advanceIncident(inc)} className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"><CheckCircle2 size={11} /> Acknowledge</button>
                      )}
                      {inc.status === "acknowledged" && (
                        <button onClick={() => beginTriage(inc)} className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"><MessageCircleQuestion size={11} /> Triage</button>
                      )}
                      {inc.status === "in_progress" && (
                        <button onClick={() => advanceIncident(inc)} className="flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"><CheckCircle2 size={11} /> Resolve</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* §T.14 — Incident Detail Drawer */}
      {selectedIncident && <IncidentDetail
        incident={selectedIncident}
        stage={deriveFlowStage(selectedIncident, !!dispatches.find((d) => d.incident === selectedIncident.id))}
        onClose={() => setSelectedIncidentId(null)}
        onAdvance={advanceIncident}
        onAcknowledge={acknowledgeIncident}
        onBeginTriage={beginTriage}
        onCompleteTriage={completeTriage}
        onResolveNoResponse={resolveNoResponse}
        onCloseResolved={closeResolved}
        onSetPriority={setPriority}
        onAddNote={addNote}
        onCloseFalseAlarm={requestCloseFalseAlarm}
        possibleDuplicates={selectedIncident ? possibleDuplicateOf(selectedIncident, incidents) : []}
        onKeepSeparate={keepSeparate}
        onLinkRelated={linkRelated}
        onEscalateToCaptain={(inc) => setEscalateTarget(inc)}
        onAssign={(inc) => setDispatchTarget(inc)}
        onChangeCategory={(inc) => setCategoryChangeTarget(inc)}
        onCctvReview={openCctvReview}
        onNotifyReporter={(inc) => setNotifyTarget(inc)}
        onRequestInfo={(inc) => setRequestInfoTarget(inc)}
        onChangeUrgency={(inc) => setUrgencyTarget(inc)}
        onCreateAlert={(inc) => setCreateAlertTarget(inc)}
        onRefer={(inc) => setReferralTarget(inc)}
        onRequestVideo={(inc) => setVideoRequestTarget(inc)}
        onTimeline={(inc) => setTimelineTarget(inc)}
        dispatchInfo={selectedIncident ? dispatches.find((d) => d.incident === selectedIncident.id) : undefined}
      />}

      {/* §T.15 — Modals */}
      {dispatchTarget && <DispatchModal incident={dispatchTarget} recommendation={recommendDispatch(dispatchTarget)} onClose={() => setDispatchTarget(null)} onConfirm={confirmDispatch} />}
      {escalateTarget && <EscalateToCaptainModal incident={escalateTarget} onClose={() => setEscalateTarget(null)} onConfirm={escalateToCaptain} />}
      {closeTarget && <CloseFalseAlarmModal incident={closeTarget} onClose={() => setCloseTarget(null)} onConfirm={closeFalseAlarm} />}
      {resolveTarget && <ResolutionSummaryModal incident={resolveTarget} onClose={() => setResolveTarget(null)} onResolve={confirmResolve} />}
      {categoryChangeTarget && <CategoryChangeModal incident={categoryChangeTarget} onClose={() => setCategoryChangeTarget(null)} onConfirm={changeCategory} />}
      {cctvTarget && <CctvReviewModal incident={cctvTarget} onClose={() => setCctvTarget(null)} onRequestClip={requestCctvClip} onProvideClip={provideCctvClip} onConfirmReview={confirmCctvReview} onAddNote={addCctvNote} />}
      {timelineTarget && <ViewTimelineModal incident={timelineTarget} onClose={() => setTimelineTarget(null)} />}
      {mapTarget && <ViewMapModal incident={mapTarget} onClose={() => setMapTarget(null)} />}
      {notifyTarget && <NotifyReporterModal incident={notifyTarget} onClose={() => setNotifyTarget(null)} onConfirm={confirmNotifyReporter} />}

      {/* Part 11 — additional case action modals */}
      {requestInfoTarget && <RequestInfoModal incident={requestInfoTarget} onClose={() => setRequestInfoTarget(null)} onConfirm={requestInfo} />}
      {urgencyTarget && <ChangeUrgencyModal incident={urgencyTarget} onClose={() => setUrgencyTarget(null)} onConfirm={changeUrgency} />}
      {createAlertTarget && <CreateAlertModal incident={createAlertTarget} onClose={() => setCreateAlertTarget(null)} onConfirm={createAlert} />}
      {referralTarget && <ReferralModal incident={referralTarget} onClose={() => setReferralTarget(null)} onConfirm={referCase} />}
      {videoRequestTarget && <RequestVideoClipModal incident={videoRequestTarget} onClose={() => setVideoRequestTarget(null)} onConfirm={requestVideo} />}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
