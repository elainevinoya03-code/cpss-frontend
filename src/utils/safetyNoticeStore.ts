export type NoticeState = "draft" | "published" | "archived";

export type NoticeTarget =
  | { kind: "barangay" }
  | { kind: "purok"; purok: string };

export type NoticeCategory = "General" | "Safety Alert" | "Event Notice" | "Weather Warning";

export type SafetyNotice = {
  id: string;
  title: string;
  category: NoticeCategory;
  message: string;
  target: NoticeTarget;
  state: NoticeState;
  author: string;
  createdAt: string;
  publishedAt?: string;
};

let notices: SafetyNotice[] = [];
let nextNotice = 1;
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function seedSafetyNotices(initial: SafetyNotice[]) {
  if (notices.length === 0) {
    notices = [...initial];
    const max = notices.reduce((acc, n) => {
      const m = /^NTC-(\d+)$/.exec(n.id);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    nextNotice = max + 1;
    emit();
  }
}

export function getSafetyNotices(): SafetyNotice[] {
  return notices;
}

export function subscribeSafetyNotices(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function addSafetyNotice(input: Omit<SafetyNotice, "id">): SafetyNotice {
  const notice: SafetyNotice = {
    ...input,
    id: `NTC-${String(nextNotice++).padStart(3, "0")}`,
  };
  notices = [notice, ...notices];
  emit();
  return notice;
}

export function setSafetyNoticeState(id: string, state: NoticeState) {
  notices = notices.map((n) =>
    n.id === id
      ? {
          ...n,
          state,
          publishedAt: state === "published" ? (n.publishedAt ?? new Date().toISOString()) : n.publishedAt,
        }
      : n
  );
  emit();
}
