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
  Filter,
  PieChart,
} from "lucide-react";
import { useIncidentStore } from "../desk_officer/incidentStore";
import { getTanods } from "../desk_officer/tanodStore";
import { PUROK_ZONES } from "../constants/purok";

const REPORT_TYPES = [
  { key: "incidents", label: "Incident Summary", icon: AlertTriangle },
  { key: "patrol", label: "Patrol Coverage", icon: MapPin },
  { key: "team", label: "Team Performance", icon: Users },
  { key: "response", label: "Response Time Analysis", icon: Clock },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Reports & Analytics</h1>
              <p className="mt-1 text-sm text-stone-500">Incident statistics, patrol coverage & operational insights</p>
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
                  ? "bg-[#0038A8] text-white shadow-sm"
                  : "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              <rt.icon size={13} /> {rt.label}
            </button>
          ))}
          <div className="ml-auto">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-600 outline-none focus:border-[#0038A8]/50"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </section>

        {/* Summary KPIs */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">TOTAL INCIDENTS</span>
            <div className="mt-1 text-[22px] font-bold text-[#0038A8]">{incidents.length}</div>
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
            <div className="mt-1 text-[22px] font-bold text-[#0038A8]">{incidents.length > 0 ? Math.round((resolvedIncidents.length / incidents.length) * 100) : 0}%</div>
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
                        <div className="h-full rounded-full bg-[#0038A8] transition-all duration-500" style={{ width: `${(count / maxCategory) * 100}%` }} />
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
                      className="w-full rounded-t-md bg-[#0038A8] transition-all duration-500 hover:bg-[#002A8C]"
                      style={{ height: `${height}%`, minHeight: 4 }}
                    />
                    <span className="text-[9px] text-[#94A3B8]">{m}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
