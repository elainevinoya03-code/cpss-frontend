import { useState, useMemo } from "react";
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Users,
  MapPin,
  Clock,
  ClipboardList,
  CheckCircle2,
  UserCheck,
  UserX,
  Timer,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useIncidentStore } from "../desk_officer/incidentStore";
import { getTanods } from "../desk_officer/tanodStore";
import { PUROK_ZONES } from "../constants/purok";
import {
  usePatrolScheduleStore,
  getRoster,
  getTeams,
  getCheckInOutRecords,
} from "./patrolScheduleStore";
import type { CheckInOutRecord } from "./patrolScheduleShared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TYPES = [
  { key: "incidents", label: "Incident Summary", icon: AlertTriangle },
  { key: "patrol", label: "Patrol Coverage", icon: MapPin },
  { key: "team", label: "Team Performance", icon: Users },
  { key: "response", label: "Response Time Analysis", icon: Clock },
  { key: "duty", label: "Duty Reports", icon: ClipboardList },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(isoStr?: string) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return "—";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 0) return "—";
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

function formatTimeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Seed completed duty records (so the tab is populated out of the box)
// ---------------------------------------------------------------------------

const DEMO_COMPLETED_RECORDS: CheckInOutRecord[] = [
  {
    id: "DIO-001",
    scheduleId: "PS-2026-041",
    tanodId: "tn-03",
    teamId: "team-alpha",
    checkInTime: new Date(Date.now() - 5.5 * 3_600_000).toISOString(),
    checkOutTime: new Date(Date.now() - 0.5 * 3_600_000).toISOString(),
    confirmedBy: "Chief Tanod",
    checkInNotes: "Equipment check OK. Issued two traffic cones for deployment.",
    checkOutNotes: "All quiet at end of duty. Gate secured. No blotter referrals.",
    checkpointPlanId: "CP-2026-118",
    status: "checked_out",
    createdAt: new Date(Date.now() - 5.5 * 3_600_000).toISOString(),
  },
  {
    id: "DIO-002",
    scheduleId: "PS-2026-041",
    tanodId: "tn-01",
    teamId: "team-alpha",
    checkInTime: new Date(Date.now() - 27 * 3_600_000).toISOString(),
    checkOutTime: new Date(Date.now() - 22 * 3_600_000).toISOString(),
    confirmedBy: "Chief Tanod",
    checkInNotes: "Heavier than usual foot traffic due to fiesta preparations. Extra lights deployed.",
    checkOutNotes: "Two minor incidents logged: vendor dispute (resolved), abandoned bag at stall 17 (cleared). No escalation.",
    checkpointPlanId: "CP-2026-118",
    status: "checked_out",
    createdAt: new Date(Date.now() - 27 * 3_600_000).toISOString(),
  },
  {
    id: "DIO-003",
    scheduleId: "PS-2026-042",
    tanodId: "tn-05",
    teamId: "team-bravo",
    checkInTime: new Date(Date.now() - 52 * 3_600_000).toISOString(),
    checkOutTime: new Date(Date.now() - 47 * 3_600_000).toISOString(),
    confirmedBy: "Chief Tanod",
    checkInNotes: "Terminal area: buses running late; crowd spilling into road.",
    checkOutNotes: "Coordinated with PNP for 30 min traffic diversion. No injuries. All CPs confirmed.",
    checkpointPlanId: "CP-2026-119",
    status: "checked_out",
    createdAt: new Date(Date.now() - 52 * 3_600_000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Duty Reports Tab
// ---------------------------------------------------------------------------

function DutyReportsTab() {
  const { checkInOutRecords } = usePatrolScheduleStore();
  const allRoster = getRoster();
  const allTeams = getTeams();

  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [selected, setSelected] = useState<CheckInOutRecord | null>(null);

  // Merge live completed records + demo seed
  const completedRecords = useMemo(() => {
    const live = checkInOutRecords.filter((r) => r.status === "checked_out");
    return [...live, ...DEMO_COMPLETED_RECORDS];
  }, [checkInOutRecords]);

  const filtered = useMemo(() => {
    let list = completedRecords;
    if (filterTeam !== "all") list = list.filter((r) => r.teamId === filterTeam);
    if (filterPlan !== "all") list = list.filter((r) => r.checkpointPlanId === filterPlan);
    return list;
  }, [completedRecords, filterTeam, filterPlan]);

  const uniquePlans = useMemo(() => {
    const plans = [...new Set(completedRecords.map((r) => r.checkpointPlanId))];
    return plans;
  }, [completedRecords]);

  function tanodName(id: string) {
    return allRoster.find((m) => m.id === id)?.name ?? id;
  }
  function teamName(id: string) {
    return allTeams.find((t) => t.id === id)?.name ?? id;
  }

  // Summary KPIs
  const totalCompleted = completedRecords.length;
  const avgDurationMs = useMemo(() => {
    const withBoth = completedRecords.filter((r) => r.checkInTime && r.checkOutTime);
    if (withBoth.length === 0) return 0;
    const totalMs = withBoth.reduce((sum, r) => sum + (new Date(r.checkOutTime!).getTime() - new Date(r.checkInTime!).getTime()), 0);
    return totalMs / withBoth.length;
  }, [completedRecords]);
  const avgDurationHrs = Math.floor(avgDurationMs / 3_600_000);
  const avgDurationMins = Math.floor((avgDurationMs % 3_600_000) / 60_000);
  const withNotes = completedRecords.filter((r) => r.checkOutNotes).length;

  return (
    <>
      {/* KPIs */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
          <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">COMPLETED DUTIES</span>
          <div className="mt-1 text-[22px] font-bold text-[#15803D]">{totalCompleted}</div>
          <div className="mt-0.5 text-[10px] text-[#94A3B8]">check-outs recorded</div>
        </div>
        <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
          <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">AVG DUTY DURATION</span>
          <div className="mt-1 text-[22px] font-bold text-emerald-600">
            {avgDurationMs > 0 ? `${avgDurationHrs}h ${avgDurationMins}m` : "—"}
          </div>
          <div className="mt-0.5 text-[10px] text-[#94A3B8]">per completed duty</div>
        </div>
        <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">WITH FIELD NOTES</span>
          <div className="mt-1 text-[22px] font-bold text-sky-600">{withNotes}</div>
          <div className="mt-0.5 text-[10px] text-[#94A3B8]">duties with checkout notes</div>
        </div>
      </section>

      {/* Filters */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-600 outline-none focus:border-[#15803D]/50"
        >
          <option value="all">All Teams</option>
          {allTeams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-600 outline-none focus:border-[#15803D]/50"
        >
          <option value="all">All Plans</option>
          {uniquePlans.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-stone-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </section>

      {/* Duty summary cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white px-5 py-16 text-center">
          <ClipboardList size={32} className="mx-auto text-stone-300" />
          <p className="mt-3 text-[13px] text-stone-400">No completed duty records</p>
          <p className="mt-1 text-[11px] text-stone-300">Records appear here after a Tanod checks out</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const duration = formatDuration(rec.checkInTime, rec.checkOutTime);
            return (
              <div
                key={rec.id}
                className="rounded-xl border border-black/5 bg-white shadow-sm overflow-hidden"
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-[13px] font-bold shrink-0">
                    {tanodName(rec.tanodId).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-stone-800">{tanodName(rec.tanodId)}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">Completed</span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] text-stone-500">{teamName(rec.teamId)}</span>
                    </div>
                    <p className="text-[10px] text-stone-400">{rec.scheduleId} · {rec.checkpointPlanId}</p>
                  </div>
                  <button
                    onClick={() => setSelected(rec)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50 shrink-0"
                  >
                    View Summary <ArrowRight size={11} />
                  </button>
                </div>

                {/* Card Body */}
                <div className="grid grid-cols-2 gap-0 sm:grid-cols-4 divide-x divide-stone-100">
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-stone-400">CHECK-IN</p>
                    <p className="mt-0.5 text-[11px] font-medium text-stone-700">{formatDateTime(rec.checkInTime)}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-stone-400">CHECK-OUT</p>
                    <p className="mt-0.5 text-[11px] font-medium text-stone-700">{formatDateTime(rec.checkOutTime)}</p>
                  </div>
                  <div className="px-4 py-3 col-span-2 sm:col-span-1">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-stone-400">DURATION</p>
                    <p className="mt-0.5 text-[12px] font-bold text-emerald-600">{duration}</p>
                  </div>
                  <div className="px-4 py-3 col-span-2 sm:col-span-1">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-stone-400">FIELD NOTES</p>
                    <p className="mt-0.5 text-[11px] text-stone-600 line-clamp-1">
                      {rec.checkOutNotes ?? rec.checkInNotes ?? <span className="text-stone-300">None</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-stone-900">Duty Summary</h3>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  {tanodName(selected.tanodId)} · {teamName(selected.teamId)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-500 hover:bg-stone-50">
                Close
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Completed</span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-500">{selected.scheduleId}</span>
              <span className="rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] text-[#15803D]">{selected.checkpointPlanId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] mb-4">
              <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">CHECK-IN</p>
                <p className="mt-0.5 font-semibold text-stone-800">{formatDateTime(selected.checkInTime)}</p>
              </div>
              <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">CHECK-OUT</p>
                <p className="mt-0.5 font-semibold text-stone-800">{formatDateTime(selected.checkOutTime)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2.5 border border-emerald-100">
                <p className="text-[9px] font-medium tracking-wider text-emerald-400">TOTAL DURATION</p>
                <p className="mt-0.5 text-[14px] font-bold text-emerald-700">{formatDuration(selected.checkInTime, selected.checkOutTime)}</p>
              </div>
              <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">CONFIRMED BY</p>
                <p className="mt-0.5 font-semibold text-stone-800">{selected.confirmedBy}</p>
              </div>
            </div>

            {selected.checkInNotes && (
              <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-sky-400">Check-in Notes</p>
                <p className="text-[12px] leading-relaxed text-stone-700">{selected.checkInNotes}</p>
              </div>
            )}

            {selected.checkOutNotes && (
              <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Check-out Notes</p>
                <p className="text-[12px] leading-relaxed text-stone-700">{selected.checkOutNotes}</p>
              </div>
            )}

            <div className="mt-2 rounded-lg border border-stone-100 bg-stone-50/60 px-4 py-3 text-[10px] text-stone-400">
              <p className="font-medium text-stone-500 mb-0.5">Actual path vs planned route</p>
              <p>GPS-based path comparison will be available once the Tanod mobile app transmits route logs. Checkpoint confirmations are already tracked in Live Tanod Tracking.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ReportsAnalytics({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { incidents } = useIncidentStore();
  const [tanods] = useState(() => getTanods());
  const [activeReport, setActiveReport] = useState("incidents");
  const [dateRange, setDateRange] = useState("month");

  const openIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved" || i.status === "closed_false_alarm");

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    incidents.forEach((i) => { map[i.category] = (map[i.category] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [incidents]);

  const purokBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    incidents.forEach((i) => { map[i.purok] = (map[i.purok] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  const maxCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0][1] : 1;
  const maxPurok = purokBreakdown.length > 0 ? purokBreakdown[0][1] : 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Reports & Analytics</h1>
              <p className="mt-1 text-sm text-stone-500">Incident statistics, patrol coverage, duty summaries & operational insights</p>
            </div>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50">
              <Download size={13} /> Export Report
            </button>
          </div>
        </header>

        {/* Report type tabs */}
        <section className="mb-6 flex flex-wrap gap-2">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setActiveReport(rt.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-medium transition ${
                activeReport === rt.key
                  ? "bg-[#15803D] text-white shadow-sm"
                  : "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              <rt.icon size={13} /> {rt.label}
            </button>
          ))}
          {activeReport !== "duty" && (
            <div className="ml-auto">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-600 outline-none focus:border-[#15803D]/50"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
            </div>
          )}
        </section>

        {/* Duty Reports tab content */}
        {activeReport === "duty" && <DutyReportsTab />}

        {/* All other tabs — existing analytics content */}
        {activeReport !== "duty" && (
          <>
            {/* Summary KPIs */}
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">TOTAL INCIDENTS</span>
                <div className="mt-1 text-[22px] font-bold text-[#15803D]">{incidents.length}</div>
                <div className="mt-0.5 text-[10px] text-[#94A3B8]">{openIncidents.length} open, {resolvedIncidents.length} resolved</div>
              </div>
              <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">ACTIVE TANODS</span>
                <div className="mt-1 text-[22px] font-bold text-emerald-600">{tanods.filter((t) => t.status !== "off_duty").length}</div>
              </div>
              <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">CRITICAL INCIDENTS</span>
                <div className="mt-1 text-[22px] font-bold text-rose-600">{incidents.filter((i) => i.severity === "critical" || i.source === "sos").length}</div>
              </div>
              <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">RESOLUTION RATE</span>
                <div className="mt-1 text-[22px] font-bold text-[#15803D]">{incidents.length > 0 ? Math.round((resolvedIncidents.length / incidents.length) * 100) : 0}%</div>
              </div>
            </section>

            {/* Charts area */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {/* Category breakdown */}
              <div className="rounded-xl border border-black/5 bg-white shadow-sm">
                <div className="border-b border-stone-100 px-5 py-4">
                  <h3 className="text-[14px] font-semibold text-[#334155]">Incidents by Category</h3>
                </div>
                <div className="p-5">
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-center text-[12px] text-stone-400 py-10">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {categoryBreakdown.map(([cat, count]) => (
                        <div key={cat}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-medium text-stone-700">{cat}</span>
                            <span className="font-semibold text-stone-800">{count}</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                            <div className="h-full rounded-full bg-[#15803D] transition-all duration-500" style={{ width: `${(count / maxCategory) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Purok breakdown */}
              <div className="rounded-xl border border-black/5 bg-white shadow-sm">
                <div className="border-b border-stone-100 px-5 py-4">
                  <h3 className="text-[14px] font-semibold text-[#334155]">Incidents by Purok</h3>
                </div>
                <div className="p-5">
                  {purokBreakdown.length === 0 ? (
                    <p className="text-center text-[12px] text-stone-400 py-10">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {purokBreakdown.map(([zone, count]) => (
                        <div key={zone}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-medium text-stone-700">{zone}</span>
                            <span className="font-semibold text-stone-800">{count}</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                            <div className="h-full rounded-full bg-[#0f766e] transition-all duration-500" style={{ width: `${(count / maxPurok) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Monthly trend */}
            <section className="mt-6 rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="border-b border-stone-100 px-5 py-4">
                <h3 className="text-[14px] font-semibold text-[#334155]">Monthly Incident Trend</h3>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-2" style={{ height: 160 }}>
                  {MONTHS.map((m, idx) => {
                    const height = 20 + Math.round(Math.sin(idx * 0.8 + 1) * 40 + Math.random() * 30);
                    return (
                      <div key={m} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[9px] font-semibold text-stone-500">{height}</span>
                        <div
                          className="w-full rounded-t-md bg-[#15803D] transition-all duration-500 hover:bg-[#166534]"
                          style={{ height: `${height}%`, minHeight: 4 }}
                        />
                        <span className="text-[9px] text-[#94A3B8]">{m}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
