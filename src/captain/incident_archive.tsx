import { useState, useMemo } from "react";
import {
  Archive,
  Clock,
  CheckCircle2,
  XCircle,
  Heart,
  Star,
  ClipboardCheck,
  ClipboardList,
  Lock,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import { formatTime } from "../utils/format";
import { Modal } from "../components/ui";

type IncidentStatus = "resolved" | "closed" | "false_alarm";

const STATUS_META: Record<IncidentStatus, { label: string; badge: string }> = {
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Closed", badge: "bg-sky-100 text-sky-700" },
  false_alarm: { label: "Closed – False Alarm", badge: "bg-stone-100 text-stone-600" },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All Status" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
  { key: "false_alarm", label: "False Alarm" },
];

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  warning: "bg-amber-100 text-amber-700",
  low: "bg-stone-100 text-stone-600",
};

const UPDATE_DOT: Record<string, string> = {
  alert: "bg-rose-400",
  dispatch: "bg-sky-400",
  broadcast: "bg-purple-400",
  response: "bg-emerald-400",
  milestone: "bg-amber-400",
  closeout: "bg-stone-400",
  advisory: "bg-teal-400",
};

const UPDATE_LABEL: Record<string, string> = {
  closeout: "Closed",
  advisory: "Post-Incident Advisory",
};

interface MockIncident {
  id: string;
  title: string;
  severity: "critical" | "warning" | "low";
  status: IncidentStatus;
  purok: string;
  detectedAt: string;
  resolvedAt: string;
  closureReason: string;
  description: string;
  impact: {
    fatalities: number;
    injuries: number;
    displaced: number;
    housesDamaged: number;
    estimatedDamagePHP: number;
    assistanceProvided: string;
  };
  updates: { time: string; event: string; type: string }[];
  residentFeedback: { resident: string; purok: string; rating: number; comment: string; time: string }[];
}

