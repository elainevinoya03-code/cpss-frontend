import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Siren,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  ChevronDown,
  Filter,
  Search,
  ArrowUpRight,
  Eye,
  MessageSquare,
} from "lucide-react";
import {
  useIncidentStore,
  type Incident,
} from "../desk_officer/incidentStore";

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  new: { label: "New", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  in_progress: { label: "In Progress", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  closed_false_alarm: { label: "Closed", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

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

export default function IncidentOversight({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { incidents } = useIncidentStore();
  const [filter, setFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const filtered = useMemo(() => {
    let list = incidents;
    if (filter === "open") list = list.filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm");
    else if (filter === "critical") list = list.filter((i) => i.severity === "critical" || i.source === "sos" || i.priority === "High");
    else if (filter === "resolved") list = list.filter((i) => i.status === "resolved" || i.status === "closed_false_alarm");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.purok.toLowerCase().includes(q));
    }
    return list;
  }, [incidents, filter, search]);

  const openCount = incidents.filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm").length;
  const criticalCount = incidents.filter((i) => (i.severity === "critical" || i.source === "sos" || i.priority === "High") && i.status !== "resolved").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved" || i.status === "closed_false_alarm").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Incident Oversight</h1>
            <p className="mt-1 text-sm text-stone-500">Monitor, triage, and track all reported incidents across the barangay</p>
          </div>
        </header>

        {/* KPI */}
        <section className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">OPEN INCIDENTS</span>
            <div className="mt-1 text-[22px] font-bold text-[#0038A8]">{openCount}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">CRITICAL / SOS</span>
            <div className="mt-1 text-[22px] font-bold text-rose-600">{criticalCount}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">RESOLVED</span>
            <div className="mt-1 text-[22px] font-bold text-emerald-600">{resolvedCount}</div>
          </div>
        </section>

        {/* Filters & search */}
        <section className="mb-4 flex flex-wrap items-center gap-2">
          {["open", "critical", "resolved", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                filter === f ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search incidents..."
                className="w-48 rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-[11px] text-stone-700 outline-none focus:border-[#0038A8]/50"
              />
            </div>
          </div>
        </section>

        {/* Incident list */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <AlertTriangle size={32} className="mx-auto text-stone-300" />
              <p className="mt-3 text-[13px] text-stone-400">No incidents found</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {filtered.map((inc) => {
                const status = STATUS_META[inc.status] ?? STATUS_META.new;
                const isEmergency = inc.severity === "critical" || inc.source === "sos";
                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-stone-50/50"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isEmergency ? "bg-rose-100 text-rose-600" : "bg-[#E9EDFB] text-[#0038A8]"}`}>
                      {isEmergency ? <Siren size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-[13px] font-semibold text-stone-800">{inc.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${status.badge}`}>{status.label}</span>
                        {isEmergency && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-600">SOS / Critical</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B]">{inc.category} · {inc.purok}</p>
                    </div>
                    <div className="hidden items-center gap-3 text-[10px] text-[#94A3B8] sm:flex">
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatTimeAgo(inc.time)}</span>
                      <span className="flex items-center gap-1"><User size={10} /> {inc.reporter}</span>
                    </div>
                    <ArrowUpRight size={14} className="text-stone-300" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detail panel */}
        {selectedIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedIncident(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-bold text-stone-900">{selectedIncident.id} — {selectedIncident.category}</h3>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">{selectedIncident.purok} · {formatTimeAgo(selectedIncident.time)}</p>
                </div>
                <button onClick={() => setSelectedIncident(null)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-500 hover:bg-stone-50">
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_META[selectedIncident.status]?.badge ?? ""}`}>
                  {STATUS_META[selectedIncident.status]?.label ?? selectedIncident.status}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  selectedIncident.priority === "High" ? "bg-rose-100 text-rose-700" : selectedIncident.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                }`}>
                  {selectedIncident.priority}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-stone-600 mb-4">{selectedIncident.description}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-stone-50 px-3 py-2"><span className="text-[9px] font-medium tracking-wider text-stone-400">REPORTER</span><br /><span className="font-medium text-stone-800">{selectedIncident.reporter}</span></div>
                <div className="rounded-lg bg-stone-50 px-3 py-2"><span className="text-[9px] font-medium tracking-wider text-stone-400">SOURCE</span><br /><span className="font-medium text-stone-800 capitalize">{selectedIncident.source.replace("_", " ")}</span></div>
                <div className="rounded-lg bg-stone-50 px-3 py-2"><span className="text-[9px] font-medium tracking-wider text-stone-400">ASSIGNED TEAM</span><br /><span className="font-medium text-stone-800">{selectedIncident.assignedTeam ?? "Unassigned"}</span></div>
                <div className="rounded-lg bg-stone-50 px-3 py-2"><span className="text-[9px] font-medium tracking-wider text-stone-400">LOCATION</span><br /><span className="font-medium text-stone-800">{selectedIncident.purok}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
