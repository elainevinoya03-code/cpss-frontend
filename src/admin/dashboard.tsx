import { useState, useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Cpu,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Wifi,
  WifiOff,
  Clock,
  Wrench,
  Zap,
  BatteryLow,
  Lock,
  Video,
  MessageSquare,
  ServerCrash,
  FileText,
  HardDrive,
  Database,
  ServerCog,
  Shield,
  ArrowRight,
  Radio,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  PieChart,
} from "lucide-react";
import { batteryColor } from "../utils/colors";
import { ConfirmModal, Modal } from "../components/ui";
import {
  getCctvStorageConfig,
  subscribeCctvStorage,
} from "../utils/cctvStorage";
import { getAuditLogs, subscribeAuditLogs } from "../utils/auditLog";

const DEVICES = [
  {
    name: "SM-GATE-01",
    type: "Smoke Sensor",
    status: "online",
    battery: 87,
    lastPing: "2 mins ago",
  },
  {
    name: "SM-PLAZA-02",
    type: "Smoke Sensor",
    status: "online",
    battery: 54,
    lastPing: "4 mins ago",
  },
  {
    name: "DB-HALL-01",
    type: "Decibel Meter",
    status: "maintenance",
    battery: 21,
    lastPing: "12 mins ago",
  },
  {
    name: "SM-KIOSK-01",
    type: "Smoke Sensor",
    status: "online",
    battery: 61,
    lastPing: "8 mins ago",
  },
  {
    name: "SM-PUROK3-01",
    type: "Smoke Sensor",
    status: "offline",
    battery: 8,
    lastPing: "3 hrs ago",
  },
  {
    name: "DB-MARKET-01",
    type: "Decibel Meter",
    status: "online",
    battery: 73,
    lastPing: "1 min ago",
  },
  {
    name: "SM-CHAPEL-01",
    type: "Smoke Sensor",
    status: "online",
    battery: 92,
    lastPing: "3 mins ago",
  },
  {
    name: "SM-EVAC-02",
    type: "Smoke Sensor",
    status: "pending",
    battery: 100,
    lastPing: "Pending",
  },
];

const STATUS_STYLES = {
  online: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    icon: Wifi,
    label: "Online",
  },
  offline: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-600",
    icon: WifiOff,
    label: "Offline",
  },
  pending: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
    icon: Clock,
    label: "Pending",
  },
  maintenance: {
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700",
    icon: Wrench,
    label: "Maintenance Required",
  },
} as const;

const CAMERAS = [
  { id: "CAM-GATE-01", name: "Main Gate", purok: "Purok 1", status: "online", lastSeen: "now" },
  { id: "CAM-CHAPEL-02", name: "Chapel Plaza", purok: "Purok 2", status: "online", lastSeen: "now" },
  { id: "CAM-MARKET-03", name: "Market Row", purok: "Purok 3", status: "offline", lastSeen: "20 mins ago" },
  { id: "CAM-SCHOOL-04", name: "School District", purok: "Purok 4", status: "online", lastSeen: "now" },
  { id: "CAM-PLAZA-01", name: "Town Plaza", purok: "Purok 1", status: "online", lastSeen: "now" },
  { id: "CAM-RIVER-05", name: "Riverside", purok: "Purok 1", status: "online", lastSeen: "1 min ago" },
  { id: "CAM-MARKET-07", name: "Market Annex", purok: "Purok 3", status: "online", lastSeen: "now" },
  { id: "CAM-HEALTH-08", name: "Health Center", purok: "Purok 2", status: "online", lastSeen: "now" },
  { id: "CAM-GYM-09", name: "Covered Court", purok: "Purok 4", status: "online", lastSeen: "2 mins ago" },
  { id: "CAM-SOS-10", name: "SOS Kiosk", purok: "Purok 3", status: "online", lastSeen: "now" },
  { id: "CAM-BRIDGE-11", name: "Bridge Approach", purok: "Purok 1", status: "online", lastSeen: "1 min ago" },
  { id: "CAM-EVAC-06", name: "Evacuation Zone Alpha", purok: "Evac Zone", status: "pending", lastSeen: "pending" },
];

