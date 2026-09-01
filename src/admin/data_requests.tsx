import { useState, useMemo } from "react";
import {
  UserRound,
  ShieldCheck,
  ShieldX,
  ClipboardCheck,
  FileSearch,
  AlertTriangle,
} from "lucide-react";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import { INPUT_CLASS } from "./_shared";

type RequestType = "Access" | "Correction" | "Anonymization" | "Deletion";
type RequestStatus = "Pending" | "In Review" | "Verified" | "Approved" | "Denied" | "Completed";

interface DataRequest {
  id: string;
  requester: string;
  contact: string;
  type: RequestType;
  dateSubmitted: string;
  status: RequestStatus;
  subject: string;
  relatedRecord?: string;
  processedAt?: string;
}

const TYPE_STYLES: Record<RequestType, string> = {
  Access: "bg-blue-50 text-blue-700",
  Correction: "bg-amber-50 text-amber-700",
  Anonymization: "bg-violet-50 text-violet-700",
  Deletion: "bg-rose-50 text-rose-700",
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  Pending: "bg-amber-50 text-amber-700",
  "In Review": "bg-blue-50 text-blue-700",
  Verified: "bg-emerald-50 text-emerald-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Denied: "bg-rose-50 text-rose-600",
  Completed: "bg-teal-50 text-teal-700",
};

const FILTERS: RequestStatus[] = ["Pending", "In Review", "Verified", "Approved", "Denied", "Completed"];

const INITIAL_REQUESTS: DataRequest[] = [
  {
    id: "DR-001",
    requester: "Maria Santos",
    contact: "maria.santos@residents.ph",
    type: "Deletion",
    dateSubmitted: "2026-07-18",
    status: "Pending",
    subject: "Request to delete Citizen App account and personal records",
    relatedRecord: "Citizen App account",
  },
  {
    id: "DR-002",
    requester: "Jose Ramirez",
    contact: "+63 917 555 0142",
    type: "Access",
    dateSubmitted: "2026-07-16",
    status: "In Review",
    subject: "Access copy of incident records naming the requester (INC-2068)",
    relatedRecord: "INC-2068",
  },
  {
    id: "DR-003",
    requester: "Liza Flores",
    contact: "liza.flores@residents.ph",
    type: "Correction",
    dateSubmitted: "2026-07-14",
    status: "Approved",
    subject: "Correct phone number and purok on profile and report history",
    relatedRecord: "Profile & report history",
  },
  {
    id: "DR-004",
    requester: "Andres Bautista",
    contact: "+63 918 555 0917",
    type: "Anonymization",
    dateSubmitted: "2026-07-12",
    status: "Pending",
    subject: "Anonymize identity across archived blotter records",
    relatedRecord: "Archived blotter records",
  },
  {
    id: "DR-005",
    requester: "Katrina Dela Cruz",
    contact: "katrina.dc@residents.ph",
    type: "Deletion",
    dateSubmitted: "2026-07-09",
    status: "Completed",
    subject: "Request to close account and purge notification history",
    relatedRecord: "Citizen App account & notification history",
    processedAt: "2026-07-11",
  },
  {
    id: "DR-006",
    requester: "Paolo Mendiola",
    contact: "+63 919 555 0321",
    type: "Access",
    dateSubmitted: "2026-07-05",
    status: "Denied",
    subject: "Access to CCTV footage review log — no legitimate interest established",
    relatedRecord: "CCTV review log",
    processedAt: "2026-07-08",
  },
  {
    id: "DR-007",
    requester: "Melissa Ocampo",
    contact: "melissa.ocampo@residents.ph",
    type: "Deletion",
    dateSubmitted: "2026-07-19",
    status: "In Review",
    subject: "Delete account and all records referencing the requester in official blotter entries",
    relatedRecord: "INC-2071 (official blotter records)",
  },
];

