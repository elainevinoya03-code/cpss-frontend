import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  MapPin,
  Wifi,
  WifiOff,
  Video,
  Trash2,
  Pencil,
  Power,
  Save,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  HardDrive,
  KeyRound,
  Radio,
  CheckCircle2,
  Info,
  ArrowUp,
  Wrench,
  PowerOff,
  MonitorPlay,
  Maximize2,
  Minimize2,
  Loader2,
  Signal,
  Search,
  RotateCw,
} from "lucide-react";
import { PUROK_OPTIONS } from "../constants/purok";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import { getCctvStorageConfig, subscribeCctvStorage } from "../utils/cctvStorage";

type CameraStatus = "pending" | "online" | "degraded" | "offline" | "maintenance" | "disabled";

type SimMode = "auto" | "pass" | "fail-timeout" | "fail-endpoint" | "fail-credentials";

interface ConnectionTestRecord {
  timestamp: string;
  result: "Passed" | "Failed";
  reason: string;
  latency: string;
  resultingStatus: CameraStatus;
}

interface MaintenanceRecord {
  date: string;
  type: string;
  performedBy: string;
  description: string;
  result: string;
}

interface Camera {
  id: string;
  name: string;
  purok: string;
  assignment: string;
  purpose: string;
  resolution: string;
  ip: string;
  status: CameraStatus;
  top: number;
  left: number;
  enabled: boolean;
  registeredAt: string;
  lastTested: string;
  maintenanceContact: string;
  operatorGroup: string;
  mountingType: string;
  height: string;
  orientation: string;
  fov: string;
  connectionType: string;
  streamProtocol: string;
  latency: string;
  lastHeartbeat: string;
  lastSuccessful: string;
  lastFailed: string;
  powerState: string;
  uptime: string;
  maintenanceStatus: string;
  maintenanceHistory: MaintenanceRecord[];
  testHistory: ConnectionTestRecord[];
  lat: string;
  lng: string;
  credUser: string;
  credPass: string;
}

interface EditForm {
  name: string;
  purok: string;
  assignment: string;
  purpose: string;
  resolution: string;
  lat: string;
  lng: string;
  mountingType: string;
  height: string;
  orientation: string;
  fov: string;
  connectionType: string;
  streamProtocol: string;
  ip: string;
  operatorGroup: string;
  maintenanceContact: string;
}

function generateCredToken(): string {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `••••-••••-••••-${seg()}`;
}

