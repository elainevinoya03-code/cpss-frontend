import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Cpu,
  Camera,
  Activity,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
  MapPin,
  Zap,
  Eye,
  Wrench,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  TrendingDown,
  Timer,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  DatabaseBackup,
  CheckCircle2,
  Siren,
  ShieldAlert,
  Lock,
  Video,
  Database,
  Gauge,
  Server,
  Smartphone,
  MessageSquare,
  HardDrive,
  ClipboardList,
  Terminal,
  ServerCog,
  BatteryLow,
  ArrowRight,
  ServerCrash,
  FileText,
} from "lucide-react";
import { batteryColor } from "../utils/colors";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import {
  getCctvStorageConfig,
  subscribeCctvStorage,
} from "../utils/cctvStorage";

const STAT_CARDS = [
  {
    label: "TOTAL ACTIVE USERS",
    value: "6",
    sub: "7 total accounts",
    icon: Users,
    page: "users",
    title: "Open User Management",
  },
  {
    label: "DEPLOYED IOT DEVICES",
    value: "7",
    sub: "4 online · 1 warning · 1 offline · 1 possible tamper",
    icon: Cpu,
    page: "iot",
    title: "Open IoT Provisioning",
  },
  {
    label: "CAMERA AVAILABILITY",
    value: "12",
    sub: "10 online · 1 offline · 1 pending",
    icon: Camera,
    page: "cctv",
    title: "Open CCTV Placement",
  },
  {
    label: "SYSTEM UPTIME",
    value: "99.2%",
    sub: "Last 30 days average",
    icon: Activity,
    page: "settings",
    title: "Open System Settings",
  },
];

const API_CARDS = [
  {
    label: "API REQUESTS (24H)",
    value: "48.2k",
    sub: "▲ 12% vs. yesterday",
    icon: Server,
    page: "logs",
    title: "Open Audit Logs",
  },
  {
    label: "AVG API RESPONSE",
    value: "184ms",
    sub: "p95 410ms · target ≤ 500ms",
    icon: Timer,
    page: "settings",
    title: "Open System Settings",
  },
  {
    label: "API ERROR RATE",
    value: "0.42%",
    sub: "Threshold 1% · on target",
    icon: Gauge,
    page: "logs",
    title: "Open Audit Logs",
  },
];

const SEVERITY_META = {
  critical: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
    label: "Critical",
  },
  high: {
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    dot: "bg-orange-500",
    label: "High",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-400",
    label: "Warning",
  },
  informational: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-400",
    label: "Informational",
  },
} as const;

const SEVERITY_ORDER = ["critical", "high", "warning", "informational"] as const;

const BANNER_TONES = {
  critical: {
    border: "border-rose-200",
    hover: "hover:bg-rose-50/40",
    chip: "bg-rose-100 text-rose-600",
    text: "text-rose-800",
    sub: "text-rose-500",
    icon: "text-rose-400",
    divider: "border-rose-100",
  },
  high: {
    border: "border-orange-200",
    hover: "hover:bg-orange-50/40",
    chip: "bg-orange-100 text-orange-600",
    text: "text-orange-800",
    sub: "text-orange-500",
    icon: "text-orange-400",
    divider: "border-orange-100",
  },
  warning: {
    border: "border-amber-200",
    hover: "hover:bg-amber-50/40",
    chip: "bg-amber-100 text-amber-600",
    text: "text-amber-800",
    sub: "text-amber-500",
    icon: "text-amber-400",
    divider: "border-amber-100",
  },
  informational: {
    border: "border-sky-200",
    hover: "hover:bg-sky-50/40",
    chip: "bg-sky-100 text-sky-600",
    text: "text-sky-800",
    sub: "text-sky-500",
    icon: "text-sky-400",
    divider: "border-sky-100",
  },
} as const;

const SCOPE_LABELS: Record<string, string> = {
  iot: "IoT Device",
  ops: "Operational",
  security: "Security",
  cctv: "CCTV",
  provider: "Notification Provider",
};

type AlertSeverity = keyof typeof SEVERITY_META;
type AlertScope = keyof typeof SCOPE_LABELS;

interface AlertItem {
  id: string;
  title: string;
  device?: string;
  reason: string;
  type: string;
  severity: AlertSeverity;
  scope: AlertScope;
  escalation: string;
  time: string;
  ip?: string;
}