const CAMERA_STATUS = {
  online: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", label: "Online" },
  offline: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-600", label: "Offline" },
  pending: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700", label: "Pending" },
} as const;

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
  ops: "System",
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
    escalation: "Admin",
    time: "2026-07-20 09:32",
  },
  {
    id: "a2",
    title: "DB-HALL-01 — Maintenance Required",
    device: "DB-HALL-01",
    reason: "Battery critically low at 21% — maintenance records in IoT Provisioning",
    type: "low_battery",
    severity: "warning",
    scope: "iot",
    escalation: "Admin",
    time: "2026-07-20 10:05",
  },
  {
    id: "a4",
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
    id: "a5",
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
    id: "a6",
    title: "SMS Rate Limit Approaching",
    reason:
      "SMS gateway at 80% of the 60 msg/min cap — 48 sent this minute",
    type: "sms_ratelimit",
    severity: "informational",
    scope: "provider",
    escalation: "Admin",
    time: "2026-07-20 10:08",
  },
  {
    id: "a7",
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
    id: "a8",
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
  failed_login: Lock,
  camera_offline: Video,
  sms_ratelimit: MessageSquare,
  auth_failure: ServerCrash,
  audit_failure: FileText,
  storage: HardDrive,
};

const INFRA_HEALTH = [
  {
    label: "Database",
    icon: Database,
    desc: "Connected · pool at 42% capacity",
  },
  {
    label: "Storage",
    icon: HardDrive,
    desc: "1,730 GB of 2,750 GB used · 63%",
  },
  {
    label: "Notification Service",
    icon: MessageSquare,
    desc: "Push notifications degraded — 4 failures (24h)",
  },
  {
    label: "Backend / API",
    icon: ServerCog,
    desc: "All endpoints responding · 12ms latency",
  },
];

const INFRA_STATUS = {
  healthy: {
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "Healthy",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
    label: "Warning",
  },
  unavailable: {
    badge: "bg-rose-50 text-rose-600",
    dot: "bg-rose-500",
    label: "Unavailable",
  },
} as const;

const ACTION_BADGE: Record<string, string> = {
  "Configuration Change": "bg-green-50 text-green-700",
  "User Deactivation": "bg-red-50 text-red-600",
  "User Disabled": "bg-red-50 text-red-600",
  "User Enabled": "bg-emerald-50 text-emerald-700",
  "Device Registration": "bg-rose-50 text-rose-800",
  "Geofence Update": "bg-purple-50 text-purple-700",
  "Boundary Created": "bg-purple-50 text-purple-700",
  "Boundary Updated": "bg-purple-50 text-purple-700",
  "Boundary Deleted": "bg-rose-50 text-rose-700",
  "User Created": "bg-emerald-50 text-emerald-700",
  "User Updated": "bg-sky-50 text-sky-700",
  "Password Reset": "bg-indigo-50 text-indigo-600",
  "Device Updated": "bg-cyan-50 text-cyan-700",
  "Device Decommissioned": "bg-rose-50 text-rose-700",
  "Device Disabled": "bg-amber-50 text-amber-700",
  "Device Enabled": "bg-emerald-50 text-emerald-700",
  "Device Connectivity Test": "bg-cyan-50 text-cyan-700",
  "System Alert": "bg-orange-50 text-orange-600",
  "Camera Registration": "bg-pink-50 text-pink-700",
  "Camera Placement": "bg-violet-50 text-violet-700",
  "Camera Updated": "bg-fuchsia-50 text-fuchsia-700",
  "Camera Deleted": "bg-rose-50 text-rose-700",
  "Patrol Routes": "bg-teal-50 text-teal-700",
  "Data Request Processed": "bg-teal-50 text-teal-700",
  "Credential Provisioned": "bg-sky-50 text-sky-700",
  "Credential Rotated": "bg-indigo-50 text-indigo-700",
  "Credential Revoked": "bg-rose-50 text-rose-700",
  "Camera Connectivity Test": "bg-cyan-50 text-cyan-700",
  "Camera Enabled": "bg-emerald-50 text-emerald-700",
  "Camera Disabled": "bg-amber-50 text-amber-700",
  "Camera Placed Under Maintenance": "bg-sky-50 text-sky-700",
  "Camera Restored": "bg-emerald-50 text-emerald-700",
};

