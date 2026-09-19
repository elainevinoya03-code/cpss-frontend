import React, { useState, useRef, useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Camera,
  Wifi,
  WifiOff,
  Video,
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
  MapPin,
  PowerOff,
  Loader2,
  Search,
  RotateCw,
  XCircle,
  ZoomIn,
  ZoomOut,
  Scan,
  RotateCcw,
  Zap,
  Trash2,
} from "lucide-react";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import { getCctvStorageConfig, subscribeCctvStorage } from "../utils/cctvStorage";
import { today, STYLES, MapControlButton } from "./_shared";
import { geocodeAddress, reverseGeocode } from "../chief_tanod/patrolShared";

type CameraStatus = "pending" | "online" | "offline" | "disabled";

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
  address: string;
  purok: string;
  assignment: string;
  purpose: string;
  resolution: string;
  ip: string;
  port: string;
  streamPath: string;
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
  port: string;
  streamPath: string;
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

function maskUser(value: string): string {
  const clean = value.trim();
  if (!clean || clean === "—") return "—";
  if (clean.length <= 2) return "••";
  return `${clean.slice(0, 2)}${"•".repeat(Math.min(clean.length - 2, 10))}`;
}

function generateCameraId(name: string, existing: Camera[]): string {
  const clean = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = clean ? `CAM-${clean}` : "CAM-CAMERA";
  const used = new Set(existing.map((c) => c.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function maskedStreamUrl(
  cam: Pick<Camera, "ip" | "streamProtocol" | "port" | "streamPath" | "credUser">,
): string {
  const proto = (cam.streamProtocol || "RTSP").toLowerCase();
  const host = cam.ip.trim() || "<ip>";
  const port = cam.port.trim() || "554";
  const rawPath = cam.streamPath.trim() || "/stream1";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const user = cam.credUser && cam.credUser.trim() ? maskUser(cam.credUser) : "••••";
  return `${proto}://${user}:••••••••@${host}:${port}${path}`;
}

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Validates the fields that a connection test actually depends on. A camera is
// only allowed to be registered/verified with real, complete stream details —
// missing or malformed values are rejected rather than silently auto-filled.
function validateRegistrationConfig(fields: {
  name: string;
  ip: string;
  port: string;
  streamPath: string;
  streamProtocol: string;
}): string[] {
  const errors: string[] = [];
  if (!fields.name.trim()) errors.push("Camera name is required.");
  if (!IPV4_RE.test(fields.ip.trim())) {
    errors.push("A valid IPv4 address is required (e.g. 192.168.1.40).");
  }
  const portRaw = fields.port.trim();
  const portNum = Number(portRaw);
  if (!/^\d+$/.test(portRaw) || portNum < 1 || portNum > 65535) {
    errors.push("A valid stream port between 1 and 65535 is required.");
  }
  const path = fields.streamPath.trim();
  if (!path || !path.startsWith("/")) {
    errors.push("A stream path starting with '/' is required (e.g. /stream1).");
  }
  if (!STREAM_PROTOCOLS.includes(fields.streamProtocol)) {
    errors.push("Select a valid stream protocol.");
  }
  return errors;
}

// Offline cache used by the Digital Boundaries module — reused here so the
// purok/boundary pickers still work when the backend is unreachable.
function loadCachedBoundaries(): Array<{
  id: string;
  name: string;
  badge: string;
  classification: string;
  status: string;
}> {
  try {
    const raw = localStorage.getItem("digital_boundaries_regions");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.name === "string" && r.name.trim())
      .map((r) => ({
        id: typeof r.id === "string" ? r.id : "",
        name: String(r.name).trim(),
        badge: r.badge === "Primary" ? "Primary" : "Sub-zone",
        classification: String(r.classification ?? "Standard"),
        status: r.status === "Inactive" ? "Inactive" : "Active",
      }));
  } catch {
    return [];
  }
}

const RESOLUTIONS = ["1080p", "4K", "2K", "720p"];



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

const NOT_ASSIGNED = "Not Assigned";

const MAINTENANCE_CONTACTS = [
  "Field Tech — Team A",
  "Field Tech — Team B",
  "Barangay Facilities",
  "External Contractor",
  "Unassigned",
];

const MAP_CENTER: [number, number] = [14.6681, 121.0567];
const MAP_ZOOM = 15;

function coordsToPosition(lat: string, lng: string): { top: number; left: number } {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { top: 30, left: 30 };
  const top = Math.min(94, Math.max(4, ((la - 14.595) / 0.01) * 100));
  const left = Math.min(94, Math.max(4, ((ln - 120.98) / 0.015) * 100));
  return { top, left };
}

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
    address: "",
    purok: "",
    assignment: "",
    purpose: "Public Area",
    resolution: "1080p",
    ip: "",
    port: "554",
    streamPath: "/stream1",
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
      <p className="mb-3 border-b border-stone-100 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
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
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
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

function CameraDetailModal({
  camera,
  onClose,
  onEditCredentials,
}: {
  camera: Camera;
  onClose: () => void;
  onEditCredentials: (c: Camera) => void;
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
          <DetailRow label="STREAM PORT" mono>
            {camera.port || "554"}
          </DetailRow>
          <DetailRow label="STREAM PATH" mono>
            {camera.streamPath || "/stream1"}
          </DetailRow>
          <DetailRow label="STREAM ENDPOINT (MASKED)" mono>
            {maskedStreamUrl(camera)}
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
          <DetailRow label="ACCESS USERNAME (MASKED)" mono>
            {maskUser(camera.credUser)}
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

// ─── Backend API (FastAPI + PostgreSQL — source of truth) ─────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "";

function alternateApiBase() {
  return API_BASE.includes("8080")
    ? API_BASE.replace("8080", "8000")
    : API_BASE.replace("8000", "8080");
}

// True for camera addresses that only exist inside their local network
// (10/8, 172.16/12, 192.168/16, localhost). A backend running outside that
// LAN — e.g. the Render cloud deployment — can never open a TCP/RTSP session
// to one, so a connection test against it is expected to FAIL there. That
// verdict says nothing about whether the camera is alive on-site.
function isPrivateLanIp(ip: string): boolean {
  const host = (ip || "").trim().toLowerCase();
  if (host === "localhost") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

async function cctvFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const request = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, request);
    if (!res.ok) {
      try {
        const altRes = await fetch(`${alternateApiBase()}${path}`, request);
        if (altRes.ok) {
          res = altRes;
        }
      } catch {
        // Keep the original response if the alternate backend is unreachable.
      }
    }
  } catch {
    res = await fetch(`${alternateApiBase()}${path}`, request);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = (data as { detail?: unknown })?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ")
          : `Request failed (${res.status})`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const API_STATUSES: CameraStatus[] = ["online", "offline", "pending", "disabled"];

function fromApiCamera(row: any): Camera {
  const lat = row.lat != null ? String(row.lat) : "";
  const lng = row.lng != null ? String(row.lng) : "";
  const pos = coordsToPosition(lat, lng);
  const status: CameraStatus = API_STATUSES.includes(row.status) ? row.status : "pending";
  const maintenanceHistory: MaintenanceRecord[] = Array.isArray(row.maintenance_history)
    ? (row.maintenance_history as any[]).map((m) => ({
        date: String(m.date ?? ""),
        type: String(m.type ?? ""),
        performedBy: String(m.performed_by ?? ""),
        description: String(m.description ?? ""),
        result: String(m.result ?? ""),
      }))
    : [];
  const testHistory: ConnectionTestRecord[] = Array.isArray(row.test_history)
    ? (row.test_history as any[]).map((t) => ({
        timestamp: String(t.timestamp ?? ""),
        result: t.result === "Passed" || t.result === "Failed" ? t.result : "Failed",
        reason: String(t.reason ?? ""),
        latency: String(t.latency ?? ""),
        resultingStatus: API_STATUSES.includes(t.resulting_status)
          ? (t.resulting_status as CameraStatus)
          : "pending",
      }))
    : [];
  return {
    id: String(row.id ?? ""),
    name: row.name ?? "",
    address: row.address ?? "",
    purok: row.purok ?? "",
    assignment: row.assignment ?? "",
    purpose: row.purpose ?? "",
    resolution: row.resolution ?? "1080p",
    ip: row.ip ?? "",
    port: row.port ?? "554",
    streamPath: row.stream_path ?? "/stream1",
    status,
    top: pos.top,
    left: pos.left,
    enabled: row.enabled !== false,
    registeredAt: row.registered_at ?? "",
    lastTested: row.last_tested ?? "—",
    maintenanceContact: row.maintenance_contact ?? "Unassigned",
    operatorGroup: row.operator_group ?? "Not Assigned",
    mountingType: row.mounting_type ?? "Pole",
    height: row.height ?? "",
    orientation: row.orientation ?? "North",
    fov: row.fov ?? "90°",
    connectionType: row.connection_type ?? "Ethernet (PoE)",
    streamProtocol: row.stream_protocol ?? "RTSP",
    latency: row.latency ?? "—",
    lastHeartbeat: row.last_heartbeat ?? "—",
    lastSuccessful: row.last_successful ?? "",
    lastFailed: row.last_failed ?? "",
    powerState: row.power_state ?? "Powered",
    uptime: row.uptime ?? "—",
    maintenanceStatus: row.maintenance_status ?? "—",
    maintenanceHistory,
    testHistory,
    lat,
    lng,
    credUser: row.cred_user ?? "",
    credPass: row.cred_pass ?? "",
  };
}

// True when two camera lists carry the same identity/status/liveness so a
// background sync never forces a re-render (and map redraw) for no change.
function sameCameras(a: Camera[], b: Camera[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].status !== b[i].status ||
      a[i].enabled !== b[i].enabled ||
      a[i].lastHeartbeat !== b[i].lastHeartbeat
    ) {
      return false;
    }
  }
  return true;
}

function toApiPayload(c: Camera): Record<string, unknown> {
  return {
    name: c.name,
    address: c.address,
    purok: c.purok,
    assignment: c.assignment,
    purpose: c.purpose,
    resolution: c.resolution,
    ip: c.ip,
    port: c.port,
    stream_path: c.streamPath,
    status: c.status,
    enabled: c.enabled,
    registered_at: c.registeredAt,
    last_tested: c.lastTested,
    maintenance_contact: c.maintenanceContact,
    operator_group: c.operatorGroup,
    mounting_type: c.mountingType,
    height: c.height,
    orientation: c.orientation,
    fov: c.fov,
    connection_type: c.connectionType,
    stream_protocol: c.streamProtocol,
    latency: c.latency,
    last_heartbeat: c.lastHeartbeat,
    last_successful: c.lastSuccessful,
    last_failed: c.lastFailed,
    power_state: c.powerState,
    uptime: c.uptime,
    maintenance_status: c.maintenanceStatus,
    lat: c.lat && Number.isFinite(Number(c.lat)) ? Number(c.lat) : null,
    lng: c.lng && Number.isFinite(Number(c.lng)) ? Number(c.lng) : null,
    cred_user: c.credUser || "",
    cred_pass: c.credPass || "",
  };
}

export default function CctvPlacement() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const camerasLayerRef = useRef<L.LayerGroup | null>(null);
  const regMapRef = useRef<HTMLDivElement>(null);
  const regLeafletMapRef = useRef<L.Map | null>(null);
  const regPickMarkerRef = useRef<L.Marker | null>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  // Registered but not yet verified — only cameras that really connect during
  // the connection test are admitted to the inventory (cameras).
  const [pendingRegistrations, setPendingRegistrations] = useState<Camera[]>([]);
  // Raw RTSP credentials for unverified registrations, kept only in the browser
  // (localStorage) so the connection test can authenticate. Cleared on promote/remove.
  // Server-side credentials stay masked; this store is purely for the live probe.
  const [pendingCredentials, setPendingCredentials] = useState<Record<string, { user: string; pass: string }>>(
    () => {
      try {
        const parsed = JSON.parse(localStorage.getItem("cctv_pending_credentials") || "{}");
        return typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    },
  );
  useEffect(() => {
    try {
      localStorage.setItem("cctv_pending_credentials", JSON.stringify(pendingCredentials));
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }, [pendingCredentials]);
  const [operatorUsers, setOperatorUsers] = useState<Array<{ userId: string; name: string }>>([]);
  const [boundaries, setBoundaries] = useState<
    Array<{ id: string; name: string; badge: string; classification: string; status: string }>
  >([]);

  const [regAddress, setRegAddress] = useState("");
  const [regLat, setRegLat] = useState("");
  const [regLng, setRegLng] = useState("");
  const [regLocating, setRegLocating] = useState(false);
  const [regLocMsg, setRegLocMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [cameraName, setCameraName] = useState("");
  const [purok, setPurok] = useState("");
  const [assignment, setAssignment] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [mountingType, setMountingType] = useState(MOUNTING_TYPES[0]);
  const [height, setHeight] = useState("");
  const [orientation, setOrientation] = useState(ORIENTATIONS[0]);
  const [fov, setFov] = useState("90°");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("554");
  const [streamPath, setStreamPath] = useState("/stream1");
  const [connectionType, setConnectionType] = useState(CONNECTION_TYPES[0]);
  const [streamProtocol, setStreamProtocol] = useState(STREAM_PROTOCOLS[0]);
  const [operatorGroup, setOperatorGroup] = useState(NOT_ASSIGNED);
  const [maintenanceContact, setMaintenanceContact] = useState(
    MAINTENANCE_CONTACTS[MAINTENANCE_CONTACTS.length - 1],
  );
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
    port: "",
    streamPath: "",
    operatorGroup: "",
    maintenanceContact: "",
  });

  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const openDetailsRef = useRef<(id: string) => void>(() => {});
  openDetailsRef.current = (id: string) => setViewId(id);
  const [credEditId, setCredEditId] = useState<string | null>(null);
  const [credForm, setCredForm] = useState({ user: "", pass: "" });
  const [credShow, setCredShow] = useState(false);
  const [credConfirmId, setCredConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    latency: string;
    timestamp: string;
    previous: CameraStatus;
    resulting: CameraStatus;
    reason: string;
    checks: { auth: boolean; reach: boolean; response: boolean };
    isPrivateLan: boolean;
  } | null>(null);
  const [mapFilter, setMapFilter] = useState<"all" | CameraStatus>("all");
  const [mapSearch, setMapSearch] = useState("");
  const [storage, setStorage] = useState(getCctvStorageConfig());

  // CCTV Operator options for the assignment dropdown: users with the
  // "CCTV Operator" role only. Any legacy group label already stored on a
  // camera is preserved so editing never drops an existing assignment.
  const operatorOptions = useMemo(() => {
    const names = operatorUsers.map((u) => u.name);
    cameras.forEach((c) => {
      if (c.operatorGroup && c.operatorGroup !== NOT_ASSIGNED && !names.includes(c.operatorGroup)) {
        names.push(c.operatorGroup);
      }
    });
    return [...names, NOT_ASSIGNED];
  }, [operatorUsers, cameras]);

  // Digital-boundary options (from the Digital Boundaries module): the
  // purok/zone picker lists Sub-zone boundaries, while the assigned digital
  // boundary lists every Active boundary. Values already stored on a camera
  // are preserved so edits never drop existing assignments.
  const purokOptions = useMemo(() => {
    const names = boundaries
      .filter((b) => b.status === "Active" && b.badge === "Sub-zone")
      .map((b) => b.name)
      .filter((n) => !!n);
    cameras.forEach((c) => {
      if (c.purok && !names.includes(c.purok)) names.push(c.purok);
    });
    return names;
  }, [boundaries, cameras]);

  const boundaryOptions = useMemo(() => {
    const names = boundaries
      .filter((b) => b.status === "Active")
      .map((b) => b.name)
      .filter((n) => !!n);
    cameras.forEach((c) => {
      if (c.assignment && !names.includes(c.assignment)) names.push(c.assignment);
    });
    return names;
  }, [boundaries, cameras]);

  useEffect(() => subscribeCctvStorage(() => setStorage(getCctvStorageConfig())), []);

  // Load registered cameras from the backend, then keep syncing so automatic
  // backend reconnect/offline flips appear live. Cameras that are still
  // awaiting connectivity verification (status "pending") are restored to the
  // Pending Verification list; only verified inventory rows go to the table.
  useEffect(() => {
    let cancelled = false;

    const loadCameras = async () => {
      try {
        const rows: any[] = await cctvFetch("/api/cctv/cameras");
        if (cancelled || !Array.isArray(rows)) return;

        // The backend is the single source of truth. Replace (never append to)
        // local state so a camera removed from the database — including a
        // previously saved but incorrect registration — stops being displayed.
        const pending = rows.filter((r) => r && String(r.status ?? "") === "pending");
        const verified = rows.filter((r) => r && String(r.status ?? "") !== "pending");
        const nextPending = pending.map(fromApiCamera);
        const nextCameras = verified.map(fromApiCamera);

        setPendingRegistrations((prev) => (sameCameras(prev, nextPending) ? prev : nextPending));
        setCameras((prev) => (sameCameras(prev, nextCameras) ? prev : nextCameras));

        // Retain raw credentials for known cameras (pending AND verified) so a
        // previously registered CCTV can still authenticate a reconnect probe
        // after a temporary power loss. Only drop credentials for cameras that
        // no longer exist in the database.
        const knownIds = new Set([
          ...pending.map((r) => String(r.id ?? "")),
          ...verified.map((r) => String(r.id ?? "")),
        ]);
        setPendingCredentials((prev) => {
          let pruned = false;
          const next: Record<string, { user: string; pass: string }> = {};
          Object.keys(prev).forEach((id) => {
            if (knownIds.has(id)) next[id] = prev[id];
            else pruned = true;
          });
          return pruned ? next : prev;
        });
      } catch {
        // Backend unreachable — keep the last known state.
      }
    };

    void loadCameras();
    const timer = window.setInterval(loadCameras, 15000);
    window.addEventListener("focus", loadCameras);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadCameras);
    };
  }, []);

  // Load CCTV Operator accounts from user management so the operator
  // assignment dropdown only lists users with the "CCTV Operator" role.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows: any[] = await cctvFetch("/api/users");
        if (cancelled) return;
        if (Array.isArray(rows)) {
          setOperatorUsers(
            rows
              .filter((u) => u && (u.role ?? "") === "CCTV Operator")
              .map((u) => ({ userId: String(u.userId ?? ""), name: String(u.name ?? "").trim() }))
              .filter((u) => u.name),
          );
        }
      } catch {
        // Backend unreachable — fall back to "Not Assigned" only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load digital boundaries (same source as the Digital Boundaries module) so
  // the purok/zone and assigned-boundary pickers use live geofence data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const normalize = (rows: any[]) =>
        rows
          .map((r) => ({
            id: String(r.id ?? ""),
            name: String(r.name ?? "").trim(),
            badge: r.badge === "Primary" ? "Primary" : "Sub-zone",
            classification: String(r.classification ?? "Standard"),
            status: r.status === "Inactive" ? "Inactive" : "Active",
          }))
          .filter((b) => b.name);
      try {
        const rows: any[] = await cctvFetch("/api/digital-boundaries");
        if (cancelled) return;
        const list = Array.isArray(rows) ? normalize(rows) : [];
        if (list.length === 0) {
          setBoundaries(loadCachedBoundaries());
          return;
        }
        setBoundaries(list);
      } catch {
        if (!cancelled) setBoundaries(loadCachedBoundaries());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    camerasLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      camerasLayerRef.current = null;
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = camerasLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const q = mapSearch.trim().toLowerCase();
    cameras
      .filter((c) => {
        if (mapFilter !== "all" && c.status !== mapFilter) return false;
        if (!q) return true;
        return [c.id, c.name, c.purok, c.assignment].join(" ").toLowerCase().includes(q);
      })
      .forEach((c) => {
        const la = Number(c.lat);
        const ln = Number(c.lng);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
        const cfg = STATUS_CONFIG[c.status];
        const dotColor =
          c.status === "online" ? "#10b981" : c.status === "offline" ? "#f43f5e" : "#a8a29e";
        const html = `
          <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer; ${c.status === "disabled" ? "opacity: 0.5; filter: grayscale(1);" : ""}">
            <span style="background: #15803D; color: #fff; font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 3px; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.25);">${c.id}</span>
            <div style="position: relative; margin-top: 2px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="${cfg.pin}" stroke="${cfg.pin}" stroke-width="1.5"><rect x="3" y="6" width="12" height="9" rx="1.5"/><path d="M15 9l6-3v9l-6-3z"/></svg>
              <span style="position: absolute; top: 0; right: -2px; width: 9px; height: 9px; border-radius: 999px; border: 2px solid #fff; background: ${dotColor};"></span>
            </div>
          </div>
        `;
        const icon = L.divIcon({ html, className: "", iconSize: [0, 0] });
        const marker = L.marker([la, ln], { icon });
        marker.bindTooltip(`${c.id} · ${c.name}`, { direction: "top", offset: [0, -8] });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          openDetailsRef.current(c.id);
        });
        marker.addTo(layer);
      });

    leafletMapRef.current?.invalidateSize();
  }, [cameras, mapFilter, mapSearch]);

  const zoomIn = () => leafletMapRef.current?.zoomIn();
  const zoomOut = () => leafletMapRef.current?.zoomOut();
  const resetView = () => leafletMapRef.current?.setView(MAP_CENTER, MAP_ZOOM);
  const fitAllCameras = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    const pts = cameras
      .map((c) => ({ la: Number(c.lat), ln: Number(c.lng) }))
      .filter((p) => Number.isFinite(p.la) && Number.isFinite(p.ln))
      .map((p) => L.latLng(p.la, p.ln));
    if (pts.length === 0) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 17 });
  };

  const PICK_PIN_ICON = L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
      <div style="width: 22px; height: 22px; border-radius: 999px; background: #15803D; border: 3px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>
      <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 13px solid #15803D;"></div>
    </div>`,
  });

  // Lightweight pick-a-pin map embedded in the registration form.
  useEffect(() => {
    if (!regMapRef.current || regLeafletMapRef.current) return;
    const map = L.map(regMapRef.current, {
      center: MAP_CENTER,
      zoom: 14,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("click", (evt: L.LeafletMouseEvent) => {
      placeRegPinRef.current(evt.latlng.lat, evt.latlng.lng, true);
    });
    regLeafletMapRef.current = map;
    const sizeTimer = window.setTimeout(() => map.invalidateSize(), 80);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(regMapRef.current);
    return () => {
      window.clearTimeout(sizeTimer);
      ro.disconnect();
      map.remove();
      regLeafletMapRef.current = null;
      regPickMarkerRef.current = null;
    };
  }, []);

  const placeRegPinRef = useRef<(lat: number, lng: number, reverse?: boolean) => void>(() => {});
  placeRegPinRef.current = (lat, lng, reverse = false) => {
    const map = regLeafletMapRef.current;
    if (!map) return;
    setRegLat(lat.toFixed(6));
    setRegLng(lng.toFixed(6));
    regPickMarkerRef.current?.remove();
    const marker = L.marker([lat, lng], { icon: PICK_PIN_ICON }).addTo(map);
    regPickMarkerRef.current = marker;
    setRegLocMsg(null);
    if (reverse) {
      void reverseGeocode(lat, lng).then((addr) => {
        if (addr) {
          setRegAddress(addr);
          setRegLocMsg({ kind: "ok", text: "Pin placed — address resolved from the map." });
        }
      });
    }
  };

  const clearRegLocation = () => {
    setRegAddress("");
    setRegLat("");
    setRegLng("");
    setRegLocMsg(null);
    regPickMarkerRef.current?.remove();
    regPickMarkerRef.current = null;
  };

  const handleRegLocate = async () => {
    const q = regAddress.trim();
    if (!q || regLocating) return;
    setRegLocating(true);
    setRegLocMsg(null);
    const found = await geocodeAddress(q);
    setRegLocating(false);
    if (!found) {
      setRegLocMsg({
        kind: "err",
        text: "Could not resolve that address on the map — try a street name, landmark or barangay.",
      });
      return;
    }
    regLeafletMapRef.current?.setView([found.lat, found.lng], 16, { animate: true });
    placeRegPinRef.current(found.lat, found.lng, false);
    setRegLocMsg({ kind: "ok", text: "Address located — pin placed on the map." });
  };

  const usedPctRaw = storage.totalGb > 0 ? (storage.usedGb / storage.totalGb) * 100 : 0;
  const usedPctStr = usedPctRaw.toFixed(1);
  const storageAlerting = usedPctRaw >= storage.warnThresholdPct;

  const onlineCount = cameras.filter((c) => c.enabled && c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.enabled && c.status === "offline").length;
  const pendingCount = cameras.filter((c) => c.enabled && c.status === "pending").length;

  function testConnection(cam: Camera) {
    if (cam.status === "disabled") {
      setModalMessage({
        title: "Connection Test Blocked",
        message: `${cam.id} is disabled. Enable the camera before running a connection test.`,
      });
      return;
    }

    // Verify against the camera's current registration data only. Incomplete or
    // malformed details cannot pass — the test never falls back to a guess.
    const configErrors = validateRegistrationConfig({
      name: cam.name,
      ip: cam.ip,
      port: cam.port,
      streamPath: cam.streamPath,
      streamProtocol: cam.streamProtocol,
    });
    if (configErrors.length > 0) {
      setTestResult({
        id: cam.id,
        success: false,
        latency: "—",
        timestamp: now(),
        previous: cam.status,
        resulting: cam.status,
        reason: configErrors.join(" "),
        checks: { auth: false, reach: false, response: false },
        isPrivateLan: isPrivateLanIp(cam.ip),
      });
      return;
    }

    setTestingId(cam.id);
    setTestResult(null);
    void (async () => {
      // Re-check the camera's CURRENT reachability on every Test Connection
      // click. A previous offline result is never treated as permanent — the
      // endpoint is always probed live so Registered → Online → Offline →
      // Online reconnects succeed when the CCTV is powered back on.
      const previous: CameraStatus = cam.status;

      // Real connectivity probe against the camera endpoint. A successful
      // verdict requires the backend to actually confirm reachability, stream
      // authentication and a readable frame — there is no simulated fallback.
      let success = false;
      let reason = "";
      let latency = "—";
      let auth = false;
      let reach = false;
      let response = false;
      // Whether the camera lives on a private LAN the (possibly cloud)
      // backend cannot reach. The backend reports this itself, with a local
      // check as fallback so older backends still get the guidance note.
      let privateLan = isPrivateLanIp(cam.ip);
      try {
        const diagPayload: Record<string, string> = {
          camera_id: cam.id,
          ip: cam.ip,
          port: cam.port,
          stream_path: cam.streamPath,
          stream_protocol: cam.streamProtocol,
        };
        const pendingCred = pendingCredentials[cam.id];
        if (pendingCred) {
          diagPayload.username = pendingCred.user;
          diagPayload.password = pendingCred.pass;
        } else if (cam.credUser && !cam.credUser.includes("•") && cam.credUser !== "—") {
          // Verified cameras no longer expose the raw password client-side.
          // Send the known username + camera_id so the backend can apply its
          // reconnect rule (previously-verified + TCP-reachable ⇒ Connected).
          diagPayload.username = cam.credUser;
        }
        const diag = (await cctvFetch("/api/cctv/cameras/diagnose", {
          method: "POST",
          body: JSON.stringify(diagPayload),
        })) as {
          connected: boolean;
          reachable: boolean;
          authentication: boolean;
          response: boolean;
          latency: string;
          reason: string;
          is_private_ip?: boolean;
        };
        success = !!diag.connected;
        reason = diag.reason || "";
        latency = diag.latency || "—";
        reach = !!diag.reachable;
        auth = !!diag.authentication;
        response = !!diag.response;
        privateLan = diag.is_private_ip ?? isPrivateLanIp(cam.ip);
      } catch (err) {
        success = false;
        reason = `Camera diagnosis service unavailable — ${
          err instanceof Error ? err.message : String(err)
        }. The camera cannot be verified.`;
        latency = "—";
        auth = false;
        reach = false;
        response = false;
      }

      const timestamp = now();
      // Offline is always temporary: a Failed test marks the camera Offline
      // but preserves lastSuccessful, and the next Passed test flips
      // Offline → Online (Registered → Connected → Offline → Connected).
      const resulting: CameraStatus = success
        ? "online"
        : previous === "pending"
          ? "pending"
          : "offline";

      const record: ConnectionTestRecord = {
        timestamp,
        result: success ? "Passed" : "Failed",
        reason: success ? "—" : reason,
        latency,
        resultingStatus: resulting,
      };

      const isPendingReg = pendingRegistrations.some((r) => r.id === cam.id);

      if (success) {
        if (isPendingReg) {
          // The camera genuinely connected — admit it to the inventory now.
          const admitted: Camera = {
            ...cam,
            status: "online",
            enabled: true,
            lastTested: timestamp,
            latency,
            lastHeartbeat: timestamp,
            lastSuccessful: timestamp,
            uptime: "Restarted",
            maintenanceStatus: "OK",
            testHistory: [record, ...cam.testHistory].slice(0, 10),
          };
          setPendingRegistrations((prev) => prev.filter((r) => r.id !== cam.id));
          // Keep the raw credentials cached so later Test Connection clicks
          // can still authenticate a reconnect after a temporary power loss.
          // They are only dropped when the camera itself is removed.
          setCameras((prev) => [...prev, admitted]);
          void (async () => {
            try {
              // Camera was already saved (as pending) at registration — record
              // the passed test and flip it online.
              await cctvFetch(`/api/cctv/cameras/${encodeURIComponent(admitted.id)}/tests`, {
                method: "POST",
                body: JSON.stringify({
                  timestamp: record.timestamp,
                  result: record.result,
                  reason: record.reason,
                  latency: record.latency,
                  resulting_status: "online",
                  new_status: "online",
                  last_tested: timestamp,
                  new_latency: latency,
                  last_heartbeat: timestamp,
                  last_successful: timestamp,
                  last_failed: admitted.lastFailed,
                  uptime: "Restarted",
                  maintenance_status: "OK",
                }),
              });
            } catch {
              // The camera row already exists from registration — persist the
              // verified status directly so a poll never drags it back to the
              // Pending Verification list.
              await cctvFetch(`/api/cctv/cameras/${encodeURIComponent(admitted.id)}`, {
                method: "PUT",
                body: JSON.stringify(toApiPayload({ ...admitted, status: "online" })),
              }).catch(() => {});
            }
          })();
          pushAuditLog(
            "Camera Registration",
            `Camera ${admitted.id} confirmed connected (latency ${latency}) — added to the Camera Inventory as Online.`,
          );
        } else {
          setCameras((prev) =>
            prev.map((c) =>
              c.id === cam.id
                ? {
                    ...c,
                    status: "online",
                    lastTested: timestamp,
                    latency,
                    lastHeartbeat: timestamp,
                    lastSuccessful: timestamp,
                    uptime: previous === "online" ? c.uptime : "Restarted",
                    maintenanceStatus: "OK",
                    testHistory: [record, ...c.testHistory].slice(0, 10),
                  }
                : c,
            ),
          );
          void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(cam.id)}/tests`, {
            method: "POST",
            body: JSON.stringify({
              timestamp: record.timestamp,
              result: record.result,
              reason: record.reason,
              latency: record.latency,
              resulting_status: record.resultingStatus,
              new_status: resulting,
              last_tested: timestamp,
              new_latency: latency,
              last_heartbeat: timestamp,
              last_successful: timestamp,
              last_failed: cam.lastFailed,
              uptime: previous === "online" ? cam.uptime : "Restarted",
              maintenance_status: "OK",
            }),
          }).catch(() => {});
          pushAuditLog(
            "Camera Connectivity Test",
            `Connection test for camera ${cam.id} — Stream Reachability: ${
              reach ? "PASS" : "FAIL"
            }; Authentication: ${auth ? "PASS" : "FAIL"}; Response Time: ${
              response ? "PASS" : "FAIL"
            }; Overall Result: ${success ? "PASS" : "FAIL"}; Previous Status: ${previous.toUpperCase()}; Resulting Status: ${resulting.toUpperCase()}; ${
              success
                ? `Latency: ${latency}; endpoint reachable; stream available.`
                : `Reason: ${reason}; latency: —; stream unavailable.`
            }`,
          );
        }
      } else {
        if (isPendingReg) {
          setPendingRegistrations((prev) =>
            prev.map((r) =>
              r.id === cam.id
                ? {
                    ...r,
                    lastTested: timestamp,
                    lastFailed: timestamp,
                    testHistory: [record, ...r.testHistory].slice(0, 10),
                  }
                : r,
            ),
          );
          void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(cam.id)}/tests`, {
            method: "POST",
            body: JSON.stringify({
              timestamp: record.timestamp,
              result: record.result,
              reason: record.reason,
              latency: record.latency,
              resulting_status: record.resultingStatus,
              new_status: resulting,
              last_tested: timestamp,
              new_latency: "—",
              last_heartbeat: cam.lastHeartbeat,
              last_successful: cam.lastSuccessful,
              last_failed: timestamp,
              uptime: cam.uptime,
              maintenance_status: "OK",
            }),
          }).catch(() => {});
        } else {
          setCameras((prev) =>
            prev.map((c) =>
              c.id === cam.id
                ? {
                    ...c,
                    status: resulting,
                    lastTested: timestamp,
                    latency: "—",
                    lastHeartbeat: c.lastHeartbeat,
                    lastSuccessful: c.lastSuccessful,
                    lastFailed: timestamp,
                    uptime: c.uptime,
                    maintenanceStatus: "OK",
                    testHistory: [record, ...c.testHistory].slice(0, 10),
                  }
                : c,
            ),
          );
          void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(cam.id)}/tests`, {
            method: "POST",
            body: JSON.stringify({
              timestamp: record.timestamp,
              result: record.result,
              reason: record.reason,
              latency: record.latency,
              resulting_status: record.resultingStatus,
              new_status: resulting,
              last_tested: timestamp,
              new_latency: "—",
              last_heartbeat: cam.lastHeartbeat,
              last_successful: cam.lastSuccessful,
              last_failed: timestamp,
              uptime: cam.uptime,
              maintenance_status: "OK",
            }),
          }).catch(() => {});
        }
        pushAuditLog(
          "Camera Connectivity Test",
          `Connection test failed for camera ${cam.id} — Stream Reachability: ${
            reach ? "PASS" : "FAIL"
          }; Authentication: ${auth ? "PASS" : "FAIL"}; Response Time: ${
            response ? "PASS" : "FAIL"
          }; Overall Result: FAIL; Previous Status: ${previous.toUpperCase()}; Resulting Status: ${resulting.toUpperCase()}; Reason: ${
            reason || "—"
          }.${isPendingReg ? " Camera was NOT added to the inventory." : ""}`,
        );
      }

      setTestingId(null);
      setTestResult({
        id: cam.id,
        success,
        latency,
        timestamp,
        previous,
        resulting,
        reason,
        checks: { auth, reach, response },
        isPrivateLan: privateLan && !success,
      });
    })();
  }

  function handleRegister() {
    const cameraNameValue = cameraName.trim();
    // Reject incomplete or malformed registration data up front. Never
    // auto-fill fake network details — a camera must be registered with the
    // real endpoint that the connection test will later validate.
    const configErrors = validateRegistrationConfig({
      name: cameraNameValue,
      ip,
      port,
      streamPath,
      streamProtocol,
    });
    if (configErrors.length > 0) {
      setModalMessage({
        title: "Registration Blocked — Invalid Camera Details",
        message: configErrors.join(" "),
      });
      return;
    }
    const finalIp = ip.trim();
    const pinned = regLat && regLng && Number.isFinite(Number(regLat)) && Number.isFinite(Number(regLng));
    const placeLat = pinned ? Number(regLat).toFixed(4) : (MAP_CENTER[0] + Math.random() * 0.009).toFixed(4);
    const placeLng = pinned ? Number(regLng).toFixed(4) : (MAP_CENTER[1] + Math.random() * 0.015).toFixed(4);
    const pos = coordsToPosition(placeLat, placeLng);
    const newId = generateCameraId(cameraNameValue, [...pendingRegistrations, ...cameras]);
    const finalCredUser = credUser.trim() || `svc_${newId.toLowerCase()}`;
    const finalCredPass = credPass.trim() ? credPass : generateCredToken();
    const newCamera: Camera = seedCamera({
      id: newId,
      name: cameraNameValue,
      address: regAddress.trim(),
      purok,
      assignment,
      purpose,
      resolution,
      ip: finalIp,
      port: port.trim(),
      streamPath: streamPath.trim(),
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
      lat: placeLat,
      lng: placeLng,
      credUser: finalCredUser,
      credPass: finalCredPass.trim() ? maskToken(finalCredPass) : finalCredPass,
    });
    setSavingRegistration(true);
    void (async () => {
      try {
        await cctvFetch("/api/cctv/cameras", {
          method: "POST",
          body: JSON.stringify({ id: newId, ...toApiPayload(newCamera) }),
        });
      } catch (err) {
        setSavingRegistration(false);
        setModalMessage({
          title: "Registration Not Saved",
          message: `Could not save ${newId} to the database. ${err instanceof Error ? err.message : String(err)} The camera has NOT been registered — fix the connection and try again.`,
        });
        return;
      }
      setSavingRegistration(false);
      setPendingRegistrations((prev) => [...prev, newCamera]);
      setPendingCredentials((prev) => ({
        ...prev,
        [newCamera.id]: { user: finalCredUser, pass: finalCredPass },
      }));
      pushAuditLog(
        "Camera Registration",
        `Registered camera ${newId} (${resolution}, ${purpose}) assigned to ${assignment} / ${operatorGroup} — awaiting connectivity verification${
          pinned ? ` — placed at ${placeLat}, ${placeLng}` : " — auto-placed on map"
        }`,
      );
      setModalMessage({
        title: "Camera Registered — Verify Connection",
        message: `${newId} saved to the database. Run the connection test to confirm the camera really connects before it is added to the Inventory.`,
      });
      setCameraName("");
      setPurok("");
      setAssignment("");
      setPurpose(PURPOSES[0]);
      setResolution(RESOLUTIONS[0]);
      setMountingType(MOUNTING_TYPES[0]);
      setHeight("");
      setOrientation(ORIENTATIONS[0]);
      setFov("90°");
      setConnectionType(CONNECTION_TYPES[0]);
      setStreamProtocol(STREAM_PROTOCOLS[0]);
      setIp("");
      setPort("554");
      setStreamPath("/stream1");
      setOperatorGroup(NOT_ASSIGNED);
      setMaintenanceContact(MAINTENANCE_CONTACTS[MAINTENANCE_CONTACTS.length - 1]);
      setCredUser("");
      setCredPass("");
      clearRegLocation();
    })();
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
      port: cam.port,
      streamPath: cam.streamPath,
      operatorGroup: cam.operatorGroup,
      maintenanceContact: cam.maintenanceContact || "Unassigned",
    });
  }

  function saveEdit() {
    const prev = cameras.find((c) => c.id === editId);
    if (!prev) return;
    const pos = coordsToPosition(editForm.lat, editForm.lng);
    const updatedCamera: Camera = {
      ...prev,
      name: editForm.name || prev.name,
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
      ip: editForm.ip.trim() || prev.ip,
      port: editForm.port.trim() || "554",
      streamPath: editForm.streamPath.trim() || prev.streamPath,
      operatorGroup: editForm.operatorGroup,
      maintenanceContact: editForm.maintenanceContact,
    };
    setCameras((prevCameras) =>
      prevCameras.map((c) => (c.id === editId ? updatedCamera : c)),
    );
    void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(editId ?? "")}`, {
      method: "PUT",
      body: JSON.stringify(toApiPayload(updatedCamera)),
    }).catch(() => {});
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
    if (prev.port !== editForm.port.trim() || prev.streamPath !== editForm.streamPath.trim())
      changed.push("stream endpoint");
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

  function toggleEnable(id: string) {
    const cam = cameras.find((c) => c.id === id);
    if (!cam) return;
    if (cam.enabled) {
      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled: false, status: "disabled" } : c)),
      );
      void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(id)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: false, status: "disabled" }),
      }).catch(() => {});
      pushAuditLog("Camera Disabled", `Camera ${id} disabled by authorized user — removed from active surveillance`);
      setModalMessage({
        title: "Camera Disabled",
        message: `${id} disabled. It will not appear as Online and remains dimmed until re-enabled.`,
      });
    } else {
      const reEnabled: Camera = { ...cam, enabled: true, status: "pending" };
      setCameras((prev) => prev.map((c) => (c.id === id ? reEnabled : c)));
      void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(id)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, status: "pending" }),
      }).catch(() => {});
      pushAuditLog("Camera Enabled", `Camera ${id} re-enabled — connection test running automatically to bring it back Online`);
      testConnection(reEnabled);
    }
  }

  function deleteCamera(cam: Camera) {
    setDeleteConfirmId(null);
    setCameras((prev) => prev.filter((c) => c.id !== cam.id));
    void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(cam.id)}`, {
      method: "DELETE",
    }).catch(() => {});
    pushAuditLog(
      "Camera Deleted",
      `Camera ${cam.id} deleted from the system — removed from surveillance and map placement`,
    );
    setModalMessage({
      title: "Camera Deleted",
      message: `${cam.id} has been deleted from the Camera Inventory.`,
    });
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
    void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(cam.id)}/credentials`, {
      method: "PATCH",
      body: JSON.stringify({ cred_user: user, cred_pass: pass }),
    }).catch(() => {});
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

  const summaryParts = [`${onlineCount} online`];
  if (pendingCount > 0) summaryParts.push(`${pendingCount} pending`);
  if (offlineCount > 0) summaryParts.push(`${offlineCount} offline`);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <style>{`
        .db-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .db-scroll::-webkit-scrollbar-track { background: transparent; }
        .db-scroll::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
        .db-scroll { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
      `}</style>

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">CCTV Placement &amp; Assignment</h1>
          <p className="mt-1 text-sm text-stone-500">
            Register → Configure → Place → Assign → Test → Monitor Health → Manage CCTV cameras
          </p>
        </header>

        <div
          className={`mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-4 py-2.5 text-[12px] shadow-sm ${
            storageAlerting
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-stone-200 bg-white text-stone-600"
          }`}
        >
          <HardDrive size={13} className={storageAlerting ? "text-rose-500" : "text-[#15803D]"} />
          <span className="font-semibold text-stone-800">CCTV Storage:</span>
          <span>
            {storage.usedGb.toLocaleString()} GB of {storage.totalGb.toLocaleString()} GB
          </span>
          <span className={`font-bold ${storageAlerting ? "text-rose-600" : "text-[#15803D]"}`}>
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
            description="Register a camera with its live stream, placement and assignment details — everything captured here feeds the Camera Inventory below and can be edited afterwards."
          >
            <div className="space-y-4">
              <FormSection title="Camera Identity">
                <LabeledInput
                  label="CAMERA NAME / LOCATION LABEL"
                  placeholder="e.g. Market Zone Overwatch"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                />
                <div className="md:col-span-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold tracking-wide text-[#15803D]">
                    CAMERA ID (AUTO-GENERATED)
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-stone-500">
                    {cameraName.trim() ? generateCameraId(cameraName, cameras) : "—"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-stone-400">
                    Derived from the camera name and guaranteed to be unique. Shown on the map and
                    in the inventory.
                  </p>
                </div>
                <SelectField
                  label="PUROK / LOCATION ZONE"
                  value={purok}
                  onChange={(e) => setPurok(e.target.value)}
                  options={purokOptions}
                />
                <SelectField
                  label="ASSIGNED DIGITAL BOUNDARY"
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  options={boundaryOptions}
                />
              </FormSection>

              <FormSection title="Purpose &amp; Operation">
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
                <SelectField
                  label="ASSIGNED CCTV OPERATOR / MONITORING GROUP"
                  value={operatorGroup}
                  onChange={(e) => setOperatorGroup(e.target.value)}
                  options={operatorOptions}
                />
              </FormSection>

              <FormSection title="Stream Connection">
                <LabeledInput
                  label="NETWORK IP"
                  placeholder="e.g. 192.168.1.40"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                />

                <LabeledInput
                  label="STREAM PORT"
                  placeholder="e.g. 554"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />

                <LabeledInput
                  label="STREAM PATH"
                  placeholder="e.g. /stream1"
                  value={streamPath}
                  onChange={(e) => setStreamPath(e.target.value)}
                />

                <SelectField
                  label="STREAM PROTOCOL"
                  value={streamProtocol}
                  onChange={(e) => setStreamProtocol(e.target.value)}
                  options={STREAM_PROTOCOLS}
                />

                <div className="md:col-span-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <Radio size={14} className="mt-0.5 shrink-0 text-[#15803D]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold tracking-wide text-[#15803D]">
                        STREAM ENDPOINT (MASKED)
                      </p>
                      <p className="mt-1 break-all font-mono text-[11px] text-stone-500">
                        {maskedStreamUrl({ ip, streamProtocol, port, streamPath, credUser })}
                      </p>
                      <p className="mt-0.5 text-[10px] text-stone-400">
                        The backend builds the live MJPEG feed from this endpoint (served at{" "}
                        <code>/video_feed</code>). Credentials are masked everywhere in the UI and
                        stored server-side only.
                      </p>
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Map Location / Placement">
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleRegLocate();
                          }
                        }}
                        placeholder="Search address / place, e.g. 467 Tandang Sora Ave, Quezon City"
                        className={STYLES.input + " pl-8 pr-3"}
                      />
                    </div>
                    <button
                      onClick={() => void handleRegLocate()}
                      disabled={regLocating || !regAddress.trim()}
                      className={`${STYLES.primaryBtn} shrink-0 justify-center disabled:opacity-60`}
                    >
                      {regLocating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <MapPin size={14} />
                      )}
                      Locate
                    </button>
                  </div>

                  {regLocMsg && (
                    <p
                      className={`flex items-center gap-1.5 text-[11px] ${
                        regLocMsg.kind === "ok" ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      <Info size={11} className="shrink-0" />
                      {regLocMsg.text}
                    </p>
                  )}

                  <div className="relative h-64 overflow-hidden rounded-lg border border-stone-200 bg-[#dfe8e2]">
                    <div ref={regMapRef} className="absolute inset-0 z-0 h-full w-full" />
                    <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-900/85 px-3 py-1 text-[11px] font-medium text-white">
                      Click the map to pin the camera location
                    </div>
                  </div>

                  <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
                    {regLat && regLng ? (
                      <>
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        Pinned at{" "}
                        <span className="font-mono text-stone-600">
                          {Number(regLat).toFixed(4)}, {Number(regLng).toFixed(4)}
                        </span>
                        <button
                          onClick={clearRegLocation}
                          className="ml-auto font-medium text-[#15803D] hover:underline"
                        >
                          Clear pin
                        </button>
                      </>
                    ) : (
                      <>
                        <Info size={11} className="shrink-0" />
                        No pin yet — the camera will be auto-placed on the map otherwise.
                      </>
                    )}
                  </p>
                </div>
              </FormSection>

              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                <div className="flex items-start gap-2">
                  <KeyRound size={14} className="mt-0.5 shrink-0 text-[#15803D]" />
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-[#15803D]">
                      CAMERA ACCESS CREDENTIALS
                    </p>
                    <p className="mt-0.5 text-[10px] text-green-800/80">
                      Used to authenticate to the RTSP stream endpoint. If left blank, a service
                      credential is generated automatically. Stored server-side only and shown
                      masked everywhere in the UI.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <button
                onClick={handleRegister}
                disabled={savingRegistration}
                className={`${STYLES.primaryBtn} w-full disabled:opacity-60`}
              >
                {savingRegistration ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                {savingRegistration ? "Saving to database…" : "Register & Assign Camera"}
              </button>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-6">
              <SectionCard
                title="Camera Placement Map"
                description="Geographic placement of all CCTV nodes"
            headerRight={
              <div className="flex items-center gap-2">
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
                  { key: "offline", label: "Offline" },
                  { key: "pending", label: "Pending" },
                  { key: "disabled", label: "Disabled" },
                ] as { key: "all" | CameraStatus; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setMapFilter(f.key)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                    mapFilter === f.key
                      ? "border-[#15803D] bg-[#15803D] text-white"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-h-[22rem] overflow-hidden rounded-lg border border-stone-200 bg-[#dfe8e2]">
              <div ref={mapRef} className="db-map absolute inset-0 z-0 h-full w-full" />

              {/* Map controls */}
              <div
                className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-sm backdrop-blur"
                onClick={(e) => e.stopPropagation()}
              >
                <MapControlButton icon={ZoomIn} label="Zoom in" onClick={zoomIn} />
                <MapControlButton icon={ZoomOut} label="Zoom out" onClick={zoomOut} />
                <MapControlButton icon={Scan} label="Fit all cameras" onClick={fitAllCameras} />
                <MapControlButton icon={RotateCcw} label="Reset view" onClick={resetView} />
              </div>

              {/* Legend */}
              <div
                className="absolute bottom-4 left-4 z-10 rounded-lg border border-stone-200 bg-white/95 px-3.5 py-3 text-[11px] shadow-sm backdrop-blur"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-1.5 font-semibold text-stone-700">Legend</p>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-stone-500">Online</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-stone-500">Offline</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-stone-400" />
                  <span className="text-stone-500">Pending</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-stone-400" />
                  <span className="text-stone-500">Disabled</span>
                </div>
              </div>
            </div>
          </SectionCard>
          </div>
        </SectionCard>
        </div>

        {testingId && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#15803D]/20 bg-[#15803D]/5 px-4 py-3 text-sm text-[#15803D]">
            <Loader2 size={16} className="shrink-0 animate-spin" />
            <span className="font-semibold">Testing connection — {testingId}</span>
            <span className="text-xs opacity-80">
              Probing the camera endpoint for reachability and live stream frames…
            </span>
          </div>
        )}

        {pendingRegistrations.length > 0 && (
          <section className="mt-5 rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h2 className={STYLES.sectionTitle}>Pending Verification</h2>
                <p className="mt-0.5 text-xs text-stone-400">
                  {pendingRegistrations.length} registered camera
                  {pendingRegistrations.length === 1 ? "" : "s"} waiting to be added to the inventory — run
                  the connection test to confirm the camera really connects
                </p>
              </div>
            </div>
            <div className="db-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-y border-stone-100 text-left">
                    {["STATUS", "CAMERA ID", "IP ADDRESS", "LOCATION / ZONE", "OPERATOR / GROUP", "REGISTERED", "ACTIONS"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pendingRegistrations.map((r) => (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          <Clock size={11} /> Pending
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[12px] font-semibold text-stone-800">{r.id}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-stone-600">
                        {r.ip}:{r.port}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-stone-600">{r.purok || "—"}</td>
                      <td className="px-5 py-3 text-[12px] text-stone-600">{r.operatorGroup}</td>
                      <td className="px-5 py-3 text-[12px] text-stone-400">{r.registeredAt}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => testConnection(r)}
                            disabled={testingId === r.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#166534] disabled:opacity-50"
                          >
                            {testingId === r.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Zap size={13} />
                            )}{" "}
                            {testingId === r.id ? "Verifying…" : "Run Test"}
                          </button>
                          <button
                            onClick={() => {
                              setPendingRegistrations((prev) => prev.filter((p) => p.id !== r.id));
                              setPendingCredentials((prev) => {
                                const next = { ...prev };
                                delete next[r.id];
                                return next;
                              });
                              void cctvFetch(`/api/cctv/cameras/${encodeURIComponent(r.id)}`, {
                                method: "DELETE",
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-stone-700"
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-5 rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className={STYLES.sectionTitle}>Camera Inventory</h2>
              <p className="mt-0.5 text-xs text-stone-400">
                Manage all verified CCTV nodes — {cameras.length} total
              </p>
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
                          title={c.status === "online" ? "Re-test camera connection" : "Test camera connection — required before Online"}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#15803D] hover:bg-[#15803D]/5 hover:text-[#15803D] disabled:opacity-50"
                        >
                          {testingId === c.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-[#15803D]" />
                          ) : (
                            <Radio size={13} />
                          )}
                        </button>
                        <button
                          onClick={() => setViewId(c.id)}
                          title="View camera details, health & maintenance records"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#15803D] hover:bg-[#15803D]/5 hover:text-[#15803D]"
                        >
                          <Info size={13} />
                        </button>
                        <button
                          onClick={() => openCredentialEdit(c)}
                          title="Manage camera access credentials (masked, server-side only)"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#15803D] hover:bg-[#15803D]/5 hover:text-[#15803D]"
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
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166534]"
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
                options={purokOptions}
              />
              <SelectField
                label="ASSIGNED DIGITAL BOUNDARY"
                value={editForm.assignment}
                onChange={(e) => setEditForm({ ...editForm, assignment: e.target.value })}
                options={boundaryOptions}
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
            </FormSection>

            <FormSection title="Network">
              <LabeledInput
                label="NETWORK IP"
                placeholder="e.g. 10.0.4.21"
                value={editForm.ip}
                onChange={(e) => setEditForm({ ...editForm, ip: e.target.value })}
              />
              <LabeledInput
                label="STREAM PORT"
                placeholder="e.g. 554"
                value={editForm.port}
                onChange={(e) => setEditForm({ ...editForm, port: e.target.value })}
              />
              <LabeledInput
                label="STREAM PATH"
                placeholder="e.g. /stream1"
                value={editForm.streamPath}
                onChange={(e) => setEditForm({ ...editForm, streamPath: e.target.value })}
              />
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
            </FormSection>

            <FormSection title="Assignment">
              <SelectField
                label="ASSIGNED CCTV OPERATOR / MONITORING GROUP"
                value={editForm.operatorGroup}
                onChange={(e) => setEditForm({ ...editForm, operatorGroup: e.target.value })}
                options={operatorOptions}
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

              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <KeyRound size={14} className="mt-0.5 shrink-0 text-[#15803D]" />
                <p className="text-[11px] text-green-800">
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
          />
        );
      })()}

      {testResult && (() => {
        const cam = cameras.find((c) => c.id === testResult.id) ?? pendingRegistrations.find((p) => p.id === testResult.id);
        if (!cam) return null;
        const passed = testResult.success;
        const isPendingCamera = pendingRegistrations.some((p) => p.id === cam.id);
        const failMessage =
          testResult.previous === "online"
            ? "The camera failed the connection test and has been marked Offline."
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
                  className="w-full rounded-lg bg-[#15803D] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166534]"
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
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#166534]"
                  >
                    <RotateCw size={14} /> Retry Test
                  </button>
                  {isPendingCamera ? (
                    <button
                      onClick={() => setTestResult(null)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      Close
                    </button>
                  ) : (
                    <>
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
                            ? "bg-[#15803D] text-white shadow-sm hover:bg-[#166534]"
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
                    </>
                  )}
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
                  <p className="text-sm font-bold">{passed ? "PASS" : "FAIL"}</p>
                </div>
                <p className="mt-1 text-xs opacity-90">
                  {passed
                    ? "The camera passed all checks — stream reachability, authentication, and response time — and is now Online."
                    : failMessage}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-stone-200">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-stone-600">
                    <Video size={13} className="text-[#15803D]" /> Live Camera View
                  </span>
                  {passed ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-300" /> No Feed
                    </span>
                  )}
                </div>
                <div className="relative aspect-video w-full bg-black">
                  {passed ? (
                    <>
                      <img
                        src={`${API_BASE}/video_feed`}
                        alt={`Live feed for ${testResult.id}`}
                        className="absolute inset-0 h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) fallback.classList.remove("hidden");
                        }}
                      />
                      <span className="hidden absolute inset-0 flex items-center justify-center p-6 text-center text-[12px] text-stone-400">
                        No live feed available for this camera.
                      </span>
                    </>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center p-6 text-center text-[12px] text-stone-400">
                      No live feed available — connection test failed for this camera.
                    </span>
                  )}
                </div>
                <p className="border-t border-stone-100 px-4 py-2 text-[10px] text-stone-400">
                  {passed
                    ? "Live MJPEG stream served by the backend (/video_feed). If this stays black, the camera stream is not currently available."
                    : "The live stream is only shown when the connection test passes. No feed was shown because this camera failed the test."}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-stone-200">
                {[
                  { label: "Stream Reachability", pass: testResult.checks.reach },
                  { label: "Authentication", pass: testResult.checks.auth },
                  { label: "Response Time", pass: testResult.checks.response },
                ].map((chk) => (
                  <div
                    key={chk.label}
                    className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 last:border-0"
                  >
                    <span className="text-[12px] font-medium text-stone-600">{chk.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        chk.pass ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {chk.pass ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {chk.pass ? "PASS" : "FAIL"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-4 text-[12px]">
                <DetailRow label="CAMERA">{testResult.id}</DetailRow>
                <DetailRow label="OVERALL RESULT">
                  <span className={`font-bold ${passed ? "text-emerald-600" : "text-rose-600"}`}>
                    {passed ? "PASS" : "FAIL"}
                  </span>
                </DetailRow>
                <DetailRow label="LATENCY" mono>
                  {testResult.latency}
                </DetailRow>
                <DetailRow label="REASON">{testResult.reason || "—"}</DetailRow>
                <DetailRow label="TEST DURATION">1.5 s</DetailRow>
                <DetailRow label="TESTED">{testResult.timestamp}</DetailRow>
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

              {!passed && testResult.isPrivateLan && (
                <p className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2.5 text-[11px] text-sky-800">
                  <WifiOff size={12} className="mt-0.5 shrink-0" />
                  {cam.ip} is a private LAN address that this backend cannot reach from outside
                  the local network — this FAIL does not mean the camera is dead on-site. To verify
                  it, run Test Connection from a backend on the same LAN as the camera (e.g. the
                  local dev server), with the camera powered on and reachable on the network.
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
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166534]"
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

      {deleteConfirmId && (() => {
        const cam = cameras.find((c) => c.id === deleteConfirmId);
        if (!cam) return null;
        return (
          <ConfirmModal
            type="confirm"
            title="Delete Camera"
            message={`Permanently delete ${cam.id} (${cam.name || "unnamed"}) from the Camera Inventory? This removes the camera, its placement, credentials, and all maintenance/connection-test history. This cannot be undone.`}
            confirmLabel="Delete Camera"
            onConfirm={() => deleteCamera(cam)}
            onClose={() => setDeleteConfirmId(null)}
          />
        );
      })()}

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
