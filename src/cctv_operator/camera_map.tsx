import { useState, useEffect, useMemo } from "react";
import {
  Camera,
  MapPin,
  Search,
  Eye,
  Crosshair,
  AlertTriangle,
  Wifi,
  WifiOff,
  Wrench,
  CheckCircle2,
  X,
  ChevronRight,
  Navigation,
  Radio,
  Info,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { Modal } from "../components/ui";

/* -------------------------------------------------------------------------- */
/*  Types & Constants                                                         */
/* -------------------------------------------------------------------------- */

type CameraStatus = "online" | "offline" | "maintenance";
type CameraType = "PTZ" | "Fixed";
type MapFilter = "all" | "online" | "offline" | "maintenance" | "near_incident";

interface CameraMarker {
  id: string;
  name: string;
  location: string;
  street: string;
  purok: string;
  landmark: string;
  status: CameraStatus;
  type: CameraType;
  mapX: number;
  mapY: number;
}

interface IncidentAlert {
  id: string;
  location: string;
  purok: string;
  alertType: string;
  timestamp: string;
  mapX: number;
  mapY: number;
}

interface Zone {
  name: string;
  mapX: number;
  mapY: number;
  color: string;
}

const CAMERAS: CameraMarker[] = [
  { id: "CAM-001", name: "Main Road", location: "Main Road, Purok 1", street: "Main Road", purok: "Purok 1", landmark: "Barangay Hall", status: "online", type: "PTZ", mapX: 22, mapY: 28 },
  { id: "CAM-002", name: "Checkpoint", location: "Checkpoint, Purok 2", street: "National Highway", purok: "Purok 2", landmark: "Checkpoint", status: "online", type: "Fixed", mapX: 38, mapY: 18 },
  { id: "CAM-003", name: "Purok 3 Crossing", location: "Purok Crossing, Purok 3", street: "Purok Crossing", purok: "Purok 3", landmark: "Chapel", status: "online", type: "PTZ", mapX: 55, mapY: 35 },
  { id: "CAM-004", name: "Market Area", location: "Market Strip, Purok 6", street: "Market Road", purok: "Purok 6", landmark: "Public Market", status: "online", type: "Fixed", mapX: 72, mapY: 22 },
  { id: "CAM-005", name: "Plaza & Court", location: "Barangay Plaza, Purok 2", street: "Plaza Avenue", purok: "Purok 2", landmark: "Barangay Plaza", status: "online", type: "PTZ", mapX: 35, mapY: 42 },
  { id: "CAM-006", name: "Barangay Hall", location: "Hall Entrance, HQ", street: "Main Road", purok: "HQ", landmark: "Barangay Hall", status: "offline", type: "Fixed", mapX: 20, mapY: 38 },
  { id: "CAM-007", name: "Mini Park", location: "Playground, Purok 4", street: "Park Lane", purok: "Purok 4", landmark: "Playground", status: "online", type: "Fixed", mapX: 48, mapY: 52 },
  { id: "CAM-008", name: "River Bank", location: "Low-lying area, Purok 5", street: "Riverside Road", purok: "Purok 5", landmark: "River Bridge", status: "maintenance", type: "PTZ", mapX: 60, mapY: 65 },
  { id: "CAM-009", name: "Jeep Terminal", location: "Terminal, Purok 6", street: "Terminal Road", purok: "Purok 6", landmark: "Jeepney Terminal", status: "online", type: "Fixed", mapX: 78, mapY: 40 },
];

const INCIDENT_ALERTS: IncidentAlert[] = [
  { id: "ALT-001", location: "Purok 4", purok: "Purok 4", alertType: "SOS", timestamp: "10:42:15 AM", mapX: 50, mapY: 50 },
];

const ZONES: Zone[] = [
  { name: "Purok 1", mapX: 18, mapY: 22, color: "#0038A8" },
  { name: "Purok 2", mapX: 36, mapY: 22, color: "#0038A8" },
  { name: "Purok 3", mapX: 52, mapY: 28, color: "#0038A8" },
  { name: "Purok 4", mapX: 46, mapY: 48, color: "#0038A8" },
  { name: "Purok 5", mapX: 58, mapY: 58, color: "#0038A8" },
  { name: "Purok 6", mapX: 74, mapY: 32, color: "#0038A8" },
  { name: "HQ", mapX: 16, mapY: 36, color: "#0038A8" },
];

const FILTER_OPTIONS: { key: MapFilter; label: string }[] = [
  { key: "all", label: "All Cameras" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
  { key: "maintenance", label: "Maintenance" },
  { key: "near_incident", label: "Near Incident" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatTimeFull(date: Date) {
  return date.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function statusMeta(status: CameraStatus) {
  if (status === "online") return { label: "Online", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700", ring: "ring-emerald-400/40" };
  if (status === "maintenance") return { label: "Maintenance", dot: "bg-amber-400", pill: "bg-amber-50 text-amber-700", ring: "ring-amber-400/40" };
  return { label: "Offline", dot: "bg-stone-400", pill: "bg-stone-100 text-stone-500", ring: "ring-stone-300/40" };
}

function distBetween(a: { mapX: number; mapY: number }, b: { mapX: number; mapY: number }) {
  return Math.sqrt((a.mapX - b.mapX) ** 2 + (a.mapY - b.mapY) ** 2);
}

function nearbyCameras(cameras: CameraMarker[], alert: IncidentAlert, maxDist = 25) {
  return cameras
    .filter((c) => c.status !== "offline" && distBetween(c, alert) <= maxDist)
    .sort((a, b) => distBetween(a, alert) - distBetween(b, alert));
}

/* -------------------------------------------------------------------------- */
/*  GIS Map (mock)                                                             */
/* -------------------------------------------------------------------------- */

function GisMap({
  cameras,
  selectedCam,
  alerts,
  activeAlert,
  onSelectCamera,
  onSelectAlert,
  now,
}: {
  cameras: CameraMarker[];
  selectedCam: CameraMarker | null;
  alerts: IncidentAlert[];
  activeAlert: IncidentAlert | null;
  onSelectCamera: (cam: CameraMarker) => void;
  onSelectAlert: (alert: IncidentAlert) => void;
  now: Date;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-stone-200 bg-[#d6e0f0]">
      {/* Map base layers */}
      <div className="absolute inset-0">
        {/* Streets */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Horizontal streets */}
          <line x1="5" y1="30" x2="95" y2="30" stroke="#b0bfd4" strokeWidth="0.4" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="#b0bfd4" strokeWidth="0.4" />
          <line x1="10" y1="70" x2="90" y2="70" stroke="#b0bfd4" strokeWidth="0.4" />
          {/* Vertical streets */}
          <line x1="25" y1="10" x2="25" y2="90" stroke="#b0bfd4" strokeWidth="0.4" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#b0bfd4" strokeWidth="0.4" />
          <line x1="75" y1="10" x2="75" y2="90" stroke="#b0bfd4" strokeWidth="0.4" />
          {/* Diagonal road */}
          <line x1="10" y1="15" x2="90" y2="75" stroke="#b0bfd4" strokeWidth="0.3" strokeDasharray="1.5 0.8" />
        </svg>

        {/* Zone/purok boundaries */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="8" y="14" width="22" height="22" rx="1" fill="#0038A8" fillOpacity="0.04" stroke="#0038A8" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
          <rect x="28" y="14" width="20" height="20" rx="1" fill="#0038A8" fillOpacity="0.04" stroke="#0038A8" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
          <rect x="44" y="22" width="20" height="20" rx="1" fill="#0038A8" fillOpacity="0.04" stroke="#0038A8" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
          <rect x="38" y="40" width="22" height="22" rx="1" fill="#0038A8" fillOpacity="0.04" stroke="#0038A8" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
          <rect x="52" y="50" width="20" height="20" rx="1" fill="#0038A8" fillOpacity="0.04" stroke="#0038A8" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
          <rect x="64" y="14" width="22" height="22" rx="1" fill="#0038A8" fillOpacity="0.04" stroke="#0038A8" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
          <rect x="8" y="34" width="20" height="16" rx="1" fill="#6366f1" fillOpacity="0.04" stroke="#6366f1" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 0.5" />
        </svg>

        {/* Zone labels */}
        {ZONES.map((z) => (
          <div
            key={z.name}
            className="pointer-events-none absolute select-none text-[8px] font-bold uppercase tracking-wider text-[#0038A8]/30"
            style={{ left: `${z.mapX}%`, top: `${z.mapY}%`, transform: "translate(-50%, -50%)" }}
          >
            {z.name}
          </div>
        ))}

        {/* Street labels */}
        <div className="pointer-events-none absolute left-[5%] top-[28%] select-none text-[7px] font-medium text-stone-400/60" style={{ transform: "rotate(-2deg)" }}>
          Main Road
        </div>
        <div className="pointer-events-none absolute left-[40%] top-[16%] select-none text-[7px] font-medium text-stone-400/60">
          National Highway
        </div>
        <div className="pointer-events-none absolute left-[52%] top-[33%] select-none text-[7px] font-medium text-stone-400/60">
          Purok Crossing
        </div>
        <div className="pointer-events-none absolute left-[68%] top-[20%] select-none text-[7px] font-medium text-stone-400/60">
          Market Road
        </div>
        <div className="pointer-events-none absolute left-[30%] top-[40%] select-none text-[7px] font-medium text-stone-400/60">
          Plaza Avenue
        </div>
        <div className="pointer-events-none absolute left-[44%] top-[50%] select-none text-[7px] font-medium text-stone-400/60">
          Park Lane
        </div>
        <div className="pointer-events-none absolute left-[56%] top-[63%] select-none text-[7px] font-medium text-stone-400/60">
          Riverside Road
        </div>
        <div className="pointer-events-none absolute left-[74%] top-[38%] select-none text-[7px] font-medium text-stone-400/60">
          Terminal Road
        </div>

        {/* Landmark icons */}
        <div className="absolute left-[18%] top-[35%] flex flex-col items-center" title="Barangay Hall">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-stone-300/50 text-[7px] text-stone-500">H</div>
        </div>
        <div className="absolute left-[53%] top-[26%] flex flex-col items-center" title="Chapel">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-stone-300/50 text-[7px] text-stone-500">C</div>
        </div>
        <div className="absolute left-[70%] top-[19%] flex flex-col items-center" title="Public Market">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-stone-300/50 text-[7px] text-stone-500">M</div>
        </div>
        <div className="absolute left-[76%] top-[37%] flex flex-col items-center" title="Jeepney Terminal">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-stone-300/50 text-[7px] text-stone-500">T</div>
        </div>
        <div className="absolute left-[58%] top-[63%] flex flex-col items-center" title="River Bridge">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-stone-300/50 text-[7px] text-stone-500">B</div>
        </div>

        {/* Incident alert marker */}
        {activeAlert && (
          <div
            className="absolute z-20 flex flex-col items-center"
            style={{ left: `${activeAlert.mapX}%`, top: `${activeAlert.mapY}%`, transform: "translate(-50%, -100%)" }}
          >
            <div className="relative mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg ring-4 ring-rose-300/40">
              <AlertTriangle size={16} />
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-700 text-[6px] font-bold text-white ring-2 ring-white">
                !
              </span>
            </div>
            <div className="rounded-md bg-rose-700 px-2 py-0.5 text-[7px] font-bold text-white shadow-md">
              {activeAlert.alertType} — {activeAlert.purok}
            </div>
          </div>
        )}

        {/* Camera markers */}
        {cameras.map((cam) => {
          const sm = statusMeta(cam.status);
          const isSelected = selectedCam?.id === cam.id;
          return (
            <button
              key={cam.id}
              onClick={() => onSelectCamera(cam)}
              className={`absolute z-10 flex flex-col items-center transition ${
                isSelected ? "z-30 scale-110" : "hover:z-20 hover:scale-105"
              }`}
              style={{ left: `${cam.mapX}%`, top: `${cam.mapY}%`, transform: "translate(-50%, -100%)" }}
              title={`${cam.id} — ${cam.name}`}
            >
              <div
                className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg transition ${
                  isSelected ? "bg-[#0038A8] ring-2 ring-[#0038A8]/30" : "bg-white"
                }`}
              >
                <Camera size={13} className={isSelected ? "text-white" : sm.dot.replace("bg-", "text-").replace("-500", "-600")} />
                {cam.status === "online" && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                )}
                {cam.status === "maintenance" && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white" />
                )}
              </div>
              <div
                className={`mt-0.5 whitespace-nowrap rounded px-1 py-px text-[7px] font-bold shadow-sm ${
                  isSelected ? "bg-[#0038A8] text-white" : "bg-white text-stone-700"
                }`}
              >
                {cam.id}
              </div>
            </button>
          );
        })}
      </div>

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 z-30 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
        <p className="mb-1.5 text-[7px] font-bold uppercase tracking-wider text-stone-400">Legend</p>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white" />
            <span className="text-[8px] font-medium text-stone-600">Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-stone-400 ring-1 ring-white" />
            <span className="text-[8px] font-medium text-stone-600">Offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white" />
            <span className="text-[8px] font-medium text-stone-600">Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-rose-600 ring-1 ring-white">
              <AlertTriangle size={7} className="text-white" />
            </span>
            <span className="text-[8px] font-medium text-stone-600">Incident Alert</span>
          </div>
        </div>
      </div>

      {/* Map corner info */}
      <div className="absolute bottom-3 right-3 z-30 rounded-lg border border-stone-200 bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
        <p className="text-[8px] font-medium text-stone-400">Barangay GIS Map — {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Camera List Row                                                           */
/* -------------------------------------------------------------------------- */

function CameraListRow({
  cam,
  isSelected,
  onClick,
}: {
  cam: CameraMarker;
  isSelected: boolean;
  onClick: () => void;
}) {
  const sm = statusMeta(cam.status);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
        isSelected ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
        <Camera size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[11px] font-bold text-stone-900">{cam.id}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${sm.pill}`}>
            {sm.label}
          </span>
        </div>
        <p className="truncate text-[9px] text-stone-500">{cam.name} · {cam.location}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[8px] text-stone-400">
          <span>{cam.type}</span>
          <span>·</span>
          <span>{cam.purok}</span>
        </div>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Selected Camera Panel                                                     */
/* -------------------------------------------------------------------------- */

function SelectedCameraPanel({
  cam,
  now,
  onViewFeed,
  onPtzControl,
  onOpenDetails,
}: {
  cam: CameraMarker;
  now: Date;
  onViewFeed: () => void;
  onPtzControl: () => void;
  onOpenDetails: () => void;
}) {
  const sm = statusMeta(cam.status);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">SELECTED CAMERA</p>
            <p className="mt-0.5 font-mono text-[13px] font-bold text-stone-900">{cam.id}</p>
            <p className="text-[10px] text-stone-500">{cam.name}</p>
          </div>
          <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-semibold ${sm.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sm.dot} ${cam.status === "online" ? "animate-pulse" : ""}`} />
            {sm.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CAMERA ID</p>
          <p className="mt-0.5 font-mono text-[10px] font-bold text-stone-900">{cam.id}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">TYPE</p>
          <p className="mt-0.5 text-[10px] font-semibold text-stone-900">{cam.type}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">LOCATION</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-stone-800">
            <MapPin size={9} className="text-[#0038A8]" />
            {cam.location}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">STATUS</p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${sm.dot}`} />
            <span className="text-[10px] font-medium text-stone-800">{sm.label}</span>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">LAST ACTIVE</p>
          <p className="mt-0.5 font-mono text-[10px] font-medium text-stone-900">
            {cam.status === "offline" ? (
              <span className="text-stone-400">N/A</span>
            ) : (
              formatTimeFull(now)
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onViewFeed}
          disabled={cam.status === "offline"}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-bold text-white shadow transition hover:bg-[#002A8C] disabled:opacity-40"
        >
          <Eye size={14} />
          VIEW LIVE FEED
        </button>
        <div className="flex gap-2">
          <button
            onClick={onPtzControl}
            disabled={cam.type !== "PTZ" || cam.status === "offline"}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[10px] font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
          >
            <Crosshair size={12} />
            PTZ CONTROL
          </button>
          <button
            onClick={onOpenDetails}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[10px] font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            <Info size={12} />
            CAMERA DETAILS
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Incident Alert Panel                                                      */
/* -------------------------------------------------------------------------- */

function IncidentAlertPanel({
  alert,
  cameras,
  onSelectNearest,
}: {
  alert: IncidentAlert;
  cameras: CameraMarker[];
  onSelectNearest: (cam: CameraMarker) => void;
}) {
  const nearby = nearbyCameras(cameras, alert);
  const nearest = nearby[0] ?? null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-600">
          <AlertTriangle size={12} className="text-white" />
        </span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-rose-600">Emergency Alert</p>
          <p className="text-[10px] font-medium text-stone-700">{alert.alertType} at {alert.location}</p>
        </div>
      </div>

      <div className="space-y-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-stone-500">Location</span>
          <span className="text-[10px] font-semibold text-stone-900">{alert.location}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-stone-500">Alert Type</span>
          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold text-rose-700">{alert.alertType}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-stone-500">Time</span>
          <span className="font-mono text-[10px] font-medium text-stone-900">{alert.timestamp}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-[8px] text-stone-500">Nearby Cameras</span>
          <div className="flex flex-wrap justify-end gap-1">
            {nearby.length === 0 ? (
              <span className="text-[9px] text-stone-400">None available</span>
            ) : (
              nearby.map((c) => (
                <span key={c.id} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[8px] font-semibold text-stone-700">
                  {c.id}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {nearest && (
        <button
          onClick={() => onSelectNearest(nearest)}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[11px] font-bold text-white shadow transition hover:bg-rose-700"
        >
          <Navigation size={13} />
          SELECT NEAREST CAMERA ({nearest.id})
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Camera Details Modal                                                      */
/* -------------------------------------------------------------------------- */

function CameraDetailsModal({
  cam,
  now,
  onClose,
  onViewFeed,
}: {
  cam: CameraMarker;
  now: Date;
  onClose: () => void;
  onViewFeed: () => void;
}) {
  const sm = statusMeta(cam.status);
  return (
    <Modal
      onClose={onClose}
      title="Camera Details"
      subtitle={`${cam.id} — ${cam.name}`}
      icon={<Camera size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
          <button
            onClick={onViewFeed}
            disabled={cam.status === "offline"}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
          >
            <Eye size={13} />
            VIEW LIVE FEED
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CAMERA ID</p>
          <p className="mt-0.5 font-mono text-[11px] font-bold text-stone-900">{cam.id}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CAMERA NAME</p>
          <p className="mt-0.5 text-[11px] font-bold text-stone-900">{cam.name}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">FULL LOCATION</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-800">
            <MapPin size={10} className="text-[#0038A8]" />
            {cam.location}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">STREET</p>
          <p className="mt-0.5 text-[11px] font-medium text-stone-800">{cam.street}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">PUROK / ZONE</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#0038A8]">{cam.purok}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">LANDMARK</p>
          <p className="mt-0.5 text-[11px] font-medium text-stone-800">{cam.landmark}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CAMERA TYPE</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-800">
            {cam.type === "PTZ" ? <Crosshair size={10} className="text-[#0038A8]" /> : <Camera size={10} className="text-stone-400" />}
            {cam.type}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">STATUS</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${sm.dot}`} />
            <span className="text-[11px] font-semibold text-stone-900">{sm.label}</span>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">LAST ACTIVE</p>
          <p className="mt-0.5 font-mono text-[11px] font-medium text-stone-900">
            {cam.status === "offline" ? <span className="text-stone-400">N/A</span> : formatTimeFull(now)}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  View Live Feed Modal                                                      */
/* -------------------------------------------------------------------------- */

function ViewLiveFeedModal({
  cam,
  now,
  onClose,
}: {
  cam: CameraMarker;
  now: Date;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Live Feed"
      subtitle={`${cam.id} — ${cam.name} · ${cam.location}`}
      icon={<Radio size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      size="lg"
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
      <div className="relative h-56 w-full overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 sm:h-64">
        <div className="absolute right-6 top-4 h-8 w-8 rounded-full bg-stone-600/80" />
        <div className="absolute left-[8%] bottom-0 h-24 w-16 rounded-t bg-stone-700/90" />
        <div className="absolute left-[16%] bottom-0 h-16 w-10 rounded-t bg-stone-700/70" />
        <div className="absolute right-[10%] bottom-0 h-20 w-24 rounded-t bg-stone-700/80" />
        <div className="absolute inset-x-0 bottom-0 h-11 bg-stone-700" />
        <div className="absolute bottom-2 left-[36%] h-9 w-20 rounded bg-stone-500 shadow-lg" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            LIVE
          </span>
          <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">{cam.id}</span>
        </div>
        <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
          {formatTimeFull(now)}
        </div>
        {cam.type === "PTZ" && (
          <div className="absolute left-3 bottom-3 rounded-md bg-[#0038A8]/80 px-2 py-1 text-[9px] font-semibold text-white">
            PTZ
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CAMERA</p>
          <p className="mt-0.5 font-mono text-[10px] font-bold text-stone-900">{cam.id}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[8px] font-semibold tracking-wider text-stone-400">LOCATION</p>
          <p className="mt-0.5 text-[10px] font-medium text-stone-800">{cam.name}</p>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function CameraMap() {
  const { flash, ToastPortal } = useToast();

  const [now, setNow] = useState(new Date());
  const [selectedCam, setSelectedCam] = useState<CameraMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<MapFilter>("all");
  const [activeAlert] = useState<IncidentAlert | null>(INCIDENT_ALERTS[0]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [liveFeedOpen, setLiveFeedOpen] = useState(false);
  const [ptzNotice, setPtzNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredCameras = useMemo(() => {
    let list = CAMERAS;

    if (activeFilter === "near_incident" && activeAlert) {
      list = nearbyCameras(list, activeAlert);
    } else if (activeFilter !== "all") {
      list = list.filter((c) => c.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.street.toLowerCase().includes(q) ||
          c.purok.toLowerCase().includes(q) ||
          c.landmark.toLowerCase().includes(q)
      );
    }

    return list;
  }, [searchQuery, activeFilter, activeAlert]);

  function handleSelectCamera(cam: CameraMarker) {
    setSelectedCam(cam);
    flash(`Camera selected — ${cam.id} (${cam.name})`);
  }

  function handleSelectNearest(cam: CameraMarker) {
    setSelectedCam(cam);
    setActiveFilter("all");
    flash(`Nearest camera selected — ${cam.id} for incident response`);
  }

  function handleViewFeed() {
    if (!selectedCam) return;
    if (selectedCam.status === "offline") {
      flash(`${selectedCam.id} is offline — cannot open live feed`);
      return;
    }
    setLiveFeedOpen(true);
  }

  function handlePtzControl() {
    if (!selectedCam) return;
    if (selectedCam.type !== "PTZ") {
      flash(`${selectedCam.id} is a Fixed camera — PTZ control not available`);
      return;
    }
    setPtzNotice(selectedCam.id);
    setTimeout(() => setPtzNotice(null), 3000);
    flash(`PTZ control activated for ${selectedCam.id}`);
  }

  const onlineCount = CAMERAS.filter((c) => c.status === "online").length;
  const offlineCount = CAMERAS.filter((c) => c.status === "offline").length;
  const maintenanceCount = CAMERAS.filter((c) => c.status === "maintenance").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Camera Map</h1>
              <p className="mt-1 text-sm text-stone-500">
                GIS map view — locate cameras for incident response
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">
                <Wifi size={12} />
                {onlineCount} online
              </span>
              {offlineCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-medium text-stone-500">
                  <WifiOff size={12} />
                  {offlineCount} offline
                </span>
              )}
              {maintenanceCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
                  <Wrench size={12} />
                  {maintenanceCount} maintenance
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4 xl:flex-row">
          {/* LEFT: Map + Filters + Camera List */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Camera ID, Street, Purok/Zone, Landmark, or Location..."
                className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                    activeFilter === f.key
                      ? "bg-[#0038A8] text-white shadow-sm"
                      : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {f.key === "near_incident" && <AlertTriangle size={10} className="mr-1 inline" />}
                  {f.label}
                  {f.key === "all" && <span className="ml-1 text-[9px] opacity-70">({CAMERAS.length})</span>}
                  {f.key === "online" && <span className="ml-1 text-[9px] opacity-70">({onlineCount})</span>}
                  {f.key === "offline" && <span className="ml-1 text-[9px] opacity-70">({offlineCount})</span>}
                  {f.key === "maintenance" && <span className="ml-1 text-[9px] opacity-70">({maintenanceCount})</span>}
                </button>
              ))}
            </div>

            {/* GIS Map */}
            <div className="h-[380px] w-full sm:h-[440px] lg:h-[500px]">
              <GisMap
                cameras={filteredCameras}
                selectedCam={selectedCam}
                alerts={INCIDENT_ALERTS}
                activeAlert={activeAlert}
                onSelectCamera={handleSelectCamera}
                onSelectAlert={() => {}}
                now={now}
              />
            </div>

            {/* Camera List (below map) */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Camera size={14} className="text-[#0038A8]" />
                <h2 className="text-[12px] font-semibold text-stone-700">CAMERAS</h2>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold text-stone-500">
                  {filteredCameras.length} shown
                </span>
              </div>
              <div className="grid max-h-[260px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredCameras.map((cam) => (
                  <CameraListRow
                    key={cam.id}
                    cam={cam}
                    isSelected={selectedCam?.id === cam.id}
                    onClick={() => handleSelectCamera(cam)}
                  />
                ))}
                {filteredCameras.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-5 py-10 text-center">
                    <Search size={20} className="mb-2 text-stone-300" />
                    <p className="text-[12px] font-medium text-stone-500">No cameras found</p>
                    <p className="mt-0.5 text-[10px] text-stone-400">Try adjusting your search or filter</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Selected Camera Panel + Incident Alert */}
          <div className="w-full shrink-0 space-y-4 xl:w-[340px]">
            {/* Incident Alert (if active) */}
            {activeAlert && (
              <IncidentAlertPanel
                alert={activeAlert}
                cameras={CAMERAS}
                onSelectNearest={handleSelectNearest}
              />
            )}

            {/* Selected Camera Panel */}
            {selectedCam ? (
              <SelectedCameraPanel
                cam={selectedCam}
                now={now}
                onViewFeed={handleViewFeed}
                onPtzControl={handlePtzControl}
                onOpenDetails={() => setDetailsOpen(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-5 py-16 text-center">
                <MapPin size={24} className="mb-3 text-stone-300" />
                <p className="text-[12px] font-medium text-stone-500">No camera selected</p>
                <p className="mt-1 text-[10px] text-stone-400">Click a camera marker on the map or select from the list below</p>
              </div>
            )}

            {/* Workflow hint */}
            <div className="flex items-start gap-2 rounded-xl border border-[#0038A8]/20 bg-[#0038A8]/5 px-3.5 py-3">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#0038A8]">Workflow</p>
                <p className="mt-0.5 text-[9px] leading-relaxed text-stone-600">
                  Incident / SOS location → Find nearest functional CCTV → Select Camera → View Live Feed
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* PTZ notice toast */}
      {ptzNotice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[11px] font-semibold text-white shadow-xl">
          <div className="flex items-center gap-2">
            <Crosshair size={14} />
            PTZ Control active for {ptzNotice}
          </div>
        </div>
      )}

      {/* Modals */}
      {detailsOpen && selectedCam && (
        <CameraDetailsModal
          cam={selectedCam}
          now={now}
          onClose={() => setDetailsOpen(false)}
          onViewFeed={() => { setDetailsOpen(false); handleViewFeed(); }}
        />
      )}

      {liveFeedOpen && selectedCam && (
        <ViewLiveFeedModal
          cam={selectedCam}
          now={now}
          onClose={() => setLiveFeedOpen(false)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
