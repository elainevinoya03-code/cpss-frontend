import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Crosshair,
  FileText,
  Lightbulb,
  MapPin,
  MessageSquare,
  Plus,
  Radar,
  Route,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmModal } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { useDigitalBoundaries } from "../hooks/useDigitalBoundaries";
import { useIncidentStore, type Incident } from "../desk_officer/incidentStore";
import { fromGeoPoint } from "../utils/geoUtils";
import {
  ALL_LAYERS,
  autoAddressForPoint,
  reverseGeocode,
  DAY_LABELS,
  DEFAULT_FILTERS,
  PURPOSES,
  RECURRING_OPTIONS,
  ROUTE_COLORS,
  SEV_COLOR,
  TARGET_AREA_SUGGESTIONS,
  TYPE_LABEL,
  coverageOf,
  emptyPlan,
  formatDay,
  hourBucket,
  nextPlanIdentity,
  nextPointId,
  nextRouteId,
  planMarkers,
  planPolylines,
  relabelIntermediates,
  segDist,
  snapToRoad,
  sortRoutePoints,
  suggestRoutes,
  validateStep,
  windowDesc,
  type ActivePatrol,
  type CheckpointPlan,
  type CpPoint,
  type CpRoute,
  type ExistingCheckpoint,
  type IncidentFilters,
  type LayerState,
  type MapMode,
  type PlanType,
  type RouteSuggestion,
  type ScheduleForm,
} from "./patrolShared";
import { BarangayMap } from "./patrolMap";
import {
  Field,
  PointEditor,
  StatusBadge,
  Stepper,
  TypeChip,
  inputCls,
  selectCls,
  textareaCls,
} from "./patrolUi";
import {
  CheckpointDetailsModal,
  IncidentDetailsModal,
  MapAnalysisView,
  PatrolDetailsModal,
  type AreaStat,
  type BucketStat,
} from "./patrolAnalysisView";
import { CheckpointPlansView, PlanDetailModal } from "./patrolPlansView";
import { removeCheckpointPlan, upsertCheckpointPlan, useCheckpointPlans } from "./checkpointPlanStore";
import { setPatrolScheduleTarget } from "./patrolScheduleTarget";

/* --------------------------------------------------------------------- */
/* Checkpoint Planning — Chief Tanod                                      */
/* --------------------------------------------------------------------- */

