import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Camera,
  Play,
  Pause,
  Eye,
  Users,
  Car,
  TrafficCone,
  AlertTriangle,
  Clock,
  MapPin,
  Link2,
  Shield,
  CheckCircle2,
  X,
  Radio,
  HardDrive,
  Info,
  ArrowRight,
  Scissors,
  Timer,
  Flag,
  Siren,
  Sparkles,
  Search,
  User,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";
import { INCIDENT_PRIORITIES, PRIORITY_META, type IncidentPriority } from "../constants/severity";

interface Camera {
  id: string;
  name: string;
  location: string;
  purok: string;
}

type TagType = "Suspicious Behavior" | "Unusual Crowd" | "Road Blockage" | "Other";
type DispatchStatus = "in_triage" | "dispatched" | "on_scene" | "resolved";

interface IncidentRecord {
  id: string;
  source: "CCTV-Reported";
  priority: IncidentPriority;
  category: string;
  status: DispatchStatus;
  purok: string;
  createdAt: string;
  assignedTeam?: string;
  dispatchTime?: string;
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
  preRollSec: number;
  postRollSec: number;
  storageUrl: string;
  operator: string;
  incident: IncidentRecord;
}

const CAMERAS: Camera[] = [
  { id: "CAM-GATE-01", name: "Main Gate", location: "Entrance Gate", purok: "Purok 1" },
  { id: "CAM-PLAZA-02", name: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2" },
  { id: "CAM-MARKET-03", name: "Public Market", location: "Market Strip", purok: "Purok 6" },
  { id: "CAM-CHAPEL-04", name: "Chapel Area", location: "Chapel Approach", purok: "Purok 5" },
  { id: "CAM-ROAD-05", name: "Crossing Road", location: "Purok Crossing", purok: "Purok 3" },
];

const TAG_TYPES: { key: TagType; icon: typeof Eye; hint: string }[] = [
  { key: "Suspicious Behavior", icon: Eye, hint: "Loitering, stalking, suspicious movement" },
  { key: "Unusual Crowd", icon: Users, hint: "Rapid gathering, escalating altercation" },
  { key: "Road Blockage", icon: TrafficCone, hint: "Stalled vehicle, obstruction, debris" },
  { key: "Other", icon: AlertTriangle, hint: "Anything else worth flagging" },
];

const DISPATCH_STATUS: Record<DispatchStatus, { label: string; badge: string; dot: string; note: string; owner: string }> = {
  in_triage: { label: "In Desk Officer Triage", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", note: "Awaiting triage, prioritization & dispatch decision", owner: "Barangay Desk Officer" },
  dispatched: { label: "Tanod Dispatched", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", note: "Response team assigned by Desk Officer", owner: "Barangay Desk Officer" },
  on_scene: { label: "Tanod On Scene", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400", note: "Responding unit physically at the location", owner: "Barangay Desk Officer" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", note: "Incident closed by the Desk Officer", owner: "Barangay Desk Officer" },
};

const DISPATCH_ORDER: DispatchStatus[] = ["in_triage", "dispatched", "on_scene", "resolved"];

const TEAMS = ["Team Alpha", "Team Bravo", "Team Charlie", "Team Delta", "Team Echo"];

const INITIAL_ESCALATIONS: EscalatedClip[] = [
  {
    id: "CLIP-2026-0004",
    cameraId: "CAM-MARKET-03",
    cameraName: "Public Market",
    location: "Market Strip",
    purok: "Purok 6",
    tagType: "Unusual Crowd",
    notes: "Rapid gathering outside the wet market stalls. Individuals appear agitated.",
    escalatedAt: "2026-07-20T10:05:00",
    clipStart: "2026-07-20T10:04:30",
    clipEnd: "2026-07-20T10:05:10",
    durationSec: 40,
    preRollSec: 30,
    postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0004.mp4",
    operator: "CO-01",
    incident: {
      id: "INC-2072",
      source: "CCTV-Reported",
      priority: "Medium",
      category: "Unusual Crowd",
      status: "in_triage",
      purok: "Purok 6",
      createdAt: "2026-07-20T10:05:01",
    },
  },
  {
    id: "CLIP-2026-0003",
    cameraId: "CAM-ROAD-05",
    cameraName: "Crossing Road",
    location: "Purok Crossing",
    purok: "Purok 3",
    tagType: "Road Blockage",
    notes: "Vehicle stalled across the crossing, blocking the main lane in both directions.",
    escalatedAt: "2026-07-20T09:40:00",
    clipStart: "2026-07-20T09:39:30",
    clipEnd: "2026-07-20T09:40:10",
    durationSec: 40,
    preRollSec: 30,
    postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0003.mp4",
    operator: "CO-01",
    incident: {
      id: "INC-2071",
      source: "CCTV-Reported",
      priority: "Medium",
      category: "Road Blockage",
      status: "dispatched",
      purok: "Purok 3",
      createdAt: "2026-07-20T09:40:02",
      assignedTeam: "Team Alpha",
      dispatchTime: "2026-07-20T09:44:00",
      dispatchNote: "Clearing assist requested for stalled vehicle.",
    },
  },
  {
    id: "CLIP-2026-0002",
    cameraId: "CAM-CHAPEL-04",
    cameraName: "Chapel Area",
    location: "Chapel Approach",
    purok: "Purok 5",
    tagType: "Suspicious Behavior",
    notes: "Individual lingering near parked vehicles for an extended period after night service.",
    escalatedAt: "2026-07-19T18:50:00",
    clipStart: "2026-07-19T18:49:30",
    clipEnd: "2026-07-19T18:50:10",
    durationSec: 40,
    preRollSec: 30,
    postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0002.mp4",
    operator: "CO-01",
    incident: {
      id: "INC-2069",
      source: "CCTV-Reported",
      priority: "Medium",
      category: "Suspicious Behavior",
      status: "on_scene",
      purok: "Purok 5",
      createdAt: "2026-07-19T18:50:02",
      assignedTeam: "Team Bravo",
      dispatchTime: "2026-07-19T18:56:00",
      dispatchNote: "Loitering verified on scene. Party identified and advised.",
    },
  },
  {
    id: "CLIP-2026-0001",
    cameraId: "CAM-PLAZA-02",
    cameraName: "Plaza & Court",
    location: "Barangay Plaza",
    purok: "Purok 2",
    tagType: "Other",
    notes: "Unattended package left near the court entrance.",
    escalatedAt: "2026-07-19T16:05:00",
    clipStart: "2026-07-19T16:04:30",
    clipEnd: "2026-07-19T16:05:10",
    durationSec: 40,
    preRollSec: 30,
    postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0001.mp4",
    operator: "CO-01",
    incident: {
      id: "INC-2065",
      source: "CCTV-Reported",
      priority: "Medium",
      category: "Other",
      status: "resolved",
      purok: "Purok 2",
      createdAt: "2026-07-19T16:05:02",
      assignedTeam: "Team Delta",
      dispatchTime: "2026-07-19T16:10:00",
      dispatchNote: "Package inspected and cleared. No hazard found.",
    },
  },
];

function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
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

function ClipTimeline() {
  return (
    <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div className="absolute inset-y-0 left-0 w-[75%] bg-amber-400/80" />
      <div className="absolute inset-y-0 left-[75%] w-[25%] bg-emerald-500/90" />
      <div className="absolute -top-[3px] left-[75%] h-[14px] w-0.5 bg-stone-800" />
    </div>
  );
}

function ClipTimelineLegend() {
  return (
    <div className="mt-1 flex items-center justify-between text-[9px] font-medium text-stone-400">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-3 rounded-full bg-amber-400" />
        30s pre-roll
      </span>
      <span className="flex items-center gap-1 text-stone-600">
        <Scissors size={9} />
        tag moment
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-3 rounded-full bg-emerald-500" />
        10s post-roll
      </span>
    </div>
  );
}

function TagModal({ camera, now, onClose, onConfirm }: { camera: Camera; now: Date; onClose: () => void; onConfirm: (tagType: TagType, notes: string, priority: IncidentPriority) => void }) {
  const [tagType, setTagType] = useState<TagType | null>(null);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<IncidentPriority>("Medium");

  return (
    <Modal
      onClose={onClose}
      title="Tag Threat on Live Feed"
      subtitle={`${camera.name} · ${camera.location} · ${camera.purok}`}
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
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
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
                  tagType === key
                    ? "border-[#0038A8] bg-[#0038A8]/5"
                    : "border-stone-200 bg-white hover:bg-stone-50"
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
            AUTOMATED CLIPPING — 40-SECOND CLIP
          </p>
          <ClipTimeline />
          <ClipTimelineLegend />
          <p className="mt-1.5 text-[9px] leading-relaxed text-stone-400">
            Confirming instantly logs the timestamp and camera ID, then generates a 40-second clip:
            30-second pre-roll buffer (context before the tag) + 10-second post-roll segment. The clip is saved to
            Supabase Storage and its metadata logged to <span className="font-mono">cctv_clips</span>.
          </p>
        </div>
    </Modal>
  );
}

function RoutingModal({ clip, incident, onComplete }: { clip: EscalatedClip; incident: IncidentRecord; onComplete: () => void }) {
  const steps = [
    `Generating 40-second clip (${clip.preRollSec}s pre-roll + ${clip.postRollSec}s post-roll)`,
    `Saving clip to Supabase Storage & logging ${clip.id} in cctv_clips`,
    `Creating official incident ${incident.id} — source "CCTV-Reported", priority ${incident.priority}`,
    `Mapping camera location to ${incident.purok} · ${clip.location}`,
    `Attaching clip ${clip.id} as linked evidence (storage_url)`,
    `Pushing ${incident.id} into Desk Officer triage queue`,
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
      subtitle={`${clip.id} → ${incident.id}`}
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
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                active ? "border-[#0038A8]/30 bg-[#0038A8]/5" : done ? "border-emerald-100 bg-emerald-50/50" : "border-stone-100 bg-white"
              }`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-emerald-500 text-white" : active ? "bg-[#0038A8] text-white" : "bg-stone-200"
                }`}>
                  {done ? <CheckCircle2 size={9} /> : <span className="h-1.5 w-1.5 rounded-full bg-white/70" />}
                </span>
                <span className={`text-[11px] leading-snug ${done ? "text-stone-500" : active ? "font-medium text-stone-900" : "text-stone-400"}`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
    </Modal>
  );
}

function ClipReviewModal({ clip, onClose }: { clip: EscalatedClip; onClose: () => void }) {
  const [currentSec, setCurrentSec] = useState(0);
  const [playing, setPlaying] = useState(false);
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

  return (
    <Modal
      onClose={onClose}
      title={`Clip Review — ${clip.id}`}
      subtitle={`${clip.cameraName} · ${clip.location} · ${clip.purok}`}
      icon={<Video size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="xl"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <CheckCircle2 size={13} />
            Done
          </button>
        </div>
      }
    >
      <div className="relative mb-3 h-48 w-full overflow-hidden rounded-xl border border-black/20 bg-black sm:h-56">
          <LiveFeedFrame />
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
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">CLIP SEGMENT</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-800">
              {formatTime(clip.clipStart)} → {formatTime(clip.clipEnd)}
            </p>
            <p className="text-[9px] text-stone-400">
              {clip.preRollSec}s pre-roll · {clip.postRollSec}s post-roll
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
            <p className="text-[9px] font-semibold tracking-wider text-stone-400">TAG &amp; CONTEXT</p>
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
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${PRIORITY_META[clip.incident.priority].chip}`}>
              Priority {clip.incident.priority}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${status.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
</div>
      </div>
    </Modal>
  );
}

export default function EscalatedClipsDispatches({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [escalations, setEscalations] = useState<EscalatedClip[]>(INITIAL_ESCALATIONS);
  const clipSeqRef = useRef(INITIAL_ESCALATIONS.length + 1);
  const incidentSeqRef = useRef(2073);

  const [now, setNow] = useState(new Date());
  const [feedCamera, setFeedCamera] = useState<Camera>(CAMERAS[0]);
  const [tagOpen, setTagOpen] = useState(false);
  const [routing, setRouting] = useState<{ clip: EscalatedClip; incident: IncidentRecord } | null>(null);
  const [routingDone, setRoutingDone] = useState<EscalatedClip | null>(null);
  const [reviewClip, setReviewClip] = useState<EscalatedClip | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const teamIdxRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function confirmTag(tagType: TagType, notes: string, priority: IncidentPriority = "Medium") {
    const escalatedAt = new Date();
    const start = new Date(escalatedAt.getTime() - 30 * 1000);
    const end = new Date(escalatedAt.getTime() + 10 * 1000);
    const clipId = `CLIP-2026-${String(clipSeqRef.current++).padStart(4, "0")}`;
    const incidentId = `INC-${incidentSeqRef.current++}`;

    const clip: EscalatedClip = {
      id: clipId,
      cameraId: feedCamera.id,
      cameraName: feedCamera.name,
      location: feedCamera.location,
      purok: feedCamera.purok,
      tagType,
      notes: notes || undefined,
      escalatedAt: escalatedAt.toISOString(),
      clipStart: start.toISOString(),
      clipEnd: end.toISOString(),
      durationSec: 40,
      preRollSec: 30,
      postRollSec: 10,
      storageUrl: `https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/${clipId}.mp4`,
      operator: operatorName,
      incident: {
        id: incidentId,
        source: "CCTV-Reported",
        priority,
        category: tagType,
        status: "in_triage",
        purok: feedCamera.purok,
        createdAt: escalatedAt.toISOString(),
      },
    };

    setTagOpen(false);
    setRouting({ clip, incident: clip.incident });
    beep("critical");
    flash(`Tag confirmed by ${operatorName} on ${feedCamera.name} — routing ${clipId} (${priority}) to Desk Officer triage`);
  }

  function advanceDispatch() {
    const next = escalations.find((e) => e.incident.status !== "resolved");
    if (!next) {
      flash("All incidents are resolved — nothing left to advance");
      return;
    }
    const fromIdx = DISPATCH_ORDER.indexOf(next.incident.status);
    if (fromIdx >= DISPATCH_ORDER.length - 1) return;
    const to = DISPATCH_ORDER[fromIdx + 1];
    const updated = { ...next.incident, status: to };
    if (to === "dispatched") {
      const team = TEAMS[teamIdxRef.current++ % TEAMS.length];
      updated.assignedTeam = team;
      updated.dispatchTime = now.toISOString();
      updated.dispatchNote = `${team} dispatched by the Desk Officer for ${updated.category} response.`;
    } else if (to === "on_scene") {
      updated.dispatchNote = `${updated.assignedTeam ?? "Responding unit"} on scene — situation verified.`;
    } else if (to === "resolved") {
      updated.dispatchNote = "Incident closed by the Desk Officer after verification.";
    }
    setEscalations((prev) => prev.map((e) => (e.id === next.id ? { ...e, incident: updated } : e)));
    beep("info");
    const label = DISPATCH_STATUS[to].label;
    setNotice(`${next.incident.id} → ${label}${updated.assignedTeam ? ` · ${updated.assignedTeam}` : ""}`);
    flash(`Dispatch sync — Desk Officer advanced ${next.incident.id} to "${label}"`);
  }

  function completeRouting() {
    if (!routing) return;
    const clip = routing.clip;
    setEscalations((prev) => [clip, ...prev]);
    setRouting(null);
    setRoutingDone(clip);
  }

  const matches = (esc: EscalatedClip) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
      esc.id,
      esc.incident.id,
      esc.cameraName,
      esc.cameraId,
      esc.tagType,
      esc.incident.category,
      esc.incident.status,
      esc.incident.assignedTeam ?? "",
      esc.purok,
      esc.notes ?? "",
      esc.operator,
    ].some((v) => v.toLowerCase().includes(q));
  };

  const visibleEscalations = escalations.filter(matches);

  const totalClips = escalations.length;
  const inTriage = escalations.filter((e) => e.incident.status === "in_triage").length;
  const dispatched = escalations.filter((e) => e.incident.status !== "in_triage").length;

  const kpis = [
    { label: "ESCALATED CLIPS", value: totalClips, sub: "manually tagged from live feed", icon: Video },
    { label: "INCIDENTS CREATED", value: totalClips, sub: "auto-classified CCTV-Reported", icon: Siren },
    { label: "IN DESK OFFICER TRIAGE", value: inTriage, sub: "awaiting prioritization", icon: Radio },
    { label: "TANOD DISPATCHED", value: dispatched, sub: "handled by Desk Officer", icon: Car },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Escalated Clips &amp; Dispatches</h1>
              <p className="mt-1 text-sm text-stone-500">
                Clip-to-incident tracker for manually escalated CCTV events
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0038A8]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0038A8]">
                <User size={12} />
                Operator: {operatorName}
              </span>
              <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0038A8]/5 px-3 py-1.5 text-[11px] font-medium text-[#0038A8]">
                <Eye size={12} />
                Operator view — dispatch handled by Desk Officer
              </span>
              <button
                onClick={advanceDispatch}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <RefreshCw size={12} />
                Sync Desk Officer Dispatch
              </button>
            </div>
          </div>
        </header>

        {notice && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <Bell size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-emerald-800">Dispatch feedback received</p>
              <p className="text-[10px] text-emerald-700">{notice}</p>
            </div>
            <button onClick={() => setNotice(null)} className="shrink-0 rounded-md p-1 text-emerald-500 hover:bg-emerald-100">
              <X size={13} />
            </button>
          </div>
        )}

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

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Surveillance Matrix — Live Tag</h3>
                  <p className="text-[11px] text-[#94A3B8]">Tag a threat directly on the live stream</p>
                </div>
              </div>
            </div>

            <div className="px-5">
              <div className="relative h-40 w-full overflow-hidden rounded-xl border border-black/20 bg-black">
                <LiveFeedFrame />
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    LIVE
                  </span>
                  <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">
                    {feedCamera.name}
                  </span>
                </div>
                <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                  {now.toLocaleTimeString("en-US", { hour12: false })}
                </div>
                <button
                  onClick={() => setTagOpen(true)}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white shadow-lg transition hover:bg-rose-700"
                >
                  <Flag size={12} />
                  Tag
                </button>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">FEED CAMERA</p>
                <select
                  value={feedCamera.id}
                  onChange={(e) => setFeedCamera(CAMERAS.find((c) => c.id === e.target.value) ?? CAMERAS[0])}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                >
                  {CAMERAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.location} · {c.purok}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Sparkles size={10} />
                AUTOMATED ROUTING ON CONFIRM
              </p>
              {[
                { icon: Siren, text: `Creates incident "${incidentSeqRef.current}" classified as CCTV-Reported` },
                { icon: MapPin, text: `Tags location from ${feedCamera.id} registered position` },
                { icon: Video, text: "Attaches the 40-second clip as linked evidence" },
                { icon: Radio, text: "Pushes incident into Desk Officer triage queue" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0038A8]/10 text-[#0038A8]">
                    <Icon size={11} />
                  </span>
                  <span className="text-[10px] leading-snug text-stone-600">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Escalated Clips → Incidents</h3>
                  <p className="text-[11px] text-[#94A3B8]">Every manual tag, alongside the official incident it generated</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5">
                  <Search size={12} className="text-stone-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search clip, incident, camera, status..."
                    className="w-40 bg-transparent text-[11px] text-stone-700 placeholder:text-stone-400 focus:outline-none sm:w-52"
                  />
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
                  {visibleEscalations.length} escalated
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5">
              {visibleEscalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <Search size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No escalated clips match the current search</p>
                  <p className="text-[10px] text-stone-400">Try a different keyword</p>
                </div>
              ) : (
                visibleEscalations.map((esc) => {
                  const status = DISPATCH_STATUS[esc.incident.status];
                  const orderIdx = DISPATCH_ORDER.indexOf(esc.incident.status);
                  return (
                    <div key={esc.id} className="rounded-xl border border-stone-200 bg-white p-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1.5 text-[12px] font-bold text-stone-900">
                              <Video size={12} className="text-[#0038A8]" />
                              {esc.id}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
                              <Flag size={8} />
                              {esc.tagType}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-600">
                            <Camera size={10} className="text-[#0038A8]" />
                            {esc.cameraName} · {esc.cameraId} · {esc.location} · {esc.purok}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock size={9} />
                            Tagged {formatTime(esc.escalatedAt)}
                            <span className="mx-0.5">&middot;</span>
                            <User size={9} />
                            by {esc.operator}
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
                            <HardDrive size={9} />
                            {esc.storageUrl}
                          </p>

                          <button
                            onClick={() => setReviewClip(esc)}
                            className="mt-2 flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                          >
                            <Play size={11} />
                            Review Clip
                          </button>
                        </div>

                        <div className="flex flex-col rounded-lg border border-stone-200 bg-stone-50 p-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-bold text-stone-900">{esc.incident.id}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
                              <Siren size={8} />
                              CCTV-Reported
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${PRIORITY_META[esc.incident.priority].chip}`}>
                              <Shield size={8} />
                              Priority {esc.incident.priority}
                            </span>
                          </div>

                          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-stone-500">
                            <MapPin size={9} className="text-[#0038A8]" />
                            {esc.incident.category} · {esc.incident.purok}
                          </p>
                          <p className="flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock size={9} />
                            Created {formatTime(esc.incident.createdAt)}
                          </p>

                          <div className="mt-3 rounded-lg border border-white bg-white px-3 py-2.5">
                            <p className="text-[9px] font-semibold tracking-wider text-stone-400">DISPATCH STATUS</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                                {status.label}
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
                                  <div
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold transition ${
                                      done ? `${m.dot} text-white` : "bg-stone-200 text-stone-400"
                                    }`}
                                    title={m.label}
                                  >
                                    {done ? <CheckCircle2 size={9} /> : i + 1}
                                  </div>
                                  {i < DISPATCH_ORDER.length - 1 && (
                                    <div className={`h-0.5 flex-1 ${i < orderIdx ? "bg-stone-400" : "bg-stone-200"}`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          <p className="mt-2 flex items-center gap-1 text-[9px] text-stone-400">
                            <Eye size={9} />
                            Triage &amp; dispatch owned by {status.owner} — operator observes only
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-white px-5 py-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">The Dispatch Boundary</h3>
                <p className="text-[11px] text-[#94A3B8]">Handoff confirmation — who owns each stage of the pipeline</p>
              </div>
            </div>
            <span className="hidden items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500 sm:flex">
              <Eye size={10} />
              Operator: observation only
            </span>
          </div>

          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2">
              {[
                { icon: Flag, label: "Tag", owner: "CCTV Operator", note: "Manual threat tag on live feed" },
                { icon: Video, label: "Clip", owner: "System", note: "40s auto-clip · pre + post roll" },
                { icon: Siren, label: "Incident", owner: "System", note: "CCTV-Reported · Medium · mapped" },
                { icon: Link2, label: "Evidence", owner: "System", note: "Clip attached to incident" },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-3 text-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0038A8] text-white">
                      <s.icon size={14} />
                    </span>
                    <span className="mt-1.5 text-[11px] font-bold text-stone-900">{s.label}</span>
                    <span className="text-[9px] font-medium text-[#0038A8]">{s.owner}</span>
                    <span className="mt-0.5 hidden text-[8px] leading-tight text-stone-400 sm:block">{s.note}</span>
                  </div>
                  {i < 3 && <ArrowRight size={14} className="hidden shrink-0 text-stone-300 lg:block" />}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 lg:flex-col">
              <span className="text-[9px] font-bold tracking-widest text-stone-400">HANDOFF</span>
              <ArrowRight size={14} className="text-[#0038A8]" />
            </div>

            <div className="flex flex-1 items-center gap-2">
              {[
                { icon: Radio, label: "Triage", owner: "Desk Officer", note: "Prioritization & queueing" },
                { icon: Car, label: "Dispatch", owner: "Desk Officer", note: "Assigns Barangay Tanod" },
                { icon: MapPin, label: "On Scene", owner: "Tanod", note: "Response at location" },
                { icon: CheckCircle2, label: "Resolved", owner: "Desk Officer", note: "Incident closed" },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-stone-200 bg-stone-50 px-2 py-3 text-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-300 text-stone-600">
                      <s.icon size={14} />
                    </span>
                    <span className="mt-1.5 text-[11px] font-bold text-stone-500">{s.label}</span>
                    <span className="text-[9px] font-medium text-stone-400">{s.owner}</span>
                    <span className="mt-0.5 hidden text-[8px] leading-tight text-stone-400 sm:block">{s.note}</span>
                  </div>
                  {i < 3 && <ArrowRight size={14} className="hidden shrink-0 text-stone-300 lg:block" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center">
            <Info size={13} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-700">
              The CCTV Operator can review every escalated clip and its linked incident, but the actual triage,
              prioritization, and dispatch of a Barangay Tanod is handled <span className="font-semibold">exclusively</span> by the
              Barangay Desk Officer. Dispatch statuses sync back read-only — use <span className="font-semibold">Sync Desk Officer Dispatch</span>
              to simulate the feedback loop and watch statuses advance in real time.
            </p>
          </div>
        </div>
      </main>

      {tagOpen && (
        <TagModal
          camera={feedCamera}
          now={now}
          onClose={() => setTagOpen(false)}
          onConfirm={confirmTag}
        />
      )}

      {routing && (
        <RoutingModal
          clip={routing.clip}
          incident={routing.incident}
          onComplete={completeRouting}
        />
      )}

      {reviewClip && <ClipReviewModal clip={reviewClip} onClose={() => setReviewClip(null)} />}

      {routingDone && (
        <ConfirmModal
          type="success"
          title="Escalation Complete &amp; Routed"
          message={`${routingDone.id} (40s clip) saved to Supabase Storage. Incident ${routingDone.incident.id} was auto-created as CCTV-Reported with priority ${routingDone.incident.priority} at ${routingDone.purok} · ${routingDone.location}. The clip is attached as evidence and the incident is now in the Barangay Desk Officer's triage queue for dispatching.`}
          onClose={() => setRoutingDone(null)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
