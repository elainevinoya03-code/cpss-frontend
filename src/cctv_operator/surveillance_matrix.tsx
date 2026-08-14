import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Camera,
  Eye,
  Users,
  TrafficCone,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  Database,
  HardDrive,
  Info,
  Timer,
  Flag,
  Siren,
  Sparkles,
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
  Undo2,
  Wrench,
  HardDriveDownload,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";
import { INCIDENT_PRIORITIES, type IncidentPriority } from "../constants/severity";

const DEDUP_MS = 5 * 60 * 1000;
const STORAGE_TOTAL_GB = 2000;
const STORAGE_START_GB = 1680;
const CLIP_GB = 0.04;

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
}

type TagType = "Suspicious Behavior" | "Unusual Crowd" | "Road Blockage" | "Other";
type QualityMode = "auto" | "high" | "medium" | "low";

interface Escalation {
  id: string;
  cameraId: string;
  cameraName: string;
  tagType: TagType;
  notes?: string;
  escalatedAt: string;
  clipStart: string;
  clipEnd: string;
  durationSec: number;
  preRollSec: number;
  postRollSec: number;
  storageUrl: string;
  incidentId: string;
  operator: string;
  priority: IncidentPriority;
  preRollIncomplete?: boolean;
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

const INITIAL_CAMERAS: CameraFeed[] = [
  { id: "CAM-GATE-01", name: "Main Gate", location: "Entrance Gate", purok: "Purok 1", ip: "192.168.1.101", nativeProtocol: "RTSP", status: "online", signalPct: 94, rtspUrl: "rtsp://admin:brgy@192.168.1.101:554/stream", hlsUrl: "http://192.168.1.101:8080/hls/CAM-GATE-01/index.m3u8" },
  { id: "CAM-PLAZA-02", name: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2", ip: "192.168.1.102", nativeProtocol: "HLS", status: "online", signalPct: 88, rtspUrl: "rtsp://admin:brgy@192.168.1.102:554/stream", hlsUrl: "http://192.168.1.102:8080/hls/CAM-PLAZA-02/index.m3u8" },
  { id: "CAM-MARKET-03", name: "Public Market", location: "Market Strip", purok: "Purok 6", ip: "192.168.1.103", nativeProtocol: "RTSP", status: "degraded", signalPct: 46, rtspUrl: "rtsp://admin:brgy@192.168.1.103:554/stream", hlsUrl: "http://192.168.1.103:8080/hls/CAM-MARKET-03/index.m3u8" },
  { id: "CAM-CHAPEL-04", name: "Chapel Area", location: "Chapel Approach", purok: "Purok 5", ip: "192.168.1.104", nativeProtocol: "HLS", status: "online", signalPct: 91, rtspUrl: "rtsp://admin:brgy@192.168.1.104:554/stream", hlsUrl: "http://192.168.1.104:8080/hls/CAM-CHAPEL-04/index.m3u8" },
  { id: "CAM-ROAD-05", name: "Crossing Road", location: "Purok Crossing", purok: "Purok 3", ip: "192.168.1.105", nativeProtocol: "RTSP", status: "online", signalPct: 79, rtspUrl: "rtsp://admin:brgy@192.168.1.105:554/stream", hlsUrl: "http://192.168.1.105:8080/hls/CAM-ROAD-05/index.m3u8" },
  { id: "CAM-HALL-06", name: "Barangay Hall", location: "Hall Entrance", purok: "HQ", ip: "192.168.1.106", nativeProtocol: "RTSP", status: "offline", signalPct: 0, rtspUrl: "rtsp://admin:brgy@192.168.1.106:554/stream", hlsUrl: "http://192.168.1.106:8080/hls/CAM-HALL-06/index.m3u8" },
  { id: "CAM-PARK-07", name: "Mini Park", location: "Playground", purok: "Purok 4", ip: "192.168.1.107", nativeProtocol: "HLS", status: "online", signalPct: 84, rtspUrl: "rtsp://admin:brgy@192.168.1.107:554/stream", hlsUrl: "http://192.168.1.107:8080/hls/CAM-PARK-07/index.m3u8" },
  { id: "CAM-RIVER-08", name: "River Bank", location: "Low-lying area", purok: "Purok 5", ip: "192.168.1.108", nativeProtocol: "RTSP", status: "online", signalPct: 71, rtspUrl: "rtsp://admin:brgy@192.168.1.108:554/stream", hlsUrl: "http://192.168.1.108:8080/hls/CAM-RIVER-08/index.m3u8" },
  { id: "CAM-TERMINAL-09", name: "Terminal", location: "Jeep Terminal", purok: "Purok 6", ip: "192.168.1.109", nativeProtocol: "HLS", status: "online", signalPct: 82, rtspUrl: "rtsp://admin:brgy@192.168.1.109:554/stream", hlsUrl: "http://192.168.1.109:8080/hls/CAM-TERMINAL-09/index.m3u8" },
];

const TAG_TYPES: { key: TagType; icon: typeof Eye; hint: string }[] = [
  { key: "Suspicious Behavior", icon: Eye, hint: "Loitering, stalking, suspicious movement" },
  { key: "Unusual Crowd", icon: Users, hint: "Rapid gathering, escalating altercation" },
  { key: "Road Blockage", icon: TrafficCone, hint: "Stalled vehicle, obstruction, debris" },
  { key: "Other", icon: AlertTriangle, hint: "Anything else worth flagging" },
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

function resizeCellIds(prev: (string | null)[], nextCells: number): (string | null)[] {
  const next: (string | null)[] = new Array(nextCells).fill(null);
  const used = new Set<string>();
  prev.forEach((id, i) => {
    if (id && i < nextCells) {
      next[i] = id;
      used.add(id);
    }
  });
  let idx = next.indexOf(null);
  for (const c of INITIAL_CAMERAS) {
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
  onToggleFullscreen: () => void;
}

function CameraCell({ cam, gridSize, mode, now, reconnecting, isFullscreen, feedRef, onOpen, onTag, onToggleFullscreen }: CameraCellProps) {
  const q = effectiveQuality(cam, mode);
  const isDowngraded = mode === "auto" && cam.signalPct < 50;
  const feedHeight = gridSize === 1 ? "h-72" : gridSize === 2 ? "h-52" : "h-40";

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div
        ref={feedRef}
        onClick={() => cam.status !== "offline" && !reconnecting && !isFullscreen && onOpen()}
        className={`relative ${feedHeight} w-full overflow-hidden bg-black ${cam.status !== "offline" ? "cursor-pointer" : ""}`}
      >
        {cam.status === "offline" ? (
          <div className="flex h-full flex-col items-center justify-center bg-stone-900">
            <WifiOff size={18} className="mb-1.5 text-stone-600" />
            <p className="text-[10px] font-medium text-stone-500">Camera Offline</p>
            <p className="text-[8px] text-stone-600">{cam.id}</p>
          </div>
        ) : (
          <>
            <LiveFeedFrame />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFullscreen();
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-black/80"
                    >
                      <Minimize2 size={13} />
                      Exit Fullscreen
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTag();
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white shadow-lg transition hover:bg-rose-700"
                    >
                      <Flag size={12} />
                      Tag
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTag();
                  }}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-lg transition hover:bg-rose-700"
                >
                  <Flag size={10} />
                  Tag
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFullscreen();
                  }}
                  className="absolute bottom-9 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white/80 transition hover:text-white"
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
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full ${cam.status === "offline" ? "bg-stone-300" : isDowngraded ? "bg-rose-500" : q?.bar ?? "bg-emerald-500"}`} style={{ width: `${cam.signalPct}%` }} />
          </div>
          <span className="text-[9px] font-medium text-stone-400">{cam.signalPct}%</span>
          <Wifi size={10} className={cam.status === "offline" ? "text-stone-300" : "text-emerald-500"} />
        </div>
      </div>
    </div>
  );
}

function TagModal({ camera, now, onClose, onConfirm }: { camera: CameraFeed; now: Date; onClose: () => void; onConfirm: (tagType: TagType, notes: string, priority: IncidentPriority) => void }) {
  const [tagType, setTagType] = useState<TagType | null>(null);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<IncidentPriority>("Medium");

  return (
    <Modal
      onClose={onClose}
      title="Tag Threat on Live Feed"
      subtitle={`${camera.name} · ${camera.location} · ${camera.purok} · ${camera.id}`}
      icon={<Flag size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => tagType && onConfirm(tagType, notes.trim(), priority)}
            disabled={!tagType}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            <Flag size={13} />
            Confirm Tag &amp; Escalate
          </button>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5">
          <span className="text-[10px] font-semibold tracking-wider text-stone-400">LIVE FEED TIME</span>
          <span className="flex items-center gap-2 font-mono text-[13px] font-bold text-stone-900">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            {now.toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">TAG TYPE (REQUIRED)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TAG_TYPES.map(({ key, icon: Icon, hint }) => (
              <button
                key={key}
                onClick={() => setTagType(key)}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                  tagType === key ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tagType === key ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
                  <Icon size={13} />
                </span>
                <span>
                  <span className={`block text-[12px] font-semibold ${tagType === key ? "text-[#0038A8]" : "text-stone-900"}`}>
                    {key}
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-snug text-stone-400">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">NOTES (OPTIONAL)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add context for the responding team — e.g. number of individuals, direction of travel, vehicle plate..."
            className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          />
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">INCIDENT PRIORITY (DEFAULT MEDIUM)</p>
          <div className="flex gap-1.5">
            {INCIDENT_PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition ${
                  priority === p
                    ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-stone-400">
            Stamped on the auto-created CCTV-Reported incident — the Desk Officer can still re-prioritize during triage.
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
            <Timer size={10} />
            AUTOMATED CLIPPING &amp; ESCALATION
          </p>
          <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="absolute inset-y-0 left-0 w-[75%] bg-amber-400/80" />
            <div className="absolute inset-y-0 left-[75%] w-[25%] bg-emerald-500/90" />
            <div className="absolute -top-[3px] left-[75%] h-[14px] w-0.5 bg-stone-800" />
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-stone-400">
            Confirming generates a 40-second clip (30s pre-roll + 10s post-roll), saves it to Supabase Storage, creates
            a CCTV-Reported incident and routes it into the Desk Officer triage queue.
          </p>
        </div>
    </Modal>
  );
}

function RoutingModal({ clip, incidentId, onComplete }: { clip: Escalation; incidentId: string; onComplete: () => void }) {
  const steps = [
    clip.preRollIncomplete
      ? `Generating clip — WARNING: ${clip.preRollSec}s pre-roll may be incomplete (signal degraded at capture)`
      : `Generating 40-second clip (${clip.preRollSec}s pre-roll + ${clip.postRollSec}s post-roll)`,
    `Saving clip to Supabase Storage & logging ${clip.id} in cctv_clips`,
    `Creating official incident ${incidentId} — source "CCTV-Reported", priority ${clip.priority}`,
    `Mapping camera location · ${clip.cameraName}`,
    `Attaching clip ${clip.id} as linked evidence (storage_url)`,
    `Pushing ${incidentId} into Desk Officer triage queue`,
  ];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (stepIdx >= steps.length + 1) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), 380);
    return () => clearTimeout(t);
  }, [stepIdx]);

  return (
    <Modal
      size="md"
      title="Automated Routing In Progress"
      subtitle={`${clip.id} → ${incidentId}`}
      icon={
        <>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-[#0038A8]/20" />
          <Sparkles size={18} />
        </>
      }
      iconClass="relative bg-[#0038A8]/10 text-[#0038A8]"
    >
      <div className="space-y-2.5">
          {steps.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            const warn = s.startsWith("Generating clip — WARNING");
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                warn
                  ? "border-amber-300 bg-amber-50"
                  : active
                    ? "border-[#0038A8]/30 bg-[#0038A8]/5"
                    : done
                      ? "border-emerald-100 bg-emerald-50/50"
                      : "border-stone-100 bg-white"
              }`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  warn
                    ? "bg-amber-500 text-white"
                    : done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-[#0038A8] text-white"
                        : "bg-stone-200"
                }`}>
                  {done ? <CheckCircle2 size={9} /> : <span className="h-1.5 w-1.5 rounded-full bg-white/70" />}
                </span>
                <span className={`text-[11px] leading-snug ${warn ? "font-semibold text-amber-800" : done ? "text-stone-500" : active ? "font-medium text-stone-900" : "text-stone-400"}`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
    </Modal>
  );
}

function StreamFocusModal({ camera, mode, now, onTag, onClose }: { camera: CameraFeed; mode: QualityMode; now: Date; onTag: () => void; onClose: () => void }) {
  const q = effectiveQuality(camera, mode);
  return (
    <Modal
      onClose={onClose}
      title={`Stream Focus — ${camera.name}`}
      subtitle={`${camera.id} · ${camera.location} · ${camera.purok}`}
      icon={<Camera size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="2xl"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Close
          </button>
          <button
            onClick={onTag}
            disabled={camera.status === "offline"}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            <Flag size={13} />
            Tag This Feed
          </button>
        </div>
      }
    >
      <div className="relative mb-4 h-52 w-full overflow-hidden rounded-xl border border-black/20 bg-black sm:h-64">
          {camera.status === "offline" ? (
            <div className="flex h-full flex-col items-center justify-center bg-stone-900">
              <WifiOff size={24} className="mb-2 text-stone-600" />
              <p className="text-[12px] font-medium text-stone-500">Camera Offline</p>
            </div>
          ) : (
            <>
              <LiveFeedFrame />
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
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">REGISTERED POSITION</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-800">
              <MapPin size={10} className="text-[#0038A8]" />
              {camera.location} · {camera.purok}
            </p>
            <p className="text-[9px] text-stone-400">IP {camera.ip}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">ADAPTIVE QUALITY</p>
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
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">SOURCE (PROTOCOL AGGREGATION)</p>
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

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <Info size={12} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[10px] leading-relaxed text-amber-700">
            {camera.nativeProtocol === "RTSP" ? (
              <>This camera outputs RTSP only, so the backend uses FFmpeg to transcode it to HLS for web playback.</>
            ) : (
              <>This camera natively outputs HLS, so no server-side transcoding is required.</>
            )}{" "}
            Under degraded network conditions, adaptive quality control automatically downgrades the stream to prevent
            freezing or crashes.
          </p>
        </div>
    </Modal>
  );
}

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
            Each dropdown controls a single grid cell. Swap any camera at any time — changes take effect immediately
            when you apply the grid.
          </p>
        </div>
    </Modal>
  );
}

function FaultModal({ cameras, defaultCameraId, onClose, onSubmit }: { cameras: CameraFeed[]; defaultCameraId?: string; onClose: () => void; onSubmit: (cam: CameraFeed, severity: string, description: string) => void }) {
  const [camId, setCamId] = useState(defaultCameraId ?? cameras.find((c) => c.status !== "online")?.id ?? cameras[0]?.id ?? "");
  const [severity, setSeverity] = useState("Hardware failure");
  const [description, setDescription] = useState("");
  const cam = cameras.find((c) => c.id === camId);
  const severities = ["Hardware failure", "Network instability", "Lens obstruction", "Power supply"];

  return (
    <Modal
      onClose={onClose}
      title="Report Camera Fault"
      subtitle="Logs a maintenance ticket to Barangay Admin"
      icon={<Wrench size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => cam && onSubmit(cam, severity, description.trim() || `${severity} reported on ${cam.name}`)}
            disabled={!cam}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
          >
            <Wrench size={13} />
            File Maintenance Ticket
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
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
                severity === s ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">DESCRIPTION</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the observed failure — no feed, flicker, blur, packet loss..."
          className="mb-5 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
        />
    </Modal>
  );
}

export default function SurveillanceMatrix({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [cameras, setCameras] = useState<CameraFeed[]>(INITIAL_CAMERAS);
  const [gridSize, setGridSize] = useState<1 | 2 | 3>(3);
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [cellIds, setCellIds] = useState<(string | null)[]>(() => resizeCellIds(INITIAL_CAMERAS.map((c) => c.id), 9));
  const [configureOpen, setConfigureOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [now, setNow] = useState(new Date());
  const [tagCam, setTagCam] = useState<CameraFeed | null>(null);
  const [focusCam, setFocusCam] = useState<CameraFeed | null>(null);

  const [routing, setRouting] = useState<{ clip: Escalation; incidentId: string } | null>(null);
  const [routingDone, setRoutingDone] = useState<Escalation | null>(null);
  const [sessionTags, setSessionTags] = useState<Escalation[]>([]);
  const [retractTarget, setRetractTarget] = useState<Escalation | null>(null);
  const [faultOpen, setFaultOpen] = useState(false);
  const [faultReported, setFaultReported] = useState<CameraFault | null>(null);
  const [faults, setFaults] = useState<CameraFault[]>([
    {
      id: "FLT-01",
      cameraId: "CAM-HALL-06",
      cameraName: "Barangay Hall",
      severity: "Power supply",
      description: "No feed since morning shift — power supply failure suspected at hall entrance.",
      reportedAt: new Date(Date.now() - 42 * 60000).toISOString(),
      operator: "CO-01",
      status: "open",
      ticket: "MT-2051",
    },
  ]);
  const [storageUsedGB, setStorageUsedGB] = useState(STORAGE_START_GB);
  const escalationSeqRef = React.useRef(1);

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

  const onlineCount = cameras.filter((c) => c.status !== "offline").length;
  const degradedCount = cameras.filter((c) => c.status === "degraded").length;
  const transcodingCount = cameras.filter((c) => c.nativeProtocol === "RTSP" && c.status !== "offline").length;
  const hlsStreams = cameras.filter((c) => c.status !== "offline").length;

  const cells = gridSize * gridSize;
  const assignedCount = cellIds.filter(Boolean).length;
  const feedHeight = gridSize === 1 ? "h-72" : gridSize === 2 ? "h-52" : "h-40";

  const kpis = [
    { label: "CAMERAS MONITORED", value: `${onlineCount}/${cameras.length}`, sub: "online feeds in matrix", icon: Camera },
    { label: "HLS STREAMS ACTIVE", value: hlsStreams, sub: "browser-ready playback", icon: Video },
    { label: "FFMPEG TRANSCODING", value: transcodingCount, sub: "RTSP → HLS conversion", icon: Settings2 },
    { label: "DEGRADED SIGNAL", value: degradedCount, sub: "auto-downgraded quality", icon: Signal },
  ];

  const openFaults = faults.filter((f) => f.status === "open");
  const storagePct = Math.round((storageUsedGB / STORAGE_TOTAL_GB) * 100);
  const storageCritical = storagePct >= 90;

  function confirmTag(cam: CameraFeed, tagType: TagType, notes: string, priority: IncidentPriority = "Medium") {
    const recent = sessionTags.find((t) => t.cameraId === cam.id && Date.now() - new Date(t.escalatedAt).getTime() <= DEDUP_MS);
    if (recent) {
      setTagCam(null);
      setFocusCam(null);
      beep("info");
      flash(`Duplicate blocked — ${cam.id} already tagged as ${recent.id} within the 5-minute dedup window (Sec 4.2 dedup rule)`);
      return;
    }

    const camNow = cameras.find((c) => c.id === cam.id);
    if (!camNow || camNow.status === "offline") {
      setTagCam(null);
      setFocusCam(null);
      beep("offline");
      flash(`Tag rejected — ${cam.id} lost signal mid-tag; pre-roll capture incomplete, no clip was generated`);
      return;
    }

    const at = new Date();
    const start = new Date(at.getTime() - 30 * 1000);
    const end = new Date(at.getTime() + 10 * 1000);
    const clipSeq = escalationSeqRef.current++;
    const clipId = `CLIP-2026-${String(clipSeq).padStart(4, "0")}`;
    const incidentId = `INC-${2072 + clipSeq}`;
    const preRollIncomplete = camNow.signalPct < 50;

    const clip: Escalation = {
      id: clipId,
      cameraId: cam.id,
      cameraName: cam.name,
      tagType,
      notes: notes || undefined,
      escalatedAt: at.toISOString(),
      clipStart: start.toISOString(),
      clipEnd: end.toISOString(),
      durationSec: 40,
      preRollSec: 30,
      postRollSec: 10,
      storageUrl: `https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/${clipId}.mp4`,
      incidentId,
      operator: operator,
      priority,
      preRollIncomplete,
    };

    setTagCam(null);
    setFocusCam(null);
    setSessionTags((prev) => [clip, ...prev]);
    setStorageUsedGB((g) => g + CLIP_GB);
    setRouting({ clip, incidentId });
    if (preRollIncomplete) beep("offline");
    else beep("critical");
    flash(`Tag confirmed by ${operator} on ${cam.name} — routing ${clipId} (${priority}) to Desk Officer triage${preRollIncomplete ? " (pre-roll integrity warning)" : ""}`);
  }

  function completeRouting() {
    if (!routing) return;
    setRoutingDone(routing.clip);
    setRouting(null);
  }

  function changeGridSize(n: 1 | 2 | 3) {
    setGridSize(n);
    setCellIds((prev) => resizeCellIds(prev, n * n));
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

  function retractTag(clip: Escalation) {
    setSessionTags((prev) => prev.filter((t) => t.id !== clip.id));
    setRetractTarget(null);
    beep("info");
    flash(`${clip.id} retracted by ${operator} — incident ${clip.incidentId} recalled from Desk Officer triage`);
  }

  function reportFault(cam: CameraFeed, severity: string, description: string) {
    const ticket = `MT-${2052 + faults.filter((f) => f.status === "open").length}`;
    const fault: CameraFault = {
      id: `FLT-${String(faults.length + 1).padStart(2, "0")}`,
      cameraId: cam.id,
      cameraName: cam.name,
      severity,
      description,
      reportedAt: new Date().toISOString(),
      operator,
      status: "open",
      ticket,
    };
    setFaults((prev) => [fault, ...prev]);
    setFaultOpen(false);
    beep("offline");
    setFaultReported(fault);
    flash(`Fault reported by ${operator} — maintenance ticket ${ticket} opened for ${cam.name} (Barangay Admin)`);
  }

  function resolveFault(fault: CameraFault) {
    setFaults((prev) => prev.map((f) => (f.id === fault.id ? { ...f, status: "resolved" as const } : f)));
    setCameras((prev) =>
      prev.map((c) => (c.id === fault.cameraId ? { ...c, status: "online", signalPct: 85 } : c))
    );
    beep("info");
    flash(`${fault.ticket} resolved — maintenance cleared, ${fault.cameraName} restored to live feed`);
  }

  function purgeStorage() {
    const freed = Math.min(320, Math.max(0, storageUsedGB - 1400));
    setStorageUsedGB((g) => Math.max(1400, g - freed));
    beep("info");
    flash(`Storage reclaimed — ${freed.toFixed(1)} GB purged (footage beyond 1-year retention)`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Surveillance Matrix</h1>
              <p className="mt-1 text-sm text-stone-500">
                Central live multi-camera dashboard &amp; feed management
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0038A8]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0038A8]">
                <User size={12} />
                Operator: {operator}
              </span>
              <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
              <button
                onClick={() => setFaultOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                <Wrench size={12} />
                Report Fault
                {openFaults.length > 0 && (
                  <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{openFaults.length}</span>
                )}
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">
                <Wifi size={12} />
                {onlineCount} streams live
              </span>
              <span className="hidden items-center gap-1.5 rounded-full bg-[#0038A8]/5 px-3 py-1.5 text-[11px] font-medium text-[#0038A8] sm:flex">
                <LayoutGrid size={12} />
                {gridSize}×{gridSize} grid
              </span>
            </div>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
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
                {assignedCount}/{cells} feeds assigned
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
            <span className="text-[9px] font-semibold tracking-wider text-stone-400">STREAM MANAGEMENT:</span>
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
              {qualityMode === "auto" ? "Auto-downgrades on degraded network to prevent freezing" : `Quality locked to ${qualityMode}`}
            </span>
          </div>
        </div>

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
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
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
                  feedRef={(el) => {
                    cellRefs.current[i] = el;
                  }}
                  onOpen={() => setFocusCam(cam)}
                  onTag={() => setTagCam(cam)}
                  onToggleFullscreen={() => toggleFullscreen(i)}
                />
              ) : (
                <div key={i} className="overflow-hidden rounded-xl border border-dashed border-stone-300 bg-white shadow-sm">
                  <div className={`relative ${feedHeight} w-full overflow-hidden bg-stone-100`}>
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                      <Camera size={18} className="mb-1.5 text-stone-300" />
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

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4">
              <Siren size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Incident Response Starts Here</h3>
                <p className="text-[11px] text-[#94A3B8]">The matrix is the exact origin point for active incident reporting</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-3">
              {[
                { step: "1", icon: Flag, title: "Spot & Tag", desc: "Click Tag on any live stream to flag the threat you observe." },
                { step: "2", icon: Video, title: "Auto Clip & Save", desc: "A 40-second clip (30s pre + 10s post) is saved to Supabase Storage." },
                { step: "3", icon: Siren, title: "Incident & Triage", desc: "A CCTV-Reported incident is created and routed to the Desk Officer." },
              ].map((s) => (
                <div key={s.step} className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0038A8] text-[9px] font-bold text-white">
                      {s.step}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-900">
                      <s.icon size={11} className="text-[#0038A8]" />
                      {s.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-stone-500">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
              <Info size={12} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-[10px] leading-relaxed text-amber-700">
                Matrix tags always auto-escalate (40s clip + incident + D.O. ticket). Manual Threat Flags can also be
                held as "pending" without escalation. Per the spec, a tag from either screen is a single official
                incident — a unified tagging pipeline (shared catalog + single create path) is a backend integration
                item.
              </p>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Stream Protocols</h3>
                  <p className="text-[11px] text-[#94A3B8]">How each feed reaches the browser</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {cameras.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2.5 mb-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${c.status === "offline" ? "bg-stone-100 text-stone-400" : "bg-[#0038A8]/5 text-[#0038A8]"}`}>
                      <Camera size={12} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-stone-900">{c.name}</span>
                      <span className="block truncate font-mono text-[8px] text-stone-400">
                        {c.nativeProtocol === "RTSP" ? c.rtspUrl : c.hlsUrl}
                      </span>
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                    c.status === "offline"
                      ? "bg-stone-100 text-stone-400"
                      : c.nativeProtocol === "RTSP"
                        ? "bg-violet-100 text-violet-700"
                        : "bg-sky-100 text-sky-700"
                  }`}>
                    {c.status === "offline" ? "Offline" : c.nativeProtocol === "RTSP" ? "FFmpeg → HLS" : "Native HLS"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`mt-5 rounded-xl border px-5 py-4 shadow-sm ${storageCritical ? "border-rose-200 bg-rose-50/50" : "border-black/5 bg-white"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className={storageCritical ? "text-rose-600" : "text-[#0038A8]"} />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">DVR Storage Capacity</h3>
                <p className="text-[11px] text-[#94A3B8]">
                  {storageUsedGB.toFixed(1)} GB of {STORAGE_TOTAL_GB} GB used · 1-year retention · 40s clips appended on tag
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${storageCritical ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                {storageCritical ? "NEAR CAPACITY" : "HEALTHY"}
              </span>
              <button
                onClick={purgeStorage}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <HardDriveDownload size={12} />
                Purge &gt; Retention
              </button>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full transition-all ${storageCritical ? "bg-rose-500" : "bg-[#0038A8]"}`} style={{ width: `${storagePct}%` }} />
          </div>
          <p className="mt-2 text-[9px] text-stone-400">
            {storageCritical
              ? "Storage above 90% — oldest footage beyond the 1-year retention window is at risk. Purge reclaimed footage or expand the volume."
              : "Footage older than the 1-year retention window is automatically marked for purge. Capacity headroom available."}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Undo2 size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Session Tags &amp; Undo</h3>
                  <p className="text-[11px] text-[#94A3B8]">Retract a tag before dispatch acts on it</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{sessionTags.length} this session</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {sessionTags.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10">
                  <Undo2 size={20} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No tags this session</p>
                  <p className="text-[10px] text-stone-400">Tag a live feed to enable undo</p>
                </div>
              ) : (
                sessionTags.map((t) => (
                  <div key={t.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-stone-900">{t.id}</span>
                      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-500">{t.tagType}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-stone-600">{t.cameraName} · {t.incidentId}</p>
                    <p className="flex items-center gap-1 text-[9px] text-stone-400">
                      <Clock size={8} />
                      {formatTime(t.escalatedAt)}
                      <span className="mx-0.5">&middot;</span>
                      <User size={8} />
                      {t.operator}
                      {t.preRollIncomplete && (
                        <>
                          <span className="mx-0.5">&middot;</span>
                          <span className="text-amber-600">pre-roll incomplete</span>
                        </>
                      )}
                    </p>
                    <button
                      onClick={() => setRetractTarget(t)}
                      className="mt-2 flex h-7 w-full items-center justify-center gap-1 rounded-md border border-stone-300 bg-white px-2 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <Undo2 size={11} />
                      Retract / Undo
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Camera Fault &amp; Maintenance</h3>
                  <p className="text-[11px] text-[#94A3B8]">Report hardware failures as maintenance tickets to Barangay Admin</p>
                </div>
              </div>
              <button
                onClick={() => setFaultOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Wrench size={12} />
                Report Fault
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {faults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10">
                  <CheckCircle2 size={20} className="mb-2 text-emerald-300" />
                  <p className="text-[12px] font-medium text-stone-500">No maintenance tickets</p>
                </div>
              ) : (
                faults.map((f) => (
                  <div key={f.id} className={`rounded-lg border px-3.5 py-2.5 ${f.status === "open" ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0038A8]/10 text-[#0038A8]">
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
                      <button
                        onClick={() => resolveFault(f)}
                        className="mt-2 flex h-7 w-full items-center justify-center gap-1 rounded-md border border-emerald-300 bg-white px-2 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <CheckCircle2 size={11} />
                        Mark Resolved &amp; Restore Feed
                      </button>
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

      {tagCam && (
        <TagModal camera={tagCam} now={now} onClose={() => setTagCam(null)} onConfirm={(t, n, p) => confirmTag(tagCam, t, n, p)} />
      )}

      {focusCam && (
        <StreamFocusModal
          camera={focusCam}
          mode={qualityMode}
          now={now}
          onTag={() => setTagCam(focusCam)}
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

      {routing && (
        <RoutingModal clip={routing.clip} incidentId={routing.incidentId} onComplete={completeRouting} />
      )}

      {routingDone && (
        <ConfirmModal
          type="success"
          title="Escalation Created &amp; Routed"
          message={`${routingDone.id} (40s clip) saved to Supabase Storage. Incident ${routingDone.incidentId} created as CCTV-Reported with priority ${routingDone.priority} and linked evidence from ${routingDone.cameraName}. It is now in the Barangay Desk Officer's triage queue — track its status in Escalated Clips &amp; Dispatches.`}
          onClose={() => setRoutingDone(null)}
        />
      )}

      {faultOpen && (
        <FaultModal
          cameras={cameras}
          onClose={() => setFaultOpen(false)}
          onSubmit={(cam, severity, description) => reportFault(cam, severity, description)}
        />
      )}

      {faultReported && (
        <ConfirmModal
          type="success"
          title="Maintenance Ticket Filed"
          message={`${faultReported.ticket} opened for ${faultReported.cameraName} (${faultReported.severity}) by ${faultReported.operator}. Barangay Admin has been notified and will schedule maintenance.`}
          onClose={() => setFaultReported(null)}
        />
      )}

      {retractTarget && (
        <ConfirmModal
          type="confirm"
          title="Retract Tag?"
          message={`${retractTarget.id} (${retractTarget.tagType}) on ${retractTarget.cameraName} will be withdrawn. Incident ${retractTarget.incidentId} will be recalled from Desk Officer triage. This only works before dispatch.`}
          onClose={() => setRetractTarget(null)}
          onConfirm={() => retractTag(retractTarget)}
          confirmLabel="Retract tag"
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