export default function DataRequests() {
  const [requests, setRequests] = useState<DataRequest[]>(INITIAL_REQUESTS);
  const [filter, setFilter] = useState<"All" | RequestStatus>("All");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [retentionDeny, setRetentionDeny] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);

  const filtered = useMemo(() => {
    if (filter === "All") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  function countFor(status: RequestStatus) {
    return requests.filter((r) => r.status === status).length;
  }

  function beginReview(r: DataRequest) {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "In Review" } : x)));
    pushAuditLog("Data Request Processed", `Marked data request ${r.id} (${r.type}) from ${r.requester} as In Review`);
  }

  function verifyRequest(r: DataRequest) {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "Verified" } : x)));
    pushAuditLog(
      "Data Request Processed",
      `Verified data request ${r.id} (${r.type}) from ${r.requester} — identity and legal basis checked${r.relatedRecord ? `, related record ${r.relatedRecord}` : ""}`
    );
  }

  function approveRequest(r: DataRequest) {
    const anonymized = ["Deletion", "Anonymization"].includes(r.type);
    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, status: "Completed", processedAt: new Date().toISOString().slice(0, 10) }
          : x
      )
    );
    pushAuditLog(
      "Data Request Processed",
      `${anonymized ? "Approved & processed" : "Fulfilled"} data request ${r.id} (${r.type}) from ${r.requester}${anonymized ? " — official incident/audit/evidence records subject to retention anonymized rather than deleted" : " with redaction of third-party data"}`
    );
    setModalMessage({
      title: anonymized ? "Request Processed" : "Request Approved",
      message: `${r.id} ${anonymized ? "processed" : "approved"}. ${anonymized ? "Official incident, audit, and evidence records subject to retention were anonymized rather than deleted." : "The requested records will be released with third-party data redacted."}`,
    });
  }

  function denyRequest(r: DataRequest) {
    const reason = retentionDeny
      ? "Denied / Retention Required — official records under active investigation, legal hold, approved retention, or official incident/blotter/audit requirements"
      : denyReason.trim();
    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, status: "Denied", processedAt: new Date().toISOString().slice(0, 10) }
          : x
      )
    );
    pushAuditLog(
      "Data Request Processed",
      `Denied data request ${r.id} (${r.type}) from ${r.requester} — reason: ${reason}`
    );
    setDenyId(null);
    setDenyReason("");
    setRetentionDeny(false);
    setModalMessage({
      title: retentionDeny ? "Denied — Retention Required" : "Request Denied",
      message: retentionDeny
        ? `${r.id} denied because official records under retention cannot be deleted (active investigation, legal hold, approved retention, or official incident/blotter/audit requirements). The requester is notified with the explanation.`
        : `${r.id} denied and the requester notified of the reason.`,
    });
  }

  const approveTarget = requests.find((r) => r.id === approveId);
  const denyTarget = requests.find((r) => r.id === denyId);
  const denyReady = retentionDeny || denyReason.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">Data Requests</h1>
          <p className="mt-1 text-sm text-stone-500">
            Data-subject access, correction, anonymization, and deletion requests
          </p>
        </header>

        <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs">
            Each request moves <strong>Pending → In Review → Verified</strong> before it can be
            approved or denied. Approving processes it against the Data Privacy Act. Official
            incident, audit, and evidence records subject to retention are <strong>anonymized, never
            deleted</strong>; when deletion cannot be performed, the request is
            <strong> denied / Retention Required </strong> with an explanation. Every decision is
            written to the audit trail.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Incoming Requests</h2>
              <p className="mt-0.5 text-sm text-stone-400">
                {requests.filter((r) => r.status === "Pending").length} pending · {requests.length} total
              </p>
            </div>
          </div>

          <div className="db-scroll flex items-center gap-2 overflow-x-auto border-b border-stone-100 px-6 py-3">
            {(["All", ...FILTERS] as const).map((f) => {
              const count = f === "All" ? requests.length : countFor(f);
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    filter === f
                      ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {f}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      filter === f ? "bg-[#0038A8]/10 text-[#0038A8]" : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-stone-400">
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Request</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Requester</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Type</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Date Submitted</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Subject</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Related Record</th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-stone-100">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0038A8]/10 text-[#0038A8]">
                          <ClipboardCheck size={13} />
                        </span>
                        <span className="font-mono text-xs font-semibold text-stone-700">{r.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                          <UserRound size={13} />
                        </span>
                        <div>
                          <div className="text-xs font-medium text-stone-800">{r.requester}</div>
                          <div className="text-[11px] text-stone-400">{r.contact}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_STYLES[r.type]}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-500">{r.dateSubmitted}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-500">{r.subject}</td>
                    <td className="px-6 py-4 font-mono text-xs text-stone-500">
                      {r.relatedRecord ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      {r.status === "Completed" || r.status === "Denied" ? (
                        <span className="text-xs text-stone-300">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {r.status === "Pending" && (
                            <button
                              onClick={() => beginReview(r)}
                              title="Start review"
                              className="flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <FileSearch size={12} />
                              Review
                            </button>
                          )}
                          {r.status === "In Review" && (
                            <button
                              onClick={() => verifyRequest(r)}
                              title="Verify identity and legal basis"
                              className="flex items-center gap-1 rounded-md border border-sky-200 px-2.5 py-1.5 text-xs font-medium text-sky-600 transition hover:bg-sky-50"
                            >
                              <ShieldCheck size={12} />
                              Verify
                            </button>
                          )}
                          {(r.status === "Verified" || r.status === "In Review") && (
                            <button
                              onClick={() => setApproveId(r.id)}
                              className="flex items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
                            >
                              <ShieldCheck size={12} />
                              Approve &amp; Process
                            </button>
                          )}
                          {(r.status === "Verified" || r.status === "In Review") && (
                            <button
                              onClick={() => {
                                setDenyId(r.id);
                                setDenyReason("");
                                setRetentionDeny(false);
                              }}
                              className="flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
                            >
                              <ShieldX size={12} />
                              Deny
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-stone-400">
                      No data requests match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {approveTarget && (
        <ConfirmModal
          type="confirm"
          title="Approve & Process Request"
          confirmLabel="Approve & Process"
          message={`Process ${approveTarget.id} (${approveTarget.type}) from ${approveTarget.requester}${approveTarget.relatedRecord ? ` — related record: ${approveTarget.relatedRecord}` : ""}? Official incident, audit, and evidence records subject to retention will be anonymized rather than deleted.`}
          onConfirm={() => {
            approveRequest(approveTarget);
            setApproveId(null);
          }}
          onClose={() => setApproveId(null)}
        />
      )}

      {denyTarget && (
        <Modal
          onClose={() => {
            setDenyId(null);
            setRetentionDeny(false);
          }}
          title="Deny Data Request"
          subtitle={`${denyTarget.id} — ${denyTarget.type} · ${denyTarget.requester}`}
          icon={<ShieldX size={18} />}
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDenyId(null);
                  setRetentionDeny(false);
                }}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => denyRequest(denyTarget)}
                disabled={!denyReady}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-rose-700 disabled:opacity-40"
              >
                <ShieldX size={13} />
                {retentionDeny ? "Confirm Denial — Retention Required" : "Confirm Denial"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {retentionDeny
                  ? "The request is denied because the affected official records cannot be deleted."
                  : "A reason is required. The requester is notified of the denial and the grounds."}
              </span>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-[11px] text-stone-600">
              <input
                type="checkbox"
                checked={retentionDeny}
                onChange={(e) => setRetentionDeny(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-rose-600"
              />
              <span>
                <strong>Denied / Retention Required</strong> — deletion cannot be performed because
                official records are under an active investigation, legal hold, approved retention,
                or official incident/blotter/audit requirements.
              </span>
            </label>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500">
                REASON FOR DENIAL
              </label>
              <textarea
                value={retentionDeny ? "Denied / Retention Required — official records under active investigation, legal hold, approved retention, or official incident/blotter/audit requirements" : denyReason}
                onChange={(e) => {
                  if (!retentionDeny) setDenyReason(e.target.value);
                }}
                disabled={retentionDeny}
                rows={4}
                placeholder="e.g. No legal basis identified under the Data Privacy Act for this request..."
                className={INPUT_CLASS + " resize-none" + (retentionDeny ? " bg-stone-100 text-stone-500" : "")}
              />
            </div>
          </div>
        </Modal>
      )}

      {modalMessage && (
        <ConfirmModal
          title={modalMessage.title}
          message={modalMessage.message}
          onClose={() => setModalMessage(null)}
        />
      )}
    </div>
  );
}