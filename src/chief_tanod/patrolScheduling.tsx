import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Pencil,
  Plus,
  Power,
  Radio,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ConfirmModal } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { useIncidentStore } from "../desk_officer/incidentStore";
import { PUROK_ZONES } from "../constants/purok";
import { ALL_LAYERS, formatDateTime, formatDay, planMarkers, planPolylines, type CheckpointPlan } from "./patrolShared";
import { BarangayMap } from "./patrolMap";
import { Field, StatusBadge as PlanStatusBadge, TypeChip, inputCls, selectCls, textareaCls } from "./patrolUi";
import { getApprovedCheckpointPlans, useCheckpointPlans } from "./checkpointPlanStore";
import { consumePatrolScheduleTarget } from "./patrolScheduleTarget";
import {
  addDutyLog,
  deleteTeam,
  getDutyLogs,
  getSchedules,
  updateDutyLog,
  upsertSchedule,
  upsertTeam,
  usePatrolScheduleStore,
} from "./patrolScheduleStore";
import {
  DAY_LABELS,
  FREQ_OPTIONS,
  SCHED_STATUS_META,
  SHIFT_OPTIONS,
  TEAM_CRITERIA,
  dateWindowLabel,
  emptySchedule,
  freqLabel,
  inferShift,
  lastDutyAgeDays,
  memberCriteriaFor,
  nextScheduleIdentity,
  suggestLeader,
  suggestMembers,
  suggestTeamLeader,
  suggestTeamMembers,
  validateSchedule,
  type AssignmentMode,
  type DutyLog,
  type PatrolFrequency,
  type PatrolSchedule,
  type PatrolTeam,
  type RosterMember,
  type ShiftType,
  type TeamMemberSuggestion,
} from "./patrolScheduleShared";

const WIZARD_STEPS = [
  { n: 1, label: "Plan" },
  { n: 2, label: "Schedule" },
  { n: 3, label: "Team" },
  { n: 4, label: "Assign" },
  { n: 5, label: "Ops" },
  { n: 6, label: "Review" },
];

