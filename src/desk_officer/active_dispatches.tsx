// Desk Officer Dispatch & Assignment Control Center.
// Centralized operational view: monitor incident intake, assess urgency, assign
// available field units (Tanods / BPAT), track live response operations, update
// dispatch details, request CCTV evidence, escalate / refer, and close incidents.
//
// Detailed operations (full incident files, CCTV clip request, security alert,
// agency referral, resolution summary) open in dedicated drawers / modals so the
// main view stays a clean situational-awareness + deployment surface.

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Send,
  MapPin,
  Navigation,
  Camera,
  Megaphone,
  CheckCircle2,
  Info,
  Video,
  Clock,
  ArrowUpRight,
  Landmark,
  Route,
  MessageSquare,
  X,
  ChevronRight,
  Radio,
  UserCheck,
  ListChecks,
  FileCheck2,
  Wifi,
  Battery,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { Modal, ConfirmModal } from "../components/ui";
import { formatTime } from "../utils/format";
import { PUROK_ZONES } from "../constants/purok";
import { SEVERITY_MAP } from "../constants/severity";
import {
  useIncidentStore,
  getIncidents,
  getDispatches,
  setIncidents,
  setDispatches,
  type Incident,
  type DispatchItem,
  type IncidentSource,
} from "./incidentStore";
import {
  getTanods,
  subscribeTanods,
  setTanodStatus,
  assignTanodToIncident,
  TANOD_STATUS_META,
  type Tanod,
  type TanodStatus,
} from "./tanodStore";
import { CATEGORY_ICON, CATEGORY_COLORS } from "./constants";
import {
  getFootageRequests,
  subscribeFootageRequests,
  addFootageRequest,
  type FootageRequest,
} from "../utils/footageRequestStore";
import {
  addSafetyNotice,
  type NoticeSeverity,
  type NoticeAudience,
  type SafetyNotice,
} from "../utils/safetyNoticeStore";
import { recordActivity } from "../utils/recentActivityStore";
import { pushDispatchAudit } from "../utils/dispatchAudit";

// ---------------------------------------------------------------------------
// Metadata maps (consistent with dashboard / triage conventions)
// ---------------------------------------------------------------------------

