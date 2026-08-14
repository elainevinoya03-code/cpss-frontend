import { useMemo, useState } from "react";
import {
  ClipboardList,
  MapPin,
  Clock,
  Users,
  ImageIcon,
  Info,
  ListFilter,
  CheckCircle2,
  Ban,
  CalendarDays,
  Check,
  Gauge,
  Eye,
  Send,
  Scale,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { PUROK_ZONES, PUROK_LEADER_JURISDICTION } from "../constants/purok";
import { usePurokIncidents } from "./incidentStore";

type Priority = "critical" | "warning" | "low";
type ValidationLabel = "Confirmed" | "False Information" | "Event-Related";
type QueueFilter = "all" | "awaiting" | "escalated" | ValidationLabel;

interface Incident {
  id: string;
  category: string;
  title: string;
  description: string;
  reporter: string;
  reporterPurok: string;
  lat: number;
  lng: number;
  reportedAt: string;
  suggestedPriority: Priority;
  photos: number;
  label?: ValidationLabel;
  labeledAt?: string;
  escalated?: boolean;
  escalatedAt?: string;
  escalationNotes?: string;
}

const JURISDICTION_ZONE_ID = PUROK_LEADER_JURISDICTION.zoneId;
const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
  "Crime/Suspicious Activity": { bg: "bg-sky-50", text: "text-sky-600" },
  "Road Obstruction": { bg: "bg-violet-50", text: "text-violet-600" },
};

const LABEL_META: Record<ValidationLabel, { badge: string; desc: string }> = {
  "Confirmed": { badge: "bg-emerald-100 text-emerald-700", desc: "Verified as a real, local concern" },
  "False Information": { badge: "bg-stone-200 text-stone-600", desc: "Report determined to be invalid" },
  "Event-Related": { badge: "bg-amber-100 text-amber-700", desc: "Attributable to a scheduled local event" },
};

const PRIORITY_ADJUSTMENT: Record<ValidationLabel, Record<Priority, Priority>> = {
  "Confirmed": { critical: "critical", warning: "warning", low: "low" },
  "False Information": { critical: "warning", warning: "low", low: "low" },
  "Event-Related": { critical: "warning", warning: "low", low: "low" },
};

const LABEL_ACTIVE: Record<ValidationLabel, string> = {
  "Confirmed": "border-emerald-500 bg-emerald-500 text-white",
  "False Information": "border-stone-500 bg-stone-500 text-white",
  "Event-Related": "border-amber-500 bg-amber-500 text-white",
};

const LABEL_IDLE: Record<ValidationLabel, string> = {
  "Confirmed": "border-stone-200 text-stone-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
  "False Information": "border-stone-200 text-stone-500 hover:border-stone-400 hover:bg-stone-100 hover:text-stone-700",
  "Event-Related": "border-stone-200 text-stone-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700",
};

const LABEL_ACTIONS: { key: ValidationLabel; icon: typeof CheckCircle2 }[] = [
  { key: "Confirmed", icon: CheckCircle2 },
  { key: "False Information", icon: Ban },
  { key: "Event-Related", icon: CalendarDays },
];

