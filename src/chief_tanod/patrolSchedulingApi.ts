import { type CheckInOutRecord, type DutyLog, type PatrolSchedule, type PatrolTeam } from "./patrolScheduleShared";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data?.detail || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Teams ───────────────────────────────────────────────────────────────

export async function fetchTeams(): Promise<PatrolTeam[]> {
  return apiFetch<PatrolTeam[]>("/api/patrol-scheduling/teams");
}

export async function saveTeam(team: PatrolTeam): Promise<PatrolTeam> {
  return apiFetch<PatrolTeam>("/api/patrol-scheduling/teams", {
    method: "POST",
    body: JSON.stringify(team),
  });
}

export async function deleteTeamApi(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/patrol-scheduling/teams/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Schedules ───────────────────────────────────────────────────────────

export async function fetchSchedules(): Promise<PatrolSchedule[]> {
  return apiFetch<PatrolSchedule[]>("/api/patrol-scheduling/schedules");
}

export async function saveSchedule(schedule: PatrolSchedule): Promise<PatrolSchedule> {
  return apiFetch<PatrolSchedule>("/api/patrol-scheduling/schedules", {
    method: "POST",
    body: JSON.stringify(schedule),
  });
}

// ── Duty logs ───────────────────────────────────────────────────────────

export async function fetchDutyLogs(): Promise<DutyLog[]> {
  return apiFetch<DutyLog[]>("/api/patrol-scheduling/duty-logs");
}

export async function saveDutyLog(log: DutyLog): Promise<DutyLog> {
  return apiFetch<DutyLog>("/api/patrol-scheduling/duty-logs", {
    method: "POST",
    body: JSON.stringify(log),
  });
}

export async function patchDutyLog(id: string, patch: Partial<DutyLog>): Promise<DutyLog> {
  return apiFetch<DutyLog>(`/api/patrol-scheduling/duty-logs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ── Check-in / Check-out ────────────────────────────────────────────────

export async function fetchCheckIns(): Promise<CheckInOutRecord[]> {
  return apiFetch<CheckInOutRecord[]>("/api/patrol-scheduling/check-ins");
}

export async function saveCheckIn(record: CheckInOutRecord): Promise<CheckInOutRecord> {
  return apiFetch<CheckInOutRecord>("/api/patrol-scheduling/check-ins", {
    method: "POST",
    body: JSON.stringify(record),
  });
}

export async function patchCheckIn(id: string, patch: Partial<CheckInOutRecord>): Promise<CheckInOutRecord> {
  return apiFetch<CheckInOutRecord>(`/api/patrol-scheduling/check-ins/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}