const ALERTS: AlertItem[] = [
  {
    id: "a1",
    title: "SM-PUROK3-01 — Smoke Sensor Offline",
    device: "SM-PUROK3-01",
    reason: "Device offline — no heartbeat for 3 hours",
    type: "offline",
    severity: "critical",
    scope: "iot",
    escalation: "Field Tech — Team A",
    time: "2026-07-20 09:32",
  },
  {
    id: "a2",
    title: "DB-HALL-01 — Low Battery",
    device: "DB-HALL-01",
    reason: "Battery critically low at 21% — replacement required",
    type: "low_battery",
    severity: "warning",
    scope: "iot",
    escalation: "IoT Maintenance Unit",
    time: "2026-07-20 10:05",
  },
  {
    id: "a3",
    title: "Failed SOS Notification — SOS-043",
    reason:
      "SOS-043 (Purok 3 — Market Zone) — push and SMS delivery failed after 3 retries; must route to Desk Officer → Captain",
    type: "sos_failed",
    severity: "critical",
    scope: "ops",
    escalation: "Desk Officer → Captain",
    time: "2026-07-20 10:12",
  },
  {
    id: "a4",
    title: "SM-KIOSK-01 — Possible Tamper",
    device: "SM-KIOSK-01",
    reason:
      "Enclosure tamper switch triggered — device still transmitting; verify field condition",
    type: "tamper",
    severity: "high",
    scope: "iot",
    escalation: "Admin",
    time: "2026-07-20 09:58",
  },
  {
    id: "a5",
    title: "Repeated Failed Logins — desk_officer account",
    reason:
      "3 consecutive failed login attempts within 5 minutes on a privileged account",
    type: "failed_login",
    severity: "high",
    scope: "security",
    escalation: "Admin",
    time: "2026-07-20 10:01",
    ip: "192.168.4.22",
  },
  {
    id: "a6",
    title: "CAM-MARKET-03 — Camera Offline",
    device: "CAM-MARKET-03",
    reason: "No stream for 20 minutes — live feed unavailable",
    type: "camera_offline",
    severity: "high",
    scope: "cctv",
    escalation: "CCTV Operator → Admin",
    time: "2026-07-20 09:51",
  },
  {
    id: "a7",
    title: "SMS Rate Limit Approaching",
    reason:
      "SMS gateway at 80% of the 60 msg/min cap — 48 sent this minute",
    type: "sms_ratelimit",
    severity: "informational",
    scope: "provider",
    escalation: "None",
    time: "2026-07-20 10:08",
  },
  {
    id: "a8",
    title: "Authentication Service Failure",
    reason:
      "Auth service returning 503 — sign-in and token refresh degraded for all roles",
    type: "auth_failure",
    severity: "critical",
    scope: "ops",
    escalation: "Admin",
    time: "2026-07-20 10:14",
  },
  {
    id: "a9",
    title: "Audit Log Failure",
    reason:
      "Audit-trail writer stalled for 3 minutes — entries buffered for retry; trail integrity at risk",
    type: "audit_failure",
    severity: "critical",
    scope: "ops",
    escalation: "Admin",
    time: "2026-07-20 10:11",
  },
];

const ALERT_ICONS: Record<string, LucideIcon> = {
  offline: WifiOff,
  low_battery: BatteryLow,
  tamper: ShieldAlert,
  sos_failed: Siren,
  failed_login: Lock,
  camera_offline: Video,
  sms_ratelimit: MessageSquare,
  auth_failure: ServerCrash,
  audit_failure: FileText,
};

const DEVICES = [
  {
    name: "SM-GATE-01",
    type: "Smoke Sensor",
    status: "online",
    battery: 87,
    uptime: "99.8%",
    lastPing: "2 mins ago",
    lat: "14.5995",
    lng: "120.9842",
  },
  {
    name: "SM-PLAZA-02",
    type: "Smoke Sensor",
    status: "online",
    battery: 54,
    uptime: "97.2%",
    lastPing: "4 mins ago",
    lat: "14.6001",
    lng: "120.9835",
  },
  {
    name: "DB-HALL-01",
    type: "Decibel Meter",
    status: "warning",
    battery: 21,
    uptime: "91.5%",
    lastPing: "12 mins ago",
    lat: "14.5989",
    lng: "120.9851",
  },
  {
    name: "SM-KIOSK-01",
    type: "Smoke Sensor",
    status: "tamper",
    battery: 61,
    uptime: "95.1%",
    lastPing: "8 mins ago",
    lat: "14.5983",
    lng: "120.9833",
  },
  {
    name: "SM-PUROK3-01",
    type: "Smoke Sensor",
    status: "offline",
    battery: 8,
    uptime: "78.3%",
    lastPing: "3 hrs ago",
    lat: "14.5977",
    lng: "120.9820",
  },
  {
    name: "DB-MARKET-01",
    type: "Decibel Meter",
    status: "online",
    battery: 73,
    uptime: "99.1%",
    lastPing: "1 min ago",
    lat: "14.6010",
    lng: "120.9860",
  },
  {
    name: "SM-CHAPEL-01",
    type: "Smoke Sensor",
    status: "online",
    battery: 92,
    uptime: "99.9%",
    lastPing: "3 mins ago",
    lat: "14.5965",
    lng: "120.9845",
  },
];

const AUDIT_LOGS = [
  { id: 1, time: "2026-07-20 10:05", event: "DB-HALL-01 triggered low-battery warning", type: "alert" },
  { id: 2, time: "2026-07-20 09:32", event: "SM-PUROK3-01 went offline — no heartbeat", type: "error" },
  { id: 3, time: "2026-07-20 08:45", event: "Admin updated smoke threshold to 500 ppm", type: "config" },
  { id: 4, time: "2026-07-20 08:14", event: "Admin Hello World logged in", type: "login" },
  { id: 5, time: "2026-07-20 07:55", event: "Desk Officer Hello World logged in", type: "login" },
];

const SYSTEM_ERRORS = [
  {
    id: 1,
    time: "2026-07-20 10:12",
    source: "notification-worker",
    message: "Push delivery timeout for 4 messages — retry queued",
    level: "error",
  },
  {
    id: 2,
    time: "2026-07-20 09:55",
    source: "api-gateway",
    message: "5xx spike (0.9%) over a 5-minute window",
    level: "warning",
  },
  {
    id: 3,
    time: "2026-07-20 09:51",
    source: "camera-stream",
    message: "CAM-MARKET-03 stream interrupted — reconnect initiated",
    level: "error",
  },
  {
    id: 4,
    time: "2026-07-20 10:14",
    source: "auth-service",
    message: "Auth service 503 — sign-in and token refresh degraded",
    level: "error",
  },
  {
    id: 5,
    time: "2026-07-20 10:11",
    source: "audit-writer",
    message: "Audit log write queue stalled — buffering entries for retry",
    level: "error",
  },
  {
    id: 6,
    time: "2026-07-20 02:00",
    source: "retention-worker",
    message: "Telemetry purge batch complete — 2 records skipped (legal hold)",
    level: "info",
  },
];

const ERROR_LEVEL_DOT = {
  error: "bg-rose-500",
  warning: "bg-amber-400",
  info: "bg-sky-400",
} as const;

