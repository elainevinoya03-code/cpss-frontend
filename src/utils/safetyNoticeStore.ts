export type NoticeState = "draft" | "published" | "archived";

export type NoticeTarget =
  | { kind: "barangay" }
  | { kind: "purok"; purok: string };

export type NoticeCategory = "General" | "Safety Alert" | "Event Notice" | "Weather Warning";

export type NoticeSeverity = "Info" | "Warning" | "High";

export type NoticeAudience = "tanods" | "neighborhood_watch" | "residents" | "all";

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
  incidentId?: string;
  // Create Alert extension — security alerts carry severity, audience and,
  // for high severity, a Punong Barangay approval gate.
  severity?: NoticeSeverity;
  audience?: NoticeAudience[];
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  isAllClear?: boolean;
};

const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// Demo seed — representative security alerts spanning the alert-status
// lifecycle (Draft / Pending Approval / Sent / All-Clear issued) so the
// Desk Officer dashboard's Alert Status section has content on first load.
const SEED: SafetyNotice[] = [
    {
    id: "NTC-0001",
    title: "All-Clear — Purok 5 flood risk lifted",
    category: "Weather Warning",
    message: "The flood warning for Purok 5 has been lifted. Roads are passable and outdoor activity may resume.",
    target: { kind: "purok", purok: "Purok 5" },
    state: "published",
    author: "Punong Barangay",
    createdAt: isoAgo(320),
    publishedAt: isoAgo(315),
    severity: "Info",
    audience: ["residents"],
    isAllClear: true,
  },
  {
    id: "NTC-0002",
    title: "Fire risk advisory — dry season vigilance",
    category: "Safety Alert",
    message: "Dry-season fire risk is elevated. Report smoke or open burning immediately; keep exits clear.",
    target: { kind: "barangay" },
    state: "published",
    author: "Maria Santos",
    createdAt: isoAgo(180),
    publishedAt: isoAgo(174),
    severity: "Warning",
    audience: ["all"],
  },
  {
    id: "NTC-0003",
    title: "Routine evening noise advisory",
    category: "Event Notice",
    message: "Reminder: observe the 10PM-6AM quiet hours for the barangay centers.",
    target: { kind: "barangay" },
    state: "draft",
    author: "Maria Santos",
    createdAt: isoAgo(95),
    severity: "Info",
    audience: ["residents"],
  },
  {
    id: "NTC-0004",
    title: "High-severity alert — Public Market disturbance",
    category: "Safety Alert",
    message: "Sustained disturbance at the Public Market strip. Authorities responding; avoid the area until cleared.",
    target: { kind: "purok", purok: "Purok 6" },
    state: "published",
    author: "Maria Santos",
    createdAt: isoAgo(70),
    publishedAt: isoAgo(33),
    incidentId: "INC-2069",
    severity: "High",
    audience: ["tanods", "residents"],
    approvalStatus: "approved",
    approvedBy: "Punong Barangay Cruz",
    approvedAt: isoAgo(52),
  },
  {
    id: "NTC-0005",
    title: "Alert — suspected catalytic converter thefts",
    category: "Safety Alert",
    message: "Neighbors report a group tampering with parked vehicles near the western boundary.",
    target: { kind: "purok", purok: "Purok 3" },
    state: "draft",
    author: "Maria Santos",
    createdAt: isoAgo(64),
    severity: "High",
    audience: ["tanods", "neighborhood_watch"],
    approvalStatus: "pending",
  },
];

let notices: SafetyNotice[] = [...SEED];
let nextNotice = 6;

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

export type AlertStatus = "draft" | "pending_approval" | "sent" | "all_clear";

// Derive the compact alert-status shown in the dashboard Alert Status section
// and the Security Alert Center. Order of precedence: an explicit all-clear
// wins; otherwise pending approval → sent → draft.
export function alertStatusOf(n: SafetyNotice): AlertStatus {
  if (n.isAllClear) return "all_clear";
  if (n.approvalStatus === "pending" || n.approvalStatus === "rejected") return "pending_approval";
  if (n.state === "published") return "sent";
  return "draft";
}

// 1-tap authorization gate — used only on the dedicated Security Alert Center
// (Punong Barangay approval). Never surfaced as a bypass on the dashboard.
export function approveSafetyNotice(id: string, by: string): SafetyNotice | undefined {
  let approved: SafetyNotice | undefined;
  notices = notices.map((n) => {
    if (n.id !== id) return n;
    const next = {
      ...n,
      state: "published" as NoticeState,
      approvalStatus: "approved" as const,
      approvedBy: by,
      approvedAt: new Date().toISOString(),
      publishedAt: n.publishedAt ?? new Date().toISOString(),
    };
    approved = next;
    return next;
  });
  if (approved) emit();
  return approved;
}

