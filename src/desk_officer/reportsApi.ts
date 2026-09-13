// API client for resident-submitted incident reports (report.dart -> Supabase
// `reports` table -> FastAPI `/api/reports` -> Desk Officer Incident Triage).
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export type ResidentReportStatus =
  | "pending"
  | "under_review"
  | "assigned"
  | "resolved"
  | "closed";

export interface ResidentWitness {
  name: string;
  address: string;
  contact: string;
  whatWitnessed: string;
}

export interface ResidentMedia {
  id: number;
  file_name: string;
  storage_path: string;
  media_type: string;
  created_at: string;
}

export interface ResidentStatusUpdate {
  id: number;
  title: string;
  date: string;
  description: string;
  created_at: string;
}

export interface ResidentReport {
  id: number;
  tracking_id: string;
  user_email: string;
  category: string;
  subtype: string;
  is_emergency: boolean;
  priority: string;
  latitude: number | null;
  longitude: number | null;
  place: string;
  landmark: string;
  narrative: string;
  action_taken: string;
  report_date_time: string;
  incident_date_time: string;
  status: ResidentReportStatus;
  requested_action: string;
  action_other: string;
  anonymous: boolean;
  respondent_name: string;
  respondent_address: string;
  respondent_contact: string;
  respondent_relation: string;
  callback_phone: string;
  people_affected: string;
  additional_description: string;
  specific_info: Record<string, unknown>;
  emergency_answers: Record<string, unknown>;
  witnesses: ResidentWitness[];
  created_at: string;
  updated_at: string;
  photos: ResidentMedia[];
  videos: ResidentMedia[];
  status_updates: ResidentStatusUpdate[];
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

export async function fetchResidentReports(): Promise<ResidentReport[]> {
  return apiFetch<ResidentReport[]>("/api/reports");
}

export async function patchResidentReport(
  reportId: number,
  changes: {
    status?: ResidentReportStatus;
    priority?: string;
    resolution_note?: string;
  }
): Promise<ResidentReport> {
  return apiFetch<ResidentReport>(`/api/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}