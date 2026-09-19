import { useState, useEffect, useCallback } from "react";
import {
  fetchResidentReports,
  patchResidentReport,
  type ResidentReport,
  type ResidentReportStatus,
} from "./reportsApi";
import {
  fetchIncidents,
  createIncident,
  createIncidentFromReport,
  updateIncident,
  deleteIncident,
  fetchDispatches,
  createDispatch,
  updateDispatch,
  deleteDispatch,
  fetchBlotters,
  createBlotter,
  deleteBlotter,
} from "./incidentsApi";

// ---------------------------------------------------------------------------
// §15.1 — Canonical types shared between Desk Officer Dashboard and Digital
// Blotter.  Both modules must read from the same source-of-truth so that
// converting a resolved incident into a blotter record is immediately visible
// on both pages.
// ---------------------------------------------------------------------------

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

// §15.2 — Structured closure reasons for false alarm / invalid closure.
export type ClosureReason =
  | "False Alarm"
  | "Unverified"
  | "Invalid Report"
  | "Outside Barangay Jurisdiction"
  | "No Further Action Required"
  | "Other";

// §10 / Part 10 — Final disposition is a structured field on the permanent
// blotter record.  "Other" requires a free-text description.
export type FinalDisposition =
  | "Resolved"
  | "Settled / Reconciled"
  | "Referred"
  | "Responded — No Further Action"
  | "False Alarm"
  | "Duplicate"
  | "Unverified"
  | "Other";

export const DISPOSITION_OPTIONS: FinalDisposition[] = [
  "Resolved",
  "Settled / Reconciled",
  "Referred",
  "Responded — No Further Action",
  "False Alarm",
  "Duplicate",
  "Unverified",
  "Other",
];

// §15.2 — Closure history entry.
export interface ClosureHistoryEntry {
  previousStatus: IncidentStatus;
  finalStatus: IncidentStatus;
  closureReason: string;
  closureNote: string;
  closedBy: string;
  closedAt: string;
}

// §15.3 — Incident as maintained by the Desk Officer's operational dashboard.
export interface Incident {
  id: string;
  /** Real FK to the source resident report (reports.id). Nullable. */
  reportId?: number;
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
  trackingToken?: string;
  acknowledgedAt?: string;
  slaBreached?: boolean;
  duplicateResolved?: boolean;
  relatedTo?: string[];
  escalatedToCaptain?: boolean;
  escalatedReason?: string;
  escalatedAt?: string;
  reporterSafe?: boolean;
  reporterSafeAt?: string;
  validationLabel?: string;
  relatedAlertId?: string;
  closedReason?: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  unverifiedReason?: string;
  categoryHistory?: {
    from: string;
    to: string;
    changedBy: string;
    changedAt: string;
  }[];
  assignedTeam?: string;
  dispatchId?: string;
  dispatches?: DispatchItem[];
  closureHistory?: ClosureHistoryEntry[];
  resolvedAt?: string;
  iotData?: {
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
}

// §15.4 — Dispatch item tracked by the dashboard.
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

// §15.5 / Part 9 — Permanent blotter record.  Stores every field the
// Digital Barangay Blotter module must preserve.  Designed so the archive
// is self-contained: the original incident need not be re-read to display
// the full record.
export interface Blotter {
  // — Identifiers
  id: string;
  originalIncidentId: string;

  // — Incident metadata snapshot
  category: string;
  title: string;
  description: string;
  severity: string;
  purok: string;
  source: IncidentSource;

  // — Timestamps
  incidentDateTime: string;
  resolvedDateTime: string;
  filedDateTime: string;
  convertedDateTime: string;
  createdAt: string;
  updatedAt: string;

  // — People
  reporter: string;
  anonymous: boolean;   // Part 27 — Preserve anonymous status from incident
  assignedOfficer: string;
  recordedBy: string;

  // — Location
  lat: number;
  lng: number;
  locationLabel: string;

