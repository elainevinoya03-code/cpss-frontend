import { type Incident } from "../desk_officer/incidentStore";
import {
  type PlanType,
  type PlanStatus,
  type CpPoint,
  type CpRoute,
} from "./patrolConfigurationApi";

/* --------------------------------------------------------------------- */
/* Types                                                                 */
/* --------------------------------------------------------------------- */

// Re-export types from API for consistency
export type { PlanType, PlanStatus, CpPoint, CpRoute };

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
  id?: number | null;
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
  digitalBoundaries: boolean;
  hotspots: boolean;
  incidents: boolean;
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

export const TARGET_AREA_SUGGESTIONS: string[] = [];

export const EXISTING_CHECKPOINTS: any[] = [];

export const ACTIVE_PATROLS: any[] = [];

export type ExistingCheckpoint = (typeof EXISTING_CHECKPOINTS)[number];
export type ActivePatrol = (typeof ACTIVE_PATROLS)[number];

export const LANDMARKS: any[] = [];

export const ALL_LAYERS: LayerState = {
  digitalBoundaries: true,
  hotspots: true,
  incidents: true,
  checkpoints: true,
  patrols: true,
};

export const LAYER_LABELS: { key: keyof LayerState; label: string }[] = [
  { key: "digitalBoundaries", label: "Digital Boundaries" },
  { key: "hotspots", label: "Hotspots" },
  { key: "incidents", label: "Incidents" },
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
export function nextPointId(used: Iterable<string> = []) {
  for (const id of used) {
    const m = /^pt-(\d+)$/.exec(id);
    if (m) POINT_SEQ = Math.max(POINT_SEQ, Number(m[1]));
  }
  return `pt-${++POINT_SEQ}`;
}

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

export const ROAD_SEGMENTS: { ax: number; ay: number; bx: number; by: number }[] = [];

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
    ? { lat: best.lat, lng: best.lng, snapped: bestD }
    : { lat, lng, snapped: 0 };
}

/* --------------------------------------------------------------------- */
/* Auto address from map location                                        */
/* --------------------------------------------------------------------- */

export function parseZonePolygon(path: string): { x: number; y: number }[] {
  const pairs = path.match(/[\d.]+,[\d.]+/g) ?? [];
  return pairs.map((pt) => {
    const [x, y] = pt.split(",").map(Number);
    return { x, y };
  });
}

function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Purok zone name containing SVG point (x = lat, y = lng), or null if outside. */
export function zoneAtPoint(x: number, y: number, boundaries: any[] = []): string | null {
  for (const b of boundaries) {
    if (!b.nodes || b.nodes.length < 3) continue;
    const poly = b.nodes.map((n: any) => ({ x: n.x, y: n.y }));
    if (pointInPolygon(x, y, poly)) return b.name;
  }
  return null;
}

/** Auto-generated address for a snapped map point. Stays editable in the form. */
export function autoAddressForPoint(x: number, y: number, boundaries: any[] = []): string {
  const zone = zoneAtPoint(x, y, boundaries);
  return zone ? `${zone}, Tandang Sora, Quezon City` : "Tandang Sora, Quezon City";
}

/* --------------------------------------------------------------------- */
/* True street address via reverse geocoding (OpenStreetMap Nominatim)   */
/* --------------------------------------------------------------------- */

const reverseCache = new Map<string, string | null>();

function formatTrueAddress(data: any): string | null {
  const a = data?.address ?? {};
  const street = [a.house_number, a.road || a.street || a.footway || a.path]
    .filter(Boolean)
    .join(" ");
  const place = a.amenity || a.building || a.shop || a.office || a.leisure;
  const area =
    a.neighbourhood || a.subdivision || a.suburb || a.village || a.hamlet || a.quarter;
  const city = a.city || a.town || a.municipality || a.city_district || a.county;
  const parts = [
    street || place || null,
    area || null,
    city && city !== area ? city : null,
    a.postcode || null,
  ].filter(Boolean) as string[];
  const out = parts.join(", ");
  if (out) return out;
  // Fallback: first segments of the full display name
  const display: string | undefined = data?.display_name;
  return display ? display.split(", ").slice(0, 4).join(", ") : null;
}

