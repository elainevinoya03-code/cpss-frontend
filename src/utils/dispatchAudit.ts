export type DispatchAuditAction =
  | "dispatch_created"
  | "unit_assigned"
  | "dispatch_started"
  | "marked_on_scene"
  | "marked_resolving"
  | "marked_resolved"
  | "resident_notification_sent"
  | "resident_notification_failed"
  | "notification_retried"
  | "route_opened"
  | "chat_initiated"
  | "evidence_viewed"
  | "evidence_uploaded"
  | "escalated_to_captain"
  | "escalation_acknowledged"
  | "reassignment"
  | "manual_intervention"
  | "incident_resolution_action";

export type DispatchAuditEvent = {
  id: string;
  incidentId?: string;
  dispatchId?: string;
  actorId: string;
  action: DispatchAuditAction;
  timestamp: string;
  result?: string;
  note?: string;
};

let entries: DispatchAuditEvent[] = [];
let nextSeq = 1;
const listeners: Set<() => void> = new Set();

export function pushDispatchAudit(
  action: DispatchAuditAction,
  opts: { incidentId?: string; dispatchId?: string; actorId?: string; result?: string; note?: string }
): DispatchAuditEvent {
  const event: DispatchAuditEvent = {
    id: `DA-${String(nextSeq++).padStart(4, "0")}`,
    incidentId: opts.incidentId,
    dispatchId: opts.dispatchId,
    actorId: opts.actorId ?? resolveActor(),
    action,
    timestamp: new Date().toISOString(),
    result: opts.result,
    note: opts.note,
  };
  entries = [...entries, event];
  listeners.forEach((fn) => fn());
  return event;
}

export function getDispatchAudit(): DispatchAuditEvent[] {
  return entries;
}

export function getDispatchAuditFor(dispatchId: string): DispatchAuditEvent[] {
  return entries.filter((e) => e.dispatchId === dispatchId);
}

export function getIncidentAuditFor(incidentId: string): DispatchAuditEvent[] {
  return entries.filter((e) => e.incidentId === incidentId);
}

export function subscribeDispatchAudit(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function resolveActor(): string {
  try {
    const raw = localStorage.getItem("bgyauth");
    if (raw) {
      const session = JSON.parse(raw);
      const name = typeof session.operatorName === "string" && session.operatorName
        ? session.operatorName
        : session.page;
      if (name) return name;
    }
  } catch { /* ignore */ }
  return "Desk Officer";
}
