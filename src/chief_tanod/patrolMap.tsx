import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, Crosshair } from "lucide-react";
import { PUROK_ZONES } from "../constants/purok";
import { type Incident } from "../desk_officer/incidentStore";
import {
  ACTIVE_PATROLS,
  EXISTING_CHECKPOINTS,
  LAYER_LABELS,
  SEV_COLOR,
  sortRoutePoints,
  type CpPoint,
  type DrawableRoute,
  type LayerState,
  type MapMode,
} from "./patrolShared";
import { MAP_CENTER, toGeoPoint, purokZoneToGeo } from "../utils/geoUtils";

interface BarangayMapProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident | null) => void;
  draftPoints: CpPoint[];
  mapMode: MapMode;
  interactive: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onToggleLayer?: (key: keyof LayerState) => void;
  layers: LayerState;
  heatCounts: Record<string, number>;
  showCoverage: boolean;
  coveragePct: number;
  nowLabel?: string;
  draftPolylines?: DrawableRoute[];
}

// Ensure leaflet handles icons properly in our bundler setup
// We use custom DivIcons anyway, so this is just a fallback.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function BarangayMap({
  incidents,
  selectedIncident,
  onSelectIncident,
  draftPoints,
  mapMode,
  interactive,
  onMapClick,
  onToggleLayer,
  layers,
  heatCounts,
  showCoverage,
  coveragePct,
  nowLabel = "Barangay GIS Map",
  draftPolylines,
}: BarangayMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups to easily clear/update Leaflet elements
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);
  const checkpointsLayerRef = useRef<L.LayerGroup | null>(null);
  const patrolsLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);

  // We use refs for these so we don't re-create the event listeners unnecesssarily
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  
  const mapModeRef = useRef(mapMode);
  mapModeRef.current = mapMode;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const maxHeat = Math.max(1, ...Object.values(heatCounts));

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: 16,
      zoomControl: false,
      attributionControl: false, // We'll add a minimal one or rely on CSS
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on("click", (e) => {
      if (!interactiveRef.current || mapModeRef.current === "view") return;
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    });

    zonesLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);
    checkpointsLayerRef.current = L.layerGroup().addTo(map);
    patrolsLayerRef.current = L.layerGroup().addTo(map);
    coverageLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    incidentsLayerRef.current = L.layerGroup().addTo(map);
    
    mapRef.current = map;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Zones Layer
  useEffect(() => {
    if (!zonesLayerRef.current) return;
    zonesLayerRef.current.clearLayers();

    if (!layers.boundaries) return;

    PUROK_ZONES.forEach((zone) => {
      const geoPoints = purokZoneToGeo(zone.path);
      if (geoPoints.length < 3) return;

      const count = heatCounts[zone.name] ?? 0;
      const intensity = count / maxHeat;
      const heatFill =
        count === 0
          ? "#F8FAFC"
          : count >= 1
          ? `rgba(239,68,68,${0.08 + 0.42 * intensity})`
          : "#F8FAFC";

      const polygon = L.polygon(geoPoints, {
        color: zone.color,
        weight: 1.6,
        opacity: 0.75,
        fillColor: heatFill,
        fillOpacity: 0.8,
      });

      polygon.bindTooltip(`${zone.name} — ${count} incident${count === 1 ? "" : "s"}`, {
        permanent: true,
        direction: "center",
        className: "bg-transparent border-none shadow-none text-xs font-bold",
      });

      // Override the text color via a bit of DOM manipulation when added
      polygon.on('add', function() {
         const tooltip = polygon.getTooltip();
         if (tooltip && tooltip.getElement()) {
             tooltip.getElement()!.style.color = zone.color;
             tooltip.getElement()!.style.textShadow = "0px 1px 2px rgba(255,255,255,0.8)";
         }
      });

      polygon.on("click", (e) => {
        if (!interactiveRef.current || mapModeRef.current !== "view") return;
        L.DomEvent.stopPropagation(e);
        if (mapRef.current) {
          mapRef.current.fitBounds(polygon.getBounds(), { padding: [20, 20] });
        }
      });

      polygon.addTo(zonesLayerRef.current!);
    });
  }, [layers.boundaries, heatCounts, maxHeat]);

  // Update Hotspots Layer
  useEffect(() => {
    if (!hotspotsLayerRef.current) return;
    hotspotsLayerRef.current.clearLayers();

    if (!layers.hotspots) return;

    Object.entries(heatCounts).forEach(([name, cnt]) => {
      const z = PUROK_ZONES.find((zz) => zz.name === name);
      if (!z || cnt === 0) return;
      const top =
        Object.values(heatCounts).filter((c) => c > cnt).length === 0 ||
        Object.values(heatCounts).filter((c) => c >= cnt).length <= 2;
      if (!top) return;

      const r = 40 + cnt * 8; // roughly mapped to meters for radius
      const [lat, lng] = toGeoPoint(z.labelX, z.labelY);
      
      L.circle([lat, lng], {
        radius: r,
        color: "rgba(244,63,94,0.55)",
        weight: 1.2,
        dashArray: "4 3",
        fillColor: "rgba(244,63,94,0.14)",
        fillOpacity: 1,
      }).addTo(hotspotsLayerRef.current!);
    });
  }, [layers.hotspots, heatCounts]);

  // Update Existing Checkpoints Layer
  useEffect(() => {
    if (!checkpointsLayerRef.current) return;
    checkpointsLayerRef.current.clearLayers();

    if (!layers.checkpoints) return;

    EXISTING_CHECKPOINTS.forEach((cp) => {
      const [lat, lng] = toGeoPoint(cp.lat, cp.lng);
      const iconHtml = `
        <div style="opacity: ${cp.active ? 1 : 0.45}; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center;">
          <div style="width: 14px; height: 14px; background: #0038A8; border: 1.5px solid white; border-radius: 3px; display: flex; justify-content: center; align-items: center; color: white; font-size: 8px; font-weight: bold;">S</div>
          <div style="font-size: 8px; font-weight: 700; color: #334155; white-space: nowrap; margin-top: 2px; text-shadow: 0 1px 0 white;">${cp.name}</div>
        </div>
      `;
      const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [0, 0] });
      L.marker([lat, lng], { icon }).addTo(checkpointsLayerRef.current!);
    });
  }, [layers.checkpoints]);

  // Update Active Patrols Layer
  useEffect(() => {
    if (!patrolsLayerRef.current) return;
    patrolsLayerRef.current.clearLayers();

    if (!layers.patrols) return;

    ACTIVE_PATROLS.forEach((pat) => {
      const geoPts = pat.pts.map(p => toGeoPoint(p.x, p.y));
      const pl = L.polyline(geoPts, {
        color: "#0d9488",
        weight: 2.5,
        dashArray: "6 4",
        opacity: 0.85,
      }).addTo(patrolsLayerRef.current!);

      if (geoPts.length > 0) {
         pl.bindTooltip(pat.name, {
            permanent: true,
            direction: "right",
            className: "bg-transparent border-none shadow-none text-[8px] font-bold text-teal-700",
         });
      }
    });
  }, [layers.patrols]);

  // Update Incidents Layer
  useEffect(() => {
    if (!incidentsLayerRef.current) return;
    incidentsLayerRef.current.clearLayers();

    if (!layers.incidents) return;

    incidents.forEach((inc) => {
      const isSel = selectedIncident?.id === inc.id;
      const color = SEV_COLOR[inc.severity] ?? "#94a3b8";
      const r = isSel ? 9 : inc.severity === "critical" ? 7 : inc.severity === "high" ? 6.5 : 5.5;
      
      const [lat, lng] = toGeoPoint(inc.lat, inc.lng);

      const html = `
        <div style="position: relative; width: ${r*2 + 4}px; height: ${r*2 + 4}px; display: flex; justify-content: center; align-items: center;">
           <div style="position: absolute; inset: 0; background: ${color}; opacity: 0.2; border-radius: 50%;"></div>
           <div style="width: ${r*2}px; height: ${r*2}px; background: ${color}; border: 1.5px solid white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
           ${isSel ? `
             <div style="position: absolute; top: -20px; background: #0f172a; color: white; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; white-space: nowrap;">
               ${inc.id}
             </div>
           ` : ''}
        </div>
      `;

      const icon = L.divIcon({ html, className: "", iconSize: [r*2 + 4, r*2 + 4], iconAnchor: [r + 2, r + 2] });
      
      const marker = L.marker([lat, lng], { icon });
      marker.on("click", (e) => {
        if (!interactiveRef.current || mapModeRef.current !== "view") return;
        L.DomEvent.stopPropagation(e);
        onSelectIncident(isSel ? null : inc);
      });

      marker.addTo(incidentsLayerRef.current!);
    });
  }, [layers.incidents, incidents, selectedIncident]);

  // Update Draft Layer (Polylines + Points) and Coverage
  useEffect(() => {
    if (!draftLayerRef.current || !coverageLayerRef.current) return;
    draftLayerRef.current.clearLayers();
    coverageLayerRef.current.clearLayers();

    // Coverage
    if (showCoverage) {
      draftPoints.forEach((p) => {
        const [lat, lng] = toGeoPoint(p.lat, p.lng);
        L.circle([lat, lng], {
          radius: 120, // Real meters
          color: "rgba(16,185,129,0.6)",
          weight: 1.5,
          dashArray: "3 2",
          fillColor: "rgba(16,185,129,0.15)",
          fillOpacity: 1,
        }).addTo(coverageLayerRef.current!);
      });
    }

    // Polylines
    if (draftPolylines) {
      draftPolylines.forEach((r) => {
        if (r.points.length < 2) return;
        const pts = r.points.map(p => toGeoPoint(p.lat, p.lng));
        
        // Base line
        L.polyline(pts, {
          color: r.color,
          weight: r.id === "primary" ? 3.5 : 2.5,
          opacity: r.id === "primary" ? 1 : 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(draftLayerRef.current!);

        // Primary dash overlay
        if (r.id === "primary") {
          L.polyline(pts, {
            color: "#ffffff",
            weight: 1.5,
            dashArray: "5 4",
            lineCap: "round",
            lineJoin: "round",
          }).addTo(draftLayerRef.current!);
        }
      });
    } else if (draftPoints.length > 1) {
      // Legacy single polyline
      const pts = sortRoutePoints(draftPoints).map(p => toGeoPoint(p.lat, p.lng));
      L.polyline(pts, {
        color: "#7c3aed",
        weight: 3.5,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(draftLayerRef.current!);
      L.polyline(pts, {
        color: "#ffffff",
        weight: 1.5,
        dashArray: "5 4",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(draftLayerRef.current!);
    }

    // Points
    draftPoints.forEach((p) => {
      const color = p.kind === "start" ? "#16a34a" : p.kind === "end" ? "#dc2626" : p.kind === "fixed" ? "#7c3aed" : "#0ea5e9";
      const [lat, lng] = toGeoPoint(p.lat, p.lng);

      const html = `
        <div style="display: flex; justify-content: center; align-items: center; width: 22px; height: 22px; position: relative;">
          <div style="position: absolute; inset: 0; background: ${color}; opacity: 0.25; border-radius: 50%; border: 2px solid white;"></div>
          <div style="width: 14px; height: 14px; background: ${color}; border: 1.5px solid white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
          <div style="position: absolute; top: -14px; color: ${color}; font-size: 10px; font-weight: 800; text-shadow: 0 1px 2px white; white-space: nowrap;">
            ${p.label}
          </div>
        </div>
      `;
      const icon = L.divIcon({ html, className: "", iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([lat, lng], { icon }).addTo(draftLayerRef.current!);
    });
  }, [draftPoints, draftPolylines, showCoverage]);

  // Controls
  function zoomBy(factor: number) {
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom();
    const targetZoom = factor > 1 ? currentZoom - 1 : currentZoom + 1; // Basic zoom stepping
    mapRef.current.setZoom(targetZoom);
  }

  function resetView() {
    if (!mapRef.current) return;
    mapRef.current.setView(MAP_CENTER, 16);
  }

  return (
    <div className="relative h-full min-h-[500px] w-full overflow-hidden rounded-xl border border-stone-200 bg-[#d6e0f0]">
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full z-0"
        style={{ cursor: interactive && mapMode !== "view" ? "crosshair" : "" }}
      />

      {/* Layer toggles */}
      <div className="absolute left-2.5 top-2.5 z-20 flex max-w-[calc(100%-5rem)] flex-wrap gap-1 rounded-lg border border-stone-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-sm">
        {LAYER_LABELS.map((l) => (
          <button
            key={l.key}
            onClick={() => onToggleLayer?.(l.key)}
            className={"pointer-events-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold transition " +
              (layers[l.key] ? "bg-[#0038A8]/10 text-[#0038A8]" : "text-stone-400 hover:text-stone-600")}
          >
            {layers[l.key] && <Check size={10} strokeWidth={3} />}
            {l.label}
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute right-2.5 top-2.5 z-20 flex flex-col gap-1 rounded-lg border border-stone-200 bg-white/95 p-1 shadow-sm backdrop-blur-sm">
        <button onClick={() => zoomBy(0.72)} title="Zoom in" className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-stone-600 hover:bg-stone-100">
          +
        </button>
        <button onClick={() => zoomBy(1.38)} title="Zoom out" className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-stone-600 hover:bg-stone-100">
          −
        </button>
        <button
          onClick={resetView}
          title="Reset view"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100"
        >
          <Crosshair size={13} />
        </button>
      </div>

      {/* Map mode banner */}
      {mapMode !== "view" && (
        <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-lg bg-[#0038A8] px-4 py-2 text-[11px] sm:text-xs font-bold text-white shadow-lg whitespace-nowrap">
          {mapMode === "set_fixed" && "Click on the map to set the checkpoint location"}
          {mapMode === "set_start" && "Click on the map to set Point A (start)"}
          {mapMode === "set_end" && "Click on the map to set Point B (end)"}
          {mapMode === "set_intermediate" && "Click on/near a route line to place a checkpoint (CP1, CP2…)"}
          {mapMode === "set_custom" && "Click on the map to trace a custom route — then click “Finish Route”"}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2.5 left-2.5 z-20 space-y-1.5 rounded-lg border border-stone-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm pointer-events-none">
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">Legend</p>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span className="text-[10px] font-medium text-stone-600">Incident</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0038A8]" />
          <span className="text-[10px] font-medium text-stone-600">Existing checkpoint</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0 w-3.5 border-t-2 border-dotted border-teal-600" />
          <span className="text-[10px] font-medium text-stone-600">Active patrol</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0 w-3.5 border-t-2 border-dotted border-violet-600" />
          <span className="text-[10px] font-medium text-stone-600">Planned route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-rose-400 bg-rose-100" />
          <span className="text-[10px] font-medium text-stone-600">Hotspot</span>
        </div>
      </div>

      <div className="absolute bottom-2.5 right-2.5 z-20 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-[10px] font-medium text-stone-500 shadow-sm backdrop-blur-sm pointer-events-none">
        {nowLabel}
      </div>
    </div>
  );
}