const URGENCY_META: Record<"Low" | "Medium" | "High" | "Emergency", { chip: string; dot: string; ring: string }> = {
  Low: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400", ring: "stroke-sky-400" },
  Medium: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", ring: "stroke-amber-400" },
  High: { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500", ring: "stroke-orange-500" },
  Emergency: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", ring: "stroke-rose-500" },
};

const SOURCE_META: Record<IncidentSource, { label: string; badge: string; desc: string }> = {
  resident: { label: "Resident Mobile Report", badge: "bg-sky-100 text-sky-700", desc: "Report submitted by a resident via the mobile app" },
  tanod: { label: "Tanod Field Report", badge: "bg-emerald-100 text-emerald-700", desc: "Field observation logged by an on-duty Tanod" },
  desk_officer: { label: "Desk Officer Entry", badge: "bg-stone-200 text-stone-700", desc: "Incident manually logged by the Desk Officer" },
  cctv: { label: "CCTV Escalation", badge: "bg-violet-100 text-violet-700", desc: "Escalated by the CCTV surveillance operator" },
  iot: { label: "IoT Sensor Breach", badge: "bg-amber-100 text-amber-700", desc: "Threshold breach from an ESP32 sensor device" },
  iot_cctv: { label: "IoT via CCTV", badge: "bg-orange-100 text-orange-700", desc: "IoT sensor alert flagged by the CCTV surveillance operator" },
  sos: { label: "SOS Distress Signal", badge: "bg-rose-100 text-rose-700", desc: "Emergency SOS — live GPS locked" },
};

// Incidence → marker color for the live map

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function purokCoord(purok: string): { x: number; y: number } {
  const zone = PUROK_ZONES.find((z) => z.name === purok);
  if (zone) return { x: zone.labelX, y: zone.labelY };
  return { x: 200, y: 180 };
}

function urgencyOf(inc: Incident): "Low" | "Medium" | "High" | "Emergency" {
  if (inc.severity === "critical" || inc.source === "sos") return "Emergency";
  return inc.priority;
}

const RESOLUTION_TYPES = [
  "Resolved on Scene",
  "False Alarm",
  "Settled via Mediation",
] as const;

export default function ActiveDispatches() {
  const { flash } = useToast();
  const { incidents, dispatches } = useIncidentStore();
  const [tanods, setTanods] = useState<Tanod[]>(() => getTanods());
  const [requests, setRequests] = useState<FootageRequest[]>(() => getFootageRequests());

  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [assignIncident, setAssignIncident] = useState<Incident | null>(null);
  const [directUnit, setDirectUnit] = useState<Tanod | null>(null);
  const [addBackupIncident, setAddBackupIncident] = useState<Incident | null>(null);
  const [reassignDispatch, setReassignDispatch] = useState<DispatchItem | null>(null);
  const [cctvIncident, setCctvIncident] = useState<Incident | null>(null);
  const [referIncident, setReferIncident] = useState<Incident | null>(null);
  const [resolveDispatch, setResolveDispatch] = useState<DispatchItem | null>(null);
  const [mapUnit, setMapUnit] = useState<Tanod | null>(null);

  useEffect(() => subscribeTanods(() => setTanods([...getTanods()])), []);
  useEffect(
    () => subscribeFootageRequests(() => setRequests([...getFootageRequests()])),
    []
  );

  const openIncidents = useMemo(
    () =>
      incidents
        .filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm")
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
    [incidents]
  );

  const dispatchFor = (inc: Incident) =>
    dispatches.find((d) => d.incident === inc.id);

  const filtered = useMemo(() => {
    if (tab === "pending")
      return openIncidents.filter((i) => !dispatchFor(i));
    if (tab === "active") return openIncidents.filter((i) => dispatchFor(i));
    return openIncidents;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, openIncidents, dispatches]);

  const availableUnits = useMemo(
    () => tanods.filter((t) => t.status === "available"),
    [tanods]
  );

  // Per-incident derived CCTV status
  const cctvStatus = (inc: Incident) => {
    const r = requests.find((r) => r.incidentId === inc.id && r.status !== "cancelled");
    if (!r) return { label: "Not Requested", chip: "bg-stone-100 text-stone-500" };
    if (r.status === "completed")
      return { label: "Completed", chip: "bg-emerald-100 text-emerald-700" };
    if (r.status === "in_progress")
      return { label: "In Progress", chip: "bg-sky-100 text-sky-700" };
    return { label: "Pending", chip: "bg-amber-100 text-amber-700" };
  };

  function openDetail(inc: Incident) {
    setSelectedIncident(inc);
  }

  function assignNext() {
    const next = openIncidents.find((i) => !dispatchFor(i));
    if (!next) {
      flash("No unassigned incidents left in the pending queue.", { title: "Queue Clear" });
      return;
    }
    setAssignIncident(next);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Dispatch &amp; Assignment Control Center</h1>
              <p className="mt-1 text-sm text-stone-500">
                Incident intake, urgency assessment, unit assignment and live on-scene response monitoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {availableUnits.length} Units Available
              </span>
              <button
                onClick={assignNext}
                className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
              >
                <Send size={13} /> Assign Next
              </button>
            </div>
          </div>
        </header>

        {/* Main grid: queue + live map */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Incident Queue */}
          <section className="rounded-xl border border-black/5 bg-white shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold text-[#334155]">Incident Queue</h2>
                <p className="text-[11px] text-[#94A3B8]">{filtered.length} incident{filtered.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1">
                {(["pending", "active", "all"] as const).map((t) => {
                  const label = t === "pending" ? "New / Pending" : t === "active" ? "Active" : "All";
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        tab === t ? "bg-white text-[#15803D] shadow-sm" : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      {label}
                      <span className="ml-1 text-[9px] text-stone-400">
                        {t === "pending"
                          ? openIncidents.filter((i) => !dispatchFor(i)).length
                          : t === "active"
                            ? openIncidents.filter((i) => dispatchFor(i)).length
                            : openIncidents.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <ListChecks size={26} className="text-stone-300" />
                  <p className="mt-3 text-[13px] font-medium text-stone-500">No incidents in this view</p>
                  <p className="mt-1 max-w-xs text-[11px] text-stone-400">
                    All open incidents are already assigned, or the queue is clear.
                  </p>
                </div>
              ) : (
                filtered.map((inc) => {
                  const ur = URGENCY_META[urgencyOf(inc)];
                  const dispatch = dispatchFor(inc);
                  const isEmergency = inc.severity === "critical" || inc.source === "sos";
                  const Icon = CATEGORY_ICON[inc.category] ?? Info;
                  const cat = CATEGORY_COLORS[inc.category] ?? CATEGORY_COLORS["Other"];
                  const cctv = cctvStatus(inc);
                  const assignedUnit = dispatch ? getTanods().find((t) => t.name === dispatch.team) : undefined;
                  return (
                    <article key={inc.id} className={`px-5 py-4 transition hover:bg-[#DCFCE7]/30 ${isEmergency ? "bg-rose-50/50" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${cat.bg} ${cat.text}`}>
                            <Icon size={15} />
                          </span>
                          <div>
                            <p className="font-mono text-[12px] font-bold text-stone-900">{inc.id}</p>
                            <p className="text-[10px] text-stone-400">{inc.category}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isEmergency && (
                            <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-semibold text-rose-700">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                              </span>
                              Emergency
                            </span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${ur.chip}`}>
                            {urgencyOf(inc)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${cctv.chip}`}>CCTV: {cctv.label}</span>
                        </div>
                      </div>

                      <p className="mt-2 text-[12px] leading-snug text-stone-700">{inc.description}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-stone-500">
                        <span className="inline-flex items-center gap-1"><MapPin size={10} /> {inc.purok}</span>
                        <span className="inline-flex items-center gap-1"><Clock size={10} /> Received {timeAgo(inc.time)}</span>
                        <span className="inline-flex items-center gap-1">
                          {dispatch ? (
                            <><span className={`h-1.5 w-1.5 rounded-full ${assignedUnit ? TANOD_STATUS_META[assignedUnit.status].dot : "bg-stone-400"}`} /> Status: Dispatched ({dispatch.team})</>
                          ) : (
                            <><span className="h-1.5 w-1.5 rounded-full bg-stone-400" /> Status: Unassigned</>
                          )}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!dispatch ? (
                          <button
                            onClick={() => setAssignIncident(inc)}
                            className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
                          >
                            <Send size={12} /> Assign Unit
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setAddBackupIncident(inc)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <UserCheck size={12} /> Add Backup
                            </button>
                            <button
                              onClick={() => setReassignDispatch(dispatch)}
                              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"
                            >
                              <Route size={12} /> Reassign
                            </button>
                            <button
                              onClick={() => setResolveDispatch(dispatch)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <CheckCircle2 size={12} /> Close Case
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openDetail(inc)}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"
                        >
                          View Details <ChevronRight size={12} />
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          {/* Live GPS Tracking Map */}
          <section className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#334155]">
                <Navigation size={14} className="text-[#15803D]" /> Live GPS Tracking
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-medium text-stone-500">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> En Route</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> On Scene</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-400" /> Off Duty</span>
              </div>
            </div>
            <div className="p-3">
              <svg viewBox="0 0 420 390" className="w-full rounded-lg border border-stone-100 bg-[#F6F8FF]">
                {PUROK_ZONES.map((z) => (
                  <path
                    key={z.id}
                    d={z.path}
                    fill={z.color}
                    fillOpacity="0.12"
                    stroke={z.color}
                    strokeWidth="1.5"
                  />
                ))}
                {PUROK_ZONES.map((z) => (
                  <text key={z.id} x={z.labelX} y={z.labelY} fontSize="11" fontWeight="600" fill={z.color} textAnchor="middle">
                    {z.name}
                  </text>
                ))}

                {/* Incident markers */}
                {openIncidents.map((inc) => {
                  const pos = purokCoord(inc.purok);
                  const isEmergency = inc.severity === "critical" || inc.source === "sos";
                  const dispatch = dispatchFor(inc);
                  return (
                    <g key={inc.id} transform={`translate(${pos.x + 26}, ${pos.y - 6})`} className="cursor-pointer" onClick={() => openDetail(inc)}>
                      <circle r="11" fill={isEmergency ? "#f43f5e" : dispatch ? "#f59e0b" : "#15803D"} fillOpacity="0.18" />
                      <circle r="5" fill={isEmergency ? "#f43f5e" : dispatch ? "#f59e0b" : "#15803D"} stroke="#fff" strokeWidth="1.5" />
                    </g>
                  );
                })}

                {/* Tanod markers */}
                {tanods.map((t) => {
                  const pos = purokCoord(t.purok || "Purok 1");
                  const color =
                    t.status === "available" ? "#10b981"
                    : t.status === "en_route" ? "#f59e0b"
                    : t.status === "on_scene" ? "#f43f5e"
                    : "#a8a29e";
                  return (
                    <g key={t.id} transform={`translate(${pos.x + (t.id.charCodeAt(1) % 5) * 8 - 16}, ${pos.y + 18})`} className="cursor-pointer" onClick={() => setMapUnit(t)}>
                      <circle r="8" fill={color} fillOpacity="0.18" />
                      <circle r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
                    </g>
                  );
                })}
              </svg>

              {/* Map popover for selected unit */}
              {mapUnit && (
                <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-stone-900">{mapUnit.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${TANOD_STATUS_META[mapUnit.status].chip}`}>
                      {TANOD_STATUS_META[mapUnit.status].label}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-stone-500">
                    <span className="inline-flex items-center gap-1"><Wifi size={10} /> Signal: Good</span>
                    <span className="inline-flex items-center gap-1"><Battery size={10} /> Battery: 82%</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={10} /> Beat: {mapUnit.purok || "—"}</span>
                    <span className="inline-flex items-center gap-1"><ListChecks size={10} /> Task: {mapUnit.assignment || "None"}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Responder Status Overview */}
        <section className="mt-4 rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[#334155]">Responder Status Overview</h2>
            <p className="text-[11px] text-[#94A3B8]">All shift responders — availability, active assignment and quick actions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-stone-100 text-[9px] uppercase tracking-wider text-stone-400">
                  <th className="px-5 py-2.5 font-semibold">Unit Name</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Active Assignment</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {tanods.map((t) => {
                  const meta = TANOD_STATUS_META[t.status];
                  const incident = t.incidentId ? incidents.find((i) => i.id === t.incidentId) : undefined;
                  return (
                    <tr key={t.id} className="hover:bg-[#DCFCE7]/30">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-stone-900">{t.name}</p>
                        <p className="text-[9px] text-stone-400">{t.members} members · {t.purok || "Unassigned"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${meta.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {incident ? (
                          <span className="font-mono text-[11px] font-semibold text-[#15803D]">{incident.id}</span>
                        ) : (
                          <span className="text-stone-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          {t.status === "available" ? (
                            <button
                              onClick={() => {
                                const inc = openIncidents.find((i) => !dispatchFor(i));
                                if (!inc) { flash("No pending unassigned incident to assign.", { title: "Queue Empty" }); return; }
                                setAssignIncident(inc);
                              }}
                              className="flex items-center gap-1 rounded-lg border border-[#15803D]/30 bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-semibold text-[#15803D] transition hover:bg-[#dfe6fa]"
                            >
                              <Send size={11} /> Assign Incident
                            </button>
                          ) : (
                            <button
                              onClick={() => setReassignDispatch(dispatches.find((d) => d.incident === t.incidentId) ?? null)}
                              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
                            >
                              <Route size={11} /> Reassign
                            </button>
                          )}
                          <button
                            onClick={() => setDirectUnit(t)}
                            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
                          >
                            <MessageSquare size={11} /> Direct Msg
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ----- Modals / Drawers ----- */}
      {selectedIncident && (
        <IncidentDetailDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onAssign={() => { setAssignIncident(selectedIncident); }}
          onCctv={() => setCctvIncident(selectedIncident)}
          onRefer={() => setReferIncident(selectedIncident)}
        />
      )}
      {assignIncident && (
        <AssignModal
          incident={assignIncident}
          onClose={() => setAssignIncident(null)}
        />
      )}
      {addBackupIncident && (
        <AddBackupModal
          incident={addBackupIncident}
          onClose={() => setAddBackupIncident(null)}
        />
      )}
      {reassignDispatch && (
        <ReassignModal
          dispatch={reassignDispatch}
          onClose={() => setReassignDispatch(null)}
        />
      )}
      {cctvIncident && (
        <CctvRequestModal
          incident={cctvIncident}
          onClose={() => setCctvIncident(null)}
        />
      )}
      {referIncident && (
        <ReferralModal
          incident={referIncident}
          onClose={() => setReferIncident(null)}
        />
      )}
      {directUnit && (
        <DirectMessageModal unit={directUnit} onClose={() => setDirectUnit(null)} />
      )}
      {resolveDispatch && (
        <ResolveModal
          dispatch={resolveDispatch}
          onClose={() => setResolveDispatch(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident Detail Drawer
// ---------------------------------------------------------------------------

type TimelineKind =
  | "submitted"
  | "acknowledged"
  | "assigned"
  | "status"
  | "cctv"
  | "referred"
  | "closed"
  | "note";

interface TimelineEntry {
  time: string;
  title: string;
  detail?: string;
  kind: TimelineKind;
}

const KIND_DOT: Record<TimelineKind, string> = {
  submitted: "bg-stone-400",
  acknowledged: "bg-amber-400",
  assigned: "bg-[#15803D]",
  status: "bg-sky-400",
  cctv: "bg-violet-400",
  referred: "bg-rose-500",
  closed: "bg-emerald-500",
  note: "bg-stone-300",
};

function buildTimeline(inc: Incident): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    { time: inc.time, title: "Incident received", detail: `${SOURCE_META[inc.source].label} — ${inc.category} · ${inc.purok}`, kind: "submitted" },
  ];
  if (inc.acknowledgedAt)
    entries.push({ time: inc.acknowledgedAt, title: "Desk Officer acknowledged", kind: "acknowledged" });
  if (inc.assignedTeam)
    entries.push({ time: new Date().toISOString(), title: `Assigned to ${inc.assignedTeam}`, detail: inc.dispatchId ? `Dispatch ${inc.dispatchId}` : undefined, kind: "assigned" });
  if (inc.resolvedAt)
    entries.push({ time: inc.resolvedAt, title: "Incident closed", kind: "closed" });
  return entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function IncidentDetailDrawer({
  incident,
  onClose,
  onAssign,
  onCctv,
  onRefer,
}: {
  incident: Incident;
  onClose: () => void;
  onAssign: () => void;
  onCctv: () => void;
  onRefer: () => void;
}) {
  const { flash } = useToast();
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High" | "Emergency">(urgencyOf(incident));
  const [alertOpen, setAlertOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => buildTimeline(incident));
  const ur = URGENCY_META[urgency];
  const Icon = CATEGORY_ICON[incident.category] ?? Info;
  const cat = CATEGORY_COLORS[incident.category] ?? CATEGORY_COLORS["Other"];
  const timestamp = formatTime(incident.time);

  function changeUrgency(next: "Low" | "Medium" | "High" | "Emergency") {
    setUrgency(next);
    flash(`Urgency for ${incident.id} set to ${next}.`, { title: "Urgency Updated" });
    pushDispatchAudit("manual_intervention", {
      incidentId: incident.id,
      note: `Urgency changed to ${next}`,
    });
    setTimeline((prev) => [
      ...prev,
      { time: new Date().toISOString(), title: `Urgency set to ${next}`, kind: "status" },
    ]);
  }

  function createAlert(sev: NoticeSeverity) {
    const notice = addSafetyNotice({
      title: `Security Alert — ${incident.id} (${incident.category})`,
      category: "Safety Alert",
      message: "Security alert issued from an active dispatch case by the Desk Officer. Please follow the guidance of barangay responders and stay safe.",
      target: { kind: "purok", purok: incident.purok },
      state: sev === "High" ? "draft" : "published",
      author: "D.O. Ramos",
      createdAt: new Date().toISOString(),
      incidentId: incident.id,
      severity: sev,
      audience: ["tanods", "residents"],
      approvalStatus: sev === "High" ? "pending" : undefined,
    });
    recordActivity({
      action: "alert_created",
      kind: "alert",
      incidentId: incident.id,
      refId: notice.id,
      actor: "D.O. Ramos",
      state: sev === "High" ? "Pending Approval" : "Sent",
      severity: sev === "High" ? "high" : undefined,
      target: "security_alerts",
    });
    flash(
      sev === "High"
        ? `${notice.id} drafted for Punong Barangay approval.`
        : `${notice.id} broadcast to ${incident.purok}.`,
      { title: sev === "High" ? "Alert Queued for Approval" : "Security Alert Sent" }
    );
    setAlertOpen(false);
    setTimeline((prev) => [
      ...prev,
      { time: new Date().toISOString(), title: `Security alert issued (${sev})`, kind: "note" },
    ]);
  }

  return (
    <Modal
      onClose={onClose}
      side="right"
      size="xl"
      title={`Incident Detail — ${incident.id}`}
      subtitle={incident.category}
      icon={<MapPin size={18} />}
      iconClass="bg-[#15803D]/10 text-[#15803D]"
    >
      {/* Summary header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${cat.bg} ${cat.text}`}>
            <Icon size={16} />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-stone-900">{incident.description}</p>
            <p className="text-[10px] text-stone-400">{incident.notes?.join(" · ") || "No internal notes"}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${ur.chip}`}>
          Urgency: {urgency}
        </span>
      </div>

      {/* Urgency adjust */}
      <div className="mb-4 rounded-lg border border-stone-100 p-3">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">ADJUST URGENCY</p>
        <div className="grid grid-cols-4 gap-1.5">
          <button onClick={() => changeUrgency("Low")} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${urgency === "Low" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>Low</button>
          <button onClick={() => changeUrgency("Medium")} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${urgency === "Medium" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>Medium</button>
          <button onClick={() => changeUrgency("High")} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${urgency === "High" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>High</button>
          <button onClick={() => changeUrgency("Emergency")} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${urgency === "Emergency" ? "border-rose-400 bg-rose-50 text-rose-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>Emergency</button>
        </div>
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-2 gap-3">
        <InfoTile icon={<MapPin size={12} />} label="LOCATION" value={<>{incident.purok}<span className="block text-[10px] font-normal text-stone-400">Pin recorded at report time</span></>} />
        <InfoTile icon={<Clock size={12} />} label="RECEIVED" value={timestamp} />
        <InfoTile icon={<Radio size={12} />} label="DETECTION LAYER" value={SOURCE_META[incident.source].label} />
        <InfoTile icon={<UserCheck size={12} />} label="REPORTER" value={incident.anonymous ? "Anonymous" : incident.reporter} />
      </div>

      {/* Source description */}
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-stone-100 bg-[#DCFCE7]/40 px-3 py-2.5">
        <Info size={12} className="mt-0.5 shrink-0 text-[#15803D]" />
        <p className="text-[11px] leading-relaxed text-stone-600">{SOURCE_META[incident.source].desc}</p>
      </div>

      {/* Media */}
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">ATTACHED MEDIA</p>
        <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
          {incident.photos > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: incident.photos }).map((_, i) => (
                <div key={i} className="flex h-14 w-14 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400">
                  <Camera size={18} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-stone-400">No media attached to this incident.</p>
          )}
        </div>
      </div>

      {/* CCTV sync */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5">
        <Video size={13} className="mt-0.5 shrink-0 text-violet-600" />
        <div className="text-[11px] text-violet-800">
          <span className="font-semibold">CCTV Real-Time Sync</span>
          <span className="text-violet-600"> — Camera {String((incident.purok.match(/\d/) ?? ["1"])[0]).padStart(2, "0")} ({incident.purok}) · Active Visual Confirmation</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">TIMELINE LOG</p>
        <div className="relative pl-5">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-stone-200" />
          <div className="space-y-3">
            {timeline.map((e, i) => (
              <div key={i} className="relative">
                <span className={`absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${KIND_DOT[e.kind]}`} />
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                  {new Date(e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-800">{e.title}</p>
                {e.detail && <p className="text-[10px] text-stone-500">{e.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={onAssign} className="flex items-center justify-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]">
          <Send size={13} /> Assign Responder
        </button>
        <button onClick={onCctv} className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50">
          <Video size={13} /> Request CCTV Clip
        </button>
        <button onClick={() => setAlertOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-50">
          <Megaphone size={13} /> Create Security Alert
        </button>
        <button onClick={onRefer} className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50">
          <ArrowUpRight size={13} /> Refer / Endorse
        </button>
      </div>

      {alertOpen && (
        <Modal
          onClose={() => setAlertOpen(false)}
          title="Create Security Alert"
          subtitle="Severity-graded alert linked to this active dispatch case"
          icon={<Megaphone size={18} />}
          iconClass="bg-amber-100 text-amber-700"
          size="md"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button onClick={() => setAlertOpen(false)} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={() => createAlert("High")} className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700">
                High (needs PB Approval)
              </button>
              <button onClick={() => createAlert("Warning")} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700">
                Send Warning Now
              </button>
            </div>
          }
        >
          <p className="text-[12px] leading-relaxed text-stone-600">
            This issues a security alert to <span className="font-semibold">{incident.purok}</span> for incident{" "}
            <span className="font-mono font-semibold">{incident.id}</span>. High-severity alerts are gated behind
            Punong Barangay authorization; warnings broadcast immediately.
          </p>
        </Modal>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Dispatch Assignment Modal
// ---------------------------------------------------------------------------

function AssignModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { flash } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const eligible = useMemo(
    () => getTanods().filter((t) => t.status === "available"),
    []
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) return;
    const units = eligible.filter((t) => selected.has(t.id));
    // Create dispatch record
    const dispatchId = `DP-${String(1180 + Math.floor(Math.random() * 200)).padStart(4, "0")}`;
    const teamLabel = units.map((u) => u.name).join(" + ");
    const record = getDispatches();
    setDispatches([
      {
        id: dispatchId,
        incident: incident.id,
        team: units[0]?.name ?? "Unassigned",
        status: "responding",
        purok: incident.purok,
        eta: `ETA ${2 + Math.floor(Math.random() * 6)} min`,
        photos: incident.photos,
        assigneeType: "tanod",
        dispatchedAt: new Date().toISOString(),
      },
      ...record,
    ]);
    // Update each assigned tanod to en_route
    units.forEach((u) => {
      assignTanodToIncident(u.id, incident.id, incident.category);
    });
    // Update the incident's assigned team
    const incs = getIncidents().map((i) =>
      i.id === incident.id ? { ...i, assignedTeam: teamLabel, dispatchId, status: "acknowledged" as const } : i
    );
    setIncidents(incs);
    // Activity + audit
    recordActivity({
      action: "tanod_assigned",
      kind: "tanod",
      incidentId: incident.id,
      refId: dispatchId,
      actor: "D.O. Ramos",
      state: "En Route",
      target: "dispatches",
    });
    pushDispatchAudit("dispatch_created", { incidentId: incident.id, dispatchId, note: notes.trim() || undefined });
    if (incident.priority === "High" || incident.severity === "critical" || incident.source === "sos") {
      flash(`${dispatchId} — ${units.length} unit(s) dispatched to ${incident.purok}. Push + SMS sent to the reporter.`, {
        title: "Dispatch Confirmed",
        type: "success",
      });
    } else {
      flash(`${dispatchId} — ${units.length} unit(s) dispatched to ${incident.purok}. Push notification sent.`, {
        title: "Dispatch Confirmed",
        type: "success",
      });
    }
    setConfirmOpen(false);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Dispatch & Assignment"
      subtitle={`${incident.id} · ${incident.purok} · ${urgencyOf(incident)} urgency`}
      icon={<Send size={18} />}
      iconClass="bg-[#15803D]/10 text-[#15803D]"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selected.size === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534] disabled:opacity-40"
          >
            <Send size={13} /> Confirm &amp; Dispatch
          </button>
        </div>
      }
    >
      {/* Summary */}
      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-stone-900">{incident.category}</p>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${URGENCY_META[urgencyOf(incident)].chip}`}>
            {urgencyOf(incident)}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-stone-600">{incident.description}</p>
        <p className="mt-1 text-[10px] text-stone-400">{incident.purok} · {incident.anonymous ? "Anonymous" : incident.reporter}</p>
      </div>

      {/* Units */}
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SELECT FIELD UNIT(S) — SORTED BY PROXIMITY</p>
      <div className="space-y-2">
        {eligible.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
            No available units right now. Every on-duty responder is assigned.
          </p>
        ) : (
          eligible.map((u, idx) => {
            const dist = idx === 0 ? "200m away" : `${500 + idx * 300}m away`;
            const active = selected.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                  active ? "border-[#15803D]/40 bg-[#DCFCE7] text-[#15803D]" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {active ? <CheckCircle2 size={16} className="text-[#15803D]" /> : <span className="h-4 w-4 rounded-full border border-stone-300" />}
                  <div>
                    <p className="text-[12px] font-semibold">{u.name}</p>
                    <p className="text-[9px] text-stone-400">{u.members} members · {u.purok || "Unassigned"}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <MapPin size={10} /> {dist}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Tactical notes */}
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TACTICAL NOTES / INSTRUCTIONS</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Approach from North entry; verify identities before engaging."
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#15803D]/50 focus:ring-2 focus:ring-[#15803D]/10"
        />
      </div>

      <p className="mt-2 text-[10px] text-stone-400">
        Dispatch pushes an urgent task to the assigned unit's Mobile App ("My Tasks") and alerts the Chief Tanod.
        A route line is drawn on the live map.
      </p>

      {confirmOpen && (
        <ConfirmModal
          type="confirm"
          tone="primary"
          title={`Dispatch ${selected.size} unit(s) to ${incident.id}?`}
          message={`${incident.category} in ${incident.purok} (${urgencyOf(incident)}). ${selected.size} responder(s) will be set to En Route and notified.`}
          confirmLabel={`Confirm & Dispatch ${selected.size}`}
          cancelLabel="Back"
          onConfirm={confirm}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add Backup Modal
// ---------------------------------------------------------------------------

function AddBackupModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { flash } = useToast();
  const dispatch = getDispatches().find((d) => d.incident === incident.id);
  const original = getTanods().find((t) => t.name === dispatch?.team);
  const [backup, setBackup] = useState<Tanod | null>(null);

  const candidates = getTanods().filter((t) => t.status === "available" && t.name !== original?.name);

  function confirm() {
    if (!backup) return;
    assignTanodToIncident(backup.id, incident.id, `Backup for ${incident.category}`);
    const incs = getIncidents().map((i) =>
      i.id === incident.id ? { ...i, assignedTeam: `${original?.name ?? "Team"} + ${backup.name}`, notes: [...(i.notes ?? []), `Backup unit ${backup.name} added by Desk Officer`] } : i
    );
    setIncidents(incs);
    pushDispatchAudit("unit_assigned", { incidentId: incident.id, note: `Backup unit ${backup.name} added` });
    flash(`Backup unit ${backup.name} attached to ${incident.id}. Original unit ${original?.name ?? ""} kept assigned.`, {
      title: "Backup Added",
      type: "success",
    });
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Add Backup Unit"
      subtitle={`${incident.id} · keep original assignment, attach a secondary responder`}
      icon={<UserCheck size={18} />}
      iconClass="bg-emerald-100 text-emerald-700"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={confirm} disabled={!backup} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40">
            <UserCheck size={13} /> Confirm Backup
          </button>
        </div>
      }
    >
      <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
        Original assignment: <span className="font-semibold">{original?.name ?? dispatch?.team ?? "—"}</span> · {incident.purok}
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SELECT AVAILABLE BACKUP UNIT</p>
      <div className="space-y-2">
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
            No available units to add as backup.
          </p>
        ) : (
          candidates.map((u) => (
            <button
              key={u.id}
              onClick={() => setBackup(u)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                backup?.id === u.id ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {backup?.id === u.id ? <CheckCircle2 size={16} className="text-emerald-600" /> : <span className="h-4 w-4 rounded-full border border-stone-300" />}
                <div>
                  <p className="text-[12px] font-semibold">{u.name}</p>
                  <p className="text-[9px] text-stone-400">{u.members} members · {u.purok || "Unassigned"}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reassign Modal
// ---------------------------------------------------------------------------

function ReassignModal({ dispatch, onClose }: { dispatch: DispatchItem; onClose: () => void }) {
  const { flash } = useToast();
  const original = getTanods().find((t) => t.name === dispatch.team);
  const incident = getIncidents().find((i) => i.id === dispatch.incident);
  const [target, setTarget] = useState<Tanod | null>(null);
  const [reason, setReason] = useState("");

  const candidates = getTanods().filter((t) => t.status === "available");

  function confirm() {
    if (!target) return;
    // release original back to available
    if (original) setTanodStatus(original.id, "available", { incidentId: undefined, assignment: undefined });
    // assign new unit
    assignTanodToIncident(target.id, dispatch.incident, incident?.category ?? "Reassigned dispatch");
    // update dispatch + incident
    const dis = getDispatches().map((d) => (d.id === dispatch.id ? { ...d, team: target.name, status: "responding" as const } : d));
    setDispatches(dis);
    const incs = getIncidents().map((i) => (i.id === dispatch.incident ? { ...i, assignedTeam: target.name, notes: [...(i.notes ?? []), `Reassigned to ${target.name} by Desk Officer — ${reason.trim()}`] } : i));
    setIncidents(incs);
    pushDispatchAudit("reassignment", { dispatchId: dispatch.id, incidentId: dispatch.incident, note: `Reassigned to ${target.name} — ${reason.trim()}` });
    flash(`${dispatch.id} reassigned to ${target.name}. ${original?.name ?? "Prior unit"} released to Available.`, {
      title: "Reassigned",
      type: "success",
    });
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Reassign Dispatch"
      subtitle={`${dispatch.id} · ${dispatch.incident} · reassign active assignment to a new responder`}
      icon={<Route size={18} />}
      iconClass="bg-amber-100 text-amber-700"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={confirm} disabled={!target || !reason.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-40">
            <Route size={13} /> Confirm Reassign
          </button>
        </div>
      }
    >
      <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
        Currently: <span className="font-semibold">{original?.name ?? dispatch.team}</span> · {incident?.purok ?? dispatch.purok}
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REASSIGN TO</p>
      <div className="mb-3 space-y-2">
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">No available units to reassign to.</p>
        ) : (
          candidates.map((u) => (
            <button
              key={u.id}
              onClick={() => setTarget(u)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                target?.id === u.id ? "border-amber-400 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {target?.id === u.id ? <CheckCircle2 size={16} className="text-amber-600" /> : <span className="h-4 w-4 rounded-full border border-stone-300" />}
                <div>
                  <p className="text-[12px] font-semibold">{u.name}</p>
                  <p className="text-[9px] text-stone-400">{u.members} members · {u.purok || "Unassigned"}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">REASON (REQUIRED)</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Team unavailable / route change / coverage gap…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10" />
      <p className="mt-2 text-[10px] text-stone-400">Reassignment releases the original unit back to Available and logs the event in the incident timeline.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CCTV Evidence Request Modal
// ---------------------------------------------------------------------------

function CctvRequestModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { flash } = useToast();
  const zoneNum = (incident.purok.match(/\d/) ?? ["1"])[0];
  const cameras = [
    { id: `CAM-${String(zoneNum).padStart(3, "0")}`, name: `Camera ${zoneNum} · ${incident.purok}` },
    { id: "CAM-GATE-01", name: "Camera 1 · Main Gate" },
    { id: "CAM-MARKET-03", name: "Camera 3 · Public Market" },
    { id: "CAM-PLAZA-02", name: "Camera 2 · Plaza & Court" },
  ];
  const [selectedCams, setSelectedCams] = useState<string[]>([cameras[0].id]);
  const [purpose, setPurpose] = useState("Evidence for Blotter");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [focus, setFocus] = useState("");
  const [confirm, setConfirm] = useState(false);

  function toggleCam(id: string) {
    setSelectedCams((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function submit() {
    if (selectedCams.length === 0) return;
    const cam = cameras.find((c) => c.id === selectedCams[0]);
    const req = addFootageRequest({
      incidentId: incident.id,
      cameraId: cam?.id,
      cameraName: cam?.name,
      date: incident.time.slice(0, 10),
      startTime: "00:00",
      endTime: "10:00",
      eventTag: incident.category,
      purpose: `${purpose} — ${focus.trim() || "Document the reported event."}`,
      priority: priority === "normal" ? "standard" : "urgent",
      requestedBy: "D.O. Ramos",
      requestedByRole: "Barangay Desk Officer",
    });
    recordActivity({
      action: "video_request_submitted",
      kind: "request",
      incidentId: incident.id,
      refId: req?.id,
      actor: "D.O. Ramos",
      state: "Pending",
      target: "footage_requests",
    });
    pushDispatchAudit("dispatch_created", { incidentId: incident.id, note: `CCTV evidence request ${req?.id}` });
    flash(`Formal CCTV request ${req?.id} submitted — ${selectedCams.length} camera(s) targeted for ${incident.id}.`, {
      title: "CCTV Request Submitted",
      type: "success",
    });
    setConfirm(false);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="CCTV Evidence Request"
      subtitle={`${incident.id} · Pre-filled from incident report timing`}
      icon={<Video size={18} />}
      iconClass="bg-violet-100 text-violet-700"
      size="lg"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => setConfirm(true)} disabled={selectedCams.length === 0} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40">
            <FileCheck2 size={13} /> Submit Formal Request
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TARGET CAMERA(S)</p>
          <div className="space-y-1.5">
            {cameras.map((c) => {
              const active = selectedCams.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCam(c.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition ${active ? "border-violet-400 bg-violet-50 text-violet-700" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
                  {active ? <CheckCircle2 size={12} className="text-violet-600" /> : <span className="h-3 w-3 rounded-full border border-stone-300" />}
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TIME WINDOW</p>
            <div className="grid grid-cols-2 gap-1.5">
              <input type="time" defaultValue="00:00" className="rounded-lg border border-stone-200 px-2 py-1.5 text-[11px] text-stone-700 outline-none focus:border-violet-400" />
              <input type="time" defaultValue="10:00" className="rounded-lg border border-stone-200 px-2 py-1.5 text-[11px] text-stone-700 outline-none focus:border-violet-400" />
            </div>
            <p className="mt-1 text-[9px] text-stone-400">Pre-set to ±15 min of report time</p>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">PURPOSE</p>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-[11px] text-stone-700 outline-none focus:border-violet-400">
              <option>Evidence for Blotter</option>
              <option>Referral to Agency</option>
              <option>Internal Review</option>
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">PRIORITY</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["normal", "high", "urgent"] as const).map((p) => (
                <button key={p} onClick={() => setPriority(p)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold capitalize transition ${priority === p ? "border-violet-400 bg-violet-50 text-violet-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">FOCUS / CAPTURE NOTES</p>
        <textarea value={focus} onChange={(e) => setFocus(e.target.value)} rows={2} placeholder="e.g. Locate suspect in red shirt fleeing east" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10" />
      </div>

      {confirm && (
        <ConfirmModal
          type="confirm"
          tone="primary"
          title="Submit formal CCTV request?"
          message={`${selectedCams.length} camera(s) targeted for ${incident.id}. This pushes to the CCTV Operator's queue and adds a tracking indicator to the incident.`}
          confirmLabel="Submit Request"
          cancelLabel="Back"
          onConfirm={submit}
          onClose={() => setConfirm(false)}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// External Agency Referral Modal
// ---------------------------------------------------------------------------

const AGENCIES = [
  { id: "pnp", label: "PNP — Philippine National Police" },
  { id: "bfp", label: "BFP — Bureau of Fire Protection" },
  { id: "lgu", label: "LGU Social Welfare" },
  { id: "health", label: "Municipal Health Office" },
];

function ReferralModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const { flash } = useToast();
  const [agency, setAgency] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [evidence, setEvidence] = useState({ report: true, cctv: false, photos: false, timeline: false });
  const [confirm, setConfirm] = useState(false);

  function toggleEvidence(key: keyof typeof evidence) {
    setEvidence((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function submit() {
    if (!agency) return;
    const incs = getIncidents().map((i) =>
      i.id === incident.id
        ? {
            ...i,
            status: "closed_false_alarm" as const,
            closedReason: "Outside Barangay Jurisdiction",
            notes: [...(i.notes ?? []), `Referred to ${agency} — ${remarks.trim()}`],
          }
        : i
    );
    setIncidents(incs);
    // remove dispatch
    const dis = getDispatches().filter((d) => d.incident !== incident.id);
    setDispatches(dis);
    // release units
    getTanods().forEach((t) => {
      if (t.incidentId === incident.id) setTanodStatus(t.id, "available", { incidentId: undefined, assignment: undefined });
    });
    recordActivity({
      action: "incident_referred",
      kind: "incident",
      incidentId: incident.id,
      actor: "D.O. Ramos",
      state: "Referred",
      target: "dispatches",
    });
    pushDispatchAudit("incident_resolution_action", { incidentId: incident.id, note: `Referred to ${agency} — ${remarks.trim()}` });
    flash(`${incident.id} referred to ${agency}. Case removed from dispatch queues and Punong Barangay notified.`, {
      title: "Case Referred",
      type: "success",
    });
    setConfirm(false);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="External Agency Referral"
      subtitle={`${incident.id} · ${incident.purok} · exceeds barangay jurisdiction`}
      icon={<ArrowUpRight size={18} />}
      iconClass="bg-rose-100 text-rose-700"
      size="lg"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => setConfirm(true)} disabled={!agency || !remarks.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40">
            <ArrowUpRight size={13} /> Confirm Referral &amp; Transfer
          </button>
        </div>
      }
    >
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TARGET AGENCY</p>
      <div className="mb-3 space-y-1.5">
        {AGENCIES.map((a) => (
          <button key={a.id} onClick={() => setAgency(a.label)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[11px] font-medium transition ${agency === a.label ? "border-rose-400 bg-rose-50 text-rose-700" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
            <Landmark size={13} /> {a.label}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">ENDORSEMENT REMARKS</p>
      <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Explain the reason for transfer…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10" />
      <p className="mb-1.5 mt-3 text-[10px] font-semibold tracking-wider text-stone-400">EVIDENCE PACKAGE TO BUNDLE</p>
      <div className="grid grid-cols-2 gap-1.5">
        {([["report", "Resident Reports"], ["cctv", "CCTV Video Clips"], ["photos", "Submitted Photos"], ["timeline", "Timeline Logs"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => toggleEvidence(key)} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition ${evidence[key] ? "border-rose-400 bg-rose-50 text-rose-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
            {evidence[key] ? <CheckCircle2 size={12} className="text-rose-600" /> : <span className="h-3 w-3 rounded border border-stone-300" />}
            {label}
          </button>
        ))}
      </div>

      {confirm && (
        <ConfirmModal
          type="confirm"
          tone="danger"
          title="Confirm referral & transfer case?"
          message={`${incident.id} will be removed from active dispatch queues and referred to ${agency}. Punong Barangay is notified for review.`}
          confirmLabel="Confirm Referral"
          cancelLabel="Back"
          onConfirm={submit}
          onClose={() => setConfirm(false)}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Direct Message Modal
// ---------------------------------------------------------------------------

function DirectMessageModal({ unit, onClose }: { unit: Tanod; onClose: () => void }) {
  const { flash } = useToast();
  const [msg, setMsg] = useState("");

  function send() {
    if (!msg.trim()) return;
    flash(`Message sent to ${unit.name}.`, { title: "Message Sent", type: "success" });
    setMsg("");
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title={`Direct Message — ${unit.name}`}
      subtitle="One-to-one operations message to a field unit"
      icon={<MessageSquare size={18} />}
      iconClass="bg-[#15803D]/10 text-[#15803D]"
      size="sm"
      footer={
        <button onClick={send} disabled={!msg.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534] disabled:opacity-40">
          <Send size={13} /> Send Message
        </button>
      }
    >
      <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
        {unit.name} · {TANOD_STATUS_META[unit.status].label} · {unit.purok || "—"} · {unit.assignment || "No active task"}
      </div>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Type your direct message…" className="mt-3 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#15803D]/50 focus:ring-2 focus:ring-[#15803D]/10" />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Case Resolution / Closure Modal
// ---------------------------------------------------------------------------

function ResolveModal({ dispatch, onClose }: { dispatch: DispatchItem; onClose: () => void }) {
  const { flash } = useToast();
  const incident = getIncidents().find((i) => i.id === dispatch.incident);
  const [resType, setResType] = useState<(typeof RESOLUTION_TYPES)[number]>("Resolved on Scene");
  const [summary, setSummary] = useState("");
  const [blotterId, setBlotterId] = useState("Auto-generate");
  const [confirm, setConfirm] = useState(false);

  function submit() {
    if (!summary.trim()) return;
    const bid = blotterId === "Auto-generate" ? `B-2026-${String(1000 + Math.floor(Math.random() * 900)).replace("1", "")}` : blotterId;
    // update incident to resolved
    const incs = getIncidents().map((i) =>
      i.id === dispatch.incident
        ? { ...i, status: "resolved" as const, resolvedAt: new Date().toISOString(), closedReason: resType === "False Alarm" ? "False Alarm" : "Normal Resolution", notes: [...(i.notes ?? []), summary.trim()] }
        : i
    );
    setIncidents(incs);
    // update dispatch resolved
    const dis = getDispatches().map((d) => (d.id === dispatch.id ? { ...d, status: "resolved" as const, onSceneAt: new Date().toISOString() } : d));
    setDispatches(dis);
    // release units
    getTanods().forEach((t) => {
      if (t.incidentId === dispatch.incident) setTanodStatus(t.id, "available", { incidentId: undefined, assignment: undefined });
    });
    recordActivity({
      action: "incident_closed",
      kind: "closure",
      incidentId: dispatch.incident,
      refId: bid,
      actor: "D.O. Ramos",
      state: "Closed",
      target: "blotter",
    });
    pushDispatchAudit("marked_resolved", { dispatchId: dispatch.id, incidentId: dispatch.incident, note: `${resType} — ${summary.trim()}` });
    flash(`${dispatch.incident} closed as ${resType}. Units released to Available; feedback sent to reporter.`, {
      title: "Case Closed",
      type: "success",
    });
    setConfirm(false);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Case Resolution Summary"
      subtitle={`${dispatch.id} · ${dispatch.incident} · ${dispatch.team}`}
      icon={<CheckCircle2 size={18} />}
      iconClass="bg-emerald-100 text-emerald-700"
      size="md"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
          <button onClick={() => setConfirm(true)} disabled={!summary.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40">
            <CheckCircle2 size={13} /> Close Case
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-[11px] text-stone-600">
        {incident?.description} — <span className="font-semibold">{incident?.purok ?? dispatch.purok}</span>
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">RESOLUTION TYPE</p>
      <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {RESOLUTION_TYPES.map((r) => (
          <button key={r} onClick={() => setResType(r)} className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition ${resType === r ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>{r}</button>
        ))}
      </div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">FINAL SUMMARY NOTES</p>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Summarize the resolution…" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10" />
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">LINKED BLOTTER ID</p>
        <input value={blotterId} onChange={(e) => setBlotterId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 font-mono text-[12px] text-stone-700 outline-none transition focus:border-emerald-400" />
      </div>
      <p className="mt-2 text-[10px] text-stone-400">
        Closing resets all assigned units to Available and aggregates telemetry into hotspot analytics.
      </p>

      {confirm && (
        <ConfirmModal
          type="confirm"
          tone="primary"
          title={`Close ${dispatch.incident} as ${resType}?`}
          message={`This resolves the case, resets ${dispatch.team} to Available, and sends feedback to the reporter.`}
          confirmLabel="Confirm Close"
          cancelLabel="Back"
          onConfirm={submit}
          onClose={() => setConfirm(false)}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-100 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
        {icon} {label}
      </p>
      <div className="mt-1 text-[12px] font-medium text-stone-800">{value}</div>
    </div>
  );
}
