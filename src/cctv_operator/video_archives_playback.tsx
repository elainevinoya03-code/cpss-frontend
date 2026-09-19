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
  CheckCircle2,
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
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";
import { addEvidenceActivity } from "./evidence_activity";
import { ExportEvidenceModal } from "./export_evidence_modal";

interface Camera {
  id: string;
  name: string;
  location: string;
  purok: string;
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
}

export interface Mask {
  x: number;
  y: number;
  w: number;
  h: number;
  label: "Face" | "License Plate";
}

export interface Clip {
  id: string;
  cameraId: string;
  cameraName: string;
  startISO: string;
  endISO: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  storageUrl: string;
  privacyBlurred: boolean;
  operator: string;
  masks?: Mask[];
  incidentId?: string;
  attachedAt?: string;
  retainedUntil?: string;
}

interface OpenIncident {
  id: string;
  category: string;
  purok: string;
  title: string;
  severity: string;
}

const CAMERAS: Camera[] = [
  { id: "CAM-GATE-01", name: "Main Gate", location: "Entrance Gate", purok: "Purok 1" },
  { id: "CAM-PLAZA-02", name: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2" },
  { id: "CAM-MARKET-03", name: "Public Market", location: "Market Strip", purok: "Purok 6" },
  { id: "CAM-CHAPEL-04", name: "Chapel Area", location: "Chapel Approach", purok: "Purok 5" },
  { id: "CAM-ROAD-05", name: "Crossing Road", location: "Purok Crossing", purok: "Purok 3" },
];

const RECORDINGS: Recording[] = [
  { id: "R-2600", cameraId: "CAM-GATE-01", cameraName: "Main Gate", location: "Entrance Gate", purok: "Purok 1", startISO: "2026-07-20T09:00:00", duration: 900, sizeMB: 118, events: ["Vehicle entry — plate captured"] },
  { id: "R-2599", cameraId: "CAM-GATE-01", cameraName: "Main Gate", location: "Entrance Gate", purok: "Purok 1", startISO: "2026-07-20T08:00:00", duration: 900, sizeMB: 121, events: ["Morning shift crowd at gate"] },
  { id: "R-2598", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2", startISO: "2026-07-20T10:00:00", duration: 720, sizeMB: 94, events: ["Group loitering near court"] },
  { id: "R-2597", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6", startISO: "2026-07-19T21:30:00", duration: 840, sizeMB: 112, events: ["Noise escalation — DB-MARKET-01"] },
  { id: "R-2596", cameraId: "CAM-CHAPEL-04", cameraName: "Chapel Area", location: "Chapel Approach", purok: "Purok 5", startISO: "2026-07-19T18:45:00", duration: 780, sizeMB: 101, events: ["Suspicious loitering report"] },
  { id: "R-2595", cameraId: "CAM-ROAD-05", cameraName: "Crossing Road", location: "Purok Crossing", purok: "Purok 3", startISO: "2026-07-19T17:00:00", duration: 900, sizeMB: 130, events: ["Traffic build-up after rain"] },
  { id: "R-2594", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2", startISO: "2026-07-19T16:00:00", duration: 720, sizeMB: 96, events: ["Street altercation — clip generated"] },
  { id: "R-2593", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6", startISO: "2026-07-19T12:40:00", duration: 840, sizeMB: 108, events: ["Sensor false trigger — gate area"] },
  { id: "R-2592", cameraId: "CAM-GATE-01", cameraName: "Main Gate", location: "Entrance Gate", purok: "Purok 1", startISO: "2026-07-19T11:30:00", duration: 900, sizeMB: 119, events: ["Delivery vehicle inspected"] },
  { id: "R-2591", cameraId: "CAM-CHAPEL-04", cameraName: "Chapel Area", location: "Chapel Approach", purok: "Purok 5", startISO: "2026-07-18T19:00:00", duration: 780, sizeMB: 99, events: ["Night service crowd"] },
];

const INITIAL_CLIPS: Clip[] = [
  {
    id: "CLIP-2026-0002",
    cameraId: "CAM-MARKET-03",
    cameraName: "Public Market",
    startISO: "2026-07-19T21:30:12",
    endISO: "2026-07-19T21:31:05",
    startSec: 12,
    endSec: 65,
    durationSec: 53,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0002.mp4",
    privacyBlurred: true,
    operator: "CO-01",
    masks: [
      { x: 40, y: 30, w: 60, h: 60, label: "Face" },
      { x: 55, y: 70, w: 90, h: 30, label: "License Plate" },
    ],
    incidentId: "INC-2069",
    attachedAt: "2026-07-19T22:00:00",
    retainedUntil: "2027-07-19T22:00:00",
  },
  {
    id: "CLIP-2026-0001",
    cameraId: "CAM-PLAZA-02",
    cameraName: "Plaza & Court",
    startISO: "2026-07-19T16:00:03",
    endISO: "2026-07-19T16:00:45",
    startSec: 3,
    endSec: 45,
    durationSec: 42,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0001.mp4",
    privacyBlurred: false,
    operator: "CO-01",
  },
];

const OPEN_INCIDENTS: OpenIncident[] = [
  { id: "INC-2071", category: "Fire/Smoke", purok: "Purok 3", title: "Heavy smoke column near market residential row", severity: "critical" },
  { id: "INC-2070", category: "Public Disturbance", purok: "Purok 6", title: "SOS signal at commercial strip", severity: "critical" },
  { id: "INC-2069", category: "Noise Disturbance", purok: "Purok 4", title: "Sustained loud disturbance at hall", severity: "warning" },
  { id: "INC-2068", category: "Fire/Smoke", purok: "Purok 1", title: "Smoke density breach at gate sensor", severity: "warning" },
  { id: "INC-2067", category: "Noise Disturbance", purok: "Purok 2", title: "Late-night noise complaint", severity: "low" },
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
      <span className="absolute bottom-11 left-[38%] text-[7px] font-medium tracking-widest text-white/40">
        FACE
      </span>
      <span className="absolute bottom-[11px] left-[43%] text-[6px] font-medium tracking-widest text-white/40">
        PLATE
      </span>

      <div className="absolute bottom-1 left-[58%]">
        <div className="mx-auto h-3 w-3 rounded-full bg-stone-400" />
        <div className="mx-auto h-6 w-3.5 rounded-sm bg-stone-400" />
      </div>
      <span className="absolute bottom-7 left-[55%] text-[7px] font-medium tracking-widest text-white/40">
        FACE
      </span>

      <div className="absolute bottom-1 left-[66%]">
        <div className="mx-auto h-3 w-3 rounded-full bg-stone-400" />
        <div className="mx-auto h-6 w-3.5 rounded-sm bg-stone-400" />
      </div>
      <span className="absolute bottom-7 left-[63%] text-[7px] font-medium tracking-widest text-white/40">
        FACE
      </span>

      <div className="absolute bottom-1 left-[1%] h-9 w-px bg-stone-500" />
      <div className="absolute bottom-10 left-0 h-1.5 w-24 rounded-r bg-amber-300/70" />
    </div>
  );
}

export function RedactionModal({ clip, onClose, onApply }: { clip: { id: string; masks?: Mask[] }; onClose: () => void; onApply: (masks: Mask[]) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const [masks, setMasks] = useState<Mask[]>(clip.masks ?? []);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [maskLabel, setMaskLabel] = useState<Mask["label"]>("Face");

  function posFromEvent(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function normalize(x1: number, y1: number, x2: number, y2: number) {
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }

  function onMouseDown(e: React.MouseEvent) {
    const p = posFromEvent(e);
    drawStartRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawStartRef.current) return;
    const p = posFromEvent(e);
    setDraft(normalize(drawStartRef.current.x, drawStartRef.current.y, p.x, p.y));
  }

  function onMouseUp() {
    if (drawStartRef.current && draft && draft.w >= 6 && draft.h >= 6) {
      setMasks((prev) => [...prev, { x: draft.x, y: draft.y, w: draft.w, h: draft.h, label: maskLabel }]);
    }
    drawStartRef.current = null;
    setDraft(null);
  }

  return (
    <Modal
      onClose={onClose}
      title={`Manual Privacy Processing — ${clip.id}`}
      subtitle="Draw rectangular masks over faces or license plates to manually redact PII"
      icon={<EyeOff size={18} />}
      iconClass="bg-[#15803D]/10 text-[#15803D]"
      size="2xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onApply(masks)}
            disabled={masks.length === 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534] disabled:opacity-40"
          >
            <CheckCircle2 size={13} />
            Save Privacy-Processed Copy
          </button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wider text-stone-400">MASK TYPE</span>
          <button
            onClick={() => setMaskLabel("Face")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
              maskLabel === "Face" ? "border-[#15803D] bg-[#15803D]/5 text-[#15803D]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            <Square size={11} />
            Face
          </button>
          <button
            onClick={() => setMaskLabel("License Plate")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
              maskLabel === "License Plate" ? "border-[#15803D] bg-[#15803D]/5 text-[#15803D]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            <Box size={11} />
            License Plate
          </button>
          <span className="mx-1 text-[10px] text-stone-300">·</span>
          <button
            onClick={() => setMasks([])}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50"
          >
            <Eraser size={11} />
            Clear All
          </button>
        </div>

        <div
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            drawStartRef.current = null;
            setDraft(null);
          }}
          className="relative h-56 w-full cursor-crosshair select-none overflow-hidden rounded-xl border border-stone-200 sm:h-64"
        >
          <FrameScene />
          {masks.map((m, i) => (
            <div
              key={i}
              className="absolute flex items-start justify-between rounded-sm border border-[#15803D]/60 bg-white/70 mix-blend-multiply"
              style={{ left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` }}
            >
              <span className="rounded-br bg-[#15803D]/80 px-1 py-0.5 text-[7px] font-bold uppercase text-white">
                {m.label}
              </span>
            </div>
          ))}
          {draft && draft.w > 0 && draft.h > 0 && (
            <div
              className="absolute rounded-sm border-2 border-dashed border-[#15803D] bg-[#15803D]/20"
              style={{ left: `${draft.x}px`, top: `${draft.y}px`, width: `${draft.w}px`, height: `${draft.h}px` }}
            />
          )}
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[9px] font-medium text-white">
            <EyeOff size={10} />
            {masks.length} mask{masks.length === 1 ? "" : "s"} drawn
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <Info size={12} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[10px] leading-relaxed text-amber-700">
            Manual Privacy Processing requires the operator to draw masking rectangles over each
            face or license plate. No automated detection is applied — this is a manual-only tool for
            Data Privacy Act compliance.
          </p>
        </div>
    </Modal>
  );
}

function AttachModal({ clip, onClose, onAttach }: { clip: Clip; onClose: () => void; onAttach: (incidentId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pendingIncidents = OPEN_INCIDENTS.filter((i) => i.id !== clip.incidentId);

  return (
    <Modal
      onClose={onClose}
      title="Attach Clip to Incident"
      subtitle={`${clip.id} · ${clip.cameraName}`}
      icon={<Link2 size={18} />}
      iconClass="bg-[#15803D]/10 text-[#15803D]"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => selectedId && onAttach(selectedId)}
            disabled={!selectedId}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534] disabled:opacity-40"
          >
            <Link2 size={13} />
            Attach Clip
          </button>
        </div>
      }
    >
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {pendingIncidents.map((inc) => (
            <button
              key={inc.id}
              onClick={() => setSelectedId(inc.id)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                selectedId === inc.id ? "border-[#15803D] bg-[#15803D]/5" : "border-stone-200 bg-white hover:bg-stone-50"
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

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#15803D]/15 bg-[#15803D]/5 px-3 py-2.5">
          <Link2 size={12} className="mt-0.5 shrink-0 text-[#15803D]" />
          <p className="text-[10px] font-semibold leading-relaxed text-stone-700">
            Evidence will be linked to the selected incident.
          </p>
        </div>

        <div className="mt-2 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <CalendarClock size={12} className="mt-0.5 shrink-0 text-[#15803D]" />
          <p className="text-[10px] leading-relaxed text-stone-500">
            Linking starts the official <span className="font-semibold">{RETENTION_YEARS}-year retention</span> clock.
            The clip becomes reviewable by the Barangay Desk Officer and Barangay Captain.
          </p>
        </div>
    </Modal>
  );
}

export default function VideoArchivesPlayback({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [recordings] = useState<Recording[]>(RECORDINGS);
  const [clips, setClips] = useState<Clip[]>(INITIAL_CLIPS);
  const clipSeqRef = useRef(INITIAL_CLIPS.length + 1);
  const [archiveUsedGB, setArchiveUsedGB] = useState(ARCHIVE_START_GB);

  const [dateFilter, setDateFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [cameraFilter, setCameraFilter] = useState("all");

  const [selected, setSelected] = useState<Recording | null>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [previewingSegment, setPreviewingSegment] = useState(false);

  const [redactTarget, setRedactTarget] = useState<Clip | null>(null);
  const [attachTarget, setAttachTarget] = useState<Clip | null>(null);
  const [exportTarget, setExportTarget] = useState<Clip | null>(null);
  const [clipGenerated, setClipGenerated] = useState<Clip | null>(null);
  const [attachedSuccess, setAttachedSuccess] = useState<Clip | null>(null);
  const [redactedSuccess, setRedactedSuccess] = useState<Clip | null>(null);

  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => {
      if (cameraFilter !== "all" && r.cameraId !== cameraFilter) return false;
      if (dateFilter) {
        const d = new Date(r.startISO);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (localDate !== dateFilter) return false;
      }
      if (timeFilter) {
        const t = timeToMinutes(timeFilter);
        const sd = new Date(r.startISO);
        const ed = new Date(sd.getTime() + r.duration * 1000);
        const sm = sd.getHours() * 60 + sd.getMinutes();
        const em = ed.getHours() * 60 + ed.getMinutes();
        const overlaps = sm <= em ? t >= sm && t <= em : t >= sm || t <= em;
        if (!overlaps) return false;
      }
      return true;
    });
  }, [recordings, cameraFilter, dateFilter, timeFilter]);

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
    setSelected(rec);
    setCurrentSec(0);
    setPlaying(false);
    setClipStart(null);
    setClipEnd(null);
    setPreviewingSegment(false);
  }

  function generateClip() {
    if (!selected || clipStart == null || clipEnd == null || clipEnd <= clipStart) return;
    const base = new Date(selected.startISO).getTime();
    const s = new Date(base + clipStart * 1000);
    const e = new Date(base + clipEnd * 1000);
    const id = `CLIP-2026-${String(clipSeqRef.current++).padStart(4, "0")}`;
    const clip: Clip = {
      id,
      cameraId: selected.cameraId,
      cameraName: selected.cameraName,
      startISO: s.toISOString(),
      endISO: e.toISOString(),
      startSec: clipStart,
      endSec: clipEnd,
      durationSec: clipEnd - clipStart,
      storageUrl: `https://brgyculiat.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${id}.mp4`,
      privacyBlurred: false,
      operator: operatorName,
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
    setClips((prev) => prev.map((c) => (c.id === redactTarget.id ? { ...c, privacyBlurred: true, masks } : c)));
    addEvidenceActivity({ action: "Redacted", clipId: redactTarget.id, incidentId: redactTarget.incidentId, operator: operatorName });
    setRedactedSuccess(redactTarget);
    setRedactTarget(null);
    beep("info");
    flash(`${redactTarget.id} marked as privacy-redacted by ${operatorName} (privacy_blurred = true)`);
  }

  function attachClip(incidentId: string) {
    if (!attachTarget) return;
    const attachedAt = new Date().toISOString();
    const updated: Clip = { ...attachTarget, incidentId, attachedAt, retainedUntil: retentionExpiry(attachedAt) };
    setClips((prev) => prev.map((c) => (c.id === attachTarget.id ? updated : c)));
    addEvidenceActivity({ action: "Attached", clipId: attachTarget.id, incidentId, operator: operatorName });
    setAttachedSuccess(updated);
    setAttachTarget(null);
    beep("info");
    flash(`${attachTarget.id} linked by ${operatorName} to ${incidentId} — ${RETENTION_YEARS}-year retention started`);
  }

  function clearFilters() {
    setDateFilter("");
    setTimeFilter("");
    setCameraFilter("all");
  }

  const pendingRedaction = clips.filter((c) => !c.privacyBlurred).length;
  const linkedClips = clips.filter((c) => c.incidentId).length;
  const archivePct = Math.round((archiveUsedGB / ARCHIVE_TOTAL_GB) * 100);
  const archiveCritical = archivePct >= 90;

  const kpis = [
    { label: "ARCHIVED RECORDINGS", value: recordings.length, sub: "searchable by date, time & camera", icon: Archive },
    { label: "CCTV CLIP RECORDS", value: clips.length, sub: "stored in Supabase Storage", icon: Database },
    { label: "PENDING REDACTION", value: pendingRedaction, sub: "manual PII masking required", icon: EyeOff },
    { label: "CLIPS ON INCIDENTS", value: linkedClips, sub: `retained exactly ${RETENTION_YEARS} year`, icon: Shield },
  ];

  const clipRangeValid = selected && clipStart != null && clipEnd != null && clipEnd > clipStart;
  const clipRangeInvalid = selected && clipStart != null && clipEnd != null && clipEnd <= clipStart;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Video Archives &amp; Playback</h1>
              <p className="mt-1 text-sm text-stone-500">
                Search, replay, clip and sanitize recorded surveillance footage
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#15803D]">
                <User size={12} />
                Operator: {operatorName}
              </span>
              <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#15803D]/5 px-3 py-1.5 text-[11px] font-medium text-[#15803D]">
                <Lock size={12} />
                Evidence-grade retention: {RETENTION_YEARS} year
              </span>
            </div>
          </div>
        </header>

        <div className={`mb-6 rounded-xl border px-5 py-4 shadow-sm ${archiveCritical ? "border-rose-200 bg-rose-50/50" : "border-black/5 bg-white"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className={archiveCritical ? "text-rose-600" : "text-[#15803D]"} />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Archive Storage Capacity</h3>
                <p className="text-[11px] text-[#94A3B8]">
                  {archiveUsedGB.toFixed(1)} GB of {ARCHIVE_TOTAL_GB} GB used · {clips.length} clip records · 1-year retention
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${archiveCritical ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                {archiveCritical ? "NEAR CAPACITY" : "HEALTHY"}
              </span>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full transition-all ${archiveCritical ? "bg-rose-500" : "bg-[#15803D]"}`} style={{ width: `${archivePct}%` }} />
          </div>
          <p className="mt-2 text-[9px] text-stone-400">
            {archiveCritical
              ? "Storage above 90% — oldest footage beyond the 1-year retention window is at risk. Purge reclaimed footage or expand the volume."
              : "Footage older than the 1-year retention window is automatically marked for purge. Capacity headroom available."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#15803D]">{value}</div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-[#15803D]" />
              <h3 className="text-[14px] font-semibold text-[#334155]">Search the Video Archive</h3>
            </div>
            <span className="text-[10px] font-medium text-[#94A3B8]">
              {filteredRecordings.length} of {recordings.length} recordings match
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Calendar size={10} />
                DATE
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Clock size={10} />
                TIME
              </label>
              <input
                type="time"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Camera size={10} />
                CAMERA
              </label>
              <select
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
              >
                <option value="all">All cameras</option>
                {CAMERAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={clearFilters}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50"
              >
                <RotateCcw size={11} />
                Clear
              </button>
              <button
                onClick={() => flash(`Archive filtered — ${filteredRecordings.length} recordings found`)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#15803D] px-3 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
              >
                <Search size={12} />
                Search Archive
              </button>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 620 }}>
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Archive Index</h3>
                  <p className="text-[11px] text-[#94A3B8]">Recordings matching your filters</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
                {filteredRecordings.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {filteredRecordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <Search size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No recordings found</p>
                  <p className="text-[10px] text-stone-400">Adjust the date, time or camera filters</p>
                </div>
              ) : (
                filteredRecordings.map((rec) => (
                  <div
                    key={rec.id}
                    className={`rounded-lg border px-4 py-3 transition ${
                      selected?.id === rec.id ? "border-[#15803D] bg-[#15803D]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] font-bold text-stone-900">
                        <Video size={11} className="text-[#15803D]" />
                        {rec.id}
                      </span>
                      <span className="text-[10px] text-stone-400">{rec.sizeMB} MB</span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-stone-700">{rec.cameraName}</p>
                    <p className="text-[10px] text-stone-400">{rec.location} · {rec.purok}</p>
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-stone-400">
                      <Clock size={9} />
                      {formatTime(rec.startISO)} · {fmtClock(rec.duration)}
                    </p>
                    {rec.events[0] && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-600">
                        <AlertTriangle size={8} />
                        {rec.events[0]}
                      </span>
                    )}
                    <button
                      onClick={() => loadRecording(rec)}
                      className="mt-2 flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-[#15803D]/20 bg-[#15803D]/5 text-[11px] font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white"
                    >
                      <Play size={11} />
                      {selected?.id === rec.id ? "Loaded in Player" : "Load in Player"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col gap-5 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <MonitorPlay size={16} className="text-[#15803D]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Playback Station</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      {selected ? `${selected.cameraName} · ${selected.location} · ${formatTime(selected.startISO)}` : "Select a recording from the archive index"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500">
                    <HardDrive size={10} />
                    Playback
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${playing ? "bg-rose-50 text-rose-600" : "bg-stone-100 text-stone-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${playing ? "animate-pulse bg-rose-500" : "bg-stone-300"}`} />
                    {playing ? "Playing" : "Paused"}
                  </span>
                </div>
              </div>

              <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-black/20 bg-black">
                <div className="relative h-56 w-full sm:h-64">
                  {selected ? (
                    <>
                      <FrameScene />
                      <div className="absolute left-3 top-3 flex items-center gap-2">
                        <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                          REC
                        </span>
                        <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">
                          {selected.id}
                        </span>
                      </div>
                      <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-white">
                        {new Date(new Date(selected.startISO).getTime() + currentSec * 1000).toLocaleTimeString("en-US", { hour12: false })}
                      </div>
                      {!playing && currentSec === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <button
                            onClick={() => setPlaying(true)}
                            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#15803D] shadow-xl transition hover:scale-105"
                          >
                            <Play size={26} className="ml-1" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center bg-stone-900 text-center">
                      <Video size={28} className="mb-2 text-stone-700" />
                      <p className="text-[12px] font-medium text-stone-500">No recording loaded</p>
                      <p className="text-[10px] text-stone-600">Choose a clip from the Archive Index to begin playback</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                {selected ? (
                  <>
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
                      className="w-full accent-[#15803D]"
                    />

                    <div className="mt-3 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold tracking-wider text-stone-400">CLIP RANGE</span>
                        {previewingSegment && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600">
                            <span className="h-1 w-1 animate-pulse rounded-full bg-rose-500" />
                            PREVIEWING SEGMENT
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {clipStart != null ? fmtClock(clipStart) : "—"} → {clipEnd != null ? fmtClock(clipEnd) : "—"}
                        {clipRangeValid && <span className="ml-1 font-semibold text-[#15803D]">({fmtClock((clipEnd ?? 0) - (clipStart ?? 0))})</span>}
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-stone-200">
                      {clipStart != null && clipEnd != null && (
                        <div
                          className="absolute h-2 rounded-full bg-[#15803D]/60"
                          style={{
                            left: `${(clipStart / selected.duration) * 100}%`,
                            width: `${((clipEnd - clipStart) / selected.duration) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-stone-400">
                      Select available footage surrounding the event — clips are cut only from recorded footage, with no automatic pre-roll or post-roll added.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setPlaying((p) => !p)}
                        className="flex h-9 items-center gap-1.5 rounded-lg bg-[#15803D] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
                      >
                        {playing ? <Pause size={12} /> : <Play size={12} />}
                        {playing ? "Pause" : "Play"}
                      </button>
                      <button
                        onClick={() => {
                          setClipStart(currentSec);
                          setPreviewingSegment(false);
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#15803D]/20 bg-[#15803D]/5 px-3 text-[11px] font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white"
                      >
                        <Scissors size={12} />
                        Set Clip Start
                      </button>
                      <button
                        onClick={() => {
                          setClipEnd(currentSec);
                          setPreviewingSegment(false);
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#15803D]/20 bg-[#15803D]/5 px-3 text-[11px] font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white"
                      >
                        <Scissors size={12} />
                        Set Clip End
                      </button>
                      <button
                        onClick={() => {
                          if (clipStart == null || clipEnd == null) return;
                          setCurrentSec(clipStart);
                          setPlaying(true);
                          setPreviewingSegment(true);
                        }}
                        disabled={!clipRangeValid}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#15803D]/20 bg-[#15803D]/5 px-3 text-[11px] font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Eye size={12} />
                        Preview Segment
                      </button>
                      <button
                        onClick={generateClip}
                        disabled={!clipRangeValid}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CloudUpload size={12} />
                        Generate Clip
                      </button>
                    </div>

                    {clipRangeInvalid && (
                      <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-rose-600">
                        <AlertTriangle size={10} />
                        Clip end must be after clip start
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-200 py-4 text-[11px] text-stone-400">
                    <ChevronRight size={12} />
                    Load a recording to enable play, pause and seek controls
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center gap-2 px-5 py-4">
                <Scissors size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Clip Workflow</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Set a start and end on the timeline → generate clip → redact PII → link to an incident
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-3">
                {[
                  { step: "1", title: "Select Footage", desc: "Scrub the recording and mark the start and end of the available footage surrounding the event.", icon: Scissors },
                  { step: "2", title: "Generate & Store", desc: "Saves an mp4 to Supabase Storage and writes a CCTVClip record.", icon: Database },
                  { step: "3", title: "Redact & Link", desc: "Manually mask PII, then attach the clip to an incident for review.", icon: Shield },
                ].map((s) => (
                  <div key={s.step} className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#15803D] text-[9px] font-bold text-white">
                        {s.step}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-900">
                        <s.icon size={11} className="text-[#15803D]" />
                        {s.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-stone-500">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">CCTV Clip Records</h3>
                  <p className="text-[11px] text-[#94A3B8]">clip_id · camera_id · start_time · end_time · storage_url · privacy_blurred · incident_id</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
                {clips.length} records
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {clips.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[12px] text-stone-400">No clips generated yet</p>
                </div>
              ) : (
                clips.map((clip, i) => (
                  <div key={clip.id} className={`px-5 py-4 ${i < clips.length - 1 ? "border-b border-black/5" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{clip.id}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${clip.privacyBlurred ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {clip.privacyBlurred ? <Eye size={9} /> : <EyeOff size={9} />}
                            {clip.privacyBlurred ? "Privacy blurred" : "Unredacted"}
                          </span>
                          {clip.incidentId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#15803D]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#15803D]">
                              <Link2 size={9} />
                              Linked {clip.incidentId}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
                              Not attached
                            </span>
                          )}
                        </div>
                        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                          <p className="text-[9px] font-semibold tracking-wider text-stone-400">EVIDENCE DETAILS</p>
                          <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Camera:</span> {clip.cameraId} · {clip.cameraName}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Recorded:</span> {formatTime(clip.startISO)} → {formatTime(clip.endISO)}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Clip Duration:</span> {fmtClock(clip.durationSec)}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Created by:</span> {clip.operator}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Related Incident:</span> {clip.incidentId ?? "Not attached"}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Privacy Processing:</span> {clip.privacyBlurred ? "Applied (manual masks)" : "Pending manual redaction"}</p>
                            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Status:</span> {clip.incidentId ? "Attached" : "Unattached"}</p>
                            <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 sm:col-span-2">
                              <ShieldCheck size={10} />
                              Integrity: Verified
                              <span className="rounded bg-stone-200 px-1 py-px text-[8px] font-bold tracking-wider text-stone-500">MOCK</span>
                            </p>
                          </div>
                          {clip.masks && clip.masks.length > 0 && (
                            <p className="mt-1 flex items-center gap-1 text-[9px] text-stone-400">
                              <Box size={9} />
                              {clip.masks.length} mask(s) applied {clip.masks.map((m) => m.label).join(", ")}
                            </p>
                          )}
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate font-mono text-[9px] text-stone-400">
                          <HardDrive size={9} />
                          {clip.storageUrl}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => setRedactTarget(clip)}
                          className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <EyeOff size={11} />
                          {clip.privacyBlurred ? "Manage Blur" : "Redact"}
                        </button>
                        <button
                          onClick={() => setExportTarget(clip)}
                          className="flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Download size={11} />
                          Export
                        </button>
                        <button
                          onClick={() => setAttachTarget(clip)}
                          disabled={!!clip.incidentId}
                          className="flex h-7 items-center gap-1 rounded-md border border-[#15803D]/20 bg-[#15803D]/5 px-2 text-[11px] font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Link2 size={11} />
                          {clip.incidentId ? "Attached" : "Attach to Incident"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Data Retention &amp; Review</h3>
                  <p className="text-[11px] text-[#94A3B8]">Barangay record-keeping policy</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <div className="mb-3 rounded-xl border border-[#15803D]/15 bg-[#15803D]/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CalendarClock size={14} className="text-[#15803D]" />
                  <p className="text-[11px] font-bold text-[#15803D]">1-Year Retention Policy</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-stone-600">
                  Once a clip is attached to an official incident, it is securely stored and retained for exactly{" "}
                  <span className="font-semibold">{RETENTION_YEARS} year</span>, aligning with the barangay's local
                  record-keeping requirements. Unattached clips stay in working storage until linked or pruned.
                </p>
              </div>

              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <EyeOff size={14} className="text-amber-600" />
                  <p className="text-[11px] font-bold text-amber-700">Manual Privacy Redaction</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700">
                  The operator manually draws masking boxes over faces and license plates before release.
                  Automated redaction is deferred to a future release. Sanitized clips are flagged{" "}
                  <span className="font-mono">privacy_blurred = true</span>.
                </p>
              </div>

              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Link2 size={10} />
                INCIDENT-LINKED CLIPS ({linkedClips})
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
                        <span className="rounded-full bg-[#15803D]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#15803D]">
                          {c.incidentId}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-stone-500">
                        <span className="flex items-center gap-1">
                          <CalendarClock size={9} />
                          Retained until {c.retainedUntil ? formatTime(c.retainedUntil) : "—"}
                        </span>
                        <span className="font-semibold text-emerald-600">{c.retainedUntil ? daysUntil(c.retainedUntil) : 0} days left</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${c.retainedUntil ? (365 - daysUntil(c.retainedUntil)) / 3.65 : 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[9px] text-stone-400">
                        Reviewable by Barangay Desk Officer &amp; Barangay Captain
                      </p>
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

      {clipGenerated && (
        <ConfirmModal
          type="success"
          title="Clip Generated &amp; Stored"
          message={`${clipGenerated.id} created (${fmtClock(clipGenerated.durationSec)} clip) and saved to Supabase Storage. A CCTVClip record now logs the clip ID, camera_id, start_time, end_time and storage_url.`}
          onClose={() => setClipGenerated(null)}
        />
      )}

      {attachedSuccess && (
        <ConfirmModal
          type="success"
          title="Clip Attached to Incident"
          message={`${attachedSuccess.id} linked via incident_id to ${attachedSuccess.incidentId}. Retention now locked at exactly 1 year (${attachedSuccess.retainedUntil ? formatTime(attachedSuccess.retainedUntil) : "—"}) for Desk Officer / Captain review.`}
          onClose={() => setAttachedSuccess(null)}
        />
      )}

      {redactedSuccess && (
        <ConfirmModal
          type="success"
          title="Footage Sanitized"
          message={`${redactedSuccess.id} privacy_blurred flag set to true. Manual masks cover the drawn PII (faces / license plates). Automated redaction remains deferred to a future release.`}
          onClose={() => setRedactedSuccess(null)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