export default function PatrolConfiguration({
  onNavigate,
}: { onNavigate?: (key: string) => void } = {}) {
  const { flash, ToastPortal } = useToast();
  const { incidents } = useIncidentStore();
  const { boundaries: digitalBoundaries } = useDigitalBoundaries();

  const [plannerOpen, setPlannerOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<CheckpointPlan | null>(null);
  const plans = useCheckpointPlans();
  const [dirty, setDirty] = useState(false);
  const [filters, setFilters] = useState<IncidentFilters>(DEFAULT_FILTERS);
  const [mapMode, setMapMode] = useState<MapMode>("view");
  const [customTargetId, setCustomTargetId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerState>({
    digitalBoundaries: true,
    hotspots: true,
    incidents: true,
    checkpoints: true,
    patrols: true,
  });
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<ExistingCheckpoint | null>(null);
  const [selectedPatrol, setSelectedPatrol] = useState<ActivePatrol | null>(null);
  const [detailTarget, setDetailTarget] = useState<CheckpointPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckpointPlan | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [planTypeFilter, setPlanTypeFilter] = useState<"all" | PlanType>("all");
  const [planAreaFilter, setPlanAreaFilter] = useState<string>("all");

  /* ---------------- Derived incident sets ---------------- */

  const categoryOptions = useMemo(
    () => [...new Set(incidents.map((i) => i.category).filter(Boolean))].sort(),
    [incidents]
  );
  const purokOptions = useMemo(() => {
    // Get unique purok names from incidents and digital boundaries
    const incidentPuroks = [...new Set(incidents.map((i) => i.purok).filter(Boolean))];
    const boundaryNames = digitalBoundaries.map((b) => b.name);
    const allOptions = [...new Set([...incidentPuroks, ...boundaryNames])];
    return allOptions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [incidents, digitalBoundaries]);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (filters.type !== "all" && i.category !== filters.type) return false;
      if (filters.severity !== "all" && i.severity !== filters.severity) return false;
      if (filters.area !== "all") {
        const boundaryMatch = digitalBoundaries.find((b) => b.name === i.purok || i.purok?.startsWith(b.name));
        if (boundaryMatch?.name !== filters.area && i.purok !== filters.area) return false;
      }
      if (filters.status === "open" && !["new", "acknowledged"].includes(i.status)) return false;
      if (filters.status === "under_investigation" && i.status !== "in_progress") return false;
      if (filters.status === "resolved" && !["resolved", "closed_false_alarm"].includes(i.status)) return false;
      if (filters.dateFrom && new Date(i.time) < new Date(`${filters.dateFrom}T00:00:00`)) return false;
      if (filters.dateTo && new Date(i.time) > new Date(`${filters.dateTo}T23:59:59`)) return false;
      if (filters.tod !== "all" && hourBucket(i.time) !== filters.tod) return false;
      return true;
    });
  }, [incidents, filters]);

  const heatCounts = useMemo(() => {
    const m: Record<string, number> = {};
    // Initialize with digital boundaries
    for (const b of digitalBoundaries) m[b.name] = 0;
    // Also initialize with any purok names from incidents
    for (const i of filtered) {
      if (i.purok && !m[i.purok]) m[i.purok] = 0;
    }
    for (const i of filtered) {
      if (i.purok) m[i.purok] = (m[i.purok] || 0) + 1;
    }
    return m;
  }, [filtered, digitalBoundaries]);

  const areaStats: AreaStat[] = useMemo(() => {
    const byArea = new Map<string, { count: number; types: Map<string, number> }>();
    for (const i of filtered) {
      const key = i.purok || "Unknown";
      const entry = byArea.get(key) ?? { count: 0, types: new Map() };
      entry.count += 1;
      entry.types.set(i.category, (entry.types.get(i.category) ?? 0) + 1);
      byArea.set(key, entry);
    }
    return [...byArea.entries()]
      .map(([name, v]) => ({
        name,
        count: v.count,
        dominant: [...v.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const bucketStats: BucketStat[] = useMemo(() => {
    const m: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const i of filtered) m[hourBucket(i.time)] += 1;
    return Object.entries(m)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const dayStats = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtered) {
      const d = DAY_LABELS[new Date(i.time).getDay()];
      m[d] = (m[d] ?? 0) + 1;
    }
    return DAY_LABELS.map((d) => ({ day: d, count: m[d] ?? 0 }));
  }, [filtered]);

  const maxBucketCount = Math.max(1, ...bucketStats.map((b) => b.count));
  const maxDayCount = Math.max(1, ...dayStats.map((d) => d.count));

  const allDraftPoints = useMemo(() => (draft ? planMarkers(draft) : []), [draft]);

  const routeSuggestions = useMemo(
    () => (draft && draft.type === "route" ? suggestRoutes(draft, filtered) : []),
    [draft, filtered]
  );

  const draftCoverage = useMemo(() => {
    if (!draft) return null;
    return { ...coverageOf(allDraftPoints, filtered), window: windowDesc(filters) };
  }, [draft, allDraftPoints, filtered, filters]);

  /* ---------------- Plan list derivations ---------------- */

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { draft: 0, pending_approval: 0, approved: 0, revision_required: 0, rejected: 0 };
    for (const p of plans) m[p.status] += 1;
    return m;
  }, [plans]);

  const planAreaOptions = useMemo(
    () => [...new Set(plans.map((p) => p.targetArea).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [plans]
  );

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (planTypeFilter !== "all" && p.type !== planTypeFilter) return false;
      if (planAreaFilter !== "all" && p.targetArea !== planAreaFilter) return false;
      return true;
    });
  }, [plans, planTypeFilter, planAreaFilter]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    flash("Incident filters cleared");
  }

  function toggleLayer(key: keyof LayerState) {
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  }

  /* ---------------- Draft mutations ---------------- */

  function updateDraft(patch: Partial<CheckpointPlan>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }

  function openPlanner(d: CheckpointPlan | null, targetStep = 1) {
    setDraft(d);
    setStep(targetStep);
    setMapMode("view");
    setPlannerOpen(true);
    setDirty(Boolean(d));
  }

  function startManual() {
    openPlanner(emptyPlan("fixed"), 1);
    flash("Created a new checkpoint plan — fill in the basic details to continue");
  }

  function applyTrueAddress(pointId: string, fallback: string, gpsLat: number, gpsLng: number) {
    // Fire-and-forget: replace the instant purok fallback with the true
    // street address once Nominatim resolves — unless the user edited it.
    reverseGeocode(gpsLat, gpsLng)
      .then((addr) => {
        if (!addr || addr === fallback) return;
        setDirty(true);
        setDraft((d) => {
          if (!d) return d;
          const patch = (p: CpPoint) =>
            p.id === pointId && p.address === fallback ? { ...p, address: addr } : p;
          return {
            ...d,
            points: d.points.map(patch),
            routes: (d.routes ?? []).map((r) => ({ ...r, points: r.points.map(patch) })),
          };
        });
      })
      .catch(() => {});
  }

  function commitMapPoint(lat: number, lng: number) {
    if (!draft) return;
    // Leaflet reports real GPS coords, but plans/snapping live in legacy
    // SVG pixel space — convert back first so the point lands where clicked.
    const [svgX, svgY] = fromGeoPoint(lat, lng);
    const snapped = snapToRoad(svgX, svgY);
    const slat = snapped.lat;
    const slng = snapped.lng;
    const road = snapped.snapped > 0.5;
    const at = `(${slat}, ${slng})${road ? " · snapped to nearest road" : ""}`;
    const autoAddress = autoAddressForPoint(slat, slng, digitalBoundaries);
    let next = [...draft.points];
    let msg = "";
    let createdId: string | null = null;
    if (mapMode === "set_fixed") {
      createdId = nextPointId();
      next = [
        { id: createdId, kind: "fixed", label: "FIXED", name: `${draft.targetArea || "Checkpoint"} post`, address: autoAddress, landmark: "", description: "", remarks: "", lat: slat, lng: slng },
      ];
      msg = `Fixed location set at ${at} · ${autoAddress}`;
    } else if (mapMode === "set_start") {
      createdId = nextPointId();
      next = next.filter((p) => p.kind !== "start");
      next.push({ id: createdId, kind: "start", label: "A", name: "Point A", address: autoAddress, landmark: "", description: "Starting point of route", remarks: "", lat: slat, lng: slng });
      msg = `Point A set at ${at} · ${autoAddress}`;
    } else if (mapMode === "set_end") {
      createdId = nextPointId();
      next = next.filter((p) => p.kind !== "end");
      next.push({ id: createdId, kind: "end", label: "B", name: "Point B", address: autoAddress, landmark: "", description: "End point of route", remarks: "", lat: slat, lng: slng });
      msg = `Point B set at ${at} · ${autoAddress}`;
    } else if (mapMode === "set_intermediate") {
      const near = nearestRouteInfo(slat, slng);
      if (near) {
        if (near.rid === "primary") {
          createdId = nextPointId();
          const updated = insertSeriesPoint(sortRoutePoints(draft.points), near.anchorId, slat, slng, autoAddress, createdId);
          updateDraft({ points: relabelIntermediates(updated) });
          msg = `Checkpoint added to Route 1 at ${at} · ${autoAddress}`;
        } else {
          createdId = nextPointId();
          const newId = createdId;
          updateDraft({
            routes: (draft.routes ?? []).map((r) => {
              if (r.id !== near.rid) return r;
              const start = draft.points.find((p) => p.kind === "start");
              const end = draft.points.find((p) => p.kind === "end");
              if (!start || !end) return r;
              const series = insertSeriesPoint([start, ...r.points, end], near.anchorId, slat, slng, autoAddress, newId);
              return { ...r, points: relabelIntermediates(series.slice(1, -1)) };
            }),
          });
          const rl = (draft.routes ?? []).find((r) => r.id === near.rid)?.label ?? "route";
          msg = `Checkpoint added to ${rl} at ${at} · ${autoAddress}`;
        }
        setMapMode("view");
        flash(msg);
        if (createdId) applyTrueAddress(createdId, autoAddress, lat, lng);
        return;
      }
      const cnt = next.filter((p) => p.kind === "intermediate").length + 1;
      createdId = nextPointId();
      next.push({ id: createdId, kind: "intermediate", label: `CP${cnt}`, name: `Checkpoint ${cnt}`, address: autoAddress, landmark: "", description: "", remarks: "", lat: slat, lng: slng });
      msg = `Checkpoint ${cnt} added at ${at} · ${autoAddress}`;
    } else if (mapMode === "set_custom") {
      const pt: CpPoint = { id: nextPointId(), kind: "intermediate", label: "CP", name: "", address: autoAddress, landmark: "", description: "", remarks: "", lat: slat, lng: slng };
      createdId = pt.id;
      if (!customTargetId) {
        const existing = draft.routes ?? [];
        const idx = existing.length + 2;
        const route: CpRoute = {
          id: nextRouteId(),
          label: `Route ${idx}`,
          title: "Custom route",
          role: "support",
          color: ROUTE_COLORS[(idx - 2) % ROUTE_COLORS.length],
          points: [pt],
        };
        setCustomTargetId(route.id);
        updateDraft({ routes: [...existing, route] });
        msg = `${route.label} started — keep clicking to extend it`;
      } else {
        updateDraft({
          routes: (draft.routes ?? []).map((r) => (r.id === customTargetId ? { ...r, points: relabelIntermediates([...r.points, pt]) } : r)),
        });
        msg = `Waypoint added to ${(draft.routes ?? []).find((r) => r.id === customTargetId)?.label ?? "custom route"}`;
      }
      flash(msg);
      if (createdId) applyTrueAddress(createdId, autoAddress, lat, lng);
      return;
    }
    const fresh = next[next.length - 1];
    updateDraft({ points: next });
    setMapMode("view");
    flash(msg || (fresh ? `Point ${fresh.label} set at (${fresh.lat}, ${fresh.lng})` : "Point set on map"));
    if (createdId) applyTrueAddress(createdId, autoAddress, lat, lng);
  }

  function nearestRouteInfo(lat: number, lng: number): { rid: string; anchorId: string } | null {
    if (!draft) return null;
    const hits: { rid: string; anchorId: string; d: number }[] = [];
    const consider = (rid: string, series: CpPoint[]) => {
      for (let i = 0; i + 1 < series.length; i += 1) {
        hits.push({
          rid,
          anchorId: series[i].id,
          d: segDist(lat, lng, series[i].lat, series[i].lng, series[i + 1].lat, series[i + 1].lng),
        });
      }
    };
    consider("primary", sortRoutePoints(draft.points));
    const start = draft.points.find((p) => p.kind === "start");
    const end = draft.points.find((p) => p.kind === "end");
    for (const r of draft.routes ?? []) {
      if (start && end) consider(r.id, [start, ...r.points, end]);
    }
    if (hits.length === 0) return null;
    let min = hits[0];
    for (let i = 1; i < hits.length; i += 1) if (hits[i].d < min.d) min = hits[i];
    return { rid: min.rid, anchorId: min.anchorId };
  }

  function insertSeriesPoint(series: CpPoint[], anchorId: string, lat: number, lng: number, address = "", id = nextPointId()): CpPoint[] {
    const idx = series.findIndex((p) => p.id === anchorId);
    const at = idx >= 0 ? idx + 1 : series.length;
    const out = [...series];
    out.splice(at, 0, {
      id,
      kind: "intermediate",
      label: "CP",
      name: "Checkpoint",
      address,
      landmark: "",
      description: "",
      remarks: "",
      lat: Math.round(lat),
      lng: Math.round(lng),
    });
    return out;
  }

  function updateRoutePoint(routeId: string, pointId: string, patch: Partial<CpPoint>) {
    updateDraft({
      routes: (draft?.routes ?? []).map((r) =>
        r.id === routeId ? { ...r, points: r.points.map((x) => (x.id === pointId ? { ...x, ...patch } : x)) } : r
      ),
    });
  }

  function removeRoutePoint(routeId: string, pointId: string) {
    updateDraft({
      routes: (draft?.routes ?? []).map((r) =>
        r.id === routeId ? { ...r, points: relabelIntermediates(r.points.filter((x) => x.id !== pointId)) } : r
      ),
    });
  }

  function removeRoute(routeId: string) {
    updateDraft({ routes: (draft?.routes ?? []).filter((r) => r.id !== routeId) });
    if (customTargetId === routeId) setCustomTargetId(null);
    flash("Supporting route removed");
  }

  function setSuggestionAsPrimary(sug: RouteSuggestion) {
    if (!draft) return;
    const start = draft.points.find((p) => p.kind === "start");
    const end = draft.points.find((p) => p.kind === "end");
    if (!start || !end) return;
    const inter = sug.waypoints.map((w, i) => ({
      id: nextPointId(),
      kind: "intermediate" as const,
      label: `CP${i + 1}`,
      name: `Waypoint ${i + 1}`,
      address: "",
      landmark: "",
      description: "",
      remarks: "",
      lat: Math.round(w.lat),
      lng: Math.round(w.lng),
    }));
    updateDraft({ points: relabelIntermediates([start, ...inter, end]) });
    setMapMode("view");
    flash(`Route 1 set to the ${sug.tag.toLowerCase()} suggestion (${sug.coverage}% coverage)`);
  }

  function addSuggestionAsRoute(sug: RouteSuggestion) {
    if (!draft) return;
    const existing = draft.routes ?? [];
    const idx = existing.length + 2;
    const route: CpRoute = {
      id: nextRouteId(),
      label: `Route ${idx}`,
      title: `${sug.tag} suggestion`,
      role: "support",
      color: ROUTE_COLORS[(idx - 2) % ROUTE_COLORS.length],
      points: sug.waypoints.map((w, i) => ({
        id: nextPointId(),
        kind: "intermediate",
        label: `CP${i + 1}`,
        name: `Waypoint ${i + 1}`,
        address: "",
        landmark: "",
        description: "",
        remarks: "",
        lat: Math.round(w.lat),
        lng: Math.round(w.lng),
      })),
    };
    updateDraft({ routes: [...existing, route] });
    setMapMode("view");
    flash(`${route.label} added — ${sug.tag.toLowerCase()} supporting path, ${sug.coverage}% coverage`);
  }

  function startCustomRoute() {
    if (!draft) return;
    setMapMode(mapMode === "set_custom" ? "view" : "set_custom");
  }

  function finishCustomRoute() {
    setMapMode("view");
    setCustomTargetId(null);
    flash("Custom route finished — you can edit its waypoints below");
  }

  /* ---------------- Navigation & validation ---------------- */

  function atStep(s: number): string[] {
    return draft ? validateStep(s, draft) : [];
  }

  function goNext() {
    if (!draft) return;
    const errs = atStep(step);
    if (errs.length > 0) {
      flash(errs.join(" · "), { type: "warning" });
      return;
    }
    if (step < 6) {
      setStep(step + 1);
      setMapMode("view");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function saveAsDraft() {
    if (!draft) return;
    const identity = draft.id ? { id: draft.id, code: draft.code } : nextPlanIdentity(plans);
    const saved: CheckpointPlan = {
      ...draft,
      ...identity,
      status: "draft",
      coverage: draftCoverage ?? draft.coverage,
    };
    try {
      await upsertCheckpointPlan(saved);
      setPlannerOpen(false);
      setDraft(null);
      setDirty(false);
      flash(`Plan ${saved.code} saved as Draft`);
    } catch (error) {
      flash(
        `Could not save ${saved.code} — ${error instanceof Error ? error.message : "please try again"}. Check that the backend is running.`,
        { type: "error", title: "Save failed" }
      );
    }
  }

  async function submitForApproval() {
    if (!draft) return;
    const errs = validateStep(6, draft);
    if (errs.length > 0) {
      flash(errs.join(" · "), { type: "warning" });
      return;
    }
    const identity = draft.id ? { id: draft.id, code: draft.code } : nextPlanIdentity(plans);
    const submittedPlan: CheckpointPlan = {
      ...draft,
      ...identity,
      status: "pending_approval",
      coverage: draftCoverage ?? draft.coverage,
      submittedBy: "C. Santos",
      submittedAt: new Date().toISOString(),
      decidedBy: undefined,
      decidedAt: undefined,
      revisionComment: undefined,
      rejectionReason: undefined,
    };
    try {
      await upsertCheckpointPlan(submittedPlan);
      setPlannerOpen(false);
      setDraft(null);
      setDirty(false);
      flash(`Plan ${submittedPlan.code} saved — status set to Pending; the Captain can now Approve or Reject it`);
    } catch (error) {
      flash(
        `Could not submit ${submittedPlan.code} — ${error instanceof Error ? error.message : "please try again"}. Check that the backend is running.`,
        { type: "error", title: "Submit failed" }
      );
    }
  }

  function revisePlan(id: string) {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    openPlanner({ ...p, status: "draft", revisionComment: undefined }, 1);
    flash(`Editing ${p.code} — resubmit once revisions are complete`);
  }

  async function duplicatePlan(id: string) {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    const identity = nextPlanIdentity(plans);
    const copy: CheckpointPlan = {
      ...p,
      ...identity,
      status: "draft",
      submittedBy: undefined,
      submittedAt: undefined,
      decidedBy: undefined,
      decidedAt: undefined,
      revisionComment: undefined,
      rejectionReason: undefined,
      name: `${p.name} (copy)`,
      createdAt: new Date().toISOString(),
    };
    try {
      await upsertCheckpointPlan(copy);
      flash(`${copy.code} duplicated as a new draft`);
    } catch (error) {
      flash(`Could not duplicate ${p.code} — ${error instanceof Error ? error.message : "please try again"}.`, {
        type: "error",
        title: "Duplicate failed",
      });
    }
  }

  async function deletePlan(id: string) {
    try {
      await removeCheckpointPlan(id);
      setDeleteTarget(null);
      flash(`Plan ${id} deleted`);
    } catch (error) {
      setDeleteTarget(null);
      flash(`Could not delete plan ${id} — ${error instanceof Error ? error.message : "please try again"}.`, {
        type: "error",
        title: "Delete failed",
      });
    }
  }

  function leavePlanner(discard: boolean) {
    if (discard) {
      setDraft(null);
      setDirty(false);
      setPlannerOpen(false);
      flash("Draft discarded");
    } else {
      setLeaveOpen(false);
    }
  }

  function exportPlan(p: CheckpointPlan) {
    window.print();
    flash(`Printing ${p.code} — share with PNP for coordination`, { title: "Print / Share" });
  }

  function goSchedule(p: CheckpointPlan) {
    if (!onNavigate) return;
    setPatrolScheduleTarget({ planId: p.id });
    onNavigate("patrol_scheduling");
    flash(`Opening Patrol Scheduling for ${p.code} — checkpoint locations will auto-load`);
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Checkpoint Planning</h1>
              <p className="mt-1.5 text-sm text-stone-500">
                Phase 1 — analyze incidents and hotspots, plan checkpoints on the map, then save as Pending for Captain approval
              </p>
            </div>
            {!plannerOpen && (
              <button
                onClick={startManual}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#002A8C]"
              >
                <Plus size={14} />
                Create Checkpoint Plan
              </button>
            )}
            {plannerOpen && (
              <button
                onClick={() => setLeaveOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <X size={14} />
                Exit Planner
              </button>
            )}
          </div>
        </header>

        {plannerOpen && draft ? (
          /* ================= PLANNER WORKSPACE ================= */
          <div>
            <Stepper
              step={step}
              onSelect={(s) => {
                if (s > step) {
                  const errs = atStep(step);
                  if (errs.length > 0) {
                    flash(errs.join(" · "), { type: "warning" });
                    return;
                  }
                }
                setStep(s);
                setMapMode("view");
              }}
            />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-stone-800">Step {step}</span>
                <span className="text-[11px] text-stone-500">
                  {[
                    "Enter basic information",
                    "Define checkpoint type & location/route",
                    "Overlay & validate against incidents",
                    "Set operational schedule",
                    "Add operational notes",
                    "Review complete plan",
                  ][step - 1]}
                </span>
              </div>
              <button
                onClick={saveAsDraft}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                <CheckCircle2 size={12} />
                Save as Draft
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr] items-stretch">
              {/* Map stays visible while the form is open */}
              <div className="min-w-0 flex flex-col">
                <div className="flex-1 min-h-[600px]">
                  <BarangayMap
                  incidents={filtered}
                  selectedIncident={selectedIncident}
                  onSelectIncident={setSelectedIncident}
                  selectedCheckpoint={selectedCheckpoint}
                  onSelectCheckpoint={setSelectedCheckpoint}
                  selectedPatrol={selectedPatrol}
                  onSelectPatrol={setSelectedPatrol}
                  draftPoints={planMarkers(draft)}
                  draftPolylines={planPolylines(draft)}
                  mapMode={mapMode}
                  interactive
                  onMapClick={commitMapPoint}
                  onToggleLayer={toggleLayer}
                  layers={layers}
                  heatCounts={heatCounts}
                  showCoverage={step >= 3}
                  coveragePct={draftCoverage?.pct ?? 0}
                  nowLabel={`Planner — Step ${step}${step === 2 ? " · click the map to set points" : ""}`}
                  digitalBoundaries={digitalBoundaries}
                  />
                </div>
              </div>

              {/* Form panel */}
              <div className="space-y-3 h-full flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-3">
                {/* STEP 1 — Basic information */}
                {step === 1 && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-stone-800">
                      <ClipboardList size={14} className="text-[#0038A8]" />
                      Basic Information
                    </h3>
                    <p className="mb-3 text-[10px] text-[#94A3B8]">Core details of the proposed checkpoint.</p>
                    <div className="space-y-3">
                      <Field label="Checkpoint Name" required>
                        <input
                          value={draft.name}
                          onChange={(e) => updateDraft({ name: e.target.value })}
                          placeholder="e.g., Market Night Post"
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Checkpoint Code">
                        <input
                          value={draft.code || nextPlanIdentity(plans).code}
                          readOnly
                          disabled
                          className={inputCls}
                        />
                        <p className="mt-1 text-[9px] text-[#94A3B8]">Auto-assigned on save.</p>
                      </Field>
                      <Field label="Purpose" required>
                        <select value={draft.purpose} onChange={(e) => updateDraft({ purpose: e.target.value })} className={selectCls}>
                          <option value="">Select purpose…</option>
                          {PURPOSES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Objective" required>
                        <textarea
                          value={draft.objective}
                          onChange={(e) => updateDraft({ objective: e.target.value })}
                          rows={3}
                          placeholder="What should this checkpoint accomplish?"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Reason / Basis" required>
                        <textarea
                          value={draft.rationale}
                          onChange={(e) => updateDraft({ rationale: e.target.value })}
                          rows={2}
                          placeholder="Justification, or tie to specific incidents / blotter entries…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Target Area / Zone" required>
                        <input
                          list="targetAreas"
                          value={draft.targetArea}
                          onChange={(e) => updateDraft({ targetArea: e.target.value })}
                          placeholder="Choose or type a zone…"
                          className={inputCls}
                        />
                        <datalist id="targetAreas">
                          {TARGET_AREA_SUGGESTIONS.map((o) => (
                            <option key={o} value={o} />
                          ))}
                        </datalist>
                      </Field>
                      <Field label="Remarks / Additional Justification">
                        <textarea
                          value={draft.remarks}
                          onChange={(e) => updateDraft({ remarks: e.target.value })}
                          rows={2}
                          placeholder="Optional additional justification…"
                          className={textareaCls}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {/* STEP 2 — Type & location */}
                {step === 2 && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-stone-800">
                      <MapPin size={14} className="text-[#0038A8]" />
                      Checkpoint Type & Location
                    </h3>
                    <p className="mb-3 text-[10px] text-[#94A3B8]">Choose how this checkpoint is deployed, then place it on the map.</p>

                    <div className="mb-4 grid grid-cols-2 gap-2">
                      {(["fixed", "route"] as PlanType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            const wasSame = draft.type === t;
                            updateDraft({ type: t, points: wasSame ? draft.points : [], routes: wasSame ? draft.routes : [] });
                            setMapMode("view");
                            setCustomTargetId(null);
                          }}
                          className={`rounded-xl border p-3 text-left transition ${draft.type === t
                              ? "border-[#0038A8] bg-[#0038A8]/5 ring-1 ring-[#0038A8]/30"
                              : "border-stone-200 bg-white hover:bg-stone-50"
                            }`}
                        >
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-stone-800">
                            {t === "fixed" ? <MapPin size={12} className="text-violet-600" /> : <Route size={12} className="text-teal-600" />}
                            {TYPE_LABEL[t]}
                          </span>
                          <p className="mt-0.5 text-[9px] text-[#94A3B8]">
                            {t === "fixed" ? "Single, exact location" : "Point A → Point B with CP stations"}
                          </p>
                        </button>
                      ))}
                    </div>

                    {draft.type === "fixed" ? (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-bold text-violet-800">Fixed Checkpoint Location</p>
                            <p className="text-[9px] text-violet-600">Click “Set Location” then click on the map to record the exact coordinates.</p>
                          </div>
                          <button
                            onClick={() => setMapMode(mapMode === "set_fixed" ? "view" : "set_fixed")}
                            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition ${mapMode === "set_fixed"
                                ? "bg-violet-600 text-white"
                                : "bg-white text-violet-700 shadow-sm hover:bg-violet-100"
                              }`}
                          >
                            <Crosshair size={12} />
                            {mapMode === "set_fixed" ? "Click the map…" : "Set Location"}
                          </button>
                        </div>
                        {draft.points.length > 0 && (
                          <div className="mt-3">
                            {draft.points.map((p, i) => (
                              <PointEditor
                                key={p.id}
                                point={p}
                                index={i + 1}
                                onChange={(patch) =>
                                  updateDraft({ points: draft.points.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) })
                                }
                                onRemove={() => updateDraft({ points: draft.points.filter((x) => x.id !== p.id) })}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                        <p className="mb-2 text-[11px] font-bold text-teal-800">Route-Based Checkpoint</p>
                        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                          <button
                            onClick={() => setMapMode(mapMode === "set_start" ? "view" : "set_start")}
                            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition ${mapMode === "set_start" ? "bg-green-600 text-white" : "bg-white text-green-700 shadow-sm hover:bg-green-100"
                              }`}
                          >
                            <MapPin size={12} />
                            {draft.points.some((p) => p.kind === "start") ? "Reset Point A" : "Set Point A"}
                          </button>
                          <button
                            onClick={() => setMapMode(mapMode === "set_end" ? "view" : "set_end")}
                            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition ${mapMode === "set_end" ? "bg-rose-600 text-white" : "bg-white text-rose-700 shadow-sm hover:bg-rose-100"
                              }`}
                          >
                            <MapPin size={12} />
                            {draft.points.some((p) => p.kind === "end") ? "Reset Point B" : "Set Point B"}
                          </button>
                          <button
                            onClick={() => setMapMode(mapMode === "set_intermediate" ? "view" : "set_intermediate")}
                            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition ${mapMode === "set_intermediate" ? "bg-sky-600 text-white" : "bg-white text-sky-700 shadow-sm hover:bg-sky-100"
                              }`}
                            title="Click on/near a route line on the map to add a checkpoint to that route"
                          >
                            <Plus size={12} />
                            Add Intermediate CP
                          </button>
                          <button
                            onClick={startCustomRoute}
                            disabled={!draft.points.some((p) => p.kind === "start") || !draft.points.some((p) => p.kind === "end")}
                            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${mapMode === "set_custom" ? "bg-amber-600 text-white" : "bg-white text-amber-700 shadow-sm hover:bg-amber-100"
                              }`}
                          >
                            <Route size={12} />
                            {mapMode === "set_custom" ? "Drawing…" : "Draw Custom Route"}
                          </button>
                        </div>
                        <p className="mb-2 text-[9px] text-teal-700">
                          Route 1 = primary path (violet). Set Point A and B, then add supporting routes (teal / amber). Click a route line to place CP1, CP2, CP3…
                        </p>

                        {draft.points.some((p) => p.kind === "start") && draft.points.some((p) => p.kind === "end") && (draft.routes?.length ?? 0) === 0 && (
                          <p className="mb-2 rounded-lg border border-dashed border-teal-300 bg-white px-3 py-2 text-[9px] text-teal-700">
                            Route 1 is drawn on the map. Optional: choose a suggested route below or draw your own custom route.
                          </p>
                        )}

                        {/* Route suggestions */}
                        {routeSuggestions.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                              Route suggestions {draft.routes?.length ? "" : "(optional)"}
                            </p>
                            <div className="space-y-1.5">
                              {routeSuggestions.map((sug) => {
                                const nextNum = (draft.routes?.length ?? 0) + 2;
                                return (
                                  <div key={sug.id} className="rounded-lg border border-stone-200 bg-white p-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${sug.badge}`}>{sug.tag}</span>
                                      <span className="flex-1 text-[9px] text-[#94A3B8]">{sug.detail}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <button
                                        onClick={() => setSuggestionAsPrimary(sug)}
                                        className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[9px] font-semibold text-violet-700 transition hover:bg-violet-100"
                                      >
                                        <Check size={10} /> Set as Route 1
                                      </button>
                                      <button
                                        onClick={() => addSuggestionAsRoute(sug)}
                                        className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[9px] font-semibold text-teal-700 transition hover:bg-teal-100"
                                      >
                                        <Plus size={10} /> Add as Route {nextNum}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {mapMode === "set_custom" && (
                          <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-[9px] font-semibold text-amber-800">
                              {customTargetId
                                ? "Click the map to keep adding waypoints to this route, or finish it."
                                : "Click the map to start tracing the custom route."}
                            </p>
                            <button
                              onClick={finishCustomRoute}
                              className="rounded-lg bg-amber-600 px-2.5 py-1 text-[9px] font-bold text-white transition hover:bg-amber-700"
                            >
                              Finish Route
                            </button>
                          </div>
                        )}

                        {/* Routes list */}
                        {draft.points.some((p) => p.kind === "start") || draft.points.some((p) => p.kind === "end") ? (
                          <div className="space-y-2">
                            <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#7c3aed" }} />
                                <span className="text-[11px] font-bold text-stone-700">Route 1 · Primary (A→B)</span>
                                <span className="ml-auto text-[9px] font-medium text-[#94A3B8]">{draft.points.length} point{draft.points.length === 1 ? "" : "s"}</span>
                              </div>
                              {sortRoutePoints(draft.points).length > 0 ? (
                                <div className="space-y-2">
                                  {sortRoutePoints(draft.points).map((p, i) => (
                                    <PointEditor
                                      key={p.id}
                                      point={p}
                                      index={p.kind === "intermediate" ? Number(p.label.replace("CP", "")) : i + 1}
                                      onChange={(patch) =>
                                        updateDraft({
                                          points: draft.points.map((x) => (x.id === p.id ? { ...x, ...patch } : x)),
                                        })
                                      }
                                      onRemove={() => updateDraft({ points: relabelIntermediates(draft.points.filter((x) => x.id !== p.id)) })}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-center text-[9px] text-[#94A3B8]">Set Point A and Point B on the map to begin.</p>
                              )}
                            </div>

                            {(draft.routes ?? []).map((r) => (
                              <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                                  <span className="text-[11px] font-bold text-stone-700">{r.label} · Supporting</span>
                                  {r.title && <span className="text-[9px] text-[#94A3B8]">({r.title})</span>}
                                  <button
                                    onClick={() => removeRoute(r.id)}
                                    title={`Remove ${r.label}`}
                                    className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                {r.points.length > 0 ? (
                                  <div className="space-y-2">
                                    {r.points.map((p) => (
                                      <PointEditor
                                        key={p.id}
                                        point={p}
                                        index={Number(p.label.replace("CP", "")) || p.id.length}
                                        onChange={(patch) => updateRoutePoint(r.id, p.id, patch)}
                                        onRemove={() => removeRoutePoint(r.id, p.id)}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-center text-[9px] text-stone-400">
                                    Straight A→B. Click “Add Intermediate CP” or the map to add waypoints to this route.
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed border-teal-300 bg-white px-3 py-5 text-center text-[10px] text-teal-600">
                            Set Point A and Point B on the map to begin.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3 — Coverage */}
                {step === 3 && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-stone-800">
                      <Radar size={14} className="text-[#0038A8]" />
                      Overlay &amp; Coverage Validation
                    </h3>
                    <p className="mb-3 text-[10px] text-[#94A3B8]">
                      The proposed {draft.type === "fixed" ? "checkpoint" : "route"} is overlaid against incidents and hotspots on the map.
                    </p>

                    {(draftCoverage?.total ?? 0) > 0 ? (
                      <>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-emerald-800">
                              {draft.type === "fixed" ? "This checkpoint covers" : "This route covers"}
                            </span>
                            <span className="text-[22px] font-bold text-emerald-700">{draftCoverage?.pct}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${draftCoverage?.pct ?? 0}%` }} />
                          </div>
                          <p className="mt-2 text-[10px] text-emerald-700">
                            {draftCoverage?.covered} of {draftCoverage?.total} incidents in the {draftCoverage?.window} window fall within coverage range.
                          </p>
                        </div>

                        <div className="mt-3">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Coverage by severity</p>
                          <div className="space-y-1.5">
                            {(["critical", "high", "warning", "low"] as const)
                              .map((s) => {
                                const ofArea = filtered.filter((i) => i.severity === s);
                                return { s, ofArea, cov: coverageOf(draft.points, ofArea).covered };
                              })
                              .filter((x) => x.ofArea.length > 0)
                              .map(({ s, ofArea, cov }) => (
                                <div key={s} className="flex items-center gap-2">
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[s] }} />
                                  <span className="flex-1 text-[10px] capitalize text-stone-600">{s}</span>
                                  <span className="text-[10px] font-semibold text-stone-700">
                                    {cov}/{ofArea.length}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={() => setStep(4)}
                            className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#002A8C]"
                          >
                            Looks good — continue <ChevronRight size={11} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-[10px] text-stone-400">
                        No incidents in the current window to measure coverage against. Widen your filters or add a point first.
                      </p>
                    )}
                  </div>
                )}

                {/* STEP 4 — Schedule */}
                {step === 4 && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-stone-800">
                      <Calendar size={14} className="text-[#0038A8]" />
                      Operational Schedule
                    </h3>
                    <p className="mb-3 text-[10px] text-[#94A3B8]">Define when the checkpoint will be stood up.</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Operation Date" required>
                          <input
                            type="date"
                            value={draft.schedule.operationDate}
                            onChange={(e) => updateDraft({ schedule: { ...draft.schedule, operationDate: e.target.value } })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="End Date">
                          <input
                            type="date"
                            value={draft.schedule.endDate}
                            onChange={(e) => updateDraft({ schedule: { ...draft.schedule, endDate: e.target.value } })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Start Time" required>
                          <input
                            type="time"
                            value={draft.schedule.startTime}
                            onChange={(e) => updateDraft({ schedule: { ...draft.schedule, startTime: e.target.value } })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="End Time" required>
                          <input
                            type="time"
                            value={draft.schedule.endTime}
                            onChange={(e) => updateDraft({ schedule: { ...draft.schedule, endTime: e.target.value } })}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <Field label="Recurring">
                        <div className="grid grid-cols-3 gap-1.5">
                          {RECURRING_OPTIONS.map((o) => (
                            <button
                              key={o.key}
                              onClick={() =>
                                updateDraft({
                                  schedule: {
                                    ...draft.schedule,
                                    recurring: o.key as ScheduleForm["recurring"],
                                    recurringDays: draft.schedule.recurringDays,
                                  },
                                })
                              }
                              className={`rounded-lg border px-2 py-1.5 text-[9px] font-semibold transition ${draft.schedule.recurring === o.key
                                  ? "border-[#0038A8] bg-[#0038A8] text-white"
                                  : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                                }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                      {draft.schedule.recurring === "specific_days" && (
                        <Field label="Select days">
                          <div className="flex flex-wrap gap-1.5">
                            {DAY_LABELS.map((d) => {
                              const on = draft.schedule.recurringDays.includes(d);
                              return (
                                <button
                                  key={d}
                                  onClick={() =>
                                    updateDraft({
                                      schedule: {
                                        ...draft.schedule,
                                        recurringDays: on
                                          ? draft.schedule.recurringDays.filter((x) => x !== d)
                                          : [...draft.schedule.recurringDays, d],
                                      },
                                    })
                                  }
                                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold transition ${on ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                    }`}
                                >
                                  {d[0]}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      )}
                      <Field label="Expected Duration">
                        <input
                          value={draft.schedule.expectedDuration}
                          onChange={(e) => updateDraft({ schedule: { ...draft.schedule, expectedDuration: e.target.value } })}
                          placeholder="e.g., 4 hours per duty window"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {/* STEP 5 — Notes */}
                {step === 5 && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-stone-800">
                      <MessageSquare size={14} className="text-[#0038A8]" />
                      Operational Notes
                    </h3>
                    <p className="mb-3 text-[10px] text-[#94A3B8]">Instructions for the personnel assigned to this operation.</p>
                    <div className="space-y-3">
                      <Field label="General Instructions">
                        <textarea
                          value={draft.notes.general}
                          onChange={(e) => updateDraft({ notes: { ...draft.notes, general: e.target.value } })}
                          rows={2}
                          placeholder="General instructions for personnel…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Safety Considerations">
                        <textarea
                          value={draft.notes.safety}
                          onChange={(e) => updateDraft({ notes: { ...draft.notes, safety: e.target.value } })}
                          rows={2}
                          placeholder="Safety measures, hazards to watch for…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Required Equipment / Signages">
                        <textarea
                          value={draft.notes.equipment}
                          onChange={(e) => updateDraft({ notes: { ...draft.notes, equipment: e.target.value } })}
                          rows={2}
                          placeholder="Lights, cones, signage, radio, log sheets…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Coordination Notes">
                        <textarea
                          value={draft.notes.coordination}
                          onChange={(e) => updateDraft({ notes: { ...draft.notes, coordination: e.target.value } })}
                          rows={2}
                          placeholder="PNP, nearby barangays, traffic enforcers…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Special Instructions / Restrictions">
                        <textarea
                          value={draft.notes.special}
                          onChange={(e) => updateDraft({ notes: { ...draft.notes, special: e.target.value } })}
                          rows={2}
                          placeholder="Restrictions, special orders…"
                          className={textareaCls}
                        />
                      </Field>
                      <Field label="Other Remarks">
                        <textarea
                          value={draft.notes.other}
                          onChange={(e) => updateDraft({ notes: { ...draft.notes, other: e.target.value } })}
                          rows={2}
                          placeholder="Anything else…"
                          className={textareaCls}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {/* STEP 6 — Review & submit */}
                {step === 6 && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-stone-800">
                      <FileText size={14} className="text-[#0038A8]" />
                      Review Complete Plan
                    </h3>
                    <p className="mb-3 text-[10px] text-[#94A3B8]">Full summary of the plan before it is submitted for approval. You can still edit any section.</p>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-stone-100 p-3">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">Summary</p>
                        <p className="text-[12px] font-bold text-stone-800">{draft.name || "Untitled plan"}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <StatusBadge status="draft" />
                          <TypeChip type={draft.type} />
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold text-stone-600">{draft.purpose || "No purpose"}</span>
                        </div>
                        <p className="mt-2 text-[10px] text-[#94A3B8]">
                          {draft.code || "No code"} · Target: {draft.targetArea || "—"} · {draft.points.length} point{draft.points.length === 1 ? "" : "s"} defined
                          {draft.routes && draft.routes.length > 0 ? ` · ${draft.routes.length} supporting route${draft.routes.length === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>

                      {(draftCoverage?.total ?? 0) > 0 && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-emerald-800">
                              {draft.type === "fixed" ? "Coverage" : "Route coverage"}
                            </span>
                            <span className="text-[16px] font-bold text-emerald-700">{draftCoverage?.pct}%</span>
                          </div>
                          <p className="text-[9px] text-emerald-700">
                            {draftCoverage?.covered}/{draftCoverage?.total} incidents · {draftCoverage?.window}
                          </p>
                        </div>
                      )}

                      <div className="rounded-lg border border-stone-100 p-3">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">Schedule</p>
                        <p className="text-[11px] font-medium text-stone-700">
                          {draft.schedule.operationDate ? formatDay(draft.schedule.operationDate) : "—"}
                          {draft.schedule.endDate && draft.schedule.endDate !== draft.schedule.operationDate
                            ? ` → ${formatDay(draft.schedule.endDate)}`
                            : ""}{" "}
                          · {draft.schedule.startTime}–{draft.schedule.endTime}
                        </p>
                        <p className="text-[10px] text-[#94A3B8]">
                          {draft.schedule.recurring === "daily"
                            ? "Daily"
                            : draft.schedule.recurring === "specific_days"
                              ? `Repeats: ${draft.schedule.recurringDays.join(", ")}`
                              : "One-time"}
                          {draft.schedule.expectedDuration ? ` · ~${draft.schedule.expectedDuration}` : ""}
                        </p>
                      </div>

                      {draft.notes.general ||
                        draft.notes.safety ||
                        draft.notes.equipment ||
                        draft.notes.coordination ||
                        draft.notes.special ||
                        draft.notes.other ? (
                        <div className="rounded-lg border border-stone-100 p-3">
                          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">Operational notes</p>
                          <div className="space-y-1">
                            {Object.entries({
                              "General": draft.notes.general,
                              "Safety": draft.notes.safety,
                              "Equipment": draft.notes.equipment,
                              "Coordination": draft.notes.coordination,
                              "Special": draft.notes.special,
                              "Other": draft.notes.other,
                            })
                              .filter(([, v]) => v)
                              .map(([k, v]) => (
                                <p key={k} className="text-[10px] leading-relaxed text-stone-600">
                                  <span className="font-semibold text-[#334155]">{k}:</span> {v}
                                </p>
                              ))}
                          </div>
                        </div>
                      ) : null}

                    </div>

                    {atStep(6).length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-amber-800">
                          <AlertTriangle size={12} /> Missing items — plan is not yet complete
                        </p>
                        <ul className="list-inside list-disc space-y-0.5">
                          {atStep(6).map((e) => (
                            <li key={e} className="text-[10px] text-amber-700">
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {atStep(6).length === 0 && (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 size={12} className="mr-1 inline" /> Plan is complete — save it to set its status to Pending for Captain review.
                      </div>
                    )}
                  </div>
                )}

                </div>
                {/* Step footer */}
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 shadow-sm flex-shrink-0">
                  <button
                    onClick={() => {
                      setStep(Math.max(1, step - 1));
                      setMapMode("view");
                    }}
                    disabled={step === 1}
                    className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={13} /> Back
                  </button>
                  {step < 6 ? (
                    <button
                      onClick={goNext}
                      className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#002A8C]"
                    >
                      {step === 2
                        ? "Validate coverage →"
                        : step === 3
                          ? "Set schedule →"
                          : "Next"} <ChevronRight size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={submitForApproval}
                      disabled={atStep(6).length > 0}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
                    >
                      <Send size={13} /> Save Checkpoint Plan
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= ANALYSIS + PLANS ================= */
          <>
            <MapAnalysisView
              incidents={incidents}
              filtered={filtered}
              categoryOptions={categoryOptions}
              purokOptions={purokOptions}
              filters={filters}
              onFiltersChange={setFilters}
              onResetFilters={resetFilters}
              layers={layers}
              onToggleLayer={toggleLayer}
              heatCounts={heatCounts}
              selectedIncident={selectedIncident}
              onSelectIncident={setSelectedIncident}
              selectedCheckpoint={selectedCheckpoint}
              onSelectCheckpoint={setSelectedCheckpoint}
              selectedPatrol={selectedPatrol}
              onSelectPatrol={setSelectedPatrol}
              areaStats={areaStats}
              bucketStats={bucketStats}
              dayStats={dayStats}
              maxBucketCount={maxBucketCount}
              maxDayCount={maxDayCount}
            />

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb size={15} className="text-[#0038A8]" />
                <h3 className="text-[14px] font-bold text-stone-800">Checkpoint Plans</h3>
                <span className="text-[11px] text-[#94A3B8]">Drafted, submitted and decided plans</span>
              </div>
              <CheckpointPlansView
                plans={plans}
                filteredPlans={filteredPlans}
                statusCounts={statusCounts}
                planTypeFilter={planTypeFilter}
                onPlanTypeFilter={setPlanTypeFilter}
                planAreaFilter={planAreaFilter}
                onPlanAreaFilter={setPlanAreaFilter}
                planAreaOptions={planAreaOptions}
                onClearFilters={() => {
                  setPlanTypeFilter("all");
                  setPlanAreaFilter("all");
                }}
                onView={(p) => setDetailTarget(p)}
                onSchedule={onNavigate ? goSchedule : undefined}
                onEdit={(p) => revisePlan(p.id)}
                onDuplicate={(p) => duplicatePlan(p.id)}
                onDelete={(p) => setDeleteTarget(p)}
                onPrint={(p) => exportPlan(p)}
              />
            </div>
          </>
        )}
      </main>

      {/* ---------------- Modals ---------------- */}
      {selectedIncident && <IncidentDetailsModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} />}

      {selectedCheckpoint && <CheckpointDetailsModal checkpoint={selectedCheckpoint} onClose={() => setSelectedCheckpoint(null)} />}

      {selectedPatrol && <PatrolDetailsModal patrol={selectedPatrol} onClose={() => setSelectedPatrol(null)} />}

      {detailTarget && <PlanDetailModal plan={detailTarget} onClose={() => setDetailTarget(null)} allIncidents={incidents} />}

      {deleteTarget && (
        <ConfirmModal
          type="confirm"
          title="Delete plan?"
          message={`${deleteTarget.code} — ${deleteTarget.name} will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() => deletePlan(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {leaveOpen && (
        <ConfirmModal
          type="confirm"
          title="Leave checkpoint planner?"
          message="Any unsaved changes to the current draft will be discarded. You can save it as a Draft first if you want to keep it."
          cancelLabel="Keep Editing"
          confirmLabel="Discard & Leave"
          tone="primary"
          onConfirm={() => leavePlanner(true)}
          onClose={() => setLeaveOpen(false)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}