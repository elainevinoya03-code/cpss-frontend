import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Calendar,
  Clock,
  Camera,
  Play,
  Pause,
  Scissors,
  Link2,
  Shield,
  Eye,
  EyeOff,
  Box,
  HardDrive,
  Database,
  FileText,
  RotateCcw,
  Eraser,
  Info,
  CalendarClock,
  Archive,
  Lock,
  ChevronRight,
  Square,
  Video,
  AlertTriangle,
  Filter,
  MonitorPlay,
  CloudUpload,
  User,
  ShieldCheck,
  Download,
  History,
  Siren,
  Inbox,
  Paperclip,
  Activity,
  Flag,
  MapPin,
  Volume2,
  VolumeX,
  BookmarkPlus,
  BookmarkMinus,
  X,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";
import { addEvidenceActivity, useEvidenceActivities, type EvidenceAction } from "./evidence_activity";
import { ExportEvidenceModal } from "./export_evidence_modal";
import { RedactionModal } from "./video_archives_playback";

interface Camera {
  id: string;
  name: string;
  location: string;
  purok: string;
  status: "online" | "degraded" | "offline";
  hasArchive: boolean;
}

interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  location: string;
  purok: string;
  startISO: string;
  duration: number;
  sizeMB: number;
  events: string[];
  eventTag?: string;
  incidentId?: string;
}

interface Mask {
  x: number;
  y: number;
  w: number;
  h: number;
  label: "Face" | "License Plate";
}

interface CctvEvidenceClip {
  id: string;
  cameraId: string;
  cameraName: string;
  incidentId?: string;
  startTime: string;
  endTime: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  storageReference?: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
  contentHash?: string;
  retentionStatus: "active" | "scheduled_deletion" | "legal_hold";
  privacyStatus: "original" | "privacy_processed";
  masks?: Mask[];
  attachedAt?: string;
  retainedUntil?: string;
}

interface PrivacyProcessedClip {
  id: string;
  sourceClipId: string;
  processedBy: string;
  processedAt: string;
  privacyStatus: "privacy_processed";
  maskCount: number;
  masks: Mask[];
  storageReference?: string;
}

interface OpenIncident {
  id: string;
  category: string;
  purok: string;
  title: string;
  severity: string;
}

interface EscalatedClip {
  id: string;
  cameraId: string;
  cameraName: string;
  location: string;
  purok: string;
  tagType: string;
  notes?: string;
  escalatedAt: string;
  clipStart: string;
  clipEnd: string;
  durationSec: number;
  storageUrl: string;
  operator: string;
  incident: { id: string; status: string; priority: string; category: string };
}