const RECENT_AUDIT_SEED = [
  {
    timestamp: "2026-07-20 10:05:42",
    actionType: "Credential Provisioned",
    description: "Provisioned enrollment credential for SM-EVAC-02 (result: successful)",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 09:58:31",
    actionType: "Camera Registration",
    description: "Registered new camera CAM-EVAC-06 at Evacuation Zone Alpha",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 09:41:12",
    actionType: "Configuration Change",
    description: "Adjusted Decibel Threshold to 85 dB for DB-HALL-01",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 09:20:03",
    actionType: "Patrol Routes",
    description: "Saved patrol route — Market District Foot Patrol (~2.1 km, active)",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 08:55:47",
    actionType: "Geofence Update",
    description: "Updated boundary polygon for Purok 3 — 8 nodes modified",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 08:31:05",
    actionType: "User Deactivation",
    description: "Deactivated account for Carlo Mendoza (Purok Leader)",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 08:02:19",
    actionType: "User Created",
    description: "New account created for Liza Flores (Tanod, Purok 5)",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-19 22:15:30",
    actionType: "Device Registration",
    description: "Registered new device SM-CHAPEL-01 at Purok 2, Chapel Area",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-19 18:02:11",
    actionType: "Data Request Processed",
    description: "Approved data-access request DR-005 (Access)",
    admin: "admin@brgy.gov.ph",
  },
];

const ANALYTICS_DATA = {
  deviceUptime: {
    label: "Device Uptime",
    value: "94.2%",
    change: "+2.3%",
    trend: "up",
    description: "Average uptime across all IoT devices (30 days)",
  },
  alertResponse: {
    label: "Alert Response Time",
    value: "4.2 min",
    change: "-1.1 min",
    trend: "up",
    description: "Average time to address critical alerts",
  },
  patrolCoverage: {
    label: "Patrol Coverage",
    value: "87%",
    change: "+5%",
    trend: "up",
    description: "Percentage of scheduled routes completed",
  },
  systemEfficiency: {
    label: "System Efficiency",
    value: "92.8%",
    change: "-0.5%",
    trend: "down",
    description: "Overall system performance index",
  },
};

const DEVICE_TRENDS = [
  { period: "Week 1", online: 6, offline: 1, maintenance: 0 },
  { period: "Week 2", online: 6, offline: 1, maintenance: 1 },
  { period: "Week 3", online: 5, offline: 2, maintenance: 1 },
  { period: "Week 4", online: 6, offline: 1, maintenance: 1 },
];

const ALERT_DISTRIBUTION = [
  { category: "IoT", count: 4, color: "bg-green-500" },
  { category: "CCTV", count: 1, color: "bg-purple-500" },
  { category: "Security", count: 1, color: "bg-rose-500" },
  { category: "System", count: 2, color: "bg-amber-500" },
];