const TICKETS = [
  {
    id: "MT-1042",
    device: "SM-PUROK3-01",
    type: "Offline / Reconnect",
    priority: "critical",
    team: "Field Tech — Team A",
    opened: "2026-07-20 09:32",
  },
  {
    id: "MT-1043",
    device: "DB-HALL-01",
    type: "Battery Replacement",
    priority: "urgent",
    team: "IoT Maintenance Unit",
    opened: "2026-07-20 10:05",
  },
  {
    id: "MT-1044",
    device: "SM-KIOSK-01",
    type: "Hardware Inspection",
    priority: "urgent",
    team: "Barangay Facilities",
    opened: "2026-07-20 09:58",
  },
];

const TICKET_PRIORITY = {
  critical: "bg-rose-100 text-rose-700",
  urgent: "bg-amber-100 text-amber-700",
  routine: "bg-sky-100 text-sky-700",
} as const;

const CAMERAS = [
  { id: "CAM-GATE-01", name: "Main Gate", purok: "Purok 1", status: "online", lat: "14.5998", lng: "120.9839", lastSeen: "now" },
  { id: "CAM-CHAPEL-02", name: "Chapel Plaza", purok: "Purok 2", status: "online", lat: "14.5981", lng: "120.9847", lastSeen: "now" },
  { id: "CAM-MARKET-03", name: "Market Row", purok: "Purok 3", status: "offline", lat: "14.6004", lng: "120.9858", lastSeen: "20 mins ago" },
  { id: "CAM-SCHOOL-04", name: "School District", purok: "Purok 4", status: "online", lat: "14.5969", lng: "120.9831", lastSeen: "now" },
  { id: "CAM-PLAZA-01", name: "Town Plaza", purok: "Purok 1", status: "online", lat: "14.5992", lng: "120.9840", lastSeen: "now" },
  { id: "CAM-RIVER-05", name: "Riverside", purok: "Purok 1", status: "online", lat: "14.5958", lng: "120.9817", lastSeen: "1 min ago" },
  { id: "CAM-MARKET-07", name: "Market Annex", purok: "Purok 3", status: "online", lat: "14.6008", lng: "120.9862", lastSeen: "now" },
  { id: "CAM-HEALTH-08", name: "Health Center", purok: "Purok 2", status: "online", lat: "14.5974", lng: "120.9850", lastSeen: "now" },
  { id: "CAM-GYM-09", name: "Covered Court", purok: "Purok 4", status: "online", lat: "14.5970", lng: "120.9836", lastSeen: "2 mins ago" },
  { id: "CAM-SOS-10", name: "SOS Kiosk", purok: "Purok 3", status: "online", lat: "14.6006", lng: "120.9856", lastSeen: "now" },
  { id: "CAM-BRIDGE-11", name: "Bridge Approach", purok: "Purok 1", status: "online", lat: "14.5962", lng: "120.9812", lastSeen: "1 min ago" },
  { id: "CAM-EVAC-06", name: "Evacuation Zone Alpha", purok: "Evac Zone", status: "pending", lat: "14.5955", lng: "120.9824", lastSeen: "pending" },
];

const CAMERA_STATUS = {
  online: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", label: "Online" },
  offline: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-600", label: "Offline" },
  pending: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700", label: "Pending" },
} as const;

const STATUS_STYLES = {
  online: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    icon: Wifi,
    label: "Online",
  },
  warning: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
    icon: AlertTriangle,
    label: "Warning",
  },
  offline: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-600",
    icon: WifiOff,
    label: "Offline",
  },
  tamper: {
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700",
    icon: ShieldAlert,
    label: "Possible Tamper",
  },
} as const;

const BACKUP_STATUS = {
  healthy: { badge: "bg-emerald-50 text-emerald-600", label: "Healthy" },
  overdue: { badge: "bg-amber-50 text-amber-700", label: "Overdue" },
  failed: { badge: "bg-rose-50 text-rose-600", label: "Failed" },
} as const;

const LOG_DOT = {
  alert: "bg-amber-400",
  error: "bg-rose-500",
  config: "bg-blue-400",
  login: "bg-emerald-400",
} as const;

const DB_HEALTH = {
  status: "connected",
  label: "Connected",
  active: 7,
  max: 50,
  poolPct: 42,
  latencyMs: 12,
};

const BG_JOBS = [
  { name: "SLA Monitoring", status: "running", lastRun: "10:02" },
  { name: "Notification Dispatch", status: "running", lastRun: "10:03" },
  { name: "Retention Processing", status: "healthy", lastRun: "02:00" },
  { name: "Backup Verification", status: "healthy", lastRun: "02:30" },
];

const JOB_STATUS = {
  running: { badge: "bg-sky-50 text-sky-700", dot: "bg-sky-500", label: "Running" },
  healthy: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Healthy" },
  degraded: { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-400", label: "Degraded" },
} as const;

const PROVIDERS = [
  {
    name: "SMS Gateway",
    provider: "Twilio",
    status: "operational",
    queue: 0,
    failures: 0,
    last: "10:04",
    icon: MessageSquare,
  },
  {
    name: "Push Notifications",
    provider: "FCM / Web Push",
    status: "degraded",
    queue: 23,
    failures: 4,
    last: "10:01",
    icon: Smartphone,
  },
];

const PROVIDER_STATUS = {
  operational: { badge: "bg-emerald-50 text-emerald-700", label: "Operational" },
  degraded: { badge: "bg-amber-50 text-amber-700", label: "Degraded" },
  down: { badge: "bg-rose-50 text-rose-600", label: "Down" },
} as const;

const DISPATCH_TYPES = [
  "Battery Replacement",
  "Offline / Reconnect",
  "Sensor Calibration",
  "Hardware Inspection",
  "Firmware Update",
  "Other",
];

const DISPATCH_PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "critical", label: "Critical" },
];