function maskToken(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-4);
  return `••••-••••-••••-${clean}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

const RESOLUTIONS = ["1080p", "4K", "2K", "720p"];

const BOUNDARY_OPTIONS = [
  "Main Barangay Boundary",
  "Purok 1 — Riverside",
  "Purok 2 — Chapel Area",
  "Purok 3 — Market Zone",
  "Purok 4 — School District",
  "Evacuation Zone Alpha",
];

const PURPOSES = [
  "Main Road",
  "Barangay Hall",
  "Evacuation Center",
  "Entrance / Exit",
  "Public Area",
  "Other",
];

const MOUNTING_TYPES = ["Wall", "Pole", "Ceiling", "Other"];

const ORIENTATIONS = [
  "North",
  "Northeast",
  "East",
  "Southeast",
  "South",
  "Southwest",
  "West",
  "Northwest",
];

const FOV_OPTIONS = ["45°", "60°", "90°", "120°", "180°"];

const CONNECTION_TYPES = ["Ethernet (PoE)", "Ethernet", "Wi-Fi", "LTE / 4G"];

const STREAM_PROTOCOLS = ["RTSP", "HLS", "ONVIF", "HTTP"];

const MONITORING_GROUPS = [
  "CO-01 — Surveillance Unit",
  "CO-02 — Surveillance Unit",
  "CO-03 — Operations Desk",
  "Not Assigned",
];

const MAINTENANCE_CONTACTS = [
  "Field Tech — Team A",
  "Field Tech — Team B",
  "Barangay Facilities",
  "External Contractor",
  "Unassigned",
];

const ORIENTATION_ANGLES: Record<string, number> = {
  North: 0,
  Northeast: 45,
  East: 90,
  Southeast: 135,
  South: 180,
  Southwest: 225,
  West: 270,
  Northwest: 315,
};

function orientationAngle(o: string): number {
  return ORIENTATION_ANGLES[o] ?? 0;
}

function fovToDeg(fov: string): number {
  const m = fov.match(/(\d+)/);
  return m ? Math.min(180, Number(m[1])) : 90;
}

function coordsToPosition(lat: string, lng: string): { top: number; left: number } {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { top: 30, left: 30 };
  const top = Math.min(94, Math.max(4, ((la - 14.595) / 0.01) * 100));
  const left = Math.min(94, Math.max(4, ((ln - 120.98) / 0.015) * 100));
  return { top, left };
}

const STYLES = {
  input:
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/15 disabled:cursor-not-allowed disabled:bg-stone-50",
  select:
    "w-full appearance-none rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/15",
  label: "mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500",
  section: "rounded-xl border border-stone-200 bg-white p-6 shadow-sm",
  sectionTitle: "text-base font-bold text-stone-900",
  sectionDesc: "mt-1 text-xs text-stone-400",
  primaryBtn:
    "flex items-center justify-center gap-2 rounded-md bg-[#0038A8] py-2.5 text-sm font-semibold text-white transition hover:bg-[#002A8C] active:scale-[0.99]",
};

const STATUS_CONFIG: Record<
  CameraStatus,
  { dot: string; badge: string; pin: string; label: string; icon: React.ElementType }
> = {
  online: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pin: "#2f7d4f",
    label: "Online",
    icon: Wifi,
  },
  degraded: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    pin: "#c98a1f",
    label: "Degraded",
    icon: AlertTriangle,
  },
  offline: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-600 border-rose-200",
    pin: "#c0392b",
    label: "Offline",
    icon: WifiOff,
  },
  pending: {
    dot: "bg-stone-400",
    badge: "bg-stone-100 text-stone-600 border-stone-200",
    pin: "#94a3b8",
    label: "Pending",
    icon: Clock,
  },
  maintenance: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    pin: "#0284c7",
    label: "Maintenance",
    icon: Wrench,
  },
  disabled: {
    dot: "bg-stone-400",
    badge: "bg-stone-100 text-stone-500 border-stone-200",
    pin: "#a8a29e",
    label: "Disabled",
    icon: PowerOff,
  },
};

function seedCamera(patch: Partial<Camera> & { id: string }): Camera {
  return {
    name: "",
    purok: PUROK_OPTIONS[0],
    assignment: BOUNDARY_OPTIONS[0],
    purpose: "Public Area",
    resolution: "1080p",
    ip: "",
    status: "online",
    top: 30,
    left: 30,
    enabled: true,
    registeredAt: today(),
    lastTested: "—",
    maintenanceContact: "Unassigned",
    operatorGroup: "Not Assigned",
    mountingType: "Pole",
    height: "4.0 m",
    orientation: "North",
    fov: "90°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "RTSP",
    latency: "—",
    lastHeartbeat: "—",
    lastSuccessful: "—",
    lastFailed: "—",
    powerState: "Powered",
    uptime: "—",
    maintenanceStatus: "OK",
    maintenanceHistory: [],
    testHistory: [],
    lat: "14.5995",
    lng: "120.9842",
    credUser: "",
    credPass: generateCredToken(),
    ...patch,
  };
}

const INITIAL_CAMERAS: Camera[] = [
  seedCamera({
    id: "CAM-GATE-01",
    name: "Main Gate — Perimeter",
    purok: "Purok 1 — Riverside",
    assignment: "Purok 1 — Riverside",
    purpose: "Main Road",
    resolution: "4K",
    ip: "10.0.4.11",
    status: "online",
    top: 32,
    left: 24,
    enabled: true,
    registeredAt: "2026-05-04",
    lastTested: "2026-07-20 08:40",
    maintenanceContact: "Field Tech — Team A",
    operatorGroup: "CO-01 — Surveillance Unit",
    mountingType: "Wall",
    height: "4.5 m",
    orientation: "Northeast",
    fov: "120°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "RTSP",
    latency: "34ms",
    lastHeartbeat: "2026-07-20 09:12",
    lastSuccessful: "2026-07-20 08:40",
    lastFailed: "—",
    powerState: "Powered",
    uptime: "21d 4h",
    maintenanceStatus: "OK",
    maintenanceHistory: [
      {
        date: "2026-06-18",
        type: "Inspection",
        performedBy: "Field Tech — Team A",
        description: "Routine quarterly inspection of housing and cabling",
        result: "Passed",
      },
      {
        date: "2026-05-02",
        type: "Cleaning",
        performedBy: "Field Tech — Team A",
        description: "Lens cleaning after heavy rain",
        result: "Passed",
      },
    ],
    testHistory: [
      {
        timestamp: "2026-07-20 08:40",
        result: "Passed",
        reason: "—",
        latency: "34ms",
        resultingStatus: "online",
      },
      {
        timestamp: "2026-07-20 08:35",
        result: "Passed",
        reason: "—",
        latency: "31ms",
        resultingStatus: "online",
      },
    ],
    credUser: "svc_cam_gate_01",
    credPass: generateCredToken(),
  }),
  seedCamera({
    id: "CAM-PLAZA-02",
    name: "Plaza Pan-Tilt-Zoom",
    purok: "Purok 2 — Chapel Area",
    assignment: "Purok 2 — Chapel Area",
    purpose: "Public Area",
    resolution: "1080p",
    ip: "10.0.4.12",
    status: "online",
    top: 48,
    left: 52,
    enabled: true,
    registeredAt: "2026-05-11",
    lastTested: "2026-07-20 09:05",
    maintenanceContact: "Barangay Facilities",
    operatorGroup: "CO-01 — Surveillance Unit",
    mountingType: "Pole",
    height: "6.0 m",
    orientation: "Southeast",
    fov: "180°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "HLS",
    latency: "41ms",
    lastHeartbeat: "2026-07-20 09:14",
    lastSuccessful: "2026-07-20 09:05",
    lastFailed: "—",
    powerState: "Powered",
    uptime: "18d 9h",
    maintenanceStatus: "OK",
    maintenanceHistory: [
      {
        date: "2026-06-30",
        type: "Cleaning",
        performedBy: "Barangay Facilities",
        description: "Dome housing wiped down, insect nests removed",
        result: "Passed",
      },
    ],
    credUser: "svc_cam_plaza_02",
    credPass: generateCredToken(),
  }),
  seedCamera({
    id: "CAM-MARKET-03",
    name: "Public Market Stall Front",
    purok: "Purok 3 — Market Zone",
    assignment: "Purok 3 — Market Zone",
    purpose: "Public Area",
    resolution: "1080p",
    ip: "10.0.4.13",
    status: "online",
    top: 55,
    left: 72,
    enabled: true,
    registeredAt: "2026-05-19",
    lastTested: "2026-07-20 08:15",
    maintenanceContact: "External Contractor",
    operatorGroup: "CO-02 — Surveillance Unit",
    mountingType: "Ceiling",
    height: "3.5 m",
    orientation: "South",
    fov: "90°",
    connectionType: "Wi-Fi",
    streamProtocol: "RTSP",
    latency: "28ms",
    lastHeartbeat: "2026-07-20 09:15",
    lastSuccessful: "2026-07-20 08:15",
    lastFailed: "—",
    powerState: "Powered",
    uptime: "31d 2h",
    maintenanceStatus: "OK",
    maintenanceHistory: [
      {
        date: "2026-06-12",
        type: "Cleaning",
        performedBy: "External Contractor",
        description: "Lens clean, stall lighting glare adjustment",
        result: "Passed",
      },
      {
        date: "2026-04-15",
        type: "Replacement",
        performedBy: "External Contractor",
        description: "Replaced damaged mounting housing",
        result: "Passed",
      },
    ],
    credUser: "svc_cam_market_03",
    credPass: generateCredToken(),
  }),
  seedCamera({
    id: "CAM-SCHOOL-04",
    name: "School Gate Approach",
    purok: "Purok 4 — School District",
    assignment: "Purok 4 — School District",
    purpose: "Entrance / Exit",
    resolution: "2K",
    ip: "10.0.4.14",
    status: "offline",
    top: 22,
    left: 66,
    enabled: true,
    registeredAt: "2026-04-27",
    lastTested: "2026-07-15 11:20",
    maintenanceContact: "Field Tech — Team B",
    operatorGroup: "CO-02 — Surveillance Unit",
    mountingType: "Pole",
    height: "5.0 m",
    orientation: "West",
    fov: "120°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "RTSP",
    latency: "—",
    lastHeartbeat: "—",
    lastSuccessful: "2026-07-14 22:30",
    lastFailed: "2026-07-15 11:20",
    powerState: "Powered",
    uptime: "—",
    maintenanceStatus: "Service Due",
    maintenanceHistory: [
      {
        date: "2026-07-15",
        type: "Connectivity Check",
        performedBy: "Field Tech — Team B",
        description: "Feed drop reported — endpoint unreachable, cabling suspected",
        result: "Failed",
      },
      {
        date: "2026-06-10",
        type: "Inspection",
        performedBy: "Field Tech — Team B",
        description: "Pole mount torque check",
        result: "Passed",
      },
    ],
    testHistory: [
      {
        timestamp: "2026-07-15 11:20",
        result: "Failed",
        reason: "Connection Timeout",
        latency: "—",
        resultingStatus: "offline",
      },
      {
        timestamp: "2026-07-14 22:30",
        result: "Passed",
        reason: "—",
        latency: "47ms",
        resultingStatus: "online",
      },
    ],
    credUser: "svc_cam_school_04",
    credPass: generateCredToken(),
  }),
  seedCamera({
    id: "CAM-HALL-05",
    name: "Barangay Hall Entrance",
    purok: "Main Barangay Boundary",
    assignment: "Main Barangay Boundary",
    purpose: "Barangay Hall",
    resolution: "1080p",
    ip: "10.0.4.15",
    status: "degraded",
    top: 68,
    left: 40,
    enabled: true,
    registeredAt: "2026-06-01",
    lastTested: "2026-07-19 21:45",
    maintenanceContact: "Barangay Facilities",
    operatorGroup: "CO-01 — Surveillance Unit",
    mountingType: "Wall",
    height: "4.0 m",
    orientation: "East",
    fov: "90°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "HLS",
    latency: "142ms",
    lastHeartbeat: "2026-07-20 09:10",
    lastSuccessful: "2026-07-19 21:45",
    lastFailed: "2026-07-19 21:40",
    powerState: "Powered",
    uptime: "5d 12h",
    maintenanceStatus: "Service Due",
    maintenanceHistory: [
      {
        date: "2026-07-19",
        type: "Connectivity Check",
        performedBy: "Barangay Facilities",
        description: "Intermittent feed — signal drops every few minutes",
        result: "Failed",
      },
      {
        date: "2026-06-25",
        type: "Cleaning",
        performedBy: "Barangay Facilities",
        description: "Entrance canopy area cleaned",
        result: "Passed",
      },
    ],
    testHistory: [
      {
        timestamp: "2026-07-19 21:45",
        result: "Passed",
        reason: "—",
        latency: "142ms",
        resultingStatus: "degraded",
      },
      {
        timestamp: "2026-07-19 21:40",
        result: "Failed",
        reason: "Connection Timeout",
        latency: "—",
        resultingStatus: "degraded",
      },
    ],
    credUser: "svc_cam_hall_05",
    credPass: generateCredToken(),
  }),
  seedCamera({
    id: "CAM-EVAC-06",
    name: "Evacuation Zone Overwatch",
    purok: "Evacuation Zone Alpha",
    assignment: "Evacuation Zone Alpha",
    purpose: "Evacuation Center",
    resolution: "720p",
    ip: "10.0.4.16",
    status: "pending",
    top: 40,
    left: 33,
    enabled: true,
    registeredAt: "2026-07-19",
    lastTested: "—",
    maintenanceContact: "Unassigned",
    operatorGroup: "Not Assigned",
    mountingType: "Pole",
    height: "5.5 m",
    orientation: "North",
    fov: "120°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "RTSP",
    latency: "—",
    lastHeartbeat: "—",
    lastSuccessful: "—",
    lastFailed: "—",
    powerState: "Powered",
    uptime: "—",
    maintenanceStatus: "—",
    maintenanceHistory: [],
    testHistory: [
      {
        timestamp: "2026-07-19 16:10",
        result: "Failed",
        reason: "Invalid Credentials",
        latency: "—",
        resultingStatus: "pending",
      },
    ],
    credUser: "svc_cam_evac_06",
    credPass: generateCredToken(),
  }),
  seedCamera({
    id: "CAM-PUROK2-08",
    name: "Chapel Side Street",
    purok: "Purok 2 — Chapel Area",
    assignment: "Purok 2 — Chapel Area",
    purpose: "Main Road",
    resolution: "1080p",
    ip: "10.0.4.18",
    status: "pending",
    top: 44,
    left: 58,
    enabled: true,
    registeredAt: "2026-07-21",
    lastTested: "2026-07-22 09:20",
    maintenanceContact: "Unassigned",
    operatorGroup: "Not Assigned",
    mountingType: "Wall",
    height: "4.0 m",
    orientation: "East",
    fov: "120°",
    connectionType: "Ethernet (PoE)",
    streamProtocol: "HLS",
    latency: "38ms",
    lastHeartbeat: "2026-07-22 09:20",
    lastSuccessful: "2026-07-22 09:20",
    lastFailed: "—",
    powerState: "Powered",
    uptime: "—",
    maintenanceStatus: "OK",
    maintenanceHistory: [],
    testHistory: [
      {
        timestamp: "2026-07-22 09:20",
        result: "Passed",
        reason: "—",
        latency: "38ms",
        resultingStatus: "online",
      },
    ],
    credUser: "svc_cam_chapel_08",
    credPass: generateCredToken(),
  }),
];

function CameraMarker({ camera }: { camera: Camera }) {
  const cfg = STATUS_CONFIG[camera.status];
  const angle = orientationAngle(camera.orientation);
  const dimmed = camera.status === "disabled";
  const coneW = 30 + fovToDeg(camera.fov) * 0.22;
  const coneH = 38;

  return (
    <div
      className={`absolute flex -translate-x-1/2 -translate-y-full flex-col items-center transition-opacity ${
        dimmed ? "opacity-50 grayscale" : ""
      }`}
      style={{ top: `${camera.top}%`, left: `${camera.left}%`, zIndex: Math.round(camera.top) }}
    >
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{ width: coneW, height: coneH }}
        title={`${camera.orientation} · ${camera.fov} FOV`}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
            background: dimmed ? "rgba(120,113,108,0.12)" : "rgba(245,158,11,0.14)",
            transform: `rotate(${angle}deg)`,
            transformOrigin: "50% 100%",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(50% 100%, 0.8% 1%, 99.2% 1%)",
            background: dimmed ? "rgba(120,113,108,0.28)" : "rgba(245,158,11,0.4)",
            transform: `rotate(${angle}deg)`,
            transformOrigin: "50% 100%",
          }}
        />
      </div>
      <div className="relative flex flex-col items-center">
        <span
          className="mb-0.5 flex items-center justify-center rounded-full bg-white/80 shadow-sm"
          title={`Orientation: ${camera.orientation}`}
        >
          <ArrowUp
            size={9}
            strokeWidth={2.5}
            color={cfg.pin}
            fill={cfg.pin}
            style={{ transform: `rotate(${angle}deg)` }}
          />
        </span>
        <span className="mb-1 whitespace-nowrap rounded bg-[#0038A8] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          {camera.id}
        </span>
        <div className="relative">
          <Camera
            size={22}
            strokeWidth={1.5}
            color={cfg.pin}
            fill={cfg.pin}
            className="drop-shadow-sm"
          />
          <span
            className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${cfg.dot}`}
          />
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={STYLES.label}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={STYLES.input}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div>
      <label className={STYLES.label}>{label}</label>
      <select value={value} onChange={onChange} className={STYLES.select}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 border-b border-stone-100 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0038A8]">
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  className = "",
  headerRight,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`${STYLES.section} ${className}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className={STYLES.sectionTitle}>{title}</h2>
          <p className={STYLES.sectionDesc}>{description}</p>
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 py-2.5 last:border-0">
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-stone-400">
        {label}
      </span>
      <span
        className={`text-right text-[12px] text-stone-800 ${mono ? "font-mono" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0038A8]">
        {title}
      </p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: CameraStatus }) {
  const s = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function MaintenanceResultBadge({ result }: { result: string }) {
  const cls =
    result === "Passed"
      ? "bg-emerald-50 text-emerald-700"
      : result === "Ongoing"
        ? "bg-amber-50 text-amber-700"
        : result === "Failed"
          ? "bg-rose-50 text-rose-600"
          : "bg-stone-100 text-stone-500";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${cls}`}>
      {result}
    </span>
  );
}

function LiveStreamPreview({
  camera,
  onOpenOperatorView,
}: {
  camera: Camera;
  onOpenOperatorView?: () => void;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [nowTs, setNowTs] = useState(() => new Date());
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNowTs(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onFsChange() {
      const el = feedRef.current;
      setIsFull(Boolean(el && document.fullscreenElement === el));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const live = camera.status === "online" || camera.status === "degraded";
  const connecting = camera.status === "pending";
  const noSignal =
    camera.status === "offline" ||
    camera.status === "maintenance" ||
    camera.status === "disabled";

  function toggleFullscreen() {
    const el = feedRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-black shadow-sm">
      <div
        ref={feedRef}
        className={`relative w-full overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 ${
          isFull ? "h-full" : "h-52"
        }`}
      >
        {live && (
          <>
            <div className="absolute right-6 top-4 h-10 w-10 rounded-full bg-stone-600/70" />
            <div className="absolute bottom-0 left-[8%] h-28 w-20 rounded-t-lg bg-stone-700/80" />
            <div className="absolute bottom-0 left-[20%] h-16 w-12 rounded-t-lg bg-stone-700/60" />
            <div className="absolute bottom-0 right-[10%] h-24 w-28 rounded-t-lg bg-stone-700/80" />
            <div className="absolute bottom-0 left-[44%] h-4 w-16 rounded-t bg-stone-500 shadow-lg" />
            <div className="feed-scan absolute inset-x-0" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded border border-white/10 bg-black/50 px-3 py-1.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                Simulated Preview
              </p>
              <p className="mt-0.5 text-[8px] text-white/40">
                No live CCTV feed connected — prototype stream
              </p>
            </div>
          </>
        )}

        {connecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/70">
            <Loader2 size={22} className="animate-spin text-white" />
            <p className="mt-2 text-[11px] font-semibold text-white">Connecting to stream…</p>
            <p className="mt-0.5 text-[9px] text-white/50">
              Camera has not passed its first connection test
            </p>
          </div>
        )}

        {noSignal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900">
            <PowerOff
              size={20}
              className={`mb-2 ${camera.status === "disabled" ? "text-stone-500" : "text-stone-400"}`}
            />
            <p className="text-[11px] font-semibold text-stone-500">
              {camera.status === "maintenance"
                ? "No Signal — Under Maintenance"
                : camera.status === "disabled"
                  ? "No Signal — Camera Disabled"
                  : "No Signal — Camera Offline"}
            </p>
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          {live && (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
              <span
                className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                  camera.status === "degraded" ? "bg-amber-400" : "bg-rose-500"
                }`}
              />
              {camera.status === "degraded" ? "DEGRADED" : "LIVE"}
            </span>
          )}
          {connecting && (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              CONNECTING
            </span>
          )}
          {noSignal && (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-stone-400">
              NO SIGNAL
            </span>
          )}
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <span className="rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white/90">
            {camera.id}
          </span>
          <button
            onClick={toggleFullscreen}
            title={isFull ? "Exit fullscreen preview" : "Fullscreen preview"}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white/80 transition hover:text-white"
          >
            {isFull ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>

        <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-white">{camera.name}</p>
            <p className="mt-0.5 text-[9px] text-white/60">
              {live
                ? `Last frame ${nowTs.toLocaleTimeString("en-US", { hour12: false })}`
                : "No frames received"}
            </p>
          </div>
          {live && (
            <span className="shrink-0 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/80">
              {nowTs.toLocaleTimeString("en-US", { hour12: false })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 bg-stone-900 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-stone-400">
          <span className="flex items-center gap-1">
            <Wifi size={10} className={live ? "text-emerald-400" : "text-stone-500"} />
            {live ? "Stream available" : "Stream unavailable"}
          </span>
          <span className="flex items-center gap-1">
            <Radio size={10} />
            {camera.latency !== "—" ? `${camera.latency} latency` : "Latency —"}
          </span>
          <span className="flex items-center gap-1">
            <Signal size={10} />
            {camera.streamProtocol}
          </span>
          <span className="flex items-center gap-1">
            <Video size={10} />
            {camera.connectionType}
          </span>
        </div>
        {onOpenOperatorView && (
          <button
            onClick={onOpenOperatorView}
            className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <MonitorPlay size={11} />
            Open in CCTV Operator View
          </button>
        )}
      </div>
    </div>
  );
}

function CCTVOperatorViewModal({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  const s = STATUS_CONFIG[camera.status];
  return (
    <Modal
      onClose={onClose}
      title="CCTV Operator View"
      subtitle={`Monitoring handoff from Admin configuration · ${camera.id}`}
      icon={<MonitorPlay size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="2xl"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
        </div>
      }
    >
      <LiveStreamPreview camera={camera} />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">MONITORING CONTEXT</p>
          <p className="mt-1 text-[11px] text-stone-700">
            Assigned operator / group: <strong>{camera.operatorGroup}</strong>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-700">
            Status: <StatusBadge status={camera.status} />
          </p>
          <p className="mt-1.5 text-[11px] text-stone-700">
            Stream: {camera.streamProtocol} · {camera.connectionType}
          </p>
          <p className="mt-1.5 text-[11px] text-stone-700">
            Coverage: {camera.purok} · {camera.assignment}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">
            OPERATOR CAPABILITIES (PROTOTYPE)
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
            In the Surveillance Matrix the CCTV Operator monitors this camera live, watches signal
            quality, and tags/escalates events. This modal simulates the handoff so the prototype can
            demonstrate the Admin → Operator workflow.
          </p>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[10px] text-amber-700">
        <Info size={12} className="mt-0.5 shrink-0" />
        Admin-only configuration (credentials, network, maintenance) is not exposed in the operator
        context. Status colors remain identical across roles: {s.label} cameras are visually
        consistent here.
      </p>
    </Modal>
  );
}

function CameraDetailModal({
  camera,
  onClose,
  onEditCredentials,
  onOpenOperatorView,
}: {
  camera: Camera;
  onClose: () => void;
  onEditCredentials: (c: Camera) => void;
  onOpenOperatorView: (c: Camera) => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Camera Details"
      subtitle={`${camera.id} · ${camera.name}`}
      size="3xl"
      footer={
        <div className="flex gap-3">
          <button
            onClick={() => onOpenOperatorView(camera)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white py-2.5 text-[13px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            <MonitorPlay className="h-4 w-4" />
            Open in CCTV Operator View
          </button>
          <button
            onClick={() => onEditCredentials(camera)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white py-2.5 text-[13px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            <KeyRound className="h-4 w-4" />
            Manage Credentials
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#0038A8]">
            Live Stream Preview
          </p>
          <LiveStreamPreview camera={camera} onOpenOperatorView={() => onOpenOperatorView(camera)} />
        </div>

        <DetailGroup title="Camera Information">
          <DetailRow label="CAMERA ID" mono>
            {camera.id}
          </DetailRow>
          <DetailRow label="DISPLAY NAME">{camera.name}</DetailRow>
          <DetailRow label="PUROK / LOCATION ZONE">{camera.purok}</DetailRow>
          <DetailRow label="ASSIGNED BOUNDARY">{camera.assignment}</DetailRow>
          <DetailRow label="CAMERA PURPOSE">{camera.purpose}</DetailRow>
          <DetailRow label="RESOLUTION">{camera.resolution}</DetailRow>
        </DetailGroup>

        <DetailGroup title="Placement">
          <DetailRow label="COORDINATES" mono>
            {camera.lat}, {camera.lng}
          </DetailRow>
          <DetailRow label="MOUNTING TYPE">{camera.mountingType}</DetailRow>
          <DetailRow label="CAMERA HEIGHT">{camera.height}</DetailRow>
          <DetailRow label="ORIENTATION / DIRECTION">{camera.orientation}</DetailRow>
          <DetailRow label="FIELD OF VIEW (FOV)">{camera.fov}</DetailRow>
        </DetailGroup>

        <DetailGroup title="Network">
          <DetailRow label="IP ADDRESS" mono>
            {camera.ip}
          </DetailRow>
          <DetailRow label="CONNECTION TYPE">{camera.connectionType}</DetailRow>
          <DetailRow label="STREAM PROTOCOL">{camera.streamProtocol}</DetailRow>
          <DetailRow label="CONNECTION STATUS">
            <StatusBadge status={camera.status} />
          </DetailRow>
          <DetailRow label="LATENCY">{camera.latency}</DetailRow>
        </DetailGroup>

        <DetailGroup title="Health">
          <DetailRow label="CURRENT STATUS">
            <StatusBadge status={camera.status} />
          </DetailRow>
          <DetailRow label="POWER STATE">{camera.powerState}</DetailRow>
          <DetailRow label="LAST HEARTBEAT">{camera.lastHeartbeat || "—"}</DetailRow>
          <DetailRow label="LAST SUCCESSFUL TEST">{camera.lastSuccessful || "—"}</DetailRow>
          <DetailRow label="LAST FAILED TEST">{camera.lastFailed || "—"}</DetailRow>
          <DetailRow label="UPTIME / AVAILABILITY">{camera.uptime || "—"}</DetailRow>
        </DetailGroup>

        <DetailGroup title="Assignment">
          <DetailRow label="ASSIGNED CCTV OPERATOR / GROUP">
            {camera.operatorGroup}
          </DetailRow>
          <DetailRow label="RESPONSIBLE MAINTENANCE CONTACT">
            {camera.maintenanceContact || "—"}
          </DetailRow>
        </DetailGroup>

        <DetailGroup title="Maintenance">
          <DetailRow label="DATE REGISTERED">{camera.registeredAt || "—"}</DetailRow>
          <DetailRow label="DATE LAST TESTED">{camera.lastTested || "—"}</DetailRow>
          <DetailRow label="MAINTENANCE STATUS">{camera.maintenanceStatus || "—"}</DetailRow>
          <div className="pt-2">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-stone-400">
              MAINTENANCE HISTORY
            </p>
            {camera.maintenanceHistory.length === 0 ? (
              <p className="text-[11px] text-stone-400">No maintenance records yet.</p>
            ) : (
              <div className="space-y-2">
                {camera.maintenanceHistory.map((m, i) => (
                  <div key={i} className="rounded-lg border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-stone-800">
                        {m.date} · {m.type}
                      </span>
                      <MaintenanceResultBadge result={m.result} />
                    </div>
                    <p className="mt-1 text-[10px] text-stone-500">Performed by {m.performedBy}</p>
                    <p className="mt-0.5 text-[10px] text-stone-500">{m.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DetailGroup>

        <DetailGroup title="Connection Test History">
          {camera.testHistory.length === 0 ? (
            <p className="text-[11px] text-stone-400">
              No connection tests yet. Run a connection test from the camera inventory.
            </p>
          ) : (
            <div className="db-scroll overflow-x-auto">
              <table className="w-full min-w-[380px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-[9px] font-semibold uppercase tracking-wider text-stone-400">
                    <th className="py-1.5 pr-2">Date</th>
                    <th className="py-1.5 pr-2">Result</th>
                    <th className="py-1.5 pr-2">Reason</th>
                    <th className="py-1.5 pr-2">Latency</th>
                    <th className="py-1.5 text-right">Resulting Status</th>
                  </tr>
                </thead>
                <tbody>
                  {camera.testHistory.slice(0, 5).map((t, i) => (
                    <tr key={i} className="border-b border-stone-100 last:border-0">
                      <td className="whitespace-nowrap py-1.5 pr-2 text-stone-600">{t.timestamp}</td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                            t.result === "Passed"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-600"
                          }`}
                        >
                          {t.result}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-stone-500">{t.reason}</td>
                      <td className="whitespace-nowrap py-1.5 pr-2 font-mono text-stone-500">
                        {t.latency}
                      </td>
                      <td className="py-1.5 text-right">
                        <span
                          className={`font-semibold ${
                            t.resultingStatus === "online"
                              ? "text-emerald-600"
                              : t.resultingStatus === "offline"
                                ? "text-rose-600"
                                : t.resultingStatus === "pending"
                                  ? "text-stone-500"
                                  : "text-amber-600"
                          }`}
                        >
                          {STATUS_CONFIG[t.resultingStatus].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-stone-400">
            Showing latest {Math.min(camera.testHistory.length, 5)} of {camera.testHistory.length}{" "}
            connection-test attempts.
          </p>
        </DetailGroup>

        <DetailGroup title="Credentials">
          <DetailRow label="ACCESS USERNAME" mono>
            {camera.credUser}
          </DetailRow>
          <DetailRow label="ACCESS PASSWORD / TOKEN" mono>
            {camera.credPass}
          </DetailRow>
          <p className="mt-2 flex items-start gap-1.5 text-[10px] text-stone-400">
            <KeyRound size={11} className="mt-0.5 shrink-0" />
            Credentials are masked, stored server-side only, and never written to the audit trail.
            Manage them with the key icon in the inventory or the button above.
          </p>
        </DetailGroup>
      </div>
    </Modal>
  );
}

export default function CctvPlacement() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>(INITIAL_CAMERAS);

  const [cameraId, setCameraId] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [purok, setPurok] = useState(PUROK_OPTIONS[0]);
  const [assignment, setAssignment] = useState(BOUNDARY_OPTIONS[0]);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [mountingType, setMountingType] = useState(MOUNTING_TYPES[0]);
  const [height, setHeight] = useState("");
  const [orientation, setOrientation] = useState(ORIENTATIONS[0]);
  const [fov, setFov] = useState("90°");
  const [ip, setIp] = useState(`10.0.4.${Math.floor(Math.random() * 90) + 20}`);
  const [connectionType, setConnectionType] = useState(CONNECTION_TYPES[0]);
  const [streamProtocol, setStreamProtocol] = useState(STREAM_PROTOCOLS[0]);
  const [operatorGroup, setOperatorGroup] = useState(
    MONITORING_GROUPS[MONITORING_GROUPS.length - 1],
  );
  const [maintenanceContact, setMaintenanceContact] = useState(
    MAINTENANCE_CONTACTS[MAINTENANCE_CONTACTS.length - 1],
  );
  const [lat, setLat] = useState("14.5995");
  const [lng, setLng] = useState("120.9842");
  const [pickingPin, setPickingPin] = useState(false);
  const [credUser, setCredUser] = useState("");
  const [credPass, setCredPass] = useState("");
  const [credShowPass, setCredShowPass] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    purok: "",
    assignment: "",
    purpose: "",
    resolution: "",
    lat: "",
    lng: "",
    mountingType: "",
    height: "",
    orientation: "",
    fov: "",
    connectionType: "",
    streamProtocol: "",
    ip: "",
    operatorGroup: "",
    maintenanceContact: "",
  });

  const [testingId, setTestingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [operatorViewId, setOperatorViewId] = useState<string | null>(null);
  const [credEditId, setCredEditId] = useState<string | null>(null);
  const [credForm, setCredForm] = useState({ user: "", pass: "" });
  const [credShow, setCredShow] = useState(false);
  const [credConfirmId, setCredConfirmId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    latency: string;
    timestamp: string;
    previous: CameraStatus;
    resulting: CameraStatus;
    reason: string;
    endpoint: string;
    stream: string;
  } | null>(null);
  const [simMode, setSimMode] = useState<SimMode>("auto");
  const [mapFilter, setMapFilter] = useState<"all" | CameraStatus>("all");
  const [mapSearch, setMapSearch] = useState("");
  const [storage, setStorage] = useState(getCctvStorageConfig());

  useEffect(() => subscribeCctvStorage(() => setStorage(getCctvStorageConfig())), []);

  const usedPctRaw = storage.totalGb > 0 ? (storage.usedGb / storage.totalGb) * 100 : 0;
  const usedPctStr = usedPctRaw.toFixed(1);
  const storageAlerting = usedPctRaw >= storage.warnThresholdPct;

  const onlineCount = cameras.filter((c) => c.enabled && c.status === "online").length;
  const degradedCount = cameras.filter((c) => c.enabled && c.status === "degraded").length;
  const offlineCount = cameras.filter((c) => c.enabled && c.status === "offline").length;
  const pendingCount = cameras.filter((c) => c.enabled && c.status === "pending").length;
  const maintenanceCount = cameras.filter((c) => c.enabled && c.status === "maintenance").length;

  function testConnection(cam: Camera) {
    if (cam.status === "maintenance" || cam.status === "disabled") {
      setModalMessage({
        title: "Connection Test Blocked",
        message: `${cam.id} is ${STATUS_CONFIG[cam.status].label.toLowerCase()}. Restore it from ${
          cam.status === "maintenance" ? "maintenance" : "disabled"
        } state before running a connection test.`,
      });
      return;
    }
    setTestingId(cam.id);
    setTestResult(null);
    setTimeout(() => {
      const previous: CameraStatus = cam.status;

      let success: boolean;
      let reason: string = "";
      if (simMode === "pass") {
        success = true;
      } else if (simMode === "fail-timeout") {
        success = false;
        reason = "Connection Timeout";
      } else if (simMode === "fail-endpoint") {
        success = false;
        reason = "Stream Endpoint Unreachable";
      } else if (simMode === "fail-credentials") {
        success = false;
        reason = "Invalid Credentials";
      } else {
        success = Math.random() > 0.3;
        if (!success) {
          reason = ["Connection Timeout", "Stream Endpoint Unreachable", "Invalid Credentials"][
            Math.floor(Math.random() * 3)
          ];
        }
      }

      const latency = success ? `${25 + Math.floor(Math.random() * 85)}ms` : "—";
      const timestamp = now();

      const resulting: CameraStatus = success
        ? "online"
        : previous === "pending" || previous === "offline"
          ? previous
          : "offline";

      const endpoint = success || reason === "Invalid Credentials" ? "Reachable" : "Unreachable";
      const stream = success ? "Available" : "Unavailable";

      const record: ConnectionTestRecord = {
        timestamp,
        result: success ? "Passed" : "Failed",
        reason: success ? "—" : reason,
        latency,
        resultingStatus: resulting,
      };

      setCameras((prev) =>
        prev.map((c) =>
          c.id === cam.id
            ? {
                ...c,
                status: resulting,
                lastTested: timestamp,
                latency: success ? latency : "—",
                lastHeartbeat: success ? timestamp : c.lastHeartbeat,
                lastSuccessful: success ? timestamp : c.lastSuccessful,
                lastFailed: success ? c.lastFailed : timestamp,
                uptime: success ? (previous === "online" ? c.uptime : "Restarted") : c.uptime,
                maintenanceStatus: "OK",
                testHistory: [record, ...c.testHistory].slice(0, 10),
              }
            : c,
        ),
      );

      pushAuditLog(
        "Camera Connectivity Test",
        `Connection test for camera ${cam.id} — Result: ${
          success ? "Passed" : "Failed"
        }; Previous Status: ${previous.toUpperCase()}; Resulting Status: ${resulting.toUpperCase()}; ${
          success
            ? `Latency: ${latency}; endpoint reachable; stream available.`
            : `Reason: ${reason}; latency: —; stream unavailable.`
        }`,
      );

      setTestingId(null);
      setTestResult({
        id: cam.id,
        success,
        latency,
        timestamp,
        previous,
        resulting,
        reason,
        endpoint,
        stream,
      });
    }, 1500);
  }

  function handleRegister() {
    if (!cameraId.trim()) {
      setModalMessage({ title: "Registration Required", message: "Enter a unique camera ID before registering." });
      return;
    }
    if (cameras.some((c) => c.id === cameraId.trim())) {
      setModalMessage({ title: "Duplicate Camera ID", message: `${cameraId.trim()} is already registered.` });
      return;
    }
    const finalIp = ip.trim() || `10.0.4.${Math.floor(Math.random() * 90) + 20}`;
    const pos = coordsToPosition(lat, lng);
    const newCamera: Camera = seedCamera({
      id: cameraId.trim(),
      name: cameraName.trim() || `${cameraId.trim()} — Unnamed`,
      purok,
      assignment,
      purpose,
      resolution,
      ip: finalIp,
      status: "pending",
      top: pos.top,
      left: pos.left,
      enabled: true,
      registeredAt: today(),
      lastTested: "—",
      maintenanceContact,
      operatorGroup,
      mountingType,
      height: height.trim() || "4.0 m",
      orientation,
      fov,
      connectionType,
      streamProtocol,
      latency: "—",
      lastHeartbeat: "—",
      lastSuccessful: "—",
      lastFailed: "—",
      powerState: "Powered",
      uptime: "—",
      maintenanceStatus: "—",
      maintenanceHistory: [],
      lat,
      lng,
      credUser: credUser.trim() || `svc_${cameraId.trim().toLowerCase()}`,
      credPass: credPass.trim() ? maskToken(credPass) : generateCredToken(),
    });
    setCameras((prev) => [...prev, newCamera]);
    pushAuditLog(
      "Camera Registration",
      `Registered camera ${cameraId.trim()} (${resolution}, ${purpose}) assigned to ${assignment} / ${operatorGroup} — Pending connection test`,
    );
    setModalMessage({
      title: "Camera Registered",
      message: `${cameraId.trim()} registered in a Pending state. Run a connection test before the camera can be marked Active.`,
    });
    setCameraId("");
    setCameraName("");
    setPurpose(PURPOSES[0]);
    setResolution(RESOLUTIONS[0]);
    setMountingType(MOUNTING_TYPES[0]);
    setHeight("");
    setOrientation(ORIENTATIONS[0]);
    setFov("90°");
    setConnectionType(CONNECTION_TYPES[0]);
    setStreamProtocol(STREAM_PROTOCOLS[0]);
    setIp(`10.0.4.${Math.floor(Math.random() * 90) + 20}`);
    setOperatorGroup(MONITORING_GROUPS[MONITORING_GROUPS.length - 1]);
    setMaintenanceContact(MAINTENANCE_CONTACTS[MAINTENANCE_CONTACTS.length - 1]);
    setCredUser("");
    setCredPass("");
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!pickingPin || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const newLat = (14.595 + (yPct / 100) * 0.01).toFixed(4);
    const newLng = (120.98 + (xPct / 100) * 0.015).toFixed(4);
    setLat(newLat);
    setLng(newLng);
    setPickingPin(false);
    pushAuditLog("Camera Placement", `Pinned coordinates ${newLat}, ${newLng} for camera placement`);
    setModalMessage({ title: "Placement Set", message: `Camera placement coordinates set: ${newLat}, ${newLng}` });
  }

  function openEdit(cam: Camera) {
    setEditId(cam.id);
    setEditForm({
      name: cam.name,
      purok: cam.purok,
      assignment: cam.assignment,
      purpose: cam.purpose,
      resolution: cam.resolution,
      lat: cam.lat,
      lng: cam.lng,
      mountingType: cam.mountingType,
      height: cam.height,
      orientation: cam.orientation,
      fov: cam.fov,
      connectionType: cam.connectionType,
      streamProtocol: cam.streamProtocol,
      ip: cam.ip,
      operatorGroup: cam.operatorGroup,
      maintenanceContact: cam.maintenanceContact || "Unassigned",
    });
  }

  function saveEdit() {
    const prev = cameras.find((c) => c.id === editId);
    if (!prev) return;
    const pos = coordsToPosition(editForm.lat, editForm.lng);
    setCameras((prevCameras) =>
      prevCameras.map((c) =>
        c.id === editId
          ? {
              ...c,
              name: editForm.name || c.name,
              purok: editForm.purok,
              assignment: editForm.assignment,
              purpose: editForm.purpose,
              resolution: editForm.resolution,
              lat: editForm.lat,
              lng: editForm.lng,
              top: pos.top,
              left: pos.left,
              mountingType: editForm.mountingType,
              height: editForm.height,
              orientation: editForm.orientation,
              fov: editForm.fov,
              connectionType: editForm.connectionType,
              streamProtocol: editForm.streamProtocol,
              ip: editForm.ip.trim() || c.ip,
              operatorGroup: editForm.operatorGroup,
              maintenanceContact: editForm.maintenanceContact,
            }
          : c,
      ),
    );
    const changed: string[] = [];
    if (prev.assignment !== editForm.assignment) changed.push(`assigned to ${editForm.assignment}`);
    if (prev.name !== editForm.name) changed.push("name");
    if (prev.purok !== editForm.purok) changed.push("purok");
    if (prev.purpose !== editForm.purpose) changed.push("purpose");
    if (prev.resolution !== editForm.resolution) changed.push("resolution");
    if (prev.operatorGroup !== editForm.operatorGroup) changed.push(`operator assignment → ${editForm.operatorGroup}`);
    if (prev.maintenanceContact !== editForm.maintenanceContact) changed.push("maintenance contact");
    if (prev.ip !== editForm.ip.trim()) changed.push("network IP");
    if (prev.streamProtocol !== editForm.streamProtocol) changed.push("stream protocol");
    if (prev.connectionType !== editForm.connectionType) changed.push("connection type");
    if (prev.mountingType !== editForm.mountingType) changed.push("mounting");
    if (prev.height !== editForm.height) changed.push("height");
    if (prev.orientation !== editForm.orientation) changed.push("orientation");
    if (prev.fov !== editForm.fov) changed.push("field of view");
    if (prev.lat !== editForm.lat || prev.lng !== editForm.lng) changed.push("placement coordinates");
    const detail = changed.length ? ` (${changed.join(", ")})` : "";
    pushAuditLog("Camera Updated", `Updated camera ${editId}${detail}`);
    setEditId(null);
    setModalMessage({ title: "Camera Updated", message: `Updated "${editId}"` });
  }

  function deleteCamera(id: string) {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    pushAuditLog("Camera Deleted", `Deleted camera ${id}`);
    setModalMessage({ title: "Camera Removed", message: `Removed "${id}"` });
  }

  function toggleEnable(id: string) {
    const cam = cameras.find((c) => c.id === id);
    if (!cam) return;
    if (cam.enabled) {
      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled: false, status: "disabled" } : c)),
      );
      pushAuditLog("Camera Disabled", `Camera ${id} disabled by authorized user — removed from active surveillance`);
      setModalMessage({
        title: "Camera Disabled",
        message: `${id} disabled. It will not appear as Online and remains dimmed until re-enabled.`,
      });
    } else {
      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled: true, status: "pending" } : c)),
      );
      pushAuditLog("Camera Enabled", `Camera ${id} re-enabled — must pass a connection test before returning to Active`);
      setModalMessage({
        title: "Camera Enabled",
        message: `${id} re-enabled in a Pending state. Run a connection test to bring it Online.`,
      });
    }
  }

  function toggleMaintenance(id: string) {
    const cam = cameras.find((c) => c.id === id);
    if (!cam) return;
    if (cam.status === "maintenance") {
      setCameras((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: "online",
                lastTested: now(),
                maintenanceStatus: "OK",
                maintenanceHistory: [
                  {
                    date: today(),
                    type: "Inspection",
                    performedBy: cam.maintenanceContact || "Admin",
                    description: "Restored from maintenance — connectivity verified",
                    result: "Passed",
                  },
                  ...c.maintenanceHistory,
                ],
              }
            : c,
        ),
      );
      pushAuditLog("Camera Restored", `Camera ${id} restored from maintenance and returned to Active surveillance`);
      setModalMessage({
        title: "Camera Restored",
        message: `${id} is back online after maintenance.`,
      });
    } else {
      setCameras((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: "maintenance",
                maintenanceStatus: "Under Maintenance",
                maintenanceHistory: [
                  {
                    date: today(),
                    type: "Repair",
                    performedBy: cam.maintenanceContact || "Admin",
                    description: "Placed under maintenance — camera intentionally taken offline",
                    result: "Ongoing",
                  },
                  ...c.maintenanceHistory,
                ],
              }
            : c,
        ),
      );
      pushAuditLog("Camera Placed Under Maintenance", `Camera ${id} placed under maintenance — intentionally unavailable`);
      setModalMessage({
        title: "Under Maintenance",
        message: `${id} is now under maintenance and intentionally unavailable. Restore it to bring it back online.`,
      });
    }
  }

  function openCredentialEdit(cam: Camera) {
    setCredEditId(cam.id);
    setCredForm({ user: cam.credUser || "", pass: cam.credPass || "" });
    setCredShow(false);
    setViewId(null);
  }

  function saveCredentials(cam: Camera) {
    setCredConfirmId(null);
    const user = credForm.user.trim() || cam.credUser;
    const pass = credForm.pass.trim() ? maskToken(credForm.pass) : cam.credPass;
    setCameras((prev) =>
      prev.map((c) =>
        c.id === cam.id ? { ...c, credUser: user, credPass: pass } : c,
      ),
    );
    pushAuditLog(
      "Configuration Change",
      `Updated camera access credentials for ${cam.id} — new masked credential issued (value not recorded)`,
    );
    setCredEditId(null);
    setModalMessage({
      title: "Credentials Updated",
      message: `Access credentials for ${cam.id} updated. Stored server-side only and never written to the audit trail.`,
    });
  }

  const filteredCameras = cameras.filter((c) => {
    if (mapFilter !== "all" && c.status !== mapFilter) return false;
    const q = mapSearch.trim().toLowerCase();
    if (!q) return true;
    return [c.id, c.name, c.purok, c.assignment].join(" ").toLowerCase().includes(q);
  });

  const summaryParts = [`${onlineCount} online`];
  if (degradedCount > 0) summaryParts.push(`${degradedCount} degraded`);
  if (pendingCount > 0) summaryParts.push(`${pendingCount} pending`);
  if (maintenanceCount > 0) summaryParts.push(`${maintenanceCount} maintenance`);
  if (offlineCount > 0) summaryParts.push(`${offlineCount} offline`);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <style>{`
        .db-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .db-scroll::-webkit-scrollbar-track { background: transparent; }
        .db-scroll::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
        .db-scroll { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
        @keyframes feed-scan {
          0% { top: -25%; }
          100% { top: 115%; }
        }
        .feed-scan {
          height: 24%;
          background: linear-gradient(180deg, transparent, rgba(255,255,255,0.06), transparent);
          animation: feed-scan 5s linear infinite;
          pointer-events: none;
        }
      `}</style>

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">CCTV Placement &amp; Assignment</h1>
          <p className="mt-1 text-sm text-stone-500">
            Register → Configure → Place → Assign → Test → Monitor Health → Maintain → Manage CCTV cameras
          </p>
        </header>

        <div
          className={`mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-4 py-2.5 text-[12px] shadow-sm ${
            storageAlerting
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-stone-200 bg-white text-stone-600"
          }`}
        >
          <HardDrive size={13} className={storageAlerting ? "text-rose-500" : "text-[#0038A8]"} />
          <span className="font-semibold text-stone-800">CCTV Storage:</span>
          <span>
            {storage.usedGb.toLocaleString()} GB of {storage.totalGb.toLocaleString()} GB
          </span>
          <span className={`font-bold ${storageAlerting ? "text-rose-600" : "text-[#0038A8]"}`}>
            {usedPctStr}% Used
          </span>
          <span className="text-stone-400">— Warning threshold: {storage.warnThresholdPct}%</span>
          {storageAlerting && (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
              <AlertTriangle size={11} /> Action required — review retention in System Settings →
              Data Retention
            </span>
          )}
        </div>

        <div className="space-y-5">
          <SectionCard
            title="Camera Registration"
            description="Provision a new camera and place it on the barangay map"
          >
            <div className="space-y-4">
              <FormSection title="Identity &amp; Location">
                <LabeledInput
                  label="CAMERA ID"
                  placeholder="e.g. CAM-PUROK5-01"
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                />

                <LabeledInput
                  label="DISPLAY NAME / LOCATION LABEL"
                  placeholder="e.g. Riverside Corner Pole"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                />

                <SelectField
                  label="PUROK / LOCATION ZONE"
                  value={purok}
                  onChange={(e) => setPurok(e.target.value)}
                  options={PUROK_OPTIONS}
                />

                <SelectField
                  label="ASSIGNED DIGITAL BOUNDARY"
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  options={BOUNDARY_OPTIONS}
                />
              </FormSection>

              <FormSection title="Camera Specs">
                <SelectField
                  label="CAMERA PURPOSE"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  options={PURPOSES}
                />

                <SelectField
                  label="RESOLUTION"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  options={RESOLUTIONS}
                />

                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="MOUNTING TYPE"
                    value={mountingType}
                    onChange={(e) => setMountingType(e.target.value)}
                    options={MOUNTING_TYPES}
                  />
                  <LabeledInput
                    label="CAMERA HEIGHT"
                    placeholder="e.g. 4.5 m"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="ORIENTATION / DIRECTION"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    options={ORIENTATIONS}
                  />
                  <SelectField
                    label="FIELD OF VIEW (FOV)"
                    value={fov}
                    onChange={(e) => setFov(e.target.value)}
                    options={FOV_OPTIONS}
                  />
                </div>
              </FormSection>

              <FormSection title="Network">
                <LabeledInput
                  label="NETWORK IP"
                  placeholder="e.g. 10.0.4.21"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="CONNECTION TYPE"
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value)}
                    options={CONNECTION_TYPES}
                  />
                  <SelectField
                    label="STREAM PROTOCOL"
                    value={streamProtocol}
                    onChange={(e) => setStreamProtocol(e.target.value)}
                    options={STREAM_PROTOCOLS}
                  />
                </div>
              </FormSection>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={STYLES.label}>PLACEMENT COORDINATES</span>
                  <button
                    onClick={() => setPickingPin((p) => !p)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      pickingPin
                        ? "bg-[#0038A8] text-white"
                        : "border border-stone-200 text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    <MapPin size={11} />
                    {pickingPin ? "Click map..." : "Click-to-Pin"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="LATITUDE"
                    placeholder="14.5995"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    disabled={pickingPin}
                  />
                  <LabeledInput
                    label="LONGITUDE"
                    placeholder="120.9842"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    disabled={pickingPin}
                  />
                </div>
              </div>

              <FormSection title="Assignment">
                <SelectField
                  label="ASSIGNED CCTV OPERATOR / MONITORING GROUP"
                  value={operatorGroup}
                  onChange={(e) => setOperatorGroup(e.target.value)}
                  options={MONITORING_GROUPS}
                />
                <SelectField
                  label="RESPONSIBLE MAINTENANCE CONTACT"
                  value={maintenanceContact}
                  onChange={(e) => setMaintenanceContact(e.target.value)}
                  options={MAINTENANCE_CONTACTS}
                />
              </FormSection>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
                <div className="flex items-start gap-2">
                  <KeyRound size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-[#0038A8]">
                      OPTIONAL CAMERA ACCESS CREDENTIALS
                    </p>
                    <p className="mt-0.5 text-[10px] text-blue-800/80">
                      Stored server-side only — shown masked everywhere in the UI. Used to
                      authenticate to the camera stream endpoint.
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  <LabeledInput
                    label="USERNAME"
                    placeholder="e.g. svc_cam_purok5_01"
                    value={credUser}
                    onChange={(e) => setCredUser(e.target.value)}
                  />
                  <div>
                    <label className={STYLES.label}>PASSWORD / TOKEN</label>
                    <div className="relative">
                      <input
                        type={credShowPass ? "text" : "password"}
                        value={credPass}
                        onChange={(e) => setCredPass(e.target.value)}
                        placeholder="Enter access token"
                        className={STYLES.input + " pr-10"}
                      />
                      <button
                        onClick={() => setCredShowPass((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        {credShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleRegister} className={`${STYLES.primaryBtn} w-full`}>
                <Camera size={15} />
                Register &amp; Assign Camera
              </button>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-6">
              <SectionCard
                title="Camera Placement Map"
                description="Geographic placement of all CCTV nodes"
            headerRight={
              <div className="flex items-center gap-2">
                {pickingPin && (
                  <span className="rounded-md bg-[#0038A8] px-2.5 py-1 text-[11px] font-medium text-white animate-pulse">
                    Click map to place camera
                  </span>
                )}
                <span className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500">
                  {cameras.length} registered · {summaryParts.join(" · ")}
                </span>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  value={mapSearch}
                  onChange={(e) => setMapSearch(e.target.value)}
                  placeholder="Search by camera ID, location, purok or boundary"
                  className={STYLES.input + " pl-8"}
                />
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "all", label: "All Cameras" },
                  { key: "online", label: "Online" },
                  { key: "degraded", label: "Degraded" },
                  { key: "offline", label: "Offline" },
                  { key: "pending", label: "Pending" },
                  { key: "maintenance", label: "Maintenance" },
                  { key: "disabled", label: "Disabled" },
                ] as { key: "all" | CameraStatus; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setMapFilter(f.key)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                    mapFilter === f.key
                      ? "border-[#0038A8] bg-[#0038A8] text-white"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div
              ref={mapRef}
              onClick={handleMapClick}
              className="relative h-72 overflow-hidden rounded-lg border border-stone-200"
              style={{
                backgroundColor: "#d9e6de",
                backgroundImage:
                  "linear-gradient(rgba(120,140,130,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(120,140,130,0.15) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                cursor: pickingPin ? "crosshair" : "default",
              }}
            >
              {pickingPin && (
                <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 bg-[#0038A8]/90 py-1.5 text-[11px] font-semibold text-white">
                  <MapPin size={12} />
                  Click-to-Pin enabled — click anywhere on the map to set the camera placement
                </div>
              )}
              {filteredCameras.map((c) => (
                <CameraMarker key={c.id} camera={c} />
              ))}
              <span className="absolute bottom-3 right-3 rounded-md bg-white/90 px-2.5 py-1 text-[11px] text-stone-500 shadow-sm">
                Brgy. Sample, Metro Manila
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Degraded
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Offline
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-stone-400" /> Pending
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Maintenance
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-stone-400" /> Disabled
              </div>
            </div>
          </SectionCard>
          </div>
        </SectionCard>
        </div>

        {testingId && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-4 py-3 text-sm text-[#0038A8]">
            <Loader2 size={16} className="shrink-0 animate-spin" />
            <span className="font-semibold">Testing connection — {testingId}</span>
            <span className="text-xs opacity-80">
              Simulated ~1.5 s check of endpoint, stream and credentials…
            </span>
          </div>
        )}

        <section className="mt-5 rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className={STYLES.sectionTitle}>Camera Inventory</h2>
              <p className="mt-0.5 text-xs text-stone-400">
                Manage all registered CCTV nodes — {cameras.length} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                title="Demo helper — controls the simulated outcome of the next connection test"
                className="hidden text-[10px] font-semibold uppercase tracking-wider text-stone-400 sm:block"
              >
                Simulate next test
              </span>
              <select
                value={simMode}
                onChange={(e) => setSimMode(e.target.value as SimMode)}
                className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-600 outline-none transition focus:border-[#0038A8]"
              >
                <option value="auto">Auto (random)</option>
                <option value="pass">Force Pass</option>
                <option value="fail-timeout">Force Fail — Timeout</option>
                <option value="fail-endpoint">Force Fail — Endpoint</option>
                <option value="fail-credentials">Force Fail — Credentials</option>
              </select>
            </div>
          </div>

          <div className="db-scroll overflow-x-auto">
            <table className="w-full min-w-[1360px] border-collapse">
              <thead>
                <tr className="border-y border-stone-100 text-left">
                  {[
                    "STATUS",
                    "CAMERA ID",
                    "LOCATION / ZONE",
                    "ASSIGNED BOUNDARY",
                    "PURPOSE",
                    "RESOLUTION",
                    "IP ADDRESS",
                    "OPERATOR / GROUP",
                    "ACTIONS",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cameras.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-stone-100 last:border-0 ${
                      c.enabled ? "hover:bg-stone-50/50" : "bg-stone-50 opacity-60"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3 text-[12px] font-semibold text-stone-800">{c.id}</td>
                    <td className="px-5 py-3">
                      <p className="text-[12px] text-stone-600">{c.name}</p>
                      <p className="mt-0.5 text-[10px] text-stone-400">{c.purok}</p>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-stone-500">{c.assignment}</td>
                    <td className="px-5 py-3 text-[12px] text-stone-500">{c.purpose}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-[12px] text-stone-500">
                        <Video size={11} />
                        {c.resolution}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-stone-400">{c.ip}</td>
                    <td className="px-5 py-3 text-[11px] text-stone-500">{c.operatorGroup}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testConnection(c)}
                          disabled={testingId !== null}
                          title={c.status === "online" ? "Re-test camera connection" : "Test camera connection — required before Active"}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8] disabled:opacity-50"
                        >
                          {testingId === c.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-[#0038A8]" />
                          ) : (
                            <Radio size={13} />
                          )}
                        </button>
                        <button
                          onClick={() => setViewId(c.id)}
                          title="View camera details, health & maintenance records"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                        >
                          <Info size={13} />
                        </button>
                        <button
                          onClick={() => setPreviewId(c.id)}
                          title="Open live stream preview"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                        >
                          <Video size={13} />
                        </button>
                        <button
                          onClick={() => openCredentialEdit(c)}
                          title="Manage camera access credentials (masked, server-side only)"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          title="Edit camera"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-600"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => toggleMaintenance(c.id)}
                          title={c.status === "maintenance" ? "Restore from maintenance" : "Place under maintenance"}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            c.status === "maintenance"
                              ? "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
                              : "border-sky-200 text-sky-500 hover:bg-sky-50"
                          }`}
                        >
                          <Wrench size={13} />
                        </button>
                        <button
                          onClick={() => toggleEnable(c.id)}
                          title={c.enabled ? "Disable camera" : "Enable camera"}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            c.enabled
                              ? "border-amber-200 text-amber-500 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
                          }`}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(c.id)}
                          title="Delete camera"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {editId && (
        <Modal
          onClose={() => setEditId(null)}
          title="Edit Camera"
          subtitle={editId}
          footer={
            <div className="flex gap-3">
              <button
                onClick={() => setEditId(null)}
                className="flex-1 rounded-lg border border-stone-200 py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
              >
                <Save className="h-4 w-4" /> Save Changes
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormSection title="Identity &amp; Location">
              <LabeledInput
                label="DISPLAY NAME / LOCATION LABEL"
                placeholder="Camera location name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <SelectField
                label="PUROK / LOCATION ZONE"
                value={editForm.purok}
                onChange={(e) => setEditForm({ ...editForm, purok: e.target.value })}
                options={PUROK_OPTIONS}
              />
              <SelectField
                label="ASSIGNED DIGITAL BOUNDARY"
                value={editForm.assignment}
                onChange={(e) => setEditForm({ ...editForm, assignment: e.target.value })}
                options={BOUNDARY_OPTIONS}
              />
              <SelectField
                label="CAMERA PURPOSE"
                value={editForm.purpose}
                onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                options={PURPOSES}
              />
              <SelectField
                label="RESOLUTION"
                value={editForm.resolution}
                onChange={(e) => setEditForm({ ...editForm, resolution: e.target.value })}
                options={RESOLUTIONS}
              />
            </FormSection>

            <FormSection title="Placement">
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="LATITUDE"
                  placeholder="14.5995"
                  value={editForm.lat}
                  onChange={(e) => setEditForm({ ...editForm, lat: e.target.value })}
                />
                <LabeledInput
                  label="LONGITUDE"
                  placeholder="120.9842"
                  value={editForm.lng}
                  onChange={(e) => setEditForm({ ...editForm, lng: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="MOUNTING TYPE"
                  value={editForm.mountingType}
                  onChange={(e) => setEditForm({ ...editForm, mountingType: e.target.value })}
                  options={MOUNTING_TYPES}
                />
                <LabeledInput
                  label="CAMERA HEIGHT"
                  placeholder="e.g. 4.5 m"
                  value={editForm.height}
                  onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="ORIENTATION / DIRECTION"
                  value={editForm.orientation}
                  onChange={(e) => setEditForm({ ...editForm, orientation: e.target.value })}
                  options={ORIENTATIONS}
                />
                <SelectField
                  label="FIELD OF VIEW (FOV)"
                  value={editForm.fov}
                  onChange={(e) => setEditForm({ ...editForm, fov: e.target.value })}
                  options={FOV_OPTIONS}
                />
              </div>
            </FormSection>

            <FormSection title="Network">
              <LabeledInput
                label="NETWORK IP"
                placeholder="e.g. 10.0.4.21"
                value={editForm.ip}
                onChange={(e) => setEditForm({ ...editForm, ip: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="CONNECTION TYPE"
                  value={editForm.connectionType}
                  onChange={(e) => setEditForm({ ...editForm, connectionType: e.target.value })}
                  options={CONNECTION_TYPES}
                />
                <SelectField
                  label="STREAM PROTOCOL"
                  value={editForm.streamProtocol}
                  onChange={(e) => setEditForm({ ...editForm, streamProtocol: e.target.value })}
                  options={STREAM_PROTOCOLS}
                />
              </div>
            </FormSection>

            <FormSection title="Assignment">
              <SelectField
                label="ASSIGNED CCTV OPERATOR / MONITORING GROUP"
                value={editForm.operatorGroup}
                onChange={(e) => setEditForm({ ...editForm, operatorGroup: e.target.value })}
                options={MONITORING_GROUPS}
              />
              <SelectField
                label="RESPONSIBLE MAINTENANCE CONTACT"
                value={editForm.maintenanceContact}
                onChange={(e) =>
                  setEditForm({ ...editForm, maintenanceContact: e.target.value })
                }
                options={MAINTENANCE_CONTACTS}
              />
            </FormSection>

            <div className="space-y-4 border-t border-stone-200 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={STYLES.label}>DATE REGISTERED</label>
                  <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
                    <Clock size={13} className="shrink-0 text-stone-400" />
                    {cameras.find((c) => c.id === editId)?.registeredAt || "—"}
                  </div>
                </div>
                <div>
                  <label className={STYLES.label}>DATE LAST TESTED</label>
                  <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
                    <Radio size={13} className="shrink-0 text-stone-400" />
                    {cameras.find((c) => c.id === editId)?.lastTested || "—"}
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400">
                    Auto-filled from the results of the connection test.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                <KeyRound size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
                <p className="text-[11px] text-blue-800">
                  Camera access credentials are managed separately — use the key icon in the
                  inventory (or the camera detail view) to update them. Credentials are masked and
                  stored server-side only.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {viewId && (() => {
        const cam = cameras.find((c) => c.id === viewId);
        if (!cam) return null;
        return (
          <CameraDetailModal
            camera={cam}
            onClose={() => setViewId(null)}
            onEditCredentials={openCredentialEdit}
            onOpenOperatorView={(c) => {
              setViewId(null);
              setOperatorViewId(c.id);
            }}
          />
        );
      })()}

      {previewId && (() => {
        const cam = cameras.find((c) => c.id === previewId);
        if (!cam) return null;
        return (
          <Modal
            onClose={() => setPreviewId(null)}
            title={`Live Stream Preview — ${cam.name}`}
            subtitle={`${cam.id} · ${cam.purok}`}
            icon={<Video size={18} />}
            iconClass="bg-[#0038A8]/10 text-[#0038A8]"
            size="2xl"
            footer={
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewId(null)}
                  className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
                >
                  Close
                </button>
              </div>
            }
          >
            <LiveStreamPreview
              camera={cam}
              onOpenOperatorView={() => {
                setPreviewId(null);
                setOperatorViewId(cam.id);
              }}
            />
          </Modal>
        );
      })()}

      {operatorViewId && (() => {
        const cam = cameras.find((c) => c.id === operatorViewId);
        if (!cam) return null;
        return (
          <CCTVOperatorViewModal camera={cam} onClose={() => setOperatorViewId(null)} />
        );
      })()}

      {testResult && (() => {
        const cam = cameras.find((c) => c.id === testResult.id);
        if (!cam) return null;
        const passed = testResult.success;
        const failMessage =
          testResult.previous === "online" || testResult.previous === "degraded"
            ? "The camera failed the connectivity test and has been marked Offline."
            : testResult.previous === "offline"
              ? "The camera remains offline after the failed connection test."
              : "The camera could not establish a connection. It will remain Pending until a connection test succeeds.";
        return (
          <Modal
            onClose={() => setTestResult(null)}
            title={passed ? "Connection Test Passed" : "Connection Test Failed"}
            subtitle={`${testResult.id} · ${cam.name || cam.id}`}
            icon={passed ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            iconClass={passed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}
            size="lg"
            footer={
              passed ? (
                <button
                  onClick={() => setTestResult(null)}
                  className="w-full rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#002A8C]"
                >
                  Close
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const c = cam;
                      setTestResult(null);
                      testConnection(c);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#002A8C]"
                  >
                    <RotateCw size={14} /> Retry Test
                  </button>
                  <button
                    onClick={() => {
                      setTestResult(null);
                      openEdit(cam);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
                  >
                    <Pencil size={14} /> Edit Camera
                  </button>
                  <button
                    onClick={() => {
                      setTestResult(null);
                      openCredentialEdit(cam);
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold transition ${
                      testResult.reason === "Invalid Credentials"
                        ? "bg-[#0038A8] text-white shadow-sm hover:bg-[#002A8C]"
                        : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <KeyRound size={14} /> Manage Credentials
                  </button>
                  <button
                    onClick={() => {
                      setTestResult(null);
                      setViewId(cam.id);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
                  >
                    <Info size={14} /> View Details
                  </button>
                </div>
              )
            }
          >
            <div className="space-y-4">
              <div
                className={`rounded-lg border px-4 py-3 ${
                  passed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {passed ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-600" />
                  )}
                  <p className="text-sm font-bold">{passed ? "Passed" : "Failed"}</p>
                </div>
                <p className="mt-1 text-xs opacity-90">
                  {passed
                    ? "The camera successfully passed the connection test and is now Online."
                    : failMessage}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-4 text-[12px]">
                <DetailRow label="CAMERA">{testResult.id}</DetailRow>
                <DetailRow label="ENDPOINT">{testResult.endpoint}</DetailRow>
                <DetailRow label="STREAM">
                  <span
                    className={
                      passed
                        ? "font-medium text-emerald-600"
                        : "font-medium text-rose-600"
                    }
                  >
                    {testResult.stream}
                  </span>
                </DetailRow>
                <DetailRow label="REASON">{testResult.reason || "—"}</DetailRow>
                <DetailRow label="LATENCY" mono>
                  {testResult.latency}
                </DetailRow>
                <DetailRow label="TEST DURATION">1.5 s</DetailRow>
                <DetailRow label="TESTED">{testResult.timestamp}</DetailRow>
                <DetailRow label="RESULT">
                  <span className={`font-bold ${passed ? "text-emerald-600" : "text-rose-600"}`}>
                    {passed ? "Passed" : "Failed"}
                  </span>
                </DetailRow>
                <DetailRow label="PREVIOUS STATUS">
                  {STATUS_CONFIG[testResult.previous].label}
                </DetailRow>
                <DetailRow label="NEW STATUS">
                  <StatusBadge status={testResult.resulting} />
                </DetailRow>
              </div>

              {!passed && testResult.reason === "Invalid Credentials" && (
                <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[11px] text-amber-700">
                  <KeyRound size={12} className="mt-0.5 shrink-0" />
                  Credentials: Invalid — the stream authentication is being rejected. Update the
                  camera credentials to continue. Actual password or token values are never exposed.
                </p>
              )}
            </div>
          </Modal>
        );
      })()}

      {credEditId && (() => {
        const cam = cameras.find((c) => c.id === credEditId);
        if (!cam) return null;
        return (
          <Modal
            onClose={() => { setCredEditId(null); setCredConfirmId(null); }}
            title="Camera Access Credentials"
            subtitle={`${cam.id} — masked, server-side only`}
            size="md"
            footer={
              <div className="flex gap-3">
                <button
                  onClick={() => { setCredEditId(null); setCredConfirmId(null); }}
                  className="flex-1 rounded-lg border border-stone-200 py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setCredConfirmId(cam.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
                >
                  <KeyRound className="h-4 w-4" /> Save Credentials
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <LabeledInput
                label="USERNAME"
                placeholder="e.g. svc_cam_gate_01"
                value={credForm.user}
                onChange={(e) => setCredForm((f) => ({ ...f, user: e.target.value }))}
              />
              <div>
                <label className={STYLES.label}>PASSWORD / TOKEN</label>
                <div className="relative">
                  <input
                    type={credShow ? "text" : "password"}
                    value={credForm.pass}
                    onChange={(e) =>
                      setCredForm((f) => ({ ...f, pass: e.target.value }))
                    }
                    placeholder="Enter new access token"
                    className={STYLES.input + " pr-10"}
                  />
                  <button
                    onClick={() => setCredShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {credShow ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-stone-400">
                  Type a new token to replace the current value. Credentials are stored server-side
                  only and never written to the audit trail.
                </p>
              </div>
            </div>
          </Modal>
        );
      })()}

      {credConfirmId && (() => {
        const cam = cameras.find((c) => c.id === credConfirmId);
        if (!cam) return null;
        return (
          <ConfirmModal
            type="confirm"
            title="Update Camera Access Credentials"
            message={`Update the access credentials for ${cam.id}? The current username/password is invalidated and the new credential is stored server-side only. Credential values are never written to the audit trail.`}
            confirmLabel="Update Credentials"
            onConfirm={() => saveCredentials(cam)}
            onClose={() => setCredConfirmId(null)}
          />
        );
      })()}

      {deleteConfirmId && (
        <ConfirmModal
          type="confirm"
          title="Confirm Delete"
          message={`Are you sure you want to delete camera "${deleteConfirmId}"?`}
          onConfirm={() => {
            deleteCamera(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
          onClose={() => setDeleteConfirmId(null)}
        />
      )}

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