const PATROL_METRICS = [
  { route: "Market District", completion: 95, distance: "2.1 km", incidents: 0 },
  { route: "Residential Zone", completion: 88, distance: "1.8 km", incidents: 1 },
  { route: "Industrial Area", completion: 92, distance: "2.4 km", incidents: 0 },
  { route: "School District", completion: 85, distance: "1.5 km", incidents: 2 },
];

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
          className="text-[11px] font-medium text-[#15803D] hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [pinging, setPinging] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [alertDetail, setAlertDetail] = useState<AlertItem | null>(null);
  const [storage, setStorage] = useState(getCctvStorageConfig());
  const [liveEntries, setLiveEntries] = useState(() => getAuditLogs());

  useEffect(() => subscribeCctvStorage(() => setStorage(getCctvStorageConfig())), []);
  useEffect(() => subscribeAuditLogs(() => setLiveEntries([...getAuditLogs()])), []);

  const cameraCounts = {
    online: CAMERAS.filter((c) => c.status === "online").length,
    offline: CAMERAS.filter((c) => c.status === "offline").length,
    pending: CAMERAS.filter((c) => c.status === "pending").length,
  };

  const deviceCounts = {
    online: DEVICES.filter((d) => d.status === "online").length,
    offline: DEVICES.filter((d) => d.status === "offline").length,
    pending: DEVICES.filter((d) => d.status === "pending").length,
    maintenance: DEVICES.filter((d) => d.status === "maintenance").length,
  };

  const storagePct = Math.round((storage.usedGb / storage.totalGb) * 100);
  const storageWarning = storagePct >= storage.warnThresholdPct;

  const infraCards = INFRA_HEALTH.map((c) => {
    let status: keyof typeof INFRA_STATUS = "healthy";
    if (c.label === "Storage") status = storageWarning ? "warning" : "healthy";
    if (c.label === "Notification Service") status = "warning";
    return { ...c, status };
  });

  const kpiCards = [
    {
      label: "ACTIVE USERS",
      value: "6",
      sub: "of 7 total accounts",
      icon: Users,
      page: "users",
      title: "Open User Management",
    },
    {
      label: "IOT DEVICES",
      value: String(DEVICES.length),
      sub: `${deviceCounts.online} online · ${deviceCounts.offline} offline · ${deviceCounts.pending} pending`,
      icon: Cpu,
      page: "iot",
      title: "Open IoT Provisioning",
    },
    {
      label: "CCTV CAMERAS",
      value: String(CAMERAS.length),
      sub: `${cameraCounts.online} online · ${cameraCounts.offline} offline · ${cameraCounts.pending} pending`,
      icon: Camera,
      page: "cctv",
      title: "Open CCTV Placement",
    },
    {
      label: "SYSTEM STATUS",
      value: "Healthy",
      sub: "99.2% uptime · last 30 days",
      icon: CheckCircle2,
      page: "settings",
      title: "Open System Settings",
    },
  ];

  const storageAlert: AlertItem | null = storageWarning
    ? {
        id: "a9",
        title: "Storage Warning — CCTV Clip Footage",
        reason: `Object storage at ${storagePct}% used — at or above the configured ${storage.warnThresholdPct}% warning threshold`,
        type: "storage",
        severity: "warning",
        scope: "ops",
        escalation: "Admin",
        time: "2026-07-20 10:16",
      }
    : null;

  const alerts = storageAlert ? [...ALERTS, storageAlert] : ALERTS;

  const severityCounts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: alerts.filter((a) => a.severity === severity).length,
  })).filter((c) => c.count > 0);

  const alertsSub = severityCounts
    .map((c) => `${c.count} ${SEVERITY_META[c.severity].label.toLowerCase()}`)
    .join(" · ");

  const bannerTone = BANNER_TONES[
    (["critical", "high", "warning", "informational"] as const).find((s) =>
      alerts.some((a) => a.severity === s)
    ) ?? "informational"
  ];

  const recentLogs = useMemo(() => {
    const merged = [...RECENT_AUDIT_SEED, ...liveEntries];
    return [...merged].sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1)).slice(0, 7);
  }, [liveEntries]);

  function pingDevice(name: string) {
    setPinging(name);
    setTimeout(() => {
      setPinging(null);
      setModalMessage({ title: "Ping Complete", message: `${name} — respond${name === "SM-PUROK3-01" ? "ed with 240ms latency" : "ing normally"}` });
    }, 1500);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-stone-500">
            System administration and infrastructure health
          </p>
        </header>

        {/* System Overview */}
        <section className="mb-6">
          <SectionTitle
            title="System Overview"
            sub="Is the system configured, accessible, and healthy?"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map(({ label, value, sub, icon: Icon, page, title }) => (
              <div
                key={label}
                onClick={() => onNavigate && page && onNavigate(page)}
                title={title}
                className={`group rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm ${
                  onNavigate && page
                    ? "cursor-pointer transition hover:border-[#15803D]/30 hover:bg-[#DCFCE7]/50"
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
                      <Icon size={15} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[26px] font-bold text-[#15803D]">{value}</div>
                <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Device Health */}
        <section className="mb-6">
          <SectionTitle title="Device Health" sub="Fleet status for IoT devices and CCTV cameras" />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* IoT device table */}
            <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">IoT Device Health</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      {DEVICES.length} deployed hardware nodes
                    </p>
                  </div>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("iot")}
                    className="text-[11px] font-medium text-[#15803D] hover:underline"
                  >
                    Open IoT Provisioning
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-3">
                {[
                  { label: "Online", count: deviceCounts.online, cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
                  { label: "Offline", count: deviceCounts.offline, cls: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
                  { label: "Pending", count: deviceCounts.pending, cls: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
                  { label: "Maintenance Required", count: deviceCounts.maintenance, cls: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${chip.cls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                    {chip.count} {chip.label}
                  </span>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="border-y border-black/5 text-left">
                      {["DEVICE NAME", "TYPE", "STATUS", "BATTERY", "LAST PING", "ACTIONS"].map((h) => (
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
                      const badge = (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.badge}`}
                        >
                          <s.icon size={11} />
                          {s.label}
                        </span>
                      );
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
                            {d.status === "maintenance" ? (
                              <button
                                onClick={() => onNavigate && onNavigate("iot")}
                                title="View maintenance records in IoT Provisioning"
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.badge} cursor-pointer transition hover:opacity-80`}
                              >
                                <s.icon size={11} />
                                {s.label}
                              </button>
                            ) : (
                              badge
                            )}
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
                          <td className="px-4 py-3 text-[12px] text-[#64748B]">{d.lastPing}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => pingDevice(d.name)}
                              disabled={pinging === d.name}
                              title="Ping / Force Reconnect"
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                            >
                              {pinging === d.name ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-[#15803D]" />
                              ) : (
                                <Zap size={11} />
                              )}
                              Ping
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CCTV availability */}
            <div className="rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">CCTV Availability</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      {CAMERAS.length} placed cameras
                    </p>
                  </div>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("cctv")}
                    className="text-[11px] font-medium text-[#15803D] hover:underline"
                  >
                    Manage
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-3">
                {[
                  { label: "Online", count: cameraCounts.online, cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
                  { label: "Offline", count: cameraCounts.offline, cls: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
                  { label: "Pending", count: cameraCounts.pending, cls: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${chip.cls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                    {chip.count} {chip.label}
                  </span>
                ))}
              </div>

              <div className="max-h-72 overflow-y-auto border-t border-black/5">
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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Infrastructure Health */}
        <section className="mb-6">
          <SectionTitle
            title="Infrastructure Health"
            sub="Core platform services at a glance"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {infraCards.map(({ label, icon: Icon, desc, status }) => {
              const st = INFRA_STATUS[status];
              return (
                <div
                  key={label}
                  className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
                      <Icon size={15} />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold text-[#334155]">{label}</p>
                  <p className="mt-0.5 text-[11px] text-[#94A3B8]">{desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Analytics */}
        <section className="mb-6">
          <SectionTitle
            title="Data Analytics"
            sub="Performance metrics and operational insights"
          />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Key Performance Metrics */}
            <div className="rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Key Performance Metrics</h3>
                    <p className="text-[11px] text-[#94A3B8]">30-day performance overview</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-5">
                {Object.entries(ANALYTICS_DATA).map(([key, metric]) => {
                  const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown;
                  const trendColor = metric.trend === "up" ? "text-emerald-600" : "text-rose-600";
                  const trendBg = metric.trend === "up" ? "bg-emerald-50" : "bg-rose-50";
                  return (
                    <div key={key} className="rounded-lg border border-stone-100 bg-stone-50/60 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                          {metric.label}
                        </span>
                        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${trendBg} ${trendColor}`}>
                          <TrendIcon size={10} />
                          {metric.change}
                        </div>
                      </div>
                      <p className="mt-2 text-[20px] font-bold text-[#15803D]">{metric.value}</p>
                      <p className="mt-1 text-[10px] text-[#94A3B8]">{metric.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Device Trends */}
            <div className="rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Device Status Trends</h3>
                    <p className="text-[11px] text-[#94A3B8]">Weekly device status distribution</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-4">
                  {DEVICE_TRENDS.map((week) => (
                    <div key={week.period} className="flex items-center gap-4">
                      <div className="w-16 text-[11px] font-medium text-[#64748B]">{week.period}</div>
                      <div className="flex-1 flex gap-1">
                        <div
                          className="h-6 rounded-sm bg-emerald-500 transition-all hover:opacity-80"
                          style={{ width: `${(week.online / 8) * 100}%` }}
                          title={`Online: ${week.online}`}
                        />
                        <div
                          className="h-6 rounded-sm bg-rose-500 transition-all hover:opacity-80"
                          style={{ width: `${(week.offline / 8) * 100}%` }}
                          title={`Offline: ${week.offline}`}
                        />
                        <div
                          className="h-6 rounded-sm bg-orange-500 transition-all hover:opacity-80"
                          style={{ width: `${(week.maintenance / 8) * 100}%` }}
                          title={`Maintenance: ${week.maintenance}`}
                        />
                      </div>
                      <div className="flex gap-3 text-[10px] text-[#94A3B8]">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {week.online}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          {week.offline}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-orange-500" />
                          {week.maintenance}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-[#94A3B8]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Online
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Offline
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Maintenance
                  </span>
                </div>
              </div>
            </div>

            {/* Alert Distribution */}
            <div className="rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <PieChart size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Alert Distribution</h3>
                    <p className="text-[11px] text-[#94A3B8]">Alerts by category (last 30 days)</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-6">
                  <div className="relative h-32 w-32">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                      {ALERT_DISTRIBUTION.map((item, index) => {
                        const total = ALERT_DISTRIBUTION.reduce((sum, i) => sum + i.count, 0);
                        const percentage = (item.count / total) * 100;
                        const dashArray = `${percentage} ${100 - percentage}`;
                        const offset = ALERT_DISTRIBUTION.slice(0, index).reduce(
                          (sum, i) => sum - (i.count / total) * 100,
                          0
                        );
                        return (
                          <circle
                            key={item.category}
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke={item.color.replace("bg-", "").replace("500", "#22C55E")}
                            strokeWidth="3"
                            strokeDasharray={dashArray}
                            strokeDashoffset={offset}
                            className="transition-all hover:opacity-80"
                          />
                        );
                      })}
                    </svg>
                  </div>
                  <div className="flex-1 space-y-2">
                    {ALERT_DISTRIBUTION.map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${item.color}`} />
                          <span className="text-[11px] text-[#334155]">{item.category}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#15803D]">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Patrol Metrics */}
            <div className="rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Patrol Performance</h3>
                    <p className="text-[11px] text-[#94A3B8]">Route completion and incident metrics</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] border-collapse">
                  <thead>
                    <tr className="border-y border-black/5 text-left">
                      {["ROUTE", "COMPLETION", "DISTANCE", "INCIDENTS"].map((h) => (
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
                    {PATROL_METRICS.map((metric) => (
                      <tr key={metric.route} className="border-b border-black/5 last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 text-[12px] font-semibold text-[#334155]">
                          {metric.route}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-sm bg-stone-200">
                              <div
                                className={`h-full rounded-sm ${
                                  metric.completion >= 90
                                    ? "bg-emerald-500"
                                    : metric.completion >= 80
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                }`}
                                style={{ width: `${metric.completion}%` }}
                              />
                            </div>
                            <span className="text-[12px] text-[#334155]">{metric.completion}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#64748B]">{metric.distance}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              metric.incidents === 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {metric.incidents}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* System Alerts */}
        <section className="mb-6">
          <SectionTitle
            title="System Alerts"
            sub="Administrative and system-level issues requiring attention"
          />
          {alerts.length > 0 && (
            <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ${bannerTone.border}`}>
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
                      {alerts.length} Active Alert{alerts.length !== 1 ? "s" : ""}
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
                    {alerts.map((alert) => {
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
                            </div>
                            <p className="mt-0.5 text-xs opacity-80">{alert.reason}</p>
                            <p className="mt-1 text-[11px] opacity-60">{alert.time}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {alert.scope === "iot" ? (
                              <button
                                onClick={() => alert.device && pingDevice(alert.device)}
                                className="rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium opacity-70 transition hover:opacity-100"
                              >
                                Ping
                              </button>
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
        </section>

        {/* Recent Audit Activity */}
        <section>
          <SectionTitle
            title="Recent Audit Activity"
            sub="Latest administrative actions"
            onAction={onNavigate ? () => onNavigate("logs") : undefined}
            actionLabel="View All"
          />
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div>
              {recentLogs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-5 py-3 ${
                    i < recentLogs.length - 1 ? "border-b border-black/5" : ""
                  }`}
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#15803D]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug text-[#334155]">{log.description}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#94A3B8]">
                      <Clock size={10} />
                      {log.timestamp} · {log.admin}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      ACTION_BADGE[log.actionType] ?? "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {log.actionType}
                  </span>
                </div>
              ))}
            </div>
            {onNavigate && (
              <div className="border-t border-stone-100 px-5 py-3">
                <button
                  onClick={() => onNavigate("logs")}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#15803D] hover:underline"
                >
                  <Shield size={11} />
                  Open Audit Logs
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

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

            <div className="rounded-lg border border-[#15803D]/15 bg-[#15803D]/5 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#15803D]">
                <ArrowUpRight size={11} />
                ESCALATION ROUTING (§14.12)
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[#334155]">
                {alertDetail.escalation}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">
                {alertDetail.scope === "ops"
                  ? "Infrastructure and audit-integrity failures route to the Admin for investigation (§14.12)."
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