function SchedBadge({ status }: { status: PatrolSchedule["status"] }) {
  const meta = SCHED_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[16px] font-semibold ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function WizardStepper({ step, onSelect }: { step: number; onSelect: (s: number) => void }) {
  return (
    <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm sm:gap-2">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1 sm:gap-2">
          {i > 0 && <ChevronRight size={12} className="shrink-0 text-stone-300" />}
          <button
            onClick={() => onSelect(s.n)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[16px] font-semibold transition ${
              step === s.n
                ? "bg-[#0038A8] text-white shadow-sm"
                : step > s.n
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "text-stone-400 hover:bg-stone-100"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                step === s.n ? "bg-white text-[#0038A8]" : step > s.n ? "bg-emerald-600 text-white" : "bg-stone-200"
              }`}
            >
              {step > s.n ? <Check size={8} strokeWidth={3} /> : s.n}
            </span>
            {s.label}
          </button>
        </div>
      ))}
    </div>
  );
}

function TeamsPanel({
  teams,
  roster,
  schedules,
  flash,
}: {
  teams: PatrolTeam[];
  roster: RosterMember[];
  schedules: PatrolSchedule[];
  flash: (msg: string, opts?: { type?: "info" | "success" | "warning" | "error" }) => void;
}) {
  const [editing, setEditing] = useState<PatrolTeam | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ team: PatrolTeam; action: "delete" | "toggle" } | null>(null);
  const [form, setForm] = useState<{ name: string; leaderId: string; memberIds: string[] }>({
    name: "",
    leaderId: "",
    memberIds: [],
  });
  const [targetPurok, setTargetPurok] = useState("");
  const [scores, setScores] = useState<TeamMemberSuggestion[]>([]);
  const [showForm, setShowForm] = useState(false);

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;

  const schedulesForTeamCount = useMemo(
    () => new Set(schedules.filter((s) => s.status !== "draft").map((s) => s.teamId)),
    [schedules]
  );

  const ageById = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of roster) m.set(r.id, lastDutyAgeDays(r));
    return m;
  }, [roster]);

  const scoredRows = useMemo(() => {
    const rows = roster
      .filter((r) => r.available || (editing !== null && editing.memberIds.includes(r.id)))
      .map((r) => {
        const criteria = memberCriteriaFor(r, { lastDutyAgeDays: ageById.get(r.id) ?? 30, targetPurok: targetPurok || undefined });
        return { r, criteria, total: criteria.reduce((s, c) => s + c.score, 0) };
      });
    if (scores.length && targetPurok) {
      const scoreById = new Map(scores.map((s) => [s.id, s.total]));
      rows.sort((a, b) => (scoreById.get(b.r.id) ?? b.total) - (scoreById.get(a.r.id) ?? a.total));
    } else {
      rows.sort((a, b) => b.total - a.total);
    }
    return rows;
  }, [roster, ageById, scores, targetPurok, editing]);

  function openCreate() {
    setForm({ name: "", leaderId: "", memberIds: [] });
    setScores([]);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(team: PatrolTeam) {
    setForm({ name: team.name, leaderId: team.leaderId, memberIds: team.memberIds.filter((x) => x !== team.leaderId) });
    setScores([]);
    setEditing(team);
    setShowForm(true);
  }

  function runSuggestion(excludeIds: string[]) {
    const pickers = suggestTeamMembers(roster, { excludeIds, count: 5, targetPurok: targetPurok || undefined });
    if (pickers.length === 0) {
      flash("No available tanods to suggest", { type: "warning" });
      return;
    }
    setScores(pickers);
    const leader = suggestTeamLeader(roster, pickers, excludeIds);
    setForm((f) => {
      const memberIds = [...f.memberIds];
      for (const p of pickers) {
        if (memberIds.length >= 4) break;
        if (p.id === leader?.id) continue;
        if (memberIds.includes(p.id)) continue;
        memberIds.push(p.id);
      }
      return { ...f, leaderId: leader?.id ?? f.leaderId, memberIds };
    });
    flash("Suggested members — final decision rests with you (Chief Tanod / Captain)");
  }

  function handleSave() {
    if (!form.name.trim()) {
      flash("Team name is required", { type: "warning" });
      return;
    }
    const dup = teams.some((t) => t.name.toLowerCase() === form.name.trim().toLowerCase() && t.id !== editing?.id);
    if (dup) {
      flash("A team with this name already exists", { type: "warning" });
      return;
    }
    if (!form.leaderId) {
      flash("Exactly 1 Team Leader is required", { type: "warning" });
      return;
    }
    const size = form.memberIds.length + 1;
    if (size < 3 || size > 5) {
      flash("Recommended size is 3–5 persons (1 TL + 2–4 members)", { type: "warning" });
      return;
    }
    const fullIds = [form.leaderId, ...form.memberIds];
    if (editing) {
      upsertTeam({ ...editing, name: form.name.trim(), leaderId: form.leaderId, memberIds: fullIds });
      flash(`Team "${form.name.trim()}" updated`);
      setShowForm(false);
      setEditing(null);
    } else {
      upsertTeam({
        id: `team-${Date.now()}`,
        name: form.name.trim(),
        leaderId: form.leaderId,
        memberIds: fullIds,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      flash(`Team "${form.name.trim()}" created`);
      setShowForm(false);
    }
    setScores([]);
  }

  function toggleMember(id: string) {
    setForm((f) => {
      const on = f.memberIds.includes(id);
      return { ...f, memberIds: on ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id].slice(0, 4) };
    });
  }

  const activeCount = teams.filter((t) => t.isActive).length;

  return (
    <div className="space-y-4">
      {/* Header + rules */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[16px] font-bold text-stone-900">
              <Users size={15} className="text-[#0038A8]" /> Team Management
            </p>
            <p className="mt-0.5 text-[15px] text-stone-500">
              Only teams created here can be selected later during Patrol Scheduling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[16px] font-semibold text-stone-600">
              {teams.length} teams · {activeCount} active
            </span>
            <button
              onClick={openCreate}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[15px] font-semibold text-white shadow-sm hover:bg-[#002A8C]"
            >
              <Plus size={13} /> Create Team
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-stone-50 p-2.5">
            <p className="text-[16px] font-bold uppercase tracking-wider text-[#94A3B8]">Team Leader</p>
            <p className="mt-0.5 text-[15px] text-stone-700">Exactly 1 required per team</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-2.5">
            <p className="text-[16px] font-bold uppercase tracking-wider text-[#94A3B8]">Team Size</p>
            <p className="mt-0.5 text-[15px] text-stone-700">Recommended 3–5 (1 TL + 2–4 members)</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-2.5">
            <p className="text-[16px] font-bold uppercase tracking-wider text-[#94A3B8]">Decision</p>
            <p className="mt-0.5 text-[15px] text-stone-700">System may suggest, but you have full control</p>
          </div>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[15px] font-bold text-stone-900">{editing ? `Edit Team · ${editing.name}` : "Create New Team"}</p>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-2">
              <Field label="Team name" required>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Market Night Watch" />
              </Field>
              <Field label="Team Leader" required>
                <select className={selectCls} value={form.leaderId} onChange={(e) => setForm({ ...form, leaderId: e.target.value })}>
                  <option value="">Select Team Leader…</option>
                  {scoredRows.map(({ r }) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.purok} · {r.experienceYears}y
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-1 text-[15px] font-semibold text-[#334155]">Selection basis — priority</p>
                <div className="space-y-1.5">
                  {TEAM_CRITERIA.map((c) => (
                    <div key={c.priority} className="flex items-start gap-2 rounded-lg border border-stone-100 bg-stone-50 px-2.5 py-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                        {c.priority}
                      </span>
                      <div>
                        <p className="text-[16px] font-bold text-stone-700">{c.label}</p>
                        <p className="text-[11px] text-stone-500">{c.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Target purok (optional)">
                <select className={selectCls} value={targetPurok} onChange={(e) => setTargetPurok(e.target.value)}>
                  <option value="">Any / mixed purok</option>
                  {[...new Set(roster.map((r) => r.purok))].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                onClick={() => runSuggestion(editing ? editing.memberIds : [])}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[15px] font-semibold text-violet-800 hover:bg-violet-100"
              >
                <Sparkles size={13} /> Suggest members (purok, availability, rotation, skills)
              </button>
              <button
                onClick={handleSave}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[15px] font-bold text-white hover:bg-emerald-700"
              >
                <Check size={13} /> {editing ? "Save Changes" : "Save Team"}
              </button>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-[#334155]">Roster members</p>
                <span className={`rounded-full px-2 py-0.5 text-[16px] font-semibold ${form.memberIds.length + 1 >= 3 && form.memberIds.length + 1 <= 5 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {form.memberIds.length + 1}/5 persons
                </span>
              </div>
              <p className="mb-2 mt-0.5 text-[11px] text-[#94A3B8]">Check members (1 TL + 2–4 members recommended). Scores reflect the priority criteria above.</p>

              {scores.length > 0 && (
                <div className="mb-3 space-y-1.5 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <p className="text-[16px] font-bold uppercase tracking-wider text-violet-700">Suggested picks</p>
                  {scores.slice(0, 3).map((s) => (
                    <div key={s.id} className="rounded-lg bg-white px-2.5 py-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[15px] font-bold text-stone-800">{s.name} <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-px text-[11px] font-semibold text-violet-700">{s.total} pts</span></p>
                        <p className="text-[11px] text-stone-400">{s.member.purok}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.criteria.filter((c) => c.score > 0).map((c) => (
                          <span key={c.priority} className="rounded-full bg-stone-100 px-1.5 py-px text-[10px] text-stone-600">
                            #{c.priority} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {scoredRows.map(({ r, criteria, total }) => {
                  const isLead = form.leaderId === r.id;
                  const on = form.memberIds.includes(r.id);
                  return (
                    <div key={r.id} className={`rounded-lg border px-3 py-2 ${on || isLead ? "border-[#0038A8]/30 bg-[#E9EDFB]" : "border-stone-100 bg-white"}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={on || (isLead && true)} disabled={isLead} onChange={() => toggleMember(r.id)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[16px] font-semibold text-stone-800">
                            {r.name} {isLead && <span className="ml-1 rounded-full bg-[#0038A8] px-1.5 py-px text-[10px] font-bold uppercase text-white">Leader</span>}
                            {editing && editing.memberIds.includes(r.id) && <span className="ml-1 rounded-full bg-stone-200 px-1.5 py-px text-[10px] font-semibold text-stone-600">In team</span>}
                          </p>
                          <p className="text-[11px] text-[#94A3B8]">
                            {r.purok} · {r.experienceYears}y · {r.skills.join(", ")} · perf {r.performance}% · last duty {ageById.get(r.id) ?? 30}d ago
                            {!r.available && <span className="ml-1 font-semibold text-rose-600">Unavailable</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-bold text-[#0038A8]">{total}</p>
                          <p className="text-[10px] text-[#94A3B8]">fit</p>
                        </div>
                        <button
                          onClick={() => setForm({ ...form, leaderId: r.id })}
                          disabled={isLead}
                          className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-white disabled:opacity-40"
                        >
                          {isLead ? "Leader" : "Set as leader"}
                        </button>
                      </div>
                      {on && (
                        <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                          {criteria.filter((c) => c.score > 0).map((c) => (
                            <span key={c.priority} title={`${c.reason}`} className="rounded-full bg-stone-100 px-1.5 py-px text-[10px] text-stone-600">
                              #{c.priority} {c.label} {c.score}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team list */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[15px] font-bold text-stone-900">All Teams</p>
        {teams.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-[15px] text-[#94A3B8]">
            No teams yet. Click “Create Team” to add one.
          </p>
        ) : (
          <div className="space-y-2.5">
            {teams.map((team) => {
              const onSchedule = schedulesForTeamCount.has(team.id);
              return (
                <div key={team.id} className={`rounded-xl border p-3.5 ${team.isActive ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-50 opacity-70"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-bold text-stone-900">{team.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${team.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-200 text-stone-500"}`}>
                          {team.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                          {team.memberIds.length} persons
                        </span>
                        {onSchedule && team.isActive && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Used in a schedule</span>
                        )}
                      </div>
                      <p className="mt-1 text-[15px] text-stone-600">
                        <span className="font-semibold text-stone-800">Team Leader:</span> {nameOf(team.leaderId)}
                      </p>
                      <p className="text-[15px] text-stone-600">
                        <span className="font-semibold text-stone-800">Members:</span>{" "}
                        {team.memberIds.filter((id) => id !== team.leaderId).map(nameOf).join(", ") || "—"}
                      </p>
                      <p className="mt-0.5 text-[15px] text-stone-400">
                        Created {new Date(team.createdAt).toLocaleDateString()} · {team.memberIds.map((id) => roster.find((r) => r.id === id)?.purok).filter(Boolean).join(", ") || "no puroks"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(team)} className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#0038A8]" title="Edit team">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmTarget({ team, action: "toggle" })} className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-amber-50 hover:text-amber-600" title={team.isActive ? "Deactivate team" : "Activate team"}>
                        <Power size={13} />
                      </button>
                      <button onClick={() => setConfirmTarget({ team, action: "delete" })} className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-rose-50 hover:text-rose-600" title="Delete team">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmTarget && (
        <ConfirmModal
          type="confirm"
          title={
            confirmTarget.action === "delete"
              ? `Delete ${confirmTarget.team.name}?`
              : confirmTarget.team.isActive
                ? `Deactivate ${confirmTarget.team.name}?`
                : `Activate ${confirmTarget.team.name}?`
          }
          message={
            confirmTarget.action === "delete"
              ? "This removes the team permanently. Any schedule draft still referencing it will need a new team."
              : confirmTarget.team.isActive
                ? "Deactivated teams cannot be selected in the Patrol Scheduling wizard until reactivated."
                : "This team will become selectable in the Patrol Scheduling wizard again."
          }
          confirmLabel={confirmTarget.action === "delete" ? "Delete team" : confirmTarget.team.isActive ? "Deactivate" : "Activate"}
          tone={confirmTarget.action === "delete" ? "danger" : "primary"}
          onConfirm={() => {
            if (confirmTarget.action === "delete") {
              deleteTeam(confirmTarget.team.id);
              flash(`Team "${confirmTarget.team.name}" deleted`);
            } else {
              upsertTeam({ ...confirmTarget.team, isActive: !confirmTarget.team.isActive });
              flash(confirmTarget.team.isActive ? `Team "${confirmTarget.team.name}" deactivated` : `Team "${confirmTarget.team.name}" reactivated`);
            }
            setConfirmTarget(null);
          }}
          onClose={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

export default function PatrolSchedulerRoutes({
  onNavigate: _onNavigate,
  role = "chief_tanod",
}: { onNavigate?: (key: string) => void; role?: string } = {}) {
  const isTanod = role === "tanod";
  const { flash, ToastPortal } = useToast();
  const { incidents } = useIncidentStore();
  const plans = useCheckpointPlans();
  const { roster, teams, schedules, dutyLogs } = usePatrolScheduleStore();

  const [tab, setTab] = useState<"plans" | "teams" | "schedules" | "logs">(isTanod ? "schedules" : "plans");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<PatrolSchedule | null>(null);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<PatrolSchedule | null>(null);
  const [logTanodId, setLogTanodId] = useState("");
  const [logNote, setLogNote] = useState("");
  const [approveTarget, setApproveTarget] = useState<PatrolSchedule | null>(null);

  const approvedPlans = useMemo(() => getApprovedCheckpointPlans(), [plans]);
  const draftPlan = useMemo(() => plans.find((p) => p.id === draft?.planId), [plans, draft?.planId]);
  const draftTeam = useMemo(() => teams.find((t) => t.id === draft?.teamId), [teams, draft?.teamId]);

  const heatCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const z of PUROK_ZONES) m[z.name] = 0;
    for (const i of incidents) {
      const z = PUROK_ZONES.find((zz) => zz.name === i.purok || i.purok?.startsWith(zz.name));
      if (z) m[z.name] += 1;
    }
    return m;
  }, [incidents]);

  const issues = useMemo(
    () => (draft ? validateSchedule(draft, draftPlan, draftTeam, roster, schedules, teams) : []),
    [draft, draftPlan, draftTeam, roster, schedules, teams]
  );
  const blocking = issues.filter((i) => i.level === "error");

  function patchDraft(p: Partial<PatrolSchedule>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  function startFromPlan(plan: CheckpointPlan) {
    setDraft(emptySchedule(plan));
    setCreatingTeam(false);
    setNewTeamName("");
    setStep(1);
    setWizardOpen(true);
  }

  useEffect(() => {
    const target = consumePatrolScheduleTarget();
    if (!target) return;
    const plan = plans.find((p) => p.id === target.planId);
    if (!plan || plan.status !== "approved") {
      flash("Selected plan is no longer approved — pick from the approved plans list", { type: "warning" });
      return;
    }
    startFromPlan(plan);
    flash(`${plan.code} loaded into the schedule wizard — checkpoint locations auto-loaded`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function continueDraft(s: PatrolSchedule) {
    setDraft({ ...s });
    setCreatingTeam(false);
    setStep(1);
    setWizardOpen(true);
  }

  function applySuggestions() {
    if (!draftPlan || !draft) return;
    const leader = suggestLeader(draftPlan, roster);
    const members = suggestMembers(draftPlan, roster, 3);
    const ids = [...new Set([leader?.id, ...members.map((m) => m.id)].filter(Boolean) as string[])].slice(0, 4);
    if (!leader || ids.length === 0) {
      flash("No available tanods to suggest", { type: "warning" });
      return;
    }
    const team: PatrolTeam = {
      id: `team-sug-${Date.now()}`,
      name: newTeamName.trim() || `${draftPlan.targetArea} Night Team`,
      leaderId: leader.id,
      memberIds: ids.includes(leader.id) ? ids : [leader.id, ...ids].slice(0, 4),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    upsertTeam(team);
    setCreatingTeam(true);
    setNewTeamName(team.name);
    patchDraft({ teamId: team.id, assignmentMode: "whole_team", assignments: [] });
    flash(`Suggested ${team.name} — Team Leader ${leader.name}. Final decision rests with Punong Barangay / Chief Tanod.`);
  }

  function toggleMember(id: string) {
    if (!draftTeam) return;
    const leaderId = draftTeam.leaderId;
    let memberIds = draftTeam.memberIds.includes(id)
      ? draftTeam.memberIds.filter((x) => x !== id)
      : [...draftTeam.memberIds, id];
    if (!memberIds.includes(leaderId) && leaderId) memberIds = [leaderId, ...memberIds];
    upsertTeam({ ...draftTeam, memberIds });
  }

  function setLeader(id: string) {
    if (!draftTeam) return;
    const memberIds = draftTeam.memberIds.includes(id) ? draftTeam.memberIds : [id, ...draftTeam.memberIds];
    upsertTeam({ ...draftTeam, leaderId: id, memberIds });
  }

  function persistTeamCreate() {
    if (!newTeamName.trim()) {
      flash("Team name is required", { type: "warning" });
      return;
    }
    const team: PatrolTeam = {
      id: `team-${Date.now()}`,
      name: newTeamName.trim(),
      leaderId: "",
      memberIds: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    upsertTeam(team);
    patchDraft({ teamId: team.id });
    flash("New team created — assign a Team Leader (required) and 2–4 members");
  }

  function toggleAssign(pointId: string, tanodId: string) {
    if (!draft) return;
    const rows = [...draft.assignments];
    const idx = rows.findIndex((a) => a.pointId === pointId);
    if (idx < 0) {
      rows.push({ pointId, tanodIds: [tanodId] });
    } else {
      const has = rows[idx].tanodIds.includes(tanodId);
      rows[idx] = {
        ...rows[idx],
        tanodIds: has ? rows[idx].tanodIds.filter((x) => x !== tanodId) : [...rows[idx].tanodIds, tanodId],
      };
    }
    patchDraft({ assignments: rows });
  }

  function saveDraft() {
    if (!draft) return;
    const identity = draft.id ? { id: draft.id, code: draft.code } : nextScheduleIdentity(getSchedules());
    upsertSchedule({ ...draft, ...identity, status: "draft" });
    setWizardOpen(false);
    setDraft(null);
    setTab("schedules");
    flash(`Schedule ${identity.code} saved as Draft`);
  }

  function submitForApproval() {
    if (!draft) return;
    if (blocking.length) {
      flash(blocking.map((b) => b.message).join(" · "), { type: "warning" });
      return;
    }
    const identity = draft.id ? { id: draft.id, code: draft.code } : nextScheduleIdentity(getSchedules());
    upsertSchedule({
      ...draft,
      ...identity,
      status: "pending_approval",
      submittedAt: new Date().toISOString(),
    });
    setWizardOpen(false);
    setDraft(null);
    setTab("schedules");
    flash(`${identity.code} submitted — status Draft → Pending Approval`);
  }

  function approveSchedule(s: PatrolSchedule) {
    const now = new Date().toISOString();
    const start = new Date(`${s.startDate}T${s.startTime || "00:00"}`);
    const status = !Number.isNaN(start.getTime()) && start.getTime() <= Date.now() ? "active" : "scheduled";
    upsertSchedule({
      ...s,
      status,
      decidedBy: "Punong Barangay / Chief Tanod",
      decidedAt: now,
      notifiedAt: now,
    });
    setApproveTarget(null);
    flash(`${s.code} approved — ${status === "active" ? "Active" : "Scheduled"}. Assigned team notified.`);
  }

  function logDuty(kind: "start" | "end" | "observe") {
    if (!logTarget || !logTanodId) {
      flash("Select the tanod logging this duty", { type: "warning" });
      return;
    }
    const existing = getDutyLogs().find((l) => l.scheduleId === logTarget.id && l.tanodId === logTanodId && !l.endedAt);
    const now = new Date().toISOString();
    if (kind === "start") {
      addDutyLog({
        id: `DL-${Date.now()}`,
        scheduleId: logTarget.id,
        tanodId: logTanodId,
        startedAt: now,
        observations: logNote,
        linkedBlotter: false,
        linkedBpops: false,
        status: "on_duty",
      });
      flash("Duty start logged");
    } else if (kind === "end") {
      if (existing) updateDutyLog(existing.id, { endedAt: now, observations: logNote || existing.observations });
      else {
        addDutyLog({
          id: `DL-${Date.now()}`,
          scheduleId: logTarget.id,
          tanodId: logTanodId,
          startedAt: now,
          endedAt: now,
          observations: logNote,
          linkedBlotter: false,
          linkedBpops: false,
          status: "completed",
        });
      }
      flash("Duty end logged");
    } else if (existing) {
      updateDutyLog(existing.id, { observations: logNote, linkedBlotter: true, linkedBpops: true });
      flash("Observation saved and linked to blotter / BPOPS reports");
    } else {
      addDutyLog({
        id: `DL-${Date.now()}`,
        scheduleId: logTarget.id,
        tanodId: logTanodId,
        startedAt: now,
        observations: logNote,
        linkedBlotter: true,
        linkedBpops: true,
        status: "on_duty",
      });
      flash("Observation logged and linked to blotter / BPOPS reports");
    }
    setLogNote("");
    setTab("logs");
    setLogTarget(null);
  }

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;

  /* ---------------- Tanod-focused list (duty only) ---------------- */
  if (isTanod && !wizardOpen) {
    const live = schedules.filter((s) => s.status === "active" || s.status === "scheduled");
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
        {ToastPortal && <ToastPortal />}
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <header className="mb-6 border-b border-stone-200 pb-5">
            <h1 className="text-3xl font-bold text-stone-900">My Patrol Duty</h1>
            <p className="mt-1 text-base text-stone-500">Log start/end of duty and observations for assigned schedules</p>
          </header>
          <div className="space-y-3">
            {live.length === 0 && (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
                <Calendar size={24} className="mx-auto text-stone-300" />
                <p className="mt-3 text-[15px] font-semibold text-stone-600">No assigned patrols yet</p>
              </div>
            )}
            {live.map((s) => {
              const plan = plans.find((p) => p.id === s.planId);
              return (
                <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-bold text-stone-800">{plan?.name ?? s.code}</p>
                      <p className="text-[16px] text-[#94A3B8]">
                        {s.code} · {dateWindowLabel(s)} · {s.startTime}–{s.endTime}
                      </p>
                    </div>
                    <SchedBadge status={s.status} />
                  </div>
                  <button
                    onClick={() => {
                      setLogTarget(s);
                      setLogTanodId(roster[0]?.id ?? "");
                    }}
                    className="mt-3 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[15px] font-semibold text-white"
                  >
                    Log duty / observation
                  </button>
                </div>
              );
            })}
          </div>
        </main>
        {logTarget && (
          <DutyLogSheet
            schedule={logTarget}
            roster={roster}
            tanodId={logTanodId}
            note={logNote}
            onTanod={setLogTanodId}
            onNote={setLogNote}
            onClose={() => setLogTarget(null)}
            onAction={logDuty}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      {ToastPortal && <ToastPortal />}
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">Patrol Operations</h1>
              <p className="mt-1.5 text-base text-stone-500">
                Create patrol schedules from approved checkpoint plans, assign teams, and monitor duty logs
              </p>
            </div>
            {wizardOpen ? (
              <button
                onClick={() => setLeaveOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 text-[16px] font-medium text-stone-600 hover:bg-stone-50"
              >
                <X size={14} /> Exit Wizard
              </button>
            ) : (
              <button
                onClick={() => {
                  const first = approvedPlans[0];
                  if (first) startFromPlan(first);
                  else flash("No approved checkpoint plans yet", { type: "warning" });
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 text-[16px] font-semibold text-white shadow-sm hover:bg-[#002A8C]"
              >
                <Plus size={14} /> Create Patrol Schedule
              </button>
            )}
          </div>
        </header>

        {wizardOpen && draft ? (
          <div>
            <WizardStepper step={step} onSelect={setStep} />

            {step === 1 && (
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="space-y-3 xl:col-span-2">
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Approved Checkpoint Plan</p>
                    <select
                      className={selectCls}
                      value={draft.planId}
                      onChange={(e) => {
                        const p = plans.find((x) => x.id === e.target.value);
                        if (p) setDraft(emptySchedule(p));
                      }}
                    >
                      <option value="">Select plan…</option>
                      {approvedPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                    {draftPlan && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <PlanStatusBadge status={draftPlan.status} />
                          <TypeChip type={draftPlan.type} />
                        </div>
                        <p className="text-[16px] leading-relaxed text-stone-600">{draftPlan.objective}</p>
                        <p className="text-[15px] text-stone-500">
                          <span className="font-semibold text-stone-700">Area:</span> {draftPlan.targetArea} · coverage {draftPlan.coverage.pct}% ({draftPlan.coverage.covered}/{draftPlan.coverage.total})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {draftPlan.linkedIncidentIds.map((id) => (
                            <span key={id} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              {id}
                            </span>
                          ))}
                          {draftPlan.linkedIncidentIds.length === 0 && (
                            <span className="text-[16px] text-[#94A3B8]">No linked incidents</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="xl:col-span-3">
                  {draftPlan ? (
                    <BarangayMap
                      incidents={incidents}
                      selectedIncident={null}
                      onSelectIncident={() => {}}
                      draftPoints={planMarkers(draftPlan)}
                      draftPolylines={planPolylines(draftPlan)}
                      mapMode="view"
                      interactive={false}
                      onMapClick={() => {}}
                      layers={ALL_LAYERS}
                      heatCounts={heatCounts}
                      showCoverage
                      coveragePct={draftPlan.coverage.pct}
                      nowLabel={`${draftPlan.code} · checkpoints auto-loaded`}
                    />
                  ) : (
                    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-[16px] text-[#94A3B8]">
                      Select an approved plan to load checkpoints on the map
                    </div>
                  )}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Patrol Schedule Details</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Start date" required>
                    <input type="date" className={inputCls} value={draft.startDate} onChange={(e) => patchDraft({ startDate: e.target.value })} />
                  </Field>
                  <Field label="End date">
                    <input type="date" className={inputCls} value={draft.endDate} onChange={(e) => patchDraft({ endDate: e.target.value })} />
                  </Field>
                  <Field label="Start time" required>
                    <input
                      type="time"
                      className={inputCls}
                      value={draft.startTime}
                      onChange={(e) => patchDraft({ startTime: e.target.value, shiftType: inferShift(e.target.value) })}
                    />
                  </Field>
                  <Field label="End time" required>
                    <input type="time" className={inputCls} value={draft.endTime} onChange={(e) => patchDraft({ endTime: e.target.value })} />
                  </Field>
                </div>
                <p className="mb-2 mt-4 text-[15px] font-semibold text-[#334155]">Frequency</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {FREQ_OPTIONS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() =>
                        patchDraft({
                          frequency: f.key as PatrolFrequency,
                          shiftType: f.key === "nightly" ? "night" : draft.shiftType,
                        })
                      }
                      className={`rounded-xl border p-2.5 text-left ${
                        draft.frequency === f.key ? "border-[#0038A8] bg-[#E9EDFB] ring-1 ring-[#0038A8]/30" : "border-stone-200 bg-white hover:bg-stone-50"
                      }`}
                    >
                      <p className="text-[15px] font-bold text-stone-800">{f.label}</p>
                      <p className="text-[11px] text-[#94A3B8]">{f.hint}</p>
                    </button>
                  ))}
                </div>
                {draft.frequency === "specific_days" && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((d) => {
                      const on = draft.frequencyDays.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            patchDraft({
                              frequencyDays: on ? draft.frequencyDays.filter((x) => x !== d) : [...draft.frequencyDays, d],
                            })
                          }
                          className={`rounded-full px-3 py-1 text-[16px] font-semibold ${on ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-600"}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
                {draft.frequency === "custom" && (
                  <div className="mt-3">
                    <Field label="Custom cadence">
                      <input className={inputCls} value={draft.customNotes} onChange={(e) => patchDraft({ customNotes: e.target.value })} placeholder="e.g. Market days only, skip holidays" />
                    </Field>
                  </div>
                )}
                <p className="mb-2 mt-4 text-[15px] font-semibold text-[#334155]">Shift type</p>
                <div className="grid grid-cols-3 gap-2">
                  {SHIFT_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => patchDraft({ shiftType: s.key as ShiftType })}
                      className={`rounded-xl border p-3 text-left ${
                        draft.shiftType === s.key ? "border-[#0038A8] bg-[#E9EDFB]" : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      <p className="text-[16px] font-bold text-stone-800">{s.label}</p>
                      <p className="text-[11px] text-[#94A3B8]">{s.window}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="space-y-3 lg:col-span-2">
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Create or Select Team</p>
                    <div className="mb-3 flex gap-2">
                      <button
                        onClick={() => setCreatingTeam(false)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-[15px] font-semibold ${!creatingTeam ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-white text-stone-600"}`}
                      >
                        Existing team
                      </button>
                      <button
                        onClick={() => setCreatingTeam(true)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-[15px] font-semibold ${creatingTeam ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-white text-stone-600"}`}
                      >
                        New team
                      </button>
                    </div>
                    {!creatingTeam ? (
                      <select className={selectCls} value={draft.teamId} onChange={(e) => patchDraft({ teamId: e.target.value })}>
                        <option value="">Select team…</option>
                        {teams
                          .filter((t) => t.isActive)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.memberIds.length} members)
                            </option>
                          ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <Field label="Team name" required>
                          <input className={inputCls} value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Market Night Watch" />
                        </Field>
                        {!draft.teamId && (
                          <button onClick={persistTeamCreate} className="rounded-lg bg-[#0038A8] px-3 py-1.5 text-[15px] font-semibold text-white">
                            Create team
                          </button>
                        )}
                      </div>
                    )}
                    {draftPlan && (
                      <button
                        onClick={applySuggestions}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[15px] font-semibold text-violet-800 hover:bg-violet-100"
                      >
                        <Sparkles size={13} /> Suggest members (purok, availability, rotation, skills)
                      </button>
                    )}
                    <p className="mt-2 text-[16px] leading-relaxed text-[#94A3B8]">
                      Accept, modify, or pick manually. Final decision rests with Punong Barangay / Chief Tanod.
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Roster</p>
                    {!draftTeam ? (
                      <p className="text-[16px] text-[#94A3B8]">Select or create a team to assign a leader and members.</p>
                    ) : (
                      <div className="space-y-2">
                        {roster.map((m) => {
                          const on = draftTeam.memberIds.includes(m.id);
                          const isLead = draftTeam.leaderId === m.id;
                          return (
                            <div key={m.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${on ? "border-[#0038A8]/30 bg-[#E9EDFB]" : "border-stone-100"}`}>
                              <input type="checkbox" checked={on} onChange={() => toggleMember(m.id)} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-semibold text-stone-800">
                                  {m.name} {isLead && <span className="text-[11px] font-bold uppercase text-[#0038A8]">Leader</span>}
                                </p>
                                <p className="text-[11px] text-[#94A3B8]">
                                  {m.purok} · {m.experienceYears}y · {m.skills.join(", ")} · perf {m.performance}% · last duty {formatDay(m.lastDutyAt)}
                                  {!m.available && <span className="ml-1 font-semibold text-rose-600">Unavailable</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => setLeader(m.id)}
                                className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-white"
                              >
                                Set leader
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Assign Team to Checkpoints</p>
                <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["whole_team", "per_checkpoint"] as AssignmentMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => patchDraft({ assignmentMode: mode })}
                      className={`rounded-xl border p-3 text-left ${draft.assignmentMode === mode ? "border-[#0038A8] bg-[#E9EDFB]" : "border-stone-200"}`}
                    >
                      <p className="text-[16px] font-bold text-stone-800">
                        {mode === "whole_team" ? "Whole team → entire plan" : "Team / tanods → specific checkpoints"}
                      </p>
                      <p className="text-[16px] text-[#94A3B8]">
                        {mode === "whole_team" ? "One assignment covers all CP locations." : "Split people across CP1, CP2, A/B, etc."}
                      </p>
                    </button>
                  ))}
                </div>
                {draft.assignmentMode === "whole_team" && (
                  <p className="text-[16px] text-stone-600">
                    {draftTeam ? (
                      <>
                        <span className="font-semibold">{draftTeam.name}</span> ({nameOf(draftTeam.leaderId)} + {draftTeam.memberIds.length - 1} members) will cover the full checkpoint plan.
                      </>
                    ) : (
                      "Select a team first."
                    )}
                  </p>
                )}
                {draft.assignmentMode === "per_checkpoint" && draftPlan && (
                  <div className="space-y-3">
                    {draftPlan.points.map((pt) => {
                      const row = draft.assignments.find((a) => a.pointId === pt.id);
                      return (
                        <div key={pt.id} className="rounded-lg border border-stone-100 p-3">
                          <p className="mb-2 text-[15px] font-bold text-stone-800">
                            {pt.label} · {pt.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(draftTeam?.memberIds ?? []).map((id) => {
                              const on = row?.tanodIds.includes(id);
                              return (
                                <button
                                  key={id}
                                  onClick={() => toggleAssign(pt.id, id)}
                                  className={`rounded-full px-2.5 py-1 text-[16px] font-semibold ${on ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-600"}`}
                                >
                                  {nameOf(id)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {issues.filter((i) => i.message.toLowerCase().includes("understaff") || i.message.toLowerCase().includes("overlap") || i.message.toLowerCase().includes("conflict") || i.message.toLowerCase().includes("unavailable") || i.message.toLowerCase().includes("no assigned")).length > 0 && (
                  <div className="mt-4 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    {issues
                      .filter((i) => i.level === "warn")
                      .map((i) => (
                        <p key={i.message} className="flex items-start gap-1.5 text-[15px] text-amber-800">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {i.message}
                        </p>
                      ))}
                  </div>
                )}
              </section>
            )}

            {step === 5 && (
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Assembly / Meeting point">
                  <input className={inputCls} value={draft.ops.assemblyPoint} onChange={(e) => patchDraft({ ops: { ...draft.ops, assemblyPoint: e.target.value } })} />
                </Field>
                <Field label="Required equipment">
                  <input className={inputCls} value={draft.ops.equipment} onChange={(e) => patchDraft({ ops: { ...draft.ops, equipment: e.target.value } })} />
                </Field>
                <Field label="Specific instructions">
                  <textarea rows={3} className={textareaCls} value={draft.ops.instructions} onChange={(e) => patchDraft({ ops: { ...draft.ops, instructions: e.target.value } })} />
                </Field>
                <Field label="Coordination with Pulis sa Barangay">
                  <textarea rows={3} className={textareaCls} value={draft.ops.pulisCoordination} onChange={(e) => patchDraft({ ops: { ...draft.ops, pulisCoordination: e.target.value } })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Emergency / Reporting procedure">
                    <textarea rows={3} className={textareaCls} value={draft.ops.emergencyProcedure} onChange={(e) => patchDraft({ ops: { ...draft.ops, emergencyProcedure: e.target.value } })} />
                  </Field>
                </div>
              </section>
            )}

            {step === 6 && (
              <section className="space-y-4">
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Full schedule summary</p>
                  <dl className="grid grid-cols-1 gap-3 text-[16px] sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-semibold text-[#94A3B8]">CHECKPOINT PLAN</dt>
                      <dd className="font-semibold text-stone-800">{draftPlan ? `${draftPlan.code} — ${draftPlan.name}` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold text-[#94A3B8]">SCHEDULE</dt>
                      <dd className="text-stone-700">
                        {dateWindowLabel(draft)} · {draft.startTime}–{draft.endTime} · {freqLabel(draft)} · {draft.shiftType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold text-[#94A3B8]">TEAM</dt>
                      <dd className="text-stone-700">
                        {draftTeam ? (
                          <>
                            {draftTeam.name} — Leader {nameOf(draftTeam.leaderId)} · Members {draftTeam.memberIds.map(nameOf).join(", ")}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold text-[#94A3B8]">ASSIGNMENT</dt>
                      <dd className="text-stone-700">
                        {draft.assignmentMode === "whole_team"
                          ? "Whole team covers the plan"
                          : draftPlan?.points
                              .map((pt) => {
                                const ids = draft.assignments.find((a) => a.pointId === pt.id)?.tanodIds ?? [];
                                return `${pt.label}: ${ids.length ? ids.map(nameOf).join(", ") : "unassigned"}`;
                              })
                              .join(" · ")}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className={`rounded-xl border p-4 ${blocking.length ? "border-rose-200 bg-rose-50" : issues.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <p className="mb-2 flex items-center gap-1.5 text-[16px] font-bold text-stone-800">
                    {blocking.length ? <AlertTriangle size={14} className="text-rose-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
                    Validation
                  </p>
                  {issues.length === 0 ? (
                    <p className="text-[15px] text-emerald-800">No conflicts. Personnel and assignment look complete.</p>
                  ) : (
                    <ul className="space-y-1">
                      {issues.map((i) => (
                        <li key={i.message} className={`text-[15px] ${i.level === "error" ? "text-rose-800" : "text-amber-800"}`}>
                          {i.level === "error" ? "Error: " : "Warning: "}
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[16px] font-medium text-stone-600 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Back
              </button>
              {step < 6 && (
                <button
                  onClick={() => setStep((s) => Math.min(6, s + 1))}
                  className="flex items-center gap-1 rounded-lg bg-[#0038A8] px-4 py-2 text-[16px] font-semibold text-white"
                >
                  Continue <ChevronRight size={14} />
                </button>
              )}
              <button onClick={saveDraft} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[16px] font-medium text-stone-600">
                Save draft
              </button>
              {step === 6 && (
                <button onClick={submitForApproval} className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[16px] font-bold text-white hover:bg-emerald-700">
                  <Shield size={13} /> Submit for Approval
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  { key: "plans", label: "Approved plans" },
                  { key: "teams", label: "Teams" },
                  { key: "schedules", label: "Patrol schedules" },
                  { key: "logs", label: "Monitoring & logs" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-lg px-3.5 py-2 text-[15px] font-semibold ${tab === t.key ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-white text-stone-600"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "plans" && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {approvedPlans.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
                    <ClipboardList size={24} className="mx-auto text-stone-300" />
                    <p className="mt-3 text-[15px] font-semibold text-stone-600">No approved checkpoint plans</p>
                    <p className="mt-1 text-[15px] text-[#94A3B8]">Plans approved by the Punong Barangay appear here.</p>
                  </div>
                )}
                {approvedPlans.map((p) => (
                  <div key={p.id} className="rounded-xl border border-emerald-200 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3">
                      <div>
                        <p className="text-[15px] font-bold text-stone-800">{p.name}</p>
                        <p className="font-mono text-[15px] text-[#94A3B8]">{p.code}</p>
                      </div>
                      <PlanStatusBadge status={p.status} />
                    </div>
                    <div className="px-4 py-3">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <TypeChip type={p.type} />
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{p.targetArea}</span>
                        <span className="rounded-full bg-[#0038A8]/5 px-2 py-0.5 text-[11px] font-semibold text-[#0038A8]">{p.coverage.pct}% coverage</span>
                      </div>
                      <p className="line-clamp-2 text-[15px] text-stone-500">{p.objective}</p>
                    </div>
                    <div className="border-t border-stone-100 px-4 py-3">
                      <button
                        onClick={() => startFromPlan(p)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[15px] font-bold text-white hover:bg-[#002A8C]"
                      >
                        <Calendar size={12} /> Create Patrol Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "teams" && <TeamsPanel teams={teams} roster={roster} schedules={schedules} flash={flash} />}

            {tab === "schedules" && (
              <div className="space-y-3">
                {schedules.map((s) => {
                  const plan = plans.find((p) => p.id === s.planId);
                  const team = teams.find((t) => t.id === s.teamId);
                  return (
                    <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[15px] font-bold text-stone-800">
                            {s.code} · {plan?.name ?? "Plan"}
                          </p>
                          <p className="mt-0.5 text-[15px] text-stone-500">
                            {dateWindowLabel(s)} · {s.startTime}–{s.endTime} · {freqLabel(s)} · {s.shiftType} shift
                          </p>
                          <p className="mt-1 text-[15px] text-stone-600">
                            <Users size={11} className="mr-1 inline text-[#0038A8]" />
                            {team ? `${team.name} — ${nameOf(team.leaderId)}` : "No team"}
                          </p>
                        </div>
                        <SchedBadge status={s.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.status === "draft" && (
                          <button onClick={() => continueDraft(s)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-[16px] font-semibold text-stone-600">
                            Continue editing
                          </button>
                        )}
                        {s.status === "pending_approval" && (
                          <button onClick={() => setApproveTarget(s)} className="rounded-lg bg-[#0038A8] px-3 py-1.5 text-[16px] font-bold text-white">
                            Approve &amp; activate
                          </button>
                        )}
                        {(s.status === "scheduled" || s.status === "active") && (
                          <button
                            onClick={() => {
                              setLogTarget(s);
                              setLogTanodId(team?.leaderId || roster[0]?.id || "");
                            }}
                            className="rounded-lg border border-stone-200 px-3 py-1.5 text-[16px] font-semibold text-stone-600"
                          >
                            Log duty
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "logs" && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="border-b border-stone-100 px-4 py-3">
                  <p className="text-[15px] font-semibold text-stone-800">Duty logs</p>
                  <p className="text-[16px] text-[#94A3B8]">Start/end of duty and observations feed blotter and BPOPS reports</p>
                </div>
                <table className="w-full text-left text-[16px]">
                  <thead>
                    <tr className="border-b border-stone-100 text-[16px] font-semibold tracking-wider text-[#94A3B8]">
                      <th className="px-4 py-2">Tanod</th>
                      <th className="px-4 py-2">Schedule</th>
                      <th className="px-4 py-2">Start / End</th>
                      <th className="px-4 py-2">Observation</th>
                      <th className="px-4 py-2">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {dutyLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2 font-semibold text-stone-800">{nameOf(l.tanodId)}</td>
                        <td className="px-4 py-2 text-stone-600">{schedules.find((s) => s.id === l.scheduleId)?.code ?? l.scheduleId}</td>
                        <td className="px-4 py-2 text-[15px] text-stone-500">
                          {l.startedAt ? formatDateTime(l.startedAt) : "—"}
                          <br />
                          {l.endedAt ? formatDateTime(l.endedAt) : "on duty"}
                        </td>
                        <td className="px-4 py-2 text-stone-600">{l.observations || "—"}</td>
                        <td className="px-4 py-2">
                          {l.linkedBlotter && <span className="mr-1 rounded-full bg-sky-50 px-2 py-0.5 text-[15px] font-semibold text-sky-700">Blotter</span>}
                          {l.linkedBpops && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[15px] font-semibold text-violet-700">BPOPS</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {leaveOpen && (
        <ConfirmModal
          type="confirm"
          title="Leave wizard?"
          message="Unsaved changes in this patrol schedule will be lost unless you saved a draft."
          cancelLabel="Keep editing"
          confirmLabel="Leave"
          tone="primary"
          onConfirm={() => {
            setLeaveOpen(false);
            setWizardOpen(false);
            setDraft(null);
          }}
          onClose={() => setLeaveOpen(false)}
        />
      )}

      {approveTarget && (
        <ConfirmModal
          type="confirm"
          title={`Approve ${approveTarget.code}?`}
          message="Approved schedules become Scheduled or Active and the assigned team / tanods are notified."
          confirmLabel="Approve & notify"
          tone="primary"
          onConfirm={() => approveSchedule(approveTarget)}
          onClose={() => setApproveTarget(null)}
        />
      )}

      {logTarget && (
        <DutyLogSheet
          schedule={logTarget}
          roster={roster}
          tanodId={logTanodId}
          note={logNote}
          onTanod={setLogTanodId}
          onNote={setLogNote}
          onClose={() => setLogTarget(null)}
          onAction={logDuty}
        />
      )}
    </div>
  );
}

function DutyLogSheet({
  schedule,
  roster,
  tanodId,
  note,
  onTanod,
  onNote,
  onClose,
  onAction,
}: {
  schedule: PatrolSchedule;
  roster: RosterMember[];
  tanodId: string;
  note: string;
  onTanod: (id: string) => void;
  onNote: (v: string) => void;
  onClose: () => void;
  onAction: (k: "start" | "end" | "observe") => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-[16px] font-bold text-stone-900">Duty log · {schedule.code}</p>
            <p className="text-[15px] text-[#94A3B8]">Start/end of duty and observations</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
            <X size={16} />
          </button>
        </div>
        <Field label="Tanod">
          <select className={selectCls} value={tanodId} onChange={(e) => onTanod(e.target.value)}>
            {roster.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3">
          <Field label="Observation">
            <textarea rows={3} className={textareaCls} value={note} onChange={(e) => onNote(e.target.value)} placeholder="What was observed on post…" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onAction("start")} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[15px] font-semibold text-white">
            <Clock size={12} /> Log start
          </button>
          <button onClick={() => onAction("end")} className="flex items-center gap-1 rounded-lg bg-stone-800 px-3 py-2 text-[15px] font-semibold text-white">
            Log end
          </button>
          <button onClick={() => onAction("observe")} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-[15px] font-semibold text-stone-700">
            <FileText size={12} /> Link to blotter / BPOPS
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-[#94A3B8]">
          <Radio size={10} /> Feeds Digital Blotter and BPOPS coverage reports
        </p>
      </div>
    </div>
  );
}
