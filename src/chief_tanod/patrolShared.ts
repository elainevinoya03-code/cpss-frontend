import { type Incident } from "../desk_officer/incidentStore";
import { PUROK_ZONES } from "../constants/purok";

/* --------------------------------------------------------------------- */
/* Types                                                                 */
/* --------------------------------------------------------------------- */

export type PlanType = "fixed" | "route";
export type PlanStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "revision_required"
  | "rejected";

export interface CpPoint {
  id: string;
  kind: "fixed" | "start" | "end" | "intermediate";
  label: string;
  name: string;
  address: string;
  landmark: string;
  description: string;
  remarks: string;
  lat: number;
  lng: number;
}

export interface CpRoute {
  id: string;
  label: string; // "Route 2", "Route 3", …
  title: string; // short descriptive name
  role: "support";
  color: string; // render color (hex)
  points: CpPoint[]; // intermediate waypoints only (A/B are shared plan-level points)
}

export interface RouteSuggestion {
  id: string;
  tag: "Shortest" | "Safest" | "Highest coverage";
  badge: string;
  detail: string;
  length: number;
  coverage: number;
  covered: number;
  exposed: number;
  waypoints: { lat: number; lng: number }[];
}

export interface DrawableRoute {
  id: string;
  label: string;
  color: string;
  points: CpPoint[];
}

export interface ScheduleForm {
  operationDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  recurring: "none" | "daily" | "specific_days";
  recurringDays: string[];
  expectedDuration: string;
}

export interface OperNotes {
  general: string;
  safety: string;
  equipment: string;
  coordination: string;
  special: string;
  other: string;
}

export interface CoverageResult {
  pct: number;
  covered: number;
  total: number;
}

export interface CheckpointPlan {
  id: string;
  code: string;
  name: string;
  type: PlanType;
  purpose: string;
  objective: string;
  rationale: string;
  targetArea: string;
  remarks: string;
  points: CpPoint[];
  routes?: CpRoute[]; // supporting routes (Route 2+); Route 1 = primary in `points`
  linkedIncidentIds: string[];
  schedule: ScheduleForm;
  notes: OperNotes;
  coverage: CoverageResult & { window: string };
  status: PlanStatus;
  submittedBy?: string;
  submittedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  revisionComment?: string;
  rejectionReason?: string;
  approvalComments?: string;
  createdAt: string;
}

export type MapMode =
  | "view"
  | "set_fixed"
  | "set_start"
  | "set_end"
  | "set_intermediate"
  | "set_custom";

export type LayerState = {
  boundaries: boolean;
  roads: boolean;
  incidents: boolean;
  hotspots: boolean;
  checkpoints: boolean;
  patrols: boolean;
};

export interface IncidentFilters {
  type: string;
  dateFrom: string;
  dateTo: string;
  tod: string;
  area: string;
  status: string;
  severity: string;
}

/* --------------------------------------------------------------------- */
/* Constants                                                             */
/* --------------------------------------------------------------------- */

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Draft", badge: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  pending_approval: { label: "Pending", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  approved: { label: "Approved / Finalized", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  revision_required: { label: "Revision Required", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-600", dot: "bg-rose-500" },
};

export const PURPOSES = [
  "Crime Prevention",
  "Traffic Control",
  "Special Operation",
  "Community Safety",
  "Emergency Response",
  "Other",
];

export const TYPE_LABEL: Record<PlanType, string> = {
  fixed: "Fixed Checkpoint",
  route: "Route-Based / Point-to-Point",
};

export const SEV_COLOR: Record<string, string> = {
  critical: "#e11d48",
  high: "#f97316",
  warning: "#f59e0b",
  low: "#38bdf8",
};

export const INC_STATUS_HEALTH: Record<string, { label: string; badge: string }> = {
  new: { label: "Open", badge: "bg-rose-50 text-rose-600" },
  acknowledged: { label: "Open", badge: "bg-amber-50 text-amber-600" },
  in_progress: { label: "Under Investigation", badge: "bg-sky-50 text-sky-600" },
  resolved: { label: "Resolved", badge: "bg-emerald-50 text-emerald-600" },
  closed_false_alarm: { label: "Resolved", badge: "bg-stone-100 text-stone-500" },
};