const INITIAL_INCIDENTS: Incident[] = [
  {
    id: "INC-2101",
    category: "Crime/Suspicious Activity",
    title: "Suspicious persons at market gate",
    description: "Three unknown individuals observed loitering near the market gate since morning; residents report they approach parked motorcycles.",
    reporter: "Jay Dela Peña",
    reporterPurok: "Purok 5",
    lat: 108,
    lng: 195,
    reportedAt: "2026-07-20T10:12:00",
    suggestedPriority: "critical",
    photos: 3,
  },
  {
    id: "INC-2100",
    category: "Fire/Smoke",
    title: "Cooking smoke near eatery row",
    description: "Smoke seen rising from eatery row beside the public market; no open flames confirmed yet.",
    reporter: "Carlo Reyes",
    reporterPurok: "Purok 4",
    lat: 112,
    lng: 205,
    reportedAt: "2026-07-20T09:40:00",
    suggestedPriority: "warning",
    photos: 2,
  },
  {
    id: "INC-2099",
    category: "Road Obstruction",
    title: "Vendor cart blocking market alley",
    description: "A vendor cart has been blocking the alley between market stalls, restricting access for deliveries.",
    reporter: "Maria Santos",
    reporterPurok: "Purok 3",
    lat: 105,
    lng: 200,
    reportedAt: "2026-07-20T08:50:00",
    suggestedPriority: "low",
    photos: 1,
    label: "Confirmed",
    labeledAt: "2026-07-20T09:15:00",
  },
  {
    id: "INC-2098",
    category: "Noise Disturbance",
    title: "Fiesta karaoke noise at plaza",
    description: "Loud karaoke from the fiesta stage at the plaza; scheduled barangay fiesta celebration today.",
    reporter: "Rosa Garcia",
    reporterPurok: "Purok 3",
    lat: 100,
    lng: 205,
    reportedAt: "2026-07-20T07:35:00",
    suggestedPriority: "warning",
    photos: 1,
    label: "Event-Related",
    labeledAt: "2026-07-20T08:05:00",
  },
  {
    id: "INC-2097",
    category: "Noise Disturbance",
    title: "Construction hammering before 6 AM",
    description: "Hammering and drilling from a storefront renovation started before 6:00 AM, disturbing nearby homes.",
    reporter: "Ana Lim",
    reporterPurok: "Purok 3",
    lat: 118,
    lng: 190,
    reportedAt: "2026-07-20T06:20:00",
    suggestedPriority: "warning",
    photos: 1,
  },
  {
    id: "INC-2096",
    category: "Fire/Smoke",
    title: "Burning garbage at back alley",
    description: "Report of burning garbage in the back alley; upon verification the pile was already extinguished and cleared.",
    reporter: "Tomas Cruz",
    reporterPurok: "Purok 6",
    lat: 90,
    lng: 180,
    reportedAt: "2026-07-19T22:05:00",
    suggestedPriority: "warning",
    photos: 2,
    label: "False Information",
    labeledAt: "2026-07-19T22:30:00",
  },
  {
    id: "INC-2095",
    category: "Fire/Smoke",
    title: "House fire near riverside",
    description: "Smoke rising from a riverside residence; possible electrical fire reported by a neighbor.",
    reporter: "Pedro Reyes",
    reporterPurok: "Purok 1",
    lat: 108,
    lng: 88,
    reportedAt: "2026-07-20T10:30:00",
    suggestedPriority: "critical",
    photos: 4,
  },
  {
    id: "INC-2094",
    category: "Noise Disturbance",
    title: "Loud party at chapel area",
    description: "Large gathering with loud music at the chapel area past quiet hours.",
    reporter: "Juan Dela Cruz",
    reporterPurok: "Purok 2",
    lat: 225,
    lng: 85,
    reportedAt: "2026-07-20T09:05:00",
    suggestedPriority: "warning",
    photos: 2,
  },
  {
    id: "INC-2093",
    category: "Crime/Suspicious Activity",
    title: "Loitering near school gate",
    description: "Unfamiliar persons loitering near the school gate after dismissal.",
    reporter: "Sara Lim",
    reporterPurok: "Purok 4",
    lat: 218,
    lng: 205,
    reportedAt: "2026-07-20T08:20:00",
    suggestedPriority: "warning",
    photos: 1,
  },
  {
    id: "INC-2092",
    category: "Road Obstruction",
    title: "Fallen tree blocking main road",
    description: "Fallen tree branch partially blocking the main road near the basketball court.",
    reporter: "Liza Mendoza",
    reporterPurok: "Purok 5",
    lat: 155,
    lng: 320,
    reportedAt: "2026-07-19T19:40:00",
    suggestedPriority: "low",
    photos: 1,
  },
  {
    id: "INC-2091",
    category: "Noise Disturbance",
    title: "Karaoke near evac zone",
    description: "Karaoke session near the evacuation zone continuing late into the night.",
    reporter: "Bea Torres",
    reporterPurok: "Purok 6",
    lat: 330,
    lng: 290,
    reportedAt: "2026-07-19T17:15:00",
    suggestedPriority: "low",
    photos: 1,
  },
  {
    id: "INC-2090",
    category: "Crime/Suspicious Activity",
    title: "Burglary report at residence",
    description: "Resident reports a burglary attempt at a residence; suspects fled on foot.",
    reporter: "Dan Cruz",
    reporterPurok: "Purok 2",
    lat: 225,
    lng: 85,
    reportedAt: "2026-07-19T15:00:00",
    suggestedPriority: "critical",
    photos: 3,
  },
];

