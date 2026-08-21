import React, { useState, useEffect } from "react";
import {
  Video,
  Camera,
  Play,
  Pause,
  Eye,
  EyeOff,
  Car,
  Clock,
  MapPin,
  Link2,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Download,
  History,
  ArrowRight,
  Scissors,
  Flag,
  Siren,
  Search,
  User,
  Inbox,
  Paperclip,
  AlertCircle,
  Activity,
  HardDrive,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";
import { addEvidenceActivity, useEvidenceActivities, type EvidenceAction } from "./evidence_activity";
import { ExportEvidenceModal } from "./export_evidence_modal";
import { RedactionModal } from "./video_archives_playback";

interface ArchiveClip {
  id: string;
  camId: string;
  camLabel: string;
  location: string;
  time: string;
  duration: string;
}

interface EvidenceClip {
  id: string;
  eventId: string;
  camLabel: string;
  time: string;
  duration: string;
  note: string;
}

type TagType = "Suspicious Behavior" | "Unusual Crowd" | "Road Blockage" | "Other";
type DispatchStatus = "in_triage" | "dispatched" | "on_scene" | "resolved";

interface IncidentRecord {
  id: string;
  source: "CCTV-Reported";
  priority: string;
  category: string;
  status: DispatchStatus;
  purok: string;
  createdAt: string;
  assignedTeam?: string;
  dispatchNote?: string;
}

interface EscalatedClip {
  id: string;
  cameraId: string;
  cameraName: string;
  location: string;
  purok: string;
  tagType: TagType;
  notes?: string;
  escalatedAt: string;
  clipStart: string;
  clipEnd: string;
  durationSec: number;
  storageUrl: string;
  operator: string;
  incident: IncidentRecord;
}

const INITIAL_ARCHIVE: ArchiveClip[] = [
  { id: "ARC-2204", camId: "RDS-03", camLabel: "RDS-03 · Riverside Drive", location: "Riverside Drive · Purok 4", time: "2026-07-20T21:00:00", duration: "60s" },
  { id: "ARC-2203", camId: "ALY-07", camLabel: "ALY-07 · North Alley", location: "Dark Alley Entry · Purok 3", time: "2026-07-20T20:58:00", duration: "60s" },
  { id: "ARC-2202", camId: "PLZ-02", camLabel: "PLZ-02 · Plaza Junction", location: "Plaza Junction · Purok 2", time: "2026-07-20T20:44:00", duration: "60s" },
  { id: "ARC-2201", camId: "MRK-04", camLabel: "MRK-04 · Market Row", location: "Market Residential Row · Purok 5", time: "2026-07-20T20:26:00", duration: "60s" },
  { id: "ARC-2200", camId: "SM-GATE-01", camLabel: "SM-GATE-01 · Main Gate", location: "Barangay Main Gate · Purok 1", time: "2026-07-20T19:55:00", duration: "60s" },
];

const INITIAL_EVIDENCE: EvidenceClip[] = [
  { id: "EV-CLIP-01", eventId: "INC-2069", camLabel: "CAM-CHAPEL-04 · Chapel Area", time: "2026-07-19T18:50:00", duration: "60s", note: "Full minute of subject lingering — bound as permanent DVR attachment" },
];

const DISPATCH_STATUS: Record<DispatchStatus, { label: string; badge: string; dot: string; note: string; owner: string }> = {
  in_triage: { label: "In Desk Officer Triage", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", note: "Awaiting triage, prioritization & dispatch decision", owner: "Barangay Desk Officer" },
  dispatched: { label: "Tanod Dispatched", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", note: "Response team assigned by Desk Officer", owner: "Barangay Desk Officer" },
  on_scene: { label: "Tanod On Scene", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400", note: "Responding unit physically at the location", owner: "Barangay Desk Officer" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", note: "Incident closed by the Desk Officer", owner: "Barangay Desk Officer" },
};

const DISPATCH_ORDER: DispatchStatus[] = ["in_triage", "dispatched", "on_scene", "resolved"];

const INITIAL_EVENTS: EscalatedClip[] = [
  {
    id: "CLIP-2026-0004", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6",
    tagType: "Unusual Crowd", notes: "Rapid gathering outside the wet market stalls. Individuals appear agitated.",
    escalatedAt: "2026-07-20T10:05:00", clipStart: "2026-07-20T10:04:35", clipEnd: "2026-07-20T10:05:10",
    durationSec: 35,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0004.mp4",
    operator: "CO-01",
    incident: { id: "INC-2072", source: "CCTV-Reported", priority: "Medium", category: "Unusual Crowd", status: "in_triage", purok: "Purok 6", createdAt: "2026-07-20T10:05:01" },
  },
  {
    id: "CLIP-2026-0003", cameraId: "CAM-ROAD-05", cameraName: "Crossing Road", location: "Purok Crossing", purok: "Purok 3",
    tagType: "Road Blockage", notes: "Vehicle stalled across the crossing, blocking the main lane in both directions.",
    escalatedAt: "2026-07-20T09:40:00", clipStart: "2026-07-20T09:39:20", clipEnd: "2026-07-20T09:40:10",
    durationSec: 50,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0003.mp4",
    operator: "CO-01",
    incident: { id: "INC-2071", source: "CCTV-Reported", priority: "Medium", category: "Road Blockage", status: "dispatched", purok: "Purok 3", createdAt: "2026-07-20T09:40:02", assignedTeam: "Team Alpha", dispatchNote: "Clearing assist requested for stalled vehicle." },
  },
  {
    id: "CLIP-2026-0002", cameraId: "CAM-CHAPEL-04", cameraName: "Chapel Area", location: "Chapel Approach", purok: "Purok 5",
    tagType: "Suspicious Behavior", notes: "Individual lingering near parked vehicles for an extended period after night service.",
    escalatedAt: "2026-07-19T18:50:00", clipStart: "2026-07-19T18:49:30", clipEnd: "2026-07-19T18:50:10",
    durationSec: 40,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0002.mp4",
    operator: "CO-01",
    incident: { id: "INC-2069", source: "CCTV-Reported", priority: "Medium", category: "Suspicious Behavior", status: "on_scene", purok: "Purok 5", createdAt: "2026-07-19T18:50:02", assignedTeam: "Team Bravo", dispatchNote: "Loitering verified on scene. Party identified and advised." },
  },
  {
    id: "CLIP-2026-0001", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2",
    tagType: "Other", notes: "Unattended package left near the court entrance.",
    escalatedAt: "2026-07-19T16:05:00", clipStart: "2026-07-19T16:04:45", clipEnd: "2026-07-19T16:05:10",
    durationSec: 25,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0001.mp4",
    operator: "CO-01",
    incident: { id: "INC-2065", source: "CCTV-Reported", priority: "Medium", category: "Other", status: "resolved", purok: "Purok 2", createdAt: "2026-07-19T16:05:02", assignedTeam: "Team Delta", dispatchNote: "Package inspected and cleared. No hazard found." },
  },
];

function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function ClipTimeline() {
  return (
    <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div className="absolute inset-y-0 left-[15%] right-[15%] bg-[#0038A8]/70" />
      <div className="absolute -top-[3px] left-[15%] h-[14px] w-0.5 bg-stone-800" />
      <div className="absolute -top-[3px] right-[15%] h-[14px] w-0.5 bg-stone-800" />
    </div>
  );
}

function ClipTimelineLegend() {
  return (
    <div className="mt-1 flex items-center justify-between text-[9px] font-medium text-stone-400">
      <span className="flex items-center gap-1">
        <span className="h-2 w-0.5 rounded-full bg-stone-700" />
        clip start
      </span>
      <span className="flex items-center gap-1 text-stone-600">
        <Scissors size={9} />
        operator-selected footage
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-0.5 rounded-full bg-stone-700" />
        clip end
      </span>
    </div>
  );
}

const ACTION_STYLE: Record<EvidenceAction, { badge: string }> = {
  Viewed: { badge: "bg-sky-100 text-sky-700" },
  Generated: { badge: "bg-violet-100 text-violet-700" },
  Redacted: { badge: "bg-amber-100 text-amber-700" },
  Attached: { badge: "bg-[#0038A8]/10 text-[#0038A8]" },
  Exported: { badge: "bg-emerald-100 text-emerald-700" },
};

function fmtStamp(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  );
}

function ClipReviewModal({ clip, onClose }: { clip: EscalatedClip; onClose: () => void }) {
  const [currentSec, setCurrentSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [redactOpen, setRedactOpen] = useState(false);
  const status = DISPATCH_STATUS[clip.incident.status];

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setCurrentSec((s) => (s >= clip.durationSec ? clip.durationSec : s + 1));
    }, 1000);
    return () => clearInterval(t);
  }, [playing, clip.durationSec]);

  useEffect(() => {
    if (playing && currentSec >= clip.durationSec) setPlaying(false);
  }, [currentSec, playing, clip.durationSec]);

  const footer = (
    <div className="flex justify-end gap-2">
      <button
        onClick={() => setRedactOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        <EyeOff size={13} />
        Redact PII
      </button>
      <button
        onClick={() => setExportOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
      >
        <Download size={13} />
        Export Evidence
      </button>
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
      >
        <CheckCircle2 size={13} />
        Done
      </button>
    </div>
  );

  return (
    <>
      <Modal
      onClose={onClose}
      title={`Clip Review — ${clip.id}`}
      subtitle={`${clip.cameraName} · ${clip.location} · ${clip.purok}`}
      icon={<Video size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="xl"
      footer={footer}
    >
      <div className="relative mb-3 h-48 w-full overflow-hidden rounded-xl border border-black/20 bg-black sm:h-56">
          <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              CLIP
            </span>
            <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">{clip.id}</span>
          </div>
          <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
            {fmtClock(currentSec)} / {fmtClock(clip.durationSec)}
          </div>
          {!playing && currentSec === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <button
                onClick={() => setPlaying(true)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#0038A8] shadow-xl transition hover:scale-105"
              >
                <Play size={22} className="ml-1" />
              </button>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={clip.durationSec}
            value={currentSec}
            onChange={(e) => setCurrentSec(Number(e.target.value))}
            className="flex-1 accent-[#0038A8]"
          />
        </div>

      <ClipTimeline />
      <ClipTimelineLegend />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">EVIDENCE DETAILS</p>
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Evidence ID:</span> {clip.id}</p>
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Camera:</span> {clip.cameraId} · {clip.cameraName}</p>
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Incident:</span> {clip.incident.id}</p>
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Recorded time:</span> {formatTime(clip.clipStart)} → {formatTime(clip.clipEnd)}</p>
            <p className="text-[9px] text-stone-400">{clip.durationSec}s of available footage selected by the operator</p>
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Created by:</span> {clip.operator}</p>
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Privacy status:</span> Applied (manual masks)</p>
            <p className="text-[10px] text-stone-600"><span className="font-semibold text-stone-500">Evidence status:</span> Attached</p>
            <p className="flex items-center gap-1 pt-0.5 text-[10px] font-semibold text-emerald-700">
              <ShieldCheck size={10} />
              Integrity: Verified
              <span className="rounded bg-stone-200 px-1 py-px text-[8px] font-bold tracking-wider text-stone-500">MOCK</span>
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[9px] font-semibold tracking-wider text-stone-400">OPERATOR OBSERVATION</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-800">
            <Flag size={10} className="text-[#0038A8]" />
            {clip.tagType}
          </p>
          {clip.notes && <p className="text-[9px] italic text-stone-500">"{clip.notes}"</p>}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
        <p className="text-[9px] font-semibold tracking-wider text-stone-400">EVIDENCE LINK &amp; STORAGE</p>
        <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-stone-700">
          <HardDrive size={9} />
          {clip.storageUrl}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
            <Link2 size={8} />
            {clip.incident.id}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
            <Siren size={8} />
            CCTV-Reported
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${status.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>
      </Modal>
      {redactOpen && (
        <RedactionModal
          clip={{ id: clip.id }}
          onClose={() => setRedactOpen(false)}
          onApply={() => {
            setRedactOpen(false);
            addEvidenceActivity({ action: "Redacted", clipId: clip.id, incidentId: clip.incident.id, operator: clip.operator });
          }}
        />
      )}
      {exportOpen && (
        <ExportEvidenceModal
          clipId={clip.id}
          incidentId={clip.incident.id}
          operator={clip.operator}
          subtitle={`${clip.cameraName} · ${clip.location}`}
          onClose={() => setExportOpen(false)}
        />
      )}
    </>
  );
}

function EvidenceActivityPanel() {
  const activities = useEvidenceActivities();

  return (
    <div className="mb-6 rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[#0038A8]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#334155]">Evidence Activity</h3>
            <p className="text-[11px] text-[#94A3B8]">Mock audit trail — evidence actions are logged as they happen</p>
          </div>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{activities.length} records</span>
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto px-5 pb-4">
        {activities.map((a) => (
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
        ))}
      </div>
    </div>
  );
}

export default function CctvEventsEvidence({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [archive, setArchive] = useState<ArchiveClip[]>(INITIAL_ARCHIVE);
  const [evidence, setEvidence] = useState<EvidenceClip[]>(INITIAL_EVIDENCE);
  const [bound, setBound] = useState<EvidenceClip | null>(null);
  const [bindTargetId, setBindTargetId] = useState(INITIAL_EVENTS[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [reviewClip, setReviewClip] = useState<EscalatedClip | null>(null);

  const events = INITIAL_EVENTS;

  function extractClip(clip: ArchiveClip) {
    const target = events.find((e) => e.id === bindTargetId) ?? events[0];
    if (!target) {
      flash("No CCTV event available — tag an event in the Surveillance Matrix first");
      return;
    }
    const boundClip: EvidenceClip = {
      id: `EV-CLIP-${String(evidence.length + 1).padStart(2, "0")}`,
      eventId: target.incident.id, camLabel: clip.camLabel, time: clip.time,
      duration: clip.duration, note: `${clip.duration} clip extracted from DVR archive`,
    };
    setArchive((prev) => prev.filter((c) => c.id !== clip.id));
    setEvidence((prev) => [boundClip, ...prev]);
    setBound(boundClip);
    addEvidenceActivity({ action: "Attached", clipId: boundClip.id, incidentId: target.incident.id, operator: operatorName });
    beep("info");
    flash(`${clip.duration} clip extracted from ${clip.camLabel} and bound to incident ${target.incident.id} (${target.id})`);
  }

  const visibleEvents = events.filter((esc) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [esc.id, esc.incident.id, esc.cameraName, esc.cameraId, esc.tagType, esc.incident.status, esc.purok, esc.location, esc.notes ?? "", esc.operator]
      .some((v) => v.toLowerCase().includes(q));
  });

  const totalEvents = events.length;
  const inTriage = events.filter((e) => e.incident.status === "in_triage").length;
  const beyondTriage = events.filter((e) => e.incident.status !== "in_triage").length;

  const kpis = [
    { label: "CCTV EVENTS TRACKED", value: totalEvents, sub: "clips linked to incidents", icon: Camera },
    { label: "PENDING DESK TRIAGE", value: inTriage, sub: "awaiting Desk Officer prioritization", icon: Siren },
    { label: "BEYOND TRIAGE", value: beyondTriage, sub: "advanced by the Desk Officer", icon: Activity },
    { label: "EVIDENCE CLIPS BOUND", value: evidence.length, sub: "permanent DVR attachments", icon: Scissors },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">CCTV Events &amp; Evidence</h1>
              <p className="mt-1 text-sm text-stone-500">
                Event &amp; evidence management workspace — review tagged events, manage evidence clips, and track incident handoff
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-[#0038A8]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0038A8]">
                <User size={12} />
                Operator: {operatorName}
              </span>
              <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
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

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 560 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">CCTV Event Log</h3>
                  <p className="text-[11px] text-[#94A3B8]">Events tagged in the Surveillance Matrix — clip, incident linkage &amp; status</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{visibleEvents.length} events</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500">
                  <Eye size={10} /> Observer only — dispatch handled by Desk Officer
                </span>
              </div>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Search size={13} className="text-stone-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events by ID, incident, camera, category..." className="w-full bg-transparent text-[11px] text-stone-700 placeholder:text-stone-400 focus:outline-none" />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
              {visibleEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <Inbox size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No events match the current search</p>
                </div>
              ) : (
                visibleEvents.map((esc) => {
                  const status = DISPATCH_STATUS[esc.incident.status];
                  const orderIdx = DISPATCH_ORDER.indexOf(esc.incident.status);
                  return (
                    <div key={esc.id} className="rounded-xl border border-stone-200 bg-white p-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1.5 text-[12px] font-bold text-stone-900">
                              <Video size={12} className="text-[#0038A8]" /> {esc.id}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
                              <Flag size={8} /> {esc.tagType}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-600">
                            <Camera size={10} className="text-[#0038A8]" /> {esc.cameraName} · {esc.cameraId} · {esc.location} · {esc.purok}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock size={9} /> Tagged {formatTime(esc.escalatedAt)} · <User size={9} /> by {esc.operator}
                          </p>
                          <ClipTimeline />
                          <ClipTimelineLegend />
                          {esc.notes && (
                            <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                              <p className="text-[9px] font-semibold tracking-wider text-stone-400">OPERATOR NOTES</p>
                              <p className="mt-0.5 text-[10px] italic leading-snug text-stone-600">"{esc.notes}"</p>
                            </div>
                          )}
                          <p className="mt-2 flex items-center gap-1 truncate font-mono text-[9px] text-stone-400">
                            <HardDrive size={9} /> {esc.storageUrl}
                          </p>
                          <button
                            onClick={() => {
                              addEvidenceActivity({ action: "Viewed", clipId: esc.id, incidentId: esc.incident.id, operator: esc.operator });
                              setReviewClip(esc);
                            }}
                            className="mt-2 flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                          >
                            <Play size={11} /> Review Clip
                          </button>
                        </div>

                        <div className="flex flex-col rounded-lg border border-stone-200 bg-stone-50 p-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-bold text-stone-900">{esc.incident.id}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
                              <Siren size={8} /> CCTV-Reported
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-600">
                              Priority {esc.incident.priority} · set by Desk Officer
                            </span>
                          </div>
                          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-stone-500">
                            <MapPin size={9} className="text-[#0038A8]" /> {esc.incident.category} · {esc.incident.purok}
                          </p>
                          <p className="flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock size={9} /> Created {formatTime(esc.incident.createdAt)}
                          </p>
                          <div className="mt-3 rounded-lg border border-white bg-white px-3 py-2.5">
                            <p className="text-[9px] font-semibold tracking-wider text-stone-400">DISPATCH STATUS (READ-ONLY)</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} /> {status.label}
                              </span>
                              {esc.incident.assignedTeam && (
                                <span className="text-[10px] font-medium text-stone-500">{esc.incident.assignedTeam}</span>
                              )}
                            </div>
                            <p className="mt-1 text-[9px] text-stone-400">{status.note}</p>
                            {esc.incident.dispatchNote && (
                              <p className="mt-1.5 text-[9px] italic text-stone-500">"{esc.incident.dispatchNote}"</p>
                            )}
                          </div>
                          <div className="mt-3 flex items-center gap-1">
                            {DISPATCH_ORDER.map((st, i) => {
                              const m = DISPATCH_STATUS[st];
                              const done = i <= orderIdx;
                              return (
                                <React.Fragment key={st}>
                                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold transition ${done ? `${m.dot} text-white` : "bg-stone-200 text-stone-400"}`} title={m.label}>
                                    {done ? <CheckCircle2 size={9} /> : i + 1}
                                  </div>
                                  {i < DISPATCH_ORDER.length - 1 && <div className={`h-0.5 flex-1 ${i < orderIdx ? "bg-stone-400" : "bg-stone-200"}`} />}
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <p className="mt-2 flex items-center gap-1 text-[9px] text-stone-400">
                            <Eye size={9} /> Desk Officer owns triage, prioritization, assignment, dispatch, and resolution.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Scissors size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Video DVR &amp; Evidence Clipper</h3>
                  <p className="text-[11px] text-[#94A3B8]">Extract clips &amp; bind as permanent attachments</p>
                </div>
              </div>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-600">{archive.length} clips</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">BIND TARGET</p>
              <select
                value={bindTargetId}
                onChange={(e) => setBindTargetId(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.id} · {e.incident.id} · {e.cameraName}</option>
                ))}
              </select>
              <p className="flex items-center gap-1 text-[9px] text-stone-400">
                <Link2 size={8} />
                Extracted clips attach to this event&apos;s linked incident.
              </p>
              <p className="pt-1 text-[10px] font-semibold tracking-wider text-stone-400">DVR ARCHIVE</p>
              {archive.map((clip) => (
                <div key={clip.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500"><Play size={11} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-stone-900">{clip.camLabel}</p>
                      <p className="flex items-center gap-1 text-[9px] text-stone-400"><Clock size={8} /> {formatTime(clip.time)} · {clip.duration}</p>
                    </div>
                    <button onClick={() => extractClip(clip)} className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white">
                      <Scissors size={10} /> Extract
                    </button>
                  </div>
                </div>
              ))}
              {archive.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-8">
                  <CheckCircle2 size={18} className="mb-1.5 text-emerald-400" />
                  <p className="text-[11px] font-medium text-stone-500">Archive exhausted</p>
                </div>
              )}
              <p className="pt-1 text-[10px] font-semibold tracking-wider text-stone-400">BOUND TO INCIDENT FILES</p>
              {evidence.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-violet-200 bg-violet-50/50 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600"><Paperclip size={11} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-stone-900">{ev.camLabel}</p>
                      <p className="flex items-center gap-1 text-[9px] text-stone-500"><Clock size={8} /> {formatTime(ev.time)} · {ev.duration}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">{ev.eventId}</span>
                  </div>
                  <p className="mt-1 text-[9px] italic text-stone-500">{ev.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <EvidenceActivityPanel />

        <div className="rounded-xl border border-black/5 bg-white px-5 py-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Shield size={16} className="text-[#0038A8]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[#334155]">The Dispatch Boundary</h3>
              <p className="text-[11px] text-[#94A3B8]">Who owns each stage of the incident pipeline</p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2">
              {[
                { icon: Flag, label: "Tag", owner: "CCTV Operator", note: "Manual tag · Surveillance Matrix" },
                { icon: Video, label: "Preserve", owner: "CCTV Operator", note: "Select footage · generate clip" },
                { icon: Download, label: "Review / Export", owner: "CCTV Operator", note: "Review, redact & export evidence" },
                { icon: ArrowRight, label: "Handoff", owner: "To Desk Officer", note: "Pending Desk Officer triage" },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-3 text-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0038A8] text-white"><s.icon size={14} /></span>
                    <span className="mt-1.5 text-[11px] font-bold text-stone-900">{s.label}</span>
                    <span className="text-[9px] font-medium text-[#0038A8]">{s.owner}</span>
                    <span className="mt-0.5 hidden text-[8px] leading-tight text-stone-400 sm:block">{s.note}</span>
                  </div>
                  {i < 3 && <span className="hidden shrink-0 text-stone-300 lg:block">→</span>}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 lg:flex-col">
              <span className="text-[9px] font-bold tracking-widest text-stone-400">HANDOFF</span>
              <span className="text-[#0038A8]">→</span>
            </div>
            <div className="flex flex-1 items-center gap-2">
              {[
                { icon: AlertCircle, label: "Triage", owner: "Desk Officer", note: "Prioritization & queueing" },
                { icon: Car, label: "Dispatch", owner: "Desk Officer", note: "Assigns Barangay Tanod" },
                { icon: MapPin, label: "On Scene", owner: "Tanod", note: "Response at location" },
                { icon: CheckCircle2, label: "Resolved", owner: "Desk Officer", note: "Incident closed" },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-stone-200 bg-stone-50 px-2 py-3 text-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-300 text-stone-600"><s.icon size={14} /></span>
                    <span className="mt-1.5 text-[11px] font-bold text-stone-500">{s.label}</span>
                    <span className="text-[9px] font-medium text-stone-400">{s.owner}</span>
                    <span className="mt-0.5 hidden text-[8px] leading-tight text-stone-400 sm:block">{s.note}</span>
                  </div>
                  {i < 3 && <span className="hidden shrink-0 text-stone-300 lg:block">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-700">
              The CCTV Operator tags events in the Surveillance Matrix and manages evidence here, but triage, prioritization, and dispatch are handled <span className="font-semibold">exclusively</span> by the Desk Officer.
            </p>
          </div>
        </div>
      </main>

      {bound && (
        <ConfirmModal type="success" title="Evidence Clip Bound"
          message={`${bound.duration} video clip extracted from ${bound.camLabel} and bound as a permanent digital attachment to incident ${bound.eventId}.`}
          onClose={() => setBound(null)} />
      )}

      {reviewClip && <ClipReviewModal clip={reviewClip} onClose={() => setReviewClip(null)} />}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
