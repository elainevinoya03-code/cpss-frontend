// API client for incidents, dispatches, and blotters
const API_BASE = import.meta.env.VITE_API_URL || "";

export type IncidentStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "closed_false_alarm";

export type IncidentSource =
  | "resident"
  | "tanod"
  | "desk_officer"
  | "cctv"
  | "iot"
  | "iot_cctv"
  | "sos";

export type VerificationStatus =
  | "new"
  | "under_review"
  | "verified"
  | "unverified";

export type DeskPriority = "Emergency" | "Low" | "Medium" | "High";

export type ClosureReason =
  | "False Alarm"
  | "Unverified"
  | "Invalid Report"
  | "Outside Barangay Jurisdiction"
  | "No Further Action Required"
  | "Other";

export type FinalDisposition =
  | "Resolved"
  | "Settled / Reconciled"
  | "Referred"
  | "Responded — No Further Action"
  | "False Alarm"
  | "Duplicate"
  | "Unverified"
  | "Other";

export interface ClosureHistoryEntry {
  previousStatus: IncidentStatus;
  finalStatus: IncidentStatus;
  closureReason: string;
  closureNote: string;
  closedBy: string;
  closedAt: string;
}

/**
 * The original resident-submitted report linked to an incident through the
 * real FK `incidents.report_id -> reports.id` (not tracking_id). Only the
 * report-derived fields are surfaced here; the full report (photos, videos,
 * status timeline) is available via `/api/reports`.
 */
export interface IncidentSourceReport {
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
  status: string;
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
  created_at: string;
  updated_at: string;
}

/**
 * An incident as returned by the backend. The wire format is snake_case
 * (the backend serializes Pydantic models / raw select columns without
 * camel-case aliasing). The store converts these into the camelCase
 * frontend `Incident` consumed by the pages.
 */
export interface Incident {
  id: string;
  /** Real FK to the source resident report (reports.id). Nullable. */
  report_id?: number | null;
  /** Embedded original report, present when the incident is linked (report_id set). */
  report?: IncidentSourceReport | null;
  category: string;
  severity: string;
  purok: string;
  description: string;
  source: IncidentSource;
  reporter: string;
  time: string;
  status: IncidentStatus;
  photos: number;
  lat: number;
  lng: number;
  priority: DeskPriority;
  notes?: string[];
  rating?: number;
  anonymous?: boolean;
  tracking_token?: string;
  acknowledged_at?: string;
  sla_breached?: boolean;
  duplicate_resolved?: boolean;
  related_to?: string[];
  escalated_to_captain?: boolean;
  escalated_reason?: string;
  escalated_at?: string;
  reporter_safe?: boolean;
  reporter_safe_at?: string;
  validation_label?: string;
  related_alert_id?: string;
  closed_reason?: string;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
  unverified_reason?: string;
  category_history?: {
    from: string;
    to: string;
    changedBy: string;
    changedAt: string;
  }[];
  assigned_team?: string;
  dispatch_id?: string;
  closure_history?: ClosureHistoryEntry[];
  resolved_at?: string;
  iot_data?: {
    sensorType: string;
    sensorId: string;
    reading: string;
    unit: string;
    thresholdState: "normal" | "elevated" | "critical";
    threshold: string;
    timestamp: string;
    location: string;
  };
  feedback?: string;
  dispatches?: DispatchItem[];
}

export interface DispatchItem {
  id: string;
  incident: string;
  team: string;
  status: string;
  purok: string;
  eta: string;
  photos: number;
  assigneeType?: "tanod" | "purok_leader";
  dispatchedAt?: string;
  onSceneAt?: string;
}

export interface Blotter {
  id: string;
  originalIncidentId: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  purok: string;
  source: IncidentSource;
  incidentDateTime: string;
  resolvedDateTime: string;
  filedDateTime: string;
  convertedDateTime: string;
  createdAt: string;
  updatedAt: string;
  reporter: string;
  anonymous: boolean;
  assignedOfficer: string;
  recordedBy: string;
  lat: number;
  lng: number;
  locationLabel: string;
  resolutionSummary: string;
  finalDisposition: FinalDisposition;
  dispositionNote?: string;
  closureReason?: string;
  citizenRating: number;
  citizenFeedback?: string;
  photoCount: number;
  fieldNotes: string[];
  evidenceReferences: string[];
  recordStatus: "active" | "amended";
  amendments?: any[];
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

// Incident endpoints
export async function fetchIncidents(): Promise<Incident[]> {
  return apiFetch<Incident[]>("/api/incidents");
}

export async function fetchIncident(incidentId: string): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${incidentId}`);
}

export async function createIncident(incident: Incident): Promise<Incident> {
  return apiFetch<Incident>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(incident),
  });
}

/**
 * Create (or return the existing) persisted incident for a resident report.
 * The report stays in `reports` (source of truth); the incident is linked by
 * `report_id -> reports.id`. The backend is idempotent: never creates a
 * duplicate incident for the same report.
 */
export async function createIncidentFromReport(reportId: number): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/from-report/${reportId}`, {
    method: "POST",
  });
}

export async function updateIncident(
  incidentId: string,
  incident: Partial<Incident>
): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${incidentId}`, {
    method: "PUT",
    body: JSON.stringify(incident),
  });
}

export async function deleteIncident(incidentId: string): Promise<void> {
  return apiFetch<void>(`/api/incidents/${incidentId}`, {
    method: "DELETE",
  });
}

// Dispatch endpoints
export async function fetchDispatches(incidentId: string): Promise<DispatchItem[]> {
  return apiFetch<DispatchItem[]>(`/api/incidents/${incidentId}/dispatches`);
}

export async function createDispatch(
  incidentId: string,
  dispatch: DispatchItem
): Promise<DispatchItem> {
  return apiFetch<DispatchItem>(`/api/incidents/${incidentId}/dispatches`, {
    method: "POST",
    body: JSON.stringify(dispatch),
  });
}

export async function updateDispatch(
  dispatchId: string,
  dispatch: Partial<DispatchItem>
): Promise<DispatchItem> {
  return apiFetch<DispatchItem>(`/api/incidents/dispatches/${dispatchId}`, {
    method: "PUT",
    body: JSON.stringify(dispatch),
  });
}

export async function deleteDispatch(dispatchId: string): Promise<void> {
  return apiFetch<void>(`/api/incidents/dispatches/${dispatchId}`, {
    method: "DELETE",
  });
}

// Blotter endpoints
export async function fetchBlotters(): Promise<Blotter[]> {
  return apiFetch<Blotter[]>("/api/incidents/blotters");
}

export async function fetchBlotter(blotterId: string): Promise<Blotter> {
  return apiFetch<Blotter>(`/api/incidents/blotters/${blotterId}`);
}

export async function createBlotter(blotter: Blotter): Promise<Blotter> {
  return apiFetch<Blotter>("/api/incidents/blotters", {
    method: "POST",
    body: JSON.stringify(blotter),
  });
}

export async function deleteBlotter(blotterId: string): Promise<void> {
  return apiFetch<void>(`/api/incidents/blotters/${blotterId}`, {
    method: "DELETE",
  });
}