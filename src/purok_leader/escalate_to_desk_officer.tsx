import { useMemo, useState } from "react";
import {
  ClipboardList,
  ArrowUpRight,
  Timer,
  ListChecks,
  Send,
  Info,
  Gauge,
  StickyNote,
  ShieldCheck,
  Scale,
  RadioTower,
  Archive,
  Clock,
  Users,
  CheckCircle2,
  LoaderCircle,
  UserCheck,
  Eye,
} from "lucide-react";
import { Modal } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";
import { usePurokIncidents, EscalationStatus, Priority, ValidationLabel, suggestedPriorityOf } from "./incidentStore";

type LocalCase = {
  id: string;
  category: string;
  title: string;
  reporter: string;
  purok: string;
  suggestedPriority: Priority;
  label?: ValidationLabel;
};

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
  "Crime/Suspicious Activity": { bg: "bg-sky-50", text: "text-sky-600" },
  "Road Obstruction": { bg: "bg-violet-50", text: "text-violet-600" },
};

const LABEL_META: Record<ValidationLabel, { badge: string }> = {
  "Confirmed": { badge: "bg-emerald-100 text-emerald-700" },
  "False Information": { badge: "bg-stone-200 text-stone-600" },
  "Event-Related": { badge: "bg-amber-100 text-amber-700" },
};

const STATUS_META: Record<EscalationStatus, { label: string; badge: string; icon: any }> = {
  in_triage: { label: "In Triage Queue", badge: "bg-amber-100 text-amber-700", icon: Timer },
  priority_adjusted: { label: "Priority Adjusted", badge: "bg-violet-100 text-violet-700", icon: Gauge },
  dispatched: { label: "Dispatched to Tanod", badge: "bg-sky-100 text-sky-700", icon: RadioTower },
  blotter: { label: "Archived to Blotter", badge: "bg-emerald-100 text-emerald-700", icon: Archive },
};

const INITIAL_LOCAL_CASES: LocalCase[] = [
  {
    id: "INC-2101",
    category: "Crime/Suspicious Activity",
    title: "Suspicious persons at market gate",
    reporter: "Jay Dela Peña",
    purok: JURISDICTION_NAME,
    suggestedPriority: "critical",
  },
  {
    id: "INC-2100",
    category: "Fire/Smoke",
    title: "Cooking smoke near eatery row",
    reporter: "Carlo Reyes",
    purok: JURISDICTION_NAME,
    suggestedPriority: "warning",
  },
  {
    id: "INC-2099",
    category: "Road Obstruction",
    title: "Vendor cart blocking market alley",
    reporter: "Maria Santos",
    purok: JURISDICTION_NAME,
    suggestedPriority: "low",
    label: "Confirmed",
  },
  {
    id: "INC-2097",
    category: "Noise Disturbance",
    title: "Construction hammering before 6 AM",
    reporter: "Ana Lim",
    purok: JURISDICTION_NAME,
    suggestedPriority: "warning",
  },
];

