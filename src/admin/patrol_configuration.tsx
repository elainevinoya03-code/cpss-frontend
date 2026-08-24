import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from "react";
import {
  Pencil,
  Trash2,
  Route,
  MousePointer2,
  Save,
  Plus,
  Undo2,
  Redo2,
  RotateCcw,
  AlertTriangle,
  Footprints,
  Car,
  Bike,
  MapPin,
  Clock,
  Info,
  ShieldAlert,
  DoorOpen,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Move,
  type LucideIcon,
} from "lucide-react";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";

const UndoIcon = Undo2;
const RedoIcon = Redo2;
const ResetIcon = RotateCcw;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const formatDateTime = (d: Date) => {
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
};

type CheckpointType = "Regular" | "High-risk" | "Entry/Exit";

type Checkpoint = {
  x: number;
  y: number;
  name?: string;
  type?: CheckpointType;
  stopDuration?: number;
  notes?: string;
};

type RouteStatus = "Active" | "Draft";

type PatrolRoute = {
  id: string;
  name: string;
  description: string;
  type: string;
  zone: string;
  status: RouteStatus;
  edited: string;
  editedAt: string;
  createdBy: string;
  editedBy: string;
  checkpoints: Checkpoint[];
  savedCheckpoints: Checkpoint[];
};

type PendingAction =
  | { type: "switchRoute"; id: string; nextMode?: "view" | "draw" | "editNodes" }
  | { type: "exitEdit" }
  | { type: "leavePage" };

type NavGuardRef = { current: (() => boolean) | null };

// Mirrors the primary boundary used on the Digital Boundaries map for containment checks
const PRIMARY_BOUNDARY = [
  { x: 720, y: 90 },
  { x: 250, y: 145 },
  { x: 165, y: 260 },
  { x: 460, y: 480 },
  { x: 340, y: 705 },
  { x: 665, y: 615 },
  { x: 855, y: 305 },
];

const PATROL_TYPES = ["Foot Patrol", "Mobile Patrol", "Bicycle Patrol"];

const ZONE_OPTIONS = [
  "Purok 1 — Riverside",
  "Purok 2 — Chapel Area",
  "Purok 3 — Market Zone",
  "Purok 4 — School District",
  "Main Barangay Boundary",
  "Evacuation Zone Alpha",
];

const CHECKPOINT_TYPES: { value: CheckpointType; label: string; icon: LucideIcon }[] = [
  { value: "Regular", label: "Regular", icon: MapPin },
  { value: "High-risk", label: "High-risk", icon: ShieldAlert },
  { value: "Entry/Exit", label: "Entry/Exit", icon: DoorOpen },
];

const TYPE_ICONS: Record<string, LucideIcon> = {
  "Foot Patrol": Footprints,
  "Mobile Patrol": Car,
  "Bicycle Patrol": Bike,
};

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Draft: "bg-amber-50 text-amber-700",
};

// Consistent geographic scale: the 1000x800 canvas converts to a plausible
// small-barangay ground distance (SVG px -> km) rather than treating pixels as km.
const PX_TO_KM = 1 / 90;

const SPEED_KMH: Record<string, number> = {
  "Foot Patrol": 4,
  "Mobile Patrol": 20,
  "Bicycle Patrol": 12,
};

const MIN_CHECKPOINT_DISTANCE = 26;
const OVERLAP_DISTANCE = 4;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Number of active patrol schedules currently referencing each route. Read-only
// reference maintained by the Desk Officer / scheduler — never managed here.
const SCHEDULE_USAGE: Record<string, number> = { r1: 2, r2: 1 };

function pointInPolygon(p: { x: number; y: number }, nodes: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
    const xi = nodes[i].x, yi = nodes[i].y;
    const xj = nodes[j].x, yj = nodes[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function crossProduct(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) {
  return (
    q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)
  );
}

function segmentsIntersect(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
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

function hasSelfIntersection(cps: Checkpoint[]) {
  for (let i = 0; i < cps.length - 1; i++) {
    for (let j = i + 1; j < cps.length - 1; j++) {
      if (j === i + 1) continue;
      if (segmentsIntersect(cps[i], cps[i + 1], cps[j], cps[j + 1])) return true;
    }
  }
  return false;
}

// Euclidean length of the open polyline, scaled by the map's geographic scale
function routeKm(cps: Checkpoint[]) {
  let total = 0;
  for (let i = 1; i < cps.length; i++) total += dist(cps[i - 1], cps[i]);
  return total * PX_TO_KM;
}

function patrolDurationMin(route: PatrolRoute) {
  const speed = SPEED_KMH[route.type] ?? 5;
  const travelMin = (routeKm(route.checkpoints) / speed) * 60;
  const stops = route.checkpoints.reduce((s, c) => s + (c.stopDuration ?? 0), 0);
  return Math.max(1, Math.round(travelMin + stops));
}

const fmtMinutes = (m: number) => {
  const mins = Math.round(m);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
};

const checkpointLabel = (c: Checkpoint, i: number) => (c.name?.trim() ? c.name.trim() : `Checkpoint ${i + 1}`);

const seedRoutes = (): PatrolRoute[] => {
  const make = (route: Omit<PatrolRoute, "savedCheckpoints">): PatrolRoute => ({
    ...route,
    savedCheckpoints: route.checkpoints.map((c) => ({ ...c })),
  });
  return [
    make({
      id: "r1",
      name: "Purok 1 Perimeter Patrol",
      description: "Night patrol around the Riverside sector covering the watch post, bridge, and flood-line marker.",
      type: "Foot Patrol",
      zone: "Purok 1 — Riverside",
      status: "Active",
      edited: "2026-07-18",
      editedAt: "Jul 18, 2026 · 2:40 PM",
      createdBy: "System Admin",
      editedBy: "System Admin",
      checkpoints: [
        { x: 250, y: 145, name: "Riverside Gate", type: "Entry/Exit", stopDuration: 2, notes: "Verify gate lock and perimeter lights." },
        { x: 300, y: 220, name: "Bamboo Bridge", type: "Regular", stopDuration: 0, notes: "" },
        { x: 340, y: 320, name: "Flood-line Marker", type: "High-risk", stopDuration: 4, notes: "Watch for rising water-level marker." },
        { x: 260, y: 360, name: "Chapel Corner", type: "Regular", stopDuration: 0, notes: "" },
        { x: 200, y: 280, name: "Purok 1 Watch Post", type: "Entry/Exit", stopDuration: 3, notes: "Check in with the watch post." },
      ],
    }),
    make({
      id: "r2",
      name: "Market Row Sweep",
      description: "Day sweep of the market stalls, dry-goods row, and fish market end.",
      type: "Foot Patrol",
      zone: "Purok 3 — Market Zone",
      status: "Active",
      edited: "2026-07-19",
      editedAt: "Jul 19, 2026 · 9:12 AM",
      createdBy: "System Admin",
      editedBy: "System Admin",
      checkpoints: [
        { x: 855, y: 305, name: "Market Main Gate", type: "Entry/Exit", stopDuration: 2, notes: "Confirm gate is open." },
        { x: 780, y: 380, name: "Vegetable Stalls", type: "High-risk", stopDuration: 4, notes: "Check stalls for theft and congestion." },
        { x: 700, y: 470, name: "Dry Goods Row", type: "Regular", stopDuration: 0, notes: "" },
        { x: 780, y: 520, name: "Fish Market End", type: "Entry/Exit", stopDuration: 3, notes: "Watch pedestrian entrance." },
        { x: 880, y: 460, name: "Market South Corner", type: "Regular", stopDuration: 0, notes: "" },
      ],
    }),
    make({
      id: "r3",
      name: "Riverside Flood Line",
      description: "Mobile check of the flood gates and evacuation ramp during rainy season.",
      type: "Mobile Patrol",
      zone: "Purok 1 — Riverside",
      status: "Draft",
      edited: "2026-07-12",
      editedAt: "Jul 12, 2026 · 4:05 PM",
      createdBy: "System Admin",
      editedBy: "System Admin",
      checkpoints: [
        { x: 250, y: 145, name: "Flood Gate", type: "Entry/Exit", stopDuration: 2, notes: "Check floodgate seal." },
        { x: 400, y: 300, name: "Mid River Bend", type: "High-risk", stopDuration: 3, notes: "High current area during heavy rain." },
        { x: 500, y: 480, name: "Evacuation Ramp", type: "Entry/Exit", stopDuration: 2, notes: "Keep ramp clear." },
      ],
    }),
  ];
};

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

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="mt-0.5 truncate text-[12.5px] font-medium text-stone-800">{children}</div>
    </div>
  );
}