function parsePath(path: string): { x: number; y: number }[] {
  const nums = path.match(/[-\d.]+/g);
  const pts: { x: number; y: number }[] = [];
  if (!nums) return pts;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return pts;
}

function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function zoneOfPoint(lat: number, lng: number): string | null {
  for (const zone of PUROK_ZONES) {
    if (pointInPolygon({ x: lat, y: lng }, parsePath(zone.path))) return zone.id;
  }
  return null;
}

function matchesJurisdiction(inc: Incident): boolean {
  if (inc.reporterPurok === JURISDICTION_NAME) return true;
  return zoneOfPoint(inc.lat, inc.lng) === JURISDICTION_ZONE_ID;
}

function matchReasons(inc: Incident): string[] {
  const reasons: string[] = [];
  if (inc.reporterPurok === JURISDICTION_NAME) reasons.push(`Reporter registered in ${JURISDICTION_NAME}`);
  if (zoneOfPoint(inc.lat, inc.lng) === JURISDICTION_ZONE_ID) reasons.push(`GPS location inside ${JURISDICTION_NAME} boundaries`);
  return reasons;
}

function zoneNameOf(inc: Incident): string | null {
  const id = zoneOfPoint(inc.lat, inc.lng);
  return PUROK_ZONES.find((z) => z.id === id)?.name ?? null;
}

function adjustedPriority(inc: Incident): Priority {
  if (!inc.label) return inc.suggestedPriority;
  return PRIORITY_ADJUSTMENT[inc.label][inc.suggestedPriority];
}

function dotColor(inc: Incident): string {
  if (!inc.label) return "#0038A8";
  if (inc.label === "Confirmed") return "#10b981";
  if (inc.label === "Event-Related") return "#f59e0b";
  return "#a8a29e";
}

