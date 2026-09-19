import React, { useState, useEffect, useRef } from "react";
import {
  Eye,
  Users,
  TrafficCone,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  HardDrive,
  Info,
  Flag,
  Search,
  LayoutGrid,
  Settings2,
  Gauge,
  Wifi,
  WifiOff,
  Signal,
  Maximize2,
  Minimize2,
  RefreshCw,
  Loader2,
  User,
  Wrench,
  Link2,
  Plus,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { ConfirmModal, Modal } from "../components/ui";
import { refreshIncidents } from "../desk_officer/incidentStore";

const DEDUP_MS = 5 * 60 * 1000;
const STORAGE_TOTAL_GB = 2000;
const STORAGE_START_GB = 1680;

type EventCategory =
  | "Suspicious Activity"
  | "Unusual Gathering"
  | "Road Obstruction"
  | "Public Disturbance"
  | "Hazard"
  | "Other";

type IncidentAction = "create_new" | "link_existing";

type QualityMode = "auto" | "high" | "medium" | "low";

interface CameraFeed {
  id: string;
  name: string;
  location: string;
  purok: string;
  ip: string;
  nativeProtocol: "RTSP" | "HLS";
  status: "online" | "degraded" | "offline";
  signalPct: number;
  rtspUrl: string;
  hlsUrl: string;
  feedUrl?: string;
}

interface CctvEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  cameraLocation: string;
  cameraPurok: string;
  category: EventCategory;
  notes?: string;
  timestamp: string;
  operator: string;
  incidentAction: IncidentAction;
  incidentId: string;
  incidentStatus: string;
}

interface ExistingIncident {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface CameraFault {
  id: string;
  cameraId: string;
  cameraName: string;
  severity: string;
  description: string;
  reportedAt: string;
  operator: string;
  status: "open" | "resolved";
  ticket: string;
}

/* -------------------------------------------------------------------------- */
/*  Backend API — single source of truth for camera records                   */
/*                                                                            */
/*  The Surveillance Matrix only ever displays cameras that were successfully */
/*  registered and verified through cctv_placement.tsx (status online/offline */
/*  in the database). Pending or disabled registrations are never shown.       */
/* -------------------------------------------------------------------------- */

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function alternateApiBase() {
  return API_BASE.includes("8080")
    ? API_BASE.replace("8080", "8000")
    : API_BASE.replace("8000", "8080");
}

async function cctvFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const doFetch = (base: string) =>
    fetch(`${base}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
  let res: Response;
  try {
    res = await doFetch(API_BASE);
    if (!res.ok) {
      try {
        const alt = await doFetch(alternateApiBase());
        if (alt.ok) res = alt;
      } catch {
        // Keep the original response if the alternate backend is unreachable.
      }
    }
  } catch {
    res = await doFetch(alternateApiBase());
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data?.detail || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

interface ApiCctvEvent {
  id: string;
  camera_id: string;
  camera_name: string;
  camera_location: string;
  camera_purok: string;
  category: string;
  notes?: string | null;
  timestamp: string;
  operator: string;
  incident_action: "create_new" | "link_existing";
  incident_id: string;
  incident_status: string;
}

interface ApiCreateCctvEventPayload {
  id: string;
  camera_id: string;
  camera_name: string;
  camera_location: string;
  camera_purok: string;
  category: string;
  notes?: string | null;
  timestamp: string;
  operator: string;
  incident_action: "create_new" | "link_existing";
  incident_id?: string | null;
}

async function fetchCctvEvents(): Promise<ApiCctvEvent[]> {
  return cctvFetch<ApiCctvEvent[]>("/api/cctv/events");
}

async function createCctvEvent(payload: ApiCreateCctvEventPayload): Promise<ApiCctvEvent> {
  return cctvFetch<ApiCctvEvent>("/api/cctv/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* Mapping helpers — the backend incidents wire shape is snake_case. */
interface ApiIncidentRow {
  id?: string;
  description?: string;
  category?: string;
  status?: string;
  priority?: string;
  time?: string;
}

function toCctvEvent(row: ApiCctvEvent): CctvEvent {
  const isKnownCategory = EVENT_CATEGORIES.some((c) => c.key === row.category);
  return {
    id: row.id,
    cameraId: row.camera_id,
    cameraName: row.camera_name,
    cameraLocation: row.camera_location,
    cameraPurok: row.camera_purok,
    category: (isKnownCategory ? row.category : "Other") as EventCategory,
    notes: row.notes ?? undefined,
    timestamp: row.timestamp,
    operator: row.operator,
    incidentAction: row.incident_action,
    incidentId: row.incident_id,
    incidentStatus: row.incident_status,
  };
}

async function fetchIncidentOptions(): Promise<ExistingIncident[]> {
  const rows = await cctvFetch<ApiIncidentRow[]>("/api/incidents");
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (i) =>
        i &&
        i.id &&
        i.status !== "resolved" &&
        i.status !== "closed_false_alarm"
    )
    .sort((a, b) => String(b.time ?? "").localeCompare(String(a.time ?? "")))
    .map((i) => ({
      id: i.id!,
      title: i.description || i.category || i.id!,
      status: i.status ?? "",
      priority: i.priority ?? "Medium",
    }));
}

interface ApiCameraRow {
  id?: string;
  name?: string;
  address?: string;
  purok?: string;
  assignment?: string;
  ip?: string;
  port?: string;
  stream_path?: string;
  stream_protocol?: string;
  status?: string;
  enabled?: boolean;
  latency?: string;
}

function signalFromLatency(latency: string): number {
  const ms = Number(String(latency).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(ms) || ms <= 0) return 90;
  if (ms <= 60) return 96;
  if (ms <= 120) return 88;
  if (ms <= 250) return 76;
  return 62;
}

function buildStreamUrl(protocol: string, ip: string, port: string, streamPath: string): string {
  const raw = protocol.toLowerCase();
  const proto = raw === "hls" ? "http" : raw;
  const host = ip.trim() || "<ip>";
  const p = port.trim() || (proto === "http" ? "80" : "554");
  const rawPath = streamPath.trim() || "/stream1";
  const safePath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return `${proto}://${host}:${p}${safePath}`;
}

function toCameraFeed(row: ApiCameraRow, liveIp: string): CameraFeed {
  const rawStatus = String(row.status ?? "");
  const status: CameraFeed["status"] = rawStatus === "online" ? "online" : "offline";
  const protocol = String(row.stream_protocol ?? "RTSP").toUpperCase();
  const nativeProtocol: CameraFeed["nativeProtocol"] = protocol === "HLS" ? "HLS" : "RTSP";
  const ip = String(row.ip ?? "");
  const port = String(row.port ?? "554");
  const streamPath = String(row.stream_path ?? "/stream1");
  const isLive = status === "online" && liveIp !== "" && ip === liveIp;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    location: String(row.address ?? "") || String(row.assignment ?? "") || String(row.name ?? ""),
    purok: String(row.purok ?? ""),
    ip,
    nativeProtocol,
    status,
    signalPct: status === "online" ? signalFromLatency(String(row.latency ?? "")) : 0,
    rtspUrl: buildStreamUrl(nativeProtocol, ip, port, streamPath),
    hlsUrl: `${API_BASE}/video_feed`,
    feedUrl: isLive ? `${API_BASE}/video_feed` : undefined,
  };
}