function CheckpointConfigModal({
  index,
  checkpoint,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  index: number;
  checkpoint: Checkpoint;
  canDelete: boolean;
  onSave: (patch: { name?: string; type?: CheckpointType; stopDuration?: number; notes?: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(checkpoint.name ?? "");
  const [type, setType] = useState<CheckpointType>(checkpoint.type ?? "Regular");
  const [stopDuration, setStopDuration] = useState(checkpoint.stopDuration ?? 0);
  const [notes, setNotes] = useState(checkpoint.notes ?? "");

  const label = name.trim() || `Checkpoint ${index + 1}`;

  return (
    <Modal
      onClose={onClose}
      title={`Checkpoint ${String(index + 1).padStart(2, "0")}`}
      subtitle={label}
      icon={<MapPin className="h-5 w-5" />}
      size="lg"
    >
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
        <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
          Location ({checkpoint.x.toFixed(0)}, {checkpoint.y.toFixed(0)})
        </span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">{type}</span>
        {stopDuration > 0 && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">Stop: {stopDuration} min</span>
        )}
      </div>

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Checkpoint Name / Label</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`e.g. Checkpoint ${String(index + 1).padStart(2, "0")} — Market Entrance`}
        className="mb-4 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
      />

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Checkpoint Type</label>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {CHECKPOINT_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-medium transition ${
                type === t.value
                  ? "border-rose-400 bg-rose-50 text-rose-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Required Stop Duration (minutes)</label>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setStopDuration((v) => Math.max(0, v - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={60}
          value={stopDuration}
          onChange={(e) => setStopDuration(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
          className="w-20 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-center text-[13px] font-semibold text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
        />
        <button
          onClick={() => setStopDuration((v) => Math.min(60, v + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
        >
          +
        </button>
        <span className="text-[11px] text-stone-400">minutes at this checkpoint</span>
      </div>

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Notes / Instructions</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="e.g. Check stalls and pedestrian entrance."
        className="mb-6 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
      />

      <div className="flex items-center gap-2">
        {canDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Checkpoint
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, type, stopDuration, notes })}
            className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-medium text-white shadow-sm hover:bg-[#002A8C]"
          >
            <Save className="h-3.5 w-3.5" /> Save Checkpoint
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RouteInfoModal({
  route,
  onSave,
  onClose,
}: {
  route: PatrolRoute;
  onSave: (patch: { name: string; description: string; type: string; zone: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(route.name);
  const [description, setDescription] = useState(route.description ?? "");
  const [type, setType] = useState(route.type);
  const [zone, setZone] = useState(route.zone);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Route name is required.");
      return;
    }
    onSave({ name: trimmed, description: description.trim(), type, zone });
  };

  return (
    <Modal onClose={onClose} title="Edit Route Info" subtitle={route.name} icon={<Pencil className="h-5 w-5" />} size="lg">
      <label className="mb-1 block text-[12px] font-medium text-stone-500">Route Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        placeholder='e.g. "Purok 5 Coastal Patrol"'
        className="mb-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
      />
      {error && (
        <p className="mb-3 flex items-center gap-1.5 text-[11.5px] font-medium text-rose-600">
          <AlertTriangle size={12} /> {error}
        </p>
      )}
      {!error && <p className="mb-3 text-[11px] text-stone-400">Route names must be unique.</p>}

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="e.g. Night patrol around the Riverside sector covering the watch post and bridge."
        className="mb-4 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
      />

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Patrol Type</label>
      <div className="mb-4 flex gap-2">
        {PATROL_TYPES.map((t) => {
          const Icon = TYPE_ICONS[t as keyof typeof TYPE_ICONS];
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[13px] font-medium transition ${
                type === t
                  ? "border-rose-400 bg-rose-50 text-rose-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              <Icon size={14} />
              {t.replace(" Patrol", "")}
            </button>
          );
        })}
      </div>

      <label className="mb-1 block text-[12px] font-medium text-stone-500">Purok / Zone / Boundary</label>
      <select
        value={zone}
        onChange={(e) => setZone(e.target.value)}
        className="mb-6 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
      >
        {ZONE_OPTIONS.map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-stone-200 px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-medium text-white shadow-sm hover:bg-[#002A8C]"
        >
          <Save className="h-3.5 w-3.5" /> Save Route Info
        </button>
      </div>
    </Modal>
  );
}

export default function PatrolConfiguration({
  navGuardRef,
  onDiscardNavigate,
}: {
  navGuardRef?: NavGuardRef;
  onDiscardNavigate?: () => void;
}) {
  const [routes, setRoutes] = useState<PatrolRoute[]>(seedRoutes);
  const [selectedId, setSelectedId] = useState("r1");
  const [mode, setMode] = useState<"view" | "draw" | "editNodes">("view"); // view | draw | editNodes
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [confirmDeleteRoute, setConfirmDeleteRoute] = useState<string | null>(null);
  const [blockedDeleteRoute, setBlockedDeleteRoute] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteDesc, setNewRouteDesc] = useState("");
  const [newRouteType, setNewRouteType] = useState(PATROL_TYPES[0]);
  const [newRouteZone, setNewRouteZone] = useState(ZONE_OPTIONS[0]);
  const [addError, setAddError] = useState<string | null>(null);
  const [editInfoId, setEditInfoId] = useState<string | null>(null);
  const [configIndex, setConfigIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<{ states: Checkpoint[][]; pos: number }>({ states: [], pos: -1 });
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [panActive, setPanActive] = useState(false);
  const [panState, setPanState] = useState<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const [showUnsaved, setShowUnsaved] = useState<PendingAction | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const latestMove = useRef<Checkpoint[]>([]);
  const dragDownRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);

  const scrollbarCss = `
    .pr-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .pr-scroll::-webkit-scrollbar-track { background: transparent; }
    .pr-scroll::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
    .pr-scroll { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
  `;

  const selected = useMemo(
    () => routes.find((r) => r.id === selectedId) ?? routes[0],
    [routes, selectedId]
  );

  const isDirty = useMemo(() => {
    if (!selected) return false;
    if (!selected.savedCheckpoints) return selected.checkpoints.length > 0;
    return JSON.stringify(selected.checkpoints) !== JSON.stringify(selected.savedCheckpoints);
  }, [selected]);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    const cps = selected.checkpoints;
    if (cps.length < 2) {
      errs.push(`Add at least 2 checkpoints — currently ${cps.length}.`);
    } else {
      cps.forEach((c, i) => {
        if (!pointInPolygon(c, PRIMARY_BOUNDARY)) {
          errs.push(`Checkpoint ${i + 1} is outside the primary boundary.`);
        }
      });
      for (let i = 0; i + 1 < cps.length; i++) {
        const a = cps[i], b = cps[i + 1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (!pointInPolygon(mid, PRIMARY_BOUNDARY)) {
          errs.push(`Route crosses outside the primary boundary between Checkpoint ${i + 1} and Checkpoint ${i + 2}.`);
        }
      }
      for (let i = 0; i < cps.length; i++) {
        for (let j = i + 1; j < cps.length; j++) {
          const d = dist(cps[i], cps[j]);
          if (d < OVERLAP_DISTANCE) errs.push(`Checkpoint ${j + 1} overlaps Checkpoint ${i + 1}.`);
          else if (d < MIN_CHECKPOINT_DISTANCE) errs.push(`Checkpoint ${j + 1} is too close to Checkpoint ${i + 1}.`);
        }
      }
      for (let i = 0; i + 1 < cps.length; i++) {
        if (dist(cps[i], cps[i + 1]) < 1) {
          errs.push(`Segment between Checkpoint ${i + 1} and Checkpoint ${i + 2} has zero length.`);
        }
      }
      if (hasSelfIntersection(cps)) {
        errs.push("Route path self-intersects — drag checkpoints to fix the crossing.");
      }
      if (routeKm(cps) < 0.01) {
        errs.push("Route has zero length — place checkpoints at distinct locations.");
      }
    }
    if (selected.name.trim()) {
      const dupName = routes.some(
        (r) => r.id !== selected.id && r.name.trim().toLowerCase() === selected.name.trim().toLowerCase()
      );
      if (dupName) errs.push(`Another route is already named "${selected.name}".`);
    }
    return errs;
  }, [selected, routes]);

  const canSave = validationErrors.length === 0;

  const canUndo = history.pos > 0;
  const canRedo = history.pos < history.states.length - 1;

  const beginSession = useCallback(
    (id: string) => {
      const r = routes.find((x) => x.id === id);
      const cps = (r?.checkpoints ?? []).map((c) => ({ ...c }));
      setHistory({ states: [cps], pos: 0 });
    },
    [routes]
  );

  const applyCheckpoints = useCallback(
    (next: Checkpoint[]) => {
      setRoutes((rs) => rs.map((r) => (r.id === selectedId ? { ...r, checkpoints: next } : r)));
    },
    [selectedId]
  );

  const commitCheckpoints = useCallback(
    (next: Checkpoint[]) => {
      applyCheckpoints(next);
      setHistory((h) => {
        const prefix = h.states.slice(0, h.pos + 1);
        const last = prefix[prefix.length - 1];
        if (last && JSON.stringify(last) === JSON.stringify(next)) return h;
        return { states: [...prefix, next.map((c) => ({ ...c }))], pos: prefix.length };
      });
    },
    [applyCheckpoints]
  );

  const undoEdit = () => {
    if (!canUndo) return;
    const target = history.states[history.pos - 1];
    applyCheckpoints(target.map((c) => ({ ...c })));
    setHistory({ ...history, pos: history.pos - 1 });
  };

  const redoEdit = () => {
    if (!canRedo) return;
    const target = history.states[history.pos + 1];
    applyCheckpoints(target.map((c) => ({ ...c })));
    setHistory({ ...history, pos: history.pos + 1 });
  };

  const resetEdits = () => {
    const base = history.states[0];
    if (!base) return;
    applyCheckpoints(base.map((c) => ({ ...c })));
    setHistory({ states: [base.map((c) => ({ ...c }))], pos: 0 });
  };

  const svgPoint = (evt: any) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const x = view.x + ((clientX - rect.left) / rect.width) * (1000 / view.zoom);
    const y = view.y + ((clientY - rect.top) / rect.height) * (800 / view.zoom);
    return {
      x: Math.max(20, Math.min(980, x)),
      y: Math.max(20, Math.min(780, y)),
    };
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

  const handleMapClick = (evt) => {
    if (mode !== "draw") return;
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    const p = svgPoint(evt);
    const cp: Checkpoint = { x: p.x, y: p.y, name: "", type: "Regular", stopDuration: 0, notes: "" };
    commitCheckpoints([...selected.checkpoints, cp]);
    setConfigIndex(selected.checkpoints.length);
  };

  const handleNodeMouseDown = (idx: number) => (evt) => {
    if (mode !== "editNodes") return;
    evt.stopPropagation();
    dragDownRef.current = { x: evt.clientX, y: evt.clientY };
    dragMovedRef.current = false;
    latestMove.current = selected.checkpoints;
    commitCheckpoints(selected.checkpoints);
    setDragIndex(idx);
  };

  const handleNodeTouchStart = (idx: number) => (evt) => {
    if (mode !== "editNodes") return;
    evt.stopPropagation();
    const t = evt.touches?.[0];
    dragDownRef.current = t ? { x: t.clientX, y: t.clientY } : null;
    dragMovedRef.current = false;
    latestMove.current = selected.checkpoints;
    commitCheckpoints(selected.checkpoints);
    setDragIndex(idx);
  };

  const applyPointerMove = (evt) => {
    if (dragIndex !== null && mode === "editNodes") {
      const cx = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const cy = evt.touches ? evt.touches[0].clientY : evt.clientY;
      if (dragDownRef.current && Math.hypot(cx - dragDownRef.current.x, cy - dragDownRef.current.y) > 6) {
        dragMovedRef.current = true;
      }
      const p = svgPoint(evt);
      const next = selected.checkpoints.map((c, i) => (i === dragIndex ? p : c));
      latestMove.current = next;
      applyCheckpoints(next);
      return;
    }
    if (panState) {
      const svg = svgRef.current;
      if (!svg) return;
      const cx = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const cy = evt.touches ? evt.touches[0].clientY : evt.clientY;
      if (dragDownRef.current && Math.hypot(cx - dragDownRef.current.x, cy - dragDownRef.current.y) > 6) {
        dragMovedRef.current = true;
      }
      const rect = svg.getBoundingClientRect();
      const vbW = 1000 / view.zoom;
      const vbH = 800 / view.zoom;
      const dx = ((cx - panState.startX) / rect.width) * vbW;
      const dy = ((cy - panState.startY) / rect.height) * vbH;
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
    dragDownRef.current = { x: evt.clientX, y: evt.clientY };
    dragMovedRef.current = false;
    if (mode === "draw" && !panActive) return;
    setPanState({ startX: evt.clientX, startY: evt.clientY, viewX: view.x, viewY: view.y });
  };

  const startPanTouch = (evt) => {
    const t = evt.touches?.[0];
    dragDownRef.current = t ? { x: t.clientX, y: t.clientY } : null;
    dragMovedRef.current = false;
    if ((mode === "draw" && !panActive) || !t) return;
    setPanState({ startX: t.clientX, startY: t.clientY, viewX: view.x, viewY: view.y });
  };

  const stopDrag = () => {
    if (dragIndex !== null) {
      commitCheckpoints(latestMove.current);
      latestMove.current = [];
    }
    setDragIndex(null);
    setPanState(null);
  };

  const removeCheckpoint = (idx: number) => (evt) => {
    evt.stopPropagation();
    if (mode !== "editNodes") return;
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (selected.checkpoints.length <= 2) return;
    commitCheckpoints(selected.checkpoints.filter((_, i) => i !== idx));
  };

  const removeCheckpointByIndex = (idx: number) => {
    if (selected.checkpoints.length <= 2) return;
    commitCheckpoints(selected.checkpoints.filter((_, i) => i !== idx));
    setConfigIndex(null);
  };

  const saveCheckpointConfig = (index: number, patch: Partial<Checkpoint>) => {
    const next = selected.checkpoints.map((c, i) => (i === index ? { ...c, ...patch } : c));
    commitCheckpoints(next);
    setConfigIndex(null);
  };

  const moveCheckpoint = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.checkpoints.length) return;
    const next = selected.checkpoints.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commitCheckpoints(next);
  };

  const saveRouteInfo = (patch: { name: string; description: string; type: string; zone: string }) => {
    const targetId = editInfoId ?? selectedId;
    const target = routes.find((r) => r.id === targetId);
    if (!target) return;
    const dupName = routes.some(
      (r) => r.id !== targetId && r.name.trim().toLowerCase() === patch.name.trim().toLowerCase()
    );
    if (dupName) {
      setModalMessage({ title: "Duplicate Route Name", message: `Another route is already named "${patch.name}".` });
      return;
    }
    const now = new Date();
    const changed: string[] = [];
    if (patch.name !== target.name) changed.push(`renamed to "${patch.name}"`);
    if (patch.type !== target.type) changed.push(`patrol type ${target.type} → ${patch.type}`);
    if (patch.zone !== target.zone) changed.push(`zone ${target.zone} → ${patch.zone}`);
    if (patch.description !== (target.description ?? "")) changed.push("description updated");
    setRoutes((rs) =>
      rs.map((r) =>
        r.id === targetId
          ? {
              ...r,
              name: patch.name,
              description: patch.description,
              type: patch.type,
              zone: patch.zone,
              edited: todayStr(),
              editedAt: formatDateTime(now),
              editedBy: "System Admin",
            }
          : r
      )
    );
    pushAuditLog(
      "Patrol Routes",
      `Updated patrol route "${patch.name}" — ${changed.length ? changed.join("; ") : "route info saved"} (changed by System Admin)`
    );
    setEditInfoId(null);
    setModalMessage({ title: "Route Info Saved", message: `Updated route info for "${patch.name}"` });
  };

  const performSave = (after?: () => void) => {
    if (!canSave) return;
    const r = selected;
    const prevCount = r.savedCheckpoints.length;
    const prevKm = routeKm(r.savedCheckpoints);
    const newCount = r.checkpoints.length;
    const newKm = routeKm(r.checkpoints);
    const now = new Date();
    const saved = r.checkpoints.map((c) => ({ ...c }));
    setRoutes((rs) =>
      rs.map((x) =>
        x.id === selectedId
          ? {
              ...x,
              savedCheckpoints: saved,
              edited: todayStr(),
              editedAt: formatDateTime(now),
              editedBy: "System Admin",
              status: "Active" as const,
            }
          : x
      )
    );
    const desc =
      r.status === "Draft"
        ? `Saved patrol route "${r.name}" — ${newCount} checkpoints (${newKm.toFixed(2)} km), status Draft → Active (changed by System Admin)`
        : `Updated Patrol Route "${r.name}" — ${prevCount} → ${newCount} checkpoints, ${prevKm.toFixed(2)} km → ${newKm.toFixed(2)} km, status ${r.status} → Active (changed by System Admin)`;
    pushAuditLog("Patrol Routes", desc);
    setMode("view");
    setHistory({ states: [saved.map((c) => ({ ...c }))], pos: 0 });
    setModalMessage({ title: "Route Saved", message: `${r.name} saved — ${newCount} checkpoints · ${newKm.toFixed(2)} km` });
    after?.();
  };

  const saveRoute = () => performSave();

  const selectRoute = (id: string, nextMode: "view" | "draw" | "editNodes" = "view") => {
    setSelectedId(id);
    setMode(nextMode);
    beginSession(id);
  };

  const requestSelectRoute = (id: string, nextMode: "view" | "draw" | "editNodes" = "view") => {
    if (id === selectedId) {
      if (nextMode === mode) return;
      if (mode !== "view" && isDirty) {
        setShowUnsaved({ type: "exitEdit" });
        return;
      }
      setMode(nextMode);
      beginSession(id);
      return;
    }
    if (isDirty) {
      setShowUnsaved({ type: "switchRoute", id, nextMode });
      return;
    }
    selectRoute(id, nextMode);
  };

  const toggleDraw = () => {
    if (mode === "draw") {
      if (isDirty) {
        setShowUnsaved({ type: "exitEdit" });
        return;
      }
      setMode("view");
      return;
    }
    beginSession(selectedId);
    setMode("draw");
  };

  const toggleEditNodes = () => {
    if (mode === "editNodes") {
      if (isDirty) {
        setShowUnsaved({ type: "exitEdit" });
        return;
      }
      setMode("view");
      return;
    }
    beginSession(selectedId);
    setMode("editNodes");
  };

  const cancelUnsaved = () => setShowUnsaved(null);

  const completeAction = (action: PendingAction) => {
    if (action.type === "switchRoute") {
      setSelectedId(action.id);
      setMode(action.nextMode ?? "view");
      beginSession(action.id);
    } else if (action.type === "exitEdit") {
      setMode("view");
    } else if (action.type === "leavePage") {
      onDiscardNavigate?.();
    }
  };

  const discardAndContinue = () => {
    if (!showUnsaved) return;
    const action = showUnsaved;
    const saved = selected.savedCheckpoints.map((c) => ({ ...c }));
    setRoutes((rs) => rs.map((r) => (r.id === selectedId ? { ...r, checkpoints: saved } : r)));
    setShowUnsaved(null);
    completeAction(action);
  };

  const saveAndContinue = () => {
    if (!showUnsaved || !canSave) return;
    const action = showUnsaved;
    performSave(() => {
      setShowUnsaved(null);
      completeAction(action);
    });
  };

  const requestDeleteRoute = (id: string) => {
    if (routes.length <= 1) {
      setModalMessage({ title: "Cannot Delete Route", message: "At least one patrol route must remain configured." });
      return;
    }
    const usage = SCHEDULE_USAGE[id] ?? 0;
    if (usage > 0) {
      setBlockedDeleteRoute(id);
      return;
    }
    setConfirmDeleteRoute(id);
  };

  const deleteRoute = () => {
    const id = confirmDeleteRoute!;
    const deleted = routes.find((r) => r.id === id);
    const remaining = routes.filter((r) => r.id !== id);
    setRoutes(remaining);
    if (selectedId === id) {
      const nextId = remaining[0]?.id ?? id;
      setSelectedId(nextId);
      setMode("view");
      beginSession(nextId);
    }
    pushAuditLog(
      "Patrol Routes",
      `Deleted patrol route "${deleted?.name ?? id}" — was ${deleted?.status}, ${deleted?.checkpoints.length} checkpoints (${routeKm(deleted?.checkpoints ?? []).toFixed(2)} km)`
    );
    setModalMessage({ title: "Route Deleted", message: "Patrol route deleted" });
    setConfirmDeleteRoute(null);
  };

  const confirmAddRoute = () => {
    const name = newRouteName.trim();
    if (!name) {
      setAddError("Route name is required.");
      return;
    }
    if (routes.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
      setAddError(`A route named "${name}" already exists.`);
      return;
    }
    const id = `route-${Date.now()}`;
    const n = routes.length + 1;
    const cx = 300 + ((n * 137) % 400);
    const cy = 250 + ((n * 211) % 300);
    const checkpoints: Checkpoint[] = [
      { x: cx, y: cy, name: "", type: "Regular", stopDuration: 0, notes: "" },
      { x: cx + 120, y: cy + 40, name: "", type: "Regular", stopDuration: 0, notes: "" },
      { x: cx + 60, y: cy + 130, name: "", type: "Regular", stopDuration: 0, notes: "" },
    ];
    const now = new Date();
    const newRoute: PatrolRoute = {
      id,
      name,
      description: newRouteDesc.trim(),
      type: newRouteType,
      zone: newRouteZone,
      status: "Draft",
      edited: todayStr(),
      editedAt: formatDateTime(now),
      createdBy: "System Admin",
      editedBy: "System Admin",
      checkpoints: checkpoints.map((c) => ({ ...c })),
      savedCheckpoints: checkpoints.map((c) => ({ ...c })),
    };
    setRoutes((rs) => [...rs, newRoute]);
    setSelectedId(id);
    setShowAddModal(false);
    setAddError(null);
    beginSession(id);
    setMode("draw");
    pushAuditLog(
      "Patrol Routes",
      `Created new patrol route "${name}" — ${newRouteType}, ${newRouteZone}, Draft, ${checkpoints.length} checkpoints (${routeKm(checkpoints).toFixed(2)} km)`
    );
    setModalMessage({ title: "Route Created", message: `Created "${name}" — click the map to add checkpoints` });
  };

  // Leave-page protection: register a navigation guard for the App shell and a
  // beforeunload handler so unsaved checkpoint changes are never lost silently.
  useEffect(() => {
    if (!navGuardRef) return;
    navGuardRef.current = () => {
      if (!isDirty) return true;
      setShowUnsaved({ type: "leavePage" });
      return false;
    };
    return () => {
      navGuardRef.current = null;
    };
  }, [isDirty, navGuardRef]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const points = selected.checkpoints.map((c) => `${c.x},${c.y}`).join(" ");
  const km = routeKm(selected.checkpoints);
  const duration = patrolDurationMin(selected);
  const TypeIcon = TYPE_ICONS[selected.type as keyof typeof TYPE_ICONS] ?? Route;
  const routeStroke = selected.status === "Active" ? "#0038A8" : "#b45309";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <style>{scrollbarCss}</style>
      <main className="flex flex-1 flex-col overflow-hidden px-6 py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">
            Patrol Routes &amp; Checkpoints
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Define and edit patrol routes and checkpoint boundaries
          </p>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm lg:flex-row">
          {/* Sidebar */}
          <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-b border-stone-200 lg:max-h-none lg:w-[21rem] lg:border-b-0 lg:border-r">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-base font-bold text-stone-900">Patrol Routes</h2>
              <p className="mt-0.5 text-xs text-stone-400">{routes.length} routes configured</p>
            </div>

            <div className="pr-scroll flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              {routes.map((r) => {
                const isSelected = r.id === selectedId;
                const Icon = TYPE_ICONS[r.type as keyof typeof TYPE_ICONS] ?? Route;
                return (
                  <div
                    key={r.id}
                    onClick={() => requestSelectRoute(r.id)}
                    className={`cursor-pointer rounded-xl border px-4 py-4 shadow-sm transition ${
                      isSelected
                        ? "border-rose-900 bg-rose-50/40"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[14px] font-semibold leading-snug text-stone-900 break-words min-w-0">
                        {r.name}
                      </span>
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${STATUS_STYLES[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[12px] text-stone-400">
                      <Icon size={12} />
                      {r.type} &nbsp;·&nbsp; {r.zone}
                    </div>
                    <p className="mt-1 text-[12px] text-stone-400">
                      {r.checkpoints.length} checkpoints &nbsp;&nbsp;{" "}
                      {routeKm(r.checkpoints).toFixed(2)} km &nbsp;&nbsp; Edited {r.edited}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditInfoId(r.id);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit Info
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteRoute(r.id);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-stone-200 p-4">
              <button
                onClick={() => {
                  setNewRouteName(`Route ${routes.length + 1}`);
                  setNewRouteDesc("");
                  setNewRouteType(PATROL_TYPES[0]);
                  setAddError(null);
                  setShowAddModal(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
              >
                <Plus className="h-4 w-4" /> Add New Patrol Route
              </button>
            </div>
          </aside>

          {/* Map panel */}
          <section className="flex min-h-[26rem] min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stone-200 bg-white px-6 py-3.5">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <TypeIcon size={14} className="shrink-0" />
                  <span className="truncate">{selected.name}</span>
                  {isDirty && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Unsaved
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 flex flex-wrap items-center text-xs text-stone-400">
                  <span className="font-semibold text-stone-600">{selected.checkpoints.length} Checkpoints</span>
                  <span className="mx-1.5 text-[#0038A8]">·</span>
                  <span className="font-bold text-[#0038A8]">{km.toFixed(2)} km</span>
                  <span className="mx-1.5 text-[#0038A8]">·</span>
                  ≈ {fmtMinutes(duration)}
                  <span className="mx-1.5 text-[#0038A8]">·</span>
                  {selected.zone}
                  <span className="mx-1.5 text-[#0038A8]">·</span>
                  Last edited {selected.edited}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleDraw}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    mode === "draw"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <Route className="h-3.5 w-3.5" />
                  {mode === "draw" ? "Stop Adding" : "Add Checkpoints"}
                </button>
                {(mode === "draw" || mode === "editNodes") && (
                  <>
                    <button
                      onClick={undoEdit}
                      disabled={!canUndo}
                      title="Undo last checkpoint change"
                      className="flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <UndoIcon className="h-3.5 w-3.5" /> Undo
                    </button>
                    <button
                      onClick={redoEdit}
                      disabled={!canRedo}
                      title="Redo last checkpoint change"
                      className="flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <RedoIcon className="h-3.5 w-3.5" /> Redo
                    </button>
                    <button
                      onClick={resetEdits}
                      title="Reset all unsaved checkpoint changes"
                      className="flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      <ResetIcon className="h-3.5 w-3.5" /> Reset
                    </button>
                  </>
                )}
                <button
                  onClick={toggleEditNodes}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    mode === "editNodes"
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : "border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                  {mode === "editNodes" ? "Done Editing" : "Edit Checkpoints"}
                </button>
                <button
                  onClick={saveRoute}
                  disabled={!canSave}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                    canSave
                      ? "bg-[#0038A8] text-white hover:bg-[#002A8C]"
                      : "cursor-not-allowed bg-stone-100 text-stone-400"
                  }`}
                >
                  <Save className="h-3.5 w-3.5" /> Save Route
                </button>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="border-b border-amber-200 bg-amber-50 px-6 py-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
                    <AlertTriangle size={12} /> Route requires fixes
                  </span>
                  {validationErrors.map((msg, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
                      <span className="h-1 w-1 rounded-full bg-amber-500" /> {msg}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="relative min-h-[280px] flex-1 overflow-hidden bg-[#dfe8e2]">
              {mode === "draw" && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-stone-900/85 px-3 py-1 text-[11px] font-medium text-white">
                  Click the map to add checkpoints to {selected.name}
                </div>
              )}
              {mode === "editNodes" && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-sky-900/85 px-3 py-1 text-[11px] font-medium text-white">
                  Drag checkpoints to reposition · click a checkpoint to configure it
                </div>
              )}

              <svg
                ref={svgRef}
                viewBox={`${view.x} ${view.y} ${1000 / view.zoom} ${800 / view.zoom}`}
                className="h-full w-full"
                style={{ cursor: mode === "draw" && !panActive ? "crosshair" : panActive ? "grab" : "default" }}
                onClick={handleMapClick}
                onMouseDown={startPan}
                onTouchStart={startPanTouch}
                onMouseMove={handleMapMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                onTouchEnd={stopDrag}
                onTouchCancel={stopDrag}
                onTouchMove={handleTouchMove}
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

                {/* primary boundary reference, faint */}
                <polygon
                  points={PRIMARY_BOUNDARY.map((n) => `${n.x},${n.y}`).join(" ")}
                  fill="none"
                  stroke="#9f1239"
                  strokeOpacity="0.22"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* other routes, faint */}
                {routes
                  .filter((r) => r.id !== selected.id)
                  .map((r) => (
                    <g key={r.id} opacity={0.4}>
                      <polyline
                        points={r.checkpoints.map((c) => `${c.x},${c.y}`).join(" ")}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      {r.checkpoints.map((c, i) => (
                        <circle
                          key={i}
                          cx={c.x}
                          cy={c.y}
                          r="6"
                          fill="#fff"
                          stroke="#64748b"
                          strokeWidth="2"
                        />
                      ))}
                    </g>
                  ))}

                {/* selected route polyline with directional arrows */}
                <polyline
                  points={points}
                  fill="none"
                  stroke={routeStroke}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={selected.status === "Active" ? undefined : "7 5"}
                />
                {selected.checkpoints.slice(0, -1).map((_, i) => {
                  const a = selected.checkpoints[i];
                  const b = selected.checkpoints[i + 1];
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;
                  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                  return (
                    <g key={`arrow-${i}`} transform={`translate(${mx}, ${my}) rotate(${angle})`}>
                      <path
                        d="M -7 -4.5 L 1.5 0 L -7 4.5"
                        fill="none"
                        stroke={routeStroke}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}

                {/* selected route checkpoint markers */}
                {selected.checkpoints.map((c, i) => {
                  const isStart = i === 0 && selected.checkpoints.length > 1;
                  const isEnd = i === selected.checkpoints.length - 1 && selected.checkpoints.length > 1;
                  const markerColor = isStart ? "#059669" : isEnd ? "#e11d48" : routeStroke;
                  const fill = isStart || isEnd ? markerColor : "#ffffff";
                  const textFill = isStart || isEnd ? "#ffffff" : routeStroke;
                  const isHighRisk = c.type === "High-risk";
                  return (
                    <g
                      key={i}
                      transform={`translate(${c.x}, ${c.y})`}
                      onMouseDown={handleNodeMouseDown(i)}
                      onTouchStart={handleNodeTouchStart(i)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dragMovedRef.current) {
                          dragMovedRef.current = false;
                          return;
                        }
                        setConfigIndex(i);
                      }}
                      style={{ cursor: mode === "editNodes" ? "grab" : "pointer" }}
                    >
                      {isHighRisk && (
                        <circle
                          r="14"
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="1.6"
                          strokeDasharray="3 3"
                          opacity="0.85"
                        />
                      )}
                      <circle r="11" fill={fill} stroke={markerColor} strokeWidth="2.5" />
                      <text y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill={textFill}>
                        {i + 1}
                      </text>
                      {isStart && (
                        <text y="27" textAnchor="middle" fontSize="9" fontWeight="800" fill="#059669">
                          START
                        </text>
                      )}
                      {isEnd && (
                        <text y="27" textAnchor="middle" fontSize="9" fontWeight="800" fill="#e11d48">
                          END
                        </text>
                      )}
                      {mode === "editNodes" && (
                        <g
                          transform="translate(-16,-16)"
                          onClick={removeCheckpoint(i)}
                          style={{ cursor: "pointer" }}
                        >
                          <circle r="7" fill="#b91c1c" />
                          <line x1="-3" y1="-3" x2="3" y2="3" stroke="white" strokeWidth="1.4" />
                          <line x1="3" y1="-3" x2="-3" y2="3" stroke="white" strokeWidth="1.4" />
                        </g>
                      )}
                      {mode === "editNodes" && (
                        <g
                          transform="translate(16,-16)"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dragMovedRef.current) {
                              dragMovedRef.current = false;
                              return;
                            }
                            setConfigIndex(i);
                          }}
                          style={{ cursor: "pointer" }}
                          aria-label="Configure checkpoint"
                        >
                          <title>Configure checkpoint</title>
                          <circle r="7" fill="#0369a1" />
                          <g transform="translate(-6,-6) scale(0.5)">
                            <path
                              d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="m15 5 4 4"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Map controls */}
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
                <MapControlButton icon={ZoomIn} label="Zoom in" onClick={() => zoomBy(1.25)} />
                <MapControlButton icon={ZoomOut} label="Zoom out" onClick={() => zoomBy(0.8)} />
                <MapControlButton icon={ResetIcon} label="Reset view" onClick={resetView} />
                <MapControlButton icon={Move} label="Pan" active={panActive} onClick={() => setPanActive((p) => !p)} />
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 right-4 rounded-lg border border-stone-200 bg-white/95 px-3.5 py-3 text-[11px] shadow-sm backdrop-blur">
                <p className="mb-1.5 font-semibold text-stone-700">Legend</p>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-0.5 w-4 bg-[#0038A8]" />
                  <span className="text-stone-500">Active Patrol Route</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-700" />
                  <span className="text-stone-500">Draft Route</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full border-2 border-[#0038A8]" />
                  <span className="text-stone-500">Checkpoint</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
                  <span className="text-stone-500">Start</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-600" />
                  <span className="text-stone-500">End</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-2 w-2 rounded-full border-2 border-dashed border-rose-500" />
                  <span className="text-stone-500">High-risk Checkpoint</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-rose-900/50" />
                  <span className="text-stone-500">Primary Boundary</span>
                </div>
              </div>
            </div>

            {/* Route Details panel */}
            <div className="border-t border-stone-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-400">
                  <Info size={13} /> Route Details
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditInfoId(selected.id)}
                    className="flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                  >
                    <Pencil className="h-3 w-3" /> Edit Route Info
                  </button>
                  {isDirty && (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10.5px] font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes — Save Route to keep
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                <DetailItem label="Route Name">
                  <span className="font-bold text-stone-900">{selected.name}</span>
                </DetailItem>
                <DetailItem label="Patrol Type">{selected.type}</DetailItem>
                <DetailItem label="Purok / Zone / Boundary">{selected.zone}</DetailItem>
                <DetailItem label="Description">{selected.description?.trim() || "—"}</DetailItem>
                <DetailItem label="Status">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLES[selected.status]}`}
                  >
                    {selected.status}
                  </span>
                </DetailItem>
                <DetailItem label="Checkpoints">{selected.checkpoints.length} checkpoints</DetailItem>
                <DetailItem label="Total Distance">
                  <span className="text-[15px] font-bold text-[#0038A8]">{km.toFixed(2)} km</span>
                </DetailItem>
                <DetailItem label="Estimated Duration">
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-stone-400" /> ≈ {fmtMinutes(duration)}
                  </span>
                </DetailItem>
                <DetailItem label="Last Updated">{selected.editedAt}</DetailItem>
                <DetailItem label="Created By">{selected.createdBy}</DetailItem>
                <DetailItem label="Last Edited By">{selected.editedBy}</DetailItem>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
                <span className="shrink-0 text-[10.5px] font-semibold text-stone-400">CHECKPOINTS</span>
                <div className="pr-scroll flex gap-2 overflow-x-auto pb-0.5">
                  {selected.checkpoints.map((c, i) => {
                    const isStart = i === 0 && selected.checkpoints.length > 1;
                    const isEnd = i === selected.checkpoints.length - 1 && selected.checkpoints.length > 1;
                    return (
                      <div key={i} className="flex shrink-0 items-center gap-0.5">
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveCheckpoint(i, -1)}
                            disabled={i === 0}
                            title="Move earlier in sequence"
                            aria-label={`Move checkpoint ${i + 1} earlier in sequence`}
                            className="flex h-3.5 w-5 items-center justify-center rounded-sm text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveCheckpoint(i, 1)}
                            disabled={i === selected.checkpoints.length - 1}
                            title="Move later in sequence"
                            aria-label={`Move checkpoint ${i + 1} later in sequence`}
                            className="flex h-3.5 w-5 items-center justify-center rounded-sm text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => setConfigIndex(i)}
                          className="group flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-700 transition hover:border-[#0038A8]/40 hover:bg-blue-50"
                          title="Configure checkpoint"
                        >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white ${
                            isStart ? "bg-emerald-600" : isEnd ? "bg-rose-600" : "bg-[#0038A8]"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="max-w-[10rem] truncate font-medium">{checkpointLabel(c, i)}</span>
                        {c.type && c.type !== "Regular" && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              c.type === "High-risk" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {c.type}
                          </span>
                        )}
                        {(c.stopDuration ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                            <Clock size={10} />
                            {c.stopDuration} min
                          </span>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} title="New Patrol Route">
          <label className="mb-1 block text-[12px] font-medium text-stone-500">Route Name</label>
          <input
            type="text"
            value={newRouteName}
            onChange={(e) => {
              setNewRouteName(e.target.value);
              setAddError(null);
            }}
            placeholder='e.g. "Purok 5 Coastal Patrol"'
            className="mb-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
          />
          {addError && (
            <p className="mb-3 flex items-center gap-1.5 text-[11.5px] font-medium text-rose-600">
              <AlertTriangle size={12} /> {addError}
            </p>
          )}
          {!addError && <p className="mb-3 text-[11px] text-stone-400">Route names must be unique.</p>}

          <label className="mb-1 block text-[12px] font-medium text-stone-500">Patrol Type</label>
          <div className="mb-4 flex gap-2">
            {PATROL_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t as keyof typeof TYPE_ICONS];
              return (
                <button
                  key={t}
                  onClick={() => setNewRouteType(t)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[13px] font-medium transition ${
                    newRouteType === t
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  <Icon size={14} />
                  {t.replace(" Patrol", "")}
                </button>
              );
            })}
          </div>

          <label className="mb-1 block text-[12px] font-medium text-stone-500">Description</label>
          <textarea
            value={newRouteDesc}
            onChange={(e) => setNewRouteDesc(e.target.value)}
            rows={2}
            placeholder="e.g. Night patrol around the Riverside sector covering the watch post and bridge."
            className="mb-4 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder-stone-300 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
          />

          <label className="mb-1 block text-[12px] font-medium text-stone-500">Purok / Zone / Boundary</label>
          <select
            value={newRouteZone}
            onChange={(e) => setNewRouteZone(e.target.value)}
            className="mb-6 w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[13px] text-stone-900 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/20"
          >
            {ZONE_OPTIONS.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <button
            onClick={confirmAddRoute}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
          >
            <Plus className="h-4 w-4" /> Start Adding Checkpoints
          </button>
        </Modal>
      )}

      {configIndex !== null && selected.checkpoints[configIndex] && (
        <CheckpointConfigModal
          key={`${configIndex}-${selected.checkpoints[configIndex].x}-${selected.checkpoints[configIndex].y}`}
          index={configIndex}
          checkpoint={selected.checkpoints[configIndex]}
          canDelete={selected.checkpoints.length > 2}
          onSave={(patch) => saveCheckpointConfig(configIndex, patch)}
          onDelete={() => removeCheckpointByIndex(configIndex)}
          onClose={() => setConfigIndex(null)}
        />
      )}

      {editInfoId && routes.find((r) => r.id === editInfoId) && (
        <RouteInfoModal
          key={editInfoId}
          route={routes.find((r) => r.id === editInfoId)!}
          onSave={saveRouteInfo}
          onClose={() => setEditInfoId(null)}
        />
      )}

      {blockedDeleteRoute && (() => {
        const r = routes.find((x) => x.id === blockedDeleteRoute);
        const count = SCHEDULE_USAGE[blockedDeleteRoute] ?? 0;
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 modal-panel-in text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle size={24} className="text-rose-600" />
              </div>
              <h3 className="mt-3 text-[14px] font-semibold text-stone-900">Cannot Delete Route</h3>
              <p className="mt-1.5 text-[12px] text-stone-500">
                {r?.name} is currently assigned to {count} active patrol {count === 1 ? "schedule" : "schedules"}.
                End or reassign those schedules before deleting this route.
              </p>
              <button
                onClick={() => setBlockedDeleteRoute(null)}
                className="mt-5 w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C]"
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {showUnsaved && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 modal-panel-in text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold text-stone-900">Unsaved Changes</h3>
            <p className="mt-1.5 text-[12px] text-stone-500">Your checkpoint changes haven't been saved.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={cancelUnsaved}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 sm:flex-1"
              >
                Cancel
              </button>
              <button
                onClick={discardAndContinue}
                className="w-full rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50 sm:flex-1"
              >
                Discard Changes
              </button>
              <button
                onClick={saveAndContinue}
                disabled={!canSave}
                className={`w-full rounded-lg px-4 py-2.5 text-[12px] font-medium text-white sm:flex-1 ${
                  canSave ? "bg-[#0038A8] hover:bg-[#002A8C]" : "cursor-not-allowed bg-stone-300"
                }`}
              >
                Save Route
              </button>
            </div>
            {!canSave && (
              <p className="mt-2 text-[10.5px] text-amber-700">
                Save Route is disabled until validation errors are fixed.
              </p>
            )}
          </div>
        </div>
      )}

      {confirmDeleteRoute && (
        <ConfirmModal
          type="confirm"
          title="Confirm Delete"
          message="Are you sure you want to delete this patrol route?"
          onConfirm={deleteRoute}
          onClose={() => setConfirmDeleteRoute(null)}
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
