// Desk Officer Alert Management Control Center.
// Operational interface to receive, review, acknowledge, escalate, broadcast
// and track alerts. Covers two surfaces:
//   • Incoming System Alerts — IoT smoke / noise threshold breaches and
//     high-urgency resident flags (Alert Detail Drawer with telemetry + CCTV).
//   • Outgoing Broadcast Alerts — security broadcasts pushed to residents,
//     Tanods and Neighborhood Watch (create modal + all-clear dialog).

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Camera,
  Clock,
  Flame,
  Link2,
  MapPin,
  Megaphone,
  PlusCircle,
  Radio,
  Shield,
  Siren,
  Volume2,
  Zap,
  FileSearch,
  X,
  Send,
  Users,
  Eye,
  Flag,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { Modal, ConfirmModal } from "../components/ui";
import { PUROK_ZONES } from "../constants/purok";
import {
  getIncidents,
  addIncident,
  type Incident,
  type IncidentSource,
} from "./incidentStore";
import {
  addSafetyNotice,
  getSafetyNotices,
  type NoticeAudience,
  type NoticeSeverity,
  type SafetyNotice,
  type NoticeTarget,
  type NoticeCategory,
} from "../utils/safetyNoticeStore";
import {
  getBroadcastHistory,
  addBroadcastRecord,
  subscribeBroadcastHistory,
  type BroadcastRecord,
} from "../utils/broadcastStore";
import { recordActivity } from "../utils/recentActivityStore";

// ---------------------------------------------------------------------------
// Local data model — incoming system alerts
// ---------------------------------------------------------------------------

type AlertStatus =
  | "unacknowledged"
  | "acknowledged"
  | "linked"
  | "dismissed"
  | "converted";

type AlertSeverity = "Emergency" | "High" | "Medium" | "Low";

type AlertSourceType = "IoT Smoke Sensor" | "IoT Noise Sensor" | "Manual System Flag";

interface SystemAlert {
  id: string;
  sourceType: AlertSourceType;
  sensorName: string;
  purok: string;
  severity: AlertSeverity;
  status: AlertStatus;
  timestamp: string;
  reading: number;
  threshold: number;
  readings: number[];
  cameras: string[];
  deviceId: string;
  linkedIncidentId?: string;
  dismissedReason?: string;
  acknowledgedAt?: string;
  dismissedAt?: string;
}

