import { useState, useMemo } from "react";
import {
  ArrowUpRight,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Search,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useIncidentStore, type Incident } from "../desk_officer/incidentStore";

export default function ReferredCases({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { incidents } = useIncidentStore();
  const [filter, setFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<Incident | null>(null);

  const referred = useMemo(
    () => incidents.filter((i) => i.escalatedToCaptain || i.status === "acknowledged"),
    [incidents]
  );

  const filtered = useMemo(() => {
    let list = referred;
    if (filter === "pending") list = list.filter((i) => i.status !== "resolved");
    else if (filter === "resolved") list = list.filter((i) => i.status === "resolved");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.purok.toLowerCase().includes(q)
      );
    }
    return list;
  }, [referred, filter, search]);

  const pendingCount = referred.filter((i) => i.status !== "resolved").length;
  const resolvedCount = referred.filter((i) => i.status === "resolved").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Referred Cases</h1>
            <p className="mt-1 text-sm text-stone-500">Incidents escalated to the Barangay Captain for review and decision</p>
          </div>
        </header>

        {/* KPI */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">TOTAL REFERRED</span>
            <div className="mt-1 text-[22px] font-bold text-[#0038A8]">{referred.length}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">PENDING REVIEW</span>
            <div className="mt-1 text-[22px] font-bold text-amber-600">{pendingCount}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">RESOLVED</span>
            <div className="mt-1 text-[22px] font-bold text-emerald-600">{resolvedCount}</div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-2">
          {["pending", "resolved", "all"].map((f) => (
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
          <div className="ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cases..."
                className="w-48 rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-[11px] text-stone-700 outline-none focus:border-[#0038A8]/50"
              />
            </div>
          </div>
        </section>

        {/* Cases list */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <FileText size={32} className="mx-auto text-stone-300" />
              <p className="mt-3 text-[13px] text-stone-400">No referred cases found</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {filtered.map((inc) => {
                const isResolved = inc.status === "resolved" || inc.status === "closed_false_alarm";
                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedCase(inc)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-stone-50/50"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${inc.escalatedToCaptain ? "bg-violet-100 text-violet-600" : "bg-amber-100 text-amber-600"}`}>
                      <ArrowUpRight size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-[13px] font-semibold text-stone-800">{inc.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${isResolved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {isResolved ? "Resolved" : "Pending"}
                        </span>
                        {inc.escalatedToCaptain && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-700">Escalated</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B]">{inc.category} · {inc.purok}</p>
                    </div>
                    <span className="hidden text-[10px] text-[#94A3B8] sm:block">
                      <Clock size={10} className="mr-1 inline" />
                      {new Date(inc.time).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detail modal */}
        {selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedCase(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-bold text-stone-900">{selectedCase.id}</h3>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">{selectedCase.category} · {selectedCase.purok}</p>
                </div>
                <button onClick={() => setSelectedCase(null)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-500 hover:bg-stone-50">Close</button>
              </div>
              {selectedCase.escalatedReason && (
                <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-violet-700">Escalation Reason</p>
                  <p className="mt-0.5 text-[11px] text-violet-600">{selectedCase.escalatedReason}</p>
                </div>
              )}
              <p className="text-[12px] leading-relaxed text-stone-600">{selectedCase.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-stone-50 px-3 py-2"><span className="text-[9px] font-medium tracking-wider text-stone-400">REPORTER</span><br /><span className="font-medium text-stone-800">{selectedCase.reporter}</span></div>
                <div className="rounded-lg bg-stone-50 px-3 py-2"><span className="text-[9px] font-medium tracking-wider text-stone-400">ASSIGNED TEAM</span><br /><span className="font-medium text-stone-800">{selectedCase.assignedTeam ?? "Unassigned"}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
