import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Pencil,
  Trash2,
  MapPin,
  Pentagon,
  MousePointer2,
  Save,
  Plus,
  Undo2,
  AlertTriangle,
  FileJson,
  Search,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
} from "lucide-react";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import {
  todayStr,
  clamp,
  crossProduct,
  onSegment,
  segmentsIntersect,
  pointInPolygon,
  MapControlButton,
  DetailRow,
  Metric,
} from "./_shared";

const UndoIcon = Undo2;
const DiscardIcon = RotateCcw;

// x = longitude (lng), y = latitude (lat) in WGS84 degrees
type Node = { x: number; y: number };
type Badge = "Primary" | "Sub-zone";
type Region = {
  id: string;
  name: string;
  badge: Badge;
  classification: string;
  status: "Active" | "Inactive";
  parentId?: string;
  created: string;
  edited: string;
  nodes: Node[];
  visible: boolean;
};

const TYPES: Badge[] = ["Primary", "Sub-zone"];
const STATUSES: Region["status"][] = ["Active", "Inactive"];

function parseCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseNode(n: any): Node | null {
  if (!n) return null;
  if (Array.isArray(n) && n.length >= 2) {
    const x = parseCoord(n[0]);
    const y = parseCoord(n[1]);
    return x != null && y != null ? { x, y } : null;
  }
  const x = parseCoord(n.x ?? n.lng ?? n.lon ?? n.longitude);
  const y = parseCoord(n.y ?? n.lat ?? n.latitude);
  return x != null && y != null ? { x, y } : null;
}

function parseNodes(raw: unknown): Node[] {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const nodes = data.map(parseNode).filter((n): n is Node => n != null);
  // Stored as {x: lat, y: lng} instead of lon/lat — Leaflet would plot off the map.
  const swapped = nodes.length > 0 && nodes.every((n) => Math.abs(n.y) > 90 && Math.abs(n.x) <= 90);
  return swapped ? nodes.map((n) => ({ x: n.y, y: n.x })) : nodes;
}

// ─── Persistence ───────────────────────────────────────────────────────────────

const REGIONS_STORAGE_KEY = "digital_boundaries_regions";

function loadRegions(): Region[] {
  try {
    const raw = localStorage.getItem(REGIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r) =>
          r &&
          typeof r.id === "string" &&
          typeof r.name === "string" &&
          (r.badge === "Primary" || r.badge === "Sub-zone")
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        badge: r.badge as Badge,
        classification: CLASSIFICATIONS.includes(r.classification) ? r.classification : "Standard",
        status: r.status === "Inactive" ? ("Inactive" as const) : ("Active" as const),
        parentId: typeof r.parentId === "string" ? r.parentId : undefined,
        created: typeof r.created === "string" && r.created ? r.created : todayStr(),
        edited: typeof r.edited === "string" && r.edited ? r.edited : todayStr(),
        nodes: parseNodes(r.nodes),
        visible: r.visible !== false,
      }));
  } catch {
    return [];
  }
}

function saveRegions(regions: Region[]) {
  try {
    localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(regions));
  } catch {
    // storage full or unavailable — keep working in memory
  }
}

// ─── Backend API (FastAPI + PostgreSQL — source of truth) ─────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "";

function alternateApiBase() {
  return API_BASE.includes("8080")
    ? API_BASE.replace("8080", "8000")
    : API_BASE.replace("8000", "8080");
}

async function boundaryFetch(path: string, options?: RequestInit) {
  const request = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, request);
    if (!res.ok) {
      try {
        const altRes = await fetch(`${alternateApiBase()}${path}`, request);
        if (altRes.ok) {
          res = altRes;
        }
      } catch {
        // Keep initial response if alternate fails
      }
    }
  } catch {
    res = await fetch(`${alternateApiBase()}${path}`, request);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ")
          : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

function fromApiRow(row: any): Region {
  return {
    id: String(row.id ?? ""),
    name: typeof row.name === "string" ? row.name : "Unnamed Boundary",
    badge: row.badge === "Primary" || row.badge === "Sub-zone" ? row.badge : "Sub-zone",
    classification: CLASSIFICATIONS.includes(row.classification) ? row.classification : "Standard",
    status: row.status === "Inactive" ? "Inactive" : "Active",
    parentId:
      typeof row.parent_id === "string" && row.parent_id
        ? row.parent_id
        : typeof row.parentId === "string" && row.parentId
          ? row.parentId
          : undefined,
    created: typeof row.created === "string" && row.created ? row.created : todayStr(),
    edited: typeof row.edited === "string" && row.edited ? row.edited : todayStr(),
    nodes: parseNodes(row.nodes),
    visible: row.visible !== false,
  };
}

function toCreatePayload(r: Region) {
  return {
    id: r.id,
    name: r.name,
    badge: r.badge,
    classification: r.classification,
    status: r.status,
    parent_id: r.parentId ?? null,
    created: r.created,
    edited: r.edited,
    nodes: r.nodes,
    visible: r.visible,
  };
}

function toUpdatePayload(r: Region) {
  return {
    name: r.name,
    badge: r.badge,
    classification: r.classification,
    status: r.status,
    parent_id: r.parentId ?? null,
    edited: r.edited,
    nodes: r.nodes,
    visible: r.visible,
  };
}

const errMsg = (e: unknown) => {
  if (e instanceof Error && e.message) return e.message;
  return "an unexpected error occurred";
};

// Shoelace formula on WGS84 lon/lat projected locally to planar meters -> hectares
function polygonArea(nodes: Node[]) {
  if (nodes.length < 3) return 0;
  const lat0 = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const mPerDegLat = 110_540;
  const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < nodes.length; i++) {
    const [x1, y1] = [nodes[i].x, nodes[i].y];
    const [x2, y2] = [nodes[(i + 1) % nodes.length].x, nodes[(i + 1) % nodes.length].y];
    sum += (x1 - x2) * mPerDegLng * ((y1 + y2) * mPerDegLat);
  }
  return Math.abs(sum) / 2 / 10000; // hectares
}

function toLatLngArray(nodes: Node[]): L.LatLngTuple[] {
  return nodes.map((n) => [n.y, n.x]);
}

function regionEqual(a: Region, b: Region) {
  if (!a || !b) return false;
  if (
    a.id !== b.id ||
    a.name !== b.name ||
    a.badge !== b.badge ||
    a.classification !== b.classification ||
    a.status !== b.status ||
    a.created !== b.created ||
    a.edited !== b.edited
  )
    return false;
  if ((a.parentId ?? "") !== (b.parentId ?? "")) return false;
  if ((a.nodes?.length ?? 0) !== (b.nodes?.length ?? 0)) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    if (a.nodes[i].x !== b.nodes[i].x || a.nodes[i].y !== b.nodes[i].y) return false;
  }
  return true;
}

const CLASSIFICATIONS = ["Standard", "Residential", "Market", "Evacuation / Emergency", "Hazard Zone"];
const FILTER_OPTIONS = ["All", "Primary", "Sub-zone", ...CLASSIFICATIONS];

function effectiveBadge(region: { badge: Badge; classification?: string }): string {
  if (region.classification === "Evacuation / Emergency" || region.classification === "Hazard Zone") return "Emergency";
  return region.badge;
}

