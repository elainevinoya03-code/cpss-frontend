import { useState, useEffect, useRef } from "react";
import {
  Eye,
  Camera,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Camera as CameraIcon,
  AlertTriangle,
  CheckCircle2,
  Send,
  Crosshair,
  Info,
  ShieldCheck,
  Circle,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { ConfirmModal, Modal } from "../components/ui";

/* -------------------------------------------------------------------------- */
/*  Types & Constants                                                         */
/* -------------------------------------------------------------------------- */

type IncidentType = "Accident" | "Disturbance" | "Suspicious Activity" | "Hazard" | "Other";
type Priority = "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";

interface CameraFeed {
  id: string;
  name: string;
  location: string;
  purok: string;
  status: "online" | "degraded" | "offline";
  signalPct: number;
  isPTZ: boolean;
}

interface IncidentTicket {
  id: string;
  cameraId: string;
  cameraName: string;
  location: string;
  purok: string;
  timestamp: string;
  incidentType: IncidentType;
  description: string;
  priority: Priority;
  snapshotTaken: boolean;
  bookmarkStart: string;
  bookmarkEnd: string;
}

interface BookmarkEntry {
  id: string;
  cameraId: string;
  start: string;
  end: string;
  snapshot: boolean;
}

const CAMERAS: CameraFeed[] = [
  { id: "CAM-001", name: "Main Road", location: "Main Road", purok: "Purok 1", status: "online", signalPct: 94, isPTZ: true },
  { id: "CAM-002", name: "Checkpoint", location: "Checkpoint", purok: "Purok 2", status: "online", signalPct: 88, isPTZ: false },
  { id: "CAM-003", name: "Purok 3", location: "Purok 3", purok: "Purok 3", status: "online", signalPct: 79, isPTZ: true },
  { id: "CAM-004", name: "Crowded Area", location: "Market Area", purok: "Purok 4", status: "degraded", signalPct: 46, isPTZ: false },
  { id: "CAM-005", name: "Plaza", location: "Barangay Plaza", purok: "Purok 5", status: "online", signalPct: 91, isPTZ: true },
  { id: "CAM-006", name: "Barangay Hall", location: "Hall Entrance", purok: "HQ", status: "offline", signalPct: 0, isPTZ: false },
  { id: "CAM-007", name: "Mini Park", location: "Playground", purok: "Purok 4", status: "online", signalPct: 84, isPTZ: false },
  { id: "CAM-008", name: "River Bank", location: "Low-lying area", purok: "Purok 5", status: "online", signalPct: 71, isPTZ: true },
  { id: "CAM-009", name: "Jeep Terminal", location: "Terminal", purok: "Purok 6", status: "online", signalPct: 82, isPTZ: false },
];

const INCIDENT_TYPES: IncidentType[] = ["Accident", "Disturbance", "Suspicious Activity", "Hazard", "Other"];
const PRIORITIES: Priority[] = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatTimeFull(date: Date) {
  return date.toLocaleTimeString("en-US", { hour12: false });
}

function signalQuality(pct: number) {
  if (pct === 0) return null;
  if (pct >= 80) return { label: "High", pill: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" };
  if (pct >= 50) return { label: "Medium", pill: "bg-amber-50 text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" };
  return { label: "Low", pill: "bg-rose-50 text-rose-600", bar: "bg-rose-500", dot: "bg-rose-500" };
}

/* -------------------------------------------------------------------------- */
/*  Live Feed Frame (mock)                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Camera Grid Cell                                                           */
/* -------------------------------------------------------------------------- */

function CameraGridCell({
  cam,
  now,
  isSelected,
  onClick,
}: {
  cam: CameraFeed;
  now: Date;
  isSelected: boolean;
  onClick: () => void;
}) {
  const q = signalQuality(cam.signalPct);
  const isOffline = cam.status === "offline";

  return (
    <div
      onClick={isOffline ? undefined : onClick}
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        isSelected ? "border-[#0038A8] ring-2 ring-[#0038A8]/20" : "border-black/5"
      } ${!isOffline ? "cursor-pointer" : ""}`}
    >
      <div className={`relative h-40 w-full overflow-hidden bg-black ${!isOffline ? "cursor-pointer" : ""}`}>
        {isOffline ? (
          <div className="flex h-full flex-col items-center justify-center bg-stone-900">
            <WifiOff size={18} className="mb-1.5 text-stone-600" />
            <p className="text-[10px] font-medium text-stone-500">Camera Offline</p>
            <p className="text-[8px] text-stone-600">{cam.id}</p>
          </div>
        ) : (
          <>
            <LiveFeedFrame />
            <div className="absolute left-2 top-2 flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                LIVE
              </span>
              <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                {cam.name}
              </span>
            </div>
            <div className="absolute right-2 top-2">
              {q && (
                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${q.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${q.dot}`} />
                  {q.label}
                </span>
              )}
            </div>
            <div className="absolute bottom-2 left-2 max-w-[60%] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
              {cam.id}
            </div>
            <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white/70">
              {formatTimeFull(now)}
            </div>
          </>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold text-stone-900">{cam.name}</span>
          <span className="shrink-0 text-[9px] text-stone-400">{cam.location}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
              isOffline
                ? "bg-stone-100 text-stone-400"
                : cam.status === "degraded"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isOffline ? "OFFLINE" : cam.status === "degraded" ? "DEGRADED" : "ONLINE"}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full ${isOffline ? "bg-stone-300" : q?.bar ?? "bg-emerald-500"}`}
              style={{ width: `${cam.signalPct}%` }}
            />
          </div>
          <span className="text-[9px] font-medium text-stone-400">{cam.signalPct}%</span>
          <Wifi size={10} className={isOffline ? "text-stone-300" : "text-emerald-500"} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PTZ Controls                                                               */
/* -------------------------------------------------------------------------- */

function PTZControls({ onZoomIn, onZoomOut }: { onZoomIn: () => void; onZoomOut: () => void }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
      <p className="mb-3 text-center text-[10px] font-semibold tracking-wider text-stone-400">PTZ CONTROL</p>
      <div className="flex flex-col items-center gap-1">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600 transition hover:bg-[#0038A8]/10 hover:text-[#0038A8]">
          <ArrowUp size={16} />
        </button>
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600 transition hover:bg-[#0038A8]/10 hover:text-[#0038A8]">
            <ArrowLeft size={16} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/10">
            <Crosshair size={14} className="text-[#0038A8]" />
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600 transition hover:bg-[#0038A8]/10 hover:text-[#0038A8]">
            <ArrowRight size={16} />
          </button>
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600 transition hover:bg-[#0038A8]/10 hover:text-[#0038A8]">
          <ArrowDown size={16} />
        </button>
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-center text-[9px] font-semibold tracking-wider text-stone-400">ZOOM</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onZoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600 transition hover:bg-stone-100"
          >
            <ZoomOut size={14} />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full w-1/2 rounded-full bg-[#0038A8]" />
          </div>
          <button
            onClick={onZoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600 transition hover:bg-stone-100"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Video Timeline with Incident Markers                                       */
/* -------------------------------------------------------------------------- */

function VideoTimeline({
  now,
  markers,
  onSeek,
}: {
  now: Date;
  markers: { time: string; label: string }[];
  onSeek?: () => void;
}) {
  const baseTime = new Date(now.getTime() - 5 * 60 * 1000);
  const positions = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const labels = positions.map((p) => {
    const t = new Date(baseTime.getTime() + p * 5 * 60 * 1000);
    return formatTimeFull(t);
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">VIDEO TIMELINE</p>
      <div className="relative">
        <div className="flex items-center justify-between text-[8px] text-stone-400">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="relative mt-1.5 h-2 w-full rounded-full bg-stone-200">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#0038A8]/30"
            style={{ width: "60%" }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0038A8] bg-white shadow"
            style={{ left: "60%" }}
          />
          {markers.map((m, i) => {
            const markerPos = 30 + i * 15;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${markerPos}%` }}
                title={m.label}
              >
                <div className="h-3 w-3 -translate-x-1/2 rounded-full border-2 border-amber-500 bg-amber-400 shadow" />
              </div>
            );
          })}
        </div>
        {markers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {markers.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-semibold text-amber-700"
              >
                <Circle size={6} className="fill-amber-400 text-amber-400" />
                {m.time} — {m.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tag Incident Modal                                                         */
/* -------------------------------------------------------------------------- */

function TagIncidentModal({
  camera,
  now,
  snapshotTaken,
  bookmarkStart,
  bookmarkEnd,
  onClose,
  onSubmit,
}: {
  camera: CameraFeed;
  now: Date;
  snapshotTaken: boolean;
  bookmarkStart: string;
  bookmarkEnd: string;
  onClose: () => void;
  onSubmit: (type: IncidentType, description: string, priority: Priority) => void;
}) {
  const [incidentType, setIncidentType] = useState<IncidentType>("Accident");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Tier 2");

  return (
    <Modal
      onClose={onClose}
      title="TAG INCIDENT"
      subtitle={`${camera.id} · ${camera.location}`}
      icon={<AlertTriangle size={18} />}
      iconClass="bg-rose-100 text-rose-600"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            CANCEL
          </button>
          <button
            onClick={() => onSubmit(incidentType, description.trim(), priority)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <CheckCircle2 size={13} />
            CREATE INCIDENT
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">INCIDENT TYPE</p>
          <select
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value as IncidentType)}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[12px] text-stone-900 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          >
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">DESCRIPTION</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the incident..."
            className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          />
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Camera</span>
              <span className="text-[11px] font-semibold text-stone-900">{camera.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Location</span>
              <span className="text-[11px] font-medium text-stone-800">{camera.location}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Timestamp</span>
              <span className="font-mono text-[11px] font-medium text-stone-900">{formatTimeFull(now)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Snapshot</span>
              <span className={`text-[11px] font-medium ${snapshotTaken ? "text-emerald-600" : "text-stone-400"}`}>
                {snapshotTaken ? "✓ Captured" : "✗ Not captured"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Video Bookmark</span>
              <span className="font-mono text-[11px] font-medium text-stone-900">
                {bookmarkStart} → {bookmarkEnd}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">PRIORITY</p>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[12px] text-stone-900 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bookmark Modal                                                             */
/* -------------------------------------------------------------------------- */

function BookmarkModal({
  camera,
  start,
  end,
  snapshotTaken,
  onClose,
  onSave,
}: {
  camera: CameraFeed;
  start: string;
  end: string;
  snapshotTaken: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="BOOKMARK INCIDENT"
      subtitle={`${camera.id} · ${camera.location}`}
      icon={<Bookmark size={18} />}
      iconClass="bg-amber-100 text-amber-600"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700"
          >
            <Bookmark size={13} />
            SAVE BOOKMARK
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Start</span>
              <span className="font-mono text-[12px] font-bold text-stone-900">{start}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">End</span>
              <span className="font-mono text-[12px] font-bold text-stone-900">{end}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Snapshot</span>
              <span className={`text-[11px] font-medium ${snapshotTaken ? "text-emerald-600" : "text-stone-400"}`}>
                {snapshotTaken ? "✓" : "✗"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-[#0038A8]/25 bg-[#0038A8]/5 px-3 py-2.5">
          <Info size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
          <p className="text-[10px] leading-relaxed text-stone-600">
            Saves the timestamp range from start to end and takes a snapshot for incident documentation.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Incident Created / Dispatch Modal                                          */
/* -------------------------------------------------------------------------- */

function IncidentCreatedModal({
  ticket,
  onClose,
  onSendToDesk,
}: {
  ticket: IncidentTicket;
  onClose: () => void;
  onSendToDesk: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="INCIDENT CREATED ✓"
      subtitle={`Incident #${ticket.id}`}
      icon={<CheckCircle2 size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
          <button
            onClick={onSendToDesk}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Send size={13} />
            SEND TO DESK
          </button>
        </div>
      }
    >
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Incident</span>
            <span className="font-mono text-[12px] font-bold text-[#0038A8]">#{ticket.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Camera</span>
            <span className="text-[11px] font-semibold text-stone-900">{ticket.cameraId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Location</span>
            <span className="text-[11px] font-medium text-stone-800">{ticket.location}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Time</span>
            <span className="font-mono text-[11px] font-medium text-stone-900">{ticket.timestamp}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Type</span>
            <span className="text-[11px] font-semibold text-stone-900">{ticket.incidentType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Priority</span>
            <span className="text-[11px] font-semibold text-stone-900">{ticket.priority}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500">Status</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              READY FOR DISPATCH
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#0038A8]/25 bg-[#0038A8]/5 px-3 py-2.5">
        <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <p className="text-[10px] leading-relaxed text-stone-600">
          This incident ticket is ready for dispatch to the Desk Officer or Chief Tanod for immediate response.
        </p>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function LiveMonitoring() {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [now, setNow] = useState(new Date());
  const [selectedCam, setSelectedCam] = useState<CameraFeed | null>(null);

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [incidentCreated, setIncidentCreated] = useState<IncidentTicket | null>(null);
  const [dispatched, setDispatched] = useState(false);

  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [bookmarkStart, setBookmarkStart] = useState("");
  const [bookmarkEnd, setBookmarkEnd] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [incidents, setIncidents] = useState<IncidentTicket[]>([]);

  const incidentSeqRef = useRef(1);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      // simulate slight signal jitter for online cameras
    }, 5000);
    return () => clearInterval(t);
  }, []);

  function handleSelectCamera(cam: CameraFeed) {
    if (cam.status === "offline") return;
    setSelectedCam(cam);
    setSnapshotTaken(false);
    setBookmarkStart("");
    setBookmarkEnd("");
    setTagModalOpen(false);
    setBookmarkModalOpen(false);
    setIncidentCreated(null);
    setDispatched(false);
  }

  function handleSnapshot() {
    if (!selectedCam) return;
    setSnapshotTaken(true);
    beep("info");
    flash(`Snapshot captured — ${selectedCam.id} at ${formatTimeFull(now)}`);
  }

  function handleBookmark() {
    if (!selectedCam) return;
    const start = formatTimeFull(now);
    const end = formatTimeFull(new Date(now.getTime() + 47000));
    setBookmarkStart(start);
    setBookmarkEnd(end);
    setBookmarkModalOpen(true);
  }

  function handleSaveBookmark() {
    if (!selectedCam) return;
    const entry: BookmarkEntry = {
      id: `BMK-${String(bookmarks.length + 1).padStart(3, "0")}`,
      cameraId: selectedCam.id,
      start: bookmarkStart,
      end: bookmarkEnd,
      snapshot: snapshotTaken,
    };
    setBookmarks((prev) => [entry, ...prev]);
    setBookmarkModalOpen(false);
    beep("info");
    flash(`Bookmark saved — ${entry.id} for ${selectedCam.id} (${bookmarkStart} → ${bookmarkEnd})`);
  }

  function handleTagIncident() {
    if (!selectedCam) return;
    setTagModalOpen(true);
  }

  function handleSubmitIncident(type: IncidentType, description: string, priority: Priority) {
    if (!selectedCam) return;
    const ticket: IncidentTicket = {
      id: String(1000 + incidentSeqRef.current++),
      cameraId: selectedCam.id,
      cameraName: selectedCam.name,
      location: selectedCam.location,
      purok: selectedCam.purok,
      timestamp: bookmarkStart || formatTimeFull(now),
      incidentType: type,
      description,
      priority,
      snapshotTaken,
      bookmarkStart: bookmarkStart || formatTimeFull(now),
      bookmarkEnd: bookmarkEnd || formatTimeFull(new Date(now.getTime() + 47000)),
    };
    setIncidents((prev) => [ticket, ...prev]);
    setTagModalOpen(false);
    setIncidentCreated(ticket);
    beep("critical");
    flash(`Incident #${ticket.id} created — ${type} at ${selectedCam.location}, ready for dispatch`);
  }

  function handleSendToDesk() {
    if (!incidentCreated) return;
    setDispatched(true);
    beep("info");
    flash(`Incident #${incidentCreated.id} dispatched — sent to Desk Officer / Chief Tanod for immediate response`);
  }

  function handleCloseIncidentCreated() {
    setIncidentCreated(null);
    setDispatched(false);
  }

  const timelineMarkers = incidents
    .filter((inc) => inc.cameraId === selectedCam?.id)
    .map((inc) => ({ time: inc.timestamp, label: inc.incidentType }));

  const onlineCount = CAMERAS.filter((c) => c.status !== "offline").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Live Monitoring</h1>
              <p className="mt-1 text-sm text-stone-500">
                Real-time camera feed monitoring and incident detection
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">
                <Wifi size={12} />
                {onlineCount} live
              </span>
              {bookmarks.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
                  <Bookmark size={12} />
                  {bookmarks.length} bookmarked
                </span>
              )}
              {incidents.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-700">
                  <AlertTriangle size={12} />
                  {incidents.length} incidents
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-5 xl:flex-row">
          {/* LEFT: Camera Grid */}
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Camera size={16} className="text-[#0038A8]" />
              <h2 className="text-[14px] font-semibold text-[#334155]">CAMERA GRID</h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                {CAMERAS.length} cameras
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {CAMERAS.map((cam) => (
                <CameraGridCell
                  key={cam.id}
                  cam={cam}
                  now={now}
                  isSelected={selectedCam?.id === cam.id}
                  onClick={() => handleSelectCamera(cam)}
                />
              ))}
            </div>
          </div>

          {/* RIGHT: Selected Camera Panel */}
          <div className="w-full xl:w-[420px] shrink-0">
            {selectedCam ? (
              <div className="space-y-4">
                {/* Selected Camera Header */}
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-stone-400">SELECTED CAMERA</p>
                      <p className="mt-0.5 font-mono text-[14px] font-bold text-stone-900">{selectedCam.id}</p>
                      <p className="text-[11px] text-stone-500">{selectedCam.location} · {selectedCam.purok}</p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      LIVE
                    </span>
                  </div>
                </div>

                {/* Focused Feed */}
                <div className="relative overflow-hidden rounded-xl border border-black/10 bg-black shadow-sm">
                  <div className="relative h-56 w-full sm:h-64">
                    <LiveFeedFrame />
                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                        LIVE
                      </span>
                      <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] font-medium text-white">
                        {selectedCam.id}
                      </span>
                    </div>
                    <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                      {formatTimeFull(now)}
                    </div>
                    {selectedCam.isPTZ && (
                      <div className="absolute left-3 bottom-3 rounded-md bg-[#0038A8]/80 px-2 py-1 text-[9px] font-semibold text-white">
                        PTZ
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                    <p className="text-[9px] font-semibold tracking-wider text-stone-400">CAMERA ID</p>
                    <p className="mt-0.5 font-mono text-[11px] font-bold text-stone-900">{selectedCam.id}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                    <p className="text-[9px] font-semibold tracking-wider text-stone-400">LOCATION</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-800">
                      <MapPin size={10} className="text-[#0038A8]" />
                      {selectedCam.location}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                    <p className="text-[9px] font-semibold tracking-wider text-stone-400">TIMESTAMP</p>
                    <p className="mt-0.5 font-mono text-[11px] font-medium text-stone-900">{formatTimeFull(now)}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                    <p className="text-[9px] font-semibold tracking-wider text-stone-400">STATUS</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        selectedCam.status === "online" ? "bg-emerald-500" : selectedCam.status === "degraded" ? "bg-amber-400" : "bg-stone-400"
                      }`} />
                      <span className="text-[11px] font-medium capitalize text-stone-800">{selectedCam.status}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleSnapshot}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <CameraIcon size={14} />
                      SNAPSHOT
                    </button>
                    <button
                      onClick={handleBookmark}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Bookmark size={14} />
                      BOOKMARK
                    </button>
                  </div>
                  <button
                    onClick={handleTagIncident}
                    className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-[13px] font-bold text-white shadow-lg transition hover:bg-rose-700"
                  >
                    <AlertTriangle size={15} />
                    TAG INCIDENT
                  </button>
                </div>

                {/* PTZ Controls (if PTZ camera) */}
                {selectedCam.isPTZ && <PTZControls onZoomIn={() => {}} onZoomOut={() => {}} />}

                {/* Video Timeline */}
                <VideoTimeline now={now} markers={timelineMarkers} />

                {/* Recent Bookmarks for this camera */}
                {bookmarks.filter((b) => b.cameraId === selectedCam.id).length > 0 && (
                  <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                    <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">BOOKMARKS</p>
                    <div className="space-y-1.5">
                      {bookmarks
                        .filter((b) => b.cameraId === selectedCam.id)
                        .map((b) => (
                          <div key={b.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Bookmark size={10} className="text-amber-500" />
                              <span className="font-mono text-[10px] font-bold text-stone-900">{b.id}</span>
                            </div>
                            <span className="font-mono text-[9px] text-stone-500">
                              {b.start} → {b.end}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-5 py-20 text-center">
                <Eye size={28} className="mb-3 text-stone-300" />
                <p className="text-[13px] font-medium text-stone-500">No camera selected</p>
                <p className="mt-1 text-[11px] text-stone-400">Click a camera in the grid to focus on its live feed</p>
              </div>
            )}
          </div>
        </div>

        {/* Incidents Created (session log) */}
        {incidents.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600" />
              <h2 className="text-[14px] font-semibold text-[#334155]">INCIDENTS CREATED</h2>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                {incidents.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-stone-900">#{inc.id}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                      {inc.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-stone-800">{inc.incidentType}</p>
                  <p className="text-[9px] text-stone-400">{inc.cameraId} · {inc.location}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[9px] text-stone-400">
                    <Clock size={8} />
                    {inc.timestamp}
                  </div>
                  {inc.description && (
                    <p className="mt-1 truncate text-[9px] text-stone-400">{inc.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {tagModalOpen && selectedCam && (
        <TagIncidentModal
          camera={selectedCam}
          now={now}
          snapshotTaken={snapshotTaken}
          bookmarkStart={bookmarkStart || formatTimeFull(now)}
          bookmarkEnd={bookmarkEnd || formatTimeFull(new Date(now.getTime() + 47000))}
          onClose={() => setTagModalOpen(false)}
          onSubmit={handleSubmitIncident}
        />
      )}

      {bookmarkModalOpen && selectedCam && (
        <BookmarkModal
          camera={selectedCam}
          start={bookmarkStart}
          end={bookmarkEnd}
          snapshotTaken={snapshotTaken}
          onClose={() => setBookmarkModalOpen(false)}
          onSave={handleSaveBookmark}
        />
      )}

      {incidentCreated && (
        <IncidentCreatedModal
          ticket={incidentCreated}
          onClose={handleCloseIncidentCreated}
          onSendToDesk={handleSendToDesk}
        />
      )}

      {dispatched && incidentCreated && (
        <ConfirmModal
          type="success"
          title="Dispatched to Desk Officer"
          message={`Incident #${incidentCreated.id} has been sent to the Desk Officer / Chief Tanod for immediate response. Camera ${incidentCreated.cameraId} at ${incidentCreated.location} — ${incidentCreated.incidentType}.`}
          onClose={handleCloseIncidentCreated}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
