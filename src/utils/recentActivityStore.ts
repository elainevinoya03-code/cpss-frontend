// Shared Recent Activity store — a compact, chronological operational feed
// shown on the Desk Officer dashboard. Records a single event per discrete
// action across the command center (incidents, tanods, CCTV, alerts, refer,
// closure) so the dashboard can show "what changed just now" without loading
// the full Audit Log module.
//
// Each event carries a `kind` and a deep-link `target` so clicking an entry
// navigates to the associated record, and an `incidentId`/`refId` for display.

export type ActivityAction =
  | "incident_received"
  | "urgency_changed"
  | "tanod_assigned"
  | "tanod_status_changed"
  | "cctv_update"
  | "video_request_submitted"
  | "video_request_completed"
  | "alert_created"
  | "alert_approved"
  | "alert_sent"
  | "all_clear_issued"
  | "incident_referred"
  | "incident_closed";

export type ActivityKind =
  | "incident"
  | "tanod"
  | "cctv"
  | "request"
  | "alert"
  | "closure";

export interface ActivityEvent {
  id: string;
  at: string;
  action: ActivityAction;
  kind: ActivityKind;
  title: string;
  incidentId?: string;
  refId?: string;
  actor: string;
  state: string;
  target: string;
  severity?: "low" | "normal" | "high";
}

const ACTIVITY_ACTION_META: Record<ActivityAction, { label: string; icon: string }> = {
  incident_received: { label: "Incident Received", icon: "incident" },
  urgency_changed: { label: "Urgency Changed", icon: "incident" },
  tanod_assigned: { label: "Tanod Assigned", icon: "tanod" },
  tanod_status_changed: { label: "Tanod Status Changed", icon: "tanod" },
  cctv_update: { label: "CCTV Update", icon: "cctv" },
  video_request_submitted: { label: "Video Clip Request Submitted", icon: "request" },
  video_request_completed: { label: "Video Clip Request Completed", icon: "request" },
  alert_created: { label: "Alert Created", icon: "alert" },
  alert_approved: { label: "Alert Approved", icon: "alert" },
  alert_sent: { label: "Alert Sent", icon: "alert" },
  all_clear_issued: { label: "All-Clear Issued", icon: "alert" },
  incident_referred: { label: "Incident Referred", icon: "incident" },
  incident_closed: { label: "Incident Closed", icon: "closure" },
};

export function activityActionLabel(action: ActivityAction): string {
  return ACTIVITY_ACTION_META[action].label;
}

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const SEED: ActivityEvent[] = [
  {
    id: "ACT-0013",
    at: isoAgo(2),
    action: "video_request_completed",
    kind: "request",
    title: "Clip delivered for INC-2068",
    incidentId: "INC-2068",
    refId: "FR-1003",
    actor: "CO-01",
    state: "Completed",
    target: "footage_requests",
  },
  {
    id: "ACT-0012",
    at: isoAgo(6),
    action: "all_clear_issued",
    kind: "alert",
    title: "All-clear issued — Purok 5 flood risk lifted",
    refId: "NTC-0001",
    actor: "Punong Barangay",
    state: "All-Clear issued",
    severity: "low",
    target: "security_alerts",
  },
  {
    id: "ACT-0011",
    at: isoAgo(9),
    action: "video_request_submitted",
    kind: "request",
    title: "Footage request filed for INC-2070",
    incidentId: "INC-2070",
    refId: "FR-1002",
    actor: "Maria Santos",
    state: "Pending",
    target: "footage_requests",
  },
  {
    id: "ACT-0010",
    at: isoAgo(14),
    action: "tanod_status_changed",
    kind: "tanod",
    title: "Team Bravo reported En Route",
    incidentId: "INC-2070",
    actor: "Team Bravo",
    state: "En Route",
    target: "incident_triage",
  },
  {
    id: "ACT-0009",
    at: isoAgo(21),
    action: "urgency_changed",
    kind: "incident",
    title: "INC-2068 escalated to High priority",
    incidentId: "INC-2068",
    actor: "Ramon Cruz",
    state: "High",
    severity: "high",
    target: "incident_triage",
  },
  {
    id: "ACT-0008",
    at: isoAgo(27),
    action: "alert_sent",
    kind: "alert",
    title: "High-severity alert sent to Purok 6",
    refId: "NTC-0004",
    actor: "Punong Barangay",
    state: "Sent",
    severity: "high",
    target: "security_alerts",
  },
  {
    id: "ACT-0007",
    at: isoAgo(33),
    action: "alert_approved",
    kind: "alert",
    title: "Security alert approved by Punong Barangay",
    refId: "NTC-0004",
    actor: "Punong Barangay Cruz",
    state: "Approved",
    severity: "high",
    target: "security_alerts",
  },
  {
    id: "ACT-0006",
    at: isoAgo(41),
    action: "tanod_assigned",
    kind: "tanod",
    title: "Team Alpha assigned to INC-2068",
    incidentId: "INC-2068",
    actor: "Maria Santos",
    state: "En Route",
    target: "incident_triage",
  },
  {
    id: "ACT-0005",
    at: isoAgo(48),
    action: "incident_referred",
    kind: "incident",
    title: "INC-2071 referred to Purok Leader",
    incidentId: "INC-2071",
    actor: "Ramon Cruz",
    state: "Referred",
    target: "incident_triage",
  },
  {
    id: "ACT-0004",
    at: isoAgo(55),
    action: "cctv_update",
    kind: "cctv",
    title: "Camera 3 (Public Market) regained signal",
    actor: "CO-01",
    state: "Online",
    target: "footage_requests",
  },
  {
    id: "ACT-0003",
    at: isoAgo(64),
    action: "alert_created",
    kind: "alert",
    title: "New security alert drafted — Fire risk notice",
    refId: "NTC-0005",
    actor: "Maria Santos",
    state: "Pending Approval",
    severity: "high",
    target: "security_alerts",
  },
  {
    id: "ACT-0002",
    at: isoAgo(76),
    action: "incident_received",
    kind: "incident",
    title: "New QRT dispatch logged (SOS)",
    incidentId: "INC-2070",
    actor: "Desk Officer",
    state: "New",
    target: "incident_triage",
  },
  {
    id: "ACT-0001",
    at: isoAgo(90),
    action: "incident_closed",
    kind: "closure",
    title: "INC-2061 closed — resolved by Team Echo",
    incidentId: "INC-2061",
    actor: "Ramon Cruz",
    state: "Resolved",
    target: "blotter",
  },
];

let events: ActivityEvent[] = [...SEED];
let nextId = 14;
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getActivity(): ActivityEvent[] {
  return events;
}

export function subscribeActivity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function recordActivity(input: Omit<ActivityEvent, "id" | "at" | "title"> & { title?: string }): ActivityEvent {
  const event: ActivityEvent = {
    ...input,
    id: `ACT-${String(nextId++).padStart(4, "0")}`,
    at: new Date().toISOString(),
    title: input.title ?? `${activityActionLabel(input.action)}${input.incidentId ? ` — ${input.incidentId}` : ""}`,
  };
  events = [event, ...events];
  emit();
  return event;
}
