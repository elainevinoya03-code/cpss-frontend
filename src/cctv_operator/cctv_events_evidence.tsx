import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Scissors,
  Timer,
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
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";

const DEDUP_MS = 5 * 60 * 1000;

function seedTime(minsAgo: number) {
  return new Date(Date.now() - minsAgo * 60000).toISOString();
}

interface FeedCam {
  id: string;
  name: string;
  location: string;
  coords: string;
  scene: "junction" | "plaza" | "alley" | "market";
}

interface ThreatFlag {
  id: string;
  camId: string;
  category: string;
  severity: string;
  note: string;
  time: string;
  tagged: boolean;
  operator: string;
}

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
  flagId: string;
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
  preRollSec: number;
  postRollSec: number;
  storageUrl: string;
  operator: string;
  incident: IncidentRecord;
}

const TAG_TYPES: { id: string; label: string; desc: string; severity: string; icon: typeof Users }[] = [
  { id: "crowd", label: "Nighttime Crowd Gathering", desc: "Unexpected gathering forming at a closed public area during off-hours", severity: "critical", icon: Users },
  { id: "loitering", label: "Prolonged Loitering", desc: "Sustained loitering inside a dark alley with no visible activity", severity: "warning", icon: Eye },
  { id: "blockage", label: "Road Blockage", desc: "Sudden obstruction or traffic blockage on a main intersection", severity: "critical", icon: TrafficCone },
];

const TAG_TYPES_FORMAL: { key: TagType; icon: typeof Eye; hint: string }[] = [
  { key: "Suspicious Behavior", icon: Eye, hint: "Loitering, stalking, suspicious movement" },
  { key: "Unusual Crowd", icon: Users, hint: "Rapid gathering, escalating altercation" },
  { key: "Road Blockage", icon: TrafficCone, hint: "Stalled vehicle, obstruction, debris" },
  { key: "Other", icon: AlertTriangle, hint: "Anything else worth flagging" },
];

const CAMERAS: FeedCam[] = [
  { id: "SM-GATE-01", name: "Main Gate Intersection", location: "Barangay Main Gate · Purok 1", coords: "11.4821°N, 122.9681°E", scene: "junction" },
  { id: "DB-HALL-01", name: "Barangay Hall Plaza", location: "Hall Frontage · Purok 2", coords: "11.4812°N, 122.9673°E", scene: "plaza" },
  { id: "ALY-07", name: "North Alley Camera", location: "Dark Alley Entry · Purok 3", coords: "11.4801°N, 122.9660°E", scene: "alley" },
  { id: "MRK-04", name: "Market Row Corner", location: "Market Residential Row · Purok 5", coords: "11.4830°N, 122.9695°E", scene: "market" },
];

