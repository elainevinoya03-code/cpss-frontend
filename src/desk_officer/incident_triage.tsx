// Barangay Desk Officer — Incident Triage.
// Live queue of resident-submitted incident reports. Reports are created in
// the citizen app (resident_app/lib/frontend/report.dart), stored in Supabase,
// exposed by the FastAPI backend (/api/reports), and surfaced here so the Desk
// Officer can review every field, verify, prioritize and process them. New
// submissions are picked up automatically on mount and on a refresh interval.

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  ClipboardList,
  RefreshCw,
  MapPin,
  Clock,
  Image as ImageIcon,
  ChevronRight,
  Users,
  Phone,
  KeyRound,
  FileText,
  ShieldAlert,
  Camera,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { Modal, ConfirmModal } from "../components/ui";
import { CATEGORY_ICON, CATEGORY_COLORS } from "./constants";
import { useIncidentStore, type DeskPriority } from "./incidentStore";
import { consumeDeskTriageTarget } from "../utils/deskTriageTarget";
import type { ResidentReport, ResidentReportStatus } from "./reportsApi";

type FilterKey = "all" | ResidentReportStatus;

const REPORT_STATUS_META: Record<
  ResidentReportStatus,
  { label: string; badge: string; dot: string }
> = {
  pending: { label: "New", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  under_review: {
    label: "Under Review",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
  },
  assigned: {
    label: "In Progress",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-400",
  },
  resolved: {
    label: "Resolved",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-400",
  },
  closed: {
    label: "Closed",
    badge: "bg-stone-100 text-stone-500",
    dot: "bg-stone-400",
  },
};

const PRIORITY_CHIP: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Critical: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Normal: "bg-sky-100 text-sky-700",
  Low: "bg-sky-100 text-sky-700",
};

const NEXT_ACTION: Record<
  ResidentReportStatus,
  { label: string | null; next: ResidentReportStatus | null; tone: string; ends: boolean }
> = {
  pending: {
    label: "Acknowledge & Start Review",
    next: "under_review",
    tone: "bg-[#0038A8] hover:bg-[#002A8C]",
    ends: false,
  },
  under_review: {
    label: "Assign / Start Work",
    next: "assigned",
    tone: "bg-[#0038A8] hover:bg-[#002A8C]",
    ends: false,
  },
  assigned: {
    label: "Mark Resolved",
    next: "resolved",
    tone: "bg-emerald-600 hover:bg-emerald-700",
    ends: true,
  },
  resolved: {
    label: "Close Case",
    next: "closed",
    tone: "bg-stone-500 hover:bg-stone-600",
    ends: true,
  },
  closed: { label: null, next: null, tone: "", ends: false },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "New" },
  { key: "under_review", label: "Under Review" },
  { key: "assigned", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

function timeAgo(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  );
}

