// Minimal deep-link signal: lets the Desk Officer Live Incident Map open a
// specific incident inside Incident Triage — either its full case view, or the
// Dispatch & Assignment modal (pre-selected on the current Incident ID).
// IncidentTriage consumes the signal once on mount.

export interface DeskCaseTarget {
  incidentId: string;
  openDispatch?: boolean;
}

let pending: DeskCaseTarget | null = null;

export function setDeskCaseTarget(target: DeskCaseTarget): void {
  pending = target;
}

export function consumeDeskCaseTarget(): DeskCaseTarget | null {
  const t = pending;
  pending = null;
  return t;
}
