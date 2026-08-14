import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Volume2,
  Siren,
  MapPin,
  Clock,
  RadioTower,
  Info,
  CheckCheck,
  LoaderCircle,
  ShieldAlert,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";
import { usePurokIncidents } from "./incidentStore";

type IotAlertType = "noise" | "disturbance" | "smoke";
type IotSeverity = "medium" | "high";
type AlertFilter = "all" | "unread" | IotAlertType;
type AlertState = "unread" | "read" | "escalated";

interface IotAlert {
  id: string;
  type: IotAlertType;
  severity: IotSeverity;
  deviceId: string;
  title: string;
  detail: string;
  purok: string;
  lat: number;
  lng: number;
  occurredAt: string;
  value?: number;
  threshold?: number;
  state: AlertState;
  acknowledgedAt?: string;
}

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

const TYPE_META: Record<IotAlertType, { label: string; icon: typeof Volume2; badge: string; dot: string }> = {
  noise: { label: "Noise Event", icon: Volume2, badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  disturbance: { label: "Disturbance", icon: Siren, badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  smoke: { label: "Smoke Sensor", icon: ShieldAlert, badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

const SEVERITY_META: Record<IotSeverity, { label: string; badge: string }> = {
  medium: { label: "Medium", badge: "bg-amber-100 text-amber-700" },
  high: { label: "High", badge: "bg-rose-100 text-rose-700" },
};

const INITIAL_ALERTS: IotAlert[] = [
  {
    id: "IoT-1203",
    type: "noise",
    severity: "medium",
    deviceId: "DB-MARKET-03",
    title: "Sustained noise at market row",
    detail: "Decibel spike near stall 12 — sustained above the quiet-hours threshold for 20+ minutes.",
    purok: JURISDICTION_NAME,
    lat: 105,
    lng: 200,
    occurredAt: "2026-07-20T10:24:00",
    value: 82,
    threshold: 80,
    state: "unread",
  },
  {
    id: "IoT-1202",
    type: "disturbance",
    severity: "medium",
    deviceId: "MD-PLAZA-02",
    title: "Motion cluster at plaza corner",
    detail: "Repeated motion events near the plaza corner overnight — possible loitering or crowd gathering.",
    purok: JURISDICTION_NAME,
    lat: 100,
    lng: 205,
    occurredAt: "2026-07-20T06:10:00",
    state: "unread",
  },
  {
    id: "IoT-1201",
    type: "noise",
    severity: "medium",
    deviceId: "DB-MARKET-03",
    title: "Fiesta karaoke at plaza",
    detail: "Loud karaoke from the fiesta stage — aligns with the scheduled barangay fiesta program today.",
    purok: JURISDICTION_NAME,
    lat: 100,
    lng: 205,
    occurredAt: "2026-07-20T08:05:00",
    value: 84,
    threshold: 85,
    state: "read",
    acknowledgedAt: "2026-07-20T08:12:00",
  },
  {
    id: "IoT-1200",
    type: "smoke",
    severity: "high",
    deviceId: "SM-PUROK3-01",
    title: "Smoke threshold breach",
    detail: "Smoke density read above threshold near the market — flagged for the Desk Officer's command center.",
    purok: JURISDICTION_NAME,
    lat: 108,
    lng: 195,
    occurredAt: "2026-07-20T09:58:00",
    value: 512,
    threshold: 500,
    state: "read",
    acknowledgedAt: "2026-07-20T10:01:00",
  },
];

export default function PurokIotAlerts() {
  const { flash, ToastPortal } = useToast();
  const { escalate, escalatedCases } = usePurokIncidents();

  const [alerts, setAlerts] = useState<IotAlert[]>(INITIAL_ALERTS);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [liveFeeding, setLiveFeeding] = useState(false);
  const liveAlertSeq = useRef(0);

  const medium = alerts.filter((a) => a.severity === "medium");
  const unread = alerts.filter((a) => a.state === "unread");
  const escalatedCount = alerts.filter((a) => a.state === "escalated").length;

  useEffect(() => {
    let innerTimer: number | null = null;
    const t = window.setTimeout(() => {
      setLiveFeeding(true);
      innerTimer = window.setTimeout(() => {
        const alert: IotAlert = {
          id: `IoT-${1204 + liveAlertSeq.current++}`,
          type: "noise",
          severity: "medium",
          deviceId: "DB-MARKET-03",
          title: "Elevated noise at eatery row",
          detail: "New noise burst detected near eatery row beside the public market — within your jurisdiction.",
          purok: JURISDICTION_NAME,
          lat: 112,
          lng: 205,
          occurredAt: new Date().toISOString(),
          value: 81,
          threshold: 80,
          state: "unread",
        };
        setAlerts((prev) => [alert, ...prev]);
        setLiveFeeding(false);
        flash("New Medium Severity IoT alert received — DB-MARKET-03 noise event");
      }, 6000);
    }, 4000);
    return () => {
      window.clearTimeout(t);
      if (innerTimer !== null) window.clearTimeout(innerTimer);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "unread") return alerts.filter((a) => a.state === "unread");
    if (filter === "noise" || filter === "disturbance" || filter === "smoke") return alerts.filter((a) => a.type === filter);
    return alerts;
  }, [alerts, filter]);

  const filterTabs: { key: AlertFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: alerts.length },
    { key: "unread", label: "Unread", count: unread.length },
    { key: "noise", label: "Noise", count: alerts.filter((a) => a.type === "noise").length },
    { key: "disturbance", label: "Disturbance", count: alerts.filter((a) => a.type === "disturbance").length },
  ];

  const kpis = [
    { label: "IOT ALERTS", value: alerts.length, sub: `within ${JURISDICTION_NAME}`, icon: Bell },
    { label: "UNREAD", value: unread.length, sub: "needs your review", icon: BellRing },
    { label: "MEDIUM SEVERITY", value: medium.length, sub: "delivered to this role", icon: Volume2 },
    { label: "ESCALATED", value: escalatedCount, sub: "sent to desk officer", icon: ArrowUpRight },
  ];

  function acknowledge(id: string) {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id && a.state === "unread" ? { ...a, state: "read", acknowledgedAt: new Date().toISOString() } : a
      )
    );
    flash(`${id} marked as read`);
  }

  function acknowledgeAll() {
    setAlerts((prev) => prev.map((a) => (a.state === "unread" ? { ...a, state: "read", acknowledgedAt: new Date().toISOString() } : a)));
    flash("All alerts marked as read");
  }

  function escalateAlert(a: IotAlert) {
    if (a.state === "escalated") return;
    const maxInc = escalatedCases.reduce((acc, c) => {
      const n = parseInt(c.id.replace(/^INC-/, ""), 10);
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 2000);
    const incidentId = `INC-${maxInc + 1}`;
    escalate({
      id: incidentId,
      category: a.type === "smoke" ? "Fire/Smoke" : "Noise Disturbance",
      title: a.title,
      reporter: a.deviceId,
      purok: JURISDICTION_NAME,
      suggestedPriority: a.severity === "high" ? "critical" : "warning",
      notes: `IoT alert from ${a.deviceId}: ${a.detail}`,
    });
    setAlerts((prev) => prev.map((al) => (al.id === a.id ? { ...al, state: "escalated" } : al)));
    flash(`${incidentId} transferred to the Barangay Desk Officer`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">IoT Alert Inbox</h1>
              <p className="mt-1 text-sm text-stone-500">
                Medium Severity sensor alerts delivered to your purok
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <RadioTower size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">ALERT COVERAGE</p>
                <p className="text-[12px] font-bold text-[#0038A8]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              As Purok Leader you receive <span className="font-semibold text-stone-800">Medium Severity IoT alerts</span> — noise and disturbance events — detected inside <span className="font-semibold text-stone-800">{JURISDICTION_LABEL}</span>. High severity sensor events (e.g. smoke breaches) are routed directly to the Desk Officer's command center; you may still review and escalate them here.
            </p>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
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

        <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Alert Stream — {JURISDICTION_NAME}</h3>
                <p className="text-[11px] text-[#94A3B8]">IoT noise &amp; disturbance events in your jurisdiction</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {liveFeeding && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <LoaderCircle size={10} className="animate-spin" />
                  Listening for sensors...
                </span>
              )}
              <button
                onClick={acknowledgeAll}
                disabled={unread.length === 0}
                className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"
              >
                <CheckCheck size={10} />
                Mark all read
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-stone-100 px-5 py-3">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  filter === t.key
                    ? "border-[#0038A8] bg-[#0038A8] text-white"
                    : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                {t.label}
                <span className="ml-1 opacity-70">({t.count})</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                <Activity size={22} className="mb-2 text-stone-300" />
                <p className="text-[12px] font-medium text-stone-500">No alerts in this view</p>
                <p className="text-[10px] text-stone-400">New sensor events appear here as they stream in</p>
              </div>
            ) : (
              filtered.map((a) => {
                const type = TYPE_META[a.type];
                const TypeIcon = type.icon;
                const sev = SEVERITY_META[a.severity];
                const isMedium = a.severity === "medium";
                return (
                  <div
                    key={a.id}
                    className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm ${
                      a.state === "unread" ? "border-amber-300 bg-amber-50/40" : "border-stone-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-stone-900">{a.id}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${type.badge}`}>
                          <TypeIcon size={9} />
                          {type.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                          {sev.label}
                        </span>
                        {a.state === "unread" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            New
                          </span>
                        ) : a.state === "escalated" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                            <ArrowUpRight size={9} />
                            Escalated
                          </span>
                        ) : null}
                        {a.severity === "medium" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#0038A8]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#0038A8]">
                            <BellRing size={9} />
                            Pushed to your inbox
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-stone-400">
                        <Clock size={10} />
                        {formatTime(a.occurredAt)}
                      </span>
                    </div>

                    <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{a.title}</h4>
                    <p className="mt-0.5 text-[11px] text-stone-500">{a.detail}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                      <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                        <RadioTower size={10} />
                        {a.deviceId}
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                        <MapPin size={10} />
                        {a.purok} · GPS {a.lat}, {a.lng}
                      </span>
                      {a.value !== undefined && a.threshold !== undefined && (
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <Activity size={10} />
                          {a.value} / {a.threshold}
                          {a.value >= a.threshold ? " · over threshold" : ""}
                        </span>
                      )}
                      {!isMedium && (
                        <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-rose-600">
                          <Siren size={10} />
                          routed to Desk Officer command center
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
                      {a.state === "unread" ? (
                        <p className="flex items-center gap-1 text-[10px] text-amber-600">
                          <BellRing size={11} />
                          Awaiting your review
                        </p>
                      ) : a.state === "escalated" ? (
                        <p className="flex items-center gap-1 text-[10px] text-stone-400">
                          <ArrowUpRight size={11} />
                          In the Desk Officer's triage queue
                        </p>
                      ) : (
                        <p className="flex items-center gap-1 text-[10px] text-stone-400">
                          <CheckCheck size={11} />
                          Read {a.acknowledgedAt ? `· ${formatTime(a.acknowledgedAt)}` : ""}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {a.state === "unread" && (
                          <button
                            onClick={() => acknowledge(a.id)}
                            className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                          >
                            <CheckCheck size={10} />
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={() => escalateAlert(a)}
                          disabled={a.state === "escalated"}
                          className="flex h-7 items-center gap-1 rounded-md bg-[#0038A8] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                        >
                          <ArrowUpRight size={10} />
                          {a.state === "escalated" ? "Transferred" : "Escalate to Desk Officer"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}