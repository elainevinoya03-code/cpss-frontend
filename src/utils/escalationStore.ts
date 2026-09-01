export type EscalationStatus = "pending" | "acknowledged";

export type CaptainEscalation = {
  id: string;
  incidentId: string;
  dispatchId?: string;
  escalatedBy: string;
  reason: string;
  note?: string;
  escalatedAt: string;
  status: EscalationStatus;
};

let entries: CaptainEscalation[] = [];
let nextSeq = 1;
const listeners: Set<() => void> = new Set();

export function pushEscalation(
  opts: Omit<CaptainEscalation, "id" | "escalatedAt" | "status">
): CaptainEscalation {
  const esc: CaptainEscalation = {
    id: `ESC-${String(nextSeq++).padStart(4, "0")}`,
    ...opts,
    escalatedAt: new Date().toISOString(),
    status: "pending",
  };
  entries = [...entries, esc];
  listeners.forEach((fn) => fn());
  return esc;
}

export function acknowledgeEscalation(id: string) {
  entries = entries.map((e) =>
    e.id === id ? { ...e, status: "acknowledged" as const } : e
  );
  listeners.forEach((fn) => fn());
}

export function getEscalations(): CaptainEscalation[] {
  return entries;
}

export function getEscalationForDispatch(dispatchId: string): CaptainEscalation | undefined {
  return entries.find((e) => e.dispatchId === dispatchId);
}

export function getEscalationForIncident(incidentId: string): CaptainEscalation | undefined {
  return entries.find((e) => e.incidentId === incidentId);
}

export function subscribeEscalations(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
