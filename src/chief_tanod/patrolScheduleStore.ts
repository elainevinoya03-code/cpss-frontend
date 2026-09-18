import { useEffect, useState } from "react";
import { type CheckpointPlan } from "./patrolShared";
import {
  SEED_ROSTER,
  SEED_TEAMS,
  type CheckInOutRecord,
  type DutyLog,
  type PatrolSchedule,
  type PatrolTeam,
  type RosterMember,
  type SkillsInventory,
} from "./patrolScheduleShared";
import { fetchRosterMembers } from "./rosterApi";

let roster: RosterMember[] = SEED_ROSTER.map((m) => ({ ...m, skills: [...m.skills] }));
let teams: PatrolTeam[] = SEED_TEAMS.map((t) => ({ ...t, memberIds: [...t.memberIds] }));
const todayStr = new Date().toISOString().split("T")[0];

let schedules: PatrolSchedule[] = [
  {
    id: "PS-2026-043",
    code: "PS-043",
    planId: "CP-2026-118",
    startDate: todayStr,
    endDate: todayStr,
    startTime: "18:00",
    endTime: "23:00",
    frequency: "one_time",
    frequencyDays: [],
    customNotes: "",
    shiftType: "night",
    teamId: "team-alpha",
    assignmentMode: "whole_team",
    assignments: [],
    ops: {
      assemblyPoint: "Barangay Hall Front",
      equipment: "Two search lights, traffic cones, log sheet, two handheld radios.",
      instructions: "Full tanod uniform with reflective vest. Briefing 30 min before start.",
      pulisCoordination: "Coordinate with Purok 3 leader and PNP substation / Pulis sa Barangay on channel 2.",
      emergencyProcedure: "Radio Desk Officer immediately; log observations on BLOTTER-1; escalate SOS to PNP.",
    },
    status: "scheduled",
    createdBy: "Chief Tanod",
    createdAt: `${todayStr}T08:10:00`,
    submittedAt: `${todayStr}T09:00:00`,
    decidedBy: "Punong Barangay",
    decidedAt: `${todayStr}T14:20:00`,
    notifiedAt: `${todayStr}T14:21:00`,
  },
  {
    id: "PS-2026-041",
    code: "PS-041",
    planId: "CP-2026-118",
    startDate: "2026-09-16",
    endDate: "2026-09-16",
    startTime: "18:00",
    endTime: "23:00",
    frequency: "one_time",
    frequencyDays: [],
    customNotes: "",
    shiftType: "night",
    teamId: "team-alpha",
    assignmentMode: "whole_team",
    assignments: [],
    ops: {
      assemblyPoint: "Market North Gate",
      equipment: "Two search lights, traffic cones, log sheet, two handheld radios.",
      instructions: "Full tanod uniform with reflective vest. Briefing 30 min before start.",
      pulisCoordination: "Coordinate with Purok 3 leader and PNP substation / Pulis sa Barangay on channel 2.",
      emergencyProcedure: "Radio Desk Officer immediately; log observations on BLOTTER-1; escalate SOS to PNP.",
    },
    status: "scheduled",
    createdBy: "Chief Tanod",
    createdAt: "2026-09-12T08:10:00",
    submittedAt: "2026-09-12T09:00:00",
    decidedBy: "Punong Barangay",
    decidedAt: "2026-09-12T14:20:00",
    notifiedAt: "2026-09-12T14:21:00",
  },
  {
    id: "PS-2026-042",
    code: "PS-042",
    planId: "CP-2026-118",
    startDate: "2026-09-20",
    endDate: "2026-09-27",
    startTime: "18:00",
    endTime: "23:00",
    frequency: "specific_days",
    frequencyDays: ["Fri", "Sat", "Sun"],
    customNotes: "",
    shiftType: "night",
    teamId: "team-bravo",
    assignmentMode: "whole_team",
    assignments: [],
    ops: {
      assemblyPoint: "Market North Gate",
      equipment: "Two search lights, traffic cones, log sheet, two handheld radios.",
      instructions: "Full tanod uniform with reflective vest. Briefing 30 min before start.",
      pulisCoordination: "Coordinate with Purok 3 leader and PNP substation / Pulis sa Barangay on channel 2.",
      emergencyProcedure: "Radio Desk Officer immediately; log observations on BLOTTER-1; escalate SOS to PNP.",
    },
    status: "scheduled",
    createdBy: "Chief Tanod",
    createdAt: "2026-09-12T08:10:00",
    submittedAt: "2026-09-12T09:00:00",
    decidedBy: "Punong Barangay",
    decidedAt: "2026-09-12T14:20:00",
    notifiedAt: "2026-09-12T14:21:00",
  },
];
let dutyLogs: DutyLog[] = [
  {
    id: "DL-001",
    scheduleId: "PS-2026-041",
    tanodId: "tn-01",
    startedAt: "2026-09-13T18:05:00",
    endedAt: "2026-09-13T23:02:00",
    observations: "Market row quiet after 21:00. Two motorcycle stops logged; no incident referral.",
    linkedBlotter: true,
    linkedBpops: true,
    confirmedBy: "Chief Tanod",
    status: "completed",
  },
];