  // — Resolution
  resolutionSummary: string;
  finalDisposition: FinalDisposition;
  dispositionNote?: string;
  closureReason?: string;

  // — Citizen feedback
  citizenRating: number;
  citizenFeedback?: string;

  // — Evidence
  photoCount: number;
  fieldNotes: string[];
  evidenceReferences: string[];

  // — Record status
  recordStatus: "active" | "amended";

  // — Amendment history (Part 11)
  amendments?: Amendment[];
}

// §11 / Part 11 — An amendment preserves the original value, corrected
// value, who corrected it, when, and why.  The archive is never silently
// overwritten.
export interface Amendment {
  field: string;
  originalValue: string;
  correctedValue: string;
  correctedBy: string;
  correctedAt: string;
  reason: string;
}

// Part 14 — Audit trail entry.  Every archival action is recorded with full
// provenance.  The audit trail is append-only and not editable through
// ordinary UI controls.
export type AuditAction =
  | "incident_resolved"
  | "incident_archived"
  | "blotter_created"
  | "blotter_viewed"
  | "correction_requested"
  | "amendment_applied"
  | "report_generated";

export interface AuditEntry {
  id: string;
  timestamp: string;
  actingUser: string;
  action: AuditAction;
  incidentId: string;
  blotterId?: string;
  result: "success" | "failure" | "info";
  reason?: string;
}

// ---------------------------------------------------------------------------
// §15.6 — Helpers
// ---------------------------------------------------------------------------

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// Map a backend incident row (snake_case) into the frontend camelCase shape.
// report_id is the real FK to the source resident report (reports.id).
function fromApiIncident(api: import("./incidentsApi").Incident): Incident {
  return {
    ...api,
    reportId: api.report_id ?? undefined,
    trackingToken: api.tracking_token,
    acknowledgedAt: api.acknowledged_at,
    slaBreached: api.sla_breached,
    duplicateResolved: api.duplicate_resolved,
    relatedTo: api.related_to,
    escalatedToCaptain: api.escalated_to_captain,
    escalatedReason: api.escalated_reason,
    escalatedAt: api.escalated_at,
    reporterSafe: api.reporter_safe,
    reporterSafeAt: api.reporter_safe_at,
    validationLabel: api.validation_label,
    relatedAlertId: api.related_alert_id,
    closedReason: api.closed_reason,
    verificationStatus: api.verification_status,
    verifiedBy: api.verified_by,
    verifiedAt: api.verified_at,
    unverifiedReason: api.unverified_reason,
    categoryHistory: api.category_history,
    assignedTeam: api.assigned_team,
    dispatchId: api.dispatch_id,
    closureHistory: api.closure_history,
    resolvedAt: api.resolved_at,
    iotData: api.iot_data,
    dispatches: api.dispatches?.map((d) => ({
      ...d,
      assigneeType: d.assigneeType,
      dispatchedAt: d.dispatchedAt,
      onSceneAt: d.onSceneAt,
    })),
  };
}

export function nextBlotterId(blotters: { id: string }[]) {
  const max = blotters.reduce((acc, b) => {
    const n = parseInt(b.id.replace(/^B-\d+-/, ""), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `B-2026-${String(max + 1).padStart(4, "0")}`;
}

// §15.6a — Map closedReason to a structured FinalDisposition.
function dispositionFromClosure(reason?: string): FinalDisposition {
  if (!reason) return "Resolved";
  const lower = reason.toLowerCase();
  if (lower.includes("false alarm")) return "False Alarm";
  if (lower.includes("unverified")) return "Unverified";
  if (lower.includes("no further")) return "Responded — No Further Action";
  if (lower.includes("outside")) return "Referred";
  if (lower.includes("invalid")) return "Unverified";
  if (lower.includes("normal") || lower.includes("resolved")) return "Resolved";
  if (lower.includes("settled") || lower.includes("reconciled"))
    return "Settled / Reconciled";
  return "Other";
}

// §6 / Part 5 — Source label for display.
const SOURCE_LABELS: Record<IncidentSource, string> = {
  resident: "Resident Report",
  tanod: "Tanod Field Report",
  desk_officer: "Desk Officer",
  cctv: "CCTV Operator",
  iot: "IoT Sensor Alert",
  iot_cctv: "IoT via CCTV Operator",
  sos: "SOS Alert",
};

// ---------------------------------------------------------------------------
// §15.7 — Seed data removed - now loading from backend API
// ---------------------------------------------------------------------------

// SEED_DISPATCHES removed - now loading from backend API
// SEED_BLOTTERS removed - now loading from backend API
// SEED_AUDIT removed - now loading from backend API

// ---------------------------------------------------------------------------
// Part 14 — Seed audit trail entries removed - now loading from backend API
// ---------------------------------------------------------------------------

let auditIdCounter = 100;
function nextAuditId() {
  return `AUD-${++auditIdCounter}`;
}

// ---------------------------------------------------------------------------
// §15.8 — Pub/sub store
// ---------------------------------------------------------------------------

type Listener = () => void;

let incidents: Incident[] = [];
let dispatches: DispatchItem[] = [];
let blotters: Blotter[] = [];
let auditTrail: AuditEntry[] = [];
let incidentsLoaded = false;
let incidentsLoading = false;

// §15.8a — Resident-submitted reports (report.dart → Supabase → FastAPI).
// Maintained in parallel to `incidents`: the raw report carries every field
// captured by report.dart; a slim mapping is merged into `incidents` so the
// shared Desk Officer pages (Dashboard, dispatch queues) see them too.
let residentReports: ResidentReport[] = [];
let residentReportsLoading = false;
let residentReportsError = false;

const listeners: Set<Listener> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

async function loadIncidents() {
  if (incidentsLoading || incidentsLoaded) return;
  incidentsLoading = true;
  try {
    const apiIncidents = await fetchIncidents();
    // Convert from backend snake_case to frontend camelCase
    incidents = apiIncidents.map(fromApiIncident);
    incidentsLoaded = true;
    emit();
  } catch (error) {
    console.error("Failed to load incidents:", error);
  } finally {
    incidentsLoading = false;
  }
}

// Force a full reload of the persisted incidents from the backend. Used after
// resident reports are persisted into incidents (via report_id) or refreshed.
export async function refreshIncidents() {
  try {
    const apiIncidents = await fetchIncidents();
    incidents = apiIncidents.map(fromApiIncident);
    emit();
  } catch (error) {
    console.error("Failed to refresh incidents:", error);
  }
}

async function loadBlotters() {
  try {
    const apiBlotters = await fetchBlotters();
    // Convert from backend snake_case to frontend camelCase
    blotters = apiBlotters.map((blotter) => ({
      ...blotter,
      originalIncidentId: blotter.original_incident_id,
      incidentDateTime: blotter.incident_date_time,
      resolvedDateTime: blotter.resolved_date_time,
      filedDateTime: blotter.filed_date_time,
      convertedDateTime: blotter.converted_date_time,
      assignedOfficer: blotter.assigned_officer,
      recordedBy: blotter.recorded_by,
      locationLabel: blotter.location_label,
      finalDisposition: blotter.final_disposition,
      dispositionNote: blotter.disposition_note,
      closureReason: blotter.closure_reason,
      citizenRating: blotter.citizen_rating,
      citizenFeedback: blotter.citizen_feedback,
      photoCount: blotter.photo_count,
      fieldNotes: blotter.field_notes,
      evidenceReferences: blotter.evidence_references,
      recordStatus: blotter.record_status,
    }));
    emit();
  } catch (error) {
    console.error("Failed to load blotters:", error);
  }
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  if (!incidentsLoaded) {
    loadIncidents();
    loadBlotters();
  }
  return () => {
    listeners.delete(fn);
  };
}

// §15.9 — Read helpers
export function getIncidents(): Incident[] {
  return incidents;
}
export function getDispatches(): DispatchItem[] {
  return dispatches;
}
export function getBlotters(): Blotter[] {
  return blotters;
}

// §15.9a — Resident report read helpers
export function getResidentReports(): ResidentReport[] {
  return residentReports;
}
export function getResidentReportsLoading(): boolean {
  return residentReportsLoading;
}
export function getResidentReportsError(): boolean {
  return residentReportsError;
}

// Part 14 — Audit trail read helpers.  The trail is append-only and not
// editable through ordinary UI controls.
export function getAuditTrail(): AuditEntry[] {
  return auditTrail;
}

export function getAuditTrailForBlotter(blotterId: string): AuditEntry[] {
  return auditTrail.filter((e) => e.blotterId === blotterId);
}

/**
 * Part 14 — Record a blotter view event in the audit trail.
 * Called when a user opens Blotter Detail.  This is a non-destructive
 * informational entry and cannot be edited or deleted.
 */
export function recordBlotterView(
  blotterId: string,
  incidentId: string,
  user: string = "D.O. Ramos"
) {
  auditTrail = [
    {
      id: nextAuditId(),
      timestamp: new Date().toISOString(),
      actingUser: user,
      action: "blotter_viewed",
      incidentId,
      blotterId,
      result: "info",
      reason: "Record viewed in Blotter Detail drawer",
    },
    ...auditTrail,
  ];
  emit();
}

// Part 25 — Generic audit entry recorder for non-blotter actions
// (e.g., report generation).  The audit trail is append-only.
export function recordAuditAction(
  action: AuditAction,
  incidentId: string,
  opts: { blotterId?: string; result?: "success" | "failure" | "info"; reason?: string; user?: string } = {}
) {
  auditTrail = [
    {
      id: nextAuditId(),
      timestamp: new Date().toISOString(),
      actingUser: opts.user ?? "D.O. Ramos",
      action,
      incidentId,
      blotterId: opts.blotterId,
      result: opts.result ?? "success",
      reason: opts.reason,
    },
    ...auditTrail,
  ];
  emit();
}

// §15.10 — Mutation helpers
export function setIncidents(next: Incident[]) {
  incidents = next;
  emit();
}

// Parts continued — Manual incident creation (Desk Officer Quick Actions).
// Generates the next sequential INC-xxxx id from the live incident array.
export function nextIncidentId(): string {
  let max = 2072;
  for (const i of incidents) {
    const m = /^INC-(\d+)$/.exec(i.id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `INC-${max + 1}`;
}

export async function addIncident(input: Omit<Incident, "id">): Promise<Incident> {
  const incident: Incident = { ...input, id: nextIncidentId() };
  try {
    // Transform to backend format
    const apiIncident = {
      ...incident,
      report_id: incident.reportId,
      acknowledged_at: incident.acknowledgedAt,
      sla_breached: incident.slaBreached,
      duplicate_resolved: incident.duplicateResolved,
      related_to: incident.relatedTo,
      escalated_to_captain: incident.escalatedToCaptain,
      escalated_reason: incident.escalatedReason,
      escalated_at: incident.escalatedAt,
      reporter_safe: incident.reporterSafe,
      reporter_safe_at: incident.reporterSafeAt,
      validation_label: incident.validationLabel,
      related_alert_id: incident.relatedAlertId,
      closed_reason: incident.closedReason,
      verification_status: incident.verificationStatus,
      verified_by: incident.verifiedBy,
      verified_at: incident.verifiedAt,
      unverified_reason: incident.unverifiedReason,
      category_history: incident.categoryHistory,
      assigned_team: incident.assignedTeam,
      dispatch_id: incident.dispatchId,
      closure_history: incident.closureHistory,
      resolved_at: incident.resolvedAt,
      iot_data: incident.iotData,
    };

    const saved = await createIncident(apiIncident);
    
    // Convert back to frontend format
    const frontendIncident = {
      ...saved,
      acknowledgedAt: saved.acknowledged_at,
      slaBreached: saved.sla_breached,
      duplicateResolved: saved.duplicate_resolved,
      relatedTo: saved.related_to,
      escalatedToCaptain: saved.escalated_to_captain,
      escalatedReason: saved.escalated_reason,
      escalatedAt: saved.escalated_at,
      reporterSafe: saved.reporter_safe,
      reporterSafeAt: saved.reporter_safe_at,
      validationLabel: saved.validation_label,
      relatedAlertId: saved.related_alert_id,
      closedReason: saved.closed_reason,
      verificationStatus: saved.verification_status,
      verifiedBy: saved.verified_by,
      verifiedAt: saved.verified_at,
      unverifiedReason: saved.unverified_reason,
      categoryHistory: saved.category_history,
      assignedTeam: saved.assigned_team,
      dispatchId: saved.dispatch_id,
      closureHistory: saved.closure_history,
      resolvedAt: saved.resolved_at,
      iotData: saved.iot_data,
      dispatches: saved.dispatches?.map((d) => ({
        ...d,
        assigneeType: d.assigneeType,
        dispatchedAt: d.dispatchedAt,
        onSceneAt: d.onSceneAt,
      })),
    };
    
    incidents = [frontendIncident, ...incidents];
    emit();
    return frontendIncident;
  } catch (error) {
    console.error("Failed to create incident:", error);
    throw error;
  }
}

export function setDispatches(next: DispatchItem[]) {
  dispatches = next;
  emit();
}
export function setBlotters(next: Blotter[]) {
  blotters = next;
  emit();
}

// §15.10b — Resident report ↔ Incident mapping helpers
export const REPORT_TO_INCIDENT_STATUS: Record<ResidentReportStatus, IncidentStatus> = {
  pending: "new",
  under_review: "acknowledged",
  assigned: "in_progress",
  resolved: "resolved",
  closed: "closed_false_alarm",
};

export const INCIDENT_TO_REPORT_STATUS: Record<IncidentStatus, ResidentReportStatus> = {
  new: "pending",
  acknowledged: "under_review",
  in_progress: "assigned",
  resolved: "resolved",
  closed_false_alarm: "closed",
};

function deskPriorityFromReport(report: ResidentReport): DeskPriority {
  const p = (report.priority || "Normal").toLowerCase();
  if (p === "high" || p === "critical" || report.is_emergency) return "High";
  if (p === "low") return "Low";
  return "Medium";
}

function severityFromReport(report: ResidentReport): string {
  if (report.is_emergency) return "critical";
  const p = (report.priority || "Normal").toLowerCase();
  if (p === "high" || p === "critical") return "critical";
  if (p === "low") return "low";
  return "warning";
}

function verificationFromReport(status: ResidentReportStatus): VerificationStatus {
  switch (status) {
    case "pending":
      return "new";
    case "under_review":
      return "under_review";
    case "resolved":
      return "verified";
    case "closed":
      return "unverified";
    case "assigned":
    default:
      return "verified";
  }
}

function purokFromPlace(report: ResidentReport): string {
  const haystack = `${report.place} ${report.landmark}`.toLowerCase();
  const match = haystack.match(/purok\s*\d/);
  if (match) {
    const digits = match[0].match(/\d+/);
    if (digits) return `Purok ${digits[0]}`;
  }
  return "";
}

/**
 * §15.10c — Shape the operational `Incident` that corresponds to a resident
 * report. The report itself is NOT converted in controlled memory anymore: the
 * incident is **persisted** server-side via `POST /api/incidents/from-report`
 * and linked through the real FK `incidents.report_id -> reports.id`. This
 * helper only (a) refreshes the report-derived fields on the persisted record
 * and (b) supplies a client-side mirror for reports that have not yet been
 * persisted.
 */
export function incidentFromReport(report: ResidentReport): Incident {
  return {
    id: report.tracking_id,
    reportId: report.id,
    category: report.category || report.subtype || "Other",
    severity: severityFromReport(report),
    purok: purokFromPlace(report),
    description: report.narrative || report.subtype || "No description provided.",
    source: "resident",
    reporter: report.anonymous ? "Anonymous" : report.user_email || "Resident",
    time: report.incident_date_time || report.report_date_time || report.created_at,
    status: REPORT_TO_INCIDENT_STATUS[report.status],
    photos: report.photos.length,
    lat: report.latitude ?? 0,
    lng: report.longitude ?? 0,
    priority: deskPriorityFromReport(report),
    notes: [],
    anonymous: report.anonymous,
    trackingToken: report.tracking_id,
    verificationStatus: verificationFromReport(report.status),
  };
}

/**
 * §15.10d — Reconcile the `incidents` array against resident reports using the
 * persisted relationship `incidents.report_id === reports.id` (not tracking_id).
 *
 * Reports that already have a persisted incident get their report-derived
 * fields refreshed while keeping the Desk Officer's operational data (status,
 * assignment, dispatch, verification, resolution). Reports with no incident yet
 * receive a client-side mirror that `syncResidentReports` persists through the
 * backend. Non-resident incidents are untouched, and persisted resident
 * incidents are kept even when a report temporarily leaves `/api/reports`.
 */
function mergeResidentIncidents(reports: ResidentReport[]) {
  const reportsById = new Map(reports.map((r) => [r.id, r]));

  const merged: Incident[] = [];
  for (const inc of incidents) {
    if (inc.source === "resident") {
      // Previews without a persisted report_id should only exist for a report
      // currently in the queue; drop stale ones.
      if (inc.reportId == null) continue;
      const report = reportsById.get(inc.reportId);
      if (!report) {
        merged.push(inc); // persisted incident kept even if the list is empty
        continue;
      }
      // Refresh report-derived fields, then overlay the persisted operational data.
      merged.push({ ...incidentFromReport(report), ...inc });
    } else {
      merged.push(inc);
    }
  }

  const withIncident = new Set(
    merged.filter((i) => i.reportId != null).map((i) => i.reportId)
  );
  for (const r of reports) {
    if (!withIncident.has(r.id)) {
      merged.push(incidentFromReport(r));
    }
  }
  incidents = merged;
}

/**
 * §15.10e — Pull fresh resident reports from the backend (`/api/reports`),
 * persist an incident for every report that doesn't have one yet (via
 * `incidents.report_id -> reports.id`), reload the persisted incidents, and
 * reconcile the store. The Desk Officer Incident Triage calls this on mount and
 * on a refresh interval.
 */
export async function syncResidentReports(): Promise<void> {
  residentReportsLoading = true;
  emit();
  try {
    const reports = await fetchResidentReports();
    residentReports = reports;
    residentReportsError = false;

    // Persist any report that is not yet linked to an incident. The backend is
    // idempotent (one report → one incident), so this never duplicates.
    const persistedReportIds = new Set(
      incidents.filter((i) => i.reportId != null).map((i) => i.reportId)
    );
    const missing = reports.filter((r) => !persistedReportIds.has(r.id));
    for (const report of missing) {
      try {
        await createIncidentFromReport(report.id);
      } catch (error) {
        console.error(`Failed to persist incident for report ${report.id}:`, error);
      }
    }

    if (missing.length > 0) await refreshIncidents();
    mergeResidentIncidents(reports);
  } catch {
    residentReportsError = true;
  } finally {
    residentReportsLoading = false;
    emit();
  }
}

/**
 * §15.10f — Persist a Desk Officer processing action (status advance and/or
 * priority change) to the resident report AND keep the linked operational
 * incident in sync through `incidents.report_id -> reports.id`, so both the
 * report (triage) and the incident (dashboard/dispatch) reflect the change.
 */
export async function updateResidentReportStatus(
  reportId: number,
  changes: {
    status?: ResidentReportStatus;
    priority?: DeskPriority;
    resolution_note?: string;
  }
): Promise<ResidentReport | null> {
  try {
    const updated = await patchResidentReport(reportId, {
      status: changes.status,
      priority: changes.priority,
      resolution_note: changes.resolution_note,
    });
    residentReports = residentReports.map((r) => (r.id === updated.id ? updated : r));

    const incident = incidents.find(
      (i) => i.source === "resident" && i.reportId === updated.id
    );
    if (incident) {
      const patch: Partial<import("./incidentsApi").Incident> = {};
      if (changes.status && REPORT_TO_INCIDENT_STATUS[changes.status]) {
        patch.status = REPORT_TO_INCIDENT_STATUS[changes.status];
        patch.verification_status = verificationFromReport(changes.status);
      }
      if (changes.priority) patch.priority = changes.priority;
      if (Object.keys(patch).length > 0) {
        try {
          await updateIncident(incident.id, patch);
        } catch (error) {
          // The report was already saved; the incident sync is best-effort.
          console.error("Failed to sync incident status from report:", error);
        }
      }
    }

    await refreshIncidents();
    emit();
    return updated;
  } catch {
    return null;
  }
}

/**
 * §15.10g — Resolve the persisted incident linked to a resident report
 * (incidents.report_id === reportId). Used by pages that need to walk
 * Incident -> report_id -> Original Report.
 */
export function getIncidentForReport(reportId: number): Incident | undefined {
  return incidents.find((i) => i.source === "resident" && i.reportId === reportId);
}

// §15.10a — Look up the dispatch record for an incident.
export function getDispatchForIncident(incidentId: string): DispatchItem | undefined {
  return dispatches.find((d) => d.incident === incidentId);
}

// §15.10b — Source label helper.
export function sourceLabel(source: IncidentSource): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * §15.11 / Part 6 / Part 13 — Convert a resolved incident into a permanent
 * blotter record.  The conversion is atomic: either a full Blotter is created
 * and the incident is removed, or nothing happens.
 *
 * Part 6 eligibility rules enforced:
 *   1. incident.status === "resolved"
 *   2. incident is not already linked to a blotter
 *   3. incident is not cancelled (closed_false_alarm)
 *   4. incident has no active/pending dispatch workflow
 *
 * Part 8 — Blotter ID format: B-YYYY-0xxx (unique, sequential).
 *
 * Part 9 — All archival fields populated from incident snapshot.
 *
 * Server-side note: In production the ID generation, eligibility checks, and
 * record creation must be server-side with transactional guarantees.  The
 * client-side store simulates atomicity via a single state transition.
 */
export function convertIncidentToBlotter(
  incidentId: string,
  officer: string = "D.O. Ramos"
): Blotter | null {
  const inc = incidents.find((i) => i.id === incidentId);
  if (!inc) return null;

  // Part 6 — Eligibility rules
  if (inc.status !== "resolved") return null;
  if (blotters.some((b) => b.originalIncidentId === inc.id)) return null;
  // Part 6 — Block if incident has an active (non-resolved) dispatch
  const activeDispatch = dispatches.find(
    (d) => d.incident === inc.id && d.status !== "resolved"
  );
  if (activeDispatch) return null;

  const now = new Date().toISOString();
  const blotterId = nextBlotterId(blotters);
  const disposition = dispositionFromClosure(inc.closedReason);
  const dispatch = dispatches.find((d) => d.incident === inc.id);

  // Part 9 — Build the complete archival record.
  const blotter: Blotter = {
    id: blotterId,
    originalIncidentId: inc.id,
    category: inc.category,
    title: inc.description,
    description: inc.description,
    severity: inc.severity,
    purok: inc.purok,
    source: inc.source,
    incidentDateTime: inc.time,
    resolvedDateTime: inc.resolvedAt ?? inc.time,
    filedDateTime: now,
    convertedDateTime: now,
    createdAt: now,
    updatedAt: now,
    reporter: inc.reporter,
    anonymous: inc.anonymous ?? false,   // Part 27 — Preserve anonymous status
    assignedOfficer: dispatch?.team ?? inc.assignedTeam ?? "Unassigned",
    recordedBy: officer,
    lat: inc.lat,
    lng: inc.lng,
    locationLabel: inc.purok,
    resolutionSummary: inc.description,
    finalDisposition: disposition,
    closureReason: inc.closedReason,
    citizenRating: inc.rating ?? 0,
    citizenFeedback: inc.feedback,
    photoCount: inc.photos,
    fieldNotes: inc.notes ?? [],
    evidenceReferences: Array.from({ length: inc.photos }, (_, i) =>
      `${inc.id.replace("INC-", "IMG-")}-${String(i + 1).padStart(3, "0")}`
    ),
    recordStatus: "active",
  };

  // Part 13 — Atomic: remove incident and prepend blotter in one transition.
  incidents = incidents.filter((i) => i.id !== inc.id);
  blotters = [blotter, ...blotters];

  // Part 14 — Record audit trail entry for this archival action.
  auditTrail = [
    {
      id: nextAuditId(),
      timestamp: now,
      actingUser: officer,
      action: "blotter_created",
      incidentId: inc.id,
      blotterId: blotterId,
      result: "success",
      reason: `Resolved incident eligible for archival — converted to permanent blotter record`,
    },
    ...auditTrail,
  ];

  emit();
  return blotter;
}

/**
 * §15.11a / Part 6 — Returns resolved incidents eligible for blotter
 * conversion.  Eligibility requires:
 *   - status === "resolved"
 *   - not closed_false_alarm
 *   - no existing blotter record
 *   - no active (non-resolved) dispatch
 */
export function getBlotterEligible(): Incident[] {
  return incidents.filter((i) => {
    if (i.status !== "resolved") return false;
    if (blotters.some((b) => b.originalIncidentId === i.id)) return false;
    // Part 6 — Block if dispatch is still active
    const hasActiveDispatch = dispatches.some(
      (d) => d.incident === i.id && d.status !== "resolved"
    );
    if (hasActiveDispatch) return false;
    return true;
  });
}

/**
 * §15.11b — Compute average response time from dispatches that have both
 * dispatchedAt and onSceneAt timestamps. Returns null when insufficient data.
 */
export function computeAvgResponseTime(): number | null {
  const times = dispatches
    .filter((d) => d.dispatchedAt && d.onSceneAt)
    .map(
      (d) =>
        new Date(d.onSceneAt!).getTime() - new Date(d.dispatchedAt!).getTime()
    );
  if (times.length === 0) return null;
  return times.reduce((a, b) => a + b, 0) / times.length / 60_000;
}

// ---------------------------------------------------------------------------
// §15.12 — React hook for consuming the store
// ---------------------------------------------------------------------------

export function useIncidentStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribe(() => setTick((t) => t + 1));
  }, []);

  const convertToBlotter = useCallback(
    (incidentId: string, officer?: string) =>
      convertIncidentToBlotter(incidentId, officer),
    []
  );

  const blotterEligible = getBlotterEligible();
  const avgResponseTime = computeAvgResponseTime();

  return {
    incidents,
    dispatches,
    blotters,
    auditTrail,
    blotterEligible,
    avgResponseTime,
    residentReports,
    residentReportsLoading,
    residentReportsError,
    syncResidentReports,
    updateResidentReportStatus,
    getIncidentForReport,
    convertToBlotter,
    setIncidents,
    setDispatches,
    setBlotters,
  };
}