const MOCK_INCIDENTS: MockIncident[] = [
  {
    id: "INC-2041",
    title: "Structure Fire — Purok 4 Residential",
    severity: "critical",
    status: "resolved",
    purok: "Purok 4",
    detectedAt: "2026-07-14T22:15:00",
    resolvedAt: "2026-07-15T01:30:00",
    closureReason: "Fire fully extinguished and scene cleared; investigation handed to the BFP arson unit. All Clear advisory broadcast to Purok 4 residents.",
    description: "Structure fire in residential area near the school district. 3 houses damaged, 12 families displaced. BFP response time: 14 minutes.",
    impact: {
      fatalities: 0,
      injuries: 2,
      displaced: 12,
      housesDamaged: 3,
      estimatedDamagePHP: 2400000,
      assistanceProvided: "12 families relocated to Barangay Hall; DSWD relief packs distributed",
    },
    updates: [
      { time: "2026-07-14T22:15:00", event: "Smoke detected by IoT sensor SM-PUROK4-01", type: "alert" },
      { time: "2026-07-14T22:17:00", event: "Desk Officer dispatched tanod units", type: "dispatch" },
      { time: "2026-07-14T22:19:00", event: "Emergency broadcast sent to Purok 4 residents", type: "broadcast" },
      { time: "2026-07-14T22:25:00", event: "Tanod Team Alpha arrived on scene", type: "response" },
      { time: "2026-07-14T22:29:00", event: "BFP Unit 1 arrived, began suppression", type: "response" },
      { time: "2026-07-14T23:15:00", event: "Fire declared under control", type: "milestone" },
      { time: "2026-07-14T23:45:00", event: "Incident mitigated — all hotspots extinguished", type: "milestone" },
      { time: "2026-07-15T01:30:00", event: "Scene cleared, investigation handed to BFP arson unit", type: "closeout" },
      { time: "2026-07-15T08:00:00", event: "All Clear advisory broadcast to Purok 4 residents", type: "advisory" },
    ],
    residentFeedback: [
      { resident: "Maricel Ramos", purok: "Purok 4", rating: 5, comment: "The tanod and BFP response was fast. We felt safe the whole time, thank you to the entire team.", time: "2026-07-16T09:30:00" },
      { resident: "Nestor Villanueva", purok: "Purok 4", rating: 4, comment: "Good coordination and clear announcements. Relief packs took a few hours but overall we were taken care of.", time: "2026-07-16T11:00:00" },
      { resident: "Liza Ocampo", purok: "Purok 4", rating: 3, comment: "The all-clear advisory could have been sent earlier. Some of us were anxious waiting for updates.", time: "2026-07-16T14:20:00" },
    ],
  },
  {
    id: "INC-2040",
    title: "Mass Noise Disturbance — Purok 6 Commercial Strip",
    severity: "warning",
    status: "resolved",
    purok: "Purok 6",
    detectedAt: "2026-07-17T19:30:00",
    resolvedAt: "2026-07-17T20:15:00",
    closureReason: "Noise returned to permitted levels; establishment advised on curfew compliance. Resolution advisory sent to Purok 6 residents.",
    description: "Sustained excessive noise from a commercial establishment past permitted hours. Multiple resident complaints.",
    impact: {
      fatalities: 0,
      injuries: 0,
      displaced: 0,
      housesDamaged: 0,
      estimatedDamagePHP: 0,
      assistanceProvided: "",
    },
    updates: [
      { time: "2026-07-17T19:30:00", event: "Noise sensor DB-MARKET-01 exceeded threshold", type: "alert" },
      { time: "2026-07-17T19:35:00", event: "Desk Officer notified via IoT Command Center", type: "dispatch" },
      { time: "2026-07-17T19:40:00", event: "Tanod Team Charlie dispatched to scene", type: "dispatch" },
      { time: "2026-07-17T19:50:00", event: "Establishment owner contacted, agreed to lower volume", type: "response" },
      { time: "2026-07-17T20:15:00", event: "Noise levels returned to normal — incident mitigated", type: "milestone" },
      { time: "2026-07-17T20:20:00", event: "Resolution advisory broadcast to Purok 6 residents", type: "advisory" },
    ],
    residentFeedback: [
      { resident: "Benjie Soriano", purok: "Purok 6", rating: 5, comment: "Responded quickly and the noise stopped within the hour. Very efficient.", time: "2026-07-18T08:15:00" },
      { resident: "Daisy Mercado", purok: "Purok 6", rating: 4, comment: "Glad it was resolved. Hopefully the automated alert prevents this from happening again.", time: "2026-07-18T09:40:00" },
    ],
  },
  {
    id: "INC-2042",
    title: "Suspicious Activity Report — Purok 2 Chapel Area",
    severity: "warning",
    status: "resolved",
    purok: "Purok 2",
    detectedAt: "2026-07-19T18:45:00",
    resolvedAt: "2026-07-19T19:30:00",
    closureReason: "Investigation found no security threat; group referred to DSWD for temporary shelter assistance. Area declared secure.",
    description: "Multiple reports of unknown individuals loitering near the Chapel area with suspicious behavior. Patrol units dispatched to investigate.",
    impact: {
      fatalities: 0,
      injuries: 0,
      displaced: 0,
      housesDamaged: 0,
      estimatedDamagePHP: 0,
      assistanceProvided: "Group referred to DSWD for temporary shelter assistance",
    },
    updates: [
      { time: "2026-07-19T18:45:00", event: "Resident report received via Purok 2 leader", type: "alert" },
      { time: "2026-07-19T18:50:00", event: "Tanod Team Bravo dispatched", type: "dispatch" },
      { time: "2026-07-19T19:05:00", event: "Team arrived, identified group as transients", type: "response" },
      { time: "2026-07-19T19:20:00", event: "Group directed to Barangay Hall for assistance", type: "response" },
      { time: "2026-07-19T19:30:00", event: "Area cleared, incident mitigated", type: "milestone" },
      { time: "2026-07-19T19:45:00", event: "All Clear advisory broadcast to Purok 2", type: "advisory" },
    ],
    residentFeedback: [
      { resident: "Karlo De Guzman", purok: "Purok 2", rating: 4, comment: "Patrol came quickly and reassured us. Good to know the area is safe.", time: "2026-07-19T20:30:00" },
      { resident: "Fe Cabrera", purok: "Purok 2", rating: 5, comment: "Thank you for handling it calmly and helping the group get assistance.", time: "2026-07-19T21:05:00" },
    ],
  },
  {
    id: "INC-2043",
    title: "Flash Flood Warning — Purok 3 & 5 Low-Lying Areas",
    severity: "critical",
    status: "resolved",
    purok: "Purok 3 & 5",
    detectedAt: "2026-07-20T06:00:00",
    resolvedAt: "2026-07-20T09:30:00",
    closureReason: "Floodwaters receded and area declared secure; all 45 evacuated families accounted for at the evacuation center.",
    description: "Heavy overnight rain caused river levels to rise rapidly. Low-lying areas in Purok 3 and 5 flooded. 45 families evacuated to Barangay Hall.",
    impact: {
      fatalities: 0,
      injuries: 0,
      displaced: 45,
      housesDamaged: 8,
      estimatedDamagePHP: 1800000,
      assistanceProvided: "45 families relocated to evacuation center; DSWD relief packs and hot meals distributed",
    },
    updates: [
      { time: "2026-07-20T06:00:00", event: "River level sensor triggered critical threshold", type: "alert" },
      { time: "2026-07-20T06:05:00", event: "Emergency broadcast sent to Purok 3 & 5", type: "broadcast" },
      { time: "2026-07-20T06:10:00", event: "All tanod teams activated for evacuation", type: "dispatch" },
      { time: "2026-07-20T06:30:00", event: "Evacuation of Purok 5 Block A initiated", type: "response" },
      { time: "2026-07-20T07:15:00", event: "45 families relocated to evacuation center", type: "milestone" },
      { time: "2026-07-20T09:30:00", event: "Water levels receding — area secured", type: "milestone" },
    ],
    residentFeedback: [
      { resident: "Jojo Manalo", purok: "Purok 3", rating: 5, comment: "The evacuation was organized. Everyone was accounted for quickly.", time: "2026-07-20T12:30:00" },
      { resident: "Aling Selya Reyes", purok: "Purok 5", rating: 4, comment: "We were worried about our homes but the teams were very helpful moving us to the hall.", time: "2026-07-20T13:45:00" },
      { resident: "Ramon Galang", purok: "Purok 5", rating: 3, comment: "Communication was good during the evacuation but hot meals could have been prepared sooner.", time: "2026-07-20T15:10:00" },
    ],
  },
  {
    id: "INC-2044",
    title: "IoT Sensor Failure — Purok 3 Smoke Detector Offline",
    severity: "low",
    status: "closed",
    purok: "Purok 3",
    detectedAt: "2026-07-20T08:00:00",
    resolvedAt: "2026-07-21T14:00:00",
    closureReason: "Equipment-only incident; field inspection confirmed water damage and a waterproof replacement sensor was ordered.",
    description: "Smoke detector SM-PUROK3-01 went offline during the flood event. Device likely water-damaged.",
    impact: {
      fatalities: 0,
      injuries: 0,
      displaced: 0,
      housesDamaged: 0,
      estimatedDamagePHP: 15000,
      assistanceProvided: "",
    },
    updates: [
      { time: "2026-07-20T08:00:00", event: "Sensor SM-PUROK3-01 reported offline", type: "alert" },
      { time: "2026-07-20T08:05:00", event: "IoT Command Center flagged device failure", type: "dispatch" },
      { time: "2026-07-20T10:00:00", event: "Field inspection confirmed water damage", type: "response" },
      { time: "2026-07-21T14:00:00", event: "Waterproof replacement sensor ordered — incident closed", type: "closeout" },
    ],
    residentFeedback: [
      { resident: "Berna Pascual", purok: "Purok 3", rating: 3, comment: "Good that it was caught, but the smoke detector being down for days is worrying.", time: "2026-07-20T16:00:00" },
    ],
  },
  {
    id: "INC-2045",
    title: "Cooking Smoke False Alarm — Purok 1",
    severity: "low",
    status: "false_alarm",
    purok: "Purok 1",
    detectedAt: "2026-07-21T11:20:00",
    resolvedAt: "2026-07-21T11:40:00",
    closureReason: "Verified as cooking smoke from a residential kitchen; no fire or hazard present. Resident informed and sensor reset.",
    description: "Smoke detector SM-PUROK1-02 triggered during midday cooking. Tanod team verified no fire or hazard present.",
    impact: {
      fatalities: 0,
      injuries: 0,
      displaced: 0,
      housesDamaged: 0,
      estimatedDamagePHP: 0,
      assistanceProvided: "",
    },
    updates: [
      { time: "2026-07-21T11:20:00", event: "Smoke detector SM-PUROK1-02 triggered", type: "alert" },
      { time: "2026-07-21T11:25:00", event: "Tanod team dispatched to verify", type: "dispatch" },
      { time: "2026-07-21T11:35:00", event: "Verified as cooking smoke — no hazard", type: "response" },
      { time: "2026-07-21T11:40:00", event: "Resident informed, sensor reset — closed as false alarm", type: "closeout" },
    ],
    residentFeedback: [
      { resident: "Tony Dela Cruz", purok: "Purok 1", rating: 4, comment: "The tanod checked quickly and reassured us it was just cooking smoke. Good to know the system works.", time: "2026-07-21T12:00:00" },
    ],
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-stone-300"}
        />
      ))}
    </div>
  );
}