function coords(report: ResidentReport) {
  if (report.latitude == null || report.longitude == null) return "—";
  return `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
        {label}
      </span>
      <span className="min-w-0 text-right text-[12px] leading-snug text-stone-700">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
      {children}
    </p>
  );
}

export default function IncidentTriage(_props: { onNavigate?: (page: string) => void }) {
  const {
    residentReports,
    residentReportsLoading,
    syncResidentReports,
    updateResidentReportStatus,
  } = useIncidentStore();
  const { flash, ToastPortal } = useToast();

  const [filter, setFilter] = useState<FilterKey>(() => {
    const target = consumeDeskTriageTarget();
    if (target === "new") return "pending";
    if (target === "acknowledged") return "under_review";
    if (target === "in_progress") return "assigned";
    return "all";
  });
  const [selected, setSelected] = useState<ResidentReport | null>(null);
  const [resolving, setResolving] = useState<ResidentReport | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [closing, setClosing] = useState<ResidentReport | null>(null);

  useEffect(() => {
    syncResidentReports();
    const t = setInterval(syncResidentReports, 30_000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    const c: Record<ResidentReportStatus, number> = {
      pending: 0,
      under_review: 0,
      assigned: 0,
      resolved: 0,
      closed: 0,
    };
    for (const r of residentReports) c[r.status] += 1;
    return c;
  }, [residentReports]);

  const queue = useMemo(() => {
    const sorted = [...residentReports].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return filter === "all" ? sorted : sorted.filter((r) => r.status === filter);
  }, [residentReports, filter]);

  const summaryCards = [
    {
      key: "pending",
      label: "NEW / PENDING",
      value: counts.pending,
      badge: REPORT_STATUS_META.pending.badge,
    },
    {
      key: "under_review",
      label: "UNDER REVIEW",
      value: counts.under_review,
      badge: REPORT_STATUS_META.under_review.badge,
    },
    {
      key: "assigned",
      label: "IN PROGRESS",
      value: counts.assigned,
      badge: REPORT_STATUS_META.assigned.badge,
    },
    {
      key: "resolved",
      label: "RESOLVED",
      value: counts.resolved,
      badge: REPORT_STATUS_META.resolved.badge,
    },
  ];

  async function runTransition(
    report: ResidentReport,
    status: ResidentReportStatus,
    note?: string
  ) {
    const updated = await updateResidentReportStatus(report.id, {
      status,
      resolution_note: note?.trim() || undefined,
    });
    if (updated) {
      flash(`${report.tracking_id} ${REPORT_STATUS_META[status].label} — saved to the record`, {
        title: "Report Updated",
      });
      if (selected && selected.id === report.id) setSelected(updated);
    } else {
      flash(`${report.tracking_id} — update failed. Check the reports API.`, {
        title: "Sync Error",
        type: "error",
      });
    }
  }

  function onAdvance(report: ResidentReport) {
    const action = NEXT_ACTION[report.status];
    if (!action.next) return;
    if (action.ends) {
      setResolutionNote("");
      setResolving(report);
      return;
    }
    void runTransition(report, action.next);
  }

  async function confirmResolve() {
    if (!resolving) return;
    await runTransition(resolving, "resolved", resolutionNote);
    setResolving(null);
  }

  async function confirmClose() {
    if (!closing) return;
    await runTransition(closing, "closed", "Closed by Desk Officer.");
    setClosing(null);
  }

  async function setPriority(report: ResidentReport, priority: DeskPriority) {
    const updated = await updateResidentReportStatus(report.id, { priority });
    if (updated) {
      if (selected && selected.id === report.id) setSelected(updated);
      flash(`${report.tracking_id} — priority set to ${priority}`, {
        title: "Priority Updated",
      });
    } else {
      flash(`${report.tracking_id} — priority update failed.`, {
        title: "Sync Error",
        type: "error",
      });
    }
  }

  const selectedReport = selected;
  const selectedAction = selectedReport ? NEXT_ACTION[selectedReport.status] : null;
  const DetailIcon = selectedReport
    ? CATEGORY_ICON[selectedReport.category] ?? ClipboardList
    : ClipboardList;
  const detailColor = selectedReport
    ? CATEGORY_COLORS[selectedReport.category] ?? { bg: "bg-stone-100", text: "text-stone-600" }
    : { bg: "bg-stone-100", text: "text-stone-600" };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Incident Triage</h1>
              <p className="mt-1 text-sm text-stone-500">
                Review, validate, prioritize, and process incoming resident reports from the
                citizen app.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => syncResidentReports()}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <RefreshCw size={12} className={residentReportsLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Summary queue cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key as FilterKey)}
              className={`flex flex-col gap-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[#0038A8]/30 ${
                filter === c.key ? "border-[#0038A8]/40" : ""
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                {c.label}
              </span>
              <span className="text-2xl font-bold text-stone-900">{c.value}</span>
              <span className={`w-fit rounded-full px-2 py-px text-[10px] font-semibold ${c.badge}`}>
                {REPORT_STATUS_META[c.key as ResidentReportStatus].label}
              </span>
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? "bg-[#0038A8] text-white"
                    : "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
                }`}
              >
                {f.label}
                {f.key !== "all" && (
                  <span className={`ml-1.5 ${active ? "text-white/70" : "text-stone-400"}`}>
                    {counts[f.key as ResidentReportStatus]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Resident report queue */}
        <div className="space-y-2">
          {residentReportsLoading && queue.length === 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-black/5 bg-white/80" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-200 bg-white/60 px-4 py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E9EDFB] text-[#0038A8]">
                <ClipboardList size={20} />
              </div>
              <p className="text-[13px] font-semibold text-stone-700">
                {filter === "all"
                  ? "No resident reports yet"
                  : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} reports`}
              </p>
              <p className="max-w-sm text-[12px] text-stone-500">
                New reports submitted through the resident app automatically appear here for the
                Desk Officer to review and process.
              </p>
            </div>
          ) : (
            queue.map((r) => {
              const Icon = CATEGORY_ICON[r.category] ?? ClipboardList;
              const color = CATEGORY_COLORS[r.category] ?? { bg: "bg-stone-100", text: "text-stone-600" };
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="group flex w-full flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3.5 text-left transition hover:border-[#0038A8]/30 hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color.bg} ${color.text}`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-stone-800">
                          {r.tracking_id}
                        </span>
                        {r.is_emergency && (
                          <span className="rounded-full bg-rose-100 px-2 py-px text-[9px] font-bold text-rose-700">
                            EMERGENCY
                          </span>
                        )}
                        {r.anonymous && (
                          <span className="rounded-full bg-stone-100 px-2 py-px text-[9px] font-semibold text-stone-500">
                            Anonymous
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-stone-500">
                          {r.category}
                          {r.subtype ? ` · ${r.subtype}` : ""}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-stone-600">
                        {r.narrative || "No narrative provided."}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-400">
                        {r.place && (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{r.place}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {timeAgo(r.created_at)}
                        </span>
                        {r.photos.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ImageIcon size={11} />
                            {r.photos.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        PRIORITY_CHIP[r.priority] ?? "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {r.priority}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${REPORT_STATUS_META[r.status].badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${REPORT_STATUS_META[r.status].dot}`} />
                      {REPORT_STATUS_META[r.status].label}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-stone-300 transition group-hover:text-[#0038A8]"
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        </main>

      {/* ── Detail drawer ── */}
      {selectedReport && (
        <Modal
          onClose={() => setSelected(null)}
          title={selectedReport.tracking_id}
          subtitle={`${selectedReport.category} · ${selectedReport.subtype || "General"}`}
          icon={
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${detailColor.bg} ${detailColor.text}`}
            >
              <DetailIcon size={18} />
            </div>
          }
          side="right"
          size="3xl"
          footer={
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Priority
                  </span>
                  {(["High", "Medium", "Low"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(selectedReport, p)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                        selectedReport.priority === p
                          ? PRIORITY_CHIP[p]
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedReport.status !== "closed" && (
                    <button
                      onClick={() => setClosing(selectedReport)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      Close as False Alarm
                    </button>
                  )}
                  {selectedAction?.next && (
                    <button
                      onClick={() => onAdvance(selectedReport)}
                      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition ${selectedAction.tone}`}
                    >
                      {selectedAction.label}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-[#94A3B8]">
                Changes are saved back to the resident report record (tracking:{" "}
                {selectedReport.tracking_id}) and reflected in the shared dashboard queue.
              </p>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Status + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${REPORT_STATUS_META[selectedReport.status].badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${REPORT_STATUS_META[selectedReport.status].dot}`} />
                {REPORT_STATUS_META[selectedReport.status].label}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  PRIORITY_CHIP[selectedReport.priority] ?? "bg-stone-100 text-stone-600"
                }`}
              >
                {selectedReport.priority} priority
              </span>
              {selectedReport.is_emergency && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700">
                  Emergency (SOS)
                </span>
              )}
              {selectedReport.anonymous && (
                <span className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-500">
                  <KeyRound size={11} />
                  Anonymous report
                </span>
              )}
            </div>

            {/* Incident overview */}
            <section>
              <SectionLabel>Incident Report</SectionLabel>
              <div className="space-y-1.5">
                <InfoRow label="Category" value={selectedReport.category || "—"} />
                {selectedReport.subtype && (
                  <InfoRow label="Subtype" value={selectedReport.subtype} />
                )}
                <InfoRow label="Priority" value={selectedReport.priority || "—"} />
                <InfoRow label="Reported at" value={fmtDateTime(selectedReport.report_date_time)} />
                <InfoRow
                  label="Incident time"
                  value={fmtDateTime(selectedReport.incident_date_time)}
                />
                <InfoRow label="Reported by" value={selectedReport.user_email || "—"} />
                <InfoRow label="Requested action" value={selectedReport.requested_action || "—"} />
                {selectedReport.action_other && (
                  <InfoRow label="Requested action (other)" value={selectedReport.action_other} />
                )}
                {selectedReport.people_affected && (
                  <InfoRow label="People affected" value={selectedReport.people_affected} />
                )}
                {selectedReport.callback_phone && (
                  <InfoRow label="Callback phone" value={selectedReport.callback_phone} />
                )}
              </div>
            </section>

            {/* Location */}
            <section>
              <SectionLabel>Location</SectionLabel>
              <div className="space-y-1.5">
                <InfoRow
                  label="Place"
                  value={
                    selectedReport.place ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} className="shrink-0 text-[#0038A8]" />
                        {selectedReport.place}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                {selectedReport.landmark && (
                  <InfoRow label="Landmark" value={selectedReport.landmark} />
                )}
                <InfoRow label="GPS coordinates" value={coords(selectedReport)} />
              </div>
            </section>

            {/* Narrative */}
            {(selectedReport.narrative || selectedReport.additional_description) && (
              <section>
                <SectionLabel>Narrative</SectionLabel>
                <div className="space-y-1.5">
                  {selectedReport.narrative && (
                    <InfoRow label="What happened" value={selectedReport.narrative} />
                  )}
                  {selectedReport.additional_description && (
                    <InfoRow
                      label="Additional description"
                      value={selectedReport.additional_description}
                    />
                  )}
                </div>
              </section>
            )}

            {selectedReport.action_taken && (
              <section>
                <SectionLabel>Action already taken</SectionLabel>
                <InfoRow label="Action taken" value={selectedReport.action_taken} />
              </section>
            )}

            {/* Respondent */}
            {selectedReport.respondent_name && (
              <section>
                <SectionLabel>Respondent</SectionLabel>
                <div className="space-y-1.5">
                  <InfoRow label="Name" value={selectedReport.respondent_name} />
                  {selectedReport.respondent_relation && (
                    <InfoRow label="Relation" value={selectedReport.respondent_relation} />
                  )}
                  {selectedReport.respondent_address && (
                    <InfoRow label="Address" value={selectedReport.respondent_address} />
                  )}
                  {selectedReport.respondent_contact && (
                    <InfoRow
                      label="Contact"
                      value={
                        <span className="flex items-center justify-end gap-1.5">
                          <Phone size={11} className="shrink-0 text-[#0038A8]" />
                          {selectedReport.respondent_contact}
                        </span>
                      }
                    />
                  )}
                </div>
              </section>
            )}

            {/* Witnesses */}
            {selectedReport.witnesses.length > 0 && (
              <section>
                <SectionLabel>Witnesses ({selectedReport.witnesses.length})</SectionLabel>
                <div className="space-y-2">
                  {selectedReport.witnesses.map((w, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={12} className="shrink-0 text-[#0038A8]" />
                        <span className="text-[12px] font-semibold text-stone-800">
                          {w.name || `Witness ${idx + 1}`}
                        </span>
                      </div>
                      {(w.address || w.contact) && (
                        <p className="mt-1 text-[11px] text-stone-500">
                          {[w.address, w.contact].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {w.whatWitnessed && (
                        <p className="mt-1 text-[11px] italic text-stone-600">"{w.whatWitnessed}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Incident-specific fields */}
            {Object.keys(selectedReport.specific_info || {}).length > 0 && (
              <section>
                <SectionLabel>Incident-specific details</SectionLabel>
                <div className="space-y-1.5">
                  {Object.entries(selectedReport.specific_info).map(([k, v]) => {
                    const display =
                      typeof v === "string" ? v : v === true ? "Yes" : v === false ? "No" : String(v);
                    const Icon = v === true ? CheckCircle2 : v === false ? ShieldAlert : FileText;
                    return (
                      <InfoRow
                        key={k}
                        label={k}
                        value={
                          <span className="flex items-center justify-end gap-1.5">
                            <Icon size={11} className="shrink-0 text-[#0038A8]" />
                            {display || (v === false ? "No" : "—")}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Evidence */}
            {(selectedReport.photos.length > 0 || selectedReport.videos.length > 0) && (
              <section>
                <SectionLabel>Evidence attachments</SectionLabel>
                <div className="space-y-1.5">
                  {selectedReport.photos.map((p) => (
                    <InfoRow
                      key={p.id}
                      label="Photo"
                      value={
                        <span className="flex items-center justify-end gap-1.5">
                          <ImageIcon size={11} className="shrink-0 text-[#0038A8]" />
                          {p.file_name}
                        </span>
                      }
                    />
                  ))}
                  {selectedReport.videos.map((v) => (
                    <InfoRow
                      key={v.id}
                      label="Video"
                      value={
                        <span className="flex items-center justify-end gap-1.5">
                          <Camera size={11} className="shrink-0 text-[#0038A8]" />
                          {v.file_name}
                        </span>
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Status timeline */}
            <section>
              <SectionLabel>Status timeline</SectionLabel>
              {selectedReport.status_updates.length === 0 ? (
                <p className="text-[11px] text-stone-400">No status updates yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedReport.status_updates.map((s) => (
                    <div key={s.id} className="flex items-start gap-2.5">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          REPORT_STATUS_META[selectedReport.status].dot
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-stone-800">{s.title}</p>
                        <p className="text-[10px] text-stone-400">{s.date}</p>
                        {s.description && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Modal>
      )}

      {/* ── Resolve modal (requires a resolution note) ── */}
      {resolving && (
        <Modal
          onClose={() => setResolving(null)}
          title={`Resolve ${resolving.tracking_id}`}
          subtitle="Record how this report was addressed before closing"
          icon={<CheckCircle2 size={18} />}
          iconClass="bg-emerald-100 text-emerald-600"
          size="md"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => setResolving(null)}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmResolve}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
              >
                Mark Resolved
              </button>
            </div>
          }
        >
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">
              RESOLUTION SUMMARY
            </p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={4}
              placeholder="Summary of what happened and what action was taken…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
              The note is appended to the report's status timeline and preserved in the report
              record.
            </p>
          </div>
        </Modal>
      )}

      {/* ── Close as false alarm ── */}
      {closing && (
        <ConfirmModal
          type="confirm"
          tone="danger"
          title="Close this report as False Alarm?"
          message={`${closing.tracking_id} will be moved to Closed and no longer accepted for dispatch. This is recorded in the report timeline.`}
          confirmLabel="Close Report"
          cancelLabel="Back"
          onConfirm={() => {
            setClosing(null);
            void confirmClose();
          }}
          onClose={() => setClosing(null)}
        />
      )}

      {ToastPortal ? <ToastPortal /> : null}
    </div>
  );
}