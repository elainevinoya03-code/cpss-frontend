import { useEffect, useState } from "react";
import { type CheckpointPlan } from "./patrolShared";
import {
  type CheckInOutRecord,
  type DutyLog,
  type PatrolSchedule,
  type PatrolTeam,
  type RosterMember,
  type SkillsInventory,
} from "./patrolScheduleShared";
import { fetchRosterMembers } from "./rosterApi";
import {
  deleteTeamApi,
  fetchCheckIns,
  fetchDutyLogs,
  fetchSchedules,
  fetchTeams,
  patchCheckIn,
  patchDutyLog,
  saveCheckIn,
  saveDutyLog,
  saveSchedule,
  saveTeam,
} from "./patrolSchedulingApi";

let roster: RosterMember[] = [];
let teams: PatrolTeam[] = [];

let schedules: PatrolSchedule[] = [];
let dutyLogs: DutyLog[] = [];
let checkInOutRecords: CheckInOutRecord[] = [];

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}

let rosterLoaded = false;

export async function loadRosterFromBackend(): Promise<void> {
  if (rosterLoaded) return;
  try {
    const members = await fetchRosterMembers();
    if (members.length) {
      roster = members;
      rosterLoaded = true;
      emit();
    }
  } catch (err) {
    console.warn("Failed to load roster from backend. Using seed data.", err);
  }
}

let opsLoaded = false;

export async function loadPatrolOperationsFromBackend(): Promise<void> {
  if (opsLoaded) return;
  try {
    const [teamRows, schedRows, dutyRows, checkInRows] = await Promise.all([
      fetchTeams(),
      fetchSchedules(),
      fetchDutyLogs(),
      fetchCheckIns(),
    ]);
    if (teamRows.length) teams = teamRows;
    if (schedRows.length) schedules = schedRows;
    if (dutyRows.length) dutyLogs = dutyRows;
    if (checkInRows.length) checkInOutRecords = checkInRows;
    opsLoaded = true;
    emit();
  } catch (err) {
    console.warn("Failed to load patrol operations from backend. Using in-memory state.", err);
  }
}

loadRosterFromBackend();
loadPatrolOperationsFromBackend();

export function subscribePatrolSchedules(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getRoster(): RosterMember[] {
  return roster;
}
export function getTeams(): PatrolTeam[] {
  return teams;
}
export function getSchedules(): PatrolSchedule[] {
  return schedules;
}
export function getDutyLogs(): DutyLog[] {
  return dutyLogs;
}

export function getCheckInOutRecords(): CheckInOutRecord[] {
  return checkInOutRecords;
}

export async function upsertTeam(team: PatrolTeam): Promise<PatrolTeam> {
  const existing = teams.find((t) => t.id === team.id);
  const inserting = !existing;
  teams = inserting ? [team, ...teams] : teams.map((t) => (t.id === team.id ? team : t));
  emit();
  try {
    const saved = await saveTeam(team);
    teams = teams.map((t) => (t.id === saved.id ? saved : t));
    emit();
    return saved;
  } catch (err) {
    if (inserting) {
      teams = teams.filter((t) => t.id !== team.id);
    } else if (existing) {
      teams = teams.map((t) => (t.id === team.id ? existing : t));
    }
    emit();
    throw err;
  }
}

export async function deleteTeam(id: string): Promise<void> {
  const existing = teams.find((t) => t.id === id);
  teams = teams.filter((t) => t.id !== id);
  emit();
  try {
    await deleteTeamApi(id);
  } catch (err) {
    if (existing) teams = [existing, ...teams];
    emit();
    throw err;
  }
}

export function upsertRosterMember(member: RosterMember): RosterMember {
  const exists = roster.some((m) => m.id === member.id);
  roster = exists ? roster.map((m) => (m.id === member.id ? member : m)) : [member, ...roster];
  emit();
  return member;
}

export function upsertSchedule(s: PatrolSchedule): PatrolSchedule {
  const exists = schedules.some((x) => x.id === s.id);
  schedules = exists ? schedules.map((x) => (x.id === s.id ? s : x)) : [s, ...schedules];
  emit();
  saveSchedule(s).catch((err) => console.warn("Failed to persist schedule", s.id, err));
  return s;
}

export function addDutyLog(log: DutyLog): DutyLog {
  dutyLogs = [log, ...dutyLogs];
  emit();
  saveDutyLog(log).catch((err) => console.warn("Failed to persist duty log", log.id, err));
  return log;
}

export function updateDutyLog(id: string, patch: Partial<DutyLog>): DutyLog | null {
  const next = dutyLogs.map((l) => (l.id === id ? { ...l, ...patch } : l));
  const found = next.find((l) => l.id === id) ?? null;
  if (!found) return null;
  dutyLogs = next;
  emit();
  patchDutyLog(id, patch).catch((err) => console.warn("Failed to update duty log", id, err));
  return found;
}

export function addCheckInOutRecord(record: CheckInOutRecord): CheckInOutRecord {
  checkInOutRecords = [record, ...checkInOutRecords];
  emit();
  saveCheckIn(record).catch((err) => console.warn("Failed to persist check-in record", record.id, err));
  return record;
}

export function updateCheckInOutRecord(id: string, patch: Partial<CheckInOutRecord>): CheckInOutRecord | null {
  const next = checkInOutRecords.map((r) => (r.id === id ? { ...r, ...patch } : r));
  const found = next.find((r) => r.id === id) ?? null;
  if (!found) return null;
  checkInOutRecords = next;
  emit();
  patchCheckIn(id, patch).catch((err) => console.warn("Failed to update check-in record", id, err));
  return found;
}

export function getTodaySchedules(): PatrolSchedule[] {
  const today = new Date().toISOString().split('T')[0];
  return schedules.filter(s => 
    s.status === 'scheduled' || s.status === 'active'
  ).filter(s => {
    const startDate = s.startDate;
    const endDate = s.endDate || s.startDate;
    return today >= startDate && today <= endDate;
  });
}

export function getOnDutyTanods(): CheckInOutRecord[] {
  return checkInOutRecords.filter(r => r.status === 'checked_in');
}

// --- Schedule-gated helpers: teams/tanods are only visible/actionable
// once a non-draft schedule exists for their team. ---
export function getScheduledTeamIds(): Set<string> {
  return new Set(
    schedules.filter((s) => s.status !== "draft").map((s) => s.teamId)
  );
}

export function teamHasSchedule(teamId: string): boolean {
  return schedules.some((s) => s.teamId === teamId && s.status !== "draft");
}

export function canCheckInToSchedule(scheduleId: string): boolean {
  const s = schedules.find((x) => x.id === scheduleId);
  if (!s) return false;
  if (s.status !== "scheduled" && s.status !== "active") return false;
  const today = new Date().toISOString().split("T")[0];
  const end = s.endDate || s.startDate;
  if (!(today >= s.startDate && today <= end)) return false;
  const team = teams.find((t) => t.id === s.teamId);
  if (!team || !team.isActive) return false;
  return true;
}

export function usePatrolScheduleStore() {
  const [, setTick] = useState(0);
  useEffect(() => subscribePatrolSchedules(() => setTick((t) => t + 1)), []);
  return { roster, teams, schedules, dutyLogs, checkInOutRecords };
}

export function planHasSchedule(plan: CheckpointPlan) {
  return schedules.some((s) => s.planId === plan.id && s.status !== "draft");
}
