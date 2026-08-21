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
  Eye,
  Send,
  Scale,
  ShieldCheck,
  RadioTower,
  MessageCircleQuestion,
  FolderCheck,
} from "lucide-react";
import { Modal } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";
import {
  usePurokIncidents,
  inJurisdiction,
  zoneOfPoint,
  ValidationOutcome,
  PurokReport,
} from "./incidentStore";

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

type QueueFilter =
  | "all"
  | "awaiting"
  | "Confirmed"
  | "Event-Related"
  | "Marked Invalid"
  | "clarification"
  | "closed";

type ActionMode = "confirm" | "invalid" | "event" | "clarify" | "close";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
  "Crime/Suspicious Activity": { bg: "bg-sky-50", text: "text-sky-600" },
  "Road Obstruction": { bg: "bg-violet-50", text: "text-violet-600" },
  "Community Welfare": { bg: "bg-teal-50", text: "text-teal-600" },
};

const OUTCOME_META: Record<ValidationOutcome, { badge: string; desc: string }> = {
  Confirmed: { badge: "bg-emerald-100 text-emerald-700", desc: "Verified as a real, local concern" },
  "Marked Invalid": { badge: "bg-stone-200 text-stone-600", desc: "False or insufficiently supported" },
  "Event-Related": { badge: "bg-amber-100 text-amber-700", desc: "Connected to a known local event" },
};

const ACTION_META: Record<ActionMode, { title: string; button: string; placeholder: string; icon: typeof CheckCircle2; chip: string }> = {
  confirm: {
    title: "Confirm Report",
    button: "Confirm",
    placeholder: "e.g. Verified with neighboring residents — this is an ongoing concern...",
    icon: CheckCircle2,
    chip: "bg-emerald-50 text-emerald-700",
  },
  invalid: {
    title: "Mark as Invalid",
    button: "Mark Invalid",
    placeholder: "e.g. Checked the location — nothing found / report is not supported by what's on site...",
    icon: Ban,
    chip: "bg-stone-100 text-stone-600",
  },
  event: {
    title: "Mark Event-Related",
    button: "Mark Event-Related",
    placeholder: "e.g. This matches the scheduled barangay fiesta program tonight...",
    icon: CalendarDays,
    chip: "bg-amber-50 text-amber-700",
  },
  clarify: {
    title: "Request Clarification",
    button: "Request Clarification",
    placeholder: "e.g. Asked the reporter for the exact address and time of the incident...",
    icon: MessageCircleQuestion,
    chip: "bg-sky-50 text-sky-700",
  },
  close: {
    title: "Close Locally",
    button: "Close Locally",
    placeholder: "e.g. Resolved within the purok — no Desk Officer action needed...",
    icon: FolderCheck,
    chip: "bg-blue-50 text-blue-700",
  },
};

const PUROK_ZONES_NAMES: Record<string, string> = {
  p1: "Purok 1",
  p2: "Purok 2",
  p3: "Purok 3",
  p4: "Purok 4",
  p5: "Purok 5",
  p6: "Purok 6",
};

function zoneNameOf(r: PurokReport): string | null {
  const id = zoneOfPoint(r.lat, r.lng);
  return (id && PUROK_ZONES_NAMES[id]) ?? null;
}

// ─── Note modal for local validation actions ─────────────────────────────────

