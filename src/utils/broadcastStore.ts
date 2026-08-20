export type PendingBroadcast = {
  id: string;
  title: string;
  severity: string;
  purok: string;
  message: string;
  category: string;
  deliveryMethod: "push+sms" | "push";
  createdAt: string;
  submittedBy: string;
};

let pending: PendingBroadcast[] = [];
let nextDraft = 1;
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function seedPendingBroadcasts(initial: PendingBroadcast[]) {
  if (pending.length === 0) {
    pending = [...initial];
    const max = pending.reduce((acc, p) => {
      const m = /^DRAFT-(\d+)$/.exec(p.id);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    nextDraft = max + 1;
    emit();
  }
}

export function getPendingBroadcasts(): PendingBroadcast[] {
  return pending;
}

export function subscribePendingBroadcasts(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function addPendingBroadcast(input: Omit<PendingBroadcast, "id">): PendingBroadcast {
  const draft: PendingBroadcast = { ...input, id: `DRAFT-${String(nextDraft++).padStart(3, "0")}` };
  pending = [draft, ...pending];
  emit();
  return draft;
}

export function removePendingBroadcast(id: string) {
  pending = pending.filter((p) => p.id !== id);
  emit();
}

export type BroadcastRecord = {
  id: string;
  title: string;
  severity: string;
  purok: string;
  message: string;
  sentAt: string;
  sentBy: string;
  status: string;
  smsCount: number;
  pushCount: number;
  safeCount: number;
  helpCount: number;
  category: string;
  deliveryMethod: "push+sms" | "push";
};

let history: BroadcastRecord[] = [];
let nextBroadcast = 1;
const historyListeners: Set<() => void> = new Set();

function emitHistory() {
  historyListeners.forEach((fn) => fn());
}

export function seedBroadcastHistory(initial: BroadcastRecord[]) {
  if (history.length === 0) {
    history = [...initial];
    const max = history.reduce((acc, r) => {
      const m = /^BCAST-(\d+)$/.exec(r.id);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    nextBroadcast = max + 1;
    emitHistory();
  }
}

export function getBroadcastHistory(): BroadcastRecord[] {
  return history;
}

export function subscribeBroadcastHistory(fn: () => void): () => void {
  historyListeners.add(fn);
  return () => {
    historyListeners.delete(fn);
  };
}

export function addBroadcastRecord(input: Omit<BroadcastRecord, "id">): BroadcastRecord {
  const record: BroadcastRecord = { ...input, id: `BCAST-${String(nextBroadcast++).padStart(3, "0")}` };
  history = [record, ...history];
  emitHistory();
  return record;
}
