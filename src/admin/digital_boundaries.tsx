import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from "react";
import {
  Pencil,
  Archive,
  ArchiveRestore,
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
  Move,
  RotateCcw,
  Scan,
  type LucideIcon,
} from "lucide-react";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";

const UndoIcon = Undo2;
const DiscardIcon = RotateCcw;

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

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Shoelace formula on normalized 0-1000 x 0-560 canvas coords -> fake hectares
function polygonArea(nodes: Node[]) {
  if (nodes.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < nodes.length; i++) {
    const [x1, y1] = [nodes[i].x, nodes[i].y];
    const [x2, y2] = [nodes[(i + 1) % nodes.length].x, nodes[(i + 1) % nodes.length].y];
    sum += x1 * y2 - x2 * y1;
  }
  // scale factor is arbitrary but consistent, tuned to feel plausible for a small barangay
  return Math.abs(sum) / 2 / 16000;
}

function polygonToPoints(nodes: Node[]) {
  return nodes.map((n) => `${n.x},${n.y}`).join(" ");
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

const seedRegions = (): Region[] => [
  {
    id: "main",
    name: "Main Barangay Boundary",
    badge: "Primary",
    classification: "Standard",
    status: "Active",
    created: "2026-05-02",
    edited: "2026-07-18",
    visible: true,
    nodes: [
      { x: 720, y: 90 },
      { x: 250, y: 145 },
      { x: 165, y: 260 },
      { x: 460, y: 480 },
      { x: 340, y: 705 },
      { x: 665, y: 615 },
      { x: 855, y: 305 },
    ],
  },
  {
    id: "p1",
    name: "Purok 1 — Riverside",
    badge: "Sub-zone",
    classification: "Residential",
    status: "Active",
    parentId: "main",
    created: "2026-06-01",
    edited: "2026-07-15",
    visible: true,
    nodes: [
      { x: 250, y: 145 },
      { x: 165, y: 260 },
      { x: 300, y: 320 },
      { x: 380, y: 200 },
    ],
  },
  {
    id: "p2",
    name: "Purok 2 — Chapel Area",
    badge: "Sub-zone",
    classification: "Residential",
    status: "Active",
    parentId: "main",
    created: "2026-06-03",
    edited: "2026-07-10",
    visible: true,
    nodes: [
      { x: 460, y: 480 },
      { x: 340, y: 705 },
      { x: 480, y: 640 },
    ],
  },
  {
    id: "p3",
    name: "Purok 3 — Market Zone",
    badge: "Sub-zone",
    classification: "Market",
    status: "Active",
    parentId: "main",
    created: "2026-06-05",
    edited: "2026-07-19",
    visible: true,
    nodes: [
      { x: 855, y: 305 },
      { x: 665, y: 615 },
      { x: 700, y: 520 },
      { x: 780, y: 400 },
    ],
  },
  {
    id: "p4",
    name: "Purok 4 — School District",
    badge: "Sub-zone",
    classification: "Standard",
    status: "Active",
    parentId: "main",
    created: "2026-06-07",
    edited: "2026-07-12",
    visible: true,
    nodes: [
      { x: 720, y: 90 },
      { x: 855, y: 305 },
      { x: 760, y: 150 },
    ],
  },
  {
    id: "evac",
    name: "Evacuation Zone Alpha",
    badge: "Sub-zone",
    classification: "Evacuation / Emergency",
    status: "Active",
    parentId: "main",
    created: "2026-05-28",
    edited: "2026-06-28",
    visible: true,
    nodes: [
      { x: 300, y: 320 },
      { x: 380, y: 200 },
      { x: 460, y: 480 },
    ],
  },
];

function crossProduct(o: Node, a: Node, b: Node) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(p: Node, q: Node, r: Node) {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function segmentsIntersect(a: Node, b: Node, c: Node, d: Node) {
  const o1 = crossProduct(a, b, c);
  const o2 = crossProduct(a, b, d);
  const o3 = crossProduct(c, d, a);
  const o4 = crossProduct(c, d, b);
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
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

function pointInPolygon(p: Node, nodes: Node[]) {
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
    const xi = nodes[i].x, yi = nodes[i].y;
    const xj = nodes[j].x, yj = nodes[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
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

// Project lon/lat rings into the 0-1000 x 0-800 canvas space, preserving aspect ratio (y flipped)
function projectGeoRing(coords: [number, number][]): Node[] {
  if (coords.length < 2) return [];
  const xs = coords.map((c) => Number(c[0]));
  const ys = coords.map((c) => Number(c[1]));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const drawW = 880, drawH = 660, margin = 50;
  const scale = Math.min((drawW - margin * 2) / spanX, (drawH - margin * 2) / spanY);
  const offsetX = (drawW - spanX * scale) / 2;
  const offsetY = (drawH - spanY * scale) / 2;
  return coords.map(([lon, lat]) => ({
    x: Math.max(20, Math.min(980, offsetX + (Number(lon) - minX) * scale)),
    y: Math.max(20, Math.min(780, offsetY + (maxY - Number(lat)) * scale)),
  }));
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

const IMPACT_USED_BY = ["Hazard Detection", "CCTV Monitoring", "Patrol Coverage", "Analytics"];

function mockImpact(region: Region) {
  let h = 0;
  for (const ch of region.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { iot: 5 + (h % 9), cameras: 1 + (h % 5), routes: 1 + (h % 4) };
}

function MapControlButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active ? "bg-[#0038A8] text-white" : "text-stone-600 hover:bg-stone-100"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-stone-400">{label}</span>
      <span className="text-right text-[13px] font-medium text-stone-800">{value}</span>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-2 py-2 text-center">
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}

export default function DigitalBoundaries() {
  const [regions, setRegions] = useState<Region[]>(seedRegions);
  const [savedRegions, setSavedRegions] = useState<Region[]>(seedRegions);
  const [selectedId, setSelectedId] = useState("main");
  const [mode, setMode] = useState("view"); // view | draw | editNodes | editDetails
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; restore: boolean } | null>(null);
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
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [panActive, setPanActive] = useState(false);
  const [panState, setPanState] = useState<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);

  const scrollbarCss = `
    .db-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .db-scroll::-webkit-scrollbar-track { background: transparent; }
    .db-scroll::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
    .db-scroll { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
  `;

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const selected = useMemo(
    () => regions.find((r) => r.id === selectedId) ?? regions[0],
    [regions, selectedId]
  );

  const savedSelected = useMemo(
    () => savedRegions.find((r) => r.id === selectedId) ?? savedRegions[0],
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
  const canSave =
    !!selected && hasMinNodes && !selfIntersection && !containmentWarning && overlapNames.length === 0 && selected.name.trim() !== "";

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

  const updateSelectedNodes = useCallback(
    (fn) => {
      setRegions((rs) => rs.map((r) => (r.id === selectedId ? { ...r, nodes: fn(r.nodes) } : r)));
    },
    [selectedId]
  );

  const svgPoint = (evt: any) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const vbW = 1000 / view.zoom;
    const vbH = 800 / view.zoom;
    const x = view.x + ((clientX - rect.left) / rect.width) * vbW;
    const y = view.y + ((clientY - rect.top) / rect.height) * vbH;
    return {
      x: Math.max(20, Math.min(980, x)),
      y: Math.max(20, Math.min(780, y)),
    };
  };

  const handleMapClick = (evt) => {
    if (mode !== "draw") return;
    const p = svgPoint(evt);
    updateSelectedNodes((nodes) => [...nodes, p]);
  };

  const handleNodeMouseDown = (idx: number) => (evt) => {
    if (mode !== "editNodes") return;
    evt.stopPropagation();
    setDragIndex(idx);
  };

  const handleNodeTouchStart = (idx: number) => (evt) => {
    if (mode !== "editNodes") return;
    evt.stopPropagation();
    setDragIndex(idx);
  };

  const applyPointerMove = (evt) => {
    if (dragIndex !== null && mode === "editNodes") {
      const p = svgPoint(evt);
      updateSelectedNodes((nodes) => nodes.map((n, i) => (i === dragIndex ? p : n)));
      return;
    }
    if (panState) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const vbW = 1000 / view.zoom;
      const vbH = 800 / view.zoom;
      const dx = ((evt.touches ? evt.touches[0].clientX : evt.clientX) - panState.startX) / rect.width * vbW;
      const dy = ((evt.touches ? evt.touches[0].clientY : evt.clientY) - panState.startY) / rect.height * vbH;
      setView((v) => {
        const maxX = Math.max(0, 1000 - 1000 / v.zoom);
        const maxY = Math.max(0, 800 - 800 / v.zoom);
        return { ...v, x: clamp(panState.viewX - dx, 0, maxX), y: clamp(panState.viewY - dy, 0, maxY) };
      });
    }
  };

  const handleMapMouseMove = applyPointerMove;
  const handleTouchMove = applyPointerMove;

  const startPan = (evt) => {
    // Pan-by-drag is always available outside draw mode; the Pan tool additionally
    // lets the user reposition the view while drawing without adding a node.
    if (mode === "draw" && !panActive) return;
    setPanState({
      startX: evt.clientX,
      startY: evt.clientY,
      viewX: view.x,
      viewY: view.y,
    });
  };

  const startPanTouch = (evt) => {
    if ((mode === "draw" && !panActive) || !evt.touches?.length) return;
    const t = evt.touches[0];
    setPanState({ startX: t.clientX, startY: t.clientY, viewX: view.x, viewY: view.y });
  };

  const stopDrag = () => {
    setDragIndex(null);
    setPanState(null);
  };

  const removeNode = (idx: number) => (evt) => {
    evt.stopPropagation();
    if (mode !== "editNodes") return;
    updateSelectedNodes((nodes) => (nodes.length > 3 ? nodes.filter((_, i) => i !== idx) : nodes));
  };

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
      setMode("view");
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

  const requestArchive = (r: Region) => {
    if (r.badge === "Primary") {
      showProtected(`"${r.name}" is the Primary boundary and cannot be archived.`);
      return;
    }
    runOrGuard(() => setConfirmArchive({ id: r.id, restore: false }));
  };

  const requestRestore = (r: Region) => {
    runOrGuard(() => setConfirmArchive({ id: r.id, restore: true }));
  };

  const startDetailsEdit = () => {
    if (selected) setMode("editDetails");
  };

  const saveBoundary = () => {
    if (!canSave || !selected || !savedSelected) return;
    const now = todayStr();
    const prevArea = polygonArea(savedSelected.nodes);
    const newArea = polygonArea(selected.nodes);
    const reclassified = savedSelected.classification !== selected.classification;
    setRegions((rs) => rs.map((r) => (r.id === selectedId ? { ...r, edited: now } : r)));
    setSavedRegions((rs) => rs.map((r) => (r.id === selectedId ? { ...selected, edited: now } : r)));
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
    setModalMessage({ title: "Boundary Saved", message: `Saved "${selected.name}"` });
  };

  const addBoundary = () => {
    const primary = regions.find((r) => r.badge === "Primary");
    setNewBoundaryName(`Purok ${regions.length}`);
    setNewBoundaryType("Sub-zone");
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

  const confirmAddBoundary = () => {
    const name = newBoundaryName.trim() || `Zone ${regions.length}`;
    if (newBoundaryType === "Primary" && primaryRegions.length >= 1) {
      showProtected(`A Primary boundary (${primaryRegions[0].name}) already exists. Only one Primary boundary is allowed.`);
      return;
    }
    if (newBoundaryType === "Sub-zone" && !newParentId) {
      setModalMessage({ title: "Parent Required", message: "A Sub-zone must have a valid Primary parent boundary." });
      return;
    }
    const id = `zone-${Date.now()}`;
    const newRegion: Region = {
      id,
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
    setRegions((rs) => [...rs, newRegion]);
    setSavedRegions((rs) => [...rs, { ...newRegion }]);
    setSelectedId(id);
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
    setModalMessage({ title: "Boundary Created", message: `Created "${name}" — click the map to draw its boundary` });
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

  const confirmImport = () => {
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
    setRegions((rs) => [...rs, ...added]);
    setSavedRegions((rs) => [...rs, ...added.map((a) => ({ ...a }))]);
    setSelectedId(added[0].id);
    setMode("view");
    pushAuditLog(
      "Boundary Created",
      [
        `Imported ${added.length} boundary polygon(s) from GeoJSON "${file.name}"`,
        `Updated by: ${currentAdmin()}`,
        fmtStamp(new Date()),
      ].join("\n")
    );
    setImportPreview(null);
    setModalMessage({ title: "Boundaries Imported", message: `Imported ${added.length} boundary polygon(s) from ${file.name}` });
  };

  const undoLastNode = () => {
    if (mode !== "draw" || (selected?.nodes.length ?? 0) <= 0) return;
    updateSelectedNodes((nodes) => nodes.slice(0, -1));
  };

  const startDraw = () => {
    if (mode !== "draw" && selected && !selected.visible) setDetails({ visible: true });
    setMode((m) => (m === "draw" ? "view" : "draw"));
  };
  const startEditNodes = () => {
    if (mode !== "editNodes" && selected && !selected.visible) setDetails({ visible: true });
    setMode((m) => (m === "editNodes" ? "view" : "editNodes"));
  };

  const zoomBy = (factor: number) =>
    setView((v) => {
      const zoom = clamp(v.zoom * factor, 1, 6);
      const vbW = 1000 / zoom;
      const vbH = 800 / zoom;
      const cx = v.x + 1000 / v.zoom / 2;
      const cy = v.y + 800 / v.zoom / 2;
      const x = clamp(cx - vbW / 2, 0, Math.max(0, 1000 - vbW));
      const y = clamp(cy - vbH / 2, 0, Math.max(0, 800 - vbH));
      return { x, y, zoom };
    });

  const resetView = () => setView({ x: 0, y: 0, zoom: 1 });

  const fitAll = () => {
    const nodes = visibleRegions.flatMap((r) => r.nodes);
    if (nodes.length === 0) {
      resetView();
      return;
    }
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 60;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const zoom = clamp(Math.min(1000 / contentW, 800 / contentH), 1, 6);
    const vbW = 1000 / zoom;
    const vbH = 800 / zoom;
    const x = clamp(minX - pad - (vbW - contentW) / 2, 0, Math.max(0, 1000 - vbW));
    const y = clamp(minY - pad - (vbH - contentH) / 2, 0, Math.max(0, 800 - vbH));
    setView({ x, y, zoom });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      mapAreaRef.current?.requestFullscreen?.();
    }
  };

  if (!selected) return null;

  const impact = mockImpact(selected);
  const parentName = selected.badge === "Sub-zone" ? regions.find((r) => r.id === selected.parentId)?.name ?? "—" : "—";
  const filteredVisibleCount = filteredRegions.filter((r) => r.visible).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <style>{scrollbarCss}</style>
      <main className="flex flex-1 flex-col overflow-hidden px-6 py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">
            Digital Boundaries (Geofencing)
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Define and manage geographic zones and Purok boundaries
          </p>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm lg:flex-row">
          {/* Sidebar */}
          <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-b border-stone-200 md:max-h-none lg:w-[21rem] lg:border-b-0 lg:border-r">
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
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-[13px] text-stone-900 placeholder-stone-400 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTER_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      filter === f
                        ? "border-[#0038A8] bg-[#0038A8] text-white"
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
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisible(r.id);
                        }}
                        title={r.visible ? "Hide boundary" : "Show boundary"}
                        aria-label={r.visible ? "Hide boundary" : "Show boundary"}
                        className="mt-0.5 shrink-0 rounded-full border border-stone-200 p-1 text-stone-500 hover:bg-stone-100"
                      >
                        {r.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <span className="min-w-0 flex-1 break-words text-[14px] font-semibold leading-snug text-stone-900">
                        {r.name}
                      </span>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5" style={{ maxWidth: "150px" }}>
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
                            className={`truncate max-w-[130px] rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${CLASSIFICATION_BADGES[r.classification] || "bg-stone-100 text-stone-600"}`}
                          >
                            {r.classification}
                          </span>
                        )}
                      </div>
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
                          if (r.status === "Inactive") {
                            requestRestore(r);
                          } else {
                            requestArchive(r);
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium ${
                          r.status === "Inactive"
                            ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            : "border-rose-200 text-rose-600 hover:bg-rose-50"
                        }`}
                      >
                        {r.status === "Inactive" ? (
                          <>
                            <ArchiveRestore className="h-3 w-3" /> Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-3 w-3" /> Archive
                          </>
                        )}
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
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#0038A8] py-2.5 text-sm font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
              >
                <FileJson className="h-4 w-4" /> Import GeoJSON
              </button>
              <button
                onClick={() => runOrGuard(addBoundary)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
              >
                <Plus className="h-4 w-4" /> Add New Boundary
              </button>
            </div>
          </aside>

          {/* Map panel */}
          <main className="flex min-h-[26rem] flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-6 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-stone-900">{selected.name}</h3>
                  {hasUnsaved && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
                      ● Unsaved changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400">
                  {selected.nodes.length} polygon nodes &nbsp;·&nbsp; {area} ha &nbsp;·&nbsp; Last
                  edited {fmtDate(selected.edited)}
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
                {!canSave && (
                  <div className="flex max-w-[15rem] flex-col gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800">
                    {!hasMinNodes && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} /> Add at least 3 nodes
                      </span>
                    )}
                    {selfIntersection && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} /> Polygon self-intersects — drag nodes to fix
                      </span>
                    )}
                    {containmentWarning && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} /> Nodes outside parent boundary
                      </span>
                    )}
                    {overlapNames.length > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} /> Boundary overlaps with {overlapNames.join(", ")}
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={saveBoundary}
                  disabled={!canSave || !hasUnsaved}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                    canSave && hasUnsaved
                      ? "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                      : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
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

            <div ref={mapAreaRef} className="relative flex-1 overflow-hidden bg-[#dfe8e2]">
              {mode === "draw" && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-stone-900/85 px-3 py-1 text-[11px] font-medium text-white">
                  Click the map to add nodes to {selected.name}
                </div>
              )}
              {mode === "editNodes" && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-sky-900/85 px-3 py-1 text-[11px] font-medium text-white">
                  Drag nodes to reposition · click a node's × to remove it
                </div>
              )}

              <svg
                ref={svgRef}
                viewBox={`${view.x} ${view.y} ${1000 / view.zoom} ${800 / view.zoom}`}
                className="h-full w-full"
                style={{ cursor: mode === "draw" ? "crosshair" : panActive ? "grab" : "default" }}
                onClick={handleMapClick}
                onMouseDown={startPan}
                onMouseMove={handleMapMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                onTouchStart={startPanTouch}
                onTouchMove={handleTouchMove}
                onTouchEnd={stopDrag}
                onTouchCancel={stopDrag}
              >
                <defs>
                  <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path
                      d="M 28 0 L 0 0 0 28"
                      fill="none"
                      stroke="#c9d6cc"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="1000" height="800" fill="url(#grid)" />

                {/* other regions, faint */}
                {visibleRegions
                  .filter((r) => r.id !== selected.id)
                  .map((r) => (
                    <polygon
                      key={r.id}
                      points={polygonToPoints(r.nodes)}
                      fill="none"
                      stroke={STROKE_BY_BADGE[effectiveBadge(r)]}
                      strokeOpacity="0.28"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  ))}

                {/* selected polygon */}
                {selected.visible && (
                  <>
                    <polygon
                      points={polygonToPoints(selected.nodes)}
                      fill={STROKE_BY_BADGE[effectiveBadge(selected)]}
                      fillOpacity="0.07"
                      stroke={STROKE_BY_BADGE[effectiveBadge(selected)]}
                      strokeWidth="2.5"
                    />
                    {selected.nodes.map((n, i) => (
                      <g
                        key={i}
                        transform={`translate(${n.x}, ${n.y})`}
                        onMouseDown={handleNodeMouseDown(i)}
                        onTouchStart={handleNodeTouchStart(i)}
                        style={{ cursor: mode === "editNodes" ? "grab" : "default" }}
                      >
                        <circle r="9" fill="#fff" stroke={STROKE_BY_BADGE[effectiveBadge(selected)]} strokeWidth="2.5" />
                        <circle r="3" fill={STROKE_BY_BADGE[effectiveBadge(selected)]} />
                        {mode === "editNodes" && (
                          <g
                            transform="translate(14,-14)"
                            onClick={removeNode(i)}
                            style={{ cursor: "pointer" }}
                          >
                            <circle r="7" fill="#b91c1c" />
                            <line x1="-3" y1="-3" x2="3" y2="3" stroke="white" strokeWidth="1.4" />
                            <line x1="3" y1="-3" x2="-3" y2="3" stroke="white" strokeWidth="1.4" />
                          </g>
                        )}
                      </g>
                    ))}
                  </>
                )}
              </svg>

              {/* Map controls */}
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
                <MapControlButton icon={ZoomIn} label="Zoom in" onClick={() => zoomBy(1.25)} />
                <MapControlButton icon={ZoomOut} label="Zoom out" onClick={() => zoomBy(0.8)} />
                <MapControlButton icon={Scan} label="Fit all boundaries" onClick={fitAll} />
                <MapControlButton icon={RotateCcw} label="Reset view" onClick={resetView} />
                <MapControlButton icon={Move} label="Pan" active={panActive} onClick={() => setPanActive((p) => !p)} />
                <MapControlButton
                  icon={isFullscreen ? Minimize2 : Maximize2}
                  label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  onClick={toggleFullscreen}
                />
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 right-4 rounded-lg border border-stone-200 bg-white/95 px-3.5 py-3 text-[11px] shadow-sm backdrop-blur">
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
          </main>

          {/* Right / secondary panel */}
          <aside className="flex max-h-[50vh] w-full shrink-0 flex-col border-t border-stone-200 bg-white md:max-h-none lg:w-[22rem] lg:border-l lg:border-t-0">
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
              {mode === "editDetails" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-stone-500">Boundary Name</label>
                    <input
                      type="text"
                      value={selected.name}
                      onChange={(e) => setDetails({ name: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
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
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
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
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
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
                              ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]"
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
              )}

              {/* Geofence impact summary */}
              <div className="rounded-xl border border-stone-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-stone-900">Geofence Impact</h3>
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                    Prototype data
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Metric value={impact.iot} label="IoT Nodes" />
                  <Metric value={impact.cameras} label="CCTV Cameras" />
                  <Metric value={impact.routes} label="Patrol Routes" />
                </div>
                <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Used by</p>
                <div className="flex flex-wrap gap-1.5">
                  {IMPACT_USED_BY.map((u) => (
                    <span
                      key={u}
                      className="rounded-full border border-stone-200 px-2.5 py-0.5 text-[11px] text-stone-600"
                    >
                      {u}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[10.5px] leading-relaxed text-stone-400">
                  Mock resource counts shown until backend relationships are integrated.
                </p>
              </div>
            </div>

            <div className="border-t border-stone-200 p-4">
              {mode === "editDetails" ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={saveBoundary}
                    disabled={!canSave || !hasUnsaved}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold shadow-sm transition ${
                      canSave && hasUnsaved
                        ? "bg-[#0038A8] text-white hover:bg-[#002A8C]"
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
              ) : (
                <button
                  onClick={startDetailsEdit}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0038A8] py-2.5 text-sm font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                >
                  <Pencil className="h-4 w-4" /> Edit Boundary
                </button>
              )}
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
            className="mb-4 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
          />

          <label className="mb-1 block text-[12px] font-medium text-stone-500">Boundary Type</label>
          <div className="mb-4 flex gap-3">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => changeAddType(t)}
                className={`flex-1 rounded-lg border py-2.5 text-[13px] font-medium transition ${
                  newBoundaryType === t
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

          {newBoundaryType === "Sub-zone" && (
            <>
              <label className="mb-1 block text-[12px] font-medium text-stone-500">Parent Boundary</label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="mb-4 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
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
            className="mb-6 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={confirmAddBoundary}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
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

      {confirmArchive && (
        <ConfirmModal
          type="confirm"
          title={confirmArchive.restore ? "Confirm Restore" : "Confirm Archive"}
          message={
            confirmArchive.restore
              ? "Are you sure you want to restore this archived boundary? It becomes Active again and returns to the map."
              : "Are you sure you want to archive this boundary? It is retained for historical records and references, but hidden from the map as Inactive."
          }
          onConfirm={() => {
            const { id, restore } = confirmArchive;
            const target = regions.find((r) => r.id === id);
            if (!target) return;
            if (target.badge === "Primary") {
              showProtected(`"${target.name}" is the Primary boundary and cannot be archived.`);
              setConfirmArchive(null);
              return;
            }
            const next = restore ? { ...target, status: "Active" as const, visible: true } : { ...target, status: "Inactive" as const, visible: false };
            setRegions((rs) => rs.map((r) => (r.id === id ? next : r)));
            setSavedRegions((rs) => rs.map((r) => (r.id === id ? { ...next } : r)));
            pushAuditLog(
              restore ? "Boundary Restored" : "Boundary Archived",
              [
                restore
                  ? `Restored archived boundary "${target.name}" (Inactive → Active)`
                  : `Archived boundary "${target.name}" (retained for historical references, Active → Inactive)`,
                `Updated by: ${currentAdmin()}`,
                fmtStamp(new Date()),
              ].join("\n")
            );
            setModalMessage(
              restore
                ? { title: "Boundary Restored", message: `Restored "${target.name}"` }
                : { title: "Boundary Archived", message: `Archived "${target.name}" — retained for historical references` }
            );
            setConfirmArchive(null);
          }}
          onClose={() => setConfirmArchive(null)}
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