const MATRIX_CAMERAS: { id: string; name: string; location: string; purok: string }[] = [
  { id: "CAM-GATE-01", name: "Main Gate", location: "Entrance Gate", purok: "Purok 1" },
  { id: "CAM-PLAZA-02", name: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2" },
  { id: "CAM-MARKET-03", name: "Public Market", location: "Market Strip", purok: "Purok 6" },
  { id: "CAM-CHAPEL-04", name: "Chapel Area", location: "Chapel Approach", purok: "Purok 5" },
  { id: "CAM-ROAD-05", name: "Crossing Road", location: "Purok Crossing", purok: "Purok 3" },
];

const INITIAL_FLAGS: ThreatFlag[] = [
  { id: "FLG-1182", camId: "ALY-07", category: "Prolonged Loitering", severity: "warning", note: "Subject lingering near dark alley entrance for ~8 minutes with no visible activity", time: seedTime(2), tagged: true, operator: "CO-01" },
  { id: "FLG-1181", camId: "SM-GATE-01", category: "Road Blockage", severity: "critical", note: "Cargo truck stalled across main gate lane, backing traffic into the intersection", time: seedTime(9), tagged: false, operator: "CO-01" },
  { id: "FLG-1180", camId: "MRK-04", category: "Nighttime Crowd Gathering", severity: "critical", note: "Unexpected crowd forming near closed market row after operating hours", time: seedTime(14.8), tagged: true, operator: "CO-01" },
];

const INITIAL_ARCHIVE: ArchiveClip[] = [
  { id: "ARC-2204", camId: "RDS-03", camLabel: "RDS-03 · Riverside Drive", location: "Riverside Drive · Purok 4", time: "2026-07-20T21:00:00", duration: "60s" },
  { id: "ARC-2203", camId: "ALY-07", camLabel: "ALY-07 · North Alley", location: "Dark Alley Entry · Purok 3", time: "2026-07-20T20:58:00", duration: "60s" },
  { id: "ARC-2202", camId: "PLZ-02", camLabel: "PLZ-02 · Plaza Junction", location: "Plaza Junction · Purok 2", time: "2026-07-20T20:44:00", duration: "60s" },
  { id: "ARC-2201", camId: "MRK-04", camLabel: "MRK-04 · Market Row", location: "Market Residential Row · Purok 5", time: "2026-07-20T20:26:00", duration: "60s" },
  { id: "ARC-2200", camId: "SM-GATE-01", camLabel: "SM-GATE-01 · Main Gate", location: "Barangay Main Gate · Purok 1", time: "2026-07-20T19:55:00", duration: "60s" },
];

const INITIAL_EVIDENCE: EvidenceClip[] = [
  { id: "EV-CLIP-01", flagId: "FLG-1182", camLabel: "ALY-07 · North Alley", time: "2026-07-20T21:10:00", duration: "60s", note: "Full minute of subject lingering — bound as permanent DVR attachment" },
];

const DISPATCH_STATUS: Record<DispatchStatus, { label: string; badge: string; dot: string; note: string; owner: string }> = {
  in_triage: { label: "In Desk Officer Triage", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", note: "Awaiting triage, prioritization & dispatch decision", owner: "Barangay Desk Officer" },
  dispatched: { label: "Tanod Dispatched", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", note: "Response team assigned by Desk Officer", owner: "Barangay Desk Officer" },
  on_scene: { label: "Tanod On Scene", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400", note: "Responding unit physically at the location", owner: "Barangay Desk Officer" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", note: "Incident closed by the Desk Officer", owner: "Barangay Desk Officer" },
};

const DISPATCH_ORDER: DispatchStatus[] = ["in_triage", "dispatched", "on_scene", "resolved"];

const INITIAL_ESCALATIONS: EscalatedClip[] = [
  {
    id: "CLIP-2026-0004", cameraId: "CAM-MARKET-03", cameraName: "Public Market", location: "Market Strip", purok: "Purok 6",
    tagType: "Unusual Crowd", notes: "Rapid gathering outside the wet market stalls. Individuals appear agitated.",
    escalatedAt: "2026-07-20T10:05:00", clipStart: "2026-07-20T10:04:30", clipEnd: "2026-07-20T10:05:10",
    durationSec: 40, preRollSec: 30, postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0004.mp4",
    operator: "CO-01",
    incident: { id: "INC-2072", source: "CCTV-Reported", priority: "Medium", category: "Unusual Crowd", status: "in_triage", purok: "Purok 6", createdAt: "2026-07-20T10:05:01" },
  },
  {
    id: "CLIP-2026-0003", cameraId: "CAM-ROAD-05", cameraName: "Crossing Road", location: "Purok Crossing", purok: "Purok 3",
    tagType: "Road Blockage", notes: "Vehicle stalled across the crossing, blocking the main lane in both directions.",
    escalatedAt: "2026-07-20T09:40:00", clipStart: "2026-07-20T09:39:30", clipEnd: "2026-07-20T09:40:10",
    durationSec: 40, preRollSec: 30, postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0003.mp4",
    operator: "CO-01",
    incident: { id: "INC-2071", source: "CCTV-Reported", priority: "Medium", category: "Road Blockage", status: "dispatched", purok: "Purok 3", createdAt: "2026-07-20T09:40:02", assignedTeam: "Team Alpha", dispatchNote: "Clearing assist requested for stalled vehicle." },
  },
  {
    id: "CLIP-2026-0002", cameraId: "CAM-CHAPEL-04", cameraName: "Chapel Area", location: "Chapel Approach", purok: "Purok 5",
    tagType: "Suspicious Behavior", notes: "Individual lingering near parked vehicles for an extended period after night service.",
    escalatedAt: "2026-07-19T18:50:00", clipStart: "2026-07-19T18:49:30", clipEnd: "2026-07-19T18:50:10",
    durationSec: 40, preRollSec: 30, postRollSec: 10,
    storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0002.mp4",
    operator: "CO-01",
    incident: { id: "INC-2069", source: "CCTV-Reported", priority: "Medium", category: "Suspicious Behavior", status: "on_scene", purok: "Purok 5", createdAt: "2026-07-19T18:50:02", assignedTeam: "Team Bravo", dispatchNote: "Loitering verified on scene. Party identified and advised." },
  },
  {
    id: "CLIP-2026-0001", cameraId: "CAM-PLAZA-02", cameraName: "Plaza & Court", location: "Barangay Plaza", purok: "Purok 2",
    tagType: "Other", notes: "Unattended package left near the court entrance.",
    escalatedAt: "2026-07-19T16:05:00", clipStart: "2026-07-19T16:04:30", clipEnd: "2026-07-19T16:05:10",
    durationSec: 40, preRollSec: 30, postRollSec: 10,
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

function FeedScene({ scene }: { scene: FeedCam["scene"] }) {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="200" height="112" fill="#17150f" />
      <g stroke="#26231b" strokeWidth="0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 25} y1="0" x2={i * 25} y2="112" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 24} x2="200" y2={i * 24} />
        ))}
      </g>
      {scene === "junction" && (
        <g>
          <path d="M100 0 L100 112" stroke="#3F4A63" strokeWidth="16" />
          <path d="M0 56 L200 56" stroke="#3F4A63" strokeWidth="16" />
          <path d="M96 0 L96 52 M104 60 L104 112" stroke="#64748B" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M0 52 L94 52 M106 60 L200 60" stroke="#64748B" strokeWidth="2" strokeDasharray="4 4" />
          <rect x="70" y="30" width="26" height="14" rx="2" fill="#3d3a6b" opacity="0.9" />
          <rect x="112" y="66" width="24" height="13" rx="2" fill="#5b3a3a" opacity="0.9" />
          <circle cx="128" cy="24" r="2.5" fill="#FCD116" opacity="0.9" />
          <circle cx="42" cy="88" r="2.5" fill="#FCD116" opacity="0.9" />
        </g>
      )}
      {scene === "plaza" && (
        <g>
          <rect x="18" y="18" width="52" height="40" rx="2" fill="#2a2620" stroke="#44506B" />
          <rect x="26" y="24" width="36" height="28" fill="#231f18" />
          <rect x="30" y="44" width="14" height="8" fill="#3a4a3a" />
          <circle cx="120" cy="36" r="10" fill="#2a3528" />
          <circle cx="146" cy="30" r="7" fill="#283327" />
          <circle cx="104" cy="30" r="6" fill="#283327" />
          <circle cx="132" cy="70" r="2" fill="#FCD116" opacity="0.9" />
          <path d="M60 96 q8 -8 16 0 q8 8 16 0 q8 -8 16 0" stroke="#444038" strokeWidth="3" fill="none" />
        </g>
      )}
      {scene === "alley" && (
        <g>
          <path d="M74 112 L84 0 L116 0 L126 112 Z" fill="#12110c" />
          <rect x="60" y="0" width="14" height="112" fill="#241f17" />
          <rect x="126" y="0" width="14" height="112" fill="#241f17" />
          <rect x="78" y="18" width="6" height="30" fill="#332c1f" />
          <rect x="116" y="30" width="6" height="34" fill="#332c1f" />
          <circle cx="100" cy="78" r="4" fill="#1e1b14" stroke="#44506B" strokeWidth="1" />
          <circle cx="106" cy="86" r="3" fill="#44506B" />
          <circle cx="92" cy="46" r="1.5" fill="#FCD116" opacity="0.6" />
        </g>
      )}
      {scene === "market" && (
        <g>
          <rect x="0" y="0" width="200" height="112" fill="#191610" />
          <path d="M0 40 L200 40" stroke="#3F4A63" strokeWidth="14" />
          <path d="M0 36 L0 44 M25 36 L25 44 M50 36 L50 44 M75 36 L75 44 M100 36 L100 44 M125 36 L125 44 M150 36 L150 44 M175 36 L175 44 M200 36 L200 44" stroke="#64748B" strokeWidth="1.5" />
          {[24, 74, 124, 174].map((x) => (
            <path key={x} d={`M${x - 14} 34 L${x} 6 L${x + 14} 34 Z`} fill="#2c281f" stroke="#44506B" />
          ))}
          <circle cx="40" cy="78" r="2" fill="#FCD116" opacity="0.9" />
          <circle cx="150" cy="92" r="2" fill="#FCD116" opacity="0.9" />
        </g>
      )}
    </svg>
  );
}

function FeedView({ cam, flagged, onFlag }: { cam: FeedCam; flagged: boolean; onFlag: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-black/20 bg-[#151311]">
      <FeedScene scene={cam.scene} />
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/40 via-transparent to-black/60 p-3">
        <div className="flex items-start justify-between">
          <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            LIVE
          </span>
          {flagged && (
            <span className="flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-black">
              <Flag size={9} />
              TAGGED
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 rounded bg-black/60 px-2 py-1.5 backdrop-blur-sm">
            <p className="truncate text-[11px] font-bold text-white">{cam.id} · {cam.name}</p>
            <p className="truncate text-[9px] text-white/60">{cam.location}</p>
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-white/50">
              <MapPin size={8} />
              {cam.coords}
            </p>
          </div>
          <button
            onClick={onFlag}
            disabled={flagged}
            className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-bold text-white transition ${
              flagged ? "cursor-not-allowed bg-amber-500" : "bg-[#0038A8] hover:bg-[#002A8C]"
            }`}
          >
            {flagged ? <CheckCircle2 size={11} /> : <Flag size={11} />}
            {flagged ? "Tagged" : "Tag"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TagAnomalyModal({ cam, onClose, onTag }: { cam: FeedCam; onClose: () => void; onTag: (t: (typeof TAG_TYPES)[number], note: string) => void }) {
  const [selected, setSelected] = useState(TAG_TYPES[0]);
  const [note, setNote] = useState("");

  return (
    <Modal
      onClose={onClose}
      title="Tag Anomaly"
      subtitle={`${cam.id} · ${cam.name}`}
      icon={<Flag size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onTag(selected, note.trim())}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Flag size={13} />
            Confirm Tag
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="mb-1 flex items-center gap-1 font-mono text-[10px] text-stone-500">
            <MapPin size={9} />
            {cam.coords}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-stone-400">
            <Clock size={9} />
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
            <span className="mx-0.5">&middot;</span>
            <Timer size={9} />
            timestamp auto-captured
          </p>
        </div>

        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">THREAT CATEGORY</p>
        <div className="mb-4 space-y-2">
          {TAG_TYPES.map((t) => {
            const Icon = t.icon;
            const active = selected.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition ${
                  active ? "border-[#0038A8]/40 bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
                  <Icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-stone-900">{t.label}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${SEVERITY_MAP[t.severity].badge}`}>
                      {SEVERITY_MAP[t.severity].label}
                    </span>
                  </span>
                  <span className="block text-[10px] leading-snug text-stone-500">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional operator note — describe the anomaly observed..."
          className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
        />

        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[9px] leading-relaxed text-stone-400">
            Tagging creates an evidence record and generates a clip. The incident is created as CCTV-Reported and routed to the Desk Officer triage queue for prioritization and dispatch.
          </p>
        </div>
    </Modal>
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

function RoutingModal({ clip, incident, onComplete }: { clip: EscalatedClip; incident: IncidentRecord; onComplete: () => void }) {
  const steps = [
    `Generating 40-second clip (${clip.preRollSec}s pre-roll + ${clip.postRollSec}s post-roll)`,
    `Saving clip to Supabase Storage & logging ${clip.id} in cctv_clips`,
    `Creating incident ${incident.id} — source "CCTV-Reported", priority ${incident.priority}`,
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
      icon={<Siren size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
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
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${status.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
        </div>
    </Modal>
  );
}

export default function CctvEventsEvidence({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [flags, setFlags] = useState<ThreatFlag[]>(INITIAL_FLAGS);
  const [archive, setArchive] = useState<ArchiveClip[]>(INITIAL_ARCHIVE);
  const [evidence, setEvidence] = useState<EvidenceClip[]>(INITIAL_EVIDENCE);
  const [tagTarget, setTagTarget] = useState<FeedCam | null>(null);
  const [taggedConfirm, setTaggedConfirm] = useState<ThreatFlag | null>(null);
  const [bound, setBound] = useState<EvidenceClip | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const [escalations, setEscalations] = useState<EscalatedClip[]>(INITIAL_ESCALATIONS);
  const [feedCamera, setFeedCamera] = useState(MATRIX_CAMERAS[0]);
  const [tagFormalOpen, setTagFormalOpen] = useState(false);
  const [routing, setRouting] = useState<{ clip: EscalatedClip; incident: IncidentRecord } | null>(null);
  const [routingDone, setRoutingDone] = useState<EscalatedClip | null>(null);
  const [reviewClip, setReviewClip] = useState<EscalatedClip | null>(null);
  const clipSeqRef = useRef(INITIAL_ESCALATIONS.length + 1);
  const incidentSeqRef = useRef(2073);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const camById = (id: string) => CAMERAS.find((c) => c.id === id);
  const activeFlagForCam = (id: string) => flags.find((f) => f.camId === id && f.tagged);

  function createFlag(threat: (typeof TAG_TYPES)[number], note: string) {
    if (!tagTarget) return;
    const recent = flags.find((f) => f.camId === tagTarget.id && now - new Date(f.time).getTime() <= DEDUP_MS);
    if (recent) {
      setTagTarget(null);
      beep("info");
      flash(`Duplicate blocked — ${tagTarget.id} already tagged as ${recent.id} within the 5-minute dedup window`);
      return;
    }
    const id = nextFlagId();
    const flag: ThreatFlag = {
      id, camId: tagTarget.id, category: threat.label, severity: threat.severity,
      note: note || threat.desc, time: new Date().toISOString(), tagged: true, operator: operatorName,
    };
    setFlags((prev) => [flag, ...prev]);
    setTagTarget(null);
    if (threat.severity === "critical") beep("critical");
    else beep("info");
    setTaggedConfirm(flag);
    flash(`${flag.id} tagged by ${operatorName} on ${camById(tagTarget.id)?.name ?? tagTarget.id} — incident created and routed to Desk Officer triage`);
  }

  function nextFlagId() {
    const max = flags.reduce((m, f) => Math.max(m, parseInt(f.id.replace("FLG-", ""), 10)), 1182);
    return `FLG-${max + 1}`;
  }

  function createFormalTag(tagType: TagType, notes: string) {
    const escalatedAt = new Date();
    const start = new Date(escalatedAt.getTime() - 30 * 1000);
    const end = new Date(escalatedAt.getTime() + 10 * 1000);
    const clipId = `CLIP-2026-${String(clipSeqRef.current++).padStart(4, "0")}`;
    const incidentId = `INC-${incidentSeqRef.current++}`;
    const clip: EscalatedClip = {
      id: clipId, cameraId: feedCamera.id, cameraName: feedCamera.name,
      location: feedCamera.location, purok: feedCamera.purok,
      tagType, notes: notes || undefined, escalatedAt: escalatedAt.toISOString(),
      clipStart: start.toISOString(), clipEnd: end.toISOString(),
      durationSec: 40, preRollSec: 30, postRollSec: 10,
      storageUrl: `https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/${clipId}.mp4`,
      operator: operatorName,
      incident: { id: incidentId, source: "CCTV-Reported", priority: "Medium", category: tagType, status: "in_triage", purok: feedCamera.purok, createdAt: escalatedAt.toISOString() },
    };
    setTagFormalOpen(false);
    setRouting({ clip, incident: clip.incident });
    beep("critical");
    flash(`Tag confirmed by ${operatorName} on ${feedCamera.name} — routing ${clipId} (Medium) to Desk Officer triage`);
  }

  function completeRouting() {
    if (!routing) return;
    setEscalations((prev) => [routing.clip, ...prev]);
    setRouting(null);
    setRoutingDone(routing.clip);
  }

  function extractClip(clip: ArchiveClip) {
    const target = flags.find((f) => f.tagged);
    if (!target) {
      flash("No incident file to bind evidence to — tag a threat first");
      return;
    }
    const boundClip: EvidenceClip = {
      id: `EV-CLIP-${String(evidence.length + 1).padStart(2, "0")}`,
      flagId: target.id, camLabel: clip.camLabel, time: clip.time,
      duration: clip.duration, note: `${clip.duration} clip extracted from DVR archive`,
    };
    setArchive((prev) => prev.filter((c) => c.id !== clip.id));
    setEvidence((prev) => [boundClip, ...prev]);
    setBound(boundClip);
    beep("info");
    flash(`${clip.duration} clip extracted from ${clip.camLabel} and bound to incident file ${target.id}`);
  }

  const flagMatches = (f: ThreatFlag) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const cam = camById(f.camId);
    return [f.id, f.category, f.note, f.operator, cam?.name ?? "", cam?.location ?? ""].some((v) => v.toLowerCase().includes(q));
  };

  const visibleFlags = useMemo(() => flags.filter((f) => flagMatches(f)), [flags, query]);
  const pendingFlags = flags.filter((f) => !f.tagged).length;
  const taggedFlags = flags.filter((f) => f.tagged).length;

  const escMatches = (esc: EscalatedClip) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [esc.id, esc.incident.id, esc.cameraName, esc.tagType, esc.incident.status, esc.purok, esc.notes ?? "", esc.operator]
      .some((v) => v.toLowerCase().includes(q));
  };
  const visibleEscalations = escalations.filter(escMatches);

  const totalClips = escalations.length;
  const inTriage = escalations.filter((e) => e.incident.status === "in_triage").length;
  const dispatchedCount = escalations.filter((e) => e.incident.status !== "in_triage").length;

  const kpis = [
    { label: "LIVE FEEDS TAGGED", value: taggedFlags, sub: "anomalies identified this session", icon: Camera },
    { label: "PENDING FLAGS", value: pendingFlags, sub: "awaiting evidence packaging", icon: Flag },
    { label: "CCTV INCIDENTS", value: totalClips, sub: "auto-classified CCTV-Reported", icon: Siren },
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
                Tag anomalies on live feeds, create evidence clips, and track incident status
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
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Live Multi-View Matrix</h3>
                  <p className="text-[11px] text-[#94A3B8]">Simultaneous IP camera streams — tag anomalies directly</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <Activity size={11} />
                Streaming
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CAMERAS.map((cam) => (
                  <FeedView key={cam.id} cam={cam} flagged={!!activeFlagForCam(cam.id)} onFlag={() => setTagTarget(cam)} />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-stone-400">
                <Flag size={10} className="text-[#0038A8]" />
                Click Tag on any stream to create an evidence record and route it to the Desk Officer triage queue.
              </p>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Tagged Events</h3>
                  <p className="text-[11px] text-[#94A3B8]">All flagged anomalies and their status</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{visibleFlags.length} flags</span>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Search size={13} className="text-stone-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flags by ID, camera, category..." className="w-full bg-transparent text-[11px] text-stone-700 placeholder:text-stone-400 focus:outline-none" />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {visibleFlags.map((flag) => {
                const cam = camById(flag.camId);
                const sev = SEVERITY_MAP[flag.severity] ?? SEVERITY_MAP.warning;
                return (
                  <div key={flag.id} className={`rounded-lg border px-3.5 py-3 ${flag.tagged ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0038A8]/10 text-[#0038A8]"><Flag size={11} /></span>
                        <span className="text-[11px] font-bold text-stone-900">{flag.id}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                      </div>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${flag.tagged ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {flag.tagged ? "Tagged" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-stone-800">{flag.category}</p>
                    <p className="text-[10px] text-stone-500">{cam?.name} · {cam?.location}</p>
                    <p className="mt-1 text-[10px] italic leading-snug text-stone-600">"{flag.note}"</p>
                    <p className="mt-1 flex items-center gap-1 text-[9px] text-stone-400">
                      <Clock size={9} /> {formatTime(flag.time)} · <User size={9} /> by {flag.operator}
                    </p>
                  </div>
                );
              })}
              {visibleFlags.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10">
                  <Flag size={20} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No flags match the current search</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 480 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Surveillance Matrix — Tag &amp; Route</h3>
                  <p className="text-[11px] text-[#94A3B8]">Tag a threat to create a CCTV-Reported incident routed to Desk Officer triage</p>
                </div>
              </div>
            </div>
            <div className="px-5">
              <div className="relative h-40 w-full overflow-hidden rounded-xl border border-black/20 bg-black">
                <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> LIVE
                  </span>
                  <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90">{feedCamera.name}</span>
                </div>
                <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                  {new Date(now).toLocaleTimeString("en-US", { hour12: false })}
                </div>
                <button onClick={() => setTagFormalOpen(true)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white shadow-lg transition hover:bg-rose-700">
                  <Flag size={12} /> Tag
                </button>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">FEED CAMERA</p>
                <select value={feedCamera.id} onChange={(e) => setFeedCamera(MATRIX_CAMERAS.find((c) => c.id === e.target.value) ?? MATRIX_CAMERAS[0])} className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30">
                  {MATRIX_CAMERAS.map((c) => (<option key={c.id} value={c.id}>{c.name} · {c.location} · {c.purok}</option>))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
                <Siren size={10} /> AUTOMATED ROUTING ON TAG
              </p>
              {[
                { icon: Siren, text: `Creates incident "${incidentSeqRef.current}" classified as CCTV-Reported` },
                { icon: MapPin, text: `Tags location from ${feedCamera.id} registered position` },
                { icon: Video, text: "Attaches the 40-second clip as linked evidence" },
                { icon: AlertCircle, text: "Routes to Desk Officer triage queue for prioritization & dispatch" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0038A8]/10 text-[#0038A8]"><Icon size={11} /></span>
                  <span className="text-[10px] leading-snug text-stone-600">{text}</span>
                </div>
              ))}
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
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">DVR ARCHIVE</p>
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
                    <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">{ev.flagId}</span>
                  </div>
                  <p className="mt-1 text-[9px] italic text-stone-500">{ev.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-white px-5 py-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Escalated Clips — Incident Status Tracker</h3>
                <p className="text-[11px] text-[#94A3B8]">Read-only view of tagged clips and their dispatch status</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500">
              <Eye size={10} /> Observer only — dispatch handled by Desk Officer
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{visibleEscalations.length} clips</span>
          </div>

          <div className="mt-4 space-y-3">
            {visibleEscalations.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                <Inbox size={22} className="mb-2 text-stone-300" />
                <p className="text-[12px] font-medium text-stone-500">No escalated clips yet</p>
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
                        <button onClick={() => setReviewClip(esc)} className="mt-2 flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white">
                          <Play size={11} /> Review Clip
                        </button>
                      </div>

                      <div className="flex flex-col rounded-lg border border-stone-200 bg-stone-50 p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-bold text-stone-900">{esc.incident.id}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
                            <Siren size={8} /> CCTV-Reported
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
                          <Eye size={9} /> Triage &amp; dispatch owned by {status.owner} — operator observes only
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-black/5 bg-white px-5 py-5 shadow-sm">
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
                { icon: Flag, label: "Tag", owner: "CCTV Operator", note: "Manual threat tag on live feed" },
                { icon: Video, label: "Clip", owner: "System", note: "40s auto-clip · pre + post roll" },
                { icon: Siren, label: "Incident", owner: "System", note: "CCTV-Reported · mapped" },
                { icon: Link2, label: "Evidence", owner: "System", note: "Clip attached to incident" },
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
              The CCTV Operator can tag threats and track clip-to-incident linkage, but triage, prioritization, and dispatch are handled <span className="font-semibold">exclusively</span> by the Desk Officer.
            </p>
          </div>
        </div>
      </main>

      {tagTarget && <TagAnomalyModal cam={tagTarget} onClose={() => setTagTarget(null)} onTag={(t, note) => createFlag(t, note)} />}

      {taggedConfirm && (
        <ConfirmModal type="success" title="Tag Created & Routed"
          message={`${taggedConfirm.id} flagged by ${operatorName} on ${camById(taggedConfirm.camId)?.name ?? taggedConfirm.camId}. Incident created as CCTV-Reported and routed to the Desk Officer triage queue for prioritization and dispatch.`}
          onClose={() => setTaggedConfirm(null)} />
      )}

      {bound && (
        <ConfirmModal type="success" title="Evidence Clip Bound"
          message={`${bound.duration} video clip extracted from ${bound.camLabel} and bound as a permanent digital attachment to incident file ${bound.flagId}.`}
          onClose={() => setBound(null)} />
      )}

      {tagFormalOpen && (
        <Modal onClose={() => setTagFormalOpen(false)} title="Tag Threat on Live Feed"
          subtitle={`${feedCamera.id} · ${feedCamera.name}`}
          icon={<Flag size={18} />} iconClass="bg-[#0038A8]/10 text-[#0038A8]" size="lg"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button onClick={() => setTagFormalOpen(false)} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
              <button onClick={() => createFormalTag("Suspicious Behavior", "")} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]">
                <Flag size={13} /> Confirm Tag &amp; Route
              </button>
            </div>
          }>
          <p className="text-[10px] leading-relaxed text-stone-500">
            This will generate a 40-second clip (30s pre-roll + 10s post-roll), save it to storage, create a CCTV-Reported incident, and push it to the Desk Officer triage queue. Priority is set to Medium by default — the Desk Officer will re-prioritize during triage.
          </p>
        </Modal>
      )}

      {routing && <RoutingModal clip={routing.clip} incident={routing.incident} onComplete={completeRouting} />}

      {reviewClip && <ClipReviewModal clip={reviewClip} onClose={() => setReviewClip(null)} />}

      {routingDone && (
        <ConfirmModal type="success" title="Escalation Complete &amp; Routed"
          message={`${routingDone.id} (40s clip) saved to Supabase Storage. Incident ${routingDone.incident.id} was auto-created as CCTV-Reported at ${routingDone.purok} · ${routingDone.location}. The clip is attached as evidence and the incident is now in the Desk Officer's triage queue for dispatching.`}
          onClose={() => setRoutingDone(null)} />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
