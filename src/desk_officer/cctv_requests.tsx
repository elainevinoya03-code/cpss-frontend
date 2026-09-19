import { useState, useEffect, useMemo } from "react";
import {
  Video,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Film,
  Camera,
  Calendar,
  Layers,
  Shield,
  RefreshCw,
  Lock,
  Play,
  FileCheck,
  Flame,
  Check,
  Info,
  MapPin,
  AlertTriangle,
  FileText,
  Activity,
} from "lucide-react";
import {
  getFootageRequests,
  subscribeFootageRequests,
  addFootageRequest,
  cancelFootageRequest,
  REQUEST_STATUS_META,
  type FootageRequest,
  type FootageRequestStatus,
  type RequestClip,
  type RequestStill,
} from "../utils/footageRequestStore";
import { getIncidents, type Incident } from "./incidentStore";
import { recordActivity } from "../utils/recentActivityStore";
import { Modal } from "../components/ui";
import { formatTime } from "../utils/format";
import { useToast } from "../hooks/useToast";

const AVAILABLE_CAMERAS = [
  { id: "CAM-MARKET-03", name: "Camera 3 · Public Market", purok: "Purok 6" },
  { id: "CAM-PLAZA-01", name: "Camera 1 · Barangay Plaza Main", purok: "Purok 1" },
  { id: "CAM-CROSSING-07", name: "Camera 7 · Main Highway Crossing", purok: "Purok 3" },
  { id: "CAM-TERMINAL-02", name: "Camera 2 · Tricycle Terminal", purok: "Purok 2" },
  { id: "CAM-HEALTH-04", name: "Camera 4 · Health Center Perimeter", purok: "Purok 4" },
  { id: "CAM-ELEM-05", name: "Camera 5 · Elementary School Gate", purok: "Purok 5" },
  { id: "CAM-RIVER-08", name: "Camera 8 · Riverside Pathway", purok: "Purok 7" },
];

