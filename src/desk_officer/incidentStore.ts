import { useState, useEffect, useCallback } from "react";

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
  | "sos";

export type VerificationStatus =
  | "new"
  | "under_review"
  | "verified"
  | "unverified";

export type DeskPriority = "Low" | "Medium" | "High";

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
  closureHistory?: ClosureHistoryEntry[];
  resolvedAt?: string;
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
  sos: "SOS Alert",
};

// ---------------------------------------------------------------------------
// §15.7 — Seed data
// ---------------------------------------------------------------------------

const SEED_INCIDENTS: Incident[] = [
  {
    id: "INC-2071",
    category: "Fire or Smoke",
    severity: "critical",
    purok: "Purok 3",
    description:
      "Heavy smoke column spotted near market residential row — SM-PUROK3-01 offline, unverified",
    source: "resident",
    reporter: "Maria Santos",
    time: isoAgo(26),
    status: "new",
    photos: 2,
    lat: 100,
    lng: 200,
    priority: "High",
    notes: [],
    verificationStatus: "new",
  },
  {
    id: "INC-2072",
    category: "Fire or Smoke",
    severity: "warning",
    purok: "Purok 3",
    description:
      "Grey smoke drifting above market row — identical area to an earlier report this hour",
    source: "resident",
    reporter: "Anonymous",
    time: isoAgo(19),
    status: "new",
    photos: 1,
    lat: 103,
    lng: 198,
    priority: "High",
    notes: [],
    anonymous: true,
    trackingToken: "TK-4823",
    verificationStatus: "new",
  },
  {
    id: "INC-2070",
    category: "Public Disturbance",
    severity: "critical",
    purok: "Purok 6",
    description:
      "SOS held for 3 seconds — live GPS locked at commercial strip, possible altercation",
    source: "sos",
    reporter: "Ana Lim",
    time: isoAgo(6),
    status: "new",
    photos: 0,
    lat: 330,
    lng: 240,
    priority: "High",
    notes: [],
    verificationStatus: "new",
  },
  {
    id: "INC-2069",
    category: "Noise Disturbance",
    severity: "warning",
    purok: "Purok 4",
    description:
      "Manual clip escalated — sustained loud disturbance at hall, DB-HALL-01 at 78 dB",
    source: "cctv",
    reporter: "CCTV Op. Santos",
    time: isoAgo(68),
    status: "acknowledged",
    acknowledgedAt: isoAgo(52),
    photos: 1,
    lat: 210,
    lng: 170,
    priority: "Medium",
    notes: [],
    verificationStatus: "verified",
    verifiedBy: "Desk Officer",
    verifiedAt: isoAgo(60),
  },
  {
    id: "INC-2068",
    category: "Fire or Smoke",
    severity: "warning",
    purok: "Purok 1",
    description:
      "IoT threshold breach — smoke density 512/500 ppm at gate sensor",
    source: "iot",
    reporter: "SM-GATE-01",
    time: isoAgo(150),
    status: "in_progress",
    acknowledgedAt: isoAgo(140),
    photos: 0,
    lat: 110,
    lng: 65,
    priority: "High",
    notes: [],
    relatedAlertId: "ALT-118",
    verificationStatus: "verified",
    verifiedBy: "Desk Officer",
    verifiedAt: isoAgo(145),
  },
  {
    id: "INC-2067",
    category: "Noise Disturbance",
    severity: "low",
    purok: "Purok 2",
    description:
      "Tanod field report — group gathered near the basketball court, advised and dispersed",
    source: "tanod",
    reporter: "Tanod B. Cruz",
    time: isoAgo(220),
    status: "acknowledged",
    acknowledgedAt: isoAgo(40),
    photos: 1,
    lat: 225,
    lng: 60,
    priority: "Low",
    notes: [],
    assignedTeam: "Team Charlie",
    dispatchId: "DP-1182",
    verificationStatus: "verified",
    verifiedBy: "Desk Officer",
    verifiedAt: isoAgo(200),
  },
  {
    id: "INC-2065",
    category: "Fire or Smoke",
    severity: "low",
    purok: "Purok 5",
    description:
      "Cooking smoke false alarm — verified within acceptable limits",
    source: "resident",
    reporter: "Rosa Garcia",
    time: "2026-07-19T20:30:00",
    status: "resolved",
    resolvedAt: "2026-07-19T21:05:00",
    photos: 3,
    lat: 85,
    lng: 310,
    rating: 5,
    priority: "Low",
    notes: [
      "Smoke source verified at residential kitchen",
      "Sensor readings within acceptable limits",
    ],
    assignedTeam: "Team Delta",
    dispatchId: "DP-1178",
    verificationStatus: "verified",
    verifiedBy: "Desk Officer",
    verifiedAt: "2026-07-19T20:35:00",
    feedback: "Mabilis at malinaw ang pagtugon ng mga tanod. Salamat po!",
    closedReason: "Normal Resolution",
  },
  {
    id: "INC-2064",
    category: "Noise Disturbance",
    severity: "low",
    purok: "Purok 2",
    description: "Event noise verified within limits",
    source: "resident",
    reporter: "Juan Dela Cruz",
    time: "2026-07-19T18:40:00",
    status: "resolved",
    resolvedAt: "2026-07-19T19:15:00",
    photos: 2,
    lat: 225,
    lng: 60,
    rating: 4,
    priority: "Low",
    notes: [
      "Sound check at chapel area",
      "Decibel levels confirmed within allowable",
    ],
    assignedTeam: "Team Charlie",
    dispatchId: "DP-1179",
    verificationStatus: "verified",
    verifiedBy: "Desk Officer",
    verifiedAt: "2026-07-19T18:50:00",
    feedback: "Na-address agad ang concern. Salamat sa mabilis na aksyon.",
    closedReason: "Normal Resolution",
  },
  {
    id: "INC-2063",
    category: "Public Disturbance",
    severity: "warning",
    purok: "Purok 6",
    description: "Street altercation mediated",
    source: "resident",
    reporter: "Ana Lim",
    time: "2026-07-19T16:20:00",
    status: "resolved",
    resolvedAt: "2026-07-19T17:30:00",
    photos: 4,
    lat: 330,
    lng: 240,
    rating: 3,
    priority: "Medium",
    notes: [
      "Parties identified and separated",
      "Ammicable settlement reached on scene",
    ],
    assignedTeam: "Team Bravo",
    dispatchId: "DP-1177",
    verificationStatus: "verified",
    verifiedBy: "Desk Officer",
    verifiedAt: "2026-07-19T16:30:00",
    feedback:
      "Naresolba naman pero sana mas mabilis ang response next time.",
    closedReason: "Normal Resolution",
  },
];