function ClosedIncidentDetail({ incident, onClose }: { incident: MockIncident; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("summary");
  const status = STATUS_META[incident.status];

  const tabs = [
    { key: "summary", label: "Incident Summary", icon: ClipboardCheck },
    { key: "updates", label: `Update History (${incident.updates.length})`, icon: Clock },
    { key: "impact", label: "Impact Summary", icon: ClipboardList },
    { key: "feedback", label: `Resident Feedback (${incident.residentFeedback?.length ?? 0})`, icon: Heart },
  ];

  return (
    <Modal
      side="right"
      size="2xl"
      onClose={onClose}
      title={incident.title}
      subtitle={`${incident.purok} · Detected ${formatTime(incident.detectedAt)}`}
      aside={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-stone-400">{incident.id}</span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[incident.severity]}`}>
            {incident.severity}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${status.badge}`}>
            {status.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-2 py-0.5 text-[10px] font-semibold text-[#0038A8]">
            <Lock size={10} />
            READ-ONLY
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-stone-400">
            Closed {formatTime(incident.resolvedAt)} · Read-only review — cannot reopen or modify
          </span>
          <span className="flex items-center gap-1.5 text-stone-400">
            <CheckCircle2 size={12} className="text-emerald-500" />
            {status.label}
          </span>
        </div>
      }
    >
      <div className="flex overflow-x-auto border-b border-stone-100 px-6 scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] font-medium transition ${
              activeTab === key
                ? "border-[#0038A8] text-[#0038A8]"
                : "border-transparent text-stone-400 hover:text-stone-600"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5">
        {activeTab === "summary" && (
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-[10px] font-medium tracking-wider text-stone-400">INCIDENT SUMMARY</p>
              <p className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-[12px] leading-relaxed text-stone-700">
                {incident.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">
                <Clock size={10} /> Detected {formatTime(incident.detectedAt)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">
                {incident.purok}
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[incident.severity]}`}>
                {incident.severity} severity
              </span>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-[12px] font-semibold text-emerald-800">{status.label}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-stone-600">
                Resolution / closure at <span className="font-medium text-stone-800">{formatTime(incident.resolvedAt)}</span>
              </p>
              <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-2.5">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">CLOSURE REASON</p>
                <p className="mt-1 text-[12px] leading-relaxed text-stone-700">{incident.closureReason}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="space-y-0">
            {incident.updates.map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ${UPDATE_DOT[entry.type] ?? "bg-stone-300"}`} />
                  {i < incident.updates.length - 1 && <div className="w-px flex-1 bg-stone-200" />}
                </div>
                <div className="pb-5">
                  <p className="text-[10px] text-stone-400">{formatTime(entry.time)}</p>
                  <p className="text-[12px] text-stone-800">{entry.event}</p>
                  {UPDATE_LABEL[entry.type] && (
                    <span className="mt-0.5 inline-block rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
                      {UPDATE_LABEL[entry.type]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "impact" && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[10px] font-medium tracking-wider text-stone-400">IMPACT SUMMARY</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">{incident.impact.fatalities} fatalities</span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">{incident.impact.injuries} injured</span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">{incident.impact.displaced} displaced</span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">{incident.impact.housesDamaged} houses damaged</span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">
                  ₱{incident.impact.estimatedDamagePHP.toLocaleString()} est. damage
                </span>
              </div>
              {incident.impact.assistanceProvided && (
                <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5">
                  <p className="text-[10px] font-medium text-sky-700">Assistance Provided</p>
                  <p className="mt-0.5 text-[11px] text-stone-600">{incident.impact.assistanceProvided}</p>
                </div>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-stone-400">
              Impact figures are final as recorded at closure and cannot be modified by the Captain.
            </p>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="space-y-4">
            {incident.residentFeedback && incident.residentFeedback.length > 0 ? (
              <>
                <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium tracking-wider text-stone-400">AVG RESIDENT RATING</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating rating={incident.residentFeedback.reduce((a, f) => a + f.rating, 0) / incident.residentFeedback.length} />
                        <span className="text-[18px] font-bold text-stone-900">
                          {(incident.residentFeedback.reduce((a, f) => a + f.rating, 0) / incident.residentFeedback.length).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-stone-400">/ 5</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium tracking-wider text-stone-400">RESPONSES</p>
                      <p className="mt-1 text-[18px] font-bold text-stone-900">{incident.residentFeedback.length}</p>
                    </div>
                  </div>
                </div>
                {incident.residentFeedback.map((f, i) => (
                  <div key={i} className="rounded-lg border border-stone-100 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E9EDFB] text-[11px] font-semibold text-[#0038A8]">
                          {f.resident.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </span>
                        <div>
                          <p className="text-[12px] font-medium text-stone-800">{f.resident}</p>
                          <p className="text-[10px] text-stone-400">{f.purok} · {formatTime(f.time)}</p>
                        </div>
                      </div>
                      <StarRating rating={f.rating} />
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-stone-600">"{f.comment}"</p>
                  </div>
                ))}
              </>
            ) : (
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-6 text-center">
                <Heart size={20} className="mx-auto text-stone-300" />
                <p className="mt-2 text-[12px] text-stone-400">No resident feedback yet</p>
                <p className="mt-1 text-[10px] text-stone-300">Feedback appears once residents rate this incident</p>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-stone-400">
              Feedback is used for executive evaluation of service quality, not individual case management.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function IncidentArchive() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<MockIncident | null>(null);

  const filtered = useMemo(() => {
    return MOCK_INCIDENTS.filter((inc) => {
      if (filterStatus !== "all" && inc.status !== filterStatus) return false;
      if (filterSeverity !== "all" && inc.severity !== filterSeverity) return false;
      if (searchQuery && !inc.title.toLowerCase().includes(searchQuery.toLowerCase()) && !inc.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [filterStatus, filterSeverity, searchQuery]);

  const total = MOCK_INCIDENTS.length;
  const resolved = MOCK_INCIDENTS.filter((i) => i.status === "resolved").length;
  const falseAlarms = MOCK_INCIDENTS.filter((i) => i.status === "false_alarm").length;
  const allFeedback = MOCK_INCIDENTS.flatMap((i) => i.residentFeedback);
  const avgRating = allFeedback.length ? allFeedback.reduce((a, f) => a + f.rating, 0) / allFeedback.length : 0;

  const kpis = [
    { label: "CLOSED INCIDENTS", value: total, sub: "Resolved, closed & false alarms", icon: Archive },
    { label: "RESOLVED", value: resolved, sub: "Confirmed and closed cases", icon: CheckCircle2 },
    { label: "CLOSED – FALSE ALARM", value: falseAlarms, sub: "Verified — no hazard found", icon: XCircle },
    { label: "AVG RESIDENT RATING", value: avgRating ? avgRating.toFixed(1) : "–", sub: `${allFeedback.length} responses`, icon: Heart },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Closed Incidents</h1>
              <p className="mt-1 text-sm text-stone-500">
                Read-only review of resolved and closed incidents: incident summary, closure reason, update history, impact and resident feedback
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-bold tracking-widest text-white">
                <Lock size={13} />
                READ-ONLY
              </span>
              <button
                onClick={() => { setFilterStatus("all"); setFilterSeverity("all"); setSearchQuery(""); }}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50"
              >
                <RefreshCw size={12} />
                Reset
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Lock size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              Executive outcome review only. Closed incident records — summary, resolution/closure
              timestamp, closure reason, update history, impact and resident feedback — are final and
              <span className="font-semibold text-stone-800"> cannot be reopened, modified, or re-stated</span>.
              Feedback is used for executive evaluation of service quality, not individual case management.
            </p>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-stone-400">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.key}
                onClick={() => setFilterStatus(sf.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  filterStatus === sf.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
            {["all", "critical", "warning", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  filterSeverity === sev ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {sev === "all" ? "All Severity" : sev}
              </button>
            ))}
          </div>

          <div className="relative ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search closed incidents..."
              className="w-56 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-700 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-stone-900">Closed Incident Records</h3>
                <p className="text-[11px] text-stone-400">{filtered.length} closed incidents · Click to review</p>
              </div>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto scrollbar-hide">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Archive size={24} className="mx-auto text-stone-300" />
                <p className="mt-2 text-[12px] text-stone-400">No closed incidents match your filters</p>
              </div>
            ) : (
              filtered.map((inc, i, arr) => (
                <div
                  key={inc.id}
                  className={`flex items-start gap-4 px-5 py-4 transition hover:bg-stone-50/80 cursor-pointer ${
                    i < arr.length - 1 ? "border-b border-black/5" : ""
                  }`}
                  onClick={() => setSelectedIncident(inc)}
                >
                  <div className="mt-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                      inc.severity === "critical" ? "bg-rose-500" : inc.severity === "warning" ? "bg-amber-400" : "bg-stone-300"
                    }`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-stone-400">{inc.id}</span>
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${SEVERITY_BADGE[inc.severity]}`}>
                        {inc.severity}
                      </span>
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_META[inc.status].badge}`}>
                        {STATUS_META[inc.status].label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] font-semibold text-stone-900 truncate">{inc.title}</p>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {inc.purok} · Detected {formatTime(inc.detectedAt)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-stone-400">Closed {formatTime(inc.resolvedAt)}</span>
                    <span className="flex items-center gap-1 text-[10px] text-stone-400">
                      <Heart size={10} className="text-rose-400" />
                      {inc.residentFeedback.length} feedback
                    </span>
                  </div>

                  <ChevronRight size={16} className="mt-2 text-stone-300" />
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {selectedIncident && (
        <ClosedIncidentDetail
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}