function EscalateModal({
  caseItem,
  onClose,
  onConfirm,
}: {
  caseItem: LocalCase;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const sev = SEVERITY_MAP[suggestedPriorityOf(caseItem)];
  const category = CATEGORY_COLORS[caseItem.category];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }
    setSubmitted(true);
    onConfirm(notes.trim());
  }

  if (submitted) {
    return (
      <Modal
        size="md"
        footer={
          <button onClick={onClose} className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C]">
            Done
          </button>
        }
      >
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <ArrowUpRight size={24} className="text-emerald-600" />
          </div>
          <h3 className="mt-3 text-[14px] font-semibold text-stone-900">Case Escalated</h3>
          <p className="mt-1.5 text-[12px] text-stone-500">
            {caseItem.id} has entered the Desk Officer's incident triage queue with your validation label and notes attached.
          </p>
          <div className="mt-4 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-left">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">TRANSFER SUMMARY</p>
            <p className="mt-1 text-[11px] font-semibold text-stone-700">
              {caseItem.id} · {caseItem.title}
            </p>
            <p className="mt-0.5 text-[10px] text-stone-500">
              Informed suggested priority: <span className="font-medium">{sev.label}</span>
              {caseItem.label ? ` · label: ${caseItem.label}` : " · no label applied"}
            </p>
            {notes && <p className="mt-1.5 text-[10px] italic text-stone-500">"{notes}"</p>}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      title="Escalate Case to Desk Officer"
      subtitle={`${caseItem.id} · local queue`}
      icon={<ArrowUpRight size={15} />}
      iconClass="bg-[#0038A8]/5 text-[#0038A8]"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
            Cancel
          </button>
          <button type="submit" form="escalate-case-form" className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]">
            <Send size={12} />
            Escalate Case
          </button>
        </div>
      }
    >
      <form id="escalate-case-form" onSubmit={submit} className="mt-4 space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${category?.bg ?? "bg-stone-100"} ${category?.text ?? "text-stone-600"}`}>
                {caseItem.category}
              </span>
              {caseItem.label && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${LABEL_META[caseItem.label].badge}`}>{caseItem.label}</span>
              )}
            </div>
            <p className="mt-1.5 text-[12px] font-bold text-stone-900">{caseItem.title}</p>
            <p className="mt-0.5 text-[10px] text-stone-500">
              Reported by {caseItem.reporter} · {caseItem.purok}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-stone-400">Suggested priority:</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
              <StickyNote size={12} className="text-stone-400" />
              Accompanying Notes <span className="text-rose-500">*</span>
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (notesError && e.target.value.trim()) setNotesError(false);
              }}
              rows={4}
              placeholder="Attach local context, preliminary findings, or the reason for escalation so the Desk Officer doesn't start from scratch..."
              className={`w-full resize-none rounded-lg border px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 ${
                notesError
                  ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/30"
                  : "border-stone-200 focus:border-[#0038A8] focus:ring-[#0038A8]/30"
              }`}
            />
            {notesError && <p className="mt-1 text-[10px] font-medium text-rose-600">Escalation notes are required — the Desk Officer needs your local context.</p>}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
            <Scale size={13} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              <span className="font-semibold">Shift in authority:</span> once escalated, this case enters the Desk Officer's triage queue. Your validation label and notes inform the suggested priority, but the Desk Officer retains <span className="font-semibold">final authority</span> over the incident's ultimate priority assignment and disposition.
            </p>
          </div>
        </form>
    </Modal>
  );
}

export default function EscalateToDeskOfficer() {
  const { flash, ToastPortal } = useToast();
  const { escalatedCases, escalate, isEscalated } = usePurokIncidents();

  const [localCases, setLocalCases] = useState<LocalCase[]>(INITIAL_LOCAL_CASES);
  const [localFilter, setLocalFilter] = useState<"all" | "unlabeled" | "labeled">("all");
  const [escalating, setEscalating] = useState<LocalCase | null>(null);

  const pendingLocal = localCases.filter((c) => !isEscalated(c.id));

  const filteredLocal = useMemo(() => {
    const base = pendingLocal;
    if (localFilter === "unlabeled") return base.filter((c) => !c.label);
    if (localFilter === "labeled") return base.filter((c) => c.label);
    return base;
  }, [pendingLocal, localFilter]);

  const inTriage = escalatedCases.filter((c) => c.status === "in_triage").length;
  const dispatchedOrBlotted = escalatedCases.filter((c) => c.status === "dispatched" || c.status === "blotter").length;

  const kpis = [
    { label: "READY TO ESCALATE", value: pendingLocal.length, sub: `unresolved in ${JURISDICTION_NAME} queue`, icon: ClipboardList },
    { label: "TRANSFERRED", value: escalatedCases.length, sub: "total cases sent to desk officer", icon: ArrowUpRight },
    { label: "AWAITING TRIAGE", value: inTriage, sub: "in desk officer's triage queue", icon: Timer },
    { label: "ASSIGNED / ARCHIVED", value: dispatchedOrBlotted, sub: "dispatched or blotted", icon: ListChecks },
  ];

  function confirmEscalation(notes: string) {
    if (!escalating) return;
    const c = escalating;
    escalate({
      id: c.id,
      category: c.category,
      title: c.title,
      reporter: c.reporter,
      purok: c.purok,
      label: c.label,
      suggestedPriority: suggestedPriorityOf(c),
      notes,
    });
    setLocalCases((prev) => prev.filter((l) => l.id !== c.id));
    flash(`${c.id} transferred to the Barangay Desk Officer`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Escalate to Desk Officer</h1>
              <p className="mt-1 text-sm text-stone-500">
                Manually transfer unresolved cases from your local queue to the Barangay Desk Officer
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <ArrowUpRight size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">LOCAL QUEUE</p>
                <p className="text-[12px] font-bold text-[#0038A8]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              <span className="font-semibold text-stone-800">Shift in authority:</span> once a case is escalated it enters the Desk Officer's incident triage queue. Your validation labels and attached notes inform the system's suggested priority — but the Desk Officer retains <span className="font-semibold text-stone-800">final authority</span> over the incident's ultimate priority assignment and disposition. After receiving the case, they can assign an on-duty Tanod for active dispatch, adjust its priority, or mark it in the digital barangay blotter.
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
                <ClipboardList size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Local Queue — Unresolved Cases</h3>
                  <p className="text-[11px] text-[#94A3B8]">Candidates for manual transfer to the Desk Officer</p>
                </div>
              </div>
              <span className="rounded-full bg-[#0038A8]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8]">
                {pendingLocal.length} pending
              </span>
            </div>

            <div className="flex gap-1.5 border-b border-stone-100 px-5 py-3">
              {[
                { key: "all", label: "All" },
                { key: "unlabeled", label: "Unlabeled" },
                { key: "labeled", label: "Labeled" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setLocalFilter(f.key as "all" | "unlabeled" | "labeled")}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    localFilter === f.key
                      ? "border-[#0038A8] bg-[#0038A8] text-white"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {filteredLocal.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <CheckCircle2 size={22} className="mb-2 text-emerald-400" />
                  <p className="text-[12px] font-medium text-stone-500">No cases in this view</p>
                  <p className="text-[10px] text-stone-400">{pendingLocal.length === 0 ? "All cases escalated — nothing pending" : "Adjust the filter to see more"}</p>
                </div>
              ) : (
                filteredLocal.map((c) => {
                  const pri = suggestedPriorityOf(c);
                  const priSev = SEVERITY_MAP[pri];
                  const origSev = SEVERITY_MAP[c.suggestedPriority];
                  const category = CATEGORY_COLORS[c.category];
                  return (
                    <div key={c.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{c.id}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${category?.bg ?? "bg-stone-100"} ${category?.text ?? "text-stone-600"}`}>
                            {c.category}
                          </span>
                          {c.label && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${LABEL_META[c.label].badge}`}>{c.label}</span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-stone-400">
                          <Users size={10} />
                          {c.reporter}
                        </span>
                      </div>

                      <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{c.title}</h4>
                      <p className="mt-0.5 text-[10px] text-stone-400">
                        {c.purok} · local queue
                      </p>

                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                        <Gauge size={12} className="text-stone-400" />
                        <span className="text-[10px] text-stone-500">
                          {c.label ? `Suggested priority after "${c.label}":` : "Suggested priority:"}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${priSev.badge}`}>{priSev.label}</span>
                        {c.label && c.suggestedPriority !== pri && (
                          <span className="text-[10px] text-stone-400">(was {origSev.label})</span>
                        )}
                      </div>

                      <button
                        onClick={() => setEscalating(c)}
                        className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                      >
                        <ArrowUpRight size={12} />
                        Escalate to Desk Officer
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
              <ArrowUpRight size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Transfer Log — Escalated Cases</h3>
                <p className="text-[11px] text-[#94A3B8]">Cases now under the Desk Officer's authority</p>
              </div>
            </div>

            <div className="flex items-start gap-2 border-b border-stone-100 bg-stone-50/60 px-5 py-3">
              <Eye size={13} className="mt-0.5 shrink-0 text-stone-400" />
              <p className="text-[10px] leading-relaxed text-stone-500">
                After receiving a case, the Desk Officer can assign an on-duty Tanod for active dispatch, adjust the priority, or mark it in the digital barangay blotter.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {escalatedCases.map((e) => {
                const StatusIcon = STATUS_META[e.status].icon;
                const priSev = SEVERITY_MAP[e.suggestedPriority];
                return (
                  <div key={e.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-stone-900">{e.id}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_META[e.status].badge}`}>
                          <StatusIcon size={9} />
                          {STATUS_META[e.status].label}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-stone-400">
                        <Clock size={10} />
                        {formatTime(e.escalatedAt)}
                      </span>
                    </div>

                    <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{e.title}</h4>
                    <p className="mt-0.5 text-[10px] text-stone-400">
                      {e.category} · reported by {e.reporter} · {e.purok}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {e.label && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${LABEL_META[e.label].badge}`}>{e.label}</span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${priSev.badge}`}>Priority: {priSev.label}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-600">
                        <UserCheck size={9} />
                        {e.deskOfficer}
                      </span>
                    </div>

                    <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
                        <StickyNote size={10} />
                        Leader Notes
                      </p>
                      <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600">"{e.notes}"</p>
                    </div>

                    <div className="mt-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[10px] text-stone-500">
                      {e.status === "in_triage" && (
                        <p className="flex items-center gap-1.5">
                          <LoaderCircle size={10} className="animate-spin text-amber-500" />
                          {e.statusNote}
                        </p>
                      )}
                      {e.status === "priority_adjusted" && e.adjustedPriority && (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <Gauge size={10} className="text-violet-500" />
                          {e.statusNote}
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${SEVERITY_MAP[e.adjustedPriority].badge}`}>
                            {SEVERITY_MAP[e.adjustedPriority].label}
                          </span>
                        </p>
                      )}
                      {e.status === "dispatched" && (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <RadioTower size={10} className="text-sky-500" />
                          {e.statusNote}
                          <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">{e.tanodUnit}</span>
                        </p>
                      )}
                      {e.status === "blotter" && (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <Archive size={10} className="text-emerald-500" />
                          {e.statusNote}
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-medium text-emerald-700">{e.blottedId}</span>
                        </p>
                      )}
                    </div>

                    <p className="mt-2 flex items-center gap-1 text-[9px] text-stone-400">
                      <ShieldCheck size={10} className="text-stone-300" />
                      Desk Officer retains final authority over priority &amp; disposition
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {escalating && <EscalateModal caseItem={escalating} onClose={() => setEscalating(null)} onConfirm={confirmEscalation} />}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
