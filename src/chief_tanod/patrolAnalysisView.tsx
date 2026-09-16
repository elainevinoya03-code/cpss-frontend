import {
  AlertTriangle,
  ChevronRight,
  Filter,
  Flame,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { Modal } from "../components/ui";
import { sourceLabel, type Incident } from "../desk_officer/incidentStore";
import {
  BUCKET_LABEL,
  INC_STATUS_HEALTH,
  SEV_COLOR,
  formatDateTime,
  type IncidentFilters,
  type LayerState,
} from "./patrolShared";
import { BarangayMap } from "./patrolMap";
import { selectCls } from "./patrolUi";

/* --------------------------------------------------------------------- */
/* Incident details modal                                                */
/* --------------------------------------------------------------------- */

export function IncidentDetailsModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const st = INC_STATUS_HEALTH[incident.status] ?? { label: incident.status, badge: "" };
  const sevBadge =
    incident.severity === "critical"
      ? "bg-rose-50 text-rose-700"
      : incident.severity === "high"
        ? "bg-orange-50 text-orange-700"
        : incident.severity === "warning"
          ? "bg-amber-50 text-amber-700"
          : "bg-sky-50 text-sky-700";
  return (
    <Modal
      onClose={onClose}
      title={`Incident ${incident.id}`}
      subtitle={`${incident.category} · ${incident.purok}`}
      icon={<AlertTriangle size={18} />}
      iconClass="bg-rose-100 text-rose-600"
      size="md"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.badge}`}>{st.label}</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sevBadge}`}>
            {incident.severity === "critical"
              ? "Critical"
              : incident.severity === "high"
                ? "High"
                : incident.severity === "warning"
                  ? "Warning"
                  : "Low"}
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
            {sourceLabel(incident.source)}
          </span>
        </div>

        <p className="text-[13px] leading-relaxed text-stone-600">{incident.description}</p>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-[11px]">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">INCIDENT TYPE</p>
            <p className="mt-0.5 font-medium text-[#334155]">{incident.category}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">DATE & TIME</p>
            <p className="mt-0.5 font-medium text-[#334155]">{formatDateTime(incident.time)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">LOCATION</p>
            <p className="mt-0.5 font-medium text-[#334155]">
              {incident.purok} · {incident.lat.toFixed(0)}, {incident.lng.toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">REFERENCE NO.</p>
            <p className="mt-0.5 font-mono font-medium text-[#334155]">{incident.id}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">REPORTED BY</p>
            <p className="mt-0.5 font-medium text-[#334155]">
              {incident.reporter || "Anonymous / System"}
            </p>
          </div>
          {incident.notes && incident.notes.length > 0 && (
            <div className="col-span-2">
              <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">NOTES</p>
              {incident.notes.map((n, i) => (
                <p key={i} className="mt-0.5 flex items-start gap-1 font-medium text-[#334155]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#0038A8]" />
                  {n}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------------- */
/* Map & analysis view                                                   */
/* --------------------------------------------------------------------- */

export interface AreaStat {
  name: string;
  count: number;
  dominant: string;
}

export interface BucketStat {
  key: string;
  count: number;
}

export interface DayStat {
  day: string;
  count: number;
}

interface MapAnalysisViewProps {
  incidents: Incident[];
  filtered: Incident[];
  categoryOptions: string[];
  purokOptions: string[];
  filters: IncidentFilters;
  onFiltersChange: (f: IncidentFilters) => void;
  onResetFilters: () => void;
  layers: LayerState;
  onToggleLayer: (key: keyof LayerState) => void;
  heatCounts: Record<string, number>;
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  areaStats: AreaStat[];
  bucketStats: BucketStat[];
  dayStats: DayStat[];
  maxBucketCount: number;
  maxDayCount: number;
}

export function MapAnalysisView({
  incidents,
  filtered,
  categoryOptions,
  purokOptions,
  filters,
  onFiltersChange,
  onResetFilters,
  layers,
  onToggleLayer,
  heatCounts,
  selectedIncident,
  onSelectIncident,
  areaStats,
  bucketStats,
  dayStats,
  maxBucketCount,
  maxDayCount,
}: MapAnalysisViewProps) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 items-stretch">
      <div className="min-w-0 xl:col-span-2 flex flex-col h-full">
        <div className="mb-4 rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm flex-shrink-0">
          <div className="mb-3.5 flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-1.5 text-[#0038A8]">
                <Filter size={14} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-stone-800">Incident Filters</h3>
                <p className="text-[10px] text-stone-400">Refine view criteria</p>
              </div>
            </div>
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors shadow-2xs"
            >
              <RefreshCw size={11} /> Reset
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <select
              value={filters.type}
              onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })}
              className={selectCls}
              title="Incident Type"
            >
              <option value="all">All types</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filters.area}
              onChange={(e) => onFiltersChange({ ...filters, area: e.target.value })}
              className={selectCls}
              title="Area / Zone / Purok"
            >
              <option value="all">All areas</option>
              {purokOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
              className={selectCls}
              title="Status"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="under_investigation">Under Investigation</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={filters.severity}
              onChange={(e) => onFiltersChange({ ...filters, severity: e.target.value })}
              className={selectCls}
              title="Severity"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="warning">Warning</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filters.tod}
              onChange={(e) => onFiltersChange({ ...filters, tod: e.target.value })}
              className={selectCls}
              title="Time of Day"
            >
              <option value="all">Any time of day</option>
              <option value="morning">Morning (6a–12n)</option>
              <option value="afternoon">Afternoon (12n–5p)</option>
              <option value="evening">Evening (5p–9p)</option>
              <option value="night">Night (9p–6a)</option>
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className={selectCls}
              title="Date from"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className={selectCls}
              title="Date to"
            />
            <div className="flex items-center rounded-lg border border-dashed border-stone-200 px-2.5 py-1.5 text-[10px] text-[#94A3B8] bg-stone-50/50">
              {filtered.length} of {incidents.length} match
            </div>
          </div>
        </div>

        <div className="flex-1">
          <BarangayMap
            incidents={filtered}
            selectedIncident={selectedIncident}
            onSelectIncident={onSelectIncident}
            draftPoints={[]}
            mapMode="view"
            interactive
            onMapClick={() => { }}
            onToggleLayer={onToggleLayer}
            layers={layers}
            heatCounts={heatCounts}
            showCoverage={false}
            coveragePct={0}
            nowLabel={`${incidents.length} incidents · ${filtered.length} shown`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 h-full">
        {/* Incident distribution summary */}
        <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm flex-shrink-0">
          <div className="mb-3.5 flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-1.5 text-[#0038A8]">
                <TrendingUp size={14} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-stone-800">Incident Distribution</h3>
                <p className="text-[10px] text-stone-400">Spatial & temporal breakdown</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Top areas</p>
              <div className="space-y-1.5">
                {areaStats.slice(0, 5).map((a, i) => (
                  <div key={a.name} className="flex items-center gap-2 rounded-lg bg-stone-50/60 px-2.5 py-1.5">
                    <span className="w-4 text-[10px] font-bold text-stone-400">{i + 1}</span>
                    <span className="flex-1 truncate text-[11px] font-medium text-stone-700">{a.name}</span>
                    <span className="text-[10px] text-[#94A3B8]">{a.dominant}</span>
                    <span className="rounded-full bg-[#0038A8]/10 px-2 py-0.5 text-[10px] font-bold text-[#0038A8]">{a.count}</span>
                  </div>
                ))}
                {areaStats.length === 0 && <p className="text-[10px] text-[#94A3B8]">No incidents in the current window.</p>}
              </div>
            </div>

            <div className="border-t border-stone-100 pt-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Peak time of day</p>
              <div className="space-y-2">
                {bucketStats.map((b) => (
                  <div key={b.key} className="flex items-center gap-2">
                    <Flame size={12} className={b.count === maxBucketCount && b.count > 0 ? "text-rose-500" : "text-stone-300"} />
                    <span className="w-28 shrink-0 text-[10px] font-medium text-stone-600">{BUCKET_LABEL[b.key].split(" ")[0]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${b.count === maxBucketCount && b.count > 0 ? "bg-rose-500" : "bg-[#0038A8]"}`}
                        style={{ width: `${maxBucketCount > 0 ? (b.count / maxBucketCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-[10px] font-bold text-stone-700">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-100 pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Peak days</p>
              <div className="flex items-end justify-between gap-1.5 rounded-lg bg-stone-50/60 p-2.5">
                {dayStats.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold text-stone-700">{d.count}</span>
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${d.count === maxDayCount && d.count > 0 ? "bg-rose-500" : "bg-[#0038A8]"}`}
                      style={{ height: `${Math.max(4, maxDayCount > 0 ? (d.count / maxDayCount) * 44 : 4)}px` }}
                    />
                    <span className="text-[9px] font-bold uppercase text-stone-500">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Incident list */}
        <div className="flex-1 min-h-0 rounded-xl border border-stone-200/80 bg-white shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 bg-stone-50/50">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-1.5 text-[#0038A8]">
                <AlertTriangle size={14} />
              </div>
              <h3 className="text-[13px] font-bold text-stone-800">Incidents</h3>
            </div>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-semibold text-stone-600">{filtered.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 min-h-0">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Search size={20} className="mx-auto text-stone-300" />
                <p className="mt-2 text-[11px] font-medium text-stone-500">No incidents match the filters</p>
              </div>
            ) : (
              filtered.map((inc) => {
                const st = INC_STATUS_HEALTH[inc.status] ?? { label: inc.status, badge: "" };
                return (
                  <button
                    key={inc.id}
                    onClick={() => onSelectIncident(inc)}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
                  >
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV_COLOR[inc.severity] ?? "#94a3b8" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-stone-800">{inc.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${st.badge}`}>{st.label}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-[#334155]">
                        {inc.category} · {inc.purok}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#94A3B8]">{formatDateTime(inc.time)} · {inc.reporter || "Anonymous"}</p>
                    </div>
                    <ChevronRight size={14} className="mt-2 shrink-0 text-stone-300" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}