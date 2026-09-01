// Minimal deep-link signal: lets the Desk Officer dashboard open Incident
// Triage pre-filtered to a specific queue (new / active / high / sla) when a
// summary card is clicked. IncidentTriage consumes it once on mount.
export type DeskTriageTarget = "new" | "acknowledged" | "in_progress" | "high" | "sla";

let pending: DeskTriageTarget | null = null;

export function setDeskTriageTarget(target: DeskTriageTarget): void {
  pending = target;
}

export function consumeDeskTriageTarget(): DeskTriageTarget | null {
  const t = pending;
  pending = null;
  return t;
}