let checkInOutRecords: CheckInOutRecord[] = [
  {
    id: "CIO-001",
    scheduleId: "PS-2026-043",
    tanodId: "tn-01",
    teamId: "team-alpha",
    checkInTime: `${todayStr}T18:05:00`,
    confirmedBy: "Chief Tanod",
    checkInNotes: "On time. Full uniform, radio issued.",
    checkpointPlanId: "CP-2026-118",
    status: "checked_in",
    createdAt: `${todayStr}T18:05:00`,
  },
  {
    id: "CIO-002",
    scheduleId: "PS-2026-043",
    tanodId: "tn-02",
    teamId: "team-alpha",
    checkInTime: `${todayStr}T18:07:00`,
    confirmedBy: "Chief Tanod",
    checkInNotes: "Late by 7 mins, reminded of assembly time.",
    checkpointPlanId: "CP-2026-118",
    status: "checked_in",
    createdAt: `${todayStr}T18:07:00`,
  },
  {
    id: "CIO-003",
    scheduleId: "PS-2026-041",
    tanodId: "tn-03",
    teamId: "team-alpha",
    checkInTime: "2026-09-16T18:04:00",
    checkOutTime: "2026-09-16T23:02:00",
    confirmedBy: "Chief Tanod",
    checkInNotes: "Night patrol briefing completed.",
    checkOutNotes: "Duty completed, no incident. Equipment returned.",
    checkpointPlanId: "CP-2026-118",
    status: "checked_out",
    createdAt: "2026-09-16T18:04:00",
  },
];

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

loadRosterFromBackend();

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

export function upsertTeam(team: PatrolTeam): PatrolTeam {
  const exists = teams.some((t) => t.id === team.id);
  teams = exists ? teams.map((t) => (t.id === team.id ? team : t)) : [team, ...teams];
  emit();
  return team;
}

export function deleteTeam(id: string): void {
  teams = teams.filter((t) => t.id !== id);
  emit();
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
  return s;
}

export function addDutyLog(log: DutyLog): DutyLog {
  dutyLogs = [log, ...dutyLogs];
  emit();
  return log;
}

export function updateDutyLog(id: string, patch: Partial<DutyLog>): DutyLog | null {
  dutyLogs = dutyLogs.map((l) => (l.id === id ? { ...l, ...patch } : l));
  emit();
  return dutyLogs.find((l) => l.id === id) ?? null;
}

export function addCheckInOutRecord(record: CheckInOutRecord): CheckInOutRecord {
  checkInOutRecords = [record, ...checkInOutRecords];
  emit();
  return record;
}

export function updateCheckInOutRecord(id: string, patch: Partial<CheckInOutRecord>): CheckInOutRecord | null {
  checkInOutRecords = checkInOutRecords.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
  return checkInOutRecords.find((r) => r.id === id) ?? null;
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
