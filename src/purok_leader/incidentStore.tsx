import { createContext, useContext, useState, ReactNode } from "react";
import { PUROK_LEADER_JURISDICTION, PUROK_ZONES } from "../constants/purok";

// ─── Shared vocabulary ────────────────────────────────────────────────────────

export type Priority = "critical" | "warning" | "low";
export type ReportSource = "resident" | "sensor";
export type ValidationOutcome = "Confirmed" | "Marked Invalid" | "Event-Related";
export type EscalationStatus = "sent" | "under_review" | "action_assigned" | "closed";

export const ESCALATION_STATUS_ORDER: EscalationStatus[] = [
  "sent",
  "under_review",
  "action_assigned",
  "closed",
];

export function nextEscalationStatus(status: EscalationStatus): EscalationStatus | null {
  const idx = ESCALATION_STATUS_ORDER.indexOf(status);
  if (idx < 0 || idx >= ESCALATION_STATUS_ORDER.length - 1) return null;
  return ESCALATION_STATUS_ORDER[idx + 1];
}

export const ESCALATION_STATUS_META: Record<EscalationStatus, { label: string; badge: string; dot: string }> = {
  sent: { label: "Sent", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  under_review: { label: "Under Review", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400" },
  action_assigned: { label: "Action Assigned", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  closed: { label: "Closed", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
};

// ─── Data model ───────────────────────────────────────────────────────────────

export interface PurokReport {
  id: string;
  category: string;
  title: string;
  description: string;
  source: ReportSource;
  reporter: string;
  reporterPurok?: string;
  deviceId?: string;
  metric?: string;
  purok: string;
  lat: number;
  lng: number;
  reportedAt: string;
  suggestedPriority: Priority;
  photos: number;
  outcome?: ValidationOutcome;
  validationNote?: string;
  validatedAt?: string;
  clarification?: { requestedAt: string; note: string };
  closedLocallyAt?: string;
  closureNote?: string;
  escalatedAt?: string;
  handoffNote?: string;
  status?: EscalationStatus;
  deskOfficer?: string;
  statusNote?: string;
  statusUpdatedAt?: string;
  adjustedPriority?: Priority;
  tanodUnit?: string;
  blottedId?: string;
  infoRequest?: { message: string; at: string };
  hasUpdate?: boolean;
}

// Read-only view of an escalated report. Field names `label` and `suggestedPriority`
// are consumed by the Desk Officer's shared triage panel.
export interface EscalatedCase {
  id: string;
  category: string;
  title: string;
  description: string;
  source: ReportSource;
  reporter: string;
  purok: string;
  escalatedAt: string;
  handoffNote: string;
  label?: ValidationOutcome;
  suggestedPriority: Priority;
  status: EscalationStatus;
  deskOfficer: string;
  statusNote: string;
  statusUpdatedAt?: string;
  adjustedPriority?: Priority;
  tanodUnit?: string;
  blottedId?: string;
  infoRequest?: { message: string; at: string };
  hasUpdate?: boolean;
}

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_ZONE_ID = PUROK_LEADER_JURISDICTION.zoneId;

function parsePath(path: string): { x: number; y: number }[] {
  const nums = path.match(/[-\d.]+/g);
  const pts: { x: number; y: number }[] = [];
  if (!nums) return pts;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return pts;
}

function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function zoneOfPoint(lat: number, lng: number): string | null {
  for (const zone of PUROK_ZONES) {
    if (pointInPolygon({ x: lat, y: lng }, parsePath(zone.path))) return zone.id;
  }
  return null;
}

// Automatic jurisdiction filter: reporter registered in the assigned purok,
// or GPS coordinates inside the purok's digital boundary.
export function inJurisdiction(r: Pick<PurokReport, "reporterPurok" | "lat" | "lng">): boolean {
  if (r.reporterPurok === JURISDICTION_NAME) return true;
  return zoneOfPoint(r.lat, r.lng) === JURISDICTION_ZONE_ID;
}

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

// ─── Seed data (single source of truth for reports AND escalations) ──────────

export const INITIAL_REPORTS: PurokReport[] = [
  // Active resident reports inside the assigned jurisdiction
  {
    id: "INC-2101",
    category: "Crime/Suspicious Activity",
    title: "Suspicious persons at market gate",
    description:
      "Three unknown individuals observed loitering near the market gate since morning; residents report they approach parked motorcycles.",
    source: "resident",
    reporter: "Jay Dela Peña",
    reporterPurok: "Purok 5",
    purok: JURISDICTION_NAME,
    lat: 108,
    lng: 195,
    reportedAt: isoAgo(4),
    suggestedPriority: "warning",
    photos: 3,
  },
  {
    id: "INC-2100",
    category: "Fire/Smoke",
    title: "Cooking smoke near eatery row",
    description: "Smoke seen rising from eatery row beside the public market; no open flames confirmed yet.",
    source: "resident",
    reporter: "Carlo Reyes",
    reporterPurok: "Purok 4",
    purok: JURISDICTION_NAME,
    lat: 112,
    lng: 205,
    reportedAt: isoAgo(6),
    suggestedPriority: "warning",
    photos: 2,
  },
  {
    id: "INC-2099",
    category: "Road Obstruction",
    title: "Vendor cart blocking market alley",
    description: "A vendor cart has been blocking the alley between market stalls, restricting access for deliveries.",
    source: "resident",
    reporter: "Maria Santos",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 105,
    lng: 200,
    reportedAt: isoAgo(8),
    suggestedPriority: "low",
    photos: 1,
    outcome: "Confirmed",
    validationNote: "Spoke with adjacent stall owners — cart has been parked there since opening hours.",
    validatedAt: isoAgo(7),
  },
  {
    id: "INC-2098",
    category: "Noise Disturbance",
    title: "Fiesta karaoke noise at plaza",
    description: "Loud karaoke from the fiesta stage at the plaza; scheduled barangay fiesta celebration today.",
    source: "resident",
    reporter: "Rosa Garcia",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 100,
    lng: 205,
    reportedAt: isoAgo(10),
    suggestedPriority: "warning",
    photos: 1,
    outcome: "Event-Related",
    validationNote: "Confirmed with the fiesta committee — part of tonight's program until the 10 PM cutoff.",
    validatedAt: isoAgo(9),
  },
  {
    id: "INC-2097",
    category: "Noise Disturbance",
    title: "Construction hammering before 6 AM",
    description: "Hammering and drilling from a storefront renovation started before 6:00 AM, disturbing nearby homes.",
    source: "resident",
    reporter: "Ana Lim",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 118,
    lng: 190,
    reportedAt: isoAgo(12),
    suggestedPriority: "warning",
    photos: 1,
    clarification: {
      requestedAt: isoAgo(11),
      note: "Asked the reporter for the exact storefront address and whether the work is permit-related.",
    },
  },

  // Medium-severity sensor alerts inside the assigned jurisdiction
  {
    id: "IoT-1203",
    category: "Noise Disturbance",
    title: "Sustained noise at market row",
    description: "Decibel spike near stall 12 — sustained above the quiet-hours threshold for 20+ minutes.",
    source: "sensor",
    reporter: "Sensor DB-MARKET-03",
    deviceId: "DB-MARKET-03",
    metric: "82 dB · threshold 80 dB",
    purok: JURISDICTION_NAME,
    lat: 105,
    lng: 200,
    reportedAt: isoAgo(2),
    suggestedPriority: "warning",
    photos: 0,
  },
  {
    id: "IoT-1202",
    category: "Crime/Suspicious Activity",
    title: "Motion cluster at plaza corner",
    description: "Repeated motion events near the plaza corner overnight — possible loitering or crowd gathering.",
    source: "sensor",
    reporter: "Sensor MD-PLAZA-02",
    deviceId: "MD-PLAZA-02",
    metric: "14 motion events · 12 AM–5 AM",
    purok: JURISDICTION_NAME,
    lat: 100,
    lng: 205,
    reportedAt: isoAgo(16),
    suggestedPriority: "warning",
    photos: 0,
  },
  {
    id: "IoT-1201",
    category: "Noise Disturbance",
    title: "Fiesta karaoke at plaza",
    description: "Loud karaoke from the fiesta stage — aligns with the scheduled barangay fiesta program today.",
    source: "sensor",
    reporter: "Sensor DB-MARKET-03",
    deviceId: "DB-MARKET-03",
    metric: "84 dB · threshold 85 dB",
    purok: JURISDICTION_NAME,
    lat: 100,
    lng: 205,
    reportedAt: isoAgo(10),
    suggestedPriority: "low",
    photos: 0,
    outcome: "Event-Related",
    validationNote: "Matches INC-2098 — fiesta program noise; no action needed beyond the cutoff time.",
    validatedAt: isoAgo(9),
  },

  // Closed locally — kept separate from the active queue
  {
    id: "INC-2089",
    category: "Road Obstruction",
    title: "Blocked drainage grate after rains",
    description: "Report of a drainage grate fully blocked by debris causing street ponding near the market side.",
    source: "resident",
    reporter: "Tomas Cruz",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 96,
    lng: 198,
    reportedAt: isoAgo(28),
    suggestedPriority: "low",
    photos: 2,
    outcome: "Marked Invalid",
    validationNote: "On-site check shows neighbors already cleared the grate; no ponding remains.",
    validatedAt: isoAgo(27),
    closedLocallyAt: isoAgo(26),
    closureNote: "Resolved on-site by residents — no Desk Officer action needed.",
  },
  {
    id: "INC-2088",
    category: "Community Welfare",
    title: "Lost child reported at plaza",
    description: "Resident reported a young child separated from guardians near the plaza stage.",
    source: "resident",
    reporter: "Bea Torres",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 102,
    lng: 210,
    reportedAt: isoAgo(30),
    suggestedPriority: "warning",
    photos: 0,
    outcome: "Confirmed",
    validationNote: "Verified on scene — child was with the fiesta first-aid tent volunteers.",
    validatedAt: isoAgo(29),
    closedLocallyAt: isoAgo(29),
    closureNote: "Child reunited with guardians within the hour; confirmed no further assistance needed.",
  },

  // Previously escalated cases — read-only progress tracked on the Escalated Cases page
  {
    id: "INC-2106",
    category: "Road Obstruction",
    title: "Flooding along market side alley",
    description: "Repeat flooding after last night's rain; drains clogged near stall 12 of the market alley.",
    source: "resident",
    reporter: "Bea Torres",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 98,
    lng: 202,
    reportedAt: isoAgo(13),
    suggestedPriority: "warning",
    photos: 2,
    outcome: "Confirmed",
    validationNote: "Repeat flooding after last night's rain; drains clogged near stall 12.",
    validatedAt: isoAgo(12.5),
    escalatedAt: isoAgo(12),
    handoffNote:
      "Repeat flooding after last night's rain; drains clogged near stall 12. Recommend clearing before the afternoon thunderstorms.",
    status: "sent",
    deskOfficer: "D.O. Ramos",
    statusNote: "Desk Officer requested additional details before accepting triage.",
    statusUpdatedAt: isoAgo(10),
    infoRequest: {
      message: "Please confirm the exact alley location and whether floodwater reached any doorway thresholds.",
      at: isoAgo(10),
    },
    hasUpdate: true,
  },
  {
    id: "INC-2105",
    category: "Crime/Suspicious Activity",
    title: "Suspicious loitering near school gate",
    description: "Unfamiliar persons loitering near the school gate after dismissal; subjects returned twice.",
    source: "resident",
    reporter: "Sara Lim",
    reporterPurok: "Purok 4",
    purok: JURISDICTION_NAME,
    lat: 218,
    lng: 205,
    reportedAt: isoAgo(40),
    suggestedPriority: "warning",
    photos: 1,
    escalatedAt: isoAgo(39),
    handoffNote:
      "Caught on the school CCTV at dismissal; subjects returned twice. Coordinating with the school guard.",
    status: "action_assigned",
    deskOfficer: "Sgt. Ramos",
    statusNote: "Desk Officer assigned a patrol response near the school gate.",
    statusUpdatedAt: isoAgo(20),
    tanodUnit: "Tanod Unit B",
  },
  {
    id: "INC-2104",
    category: "Noise Disturbance",
    title: "Karaoke fiesta noise at plaza",
    description: "Loud karaoke from the fiesta stage at the plaza during the scheduled program.",
    source: "resident",
    reporter: "Rosa Garcia",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 100,
    lng: 205,
    reportedAt: isoAgo(42),
    suggestedPriority: "low",
    photos: 1,
    outcome: "Event-Related",
    validationNote: "Part of the scheduled fiesta program; residents asked for a cutoff time.",
    validatedAt: isoAgo(41),
    escalatedAt: isoAgo(41),
    handoffNote: "Part of the scheduled fiesta program; residents asked for a cutoff time. Suggest keeping priority low.",
    status: "under_review",
    deskOfficer: "Ofc. Torres",
    statusNote: "Under review — verified as scheduled fiesta activity; cutoff set at 10:00 PM.",
    statusUpdatedAt: isoAgo(18),
    adjustedPriority: "low",
  },
  {
    id: "INC-2103",
    category: "Fire/Smoke",
    title: "Burning garbage at back alley",
    description: "Report of burning garbage in the back alley; pile was already extinguished upon verification.",
    source: "resident",
    reporter: "Tomas Cruz",
    reporterPurok: JURISDICTION_NAME,
    purok: JURISDICTION_NAME,
    lat: 90,
    lng: 180,
    reportedAt: isoAgo(46),
    suggestedPriority: "low",
    photos: 2,
    outcome: "Marked Invalid",
    validationNote: "Verified on scene — the pile was already extinguished. Likely false alarm.",
    validatedAt: isoAgo(45),
    escalatedAt: isoAgo(45),
    handoffNote: "Verified on scene with a neighbor; the pile was already extinguished. Likely false alarm.",
    status: "closed",
    deskOfficer: "Sgt. Ramos",
    statusNote: "Closed after scene verification and archived into the digital barangay blotter.",
    statusUpdatedAt: isoAgo(24),
    blottedId: "B-2026-0143",
  },

  // Outside the assigned jurisdiction — never shown to this leader
  {
    id: "INC-2095",
    category: "Fire/Smoke",
    title: "House fire near riverside",
    description: "Smoke rising from a riverside residence; possible electrical fire reported by a neighbor.",
    source: "resident",
    reporter: "Pedro Reyes",
    reporterPurok: "Purok 1",
    purok: "Purok 1",
    lat: 108,
    lng: 88,
    reportedAt: isoAgo(3),
    suggestedPriority: "critical",
    photos: 4,
  },
  {
    id: "INC-2090",
    category: "Crime/Suspicious Activity",
    title: "Burglary report at residence",
    description: "Resident reports a burglary attempt at a residence; suspects fled on foot.",
    source: "resident",
    reporter: "Dan Cruz",
    reporterPurok: "Purok 2",
    purok: "Purok 2",
    lat: 225,
    lng: 85,
    reportedAt: isoAgo(22),
    suggestedPriority: "critical",
    photos: 3,
  },
  {
    id: "INC-2092",
    category: "Road Obstruction",
    title: "Fallen tree blocking main road",
    description: "Fallen tree branch partially blocking the main road near the basketball court.",
    source: "resident",
    reporter: "Liza Mendoza",
    reporterPurok: "Purok 5",
    purok: "Purok 5",
    lat: 155,
    lng: 320,
    reportedAt: isoAgo(26),
    suggestedPriority: "low",
    photos: 1,
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface PurokIncidentStore {
  reports: PurokReport[];
  activeReports: PurokReport[];
  closedLocalReports: PurokReport[];
  escalatedCases: EscalatedCase[];
  validateReport: (id: string, outcome: ValidationOutcome, note: string) => void;
  requestClarification: (id: string, note: string) => void;
  closeLocally: (id: string, note: string) => void;
  escalate: (id: string, handoffNote: string) => boolean;
  updateCase: (id: string, patch: Partial<EscalatedCase>) => void;
  markUpdateSeen: (id: string) => void;
  markAllUpdatesSeen: () => void;
  isEscalated: (id: string) => boolean;
}

const PurokIncidentContext = createContext<PurokIncidentStore | null>(null);

export function PurokIncidentsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<PurokReport[]>(INITIAL_REPORTS);

  function mutate(id: string, fn: (r: PurokReport) => PurokReport) {
    setReports((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
  }

  function validateReport(id: string, outcome: ValidationOutcome, note: string) {
    mutate(id, (r) =>
      r.status || r.closedLocallyAt
        ? r
        : { ...r, outcome, validationNote: note.trim(), validatedAt: new Date().toISOString() }
    );
  }

  function requestClarification(id: string, note: string) {
    mutate(id, (r) =>
      r.status || r.closedLocallyAt
        ? r
        : { ...r, clarification: { requestedAt: new Date().toISOString(), note: note.trim() } }
    );
  }

  function closeLocally(id: string, note: string) {
    mutate(id, (r) =>
      r.status
        ? r
        : { ...r, closedLocallyAt: new Date().toISOString(), closureNote: note.trim() }
    );
  }

  function escalate(id: string, handoffNote: string): boolean {
    const report = reports.find((r) => r.id === id);
    if (!report || report.status || report.closedLocallyAt) return false;
    const now = new Date().toISOString();
    mutate(id, (r) => ({
      ...r,
      escalatedAt: now,
      handoffNote: handoffNote.trim(),
      status: "sent",
      deskOfficer: "D.O. Ramos",
      statusNote: "Sent to the Desk Officer — awaiting review.",
      hasUpdate: false,
    }));
    return true;
  }

  function updateCase(id: string, patch: Partial<EscalatedCase>) {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== id || !r.status) return r;
        const changed =
          (patch.status !== undefined && patch.status !== r.status) ||
          (patch.statusNote !== undefined && patch.statusNote !== r.statusNote) ||
          (patch.infoRequest !== undefined && patch.infoRequest !== r.infoRequest);
        return {
          ...r,
          ...patch,
          ...(changed ? { hasUpdate: true, statusUpdatedAt: new Date().toISOString() } : {}),
        };
      })
    );
  }

  function markUpdateSeen(id: string) {
    mutate(id, (r) => ({ ...r, hasUpdate: false }));
  }

  function markAllUpdatesSeen() {
    setReports((prev) => prev.map((r) => (r.hasUpdate ? { ...r, hasUpdate: false } : r)));
  }

  function isEscalated(id: string) {
    return reports.some((r) => r.id === id && !!r.status);
  }

  const activeReports = reports.filter((r) => !r.status && !r.closedLocallyAt);
  const closedLocalReports = reports.filter((r) => !r.status && !!r.closedLocallyAt);
  const escalatedCases: EscalatedCase[] = reports
    .filter((r) => !!r.status)
    .map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      description: r.description,
      source: r.source,
      reporter: r.reporter,
      purok: r.purok,
      escalatedAt: r.escalatedAt ?? r.reportedAt,
      handoffNote: r.handoffNote ?? "",
      label: r.outcome,
      suggestedPriority: r.suggestedPriority,
      status: r.status!,
      deskOfficer: r.deskOfficer ?? "Desk Officer",
      statusNote: r.statusNote ?? "",
      statusUpdatedAt: r.statusUpdatedAt,
      adjustedPriority: r.adjustedPriority,
      tanodUnit: r.tanodUnit,
      blottedId: r.blottedId,
      infoRequest: r.infoRequest,
      hasUpdate: r.hasUpdate,
    }));

  return (
    <PurokIncidentContext.Provider
      value={{
        reports,
        activeReports,
        closedLocalReports,
        escalatedCases,
        validateReport,
        requestClarification,
        closeLocally,
        escalate,
        updateCase,
        markUpdateSeen,
        markAllUpdatesSeen,
        isEscalated,
      }}
    >
      {children}
    </PurokIncidentContext.Provider>
  );
}

export function usePurokIncidents() {
  const ctx = useContext(PurokIncidentContext);
  if (!ctx) throw new Error("usePurokIncidents must be used within PurokIncidentsProvider");
  return ctx;
}