export const RECURRING_OPTIONS = [
  { key: "none", label: "One-time operation" },
  { key: "daily", label: "Daily" },
  { key: "specific_days", label: "Specific days" },
];

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TARGET_AREA_SUGGESTIONS = [
  ...PUROK_ZONES.map((z) => z.name),
  "Main Barangay Boundary",
  "Evacuation Zone Alpha",
];

export const EXISTING_CHECKPOINTS = [
  { id: "ECP-201", name: "Market North Gate", lat: 108, lng: 220, active: true },
  { id: "ECP-202", name: "Highway Junction", lat: 225, lng: 100, active: true },
  { id: "ECP-203", name: "Riverside Arc", lat: 160, lng: 330, active: false },
  { id: "ECP-204", name: "School District Gate", lat: 205, lng: 205, active: true },
];

export const ACTIVE_PATROLS = [
  { id: "PAT-1", name: "Purok 3–5 Sweep", pts: [{ x: 95, y: 185 }, { x: 150, y: 265 }, { x: 118, y: 330 }] },
  { id: "PAT-2", name: "Purok 1–2 Perimeter", pts: [{ x: 108, y: 55 }, { x: 225, y: 68 }, { x: 238, y: 150 }] },
];

export const LANDMARKS = [
  { name: "Barangay Hall", x: 112, y: 52, code: "H" },
  { name: "Chapel", x: 212, y: 205, code: "C" },
  { name: "Public Market", x: 104, y: 232, code: "M" },
  { name: "Jeep Terminal", x: 332, y: 218, code: "T" },
  { name: "River Bridge", x: 176, y: 318, code: "B" },
];

export const ALL_LAYERS: LayerState = {
  boundaries: true,
  roads: true,
  incidents: true,
  hotspots: true,
  checkpoints: true,
  patrols: true,
};

export const LAYER_LABELS: { key: keyof LayerState; label: string }[] = [
  { key: "boundaries", label: "Zones" },
  { key: "roads", label: "Roads" },
  { key: "incidents", label: "Incidents" },
  { key: "hotspots", label: "Hotspots" },
  { key: "checkpoints", label: "Checkpoints" },
  { key: "patrols", label: "Patrols" },
];

export const DEFAULT_FILTERS: IncidentFilters = {
  type: "all",
  dateFrom: "",
  dateTo: "",
  tod: "all",
  area: "all",
  status: "all",
  severity: "all",
};

let POINT_SEQ = 0;
export function nextPointId() {
  return `pt-${++POINT_SEQ}`;
}

/* --------------------------------------------------------------------- */
/* Seed plans                                                            */
/* --------------------------------------------------------------------- */

