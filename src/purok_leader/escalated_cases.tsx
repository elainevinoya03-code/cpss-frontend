import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock,
  Users,
  RadioTower,
  Eye,
  BellRing,
  ShieldCheck,
  MessageCircleQuestion,
  CheckCheck,
  FileText,
  UserCheck,
  Lock,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";
import { usePurokIncidents, ESCALATION_STATUS_META, EscalationStatus } from "./incidentStore";

const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

type StatusFilter = "all" | EscalationStatus;

export default function EscalatedCases() {
  const { flash, ToastPortal } = useToast();
  const { escalatedCases, markUpdateSeen, markAllUpdatesSeen } = usePurokIncidents();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const sorted = useMemo(
    () => [...escalatedCases].sort((a, b) => new Date(b.escalatedAt).getTime() - new Date(a.escalatedAt).getTime()),
    [escalatedCases]
  );

  const unread = sorted.filter((c) => c.hasUpdate);
  const sent = sorted.filter((c) => c.status === "sent");
  const inProgress = sorted.filter((c) => c.status === "under_review" || c.status === "action_assigned");
  const closed = sorted.filter((c) => c.status === "closed");

  const kpis = [
    { label: "TOTAL ESCALATED", value: sorted.length, sub: "cases sent to the Desk Officer", icon: ArrowUpRight },
    { label: "SENT", value: sent.length, sub: "awaiting Desk Officer review", icon: Clock },
    { label: "IN PROGRESS", value: inProgress.length, sub: "under review or action assigned", icon: UserCheck },
    { label: "CLOSED", value: closed.length, sub: "completed by the Desk Officer", icon: CheckCheck },
  ];

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: sorted.length },
    { key: "sent", label: "Sent", count: sent.length },
    { key: "under_review", label: "Under Review", count: sorted.filter((c) => c.status === "under_review").length },
    { key: "action_assigned", label: "Action Assigned", count: sorted.filter((c) => c.status === "action_assigned").length },
    { key: "closed", label: "Closed", count: closed.length },
  ];

  const filtered = useMemo(
    () => (statusFilter === "all" ? sorted : sorted.filter((c) => c.status === statusFilter)),
    [sorted, statusFilter]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
                Escalated Cases
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-[10px] font-semibold text-stone-600">
                  <Lock size={9} />
                  READ-ONLY
                </span>
              </h1>
              <p className="mt-1 text-sm text-stone-500">Read-only progress for cases you escalated to the Desk Officer</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <ArrowUpRight size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">ASSIGNED JURISDICTION</p>
                <p className="text-[12px] font-bold text-[#0038A8]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Eye size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              These cases now belong to the <span className="font-semibold text-stone-800">Desk Officer</span> — they decide priority changes, Tanod dispatch, blotter handling, and final disposition. You can follow progress here but cannot edit these cases.
            </p>
          </div>
        </header>

        {unread.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <BellRing size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-[11px] leading-relaxed text-amber-800">
                <span className="font-semibold">{unread.length} escalated case{unread.length > 1 ? "s" : ""} updated.</span>{" "}
                The Desk Officer changed a case status or requested further information — see the highlighted cases below.
              </p>
            </div>
            <button
              onClick={() => {
                markAllUpdatesSeen();
                flash("All updates marked as seen");
              }}
              className="flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              <CheckCheck size={11} />
              Mark all seen
            </button>
          </div>
        )}

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
              <ShieldCheck size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Escalation Progress</h3>
                <p className="text-[11px] text-[#94A3B8]">Sent → Under Review → Action Assigned → Closed</p>
              </div>
            </div>
            <span className="rounded-full bg-[#0038A8]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8]">
              {sorted.length} case{sorted.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-stone-100 px-5 py-3">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  statusFilter === t.key
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
                <CheckCheck size={22} className="mb-2 text-emerald-400" />
                <p className="text-[12px] font-medium text-stone-500">No escalated cases in this view</p>
                <p className="text-[10px] text-stone-400">Cases you escalate from Local Reports appear here</p>
              </div>
            ) : (
              filtered.map((c) => {
                const meta = ESCALATION_STATUS_META[c.status];
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm ${
                      c.hasUpdate ? "border-amber-300 ring-1 ring-amber-200" : "border-stone-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-stone-900">{c.id}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                        {c.hasUpdate && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                            <BellRing size={9} />
                            Updated by Desk Officer
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-stone-400">
                        <Clock size={10} />
                        Escalated {formatTime(c.escalatedAt)}
                      </span>
                    </div>

                    <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{c.title}</h4>
                    <p className="mt-0.5 text-[10px] text-stone-400">
                      {c.category} ·{" "}
                      {c.source === "sensor" ? (
                        <span className="inline-flex items-center gap-1">
                          <RadioTower size={9} /> Sensor Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Users size={9} /> Resident Report
                        </span>
                      )}{" "}
                      · reported by {c.reporter} · {c.purok}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-medium text-stone-600">
                        <UserCheck size={9} />
                        Handling officer: {c.deskOfficer}
                      </span>
                      {c.tanodUnit && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-medium text-sky-700">
                          Patrol response: {c.tanodUnit}
                        </span>
                      )}
                      {c.blottedId && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-medium text-emerald-700">
                          Blotter ref: {c.blottedId}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                        <p className="text-[10px] font-semibold text-stone-500">Your handoff note</p>
                        <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600">&ldquo;{c.handoffNote}&rdquo;</p>
                        {c.label && (
                          <p className="mt-1 text-[10px] text-stone-400">Validation outcome: {c.label}</p>
                        )}
                      </div>
                      <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-semibold text-stone-500">Desk Officer update</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-stone-600">{c.statusNote}</p>
                        {c.statusUpdatedAt && (
                          <p className="mt-1 text-[9px] text-stone-400">Last updated {formatTime(c.statusUpdatedAt)}</p>
                        )}
                      </div>
                    </div>

                    {c.infoRequest && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50/70 px-3 py-2">
                        <MessageCircleQuestion size={12} className="mt-0.5 shrink-0 text-orange-600" />
                        <div>
                          <p className="text-[10px] font-semibold text-orange-700">
                            Further information requested{c.infoRequest.at ? ` · ${formatTime(c.infoRequest.at)}` : ""}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-stone-600">{c.infoRequest.message}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
                      <p className="flex items-center gap-1 text-[10px] text-stone-400">
                        <Lock size={10} />
                        Read-only — priority, dispatch &amp; disposition are handled by the Desk Officer
                      </p>
                      {c.hasUpdate && (
                        <button
                          onClick={() => {
                            markUpdateSeen(c.id);
                            flash(`${c.id} marked as seen`);
                          }}
                          className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <CheckCheck size={10} />
                          Mark seen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
