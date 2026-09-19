// API client for patrol configuration (checkpoint plans)
const API_BASE = import.meta.env.VITE_API_URL || "";

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
  id?: number | null;
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

function isNetworkError(error: unknown): boolean {
  // fetch rejects with a TypeError on network-level failures (connection
  // reset, server restart mid-request, etc.), whereas HTTP error statuses
  // throw an Error with a status detail.
  return error instanceof TypeError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  retries = 0
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      // DELETE is idempotent — a 404 on retry means the first attempt
      // already succeeded but the response was lost.
      if (options?.method === "DELETE" && res.status === 404) {
        return undefined as T;
      }
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
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      // The backend may have processed (and committed) the first attempt, so
      // retry before surfacing an error — create/update re-assert the same
      // plan id, which is safe.
      await sleep(600);
      return apiFetch(path, options, retries - 1);
    }
    throw error;
  }
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
  }, 3);
}

export async function updateCheckpointPlan(
  planId: string,
  plan: Partial<CheckpointPlan>
): Promise<CheckpointPlan> {
  return apiFetch<CheckpointPlan>(`/api/patrol-configuration/${planId}`, {
    method: "PUT",
    body: JSON.stringify(plan),
  }, 3);
}

export async function deleteCheckpointPlan(planId: string): Promise<void> {
  return apiFetch<void>(`/api/patrol-configuration/${planId}`, {
    method: "DELETE",
  }, 1);
}