const DISPATCH_TEAMS = [
  "Field Tech — Team A",
  "Field Tech — Team B",
  "IoT Maintenance Unit",
  "Barangay Facilities",
  "External Contractor",
];

const FIELD_STYLE =
  "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/15";

const PICK_STYLE = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
    active
      ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]"
      : "border-stone-200 text-stone-600 hover:bg-stone-50"
  }`;

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [pinging, setPinging] = useState<string | null>(null);
  const [logsModalDevice, setLogsModalDevice] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [dispatchDevice, setDispatchDevice] = useState<string | null>(null);
  const [dispatchType, setDispatchType] = useState(DISPATCH_TYPES[0]);
  const [dispatchPriority, setDispatchPriority] = useState("routine");
  const [dispatchTeam, setDispatchTeam] = useState(DISPATCH_TEAMS[0]);
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [alertDetail, setAlertDetail] = useState<AlertItem | null>(null);
  const [resolvedTickets, setResolvedTickets] = useState<string[]>([]);
  const [storage, setStorage] = useState(getCctvStorageConfig());

  useEffect(() => subscribeCctvStorage(() => setStorage(getCctvStorageConfig())), []);

  const cameraCounts = {
    online: CAMERAS.filter((c) => c.status === "online").length,
    offline: CAMERAS.filter((c) => c.status === "offline").length,
    pending: CAMERAS.filter((c) => c.status === "pending").length,
  };

  const severityCounts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: ALERTS.filter((a) => a.severity === severity).length,
  })).filter((c) => c.count > 0);

  const alertsSub = severityCounts
    .map((c) => `${c.count} ${SEVERITY_META[c.severity].label.toLowerCase()}`)
    .join(" · ");

  const bannerTone = BANNER_TONES[
    (["critical", "high", "warning", "informational"] as const).find((s) =>
      ALERTS.some((a) => a.severity === s)
    ) ?? "informational"
  ];

  const volumes = [
    { label: "CCTV Clip Footage", used: storage.usedGb, total: storage.totalGb },
    { label: "IoT Telemetry", used: 320, total: 500 },
    { label: "Audit Trail", used: 18, total: 50 },
    { label: "Incident & Evidence", used: 42, total: 200 },
  ];
  const storageUsed = volumes.reduce((sum, v) => sum + v.used, 0);
  const storageTotal = volumes.reduce((sum, v) => sum + v.total, 0);
  const storagePct = Math.round((storageUsed / storageTotal) * 100);
  const storageWarning = storagePct >= storage.warnThresholdPct;

  function pingDevice(name: string) {
    setPinging(name);
    setTimeout(() => {
      setPinging(null);
      setModalMessage({ title: "Ping Complete", message: `${name} — respond${name === "SM-PUROK3-01" ? "ed with 240ms latency" : "ing normally"}` });
    }, 1500);
  }

  function openDispatch(name: string) {
    setDispatchDevice(name);
    setDispatchType(DISPATCH_TYPES[0]);
    setDispatchPriority("routine");
    setDispatchTeam(DISPATCH_TEAMS[0]);
    setDispatchNotes("");
  }

  function submitDispatch() {
    if (!dispatchDevice) return;
    const device = dispatchDevice;
    const priorityLabel = DISPATCH_PRIORITIES.find((p) => p.value === dispatchPriority)?.label ?? dispatchPriority;
    setDispatchDevice(null);
    pushAuditLog(
      "Dispatch Created",
      `Dispatched ${dispatchType} for ${device} (${priorityLabel}) to ${dispatchTeam}${dispatchNotes ? ` — ${dispatchNotes}` : ""}`
    );
    setModalMessage({
      title: "Dispatch Confirmed",
      message: `${device} maintenance requested — ${dispatchType} assigned to ${dispatchTeam} (${priorityLabel} priority).`,
    });
  }

  function viewLogs(name: string) {
    setLogsModalDevice(name);
  }

  function resolveTicket(ticket: (typeof TICKETS)[number]) {
    setResolvedTickets((prev) => [...prev, ticket.id]);
    pushAuditLog("Maintenance Resolved", `Resolved ${ticket.type} for ${ticket.device} (${ticket.id})`);
    setModalMessage({
      title: "Ticket Resolved",
      message: `${ticket.device} — ${ticket.type} marked resolved. ${ticket.team} notified.`,
    });
  }

  const openTickets = TICKETS.filter((t) => !resolvedTickets.includes(t.id));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-stone-500">
            System health and real-time device monitoring
          </p>
        </header>

        {/* Active Alerts banner — four severity levels, operational + IoT alerts, escalation routing */}
        {ALERTS.length > 0 && (
          <div className={`mb-6 overflow-hidden rounded-xl border bg-white shadow-sm ${bannerTone.border}`}>
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className={`flex w-full items-center justify-between px-5 py-3.5 transition ${bannerTone.hover}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bannerTone.chip}`}>
                  <AlertTriangle size={16} />
                </div>
                <div className="text-left">
                  <p className={`text-[13px] font-semibold ${bannerTone.text}`}>
                    {ALERTS.length} Active Alert{ALERTS.length !== 1 ? "s" : ""} Require Attention
                  </p>
                  <p className={`text-[11px] ${bannerTone.sub}`}>{alertsSub}</p>
                </div>
              </div>
              {showAlerts ? (
                <ChevronUp size={16} className={bannerTone.icon} />
              ) : (
                <ChevronDown size={16} className={bannerTone.icon} />
              )}
            </button>

            {showAlerts && (
              <div className={`border-t px-5 py-4 ${bannerTone.divider}`}>
                <div className="space-y-3">
                  {ALERTS.map((alert) => {
                    const Icon = ALERT_ICONS[alert.type] ?? AlertTriangle;
                    const sev = SEVERITY_META[alert.severity];
                    return (
                      <div
                        key={alert.id}
                        className={`flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3 text-sm ${sev.badge}`}
                      >
                        <Icon size={16} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{alert.title}</p>
                            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              {sev.label}
                            </span>
                            <span
                              className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium opacity-80"
                              title="Escalation routing per §14.12"
                            >
                              <ArrowUpRight size={10} />
                              {alert.escalation}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs opacity-80">{alert.reason}</p>
                          <p className="mt-1 text-[11px] opacity-60">{alert.time}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {alert.scope === "iot" ? (
                            <>
                              <button
                                onClick={() => alert.device && pingDevice(alert.device)}
                                className="rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium opacity-70 transition hover:opacity-100"
                              >
                                Ping
                              </button>
                              <button
                                onClick={() => alert.device && openDispatch(alert.device)}
                                className="rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium opacity-70 transition hover:opacity-100"
                              >
                                Dispatch
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setAlertDetail(alert)}
                              className="flex items-center gap-1 rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium opacity-70 transition hover:opacity-100"
                            >
                              Details
                              <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPI stat cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map(({ label, value, sub, icon: Icon, page, title }) => (
            <div
              key={label}
              onClick={() => onNavigate && page && onNavigate(page)}
              title={title}
              className={`group rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm ${
                onNavigate && page
                  ? "cursor-pointer transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  {label}
                </span>
                <div className="flex items-center gap-1.5">
                  {onNavigate && page && (
                    <ArrowUpRight size={12} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
                  )}
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                    <Icon size={15} />
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        {/* Alerts + API metrics (14.4) */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            onClick={() => setShowAlerts(!showAlerts)}
            title="Expand / collapse active alerts"
            className="group cursor-pointer rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm transition hover:border-rose-200 hover:bg-rose-50/30"
          >
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                ACTIVE ALERTS
              </span>
              <div className="flex items-center gap-1.5">
                <ArrowUpRight size={12} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle size={15} />
                </div>
              </div>
            </div>
            <div className="mt-2 text-[26px] font-bold text-rose-600">{ALERTS.length}</div>
            <div className="mt-1 text-[11px] text-[#94A3B8]">{alertsSub}</div>
          </div>
          {API_CARDS.map(({ label, value, sub, icon: Icon, page, title }) => (
            <div
              key={label}
              onClick={() => onNavigate && page && onNavigate(page)}
              title={title}
              className={`group rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm ${
                onNavigate && page
                  ? "cursor-pointer transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  {label}
                </span>
                <div className="flex items-center gap-1.5">
                  {onNavigate && page && (
                    <ArrowUpRight size={12} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
                  )}
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                    <Icon size={15} />
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        {/* System Health & Infrastructure — DB, background jobs, storage, providers */}
        <div className="mb-6 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0038A8]/10 text-[#0038A8]">
                <ServerCog size={17} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">
                  System Health & Infrastructure
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Database, background jobs, storage, and notification providers
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate("settings")}
                className="text-[11px] font-medium text-[#0038A8] hover:underline"
              >
                Open System Settings
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
            {/* Database connection health */}
            <div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  <Database size={11} />
                  DATABASE CONNECTION
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {DB_HEALTH.label}
                </span>
              </div>
              <p className="mt-2 text-[13px] font-semibold text-[#334155]">
                Connection pool at {DB_HEALTH.poolPct}% capacity
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${DB_HEALTH.poolPct >= 80 ? "bg-amber-400" : "bg-[#0038A8]"}`}
                    style={{ width: `${DB_HEALTH.poolPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-stone-400">{DB_HEALTH.poolPct}%</span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                {DB_HEALTH.active} / {DB_HEALTH.max} active connections ·{" "}
                {DB_HEALTH.latencyMs}ms latency
              </p>
            </div>

            {/* Background jobs (14.10) */}
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                <Activity size={11} />
                BACKGROUND JOBS
              </p>
              <div className="mt-2 space-y-2.5">
                {BG_JOBS.map((job) => {
                  const st = JOB_STATUS[job.status as keyof typeof JOB_STATUS];
                  return (
                    <div key={job.name} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-[#334155]">{job.name}</p>
                        <p className="text-[10px] text-[#94A3B8]">Last run {job.lastRun}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${job.status === "running" ? "animate-pulse" : ""}`} />
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Object storage utilization */}
            <div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  <HardDrive size={11} />
                  OBJECT STORAGE
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    storageWarning
                      ? "bg-rose-50 text-rose-600"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${storageWarning ? "bg-rose-500" : "bg-emerald-500"}`} />
                  {storageWarning ? "Capacity warning" : "Within threshold"}
                </span>
              </div>
              <p className="mt-2 text-[13px] font-semibold text-[#334155]">
                {storageUsed.toLocaleString()} GB of {storageTotal.toLocaleString()} GB used
              </p>
              <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full ${storageWarning ? "bg-rose-500" : "bg-[#0038A8]"}`}
                  style={{ width: `${storagePct}%` }}
                />
                <div
                  className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-amber-500"
                  style={{ left: `${storage.warnThresholdPct}%` }}
                  title={`Warning threshold ${storage.warnThresholdPct}%`}
                />
              </div>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                {storagePct}% used · warning at {storage.warnThresholdPct}%
              </p>
              <div className="mt-2 space-y-1">
                {volumes.map((v) => (
                  <div key={v.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-500">{v.label}</span>
                    <span className="font-medium text-[#334155]">
                      {v.used.toLocaleString()} / {v.total.toLocaleString()} GB
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification providers (14.9) */}
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                <MessageSquare size={11} />
                NOTIFICATION PROVIDERS
              </p>
              <div className="mt-2 space-y-3">
                {PROVIDERS.map((p) => {
                  const st = PROVIDER_STATUS[p.status as keyof typeof PROVIDER_STATUS];
                  return (
                    <div key={p.name} className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p.icon size={13} className="shrink-0 text-[#0038A8]" />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-[#334155]">{p.name}</p>
                            <p className="text-[10px] text-[#94A3B8]">{p.provider}</p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.badge}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#64748B]">
                        Queue {p.queue} · {p.failures} failed (24h) · last send {p.last}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Public safety metrics */}
        <div className="mb-6 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0038A8]/10 text-[#0038A8]">
                <BarChart3 size={17} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">
                  Public Safety Metrics
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Incident rate and response performance — system health summary
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500">
                July 2026
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-stone-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  <TrendingDown size={11} />
                  INCIDENT RATE
                </p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <ArrowDownRight size={11} />
                  8.2%
                </span>
              </div>
              <div className="mt-2 flex items-end gap-1.5">
                <span className="text-[26px] font-bold tracking-tight text-[#0038A8]">12.4</span>
                <span className="pb-1 text-[11px] text-[#94A3B8]">per 1,000 residents</span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                <span className="font-medium text-emerald-600">Down</span> vs. last month
              </p>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  <Timer size={11} />
                  AVG RESPONSE TIME
                </p>
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    8.3 <= 10
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Shield size={11} />
                  On Target
                </span>
              </div>
              <div className="mt-2 flex items-end gap-1.5">
                <span className="text-[26px] font-bold tracking-tight text-[#0038A8]">8.3</span>
                <span className="pb-1 text-[11px] text-[#94A3B8]">min · target ≤ 10</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-[#0038A8]" style={{ width: "83%" }} />
                </div>
                <span className="text-[10px] font-medium text-stone-400">83%</span>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  <Shield size={11} />
                  INCIDENTS RESOLVED
                </p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <ArrowUpRight size={11} />
                  96.8%
                </span>
              </div>
              <div className="mt-2 flex items-end gap-1.5">
                <span className="text-[26px] font-bold tracking-tight text-[#0038A8]">96.8</span>
                <span className="pb-1 text-[11px] text-[#94A3B8]">% closed this month</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: "96.8%" }} />
                </div>
                <span className="text-[10px] font-medium text-stone-400">96.8%</span>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-100 px-5 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-stone-500">
                Incidents by day — last 7 days
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                  <span className="h-2 w-2 rounded-sm bg-[#0038A8]" />
                  Incidents
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                  <span className="w-3 border-t border-dashed border-[#94A3B8]" />
                  Daily avg 4.4
                </span>
              </div>
            </div>

            <div className="relative h-24">
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-[#0038A8]/25"
                style={{ bottom: `${(4.4 / 7) * 100}%` }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-stone-200" />
              <div className="relative flex h-full items-end gap-2">
                {[
                  { label: "Mon", v: 5 },
                  { label: "Tue", v: 3 },
                  { label: "Wed", v: 7 },
                  { label: "Thu", v: 4 },
                  { label: "Fri", v: 6 },
                  { label: "Sat", v: 4 },
                  { label: "Sun", v: 2 },
                ].map((d) => (
                  <div key={d.label} className="group relative h-full flex-1">
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[9px] font-semibold text-[#94A3B8] transition group-hover:text-[#334155]"
                      style={{ bottom: `calc(${(d.v / 7) * 100}% + 4px)` }}
                    >
                      {d.v}
                    </span>
                    <div
                      className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-[26px] rounded-t-md transition-all group-hover:brightness-110 ${
                        d.v >= 7
                          ? "bg-gradient-to-t from-rose-600 to-rose-400"
                          : d.v >= 5
                            ? "bg-gradient-to-t from-amber-500 to-amber-300"
                            : "bg-gradient-to-t from-[#0038A8] to-[#3b6bd6]"
                      }`}
                      style={{ height: `${(d.v / 7) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 flex gap-2">
              {[
                { label: "Mon" },
                { label: "Tue" },
                { label: "Wed" },
                { label: "Thu" },
                { label: "Fri" },
                { label: "Sat" },
                { label: "Sun" },
              ].map((d) => (
                <span key={d.label} className="flex-1 text-center text-[9px] font-medium text-stone-400">
                  {d.label}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-[11px] text-stone-500">
                <span className="font-semibold text-stone-700">31</span> incidents · peak{" "}
                <span className="font-semibold text-amber-600">Wed</span>
              </p>
              <p className="text-[11px] text-stone-400">avg 4.4 / day</p>
            </div>
          </div>

          <div className="border-t border-stone-100 px-5 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
                <DatabaseBackup size={13} className="text-[#0038A8]" />
                BACKUP & DISASTER RECOVERY
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BACKUP_STATUS.healthy.badge}`}
              >
                <CheckCircle2 size={11} />
                {BACKUP_STATUS.healthy.label}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  LAST SUCCESSFUL BACKUP
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#334155]">2026-07-20 02:00</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Nightly full backup · all data categories · verified on completion
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  LAST RESTORATION TEST
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#334155]">2026-06-28 · Success</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Restore verified end-to-end — next monthly test due late July 2026
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">COVERAGE</p>
                <p className="mt-1 text-[13px] font-semibold text-[#334155]">
                  All retention categories
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  User directory, IoT/CCTV config, audit trail, and incident & evidence records subject
                  to retention
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* IoT table + CCTV fleet */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Device Table */}
          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    IoT System Health Monitor
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Real-time status of all deployed hardware nodes
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("settings")}
                    className="flex items-center gap-1 rounded-lg border border-black/10 px-3 py-1.5 text-[12px] font-medium text-[#0038A8] transition hover:bg-[#E9EDFB]"
                    title="Adjust sensor thresholds in System Settings"
                  >
                    <Zap size={13} />
                    Thresholds
                  </button>
                )}
                <button className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-[12px] font-medium text-[#334155] hover:bg-[#E9EDFB]">
                  <RefreshCw size={13} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse">
                <thead>
                  <tr className="border-y border-black/5 text-left">
                    {[
                      "DEVICE NAME",
                      "TYPE",
                      "STATUS",
                      "BATTERY",
                      "UPTIME",
                      "LAST PING",
                      "COORDINATES",
                      "ACTIONS",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[10px] font-semibold tracking-wider text-[#94A3B8]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEVICES.map((d) => {
                    const s = STATUS_STYLES[d.status as keyof typeof STATUS_STYLES];
                    return (
                      <tr
                        key={d.name}
                        className="border-b border-black/5 last:border-0 hover:bg-[#F8FAFC]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                            <span className="text-[12px] font-semibold text-[#334155]">
                              {d.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#64748B]">{d.type}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.badge}`}
                          >
                            <s.icon size={11} />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-8 rounded-sm border border-black/10 p-[1.5px]">
                              <div
                                className={`h-full rounded-[1px] ${batteryColor(d.battery)}`}
                                style={{ width: `${d.battery}%` }}
                              />
                            </div>
                            <span className="text-[12px] text-[#334155]">{d.battery}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-medium text-emerald-600">
                          {d.uptime}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#64748B]">{d.lastPing}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onNavigate && onNavigate("boundaries")}
                            className="group flex items-center gap-1 text-[12px] text-[#0038A8] transition hover:text-[#002A8C]"
                            title="View on Digital Boundaries map"
                          >
                            <MapPin size={12} className="opacity-60 group-hover:opacity-100" />
                            <span className="font-mono text-[11px]">
                              {d.lat}, {d.lng}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => pingDevice(d.name)}
                              disabled={pinging === d.name}
                              title="Ping / Force Reconnect"
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                            >
                              {pinging === d.name ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-[#0038A8]" />
                              ) : (
                                <Zap size={11} />
                              )}
                              Ping
                            </button>
                            <button
                              onClick={() => viewLogs(d.name)}
                              title="View telemetry logs"
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Eye size={11} />
                              Logs
                            </button>
                            <button
                              onClick={() => openDispatch(d.name)}
                              title="Dispatch field maintenance"
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Wrench size={11} />
                              Report
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CCTV Fleet Availability */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    CCTV Fleet Availability
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    {CAMERAS.length} placed · {cameraCounts.online} online ·{" "}
                    {cameraCounts.offline} offline · {cameraCounts.pending} pending
                  </p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("cctv")}
                  className="text-[11px] font-medium text-[#0038A8] hover:underline"
                >
                  Manage
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {CAMERAS.map((c, i) => {
                const st = CAMERA_STATUS[c.status as keyof typeof CAMERA_STATUS];
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 px-5 py-2.5 ${
                      i < CAMERAS.length - 1 ? "border-b border-black/5" : ""
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[#334155]">{c.id}</p>
                      <p className="truncate text-[10px] text-[#94A3B8]">
                        {c.name} · {c.purok}
                      </p>
                    </div>
                    <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${st.badge}`}>
                      {st.label}
                    </span>
                    <span className="hidden w-24 text-right text-[10px] text-[#94A3B8] lg:block">
                      {c.lastSeen}
                    </span>
                    <button
                      onClick={() => onNavigate && onNavigate("boundaries")}
                      title="View on Digital Boundaries map"
                      className="text-[#0038A8] opacity-60 transition hover:opacity-100"
                    >
                      <MapPin size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-stone-100 px-5 py-3">
              <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <ArrowUpRight size={11} className="text-[#0038A8]" />
                Offline cameras route to CCTV Operator → Admin (§14.12)
              </p>
            </div>
          </div>
        </div>

        {/* System errors, maintenance tickets, audit logs */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* System Errors */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">System Errors</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Infrastructure faults, distinct from user-audit events
                  </p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("logs")}
                  className="text-[11px] font-medium text-[#0038A8] hover:underline"
                >
                  View All
                </button>
              )}
            </div>

            <div>
              {SYSTEM_ERRORS.map((e, i) => (
                <div
                  key={e.id}
                  className={`flex items-start gap-3 px-5 py-3 ${
                    i < SYSTEM_ERRORS.length - 1 ? "border-b border-black/5" : ""
                  }`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ERROR_LEVEL_DOT[e.level as keyof typeof ERROR_LEVEL_DOT]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug text-[#334155]">{e.message}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#94A3B8]">
                      <Clock size={10} />
                      <span className="font-mono">{e.source}</span> · {e.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Maintenance Tickets */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    Open Maintenance Tickets
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Aggregated field maintenance queue
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0038A8]">
                {openTickets.length} open
              </span>
            </div>

            <div>
              {openTickets.map((t, i) => (
                <div
                  key={t.id}
                  className={`px-5 py-3 ${i < openTickets.length - 1 ? "border-b border-black/5" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[#334155]">{t.device}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TICKET_PRIORITY[t.priority as keyof typeof TICKET_PRIORITY]}`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">{t.type}</p>
                  <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                    {t.team} · opened {t.opened}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => openDispatch(t.device)}
                      className="flex h-6 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      <ArrowRight size={10} />
                      Update
                    </button>
                    <button
                      onClick={() => resolveTicket(t)}
                      className="flex h-6 items-center gap-1 rounded-md border border-emerald-200 px-2 text-[10px] font-medium text-emerald-600 transition hover:bg-emerald-50"
                    >
                      <CheckCircle2 size={10} />
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Recent Audit Logs</h3>
                  <p className="text-[11px] text-[#94A3B8]">Latest system events</p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("logs")}
                  className="text-[11px] font-medium text-[#0038A8] hover:underline"
                >
                  View All
                </button>
              )}
            </div>

            <div className="space-y-0">
              {AUDIT_LOGS.map((log, i) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 px-5 py-3 ${
                    i < AUDIT_LOGS.length - 1 ? "border-b border-black/5" : ""
                  }`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${LOG_DOT[log.type as keyof typeof LOG_DOT]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug text-[#334155]">{log.event}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#94A3B8]">
                      <Clock size={10} />
                      {log.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Telemetry Logs modal */}
      {logsModalDevice && (
        <Modal onClose={() => setLogsModalDevice(null)} title="Telemetry Stream" subtitle={logsModalDevice} size="lg">
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
            {[
              `[${new Date().toISOString()}] MQTT CONNECT ${logsModalDevice}`,
              `[${new Date().toISOString()}] SUB sensors/${logsModalDevice.toLowerCase()}/telemetry`,
              `[${new Date().toISOString()}] {"temp":28.4,"humidity":72,"smoke_ppm":${logsModalDevice.startsWith("DB") ? "0" : "45"},"battery":${DEVICES.find((d) => d.name === logsModalDevice)?.battery ?? 0}}`,
              `[${new Date().toISOString()}] PING OK rssi=-${30 + Math.floor(Math.random() * 40)}dBm`,
              `[${new Date().toISOString()}] {"smoke_ppm":${logsModalDevice.startsWith("DB") ? "0" : "42"},"battery":${DEVICES.find((d) => d.name === logsModalDevice)?.battery ?? 0}}`,
              `[${new Date().toISOString()}] PING OK rssi=-${30 + Math.floor(Math.random() * 40)}dBm`,
              `[${new Date().toISOString()}] {"temp":28.5,"humidity":71,"smoke_ppm":${logsModalDevice.startsWith("DB") ? "0" : "44"},"battery":${DEVICES.find((d) => d.name === logsModalDevice)?.battery ?? 0}}`,
            ].map((line, i) => (
              <div key={i} className={i % 2 === 0 ? "" : "text-emerald-300/70"}>
                {line}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-stone-400">
              Simulated MQTT payload stream — live in production via WebSocket broker
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("settings")}
                className="text-[11px] font-medium text-[#0038A8] hover:underline"
              >
                Adjust Thresholds
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Dispatch modal */}
      {dispatchDevice && (
        <Modal
          onClose={() => setDispatchDevice(null)}
          title="Dispatch Field Maintenance"
          subtitle={dispatchDevice}
          icon={<Wrench size={18} />}
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDispatchDevice(null)}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={submitDispatch}
                className="flex items-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#002A8C]"
              >
                <Wrench size={13} />
                Dispatch Now
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500">
                MAINTENANCE TYPE
              </span>
              <div className="grid grid-cols-2 gap-2">
                {DISPATCH_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDispatchType(t)}
                    className={`${PICK_STYLE(dispatchType === t)} text-left`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500">
                PRIORITY
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DISPATCH_PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setDispatchPriority(p.value)}
                    className={`${PICK_STYLE(dispatchPriority === p.value)} text-center`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500">
                ASSIGNED TEAM
              </span>
              <select
                value={dispatchTeam}
                onChange={(e) => setDispatchTeam(e.target.value)}
                className={FIELD_STYLE}
              >
                {DISPATCH_TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500">
                NOTES
              </label>
              <textarea
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                rows={3}
                placeholder="Optional — describe the fault or instructions for the field team..."
                className={`${FIELD_STYLE} resize-none`}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Alert Details modal */}
      {alertDetail && (
        <Modal
          onClose={() => setAlertDetail(null)}
          title={alertDetail.title}
          subtitle={alertDetail.device}
          icon={(() => {
            const Icon = ALERT_ICONS[alertDetail.type] ?? AlertTriangle;
            return <Icon size={18} />;
          })()}
          size="md"
        >
          <div className="space-y-4">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SEVERITY_META[alertDetail.severity].badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[alertDetail.severity].dot}`} />
              {SEVERITY_META[alertDetail.severity].label}
            </span>

            <p className="text-[13px] leading-relaxed text-stone-600">{alertDetail.reason}</p>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-[11px]">
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">CATEGORY</p>
                <p className="mt-0.5 font-medium text-[#334155]">
                  {SCOPE_LABELS[alertDetail.scope]}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">DETECTED</p>
                <p className="mt-0.5 font-medium text-[#334155]">{alertDetail.time}</p>
              </div>
              {alertDetail.ip && (
                <div className="col-span-2">
                  <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">SOURCE IP</p>
                  <p className="mt-0.5 font-mono font-medium text-[#334155]">{alertDetail.ip}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#0038A8]">
                <ArrowUpRight size={11} />
                ESCALATION ROUTING (§14.12)
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[#334155]">
                {alertDetail.escalation}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">
                {alertDetail.scope === "ops"
                  ? alertDetail.type === "sos_failed"
                    ? "Failed SOS notifications escalate Desk Officer → Captain for immediate acknowledgment."
                    : "Infrastructure and audit-integrity failures route to the Admin for immediate investigation (§14.12)."
                  : alertDetail.scope === "security"
                    ? "Suspicious access patterns are monitored continuously; confirm account state and revoke access if needed."
                    : "Routing follows the §14.12 alert routing table for this alert class."}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation modal */}
      {modalMessage && (
        <ConfirmModal
          title={modalMessage.title}
          message={modalMessage.message}
          onClose={() => setModalMessage(null)}
        />
      )}
    </div>
  );
}