const SEED_DISPATCHES: DispatchItem[] = [
  {
    id: "DP-1181",
    incident: "INC-2070",
    team: "Team Bravo",
    status: "responding",
    purok: "Purok 6",
    eta: "ETA 3 min",
    photos: 0,
    dispatchedAt: isoAgo(4),
    onSceneAt: undefined,
  },
  {
    id: "DP-1180",
    incident: "INC-2068",
    team: "Team Alpha",
    status: "on_scene",
    purok: "Purok 1",
    eta: "On scene",
    photos: 1,
    dispatchedAt: isoAgo(138),
    onSceneAt: isoAgo(133),
  },
  {
    id: "DP-1182",
    incident: "INC-2067",
    team: "Team Charlie",
    status: "resolving",
    purok: "Purok 2",
    eta: "ETA 10 min",
    photos: 2,
    dispatchedAt: isoAgo(38),
    onSceneAt: isoAgo(34),
  },
  {
    id: "DP-1178",
    incident: "INC-2065",
    team: "Team Delta",
    status: "resolved",
    purok: "Purok 5",
    eta: "Closed",
    photos: 3,
    dispatchedAt: "2026-07-19T20:33:00",
    onSceneAt: "2026-07-19T20:38:00",
  },
];

// §15.7a — Seed blotter records enriched with Part 9 fields.
const SEED_BLOTTERS: Blotter[] = [
  {
    id: "B-2026-0142",
    originalIncidentId: "INC-2043",
    category: "Fire or Smoke",
    title: "False alarm — cooking smoke",
    description:
      "IoT sensor triggered by cooking fumes at Purok 2 residence. No fire detected on scene.",
    severity: "low",
    purok: "Purok 2",
    source: "iot",
    incidentDateTime: "2026-07-20T08:15:00",
    resolvedDateTime: "2026-07-20T09:45:00",
    filedDateTime: "2026-07-20T10:00:00",
    convertedDateTime: "2026-07-20T10:00:00",
    createdAt: "2026-07-20T10:00:00",
    updatedAt: "2026-07-20T10:00:00",
    reporter: "Juan Dela Cruz",
    anonymous: false,
    assignedOfficer: "Team Alpha",
    recordedBy: "D.O. Ramos",
    lat: 225,
    lng: 60,
    locationLabel: "Purok 2, Sitio Centro",
    resolutionSummary:
      "Sensor triggered by cooking fumes. No fire detected. Resident advised on ventilation.",
    finalDisposition: "False Alarm",
    closureReason: "Normal Resolution",
    citizenRating: 5,
    citizenFeedback: undefined,
    photoCount: 2,
    fieldNotes: [
      "Sensor triggered by cooking fumes",
      "No fire detected on scene",
    ],
    evidenceReferences: ["IMG-2043-001", "IMG-2043-002"],
    recordStatus: "active",
  },
  {
    id: "B-2026-0141",
    originalIncidentId: "INC-2042",
    category: "Noise Disturbance",
    title: "Event noise — verified within limits",
    description:
      "Noise complaint from chapel area during a community event. Sound check confirmed levels within allowable limits.",
    severity: "low",
    purok: "Purok 5",
    source: "resident",
    incidentDateTime: "2026-07-19T19:30:00",
    resolvedDateTime: "2026-07-19T21:00:00",
    filedDateTime: "2026-07-19T21:05:00",
    convertedDateTime: "2026-07-19T21:05:00",
    createdAt: "2026-07-19T21:05:00",
    updatedAt: "2026-07-19T21:05:00",
    reporter: "Rosa Garcia",
    anonymous: false,
    assignedOfficer: "Team Delta",
    recordedBy: "D.O. Ramos",
    lat: 85,
    lng: 310,
    locationLabel: "Purok 5, Chapel Area",
    resolutionSummary:
      "Decibel measurement taken at venue. Within allowable levels. Event organizers reminded of noise ordinance.",
    finalDisposition: "Resolved",
    closureReason: "Normal Resolution",
    citizenRating: 4,
    citizenFeedback: undefined,
    photoCount: 1,
    fieldNotes: [
      "Decibel measurement taken at venue",
      "Within allowable levels",
    ],
    evidenceReferences: ["IMG-2042-001"],
    recordStatus: "active",
  },
];