/**
 * Resolve the true street address for a real GPS coordinate.
 * Results are cached per location. Returns null on failure so callers
 * can keep the instant purok-based fallback address.
 */
export async function reverseGeocode(gpsLat: number, gpsLng: number): Promise<string | null> {
  const key = `${gpsLat.toFixed(5)},${gpsLng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(gpsLat)}&lon=${encodeURIComponent(gpsLng)}` +
      `&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = formatTrueAddress(data);
    reverseCache.set(key, addr);
    return addr;
  } catch {
    return null;
  }
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

/**
 * Resolve a free-text address to a GPS coordinate via OpenStreetMap Nominatim.
 * Results are cached per query. Returns null when nothing could be resolved
 * so callers can leave the point untouched.
 */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
      `&q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const lat = hit ? Number(hit.lat) : Number.NaN;
    const lng = hit ? Number(hit.lon) : Number.NaN;
    const out = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    geocodeCache.set(key, out);
    return out;
  } catch {
    return null;
  }
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
export function nextRouteId(used: Iterable<string> = []) {
  for (const id of used) {
    const m = /^rt-(\d+)$/.exec(id);
    if (m) ROUTE_SEQ = Math.max(ROUTE_SEQ, Number(m[1]));
  }
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

/* ---------------- Operational schedule validation ---------------- */

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateOnly(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    return null;
  }
  return d;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysStr(dateStr: string, n: number): string {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Whole calendar days from a to b (b − a). Null when either side is invalid. */
export function diffCalendarDays(a: string, b: string): number | null {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function weekdayOf(dateStr: string): string | null {
  const d = parseDateOnly(dateStr);
  return d ? DAY_LABELS[d.getDay()] : null;
}

/** Effective end date: explicit endDate, or operationDate when blank (single-day). */
export function effectiveEndDate(s: ScheduleForm): string {
  return s.endDate?.trim() ? s.endDate.trim() : s.operationDate;
}

export function isMultiDaySchedule(s: ScheduleForm): boolean {
  if (!s.operationDate) return false;
  const diff = diffCalendarDays(s.operationDate, effectiveEndDate(s));
  return diff !== null && diff > 0;
}

/** Ordered unique weekday labels (Sun→Sat) actually covered by the date range. */
export function weekdaysInRange(start: string, end: string): string[] {
  const diff = diffCalendarDays(start, end);
  if (diff === null || diff < 0) return [];
  const seen = new Set<string>();
  for (let i = 0; i <= Math.min(diff, 366); i += 1) {
    const w = weekdayOf(addDaysStr(start, i));
    if (w) seen.add(w);
  }
  return DAY_LABELS.filter((d) => seen.has(d));
}

export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((t || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** True when the daily window crosses midnight (end earlier than start = next-day end). */
export function isOvernightWindow(s: ScheduleForm): boolean {
  const a = timeToMinutes(s.startTime);
  const b = timeToMinutes(s.endTime);
  return a !== null && b !== null && b < a;
}

/** Length of the daily time window in minutes. 0 when equal (zero-length), null when invalid. */
export function dailyWindowMinutes(s: ScheduleForm): number | null {
  const a = timeToMinutes(s.startTime);
  const b = timeToMinutes(s.endTime);
  if (a === null || b === null) return null;
  if (b === a) return 0;
  return b > a ? b - a : 24 * 60 - a + b;
}

/** Concrete occurrence dates for the schedule — each inside the date range. */
export function scheduleOccurrences(s: ScheduleForm): string[] {
  if (!s.operationDate) return [];
  const end = effectiveEndDate(s);
  const diff = diffCalendarDays(s.operationDate, end);
  if (diff === null || diff < 0) return [];
  const total = Math.min(diff, 366);
  if (s.recurring === "daily") {
    const out: string[] = [];
    for (let i = 0; i <= total; i += 1) out.push(addDaysStr(s.operationDate, i));
    return out;
  }
  if (s.recurring === "specific_days") {
    if (s.recurringDays.length === 0) return [];
    const want = new Set(s.recurringDays);
    const out: string[] = [];
    for (let i = 0; i <= total; i += 1) {
      const ds = addDaysStr(s.operationDate, i);
      const w = weekdayOf(ds);
      if (w && want.has(w)) out.push(ds);
    }
    return out;
  }
  // One-time: the operation date itself.
  return [s.operationDate];
}

/** Full schedule validation with specific, actionable messages. */
export function validateSchedule(s: ScheduleForm): string[] {
  const errs: string[] = [];
  const today = todayStr();
  if (!s.operationDate) {
    errs.push("Operation date is required.");
    return errs;
  }
  if (s.operationDate < today) {
    errs.push(`Operation date ${s.operationDate} is in the past — pick today or a future date.`);
  }
  const end = effectiveEndDate(s);
  if (s.endDate?.trim() && s.endDate.trim() < s.operationDate) {
    errs.push(`End date ${s.endDate.trim()} is earlier than operation date ${s.operationDate}.`);
    return errs;
  }
  if (!s.startTime || !s.endTime) {
    errs.push("Start and end times are required.");
  } else {
    const a = timeToMinutes(s.startTime);
    const b = timeToMinutes(s.endTime);
    if (a === null || b === null) {
      errs.push("Start and end times must be valid times (HH:MM).");
    } else if (a === b) {
      errs.push(`Time range ${s.startTime}–${s.endTime} has zero length — set an end time different from the start time.`);
    }
  }
  const multi = isMultiDaySchedule(s);
  if (!multi) {
    if (s.recurring !== "none") {
      errs.push("Single-day operation — set Recurring to “One-time operation”.");
    }
    if (s.recurringDays.length > 0) {
      errs.push("Single-day operation — clear the selected recurring days.");
    }
  } else if (s.recurring === "specific_days") {
    if (s.recurringDays.length === 0) {
      errs.push("Pick at least one recurring day.");
    } else {
      const valid = new Set(weekdaysInRange(s.operationDate, end));
      const bad = s.recurringDays.filter((d) => !valid.has(d));
      if (bad.length > 0) {
        errs.push(
          `${bad.join(", ")} ${bad.length === 1 ? "does" : "do"} not occur between ${s.operationDate} and ${end} — remove ${bad.length === 1 ? "it" : "them"}.`
        );
      }
      if (scheduleOccurrences(s).length === 0) {
        errs.push("The selected days produce no occurrence inside the date range.");
      }
    }
  }
  return errs;
}

/** Normalize a schedule after its dates change: move an earlier end date up,
 *  collapse single-day ranges to one-time, and prune out-of-range recurring
 *  days. Returns the fixed schedule plus human-readable notes of what changed. */
export function revalidateScheduleDates(
  s: ScheduleForm,
  changed: "operationDate" | "endDate"
): { schedule: ScheduleForm; notes: string[] } {
  const notes: string[] = [];
  let next: ScheduleForm = { ...s, recurringDays: [...s.recurringDays] };
  if (changed === "operationDate" && next.endDate?.trim() && next.endDate.trim() < next.operationDate) {
    notes.push(`End date ${next.endDate.trim()} was earlier than the new operation date — it was moved to ${next.operationDate}.`);
    next = { ...next, endDate: next.operationDate };
  }
  const end = effectiveEndDate(next);
  if (!isMultiDaySchedule(next)) {
    if (next.recurring !== "none" || next.recurringDays.length > 0) {
      notes.push("Single-day range — recurring was reset to one-time operation.");
    }
    next = { ...next, recurring: "none", recurringDays: [] };
  } else if (next.recurring === "specific_days") {
    const valid = new Set(weekdaysInRange(next.operationDate, end));
    const removed = next.recurringDays.filter((d) => !valid.has(d));
    if (removed.length > 0) {
      notes.push(`${removed.join(", ")} no longer occur between ${next.operationDate} and ${end} — removed.`);
      next = { ...next, recurringDays: next.recurringDays.filter((d) => valid.has(d)) };
    }
  }
  return { schedule: next, notes };
}

export interface ScheduleConflict {
  planId: string;
  code: string;
  name: string;
  kind: "duplicate" | "overlap";
  detail: string;
}

function splitWindow(start: string, end: string): Array<[number, number]> {
  const ms = timeToMinutes(start);
  const me = timeToMinutes(end);
  if (ms === null || me === null || ms === me) return [];
  return me > ms ? [[ms, me]] : [[ms, 1440], [0, me]];
}

function timeWindowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const A = splitWindow(aStart, aEnd);
  const B = splitWindow(bStart, bEnd);
  if (A.length === 0 || B.length === 0) return false;
  return A.some(([a0, a1]) => B.some(([b0, b1]) => a0 < b1 && b0 < a1));
}

function dateRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Compare a draft schedule against already-saved plans (excluding itself).
 *  Same area + dates + times => duplicate (blocking); any other same-area
 *  overlap => overlap (warning). Planner schedules carry no team field, so
 *  conflicts are matched on checkpoint area + time window. */
export function findScheduleConflicts(draft: CheckpointPlan, plans: CheckpointPlan[]): ScheduleConflict[] {
  const out: ScheduleConflict[] = [];
  const ds = draft.schedule;
  if (!ds.operationDate || !ds.startTime || !ds.endTime) return out;
  const dEnd = effectiveEndDate(ds);
  if (diffCalendarDays(ds.operationDate, dEnd) === null) return out;
  const area = (draft.targetArea || "").trim().toLowerCase();
  if (!area) return out;
  for (const p of plans) {
    if (draft.id && p.id === draft.id) continue; // exclude self when editing
    const ps = p.schedule;
    if (!ps?.operationDate || !ps?.startTime || !ps?.endTime) continue;
    if ((p.targetArea || "").trim().toLowerCase() !== area) continue;
    const pEnd = ps.endDate?.trim() ? ps.endDate.trim() : ps.operationDate;
    if (!dateRangesOverlap(ds.operationDate, dEnd, ps.operationDate, pEnd)) continue;
    if (!timeWindowsOverlap(ds.startTime, ds.endTime, ps.startTime, ps.endTime)) continue;
    const sameDates = ds.operationDate === ps.operationDate && dEnd === pEnd;
    const sameTimes = ds.startTime === ps.startTime && ds.endTime === ps.endTime;
    if (sameDates && sameTimes) {
      out.push({
        planId: p.id,
        code: p.code,
        name: p.name,
        kind: "duplicate",
        detail: `${p.code} already covers ${draft.targetArea.trim()} on ${ds.operationDate}${dEnd !== ds.operationDate ? ` → ${dEnd}` : ""} at ${ds.startTime}–${ds.endTime}.`,
      });
    } else {
      out.push({
        planId: p.id,
        code: p.code,
        name: p.name,
        kind: "overlap",
        detail: `${p.code} (${ps.operationDate}${pEnd !== ps.operationDate ? ` → ${pEnd}` : ""} ${ps.startTime}–${ps.endTime}) overlaps this schedule.`,
      });
    }
  }
  return out;
}

export function validateStep(step: number, d: CheckpointPlan): string[] {
  const errs: string[] = [];
  if (step === 1) {
    if (!d.name.trim()) errs.push("Checkpoint name is required.");
    if (!d.purpose.trim()) errs.push("Purpose is required.");
    if (!d.objective.trim()) errs.push("Objective is required.");
    if (!d.targetArea.trim()) errs.push("Target area / zone is required.");
    if (!d.linkedIncidentIds || d.linkedIncidentIds.length === 0)
      errs.push("Reason / Basis is required — select at least one resolved incident.");
    else if (new Set(d.linkedIncidentIds).size !== d.linkedIncidentIds.length)
      errs.push("Reason / Basis contains a duplicate incident — each incident may only be selected once.");
  }
  if (step === 2) {
    if (d.points.length === 0) errs.push("Set at least one location on the map.");
    if (d.type === "route") {
      if (!d.points.some((p) => p.kind === "start")) errs.push("Set Point A (starting point).");
      if (!d.points.some((p) => p.kind === "end")) errs.push("Set Point B (end point).");
    }
  }
  if (step === 4) {
    errs.push(...validateSchedule(d.schedule));
  }
  if (step === 6) {
    errs.push(...validateStep(1, d), ...validateStep(2, d), ...validateStep(4, d));
    const hasBasis = d.linkedIncidentIds.length > 0 || d.rationale.trim().length > 0 || d.remarks.trim().length > 0;
    if (!hasBasis) errs.push("Add at least one basis (resolved incident, rationale, or justification).");
    else if (d.linkedIncidentIds.length === 0)
      errs.push("Reason / Basis must be resolved incidents — select at least one from the dropdown.");
  }
  return errs;
}