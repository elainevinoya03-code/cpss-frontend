// API client for patrol configuration (checkpoint plans)
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export type PlanType = "fixed" | "route";
export type PlanStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "revision_required"
  | "rejected";

export interface CpPoint {
  id: string;
  kind: "fixed" | "start" | "end" | "intermediate";
  label: string;
  name: string;
  address: string;
  landmark: string;
  description: string;
  remarks: string;
  lat: number;
  lng: number;
  route_id?: string;
}

export interface CpRoute {
  id: string;
  label: string;
  title: string;
  role: string;
  color: string;
  points: CpPoint[];
}

export interface ScheduleForm {
  operationDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  recurring: "none" | "daily" | "specific_days";
  recurringDays: string[];
  expectedDuration: string;
}

export interface OperNotes {
  general: string;
  safety: string;
  equipment: string;
  coordination: string;
  special: string;
  other: string;
}

export interface CoverageResult {
  pct: number;
  covered: number;
  total: number;
  window: string;
}

export interface CheckpointPlan {
  id: string;
  code: string;
  name: string;
  type: PlanType;
  purpose: string;
  objective: string;
  rationale: string;
  target_area: string;
  remarks: string;
  points: CpPoint[];
  routes: CpRoute[];
  linked_incident_ids: string[];
  schedule: ScheduleForm;
  notes: OperNotes;
  coverage: CoverageResult;
  status: PlanStatus;
  submitted_by?: string;
  submitted_at?: string;
  decided_by?: string;
  decided_at?: string;
  revision_comment?: string;
  rejection_reason?: string;
  approval_comments?: string;
  created_at: string;
  updated_at: string;
}

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

export async function fetchCheckpointPlans(): Promise<CheckpointPlan[]> {
  return apiFetch<CheckpointPlan[]>("/api/patrol-configuration");
}

export async function fetchCheckpointPlan(planId: string): Promise<CheckpointPlan> {
  return apiFetch<CheckpointPlan>(`/api/patrol-configuration/${planId}`);
}

export async function createCheckpointPlan(plan: CheckpointPlan): Promise<CheckpointPlan> {
  return apiFetch<CheckpointPlan>("/api/patrol-configuration", {
    method: "POST",
    body: JSON.stringify(plan),
  });
}

export async function updateCheckpointPlan(
  planId: string,
  plan: Partial<CheckpointPlan>
): Promise<CheckpointPlan> {
  return apiFetch<CheckpointPlan>(`/api/patrol-configuration/${planId}`, {
    method: "PUT",
    body: JSON.stringify(plan),
  });
}

export async function deleteCheckpointPlan(planId: string): Promise<void> {
  return apiFetch<void>(`/api/patrol-configuration/${planId}`, {
    method: "DELETE",
  });
}