export const SEED_PLANS: CheckpointPlan[] = [
  {
    id: "CP-2026-118",
    code: "CP-118",
    name: "Public Market Night Interdiction",
    type: "fixed",
    purpose: "Crime Prevention",
    objective:
      "Deter theft and public-disturbance incidents around the market row during peak evening hours.",
    rationale:
      "Purok 3 logged five fire/public-disturbance alerts in the past month; two SOS triggers surfaced near the commercial strip.",
    targetArea: "Purok 3",
    remarks: "Requires PNP visibility alongside barangay tanods. High foot traffic on market days.",
    points: [
      {
        id: "sp-1",
        kind: "fixed",
        label: "FIXED",
        name: "Market North Gate",
        address: "Market Row, Purok 3",
        landmark: "Public Market North Entrance",
        description: "Fixed post at the north gate",
        remarks: "Night shift staffed; log all stops on BLOTTER-1.",
        lat: 108,
        lng: 220,
      },
    ],
    linkedIncidentIds: ["INC-2071", "INC-2072", "INC-2070"],
    schedule: {
      operationDate: "2026-09-20",
      endDate: "2026-09-27",
      startTime: "18:00",
      endTime: "23:00",
      recurring: "specific_days",
      recurringDays: ["Fri", "Sat", "Sun"],
      expectedDuration: "5 hours per night",
    },
    notes: {
      general: "Full tanod uniform with reflective vest. Briefing 30 min before start.",
      safety: "Keep line of sight on adjacent alleys. Watch for vehicles speeding off.",
      equipment: "Two search lights, traffic cones, log sheet, two handheld radios.",
      coordination: "Coordinate with Purok 3 leader and PNP substation.",
      special: "High-visibility only; no aggressive stops outside SOP.",
      other: "Radios on channel 2; market vendors informed by the morning.",
    },
    coverage: { pct: 63, covered: 5, total: 8, window: "Last 30 days" },
    status: "approved",
    submittedBy: "C. Santos",
    submittedAt: "2026-09-10T09:12:00",
    decidedBy: "Punong Barangay",
    decidedAt: "2026-09-11T14:05:00",
    approvalComments: undefined,
    createdAt: "2026-09-10T08:55:00",
  },
  {
    id: "CP-2026-119",
    code: "CP-119",
    name: "Riverside ↔ Terminal Through-route",
    type: "route",
    purpose: "Traffic Control",
    objective:
      "Run a mobile checkpoint sweep across the terminal corridor to cut down traffic-related incidents and nuisance complaints.",
    rationale:
      "Terminal and riverside areas concentrate recurring noise and disturbance reports; a moving post covers both in one duty window.",
    targetArea: "Purok 5",
    remarks: "Accompany with PNP. Suspend during market-day rush.",
    points: [
      {
        id: "sp-2",
        kind: "start",
        label: "A",
        name: "Point A — Riverside Arc",
        address: "Riverside Road",
        landmark: "River Bridge",
        description: "Start sweep at the riverside concourse",
        remarks: "Assemble team here",
        lat: 130,
        lng: 312,
      },
      { id: "sp-3", kind: "intermediate", label: "CP1", name: "Checkpoint 1 — Chapel Crossing", address: "Purok Crossing", landmark: "Chapel", description: "Primary traffic stop point", remarks: "", lat: 148, lng: 248 },
      { id: "sp-4", kind: "intermediate", label: "CP2", name: "Checkpoint 2 — Market Row", address: "Market Road", landmark: "Public Market", description: "Secondary stop point", remarks: "", lat: 118, lng: 222 },
      {
        id: "sp-5",
        kind: "end",
        label: "B",
        name: "Point B — Terminal",
        address: "Terminal Road",
        landmark: "Jeepney Terminal",
        description: "Sweep ends at the terminal",
        remarks: "Debrief here after sweep",
        lat: 312,
        lng: 218,
      },
    ],
    routes: [
      {
        id: "r-seed-1",
        label: "Route 2",
        title: "Safest suggestion",
        role: "support",
        color: "#0d9488",
        points: [
          { id: "sr-1", kind: "intermediate", label: "CP1", name: "CP — Chapel Service Road", address: "Chapel Lane", landmark: "Chapel", description: "Detour via chapel side road", remarks: "", lat: 205, lng: 250 },
          { id: "sr-2", kind: "intermediate", label: "CP2", name: "CP — East Purok Crossing", address: "Purok Crossing", landmark: "", description: "Secondary coverage point", remarks: "", lat: 252, lng: 232 },
        ],
      },
    ],
    linkedIncidentIds: ["INC-2069", "INC-2067"],
    schedule: {
      operationDate: "2026-09-22",
      endDate: "2026-09-22",
      startTime: "17:00",
      endTime: "21:00",
      recurring: "none",
      recurringDays: [],
      expectedDuration: "4 hours",
    },
    notes: {
      general: "Sweep speed kept below 20 kph. All stops logged.",
      safety: "Use cones at each stop point before dismounting.",
      equipment: "Mobile lights, cones, radios, GO-BAGS.",
      coordination: "Desk Officer informed of live position for the duration.",
      special: "Terminal guard to hold traffic at Point B on approach.",
      other: "",
    },
    coverage: { pct: 71, covered: 5, total: 7, window: "Last 30 days" },
    status: "pending_approval",
    submittedBy: "C. Santos",
    submittedAt: "2026-09-12T10:40:00",
    createdAt: "2026-09-12T10:10:00",
  },
  {
    id: "CP-2026-116",
    code: "CP-116",
    name: "School District Morning Watch",
    type: "fixed",
    purpose: "Community Safety",
    objective: "Standby post near the school district during drop-off hours.",
    rationale: "Reports of hazards and disturbances near school pickup lanes.",
    targetArea: "Purok 4",
    remarks: "",
    points: [
      { id: "sp-6", kind: "fixed", label: "FIXED", name: "School Gate Post", address: "School District, Purok 4", landmark: "Playground", description: "", remarks: "", lat: 205, lng: 205 },
    ],
    linkedIncidentIds: [],
    schedule: {
      operationDate: "2026-09-25",
      endDate: "2026-09-25",
      startTime: "06:00",
      endTime: "08:00",
      recurring: "daily",
      recurringDays: [],
      expectedDuration: "2 hours",
    },
    notes: {
      general: "",
      safety: "Direct traffic during drop-off; keep gates clear.",
      equipment: "Vest, whistle, cones.",
      coordination: "School guard on site.",
      special: "",
      other: "",
    },
    coverage: { pct: 25, covered: 1, total: 4, window: "Last 30 days" },
    status: "revision_required",
    submittedBy: "C. Santos",
    submittedAt: "2026-09-11T09:05:00",
    decidedBy: "Punong Barangay",
    decidedAt: "2026-09-12T16:20:00",
    revisionComment: "Extend the operating window through afternoon dismissal and add a second post at the playground exit.",
    createdAt: "2026-09-11T08:40:00",
  },
  {
    id: "CP-2026-113",
    code: "CP-113",
    name: "Purok 1 Riverside Flood Lane",
    type: "route",
    purpose: "Emergency Response",
    objective: "Route checkpoint sweep along the low-lying flood lane.",
    rationale: "Repeated hazard reports in the flood-prone corridor.",
    targetArea: "Purok 1",
    remarks: "",
    points: [
      { id: "sp-7", kind: "start", label: "A", name: "Point A", address: "", landmark: "", description: "", remarks: "", lat: 96, lng: 70 },
      { id: "sp-8", kind: "end", label: "B", name: "Point B", address: "", landmark: "", description: "", remarks: "", lat: 250, lng: 80 },
    ],
    linkedIncidentIds: [],
    schedule: {
      operationDate: "2026-09-08",
      endDate: "2026-09-08",
      startTime: "10:00",
      endTime: "12:00",
      recurring: "none",
      recurringDays: [],
      expectedDuration: "2 hours",
    },
    notes: { general: "", safety: "", equipment: "", coordination: "", special: "", other: "" },
    coverage: { pct: 30, covered: 1, total: 4, window: "Last 30 days" },
    status: "rejected",
    submittedBy: "C. Santos",
    submittedAt: "2026-09-05T11:30:00",
    decidedBy: "Punong Barangay",
    decidedAt: "2026-09-06T09:50:00",
    rejectionReason: "Route overlaps the approved Highway Junction post. Consolidate with the existing checkpoint instead of running a parallel route.",
    createdAt: "2026-09-05T10:55:00",
  },
  {
    id: "CP-2026-112",
    code: "CP-112",
    name: "Evening Plaza Visibility Post",
    type: "fixed",
    purpose: "Crime Prevention",
    objective: "Deter loitering and noise complaints at the plaza.",
    rationale: "Recurring evening noise disturbance reports in Purok 2.",
    targetArea: "Purok 2",
    remarks: "Pending personnel availability check.",
    points: [
      { id: "sp-9", kind: "fixed", label: "FIXED", name: "Plaza Post", address: "Plaza Avenue, Purok 2", landmark: "Barangay Plaza", description: "", remarks: "", lat: 225, lng: 138 },
    ],
    linkedIncidentIds: ["INC-2064"],
    schedule: {
      operationDate: "2026-09-30",
      endDate: "2026-09-30",
      startTime: "19:00",
      endTime: "22:00",
      recurring: "none",
      recurringDays: [],
      expectedDuration: "3 hours",
    },
    notes: { general: "", safety: "", equipment: "", coordination: "", special: "", other: "" },
    coverage: { pct: 38, covered: 3, total: 8, window: "All incidents" },
    status: "draft",
    submittedBy: "C. Santos",
    createdAt: "2026-09-13T08:20:00",
  },
];

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

