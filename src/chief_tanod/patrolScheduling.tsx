import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Power,
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
  deleteTeam,
  getSchedules,
  planHasSchedule,
  upsertSchedule,
  upsertTeam,
  usePatrolScheduleStore,
} from "./patrolScheduleStore";
import {
  DAY_LABELS,
  FREQ_OPTIONS,
  SCHED_STATUS_META,
  SHIFT_OPTIONS,
  activeTeamAssignedIds,
  allowedPatrolFrequencies,
  dateWindowLabel,
  emptySchedule,
  findActiveTeamConflicts,
  freqLabel,
  inferShift,
  isOperationalScheduleUsable,
  nextScheduleIdentity,
  operationalLinkIssues,
  operationalScheduleIdForPlan,
  operationalScheduleSummary,
  validateNewTeamMembers,
  validateSchedule,
  type AssignmentMode,
  type PatrolFrequency,
  type PatrolSchedule,
  type PatrolTeam,
  type RosterMember,
  type ShiftType,
} from "./patrolScheduleShared";
import SkillsInventory from "./skillsInventory";

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
  onNavigate,
}: {
  teams: PatrolTeam[];
  roster: RosterMember[];
  schedules: PatrolSchedule[];
  flash: (msg: string, opts?: { type?: "info" | "success" | "warning" | "error" }) => void;
  onNavigate?: (key: string) => void;
}) {
  const [editing, setEditing] = useState<PatrolTeam | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ team: PatrolTeam; action: "delete" | "toggle" } | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessName, setDeleteSuccessName] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; leaderId: string; memberIds: string[] }>({
    name: "",
    leaderId: "",
    memberIds: [],
  });
  const [showForm, setShowForm] = useState(false);
  const [skillsInventoryTanod, setSkillsInventoryTanod] = useState<RosterMember | null>(null);
  const [showSkillsInventory, setShowSkillsInventory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Members taken by another ACTIVE team are not selectable for a new team.
  // Deleting/deactivating a team (or removing the member from it) frees them again.
  const assignedTanodIds = useMemo(
    () => activeTeamAssignedIds(teams, editing?.id ?? undefined),
    [teams, editing?.id]
  );

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;

  const schedulesForTeamCount = useMemo(
    () => new Set(schedules.filter((s) => s.status !== "draft").map((s) => s.teamId)),
    [schedules]
  );

  const rosterRows = useMemo(() => {
    return roster
      .filter(
        (r) =>
          r.available ||
          assignedTanodIds.has(r.id) ||
          (editing !== null && (editing.memberIds.includes(r.id) || editing.leaderId === r.id))
      )
      .map((r) => ({ r, isAssigned: assignedTanodIds.has(r.id) }));
  }, [roster, editing, assignedTanodIds]);

  function openCreate() {
    setForm({ name: "", leaderId: "", memberIds: [] });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(team: PatrolTeam) {
    setForm({ name: team.name, leaderId: team.leaderId, memberIds: team.memberIds.filter((x) => x !== team.leaderId) });
    setEditing(team);
    setShowForm(true);
  }

  async function handleSave() {
    if (isSaving) return;
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
    // Re-check availability at submit time: a member may have joined another
    // active team while this form was open. This also blocks manual bypass
    // attempts (e.g. crafted payloads) on the frontend; the backend re-validates.
    const memberIssues = validateNewTeamMembers(teams, fullIds, {
      excludeTeamId: editing?.id ?? undefined,
      roster,
    });
    if (memberIssues.length > 0) {
      flash(memberIssues.map((i) => i.message).join(" · "), { type: "error" });
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        await upsertTeam({ ...editing, name: form.name.trim(), leaderId: form.leaderId, memberIds: fullIds });
        flash(`Team "${form.name.trim()}" updated`);
        setShowForm(false);
        setEditing(null);
      } else {
        await upsertTeam({
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
    } catch (err) {
      flash((err as Error).message || "Failed to save team", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  function toggleMember(id: string) {
    // Hard guard so a disabled (already-assigned) member cannot be toggled on.
    if (!form.memberIds.includes(id) && assignedTanodIds.has(id) && form.leaderId !== id) {
      flash("That member is already assigned to another active team", { type: "warning" });
      return;
    }
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
            <p className="mt-1 text-[13px] text-amber-700">
              <AlertTriangle size={12} className="mr-1 inline" />
              Tanod assigned to another active team are disabled and marked as "Already assigned"
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[16px] font-semibold text-stone-600">
              {teams.length} teams · {activeCount} active
            </span>
            <button
              onClick={() => onNavigate?.("skills_inventory")}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[15px] font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Award size={13} /> Skills Inventory
            </button>
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
            <p className="mt-0.5 text-[15px] text-stone-700">You have full control</p>
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
                  {rosterRows.map(({ r, isAssigned }) => (
                    <option key={r.id} value={r.id} disabled={isAssigned}>
                      {r.name} · {r.purok} · {r.experienceYears}y{isAssigned ? " — Already assigned to another active team" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[15px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{" "}
                {isSaving ? "Saving…" : editing ? "Save Changes" : "Save Team"}
              </button>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-[#334155]">Roster members</p>
                <span className={`rounded-full px-2 py-0.5 text-[16px] font-semibold ${form.memberIds.length + 1 >= 3 && form.memberIds.length + 1 <= 5 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {form.memberIds.length + 1}/5 persons
                </span>
              </div>
              <p className="mb-2 mt-0.5 text-[11px] text-[#94A3B8]">Check members (1 TL + 2–4 members recommended).</p>

              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {rosterRows.map(({ r, isAssigned }) => {
                  const isLead = form.leaderId === r.id;
                  const on = form.memberIds.includes(r.id);
                  const hasSkillsInventory = r.skillsInventory && Object.keys(r.skillsInventory).length > 0;
                  return (
                    <div key={r.id} className={`rounded-lg border px-3 py-2 ${on || isLead ? "border-[#0038A8]/30 bg-[#E9EDFB]" : isAssigned ? "border-stone-200 bg-stone-100 opacity-60" : "border-stone-100 bg-white"}`}>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={on || (isLead && true)} 
                          disabled={isLead || isAssigned} 
                          onChange={() => toggleMember(r.id)} 
                          className={isAssigned ? "opacity-40 cursor-not-allowed" : ""}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[16px] font-semibold text-stone-800">
                            {r.name} {isLead && <span className="ml-1 rounded-full bg-[#0038A8] px-1.5 py-px text-[10px] font-bold uppercase text-white">Leader</span>}
                            {editing && editing.memberIds.includes(r.id) && <span className="ml-1 rounded-full bg-stone-200 px-1.5 py-px text-[10px] font-semibold text-stone-600">In team</span>}
                            {hasSkillsInventory && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700">Skills ✓</span>}
                            {isAssigned && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">Already assigned</span>}
                          </p>
                          <p className="text-[11px] text-[#94A3B8]">
                            {r.purok} · {r.experienceYears}y · {r.skills.join(", ")} · perf {r.performance}%
                            {!r.available && <span className="ml-1 font-semibold text-rose-600">Unavailable</span>}
                            {isAssigned && <span className="ml-1 font-semibold text-amber-600">Already assigned to another active team</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (isAssigned) {
                              flash("That member is already assigned to another active team", { type: "warning" });
                              return;
                            }
                            setForm({ ...form, leaderId: r.id });
                          }}
                          disabled={isLead || isAssigned}
                          className={`rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-white disabled:opacity-40 ${isAssigned ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {isLead ? "Leader" : "Set as leader"}
                        </button>
                        <button
                          onClick={() => {
                            setSkillsInventoryTanod(r);
                            setShowSkillsInventory(true);
                          }}
                          className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-[#E9EDFB] hover:text-[#0038A8]"
                          title="View Skills Inventory"
                        >
                          <Award size={12} />
                        </button>
                      </div>
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
                      <button onClick={() => { setDeleteError(null); setConfirmTarget({ team, action: "toggle" }); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-amber-50 hover:text-amber-600" title={team.isActive ? "Deactivate team" : "Activate team"}>
                        <Power size={13} />
                      </button>
                      <button onClick={() => { setDeleteError(null); setConfirmTarget({ team, action: "delete" }); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-rose-50 hover:text-rose-600" title="Delete team">
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
        <>
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
            loading={deletingTeamId === confirmTarget.team.id}
            loadingLabel={confirmTarget.action === "delete" ? "Deleting…" : "Updating…"}
            onConfirm={async () => {
              // Prevent duplicate requests while one is already in flight for this team.
              if (deletingTeamId === confirmTarget.team.id) return;
              if (confirmTarget.action === "delete") {
                // Keep the confirmation modal open while the request is processing.
                setDeletingTeamId(confirmTarget.team.id);
                setDeleteError(null);
                try {
                  await deleteTeam(confirmTarget.team.id);
                  // deleteTeam optimistically removes the team and emits,
                  // so the team list refreshes immediately via usePatrolScheduleStore.
                  const deletedName = confirmTarget.team.name;
                  setConfirmTarget(null);
                  setDeleteSuccessName(deletedName);
                } catch (err) {
                  const message = (err as Error).message || "Failed to delete team. Please try again.";
                  setDeleteError(message);
                  flash(message, { type: "error" });
                } finally {
                  setDeletingTeamId(null);
                }
              } else {
                try {
                  await upsertTeam({ ...confirmTarget.team, isActive: !confirmTarget.team.isActive });
                  flash(confirmTarget.team.isActive ? `Team "${confirmTarget.team.name}" deactivated` : `Team "${confirmTarget.team.name}" reactivated`);
                  setConfirmTarget(null);
                } catch (err) {
                  flash((err as Error).message || "Failed to update team", { type: "error" });
                }
              }
            }}
            onClose={() => {
              // Don't allow dismissing while the delete request is processing.
              if (deletingTeamId === confirmTarget.team.id) return;
              setDeleteError(null);
              setConfirmTarget(null);
            }}
          />
          {deleteError && confirmTarget.action === "delete" && (
            <div className="fixed left-1/2 top-6 z-[95] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center shadow-lg">
              <p className="text-[13px] font-semibold text-rose-800">{deleteError}</p>
            </div>
          )}
        </>
      )}

      {deleteSuccessName && (
        <ConfirmModal
          type="success"
          title={`Team "${deleteSuccessName}" deleted successfully`}
          message="The team has been removed and the team list has been updated."
          onClose={() => setDeleteSuccessName(null)}
        />
      )}

      {showSkillsInventory && skillsInventoryTanod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSkillsInventory(false)}>
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Skills Inventory</h2>
                <p className="text-sm text-stone-500">{skillsInventoryTanod.name} · {skillsInventoryTanod.purok}</p>
              </div>
              <button
                onClick={() => setShowSkillsInventory(false)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-6">
              {skillsInventoryTanod.skillsInventory ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800 mb-2">Experience</h3>
                    <div className="space-y-2">
                      <div className="rounded-lg bg-stone-50 p-3">
                        <p className="text-xs font-medium text-stone-500">Existing Tanod Experience</p>
                        <p className="text-sm text-stone-700 mt-1">{skillsInventoryTanod.skillsInventory.existingTanodExperience || "Not specified"}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50 p-3">
                        <p className="text-xs font-medium text-stone-500">Basic Patrol Experience</p>
                        <p className="text-sm text-stone-700 mt-1">{skillsInventoryTanod.skillsInventory.basicPatrolExperience || "Not specified"}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-stone-800 mb-2">Training & Certifications</h3>
                    <div className="rounded-lg bg-stone-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-stone-700">First Aid Training</p>
                        <span className={`text-xs font-semibold ${skillsInventoryTanod.skillsInventory.firstAidTraining.hasTraining ? "text-emerald-600" : "text-stone-500"}`}>
                          {skillsInventoryTanod.skillsInventory.firstAidTraining.hasTraining ? "Yes" : "No"}
                        </span>
                      </div>
                      {skillsInventoryTanod.skillsInventory.firstAidTraining.hasTraining && (
                        <div className="mt-2 space-y-1 text-xs text-stone-600">
                          <p><span className="font-medium">Date:</span> {skillsInventoryTanod.skillsInventory.firstAidTraining.certificateDate || "Not specified"}</p>
                          <p><span className="font-medium">Provider:</span> {skillsInventoryTanod.skillsInventory.firstAidTraining.trainingProvider || "Not specified"}</p>
                          <p><span className="font-medium">Certificate:</span> {skillsInventoryTanod.skillsInventory.firstAidTraining.certificateNumber || "Not specified"}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-stone-800 mb-2">Specialized Skills</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "selfDefenseTraining" as const, label: "Self-Defense" },
                        { key: "disasterResponseTraining" as const, label: "Disaster Response" },
                        { key: "crowdControlTraining" as const, label: "Crowd Control" },
                        { key: "radioCommunicationSkills" as const, label: "Radio Communication" },
                        { key: "humanRightsOrientation" as const, label: "Human Rights" },
                      ].map((skill) => (
                        <div key={skill.key} className="rounded-lg bg-stone-50 p-2 flex items-center justify-between">
                          <span className="text-xs text-stone-700">{skill.label}</span>
                          <span className={`text-xs font-semibold ${skillsInventoryTanod.skillsInventory?.[skill.key] ? "text-emerald-600" : "text-stone-400"}`}>
                            {skillsInventoryTanod.skillsInventory?.[skill.key] ? "Yes" : "No"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {skillsInventoryTanod.skillsInventory.otherRelevantSkills && (
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800 mb-2">Other Skills</h3>
                      <div className="rounded-lg bg-stone-50 p-3">
                        <p className="text-sm text-stone-700">{skillsInventoryTanod.skillsInventory.otherRelevantSkills}</p>
                      </div>
                    </div>
                  )}

                  {skillsInventoryTanod.skillsInventory.certificateNumbers && (
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800 mb-2">Certificate Numbers</h3>
                      <div className="rounded-lg bg-stone-50 p-3">
                        <p className="text-sm text-stone-700">{skillsInventoryTanod.skillsInventory.certificateNumbers}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award size={48} className="mx-auto text-stone-300 mb-4" />
                  <p className="text-sm text-stone-500">No skills inventory data recorded for this Tanod.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex-shrink-0 text-stone-500">{label}</dt>
      <dd className="text-right font-semibold text-stone-800">{value}</dd>
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
  const { roster, teams, schedules, dutyLogs, checkInOutRecords } = usePatrolScheduleStore();

  const [tab, setTab] = useState<"plans" | "teams" | "schedules" | "logs" | "skills_inventory">(isTanod ? "schedules" : "plans");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<PatrolSchedule | null>(null);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [pendingTeam, setPendingTeam] = useState<PatrolTeam | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const approvedPlans = useMemo(
    () => getApprovedCheckpointPlans().filter((p) => !planHasSchedule(p)),
    [plans, schedules]
  );
  const draftPlan = useMemo(() => plans.find((p) => p.id === draft?.planId), [plans, draft?.planId]);
  const draftTeam = useMemo(() => teams.find((t) => t.id === draft?.teamId), [teams, draft?.teamId]);
  const rosterTeam = pendingTeam ?? draftTeam;

  // Members taken by another ACTIVE team are not selectable for a new team.
  // When viewing an existing team, its own members stay enabled.
  const rosterDisabledIds = useMemo(
    () => activeTeamAssignedIds(teams, pendingTeam ? undefined : (draft?.teamId || undefined)),
    [teams, pendingTeam, draft?.teamId]
  );

  // Once a patrol schedule has been created (it has an id and a linked
  // Operational Schedule), the link is read-only here — changes must go
  // through the Operational Schedule itself (Patrol Configuration).
  const opScheduleLocked = Boolean(draft?.id && draft?.operationalScheduleId);

  /** Clamp a patrol date inside the linked Operational Schedule's range. */
  function clampToOperationalRange(value: string): string {
    if (!value || !draftPlan || !isOperationalScheduleUsable(draftPlan)) return value;
    const opStart = draftPlan.schedule.operationDate;
    const opEnd = draftPlan.schedule.endDate?.trim() ? draftPlan.schedule.endDate.trim() : opStart;
    if (value < opStart) return opStart;
    if (value > opEnd) return opEnd;
    return value;
  }

  const opScheduleOptions = useMemo(
    () => [...(draftPlan && !approvedPlans.some((p) => p.id === draftPlan.id) ? [draftPlan] : []), ...approvedPlans],
    [draftPlan, approvedPlans]
  );
  const opRangeStart = draftPlan && isOperationalScheduleUsable(draftPlan) ? draftPlan.schedule.operationDate : "";
  const opRangeEnd =
    draftPlan && isOperationalScheduleUsable(draftPlan)
      ? draftPlan.schedule.endDate?.trim()
        ? draftPlan.schedule.endDate.trim()
        : draftPlan.schedule.operationDate
      : "";
  const opOvernightWindow =
    draftPlan && isOperationalScheduleUsable(draftPlan)
      ? draftPlan.schedule.startTime > draftPlan.schedule.endTime
      : false;
  const allowedFreqs = useMemo(() => allowedPatrolFrequencies(draftPlan), [draftPlan]);
  const opLinkErrs = draft ? operationalLinkIssues(draft, draftPlan).filter((i) => i.level === "error") : [];

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
    if (!isOperationalScheduleUsable(plan)) {
      flash(`No available Operational Schedule for ${plan.code} — it was deleted or is invalid`, { type: "warning" });
      return;
    }
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
    setPendingTeam(null);
    setCreatingTeam(false);
    setStep(1);
    setWizardOpen(true);
  }

  function toggleMember(id: string) {
    // A new (pending) team must not take members of another active team.
    if (pendingTeam && !pendingTeam.memberIds.includes(id) && rosterDisabledIds.has(id)) {
      flash("That member is already assigned to another active team", { type: "warning" });
      return;
    }
    if (pendingTeam) {
      const leaderId = pendingTeam.leaderId;
      let memberIds = pendingTeam.memberIds.includes(id)
        ? pendingTeam.memberIds.filter((x) => x !== id)
        : [...pendingTeam.memberIds, id];
      if (!memberIds.includes(leaderId) && leaderId) memberIds = [leaderId, ...memberIds];
      setPendingTeam({ ...pendingTeam, memberIds });
      return;
    }
    if (!draftTeam) return;
    const leaderId = draftTeam.leaderId;
    let memberIds = draftTeam.memberIds.includes(id)
      ? draftTeam.memberIds.filter((x) => x !== id)
      : [...draftTeam.memberIds, id];
    if (!memberIds.includes(leaderId) && leaderId) memberIds = [leaderId, ...memberIds];
    upsertTeam({ ...draftTeam, memberIds }).catch((err) => {
      flash((err as Error).message || "Failed to update team members", { type: "error" });
    });
  }

  function setLeader(id: string) {
    if (pendingTeam && rosterDisabledIds.has(id) && pendingTeam.leaderId !== id && !pendingTeam.memberIds.includes(id)) {
      flash("That member is already assigned to another active team", { type: "warning" });
      return;
    }
    if (pendingTeam) {
      const memberIds = pendingTeam.memberIds.includes(id) ? pendingTeam.memberIds : [id, ...pendingTeam.memberIds];
      setPendingTeam({ ...pendingTeam, leaderId: id, memberIds });
      return;
    }
    if (!draftTeam) return;
    const memberIds = draftTeam.memberIds.includes(id) ? draftTeam.memberIds : [id, ...draftTeam.memberIds];
    upsertTeam({ ...draftTeam, leaderId: id, memberIds }).catch((err) => {
      flash((err as Error).message || "Failed to update team leader", { type: "error" });
    });
  }

  async function persistTeamCreate() {
    const name = newTeamName.trim();
    if (!name) {
      flash("Team name is required", { type: "warning" });
      return;
    }
    // Re-check at submit time against the latest active teams (covers members
    // assigned elsewhere while the form was open + manual bypass attempts).
    if (pendingTeam) {
      const candidateIds = [pendingTeam.leaderId, ...pendingTeam.memberIds].filter(Boolean);
      const conflicts = findActiveTeamConflicts(teams, candidateIds);
      if (conflicts.length > 0) {
        const names = conflicts.map((id) => roster.find((r) => r.id === id)?.name ?? id);
        flash(`${names.join(", ")} ${conflicts.length === 1 ? "is" : "are"} already assigned to another active team.`, { type: "error" });
        return;
      }
    }
    try {
      if (pendingTeam) {
        const team: PatrolTeam = { ...pendingTeam, name };
        await upsertTeam(team);
        patchDraft({ teamId: team.id, assignmentMode: "whole_team", assignments: [] });
        setPendingTeam(null);
        flash(`Team "${team.name}" created and assigned to this schedule.`);
        return;
      }
      const team: PatrolTeam = {
        id: `team-${Date.now()}`,
        name,
        leaderId: "",
        memberIds: [],
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await upsertTeam(team);
      patchDraft({ teamId: team.id });
      flash("New team created — assign a Team Leader (required) and 2–4 members");
    } catch (err) {
      flash((err as Error).message || "Failed to create team", { type: "error" });
    }
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
    // Even drafts require a live Operational Schedule link — a deleted or
    // invalid Operational Schedule must not seed new patrol schedules.
    const linkErrs = operationalLinkIssues(draft, draftPlan).filter((i) => i.level === "error");
    if (linkErrs.length) {
      flash(linkErrs.map((b) => b.message).join(" · "), { type: "error" });
      return;
    }
    const identity = draft.id ? { id: draft.id, code: draft.code } : nextScheduleIdentity(getSchedules());
    upsertSchedule({ ...draft, ...identity, status: "draft" });
    setPendingTeam(null);
    setWizardOpen(false);
    setDraft(null);
    setTab("schedules");
    flash(`Schedule ${identity.code} saved as Draft`);
  }

  function finishSchedule() {
    if (!draft) return;
    if (blocking.length) {
      flash(blocking.map((b) => b.message).join(" · "), { type: "warning" });
      return;
    }
    const identity = draft.id ? { id: draft.id, code: draft.code } : nextScheduleIdentity(getSchedules());
    const now = new Date().toISOString();
    upsertSchedule({
      ...draft,
      ...identity,
      status: "active",
      submittedAt: now,
      decidedBy: "Punong Barangay / Chief Tanod",
      decidedAt: now,
      notifiedAt: now,
    });
    setPendingTeam(null);
    setWizardOpen(false);
    setDraft(null);
    setTab("schedules");
    flash(`${identity.code} completed — Active. Assigned team notified.`);
  }

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;

  /* ---------------- Tanod-focused list (view only) ---------------- */
  if (isTanod && !wizardOpen) {
    const live = schedules.filter((s) => s.status === "active" || s.status === "scheduled" || s.status === "pending_approval");
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
        {ToastPortal && <ToastPortal />}
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <header className="mb-6 border-b border-stone-200 pb-5">
            <h1 className="text-3xl font-bold text-stone-900">My Patrol Duty</h1>
            <p className="mt-1 text-base text-stone-500">Your assigned patrol schedules</p>
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
                </div>
              );
            })}
          </div>
        </main>
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
                  const first = approvedPlans.find((p) => isOperationalScheduleUsable(p));
                  if (first) startFromPlan(first);
                  else if (approvedPlans.length) flash("No available Operational Schedule — existing ones were deleted or are invalid", { type: "warning" });
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
                        if (!p) return;
                        if (!isOperationalScheduleUsable(p)) {
                          flash("That Operational Schedule is no longer available — select a current one", { type: "warning" });
                          return;
                        }
                        if (p.id === draft.planId) return;
                        setDraft(emptySchedule(p));
                      }}
                    >
                      <option value="">Select plan…</option>
                      {[
                        ...(draftPlan && !approvedPlans.some((p) => p.id === draftPlan.id) ? [draftPlan] : []),
                        ...approvedPlans,
                      ].map((p) => {
                        const usable = isOperationalScheduleUsable(p);
                        return (
                          <option key={p.id} value={p.id} disabled={!usable}>
                            {p.code} — {p.name}{usable ? "" : " — Operational Schedule no longer available"}
                          </option>
                        );
                      })}
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
              <section className="space-y-4">
                {/* Operational Schedule selector — existing backend data, not a separate list */}
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Operational Schedule</p>
                  <p className="mb-2 text-[13px] text-stone-500">
                    Select an existing Operational Schedule. Operation dates, times, checkpoints and recurrence are populated from it automatically.
                  </p>
                  <Field label="Existing Operational Schedule" required>
                    <select
                      className={selectCls}
                      value={draft.operationalScheduleId}
                      disabled={opScheduleLocked}
                      onChange={(e) => {
                        const next = plans.find((x) => operationalScheduleIdForPlan(x) === e.target.value);
                        if (!next) return;
                        if (!isOperationalScheduleUsable(next)) {
                          flash("That Operational Schedule is no longer available — select a current one", { type: "warning" });
                          return;
                        }
                        if (next.id === draft.planId) return;
                        setDraft(emptySchedule(next));
                        flash(`Operational Schedule loaded — ${operationalScheduleSummary(next)}`);
                      }}
                    >
                      <option value="">Select Operational Schedule…</option>
                      {opScheduleOptions.map((p) => {
                        const usable = isOperationalScheduleUsable(p);
                        return (
                          <option key={p.id} value={operationalScheduleIdForPlan(p)} disabled={!usable}>
                            {p.code} — {p.name} · {operationalScheduleSummary(p)}{usable ? "" : " — no longer available"}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                  {opScheduleLocked && (
                    <p className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] font-medium text-stone-600">
                      Linked Operational Schedule is read-only — it cannot be changed after the patrol schedule has been created. Manage it in Patrol Configuration.
                    </p>
                  )}
                  {opLinkErrs.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3">
                      {opLinkErrs.map((i) => (
                        <p key={i.message} className="flex items-start gap-1.5 text-[13px] font-semibold text-rose-700">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {i.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linked details — always read-only */}
                {draftPlan && isOperationalScheduleUsable(draftPlan) && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Linked schedule details (read-only)</p>
                    <dl className="grid grid-cols-1 gap-3 text-[16px] sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">OPERATION DATE</dt>
                        <dd className="font-semibold text-stone-800">{draftPlan.schedule.operationDate}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">END DATE</dt>
                        <dd className="font-semibold text-stone-800">{opRangeEnd}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">OPERATION TIME</dt>
                        <dd className="font-semibold text-stone-800">{draftPlan.schedule.startTime}–{draftPlan.schedule.endTime}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">RECURRING</dt>
                        <dd className="font-semibold text-stone-800">
                          {draftPlan.schedule.recurring === "specific_days"
                            ? draftPlan.schedule.recurringDays.join(", ") || "—"
                            : draftPlan.schedule.recurring === "daily"
                              ? "Daily"
                              : "One-time"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">CHECKPOINTS / ROUTE</dt>
                        <dd className="text-stone-700">
                          {draftPlan.points.length} point{draftPlan.points.length === 1 ? "" : "s"}
                          {(draftPlan.routes?.length ?? 0) > 0 && ` · ${draftPlan.routes!.length} supporting route${draftPlan.routes!.length === 1 ? "" : "s"}`}
                          {draftPlan.points.length > 0 && ` — ${draftPlan.points.slice(0, 4).map((pt) => pt.label).join(", ")}${draftPlan.points.length > 4 ? "…" : ""}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">ASSIGNED TEAM</dt>
                        <dd className="text-stone-700">{draftTeam ? draftTeam.name : "Not selected yet (Step 3)"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[11px] font-semibold text-[#94A3B8]">OPERATIONAL SCHEDULE ID</dt>
                        <dd className="font-mono text-stone-700">{draft.operationalScheduleId || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="mb-1 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Patrol Schedule Details</p>
                <p className="mb-3 text-[13px] text-stone-500">
                  Must stay inside the Operational Schedule range{opRangeStart ? ` (${opRangeStart} → ${opRangeEnd}, ${draftPlan?.schedule.startTime}–${draftPlan?.schedule.endTime})` : ""}. Dates outside it are not allowed.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Start date" required>
                    <input
                      type="date"
                      className={inputCls}
                      value={draft.startDate}
                      min={opRangeStart || undefined}
                      max={opRangeEnd || undefined}
                      disabled={opScheduleLocked}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = clampToOperationalRange(raw);
                        if (v !== raw) flash(`Start date must stay inside the Operational Schedule range ${opRangeStart} → ${opRangeEnd}`, { type: "warning" });
                        patchDraft({ startDate: v, endDate: draft.endDate && draft.endDate < v ? v : draft.endDate });
                      }}
                    />
                  </Field>
                  <Field label="End date">
                    <input
                      type="date"
                      className={inputCls}
                      value={draft.endDate}
                      min={draft.startDate || opRangeStart || undefined}
                      max={opRangeEnd || undefined}
                      disabled={opScheduleLocked}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = clampToOperationalRange(raw);
                        if (v !== raw) flash(`End date must stay inside the Operational Schedule range ${opRangeStart} → ${opRangeEnd}`, { type: "warning" });
                        patchDraft({ endDate: v });
                      }}
                    />
                  </Field>
                  <Field label="Start time" required>
                    <input
                      type="time"
                      className={inputCls}
                      value={draft.startTime}
                      min={!opOvernightWindow && opRangeStart ? draftPlan?.schedule.startTime : undefined}
                      max={!opOvernightWindow && opRangeStart ? draftPlan?.schedule.endTime : undefined}
                      disabled={opScheduleLocked}
                      onChange={(e) => patchDraft({ startTime: e.target.value, shiftType: inferShift(e.target.value) })}
                    />
                  </Field>
                  <Field label="End time" required>
                    <input
                      type="time"
                      className={inputCls}
                      value={draft.endTime}
                      min={!opOvernightWindow && opRangeStart ? draftPlan?.schedule.startTime : undefined}
                      max={!opOvernightWindow && opRangeStart ? draftPlan?.schedule.endTime : undefined}
                      disabled={opScheduleLocked}
                      onChange={(e) => patchDraft({ endTime: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="mb-2 mt-4 text-[15px] font-semibold text-[#334155]">Frequency</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {FREQ_OPTIONS.map((f) => {
                    const allowed = allowedFreqs.includes(f.key as PatrolFrequency);
                    const disabled = opScheduleLocked || !allowed;
                    return (
                      <button
                        key={f.key}
                        disabled={disabled}
                        title={
                          opScheduleLocked
                            ? "Read-only — linked Operational Schedule cannot be changed after creation"
                            : allowed
                              ? undefined
                              : "Not covered by the Operational Schedule's recurrence"
                        }
                        onClick={() =>
                          patchDraft({
                            frequency: f.key as PatrolFrequency,
                            shiftType: f.key === "nightly" ? "night" : draft.shiftType,
                          })
                        }
                        className={`rounded-xl border p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                          draft.frequency === f.key ? "border-[#0038A8] bg-[#E9EDFB] ring-1 ring-[#0038A8]/30" : "border-stone-200 bg-white hover:bg-stone-50"
                        }`}
                      >
                        <p className="text-[15px] font-bold text-stone-800">{f.label}</p>
                        <p className="text-[11px] text-[#94A3B8]">{f.hint}</p>
                      </button>
                    );
                  })}
                </div>
                {draft.frequency === "specific_days" && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((d) => {
                      const on = draft.frequencyDays.includes(d);
                      // Patrol days must be valid recurring dates of the Operational Schedule.
                      const opDayBlocked =
                        !!draftPlan &&
                        isOperationalScheduleUsable(draftPlan) &&
                        draftPlan.schedule.recurring === "specific_days" &&
                        !draftPlan.schedule.recurringDays.includes(d);
                      const disabled = opScheduleLocked || opDayBlocked;
                      return (
                        <button
                          key={d}
                          disabled={disabled}
                          title={
                            opScheduleLocked
                              ? "Read-only — linked Operational Schedule cannot be changed after creation"
                              : opDayBlocked
                                ? `${d} is not a recurring day of the Operational Schedule`
                                : undefined
                          }
                          onClick={() =>
                            patchDraft({
                              frequencyDays: on ? draft.frequencyDays.filter((x) => x !== d) : [...draft.frequencyDays, d],
                            })
                          }
                          className={`rounded-full px-3 py-1 text-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-600"}`}
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
                      disabled={opScheduleLocked}
                      title={opScheduleLocked ? "Read-only — linked Operational Schedule cannot be changed after creation" : undefined}
                      onClick={() => patchDraft({ shiftType: s.key as ShiftType })}
                      className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                        draft.shiftType === s.key ? "border-[#0038A8] bg-[#E9EDFB]" : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      <p className="text-[16px] font-bold text-stone-800">{s.label}</p>
                      <p className="text-[11px] text-[#94A3B8]">{s.window}</p>
                    </button>
                  ))}
                </div>
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
                        onClick={() => {
                          if (creatingTeam && pendingTeam) setPendingTeam(null);
                          setCreatingTeam(false);
                        }}
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
                      <div className="space-y-2">
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
                        <p className="text-[13px] text-stone-500">
                          Only active teams are listed. To add new members, use "New team" — tanods already in another active team cannot be reused.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[13px] text-amber-700">
                          <AlertTriangle size={12} className="mr-1 inline" />
                          Only available Tanod (not in another active team) can be added to new teams
                        </p>
                        <Field label="Team name" required>
                          <input className={inputCls} value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Market Night Watch" />
                        </Field>
                        {!draft.teamId && (
                          <button onClick={persistTeamCreate} className="rounded-lg bg-[#0038A8] px-3 py-1.5 text-[15px] font-semibold text-white">
                            {pendingTeam ? "Save team" : "Create team"}
                          </button>
                        )}
                        {pendingTeam && (
                          <p className="text-[14px] font-semibold text-stone-600">Unsaved team — not yet saved. Click "Save team" to create it.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-[15px] font-semibold uppercase tracking-wider text-[#94A3B8]">Roster</p>
                    <p className="mb-2 text-[13px] text-amber-700">
                      <AlertTriangle size={12} className="mr-1 inline" />
                      Tanod already in another active team are disabled and marked as "Already assigned"
                    </p>
                    {!rosterTeam ? (
                      <p className="text-[16px] text-[#94A3B8]">Select or create a team to assign a leader and members.</p>
                    ) : (
                      <div className="space-y-2">
                        {pendingTeam && (
                          <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[14px] font-semibold text-stone-600">
                            New team preview — {pendingTeam.name}. Not saved until you click "Save team".
                          </p>
                        )}
                        {roster.map((m) => {
                          const on = rosterTeam.memberIds.includes(m.id);
                          const isLead = rosterTeam.leaderId === m.id;
                          const isAssigned = rosterDisabledIds.has(m.id) && !on && !isLead;
                          return (
                            <div key={m.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${on ? "border-[#0038A8]/30 bg-[#E9EDFB]" : isAssigned ? "border-stone-200 bg-stone-100 opacity-60" : "border-stone-100"}`}>
                              <input 
                                type="checkbox" 
                                checked={on} 
                                disabled={isAssigned} 
                                onChange={() => toggleMember(m.id)} 
                                className={isAssigned ? "opacity-40 cursor-not-allowed" : ""}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-semibold text-stone-800">
                                  {m.name} {isLead && <span className="text-[11px] font-bold uppercase text-[#0038A8]">Leader</span>}
                                  {isAssigned && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">Already assigned</span>}
                                </p>
                                <p className="text-[11px] text-[#94A3B8]">
                                  {m.purok} · {m.experienceYears}y · {m.skills.join(", ")} · perf {m.performance}% · last duty {formatDay(m.lastDutyAt)}
                                  {!m.available && <span className="ml-1 font-semibold text-rose-600">Unavailable</span>}
                                  {isAssigned && <span className="ml-1 font-semibold text-amber-600">Already assigned to another active team</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => setLeader(m.id)}
                                disabled={isAssigned}
                                className={`rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-white ${isAssigned ? "opacity-40 cursor-not-allowed" : ""}`}
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
                      <dt className="text-[11px] font-semibold text-[#94A3B8]">OPERATIONAL SCHEDULE</dt>
                      <dd className="text-stone-700">
                        {draft.operationalScheduleId ? (
                          <>
                            ID {draft.operationalScheduleId}
                            {draftPlan && isOperationalScheduleUsable(draftPlan)
                              ? ` · ${operationalScheduleSummary(draftPlan)}`
                              : " · no longer available"}{" "}
                            <span className="text-stone-400">(read-only)</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
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
                  onClick={() => {
                    if (step === 2 && opLinkErrs.length) {
                      flash(opLinkErrs.map((b) => b.message).join(" · "), { type: "error" });
                      return;
                    }
                    if (step === 3 && pendingTeam) {
                      flash("Please save the team first by clicking 'Save team' before continuing.", { type: "warning" });
                      return;
                    }
                    setStep((s) => Math.min(6, s + 1));
                  }}
                  className="flex items-center gap-1 rounded-lg bg-[#0038A8] px-4 py-2 text-[16px] font-semibold text-white"
                >
                  Continue <ChevronRight size={14} />
                </button>
              )}
              <button onClick={saveDraft} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[16px] font-medium text-stone-600">
                Save draft
              </button>
              {step === 6 && (
                <button onClick={finishSchedule} className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[16px] font-bold text-white hover:bg-emerald-700">
                  <Check size={13} /> Done
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
                  { key: "skills_inventory", label: "Skills Inventory" },
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

            {tab === "teams" && <TeamsPanel teams={teams} roster={roster} schedules={schedules} flash={flash} onNavigate={_onNavigate} />}

            {tab === "skills_inventory" && <SkillsInventory />}

            {tab === "schedules" && (
              <div className="space-y-3">
                {schedules.map((s) => {
                  const plan = plans.find((p) => p.id === s.planId);
                  const team = teams.find((t) => t.id === s.teamId);
                  const open = detailsId === s.id;
                  const schedLogs = dutyLogs.filter((l) => l.scheduleId === s.id);
                  const schedCheckIns = checkInOutRecords.filter((r) => r.scheduleId === s.id);
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
                        <button
                          onClick={() => setDetailsId(open ? null : s.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-3 py-1.5 text-[16px] font-semibold text-[#0038A8] hover:bg-[#0038A8]/10"
                        >
                          <Eye size={12} /> {open ? "Hide details" : "Details"}
                        </button>
                        <button
                          onClick={() => continueDraft(s)}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-[16px] font-semibold text-stone-600 hover:bg-stone-50"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        {s.status === "draft" && (
                          <button
                            onClick={() => continueDraft(s)}
                            className="rounded-lg border border-stone-200 px-3 py-1.5 text-[16px] font-semibold text-stone-600 hover:bg-stone-50"
                          >
                            Continue editing
                          </button>
                        )}
                      </div>
                      {open && (
                        <div className="mt-3 space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">Schedule</p>
                              <dl className="mt-2 space-y-1 text-[15px]">
                                <DetailRow label="Frequency" value={freqLabel(s)} />
                                <DetailRow
                                  label="Operational Schedule"
                                  value={(() => {
                                    if (!s.operationalScheduleId) return "Not linked";
                                    const opPlan = plans.find((p) => p.id === s.planId);
                                    const summary =
                                      opPlan && isOperationalScheduleUsable(opPlan)
                                        ? operationalScheduleSummary(opPlan)
                                        : "source no longer available";
                                    return `ID ${s.operationalScheduleId} · ${summary} (read-only)`;
                                  })()}
                                />
                                <DetailRow label="Shift" value={s.shiftType} />
                                <DetailRow
                                  label="Days"
                                  value={
                                    s.frequencyDays.length
                                      ? s.frequencyDays.join(", ")
                                      : s.startDate === s.endDate
                                        ? formatDay(s.startDate)
                                        : "Whole window"
                                  }
                                />
                                {s.customNotes && <DetailRow label="Notes" value={s.customNotes} />}
                                <DetailRow label="Created by" value={s.createdBy} />
                                {s.createdAt && <DetailRow label="Created at" value={formatDateTime(s.createdAt)} />}
                                {s.decidedBy && <DetailRow label="Decided by" value={s.decidedBy} />}
                                {s.decidedAt && <DetailRow label="Decided at" value={formatDateTime(s.decidedAt)} />}
                                {s.notifiedAt && <DetailRow label="Notified at" value={formatDateTime(s.notifiedAt)} />}
                              </dl>
                            </div>
                            <div>
                              <p className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">Operations</p>
                              <dl className="mt-2 space-y-1 text-[15px]">
                                <DetailRow label="Assembly point" value={s.ops.assemblyPoint} />
                                <DetailRow label="Equipment" value={s.ops.equipment} />
                                <DetailRow label="Instructions" value={s.ops.instructions} />
                                <DetailRow label="Pulis coordination" value={s.ops.pulisCoordination} />
                                <DetailRow label="Emergency procedure" value={s.ops.emergencyProcedure} />
                              </dl>
                            </div>
                          </div>

                          {team && (
                            <div>
                              <p className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">Team</p>
                              <p className="mt-2 text-[15px] font-semibold text-stone-800">
                                {team.name}{" "}
                                <span className="ml-1 font-normal text-stone-500">
                                  / TL {nameOf(team.leaderId)} · {team.memberIds.length} members
                                </span>
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {team.memberIds.map((id) => (
                                  <span key={id} className="rounded-full bg-white px-2 py-0.5 text-[13px] font-semibold text-stone-600 ring-1 ring-stone-200">
                                    {nameOf(id)}
                                    {id === team.leaderId && " · TL"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {s.assignments.length > 0 && (
                            <div>
                              <p className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">Checkpoint assignments</p>
                              <ul className="mt-2 space-y-1.5 text-[15px]">
                                {s.assignments.map((a) => {
                                  const point = plan?.points.find((p) => p.id === a.pointId);
                                  return (
                                    <li key={a.pointId} className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-stone-800">{point?.label ?? a.pointId}</span>
                                      {a.tanodIds.length > 0 && (
                                        <span className="text-stone-500">→ {a.tanodIds.map((id) => nameOf(id)).join(", ")}</span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {schedCheckIns.length > 0 && (
                            <div>
                              <p className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">Check-in / check-out</p>
                              <ul className="mt-2 space-y-1.5 text-[15px]">
                                {schedCheckIns.map((r) => (
                                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-stone-800">{nameOf(r.tanodId)}</span>
                                    <span className="text-stone-500">
                                      {r.checkInTime ? formatDateTime(r.checkInTime) : "—"} → {r.checkOutTime ? formatDateTime(r.checkOutTime) : "on duty"}
                                    </span>
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-700">
                                      {r.status === "checked_out" ? "Checked out" : "Checked in"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {schedLogs.length > 0 && (
                            <div>
                              <p className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">Duty logs</p>
                              <ul className="mt-2 space-y-1.5 text-[15px]">
                                {schedLogs.map((l) => (
                                  <li key={l.id} className="flex flex-wrap items-start gap-2">
                                    <span className="font-semibold text-stone-800">{nameOf(l.tanodId)}</span>
                                    <span className="text-stone-500">
                                      {l.startedAt ? formatDateTime(l.startedAt) : "—"}
                                      {l.endedAt ? ` → ${formatDateTime(l.endedAt)}` : " · on duty"}
                                    </span>
                                    {l.observations && <span className="text-stone-600">{l.observations}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "logs" && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="border-b border-stone-100 px-4 py-3">
                  <p className="text-[15px] font-semibold text-stone-800">Duty logs</p>
                  <p className="text-[16px] text-[#94A3B8]">Start/end of duty and observations</p>
                </div>
                <table className="w-full text-left text-[16px]">
                  <thead>
                    <tr className="border-b border-stone-100 text-[16px] font-semibold tracking-wider text-[#94A3B8]">
                      <th className="px-4 py-2">Tanod</th>
                      <th className="px-4 py-2">Schedule</th>
                      <th className="px-4 py-2">Start / End</th>
                      <th className="px-4 py-2">Observation</th>
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
            setPendingTeam(null);
            setLeaveOpen(false);
            setWizardOpen(false);
            setDraft(null);
          }}
          onClose={() => setLeaveOpen(false)}
        />
      )}

    </div>
  );
}
