import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  FileText,
  Filter,
  MapPin,
  Pencil,
  Printer,
  RefreshCw,
  Route,
  Search,
  Send,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Modal } from "../components/ui";
import { PUROK_ZONES } from "../constants/purok";
import { type Incident } from "../desk_officer/incidentStore";
import {
  ALL_LAYERS,
  planMarkers,
  planPolylines,
  formatDay,
  formatDateTime,
  type CheckpointPlan,
  type PlanType,
} from "./patrolShared";
import { BarangayMap } from "./patrolMap";
import { StatusBadge, TypeChip, textareaCls } from "./patrolUi";

/* --------------------------------------------------------------------- */
/* Approval modal                                                        */
/* --------------------------------------------------------------------- */

export function ApprovalModal({ plan, onDecide, onClose }: {
  plan: CheckpointPlan;
  onDecide: (decision: "approve" | "revision" | "reject", comment: string) => void;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");

  return (
    <Modal
      onClose={onClose}
      title="Approval Decision"
      subtitle={`${plan.code} — ${plan.name}`}
      icon={<Shield size={18} />}
      iconClass="bg-amber-100 text-amber-700"
      size="lg"
      footer={
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onDecide(decision, comment.trim())}
            disabled={decision !== "approve" && comment.length === 0}
            className={`flex-1 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition disabled:opacity-40 ${
              decision === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#15803D] hover:bg-[#166534]"
            }`}
          >
            {decision === "approve" ? "Approve & Finalize" : "Reject Plan"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={plan.status} />
          <TypeChip type={plan.type} />
          <span className="text-[10px] font-medium text-[#94A3B8]">
            Submitted by {plan.submittedBy ?? "—"} on {plan.submittedAt ? formatDateTime(plan.submittedAt) : "—"}
          </span>
        </div>

        <p className="text-[12px] leading-relaxed text-stone-500">{plan.objective}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
            <p className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">TARGET AREA</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#334155]">{plan.targetArea}</p>
          </div>
          <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
            <p className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">COVERAGE</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#15803D]">
              {plan.coverage.pct}% ({plan.coverage.covered}/{plan.coverage.total})
            </p>
          </div>
          <div className="col-span-2 rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
            <p className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">SCHEDULE</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#334155]">
              {plan.schedule.operationDate ? formatDay(plan.schedule.operationDate) : "—"}
              {plan.schedule.endDate && plan.schedule.endDate !== plan.schedule.operationDate
                ? ` → ${formatDay(plan.schedule.endDate)}`
                : ""}{" "}
              · {plan.schedule.startTime}–{plan.schedule.endTime}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Decision</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                { key: "approve", label: "Approve", desc: "Finalize for scheduling", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                { key: "reject", label: "Reject", desc: "Close without approval", cls: "border-rose-200 bg-rose-50 text-rose-700" },
              ] as const
            ).map((d) => (
              <button
                key={d.key}
                onClick={() => setDecision(d.key)}
                className={`rounded-xl border p-3 text-left transition ${
                  decision === d.key ? `ring-2 ring-offset-1 ${d.cls} border-transparent` : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <p className="text-[11px] font-bold">{d.label}</p>
                <p className="mt-0.5 text-[9px] opacity-70">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            {decision === "approve" ? "Approval remarks (optional)" : "Rejection reason (required)"}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={decision === "approve" ? "Add approval notes for the record…" : "Explain why the plan is being rejected…"}
            className={textareaCls}
          />
          <p className="mt-2 text-[9px] text-[#94A3B8]">
            Closing without a decision keeps the plan as Pending.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------------- */
/* Plan detail modal                                                     */
/* --------------------------------------------------------------------- */

export function PlanDetailModal({ plan, onClose, allIncidents }: {
  plan: CheckpointPlan;
  onClose: () => void;
  allIncidents: Incident[];
}) {
  const linkedIncidents = allIncidents.filter((i) => plan.linkedIncidentIds.includes(i.id));
  const heatCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const z of PUROK_ZONES) m[z.name] = 0;
    for (const i of allIncidents) {
      const z = PUROK_ZONES.find((zz) => zz.name === i.purok || i.purok?.startsWith(zz.name));
      if (z) m[z.name] += 1;
    }
    return m;
  }, [allIncidents]);
  return (
    <Modal
      onClose={onClose}
      title={`${plan.code} — ${plan.name}`}
      subtitle="Complete checkpoint plan"
      icon={<FileText size={18} />}
      iconClass="bg-[#15803D]/10 text-[#15803D]"
      size="3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <BarangayMap
          incidents={allIncidents}
          selectedIncident={null}
          onSelectIncident={() => {}}
          draftPoints={planMarkers(plan)}
          draftPolylines={planPolylines(plan)}
          mapMode="view"
          interactive={false}
          onMapClick={() => {}}
          onToggleLayer={() => {}}
          layers={ALL_LAYERS}
          heatCounts={heatCounts}
          showCoverage={false}
          coveragePct={plan.coverage.pct}
          nowLabel={`${plan.coverage.window} · Coverage ${plan.coverage.pct}%`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={plan.status} />
          <TypeChip type={plan.type} />
          <span className="text-[10px] font-medium text-[#94A3B8]">ID {plan.id}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-100 bg-stone-50/60 p-3">
            <p className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">PURPOSE</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#334155]">{plan.purpose}</p>
          </div>
          <div className="rounded-lg border border-stone-100 bg-stone-50/60 p-3">
            <p className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">TARGET AREA</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#334155]">{plan.targetArea}</p>
          </div>
          <div className="rounded-lg border border-stone-100 bg-stone-50/60 p-3">
            <p className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">COVERAGE</p>
            <p className="mt-0.5 text-[11px] font-bold text-[#15803D]">
              {plan.coverage.pct}% <span className="font-normal text-[#94A3B8]">({plan.coverage.covered}/{plan.coverage.total})</span>
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Objective</p>
          <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{plan.objective}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Reason / Basis</p>
          <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{plan.rationale || "—"}</p>
          {linkedIncidents.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {linkedIncidents.map((inc) => (
                <span key={inc.id} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700">
                  <MapPin size={9} />
                  {inc.id} · {inc.category}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Schedule</p>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-medium text-stone-600">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} className="text-[#15803D]" />
              {plan.schedule.operationDate ? formatDay(plan.schedule.operationDate) : "—"}
              {plan.schedule.endDate && plan.schedule.endDate !== plan.schedule.operationDate
                ? ` → ${formatDay(plan.schedule.endDate)}`
                : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} className="text-[#15803D]" />
              {plan.schedule.startTime}–{plan.schedule.endTime}
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw size={11} className="text-[#15803D]" />
              {plan.schedule.recurring === "daily"
                ? "Daily"
                : plan.schedule.recurring === "specific_days"
                  ? plan.schedule.recurringDays.join(", ")
                  : "One-time"}
            </span>
            {plan.schedule.expectedDuration && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} className="text-[#15803D]" />
                {plan.schedule.expectedDuration}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Points & Route</p>
          <div className="space-y-1.5">
            {plan.points.map((p, i) => (
              <div key={p.id} className="flex items-start gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#15803D] text-[8px] font-bold text-white">
                  {p.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#334155]">
                    {p.name || "Unnamed point"}
                    {i < plan.points.length - 1 && plan.type === "route" && (
                      <ArrowRight size={10} className="ml-1 inline text-stone-300" />
                    )}
                  </p>
                  <p className="text-[9px] text-[#94A3B8]">
                    {p.address || "No address"} {p.landmark ? `· ${p.landmark}` : ""} · {p.lat.toFixed(0)}, {p.lng.toFixed(0)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {(plan.routes ?? []).length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                Supporting routes ({(plan.routes ?? []).length})
              </p>
              <div className="space-y-2">
                {(plan.routes ?? []).map((r) => (
                  <div key={r.id} className="rounded-lg border border-stone-100 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                      <p className="text-[10px] font-bold text-stone-700">{r.label}</p>
                      {r.title && <span className="text-[9px] text-[#94A3B8]">({r.title})</span>}
                    </div>
                    {r.points.length > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        {r.points.map((p) => (
                          <div key={p.id} className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white" style={{ background: r.color }}>
                              {p.label.replace("CP", "")}
                            </span>
                            <p className="text-[10px] text-stone-600">
                              {p.name || "Unnamed"} {p.address ? `· ${p.address}` : ""} 
                              <span className="font-mono text-[8px] text-[#94A3B8]"> · {p.lat.toFixed(0)}, {p.lng.toFixed(0)}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[9px] text-[#94A3B8]">Straight A→B supporting path.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(plan.notes.general ||
          plan.notes.safety ||
          plan.notes.equipment ||
          plan.notes.coordination ||
          plan.notes.special ||
          plan.notes.other) && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Operational Notes</p>
            <div className="space-y-1">
              {Object.entries({
                "General Instructions": plan.notes.general,
                "Safety Considerations": plan.notes.safety,
                "Equipment / Signages": plan.notes.equipment,
                "Coordination": plan.notes.coordination,
                "Special Instructions": plan.notes.special,
                "Other Remarks": plan.notes.other,
              })
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <p key={k} className="text-[11px] text-stone-600">
                    <span className="font-semibold text-[#334155]">{k}:</span> {v}
                  </p>
                ))}
            </div>
          </div>
        )}

        {plan.remarks && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Remarks</p>
            <p className="mt-1 text-[12px] text-stone-600">{plan.remarks}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-[10px] text-[#94A3B8]">
          <span className="inline-flex items-center gap-1">
            <User size={11} />
            Submitted by {plan.submittedBy ?? "—"} {plan.submittedAt ? `· ${formatDateTime(plan.submittedAt)}` : ""}
          </span>
          {plan.decidedBy && (
            <span className="inline-flex items-center gap-1">
              <Shield size={11} />
              Decided by {plan.decidedBy} {plan.decidedAt ? `· ${formatDateTime(plan.decidedAt)}` : ""}
            </span>
          )}
        </div>

        {plan.revisionComment && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
            <span className="font-bold">Revision request:</span> {plan.revisionComment}
          </div>
        )}
        {plan.rejectionReason && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
            <span className="font-bold">Rejection reason:</span> {plan.rejectionReason}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------------- */
/* Checkpoint plans view                                                 */
/* --------------------------------------------------------------------- */

interface CheckpointPlansViewProps {
  plans: CheckpointPlan[];
  filteredPlans: CheckpointPlan[];
  statusCounts: Record<string, number>;
  planTypeFilter: "all" | PlanType;
  onPlanTypeFilter: (v: "all" | PlanType) => void;
  planAreaFilter: string;
  onPlanAreaFilter: (v: string) => void;
  planAreaOptions: string[];
  onClearFilters: () => void;
  onView: (p: CheckpointPlan) => void;
  onDecide?: (p: CheckpointPlan) => void;
  onSchedule?: (p: CheckpointPlan) => void;
  onEdit: (p: CheckpointPlan) => void;
  onDuplicate: (p: CheckpointPlan) => void;
  onDelete: (p: CheckpointPlan) => void;
  onPrint: (p: CheckpointPlan) => void;
}

export function CheckpointPlansView({
  plans,
  filteredPlans,
  statusCounts,
  planTypeFilter,
  onPlanTypeFilter,
  planAreaFilter,
  onPlanAreaFilter,
  planAreaOptions,
  onClearFilters,
  onView,
  onDecide,
  onSchedule,
  onEdit,
  onDuplicate,
  onDelete,
  onPrint,
}: CheckpointPlansViewProps) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { key: "approved", label: "Approved / Finalized" },
            { key: "pending_approval", label: "Pending" },
            { key: "draft", label: "Drafts" },
            { key: "rejected", label: "Rejected" },
          ] as const
).map((s) => (
            <div key={s.key} className="rounded-xl border border-black/5 bg-white px-4 py-4 shadow-sm">
              <span className="text-[9px] font-semibold tracking-wider text-[#94A3B8]">{s.label.toUpperCase()}</span>
              <div className="mt-1.5 text-[24px] font-bold leading-none text-[#15803D]">{statusCounts[s.key]}</div>
            </div>
          ))}
      </div>

      {plans.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <Filter size={14} className="text-[#15803D]" />
          <span className="text-[11px] font-semibold text-stone-600">Filters:</span>
          <select
            value={planTypeFilter}
            onChange={(e) => onPlanTypeFilter(e.target.value as "all" | PlanType)}
            className="w-auto rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-700 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
          >
            <option value="all">All types</option>
            <option value="fixed">Fixed Checkpoint</option>
            <option value="route">Route-Based</option>
          </select>
          <select
            value={planAreaFilter}
            onChange={(e) => onPlanAreaFilter(e.target.value)}
            className="w-auto rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-700 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
          >
            <option value="all">All areas</option>
            {planAreaOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {(planTypeFilter !== "all" || planAreaFilter !== "all") && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-stone-500 hover:bg-stone-50"
            >
              <X size={10} /> Clear
            </button>
          )}
          <span className="ml-auto text-[10px] text-[#94A3B8]">
            {filteredPlans.length} of {plans.length} plan{plans.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center shadow-sm">
          <ClipboardList size={26} className="mx-auto text-stone-300" />
          <p className="mt-3 text-[13px] font-semibold text-stone-600">No checkpoint plans yet</p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Use the Create Checkpoint Plan button to draft your first plan.</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center shadow-sm">
          <Search size={22} className="mx-auto text-stone-300" />
          <p className="mt-3 text-[13px] font-semibold text-stone-600">No plans match the filters</p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Adjust the filter criteria or clear filters to see all plans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredPlans.map((p) => {
            const isApproved = p.status === "approved";
            const isPending = p.status === "pending_approval";
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white shadow-sm ${
                  isApproved ? "border-emerald-200" : isPending ? "border-amber-200" : "border-stone-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
                      {p.type === "fixed" ? <MapPin size={14} /> : <Route size={14} />}
                    </span>
                    <div>
                      <p className="text-[13px] font-bold text-stone-800">{p.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#94A3B8]">{p.code} · {p.id}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="p-4">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <TypeChip type={p.type} />
                    {p.type === "route" && (() => {
                      const startPt = p.points.find((pt) => pt.kind === "start");
                      const endPt = p.points.find((pt) => pt.kind === "end");
                      if (startPt || endPt) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-semibold text-teal-700">
                            {startPt && <><span className="font-bold text-green-700">A</span> {startPt.name || "Start"}</>}
                            <ArrowRight size={9} className="text-teal-400" />
                            {endPt && <><span className="font-bold text-rose-700">B</span> {endPt.name || "End"}</>}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {(p.routes?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                        <Route size={9} /> {p.routes!.length} supporting route{p.routes!.length === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold text-stone-600">
                      <MapPin size={9} /> {p.targetArea}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#15803D]/5 px-2 py-0.5 text-[9px] font-semibold text-[#15803D]">
                      {p.coverage.pct}% coverage
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-[#64748B]">{p.objective}</p>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                    <Calendar size={9} />
                    {p.schedule.operationDate ? formatDay(p.schedule.operationDate) : "—"}
                    {p.schedule.endDate && p.schedule.endDate !== p.schedule.operationDate
                      ? ` → ${formatDay(p.schedule.endDate)}`
                      : ""}{" "}
                    · {p.schedule.startTime}–{p.schedule.endTime}
                  </p>
                </div>

                {isApproved && (
                  <div className="mx-4 mb-3 flex flex-col items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="w-full text-[10px] font-semibold leading-relaxed text-emerald-800">
                      {onSchedule
                        ? "Approved & ready for deployment — create the patrol schedule and assign the team."
                        : "Approved & ready for deployment. Create the Patrol Schedule (team assignment) in Patrol Operations."}
                    </p>
                    {onSchedule && (
                      <button
                        onClick={() => onSchedule(p)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        <Calendar size={13} /> Create Patrol Schedule &amp; Assign Team
                      </button>
                    )}
                  </div>
                )}

                {p.status === "revision_required" && p.revisionComment && (
                  <button
                    onClick={() => onEdit(p)}
                    className="mx-4 mb-3 w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-left text-[10px] text-sky-800 transition hover:bg-sky-100 hover:ring-1 hover:ring-sky-300"
                    title="Click to open in editor"
                  >
                    <span className="font-bold">Revision request:</span> {p.revisionComment}
                    <span className="mt-1 block text-[9px] font-semibold text-sky-500">Click to edit →</span>
                  </button>
                )}
                {p.status === "rejected" && p.rejectionReason && (
                  <div className="mx-4 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] text-rose-800">
                    <span className="font-bold">Rejected:</span> {p.rejectionReason}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-3.5">
                  <button
                    onClick={() => onView(p)}
                    className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50"
                  >
                    <Eye size={12} /> View
                  </button>
                  {isPending && onDecide && (
                    <button
                      onClick={() => onDecide(p)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-[#166534]"
                    >
                      <Shield size={12} /> Review &amp; Decide
                    </button>
                  )}
                  {p.status === "draft" && (
                    <button
                      onClick={() => onEdit(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <Pencil size={12} /> Continue Editing
                    </button>
                  )}
                  {p.status === "revision_required" && (
                    <button
                      onClick={() => onEdit(p)}
                      className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-sky-700"
                    >
                      <Send size={12} /> Revise &amp; Resubmit
                    </button>
                  )}
                  {(p.status === "rejected" || p.status === "approved") && (
                    <button
                      onClick={() => onDuplicate(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <Copy size={12} /> Duplicate
                    </button>
                  )}
                  {(isApproved || isPending) && (
                    <button
                      onClick={() => onPrint(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <Printer size={12} /> Print / Share w/ PNP
                    </button>
                  )}
                  {(p.status === "draft" || p.status === "rejected") && (
                    <button
                      onClick={() => onDelete(p)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}