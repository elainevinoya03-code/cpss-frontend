// Security Alert Center — the dedicated details page for security alerts
// (severity-graded notices that go to field units and residents). Reached from
// the Desk Officer dashboard's Alert Status section. This is a read-and-approve
// detail view, not the full alert-management workflow (drafting lives in the
// dashboard composer; distribution lives downstream).

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Shield,
  Megaphone,
  Clock,
  MapPin,
  Link2,
  CheckCircle2,
  Send,
  ChevronLeft,
  Radio,
  Users,
  Info,
} from "lucide-react";
import { getSafetyNotices, subscribeSafetyNotices, alertStatusOf, approveSafetyNotice, type SafetyNotice, type AlertStatus } from "../utils/safetyNoticeStore";
import { consumeSecurityAlertTarget } from "../utils/securityAlertTarget";
import { recordActivity } from "../utils/recentActivityStore";
import { useToast } from "../hooks/useToast";
import { Modal } from "../components/ui";

const SEVERITY_META: Record<string, { chip: string; dot: string }> = {
  High: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  Warning: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  Info: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
};

const STATUS_META: Record<AlertStatus, { label: string; chip: string; dot: string }> = {
  draft: { label: "Draft", chip: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  pending_approval: { label: "Pending Approval", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  sent: { label: "Sent", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  all_clear: { label: "All-Clear issued", chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
};

const AUDIENCE_LABEL: Record<string, string> = {
  tanods: "Barangay Tanods",
  neighborhood_watch: "Neighborhood Watch",
  residents: "Residents",
  all: "All",
};

function formatFull(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function targetLabel(n: SafetyNotice) {
  return n.target.kind === "barangay" ? "Entire Barangay" : n.target.purok;
}

export default function SecurityAlertCenter() {
  const { flash } = useToast();
  const [alerts, setAlerts] = useState<SafetyNotice[]>(() =>
    getSafetyNotices().filter((n) => n.severity !== undefined || n.isAllClear)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<SafetyNotice | null>(null);

  useEffect(() => subscribeSafetyNotices(() => setAlerts([...getSafetyNotices()])), []);

  // Deep-link from the dashboard Alert Status section.
  useEffect(() => {
    const target = consumeSecurityAlertTarget();
    if (target) setSelectedId(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(
    () =>
      [...alerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [alerts]
  );

  const selected = sorted.find((a) => a.id === selectedId) ?? null;

  const counts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let sent = 0;
    let allClear = 0;
    alerts.forEach((a) => {
      const s = alertStatusOf(a);
      if (s === "pending_approval") pending++;
      else if (s === "all_clear") allClear++;
      else if (s === "sent") {
        sent++;
        if (a.severity !== "Info") active++;
      }
    });
    return { active, pending, sent, allClear };
  }, [alerts]);

  function handleApprove(n: SafetyNotice) {
    const approved = approveSafetyNotice(n.id, "Punong Barangay Cruz");
    if (approved) {
      recordActivity({
        action: "alert_approved",
        kind: "alert",
        incidentId: approved.incidentId,
        refId: approved.id,
        actor: "Punong Barangay Cruz",
        state: "Approved",
        severity: approved.severity === "High" ? "high" : undefined,
        target: "security_alerts",
      });
      flash(`${approved.id} approved and published to ${targetLabel(approved)}.`, { title: "Alert Authorized" });
    }
    setConfirmApprove(null);
  }

  const barColor =
    "flex items-center gap-1.5 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 py-1 text-[10px] font-medium text-[#0038A8]";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Page Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Security Alert Center</h1>
              <p className="mt-1 text-sm text-stone-500">
                Severity-graded alerts to field units and residents — status, targets, linked incidents and approval.
              </p>
            </div>
          </div>
        </header>

        {/* Summary counts */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Active", value: counts.active, icon: Radio, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Pending Approval", value: counts.pending, icon: Shield, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Recently Sent", value: counts.sent, icon: Send, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "All-Clear", value: counts.allClear, icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wider text-stone-400">{label}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg} ${color}`}>
                  <Icon size={13} />
                </div>
              </div>
              <div className="mt-1.5 text-[22px] font-bold text-stone-900">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Alert list */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm lg:col-span-1">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[#334155]">Security Alerts</h3>
              <p className="text-[11px] text-[#94A3B8]">{alerts.length} alert{alerts.length === 1 ? "" : "s"}</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {sorted.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Shield size={22} className="mx-auto text-stone-300" />
                  <p className="mt-2 text-[12px] text-stone-400">No security alerts yet</p>
                </div>
              ) : (
                sorted.map((a) => {
                  const st = STATUS_META[alertStatusOf(a)];
                  const sev = SEVERITY_META[a.severity ?? "Info"];
                  const isActive = selectedId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`block w-full border-b border-stone-50 px-5 py-3 text-left transition hover:bg-[#E9EDFB]/40 ${isActive ? "bg-[#E9EDFB]/60 ring-1 ring-inset ring-[#0038A8]/20" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-[#334155]">{a.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${st.chip}`}>{st.label}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                        <span className={`inline-flex items-center gap-1 ${sev.dot ? "" : ""}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                          {a.severity ?? "Info"}
                        </span>
                        <span>·</span>
                        <MapPin size={9} /> {targetLabel(a)}
                        <span>·</span>
                        <Clock size={9} /> {timeAgo(a.createdAt)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm lg:col-span-2">
            {!selected ? (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <Shield size={28} className="text-stone-300" />
                <p className="mt-3 text-[13px] font-medium text-stone-500">Select an alert to view its details</p>
                <p className="mt-1 max-w-[300px] text-[11px] text-stone-400">
                  Choose an alert from the list to review status, target, linked incident, and approval.
                </p>
              </div>
            ) : (
              <AlertDetail alert={selected} onApprove={() => setConfirmApprove(selected)} />
            )}
          </div>
        </div>
      </main>

      {confirmApprove && (
        <Modal
          onClose={() => setConfirmApprove(null)}
          title="Authorize & Publish Alert"
          subtitle="Punong Barangay authorization for a high-severity public alert"
          icon={<CheckCircle2 size={18} />}
          iconClass="bg-emerald-100 text-emerald-700"
          size="md"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => setConfirmApprove(null)}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Keep Pending
              </button>
              <button
                onClick={() => handleApprove(confirmApprove)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
              >
                <CheckCircle2 size={13} /> Approve & Publish
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-[12px] text-stone-600">
              Approving <span className="font-semibold text-stone-900">{confirmApprove.id}</span> —{" "}
              <span className="font-medium">{confirmApprove.title}</span> — immediately publishes it to{" "}
              {targetLabel(confirmApprove)} and distributes to the selected audience.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
              This records the Punong Barangay as approver and moves the alert from Pending Approval to Sent.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AlertDetail({ alert, onApprove }: { alert: SafetyNotice; onApprove: () => void }) {
  const status = alertStatusOf(alert);
  const st = STATUS_META[status];
  const sev = SEVERITY_META[alert.severity ?? "Info"];
  const isPending = status === "pending_approval";

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f766e]/10 text-[#0f766e]">
            {alert.isAllClear ? <CheckCircle2 size={18} /> : <Megaphone size={18} />}
          </div>
          <div>
            <p className="text-[10px] text-stone-400">{alert.id}</p>
            <h3 className="text-[16px] font-semibold leading-snug text-stone-900">{alert.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${st.chip}`}>{st.label}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${sev.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} /> {alert.severity ?? "Info"}
              </span>
            </div>
          </div>
        </div>
        {isPending && (
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
          >
            <CheckCircle2 size={13} /> Approve & Publish
          </button>
        )}
      </div>

      {/* Status banner for pending high-severity */}
      {isPending && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <Shield size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            This high-severity public alert is <span className="font-semibold">Pending Approval</span>. It will not be
            distributed to field units or residents until authorized by the Punong Barangay. No dashboard shortcut
            bypasses this gate.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoTile icon={<MapPin size={13} />} label="TARGET ZONE" value={targetLabel(alert)} />
        <InfoTile
          icon={<Users size={13} />}
          label="AUDIENCE"
          value={alert.audience?.length ? alert.audience.map((a) => AUDIENCE_LABEL[a] ?? a).join(", ") : "Residents"}
        />
        <InfoTile icon={<Link2 size={13} />} label="LINKED INCIDENT" value={alert.incidentId ?? "—"} />
        <InfoTile icon={<Clock size={13} />} label="CREATED" value={formatFull(alert.createdAt)} />
        {alert.publishedAt && <InfoTile icon={<Send size={13} />} label="PUBLISHED" value={formatFull(alert.publishedAt)} />}
        {alert.approvedBy && <InfoTile icon={<CheckCircle2 size={13} />} label="APPROVED BY" value={`${alert.approvedBy}${alert.approvedAt ? ` · ${formatFull(alert.approvedAt)}` : ""}`} />}
        {alert.approvalStatus === "pending" && <InfoTile icon={<Shield size={13} />} label="APPROVAL GATE" value="Awaiting Punong Barangay" />}
        <div className="sm:col-span-2">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">MESSAGE</p>
          <p className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-[12px] leading-relaxed text-stone-700">
            {alert.message}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-[#E9EDFB]/40 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] text-stone-500">
          <ChevronLeft size={12} className="text-[#0038A8]" /> Auto-distributed via push &amp; SMS once authorized.
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${barColorFor(status)}`}>
          <Info size={10} /> Status: {st.label}
        </span>
      </div>
    </div>
  );
}

function barColorFor(status: AlertStatus) {
  return status === "pending_approval"
    ? "text-amber-700"
    : status === "sent"
      ? "text-emerald-700"
      : "text-stone-500";
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-100 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-[12px] font-medium text-stone-800">{value}</p>
    </div>
  );
}
