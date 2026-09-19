import { type CheckpointPlan, DAY_LABELS, formatDay, scheduleOccurrences } from "./patrolShared";

export type PatrolFrequency = "one_time" | "daily" | "nightly" | "specific_days" | "date_range" | "custom";
export type ShiftType = "day" | "night" | "graveyard";
export type AssignmentMode = "whole_team" | "per_checkpoint";
export type PatrolScheduleStatus = "draft" | "pending_approval" | "scheduled" | "active" | "completed";

export interface TrainingCertification {
  hasTraining: boolean;
  certificateDate?: string;
  trainingProvider?: string;
  certificateNumber?: string;
  proofOfTraining?: string;
}

export interface SkillsInventory {
  existingTanodExperience: string;
  basicPatrolExperience: string;
  firstAidTraining: TrainingCertification;
  selfDefenseTraining: boolean;
  disasterResponseTraining: boolean;
  crowdControlTraining: boolean;
  radioCommunicationSkills: boolean;
  humanRightsOrientation: boolean;
  otherRelevantSkills: string;
  certificateNumbers: string;
}

export interface RosterMember {
  id: string;
  name: string;
  purok: string;
  skills: string[];
  experienceYears: number;
  performance: number;
  available: boolean;
  lastDutyAt: string;
  skillsInventory?: SkillsInventory;
}