export default function CctvRequests() {
  const { flash, ToastPortal } = useToast();

  // Store data
  const [requests, setRequests] = useState<FootageRequest[]>(() => getFootageRequests());
  const [incidents, setIncidents] = useState<Incident[]>(() => getIncidents());

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FootageRequestStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "standard" | "urgent">("ALL");

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FootageRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FootageRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [activeClipModal, setActiveClipModal] = useState<RequestClip | null>(null);
  const [activeStillModal, setActiveStillModal] = useState<RequestStill | null>(null);
  const [attachBlotterSuccess, setAttachBlotterSuccess] = useState<string | null>(null);

  // New Request Form State
  const [formIncidentId, setFormIncidentId] = useState("");
  const [formCameraId, setFormCameraId] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formStartTime, setFormStartTime] = useState("20:00:00");
  const [formEndTime, setFormEndTime] = useState("20:15:00");
  const [formEventTag, setFormEventTag] = useState("Incident Verification");
  const [formPriority, setFormPriority] = useState<"standard" | "urgent">("standard");
  const [formPurpose, setFormPurpose] = useState("");
  const [formNote, setFormNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to changes
  useEffect(() => {
    const unsub = subscribeFootageRequests(() => {
      setRequests([...getFootageRequests()]);
    });
    return () => unsub();
  }, []);

  // Update incidents list periodically
  useEffect(() => {
    setIncidents(getIncidents());
  }, []);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && req.priority !== priorityFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        req.id.toLowerCase().includes(q) ||
        (req.incidentId && req.incidentId.toLowerCase().includes(q)) ||
        (req.cameraName && req.cameraName.toLowerCase().includes(q)) ||
        (req.cameraId && req.cameraId.toLowerCase().includes(q)) ||
        (req.eventTag && req.eventTag.toLowerCase().includes(q)) ||
        req.purpose.toLowerCase().includes(q) ||
        req.requestedBy.toLowerCase().includes(q)
      );
    });
  }, [requests, statusFilter, priorityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "pending" || r.status === "in_progress").length;
    const completed = requests.filter((r) => r.status === "completed").length;
    const urgent = requests.filter(
      (r) => r.priority === "urgent" && (r.status === "pending" || r.status === "in_progress")
    ).length;
    return { total, pending, completed, urgent };
  }, [requests]);

  // Handle Form Incident Select auto-fills
  const handleSelectIncident = (incId: string) => {
    setFormIncidentId(incId);
    if (!incId) return;
    const inc = incidents.find((i) => i.id === incId);
    if (inc) {
      if (inc.category) setFormEventTag(inc.category);
      if (inc.priority === "High" || inc.severity === "Critical" || inc.severity === "High") {
        setFormPriority("urgent");
      }
      setFormPurpose(
        `Footage requisition to support Blotter report for ${inc.id} (${inc.category} in ${inc.purok}): ${inc.description.slice(
          0,
          100
        )}...`
      );
    }
  };

  // Submit New Request
  const handleSubmitNewRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPurpose.trim()) {
      flash("Please provide a valid justification or purpose for this request.", { title: "Missing Justification" });
      return;
    }

    setIsSubmitting(true);
    const selectedCam = AVAILABLE_CAMERAS.find((c) => c.id === formCameraId);

    const newReq = addFootageRequest({
      incidentId: formIncidentId ? formIncidentId : undefined,
      cameraId: formCameraId || (selectedCam ? selectedCam.id : undefined),
      cameraName: selectedCam ? selectedCam.name : formCameraId ? `Camera ${formCameraId}` : undefined,
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      eventTag: formEventTag,
      purpose: formPurpose.trim(),
      priority: formPriority,
      requestedBy: "Desk Officer on Duty",
      requestedByRole: "Barangay Desk Officer",
      note: formNote.trim() || undefined,
    });

    recordActivity({
      action: "video_request_submitted",
      kind: "request",
      title: `Footage request ${newReq.id} submitted`,
      incidentId: newReq.incidentId,
      refId: newReq.id,
      actor: "Desk Officer",
      state: "pending",
      target: "cctv_requests",
      severity: formPriority === "urgent" ? "high" : "normal",
    });

    flash(`Requisition ${newReq.id} submitted to CCTV Operations queue.`, { title: "Requisition Filed" });
    setIsSubmitting(false);
    setIsNewModalOpen(false);

    // Reset Form
    setFormIncidentId("");
    setFormCameraId("");
    setFormPurpose("");
    setFormNote("");
    setFormPriority("standard");
  };

  // Handle Cancel
  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    cancelFootageRequest(
      cancelTarget.id,
      "Desk Officer",
      cancelReason.trim() || "Cancelled by Desk Officer"
    );

    recordActivity({
      action: "cctv_update",
      kind: "request",
      title: `Footage request ${cancelTarget.id} cancelled`,
      incidentId: cancelTarget.incidentId,
      refId: cancelTarget.id,
      actor: "Desk Officer",
      state: "cancelled",
      target: "cctv_requests",
    });

    flash(`Footage Request ${cancelTarget.id} was cancelled.`, { title: "Requisition Cancelled" });
    setCancelTarget(null);
    setCancelReason("");
    if (selectedRequest?.id === cancelTarget.id) {
      setSelectedRequest(null);
    }
  };

  // Attach to Blotter simulation
  const handleAttachToBlotter = (req: FootageRequest) => {
    setAttachBlotterSuccess(req.id);
    recordActivity({
      action: "cctv_update",
      kind: "cctv",
      title: `Evidence ${req.id} attached to Blotter`,
      incidentId: req.incidentId,
      refId: req.id,
      actor: "Desk Officer",
      state: "attached_to_blotter",
      target: "digital_blotter",
    });
    flash(`Evidence from ${req.id} bound to Barangay Blotter case folder.`, { title: "Evidence Linked" });
    setTimeout(() => {
      setAttachBlotterSuccess(null);
    }, 3000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      {ToastPortal && <ToastPortal />}

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Page Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">CCTV Footage Requests</h1>
              <p className="mt-1 text-sm text-stone-500">
                Formal surveillance footage requisition, digital evidence chain-of-custody, and blotter case binding
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setRequests([...getFootageRequests()]);
                  flash("Requisition registry refreshed.", { title: "Refreshed" });
                }}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 transition"
              >
                <RefreshCw size={13} /> Refresh
              </button>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
              >
                <Plus size={13} /> New Requisition
              </button>
            </div>
          </div>
        </header>

        {/* Metric / Summary Cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Requisitions", value: stats.total, icon: Video, color: "text-[#15803D]", bg: "bg-[#15803D]/10" },
            { label: "Pending Processing", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Fulfilled / Ready", value: stats.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Urgent Priority", value: stats.urgent, icon: Flame, color: "text-rose-600", bg: "bg-rose-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase">{label}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg} ${color}`}>
                  <Icon size={13} />
                </div>
              </div>
              <div className="mt-1.5 text-[22px] font-bold text-stone-900">{value}</div>
            </div>
          ))}
        </div>

        {/* Main Content: Registry Card */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm">
          {/* Card Header with Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold text-[#334155]">Requisition Registry</h2>
              <p className="text-[11px] text-[#94A3B8]">
                {filteredRequests.length} requisition{filteredRequests.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Bar */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, camera, case..."
                  className="w-44 sm:w-56 rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-[11px] text-stone-700 placeholder-stone-400 focus:border-[#15803D] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1.5 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1">
                {(["ALL", "pending", "in_progress", "completed", "cancelled"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      statusFilter === st ? "bg-white text-[#15803D] shadow-sm" : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {st === "ALL"
                      ? "All"
                      : st === "in_progress"
                      ? "In Progress"
                      : st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              {/* Priority Filter Tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1">
                {(["ALL", "urgent", "standard"] as const).map((pr) => (
                  <button
                    key={pr}
                    onClick={() => setPriorityFilter(pr)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition capitalize ${
                      priorityFilter === pr ? "bg-white text-[#15803D] shadow-sm" : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {pr === "ALL" ? "All Prios" : pr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Requisition List */}
          <div className="divide-y divide-stone-100">
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <Video size={28} className="text-stone-300 mb-2" />
                <p className="text-sm font-semibold text-stone-600">No CCTV requisitions found</p>
                <p className="mt-1 text-xs text-stone-400 max-w-sm">
                  {searchQuery || statusFilter !== "ALL" || priorityFilter !== "ALL"
                    ? "Try adjusting your filters or search keywords."
                    : "No surveillance requests recorded yet. Click 'New Requisition' to submit a footage request to CCTV operators."}
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const meta = REQUEST_STATUS_META[req.status] || {
                  label: req.status,
                  badge: "bg-stone-100 text-stone-600",
                };
                const hasClips = Boolean(req.clips && req.clips.length > 0);
                const hasStills = Boolean(req.stills && req.stills.length > 0);

                return (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 transition hover:bg-[#DCFCE7]/30"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Requisition Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-stone-900">{req.id}</span>
                          {req.incidentId && (
                            <span className="rounded-md bg-[#15803D]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#15803D]">
                              Incident: {req.incidentId}
                            </span>
                          )}
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>
                            {meta.label}
                          </span>
                          {req.priority === "urgent" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                              <Flame size={10} className="fill-rose-500 text-rose-500" />
                              Urgent Priority
                            </span>
                          ) : (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                              Standard
                            </span>
                          )}
                          <span className="text-[11px] text-stone-400">
                            · Filed {req.requestedAt ? formatTime(req.requestedAt) : "Recent"} by {req.requestedBy}
                          </span>
                        </div>

                        {/* Camera & Time Window Specification */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                          <span className="inline-flex items-center gap-1 font-medium text-stone-800">
                            <Camera size={13} className="text-[#15803D]" />
                            {req.cameraName || req.cameraId || "Unspecified Camera"}
                          </span>
                          {req.date && (
                            <span className="inline-flex items-center gap-1 text-stone-500">
                              <Calendar size={12} className="text-stone-400" />
                              {req.date}
                            </span>
                          )}
                          {(req.startTime || req.endTime) && (
                            <span className="inline-flex items-center gap-1 text-stone-500">
                              <Clock size={12} className="text-stone-400" />
                              Window: {req.startTime || "?"} – {req.endTime || "?"}
                            </span>
                          )}
                          {req.eventTag && (
                            <span className="inline-flex items-center gap-1 text-stone-500">
                              <Layers size={12} className="text-stone-400" />
                              Tag: <span className="font-medium text-stone-700">{req.eventTag}</span>
                            </span>
                          )}
                        </div>

                        {/* Purpose / Justification */}
                        <p className="mt-2 text-xs text-stone-700 line-clamp-2 leading-relaxed">
                          <strong className="text-stone-900 font-medium">Justification: </strong>
                          {req.purpose}
                        </p>

                        {/* Operator Feedback Note */}
                        {req.operatorStatus && (
                          <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-green-100 bg-[#15803D]/5 px-3 py-1.5 text-[11px] text-[#15803D]">
                            <Info size={13} className="shrink-0 mt-0.5" />
                            <span>
                              <strong>Surveillance Team Note: </strong>
                              {req.operatorStatus}
                            </span>
                          </div>
                        )}

                        {/* Completed Extracted Assets Preview */}
                        {req.status === "completed" && (hasClips || hasStills) && (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5">
                            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                Evidence Ready ({req.clips?.length ?? 0} Clips, {req.stills?.length ?? 0} Stills)
                              </span>
                              <span className="text-[10px] text-emerald-700 font-normal">H.264 MP4 · Secure Evidence</span>
                            </div>

                            {req.clips && req.clips.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {req.clips.map((clip) => (
                                  <button
                                    key={clip.id}
                                    onClick={() => setActiveClipModal(clip)}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-800 shadow-xs hover:bg-emerald-50 transition"
                                  >
                                    <Play size={11} className="fill-emerald-600 text-emerald-600" />
                                    <span>{clip.durationSec}s Clip ({clip.sizeMB} MB)</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-stone-100">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 transition"
                        >
                          <Eye size={12} className="text-stone-500" />
                          Audit & Custody
                        </button>

                        {req.status === "completed" && (
                          <button
                            onClick={() => handleAttachToBlotter(req)}
                            disabled={attachBlotterSuccess === req.id}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-80"
                          >
                            {attachBlotterSuccess === req.id ? (
                              <>
                                <Check size={12} /> Bound to Blotter
                              </>
                            ) : (
                              <>
                                <FileCheck size={12} /> Bind to Blotter
                              </>
                            )}
                          </button>
                        )}

                        {(req.status === "pending" || req.status === "in_progress") && (
                          <button
                            onClick={() => {
                              setCancelTarget(req);
                              setCancelReason("");
                            }}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition"
                          >
                            <XCircle size={12} />
                            Cancel Request
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* 1. NEW FOOTAGE REQUISITION MODAL */}
      {/* ========================================================= */}
      {isNewModalOpen && (
        <Modal
          onClose={() => setIsNewModalOpen(false)}
          title="Create Formal CCTV Footage Requisition"
          subtitle="File a legally tracked video evidence request to the Surveillance Room for blotter cases."
          size="lg"
        >
          <form onSubmit={handleSubmitNewRequest} className="space-y-4">
            {/* Associated Incident Selection */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Link to Incident / Blotter Report (Optional)
              </label>
              <select
                value={formIncidentId}
                onChange={(e) => handleSelectIncident(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
              >
                <option value="">-- Standalone Requisition (No Incident Linked) --</option>
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id} · {inc.category || "Incident"} · {inc.purok} ({inc.time || "Recent"})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-stone-400 mt-1">
                Selecting an active incident associates this footage directly with its digital case file.
              </p>
            </div>

            {/* Target Camera & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Target Camera / Sector <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formCameraId}
                  onChange={(e) => setFormCameraId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                >
                  <option value="">Select CCTV Camera...</option>
                  {AVAILABLE_CAMERAS.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.name} ({cam.purok})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Priority Rating <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as "standard" | "urgent")}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                >
                  <option value="standard">Standard Priority (Regular Blotter Case)</option>
                  <option value="urgent">Urgent Priority (Critical / Escalated Case)</option>
                </select>
              </div>
            </div>

            {/* Date & Time Window */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Incident Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Start Window (HH:MM:SS) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  placeholder="20:00:00"
                  required
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  End Window (HH:MM:SS) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  placeholder="20:15:00"
                  required
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                />
              </div>
            </div>

            {/* Event Classification Tag */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Event Classification / Tag
              </label>
              <input
                type="text"
                value={formEventTag}
                onChange={(e) => setFormEventTag(e.target.value)}
                placeholder="e.g. Public Disturbance, Vehicular Incident, Theft"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
              />
            </div>

            {/* Justification / Legal Purpose */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Formal Justification / Legal Purpose <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={formPurpose}
                onChange={(e) => setFormPurpose(e.target.value)}
                rows={3}
                required
                placeholder="State the official justification for reviewing and exporting this surveillance recording..."
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
              />
            </div>

            {/* Instructions for Operator */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Operator Instructions (Optional)
              </label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="e.g. Target suspect wearing dark shirt moving towards market entrance."
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
              />
            </div>

            {/* Legal Notice Box */}
            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Lock size={14} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Data Privacy & RA 10173 Compliance:</strong> All video extraction requests are logged in the immutable system audit trail and subject to Barangay Captain oversight.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#166534] transition disabled:opacity-50"
              >
                <Plus size={13} />
                {isSubmitting ? "Submitting..." : "Submit Requisition"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 2. AUDIT & CUSTODY DETAILS MODAL */}
      {/* ========================================================= */}
      {selectedRequest && (
        <Modal
          onClose={() => setSelectedRequest(null)}
          title={`Requisition Details · ${selectedRequest.id}`}
          subtitle="Complete audit trail, chain of custody logs, and attached digital evidence."
          size="lg"
        >
          <div className="space-y-4">
            {/* Header info box */}
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-stone-900">{selectedRequest.id}</span>
                  {selectedRequest.incidentId && (
                    <span className="rounded-md bg-[#15803D]/10 px-2 py-0.5 font-mono text-xs font-semibold text-[#15803D]">
                      Incident: {selectedRequest.incidentId}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      REQUEST_STATUS_META[selectedRequest.status]?.badge || "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {REQUEST_STATUS_META[selectedRequest.status]?.label || selectedRequest.status}
                  </span>
                </div>

                <span className="text-xs text-stone-500 font-medium">
                  Filed {selectedRequest.requestedAt ? new Date(selectedRequest.requestedAt).toLocaleString() : "Recent"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Camera Source</span>
                  <span className="text-stone-800 font-medium">{selectedRequest.cameraName || selectedRequest.cameraId || "—"}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Time Window</span>
                  <span className="text-stone-800 font-medium">
                    {selectedRequest.startTime || "?"} – {selectedRequest.endTime || "?"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Requester</span>
                  <span className="text-stone-800 font-medium">{selectedRequest.requestedBy}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Classification</span>
                  <span className="text-stone-800 font-medium">{selectedRequest.eventTag || "Standard"}</span>
                </div>
              </div>
            </div>

            {/* Purpose & Legal Justification */}
            <div className="rounded-lg border border-stone-200 p-3 bg-white">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">Purpose & Legal Justification</h4>
              <p className="mt-1 text-xs text-stone-700 leading-relaxed">{selectedRequest.purpose}</p>
            </div>

            {/* Attached Video Clips */}
            {selectedRequest.clips && selectedRequest.clips.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                  <Film size={14} className="text-emerald-600" />
                  Attached Video Clips ({selectedRequest.clips.length})
                </h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedRequest.clips.map((clip) => (
                    <div key={clip.id} className="rounded-lg bg-white p-3 border border-emerald-200 shadow-xs">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-900">
                        <span>{clip.id}</span>
                        <span className="text-[10px] text-emerald-700 font-medium">{clip.durationSec}s · {clip.sizeMB} MB</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1">Window: {clip.start} – {clip.end}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          onClick={() => setActiveClipModal(clip)}
                          className="inline-flex items-center gap-1 rounded bg-[#15803D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#166534] transition"
                        >
                          <Play size={11} className="fill-white" />
                          Play Clip
                        </button>
                        <a
                          href={clip.storageUrl}
                          download={`evidence-${clip.id}.mp4`}
                          className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 transition"
                        >
                          <Download size={11} className="text-stone-500" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Stills */}
            {selectedRequest.stills && selectedRequest.stills.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Camera size={14} className="text-[#15803D]" />
                  Extracted Stills ({selectedRequest.stills.length})
                </h4>
                <div className="mt-3 flex flex-wrap gap-3">
                  {selectedRequest.stills.map((still) => (
                    <button
                      key={still.id}
                      onClick={() => setActiveStillModal(still)}
                      className="group relative overflow-hidden rounded-lg border border-stone-200 bg-stone-100 p-1 hover:border-[#15803D] transition text-left"
                    >
                      <div className="h-20 w-32 rounded bg-stone-800 flex items-center justify-center text-stone-400 group-hover:bg-stone-700">
                        <Camera size={20} />
                      </div>
                      <div className="mt-1 text-[10px] font-medium text-stone-700 truncate w-32 px-1">
                        {still.id} · {still.at}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chain of Custody Audit Trail */}
            <div>
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Shield size={14} className="text-[#15803D]" />
                Chain of Custody & Audit Log
              </h4>
              <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2.5 max-h-48 overflow-y-auto">
                {selectedRequest.chainOfCustody && selectedRequest.chainOfCustody.length > 0 ? (
                  selectedRequest.chainOfCustody.map((custody, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs pb-2 border-b border-stone-100 last:border-0 last:pb-0">
                      <div className="h-2 w-2 rounded-full bg-[#15803D] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-900">{custody.action}</span>
                          <span className="text-[10px] text-stone-400">{custody.at ? formatTime(custody.at) : "—"}</span>
                        </div>
                        <p className="text-[11px] text-stone-600 font-medium">Actor: {custody.actor}</p>
                        {custody.note && <p className="text-[11px] text-stone-500 italic mt-0.5">{custody.note}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-400 italic">No chain of custody logs registered yet.</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Close
              </button>
              {selectedRequest.status === "completed" && (
                <button
                  type="button"
                  onClick={() => {
                    handleAttachToBlotter(selectedRequest);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                >
                  <FileCheck size={13} />
                  Attach Evidence to Blotter
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 3. CANCEL REQUEST MODAL */}
      {/* ========================================================= */}
      {cancelTarget && (
        <Modal
          onClose={() => setCancelTarget(null)}
          title={`Cancel Requisition · ${cancelTarget.id}`}
          subtitle="Provide an administrative justification for withdrawing this footage request."
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 p-3 border border-rose-200 text-xs text-rose-900">
              Are you sure you want to cancel request <strong>{cancelTarget.id}</strong>? The CCTV Operator will be notified to abort the extraction process.
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Cancellation Reason / Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="e.g. Settled amicably during mediation, footage no longer required..."
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition"
              >
                <XCircle size={13} />
                Confirm Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 4. VIDEO CLIP PLAYER MODAL */}
      {/* ========================================================= */}
      {activeClipModal && (
        <Modal
          onClose={() => setActiveClipModal(null)}
          title={`Evidence Playback · ${activeClipModal.id}`}
          subtitle={`${activeClipModal.cameraName} · Duration: ${activeClipModal.durationSec}s`}
          size="lg"
        >
          <div className="space-y-3">
            <div className="relative aspect-video w-full rounded-xl bg-black flex flex-col items-center justify-center text-white overflow-hidden shadow-inner">
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-[11px] font-mono backdrop-blur-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                SECURE EVIDENCE REPLAY
              </div>
              <Film size={40} className="text-stone-600 mb-2" />
              <p className="text-xs font-mono text-stone-400">
                Simulated Video: {activeClipModal.start} – {activeClipModal.end}
              </p>
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between rounded bg-black/70 px-3 py-2 text-xs backdrop-blur-xs">
                <div className="flex items-center gap-2">
                  <Play size={14} className="fill-white cursor-pointer hover:opacity-80" />
                  <span className="font-mono text-[11px] text-stone-300">00:00 / 00:{activeClipModal.durationSec}</span>
                </div>
                <span className="text-[10px] text-stone-400">{activeClipModal.fileType} · {activeClipModal.sizeMB} MB</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 pt-2">
              <span>Watermark & Hash: <strong className="font-mono text-stone-700">SHA256-{activeClipModal.id.replace(/\W/g, "")}</strong></span>
              <a
                href={activeClipModal.storageUrl}
                download={`evidence-${activeClipModal.id}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166534] transition"
              >
                <Download size={13} />
                Download Clip
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 5. STILL IMAGE PREVIEW MODAL */}
      {/* ========================================================= */}
      {activeStillModal && (
        <Modal
          onClose={() => setActiveStillModal(null)}
          title={`High-Resolution Still · ${activeStillModal.id}`}
          subtitle={`${activeStillModal.cameraName} · Captured At: ${activeStillModal.at}`}
          size="md"
        >
          <div className="space-y-3">
            <div className="aspect-video w-full rounded-xl bg-stone-900 flex items-center justify-center text-stone-400">
              <Camera size={36} />
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={() => setActiveStillModal(null)}
                className="rounded-lg bg-stone-100 px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
