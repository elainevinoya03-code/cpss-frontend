/* --------------------------------------------------------------------- */
/* Checkpoint Plans — Captain page                                        */
/* --------------------------------------------------------------------- */

import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Shield,
  Eye,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Route,
} from "lucide-react";
import { useToast } from "../hooks/useToast.tsx";
import Modal from "../components/ui/Modal";
import {
  getCheckpointPlans,
  upsertCheckpointPlan,
  useCheckpointPlans,
} from "../chief_tanod/checkpointPlanStore";
import { type CheckpointPlan } from "../chief_tanod/patrolShared";
import { formatDay, formatDateTime, PLAN_STATUS_META } from "../chief_tanod/patrolShared";

interface CheckpointPlansProps {
  role?: string;
}

export default function CheckpointPlans({ role = "captain" }: CheckpointPlansProps) {
  const { flash, ToastPortal } = useToast();
  const plans = useCheckpointPlans();
  const [selectedPlan, setSelectedPlan] = useState<CheckpointPlan | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<"approve" | "reject">("approve");
  const [approvalComment, setApprovalComment] = useState("");

  // Access control - only Captain can access
  if (role !== "captain") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-4xl rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-rose-600" />
            <h2 className="text-xl font-bold text-stone-900">Access Denied</h2>
            <p className="mt-2 text-stone-600">
              This feature is only accessible to the Captain.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Filter plans that are submitted (not draft) for Captain review
  const submittedPlans = useMemo(
    () => plans.filter((p) => p.status !== "draft"),
    [plans]
  );

  const statusCounts = useMemo(() => {
    return {
      pending_approval: submittedPlans.filter((p) => p.status === "pending_approval").length,
      approved: submittedPlans.filter((p) => p.status === "approved").length,
      rejected: submittedPlans.filter((p) => p.status === "rejected").length,
      revision_required: submittedPlans.filter((p) => p.status === "revision_required").length,
    };
  }, [submittedPlans]);

  const handleViewPlan = (plan: CheckpointPlan) => {
    setSelectedPlan(plan);
    setShowDetailModal(true);
  };

  const handleOpenApproval = (plan: CheckpointPlan) => {
    setSelectedPlan(plan);
    setApprovalDecision("approve");
    setApprovalComment("");
    setShowApprovalModal(true);
  };

  const handleApprovalDecision = async () => {
    if (!selectedPlan) return;

    if (approvalDecision === "reject" && !approvalComment.trim()) {
      flash("Please provide a rejection reason", { type: "warning" });
      return;
    }

    try {
      const updatedPlan: CheckpointPlan = {
        ...selectedPlan,
        status: approvalDecision === "approve" ? "approved" : "rejected",
        decidedBy: "Captain",
        decidedAt: new Date().toISOString(),
        rejectionReason: approvalDecision === "reject" ? approvalComment.trim() : undefined,
        approvalComments: approvalDecision === "approve" ? approvalComment.trim() : undefined,
      };

      await upsertCheckpointPlan(updatedPlan);
      flash(
        `Plan ${updatedPlan.code} has been ${approvalDecision === "approve" ? "approved" : "rejected"}`,
        { type: "success" }
      );
      setShowApprovalModal(false);
      setSelectedPlan(null);
    } catch (error) {
      flash("Failed to update plan status", { type: "error" });
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const meta = PLAN_STATUS_META[status as keyof typeof PLAN_STATUS_META];
    if (!meta) return null;
    return (
      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${meta.badge}`}>
        {meta.label}
      </span>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <ToastPortal />
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Checkpoint Plans Review</h1>
            <p className="mt-1 text-sm text-stone-500">
              Review and approve checkpoint plans submitted by Chief Tanod
            </p>
          </div>
        </header>

        {/* Status Overview */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <span className="text-[9px] font-semibold tracking-wider text-stone-400">PENDING APPROVAL</span>
            <div className="mt-1.5 text-[24px] font-bold leading-none text-amber-600">{statusCounts.pending_approval}</div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <span className="text-[9px] font-semibold tracking-wider text-stone-400">APPROVED</span>
            <div className="mt-1.5 text-[24px] font-bold leading-none text-emerald-600">{statusCounts.approved}</div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <span className="text-[9px] font-semibold tracking-wider text-stone-400">REJECTED</span>
            <div className="mt-1.5 text-[24px] font-bold leading-none text-rose-600">{statusCounts.rejected}</div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <span className="text-[9px] font-semibold tracking-wider text-stone-400">REVISION REQUIRED</span>
            <div className="mt-1.5 text-[24px] font-bold leading-none text-sky-600">{statusCounts.revision_required}</div>
          </div>
        </div>

        {/* Plans List */}
        {submittedPlans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center shadow-sm">
            <FileText size={48} className="mx-auto mb-4 text-stone-300" />
            <h3 className="text-lg font-semibold text-stone-900">No Submitted Plans</h3>
            <p className="mt-2 text-stone-500">
              No checkpoint plans have been submitted for review yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submittedPlans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  plan.status === "pending_approval"
                    ? "border-amber-200"
                    : plan.status === "approved"
                      ? "border-emerald-200"
                      : plan.status === "rejected"
                        ? "border-rose-200"
                        : "border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9EDFB] text-[#0038A8]">
                      {plan.type === "fixed" ? <MapPin size={18} /> : <Route size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-stone-800">{plan.name}</h3>
                        {getStatusBadge(plan.status)}
                      </div>
                      <p className="text-[11px] text-stone-500">{plan.code} · {plan.targetArea}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-stone-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {plan.schedule.operationDate ? formatDay(plan.schedule.operationDate) : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {plan.schedule.startTime} - {plan.schedule.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {plan.points.length} checkpoint{plan.points.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] text-stone-600">{plan.objective}</p>
                      
                      {/* Submission info */}
                      <div className="mt-2 text-[10px] text-stone-400">
                        Submitted by {plan.submittedBy || "Chief Tanod"}{" "}
                        {plan.submittedAt && `· ${formatDateTime(plan.submittedAt)}`}
                      </div>

                      {/* Rejection reason */}
                      {plan.status === "rejected" && plan.rejectionReason && (
                        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">
                          <span className="font-bold">Rejection reason:</span> {plan.rejectionReason}
                        </div>
                      )}

                      {/* Revision comment */}
                      {plan.status === "revision_required" && plan.revisionComment && (
                        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] text-sky-800">
                          <span className="font-bold">Revision request:</span> {plan.revisionComment}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                  <button
                    onClick={() => handleViewPlan(plan)}
                    className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                  >
                    <Eye size={12} /> View Details
                  </button>
                  {plan.status === "pending_approval" && (
                    <button
                      onClick={() => handleOpenApproval(plan)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-2 text-[11px] font-medium text-white hover:bg-[#002A8C]"
                    >
                      <Shield size={12} /> Review & Decide
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Plan Detail Modal */}
      {showDetailModal && selectedPlan && (
        <Modal
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPlan(null);
          }}
          title={`${selectedPlan.code} — ${selectedPlan.name}`}
          subtitle="Checkpoint Plan Details"
          icon={<FileText size={18} />}
          iconClass="bg-[#0038A8]/10 text-[#0038A8]"
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedPlan(null);
                }}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Close
              </button>
              {selectedPlan.status === "pending_approval" && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenApproval(selectedPlan);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#002A8C]"
                >
                  <Shield size={12} /> Review & Decide
                </button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(selectedPlan.status)}
              <span className="text-[10px] font-medium text-stone-400">
                {selectedPlan.type === "fixed" ? "Fixed Checkpoint" : "Route-Based"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">TARGET AREA</p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-800">{selectedPlan.targetArea}</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">COVERAGE</p>
                <p className="mt-0.5 text-[11px] font-bold text-[#0038A8]">
                  {selectedPlan.coverage.pct}% ({selectedPlan.coverage.covered}/{selectedPlan.coverage.total})
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Objective</p>
              <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{selectedPlan.objective}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Rationale</p>
              <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{selectedPlan.rationale || "—"}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Schedule</p>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-medium text-stone-600">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} className="text-[#0038A8]" />
                  {selectedPlan.schedule.operationDate ? formatDay(selectedPlan.schedule.operationDate) : "—"}
                  {selectedPlan.schedule.endDate && selectedPlan.schedule.endDate !== selectedPlan.schedule.operationDate
                    ? ` → ${formatDay(selectedPlan.schedule.endDate)}`
                    : ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} className="text-[#0038A8]" />
                  {selectedPlan.schedule.startTime}–{selectedPlan.schedule.endTime}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Checkpoints ({selectedPlan.points.length})
              </p>
              <div className="space-y-1.5">
                {selectedPlan.points.map((point, index) => (
                  <div key={point.id} className="flex items-start gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0038A8] text-[8px] font-bold text-white">
                      {point.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-stone-800">{point.name || "Unnamed point"}</p>
                      <p className="text-[9px] text-stone-400">
                        {point.address || "No address"} {point.landmark ? `· ${point.landmark}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-[10px] text-stone-400">
              <span className="inline-flex items-center gap-1">
                Submitted by {selectedPlan.submittedBy || "Chief Tanod"}{" "}
                {selectedPlan.submittedAt && `· ${formatDateTime(selectedPlan.submittedAt)}`}
              </span>
              {selectedPlan.decidedBy && (
                <span className="inline-flex items-center gap-1">
                  <Shield size={11} />
                  Decided by {selectedPlan.decidedBy} {selectedPlan.decidedAt ? `· ${formatDateTime(selectedPlan.decidedAt)}` : ""}
                </span>
              )}
            </div>

            {selectedPlan.rejectionReason && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
                <span className="font-bold">Rejection reason:</span> {selectedPlan.rejectionReason}
              </div>
            )}

            {selectedPlan.approvalComments && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                <span className="font-bold">Approval comments:</span> {selectedPlan.approvalComments}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approval Decision Modal */}
      {showApprovalModal && selectedPlan && (
        <Modal
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedPlan(null);
          }}
          title="Review Checkpoint Plan"
          subtitle={`${selectedPlan.code} — ${selectedPlan.name}`}
          icon={<Shield size={18} />}
          iconClass="bg-amber-100 text-amber-700"
          size="lg"
          footer={
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedPlan(null);
                }}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprovalDecision}
                disabled={approvalDecision === "reject" && !approvalComment.trim()}
                className={`flex-1 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition disabled:opacity-40 ${
                  approvalDecision === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {approvalDecision === "approve" ? "Approve Plan" : "Reject Plan"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(selectedPlan.status)}
              <span className="text-[10px] font-medium text-stone-400">
                {selectedPlan.type === "fixed" ? "Fixed Checkpoint" : "Route-Based"}
              </span>
            </div>

            <p className="text-[12px] leading-relaxed text-stone-600">{selectedPlan.objective}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">TARGET AREA</p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-800">{selectedPlan.targetArea}</p>
              </div>
              <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">COVERAGE</p>
                <p className="mt-0.5 text-[11px] font-bold text-[#0038A8]">
                  {selectedPlan.coverage.pct}% ({selectedPlan.coverage.covered}/{selectedPlan.coverage.total})
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Decision</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => setApprovalDecision("approve")}
                  className={`rounded-xl border p-3 text-left transition ${
                    approvalDecision === "approve"
                      ? "border-emerald-200 bg-emerald-50 ring-2 ring-emerald-400"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={approvalDecision === "approve" ? "text-emerald-600" : "text-stone-400"} />
                    <p className="text-[11px] font-bold">Approve</p>
                  </div>
                  <p className="mt-0.5 text-[9px] text-stone-500">Finalize plan for deployment</p>
                </button>
                <button
                  onClick={() => setApprovalDecision("reject")}
                  className={`rounded-xl border p-3 text-left transition ${
                    approvalDecision === "reject"
                      ? "border-rose-200 bg-rose-50 ring-2 ring-rose-400"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <X size={16} className={approvalDecision === "reject" ? "text-rose-600" : "text-stone-400"} />
                    <p className="text-[11px] font-bold">Reject</p>
                  </div>
                  <p className="mt-0.5 text-[9px] text-stone-500">Return plan for revision</p>
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                {approvalDecision === "approve" ? "Approval comments (optional)" : "Rejection reason (required)"}
              </p>
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={3}
                placeholder={
                  approvalDecision === "approve"
                    ? "Add any approval notes for the record..."
                    : "Explain why the plan is being rejected..."
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