// A camera record is only valid for surveillance once it has completed the
// registration/verification flow in cctv_placement.tsx. That means it exists
// in the backend with an enabled status of online or offline — pending
// (registered but not yet verified) and disabled cameras are excluded.
function isApprovedCamera(row: ApiCameraRow): boolean {
  if (!row || row.enabled === false) return false;
  return row.status === "online" || row.status === "offline";
}

// Open incidents for the "Link to Existing Incident" step are loaded from the
// backend so the tag guarantees no duplicate incidents. Only open (non-closed)
// incidents are linkable; CCTV tag events never create a duplicate incident.
const EVENT_CATEGORIES: { key: EventCategory; icon: typeof Eye; hint: string }[] = [
  { key: "Suspicious Activity", icon: Eye, hint: "Loitering, stalking, unusual movement patterns" },
  { key: "Unusual Gathering", icon: Users, hint: "Rapid crowd formation, escalating altercation" },
  { key: "Road Obstruction", icon: TrafficCone, hint: "Stalled vehicle, debris, blocked passage" },
  { key: "Public Disturbance", icon: AlertTriangle, hint: "Noise, confrontation, public disorder" },
  { key: "Hazard", icon: AlertTriangle, hint: "Flooding, fire, structural risk, safety threat" },
  { key: "Other", icon: Flag, hint: "Anything else worth flagging" },
];

const MODE_META: Record<QualityMode, { label: string; pill?: string }> = {
  auto: { label: "Auto" },
  high: { label: "High", pill: "bg-emerald-50 text-emerald-700" },
  medium: { label: "Medium", pill: "bg-amber-50 text-amber-700" },
  low: { label: "Low", pill: "bg-rose-50 text-rose-600" },
};

function signalQuality(pct: number) {
  if (pct === 0) return null;
  if (pct >= 80) return { label: "High", pill: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" };
  if (pct >= 50) return { label: "Medium", pill: "bg-amber-50 text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" };
  return { label: "Low", pill: "bg-rose-50 text-rose-600", bar: "bg-rose-500", dot: "bg-rose-500" };
}

function effectiveQuality(cam: CameraFeed, mode: QualityMode) {
  if (cam.status === "offline") return null;
  if (mode !== "auto") return { label: MODE_META[mode].label, pill: MODE_META[mode].pill ?? "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" };
  return signalQuality(cam.signalPct);
}

function LiveFeedFrame() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900">
      <div className="absolute right-6 top-4 h-8 w-8 rounded-full bg-stone-600/80" />
      <div className="absolute left-[8%] bottom-0 h-24 w-16 rounded-t bg-stone-700/90" />
      <div className="absolute left-[16%] bottom-0 h-16 w-10 rounded-t bg-stone-700/70" />
      <div className="absolute right-[10%] bottom-0 h-20 w-24 rounded-t bg-stone-700/80" />
      <div className="absolute inset-x-0 bottom-0 h-11 bg-stone-700" />
      <div className="absolute bottom-2 left-[36%] h-9 w-20 rounded bg-stone-500 shadow-lg" />
      <div className="absolute bottom-2 left-[58%]">
        <div className="mx-auto h-3 w-3 rounded-full bg-stone-400" />
        <div className="mx-auto h-6 w-3.5 rounded-sm bg-stone-400" />
      </div>
      <div className="absolute bottom-2 left-[66%]">
        <div className="mx-auto h-3 w-3 rounded-full bg-stone-400" />
        <div className="mx-auto h-6 w-3.5 rounded-sm bg-stone-400" />
      </div>
    </div>
  );
}

function resizeCellIds(prev: (string | null)[], nextCells: number, available: CameraFeed[]): (string | null)[] {
  const next: (string | null)[] = new Array(nextCells).fill(null);
  const availableIds = new Set(available.map((c) => c.id));
  const used = new Set<string>();
  prev.forEach((id, i) => {
    if (id && i < nextCells && availableIds.has(id) && !used.has(id)) {
      next[i] = id;
      used.add(id);
    }
  });
  let idx = next.indexOf(null);
  for (const c of available) {
    if (idx === -1) break;
    if (!used.has(c.id)) {
      next[idx] = c.id;
      used.add(c.id);
      idx = next.indexOf(null);
    }
  }
  return next;
}

function ReconnectOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-950/70 backdrop-blur-[2px]">
      <Loader2 size={20} className="mb-2 animate-spin text-white" />
      <p className="text-[11px] font-semibold text-white">Reconnecting stream...</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CameraCell                                                                */
/* -------------------------------------------------------------------------- */

interface CameraCellProps {
  cam: CameraFeed;
  gridSize: 1 | 2 | 3;
  mode: QualityMode;
  now: Date;
  reconnecting: boolean;
  isFullscreen: boolean;
  feedRef: (el: HTMLDivElement | null) => void;
  onOpen: () => void;
  onTag: () => void;
  onReportFault: () => void;
  onToggleFullscreen: () => void;
}