function ActionModal({
  mode,
  report,
  onClose,
  onConfirm,
}: {
  mode: ActionMode;
  report: PurokReport;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const meta = ACTION_META[mode];
  const Icon = meta.icon;

  const summary: Record<ActionMode, string> = {
    confirm: `Marks ${report.id} as locally verified. The official priority and disposition remain with the Desk Officer.`,
    invalid: `Records ${report.id} as false or insufficiently supported. You can still close it locally afterwards.`,
    event: `Records ${report.id} as connected to a known local event rather than a new concern.`,
    clarify: `Records that more details are needed from the reporter before further validation of ${report.id}.`,
    close: `Closes ${report.id} locally — it moves out of your active queue and needs no Desk Officer action.`,
  };

  return (
    <Modal
      onClose={onClose}
      title={meta.title}
      subtitle={`${report.id} · local validation`}
      icon={<Icon size={15} />}
      iconClass={meta.chip}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Icon size={12} />
            {meta.button}
          </button>
        </div>
      }
    >
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-stone-900">{report.title}</span>
            {report.outcome && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${OUTCOME_META[report.outcome].badge}`}>
                {report.outcome}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-stone-500">
            {report.category} · {report.source === "sensor" ? `${report.reporter}` : `${report.reporter} (${report.reporterPurok ?? report.purok})`}
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-stone-500">{summary[mode]}</p>

        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-stone-700">
            Local verification note <span className="font-normal text-stone-400">(optional)</span>
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={meta.placeholder}
            className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          />
          <p className="mt-1 text-[10px] text-stone-400">Saved alongside the action with a timestamp for the record.</p>
        </div>

        {(mode === "confirm" || mode === "invalid" || mode === "event") && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
            <Scale size={13} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              This is a <span className="font-semibold">local validation</span> only — it does not change the official priority, dispatch Tanods, or create blotter records.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Escalation modal (single escalation entry point) ────────────────────────

function EscalateModal({
  report,
  onClose,
  onConfirm,
}: {
  report: PurokReport;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);

  function submit() {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    onConfirm(note.trim());
  }

  return (
    <Modal
      onClose={onClose}
      title="Escalate to Desk Officer"
      subtitle={`${report.id} · handoff to the operations desk`}
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
            Escalate Case
          </button>
        </div>
      }
    >
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
          <p className="mb-1.5 text-[9px] font-semibold tracking-wider text-stone-400">CASE SUMMARY</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-stone-900">{report.title}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CATEGORY_COLORS[report.category]?.bg ?? "bg-stone-100"} ${CATEGORY_COLORS[report.category]?.text ?? "text-stone-600"}`}>
              {report.category}
            </span>
            {report.outcome && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${OUTCOME_META[report.outcome].badge}`}>
                {report.outcome}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-stone-500">{report.description}</p>
          <p className="mt-1.5 text-[10px] text-stone-500">
            {report.source === "sensor" ? (
              <>Sensor alert from {report.deviceId}{report.metric ? ` · ${report.metric}` : ""}</>
            ) : (
              <>Reported by {report.reporter} ({report.reporterPurok ?? report.purok})</>
            )}
            {" · "}GPS {report.lat}, {report.lng} · {formatTime(report.reportedAt)}
          </p>
          {report.validationNote && (
            <p className="mt-1.5 rounded-md bg-white px-2 py-1.5 text-[10px] italic text-stone-500">
              Validation note: &ldquo;{report.validationNote}&rdquo;
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-stone-700">
            Handoff note <span className="text-rose-500">*</span>
          </p>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError && e.target.value.trim()) setNoteError(false);
            }}
            rows={4}
            placeholder="Concise local context or preliminary findings so the Desk Officer doesn't start from scratch..."
            className={`w-full resize-none rounded-lg border px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 ${
              noteError
                ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/30"
                : "border-stone-200 focus:border-[#0038A8] focus:ring-[#0038A8]/30"
            }`}
          />
          {noteError && (
            <p className="mt-1 text-[10px] font-medium text-rose-600">A handoff note is required — attach local context before escalating.</p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
          <Scale size={13} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            Your escalation is <span className="font-semibold">advisory</span>. The Desk Officer remains responsible for priority changes, dispatch, blotter handling, and final disposition.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LocalReports() {
  const { flash, ToastPortal } = useToast();
  const { activeReports, closedLocalReports, validateReport, requestClarification, closeLocally, escalate } =
    usePurokIncidents();

  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [actionMode, setActionMode] = useState<{ mode: ActionMode; report: PurokReport } | null>(null);
  const [escalating, setEscalating] = useState<PurokReport | null>(null);

  // Automatic jurisdiction filter — assigned purok + digital boundary.
  const localActive = useMemo(() => activeReports.filter(inJurisdiction), [activeReports]);
  const localClosed = useMemo(() => closedLocalReports.filter(inJurisdiction), [closedLocalReports]);

  const sensorCount = localActive.filter((r) => r.source === "sensor").length;
  const awaiting = localActive.filter((r) => !r.outcome && !r.clarification);
  const clarified = localActive.filter((r) => r.clarification);

  const filtered = useMemo(() => {
    switch (queueFilter) {
      case "awaiting":
        return localActive.filter((r) => !r.outcome && !r.clarification);
      case "clarification":
        return localActive.filter((r) => r.clarification);
      case "Confirmed":
      case "Event-Related":
      case "Marked Invalid":
        return localActive.filter((r) => r.outcome === queueFilter);
      case "closed":
        return localClosed;
      default:
        return localActive;
    }
  }, [queueFilter, localActive, localClosed]);

  const filterTabs: { key: QueueFilter; label: string; count: number }[] = [
    { key: "all", label: "All Active", count: localActive.length },
    { key: "awaiting", label: "Awaiting Review", count: awaiting.length },
    { key: "Confirmed", label: "Confirmed", count: localActive.filter((r) => r.outcome === "Confirmed").length },
    { key: "Event-Related", label: "Event-Related", count: localActive.filter((r) => r.outcome === "Event-Related").length },
    { key: "Marked Invalid", label: "Marked Invalid", count: localActive.filter((r) => r.outcome === "Marked Invalid").length },
    { key: "clarification", label: "Clarification", count: clarified.length },
    { key: "closed", label: "Closed Locally", count: localClosed.length },
  ];

  const kpis = [
    { label: "ACTIVE LOCAL REPORTS", value: localActive.length, sub: `within ${JURISDICTION_NAME}`, icon: ClipboardList },
    { label: "AWAITING REVIEW", value: awaiting.length, sub: "need community validation", icon: Eye },
    { label: "SENSOR ALERTS", value: sensorCount, sub: "medium severity · in queue", icon: RadioTower },
    { label: "CLOSED LOCALLY", value: localClosed.length, sub: "no Desk Officer action needed", icon: FolderCheck },
  ];

  function handleAction(note: string) {
    if (!actionMode) return;
    const { mode, report } = actionMode;
    if (mode === "confirm") {
      validateReport(report.id, "Confirmed", note);
      flash(`${report.id} confirmed as locally verified`);
    } else if (mode === "invalid") {
      validateReport(report.id, "Marked Invalid", note);
      flash(`${report.id} marked invalid — false or insufficiently supported`);
    } else if (mode === "event") {
      validateReport(report.id, "Event-Related", note);
      flash(`${report.id} marked as event-related`);
    } else if (mode === "clarify") {
      requestClarification(report.id, note);
      flash(`${report.id} — clarification requested from the reporter`);
    } else {
      closeLocally(report.id, note);
      flash(`${report.id} closed locally — no Desk Officer action needed`);
    }
    setActionMode(null);
  }

  function confirmEscalation(note: string) {
    if (!escalating) return;
    escalate(escalating.id, note);
    flash(`${escalating.id} escalated to the Desk Officer with your handoff note`);
    setEscalating(null);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Local Reports</h1>
              <p className="mt-1 text-sm text-stone-500">
                Resident reports &amp; medium-severity sensor alerts in your assigned purok
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
              This queue is auto-filtered to reports inside <span className="font-semibold text-stone-800">{JURISDICTION_LABEL}</span> — matched by the reporter's registered purok or GPS position inside the purok boundary. Medium-severity IoT alerts appear here labeled <span className="font-semibold text-stone-800">Sensor Alert</span>; high-severity emergencies bypass this page and route directly to the Desk Officer's command center. Your validation is advisory — the <span className="font-semibold text-stone-800">Desk Officer retains final authority</span>.
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

        <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <ListFilter size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Unified Report Queue — {JURISDICTION_NAME}</h3>
                <p className="text-[11px] text-[#94A3B8]">One queue for resident reports and Sensor Alerts · escalated cases are tracked separately</p>
              </div>
            </div>
            <span className="rounded-full bg-[#0038A8]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8]">
              {localActive.length} active
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

          <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                <CheckCircle2 size={22} className="mb-2 text-emerald-400" />
                <p className="text-[12px] font-medium text-stone-500">No reports in this view</p>
                <p className="text-[10px] text-stone-400">Adjust the filter to see more of your queue</p>
              </div>
            ) : (
              filtered.map((r) => <ReportCard key={r.id} report={r} onAction={(mode) => setActionMode({ mode, report: r })} onEscalate={() => setEscalating(r)} />)
            )}
          </div>
        </div>
      </main>

      {actionMode && <ActionModal mode={actionMode.mode} report={actionMode.report} onClose={() => setActionMode(null)} onConfirm={handleAction} />}
      {escalating && <EscalateModal report={escalating} onClose={() => setEscalating(null)} onConfirm={confirmEscalation} />}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({
  report: r,
  onAction,
  onEscalate,
}: {
  report: PurokReport;
  onAction: (mode: ActionMode) => void;
  onEscalate: () => void;
}) {
  const isSensor = r.source === "sensor";
  const category = CATEGORY_COLORS[r.category];
  const zone = zoneNameOf(r);

  return (
    <div className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm ${r.closedLocallyAt ? "border-stone-200 opacity-80" : "border-stone-200"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-stone-900">{r.id}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${category?.bg ?? "bg-stone-100"} ${category?.text ?? "text-stone-600"}`}>
            {r.category}
          </span>
          {isSensor ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
              <RadioTower size={9} />
              Sensor Alert
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
              <Users size={9} />
              Resident Report
            </span>
          )}
          {r.outcome && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${OUTCOME_META[r.outcome].badge}`}>
              <Check size={9} />
              {r.outcome}
            </span>
          )}
          {r.clarification && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-medium text-orange-700">
              <MessageCircleQuestion size={9} />
              Clarification Requested
            </span>
          )}
          {r.closedLocallyAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
              <FolderCheck size={9} />
              Closed Locally
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[10px] text-stone-400">
          <Clock size={10} />
          {formatTime(r.reportedAt)}
        </span>
      </div>

      <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{r.title}</h4>
      <p className="mt-0.5 text-[11px] text-stone-500">{r.description}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
          {isSensor ? <RadioTower size={10} /> : <Users size={10} />}
          {isSensor ? r.reporter : `${r.reporter}${r.reporterPurok && r.reporterPurok !== PUROK_LEADER_JURISDICTION.name ? ` · registered ${r.reporterPurok}` : ""}`}
        </span>
        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
          <MapPin size={10} />
          GPS {r.lat}, {r.lng}
          {zone ? ` · ${zone}` : ""}
        </span>
        {isSensor && r.metric && (
          <span className="rounded-md bg-stone-100 px-2 py-1">{r.metric}</span>
        )}
        {!isSensor && r.photos > 0 && (
          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
            <ImageIcon size={10} />
            {r.photos} photo{r.photos > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {r.validationNote && (
        <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
            <ShieldCheck size={10} />
            Validation outcome{r.validatedAt ? ` · ${formatTime(r.validatedAt)}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600">&ldquo;{r.validationNote}&rdquo;</p>
        </div>
      )}

      {r.clarification && (
        <div className="mt-2 rounded-md border border-orange-200 bg-orange-50/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-orange-700">
            <MessageCircleQuestion size={10} />
            Clarification requested{r.clarification.requestedAt ? ` · ${formatTime(r.clarification.requestedAt)}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600">&ldquo;{r.clarification.note}&rdquo;</p>
        </div>
      )}

      {r.closedLocallyAt ? (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
            <FolderCheck size={10} />
            Closed locally{r.closedLocallyAt ? ` · ${formatTime(r.closedLocallyAt)}` : ""}
          </p>
          {r.closureNote && <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600">&ldquo;{r.closureNote}&rdquo;</p>}
        </div>
      ) : (
        <>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onAction("confirm")}
              title="Locally verify this report"
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
                r.outcome === "Confirmed"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-stone-200 text-stone-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <CheckCircle2 size={11} />
              Confirm
            </button>
            <button
              onClick={() => onAction("invalid")}
              title="Mark false or insufficiently supported"
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
                r.outcome === "Marked Invalid"
                  ? "border-stone-500 bg-stone-500 text-white"
                  : "border-stone-200 text-stone-500 hover:border-stone-400 hover:bg-stone-100 hover:text-stone-700"
              }`}
            >
              <Ban size={11} />
              Mark Invalid
            </button>
            <button
              onClick={() => onAction("event")}
              title="Connected to a known local event"
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
                r.outcome === "Event-Related"
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-stone-200 text-stone-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              }`}
            >
              <CalendarDays size={11} />
              Event-Related
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
            <button
              onClick={() => onAction("clarify")}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition ${
                r.clarification
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <MessageCircleQuestion size={12} />
              Request Clarification
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onAction("close")}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                <FolderCheck size={12} />
                Close Locally
              </button>
              <button
                onClick={onEscalate}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Send size={11} />
                Escalate to Desk Officer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
