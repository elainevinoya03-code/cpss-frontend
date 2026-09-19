import { type RosterMember, type SkillsInventory } from "./patrolScheduleShared";

const API_BASE = import.meta.env.VITE_API_URL || "";

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

export interface RosterMemberApiResponse {
  id: string;
  name: string;
  purok: string;
  skills: string[];
  experienceYears: number;
  performance: number;
  available: boolean;
  lastDutyAt: string;
  skillsInventory?: Record<string, unknown>;
  userId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchRosterMembers(): Promise<RosterMember[]> {
  const members = await apiFetch<RosterMemberApiResponse[]>("/api/roster-members");
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    purok: m.purok,
    skills: m.skills ?? [],
    experienceYears: m.experienceYears ?? 0,
    performance: m.performance ?? 0,
    available: m.available ?? true,
    lastDutyAt: m.lastDutyAt ?? "",
    skillsInventory: (m.skillsInventory as unknown as SkillsInventory) || undefined,
  }));
}

export async function saveRosterMember(member: RosterMember): Promise<RosterMember> {
  const { skillsInventory, ...rest } = member;
  const saved = await apiFetch<RosterMemberApiResponse>("/api/roster-members", {
    method: "POST",
    body: JSON.stringify({
      ...rest,
      skillsInventory: skillsInventory || {},
    }),
  });
  return {
    id: saved.id,
    name: saved.name,
    purok: saved.purok,
    skills: saved.skills ?? [],
    experienceYears: saved.experienceYears ?? 0,
    performance: saved.performance ?? 0,
    available: saved.available ?? true,
    lastDutyAt: saved.lastDutyAt ?? "",
    skillsInventory: (saved.skillsInventory as unknown as SkillsInventory) || skillsInventory,
  };
}