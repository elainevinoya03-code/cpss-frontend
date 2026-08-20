import { useState } from "react";
import {
  Radio,
  ClipboardList,
  Navigation,
  MessageSquare,
  MapPin,
  Users,
  Clock,
  Eye,
  Send,
  X,
  CheckCircle2,
  Flame,
  Volume2,
  Siren,
  Zap,
  Smartphone,
  Camera,
  Video,
  ImageIcon,
  FileText,
  Shield,
  Activity,
  BellRing,
  Timer,
  ChevronRight,
  AlertTriangle,
  PhoneCall,
  RefreshCw,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { Modal } from "../components/ui";

// §14.1 — Dispatch states: Available, Responding, On Scene, Resolving, Unavailable
type DispatchStatus = "responding" | "on_scene" | "resolving" | "resolved";

type Priority = "High" | "Medium" | "Low";

type NotificationStatus = "queued" | "sent" | "delivered" | "failed";

// §14.2 — Reassignment reasons
type ReassignReason = "Team unavailable" | "Team reassigned to emergency" | "Closer responder available" | "Operational change" | "Other";

const REASSIGN_REASONS: ReassignReason[] = ["Team unavailable", "Team reassigned to emergency", "Closer responder available", "Operational change", "Other"];

interface Incident {
  id: string;
  category: string;
  severity: string;
  source: string;
  purok: string;
  reporter: string;
  time: string;
  description: string;
  photos: number;
  priority: Priority;
}

interface Dispatch {
  id: string;
  incident: string;
  team: string;
  status: DispatchStatus;
  purok: string;
  reporter: string;
  time: string;
  eta: string;
  distance: string;
  evidence: number;
  priority: Priority;
  // §14.3 — Assignment history tracks each reassignment
  assignmentHistory?: { from: string; to: string; reason: ReassignReason; customReason?: string; reassignedBy: string; reassignedAt: string }[];
}

interface Evidence {
  id: string;
  dispatch: string;
  author: string;
  type: "photo" | "video" | "note";
  label: string;
  note: string;
  time: string;
}

interface ResidentUpdate {
  id: string;
  dispatch: string;
  trackingId: string;
  channel: string;
  message: string;
  time: string;
  status: NotificationStatus;
}

const DISPATCH_META: Record<DispatchStatus, { label: string; action: string | null; next?: DispatchStatus; badge: string; dot: string }> = {
  responding: { label: "Responding", action: "Mark On-Scene", next: "on_scene", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  on_scene: { label: "On-Scene", action: "Mark Resolving", next: "resolving", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  resolving: { label: "Resolving", action: "Mark Resolved", next: "resolved", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400" },
  resolved: { label: "Resolved", action: null, badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
};

const TRANSITION_MESSAGE: Record<DispatchStatus, string> = {
  responding: "A Tanod unit is responding to your report",
  on_scene: "The assigned Tanod unit has arrived on scene",
  resolving: "On-scene team is now resolving the situation",
  resolved: "Your report has been resolved — thank you",
};

// §6.1.11 / §14.9 — ordinary resident updates go out as push only; SMS is layered on
// only when the linked incident is High priority (emergency-grade). Low/Medium incidents
// never text the citizen on routine dispatch transitions.
function residentUpdateChannel(priority: Priority): string {
  return priority === "High" ? "Push + SMS" : "Push";
}

const NOTIFICATION_STATUS_META: Record<NotificationStatus, { label: string; badge: string; dot: string }> = {
  queued: { label: "Queued", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  sent: { label: "Sent", badge: "bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  delivered: { label: "Delivered", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  failed: { label: "Failed", badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

function channelPill(channel: string) {
  return channel === "Push + SMS"
    ? { badge: "bg-rose-50 text-rose-700", icon: MessageSquare }
    : { badge: "bg-sky-50 text-sky-700", icon: Smartphone };
}

const SOURCE_ICON: Record<string, typeof Smartphone> = {
  "Citizen App": Smartphone,
  "CCTV Escalation": Camera,
  "Purok Leader": FileText,
  "Emergency SOS": Siren,
  "IoT Sensor": Zap,
};

const CATEGORY_ICON: Record<string, typeof Flame> = {
  "Fire/Smoke": Flame,
  "Noise Disturbance": Volume2,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
};

const EVIDENCE_META: Record<string, { label: string; icon: typeof ImageIcon; pill: string }> = {
  photo: { label: "Photo", icon: ImageIcon, pill: "bg-sky-100 text-sky-700" },
  video: { label: "Video", icon: Video, pill: "bg-violet-100 text-violet-700" },
  note: { label: "Note", icon: FileText, pill: "bg-amber-100 text-amber-700" },
};

const INITIAL_UNASSIGNED: Incident[] = [
  { id: "INC-2071", category: "Fire/Smoke", severity: "critical", source: "Citizen App", purok: "Purok 3", reporter: "Maria Santos", time: "2026-07-20T09:32:00", description: "Heavy smoke column spotted near market residential row — SM-PUROK3-01 offline, unverified", photos: 2, priority: "High" },
  { id: "INC-2070", category: "Public Disturbance", severity: "critical", source: "Emergency SOS", purok: "Purok 6", reporter: "Ana Lim", time: "2026-07-20T10:05:00", description: "SOS held for 3s — live GPS locked at commercial strip, possible altercation", photos: 0, priority: "High" },
  { id: "INC-2069", category: "Noise Disturbance", severity: "warning", source: "CCTV Escalation", purok: "Purok 4", reporter: "CCTV Op. Santos", time: "2026-07-20T10:12:00", description: "Manual clip escalated — sustained loud disturbance at hall, DB-HALL-01 at 78 dB", photos: 1, priority: "Medium" },
];

const INITIAL_DISPATCHES: Dispatch[] = [
  { id: "DP-1181", incident: "INC-2068", team: "Team Alpha", status: "responding", purok: "Purok 1", reporter: "SM-GATE-01 (IoT)", time: "2026-07-20T09:58:00", eta: "ETA 3 min", distance: "1.2 km", evidence: 0, priority: "High" },
  { id: "DP-1180", incident: "INC-2066", team: "Team Bravo", status: "on_scene", purok: "Purok 5", reporter: "Rosa Garcia", time: "2026-07-20T09:40:00", eta: "On scene", distance: "0.8 km", evidence: 3, priority: "High" },
  { id: "DP-1182", incident: "INC-2067", team: "Team Charlie", status: "resolving", purok: "Purok 2", reporter: "PL. Reyes", time: "2026-07-20T08:45:00", eta: "ETA 10 min", distance: "1.6 km", evidence: 1, priority: "Low" },
  { id: "DP-1178", incident: "INC-2065", team: "Team Delta", status: "resolved", purok: "Purok 5", reporter: "Rosa Garcia", time: "2026-07-19T20:30:00", eta: "Closed", distance: "—", evidence: 3, priority: "Medium" },
];

const ON_DUTY_TANODS = [
  { id: "t1", name: "Team Alpha", members: 4, availability: "dispatched", purok: "Purok 1" },
  { id: "t2", name: "Team Bravo", members: 3, availability: "available", purok: "Purok 5" },
  { id: "t3", name: "Team Charlie", members: 4, availability: "available", purok: "Purok 2" },
  { id: "t4", name: "Team Delta", members: 3, availability: "available", purok: "Purok 5" },
];

const ROUTE_STEPS = [
  { text: "Head north on Barangay Road toward Plaza", dist: "400 m" },
  { text: "Turn left at Plaza Junction", dist: "50 m" },
  { text: "Continue straight — incident point on right", dist: "120 m" },
];

const INITIAL_EVIDENCE: Evidence[] = [
  { id: "EV-014", dispatch: "DP-1180", author: "Team Bravo", type: "photo", label: "Incident scene overview", note: "Smoke source isolated at rear stall", time: "2026-07-20T10:18:00" },
  { id: "EV-013", dispatch: "DP-1180", author: "Team Bravo", type: "video", label: "Live situation walkthrough", note: "4 min clip — crowd dispersed", time: "2026-07-20T10:12:00" },
  { id: "EV-012", dispatch: "DP-1182", author: "Team Charlie", type: "note", label: "Situation note", note: "Resident identified, verifying details with Purok Leader", time: "2026-07-20T09:55:00" },
];

const INITIAL_RESIDENT_UPDATES: ResidentUpdate[] = [
  { id: "RU-052", dispatch: "DP-1180", trackingId: "Tracking 8842", channel: "Push + SMS", message: "Team Bravo arrived on scene at your reported location", time: "2026-07-20T10:12:00", status: "delivered" },
  { id: "RU-051", dispatch: "DP-1181", trackingId: "Tracking 8820", channel: "Push + SMS", message: "Team Alpha is responding to your IoT-triggered alert", time: "2026-07-20T09:58:00", status: "sent" },
  { id: "RU-050", dispatch: "DP-1182", trackingId: "Tracking 8761", channel: "Push", message: "Team Charlie is resolving your complaint", time: "2026-07-20T09:15:00", status: "failed" },
];

const CHAT_SEED: Record<string, { id: string; from: "me" | "them"; text: string; time: string }[]> = {
  "Team Alpha": [
    { id: "m1", from: "them", text: "Responding to INC-2068, ETA 3 minutes.", time: "2026-07-20T09:59:00" },
    { id: "m2", from: "me", text: "Copy. Update us once you reach the gate sensor.", time: "2026-07-20T10:00:00" },
  ],
  "Team Bravo": [
    { id: "m1", from: "them", text: "On scene at INC-2066, smoke verified, crowd controlled.", time: "2026-07-20T10:12:00" },
    { id: "m2", from: "me", text: "Photo evidence received. Keep monitoring.", time: "2026-07-20T10:13:00" },
  ],
  "Team Charlie": [
    { id: "m1", from: "them", text: "Situation note uploaded for INC-2067.", time: "2026-07-20T09:56:00" },
  ],
};

function AssignModal({ incident, onClose, onAssign }) {
  const [selected, setSelected] = useState("t2");

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Assign &amp; Dispatch"
      subtitle={incident?.id}
      icon={<Radio size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onAssign(selected)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Send size={13} />
            Dispatch Now
          </button>
        </div>
      }
    >
      {incident && (
        <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-stone-900">{incident.category}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_MAP[incident.severity].badge}`}>
              {SEVERITY_MAP[incident.severity].label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-600">{incident.description}</p>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-stone-400">
            <MapPin size={9} />
            {incident.purok}
            <span className="mx-0.5">&middot;</span>
            {incident.reporter}
          </p>
        </div>
      )}

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">AVAILABLE ON-DUTY TANODS</p>
      <div className="mb-4 space-y-2">
        {ON_DUTY_TANODS.filter((t) => t.availability === "available").map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 transition ${
              selected === t.id ? "border-[#0038A8]/40 bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                {t.name.replace("Team ", "")}
              </span>
              <span className="text-left">
                <span className="block text-[12px] font-semibold text-stone-900">{t.name}</span>
                <span className="block text-[10px] text-stone-400">{t.members} members · nearest to {t.purok}</span>
              </span>
            </span>
            {selected === t.id && <CheckCircle2 size={15} className="text-[#0038A8]" />}
          </button>
        ))}
      </div>

      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">TURN-BY-TURN ROUTE GUIDANCE</p>
        <div className="space-y-1.5">
          {ROUTE_STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-stone-600">
              <Navigation size={11} className={i === 0 ? "text-[#0038A8]" : "text-stone-300"} />
              <span className="flex-1">{s.text}</span>
              <span className="text-[10px] font-medium text-stone-400">{s.dist}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 border-t border-stone-200 pt-2 text-[10px] text-stone-500">
          <BellRing size={10} className="text-[#0038A8]" />
          High-priority vibration + audio push fired on assignment
        </p>
      </div>
    </Modal>
  );
}

function RouteModal({ dispatch, onClose }) {
  if (!dispatch) return null;
  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Route Guidance"
      subtitle={`${dispatch.incident} · ${dispatch.team}`}
      icon={<Navigation size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
    >
      <div className="mb-4 relative h-44 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        <svg viewBox="0 0 400 170" className="h-full w-full">
          <rect x="0" y="0" width="400" height="170" fill="#F8FAFC" />
          <path d="M60 140 C 120 120, 140 60, 330 40" fill="none" stroke="#0038A8" strokeWidth="3" strokeDasharray="6 5" />
          <path d="M60 140 C 120 120, 140 60, 330 40" fill="none" stroke="#fff" strokeWidth="1" opacity="0.5" />
          {ROUTE_STEPS.map((_, i) => (
            <circle key={i} cx={60 + i * 135} cy={140 - i * 50} r="4" fill={i === 0 ? "#0038A8" : i === ROUTE_STEPS.length - 1 ? "#dc2626" : "#0038A8"} stroke="white" strokeWidth="2" />
          ))}
          <text x="52" y="150" textAnchor="middle" fontSize="9" fill="#0038A8" fontWeight="700">HQ</text>
          <text x="330" y="32" textAnchor="middle" fontSize="9" fill="#dc2626" fontWeight="700">INCIDENT</text>
        </svg>
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[9px] font-semibold text-stone-600 shadow-sm">
          <MapPin size={9} className="text-[#0038A8]" />
          {dispatch.purok} · {dispatch.distance}
        </span>
      </div>

      <div className="mb-5 space-y-2">
        {ROUTE_STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
            <Navigation size={11} className={i === 0 ? "text-[#0038A8]" : "text-stone-300"} />
            <span className="flex-1">{s.text}</span>
            <span className="text-[10px] font-medium text-stone-400">{s.dist}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <Timer size={13} />
          Fastest route {dispatch.eta}
        </span>
        <span className="text-[10px] text-emerald-600">Push navigation active</span>
      </div>
    </Modal>
  );
}

function ChatModal({ team, onClose }) {
  const [messages, setMessages] = useState(CHAT_SEED[team] ?? []);
  const [input, setInput] = useState("");
  const { flash } = useToast();

  function send() {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { id: `m${Date.now()}`, from: "me", text: input.trim(), time: new Date().toISOString() }]);
    setInput("");
    flash("Message sent");
  }

  return (
    <Modal size="md" panelClass="overflow-hidden">
      <div className="-m-5 flex h-[480px] flex-col sm:-m-6">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
              {team.replace("Team ", "")}
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-stone-900">{team}</h2>
              <p className="text-[10px] text-stone-400">Operations Chat · {team} unit</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.from === "me" ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-stone-50 text-stone-800"}`}>
                <p className="text-[12px] leading-snug">{m.text}</p>
                <p className={`mt-1 text-[9px] ${m.from === "me" ? "text-white/60" : "text-stone-400"}`}>{formatTime(m.time)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Message ${team}...`}
            className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          />
          <button onClick={send} disabled={!input.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0038A8] text-white transition hover:bg-[#002A8C] disabled:opacity-40">
            <Send size={13} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

// §14.6 — Reassign modal: select new team, choose reason (with custom text for "Other")
function ReassignModal({ dispatch, onClose, onReassign, availableTeams }) {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [reason, setReason] = useState<ReassignReason>("Team unavailable");
  const [customReason, setCustomReason] = useState("");
  const effectiveTeam = selectedTeam || availableTeams[0]?.id || "";

  function submit() {
    if (!effectiveTeam || !reason) return;
    onReassign(dispatch.id, effectiveTeam, reason, reason === "Other" ? customReason : undefined);
  }

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Reassign Dispatch"
      subtitle={`${dispatch.id} · ${dispatch.incident} · currently ${dispatch.team}`}
      icon={<RefreshCcw size={18} className="text-amber-600" />}
      iconClass="bg-amber-50"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!effectiveTeam}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCcw size={13} />
            Confirm Reassignment
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-stone-900">{dispatch.incident}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DISPATCH_META[dispatch.status].badge}`}>
            {DISPATCH_META[dispatch.status].label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-stone-600">Purok: {dispatch.purok} · Priority: {dispatch.priority}</p>
      </div>

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REASSIGN TO</p>
      <div className="mb-4 space-y-2">
        {availableTeams.map((team) => {
          const isActive = effectiveTeam === team.id;
          const alreadyAssigned = team.name === dispatch.team;
          return (
            <button
              key={team.id}
              onClick={() => !alreadyAssigned && setSelectedTeam(team.id)}
              disabled={alreadyAssigned}
              className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 transition ${
                isActive ? "border-amber-400 bg-amber-50" : alreadyAssigned ? "border-stone-100 bg-stone-50 opacity-50 cursor-not-allowed" : "border-stone-200 bg-white hover:bg-stone-50"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${alreadyAssigned ? "bg-stone-400" : "bg-amber-600"}`}>
                  {team.name.replace("Team ", "")}
                </span>
                <span className="text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-stone-900">{team.name}</span>
                    {alreadyAssigned && <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">Current</span>}
                    {team.availability === "available" && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">Available</span>}
                  </span>
                  <span className="block text-[10px] text-stone-400">{team.members} members · {team.purok}</span>
                </span>
              </span>
              {isActive && <CheckCircle2 size={15} className="text-amber-600" />}
            </button>
          );
        })}
      </div>

      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REASON</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {REASSIGN_REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
              reason === r ? "border-amber-400 bg-amber-50 text-amber-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {reason === "Other" && (
        <textarea
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="Specify reassignment reason…"
          className="mb-3 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-700 placeholder:text-stone-300 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
          rows={2}
        />
      )}

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <ShieldAlert size={12} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-[10px] leading-snug text-stone-600">
          Reassignment records the previous team, new team, reason, officer, and timestamp. The resident is automatically notified of the team change.
        </p>
      </div>
    </Modal>
  );
}

export default function ActiveDispatches() {
  const { flash, ToastPortal } = useToast();

  const [unassigned, setUnassigned] = useState<Incident[]>(INITIAL_UNASSIGNED);
  const [dispatches, setDispatches] = useState<Dispatch[]>(INITIAL_DISPATCHES);
  const evidence = INITIAL_EVIDENCE;
  const [residentUpdates, setResidentUpdates] = useState<ResidentUpdate[]>(INITIAL_RESIDENT_UPDATES);

  const [assignIncident, setAssignIncident] = useState<Incident | null>(null);
  const [routeTarget, setRouteTarget] = useState<Dispatch | null>(null);
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  // §14.4 — Reassignment state
  const [reassignTarget, setReassignTarget] = useState<Dispatch | null>(null);

  function confirmAssign(teamId: string) {
    const inc = assignIncident;
    if (!inc) return;
    const team = ON_DUTY_TANODS.find((t) => t.id === teamId)?.name ?? "Team Bravo";
    const dispatchId = `DP-${1183 + dispatches.length}`;
    setDispatches((prev) => [
      { id: dispatchId, incident: inc.id, team, status: "responding", purok: inc.purok, reporter: inc.reporter, time: new Date().toISOString(), eta: "ETA 3 min", distance: "1.1 km", evidence: 0, priority: inc.priority },
      ...prev,
    ]);
    const channel = residentUpdateChannel(inc.priority);
    setResidentUpdates((prev) => [
      { id: `RU-${53 + prev.length}`, dispatch: dispatchId, trackingId: `Tracking ${8000 + prev.length}`, channel, message: `${team} is responding to your ${inc.category.toLowerCase()} report`, time: new Date().toISOString(), status: "sent" },
      ...prev,
    ]);
    setUnassigned((prev) => prev.filter((i) => i.id !== inc.id));
    setAssignIncident(null);
    flash(`${inc.id} dispatched to ${team} — resident notified via ${channel === "Push + SMS" ? "push + SMS" : "push"}`);
  }

  function advanceStatus(id: string) {
    const dp = dispatches.find((d) => d.id === id);
    if (!dp) return;
    const next = DISPATCH_META[dp.status].next;
    if (!next) return;
    setDispatches((prev) => prev.map((d) => (d.id === id ? { ...d, status: next, eta: next === "resolved" ? "Closed" : d.eta } : d)));
    const channel = residentUpdateChannel(dp.priority);
    setResidentUpdates((prev) => [
      { id: `RU-${53 + prev.length}`, dispatch: dp.id, trackingId: `Tracking ${8000 + prev.length}`, channel, message: `${TRANSITION_MESSAGE[next]}`, time: new Date().toISOString(), status: "sent" },
      ...prev,
    ]);
    flash(`${dp.id} → ${DISPATCH_META[next].label}. Resident auto-notified via ${channel === "Push + SMS" ? "push + SMS" : "push"}`);
  }

  // §14.5 — Reassignment handler. Records history, updates dispatch, notifies resident.
  function reassignDispatch(dispatchId: string, newTeamId: string, reason: ReassignReason, customReason?: string) {
    const dp = dispatches.find((d) => d.id === dispatchId);
    if (!dp) return;
    const newTeam = ON_DUTY_TANODS.find((t) => t.id === newTeamId)?.name ?? "Team Charlie";
    const historyEntry = { from: dp.team, to: newTeam, reason, customReason, reassignedBy: "Desk Officer", reassignedAt: new Date().toISOString() };
    setDispatches((prev) =>
      prev.map((d) =>
        d.id === dispatchId
          ? { ...d, team: newTeam, assignmentHistory: [...(d.assignmentHistory ?? []), historyEntry] }
          : d
      )
    );
    const channel = residentUpdateChannel(dp.priority);
    setResidentUpdates((prev) => [
      { id: `RU-${53 + prev.length}`, dispatch: dispatchId, trackingId: `Tracking ${8000 + prev.length}`, channel, message: `${newTeam} has been assigned to your case (reassigned from ${dp.team})`, time: new Date().toISOString(), status: "sent" },
      ...prev,
    ]);
    setReassignTarget(null);
    flash(`${dp.id} reassigned to ${newTeam}. Reason: ${reason}. Resident notified.`);
  }

  function retryUpdate(id: string) {
    setResidentUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, status: "queued" } : u)));
    flash(`${id} re-queued for delivery`);
    setTimeout(() => {
      setResidentUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, status: "sent" } : u)));
    }, 1500);
  }

  const active = dispatches.filter((d) => d.status !== "resolved");
  const responding = dispatches.filter((d) => d.status === "responding").length;
  const onScene = dispatches.filter((d) => d.status === "on_scene").length;
  const resolving = dispatches.filter((d) => d.status === "resolving").length;
  const resolvedToday = dispatches.filter((d) => d.status === "resolved").length;
  const available = ON_DUTY_TANODS.filter((t) => t.availability === "available").length;

  const kpis = [
    { label: "ACTIVE DISPATCHES", value: active.length, sub: `${responding} responding · ${onScene} on scene`, icon: Radio },
    { label: "RESOLVING NOW", value: resolving, sub: "units finishing on-scene work", icon: Shield },
    { label: "UNASSIGNED QUEUE", value: unassigned.length, sub: `${available} tanod units available`, icon: ClipboardList },
    { label: "RESOLVED TODAY", value: resolvedToday, sub: "cases closed & logged", icon: CheckCircle2 },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Active Dispatches</h1>
              <p className="mt-1 text-sm text-stone-500">
                Assignment, routing &amp; live on-scene monitoring of field responders
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {available} Units Available
              </span>
              <button
                onClick={() => unassigned[0] && setAssignIncident(unassigned[0])}
                disabled={unassigned.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
              >
                <Send size={13} />
                Assign Next
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

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 520 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Active Dispatch Queue</h3>
                  <p className="text-[11px] text-[#94A3B8]">Strict state machine: Responding → On-Scene → Resolving → Resolved</p>
                </div>
              </div>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700">{active.length} active</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {dispatches.map((dp, i) => {
                const meta = DISPATCH_META[dp.status];
                return (
                  <div key={dp.id} className={`px-5 py-3 ${i < dispatches.length - 1 ? "border-b border-black/5" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12px] font-bold text-stone-900">{dp.id}</span>
                        <span className="text-[11px] text-stone-500">{dp.incident} · {dp.purok}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
                          <Users size={11} className="text-[#0038A8]" />
                          {dp.team}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-stone-400">
                          <Timer size={10} className="text-emerald-500" />
                          {dp.eta}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-stone-400">
                          <Navigation size={10} />
                          {dp.distance}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-stone-400">
                      <MapPin size={9} />
                      {dp.reporter}
                      <span className="mx-0.5">&middot;</span>
                      <Clock size={9} />
                      {formatTime(dp.time)}
                      {dp.evidence > 0 && (
                        <>
                          <span className="mx-0.5">&middot;</span>
                          <ImageIcon size={9} />
                          {dp.evidence} evidence
                        </>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setRouteTarget(dp)}
                        className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        <Navigation size={11} />
                        Route
                      </button>
                      <button
                        onClick={() => setChatTarget(dp.team)}
                        className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        <MessageSquare size={11} />
                        Message
                      </button>
                      {dp.evidence > 0 && (
                        <button
                          onClick={() => flash(`${dp.id} evidence: ${dp.evidence} item(s) in the On-Scene stream below`)}
                          className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <Eye size={11} />
                          Evidence
                        </button>
                      )}
                      {/* §14.7 — Reassign button only shown for active (non-resolved) dispatches */}
                      {meta.action && (
                        <button
                          onClick={() => setReassignTarget(dp)}
                          className="flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          <RefreshCcw size={11} />
                          Reassign
                        </button>
                      )}
                      {meta.action && (
                        <button
                          onClick={() => advanceStatus(dp.id)}
                          className="flex h-7 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                        >
                          <CheckCircle2 size={11} />
                          {meta.action}
                        </button>
                      )}
                    </div>
                    {/* §14.8 — Show assignment history if this dispatch was reassigned */}
                    {dp.assignmentHistory && dp.assignmentHistory.length > 0 && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2">
                        <p className="text-[9px] font-semibold tracking-wide text-amber-600">REASSIGNMENT HISTORY</p>
                        {dp.assignmentHistory.map((entry, idx) => (
                          <p key={idx} className="mt-0.5 text-[10px] text-stone-500">
                            <span className="font-medium text-stone-600">{entry.from}</span> → <span className="font-medium text-stone-600">{entry.to}</span>
                            {" · "}{entry.reason}{entry.customReason ? `: ${entry.customReason}` : ""}
                            {" · "}{entry.reassignedBy} · {formatTime(entry.reassignedAt)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Triage Intake</h3>
                  <p className="text-[11px] text-[#94A3B8]">Verified incidents ready for assignment</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-600">{unassigned.length}</span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {unassigned.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[12px] text-stone-400">Queue cleared — all incidents assigned</p>
                </div>
              ) : (
                unassigned.map((inc) => {
                  const sev = SEVERITY_MAP[inc.severity];
                  const SrcIcon = SOURCE_ICON[inc.source] || AlertTriangle;
                  const CatIcon = CATEGORY_ICON[inc.category] || AlertTriangle;
                  const catColors = CATEGORY_COLORS[inc.category] || { bg: "bg-stone-100", text: "text-stone-600" };
                  return (
                    <div key={inc.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-md ${catColors.bg} ${catColors.text}`}>
                            <CatIcon size={12} />
                          </span>
                          <span className="text-[11px] font-bold text-stone-900">{inc.id}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                        </div>
                        <span className="flex items-center gap-1 text-[9px] text-stone-400">
                          <SrcIcon size={9} />
                          {inc.source}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug text-stone-600">{inc.description}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-stone-400">
                        <MapPin size={9} />
                        {inc.purok}
                        <span className="mx-0.5">&middot;</span>
                        <Clock size={9} />
                        {formatTime(inc.time)}
                      </p>
                      <button
                        onClick={() => setAssignIncident(inc)}
                        className="mt-2 flex h-7 w-full items-center justify-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                      >
                        <Send size={11} />
                        Assign &amp; Dispatch
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">On-Scene Evidence Stream</h3>
                  <p className="text-[11px] text-[#94A3B8]">Photos, videos &amp; situation notes uploaded by field Tanods</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <Activity size={11} />
                Live uploads
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {evidence.map((ev, i) => {
                const meta = EVIDENCE_META[ev.type];
                const Icon = meta.icon;
                const dispatch = dispatches.find((d) => d.id === ev.dispatch);
                return (
                  <div key={ev.id} className={`flex items-start gap-3 px-5 py-3 ${i < evidence.length - 1 ? "border-b border-black/5" : ""}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.pill}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-stone-900">{ev.label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${meta.pill}`}>{meta.label}</span>
                        <span className="text-[10px] text-stone-400">{ev.author} · {ev.dispatch}{dispatch ? ` · ${dispatch.incident}` : ""}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone-500">{ev.note}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                        <Clock size={9} />
                        {formatTime(ev.time)}
                      </p>
                    </div>
                    <button
                      onClick={() => flash(`${ev.type.toUpperCase()} — ${ev.label} by ${ev.author}`)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      <Eye size={11} />
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <BellRing size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Automated Resident Updates</h3>
                  <p className="text-[11px] text-[#94A3B8]">Push on every shift — SMS only for high-priority incidents</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <Activity size={11} />
                Auto
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {residentUpdates.map((u) => {
                const statusMeta = NOTIFICATION_STATUS_META[u.status];
                const chPill = channelPill(u.channel);
                const ChannelIcon = chPill.icon;
                return (
                  <div key={u.id} className={`rounded-lg border bg-white px-3.5 py-3 ${u.status === "failed" ? "border-rose-200" : "border-stone-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#0038A8]">{u.id}</span>
                      <span className="flex items-center gap-1 text-[9px] text-stone-400">
                        <Smartphone size={9} />
                        {u.trackingId}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-stone-700">{u.message}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${chPill.badge}`}>
                          <ChannelIcon size={9} />
                          {u.channel}
                        </span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${statusMeta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot} ${u.status === "queued" ? "animate-pulse" : ""}`} />
                          {statusMeta.label}
                        </span>
                        {u.status === "failed" && (
                          <button
                            onClick={() => retryUpdate(u.id)}
                            className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            <RefreshCw size={9} />
                            Retry
                          </button>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[9px] text-stone-400">
                        <Clock size={9} />
                        {formatTime(u.time)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">On-Duty Tanod Coverage</h3>
                  <p className="text-[11px] text-[#94A3B8]">Responder availability for assignment</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 px-5 pb-5">
              {ON_DUTY_TANODS.map((t) => (
                <div key={t.id} className={`flex items-center justify-between rounded-lg border px-3.5 py-3 ${t.availability === "available" ? "border-stone-200 bg-white" : "border-sky-200 bg-sky-50/60"}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                      {t.name.replace("Team ", "")}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-stone-900">{t.name}</p>
                      <p className="text-[10px] text-stone-400">{t.members} members · {t.purok}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${t.availability === "available" ? "bg-emerald-50 text-emerald-600" : "bg-sky-100 text-sky-700"}`}>
                    {t.availability === "available" ? <CheckCircle2 size={9} /> : <Navigation size={9} />}
                    {t.availability === "available" ? "Available" : "Dispatched"}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <PhoneCall size={12} className="text-[#0038A8]" />
                <p className="text-[10px] text-stone-500">Message any active unit via the Operations Chat Center</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Operations Chat — Field Units</h3>
                  <p className="text-[11px] text-[#94A3B8]">Quick status clarifications with active responders</p>
                </div>
              </div>
              {chatTarget && (
                <button onClick={() => setChatTarget(null)} className="flex items-center gap-0.5 text-[11px] font-medium text-[#0038A8] hover:underline">
                  Close <X size={11} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto px-5 pb-3">
              {ON_DUTY_TANODS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setChatTarget(t.name)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                    chatTarget === t.name ? "border-[#0038A8]/30 bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[#0038A8] text-[9px] font-bold text-white">
                    {t.name.replace("Team ", "")}
                    <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white ${t.availability === "available" ? "bg-emerald-500" : "bg-sky-400"}`} />
                  </span>
                  <span className="text-left">
                    <span className="block text-[11px] font-semibold leading-tight text-stone-900">{t.name}</span>
                    <span className="block text-[9px] leading-tight text-stone-400">{t.availability === "available" ? "Available" : "Dispatched"}</span>
                  </span>
                  <ChevronRight size={12} className="text-stone-300" />
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {chatTarget ? (
                <div className="space-y-2">
                  {(CHAT_SEED[chatTarget] ?? []).map((m) => (
                    <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.from === "me" ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-stone-50 text-stone-800"}`}>
                        <p className="text-[11px] leading-snug">{m.text}</p>
                        <p className={`mt-0.5 text-[9px] ${m.from === "me" ? "text-white/60" : "text-stone-400"}`}>{formatTime(m.time)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                    <MessageSquare size={11} className="text-[#0038A8]" />
                    <p className="text-[10px] text-stone-500">Message {chatTarget} directly from the full chat window</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10">
                  <MessageSquare size={20} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">Select a field unit above to preview the thread</p>
                  <p className="mt-0.5 text-[10px] text-stone-400">Open the full Operations Chat Center for active conversations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {assignIncident && (
        <AssignModal incident={assignIncident} onClose={() => setAssignIncident(null)} onAssign={confirmAssign} />
      )}

      {reassignTarget && (
        <ReassignModal
          dispatch={reassignTarget}
          onClose={() => setReassignTarget(null)}
          onReassign={reassignDispatch}
          availableTeams={ON_DUTY_TANODS}
        />
      )}

      {routeTarget && <RouteModal dispatch={routeTarget} onClose={() => setRouteTarget(null)} />}

      {chatTarget && <ChatModal team={chatTarget} onClose={() => setChatTarget(null)} />}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
