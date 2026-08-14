import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  MapPin,
  Clock,
  Flag,
  Siren,
  Scissors,
  Paperclip,
  Zap,
  CheckCircle2,
  FileText,
  Send,
  Timer,
  Users,
  Footprints,
  TrafficCone,
  Activity,
  Inbox,
  Play,
  Search,
  Undo2,
  User,
  AlertCircle,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal, SoundToggle } from "../components/ui";

type FlagStage = "flagged" | "injected" | "retracted";

const SLA_SECONDS = 15 * 60;
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
  stage: FlagStage;
  ticket?: string;
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

const THREAT_TYPES: { id: string; label: string; desc: string; severity: string; icon: typeof Users }[] = [
  { id: "crowd", label: "Nighttime Crowd Gathering", desc: "Unexpected gathering forming at a closed public area during off-hours", severity: "critical", icon: Users },
  { id: "loitering", label: "Prolonged Loitering", desc: "Sustained loitering inside a dark alley with no visible activity", severity: "warning", icon: Footprints },
  { id: "blockage", label: "Road Blockage", desc: "Sudden obstruction or traffic blockage on a main intersection", severity: "critical", icon: TrafficCone },
];

const CAMERAS: FeedCam[] = [
  { id: "SM-GATE-01", name: "Main Gate Intersection", location: "Barangay Main Gate · Purok 1", coords: "11.4821°N, 122.9681°E", scene: "junction" },
  { id: "DB-HALL-01", name: "Barangay Hall Plaza", location: "Hall Frontage · Purok 2", coords: "11.4812°N, 122.9673°E", scene: "plaza" },
  { id: "ALY-07", name: "North Alley Camera", location: "Dark Alley Entry · Purok 3", coords: "11.4801°N, 122.9660°E", scene: "alley" },
  { id: "MRK-04", name: "Market Row Corner", location: "Market Residential Row · Purok 5", coords: "11.4830°N, 122.9695°E", scene: "market" },
];