function EscalateModal({
  incident,
  onClose,
  onConfirm,
}: {
  incident: Incident;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState(false);
  const sev = SEVERITY_MAP[adjustedPriority(incident)];

  function submit() {
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }
    onConfirm(notes.trim());
  }

  return (
    <Modal
      onClose={onClose}
      title="Transfer to Desk Officer"
      subtitle={`${incident.id} · unresolved case`}
      icon={<Send size={15} />}
      iconClass="bg-[#0038A8]/5 text-[#0038A8]"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
            Cancel
          </button>
          <button
            onClick={submit}
            className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Send size={12} />
            Transfer to Desk Officer
          </button>
        </div>
      }
    >
      <div className="mt-4 space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold text-stone-900">{incident.title}</span>
              {incident.label && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${LABEL_META[incident.label].badge}`}>
                  {incident.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-stone-500">
              {incident.category} · reported by {incident.reporter} ({incident.reporterPurok}) · GPS {incident.lat}, {incident.lng}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-stone-400">Suggested priority:</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-stone-700">
              Notes for the Desk Officer <span className="text-rose-500">*</span>
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (notesError && e.target.value.trim()) setNotesError(false);
              }}
              rows={4}
              placeholder="e.g. Verified with neighboring residents — sustained concern in the market area. Recommend dispatch during peak hours..."
              className={`w-full resize-none rounded-lg border px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 ${
                notesError
                  ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/30"
                  : "border-stone-200 focus:border-[#0038A8] focus:ring-[#0038A8]/30"
              }`}
            />
            {notesError && <p className="mt-1 text-[10px] font-medium text-rose-600">Escalation notes are required — attach local context before transferring.</p>}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
            <Scale size={13} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              The Desk Officer retains <span className="font-semibold">final authority</span> over priority assignment and ultimate disposition. Your validation label and notes inform their triage.
            </p>
          </div>
        </div>
    </Modal>
  );
}

export default function PurokIncidentsQueue() {
  const { flash, ToastPortal } = useToast();
  const { escalate } = usePurokIncidents();
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [escalating, setEscalating] = useState<Incident | null>(null);

  const streamIncidents = useMemo(() => incidents.filter(matchesJurisdiction), [incidents]);

  const awaiting = streamIncidents.filter((i) => !i.label);
  const confirmed = streamIncidents.filter((i) => i.label === "Confirmed");
  const falseInfo = streamIncidents.filter((i) => i.label === "False Information");
  const eventRelated = streamIncidents.filter((i) => i.label === "Event-Related");
  const escalated = streamIncidents.filter((i) => i.escalated);

  const filtered = useMemo(() => {
    if (queueFilter === "awaiting") return awaiting;
    if (queueFilter === "escalated") return escalated;
    if (queueFilter === "Confirmed" || queueFilter === "False Information" || queueFilter === "Event-Related") {
      return streamIncidents.filter((i) => i.label === queueFilter);
    }
    return streamIncidents;
  }, [queueFilter, streamIncidents, awaiting, escalated]);

  const filterTabs: { key: QueueFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: streamIncidents.length },
    { key: "awaiting", label: "Awaiting Review", count: awaiting.length },
    { key: "Confirmed", label: "Confirmed", count: confirmed.length },
    { key: "Event-Related", label: "Event-Related", count: eventRelated.length },
    { key: "False Information", label: "False Info", count: falseInfo.length },
    { key: "escalated", label: "Escalated", count: escalated.length },
  ];

  const kpis = [
    { label: "ACTIVE STREAM", value: streamIncidents.length, sub: `incidents in ${JURISDICTION_NAME}`, icon: ClipboardList },
    { label: "AWAITING REVIEW", value: awaiting.length, sub: "needs community validation", icon: Eye },
    { label: "CONFIRMED", value: confirmed.length, sub: "verified local concerns", icon: CheckCircle2 },
    { label: "FALSE INFORMATION", value: falseInfo.length, sub: "invalid reports", icon: Ban },
  ];

  const validationMix = [
    { label: "Awaiting Review", count: awaiting.length, color: "#0038A8" },
    { label: "Confirmed", count: confirmed.length, color: "#10b981" },
    { label: "Event-Related", count: eventRelated.length, color: "#f59e0b" },
    { label: "False Information", count: falseInfo.length, color: "#a8a29e" },
    { label: "Escalated", count: escalated.length, color: "#002A8C" },
  ];
  const mixMax = Math.max(streamIncidents.length, 1);

  function applyLabel(id: string, label: ValidationLabel) {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, label, labeledAt: new Date().toISOString() } : inc))
    );
    flash(`${id} marked as ${label}`);
  }

  function confirmEscalation(notes: string) {
    if (!escalating) return;
    const inc = escalating;
    escalate({
      id: inc.id,
      category: inc.category,
      title: inc.title,
      reporter: inc.reporter,
      purok: inc.reporterPurok,
      label: inc.label,
      suggestedPriority: adjustedPriority(inc),
      notes,
    });
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === inc.id ? { ...i, escalated: true, escalatedAt: new Date().toISOString(), escalationNotes: notes } : i
      )
    );
    flash(`${inc.id} transferred to the Barangay Desk Officer`);
    setEscalating(null);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Purok Incidents Queue</h1>
              <p className="mt-1 text-sm text-stone-500">
                Community validation &amp; stream review for your assigned purok
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <MapPin size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">ASSIGNED JURISDICTION</p>
                <p className="text-[12px] font-bold text-[#0038A8]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              Your stream is auto-filtered to incidents tied to <span className="font-semibold text-stone-800">{JURISDICTION_LABEL}</span> — by the reporter's registered purok or the incident's GPS location within purok boundaries. Labels you apply tune the suggested priority, but the <span className="font-semibold text-stone-800">Barangay Desk Officer retains final authority</span> over priority assignment and ultimate disposition.
            </p>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <ListFilter size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Incident Stream — {JURISDICTION_NAME}</h3>
                  <p className="text-[11px] text-[#94A3B8]">Auto-filtered to your assigned jurisdiction</p>
                </div>
              </div>
              <span className="rounded-full bg-[#0038A8]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8]">
                {streamIncidents.length} in stream
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-stone-100 px-5 py-3">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setQueueFilter(t.key)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    queueFilter === t.key
                      ? "border-[#0038A8] bg-[#0038A8] text-white"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 opacity-70">({t.count})</span>
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <CheckCircle2 size={22} className="mb-2 text-emerald-400" />
                  <p className="text-[12px] font-medium text-stone-500">No incidents in this view</p>
                  <p className="text-[10px] text-stone-400">Adjust the filter to see more of your stream</p>
                </div>
              ) : (
                filtered.map((inc) => {
                  const adj = adjustedPriority(inc);
                  const origSev = SEVERITY_MAP[inc.suggestedPriority];
                  const adjSev = SEVERITY_MAP[adj];
                  const zone = zoneNameOf(inc);
                  const reasons = matchReasons(inc);
                  const category = CATEGORY_COLORS[inc.category];
                  return (
                    <div key={inc.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{inc.id}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${category?.bg ?? "bg-stone-100"} ${category?.text ?? "text-stone-600"}`}>
                            {inc.category}
                          </span>
                          {inc.label && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${LABEL_META[inc.label].badge}`}>
                              <Check size={9} />
                              {inc.label}
                            </span>
                          )}
                          {inc.escalated && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                              <ArrowUpRight size={9} />
                              Escalated
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-stone-400">
                          <Clock size={10} />
                          {formatTime(inc.reportedAt)}
                        </span>
                      </div>

                      <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{inc.title}</h4>
                      <p className="mt-0.5 text-[11px] text-stone-500">{inc.description}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <Users size={10} />
                          {inc.reporter} · {inc.reporterPurok}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <MapPin size={10} />
                          GPS {inc.lat}, {inc.lng}
                          {zone ? ` · ${zone}` : ""}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <ImageIcon size={10} />
                          {inc.photos} photos
                        </span>
                      </div>

                      {reasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {reasons.map((r) => (
                            <span key={r} className="inline-flex items-center gap-1 rounded-md bg-[#0038A8]/5 px-2 py-1 text-[9px] font-medium text-[#0038A8]">
                              <CheckCircle2 size={9} />
                              {r}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                        <Gauge size={12} className="text-stone-400" />
                        <span className="text-[10px] text-stone-500">
                          {inc.label ? `Suggested priority after "${inc.label}":` : "Suggested priority:"}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${adjSev.badge}`}>{adjSev.label}</span>
                        {inc.label && inc.suggestedPriority !== adj && (
                          <span className="text-[10px] text-stone-400">(was {origSev.label})</span>
                        )}
                        {inc.label && inc.suggestedPriority === adj && (
                          <span className="text-[10px] text-stone-400">no change</span>
                        )}
                        {!inc.label && (
                          <span className="text-[10px] text-stone-400">awaiting community validation</span>
                        )}
                      </div>

                      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                        {LABEL_ACTIONS.map(({ key, icon: Icon }) => {
                          const active = inc.label === key;
                          return (
                            <button
                              key={key}
                              onClick={() => applyLabel(inc.id, key)}
                              title={LABEL_META[key].desc}
                              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${active ? LABEL_ACTIVE[key] : LABEL_IDLE[key]}`}
                            >
                              <Icon size={11} />
                              {key}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
                        <p className="flex items-center gap-1 text-[10px] text-stone-400">
                          <ShieldCheck size={11} className="text-stone-300" />
                          Desk Officer holds final authority over priority &amp; disposition
                        </p>
                        <button
                          onClick={() => setEscalating(inc)}
                          disabled={inc.escalated}
                          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                        >
                          <Send size={11} />
                          {inc.escalated ? "Transferred" : "Transfer to Desk Officer"}
                        </button>
                      </div>

                      {inc.escalated && (
                        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
                          <p className="flex items-center gap-1 text-[10px] font-semibold text-blue-700">
                            <ArrowUpRight size={10} />
                            Transferred to Barangay Desk Officer
                          </p>
                          <p className="mt-0.5 text-[10px] italic leading-snug text-stone-600">"{inc.escalationNotes}"</p>
                          {inc.escalatedAt && <p className="mt-0.5 text-[9px] text-stone-400">{formatTime(inc.escalatedAt)}</p>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4">
              <MapPin size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Jurisdiction Map</h3>
                <p className="text-[11px] text-[#94A3B8]">Purok boundaries · GPS-anchored incidents</p>
              </div>
            </div>

            <div className="px-5">
              <svg viewBox="0 0 400 400" className="w-full">
                {PUROK_ZONES.map((z) => {
                  const active = z.id === JURISDICTION_ZONE_ID;
                  return (
                    <path
                      key={z.id}
                      d={z.path}
                      fill={active ? z.color : "#e7e5e4"}
                      fillOpacity={active ? 0.18 : 0.55}
                      stroke={active ? z.color : "#d6d3d1"}
                      strokeWidth={active ? 2.5 : 1}
                    />
                  );
                })}
                {PUROK_ZONES.map((z) => {
                  const active = z.id === JURISDICTION_ZONE_ID;
                  return (
                    <text
                      key={`${z.id}-label`}
                      x={z.labelX}
                      y={z.labelY}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={active ? 700 : 500}
                      fill={active ? "#0038A8" : "#a8a29e"}
                    >
                      {z.name}
                      {active ? " · you" : ""}
                    </text>
                  );
                })}
                {incidents.map((inc) => {
                  const inStream = matchesJurisdiction(inc);
                  return (
                    <circle
                      key={inc.id}
                      cx={inc.lat}
                      cy={inc.lng}
                      r={inStream ? 5.5 : 3.5}
                      fill={inStream ? dotColor(inc) : "#cbc5bb"}
                      stroke="#ffffff"
                      strokeWidth={inStream ? 1.5 : 1}
                      opacity={inStream ? 1 : 0.4}
                    >
                      <title>{inc.id} — {inc.title}</title>
                    </circle>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-[10px] text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0038A8]" /> Awaiting
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Event-Related
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-400" /> False Info
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 opacity-60" /> Other purok
              </span>
            </div>

            <div className="border-t border-stone-100 px-5 py-4">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">VALIDATION MIX — {JURISDICTION_NAME}</p>
              <div className="space-y-2.5">
                {validationMix.map((m) => (
                  <div key={m.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-stone-600">{m.label}</span>
                      <span className="text-[10px] font-semibold text-[#0038A8]">{m.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full" style={{ width: `${(m.count / mixMax) * 100}%`, backgroundColor: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {escalating && <EscalateModal incident={escalating} onClose={() => setEscalating(null)} onConfirm={confirmEscalation} />}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
