export type AuditEntry = {
  id: number;
  timestamp: string;
  admin: string;
  actionType: string;
  description: string;
  ip: string;
};

let entries: AuditEntry[] = [];
let nextId = 100;
const listeners: Set<() => void> = new Set();

export function pushAuditLog(actionType: string, description: string, actor?: { admin?: string; ip?: string }) {
  const { admin, ip } = resolveActor(actor);
  const entry: AuditEntry = {
    id: nextId++,
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    admin,
    actionType,
    description,
    ip,
  };
  entries = [...entries, entry];
  listeners.forEach((fn) => fn());
}

function resolveActor(actor?: { admin?: string; ip?: string }): { admin: string; ip: string } {
  if (actor?.admin) return { admin: actor.admin, ip: actor.ip ?? "192.168.1.10" };
  try {
    const raw = localStorage.getItem("bgyauth");
    if (raw) {
      const session = JSON.parse(raw);
      const name = typeof session.operatorName === "string" && session.operatorName ? session.operatorName : session.page;
      if (name) {
        return {
          admin: `${name}@brgy.gov.ph`,
          ip: "192.168.1.10",
        };
      }
    }
  } catch {}
  return { admin: "admin@brgy.gov.ph", ip: "192.168.1.10" };
}

export function getAuditLogs(): AuditEntry[] {
  return entries;
}

export function subscribeAuditLogs(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