const INITIAL_FLAGS: ThreatFlag[] = [
  { id: "FLG-1182", camId: "ALY-07", category: "Prolonged Loitering", severity: "warning", note: "Subject lingering near dark alley entrance for ~8 minutes with no visible activity", time: seedTime(2), stage: "injected", ticket: "HQ-4091", operator: "CO-01" },
  { id: "FLG-1181", camId: "SM-GATE-01", category: "Road Blockage", severity: "critical", note: "Cargo truck stalled across main gate lane, backing traffic into the intersection", time: seedTime(9), stage: "flagged", operator: "CO-01" },
  { id: "FLG-1180", camId: "MRK-04", category: "Nighttime Crowd Gathering", severity: "critical", note: "Unexpected crowd forming near closed market row after operating hours", time: seedTime(14.8), stage: "flagged", operator: "CO-01" },
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
              FLAGGED
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
            {flagged ? "Flagged" : "Flag"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TagModal({ cam, onClose, onTag, onTagEscalate }: { cam: FeedCam; onClose: () => void; onTag: (t: (typeof THREAT_TYPES)[number], note: string) => void; onTagEscalate: (t: (typeof THREAT_TYPES)[number], note: string) => void }) {
  const [selected, setSelected] = useState(THREAT_TYPES[0]);
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
          <button
            onClick={() => onTag(selected, note.trim())}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-4 py-2.5 text-[12px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8]/5"
          >
            <Flag size={13} />
            Flag Threat
          </button>
          <button
            onClick={() => onTagEscalate(selected, note.trim())}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Zap size={13} />
            Flag &amp; Escalate
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
            timestamp will be auto-captured
          </p>
        </div>

        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">THREAT CATEGORY</p>
        <div className="mb-4 space-y-2">
          {THREAT_TYPES.map((t) => {
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
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500"}`}>
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
          className="mb-5 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
        />
    </Modal>
  );
}

export default function ManualThreatFlags({ operatorName = "CO-01" }: { operatorName?: string }) {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [flags, setFlags] = useState<ThreatFlag[]>(INITIAL_FLAGS);
  const [archive, setArchive] = useState<ArchiveClip[]>(INITIAL_ARCHIVE);
  const [evidence, setEvidence] = useState<EvidenceClip[]>(INITIAL_EVIDENCE);
  const [tagTarget, setTagTarget] = useState<FeedCam | null>(null);
  const [escalated, setEscalated] = useState<ThreatFlag | null>(null);
  const [bound, setBound] = useState<EvidenceClip | null>(null);
  const [retractTarget, setRetractTarget] = useState<ThreatFlag | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const camById = (id: string) => CAMERAS.find((c) => c.id === id);
  const activeFlagForCam = (id: string) => flags.find((f) => f.camId === id && f.stage === "flagged");

  function createFlag(threat: (typeof THREAT_TYPES)[number], note: string, escalate: boolean) {
    if (!tagTarget) return;
    const recent = flags.find((f) => f.camId === tagTarget.id && f.stage !== "retracted" && now - new Date(f.time).getTime() <= DEDUP_MS);
    if (recent) {
      setTagTarget(null);
      beep("info");
      flash(`Duplicate blocked — ${tagTarget.id} already flagged as ${recent.id} within the 5-minute dedup window (Sec 4.2 dedup rule)`);
      return;
    }
    const id = nextFlagId();
    const flag: ThreatFlag = {
      id,
      camId: tagTarget.id,
      category: threat.label,
      severity: threat.severity,
      note: note || threat.desc,
      time: new Date().toISOString(),
      stage: escalate ? "injected" : "flagged",
      ticket: escalate ? nextTicket() : undefined,
      operator: operatorName,
    };
    setFlags((prev) => [flag, ...prev]);
    setTagTarget(null);
    if (escalate) {
      if (threat.severity === "critical") beep("critical");
      setEscalated(flag);
      flash(`${flag.id} flagged & escalated — high-priority ticket ${flag.ticket} injected into the Desk Officer queue`);
    } else {
      flash(`${flag.id} flagged by ${operatorName} — snapshot & coordinates packaged into a pre-filled report`);
    }
  }

  function nextTicket() {
    const max = flags.reduce((m, f) => (f.ticket ? Math.max(m, parseInt(f.ticket.replace("HQ-", ""), 10)) : m), 4090);
    return `HQ-${max + 1}`;
  }

  function nextFlagId() {
    const max = flags.reduce((m, f) => Math.max(m, parseInt(f.id.replace("FLG-", ""), 10)), 1182);
    return `FLG-${max + 1}`;
  }

  function escalate(flag: ThreatFlag) {
    const ticket = flag.ticket ?? nextTicket();
    const updated = { ...flag, stage: "injected" as FlagStage, ticket };
    setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
    if (flag.severity === "critical") beep("critical");
    setEscalated(updated);
    flash(`${flag.id} escalated — report package + geocoordinates injected as ${ticket}`);
  }

  function escalateSilently(flag: ThreatFlag) {
    const ticket = flag.ticket ?? nextTicket();
    const updated = { ...flag, stage: "injected" as FlagStage, ticket };
    setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
    beep("critical");
    flash(`${flag.id} auto-escalated — SLA exceeded, injected as ${ticket}`);
  }

  useEffect(() => {
    flags.forEach((f) => {
      if (f.stage === "flagged" && now - new Date(f.time).getTime() >= SLA_SECONDS * 1000) {
        escalateSilently(f);
      }
    });
  }, [now, flags]);

  function retract(flag: ThreatFlag) {
    setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, stage: "retracted" as FlagStage } : f)));
    setRetractTarget(null);
    beep("info");
    flash(`${flag.id} retracted by ${operatorName} — anomaly withdrawn before escalation; removed from dispatch queue`);
  }

  function escalateNext() {
    const next = flags.find((f) => f.stage === "flagged");
    if (next) escalate(next);
  }

  function extractClip(clip: ArchiveClip) {
    const target = flags.find((f) => f.stage !== "retracted");
    if (!target) {
      flash("No incident file to bind evidence to — flag a threat first");
      return;
    }
    const boundClip: EvidenceClip = {
      id: `EV-CLIP-${String(evidence.length + 1).padStart(2, "0")}`,
      flagId: target.id,
      camLabel: clip.camLabel,
      time: clip.time,
      duration: clip.duration,
      note: `${clip.duration} clip extracted from DVR archive`,
    };
    setArchive((prev) => prev.filter((c) => c.id !== clip.id));
    setEvidence((prev) => [boundClip, ...prev]);
    setBound(boundClip);
    flash(`${clip.duration} clip extracted from ${clip.camLabel} and bound to incident file ${target.id}`);
  }

  const matches = (f: ThreatFlag) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const cam = camById(f.camId);
    return [f.id, f.ticket ?? "", f.category, f.note, f.operator, cam?.name ?? "", cam?.location ?? ""].some((v) => v.toLowerCase().includes(q));
  };

  const visibleFlags = useMemo(() => flags.filter((f) => f.stage !== "retracted" && matches(f)), [flags, query]);
  const pendingFlags = flags.filter((f) => f.stage === "flagged").length;
  const injected = useMemo(() => flags.filter((f) => f.stage === "injected" && matches(f)), [flags, query]);
  const escalatedToday = flags.filter((f) => f.stage === "injected").length;
  const retractedCount = flags.filter((f) => f.stage === "retracted").length;

  function remainingSecs(f: ThreatFlag) {
    return Math.max(0, Math.round((SLA_SECONDS * 1000 - (now - new Date(f.time).getTime())) / 1000));
  }

  const liveFeeds = CAMERAS.length;

  const kpis = [
    { label: "LIVE FEEDS ONLINE", value: liveFeeds, sub: "IP streams on the multi-view matrix", icon: Camera },
    { label: "PENDING FLAGS", value: pendingFlags, sub: "awaiting dispatch escalation", icon: Flag },
    { label: "INJECTED TICKETS", value: escalatedToday, sub: "high-priority in Desk Officer queue", icon: Siren },
    { label: "EVIDENCE CLIPS BOUND", value: evidence.length, sub: "permanent DVR attachments", icon: Scissors },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Manual Threat Flags</h1>
              <p className="mt-1 text-sm text-stone-500">
                Flag anomalies on live feeds, package incident reports &amp; escalate straight to dispatch
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-[#0038A8]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0038A8]">
                <User size={12} />
                Operator: {operatorName}
              </span>
              <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
              <span className="flex items-center gap-1.5 rounded-full bg-[#0038A8]/5 px-3 py-1.5 text-[11px] font-semibold text-[#0038A8]">
                <Zap size={12} />
                Shortcut Macro
              </span>
              <button
                onClick={escalateNext}
                disabled={pendingFlags === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
              >
                <Send size={13} />
                Escalate Next Flag
              </button>
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
                  <p className="text-[11px] text-[#94A3B8]">Simultaneous IP camera streams from high-risk intersections &amp; public spaces</p>
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
                  <FeedView
                    key={cam.id}
                    cam={cam}
                    flagged={!!activeFlagForCam(cam.id)}
                    onFlag={() => setTagTarget(cam)}
                  />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-stone-400">
                <Flag size={10} className="text-[#0038A8]" />
                Single-click the Flag control on any stream to tag an anomaly — the timestamped snapshot and camera geocoordinates are auto-packaged.
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-[9px] leading-snug text-amber-700">
                <AlertCircle size={10} className="mt-0.5 shrink-0" />
                Demo catalog note: this feed uses IDs (SM-GATE-01, DB-HALL-01, ALY-07, MRK-04). The Surveillance Matrix assigns cameras per cell from its own 9-camera catalog. A unified shared camera catalog is a backend integration item — IDs already overlap (ALY-07, MRK-04).
              </p>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Dispatch Escalator</h3>
                  <p className="text-[11px] text-[#94A3B8]">Flagged incidents → auto-packaged → high-priority D.O. tickets</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">{pendingFlags} pending</span>
            </div>

            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Search size={13} className="text-stone-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search flags by ID, ticket, camera, category, note or operator..."
                  className="w-full bg-transparent text-[11px] text-stone-700 placeholder:text-stone-400 focus:outline-none"
                />
                {retractedCount > 0 && (
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold text-stone-500" title={`${retractedCount} flag(s) retracted this session`}>
                    {retractedCount} retracted
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {visibleFlags.map((flag) => {
                const cam = camById(flag.camId);
                const sev = SEVERITY_MAP[flag.severity] ?? SEVERITY_MAP.warning;
                const injectedFlag = flag.stage === "injected";
                const remaining = remainingSecs(flag);
                const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
                const ss = String(remaining % 60).padStart(2, "0");
                const overdue = remaining <= 0;
                const slaColor = overdue ? "text-rose-600" : remaining < 300 ? "text-amber-600" : "text-emerald-600";
                return (
                  <div key={flag.id} className={`rounded-lg border px-3.5 py-3 ${injectedFlag ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0038A8]/10 text-[#0038A8]">
                          <Flag size={11} />
                        </span>
                        <span className="text-[11px] font-bold text-stone-900">{flag.id}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                      </div>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${injectedFlag ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {injectedFlag ? <CheckCircle2 size={9} /> : <Timer size={9} />}
                        {injectedFlag ? "Injected" : "Flagged"}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11px] font-semibold text-stone-800">{flag.category}</p>
                    <p className="text-[10px] text-stone-500">
                      {cam?.name} · {cam?.location}
                    </p>
                    <p className="mt-1 text-[10px] italic leading-snug text-stone-600">"{flag.note}"</p>
                    <p className="mt-1 flex items-center gap-1 text-[9px] text-stone-400">
                      <Clock size={9} />
                      {formatTime(flag.time)}
                      <span className="mx-0.5">&middot;</span>
                      <User size={9} />
                      by {flag.operator}
                    </p>

                    <div className="mt-2 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5">
                      <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-[#151311]">
                        <Camera size={11} className="text-white/50" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 font-mono text-[9px] text-stone-500">
                          <MapPin size={8} />
                          {cam?.coords}
                        </p>
                        <p className="flex items-center gap-1 text-[9px] text-stone-400">
                          <FileText size={8} />
                          Auto-packaged report · {formatTime(flag.time)}
                        </p>
                      </div>
                    </div>

                    {!injectedFlag && (
                      <p className={`mt-1.5 flex items-center justify-between rounded-md border px-2.5 py-1 text-[9px] font-medium ${
                        overdue ? "border-rose-200 bg-rose-50 text-rose-700" : "border-stone-200 bg-white text-stone-500"
                      }`}>
                        <span className="flex items-center gap-1">
                          <Timer size={10} />
                          {overdue ? "SLA exceeded — auto-escalation imminent" : `SLA window (15 min): ${mm}:${ss} remaining`}
                        </span>
                        <span className={`font-mono ${slaColor}`}>{overdue ? "OVERDUE" : `${Math.max(1, Math.ceil(remaining / 60))} min`}</span>
                      </p>
                    )}

                    {injectedFlag ? (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
                        <Siren size={11} />
                        {flag.ticket} · Injected into Desk Officer dispatch queue
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setRetractTarget(flag)}
                          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-stone-300 bg-white px-2 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
                        >
                          <Undo2 size={11} />
                          Retract
                        </button>
                        <button
                          onClick={() => escalate(flag)}
                          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-[#0038A8] px-2 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                        >
                          <Zap size={11} />
                          Escalate to Desk Officer
                        </button>
                      </div>
                    )}
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
                <Siren size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Desk Officer Queue Injection</h3>
                  <p className="text-[11px] text-[#94A3B8]">Packaged flags injected as high-priority tickets for immediate action</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-600">{injected.length} high-priority</span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {injected.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <Inbox size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No tickets injected yet</p>
                  <p className="text-[10px] text-stone-400">Escalate a flagged incident to push it into the D.O. queue</p>
                </div>
              ) : (
                injected.map((flag) => {
                  const cam = camById(flag.camId);
                  const sev = SEVERITY_MAP[flag.severity] ?? SEVERITY_MAP.warning;
                  return (
                    <div key={flag.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                            <Siren size={9} />
                            HIGH PRIORITY
                          </span>
                          <span className="text-[11px] font-bold text-stone-900">{flag.ticket}</span>
                          <span className="text-[10px] text-stone-400">{flag.id}</span>
                        </div>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold text-stone-800">{flag.category}</p>
                      <p className="flex items-center gap-1 text-[10px] text-stone-400">
                        <MapPin size={9} />
                        {cam?.name} · {cam?.location}
                        <span className="mx-0.5">&middot;</span>
                        <span className="font-mono">{cam?.coords}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] italic text-stone-500">"{flag.note}"</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[9px] text-stone-400">
                        <Clock size={9} />
                        {formatTime(flag.time)}
                        <span className="mx-0.5">&middot;</span>
                        <User size={9} />
                        by {flag.operator}
                        <span className="mx-0.5">&middot;</span>
                        <CheckCircle2 size={9} className="text-emerald-500" />
                        Injected to D.O. dispatch queue for immediate action
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
                  <p className="text-[11px] text-[#94A3B8]">Extract minute-long clips &amp; bind as permanent attachments</p>
                </div>
              </div>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-600">{archive.length} clips</span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">DVR ARCHIVE</p>
              {archive.map((clip) => (
                <div key={clip.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500">
                      <Play size={11} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-stone-900">{clip.camLabel}</p>
                      <p className="flex items-center gap-1 text-[9px] text-stone-400">
                        <Clock size={8} />
                        {formatTime(clip.time)}
                        <span className="mx-0.5">&middot;</span>
                        {clip.duration} clip
                      </p>
                    </div>
                    <button
                      onClick={() => extractClip(clip)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                    >
                      <Scissors size={10} />
                      Extract
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
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600">
                      <Paperclip size={11} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-stone-900">{ev.camLabel}</p>
                      <p className="flex items-center gap-1 text-[9px] text-stone-500">
                        <Clock size={8} />
                        {formatTime(ev.time)}
                        <span className="mx-0.5">&middot;</span>
                        {ev.duration}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">{ev.flagId}</span>
                  </div>
                  <p className="mt-1 text-[9px] italic text-stone-500">{ev.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {tagTarget && (
        <TagModal
          cam={tagTarget}
          onClose={() => setTagTarget(null)}
          onTag={(t, note) => createFlag(t, note, false)}
          onTagEscalate={(t, note) => createFlag(t, note, true)}
        />
      )}

      {escalated && (
        <ConfirmModal
          type="success"
          title="Escalated to Dispatch"
          message={`${escalated.id} auto-packaged — timestamped snapshot and camera geocoordinates captured into a pre-filled report, then injected as high-priority ticket ${escalated.ticket} straight into the Desk Officer dispatch queue for immediate action.`}
          onClose={() => setEscalated(null)}
        />
      )}

      {bound && (
        <ConfirmModal
          type="success"
          title="Evidence Clip Bound"
          message={`${bound.duration} video clip extracted from ${bound.camLabel} and bound as a permanent digital attachment to incident file ${bound.flagId}.`}
          onClose={() => setBound(null)}
        />
      )}

      {retractTarget && (
        <ConfirmModal
          type="confirm"
          title="Retract Flag?"
          message={`${retractTarget.id} (${retractTarget.category}) will be withdrawn from the dispatch queue. This action is only allowed before escalation.`}
          onClose={() => setRetractTarget(null)}
          onConfirm={() => retract(retractTarget)}
          confirmLabel="Retract flag"
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