const ALERT_STATUS_META: Record<AlertStatus, { label: string; chip: string; dot: string }> = {
  unacknowledged: { label: "Unacknowledged", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  linked: { label: "Linked to Incident", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  dismissed: { label: "Dismissed / False Alarm", chip: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  converted: { label: "Converted to Incident", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

const ALERT_SEVERITY_META: Record<AlertSeverity, { chip: string; dot: string }> = {
  Emergency: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  High: { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  Medium: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  Low: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
};

const SOURCE_TYPE_ICON: Record<AlertSourceType, typeof Flame> = {
  "IoT Smoke Sensor": Flame,
  "IoT Noise Sensor": Volume2,
  "Manual System Flag": Flag,
};

const SOURCE_TYPE_CHIP: Record<AlertSourceType, string> = {
  "IoT Smoke Sensor": "bg-amber-100 text-amber-700",
  "IoT Noise Sensor": "bg-violet-100 text-violet-700",
  "Manual System Flag": "bg-sky-100 text-sky-700",
};

const PUROK_COORDS: Record<string, { lat: number; lng: number }> = {
  "Purok 1": { lat: 14.712, lng: 121.015 },
  "Purok 2": { lat: 14.714, lng: 121.017 },
  "Purok 3": { lat: 14.71, lng: 121.013 },
  "Purok 4": { lat: 14.711, lng: 121.018 },
  "Purok 5": { lat: 14.707, lng: 121.012 },
  "Purok 6": { lat: 14.709, lng: 121.02 },
};

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const SEED_ALERTS: SystemAlert[] = [
  {
    id: "ALT-2026-0081",
    sourceType: "IoT Smoke Sensor",
    sensorName: "Smoke Sensor #04",
    purok: "Purok 4",
    severity: "Emergency",
    status: "unacknowledged",
    timestamp: isoAgo(38),
    reading: 85,
    threshold: 60,
    readings: [22, 25, 28, 31, 40, 52, 63, 71, 78, 85],
    cameras: ["Cam 08", "Cam 09"],
    deviceId: "SM-PUROK4-04",
  },
  {
    id: "ALT-2026-0078",
    sourceType: "IoT Noise Sensor",
    sensorName: "Noise Sensor #02",
    purok: "Purok 2",
    severity: "High",
    status: "acknowledged",
    timestamp: isoAgo(112),
    reading: 78,
    threshold: 70,
    readings: [30, 34, 39, 48, 55, 61, 66, 72, 76, 78],
    cameras: ["Cam 04", "Cam 05"],
    deviceId: "NS-PUROK2-02",
    acknowledgedAt: isoAgo(96),
  },
  {
    id: "ALT-2026-0074",
    sourceType: "Manual System Flag",
    sensorName: "Operator Flag — Market Strip",
    purok: "Purok 6",
    severity: "Medium",
    status: "linked",
    timestamp: isoAgo(240),
    reading: 0,
    threshold: 60,
    readings: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    cameras: ["Cam 02", "Cam 03"],
    deviceId: "MAN-OP-06",
    linkedIncidentId: "INC-2070",
  },
  {
    id: "ALT-2026-0069",
    sourceType: "IoT Smoke Sensor",
    sensorName: "Smoke Sensor #01",
    purok: "Purok 1",
    severity: "Low",
    status: "dismissed",
    timestamp: isoAgo(420),
    reading: 44,
    threshold: 60,
    readings: [30, 35, 38, 41, 44, 42, 40, 38, 35, 33],
    cameras: ["Cam 01"],
    deviceId: "SM-PUROK1-01",
    dismissedReason: "Sensor calibrated during chef demo — elevated cooking smoke, no active fire.",
    dismissedAt: isoAgo(400),
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function formatFull(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso;
  }
}

const AUDIENCE_LABEL: Record<string, string> = {
  tanods: "Tanods", neighborhood_watch: "Neighborhood Watch", residents: "Residents", all: "All",
};

function broadcastTargetLabel(n: SafetyNotice): string {
  return n.target.kind === "barangay" ? "Entire Barangay" : n.target.purok;
}

const BROADCAST_TEMPLATES: { label: string; body: string }[] = [
  { label: "Smoke / Fire Advisory", body: "Heavy smoke detected near the area. Keep clear of the location. Responders en route." },
  { label: "Noise Disturbance", body: "Sustained noise disturbance reported in the zone. Authorities responding; please cooperate." },
  { label: "Suspicious Activity", body: "Suspicious activity reported near the zone. Stay vigilant and report anything unusual." },
  { label: "Medical / Welfare", body: "A medical emergency has been reported. Clear access routes for responders." },
];


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AlertManagement() {
  const { flash, ToastPortal } = useToast();
  const { muted, setMuted, beep } = useAlertSound();

  const [alerts, setAlerts] = useState<SystemAlert[]>(SEED_ALERTS);
  const [broadcasts, setBroadcasts] = useState<SafetyNotice[]>(() =>
    getSafetyNotices().filter((n) => n.severity !== undefined || n.audience?.length)
  );
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastRecord[]>(() =>
    getBroadcastHistory()
  );

  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [selected, setSelected] = useState<SystemAlert | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [allClearTarget, setAllClearTarget] = useState<SafetyNotice | null>(null);
  const [dismissTarget, setDismissTarget] = useState<SystemAlert | null>(null);
  const [convertTarget, setConvertTarget] = useState<SystemAlert | null>(null);
  const [linkTarget, setLinkTarget] = useState<SystemAlert | null>(null);

  useEffect(() => subscribeBroadcastHistory(() => setBroadcastHistory([...getBroadcastHistory()])), []);

  const incidents = useMemo(() => getIncidents(), []);

  const counts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let iotBreaches = 0;
    alerts.forEach((a) => {
      if (a.status === "unacknowledged" || a.status === "acknowledged") active++;
      if (a.sourceType !== "Manual System Flag") iotBreaches++;
    });
    broadcasts.forEach((b) => {
      if (b.approvalStatus === "pending" || b.approvalStatus === "rejected") pending++;
      else if (b.state === "published" && !b.isAllClear) active++;
    });
    return { active, pending, iotBreaches, sentToday: broadcastHistory.length + broadcasts.length };
  }, [alerts, broadcasts, broadcastHistory]);

  const filteredAlerts = useMemo(() => {
    let list = alerts;
    if (sourceFilter !== "All") list = list.filter((a) => a.sourceType === sourceFilter);
    if (severityFilter !== "All") list = list.filter((a) => a.severity === severityFilter);
    if (statusFilter !== "All") list = list.filter((a) => a.status === statusFilter);
    return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, sourceFilter, severityFilter, statusFilter]);


  function ackAlert(a: SystemAlert) {
    setAlerts((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? { ...x, status: "acknowledged", acknowledgedAt: new Date().toISOString() }
          : x
      )
    );
    beep("info");
    flash(`${a.id} acknowledged — dashboard audio alarm silenced.`, { title: "Alert Acknowledged" });
    recordActivity({
      action: "alert_sent",
      kind: "alert",
      refId: a.id,
      actor: "D.O. Ramos",
      state: "Acknowledged",
      severity: a.severity === "Emergency" ? "high" : "normal",
      target: "security_alerts",
    });
  }

  function handleDismiss(reason: string) {
    if (!dismissTarget) return;
    const id = dismissTarget.id;
    setAlerts((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "dismissed", dismissedReason: reason, dismissedAt: new Date().toISOString() }
          : x
      )
    );
    recordActivity({
      action: "incident_closed",
      kind: "closure",
      refId: id,
      actor: "D.O. Ramos",
      state: "Dismissed — False Alarm",
      target: "security_alerts",
    });
    flash(`${id} dismissed and cleared from the queue.`, { title: "Alert Dismissed" });
    setDismissTarget(null);
    setSelected((s) => (s && s.id === id ? { ...s, status: "dismissed" } : s));
  }

  function handleConvert(alert: SystemAlert, incident: Incident) {
    const id = alert.id;
    setAlerts((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, status: "converted", linkedIncidentId: incident.id } : x
      )
    );
    recordActivity({
      action: "incident_received",
      kind: "incident",
      incidentId: incident.id,
      refId: id,
      actor: "Desk Officer",
      state: `Converted from ${id} · ${incident.category}`,
      severity: alert.severity === "Emergency" ? "high" : "normal",
      target: "incident_triage",
    });
    flash(`${id} converted to ${incident.id} — CCTV review and map pin routed.`, {
      title: "Incident Created from Alert",
    });
    setConvertTarget(null);
    setSelected((s) => (s && s.id === id ? { ...s, status: "converted", linkedIncidentId: incident.id } : s));
  }

  function handleLink(alert: SystemAlert, incidentId: string) {
    const id = alert.id;
    setAlerts((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "linked", linkedIncidentId: incidentId } : x))
    );
    recordActivity({
      action: "urgency_changed",
      kind: "incident",
      incidentId,
      refId: id,
      actor: "D.O. Ramos",
      state: "Alert linked",
      target: "incident_triage",
    });
    flash(`${id} linked to ${incidentId} — sensor logs merged into the incident timeline.`, {
      title: "Alert Linked to Incident",
    });
    setLinkTarget(null);
    setSelected((s) => (s && s.id === id ? { ...s, status: "linked", linkedIncidentId: incidentId } : s));
  }

  function handleBroadcastSubmit(n: SafetyNotice) {
    setBroadcasts((prev) => [n, ...prev]);
    const audienceLabel = (n.audience ?? []).map((a) => AUDIENCE_LABEL[a] ?? a).join(", ") || "Residents";
    const isHigh = n.severity === "High";
    recordActivity({
      action: isHigh ? "alert_created" : "alert_sent",
      kind: "alert",
      refId: n.id,
      incidentId: n.incidentId,
      actor: "D.O. Ramos",
      state: isHigh ? "Pending Approval" : "Sent",
      severity: isHigh ? "high" : "normal",
      target: "security_alerts",
    });
    setBroadcastOpen(false);
    if (isHigh) {
      flash(`${n.id} routed to the Punong Barangay approval queue — Pending Approval.`, {
        title: "High-Severity Alert Escalated",
      });
    } else {
      flash(`${n.id} broadcast released to ${audienceLabel} across push + SMS.`, {
        title: "Security Alert Broadcast",
      });
      addBroadcastRecord({
        title: n.title,
        severity: n.severity ?? "Info",
        purok: broadcastTargetLabel(n),
        message: n.message,
        sentAt: new Date().toISOString(),
        sentBy: "D.O. Ramos",
        status: "Active",
        smsCount: 96,
        pushCount: 260,
        safeCount: 0,
        helpCount: 0,
        category: n.category,
        deliveryMethod: "push+sms",
      });
    }
  }

  function handleAllClear(notes: string) {
    if (!allClearTarget) return;
    const n = allClearTarget;
    const resolved: SafetyNotice = { ...n, isAllClear: true, state: "published" };
    setBroadcasts((prev) => prev.map((x) => (x.id === n.id ? resolved : x)));
    addBroadcastRecord({
      title: `All-Clear — ${n.title}`,
      severity: "Info",
      purok: broadcastTargetLabel(n),
      message: notes,
      sentAt: new Date().toISOString(),
      sentBy: "D.O. Ramos",
      status: "Resolved",
      smsCount: 0,
      pushCount: 260,
      safeCount: 0,
      helpCount: 0,
      category: n.category,
      deliveryMethod: "push",
    });
    recordActivity({
      action: "all_clear_issued",
      kind: "alert",
      refId: n.id,
      incidentId: n.incidentId,
      actor: "D.O. Ramos",
      state: "All-Clear issued",
      severity: "low",
      target: "security_alerts",
    });
    flash(`All-Clear broadcast to the original audience — ${n.id} marked Resolved / Closed.`, {
      title: "All-Clear Sent",
    });
    setAllClearTarget(null);
  }


  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      {ToastPortal && <ToastPortal />}
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Page Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Alert Management Control Center</h1>
              <p className="mt-1 text-sm text-stone-500">
                Receive, review, acknowledge, escalate, broadcast, and track alerts across IoT sensors, residents, and field units
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMuted(!muted)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <BellRing size={13} />
                <span className="hidden sm:inline">{muted ? "Audio Muted" : "Audio On"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Summary metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Alerts", value: counts.active, icon: AlertTriangle, sub: "Needing attention" },
            { label: "Pending Approval", value: counts.pending, icon: Shield, sub: "Awaiting sign-off" },
            { label: "IoT Breaches", value: counts.iotBreaches, icon: Zap, sub: "Threshold exceeded" },
            { label: "Sent Today", value: counts.sentToday, icon: Send, sub: "Push + SMS" },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <section className="mb-6 flex flex-col gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-[#94A3B8] uppercase">Quick Actions</p>
            <p className="mt-0.5 text-[11px] text-[#94A3B8]">Common operational shortcuts</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <button
              onClick={() => setBroadcastOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-black/5 bg-white px-3 py-2 text-left shadow-sm transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                <PlusCircle size={13} />
              </div>
              <span className="text-[12px] font-semibold text-[#334155]">Create Security Alert</span>
            </button>
            <button
              onClick={() => {
                const unack = alerts.find((a) => a.status === "unacknowledged");
                if (unack) {
                  ackAlert(unack);
                } else {
                  flash("No unacknowledged alerts remain — all audio alarms already silenced.", { title: "Queue Clear" });
                }
              }}
              className="flex items-center gap-2 rounded-lg border border-black/5 bg-white px-3 py-2 text-left shadow-sm transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <BellRing size={13} />
              </div>
              <span className="text-[12px] font-semibold text-[#334155]">Acknowledge Audio Alerts</span>
            </button>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800 sm:max-w-[260px]">
              High-severity broadcasts route to the <span className="font-semibold">Punong Barangay approval queue</span> before release.
            </div>
          </div>
        </section>


        {/* Incoming System Alerts Queue */}
        <section className="mb-6 rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#334155]">
                <Radio size={14} className="text-[#0038A8]" /> Incoming System Alerts Queue
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                IoT threshold breaches and high-urgency flags — {filteredAlerts.length} alert{filteredAlerts.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={["All", "IoT Smoke Sensor", "IoT Noise Sensor", "Manual System Flag"]} label="Source" />
              <FilterSelect value={severityFilter} onChange={setSeverityFilter} options={["All", "Emergency", "High", "Medium", "Low"]} label="Severity" />
              <FilterSelect value={statusFilter} onChange={setStatusFilter} options={["All", "unacknowledged", "acknowledged", "linked", "dismissed", "converted"]} label="Status" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-stone-100 text-[9px] uppercase tracking-wider text-stone-400">
                  <th className="px-5 py-2.5 font-semibold">Alert ID</th>
                  <th className="px-3 py-2.5 font-semibold">Source / Type</th>
                  <th className="px-3 py-2.5 font-semibold">Location</th>
                  <th className="px-3 py-2.5 font-semibold">Severity</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-stone-400">
                      No alerts match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((a) => {
                    const st = ALERT_STATUS_META[a.status];
                    const sev = ALERT_SEVERITY_META[a.severity];
                    const SourceIcon = SOURCE_TYPE_ICON[a.sourceType];
                    return (
                      <tr key={a.id} className="hover:bg-[#E9EDFB]/30">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-stone-900">{a.id}</p>
                          <p className="text-[9px] text-stone-400">{timeAgo(a.timestamp)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${SOURCE_TYPE_CHIP[a.sourceType]}`}>
                            <SourceIcon size={9} /> {a.sourceType}
                          </span>
                          <p className="mt-1 text-[9px] text-stone-400">{a.sensorName}</p>
                        </td>
                        <td className="px-3 py-3 text-stone-600">{a.purok}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${sev.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} /> {a.severity}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${st.chip}`}>{st.label}</span>
                        </td>


                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelected(a)}
                              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-50"
                            >
                              <Eye size={10} /> Review
                            </button>
                            {a.status === "unacknowledged" && (
                              <button
                                onClick={() => ackAlert(a)}
                                className="flex items-center gap-1 rounded-lg bg-[#0038A8] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#002A8C]"
                              >
                                <BellRing size={10} /> Ack
                              </button>
                            )}
                            {a.linkedIncidentId ? (
                              <span className="rounded-lg bg-sky-100 px-2 py-1 text-[10px] font-medium text-sky-700">
                                {a.linkedIncidentId}
                              </span>
                            ) : (
                              <button
                                onClick={() => setLinkTarget(a)}
                                className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-50"
                              >
                                <Link2 size={10} /> Link
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>


        {/* Outgoing Broadcast Alert History */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#334155]">
                <Megaphone size={14} className="text-[#0f766e]" /> Outgoing Broadcast Alert History
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                Security broadcasts sent to residents, Tanods &amp; Neighborhood Watch
              </p>
            </div>
            <button
              onClick={() => setBroadcastOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#115e59]"
            >
              <Megaphone size={13} /> New Broadcast
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-stone-100 text-[9px] uppercase tracking-wider text-stone-400">
                  <th className="px-5 py-2.5 font-semibold">Broadcast ID</th>
                  <th className="px-3 py-2.5 font-semibold">Target Audience</th>
                  <th className="px-3 py-2.5 font-semibold">Severity</th>
                  <th className="px-3 py-2.5 font-semibold">Broadcast Time</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {broadcasts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-stone-400">
                      No outgoing broadcasts recorded yet.
                    </td>
                  </tr>
                ) : (
                  broadcasts.map((b) => {
                    const sev = b.severity ?? "Info";
                    const sevMeta = ALERT_SEVERITY_META[sev as AlertSeverity] ?? ALERT_SEVERITY_META.Low;
                    const isAllClear = !!b.isAllClear;
                    const isPending = b.approvalStatus === "pending" || b.approvalStatus === "rejected";
                    const isActive = !isAllClear && !isPending && b.state === "published";
                    return (
                      <tr key={b.id} className="hover:bg-[#E9EDFB]/30">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-stone-900">{b.id}</p>
                          <p className="text-[9px] text-stone-400">{b.title}</p>
                        </td>
                        <td className="px-3 py-3 text-stone-600">
                          {(b.audience?.length ? b.audience.map((a) => AUDIENCE_LABEL[a] ?? a).join(", ") : "All")} · {broadcastTargetLabel(b)}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${sevMeta.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sevMeta.dot}`} /> {sev}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-stone-600">{b.publishedAt ? formatFull(b.publishedAt) : formatFull(b.createdAt)}</td>
                        <td className="px-3 py-3">
                          {isAllClear ? (
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-semibold text-teal-700">Resolved / Closed</span>
                          ) : isPending ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">Pending Approval</span>
                          ) : isActive ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">Active</span>
                          ) : (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold text-stone-500">Draft</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => flash(`${b.id} — ${b.title}\n${b.message}`, { title: "Broadcast Record" })}
                              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-50"
                            >
                              <FileSearch size={10} /> View Record
                            </button>
                            {isActive && !isAllClear && (
                              <button
                                onClick={() => setAllClearTarget(b)}
                                className="flex items-center gap-1 rounded-lg bg-teal-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-teal-700"
                              >
                                <CheckCircle2 size={10} /> All-Clear
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>


      {/* Alert Detail Drawer */}
      {selected && (
        <AlertDetailDrawer
          alert={selected}
          onClose={() => setSelected(null)}
          onAcknowledge={() => ackAlert(selected)}
          onConvert={() => setConvertTarget(selected)}
          onLink={() => setLinkTarget(selected)}
          onDismiss={() => setDismissTarget(selected)}
          onEscalate={() => {
            setSelected(null);
            setBroadcastOpen(true);
          }}
        />
      )}

      {/* Create / Escalate Security Alert Broadcast Modal */}
      {broadcastOpen && (
        <BroadcastModal
          onClose={() => setBroadcastOpen(false)}
          onSubmit={handleBroadcastSubmit}
          incidents={incidents}
        />
      )}

      {/* Link to existing incident modal */}
      {linkTarget && (
        <LinkIncidentModal
          alert={linkTarget}
          incidents={incidents}
          onClose={() => setLinkTarget(null)}
          onLink={(id) => handleLink(linkTarget, id)}
        />
      )}

      {/* Convert to incident modal */}
      {convertTarget && (
        <ConvertIncidentModal
          alert={convertTarget}
          onClose={() => setConvertTarget(null)}
          onConvert={(inc) => handleConvert(convertTarget, inc)}
        />
      )}

      {/* Dismiss / false alarm modal */}
      {dismissTarget && (
        <DismissAlertModal
          alert={dismissTarget}
          onClose={() => setDismissTarget(null)}
          onConfirm={handleDismiss}
        />
      )}

      {/* All-clear dialog */}
      {allClearTarget && (
        <AllClearModal
          alert={allClearTarget}
          onClose={() => setAllClearTarget(null)}
          onConfirm={handleAllClear}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function FilterSelect({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-600 focus:border-[#0038A8] focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "All" ? `${label}: ${o}` : o}
        </option>
      ))}
    </select>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-100 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-stone-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-[12px] font-medium text-stone-800">{value}</p>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Alert Detail Drawer
// ---------------------------------------------------------------------------

function AlertDetailDrawer({
  alert, onClose, onAcknowledge, onConvert, onLink, onDismiss, onEscalate,
}: {
  alert: SystemAlert;
  onClose: () => void;
  onAcknowledge: () => void;
  onConvert: () => void;
  onLink: () => void;
  onDismiss: () => void;
  onEscalate: () => void;
}) {
  const st = ALERT_STATUS_META[alert.status];
  const canAct = alert.status === "unacknowledged" || alert.status === "acknowledged";
  const hasIncident = !!alert.linkedIncidentId;

  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={alert.id}
      subtitle={`${alert.sourceType} · ${alert.purok}`}
      icon={<AlertTriangle size={18} />}
      iconClass={alert.severity === "Emergency" ? "bg-rose-100 text-rose-700" : "bg-[#0038A8]/10 text-[#0038A8]"}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Dismiss (False Alarm)
          </button>
          {!hasIncident && (
            <button
              onClick={onLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#0038A8]/30 bg-[#E9EDFB] px-3 py-2 text-[11px] font-semibold text-[#0038A8] hover:bg-[#dbe3fb]"
            >
              <Link2 size={12} /> Link to Incident
            </button>
          )}
          {canAct && alert.status === "unacknowledged" && (
            <button
              onClick={onAcknowledge}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#002A8C]"
            >
              <BellRing size={12} /> Confirm &amp; Acknowledge
            </button>
          )}
          {canAct && (
            <button
              onClick={onConvert}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#115e59]"
            >
              <PlusCircle size={12} /> Convert to Incident
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile icon={<Clock size={13} />} label="TIMESTAMP" value={formatFull(alert.timestamp)} />
          <InfoTile icon={<Siren size={13} />} label="SEVERITY" value={alert.severity} />
          <InfoTile icon={<MapPin size={13} />} label="LOCATION" value={alert.purok} />
          <InfoTile icon={<Camera size={13} />} label="COVERAGE CAMERAS" value={alert.cameras.join(", ")} />
          <InfoTile icon={<Zap size={13} />} label="DEVICE" value={`${alert.deviceId} · ${alert.sensorName}`} />
          <InfoTile icon={<Shield size={13} />} label="STATUS" value={st.label} />
        </div>

        {hasIncident && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
            <Link2 size={14} className="mt-0.5 shrink-0 text-sky-600" />
            <p className="text-[11px] leading-relaxed text-sky-800">
              Linked to <span className="font-semibold">{alert.linkedIncidentId}</span> — sensor logs and alert timestamps
              merged into the incident timeline.
            </p>
          </div>
        )}


        {/* Telemetry graph */}
        <div className="rounded-lg border border-stone-100 p-3">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">SENSOR HISTORICAL GRAPH</p>
          <TelemetryChart alert={alert} />
          <p className="mt-2 text-[10px] text-stone-500">
            Reading: <span className="font-semibold text-stone-800">{alert.reading}%</span> · Threshold:{" "}
            <span className="font-semibold text-stone-800">{alert.threshold}%</span>
            {alert.reading >= alert.threshold && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700">
                <AlertTriangle size={9} /> Threshold Breach
              </span>
            )}
          </p>
        </div>

        {/* CCTV previews */}
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">LINKED CCTV VISUALS</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {alert.cameras.map((cam) => (
              <div key={cam} className="flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-200 text-stone-500">
                  <Camera size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-stone-800">{cam}</p>
                  <p className="text-[9px] text-stone-400">Live feed · covering {alert.purok}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalated broadcast shortcut */}
        <button
          onClick={onEscalate}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          <Megaphone size={13} /> Escalate to Security Broadcast
        </button>
      </div>
    </Modal>
  );
}

function TelemetryChart({ alert }: { alert: SystemAlert }) {
  const max = Math.max(100, alert.threshold + 20);
  const points = alert.readings.map((r, i) => {
    const x = i * (280 / Math.max(1, alert.readings.length - 1));
    const y = 80 - (r / max) * 70;
    return `${x},${y}`;
  });
  const thY = 80 - (alert.threshold / max) * 70;
  const poly = points.join(" ");
  return (
    <svg viewBox="0 0 280 90" className="h-auto w-full rounded-md bg-[#F6F8FF]">
      <line x1="0" y1={thY} x2="280" y2={thY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
      <text x="4" y={thY - 3} fontSize="6" fill="#b45309">Threshold {alert.threshold}%</text>
      <polygon points={`0,80 ${poly} 280,80`} fill="rgba(220,38,38,0.12)" />
      <polyline points={poly} fill="none" stroke={alert.reading >= alert.threshold ? "#dc2626" : "#3B6BE0"} strokeWidth="2" strokeLinejoin="round" />
      {alert.readings.map((r, i) => {
        const [x, y] = points[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={i === alert.readings.length - 1 ? 3 : 1.8} fill={r >= alert.threshold ? "#dc2626" : "#3B6BE0"} />;
      })}
      <text x="4" y="88" fontSize="6" fill="#64748b">Historical readings (last 10 samples)</text>
    </svg>
  );
}


// ---------------------------------------------------------------------------
// Broadcast Modal — create / escalate security alert
// ---------------------------------------------------------------------------

function BroadcastModal({
  onClose, onSubmit, incidents,
}: {
  onClose: () => void;
  onSubmit: (n: SafetyNotice) => void;
  incidents: Incident[];
}) {
  const [severity, setSeverity] = useState<NoticeSeverity>("High");
  const [audience, setAudience] = useState<NoticeAudience[]>(["residents", "tanods", "neighborhood_watch"]);
  const [purok, setPurok] = useState("Purok 4");
  const [template, setTemplate] = useState("Smoke / Fire Advisory");
  const [message, setMessage] = useState("");
  const [incidentId, setIncidentId] = useState<string>(() => incidents[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requiresApproval = severity === "High";
  const openIncidents = incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "closed_false_alarm"
  );

  function toggleAudience(a: NoticeAudience) {
    setAudience((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function chooseTemplate(label: string) {
    setTemplate(label);
    const t = BROADCAST_TEMPLATES.find((x) => x.label === label);
    if (t) setMessage(t.body);
  }

  function submit() {
    const effectiveTitle = title.trim() || `${template} — ${purok}`;
    const notice = addSafetyNotice({
      title: effectiveTitle,
      category: "Safety Alert" as NoticeCategory,
      message: message.trim() || "Security advisory issued by the Barangay Desk Officer.",
      target: { kind: "purok", purok } as NoticeTarget,
      state: requiresApproval ? "draft" : "published",
      author: "D.O. Ramos",
      createdAt: new Date().toISOString(),
      publishedAt: requiresApproval ? undefined : new Date().toISOString(),
      incidentId: incidentId || undefined,
      severity,
      audience,
      approvalStatus: requiresApproval ? "pending" : undefined,
    });
    onSubmit(notice);
  }

  return (
    <Modal
      onClose={onClose}
      title="Create Security Alert"
      subtitle="Severity-graded broadcast to residents, Tanods &amp; Neighborhood Watch"
      icon={<Megaphone size={18} />}
      iconClass="bg-[#0f766e]/10 text-[#0f766e]"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-white transition ${
              requiresApproval ? "bg-amber-600 hover:bg-amber-700" : "bg-[#0f766e] hover:bg-[#115e59]"
            }`}
          >
            <Send size={13} />
            {requiresApproval ? "Submit for Approval" : "Submit Alert Broadcast"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Linked incident */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">LINKED INCIDENT</p>
          <select
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none"
          >
            <option value="">— None —</option>
            {openIncidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} · {i.category} · {i.purok}
              </option>
            ))}
          </select>
        </div>


        {/* Severity */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">ALERT SEVERITY</p>
          <div className="grid grid-cols-3 gap-2">
            {(["Info", "Warning", "High"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                  severity === s
                    ? s === "High"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {requiresApproval
              ? "High / Emergency severity requires Punong Barangay confirmation before broadcast."
              : "Info / Warning severity releases immediately across push notifications & SMS."}
          </div>
        </div>

        {/* Target audience */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET AUDIENCE</p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "residents", label: "Zone Residents" },
              { value: "tanods", label: "Assigned Tanods" },
              { value: "neighborhood_watch", label: "Neighborhood Watch" },
            ] as { value: NoticeAudience; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleAudience(opt.value)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                  audience.includes(opt.value)
                    ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                <Users size={12} /> {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET LOCATION</p>
          <select
            value={purok}
            onChange={(e) => setPurok(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none"
          >
            <option value="Entire Barangay">Entire Barangay (System-Wide)</option>
            {PUROK_ZONES.map((z) => (
              <option key={z.id} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        {/* Message template */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">MESSAGE TEMPLATE</p>
          <div className="flex flex-wrap gap-1.5">
            {BROADCAST_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => chooseTemplate(t.label)}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                  template === t.label
                    ? "border-[#0f766e]/40 bg-teal-50 text-[#0f766e]"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom message narrative */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">CUSTOM MESSAGE NARRATIVE</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Describe the situation, affected zone and instructions for the audience..."
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>

        {/* Title */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">ALERT TITLE</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short alert title shown to recipients"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
      </div>

      {confirmOpen && (
        <ConfirmModal
          type="confirm"
          tone={requiresApproval ? "danger" : "primary"}
          title={requiresApproval ? "Escalate this High-Severity broadcast?" : "Submit this security broadcast?"}
          message={
            requiresApproval
              ? "This High-severity alert routes to the Punong Barangay approval queue with status Pending Approval. It will not be distributed until authorized."
              : `This ${severity} alert broadcasts immediately across push + SMS to the selected audience(s).`
          }
          confirmLabel={requiresApproval ? "Send for Approval" : "Submit Broadcast"}
          cancelLabel="Back"
          onConfirm={() => {
            setConfirmOpen(false);
            submit();
          }}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </Modal>
  );
}


// ---------------------------------------------------------------------------
// Link to existing incident
// ---------------------------------------------------------------------------

function LinkIncidentModal({
  alert, incidents, onClose, onLink,
}: {
  alert: SystemAlert;
  incidents: Incident[];
  onClose: () => void;
  onLink: (id: string) => void;
}) {
  const [incidentId, setIncidentId] = useState<string>(() => incidents[0]?.id ?? "");
  const openIncidents = incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "closed_false_alarm"
  );
  return (
    <Modal
      onClose={onClose}
      title="Link Alert to Incident"
      subtitle={`${alert.id} · ${alert.purok}`}
      icon={<Link2 size={18} />}
      iconClass="bg-sky-100 text-sky-700"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onLink(incidentId)}
            disabled={!incidentId}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#002A8C] disabled:opacity-40"
          >
            <Link2 size={13} /> Link to Incident
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-stone-600">
          Attach <span className="font-semibold text-stone-900">{alert.id}</span> sensor logs and timestamps to an active
          incident folder for the parallel CCTV review.
        </p>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">ACTIVE INCIDENT</p>
          <select
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 focus:border-[#0038A8] focus:outline-none"
          >
            {openIncidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} · {i.category} · {i.purok}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11px] text-sky-800">
          Linking merges the sensor logs and alert timestamp into the target incident timeline, then sets the alert status
          to <span className="font-semibold">Linked to Incident</span>.
        </div>
      </div>
    </Modal>
  );
}


// ---------------------------------------------------------------------------
// Convert to incident
// ---------------------------------------------------------------------------

const INCIDENT_CATEGORY_OPTIONS = [
  "Fire or Smoke",
  "Noise Disturbance",
  "Public Disturbance",
  "Hazard or Obstruction",
  "Suspicious Activity",
  "Medical or Welfare Concern",
  "Other",
] as const;

function ConvertIncidentModal({
  alert, onClose, onConvert,
}: {
  alert: SystemAlert;
  onClose: () => void;
  onConvert: (inc: Incident) => void;
}) {
  const [category, setCategory] = useState<string>(
    alert.sourceType === "IoT Smoke Sensor" ? "Fire or Smoke" : "Noise Disturbance"
  );
  const [description, setDescription] = useState<string>(
    `${alert.sourceType} breach at ${alert.purok} (${alert.sensorName}, reading ${alert.reading}% vs threshold ${alert.threshold}%).`
  );
  const coord = PUROK_COORDS[alert.purok] ?? PUROK_COORDS["Purok 1"];

  async function submit() {
    const inc = await addIncident({
      category,
      severity: alert.severity === "Emergency" ? "critical" : alert.severity === "High" ? "warning" : "low",
      purok: alert.purok,
      description: description.trim(),
      source: "iot" as IncidentSource,
      reporter: alert.sensorName,
      time: alert.timestamp,
      status: "new",
      photos: 0,
      lat: coord.lat,
      lng: coord.lng,
      priority: alert.severity === "Emergency" ? "High" : alert.severity === "High" ? "Medium" : "Low",
      relatedAlertId: alert.id,
      verificationStatus: "new",
    });
    onConvert(inc);
  }

  return (
    <Modal
      onClose={onClose}
      title={`Create Incident from ${alert.id}`}
      subtitle={`${alert.purok} · ${alert.sourceType}`}
      icon={<PlusCircle size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!description.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#002A8C] disabled:opacity-40"
          >
            <PlusCircle size={13} /> Confirm &amp; Create Incident
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <InfoTile icon={<MapPin size={13} />} label="CONFIRMED LOCATION" value={alert.purok} />
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">INCIDENT TYPE</p>
          <div className="flex flex-wrap gap-1.5">
            {INCIDENT_CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                  category === c
                    ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">NARRATIVE</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
          System will generate a new Incident ID, auto-attach sensor metadata, drop a pin, and route parallel CCTV review
          triggers. Status becomes <span className="font-semibold">Converted to Incident</span>.
        </div>
      </div>
    </Modal>
  );
}


// ---------------------------------------------------------------------------
// Dismiss / false alarm
// ---------------------------------------------------------------------------

function DismissAlertModal({
  alert, onClose, onConfirm,
}: {
  alert: SystemAlert;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      onClose={onClose}
      title={`Dismiss ${alert.id}`}
      subtitle="Mark as resolved / false alarm"
      icon={<X size={18} />}
      iconClass="bg-stone-100 text-stone-600"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={reason.trim().length < 3}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-stone-600 px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-stone-700 disabled:opacity-40"
          >
            <CheckCircle2 size={13} /> Dismiss Alert
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-stone-600">
          Dismissing {alert.id} clears it from the queue and marks it{" "}
          <span className="font-semibold">Dismissed / False Alarm</span>. A remark is required for the audit trail.
        </p>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">DISMISSAL REASON (REQUIRED)</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Sensor false positive from cooking smoke — no active fire detected."
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[11px] text-stone-600">
          The reason is logged in the audit trail and the sensor telemetry is retained for sensor tuning.
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// All-Clear dialog
// ---------------------------------------------------------------------------

function AllClearModal({
  alert, onClose, onConfirm,
}: {
  alert: SafetyNotice;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Modal
      onClose={onClose}
      title={`Issue All-Clear — ${alert.id}`}
      subtitle={alert.title}
      icon={<CheckCircle2 size={18} />}
      iconClass="bg-teal-100 text-teal-700"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={notes.trim().length < 3}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
          >
            <CheckCircle2 size={13} /> Confirm &amp; Send All-Clear
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-stone-600">
          This broadcasts an <span className="font-semibold">All-Clear</span> to everyone who received {alert.id} —{" "}
          {(alert.audience?.length ? alert.audience.map((a) => AUDIENCE_LABEL[a] ?? a).join(", ") : "Residents")} at{" "}
          {broadcastTargetLabel(alert)} — and moves the alert to{" "}
          <span className="font-semibold">Resolved / Closed</span>.
        </p>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">RESOLUTION / FINAL ADVISORY</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Area is now safe. Thank you for your cooperation."
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-[11px] text-teal-800">
          The full broadcast log and resolution timestamp are attached to the linked incident folder for permanent record.
        </div>
      </div>
    </Modal>
  );
}

