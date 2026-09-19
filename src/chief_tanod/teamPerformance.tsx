import { useState, useMemo } from "react";
import {
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  Award,
  BarChart3,
  Activity,
} from "lucide-react";
import { getTanods, TANOD_STATUS_META, type Tanod } from "../desk_officer/tanodStore";

interface PerformanceRecord {
  tanodId: string;
  name: string;
  purok: string;
  incidentsHandled: number;
  responseTimeAvg: number;
  complianceRate: number;
  status: string;
  trend: "up" | "down" | "stable";
}

const MOCK_PERF: PerformanceRecord[] = [
  { tanodId: "T-001", name: "Juan D.", purok: "Purok 1", incidentsHandled: 24, responseTimeAvg: 4.2, complianceRate: 95, status: "available", trend: "up" },
  { tanodId: "T-002", name: "Pedro S.", purok: "Purok 2", incidentsHandled: 18, responseTimeAvg: 5.8, complianceRate: 88, status: "en_route", trend: "stable" },
  { tanodId: "T-003", name: "Marco L.", purok: "Purok 3", incidentsHandled: 31, responseTimeAvg: 3.1, complianceRate: 97, status: "on_scene", trend: "up" },
  { tanodId: "T-004", name: "Luis R.", purok: "Purok 4", incidentsHandled: 12, responseTimeAvg: 7.4, complianceRate: 72, status: "available", trend: "down" },
  { tanodId: "T-005", name: "Diego M.", purok: "Purok 5", incidentsHandled: 22, responseTimeAvg: 4.9, complianceRate: 91, status: "off_duty", trend: "up" },
  { tanodId: "T-006", name: "Andres B.", purok: "Purok 6", incidentsHandled: 15, responseTimeAvg: 6.1, complianceRate: 83, status: "available", trend: "stable" },
];

export default function TeamPerformance({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [tanods] = useState<Tanod[]>(() => getTanods());
  const [sortBy, setSortBy] = useState<string>("incidents");

  const sorted = useMemo(() => {
    const list = [...MOCK_PERF];
    if (sortBy === "incidents") list.sort((a, b) => b.incidentsHandled - a.incidentsHandled);
    else if (sortBy === "response") list.sort((a, b) => a.responseTimeAvg - b.responseTimeAvg);
    else if (sortBy === "compliance") list.sort((a, b) => b.complianceRate - a.complianceRate);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [sortBy]);

  const avgCompliance = Math.round(MOCK_PERF.reduce((s, p) => s + p.complianceRate, 0) / MOCK_PERF.length);
  const avgResponse = (MOCK_PERF.reduce((s, p) => s + p.responseTimeAvg, 0) / MOCK_PERF.length).toFixed(1);
  const totalIncidents = MOCK_PERF.reduce((s, p) => s + p.incidentsHandled, 0);
  const topPerformer = MOCK_PERF.reduce((best, p) => (p.complianceRate > best.complianceRate ? p : best), MOCK_PERF[0]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Team Performance</h1>
            <p className="mt-1 text-sm text-stone-500">Tanod compliance, response times & incident handling metrics</p>
          </div>
        </header>

        {/* KPI row */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">AVG COMPLIANCE</span>
              <Target size={14} className="text-[#15803D]" />
            </div>
            <div className={`mt-1 text-[22px] font-bold ${avgCompliance >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{avgCompliance}%</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">AVG RESPONSE</span>
              <Clock size={14} className="text-amber-500" />
            </div>
            <div className="mt-1 text-[22px] font-bold text-stone-800">{avgResponse}m</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">TOTAL INCIDENTS</span>
              <AlertTriangle size={14} className="text-[#15803D]" />
            </div>
            <div className="mt-1 text-[22px] font-bold text-[#15803D]">{totalIncidents}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">TOP PERFORMER</span>
              <Award size={14} className="text-amber-500" />
            </div>
            <div className="mt-1 text-[14px] font-bold text-stone-800">{topPerformer.name}</div>
            <div className="text-[10px] text-[#94A3B8]">{topPerformer.complianceRate}% compliance</div>
          </div>
        </section>

        {/* Performance table */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
            <h3 className="text-[14px] font-semibold text-[#334155]">Individual Performance</h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-600 outline-none focus:border-[#15803D]/50"
            >
              <option value="incidents">Sort by Incidents</option>
              <option value="response">Sort by Response Time</option>
              <option value="compliance">Sort by Compliance</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-stone-100 text-[10px] font-semibold tracking-wider text-[#94A3B8]">
                  <th className="px-5 py-3">Tanod</th>
                  <th className="px-5 py-3">Zone</th>
                  <th className="px-5 py-3 text-right">Incidents</th>
                  <th className="px-5 py-3 text-right">Avg Response</th>
                  <th className="px-5 py-3 text-center">Compliance</th>
                  <th className="px-5 py-3 text-center">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {sorted.map((rec) => {
                  const meta = TANOD_STATUS_META[rec.status as keyof typeof TANOD_STATUS_META];
                  return (
                    <tr key={rec.tanodId} className="hover:bg-stone-50/50 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${meta?.dot ?? "bg-stone-300"}`} />
                          <span className="font-semibold text-stone-800">{rec.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[#64748B]">{rec.purok}</td>
                      <td className="px-5 py-3 text-right font-semibold text-stone-800">{rec.incidentsHandled}</td>
                      <td className="px-5 py-3 text-right text-stone-600">{rec.responseTimeAvg}m</td>
                      <td className="px-5 py-3 text-center">
                        <div className="mx-auto flex items-center justify-center gap-1.5">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-stone-200">
                            <div
                              className={`h-full rounded-full ${rec.complianceRate >= 80 ? "bg-emerald-500" : rec.complianceRate >= 50 ? "bg-amber-400" : "bg-rose-500"}`}
                              style={{ width: `${rec.complianceRate}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-stone-700">{rec.complianceRate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {rec.trend === "up" ? <TrendingUp size={14} className="mx-auto text-emerald-500" /> : rec.trend === "down" ? <TrendingDown size={14} className="mx-auto text-rose-500" /> : <Activity size={14} className="mx-auto text-stone-400" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Zone breakdown */}
        <section className="mt-6 rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h3 className="text-[14px] font-semibold text-[#334155]">Zone Coverage Performance</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6"].map((zone) => {
              const zonePerf = MOCK_PERF.filter((p) => p.purok === zone);
              const avg = zonePerf.length > 0 ? Math.round(zonePerf.reduce((s, p) => s + p.complianceRate, 0) / zonePerf.length) : 0;
              return (
                <div key={zone} className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-semibold text-stone-800">{zone}</span>
                    <span className={`text-[11px] font-bold ${avg >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{avg}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                    <div className={`h-full rounded-full ${avg >= 80 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${avg}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#94A3B8]">{zonePerf.length} tanod(s) assigned</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