const CLASSIFICATION_BADGES: Record<string, string> = {
  Standard: "bg-stone-100 text-stone-600",
  Residential: "bg-green-100 text-green-700",
  Market: "bg-amber-100 text-amber-700",
  "Evacuation / Emergency": "bg-red-100 text-red-700",
  "Hazard Zone": "bg-orange-100 text-orange-700",
};

const BADGE_STYLES: Record<string, string> = {
  Primary: "bg-rose-100 text-rose-700",
  "Sub-zone": "bg-sky-100 text-sky-700",
  Emergency: "bg-rose-100 text-rose-600",
};

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-stone-100 text-stone-500",
};

const STROKE_BY_BADGE: Record<string, string> = {
  Primary: "#9f1239",
  "Sub-zone": "#0369a1",
  Emergency: "#b91c1c",
};

const MAP_CENTER: [number, number] = [14.6681, 121.0567]; // 467 Tandang Sora Ave, Quezon City, 1128 Metro Manila (PH)
const MAP_ZOOM = 15;

function makeNodeIcon(color: string, edit: boolean, draw: boolean = false) {
  const size = draw ? 32 : 26;
  const borderWidth = draw ? 3 : 2.5;
  const centerSize = draw ? 8 : 6;
  const animation = draw ? 'animation: pulse 1.5s infinite;' : '';
  const showX = edit || draw;
  
  return L.divIcon({
    className: "",
    html: `<style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>
    <div style="position:relative;width:${size}px;height:${size}px;${animation}">
      <span style="position:absolute;inset:0;border-radius:50%;background:#fff;border:${borderWidth}px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,.35);"></span>
      ${showX ? `
        <span style="position:absolute;left:${(size - centerSize) / 2}px;top:${(size - centerSize) / 2}px;width:${centerSize}px;height:${centerSize}px;border-radius:50%;background:#b91c1c;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${centerSize * 0.8}px;font-weight:700;line-height:1;">×</span>
      ` : `
        <span style="position:absolute;left:${(size - centerSize) / 2}px;top:${(size - centerSize) / 2}px;width:${centerSize}px;height:${centerSize}px;border-radius:50%;background:${color};"></span>
      `}
      ${edit ? `<span class="db-node-x" style="position:absolute;right:-4px;top:-6px;width:15px;height:15px;line-height:13px;text-align:center;font-size:11px;font-weight:700;color:#fff;background:#b91c1c;border-radius:50%;border:1.5px solid #fff;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.3);">×</span>` : ""}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}



function hasSelfIntersection(nodes: Node[]) {
  if (nodes.length < 4) return false;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    for (let j = i + 2; j < nodes.length; j++) {
      if (i === 0 && j === nodes.length - 1) continue;
      const c = nodes[j];
      const d = nodes[(j + 1) % nodes.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function isContainedIn(region: { nodes: Node[] }, parentNodes: Node[]) {
  if (!parentNodes || parentNodes.length < 3) return true;
  return region.nodes.every((n) => pointInPolygon(n, parentNodes));
}

// --- Overlap detection (strict: shared borders / touching vertices are not overlaps) ---

function properIntersection(a: Node, b: Node, c: Node, d: Node) {
  const o1 = crossProduct(a, b, c);
  const o2 = crossProduct(a, b, d);
  const o3 = crossProduct(c, d, a);
  const o4 = crossProduct(c, d, b);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function distToSegmentSq(p: Node, a: Node, b: Node) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return (p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2;
}

function onBoundary(p: Node, nodes: Node[]) {
  for (let i = 0; i < nodes.length; i++) {
    if (distToSegmentSq(p, nodes[i], nodes[(i + 1) % nodes.length]) < 1e-6) return true;
  }
  return false;
}

function strictlyInside(p: Node, nodes: Node[]) {
  return pointInPolygon(p, nodes) && !onBoundary(p, nodes);
}

function polygonCentroid(nodes: Node[]) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i], b = nodes[(i + 1) % nodes.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (area === 0) return nodes[0] ?? { x: 0, y: 0 };
  area /= 2;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function polygonsOverlap(a: Node[], b: Node[]) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (properIntersection(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  for (const p of a) if (strictlyInside(p, b)) return true;
  for (const p of b) if (strictlyInside(p, a)) return true;
  if (strictlyInside(polygonCentroid(a), b)) return true;
  if (strictlyInside(polygonCentroid(b), a)) return true;
  return false;
}

// GeoJSON support: extract polygon rings (outer ring per polygon) from a GeoJSON object
function extractGeoJsonPolygons(geo: any): { coords: [number, number][]; properties: Record<string, any> }[] {
  const out: { coords: [number, number][]; properties: Record<string, any> }[] = [];
  const props = geo?.properties ?? {};

  function pushGeometry(geometry: any, sourceProps: Record<string, any>) {
    if (!geometry) return;
    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
      out.push({ coords: geometry.coordinates[0], properties: sourceProps });
    } else if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((poly: any) => {
        if (Array.isArray(poly) && poly.length > 0) out.push({ coords: poly[0], properties: sourceProps });
      });
    }
  }

  if (geo?.type === "FeatureCollection" && Array.isArray(geo.features)) {
    geo.features.forEach((f: any) => pushGeometry(f?.geometry, f?.properties ?? {}));
  } else if (geo?.type === "Feature") {
    pushGeometry(geo.geometry, geo.properties ?? {});
  } else {
    pushGeometry(geo, props);
  }
  return out;
}

// Convert a GeoJSON [lon, lat] ring into the app's Node shape (no projection needed —
// Leaflet renders real WGS84 coordinates directly on the basemap).
function projectGeoRing(coords: [number, number][]): Node[] {
  return coords.map(([lon, lat]) => ({ x: Number(lon), y: Number(lat) }));
}

function geoClassification(properties: Record<string, any>): string {
  const raw = properties?.classification ?? properties?.category;
  return CLASSIFICATIONS.includes(raw) ? raw : "Standard";
}

const currentAdmin = () => {
  try {
    const raw = localStorage.getItem("bgyauth");
    if (raw) {
      const s = JSON.parse(raw);
      const name = typeof s?.operatorName === "string" && s.operatorName ? s.operatorName : s?.page;
      if (name) return name === "admin" ? "System Admin" : name;
    }
  } catch {}
  return "System Admin";
};

const fmtStamp = (d: Date) =>
  d
    .toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    .replace(", ", " · ");

const fmtDate = (s: string) => {
  if (!s) return "—";
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function auditDesc({
  action,
  name,
  prevClass,
  newClass,
  prevArea,
  newArea,
}: {
  action: string;
  name: string;
  prevClass?: string;
  newClass?: string;
  prevArea?: number;
  newArea?: number;
}) {
  const lines = [`${name} ${action.toLowerCase()}`];
  if (prevClass && newClass && prevClass !== newClass) lines.push(`Classification: ${prevClass} → ${newClass}`);
  if (typeof prevArea === "number" && typeof newArea === "number" && prevArea !== newArea)
    lines.push(`Area: ${prevArea} ha → ${newArea} ha`);
  lines.push(`Updated by: ${currentAdmin()}`);
  lines.push(fmtStamp(new Date()));
  return lines.join("\n");
}

export default function DigitalBoundaries() {
  const [regions, setRegions] = useState<Region[]>(() => loadRegions());
  const [savedRegions, setSavedRegions] = useState<Region[]>(() => loadRegions());
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState("view"); // view | draw | editNodes | editDetails
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name?: string; isPrimary?: boolean } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBoundaryName, setNewBoundaryName] = useState("");
  const [newBoundaryType, setNewBoundaryType] = useState<Badge>("Sub-zone");
  const [newBoundaryClassification, setNewBoundaryClassification] = useState("Standard");
  const [newParentId, setNewParentId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    file: File;
    data: any;
    polys: { coords: [number, number][]; properties: Record<string, any> }[];
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [offline, setOffline] = useState(false);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.LayerGroup | null>(null);
  const nodeLayerRef = useRef<L.LayerGroup | null>(null);
  const nodeMarkersRef = useRef(new Map<number, L.Marker>());
  const mapClickedRef = useRef(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    saveRegions(savedRegions);
  }, [savedRegions]);

  // Load the database as the source of truth on mount.  localStorage is the
  // offline cache: boundaries stored locally but missing from the database are
  // synced up (Primaries first) so previously drawn zones are never lost.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = (await boundaryFetch("/api/digital-boundaries")) as any[];
        const local = loadRegions();
        const localById = new Map(local.map((r) => [r.id, r]));
        const withCachedNodes = (list: Region[]) =>
          list.map((r) => {
            if (r.nodes.length >= 3) return r;
            const cached = localById.get(r.id);
            if (cached && cached.nodes.length > r.nodes.length) return { ...r, nodes: cached.nodes };
            return r;
          });
        let final = withCachedNodes(rows.map(fromApiRow));
        const dbIds = new Set(final.map((r) => r.id));
        const toSeed = local.filter((r) => !dbIds.has(r.id));
        if (toSeed.length > 0) {
          const primaries = toSeed.filter((r) => r.badge === "Primary");
          const others = toSeed.filter((r) => r.badge !== "Primary");
          for (const r of [...primaries, ...others]) {
            try {
              await boundaryFetch("/api/digital-boundaries", {
                method: "POST",
                body: JSON.stringify(toCreatePayload(r)),
              });
            } catch (e) {
              console.error("Failed to sync boundary to the database:", r.id, errMsg(e));
            }
          }
          final = withCachedNodes(((await boundaryFetch("/api/digital-boundaries")) as any[]).map(fromApiRow));
        }
        if (final.length === 0 && local.length > 0) final = local;
        if (cancelled) return;
        setRegions(final);
        setSavedRegions(final);
        saveRegions(final);
        setSelectedId((id) => (final.some((r) => r.id === id) ? id : (final[0]?.id ?? "")));
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      mapRef.current?.invalidateSize();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const selected = useMemo(
    () => regions.find((r) => r.id === selectedId),
    [regions, selectedId]
  );

  const savedSelected = useMemo(
    () => savedRegions.find((r) => r.id === selectedId),
    [savedRegions, selectedId]
  );

  const hasUnsaved = useMemo(
    () => (selected && savedSelected ? !regionEqual(selected, savedSelected) : false),
    [selected, savedSelected]
  );

  const primaryRegions = useMemo(() => regions.filter((r) => r.badge === "Primary"), [regions]);
  const visibleRegions = useMemo(() => regions.filter((r) => r.visible), [regions]);

  const filteredRegions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regions.filter((r) => {
      if (filter !== "All" && r.badge !== filter && r.classification !== filter) return false;
      if (q === "") return true;
      return r.name.toLowerCase().includes(q) || r.classification.toLowerCase().includes(q);
    });
  }, [regions, search, filter]);

  const selfIntersection = useMemo(() => (selected ? hasSelfIntersection(selected.nodes) : false), [selected]);

  const containmentWarning = useMemo(() => {
    if (!selected) return false;
    if (selected.badge === "Primary") return false;
    const parent = regions.find((r) => r.id === selected.parentId);
    if (!parent || parent.badge !== "Primary") return true;
    return !isContainedIn(selected, parent.nodes);
  }, [selected, regions]);

  const overlapNames = useMemo(() => {
    if (!selected || selected.nodes.length < 3) return [];
    const names: string[] = [];
    for (const other of regions) {
      if (other.id === selected.id) continue;
      // Sub-zones are governed by their parent containment check, not overlap, so never
      // flag a Sub-zone against the Primary boundary here.
      if (selected.badge === "Sub-zone" && other.badge === "Primary") continue;
      if (other.badge === "Sub-zone" && other.parentId === selected.id) continue;
      if (other.nodes.length >= 3 && polygonsOverlap(selected.nodes, other.nodes)) names.push(other.name);
    }
    return names;
  }, [selected, regions]);

  const hasMinNodes = (selected?.nodes.length ?? 0) >= 3;
  // A boundary with nodes already saved is valid even if we're only editing metadata —
  // use the saved node count as a fallback so metadata-only edits are never blocked.
  const savedHasMinNodes = (savedSelected?.nodes.length ?? 0) >= 3;
  const canSave =
    !!selected &&
    (hasMinNodes || savedHasMinNodes) &&
    !selfIntersection &&
    !containmentWarning &&
    overlapNames.length === 0 &&
    selected.name.trim() !== "";

  const area = selected ? polygonArea(selected.nodes).toFixed(1) : "0.0";

  const importStats = useMemo(() => {
    if (!importPreview) return null;
    const { file, data, polys } = importPreview;
    const geometries: any[] =
      data?.type === "FeatureCollection" && Array.isArray(data.features)
        ? data.features.map((f: any) => f?.geometry)
        : [data?.geometry ?? data];
    const polygonCount = geometries.filter((g) => g?.type === "Polygon").length;
    const multiPolygonCount = geometries.filter((g) => g?.type === "MultiPolygon").length;
    const classifications = new Set<string>();
    const names: string[] = [];
    const validPolys = polys.filter((poly) => poly.coords.length >= 3);
    validPolys.forEach((poly, i) => {
      classifications.add(geoClassification(poly.properties));
      const baseName = poly.properties?.name ?? poly.properties?.label ?? `Imported Zone ${i + 1}`;
      names.push(`${baseName}${validPolys.length > 1 ? ` (${i + 1})` : ""}`);
    });
    const missingName = polys.filter((p) => !p.properties?.name && !p.properties?.label).length;
    const missingClassification = polys.filter((p) => !p.properties?.classification && !p.properties?.category).length;
    return { file, polys, polygonCount, multiPolygonCount, classifications: Array.from(classifications), names, missingName, missingClassification };
  }, [importPreview]);

  const updateSelectedNodes = useCallback((fn: (nodes: Node[]) => Node[]) => {
    const id = selectedIdRef.current;
    if (!id) return;
    setRegions((rs) => rs.map((r) => (r.id === id ? { ...r, nodes: fn(r.nodes) } : r)));
  }, []);

  const updateSelectedNodesRef = useRef(updateSelectedNodes);
  updateSelectedNodesRef.current = updateSelectedNodes;

  // Click on the real map in draw mode appends a node at the clicked lat/lng.
  const handleMapClick = (lat: number, lng: number) => {
    if (modeRef.current !== "draw") return;
    updateSelectedNodesRef.current((nodes) => [...nodes, { x: lng, y: lat }]);
  };

  const mapClickRef = useRef(handleMapClick);
  mapClickRef.current = handleMapClick;

  // Bootstrap the Leaflet basemap once.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    // A drag that ends counts as a pan, not a click — never add a node from it.
    map.on("dragstart", () => {
      mapClickedRef.current = true;
    });
    map.on("dragend", () => {
      window.setTimeout(() => {
        mapClickedRef.current = false;
      }, 0);
    });
    map.on("click", (evt: L.LeafletMouseEvent) => {
      if (mapClickedRef.current) return;
      mapClickRef.current(evt.latlng.lat, evt.latlng.lng);
    });
    polygonLayerRef.current = L.layerGroup().addTo(map);
    nodeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const sizeTimer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(sizeTimer);
      map.remove();
      mapRef.current = null;
      polygonLayerRef.current = null;
      nodeLayerRef.current = null;
      nodeMarkersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const el = mapAreaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const didFitRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nodes = visibleRegions.flatMap((r) => r.nodes);
    if (nodes.length < 2) return;
    if (didFitRef.current) return;
    didFitRef.current = true;
    map.invalidateSize();
    map.fitBounds(toLatLngArray(nodes), { padding: [40, 40], maxZoom: 17 });
  }, [visibleRegions]);

  // Keep polygon paths in sync with React state (and follow marker drags).
  useEffect(() => {
    const map = mapRef.current;
    const polyLayer = polygonLayerRef.current;
    if (!map || !polyLayer) return;

    polyLayer.clearLayers();
    for (const r of visibleRegions) {
      if (r.nodes.length === 0) continue;
      const color = STROKE_BY_BADGE[effectiveBadge(r)];
      const isSel = r.id === selectedId;
      
      if (r.nodes.length >= 3) {
        // Draw full polygon. In draw mode, layers must not steal map clicks
        // or new nodes cannot be placed on top of an existing zone.
        const poly = L.polygon(toLatLngArray(r.nodes), {
          color,
          weight: isSel ? 3 : 2,
          opacity: isSel ? 1 : 0.85,
          fillColor: color,
          fillOpacity: isSel ? 0.18 : 0.1,
          dashArray: isSel ? undefined : "6 4",
          interactive: mode !== "draw",
        }).addTo(polyLayer);
        poly.on("click", (evt: L.LeafletMouseEvent) => {
          if (modeRef.current === "draw") {
            mapClickRef.current(evt.latlng.lat, evt.latlng.lng);
          }
        });
      } else {
        // Draw polyline for partial polygons (1-2 nodes)
        const line = L.polyline(toLatLngArray(r.nodes), {
          color,
          weight: isSel ? 3 : 1.5,
          opacity: isSel ? 1 : 0.6,
          dashArray: isSel ? undefined : "5 5",
          interactive: mode !== "draw",
        }).addTo(polyLayer);
        line.on("click", (evt: L.LeafletMouseEvent) => {
          if (modeRef.current === "draw") {
            mapClickRef.current(evt.latlng.lat, evt.latlng.lng);
          }
        });
      }
    }

    if (selected && selected.visible) {
      const edit = mode === "editNodes";
      const draw = mode === "draw";
      selected.nodes.forEach((n, i) => {
        const m = nodeMarkersRef.current.get(i);
        if (m) {
          m.setLatLng([n.y, n.x]);
          if (edit || draw) m.dragging?.enable();
          else m.dragging?.disable();
        }
      });
    }
    map.getContainer().style.cursor = mode === "draw" ? "crosshair" : "";
  }, [regions, selectedId, mode, selected, visibleRegions]);

  // (Re)create draggable node markers when the selected region or mode changes.
  useEffect(() => {
    const nodeLayer = nodeLayerRef.current;
    if (!nodeLayer) return;

    for (const m of nodeMarkersRef.current.values()) m.remove();
    nodeMarkersRef.current.clear();

    if (!selected || !selected.visible) return;
    if (mode !== "view" && mode !== "editNodes" && mode !== "draw") return;
    if (selected.nodes.length === 0 && mode !== "draw") return;

    const color = STROKE_BY_BADGE[effectiveBadge(selected)];
    const edit = mode === "editNodes";
    const draw = mode === "draw";
    selected.nodes.forEach((n, i) => {
      const marker = L.marker([n.y, n.x], {
        icon: makeNodeIcon(color, edit, draw),
        draggable: true,
        zIndexOffset: 500,
      });
      marker.on("drag", () => {
        const ll = marker.getLatLng();
        setRegions((rs) =>
          rs.map((r) =>
            r.id === selectedIdRef.current
              ? { ...r, nodes: r.nodes.map((node, j) => (j === i ? { x: ll.lng, y: ll.lat } : node)) }
              : r
          )
        );
      });
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        setRegions((rs) =>
          rs.map((r) =>
            r.id === selectedIdRef.current
              ? { ...r, nodes: r.nodes.map((node, j) => (j === i ? { x: ll.lng, y: ll.lat } : node)) }
              : r
          )
        );
      });
      marker.on("click", (evt: L.LeafletMouseEvent) => {
        const target = evt.originalEvent.target as HTMLElement | null;
        if (target?.classList?.contains("db-node-x")) {
          evt.originalEvent.stopPropagation();
          setRegions((rs) =>
            rs.map((r) =>
              r.id === selectedIdRef.current && (r.nodes.length > 3 || draw)
                ? { ...r, nodes: r.nodes.filter((_, j) => j !== i) }
                : r
            )
          );
        }
      });
      if (!edit && !draw) marker.dragging?.disable();
      marker.addTo(nodeLayer);
      nodeMarkersRef.current.set(i, marker);
    });
  }, [selectedId, mode, selected?.visible, selected?.nodes.length]);

  const setDetails = (patch: Partial<Region>) => {
    setRegions((rs) => rs.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)));
  };

  const showProtected = (message: string) =>
    setModalMessage({ title: "Primary Boundary Protected", message });

  const changeType = (t: Badge) => {
    if (!selected || t === selected.badge) return;
    if (t === "Sub-zone" && selected.badge === "Primary" && primaryRegions.length === 1) {
      showProtected(`"${selected.name}" is the only Primary boundary and cannot be converted to a Sub-zone.`);
      return;
    }
    if (t === "Primary" && selected.badge === "Sub-zone" && primaryRegions.length >= 1) {
      showProtected(`A Primary boundary (${primaryRegions[0].name}) already exists. Only one Primary boundary is allowed.`);
      return;
    }
    setDetails({ badge: t, ...(t === "Primary" ? { parentId: undefined } : {}) });
  };

  const resetChanges = () => {
    const saved = savedRegions.find((r) => r.id === selectedId);
    if (!saved) return;
    setRegions((rs) =>
      rs.map((r) => (r.id === selectedId ? { ...saved, visible: r.visible } : r))
    );
  };

  const discardChanges = () => {
    resetChanges();
    setMode("view");
  };

  const runOrGuard = (action: () => void) => {
    if (hasUnsaved) {
      pendingActionRef.current = action;
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const confirmDiscardAndRun = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedModal(false);
    discardChanges();
    if (action) action();
  };

  const cancelUnsaved = () => {
    pendingActionRef.current = null;
    setShowUnsavedModal(false);
  };

  const selectBoundary = (id: string) => {
    if (id === selectedId) {
      runOrGuard(() => setMode("view"));
      return;
    }
    runOrGuard(() => {
      setSelectedId(id);
      setMode("view");
    });
  };

  const editFromSidebar = (id: string) => {
    const target = regions.find((r) => r.id === id);
    if (!target) return;
    runOrGuard(() => {
      setSelectedId(id);
      setMode("editDetails");
    });
  };

  const requestDelete = (r: Region) => {
    setConfirmDelete({ id: r.id, name: r.name, isPrimary: r.badge === "Primary" });
  };

  const deletingRef = useRef(false);

  const deleteBoundary = async (id: string) => {
    if (deletingRef.current) return;
    const target = regions.find((r) => r.id === id);
    if (!target) return;
    deletingRef.current = true;
    setConfirmDelete(null);
    try {
      await boundaryFetch(`/api/digital-boundaries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const updateList = (rs: Region[]) =>
        rs
          .filter((r) => r.id !== id)
          .map((r) => (r.parentId === id ? { ...r, parentId: undefined } : r));

      setRegions((rs) => updateList(rs));
      setSavedRegions((rs) => {
        const next = updateList(rs);
        saveRegions(next);
        return next;
      });
      if (selectedIdRef.current === id) {
        const remaining = regions.filter((r) => r.id !== id);
        setSelectedId(remaining[0]?.id ?? "");
        setMode("view");
      }
      pushAuditLog(
        "Boundary Deleted",
        [
          `Deleted boundary "${target.name}" (${target.badge}) (removed from the database)`,
          `Updated by: ${currentAdmin()}`,
          fmtStamp(new Date()),
        ].join("\n")
      );
      setModalMessage({
        title: "Boundary Deleted",
        message: `Deleted "${target.name}" from the database and map.`,
      });
    } catch (e) {
      setModalMessage({
        title: "Delete Failed",
        message: `Could not delete "${target.name}" — ${errMsg(e)}. The boundary was kept.`,
      });
    } finally {
      deletingRef.current = false;
    }
  };

  const startDetailsEdit = () => {
    if (selected) runOrGuard(() => setMode("editDetails"));
  };

  const saveBoundary = async () => {
    if (!canSave || !selected || !savedSelected) return;
    const now = todayStr();
    const updated: Region = { ...selected, edited: now };
    const prevArea = polygonArea(savedSelected.nodes);
    const newArea = polygonArea(selected.nodes);
    const reclassified = savedSelected.classification !== selected.classification;
    try {
      await boundaryFetch(`/api/digital-boundaries/${encodeURIComponent(selected.id)}`, {
        method: "PUT",
        body: JSON.stringify(toUpdatePayload(updated)),
      });
      setRegions((rs) => rs.map((r) => (r.id === selected.id ? updated : r)));
      setSavedRegions((rs) => rs.map((r) => (r.id === selected.id ? { ...updated } : r)));
      pushAuditLog(
        "Boundary Updated",
        auditDesc({
          action: reclassified ? "Reclassified" : "Updated",
          name: selected.name,
          prevClass: savedSelected.classification,
          newClass: selected.classification,
          prevArea: Number(prevArea.toFixed(2)),
          newArea: Number(newArea.toFixed(2)),
        })
      );
      setMode("view");
      setModalMessage({ title: "Boundary Saved", message: `Saved "${selected.name}" to the database` });
    } catch (e) {
      setModalMessage({
        title: "Save Failed",
        message: `Could not save "${selected.name}" — ${errMsg(e)}. Your changes are still on screen; please retry.`,
      });
    }
  };

  const addBoundary = () => {
    const primary = regions.find((r) => r.badge === "Primary");
    setNewBoundaryName("");
    setNewBoundaryType(primary ? "Sub-zone" : "Primary");
    setNewBoundaryClassification("Standard");
    setNewParentId(primary?.id ?? "");
    setShowAddModal(true);
  };

  const changeAddType = (t: Badge) => {
    if (t === "Primary" && primaryRegions.length >= 1) {
      showProtected(`A Primary boundary (${primaryRegions[0].name}) already exists. Only one Primary boundary is allowed.`);
      return;
    }
    setNewBoundaryType(t);
  };

  const confirmAddBoundary = async () => {
    const name = newBoundaryName.trim() || `Zone ${regions.length + 1}`;
    if (newBoundaryType === "Primary" && primaryRegions.length >= 1) {
      showProtected(`A Primary boundary (${primaryRegions[0].name}) already exists. Only one Primary boundary is allowed.`);
      return;
    }
    if (newBoundaryType === "Sub-zone" && !newParentId) {
      setModalMessage({ title: "Parent Required", message: "A Sub-zone must have a valid Primary parent boundary." });
      return;
    }
    const pending: Region = {
      id: `zone-${Date.now()}`,
      name,
      badge: newBoundaryType,
      classification: newBoundaryClassification,
      status: "Active",
      parentId: newBoundaryType === "Sub-zone" ? newParentId : undefined,
      created: todayStr(),
      edited: todayStr(),
      visible: true,
      nodes: [],
    };
    try {
      const created = await boundaryFetch("/api/digital-boundaries", {
        method: "POST",
        body: JSON.stringify(toCreatePayload(pending)),
      });
      const newRegion = fromApiRow(created);
      setRegions((rs) => [...rs, newRegion]);
      setSavedRegions((rs) => [...rs, { ...newRegion }]);
      setSelectedId(newRegion.id);
      setShowAddModal(false);
      setMode("draw");
      pushAuditLog(
        "Boundary Created",
        [
          `Created new boundary "${name}"`,
          `Classification: ${newBoundaryClassification}`,
          `Area: 0.0 ha`,
          `Updated by: ${currentAdmin()}`,
          fmtStamp(new Date()),
        ].join("\n")
      );
      // Stay in draw mode immediately — a blocking modal would cover the map.
    } catch (e) {
      const reason = errMsg(e);
      if (/only one primary/i.test(reason)) {
        try {
          const rows = (await boundaryFetch("/api/digital-boundaries")) as any[];
          const loaded = rows.map(fromApiRow);
          const primary = loaded.find((r) => r.badge === "Primary");
          setRegions(loaded);
          setSavedRegions(loaded);
          saveRegions(loaded);
          setShowAddModal(false);
          if (primary) {
            setSelectedId(primary.id);
            setMode("draw");
          }
          setModalMessage({
            title: "Primary Already Exists",
            message: `A Primary boundary already exists (${primary?.name ?? "unnamed"}). Only one is allowed — draw or edit that zone instead of creating another.`,
          });
          return;
        } catch {
          /* fall through to generic error */
        }
      }
      setModalMessage({
        title: "Create Failed",
        message: `Could not create "${name}" — ${reason}`,
      });
    }
  };

  const toggleVisible = (id: string) =>
    setRegions((rs) => rs.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));

  const setAllVisible = (v: boolean) => setRegions((rs) => rs.map((r) => ({ ...r, visible: v })));

  const parseImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const polys = extractGeoJsonPolygons(data);
        if (polys.length === 0) {
          setModalMessage({ title: "Import Failed", message: "No Polygon or MultiPolygon geometries found in the GeoJSON file." });
          return;
        }
        const valid = polys.filter((poly) => poly.coords.length >= 3);
        if (valid.length === 0) {
          setModalMessage({ title: "Import Failed", message: "Imported polygons did not contain at least 3 coordinates." });
          return;
        }
        if (primaryRegions.length === 0) {
          setModalMessage({ title: "Import Failed", message: "No Primary boundary exists. Create a Primary boundary before importing zones." });
          return;
        }
        setImportPreview({ file, data, polys });
      } catch (err: any) {
        setModalMessage({ title: "Import Failed", message: `Could not parse GeoJSON: ${err?.message ?? "invalid file"}` });
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    const { file, polys } = importPreview;
    const primary = regions.find((r) => r.badge === "Primary");
    if (!primary) {
      setModalMessage({ title: "Import Failed", message: "No Primary boundary exists. Create a Primary boundary before importing zones." });
      setImportPreview(null);
      return;
    }
    const stamp = Date.now();
    const valid = polys.filter((poly) => poly.coords.length >= 3);
    const added: Region[] = valid.map((poly, i) => {
      const baseName = poly.properties?.name ?? poly.properties?.label ?? `Imported Zone ${i + 1}`;
      return {
        id: `import-${stamp}-${i}`,
        name: `${baseName}${valid.length > 1 ? ` (${i + 1})` : ""}`,
        badge: "Sub-zone",
        classification: geoClassification(poly.properties),
        status: "Active",
        parentId: primary.id,
        created: todayStr(),
        edited: todayStr(),
        visible: true,
        nodes: projectGeoRing(poly.coords),
      };
    });
    const committed: Region[] = [];
    try {
      for (const a of added) {
        const created = await boundaryFetch("/api/digital-boundaries", {
          method: "POST",
          body: JSON.stringify(toCreatePayload(a)),
        });
        committed.push(fromApiRow(created));
      }
    } catch (e) {
      setModalMessage({
        title: "Import Failed",
        message: `Import stopped — ${errMsg(e)}. No polygons were added. Start the backend and retry.`,
      });
      return;
    }
    setRegions((rs) => [...rs, ...committed]);
    setSavedRegions((rs) => [...rs, ...committed.map((a) => ({ ...a }))]);
    setSelectedId(committed[0]?.id ?? "");
    setMode("view");
    pushAuditLog(
      "Boundary Created",
      [
        `Imported ${committed.length} boundary polygon(s) from GeoJSON "${file.name}"`,
        `Updated by: ${currentAdmin()}`,
        fmtStamp(new Date()),
      ].join("\n")
    );
    setImportPreview(null);
    setModalMessage({ title: "Boundaries Imported", message: `Imported ${committed.length} boundary polygon(s) from ${file.name}` });
  };

  const undoLastNode = () => {
    if (mode !== "draw" || (selected?.nodes.length ?? 0) <= 0) return;
    updateSelectedNodes((nodes) => nodes.slice(0, -1));
  };

  const startDraw = () => {
    if (!selected) {
      addBoundary();
      return;
    }
    if (mode === "draw") {
      setMode("view");
      return;
    }
    runOrGuard(() => {
      if (!selected.visible) setDetails({ visible: true });
      setMode("draw");
    });
  };

  // Force map redraw when entering draw mode to ensure markers appear
  useEffect(() => {
    if (mode === "draw" && mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [mode]);
  const startEditNodes = () => {
    if (mode === "editNodes") {
      setMode("view");
      return;
    }
    runOrGuard(() => {
      if (selected && !selected.visible) setDetails({ visible: true });
      setMode("editNodes");
    });
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const resetView = () => {
    const map = mapRef.current;
    if (map) map.setView(MAP_CENTER, MAP_ZOOM);
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const nodes = visibleRegions.flatMap((r) => r.nodes);
    if (nodes.length >= 2) {
      map.fitBounds(toLatLngArray(nodes), { padding: [40, 40] });
    } else {
      resetView();
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      mapAreaRef.current?.requestFullscreen?.();
    }
  };

  const parentName = selected && selected.badge === "Sub-zone" ? regions.find((r) => r.id === selected.parentId)?.name ?? "—" : "—";
  const filteredVisibleCount = filteredRegions.filter((r) => r.visible).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex flex-1 flex-col overflow-hidden px-6 py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">
            Digital Boundaries (Geofencing)
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Define and manage geographic zones and Purok boundaries
          </p>
        </header>

        {offline && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              Database unreachable — showing saved offline data. Start the backend (uvicorn on port
              8080/8000) so boundaries sync to the database.
            </span>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm lg:flex-row">
          {/* Sidebar */}
          <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-b border-stone-200 lg:max-h-none lg:w-[21rem] lg:border-b-0 lg:border-r">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-base font-bold text-stone-900">Defined Regions</h2>
              <p className="mt-0.5 text-xs text-stone-400">
                {regions.length} boundaries configured · {filteredVisibleCount}/{filteredRegions.length} shown
              </p>
            </div>

            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or classification..."
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-[13px] text-stone-900 placeholder-stone-400 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTER_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      filter === f
                        ? "border-[#15803D] bg-[#15803D] text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="db-scroll flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              {filteredRegions.map((r) => {
                const isSelected = r.id === selectedId;
                return (
                  <div
                    key={r.id}
                    onClick={() => selectBoundary(r.id)}
                    className={`cursor-pointer rounded-xl border px-4 py-4 shadow-sm transition ${
                      isSelected
                        ? "border-rose-900 bg-rose-50/40"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    } ${!r.visible ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 break-words text-[14px] font-semibold leading-snug text-stone-900">
                        {r.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisible(r.id);
                        }}
                        title={r.visible ? "Hide boundary" : "Show boundary"}
                        aria-label={r.visible ? "Hide boundary" : "Show boundary"}
                        className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                      >
                        {r.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${STATUS_STYLES[r.status]}`}
                      >
                        {r.status}
                      </span>
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${BADGE_STYLES[r.badge]}`}
                      >
                        {r.badge}
                      </span>
                      {r.classification && (
                        <span
                          className={`max-w-full truncate rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${CLASSIFICATION_BADGES[r.classification] || "bg-stone-100 text-stone-600"}`}
                        >
                          {r.classification}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] text-stone-400">
                      {r.nodes.length} nodes &nbsp;&nbsp; {polygonArea(r.nodes).toFixed(1)} ha
                      &nbsp;&nbsp; Edited {fmtDate(r.edited)}
                    </p>
                    {r.badge === "Sub-zone" && (
                      <p className="mt-0.5 text-[11px] text-stone-400">
                        Parent: {regions.find((p) => p.id === r.parentId)?.name ?? "—"}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editFromSidebar(r.id);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(r);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredRegions.length === 0 && (
                <p className="px-2 py-6 text-center text-[12px] text-stone-400">
                  No boundaries match your search or filter.
                </p>
              )}
            </div>

            <div className="border-t border-stone-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium text-stone-500">Map visibility</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAllVisible(true)}
                    className="flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                  >
                    <Eye className="h-3 w-3" /> Show All
                  </button>
                  <button
                    onClick={() => setAllVisible(false)}
                    className="flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                  >
                    <EyeOff className="h-3 w-3" /> Hide All
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) runOrGuard(() => parseImportFile(file));
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#15803D] py-2.5 text-sm font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white"
              >
                <FileJson className="h-4 w-4" /> Import GeoJSON
              </button>
              <button
                onClick={() => runOrGuard(addBoundary)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#15803D] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166534]"
              >
                <Plus className="h-4 w-4" /> Add New Boundary
              </button>
            </div>
          </aside>

          {/* Map panel */}
          <section className="flex min-h-[26rem] flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="border-b border-stone-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-stone-900">{selected?.name || "No boundary selected"}</h3>
                    {hasUnsaved && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
                        ● Unsaved changes
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400">
                    {selected ? `${selected.nodes.length} polygon nodes &nbsp;·&nbsp; ${area} ha &nbsp;·&nbsp; Last edited ${fmtDate(selected.edited)}` : "Select or create a boundary to begin"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={startDraw}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      mode === "draw"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <Pentagon className="h-3.5 w-3.5" />
                    {mode === "draw" ? "Stop Drawing" : "Draw Polygon"}
                  </button>
                  {mode === "draw" && (
                    <button
                      onClick={undoLastNode}
                      className="flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      <UndoIcon className="h-3.5 w-3.5" /> Undo
                    </button>
                  )}
                  <button
                    onClick={startEditNodes}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      mode === "editNodes"
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" />
                    {mode === "editNodes" ? "Done Editing" : "Edit Nodes"}
                  </button>
                  <button
                    onClick={saveBoundary}
                    disabled={!canSave || !hasUnsaved}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                      canSave && hasUnsaved
                        ? "bg-[#15803D] text-white hover:bg-[#166534]"
                        : "cursor-not-allowed bg-stone-100 text-stone-400"
                    }`}
                  >
                    <Save className="h-3.5 w-3.5" /> Save Boundary
                  </button>
                  {hasUnsaved && (
                    <button
                      onClick={resetChanges}
                      title="Restore the polygon and properties to the last saved state"
                      className="flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset Changes
                    </button>
                  )}
                  {hasUnsaved && (
                    <button
                      onClick={discardChanges}
                      className="flex items-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <DiscardIcon className="h-3.5 w-3.5" /> Discard Changes
                    </button>
                  )}
                </div>
              </div>
              {!canSave && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-amber-100 bg-amber-50 px-6 py-2 text-[11px] font-medium text-amber-800">
                  <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                  {!hasMinNodes && <span>Add at least 3 nodes</span>}
                  {selfIntersection && <span>· Polygon self-intersects — drag nodes to fix</span>}
                  {containmentWarning && <span>· Nodes outside parent boundary</span>}
                  {overlapNames.length > 0 && <span>· Overlaps with: {overlapNames.join(", ")}</span>}
                </div>
              )}
            </div>

            <div ref={mapAreaRef} className="relative min-h-[22rem] flex-1 overflow-hidden bg-[#dfe8e2]">
              {mode === "draw" && selected && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-stone-900/85 px-3 py-1 text-[11px] font-medium text-white">
                  Click the map to add nodes to {selected.name}
                </div>
              )}
              {mode === "editNodes" && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-sky-900/85 px-3 py-1 text-[11px] font-medium text-white">
                  Drag nodes to reposition · click a node's × to remove it
                </div>
              )}

              <div ref={mapContainerRef} className="db-map absolute inset-0 z-0 h-full w-full" />

              {/* Map controls */}
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-sm backdrop-blur" onClick={(e) => e.stopPropagation()}>
                <MapControlButton icon={ZoomIn} label="Zoom in" onClick={zoomIn} />
                <MapControlButton icon={ZoomOut} label="Zoom out" onClick={zoomOut} />
                <MapControlButton icon={Scan} label="Fit all boundaries" onClick={fitAll} />
                <MapControlButton icon={RotateCcw} label="Reset view" onClick={resetView} />
                <MapControlButton
                  icon={isFullscreen ? Minimize2 : Maximize2}
                  label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  onClick={toggleFullscreen}
                />
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 rounded-lg border border-stone-200 bg-white/95 px-3.5 py-3 text-[11px] shadow-sm backdrop-blur" onClick={(e) => e.stopPropagation()}>
                <p className="mb-1.5 font-semibold text-stone-700">Legend</p>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-0.5 w-4 bg-rose-800" />
                  <span className="text-stone-500">Primary Boundary</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-0.5 w-4 bg-sky-700" />
                  <span className="text-stone-500">Sub-zone</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <MapPin className="h-3 w-3 text-stone-500" />
                  <span className="text-stone-500">Edit Node</span>
                </div>
              </div>
            </div>
          </section>

          {/* Right / secondary panel */}
          <aside className="flex max-h-[50vh] w-full shrink-0 flex-col border-t border-stone-200 bg-white lg:max-h-none lg:w-[22rem] lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-stone-900">Boundary Details</h2>
                <p className="mt-0.5 text-xs text-stone-400">Inspect the selected boundary</p>
              </div>
              {mode === "editDetails" && (
                <button
                  onClick={() => setMode("view")}
                  className="rounded-full border border-stone-200 px-3 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="db-scroll flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {selected ? (
                mode === "editDetails" ? (
                  <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-stone-500">Boundary Name</label>
                    <input
                      type="text"
                      value={selected.name}
                      onChange={(e) => setDetails({ name: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-stone-500">Boundary Type</label>
                    <div className="flex gap-3">
                      {TYPES.map((t) => (
                        <button
                          key={t}
                          onClick={() => changeType(t)}
                          className={`flex-1 rounded-lg border py-2.5 text-[13px] font-medium transition ${
                            selected.badge === t
                              ? t === "Primary"
                                ? "border-rose-400 bg-rose-50 text-rose-700"
                                : "border-sky-400 bg-sky-50 text-sky-700"
                              : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selected.badge === "Sub-zone" && (
                    <div>
                      <label className="mb-1 block text-[12px] font-medium text-stone-500">Parent Boundary</label>
                      <select
                        value={selected.parentId ?? ""}
                        onChange={(e) => setDetails({ parentId: e.target.value || undefined })}
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
                      >
                        <option value="">Select a Primary boundary…</option>
                        {primaryRegions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {!selected.parentId && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          A Sub-zone must have a valid Primary parent boundary.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-stone-500">Zone Classification</label>
                    <select
                      value={selected.classification}
                      onChange={(e) => setDetails({ classification: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
                    >
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-stone-500">Status</label>
                    <div className="flex gap-3">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDetails({ status: s })}
                          className={`flex-1 rounded-lg border py-2.5 text-[13px] font-medium transition ${
                            selected.status === s
                              ? "border-[#15803D] bg-[#15803D]/5 text-[#15803D]"
                              : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-bold text-stone-900">{selected.name}</h3>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${BADGE_STYLES[selected.badge]}`}>
                        {selected.badge}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${CLASSIFICATION_BADGES[selected.classification] || "bg-stone-100 text-stone-600"}`}
                      >
                        {selected.classification}
                      </span>
                    </div>
                  </div>
                  <DetailRow label="Area" value={`${area} ha`} />
                  <DetailRow label="Nodes" value={`${selected.nodes.length}`} />
                  <DetailRow
                    label="Status"
                    value={
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[selected.status]}`}>
                        {selected.status}
                      </span>
                    }
                  />
                  <DetailRow label="Parent Boundary" value={parentName} />
                  <DetailRow label="Created" value={fmtDate(selected.created)} />
                  <DetailRow label="Last Modified" value={fmtDate(selected.edited)} />
                </div>
              )
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-center">
                <p className="text-sm text-stone-500">No boundary selected</p>
                <p className="text-xs text-stone-400 mt-1">Create or select a boundary to view details</p>
              </div>
            )}
            </div>

            <div className="border-t border-stone-200 p-4">
              {selected && mode === "editDetails" ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={saveBoundary}
                    disabled={!canSave || !hasUnsaved}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold shadow-sm transition ${
                      canSave && hasUnsaved
                        ? "bg-[#15803D] text-white hover:bg-[#166534]"
                        : "cursor-not-allowed bg-stone-100 text-stone-400"
                    }`}
                  >
                    <Save className="h-4 w-4" /> Save Boundary
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={discardChanges}
                      className="flex-1 rounded-lg border border-rose-200 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={resetChanges}
                      className="flex-1 rounded-lg border border-stone-200 py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Reset Changes
                    </button>
                  </div>
                </div>
              ) : selected ? (
                <div className="flex gap-2">
                  <button
                    onClick={startDetailsEdit}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#15803D] py-2.5 text-sm font-semibold text-[#15803D] transition hover:bg-[#15803D] hover:text-white"
                  >
                    <Pencil className="h-4 w-4" /> Edit Boundary
                  </button>
                  <button
                    onClick={() => requestDelete(selected)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3.5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </main>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} title="New Boundary">
          <label className="mb-1 block text-[12px] font-medium text-stone-500">Boundary Name</label>
          <input
            type="text"
            value={newBoundaryName}
            onChange={(e) => setNewBoundaryName(e.target.value)}
            placeholder='e.g. "Purok 5 — Coastal Zone"'
            className="mb-4 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
          />

          <label className="mb-1 block text-[12px] font-medium text-stone-500">Boundary Type</label>
          <div className="mb-4 flex gap-3">
            {TYPES.map((t) => {
              const blocked = t === "Sub-zone" && primaryRegions.length === 0;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={blocked}
                  onClick={() => changeAddType(t)}
                  className={`flex-1 rounded-lg border py-2.5 text-[13px] font-medium transition ${
                    newBoundaryType === t
                      ? t === "Primary"
                        ? "border-rose-400 bg-rose-50 text-rose-700"
                        : "border-sky-400 bg-sky-50 text-sky-700"
                      : blocked
                        ? "cursor-not-allowed border-stone-100 text-stone-300"
                        : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {primaryRegions.length === 0 && (
            <p className="mb-4 text-[12px] text-stone-500">
              Create a Primary boundary first. Sub-zones can only be added under that parent.
            </p>
          )}

          {newBoundaryType === "Sub-zone" && (
            <>
              <label className="mb-1 block text-[12px] font-medium text-stone-500">Parent Boundary</label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="mb-4 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
              >
                <option value="">Select a Primary boundary…</option>
                {primaryRegions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="mb-1 block text-[12px] font-medium text-stone-500">Zone Classification</label>
          <select
            value={newBoundaryClassification}
            onChange={(e) => setNewBoundaryClassification(e.target.value)}
            className="mb-6 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20"
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={confirmAddBoundary}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#15803D] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166534]"
          >
            <Plus className="h-4 w-4" /> Start Drawing Boundary
          </button>
        </Modal>
      )}

      {importPreview && importStats && (
        <Modal
          onClose={() => setImportPreview(null)}
          title="Import Preview"
          subtitle={importStats.file.name}
          size="md"
          footer={
            <div className="flex gap-3">
              <button
                onClick={() => setImportPreview(null)}
                className="flex-1 rounded-lg border border-stone-200 py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166534]"
              >
                <FileJson className="h-4 w-4" /> Import Boundaries
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-center">
                <p className="text-lg font-bold text-stone-900">{importStats.polys.length}</p>
                <p className="text-[11px] text-stone-500">Detected features</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-center">
                <p className="text-lg font-bold text-stone-900">{importStats.polys.filter((p) => p.coords.length >= 3).length}</p>
                <p className="text-[11px] text-stone-500">Valid (&ge;3 pts)</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-center">
                <p className="text-lg font-bold text-stone-900">{importStats.polygonCount}</p>
                <p className="text-[11px] text-stone-500">Polygon geometries</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-center">
                <p className="text-lg font-bold text-stone-900">{importStats.multiPolygonCount}</p>
                <p className="text-[11px] text-stone-500">MultiPolygon geometries</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Detected classifications</p>
              <div className="flex flex-wrap gap-1.5">
                {importStats.classifications.length === 0 && (
                  <span className="text-[12px] text-stone-500">None — all default to Standard</span>
                )}
                {importStats.classifications.map((c) => (
                  <span
                    key={c}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CLASSIFICATION_BADGES[c] || "bg-stone-100 text-stone-600"}`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Boundary names</p>
              {importStats.names.length === 0 ? (
                <p className="text-[12px] text-stone-500">No names provided in file properties.</p>
              ) : (
                <ul className="space-y-1 text-[12px] text-stone-600">
                  {importStats.names.slice(0, 8).map((n, i) => (
                    <li key={i} className="truncate">• {n}</li>
                  ))}
                  {importStats.names.length > 8 && <li className="text-stone-400">+{importStats.names.length - 8} more</li>}
                </ul>
              )}
            </div>

            {importStats.missingName > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                ⚠ {importStats.missingName} boundary/boundaries are missing a name and will default to "Imported Zone N".
              </p>
            )}
            {importStats.missingClassification > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                ⚠ {importStats.missingClassification} boundary/boundaries are missing a classification and will default to Standard.
              </p>
            )}
            <p className="text-[11.5px] text-stone-400">
              Imported zones are created as Sub-zones under <span className="font-medium text-stone-600">{primaryRegions[0]?.name}</span>.
            </p>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          type="confirm"
          title={confirmDelete.isPrimary ? "Delete Primary Boundary" : "Confirm Delete"}
          message={
            confirmDelete.isPrimary
              ? `Are you sure you want to permanently delete the Primary boundary "${confirmDelete.name}"? Any Sub-zones linked to it will have their parent detached. This action cannot be undone — the boundary and its nodes will be removed from both the map and the database.`
              : `Are you sure you want to permanently delete "${confirmDelete.name || "this boundary"}"? This action cannot be undone — the boundary and its nodes are removed from both the map and the database.`
          }
          confirmLabel="Delete"
          onConfirm={() => deleteBoundary(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {showUnsavedModal && (
        <ConfirmModal
          type="confirm"
          title="Unsaved Changes"
          message="You have unsaved changes. Discard your changes or continue editing?"
          confirmLabel="Discard Changes"
          cancelLabel="Continue Editing"
          onConfirm={confirmDiscardAndRun}
          onClose={cancelUnsaved}
        />
      )}

      {modalMessage && (
        <ConfirmModal
          title={modalMessage.title}
          message={modalMessage.message}
          onClose={() => setModalMessage(null)}
        />
      )}
    </div>
  );
}
