export type CaptainInboxType = "escalation" | "sla_breach";

export type CaptainInboxItem = {
  id: string;
  type: CaptainInboxType;
  incidentId: string;
  title: string;
  purok: string;
  priority: string;
  reason?: string;
  submittedBy: string;
  createdAt: string;
  read: boolean;
};

let items: CaptainInboxItem[] = [];
let nextId = 1;
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function seedCaptainInbox(initial: CaptainInboxItem[]) {
  if (items.length === 0) {
    items = [...initial];
    const max = items.reduce((acc, p) => {
      const m = /^CAP-(\d+)$/.exec(p.id);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    nextId = max + 1;
    emit();
  }
}

export function getCaptainInboxItems(): CaptainInboxItem[] {
  return items;
}

export function subscribeCaptainInbox(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function addCaptainInboxItem(input: Omit<CaptainInboxItem, "id" | "read" | "createdAt">): CaptainInboxItem {
  const unreadDup = items.some((p) => p.type === input.type && p.incidentId === input.incidentId && !p.read);
  if (unreadDup) return items.find((p) => p.type === input.type && p.incidentId === input.incidentId && !p.read) as CaptainInboxItem;
  const item: CaptainInboxItem = {
    ...input,
    id: `CAP-${String(nextId++).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  items = [item, ...items];
  emit();
  return item;
}

export function markCaptainInboxRead(id: string) {
  items = items.map((p) => (p.id === id ? { ...p, read: true } : p));
  emit();
}

export function markAllCaptainInboxRead() {
  items = items.map((p) => (p.read ? p : { ...p, read: true }));
  emit();
}