export interface PatrolTeam {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CheckpointAssignment {
  pointId: string;
  tanodIds: string[];
}

export interface PatrolOpsNotes {
  assemblyPoint: string;
  equipment: string;
  instructions: string;
  pulisCoordination: string;
  emergencyProcedure: string;
}

export interface PatrolSchedule {
  id: string;
  code: string;
  planId: string;
  /** Linked Operational Schedule id (patrol_schedules.id as text).
   *  The Schedule section is driven by this existing backend record — it is
   *  read-only here after creation and managed in Patrol Configuration. */
  operationalScheduleId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  frequency: PatrolFrequency;
  frequencyDays: string[];
  customNotes: string;
  shiftType: ShiftType;
  teamId: string;
  assignmentMode: AssignmentMode;
  assignments: CheckpointAssignment[];
  ops: PatrolOpsNotes;
  status: PatrolScheduleStatus;
  createdBy: string;
  createdAt: string;
  submittedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  notifiedAt?: string;
}

export interface DutyLog {
  id: string;
  scheduleId: string;
  tanodId: string;
  startedAt?: string;
  endedAt?: string;
  observations: string;
  linkedBlotter: boolean;
  linkedBpops: boolean;
  confirmedBy?: string; // Chief Tanod who confirmed check-in/check-out
  photoEvidence?: string; // URL to photo evidence
  checkInNotes?: string; // Notes during check-in
  checkOutNotes?: string; // Notes during check-out
  status: "pending" | "on_duty" | "completed";
}

export interface CheckInOutRecord {
  id: string;
  scheduleId: string;
  tanodId: string;
  teamId: string;
  checkInTime?: string;
  checkOutTime?: string;
  confirmedBy: string; // Chief Tanod ID
  photoEvidence?: string;
  checkInNotes?: string;
  checkOutNotes?: string;
  checkpointPlanId: string;
  status: "checked_in" | "checked_out";
  createdAt: string;
}

export const FREQ_OPTIONS: { key: PatrolFrequency; label: string; hint: string }[] = [
  { key: "one_time", label: "One-time", hint: "Single duty window" },
  { key: "daily", label: "Daily", hint: "Every day in the range" },
  { key: "nightly", label: "Nightly", hint: "Evening / overnight run" },
  { key: "specific_days", label: "Specific Days", hint: "Pick weekdays" },
  { key: "date_range", label: "Date Range", hint: "Inclusive start–end" },
  { key: "custom", label: "Custom", hint: "Describe the cadence" },
];

export const SHIFT_OPTIONS: { key: ShiftType; label: string; window: string }[] = [
  { key: "day", label: "Day", window: "06:00–14:00 typical" },
  { key: "night", label: "Night", window: "14:00–22:00 typical" },
  { key: "graveyard", label: "Graveyard", window: "22:00–06:00 typical" },
];

export const SCHED_STATUS_META: Record<PatrolScheduleStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Draft", badge: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  pending_approval: { label: "Pending Approval", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  scheduled: { label: "Scheduled", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  active: { label: "Active", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  completed: { label: "Completed", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

export function emptyOps(): PatrolOpsNotes {
  return { assemblyPoint: "", equipment: "", instructions: "", pulisCoordination: "", emergencyProcedure: "" };
}

export function emptySchedule(plan?: CheckpointPlan): PatrolSchedule {
  const start = plan?.schedule.operationDate ?? "";
  const end = plan?.schedule.endDate || start;
  const startTime = plan?.schedule.startTime ?? "18:00";
  const endTime = plan?.schedule.endTime ?? "22:00";
  let frequency: PatrolFrequency = "one_time";
  if (plan?.schedule.recurring === "daily") frequency = "daily";
  if (plan?.schedule.recurring === "specific_days") frequency = "specific_days";
  return {
    id: "",
    code: "",
    planId: plan?.id ?? "",
    operationalScheduleId: plan?.schedule?.id != null ? String(plan.schedule.id) : "",
    startDate: start,
    endDate: end,
    startTime,
    endTime,
    frequency,
    frequencyDays: plan?.schedule.recurringDays ?? [],
    customNotes: "",
    shiftType: inferShift(startTime),
    teamId: "",
    assignmentMode: "whole_team",
    assignments: [],
    ops: {
      ...emptyOps(),
      equipment: plan?.notes.equipment ?? "",
      instructions: plan?.notes.general || plan?.notes.special || "",
      pulisCoordination: plan?.notes.coordination ?? "",
      emergencyProcedure: plan?.notes.safety ?? "",
      assemblyPoint: plan?.points.find((p) => p.kind === "start" || p.kind === "fixed")?.name ?? "",
    },
    status: "draft",
    createdBy: "Chief Tanod",
    createdAt: new Date().toISOString(),
  };
}

export function inferShift(startTime: string): ShiftType {
  const h = Number((startTime || "18:00").slice(0, 2));
  if (h >= 6 && h < 14) return "day";
  if (h >= 14 && h < 22) return "night";
  return "graveyard";
}

export function freqLabel(s: PatrolSchedule) {
  if (s.frequency === "one_time") return "One-time";
  if (s.frequency === "daily") return "Daily";
  if (s.frequency === "nightly") return "Nightly";
  if (s.frequency === "date_range") return "Date range";
  if (s.frequency === "custom") return s.customNotes || "Custom";
  return s.frequencyDays.length ? s.frequencyDays.join(", ") : "Specific days";
}

export function dateWindowLabel(s: PatrolSchedule) {
  if (!s.startDate) return "—";
  const a = formatDay(s.startDate);
  if (s.endDate && s.endDate !== s.startDate) return `${a} → ${formatDay(s.endDate)}`;
  return a;
}

export interface MemberCriterion {
  priority: number;
  label: string;
  reason: string;
  score: number;
}

export interface TeamMemberSuggestion {
  id: string;
  name: string;
  member: RosterMember;
  total: number;
  criteria: MemberCriterion[];
}

export const TEAM_CRITERIA: { priority: number; label: string; reason: string }[] = [
  { priority: 1, label: "Residence / Purok", reason: "Familiar with the area" },
  { priority: 2, label: "Availability", reason: "No overlapping duties" },
  { priority: 3, label: "Fair Rotation", reason: "Avoid overloading the same people" },
  { priority: 4, label: "Experience / Skills", reason: "Night patrol or leadership capability" },
  { priority: 5, label: "Team Balance", reason: "Mix of experience levels" },
  { priority: 6, label: "Performance", reason: "Based on previous reliability" },
];

export function memberCriteriaFor(m: RosterMember, opts: { lastDutyAgeDays: number; targetPurok?: string }): MemberCriterion[] {
  const purokScore = opts.targetPurok ? (m.purok === opts.targetPurok ? 25 : 10) : 15;
  return [
    { priority: 1, label: "Residence / Purok", reason: `Based in ${m.purok} — familiar with the area`, score: purokScore },
    { priority: 2, label: "Availability", reason: m.available ? "No overlapping duties — available" : "Marked unavailable", score: m.available ? 20 : 0 },
    { priority: 3, label: "Fair Rotation", reason: `Last duty ${opts.lastDutyAgeDays} days ago — due for a rotation`, score: Math.min(15, opts.lastDutyAgeDays) },
    { priority: 4, label: "Experience / Skills", reason: `${m.experienceYears}y experience · ${m.skills.join(", ")}`, score: Math.min(20, m.experienceYears * 2) },
    { priority: 5, label: "Team Balance", reason: m.experienceYears >= 5 ? "Senior — anchors the team" : m.experienceYears >= 3 ? "Mid — solid contributor" : "Junior — balances the mix", score: Math.min(10, m.experienceYears) },
    { priority: 6, label: "Performance", reason: `Previous reliability rating ${m.performance}%`, score: Math.round(m.performance / 10) },
  ];
}

export function lastDutyAgeDays(m: RosterMember): number {
  const last = new Date(m.lastDutyAt).getTime();
  return Number.isNaN(last) ? 30 : Math.round((Date.now() - last) / 86_400_000);
}

export function suggestTeamMembers(roster: RosterMember[], opts: { excludeIds?: string[]; count?: number; targetPurok?: string } = {}): TeamMemberSuggestion[] {
  const count = opts.count ?? 4;
  const scored = roster
    .filter((m) => m.available)
    .filter((m) => !opts.excludeIds?.includes(m.id))
    .map((m) => {
      const criteria = memberCriteriaFor(m, { lastDutyAgeDays: lastDutyAgeDays(m), targetPurok: opts.targetPurok });
      return { id: m.id, name: m.name, member: m, total: criteria.reduce((s, c) => s + c.score, 0), criteria };
    })
    .sort((a, b) => b.total - a.total);
  return scored.slice(0, count);
}

export function suggestTeamLeader(roster: RosterMember[], scored: TeamMemberSuggestion[], excludeIds: string[] = []): RosterMember | undefined {
  const candidates = scored.filter((s) => !excludeIds.includes(s.id));
  return [...candidates].sort((a, b) => b.member.experienceYears - a.member.experienceYears || b.member.performance - a.member.performance)[0]?.member;
}

export function suggestMembers(plan: CheckpointPlan, roster: RosterMember[], count = 3): RosterMember[] {
  const area = plan.targetArea;
  const scored = roster
    .filter((m) => m.available)
    .map((m) => {
      let score = 0;
      if (m.purok === area) score += 40;
      score += m.available ? 20 : 0;
      score += Math.min(20, m.experienceYears * 2);
      score += Math.round(m.performance / 10);
      const last = new Date(m.lastDutyAt).getTime();
      const ageDays = Number.isNaN(last) ? 30 : (Date.now() - last) / 86_400_000;
      score += Math.min(15, ageDays);
      const purpose = plan.purpose.toLowerCase();
      if (purpose.includes("traffic") && m.skills.some((s) => s.includes("traffic"))) score += 12;
      if (purpose.includes("crime") && m.skills.some((s) => s.includes("watch") || s.includes("crowd"))) score += 12;
      if (purpose.includes("emergency") && m.skills.some((s) => s.includes("flood") || s.includes("first aid"))) score += 12;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((x) => x.m);
}

export function suggestLeader(plan: CheckpointPlan, roster: RosterMember[]): RosterMember | undefined {
  return suggestMembers(plan, roster, 6).sort((a, b) => b.experienceYears - a.experienceYears || b.performance - a.performance)[0];
}

export type ValidationIssue = { level: "error" | "warn"; message: string };

/** Members already taken by an existing *active* team (excluding `excludeTeamId`).
 *  Used to disable those members when creating a new team. Deleting,
 *  deactivating, or removing a member from their team frees them again. */
export function activeTeamAssignedIds(teams: PatrolTeam[], excludeTeamId?: string): Set<string> {
  const assigned = new Set<string>();
  for (const t of teams) {
    if (!t.isActive) continue;
    if (excludeTeamId && t.id === excludeTeamId) continue;
    if (t.leaderId) assigned.add(t.leaderId);
    for (const id of t.memberIds ?? []) {
      if (id) assigned.add(id);
    }
  }
  return assigned;
}

/** Subset of `candidateIds` that conflict with another active team. */
export function findActiveTeamConflicts(
  teams: PatrolTeam[],
  candidateIds: string[],
  excludeTeamId?: string
): string[] {
  const assigned = activeTeamAssignedIds(teams, excludeTeamId);
  return [...new Set(candidateIds.filter(Boolean))].filter((id) => assigned.has(id));
}

/** Frontend guard for Create/Update team: rejects already-assigned members and
 *  in-payload duplicates so a manual submit cannot bypass the disabled UI. */
export function validateNewTeamMembers(
  teams: PatrolTeam[],
  candidateIds: string[],
  opts: { excludeTeamId?: string; roster?: RosterMember[] } = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = candidateIds.filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if ([...new Set(dupes)].length > 0) {
    issues.push({ level: "error", message: "Duplicate members selected — each tanod can only appear once per team." });
  }
  const conflicts = findActiveTeamConflicts(teams, ids, opts.excludeTeamId);
  if (conflicts.length > 0) {
    const names = conflicts.map((id) => opts.roster?.find((r) => r.id === id)?.name ?? id);
    issues.push({
      level: "error",
      message: `${names.join(", ")} ${conflicts.length === 1 ? "is" : "are"} already assigned to another active team.`,
    });
  }
  return issues;
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function schedulesConflict(a: PatrolSchedule, b: PatrolSchedule) {
  if (a.id && b.id && a.id === b.id) return false;
  if (!a.startDate || !b.startDate) return false;
  const aEnd = a.endDate || a.startDate;
  const bEnd = b.endDate || b.startDate;
  const datesOverlap = a.startDate <= bEnd && b.startDate <= aEnd;
  if (!datesOverlap) return false;
  return timesOverlap(a.startTime || "00:00", a.endTime || "23:59", b.startTime || "00:00", b.endTime || "23:59");
}

export function assignedTanodIds(s: PatrolSchedule, team: PatrolTeam | undefined): string[] {
  if (s.assignmentMode === "per_checkpoint") {
    return [...new Set(s.assignments.flatMap((a) => a.tanodIds))];
  }
  return team?.memberIds ?? [];
}

/* ---------------- Operational Schedule linkage ---------------- */
// The Schedule section is driven by the existing Operational Schedule
// (the patrol_schedules row owned by the approved checkpoint plan) instead
// of a separate free-form schedule list.

/** Operational Schedule id for a plan ("" when the backend has none). */
export function operationalScheduleIdForPlan(plan?: CheckpointPlan): string {
  return plan?.schedule?.id != null ? String(plan.schedule.id) : "";
}

/** Whether the plan carries a usable Operational Schedule from the backend. */
export function isOperationalScheduleUsable(plan?: CheckpointPlan): boolean {
  const s = plan?.schedule;
  if (!s || s.id == null) return false;
  if (!s.operationDate || !s.startTime || !s.endTime) return false;
  const end = s.endDate?.trim() ? s.endDate.trim() : s.operationDate;
  if (!end || end < s.operationDate) return false;
  return true;
}

/** One-line summary of the Operational Schedule for selectors and read-only views. */
export function operationalScheduleSummary(plan?: CheckpointPlan): string {
  const s = plan?.schedule;
  if (!s?.operationDate) return "No Operational Schedule";
  const end = s.endDate?.trim() ? s.endDate.trim() : s.operationDate;
  const recur =
    s.recurring === "specific_days" && s.recurringDays.length
      ? ` · ${s.recurringDays.join(", ")}`
      : s.recurring === "daily"
        ? " · Daily"
        : "";
  return `${s.operationDate}${end !== s.operationDate ? ` → ${end}` : ""} · ${s.startTime}–${s.endTime}${recur}`;
}

/** Patrol frequencies allowed under the Operational Schedule's recurrence. */
export function allowedPatrolFrequencies(plan?: CheckpointPlan): PatrolFrequency[] {
  const r = plan?.schedule?.recurring ?? "none";
  if (r === "none") return ["one_time"];
  if (r === "daily") return ["one_time", "daily", "nightly", "date_range", "specific_days"];
  return ["one_time", "specific_days"];
}

function patrolTimeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((t || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function patrolTimeWithin(t: string, windowStart: string, windowEnd: string): boolean {
  const tm = patrolTimeToMinutes(t);
  const sm = patrolTimeToMinutes(windowStart);
  const em = patrolTimeToMinutes(windowEnd);
  if (tm === null || sm === null || em === null || sm === em) return false;
  const spans: Array<[number, number]> = em > sm ? [[sm, em]] : [[sm, 1440], [0, em]];
  return spans.some(([a, b]) => a <= tm && tm <= b);
}

function patrolDateToWeekday(ds: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ds || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return DAY_LABELS[d.getDay()];
}

/** Concrete patrol dates implied by the draft (capped, for containment checks). */
export function patrolDatesOf(s: PatrolSchedule, limit = 370): string[] {
  const end = s.endDate?.trim() ? s.endDate.trim() : s.startDate;
  if (!s.startDate || !end || end < s.startDate) return [];
  const out: string[] = [];
  const startD = new Date(`${s.startDate}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  const total = Math.round((endD.getTime() - startD.getTime()) / 86400000);
  if (Number.isNaN(total) || total < 0 || total > limit) return [];
  if (s.frequency === "one_time" || s.frequency === "custom") return [s.startDate];
  const want = new Set(s.frequency === "specific_days" ? s.frequencyDays : []);
  for (let i = 0; i <= total; i += 1) {
    const d = new Date(startD.getTime() + i * 86400000);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (s.frequency === "specific_days") {
      const w = patrolDateToWeekday(ds);
      if (w && want.has(w)) out.push(ds);
    } else {
      out.push(ds);
    }
  }
  return out;
}

/** Link-level issues: missing, deleted, or invalid Operational Schedule.
 *  These block even draft saves — containment below is enforced on activation. */
export function operationalLinkIssues(s: PatrolSchedule, plan?: CheckpointPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!s.operationalScheduleId) {
    issues.push({
      level: "error",
      message: "Select an existing Operational Schedule — a patrol schedule cannot be created without one.",
    });
    return issues;
  }
  if (!plan) {
    issues.push({
      level: "error",
      message: "The linked checkpoint plan is no longer available — its Operational Schedule can no longer be used.",
    });
    return issues;
  }
  if (!isOperationalScheduleUsable(plan) || operationalScheduleIdForPlan(plan) !== s.operationalScheduleId) {
    issues.push({
      level: "error",
      message:
        "The linked Operational Schedule is no longer available — it was deleted or is invalid. Manage Operational Schedules in Patrol Configuration.",
    });
  }
  return issues;
}

/** Window containment: patrol dates/times must stay inside the linked
 *  Operational Schedule's range, and patrol dates must be valid recurring
 *  dates generated by that schedule. */
export function operationalWindowIssues(s: PatrolSchedule, plan?: CheckpointPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!s.operationalScheduleId || !plan || !isOperationalScheduleUsable(plan)) return issues;
  if (operationalScheduleIdForPlan(plan) !== s.operationalScheduleId) return issues;
  const op = plan.schedule;
  const opEnd = op.endDate?.trim() ? op.endDate.trim() : op.operationDate;
  if (s.frequency === "custom") {
    issues.push({
      level: "error",
      message: "Custom cadence cannot be verified against the Operational Schedule — pick a listed frequency within its dates.",
    });
    return issues;
  }
  const end = s.endDate?.trim() ? s.endDate.trim() : s.startDate;
  if (!s.startDate || end < s.startDate || s.startDate < op.operationDate || end > opEnd) {
    issues.push({
      level: "error",
      message: `Patrol dates must stay inside the Operational Schedule range ${op.operationDate} → ${opEnd}.`,
    });
    return issues;
  }
  if (
    !patrolTimeWithin(s.startTime, op.startTime, op.endTime) ||
    !patrolTimeWithin(s.endTime, op.startTime, op.endTime)
  ) {
    issues.push({
      level: "error",
      message: `Patrol times must stay inside the Operational Schedule window ${op.startTime}–${op.endTime}.`,
    });
  }
  const occurrences = new Set(scheduleOccurrences(op));
  for (const ds of patrolDatesOf(s)) {
    if (!occurrences.has(ds)) {
      issues.push({
        level: "error",
        message: `Patrol date ${ds} is not a valid recurring date of the Operational Schedule.`,
      });
      break;
    }
  }
  return issues;
}

export function validateSchedule(
  s: PatrolSchedule,
  plan: CheckpointPlan | undefined,
  team: PatrolTeam | undefined,
  roster: RosterMember[],
  others: PatrolSchedule[],
  allTeams: PatrolTeam[] = []
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!s.planId) issues.push({ level: "error", message: "Select an approved checkpoint plan." });
  issues.push(...operationalLinkIssues(s, plan));
  issues.push(...operationalWindowIssues(s, plan));
  if (!s.startDate) issues.push({ level: "error", message: "Start date is required." });
  if (!s.startTime || !s.endTime) issues.push({ level: "error", message: "Start and end times are required." });
  if (s.frequency === "specific_days" && s.frequencyDays.length === 0) {
    issues.push({ level: "error", message: "Pick at least one weekday." });
  }
  if (s.frequency === "custom" && !s.customNotes.trim()) {
    issues.push({ level: "error", message: "Describe the custom frequency." });
  }
  if ((s.frequency === "date_range" || s.frequency === "daily" || s.frequency === "nightly") && !s.endDate) {
    issues.push({ level: "error", message: "End date is required for this frequency." });
  }
  if (!s.teamId) issues.push({ level: "error", message: "Select a team." });
  if (s.teamId && !team) issues.push({ level: "error", message: "Selected team not found." });
  if (team && !team.leaderId) issues.push({ level: "error", message: "Team Leader is required." });
  if (team && team.isActive === false) issues.push({ level: "error", message: `${team.name} is deactivated — reactivate it in Team Management.` });
  if (team) {
    const size = team.memberIds.length;
    if (size < 3) issues.push({ level: "warn", message: "Team is understaffed — 1 TL + 2–4 members recommended." });
    else if (size > 5) issues.push({ level: "warn", message: "Team has more than 5 persons — confirm this is intended." });
    const missing = team.memberIds.filter((id) => !roster.some((r) => r.id === id));
    if (missing.length) issues.push({ level: "error", message: "One or more assigned members are not on the roster." });
    const unavailable = team.memberIds
      .map((id) => roster.find((r) => r.id === id))
      .filter((m) => m && !m.available);
    if (unavailable.length) {
      issues.push({
        level: "warn",
        message: `Unavailable: ${unavailable.map((m) => m!.name).join(", ")}`,
      });
    }
  }
  if (s.assignmentMode === "per_checkpoint" && plan) {
    for (const pt of plan.points) {
      const row = s.assignments.find((a) => a.pointId === pt.id);
      if (!row || row.tanodIds.length === 0) {
        issues.push({ level: "warn", message: `${pt.label} (${pt.name || "unnamed"}) has no assigned tanod.` });
      }
    }
  }
  const ids = assignedTanodIds(s, team);
  for (const other of others.filter((o) => ["pending_approval", "scheduled", "active"].includes(o.status))) {
    if (!schedulesConflict(s, other)) continue;
    const otherTeam = allTeams.find((t) => t.id === other.teamId);
    const otherIds = assignedTanodIds(other, otherTeam);
    const clash = ids.filter((id) => otherIds.includes(id));
    if (clash.length) {
      const names = clash.map((id) => roster.find((r) => r.id === id)?.name ?? id).join(", ");
      issues.push({
        level: "warn",
        message: `Personnel conflict with ${other.code}: ${names} already assigned in an overlapping window.`,
      });
    } else {
      issues.push({
        level: "warn",
        message: `Schedule window overlaps ${other.code}. Confirm coverage does not collide.`,
      });
    }
  }
  if (ids.length === 0 && team) {
    issues.push({ level: "error", message: "No tanods assigned to this duty." });
  }
  return issues;
}

export function nextScheduleIdentity(existing: PatrolSchedule[]) {
  let max = 40;
  for (const s of existing) {
    const m = /PS-(\d+)/.exec(s.code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = max + 1;
  return { id: `PS-2026-${String(n).padStart(3, "0")}`, code: `PS-${String(n).padStart(3, "0")}` };
}

export { DAY_LABELS };
