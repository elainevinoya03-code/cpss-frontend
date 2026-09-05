import { useState, useMemo } from "react";
import {
  Map,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Calendar,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { PUROK_ZONES } from "../constants/purok";

interface PatrolRoute {
  id: string;
  name: string;
  zone: string;
  status: "active" | "completed" | "scheduled";
  assignedTeam: string[];
  startTime: string;
  endTime: string;
}

const MOCK_ROUTES: PatrolRoute[] = [
  { id: "PR-001", name: "Morning Zone Sweep", zone: "Purok 1", status: "completed", assignedTeam: ["Juan D.", "Pedro S."], startTime: "06:00", endTime: "08:00" },
  { id: "PR-002", name: "Commercial Area Patrol", zone: "Purok 3", status: "active", assignedTeam: ["Marco L."], startTime: "08:00", endTime: "10:00" },
  { id: "PR-003", name: "Residential Perimeter", zone: "Purok 5", status: "scheduled", assignedTeam: ["Luis R.", "Diego M."], startTime: "14:00", endTime: "16:00" },
  { id: "PR-004", name: "Night Watch Route", zone: "Purok 2", status: "scheduled", assignedTeam: ["Andres B."], startTime: "20:00", endTime: "22:00" },
];

const STATUS_STYLE: Record<string, { badge: string; dot: string }> = {
  active: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  completed: { badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  scheduled: { badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
};

export default function PatrolSchedulerRoutes() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const filtered = useMemo(
    () => (selectedZone ? MOCK_ROUTES.filter((r) => r.zone === selectedZone) : MOCK_ROUTES),
    [selectedZone]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Patrol Operations</h1>
              <p className="mt-1 text-sm text-stone-500">Active patrol routes, coverage map & team assignments</p>
            </div>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </header>

        {/* KPI row */}
        <section className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">ACTIVE ROUTES</span>
            <div className="mt-1 text-[22px] font-bold text-emerald-600">{MOCK_ROUTES.filter((r) => r.status === "active").length}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">SCHEDULED</span>
            <div className="mt-1 text-[22px] font-bold text-sky-600">{MOCK_ROUTES.filter((r) => r.status === "scheduled").length}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">COMPLETED</span>
            <div className="mt-1 text-[22px] font-bold text-stone-400">{MOCK_ROUTES.filter((r) => r.status === "completed").length}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Map */}
          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Map size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Coverage Map</h3>
                  <p className="text-[11px] text-[#94A3B8]">Patrol route zones & coverage status</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="relative mx-auto max-w-[640px]">
                <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-auto w-full">
                  {PUROK_ZONES.map((zone) => {
                    const zoneRoutes = MOCK_ROUTES.filter((r) => r.zone === zone.name);
                    const hasActive = zoneRoutes.some((r) => r.status === "active");
                    const isSelected = selectedZone === zone.name;
                    return (
                      <g
                        key={zone.id}
                        onClick={() => setSelectedZone(isSelected ? null : zone.name)}
                        className="cursor-pointer"
                      >
                        <path
                          d={zone.path}
                          fill={isSelected ? "#dbe3fb" : hasActive ? "#ecfdf5" : "#F8FAFC"}
                          stroke={hasActive ? "#10b981" : zone.color}
                          strokeWidth={isSelected ? 2.5 : hasActive ? 2 : 1.5}
                          strokeOpacity={isSelected ? 1 : 0.6}
                          className="transition-colors duration-200"
                        />
                        <text x={zone.labelX} y={zone.labelY} textAnchor="middle" className="pointer-events-none select-none" fontSize="10" fontWeight="500" fill={zone.color} opacity={0.85}>
                          {zone.name}
                        </text>
                        {zoneRoutes.length > 0 && (
                          <g className="pointer-events-none">
                            <circle cx={zone.labelX + 30} cy={zone.labelY - 8} r={8} fill={hasActive ? "#10b981" : "#0ea5e9"} opacity={0.9} />
                            <text x={zone.labelX + 30} y={zone.labelY - 4.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
                              {zoneRoutes.length}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Routes list */}
          <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[#334155]">
                Routes {selectedZone ? `— ${selectedZone}` : ""}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-black/5">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Navigation size={24} className="mx-auto text-stone-300" />
                  <p className="mt-2 text-[12px] text-stone-400">No routes found</p>
                </div>
              ) : (
                filtered.map((route) => {
                  const style = STATUS_STYLE[route.status];
                  return (
                    <div key={route.id} className="px-5 py-3.5 transition hover:bg-stone-50/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-stone-800">{route.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${style.badge}`}>
                              {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-[#64748B]">
                            <MapPin size={9} /> {route.zone}
                            <Clock size={9} /> {route.startTime}–{route.endTime}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                            <Users size={9} /> {route.assignedTeam.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