export function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

/* --------------------------------------------------------------------- */
/* Road network & snapping                                               */
/* --------------------------------------------------------------------- */

export const ROAD_SEGMENTS: { ax: number; ay: number; bx: number; by: number }[] = [
  { ax: 0, ay: 118, bx: 440, by: 118 },
  { ax: 0, ay: 205, bx: 440, by: 205 },
  { ax: 0, ay: 300, bx: 440, by: 300 },
  { ax: 110, ay: 0, bx: 110, by: 400 },
  { ax: 228, ay: 0, bx: 228, by: 400 },
  { ax: 330, ay: 0, bx: 330, by: 400 },
  { ax: 40, ay: 40, bx: 400, by: 335 },
];

export function nearestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { lat: ax + t * dx, lng: ay + t * dy };
}

export function snapToRoad(lat: number, lng: number) {
  let best: { lat: number; lng: number } | null = null;
  let bestD = Infinity;
  for (const s of ROAD_SEGMENTS) {
    const p = nearestOnSegment(lat, lng, s.ax, s.ay, s.bx, s.by);
    const d = dist(lat, lng, p.lat, p.lng);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best
    ? { lat: Math.round(best.lat), lng: Math.round(best.lng), snapped: bestD }
    : { lat: Math.round(lat), lng: Math.round(lng), snapped: 0 };
}

export function coverageOf(points: CpPoint[], incidents: Incident[], threshold = 42): CoverageResult {
  const total = incidents.length;
  if (total === 0) return { pct: 0, covered: 0, total: 0 };
  if (points.length === 0) return { pct: 0, covered: 0, total };
  let covered = 0;
  for (const inc of incidents) {
    const nearPoint = points.some((p) => dist(p.lat, p.lng, inc.lat, inc.lng) <= threshold);
    let nearSeg = false;
    for (let i = 0; i + 1 < points.length; i += 1) {
      if (
        segDist(inc.lat, inc.lng, points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng) <=
        threshold
      ) {
        nearSeg = true;
        break;
      }
    }
    if (nearPoint || nearSeg) covered += 1;
  }
  return { pct: Math.round((covered / total) * 100), covered, total };
}

export function hourBucket(iso: string) {
  const h = new Date(iso).getHours();
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export const BUCKET_LABEL: Record<string, string> = {
  morning: "Morning (6a–12n)",
  afternoon: "Afternoon (12n–5p)",
  evening: "Evening (5p–9p)",
  night: "Night (9p–6a)",
};

export function weekdayShort(iso: string) {
  return DAY_LABELS[new Date(iso).getDay()];
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function pathBounds(d: string) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function sortRoutePoints(points: CpPoint[]) {
  const order: Record<string, number> = { start: 0, intermediate: 1, end: 2 };
  return [...points].sort((a, b) => order[a.kind] - order[b.kind]);
}

export function nextPlanIdentity(plans: CheckpointPlan[]) {
  let max = 119;
  for (const p of plans) {
    const m = /CP-2026-(\d+)/.exec(p.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const next = max + 1;
  return { id: `CP-2026-${next}`, code: `CP-${String(next).padStart(3, "0")}` };
}

export function emptyPlan(type: PlanType): CheckpointPlan {
  return {
    id: "",
    code: "",
    name: "",
    type,
    purpose: "",
    objective: "",
    rationale: "",
    targetArea: "",
    remarks: "",
    points: [],
    routes: [],
    linkedIncidentIds: [],
    schedule: {
      operationDate: "",
      endDate: "",
      startTime: "18:00",
      endTime: "22:00",
      recurring: "none",
      recurringDays: [],
      expectedDuration: "",
    },
    notes: {
      general: "",
      safety: "",
      equipment: "",
      coordination: "",
      special: "",
      other: "",
    },
    coverage: { pct: 0, covered: 0, total: 0, window: "All incidents (current filter)" },
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

export const SUGGESTION_BADGES: Record<RouteSuggestion["tag"], string> = {
  Shortest: "bg-sky-50 text-sky-700",
  Safest: "bg-emerald-50 text-emerald-700",
  "Highest coverage": "bg-rose-50 text-rose-700",
};

export const ROUTE_COLORS = ["#0d9488", "#d97706", "#0ea5e9"];

let ROUTE_SEQ = 0;
export function nextRouteId() {
  return `rt-${++ROUTE_SEQ}`;
}

export function relabelIntermediates(series: CpPoint[]) {
  let k = 0;
  return series.map((p) => (p.kind === "intermediate" ? { ...p, label: `CP${++k}` } : p));
}

export function corridorLength(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[]
) {
  const pts = [a, ...waypoints, b];
  let L = 0;
  for (let i = 0; i + 1 < pts.length; i += 1) L += dist(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
  return L;
}

export function corridorExposure(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[],
  incidents: Incident[],
  threshold = 40
) {
  const pts = [a, ...waypoints, b];
  const sev: Record<string, number> = { critical: 4, high: 3, warning: 2, low: 1 };
  let exposure = 0;
  for (const inc of incidents) {
    let near = false;
    for (let i = 0; i + 1 < pts.length; i += 1) {
      if (segDist(inc.lat, inc.lng, pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng) <= threshold) {
        near = true;
        break;
      }
    }
    if (near) exposure += sev[inc.severity] ?? 1;
  }
  return exposure;
}

function diagPoint(p: { lat: number; lng: number }) {
  const ax = 40;
  const ay = 40;
  const dx = 360;
  const dy = 295;
  const t = ((p.lat - ax) * dx + (p.lng - ay) * dy) / (dx * dx + dy * dy);
  const q = Math.max(0, Math.min(1, t));
  return { lat: ax + q * dx, lng: ay + q * dy };
}

export function suggestRoutes(plan: CheckpointPlan, incidents: Incident[]): RouteSuggestion[] {
  const start = plan.points.find((p) => p.kind === "start");
  const end = plan.points.find((p) => p.kind === "end");
  if (!start || !end) return [];
  const A = { lat: start.lat, lng: start.lng };
  const B = { lat: end.lat, lng: end.lng };

  const candidates: { key: string; waypoints: { lat: number; lng: number }[] }[] = [];
  const add = (name: string, ws: { lat: number; lng: number }[]) => {
    const filtered = ws.filter((w) => dist(w.lat, w.lng, A.lat, A.lng) > 6 && dist(w.lat, w.lng, B.lat, B.lng) > 6);
    candidates.push({ key: `${name}::${filtered.map((w) => `${Math.round(w.lat)},${Math.round(w.lng)}`).join("|")}`, waypoints: filtered });
  };

  add("Direct", []);
  for (const y of [118, 205, 300]) add(`Via Y-${y}`, [{ lat: A.lat, lng: y }, { lat: B.lat, lng: y }]);
  for (const x of [110, 228, 330]) add(`Via X-${x}`, [{ lat: x, lng: A.lng }, { lat: x, lng: B.lng }]);
  const dA = diagPoint(A);
  const dB = diagPoint(B);
  add("Diagonal", [dA, dB]);

  const scored = candidates.map((c) => {
      const allPts: CpPoint[] = [
        { id: "s-start", kind: "start", label: "A", name: "A", address: "", landmark: "", description: "", remarks: "", lat: A.lat, lng: A.lng },
        ...c.waypoints.map((w, i) => ({
          id: `s-${i}`,
          kind: "intermediate" as const,
          label: `CP${i + 1}`,
          name: `Waypoint ${i + 1}`,
          address: "",
          landmark: "",
          description: "",
          remarks: "",
          lat: Math.round(w.lat),
          lng: Math.round(w.lng),
        })),
        { id: "s-end", kind: "end", label: "B", name: "B", address: "", landmark: "", description: "", remarks: "", lat: B.lat, lng: B.lng },
      ];
      const cov = coverageOf(allPts, incidents);
      return {
        key: c.key,
        waypoints: c.waypoints,
        length: corridorLength(A, B, c.waypoints),
        exposure: corridorExposure(A, B, c.waypoints, incidents),
        coverage: cov.pct,
        covered: cov.covered,
      };
    });

  const byLen = [...scored].sort((a, b) => a.length - b.length);
  const bySafe = [...scored].sort((a, b) => a.exposure - b.exposure);
  const byCov = [...scored].sort((a, b) => b.coverage - a.coverage || b.covered - a.covered);

  const used = new Set<string>();
  const take = (arr: typeof scored, tag: RouteSuggestion["tag"]): RouteSuggestion => {
    let s = arr.find((x) => !used.has(x.key));
    if (!s) {
      s = arr[0];
      used.clear();
    }
    used.add(s.key);
    const exp = s.exposure;
    return {
      id: `rsc-${tag.toLowerCase().replace(/\s+/g, "-")}`,
      tag,
      badge: SUGGESTION_BADGES[tag],
      detail: `~${Math.round(s.length)} units · covers ${s.covered} incident${s.covered === 1 ? "" : "s"} (${s.coverage}%) in the current window`,
      length: s.length,
      coverage: s.coverage,
      covered: s.covered,
      exposed: exp,
      waypoints: s.waypoints,
    };
  };

  const out: RouteSuggestion[] = [];
  out.push(take(byLen, "Shortest"));
  if (scored.length > 1) out.push(take(bySafe, "Safest"));
  if (scored.length > 2) out.push(take(byCov, "Highest coverage"));
  return out;
}

export function planPolylines(plan: CheckpointPlan): DrawableRoute[] {
  const lines: DrawableRoute[] = [];
  if (plan.type === "route") {
    const primary = sortRoutePoints(plan.points);
    if (primary.length >= 2) lines.push({ id: "primary", label: "Route 1", color: "#7c3aed", points: primary });
    const start = primary.find((p) => p.kind === "start");
    const end = primary.find((p) => p.kind === "end");
    (plan.routes ?? []).forEach((r, i) => {
      if (start && end) {
        lines.push({ id: r.id, label: r.label, color: r.color ?? ROUTE_COLORS[i % ROUTE_COLORS.length], points: [start, ...r.points, end] });
      }
    });
  }
  return lines;
}

export function planMarkers(plan: CheckpointPlan): CpPoint[] {
  if (plan.type === "fixed") return plan.points;
  return [...plan.points, ...(plan.routes ?? []).flatMap((r) => r.points)];
}

export function windowDesc(f: IncidentFilters) {
  if (f.dateFrom && f.dateTo) return `${f.dateFrom} → ${f.dateTo}`;
  if (f.dateFrom) return `From ${f.dateFrom}`;
  if (f.dateTo) return `Until ${f.dateTo}`;
  return "Current filter window";
}

export function validateStep(step: number, d: CheckpointPlan): string[] {
  const errs: string[] = [];
  if (step === 1) {
    if (!d.name.trim()) errs.push("Checkpoint name is required.");
    if (!d.purpose.trim()) errs.push("Purpose is required.");
    if (!d.objective.trim()) errs.push("Objective is required.");
    if (!d.targetArea.trim()) errs.push("Target area / zone is required.");
  }
  if (step === 2) {
    if (d.points.length === 0) errs.push("Set at least one location on the map.");
    if (d.type === "route") {
      if (!d.points.some((p) => p.kind === "start")) errs.push("Set Point A (starting point).");
      if (!d.points.some((p) => p.kind === "end")) errs.push("Set Point B (end point).");
    }
  }
  if (step === 4) {
    if (!d.schedule.operationDate) errs.push("Operation date is required.");
    if (!d.schedule.startTime || !d.schedule.endTime) errs.push("Start and end times are required.");
    else if (
      d.schedule.endTime <= d.schedule.startTime &&
      (!d.schedule.endDate || d.schedule.endDate === d.schedule.operationDate)
    ) {
      errs.push("End time must be after start time on the same day.");
    }
    if (d.schedule.recurring === "specific_days" && d.schedule.recurringDays.length === 0) {
      errs.push("Pick at least one recurring day.");
    }
  }
  if (step === 6) {
    errs.push(...validateStep(1, d), ...validateStep(2, d), ...validateStep(4, d));
    const hasBasis = d.rationale.trim().length > 0 || d.linkedIncidentIds.length > 0 || d.remarks.trim().length > 0;
    if (!hasBasis) errs.push("Add at least one basis (rationale, linked incident, or justification).");
  }
  return errs;
}