function CameraCell({ cam, gridSize, mode, now, reconnecting, isFullscreen, feedRef, onOpen, onTag, onReportFault, onToggleFullscreen }: CameraCellProps) {
  const q = effectiveQuality(cam, mode);
  const isDowngraded = mode === "auto" && cam.signalPct < 50;
  const feedHeight = gridSize === 1 ? "h-[560px]" : gridSize === 2 ? "h-[420px]" : "h-80";
  const isOffline = cam.status === "offline";
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const videoUrl = cam.feedUrl ?? null;

  // Handle auto-retry on error without double-loading the stream
  useEffect(() => {
    if (imageError && videoUrl && !isOffline) {
      const retryTimer = setTimeout(() => {
        setImageError(false);
        setImageLoaded(false);
        setRetryKey((prev) => prev + 1);
      }, 3000);
      return () => clearTimeout(retryTimer);
    }
  }, [imageError, videoUrl, isOffline]);

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div
        ref={feedRef}
        onClick={() => !isOffline && !reconnecting && !isFullscreen && onOpen()}
        className={`relative ${feedHeight} w-full overflow-hidden bg-black ${!isOffline ? "cursor-pointer" : ""}`}
      >
        {isOffline ? (
          <div className="flex h-full flex-col items-center justify-center bg-stone-900">
            <WifiOff size={18} className="mb-1.5 text-stone-600" />
            <p className="text-[10px] font-medium text-stone-500">Camera Offline</p>
            <p className="text-[8px] text-stone-600">{cam.id}</p>
          </div>
        ) : (
          <>
            <div className="absolute inset-0">
              {videoUrl ? (
                <>
                  {!imageLoaded && !imageError && (
                    <div className="flex h-full flex-col items-center justify-center bg-stone-900">
                      <Loader2 size={18} className="mb-1.5 animate-spin text-stone-500" />
                      <p className="text-[10px] font-medium text-stone-500">Connecting...</p>
                    </div>
                  )}
                  {imageError && (
                    <div className="flex h-full flex-col items-center justify-center bg-stone-900">
                      <WifiOff size={18} className="mb-1.5 text-rose-500" />
                      <p className="text-[10px] font-medium text-stone-500">Connection Failed</p>
                      <p className="text-[8px] text-stone-600">Retrying...</p>
                    </div>
                  )}
                  <img
                    src={`${videoUrl}?retry=${retryKey}`}
                    alt={cam.name}
                    className={`h-full w-full object-cover ${(!imageLoaded || imageError) ? 'hidden' : ''}`}
                    onLoad={() => {
                      setImageLoaded(true);
                      setImageError(false);
                    }}
                    onError={() => {
                      setImageError(true);
                      setImageLoaded(false);
                    }}
                  />
                </>
              ) : (
                <LiveFeedFrame />
              )}
            </div>
            {reconnecting && <ReconnectOverlay />}

            {isFullscreen ? (
              <>
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    LIVE
                  </span>
                  <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">{cam.name}</span>
                  <span className="rounded-md bg-[#0038A8]/80 px-2 py-1 font-mono text-[10px] font-medium text-white">{cam.id}</span>
                </div>
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  {q && (
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${q.pill}`}>
                      <span className={`h-2 w-2 rounded-full ${q.dot}`} />
                      {q.label}
                    </span>
                  )}
                  <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                    {now.toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                </div>
                <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                      <MapPin size={11} className="shrink-0 text-white/70" />
                      {cam.location} · {cam.purok}
                    </p>
                    <p className="mt-1 max-w-md truncate font-mono text-[9px] text-white/60">
                      {cam.nativeProtocol === "RTSP" ? cam.rtspUrl : cam.hlsUrl}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                      className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-black/80"
                    >
                      <Minimize2 size={13} />
                      Exit Fullscreen
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onTag(); }}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white shadow-lg transition hover:bg-rose-700"
                    >
                      <Flag size={12} />
                      Tag Event
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="absolute left-2 top-2 flex items-center gap-1.5">
                  <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                    LIVE
                  </span>
                  <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                    {cam.name}
                  </span>
                </div>
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  {q && (
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${q.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${q.dot}`} />
                      {q.label}
                    </span>
                  )}
                  {cam.nativeProtocol === "RTSP" ? (
                    <span className="rounded-md bg-violet-500/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      FFmpeg → HLS
                    </span>
                  ) : (
                    <span className="rounded-md bg-sky-500/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      Native HLS
                    </span>
                  )}
                </div>
                {isDowngraded && (
                  <div className="absolute bottom-8 right-2 flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                    <Signal size={8} />
                    Downgraded
                  </div>
                )}
                <div className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white/80">
                  {cam.nativeProtocol === "RTSP" ? cam.rtspUrl : cam.hlsUrl}
                </div>
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onTag(); }}
                    className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-lg transition hover:bg-rose-700"
                  >
                    <Flag size={10} />
                    Tag Event
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onReportFault(); }}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-amber-400 transition hover:text-amber-300"
                    title="Report Camera Problem"
                  >
                    <Wrench size={11} />
                  </button>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                  className="absolute bottom-10 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white/80 transition hover:text-white"
                  title="Fullscreen stream"
                >
                  <Maximize2 size={11} />
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold text-stone-900">{cam.name}</span>
          <span className="shrink-0 text-[9px] text-stone-400">{cam.location} · {cam.purok}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
            isOffline ? "bg-stone-100 text-stone-400" : cam.status === "degraded" ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}>
            {isOffline ? "OFFLINE" : cam.status === "degraded" ? "DEGRADED" : "ONLINE"}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full ${isOffline ? "bg-stone-300" : isDowngraded ? "bg-rose-500" : q?.bar ?? "bg-emerald-500"}`} style={{ width: `${cam.signalPct}%` }} />
          </div>
          <span className="text-[9px] font-medium text-stone-400">{cam.signalPct}%</span>
          <Wifi size={10} className={isOffline ? "text-stone-300" : "text-emerald-500"} />
        </div>
        <div className="mt-1 flex items-center gap-1 text-[8px] text-stone-400">
          <Clock size={8} />
          {isOffline ? (
            <span>Last seen {new Date(Date.now() - 3600000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
          ) : (
            <span>Connected · {cam.nativeProtocol === "RTSP" ? "RTSP ingest" : "Native HLS"} · IP {cam.ip}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tag Modal — WATCH → IDENTIFY → TAG → REPORT                              */
/* -------------------------------------------------------------------------- */

type TagStep = "details" | "incident" | "confirm";

function TagModal({
  camera,
  now,
  incidents,
  saving,
  onClose,
  onConfirm,
}: {
  camera: CameraFeed;
  now: Date;
  incidents: ExistingIncident[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (category: EventCategory, notes: string, action: IncidentAction, linkedIncidentId?: string) => void;
}) {
  const [step, setStep] = useState<TagStep>("details");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [notes, setNotes] = useState("");
  const [incidentAction, setIncidentAction] = useState<IncidentAction>("create_new");
  const [linkedIncidentId, setLinkedIncidentId] = useState<string | null>(null);
  const [incidentSearch, setIncidentSearch] = useState("");

  const filteredIncidents = incidents.filter(
    (inc) =>
      inc.id.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      inc.title.toLowerCase().includes(incidentSearch.toLowerCase())
  );

  const linkedIncident = incidents.find((i) => i.id === linkedIncidentId);

  function handleNext() {
    if (step === "details" && category) setStep("incident");
    else if (step === "incident") setStep("confirm");
  }

  function handleBack() {
    if (step === "confirm") setStep("incident");
    else if (step === "incident") setStep("details");
  }

  function handleConfirm() {
    if (saving || !category) return;
    onConfirm(category, notes.trim(), incidentAction, linkedIncidentId ?? undefined);
  }

  return (
    <Modal
      onClose={saving ? () => {} : onClose}
      title="Tag CCTV Event"
      subtitle={`${camera.name} · ${camera.location} · ${camera.purok} · ${camera.id}`}
      icon={<Flag size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={saving ? undefined : onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          {step !== "details" && (
            <button
              onClick={handleBack}
              disabled={saving}
              className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
          )}
          {step === "confirm" ? (
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {saving ? "Saving…" : "Confirm & Submit"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={step === "details" && !category}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      }
    >
      {/* Step progress bar */}
      <div className="mb-5 flex items-center gap-2">
        {(["details", "incident", "confirm"] as TagStep[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                step === s ? "bg-[#0038A8] text-white" : i < ["details", "incident", "confirm"].indexOf(step) ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-500"
              }`}>
                {i < ["details", "incident", "confirm"].indexOf(step) ? <CheckCircle2 size={10} /> : i + 1}
              </span>
              <span className={`text-[10px] font-semibold capitalize ${step === s ? "text-[#0038A8]" : "text-stone-400"}`}>
                {s === "details" ? "Event Details" : s === "incident" ? "Incident Link" : "Confirm"}
              </span>
            </div>
            {i < 2 && <div className="mx-1 h-px flex-1 bg-stone-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: Event Details */}
      {step === "details" && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5">
            <span className="text-[10px] font-semibold tracking-wider text-stone-400">EVENT TIME</span>
            <span className="flex items-center gap-2 font-mono text-[13px] font-bold text-stone-900">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              {now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">EVENT CATEGORY (REQUIRED)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EVENT_CATEGORIES.map(({ key, icon: Icon, hint }) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                    category === key ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${category === key ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
                    <Icon size={13} />
                  </span>
                  <span>
                    <span className={`block text-[12px] font-semibold ${category === key ? "text-[#0038A8]" : "text-stone-900"}`}>
                      {key}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-snug text-stone-400">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">DESCRIPTION (OPTIONAL)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Record your observation — number of individuals, direction of travel, vehicle description..."
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            />
          </div>
        </>
      )}

      {/* STEP 2: Incident Relationship */}
      {step === "incident" && (
        <>
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">INCIDENT RELATIONSHIP</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => { setIncidentAction("create_new"); setLinkedIncidentId(null); }}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-3 text-left transition ${
                  incidentAction === "create_new" ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${incidentAction === "create_new" ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
                  <Plus size={13} />
                </span>
                <span>
                  <span className={`block text-[12px] font-semibold ${incidentAction === "create_new" ? "text-[#0038A8]" : "text-stone-900"}`}>
                    Create New Incident
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-snug text-stone-400">
                    A CCTV-Reported incident is created with status In Progress and priority Emergency, then routed to the Desk Officer triage queue.
                  </span>
                </span>
              </button>
              <button
                onClick={() => setIncidentAction("link_existing")}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-3 text-left transition ${
                  incidentAction === "link_existing" ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${incidentAction === "link_existing" ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
                  <Link2 size={13} />
                </span>
                <span>
                  <span className={`block text-[12px] font-semibold ${incidentAction === "link_existing" ? "text-[#0038A8]" : "text-stone-900"}`}>
                    Link to Existing Incident
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-snug text-stone-400">
                    Attach this CCTV event/evidence to an already-open incident. No duplicate is created.
                  </span>
                </span>
              </button>
            </div>
          </div>

          {incidentAction === "link_existing" && (
            <div className="mb-4">
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SEARCH INCIDENTS</p>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={incidentSearch}
                  onChange={(e) => setIncidentSearch(e.target.value)}
                  placeholder="Search by ID or title..."
                  className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {filteredIncidents.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-stone-400">No incidents found</p>
                ) : (
                  filteredIncidents.map((inc) => (
                    <button
                      key={inc.id}
                      onClick={() => setLinkedIncidentId(inc.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        linkedIncidentId === inc.id
                          ? "border-[#0038A8] bg-[#0038A8]/5"
                          : "border-stone-200 bg-white hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-stone-900">{inc.id}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                          inc.priority === "Emergency" ? "bg-rose-200 text-rose-800"
                          : inc.priority === "Critical" ? "bg-rose-100 text-rose-700"
                          : inc.priority === "High" ? "bg-orange-100 text-orange-700"
                          : inc.priority === "Medium" ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700"
                        }`}>
                          {inc.priority}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-stone-800">{inc.title}</p>
                      <p className="text-[9px] text-stone-400">{inc.status}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {incidentAction === "create_new" && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <Info size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
                <div>
                  <p className="text-[10px] font-semibold text-stone-700">Status: In Progress · Priority: Emergency</p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-stone-500">
                    The incident is opened as In Progress and marked Emergency; the CCTV Operator cannot change, promote, or downgrade incident priority.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* STEP 3: Confirmation Summary */}
      {step === "confirm" && (
        <>
          <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">CONFIRMATION SUMMARY</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Camera</span>
                <span className="text-[11px] font-semibold text-stone-900">{camera.name} ({camera.id})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Location</span>
                <span className="text-[11px] font-medium text-stone-800">{camera.location} · {camera.purok}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Event Category</span>
                <span className="text-[11px] font-semibold text-[#0038A8]">{category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Timestamp</span>
                <span className="font-mono text-[11px] font-medium text-stone-900">{now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Operator</span>
                <span className="text-[11px] font-medium text-stone-800">{camera.id.startsWith("CAM") ? "CO-01" : "CO-01"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Incident Action</span>
                <span className="text-[11px] font-semibold text-stone-900">
                  {incidentAction === "create_new" ? "Create New Incident" : `Link to ${linkedIncidentId}`}
                </span>
              </div>
              {incidentAction === "create_new" && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-stone-500">Status / Priority</span>
                  <span className="text-[11px] font-semibold text-stone-900">In Progress · Emergency</span>
                </div>
              )}
              {incidentAction === "link_existing" && linkedIncident && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-stone-500">Linked Incident</span>
                  <span className="text-[11px] font-medium text-stone-800">{linkedIncident.title}</span>
                </div>
              )}
              {notes && (
                <div className="flex items-start justify-between gap-4">
                  <span className="shrink-0 text-[10px] text-stone-500">Notes</span>
                  <span className="text-right text-[11px] text-stone-700">{notes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
            <Info size={12} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[10px] leading-relaxed text-amber-700">
              {incidentAction === "create_new" ? (
                <>Status: <strong>In Progress</strong> · Priority: <strong>Emergency</strong>. The incident is routed straight to the Desk Officer triage queue.</>
              ) : (
                <>This CCTV event and any available footage will be attached to incident <strong>{linkedIncidentId}</strong> as supplementary evidence. No duplicate incident will be created.</>
              )}
            </p>
          </div>

          <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#0038A8]/25 bg-[#0038A8]/5 px-3 py-2.5">
            <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[10px] font-semibold leading-relaxed text-stone-800">
              CCTV Operator records the observation. The Desk Officer determines the final priority during triage.
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stream Focus Modal                                                        */
/* -------------------------------------------------------------------------- */

function StreamFocusModal({ camera, mode, now, onTag, onReportFault, onClose }: { camera: CameraFeed; mode: QualityMode; now: Date; onTag: () => void; onReportFault: () => void; onClose: () => void }) {
  const q = effectiveQuality(camera, mode);
  const isOffline = camera.status === "offline";
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const videoUrl = camera.feedUrl ?? null;

  // Preload the image when component mounts
  useEffect(() => {
    if (videoUrl && !isOffline) {
      setImageLoaded(false);
      setImageError(false);
      
      const img = new Image();
      img.src = videoUrl;
      
      img.onload = () => {
        setImageLoaded(true);
        setImageError(false);
      };
      
      img.onerror = () => {
        setImageError(true);
        console.error(`Failed to load camera feed: ${videoUrl}`);
        
        // Auto-retry after 3 seconds
        const retryTimer = setTimeout(() => {
          const retryImg = new Image();
          retryImg.src = videoUrl;
          retryImg.onload = () => {
            setImageLoaded(true);
            setImageError(false);
          };
          retryImg.onerror = () => {
            // Retry again after 5 seconds
            setTimeout(() => {
              const finalRetry = new Image();
              finalRetry.src = videoUrl;
              finalRetry.onload = () => {
                setImageLoaded(true);
                setImageError(false);
              };
            }, 5000);
          };
        }, 3000);
        
        return () => clearTimeout(retryTimer);
      };
      
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }
  }, [videoUrl, isOffline]);

  return (
    <Modal
      onClose={onClose}
      title={`Stream Focus — ${camera.name}`}
      subtitle={`${camera.id} · ${camera.location} · ${camera.purok}`}
            icon={<Eye size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="2xl"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Close
          </button>
          <button
            onClick={onReportFault}
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            <Wrench size={12} />
            Report Problem
          </button>
          <button
            onClick={onTag}
            disabled={isOffline}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            <Flag size={13} />
            Tag Event
          </button>
        </div>
      }
    >
      <div className="relative mb-4 h-96 w-full overflow-hidden rounded-xl border border-black/20 bg-black sm:h-[480px]">
        {isOffline ? (
          <div className="flex h-full flex-col items-center justify-center bg-stone-900">
            <WifiOff size={24} className="mb-2 text-stone-600" />
            <p className="text-[12px] font-medium text-stone-500">Camera Offline</p>
          </div>
        ) : (
          <>
            {videoUrl ? (
              <>
                {!imageLoaded && !imageError && (
                  <div className="flex h-full flex-col items-center justify-center bg-stone-900">
                    <Loader2 size={24} className="mb-2 animate-spin text-stone-500" />
                    <p className="text-[12px] font-medium text-stone-500">Connecting...</p>
                  </div>
                )}
                {imageError && (
                  <div className="flex h-full flex-col items-center justify-center bg-stone-900">
                    <WifiOff size={24} className="mb-2 text-rose-500" />
                    <p className="text-[12px] font-medium text-stone-500">Connection Failed</p>
                    <p className="text-[10px] text-stone-600">Retrying...</p>
                  </div>
                )}
                {imageLoaded && (
                  <img
                    src={videoUrl}
                    alt={camera.name}
                    className="h-full w-full object-cover"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                )}
              </>
            ) : (
              <LiveFeedFrame />
            )}
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                LIVE
              </span>
              <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">{camera.id}</span>
            </div>
            <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
              {now.toLocaleTimeString("en-US", { hour12: false })}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">LOCATION</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-800">
            <MapPin size={10} className="text-[#0038A8]" />
            {camera.location} · {camera.purok}
          </p>
          <p className="text-[9px] text-stone-400">IP {camera.ip}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">SIGNAL QUALITY</p>
          {q ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-stone-800">
              <Gauge size={11} className="text-[#0038A8]" />
              {q.label}
              <span className="text-[9px] text-stone-400">· {camera.signalPct}% signal</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] font-medium text-stone-400">Offline</p>
          )}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full ${q?.bar ?? "bg-stone-300"}`} style={{ width: `${camera.signalPct}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">SOURCE (PROTOCOL)</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-stone-700">{camera.rtspUrl}</p>
          <p className="text-[9px] text-stone-400">RTSP ingest</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">PLAYBACK (BROWSER)</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-stone-700">{camera.hlsUrl}</p>
          <p className="text-[9px] text-stone-400">
            HLS ·{" "}
            {camera.nativeProtocol === "RTSP" ? (
              <span className="font-semibold text-violet-600">FFmpeg transcoded</span>
            ) : (
              <span className="font-semibold text-sky-600">native</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
        <Info size={12} className="mt-0.5 shrink-0 text-stone-400" />
        <p className="text-[10px] leading-relaxed text-stone-500">
          {camera.nativeProtocol === "RTSP" ? (
            <>This camera outputs RTSP only. The backend uses FFmpeg to transcode to HLS for web playback.</>
          ) : (
            <>This camera natively outputs HLS — no server-side transcoding required.</>
          )}{" "}
          Adaptive quality control automatically downgrades the stream under degraded network conditions.
        </p>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Configure Modal                                                           */
/* -------------------------------------------------------------------------- */

function ConfigureModal({ cameras, cellIds, gridSize, onClose, onApply }: { cameras: CameraFeed[]; cellIds: (string | null)[]; gridSize: 1 | 2 | 3; onClose: () => void; onApply: (ids: (string | null)[]) => void }) {
  const [draft, setDraft] = useState<(string | null)[]>(cellIds);
  const cells = gridSize * gridSize;
  const assigned = draft.filter(Boolean).length;

  return (
    <Modal
      onClose={onClose}
      title="Configure Grid Feeds"
      subtitle={`Assign a camera to each ${gridSize}×${gridSize} grid cell`}
      icon={<Settings2 size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="lg"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onApply(draft)}
            className="flex-1 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            Apply Grid
          </button>
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-stone-400">CELL ASSIGNMENT</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">{assigned}/{cells} assigned</span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
        {Array.from({ length: cells }, (_, i) => {
          const camId = draft[i] ?? "";
          const cam = cameras.find((c) => c.id === camId);
          return (
            <div key={i} className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
              <p className="mb-1.5 text-[9px] font-semibold tracking-wider text-stone-400">CELL {i + 1}</p>
              <select
                value={camId}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : e.target.value;
                  setDraft((prev) => {
                    const next = [...prev];
                    next[i] = v;
                    return next;
                  });
                }}
                className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              >
                <option value="">(Empty)</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.purok}
                  </option>
                ))}
              </select>
              {cam && (
                <p className="mt-1 truncate text-[9px] text-stone-400">
                  {cam.location} ·{" "}
                  <span className={`font-medium ${cam.status === "offline" ? "text-stone-400" : cam.status === "degraded" ? "text-amber-600" : "text-emerald-600"}`}>
                    {cam.status}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
        <Info size={12} className="mt-0.5 shrink-0 text-stone-400" />
        <p className="text-[10px] leading-relaxed text-stone-500">
          Each dropdown controls a single grid cell. Swap any camera at any time — changes take effect immediately when you apply the grid.
        </p>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Camera Fault Modal                                                        */
/* -------------------------------------------------------------------------- */

function FaultModal({
  cameras,
  defaultCameraId,
  onClose,
  onSubmit,
}: {
  cameras: CameraFeed[];
  defaultCameraId?: string;
  onClose: () => void;
  onSubmit: (cam: CameraFeed, faultType: string, description: string) => void;
}) {
  const [camId, setCamId] = useState(defaultCameraId ?? cameras.find((c) => c.status !== "online")?.id ?? cameras[0]?.id ?? "");
  const [faultType, setFaultType] = useState("Hardware failure");
  const [description, setDescription] = useState("");
  const cam = cameras.find((c) => c.id === camId);
  const faultTypes = ["Hardware failure", "Network instability", "Lens obstruction", "Power supply", "Image quality degradation"];

  return (
    <Modal
      onClose={onClose}
      title="Report Camera Problem"
      subtitle="Files a maintenance ticket to Barangay Admin"
      icon={<Wrench size={18} />}
      iconClass="bg-amber-100 text-amber-700"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => cam && onSubmit(cam, faultType, description.trim() || `${faultType} reported on ${cam.name}`)}
            disabled={!cam}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-40"
          >
            <Wrench size={13} />
            Submit Fault Report
          </button>
        </div>
      }
    >
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CAMERA</p>
      <select
        value={camId}
        onChange={(e) => setCamId(e.target.value)}
        className="mb-4 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
      >
        {cameras.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.location} · {c.id} · {c.status}
          </option>
        ))}
      </select>
      {cam && (
        <p className="-mt-3 mb-4 text-[9px] text-stone-400">
          Signal {cam.signalPct}% · {cam.nativeProtocol === "RTSP" ? "RTSP ingest" : "Native HLS"}
        </p>
      )}

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">FAULT TYPE</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {faultTypes.map((ft) => (
          <button
            key={ft}
            onClick={() => setFaultType(ft)}
            className={`rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
              faultType === ft ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            {ft}
          </button>
        ))}
      </div>

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">DESCRIPTION</p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Describe the observed problem — no feed, flicker, blur, packet loss..."
        className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
      />
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  SurveillanceMatrix — Main Export                                          */
/* -------------------------------------------------------------------------- */

export default function SurveillanceMatrix({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { beep } = useAlertSound();

  const [cameras, setCameras] = useState<CameraFeed[]>([]);
  const [gridSize, setGridSize] = useState<1 | 2 | 3>(1);
  const gridRef = useRef<1 | 2 | 3>(1);
  gridRef.current = gridSize;
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [cellIds, setCellIds] = useState<(string | null)[]>(() => resizeCellIds([], 1, []));
  const [configureOpen, setConfigureOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [now, setNow] = useState(new Date());
  const [tagCam, setTagCam] = useState<CameraFeed | null>(null);
  const [focusCam, setFocusCam] = useState<CameraFeed | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagSuccess, setTagSuccess] = useState<CctvEvent | null>(null);

  const [faultOpen, setFaultOpen] = useState(false);
  const [faultTargetCamera, setFaultTargetCamera] = useState<string | undefined>(undefined);
  const [faultReported, setFaultReported] = useState<CameraFault | null>(null);
  const [faults, setFaults] = useState<CameraFault[]>([]);

  const [recentEvents, setRecentEvents] = useState<CctvEvent[]>([]);
  const [incidentOptions, setIncidentOptions] = useState<ExistingIncident[]>([]);
  const [storageUsedGB] = useState(STORAGE_START_GB);
  const eventSeqRef = useRef(1);
  const recentTagsRef = useRef<{ id: string; cameraId: string; taggedAt: number }[]>([]);

  const operator = operatorName;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setCameras((prev) =>
        prev.map((c) => {
          if (c.status === "offline") return c;
          const jitter = Math.floor(Math.random() * 9) - 4;
          const next = Math.max(8, Math.min(100, c.signalPct + jitter));
          return { ...c, signalPct: next, status: next < 50 ? "degraded" : "online" };
        })
      );
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Load only the cameras that completed registration/verification in
  // cctv_placement.tsx. The backend is the single source of truth, so records
  // are never hardcoded here and only approved (online/offline) cameras show.
  useEffect(() => {
    let cancelled = false;

    async function loadCameras() {
      try {
        const rows = await cctvFetch<ApiCameraRow[]>("/api/cctv/cameras");
        if (cancelled || !Array.isArray(rows)) return;

        let liveIp = "";
        try {
          const live = await cctvFetch<{ ip?: string }>("/api/cctv/live");
          liveIp = String(live?.ip ?? "");
        } catch {
          // Live-feed metadata unavailable — cameras still load without a feed URL.
        }
        if (cancelled) return;

        const feeds = rows.filter(isApprovedCamera).map((r) => toCameraFeed(r, liveIp)).filter((f) => f.id);
        setCameras(feeds);
        setCellIds((prev) => resizeCellIds(prev, gridRef.current * gridRef.current, feeds));
      } catch {
        // Backend unreachable — keep whatever was previously loaded.
      }
    }

    void loadCameras();
    const timer = window.setInterval(loadCameras, 20000);
    window.addEventListener("focus", loadCameras);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadCameras);
    };
  }, []);

  // Load persisted CCTV tag events and open incident options from the backend.
  // Tagged events survive page refreshes because they are stored in the CPSS
  // database (cctv_events + the linked incident on the incidents table).
  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const rows = await fetchCctvEvents();
        if (cancelled || !Array.isArray(rows)) return;
        setRecentEvents(rows.filter((r) => r && r.id).map(toCctvEvent));
      } catch {
        // Backend unreachable — the in-memory log keeps whatever is available.
      }
    }

    async function loadIncidentOptions() {
      try {
        setIncidentOptions(await fetchIncidentOptions());
      } catch {
        // Backend unreachable — the Link to Existing Incident list stays empty.
      }
    }

    void loadEvents();
    void loadIncidentOptions();
    const timer = window.setInterval(loadEvents, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      const idx = cellRefs.current.findIndex((el) => el && document.fullscreenElement === el);
      setFullscreenIndex(idx === -1 ? null : idx);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, []);

  const cells = gridSize * gridSize;
  const assignedCount = cellIds.filter(Boolean).length;
  const feedHeight = gridSize === 1 ? "h-[560px]" : gridSize === 2 ? "h-[420px]" : "h-80";

  const storagePct = Math.round((storageUsedGB / STORAGE_TOTAL_GB) * 100);
  const storageCritical = storagePct >= 90;

  /* ---- Tag Event Handler ---- */
  async function confirmTagEvent(cam: CameraFeed, category: EventCategory, notes: string, action: IncidentAction, linkedIncidentId?: string) {
    const recent = recentTagsRef.current.find((t) => t.cameraId === cam.id && Date.now() - t.taggedAt <= DEDUP_MS);
    if (recent) {
      setTagCam(null);
      setFocusCam(null);
      beep("info");
      flash(`Duplicate blocked — ${cam.id} was already tagged as ${recent.id} within the 5-minute dedup window`);
      return;
    }

    const camNow = cameras.find((c) => c.id === cam.id);
    if (!camNow || camNow.status === "offline") {
      setTagCam(null);
      setFocusCam(null);
      beep("offline");
      flash(`Tag rejected — ${cam.id} is offline; no footage available for clip capture`);
      return;
    }

    const seq = eventSeqRef.current++;
    const eventId = `CCTV-EVT-${String(seq).padStart(4, "0")}`;

    const payload: ApiCreateCctvEventPayload = {
      id: eventId,
      camera_id: cam.id,
      camera_name: cam.name,
      camera_location: cam.location,
      camera_purok: cam.purok,
      category,
      notes: notes || null,
      timestamp: new Date().toISOString(),
      operator,
      incident_action: action,
      incident_id: action === "link_existing" ? linkedIncidentId : null,
    };

    setTagSaving(true);
    setTagSuccess(null);
    try {
      const saved = await createCctvEvent(payload);
      const event: CctvEvent = toCctvEvent(saved);

      recentTagsRef.current = [{ id: eventId, cameraId: cam.id, taggedAt: Date.now() }, ...recentTagsRef.current];
      setRecentEvents((prev) => [event, ...prev]);
      void refreshIncidents();
      void fetchIncidentOptions().then(setIncidentOptions).catch(() => {});

      setTagSaving(false);
      setTagCam(null);
      setFocusCam(null);
      setTagSuccess(event);
      beep("critical");
    } catch (error) {
      setTagSaving(false);
      beep("offline");
      const msg = error instanceof Error ? error.message : "Request failed";
      flash(`Event ${eventId} could not be saved — ${msg}. The tag was not recorded.`, { type: "error" });
    }
  }

  /* ---- Fault Report Handler ---- */
  function reportFault(cam: CameraFeed, faultType: string, description: string) {
    const ticket = `MT-${2052 + faults.filter((f) => f.status === "open").length}`;
    const fault: CameraFault = {
      id: `FLT-${String(faults.length + 1).padStart(2, "0")}`,
      cameraId: cam.id,
      cameraName: cam.name,
      severity: faultType,
      description,
      reportedAt: new Date().toISOString(),
      operator,
      status: "open",
      ticket,
    };
    setFaults((prev) => [fault, ...prev]);
    setFaultOpen(false);
    setFaultTargetCamera(undefined);
    beep("offline");
    setFaultReported(fault);
    flash(`Fault report filed — ticket ${ticket} opened for ${cam.name}`);
  }

  function openFaultForCamera(cam: CameraFeed) {
    setFaultTargetCamera(cam.id);
    setFaultOpen(true);
  }

  function changeGridSize(n: 1 | 2 | 3) {
    setGridSize(n);
    setCellIds((prev) => resizeCellIds(prev, n * n, cameras));
  }

  function reconnectStreams() {
    if (reconnecting) return;
    setReconnecting(true);
    flash("Reconnecting all streams — refreshing live feeds");
    setTimeout(() => {
      setCameras((prev) =>
        prev.map((c) =>
          c.status === "offline" ? c : { ...c, status: "online", signalPct: 70 + Math.floor(Math.random() * 26) }
        )
      );
      setReconnecting(false);
      flash("All streams reconnected — live feeds restored");
    }, 1400);
  }

  function toggleFullscreen(index: number) {
    const el = cellRefs.current[index];
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }

  /* ---- Render ---- */
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-2 py-4 sm:px-4 sm:py-6">
        {/* Grid Controls */}
        <div className="mb-5 rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">GRID LAYOUT</p>
                <div className="flex items-center gap-1">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => changeGridSize(n)}
                      className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition ${
                        gridSize === n ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      <LayoutGrid size={12} />
                      {n}×{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">QUALITY MODE</p>
                <div className="flex items-center gap-1">
                  {(["auto", "high", "medium", "low"] as QualityMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setQualityMode(m)}
                      className={`h-8 rounded-lg border px-3 text-[11px] font-semibold capitalize transition ${
                        qualityMode === m ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={reconnectStreams}
                disabled={reconnecting}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
              >
                <RefreshCw size={12} className={reconnecting ? "animate-spin" : ""} />
                {reconnecting ? "Reconnecting..." : "Reconnect Streams"}
              </button>
              <button
                onClick={() => setConfigureOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <Settings2 size={12} />
                Configure Feeds
              </button>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
                {assignedCount}/{cells} feeds
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
            <span className="text-[9px] font-semibold tracking-wider text-stone-400">PROTOCOLS:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-medium text-sky-700">
              <Wifi size={8} />
              RTSP ingest
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-medium text-violet-700">
              <Settings2 size={8} />
              FFmpeg → HLS
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
              <Gauge size={8} />
              Adaptive quality
            </span>
            <span className="ml-auto flex items-center gap-1 text-[9px] text-stone-400">
              <Signal size={9} />
              {qualityMode === "auto" ? "Auto-downgrades on degraded network" : `Locked to ${qualityMode}`}
            </span>
          </div>
        </div>

        {/* Camera Grid */}
        {assignedCount === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center">
            <LayoutGrid size={26} className="mx-auto mb-2 text-stone-300" />
            <p className="text-[13px] font-medium text-stone-500">No camera feeds assigned</p>
            <p className="mb-4 text-[11px] text-stone-400">Configure the grid to add live feeds</p>
            <button
              onClick={() => setConfigureOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
            >
              <Settings2 size={12} />
              Configure Feeds
            </button>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
            {cellIds.map((id, i) => {
              const cam = id ? cameras.find((c) => c.id === id) : undefined;
              return cam ? (
                <CameraCell
                  key={i}
                  cam={cam}
                  gridSize={gridSize}
                  mode={qualityMode}
                  now={now}
                  reconnecting={reconnecting}
                  isFullscreen={fullscreenIndex === i}
                  feedRef={(el) => { cellRefs.current[i] = el; }}
                  onOpen={() => setFocusCam(cam)}
                  onTag={() => setTagCam(cam)}
                  onReportFault={() => openFaultForCamera(cam)}
                  onToggleFullscreen={() => toggleFullscreen(i)}
                />
              ) : (
                <div key={i} className="overflow-hidden rounded-xl border border-dashed border-stone-300 bg-white shadow-sm">
                  <div className={`relative ${feedHeight} w-full overflow-hidden bg-stone-100`}>
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                                            <Eye size={18} className="mb-1.5 text-stone-300" />
                      <p className="text-[10px] font-medium text-stone-400">No camera assigned</p>
                      <button
                        onClick={() => setConfigureOpen(true)}
                        className="mt-2 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                      >
                        Assign camera
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <span className="text-[10px] text-stone-400">Cell {i + 1} — no feed</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent CCTV Events + Storage */}
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Recent Events — read-only */}
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Recent CCTV Events</h3>
                  <p className="text-[11px] text-[#94A3B8]">Manual CCTV Events tagged by the operator — saved to the CPSS database</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{recentEvents.length} events</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {recentEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10">
                  <Flag size={20} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No events tagged yet</p>
                  <p className="text-[10px] text-stone-400">Tag a live feed to create a CCTV event</p>
                </div>
              ) : (
                recentEvents.map((evt) => (
                  <div key={evt.id} className="mb-2 rounded-lg border border-stone-200 px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-stone-900">{evt.id}</span>
                      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-500">{evt.category}</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-stone-800">{evt.cameraName} ({evt.cameraId})</p>
                    <p className="text-[9px] text-stone-400">{evt.cameraLocation} · {evt.cameraPurok}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[9px] text-stone-400">
                        <Clock size={8} />
                        {formatTime(evt.timestamp)}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-stone-400">
                        <User size={8} />
                        {evt.operator}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 font-mono text-[9px] text-stone-500">
                        <Link2 size={8} />
                        {evt.incidentId}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                        evt.incidentAction === "create_new"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700"
                      }`}>
                        {evt.incidentStatus}
                      </span>
                    </div>
                    {evt.notes && (
                      <p className="mt-1 truncate text-[9px] text-stone-400">Note: {evt.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Storage — read-only */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4">
              <HardDrive size={16} className={storageCritical ? "text-rose-600" : "text-[#0038A8]"} />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Storage Capacity</h3>
                <p className="text-[11px] text-[#94A3B8]">DVR storage — read only</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 px-5 pb-4">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider text-stone-400">CAPACITY</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${storageCritical ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {storageCritical ? "NEAR CAPACITY" : "HEALTHY"}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div className={`h-full rounded-full transition-all ${storageCritical ? "bg-rose-500" : "bg-[#0038A8]"}`} style={{ width: `${storagePct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[12px] font-bold text-stone-900">{storageUsedGB.toFixed(0)} GB</span>
                  <span className="text-[10px] text-stone-400">of {STORAGE_TOTAL_GB} GB</span>
                </div>
                <p className="mt-1 text-[9px] text-stone-400">
                  {storagePct}% used · 1-year retention · {recentEvents.length} clip(s) saved this session
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Faults — read-only log */}
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-amber-600" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Camera Fault Reports</h3>
                  <p className="text-[11px] text-[#94A3B8]">Maintenance tickets filed this session</p>
                </div>
              </div>
              <button
                onClick={() => { setFaultTargetCamera(undefined); setFaultOpen(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-700"
              >
                <Wrench size={12} />
                Report Problem
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {faults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10">
                  <CheckCircle2 size={20} className="mb-2 text-emerald-300" />
                  <p className="text-[12px] font-medium text-stone-500">No fault reports</p>
                </div>
              ) : (
                faults.map((f) => (
                  <div key={f.id} className={`rounded-lg border px-3.5 py-2.5 ${f.status === "open" ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                          <Wrench size={11} />
                        </span>
                        <span className="font-mono text-[10px] font-bold text-stone-900">{f.ticket}</span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${f.status === "open" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {f.status === "open" ? "Open" : "Resolved"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-stone-800">{f.cameraName} · {f.severity}</p>
                    <p className="text-[10px] text-stone-500">{f.description}</p>
                    <p className="mt-1 flex items-center gap-1 text-[9px] text-stone-400">
                      <Clock size={8} />
                      {formatTime(f.reportedAt)}
                      <span className="mx-0.5">&middot;</span>
                      <User size={8} />
                      {f.operator}
                    </p>
                    {f.status === "open" ? (
                      <p className="mt-2 flex items-center gap-1 text-[9px] font-medium text-amber-600">
                        <Wrench size={10} />
                        Open — Maintenance/Admin will handle resolution
                      </p>
                    ) : (
                      <p className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-emerald-600">
                        <CheckCircle2 size={10} />
                        Maintenance cleared — feed restored
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ---- Modals ---- */}
      {tagCam && (
        <TagModal
          camera={tagCam}
          now={now}
          incidents={incidentOptions}
          saving={tagSaving}
          onClose={() => setTagCam(null)}
          onConfirm={(cat, notes, action, linkedId) => confirmTagEvent(tagCam, cat, notes, action, linkedId)}
        />
      )}

      {tagSuccess && (
        <ConfirmModal
          type="success"
          title="Event Tagged Successfully"
          message={
            tagSuccess.incidentAction === "create_new"
              ? `Event ${tagSuccess.id} tagged on ${tagSuccess.cameraName} — INCIDENT ${tagSuccess.incidentId} CREATED and saved to the CPSS database. Status In Progress · Priority Emergency. Routed to Desk Officer triage.`
              : `Event ${tagSuccess.id} tagged on ${tagSuccess.cameraName} and attached to existing incident ${tagSuccess.incidentId} as supplementary evidence. Saved to the CPSS database.`
          }
          onClose={() => setTagSuccess(null)}
        />
      )}

      {focusCam && (
        <StreamFocusModal
          camera={focusCam}
          mode={qualityMode}
          now={now}
          onTag={() => setTagCam(focusCam)}
          onReportFault={() => openFaultForCamera(focusCam)}
          onClose={() => setFocusCam(null)}
        />
      )}

      {configureOpen && (
        <ConfigureModal
          cameras={cameras}
          cellIds={cellIds}
          gridSize={gridSize}
          onClose={() => setConfigureOpen(false)}
          onApply={(ids) => {
            setCellIds(ids);
            setConfigureOpen(false);
            flash(`Grid updated — ${ids.filter(Boolean).length} feeds assigned`);
          }}
        />
      )}

      {faultOpen && (
        <FaultModal
          cameras={cameras}
          defaultCameraId={faultTargetCamera}
          onClose={() => { setFaultOpen(false); setFaultTargetCamera(undefined); }}
          onSubmit={(cam, severity, description) => reportFault(cam, severity, description)}
        />
      )}

      {faultReported && (
        <ConfirmModal
          type="success"
          title="Fault Reported Successfully"
          message={`${faultReported.ticket} filed for ${faultReported.cameraName} (${faultReported.severity}). Maintenance/Admin will handle resolution. No action is required from the CCTV Operator.`}
          onClose={() => setFaultReported(null)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