const CAMERAS: Camera[] = [
  { id: "CAM-GATE-01", name: "Main Gate", location: "Entrance Gate", purok: "Purok 1", status: "online", hasArchive: true },
  { id: "CAM-PLAZA-02", name: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2", status: "online", hasArchive: true },
  { id: "CAM-MARKET-03", name: "Public Market", location: "Market Strip", purok: "Purok 6", status: "online", hasArchive: true },
  { id: "CAM-CHAPEL-04", name: "Chapel Area", location: "Chapel Approach", purok: "Purok 5", status: "online", hasArchive: true },
  { id: "CAM-ROAD-05", name: "Crossing Road", location: "Purok Crossing", purok: "Purok 3", status: "online", hasArchive: true },
  { id: "CAM-TERMNL-06", name: "Terminal Stop", location: "Jeepney Terminal", purok: "Purok 1", status: "degraded", hasArchive: false },
  { id: "CAM-SWERS-07", name: "Sewers Access", location: "Utility Trench", purok: "Purok 4", status: "offline", hasArchive: false },
  { id: "CAM-PARK-08", name: "Park View", location: "Greenbelt Park", purok: "Purok 2", status: "online", hasArchive: false },
  { id: "CAM-TERMNL-09", name: "Secondary Gate", location: "Back Entrance", purok: "Purok 3", status: "degraded", hasArchive: false },
];

const RECORDINGS: Recording[] = [
  { id: "R-2600", cameraId: "CAM-GATE-01", cameraName: "Main Gate", location: "Entrance Gate", purok: "Purok 1", startISO: "2026-07-20T09:00:00", duration: 900, sizeMB: 118, events: ["Vehicle entry — plate captured"], eventTag: "Suspicious Activity", incidentId: "INC-2068" },
  { id: "R-2599", cameraId: "CAM-GATE-01", cameraName: "Main Gate", location: "Entrance Gate", purok: "Purok 1", startISO: "2026-07-20T08:00:00", duration: 900, sizeMB: 121, events: ["Morning shift crowd at gate"], eventTag: "Unusual Gathering" },
  { id: "R-2598", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2", startISO: "2026-07-20T10:00:00", duration: 720, sizeMB: 94, events: ["Group loitering near court"], eventTag: "Suspicious Activity", incidentId: "INC-2070" },
  { id: "R-2597", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6", startISO: "2026-07-19T21:30:00", duration: 840, sizeMB: 112, events: ["Noise escalation — DB-MARKET-01"], eventTag: "Public Disturbance", incidentId: "INC-2069" },
  { id: "R-2596", cameraId: "CAM-CHAPEL-04", cameraName: "Chapel Area", location: "Chapel Approach", purok: "Purok 5", startISO: "2026-07-19T18:45:00", duration: 780, sizeMB: 101, events: ["Suspicious loitering report"], eventTag: "Suspicious Activity", incidentId: "INC-2069" },
  { id: "R-2595", cameraId: "CAM-ROAD-05", cameraName: "Crossing Road", location: "Purok Crossing", purok: "Purok 3", startISO: "2026-07-19T17:00:00", duration: 900, sizeMB: 130, events: ["Traffic build-up after rain"], eventTag: "Road Obstruction", incidentId: "INC-2071" },
  { id: "R-2594", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2", startISO: "2026-07-19T16:00:00", duration: 720, sizeMB: 96, events: ["Street altercation — clip generated"], eventTag: "Public Disturbance", incidentId: "INC-2067" },
  { id: "R-2593", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6", startISO: "2026-07-19T12:40:00", duration: 840, sizeMB: 108, events: ["Sensor false trigger — gate area"], eventTag: "Hazard" },
  { id: "R-2592", cameraId: "CAM-GATE-01", cameraName: "Main Gate", location: "Entrance Gate", purok: "Purok 1", startISO: "2026-07-19T11:30:00", duration: 900, sizeMB: 119, events: ["Delivery vehicle inspected"] },
  { id: "R-2591", cameraId: "CAM-CHAPEL-04", cameraName: "Chapel Area", location: "Chapel Approach", purok: "Purok 5", startISO: "2026-07-18T19:00:00", duration: 780, sizeMB: 99, events: ["Night service crowd"], eventTag: "Other" },
];

const INITIAL_CLIPS: CctvEvidenceClip[] = [
  {
    id: "CLIP-2026-0002", cameraId: "CAM-MARKET-03", cameraName: "Public Market",
    startTime: "2026-07-19T21:30:12", endTime: "2026-07-19T21:31:05",
    startSec: 12, endSec: 65, durationSec: 53,
    storageReference: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0002.mp4",
    fileType: "video/mp4", fileSize: 8_480_000,
    uploadedBy: "CO-01", createdAt: "2026-07-19T21:32:00",
    contentHash: "sha256:a3f2c8…d71e", retentionStatus: "active", privacyStatus: "privacy_processed",
    masks: [
      { x: 40, y: 30, w: 60, h: 60, label: "Face" },
      { x: 55, y: 70, w: 90, h: 30, label: "License Plate" },
    ],
    incidentId: "INC-2069", attachedAt: "2026-07-19T22:00:00",
    retainedUntil: "2027-07-19T22:00:00",
  },
  {
    id: "CLIP-2026-0001", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court",
    startTime: "2026-07-19T16:00:03", endTime: "2026-07-19T16:00:45",
    startSec: 3, endSec: 45, durationSec: 42,
    storageReference: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0001.mp4",
    fileType: "video/mp4", fileSize: 6_720_000,
    uploadedBy: "CO-01", createdAt: "2026-07-19T16:01:00",
    retentionStatus: "active", privacyStatus: "original",
  },
];

const OPEN_INCIDENTS: OpenIncident[] = [
  { id: "INC-2071", category: "Fire/Smoke", purok: "Purok 3", title: "Heavy smoke column near market residential row", severity: "critical" },
  { id: "INC-2070", category: "Public Disturbance", purok: "Purok 6", title: "SOS signal at commercial strip", severity: "critical" },
  { id: "INC-2069", category: "Noise Disturbance", purok: "Purok 4", title: "Sustained loud disturbance at hall", severity: "warning" },
  { id: "INC-2068", category: "Fire/Smoke", purok: "Purok 1", title: "Smoke density breach at gate sensor", severity: "warning" },
  { id: "INC-2067", category: "Noise Disturbance", purok: "Purok 2", title: "Late-night noise complaint", severity: "low" },
];

const INITIAL_ESCALATED: EscalatedClip[] = [
  {
    id: "CLIP-EVT-0004", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6",
    tagType: "Unusual Crowd", notes: "Rapid gathering outside the wet market stalls. Individuals appear agitated.",
    escalatedAt: "2026-07-20T10:05:00", clipStart: "2026-07-20T10:04:35", clipEnd: "2026-07-20T10:05:10",
    durationSec: 35, storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-EVT-0004.mp4",
    operator: "CO-01", incident: { id: "INC-2072", status: "in_triage", priority: "Medium", category: "Unusual Crowd" },
  },
  {
    id: "CLIP-EVT-0003", cameraId: "CAM-ROAD-05", cameraName: "Crossing Road", location: "Purok Crossing", purok: "Purok 3",
    tagType: "Road Blockage", notes: "Vehicle stalled across the crossing, blocking the main lane.",
    escalatedAt: "2026-07-20T09:40:00", clipStart: "2026-07-20T09:39:20", clipEnd: "2026-07-20T09:40:10",
    durationSec: 50, storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-EVT-0003.mp4",
    operator: "CO-01", incident: { id: "INC-2071", status: "dispatched", priority: "Medium", category: "Road Blockage" },
  },
];

const EVENT_TAGS = [
  "Suspicious Activity",
  "Unusual Gathering",
  "Road Obstruction",
  "Public Disturbance",
  "Hazard",
  "Other",
];

const RETENTION_YEARS = 1;
const STORAGE_BUCKET = "cctv-clips";
const ARCHIVE_TOTAL_GB = 2000;
const ARCHIVE_START_GB = 1752;
const CLIP_GB = 0.03;

function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function retentionExpiry(attachedAt: string) {
  const d = new Date(attachedAt);
  d.setFullYear(d.getFullYear() + RETENTION_YEARS);
  return d.toISOString();
}

function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtRecordingDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtRecordingRange(startISO: string, durationSec: number) {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationSec * 1000);
  return { start: fmtTimestamp(startISO), end: fmtTimestamp(end.toISOString()) };
}

function fmtStamp(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  );
}

function FrameScene() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900">
      <div className="absolute right-6 top-4 h-8 w-8 rounded-full bg-stone-600/80" />
      <div className="absolute right-10 top-5 h-6 w-6 rounded-full bg-stone-600/50" />
      <div className="absolute left-[8%] bottom-0 h-24 w-16 rounded-t bg-stone-700/90" />
      <div className="absolute left-[16%] bottom-0 h-16 w-10 rounded-t bg-stone-700/70" />
      <div className="absolute right-[10%] bottom-0 h-20 w-24 rounded-t bg-stone-700/80" />
      <div className="absolute inset-x-0 bottom-0 h-11 bg-stone-700" />
      <div className="absolute bottom-2 left-[36%] h-9 w-20 rounded bg-stone-500 shadow-lg">
        <div className="absolute -bottom-0.5 left-1/2 flex h-2.5 w-10 -translate-x-1/2 items-center justify-center rounded-sm bg-stone-200">
          <span className="text-[6px] font-bold tracking-wider text-stone-700">ABC-123</span>
        </div>
      </div>
      <span className="absolute bottom-11 left-[38%] text-[7px] font-medium tracking-widest text-white/40">FACE</span>
      <span className="absolute bottom-[11px] left-[43%] text-[6px] font-medium tracking-widest text-white/40">PLATE</span>
      <div className="absolute bottom-1 left-[58%]">
        <div className="mx-auto h-3 w-3 rounded-full bg-stone-400" />
        <div className="mx-auto h-6 w-3.5 rounded-sm bg-stone-400" />
      </div>
      <span className="absolute bottom-7 left-[55%] text-[7px] font-medium tracking-widest text-white/40">FACE</span>
      <div className="absolute bottom-1 left-[66%]">
        <div className="mx-auto h-3 w-3 rounded-full bg-stone-400" />
        <div className="mx-auto h-6 w-3.5 rounded-sm bg-stone-400" />
      </div>
      <span className="absolute bottom-7 left-[63%] text-[7px] font-medium tracking-widest text-white/40">FACE</span>
      <div className="absolute bottom-1 left-[1%] h-9 w-px bg-stone-500" />
      <div className="absolute bottom-10 left-0 h-1.5 w-24 rounded-r bg-amber-300/70" />
    </div>
  );
}


function AttachModal({ clip, onClose, onAttach }: { clip: CctvEvidenceClip; onClose: () => void; onAttach: (incidentId: string) => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "confirm">("select");

  const pendingIncidents = OPEN_INCIDENTS.filter((i) => i.id !== clip.incidentId);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? pendingIncidents.filter((i) =>
        [i.id, i.title, i.category, i.purok, i.severity].some((v) => v.toLowerCase().includes(q))
      )
    : pendingIncidents;
  const selectedIncident = pendingIncidents.find((i) => i.id === selectedId) ?? null;

  function handleConfirm() {
    if (selectedId) onAttach(selectedId);
  }

  return (
    <Modal
      onClose={onClose}
      title={step === "select" ? "Attach Clip to Incident" : "Attach Evidence"}
      subtitle={step === "select" ? `${clip.id} · ${clip.cameraName}` : undefined}
      icon={<Link2 size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="md"
      footer={
        step === "select" ? (
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
            <button
              onClick={() => selectedId && setStep("confirm")}
              disabled={!selectedId}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
            >
              <Link2 size={13} />
              Continue
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setStep("select")} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
            >
              <Link2 size={13} />
              Attach Evidence
            </button>
          </div>
        )
      }
    >
      {step === "select" ? (
        <>
          {/* Search input */}
          <div className="mb-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by incident ID, title, category, or purok…"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-[11px] text-stone-700 placeholder:text-stone-400 focus:border-[#0038A8] focus:bg-white focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <p className="mt-1 text-[9px] text-stone-400">
              {filtered.length} incident{filtered.length !== 1 ? "s" : ""} available · Search by ID, title, category or purok
            </p>
          </div>

          {/* Incident list */}
          <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 py-6 text-[11px] text-stone-400">
                <Search size={12} /> No incidents match "{query}"
              </div>
            )}
            {filtered.map((inc) => (
              <button
                key={inc.id}
                onClick={() => setSelectedId(inc.id)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                  selectedId === inc.id ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className={`mt-0.5 flex h-2 w-2 shrink-0 rounded-full ${inc.severity === "critical" ? "bg-rose-500" : inc.severity === "warning" ? "bg-amber-400" : "bg-sky-400"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-stone-900">{inc.id}</span>
                    <span className="text-[10px] text-stone-400">{inc.purok}</span>
                  </span>
                  <span className="block text-[11px] text-stone-600">{inc.title}</span>
                </span>
                <span className="shrink-0 text-[10px] font-medium capitalize text-stone-400">{inc.category}</span>
              </button>
            ))}
          </div>

          {/* Duplicate warning */}
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[10px] leading-relaxed text-amber-700">
              <span className="font-semibold">Do not create a duplicate incident.</span> Attach this clip only if the selected incident already represents the event being investigated. If no matching incident exists, create one first through the proper reporting channel.
            </p>
          </div>
        </>
      ) : (
        /* ── Confirmation step ──────────────────────── */
        <div className="space-y-3">
          {/* Camera */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">CAMERA</p>
            <p className="mt-1 text-[12px] font-bold text-stone-900">{clip.cameraId} — {clip.cameraName}</p>
          </div>

          {/* Clip time range */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">CLIP</p>
            <p className="mt-1 font-mono text-[12px] font-bold text-stone-900">
              {fmtTimestamp(clip.startTime)} – {fmtTimestamp(clip.endTime)}
            </p>
            <p className="mt-0.5 text-[10px] text-stone-500">{clip.id} · {fmtClock(clip.durationSec)} · {clip.fileType}</p>
          </div>

          {/* Incident */}
          {selectedIncident && (
            <div className="rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-4 py-3">
              <p className="text-[9px] font-semibold tracking-wider text-[#0038A8]">ATTACH TO</p>
              <p className="mt-1 text-[12px] font-bold text-stone-900">{selectedIncident.id} — {selectedIncident.title}</p>
              <p className="mt-0.5 text-[10px] text-stone-500">{selectedIncident.category} · {selectedIncident.purok} · {selectedIncident.severity}</p>
            </div>
          )}

          {/* Notice */}
          <div className="flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3 py-2.5">
            <Link2 size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[10px] font-semibold leading-relaxed text-stone-700">
              This clip will be added as supplementary CCTV evidence.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <CalendarClock size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[10px] leading-relaxed text-stone-500">
              Linking starts the official <span className="font-semibold">{RETENTION_YEARS}-year retention</span> clock.
              The clip becomes reviewable by the Barangay Desk Officer and Barangay Captain.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CreateIncidentModal({
  clip,
  operatorName,
  onClose,
  onCreate,
}: {
  clip: CctvEvidenceClip;
  operatorName: string;
  onClose: () => void;
  onCreate: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const camera = CAMERAS.find((c) => c.id === clip.cameraId);
  const recording = RECORDINGS.find(
    (r) => r.cameraId === clip.cameraId && clip.startTime >= r.startISO && clip.startTime <= new Date(new Date(r.startISO).getTime() + r.duration * 1000).toISOString()
  );
  const category = recording?.eventTag ?? "Unclassified";

  return (
    <Modal
      onClose={onClose}
      title="Create CCTV Incident"
      subtitle={`${clip.id} · ${clip.cameraName}`}
      icon={<Siren size={18} />}
      iconClass="bg-amber-50 text-amber-600"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onCreate(notes)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700"
          >
            <Siren size={13} />
            Create CCTV Incident
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Pre-filled fields */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">SOURCE</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <Siren size={8} /> CCTV
            </span>
            <span className="text-[11px] text-stone-500">Operator-reported observation</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">CAMERA</p>
            <p className="mt-0.5 text-[11px] font-bold text-stone-900">{clip.cameraId}</p>
            <p className="text-[10px] text-stone-500">{clip.cameraName} · {camera?.location ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">LOCATION</p>
            <p className="mt-0.5 text-[11px] font-bold text-stone-900">{camera?.purok ?? "—"}</p>
            <p className="text-[10px] text-stone-500">{camera?.location ?? "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">EVENT CATEGORY</p>
            <p className="mt-0.5 text-[11px] font-bold text-stone-900">{category}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">OPERATOR</p>
            <p className="mt-0.5 text-[11px] font-bold text-stone-900">{operatorName}</p>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">EVENT / RECORDING TIMESTAMP</p>
          <p className="mt-0.5 font-mono text-[11px] font-bold text-stone-900">
            {fmtTimestamp(clip.startTime)} – {fmtTimestamp(clip.endTime)}
          </p>
          <p className="mt-0.5 text-[10px] text-stone-500">{fmtRecordingDate(clip.startTime)} · {fmtClock(clip.durationSec)} clip</p>
        </div>

        {/* Operator notes */}
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-wider text-stone-400">OPERATOR NOTES</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Describe what was observed on camera — be specific about behavior, individuals, and timeline…"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[11px] text-stone-700 placeholder:text-stone-400 focus:border-[#0038A8] focus:outline-none"
          />
        </div>

        {/* Attached evidence clip */}
        <div className="rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-4 py-3">
          <p className="text-[9px] font-semibold tracking-wider text-[#0038A8]">ATTACHED EVIDENCE CLIP</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-[#0038A8]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#0038A8]">
              <Video size={8} /> {clip.id}
            </span>
            <span className="font-mono text-[10px] text-stone-600">
              {fmtTimestamp(clip.startTime)} – {fmtTimestamp(clip.endTime)}
            </span>
            <span className="text-[10px] text-stone-400">· {fmtClock(clip.durationSec)} · {clip.fileType}</span>
          </div>
        </div>

        {/* Priority role-boundary */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[9px] font-semibold tracking-wider text-amber-600">PRIORITY</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Medium</span>
            <span className="text-[10px] text-amber-600">(initial — locked by CCTV role)</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700">
            CCTV Operator records the observation. The Desk Officer determines the final priority during triage.
          </p>
        </div>
      </div>
    </Modal>
  );
}

const ACTION_STYLE: Record<EvidenceAction, { badge: string }> = {
  Viewed: { badge: "bg-sky-100 text-sky-700" },
  Generated: { badge: "bg-violet-100 text-violet-700" },
  Redacted: { badge: "bg-amber-100 text-amber-700" },
  Attached: { badge: "bg-[#0038A8]/10 text-[#0038A8]" },
  Exported: { badge: "bg-emerald-100 text-emerald-700" },
};

function EvidenceActivityPanel() {
  const activities = useEvidenceActivities();

  return (
    <div className="mb-6 rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[#0038A8]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#334155]">Evidence Activity Log</h3>
            <p className="text-[11px] text-[#94A3B8]">Audit trail — evidence actions are logged as they happen</p>
          </div>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{activities.length} records</span>
      </div>
      <div className="max-h-64 space-y-1.5 overflow-y-auto px-5 pb-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-8">
            <Inbox size={18} className="mb-1.5 text-stone-300" />
            <p className="text-[11px] font-medium text-stone-500">No evidence activity recorded yet</p>
          </div>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-stone-200 bg-white px-3.5 py-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${ACTION_STYLE[a.action].badge}`}>
                {a.action.toUpperCase()}
              </span>
              <span className="font-mono text-[11px] font-semibold text-stone-900">{a.clipId}</span>
              {a.incidentId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
                  <Link2 size={8} />
                  {a.incidentId}
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-stone-500">
                <User size={9} />
                {a.operator}
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-stone-400">
                <Clock size={9} />
                {fmtStamp(a.at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function RecordedFootageEvidence({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [recordings] = useState<Recording[]>(RECORDINGS);
  const [clips, setClips] = useState<CctvEvidenceClip[]>(INITIAL_CLIPS);
  const clipSeqRef = useRef(INITIAL_CLIPS.length + 1);
  const createdIncidentsRef = useRef(0);
  const processedSeqRef = useRef(0);
  const [archiveUsedGB, setArchiveUsedGB] = useState(ARCHIVE_START_GB);

  const [dateFilter, setDateFilter] = useState("");
  const [startTimeFilter, setStartTimeFilter] = useState("");
  const [endTimeFilter, setEndTimeFilter] = useState("");
  const [cameraFilter, setCameraFilter] = useState("all");
  const [incidentFilter, setIncidentFilter] = useState("all");
  const [eventTagFilter, setEventTagFilter] = useState("all");

  const [selected, setSelected] = useState<Recording | null>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [previewingSegment, setPreviewingSegment] = useState(false);
  const [volume, setVolume] = useState(80);

  const [redactTarget, setRedactTarget] = useState<CctvEvidenceClip | null>(null);
  const [attachTarget, setAttachTarget] = useState<CctvEvidenceClip | null>(null);
  const [exportTarget, setExportTarget] = useState<CctvEvidenceClip | null>(null);
  const [clipGenerated, setClipGenerated] = useState<CctvEvidenceClip | null>(null);
  const [attachedSuccess, setAttachedSuccess] = useState<CctvEvidenceClip | null>(null);
  const [redactedSuccess, setRedactedSuccess] = useState<{ clip: CctvEvidenceClip; processed: PrivacyProcessedClip } | null>(null);
  const [createIncidentTarget, setCreateIncidentTarget] = useState<CctvEvidenceClip | null>(null);
  const [createdIncidentSuccess, setCreatedIncidentSuccess] = useState<{ clip: CctvEvidenceClip; incidentId: string } | null>(null);
  const [processedClips, setProcessedClips] = useState<PrivacyProcessedClip[]>([]);

  const [eventQuery, setEventQuery] = useState("");
  const escalatedClips = INITIAL_ESCALATED;

  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => {
      if (cameraFilter !== "all" && r.cameraId !== cameraFilter) return false;
      if (incidentFilter !== "all" && r.incidentId !== incidentFilter) return false;
      if (eventTagFilter !== "all" && r.eventTag !== eventTagFilter) return false;
      if (dateFilter) {
        const d = new Date(r.startISO);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (localDate !== dateFilter) return false;
      }
      if (startTimeFilter || endTimeFilter) {
        const sd = new Date(r.startISO);
        const ed = new Date(sd.getTime() + r.duration * 1000);
        const sm = sd.getHours() * 60 + sd.getMinutes();
        const em = ed.getHours() * 60 + ed.getMinutes();
        if (startTimeFilter) {
          const st = timeToMinutes(startTimeFilter);
          if (sm > st) return false;
        }
        if (endTimeFilter) {
          const et = timeToMinutes(endTimeFilter);
          if (em < et) return false;
        }
      }
      return true;
    });
  }, [recordings, cameraFilter, dateFilter, startTimeFilter, endTimeFilter, incidentFilter, eventTagFilter]);

  useEffect(() => {
    if (!playing || !selected) return;
    const limit = previewingSegment && clipEnd != null ? Math.min(clipEnd, selected.duration) : selected.duration;
    const interval = setInterval(() => {
      setCurrentSec((s) => (s >= limit ? s : s + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [playing, selected, previewingSegment, clipEnd]);

  useEffect(() => {
    if (!selected || !playing) return;
    const limit = previewingSegment && clipEnd != null ? clipEnd : selected.duration;
    if (currentSec >= limit) {
      setPlaying(false);
      setPreviewingSegment(false);
    }
  }, [currentSec, playing, selected, previewingSegment, clipEnd]);

  function loadRecording(rec: Recording) {
    const cam = CAMERAS.find((c) => c.id === rec.cameraId);
    if (cam && !cam.hasArchive) {
      flash(`${cam.name} (${cam.id}) has no accessible archive — live stream only`);
      return;
    }
    setSelected(rec);
    setCurrentSec(0);
    setPlaying(false);
    setClipStart(null);
    setClipEnd(null);
    setPreviewingSegment(false);
    addEvidenceActivity({ action: "Viewed", clipId: rec.id, operator: operatorName });
  }

  function generateClip() {
    if (!selected || clipStart == null || clipEnd == null || clipEnd <= clipStart) return;
    const base = new Date(selected.startISO).getTime();
    const s = new Date(base + clipStart * 1000);
    const e = new Date(base + clipEnd * 1000);
    const id = `CLIP-2026-${String(clipSeqRef.current++).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const clip: CctvEvidenceClip = {
      id,
      cameraId: selected.cameraId,
      cameraName: selected.cameraName,
      startTime: s.toISOString(),
      endTime: e.toISOString(),
      startSec: clipStart,
      endSec: clipEnd,
      durationSec: clipEnd - clipStart,
      storageReference: `https://brgyculiat.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${id}.mp4`,
      fileType: "video/mp4",
      fileSize: Math.round((clipEnd - clipStart) * 16_000),
      uploadedBy: operatorName,
      createdAt: now,
      contentHash: `sha256:${id.replace("CLIP-2026-", "").padStart(4, "0")}`,
      retentionStatus: "active",
      privacyStatus: "original",
    };
    setClips((prev) => [clip, ...prev]);
    setArchiveUsedGB((g) => g + CLIP_GB);
    addEvidenceActivity({ action: "Generated", clipId: id, operator: operatorName });
    setClipStart(null);
    setClipEnd(null);
    setClipGenerated(clip);
    beep("info");
    flash(`${id} generated by ${operatorName} and saved to Supabase Storage`);
  }

  function applyRedaction(masks: Mask[]) {
    if (!redactTarget) return;
    const now = new Date().toISOString();
    const processedId = `PRIV-2026-${String(processedSeqRef.current++).padStart(4, "0")}`;
    const processed: PrivacyProcessedClip = {
      id: processedId,
      sourceClipId: redactTarget.id,
      processedBy: operatorName,
      processedAt: now,
      privacyStatus: "privacy_processed",
      maskCount: masks.length,
      masks,
      storageReference: `https://brgyculiat.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${processedId}.mp4`,
    };
    setProcessedClips((prev) => [processed, ...prev]);
    addEvidenceActivity({ action: "Redacted", clipId: redactTarget.id, incidentId: redactTarget.incidentId, operator: operatorName });
    setRedactedSuccess({ clip: redactTarget, processed });
    setRedactTarget(null);
    beep("info");
    flash(`${processedId} created from ${redactTarget.id} — ${masks.length} manual mask(s) applied. Original preserved.`);
  }

  function attachClip(incidentId: string) {
    if (!attachTarget) return;
    const attachedAt = new Date().toISOString();
    const updated: CctvEvidenceClip = { ...attachTarget, incidentId, attachedAt, retainedUntil: retentionExpiry(attachedAt) };
    setClips((prev) => prev.map((c) => (c.id === attachTarget.id ? updated : c)));
    addEvidenceActivity({ action: "Attached", clipId: attachTarget.id, incidentId, operator: operatorName });
    setAttachedSuccess(updated);
    setAttachTarget(null);
    beep("info");
    flash(`${attachTarget.id} linked by ${operatorName} to ${incidentId} — ${RETENTION_YEARS}-year retention started`);
  }

  function createIncident(notes: string) {
    if (!createIncidentTarget) return;
    const clip = createIncidentTarget;
    const camera = CAMERAS.find((c) => c.id === clip.cameraId);
    const recording = RECORDINGS.find(
      (r) => r.cameraId === clip.cameraId && clip.startTime >= r.startISO && clip.startTime <= new Date(new Date(r.startISO).getTime() + r.duration * 1000).toISOString()
    );
    const incidentId = `INC-${2085 + createdIncidentsRef.current++}`;
    const attachedAt = new Date().toISOString();
    const updatedClip: CctvEvidenceClip = {
      ...clip,
      incidentId,
      attachedAt,
      retainedUntil: retentionExpiry(attachedAt),
    };
    setClips((prev) => prev.map((c) => (c.id === clip.id ? updatedClip : c)));
    addEvidenceActivity({ action: "Attached", clipId: clip.id, incidentId, operator: operatorName });
    setCreatedIncidentSuccess({ clip: updatedClip, incidentId });
    setCreateIncidentTarget(null);
    beep("info");
    flash(`${incidentId} created by ${operatorName} from ${clip.id} — CCTV-reported, initial priority Medium`);
  }

  function clearFilters() {
    setDateFilter("");
    setStartTimeFilter("");
    setEndTimeFilter("");
    setCameraFilter("all");
    setIncidentFilter("all");
    setEventTagFilter("all");
  }

  const noArchiveCameras = CAMERAS.filter((c) => !c.hasArchive);
  const pendingRedaction = clips.filter((c) => !processedClips.some((p) => p.sourceClipId === c.id)).length;
  const linkedClips = clips.filter((c) => c.incidentId).length;
  const archivePct = Math.round((archiveUsedGB / ARCHIVE_TOTAL_GB) * 100);
  const archiveCritical = archivePct >= 90;

  const visibleEscalated = escalatedClips.filter((esc) => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return true;
    return [esc.id, esc.incident.id, esc.cameraName, esc.cameraId, esc.tagType, esc.purok, esc.location, esc.notes ?? ""]
      .some((v) => v.toLowerCase().includes(q));
  });

  const kpis = [
    { label: "ARCHIVED RECORDINGS", value: recordings.length, sub: "searchable by date, time & camera", icon: Archive },
    { label: "CCTV CLIP RECORDS", value: clips.length, sub: "stored in Supabase Storage", icon: Database },
    { label: "PENDING PRIVACY PROCESSING", value: pendingRedaction, sub: "manual PII masking required", icon: EyeOff },
    { label: "NO-ARCHIVE CAMERAS", value: noArchiveCameras.length, sub: "live stream only — no DVR", icon: AlertTriangle },
  ];

  const clipErrors: string[] = [];
  if (selected) {
    if (clipStart != null && clipStart < 0) clipErrors.push("Clip start is before the recording start.");
    if (clipStart != null && clipStart > selected.duration) clipErrors.push("Clip start is beyond the recording end.");
    if (clipEnd != null && clipEnd < 0) clipErrors.push("Clip end is before the recording start.");
    if (clipEnd != null && clipEnd > selected.duration) clipErrors.push("Clip end exceeds available footage duration.");
    if (clipStart != null && clipEnd != null && clipEnd <= clipStart) clipErrors.push("Clip end must be after clip start.");
    if (clipStart != null && clipEnd != null && clipEnd > clipStart && (clipEnd - clipStart) > selected.duration) clipErrors.push("Clip range exceeds total recording duration.");
    if (clipStart == null || clipEnd == null) clipErrors.push("Set both clip start and clip end to create a clip.");
  }
  const canCreateClip = selected && clipStart != null && clipEnd != null && clipErrors.length === 0;
  const clipDuration = clipStart != null && clipEnd != null ? clipEnd - clipStart : 0;

  const selectedCamera = selected ? CAMERAS.find((c) => c.id === selected.cameraId) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Recorded Footage &amp; Evidence</h1>
              <p className="mt-1 text-sm text-stone-500">
                Search, replay, clip, sanitize and export recorded surveillance footage as incident evidence
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0038A8]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0038A8]">
                <User size={12} />
                Operator: {operatorName}
              </span>
              <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0038A8]/5 px-3 py-1.5 text-[11px] font-medium text-[#0038A8]">
                <Lock size={12} />
                Evidence-grade retention: {RETENTION_YEARS} year
              </span>
            </div>
          </div>
        </header>

        {/* Archive storage banner */}
        <div className={`mb-6 rounded-xl border px-5 py-4 shadow-sm ${archiveCritical ? "border-rose-200 bg-rose-50/50" : "border-black/5 bg-white"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className={archiveCritical ? "text-rose-600" : "text-[#0038A8]"} />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Archive Storage Capacity</h3>
                <p className="text-[11px] text-[#94A3B8]">
                  {archiveUsedGB.toFixed(1)} GB of {ARCHIVE_TOTAL_GB} GB used · {clips.length} clip records · 1-year retention
                </p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${archiveCritical ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              {archiveCritical ? "NEAR CAPACITY" : "HEALTHY"}
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full transition-all ${archiveCritical ? "bg-rose-500" : "bg-[#0038A8]"}`} style={{ width: `${archivePct}%` }} />
          </div>
          <p className="mt-2 text-[9px] text-stone-400">
            {archiveCritical
              ? "Storage above 90% — oldest footage beyond the 1-year retention window is at risk."
              : "Footage older than the 1-year retention window is automatically marked for purge. Capacity headroom available."}
          </p>
        </div>

        {/* KPI row */}
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


        {/* Search bar */}
        <div className="mb-6 rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-[#0038A8]" />
              <h3 className="text-[14px] font-semibold text-[#334155]">Search the Video Archive</h3>
            </div>
            <span className="text-[10px] font-medium text-[#94A3B8]">
              {filteredRecordings.length} of {recordings.length} recordings match
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Camera filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Camera size={10} /> CAMERA
              </label>
              <select
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              >
                <option value="all">All cameras</option>
                {CAMERAS.filter((c) => c.hasArchive).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name} · {c.location} · {c.purok} · Archive: Available
                  </option>
                ))}
                {CAMERAS.filter((c) => !c.hasArchive).length > 0 && (
                  <optgroup label="Live Stream Only — No Archive">
                    {CAMERAS.filter((c) => !c.hasArchive).map((c) => (
                      <option key={c.id} value={c.id} disabled>
                        {c.id} — {c.name} · {c.location} · {c.purok} · LIVE ONLY
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Date filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Calendar size={10} /> DATE
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              />
            </div>

            {/* Start Time filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Clock size={10} /> START TIME
              </label>
              <input
                type="time"
                value={startTimeFilter}
                onChange={(e) => setStartTimeFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              />
            </div>

            {/* End Time filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Clock size={10} /> END TIME
              </label>
              <input
                type="time"
                value={endTimeFilter}
                onChange={(e) => setEndTimeFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              />
            </div>

            {/* Related Incident filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Link2 size={10} /> RELATED INCIDENT
              </label>
              <select
                value={incidentFilter}
                onChange={(e) => setIncidentFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              >
                <option value="all">All incidents</option>
                {[...new Set(RECORDINGS.filter((r) => r.incidentId).map((r) => r.incidentId))].map((incId) => {
                  const inc = OPEN_INCIDENTS.find((i) => i.id === incId);
                  return (
                    <option key={incId} value={incId}>
                      {incId}{inc ? ` — ${inc.title}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Event Tag filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Flag size={10} /> EVENT TAG
              </label>
              <select
                value={eventTagFilter}
                onChange={(e) => setEventTagFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              >
                <option value="all">All tags</option>
                {EVENT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter actions row */}
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {cameraFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                  Camera: {CAMERAS.find((c) => c.id === cameraFilter)?.name ?? cameraFilter}
                  <button onClick={() => setCameraFilter("all")} className="ml-0.5 rounded-full hover:bg-[#0038A8]/10">&times;</button>
                </span>
              )}
              {dateFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                  Date: {dateFilter}
                  <button onClick={() => setDateFilter("")} className="ml-0.5 rounded-full hover:bg-[#0038A8]/10">&times;</button>
                </span>
              )}
              {startTimeFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                  From: {startTimeFilter}
                  <button onClick={() => setStartTimeFilter("")} className="ml-0.5 rounded-full hover:bg-[#0038A8]/10">&times;</button>
                </span>
              )}
              {endTimeFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                  To: {endTimeFilter}
                  <button onClick={() => setEndTimeFilter("")} className="ml-0.5 rounded-full hover:bg-[#0038A8]/10">&times;</button>
                </span>
              )}
              {incidentFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                  Incident: {incidentFilter}
                  <button onClick={() => setIncidentFilter("all")} className="ml-0.5 rounded-full hover:bg-[#0038A8]/10">&times;</button>
                </span>
              )}
              {eventTagFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                  Tag: {eventTagFilter}
                  <button onClick={() => setEventTagFilter("all")} className="ml-0.5 rounded-full hover:bg-[#0038A8]/10">&times;</button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearFilters} className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50">
                <RotateCcw size={11} /> Clear All
              </button>
              <button
                onClick={() => flash(`Archive filtered — ${filteredRecordings.length} recordings found`)}
                className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0038A8] px-4 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Search size={12} /> Search Archive
              </button>
            </div>
          </div>

          {/* Camera reference card */}
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="mb-2 text-[9px] font-semibold tracking-wider text-stone-400">REGISTERED CAMERAS</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CAMERAS.map((cam) => (
                <div
                  key={cam.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
                    cameraFilter === cam.id
                      ? "border-[#0038A8] bg-[#0038A8]/5"
                      : cam.hasArchive
                        ? "border-stone-200 bg-white"
                        : "border-amber-200 bg-amber-50/50"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    cam.hasArchive ? "bg-[#E9EDFB] text-[#0038A8]" : "bg-amber-100 text-amber-600"
                  }`}>
                    <Camera size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold text-stone-900">
                      {cam.id} — {cam.name}
                    </p>
                    <p className="truncate text-[9px] text-stone-400">
                      {cam.location} · {cam.purok}
                    </p>
                  </div>
                  {cam.hasArchive ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">
                      Archive Available
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">
                      LIVE ONLY
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main workspace: Search Results + Playback + Clip Workflow */}
        <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 640 }}>
          {/* Search Results */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Search Results</h3>
                  <p className="text-[11px] text-[#94A3B8]">Recorded footage matching your filters</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{filteredRecordings.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {filteredRecordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <Search size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No recordings found</p>
                  <p className="text-[10px] text-stone-400">Adjust the date, time or camera filters</p>
                </div>
              ) : (
                filteredRecordings.map((rec) => {
                  const cam = CAMERAS.find((c) => c.id === rec.cameraId);
                  const isDisabled = cam && !cam.hasArchive;
                  const { start: startTime, end: endTime } = fmtRecordingRange(rec.startISO, rec.duration);
                  const isLinked = !!rec.incidentId;
                  const hasTag = !!rec.eventTag;
                  return (
                    <div
                      key={rec.id}
                      className={`rounded-xl border p-4 transition ${
                        selected?.id === rec.id
                          ? "border-[#0038A8] bg-[#0038A8]/5 shadow-sm"
                          : isDisabled
                            ? "border-stone-200 bg-stone-50 opacity-60"
                            : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                      }`}
                    >
                      {/* Result header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0038A8]/10 text-[#0038A8]">
                            <Video size={14} />
                          </span>
                          <div>
                            <p className="text-[13px] font-bold text-stone-900">{rec.id}</p>
                            <p className="text-[10px] text-stone-400">{rec.sizeMB} MB</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          cam?.hasArchive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {cam?.hasArchive ? "ARCHIVE AVAILABLE" : "LIVE ONLY"}
                        </span>
                      </div>

                      {/* Camera identification */}
                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                        <p className="text-[9px] font-semibold tracking-wider text-stone-400">CAMERA</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] font-bold text-stone-900">{rec.cameraId}</span>
                          <span className="text-[10px] text-stone-500">{rec.cameraName}</span>
                        </div>
                        <p className="flex items-center gap-1 text-[10px] text-stone-400">
                          <MapPin size={9} /> {rec.location} · {rec.purok}
                        </p>
                      </div>

                      {/* Timestamps and duration */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                          <p className="text-[9px] font-semibold tracking-wider text-stone-400">RECORDING DATE</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-stone-900">{fmtRecordingDate(rec.startISO)}</p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                          <p className="text-[9px] font-semibold tracking-wider text-stone-400">DURATION</p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#0038A8]">{fmtClock(rec.duration)}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2">
                        <p className="text-[9px] font-semibold tracking-wider text-stone-400">TIMESTAMP RANGE</p>
                        <p className="mt-0.5 font-mono text-[11px] font-semibold text-stone-700">{startTime} – {endTime}</p>
                      </div>

                      {/* Incident + Event Tag */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {isLinked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-bold text-[#0038A8]">
                            <Link2 size={8} /> {rec.incidentId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-medium text-stone-400">
                            No incident
                          </span>
                        )}
                        {hasTag ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                            <Flag size={8} /> {rec.eventTag}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-medium text-stone-400">
                            No tag
                          </span>
                        )}
                      </div>

                      {/* Evidence status */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold tracking-wider text-stone-400">EVIDENCE:</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          isLinked ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
                        }`}>
                          {isLinked ? "Linked to Incident" : "Unlinked"}
                        </span>
                        {rec.events[0] && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
                            <AlertTriangle size={8} /> {rec.events[0]}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 flex items-center gap-2">
                        {isDisabled ? (
                          <div className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-600">
                            <AlertTriangle size={10} /> No archive — live stream only
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => loadRecording(rec)}
                              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0038A8] text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                            >
                              <Play size={12} />
                              {selected?.id === rec.id ? "Playing" : "Play"}
                            </button>
                            <button
                              onClick={() => loadRecording(rec)}
                              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                            >
                              <Scissors size={12} /> Select Clip
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Playback + Clip Workflow */}
          <div className="xl:col-span-2 flex flex-col gap-5 overflow-hidden">
            {/* Playback Station */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <MonitorPlay size={16} className="text-[#0038A8]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Playback Station</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      {selected ? `${selected.cameraId} · ${selected.cameraName} · ${selected.location}` : "Select a recording from the search results"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selected && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      selectedCamera?.hasArchive ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {selectedCamera?.hasArchive ? "ARCHIVE" : "LIVE ONLY"}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${playing ? "bg-rose-50 text-rose-600" : "bg-stone-100 text-stone-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${playing ? "animate-pulse bg-rose-500" : "bg-stone-300"}`} />
                    {playing ? "Playing" : "Paused"}
                  </span>
                </div>
              </div>

              {/* Video viewport */}
              <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-black/20 bg-black">
                <div className="relative h-56 w-full sm:h-64">
                  {selected ? (
                    <>
                      {selectedCamera && !selectedCamera.hasArchive ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/95 text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                            <AlertTriangle size={24} className="text-amber-400" />
                          </div>
                          <p className="text-[14px] font-bold text-white">Recorded Footage Unavailable</p>
                          <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-stone-400">
                            This camera currently provides a live stream but no accessible archive recording source.
                          </p>
                          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                            <p className="text-[10px] font-semibold text-amber-300">
                              {selectedCamera.name} ({selectedCamera.id}) — {selectedCamera.status}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <FrameScene />
                          <div className="absolute left-3 top-3 flex items-center gap-2">
                            <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                              REC
                            </span>
                            <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">{selected.id}</span>
                          </div>
                          <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-white">
                            {new Date(new Date(selected.startISO).getTime() + currentSec * 1000).toLocaleTimeString("en-US", { hour12: false })}
                          </div>
                          {!playing && currentSec === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <button
                                onClick={() => setPlaying(true)}
                                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#0038A8] shadow-xl transition hover:scale-105"
                              >
                                <Play size={26} className="ml-1" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center bg-stone-900 text-center">
                      <Video size={28} className="mb-2 text-stone-700" />
                      <p className="text-[12px] font-medium text-stone-500">No recording loaded</p>
                      <p className="text-[10px] text-stone-600">Choose a recording from the search results to begin playback</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                {selected ? (
                  <>
                    {/* Source limitation note */}
                    {selectedCamera?.hasArchive && (
                      <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3 py-2">
                        <Info size={12} className="mt-0.5 shrink-0 text-[#0038A8]" />
                        <p className="text-[10px] leading-relaxed text-stone-600">
                          Archive playback provided by external recorder. Footage is read from the DVR archive and is not a live feed.
                        </p>
                      </div>
                    )}

                    {/* Timestamps row */}
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-center">
                        <p className="text-[9px] font-semibold tracking-wider text-stone-400">START</p>
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-stone-700">{fmtTimestamp(selected.startISO)}</p>
                      </div>
                      <div className="rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-3 py-2 text-center">
                        <p className="text-[9px] font-semibold tracking-wider text-[#0038A8]">CURRENT</p>
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-[#0038A8]">
                          {new Date(new Date(selected.startISO).getTime() + currentSec * 1000).toLocaleTimeString("en-US", { hour12: false })}
                        </p>
                      </div>
                      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-center">
                        <p className="text-[9px] font-semibold tracking-wider text-stone-400">END</p>
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-stone-700">
                          {fmtTimestamp(new Date(new Date(selected.startISO).getTime() + selected.duration * 1000).toISOString())}
                        </p>
                      </div>
                    </div>

                    {/* Seek bar */}
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold tracking-wider text-stone-400">SEEK</span>
                      <span className="font-mono text-[11px] text-stone-700">
                        {fmtClock(currentSec)} / {fmtClock(selected.duration)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={selected.duration}
                      value={currentSec}
                      onChange={(e) => setCurrentSec(Number(e.target.value))}
                      className="w-full accent-[#0038A8]"
                    />

                    {/* Playback controls row */}
                    <div className="mt-3 mb-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setPlaying((p) => !p)}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                      >
                        {playing ? <Pause size={12} /> : <Play size={12} />}
                        {playing ? "Pause" : "Play"}
                      </button>
                      <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5">
                        <button onClick={() => setVolume((v) => (v > 0 ? 0 : 80))} className="text-stone-500 hover:text-stone-700 transition">
                          {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={volume}
                          onChange={(e) => setVolume(Number(e.target.value))}
                          className="w-16 accent-[#0038A8]"
                        />
                        <span className="w-7 text-right font-mono text-[9px] text-stone-400">{volume}%</span>
                      </div>
                    </div>

                    {/* ── Clip Selection ────────────────────────────── */}
                    <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
                      {/* Header row */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scissors size={14} className="text-[#0038A8]" />
                          <span className="text-[11px] font-bold tracking-wider text-[#334155]">CLIP SELECTION</span>
                          {previewingSegment && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600">
                              <span className="h-1 w-1 animate-pulse rounded-full bg-rose-500" />
                              PREVIEWING
                            </span>
                          )}
                        </div>
                        {canCreateClip && (
                          <span className="font-mono text-[11px] font-bold text-[#0038A8]">
                            {fmtClock(clipDuration)}
                          </span>
                        )}
                      </div>

                      {/* Visual timeline */}
                      <div className="relative mb-3">
                        {/* Full recording bar */}
                        <div className="relative h-7 rounded-md bg-stone-100">
                          {/* Clip selection highlight */}
                          {clipStart != null && clipEnd != null && clipEnd > clipStart && (
                            <div
                              className="absolute top-0 h-7 rounded-md bg-[#0038A8]/20 border-y border-[#0038A8]/40"
                              style={{
                                left: `${(clipStart / selected.duration) * 100}%`,
                                width: `${((clipEnd - clipStart) / selected.duration) * 100}%`,
                              }}
                            />
                          )}
                          {/* Recording start marker */}
                          <div className="absolute left-0 top-0 h-7 w-0.5 bg-stone-400" />
                          <div className="absolute -top-3.5 left-0 text-[8px] font-bold text-stone-400">
                            {fmtRecordingRange(selected.startISO, selected.duration).start}
                          </div>
                          {/* Recording end marker */}
                          <div className="absolute right-0 top-0 h-7 w-0.5 bg-stone-400" />
                          <div className="absolute -top-3.5 right-0 text-[8px] font-bold text-stone-400">
                            {fmtRecordingRange(selected.startISO, selected.duration).end}
                          </div>
                          {/* Clip start marker */}
                          {clipStart != null && (
                            <div
                              className="absolute top-0 z-10 h-7 w-0.5 bg-emerald-600"
                              style={{ left: `${(clipStart / selected.duration) * 100}%` }}
                            >
                              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-emerald-600">
                                ▲ {fmtClock(clipStart)}
                              </div>
                            </div>
                          )}
                          {/* Clip end marker */}
                          {clipEnd != null && (
                            <div
                              className="absolute top-0 z-10 h-7 w-0.5 bg-rose-500"
                              style={{ left: `${(clipEnd / selected.duration) * 100}%` }}
                            >
                              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-rose-500">
                                ▲ {fmtClock(clipEnd)}
                              </div>
                            </div>
                          )}
                          {/* Current playback position */}
                          <div
                            className="absolute top-0 z-20 h-7 w-px bg-[#0038A8]"
                            style={{ left: `${(currentSec / selected.duration) * 100}%` }}
                          >
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-[#0038A8] px-1 py-px text-[7px] font-bold text-white whitespace-nowrap">
                              NOW
                            </div>
                          </div>
                        </div>
                        {/* Timeline labels below */}
                        <div className="mt-7 flex justify-between">
                          <span className="text-[8px] text-stone-400">Recording Start</span>
                          <span className="text-[8px] text-stone-400">Recording End</span>
                        </div>
                      </div>

                      {/* Timestamp readouts */}
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-center">
                          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CLIP START</p>
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-emerald-600">
                            {clipStart != null ? fmtClock(clipStart) : "—"}
                          </p>
                          <p className="font-mono text-[8px] text-stone-400">
                            {clipStart != null ? fmtTimestamp(new Date(new Date(selected.startISO).getTime() + clipStart * 1000).toISOString()).split(", ")[1] ?? "" : ""}
                          </p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-center">
                          <p className="text-[8px] font-semibold tracking-wider text-stone-400">CLIP END</p>
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-rose-500">
                            {clipEnd != null ? fmtClock(clipEnd) : "—"}
                          </p>
                          <p className="font-mono text-[8px] text-stone-400">
                            {clipEnd != null ? fmtTimestamp(new Date(new Date(selected.startISO).getTime() + clipEnd * 1000).toISOString()).split(", ")[1] ?? "" : ""}
                          </p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-center">
                          <p className="text-[8px] font-semibold tracking-wider text-stone-400">DURATION</p>
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-[#334155]">
                            {canCreateClip ? fmtClock(clipDuration) : "—"}
                          </p>
                          <p className="font-mono text-[8px] text-stone-400">
                            {canCreateClip ? `${Math.round((clipDuration / selected.duration) * 100)}% of recording` : ""}
                          </p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-center">
                          <p className="text-[8px] font-semibold tracking-wider text-stone-400">AVAILABLE</p>
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-stone-500">
                            {fmtClock(selected.duration)}
                          </p>
                          <p className="font-mono text-[8px] text-stone-400">{selected.sizeMB} MB</p>
                        </div>
                      </div>

                      {/* Set buttons */}
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => { setClipStart(currentSec); setPreviewingSegment(false); }}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <BookmarkPlus size={11} /> Set Start @ {fmtClock(currentSec)}
                        </button>
                        <button
                          onClick={() => { setClipEnd(currentSec); setPreviewingSegment(false); }}
                          disabled={currentSec <= (clipStart ?? 0)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <BookmarkMinus size={11} /> Set End @ {fmtClock(currentSec)}
                        </button>
                        {clipStart != null && clipEnd != null && (
                          <button
                            onClick={() => { setClipStart(null); setClipEnd(null); setPreviewingSegment(false); }}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[10px] font-semibold text-stone-500 transition hover:bg-stone-50"
                          >
                            <X size={11} /> Clear Selection
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (clipStart == null || clipEnd == null) return;
                            setCurrentSec(clipStart);
                            setPlaying(true);
                            setPreviewingSegment(true);
                          }}
                          disabled={!canCreateClip}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-3 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Eye size={11} /> Preview Segment
                        </button>
                      </div>

                      {/* Validation errors */}
                      {clipErrors.length > 0 && (
                        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                          <div className="mb-1 flex items-center gap-1">
                            <AlertTriangle size={10} className="text-rose-600" />
                            <span className="text-[9px] font-bold tracking-wider text-rose-600">VALIDATION</span>
                          </div>
                          <ul className="space-y-0.5">
                            {clipErrors.map((err, i) => (
                              <li key={i} className="flex items-start gap-1 text-[10px] leading-relaxed text-rose-700">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                                {err}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Create / Cancel buttons */}
                      <div className="flex items-center gap-2 border-t border-stone-100 pt-3">
                        <button
                          onClick={generateClip}
                          disabled={!canCreateClip}
                          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#002A8C] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CloudUpload size={12} /> Create Clip
                        </button>
                        <button
                          onClick={() => { setClipStart(null); setClipEnd(null); setPreviewingSegment(false); setPlaying(false); setCurrentSec(0); }}
                          className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-50"
                        >
                          <X size={12} /> Cancel
                        </button>
                        <span className="ml-auto text-[9px] italic text-stone-400">
                          Clips contain only recorded footage — no pre-roll or post-roll is added
                        </span>
                      </div>
                    </div>

                    {/* Recording metadata */}
                    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
                      <p className="text-[9px] font-semibold tracking-wider text-stone-400">RECORDING METADATA</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                        <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Recording ID:</span> {selected.id}</p>
                        <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Camera:</span> {selected.cameraId} · {selected.cameraName}</p>
                        <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Location:</span> {selected.location} · {selected.purok}</p>
                        <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Date:</span> {fmtRecordingDate(selected.startISO)}</p>
                        <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Duration:</span> {fmtClock(selected.duration)}</p>
                        <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Size:</span> {selected.sizeMB} MB</p>
                        {selected.eventTag && (
                          <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Event Tag:</span> {selected.eventTag}</p>
                        )}
                        {selected.incidentId && (
                          <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Incident:</span> {selected.incidentId}</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-200 py-4 text-[11px] text-stone-400">
                    <ChevronRight size={12} /> Load a recording to enable play, pause and seek controls
                  </div>
                )}
              </div>
            </div>

            {/* Clip Workflow Steps */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center gap-2 px-5 py-4">
                <Scissors size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Clip Workflow</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Set a start and end on the timeline → generate clip → privacy-process PII → link to an incident
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-3">
                {[
                  { step: "1", title: "Select Footage", desc: "Scrub the recording and mark the start and end of the available footage surrounding the event.", icon: Scissors },
                  { step: "2", title: "Generate & Store", desc: "Saves an mp4 to Supabase Storage and writes a CCTVClip record.", icon: Database },
                  { step: "3", title: "Privacy Process & Link", desc: "Manually mask PII, then attach the clip to an incident for review.", icon: Shield },
                ].map((s) => (
                  <div key={s.step} className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0038A8] text-[9px] font-bold text-white">{s.step}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-900">
                        <s.icon size={11} className="text-[#0038A8]" /> {s.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-stone-500">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Clip Records + Incident-Linked Clips */}
        <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">CCTV Clip Records</h3>
                  <p className="text-[11px] text-[#94A3B8]">clip_id · camera_id · start_time · end_time · storage_reference · privacy_status · incident_id</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{clips.length} records</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {clips.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[12px] text-stone-400">No clips generated yet</p>
                </div>
              ) : (
                clips.map((clip, i) => {
                  const hasProcessed = processedClips.some((p) => p.sourceClipId === clip.id);
                  const latestProcessed = processedClips.find((p) => p.sourceClipId === clip.id);
                  return (
                  <div key={clip.id} className={`px-5 py-4 ${i < clips.length - 1 ? "border-b border-black/5" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{clip.id}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
                            <Shield size={8} /> Original
                          </span>
                          {hasProcessed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                              <Eye size={8} /> Processed copy exists
                            </span>
                          )}
                          {!hasProcessed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                              <EyeOff size={8} /> No processed copy
                            </span>
                          )}
                          {clip.incidentId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
                              <Link2 size={9} /> Linked {clip.incidentId}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">Not attached</span>
                          )}
                        </div>
                        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                          <p className="text-[9px] font-semibold tracking-wider text-stone-400">EVIDENCE DETAILS</p>
                          <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Camera:</span> {clip.cameraId} · {clip.cameraName}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Recorded:</span> {formatTime(clip.startTime)} → {formatTime(clip.endTime)}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Clip Duration:</span> {fmtClock(clip.durationSec)}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Created by:</span> {clip.uploadedBy}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Related Incident:</span> {clip.incidentId ?? "Not attached"}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Privacy Processing:</span> {hasProcessed ? `Processed copy: ${latestProcessed?.id} (${latestProcessed?.maskCount} masks)` : "No processed copy — original preserved"}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Status:</span> {clip.incidentId ? "Attached" : "Unattached"}</p>
                            <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 sm:col-span-2">
                              <ShieldCheck size={10} /> Integrity: Verified
                              <span className="rounded bg-stone-200 px-1 py-px text-[8px] font-bold tracking-wider text-stone-500">MOCK</span>
                            </p>
                          </div>
                          {clip.masks && clip.masks.length > 0 && (
                            <p className="mt-1 flex items-center gap-1 text-[9px] text-stone-400">
                              <Box size={9} /> {clip.masks.length} mask(s) applied — {clip.masks.map((m) => m.label).join(", ")}
                            </p>
                          )}
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate font-mono text-[9px] text-stone-400">
                          <HardDrive size={9} /> {clip.storageReference}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => setRedactTarget(clip)}
                          className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <EyeOff size={11} /> {clip.privacyStatus === "privacy_processed" ? "Manage Privacy" : "Process Privacy"}
                        </button>
                        <button
                          onClick={() => setExportTarget(clip)}
                          className="flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Download size={11} /> Export
                        </button>
                        <button
                          onClick={() => setAttachTarget(clip)}
                          disabled={!!clip.incidentId}
                          className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Link2 size={11} /> {clip.incidentId ? "Attached" : "Attach to Incident"}
                        </button>
                        {!clip.incidentId && (
                          <button
                            onClick={() => setCreateIncidentTarget(clip)}
                            className="flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"
                          >
                            <Siren size={11} /> Create Incident
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Privacy-Processed Copies */}
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <EyeOff size={16} className="text-amber-600" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Privacy-Processed Copies</h3>
                  <p className="text-[11px] text-[#94A3B8]">Derived copies with manual masks — originals preserved</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700">{processedClips.length} processed</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {processedClips.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <EyeOff size={20} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-[12px] text-stone-400">No privacy-processed copies yet</p>
                  <p className="mt-1 text-[10px] text-stone-400">Use "Process Privacy" on an evidence clip to create a processed copy</p>
                </div>
              ) : (
                processedClips.map((pc, i) => {
                  const source = clips.find((c) => c.id === pc.sourceClipId);
                  return (
                    <div key={pc.id} className={`px-5 py-4 ${i < processedClips.length - 1 ? "border-b border-black/5" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-bold text-stone-900">{pc.id}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                              <Eye size={8} /> Privacy Processed
                            </span>
                          </div>
                          <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                            <p className="text-[9px] font-semibold tracking-wider text-stone-400">PROCESSED COPY DETAILS</p>
                            <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                              <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Source Clip:</span> {pc.sourceClipId}</p>
                              <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Camera:</span> {source?.cameraId ?? "—"} · {source?.cameraName ?? "—"}</p>
                              <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Processed By:</span> {pc.processedBy}</p>
                              <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Processed At:</span> {formatTime(pc.processedAt)}</p>
                              <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Mask Count:</span> {pc.maskCount} manual mask(s)</p>
                              <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Mask Types:</span> {pc.masks.map((m) => m.label).join(", ")}</p>
                              {pc.storageReference && (
                                <p className="sm:col-span-2 flex items-center gap-1 text-[10px] text-stone-600">
                                  <HardDrive size={9} /> {pc.storageReference}
                                </p>
                              )}
                            </div>
                          </div>
                          {source && (
                            <div className="mt-2 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                              <Shield size={10} className="mt-0.5 shrink-0 text-sky-600" />
                              <p className="text-[10px] leading-relaxed text-sky-700">
                                <span className="font-semibold">Original preserved:</span> {source.id} ({source.cameraId} — {source.cameraName}) remains unmodified with <span className="font-mono">privacyStatus: "original"</span>. Access restricted to authorized CCTV/evidence permissions.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Data Retention & Review sidebar */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Data Retention &amp; Review</h3>
                  <p className="text-[11px] text-[#94A3B8]">Barangay record-keeping policy</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <div className="mb-3 rounded-xl border border-[#0038A8]/15 bg-[#0038A8]/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CalendarClock size={14} className="text-[#0038A8]" />
                  <p className="text-[11px] font-bold text-[#0038A8]">1-Year Retention Policy</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-stone-600">
                  Once a clip is attached to an official incident, it is securely stored and retained for exactly{" "}
                  <span className="font-semibold">{RETENTION_YEARS} year</span>, aligning with the barangay&apos;s local
                  record-keeping requirements. Unattached clips stay in working storage until linked or pruned.
                </p>
              </div>

              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <EyeOff size={14} className="text-amber-600" />
                  <p className="text-[11px] font-bold text-amber-700">Manual Privacy Processing</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700">
                  The operator manually draws masking boxes over faces and license plates before release.
                  Automated redaction is not supported. All privacy processing is manual — the operator draws rectangular masks over PII. Sanitized clips are flagged{" "}
                  <span className="font-mono">privacy_blurred = true</span>.
                </p>
              </div>

              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Link2 size={10} /> INCIDENT-LINKED CLIPS ({linkedClips})
              </p>
              {linkedClips === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-200 py-6 text-center">
                  <FileText size={18} className="mx-auto mb-1.5 text-stone-300" />
                  <p className="text-[11px] text-stone-400">No clips linked to incidents yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clips.filter((c) => c.incidentId).map((c) => (
                    <div key={c.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-900">{c.id}</span>
                        <span className="rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">{c.incidentId}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-stone-500">
                        <span className="flex items-center gap-1">
                          <CalendarClock size={9} /> Retained until {c.retainedUntil ? formatTime(c.retainedUntil) : "—"}
                        </span>
                        <span className="font-semibold text-emerald-600">{c.retainedUntil ? daysUntil(c.retainedUntil) : 0} days left</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.retainedUntil ? (365 - daysUntil(c.retainedUntil)) / 3.65 : 0}%` }} />
                      </div>
                      <p className="mt-1 text-[9px] text-stone-400">Reviewable by Desk Officer &amp; Captain</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <Info size={12} className="mt-0.5 shrink-0 text-stone-400" />
                <p className="text-[10px] leading-relaxed text-stone-500">
                  Retention begins on the <span className="font-mono">attached_at</span> timestamp and expires exactly{" "}
                  {RETENTION_YEARS} year later on <span className="font-mono">retained_until</span>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Escalated CCTV Events */}
        <div className="mb-6 rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <Siren size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Escalated CCTV Events</h3>
                <p className="text-[11px] text-[#94A3B8]">Events tagged in the Surveillance Matrix — clips linked to incidents</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{visibleEscalated.length} events</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500">
                <Eye size={10} /> Observer only — dispatch handled by Desk Officer
              </span>
            </div>
          </div>
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <Search size={13} className="text-stone-400" />
              <input
                value={eventQuery}
                onChange={(e) => setEventQuery(e.target.value)}
                placeholder="Search events by ID, incident, camera, category..."
                className="w-full bg-transparent text-[11px] text-stone-700 placeholder:text-stone-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-80 space-y-3 overflow-y-auto px-5 pb-4">
            {visibleEscalated.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                <Inbox size={22} className="mb-2 text-stone-300" />
                <p className="text-[12px] font-medium text-stone-500">No events match the current search</p>
              </div>
            ) : (
              visibleEscalated.map((esc) => (
                <div key={esc.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[12px] font-bold text-stone-900">
                      <Video size={12} className="text-[#0038A8]" /> {esc.id}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
                      <Flag size={8} /> {esc.tagType}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {esc.cameraName} · {esc.location} · {esc.purok}
                    </span>
                    <span className="ml-auto text-[10px] text-stone-400">{formatTime(esc.escalatedAt)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      {esc.notes && (
                        <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                          <p className="text-[9px] font-semibold tracking-wider text-stone-400">OPERATOR NOTES</p>
                          <p className="mt-0.5 text-[10px] italic leading-snug text-stone-600">&quot;{esc.notes}&quot;</p>
                        </div>
                      )}
                      <p className="mt-1.5 flex items-center gap-1 truncate font-mono text-[9px] text-stone-400">
                        <HardDrive size={9} /> {esc.storageUrl}
                      </p>
                    </div>
                    <div className="flex flex-col rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-stone-900">{esc.incident.id}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
                          <Siren size={8} /> CCTV-Reported
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          esc.incident.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                          esc.incident.status === "on_scene" ? "bg-violet-100 text-violet-700" :
                          esc.incident.status === "dispatched" ? "bg-sky-100 text-sky-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {esc.incident.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-[9px] text-stone-400">{esc.incident.category} · {esc.incident.priority} priority</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Evidence Activity Log */}
        <EvidenceActivityPanel />
      </main>

      {redactTarget && (
        <RedactionModal
          clip={redactTarget}
          onClose={() => setRedactTarget(null)}
          onApply={applyRedaction}
        />
      )}

      {attachTarget && (
        <AttachModal
          clip={attachTarget}
          onClose={() => setAttachTarget(null)}
          onAttach={attachClip}
        />
      )}

      {exportTarget && (
        <ExportEvidenceModal
          clipId={exportTarget.id}
          incidentId={exportTarget.incidentId}
          operator={operatorName}
          subtitle={`${exportTarget.cameraName} · ${exportTarget.cameraId}`}
          onClose={() => setExportTarget(null)}
        />
      )}

      {createIncidentTarget && (
        <CreateIncidentModal
          clip={createIncidentTarget}
          operatorName={operatorName}
          onClose={() => setCreateIncidentTarget(null)}
          onCreate={createIncident}
        />
      )}

      {clipGenerated && (
        <ConfirmModal
          type="success"
          title="Clip Generated & Stored"
          message={`${clipGenerated.id} created (${fmtClock(clipGenerated.durationSec)} clip) and saved to Supabase Storage. A CCTVClip record now logs the clip ID, camera_id, start_time, end_time and storage_url.`}
          onClose={() => setClipGenerated(null)}
        />
      )}

      {attachedSuccess && (
        <ConfirmModal
          type="success"
          title="Evidence Attached Successfully"
          message={`${attachedSuccess.id} (${attachedSuccess.cameraId} — ${attachedSuccess.cameraName}) has been attached to ${attachedSuccess.incidentId} as supplementary CCTV evidence. Retention now locked at exactly 1 year (${attachedSuccess.retainedUntil ? formatTime(attachedSuccess.retainedUntil) : "—"}) for Desk Officer / Captain review.`}
          onClose={() => setAttachedSuccess(null)}
        />
      )}

      {createdIncidentSuccess && (
        <ConfirmModal
          type="success"
          title="CCTV Incident Created"
          message={`${createdIncidentSuccess.incidentId} created by ${operatorName} (CCTV Operator) with initial priority Medium. Source: CCTV. Camera: ${createdIncidentSuccess.clip.cameraId} — ${createdIncidentSuccess.clip.cameraName}. Attached evidence: ${createdIncidentSuccess.clip.id}. The Desk Officer will determine the final priority during triage.`}
          onClose={() => setCreatedIncidentSuccess(null)}
        />
      )}

      {redactedSuccess && (
        <ConfirmModal
          type="success"
          title="Privacy Processing Complete"
          message={`${redactedSuccess.processed.id} created from ${redactedSuccess.clip.id} (${redactedSuccess.clip.cameraId} — ${redactedSuccess.clip.cameraName}). ${redactedSuccess.processed.maskCount} manual mask(s) applied. Original evidence preserved — not overwritten. The processed copy is stored separately and referenced to the source clip.`}
          onClose={() => setRedactedSuccess(null)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