// ---------------------------------------------------------------------------
// Part 14 — Seed audit trail entries for existing blotter records
// ---------------------------------------------------------------------------

let auditIdCounter = 100;
function nextAuditId() {
  return `AUD-${++auditIdCounter}`;
}

const SEED_AUDIT: AuditEntry[] = [
  {
    id: "AUD-001",
    timestamp: "2026-07-20T10:00:00",
    actingUser: "D.O. Ramos",
    action: "blotter_created",
    incidentId: "INC-2043",
    blotterId: "B-2026-0142",
    result: "success",
    reason: "Resolved incident eligible for archival — converted to permanent blotter record",
  },
  {
    id: "AUD-002",
    timestamp: "2026-07-19T21:05:00",
    actingUser: "D.O. Ramos",
    action: "blotter_created",
    incidentId: "INC-2042",
    blotterId: "B-2026-0141",
    result: "success",
    reason: "Resolved incident eligible for archival — converted to permanent blotter record",
  },
];

// ---------------------------------------------------------------------------
// §15.8 — Pub/sub store
// ---------------------------------------------------------------------------

type Listener = () => void;

let incidents: Incident[] = [...SEED_INCIDENTS];
let dispatches: DispatchItem[] = [...SEED_DISPATCHES];
let blotters: Blotter[] = [...SEED_BLOTTERS];
let auditTrail: AuditEntry[] = [...SEED_AUDIT];

const listeners: Set<Listener> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
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

export function addIncident(input: Omit<Incident, "id">): Incident {
  const incident: Incident = { ...input, id: nextIncidentId() };
  incidents = [incident, ...incidents];
  emit();
  return incident;
}

export function setDispatches(next: DispatchItem[]) {
  dispatches = next;
  emit();
}
export function setBlotters(next: Blotter[]) {
  blotters = next;
  emit();
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
    convertToBlotter,
    setIncidents,
    setDispatches,
    setBlotters,
  };
}
