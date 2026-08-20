import { useState, useEffect, useRef } from "react";
import {
  Radio,
  AlertTriangle,
  Siren,
  Zap,
  BellRing,
  Megaphone,
  Send,
  CheckCircle2,
  MapPin,
  Navigation,
  Users,
  ShieldCheck,
  Clock,
  Flame,
  Volume2,
  Smartphone,
  UserCheck,
  HelpCircle,
  Timer,
  BadgeCheck,
  MessageSquare,
  ArrowUpRight,
  Layers,
  ChevronDown,
  ChevronUp,
  PhoneOff,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal } from "../components/ui";

type DeviceType = "smoke" | "noise";

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  purok: string;
  status: "online" | "warning" | "offline";
  value: number;
  threshold: number;
  battery: number;
  rssi: number;
  lastPing: string;
}

interface AlertItem {
  id: string;
  title: string;
  type: "iot" | "sos" | "noise";
  severity: "critical" | "warning";
  purok: string;
  detail: string;
  source: string;
  time: string;
  status: "open" | "dispatched" | "broadcasting" | "closed";
}

interface AlertCluster {
  id: string;
  alertIds: string[];
  area: string;
  firstTime: string;
  lastTime: string;
  status: AlertItem["status"];
  memberCount: number;
}

// §6.5.6 — alerts cluster when they come from the SAME device within a short window, or from
// MULTIPLE devices inside the same area within a configured time window. Clustering only reduces
// top-level noise — every contributing alert stays individually expandable and actionable.
const SAME_DEVICE_WINDOW_MS = 10 * 60 * 1000;
const AREA_WINDOW_MS = 15 * 60 * 1000;

function alertDevice(a: AlertItem) {
  return a.source.split(" · ")[0];
}

function clusterStatusOf(members: AlertItem[]): AlertItem["status"] {
  if (members.some((m) => m.status === "open")) return "open";
  if (members.some((m) => m.status === "dispatched")) return "dispatched";
  if (members.some((m) => m.status === "broadcasting")) return "broadcasting";
  return "closed";
}

function buildClusters(alerts: AlertItem[]): AlertCluster[] {
  const sorted = [...alerts].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const clusters: AlertCluster[] = [];
  for (const alert of sorted) {
    const t = new Date(alert.time).getTime();
    const device = alertDevice(alert);
    let target: AlertCluster | undefined;
    for (const c of clusters) {
      const lastT = new Date(c.lastTime).getTime();
      const cLast = alerts.find((x) => x.id === c.alertIds[c.alertIds.length - 1]);
      const cDevice = cLast ? alertDevice(cLast) : "";
      const sameDevice = cDevice === device && t - lastT <= SAME_DEVICE_WINDOW_MS;
      const sameArea = c.area.split(", ").includes(alert.purok) && t - lastT <= AREA_WINDOW_MS;
      if (sameDevice || sameArea) {
        target = c;
        break;
      }
    }
    if (target) {
      target.alertIds.push(alert.id);
      target.lastTime = alert.time;
      target.area = [...new Set([...target.area.split(", "), alert.purok])].join(", ");
    } else {
      clusters.push({
        id: `CL-${String(clusters.length + 1).padStart(3, "0")}`,
        alertIds: [alert.id],
        area: alert.purok,
        firstTime: alert.time,
        lastTime: alert.time,
        status: alert.status,
        memberCount: 1,
      });
    }
  }
  return clusters.map((c) => {
    const members = alerts.filter((a) => c.alertIds.includes(a.id));
    return { ...c, memberCount: members.length, status: clusterStatusOf(members) };
  });
}

interface BroadcastItem {
  id: string;
  target: string;
  severity: "critical" | "warning";
  channel: string;
  residents: number;
  status: "awaiting_approval" | "sent";
  trigger: string;
}

const INITIAL_DEVICES: Device[] = [
  { id: "d1", name: "SM-GATE-01", type: "smoke", purok: "Purok 1", status: "online", value: 512, threshold: 500, battery: 87, rssi: -68, lastPing: "2 min ago" },
  { id: "d2", name: "SM-PLAZA-02", type: "smoke", purok: "Purok 2", status: "online", value: 85, threshold: 500, battery: 54, rssi: -71, lastPing: "4 min ago" },
  { id: "d3", name: "DB-HALL-01", type: "noise", purok: "Purok 4", status: "warning", value: 78, threshold: 85, battery: 21, rssi: -64, lastPing: "12 min ago" },
  { id: "d4", name: "SM-PUROK3-01", type: "smoke", purok: "Purok 3", status: "offline", value: 0, threshold: 500, battery: 8, rssi: -999, lastPing: "3 hrs ago" },
  { id: "d5", name: "DB-MARKET-01", type: "noise", purok: "Purok 6", status: "online", value: 62, threshold: 85, battery: 73, rssi: -59, lastPing: "1 min ago" },
  { id: "d6", name: "SM-CHAPEL-01", type: "smoke", purok: "Purok 5", status: "online", value: 45, threshold: 500, battery: 92, rssi: -63, lastPing: "3 min ago" },
];

const INITIAL_ALERTS: AlertItem[] = [
  { id: "ALT-118", title: "SM-GATE-01 Threshold Breach", type: "iot", severity: "critical", purok: "Purok 1", detail: "Smoke density 512 ppm exceeded 500 ppm threshold — bypassed standard queue", source: "SM-GATE-01 · ESP32/MQ-2", time: "2026-07-20T09:58:00", status: "open" },
  { id: "ALT-116", title: "DB-HALL-01 Noise Spike", type: "noise", severity: "warning", purok: "Purok 4", detail: "Noise spike 76 dB — second reading above ambient, same area as ALT-117", source: "DB-HALL-01 · ESP32/KY-037", time: "2026-07-20T09:45:00", status: "open" },
  { id: "SOS-042", title: "Citizen Emergency SOS", type: "sos", severity: "critical", purok: "Purok 6", detail: "SOS button held 3s — live GPS locked at Commercial Strip", source: "Ana Lim · Mobile App", time: "2026-07-20T10:05:00", status: "open" },
  { id: "ALT-117", title: "DB-HALL-01 Noise Spike", type: "noise", severity: "warning", purok: "Purok 4", detail: "Sustained 78 dB — approaching 85 dB threshold", source: "DB-HALL-01 · ESP32/KY-037", time: "2026-07-20T09:47:00", status: "dispatched" },
];

const INITIAL_BROADCASTS: BroadcastItem[] = [
  { id: "BC-031", target: "Purok 1 Geofence", severity: "critical", channel: "SMS + Loud Push", residents: 96, status: "awaiting_approval", trigger: "SM-GATE-01 breach" },
  { id: "BC-030", target: "Purok 4 Local", severity: "warning", channel: "Silent Push", residents: 12, status: "sent", trigger: "DB-HALL-01 noise" },
];

const ON_DUTY_TANODS = [
  { id: "t1", name: "Team Alpha", members: 4, availability: "dispatched", purok: "Purok 1" },
  { id: "t2", name: "Team Bravo", members: 3, availability: "available", purok: "Purok 6" },
  { id: "t3", name: "Team Charlie", members: 4, availability: "available", purok: "Purok 2" },
  { id: "t4", name: "Team Delta", members: 3, availability: "available", purok: "Purok 5" },
];

const INITIAL_ROUTES = [
  { id: "R-221", alert: "SM-GATE-01 Breach", tanod: "Team Alpha", eta: "4 min", distance: "1.2 km", status: "en_route" },
  { id: "R-222", alert: "SOS-042 Ana Lim", tanod: "Team Bravo", eta: "3 min", distance: "0.9 km", status: "en_route" },
  { id: "R-220", alert: "DB-HALL-01 Noise", tanod: "Team Charlie", eta: "6 min", distance: "1.6 km", status: "on_scene" },
];

const ROUTE_STEPS = [
  { text: "Head north on Barangay Road toward Plaza", dist: "400 m" },
  { text: "Turn left at Plaza Junction", dist: "50 m" },
  { text: "Continue straight — sensor/SOS point on right", dist: "120 m" },
];

// §6.5.13 — Resident Safety Acknowledgment has four defined states, not two.
const ROLL_CALL = {
  zone: "Purok 1 — Gate Residential",
  reached: 96,
  safe: 54,
  needHelp: 9,
  notSure: 8,
  unable: 5,
  noResponse: 20,
};

const NON_RESPONDERS = [
  { id: "NR-01", name: "L. Santos", gps: "Gate Residential Block", lastSeen: "3 min ago" },
  { id: "NR-02", name: "R. Mendoza", gps: "Plaza North", lastSeen: "5 min ago" },
  { id: "NR-03", name: "J. Cruz", gps: "Market Row", lastSeen: "6 min ago" },
  { id: "NR-04", name: "T. Bautista", gps: "Chapel Road", lastSeen: "8 min ago" },
];

const ALERT_TYPE_ICON: Record<string, typeof Flame> = {
  iot: Flame,
  sos: Siren,
  noise: Volume2,
};

const ALERT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  iot: { bg: "bg-rose-50", text: "text-rose-600" },
  sos: { bg: "bg-rose-100", text: "text-rose-700" },
  noise: { bg: "bg-amber-50", text: "text-amber-600" },
};

const BROADCAST_CHANNEL_COLORS: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  warning: "bg-amber-100 text-amber-700",
};

function deviceRisk(d: Device) {
  if (d.status === "offline") return "critical";
  if (d.value >= d.threshold) return "critical";
  if (d.status === "warning") return "warning";
  return "online";
}

function nextBroadcastId(broadcasts: { id: string }[]) {
  const max = broadcasts.reduce((acc, b) => {
    const n = parseInt(b.id.replace(/^BC-/, ""), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `BC-${max + 1}`;
}

function AlertPopUp({ alert, onDispatch, onBroadcast, onClose }) {
  if (!alert) return null;
  const meta = ALERT_TYPE_COLORS[alert.type];
  const Icon = ALERT_TYPE_ICON[alert.type] || AlertTriangle;
  const isSOS = alert.type === "sos";

  return (
    <Modal
      onClose={onClose}
      size="md"
      panelClass="border-rose-400/60 overflow-hidden"
      title={alert.title}
      subtitle={isSOS ? "EMERGENCY SOS SIGNAL" : "IOT THRESHOLD BREACH"}
      icon={
        <>
          <span className="absolute inset-0 animate-ping rounded-xl bg-rose-400 opacity-30" />
          <Icon size={22} />
        </>
      }
      iconClass={`relative ${meta.bg} ${meta.text}`}
      footer={
        <>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
              Hold
            </button>
            <button
              onClick={onDispatch}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
            >
              <Navigation size={13} />
              Dispatch Tanod
            </button>
          </div>
          <button
            onClick={onBroadcast}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <Megaphone size={13} />
            Request Emergency Broadcast
          </button>
        </>
      }
    >
      <div className="absolute inset-x-0 top-0 h-1.5 animate-pulse bg-rose-500" />
      <div className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-2xl ring-4 ring-rose-500/30" />
      <div className="mb-5 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <MapPin size={15} className="text-rose-600" />
          <p className="text-[13px] font-semibold text-rose-800">{alert.purok}</p>
        </div>
        <p className="text-[12px] leading-relaxed text-stone-500">{alert.detail}</p>
        <p className="text-[11px] text-stone-400">{alert.source} · {formatTime(alert.time)}</p>
      </div>
    </Modal>
  );
}

function DispatchModal({ alert, onClose, onConfirm }) {
  const [selected, setSelected] = useState("t2");

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Field Dispatch"
      subtitle={alert?.title}
      icon={<Navigation size={18} className="text-[#0038A8]" />}
      iconClass="bg-[#0038A8]/10"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <Send size={13} />
            Dispatch Now
          </button>
        </div>
      }
    >
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">AVAILABLE ON-DUTY TANODS</p>
      <div className="mb-4 space-y-2">
        {ON_DUTY_TANODS.filter((t) => t.availability === "available").map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 transition ${
              selected === t.id ? "border-[#0038A8]/40 bg-[#0038A8]/5" : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                {t.name.replace("Team ", "")}
              </span>
              <span className="text-left">
                <span className="block text-[12px] font-semibold text-stone-900">{t.name}</span>
                <span className="block text-[10px] text-stone-400">{t.members} members · {t.purok}</span>
              </span>
            </span>
            {selected === t.id && <CheckCircle2 size={15} className="text-[#0038A8]" />}
          </button>
        ))}
      </div>

      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">TURN-BY-TURN ROUTE GUIDANCE</p>
        <div className="space-y-1.5">
          {ROUTE_STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-stone-600">
              <Navigation size={11} className={i === 0 ? "text-[#0038A8]" : "text-stone-300"} />
              <span className="flex-1">{s.text}</span>
              <span className="text-[10px] font-medium text-stone-400">{s.dist}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CaptainAuthModal({ broadcast, onClose, onApprove }) {
  if (!broadcast) return null;
  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Captain Authorization"
      subtitle="Review and authorize high-severity emergency broadcast"
      icon={<ShieldCheck size={18} className="text-rose-600" />}
      iconClass="bg-rose-100"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Keep Queued
          </button>
          <button
            onClick={() => onApprove(broadcast)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700"
          >
            <ShieldCheck size={13} />
            Approve &amp; Send
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-stone-900">{broadcast.id}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BROADCAST_CHANNEL_COLORS[broadcast.severity]}`}>
            {broadcast.severity === "critical" ? "High" : "Medium"}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-stone-600">{broadcast.target} · {broadcast.channel}</p>
        <p className="text-[11px] text-stone-500">Triggered by {broadcast.trigger}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#0038A8]">
          <Users size={12} />
          {broadcast.residents} residents inside geofenced zone
        </p>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <ArrowUpRight size={13} className="mt-0.5 text-stone-400" />
        <p className="text-[11px] leading-relaxed text-stone-500">
          Simultaneous cellular SMS plus loud, persistent mobile push will be sent to every resident inside the affected geofence.
        </p>
      </div>
    </Modal>
  );
}

export default function IotAlertCommandCenter() {
  const { flash, ToastPortal } = useToast();

  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(INITIAL_BROADCASTS);
  const [routes, setRoutes] = useState(INITIAL_ROUTES);

  const [popAlert, setPopAlert] = useState<AlertItem | null>(null);
  const triggeredRef = useRef<string[]>([]);
  const devicesRef = useRef(devices);
  const alertCounterRef = useRef(119);
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const [dispatchAlert, setDispatchAlert] = useState<AlertItem | null>(null);
  const [authBroadcast, setAuthBroadcast] = useState<BroadcastItem | null>(null);
  const [sentBroadcast, setSentBroadcast] = useState<BroadcastItem | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = devicesRef.current.map((d) => {
        if (d.status === "offline") return d;
        const jitter = Math.floor(Math.random() * 7) - 3;
        return {
          ...d,
          value: Math.max(0, Math.min(d.threshold + 90, d.value + jitter)),
          lastPing: "just now",
        };
      });
      setDevices(next);
      const breached = next.find((d) => d.value >= d.threshold && !triggeredRef.current.includes(d.id));
      if (breached) {
        triggeredRef.current.push(breached.id);
        const alert: AlertItem = {
          id: `ALT-${alertCounterRef.current++}`,
          title: `${breached.name} Threshold Breach`,
          type: "iot",
          severity: "critical",
          purok: breached.purok,
          detail: `${breached.type === "smoke" ? "Smoke density" : "Decibel level"} ${breached.value} exceeded ${breached.threshold} threshold — bypassed standard queue`,
          source: `${breached.name} · ESP32/${breached.type === "smoke" ? "MQ-2" : "KY-037"}`,
          time: new Date().toISOString(),
          status: "open",
        };
        setAlerts((a) => [alert, ...a]);
        setPopAlert((p) => p ?? alert);
      }
    }, 4000);

    const sosTimer = setTimeout(() => {
      setPopAlert((p) => p ?? {
        id: "SOS-043",
        title: "Citizen Emergency SOS",
        type: "sos",
        severity: "critical",
        purok: "Purok 3 — Market Zone",
        detail: "SOS button held 3s — live GPS coordinates streaming at market entrance",
        source: "Pedro Reyes · Mobile App",
        time: new Date().toISOString(),
        status: "open",
      });
      setAlerts((a) => a.some((x) => x.id === "SOS-043") ? a : [
        { id: "SOS-043", title: "Citizen Emergency SOS", type: "sos", severity: "critical", purok: "Purok 3 — Market Zone", detail: "SOS button held 3s — live GPS coordinates streaming at market entrance", source: "Pedro Reyes · Mobile App", time: new Date().toISOString(), status: "open" },
        ...a,
      ]);
    }, 9000);

    return () => {
      clearInterval(interval);
      clearTimeout(sosTimer);
    };
  }, []);

  function confirmDispatch(alert: AlertItem, teamId: string) {
    const team = ON_DUTY_TANODS.find((t) => t.id === teamId)?.name ?? "Team Charlie";
    setRoutes((prev) => [
      { id: `R-${220 + prev.length}`, alert: alert.title, tanod: team, eta: "3 min", distance: "1.1 km", status: "en_route" },
      ...prev,
    ]);
    setAlerts((a) => a.map((x) => (x.id === alert.id ? { ...x, status: "dispatched" } : x)));
    setPopAlert(null);
    setDispatchAlert(null);
    flash(`${alert.id} dispatched to ${team} with turn-by-turn navigation`);
  }

  function requestBroadcast(alert: AlertItem) {
    const isHigh = alert.severity === "critical";
    const bc: BroadcastItem = {
      id: nextBroadcastId(broadcasts),
      target: `${alert.purok}${isHigh ? " Geofence" : " Local"}`,
      severity: isHigh ? "critical" : "warning",
      channel: isHigh ? "SMS + Loud Push" : "Silent Push",
      residents: isHigh ? 96 : 12,
      status: isHigh ? "awaiting_approval" : "sent",
      trigger: alert.title,
    };
    setBroadcasts((prev) => [bc, ...prev]);
    setPopAlert(null);
    if (isHigh) {
      setAuthBroadcast(bc);
    } else {
      flash(`Silent push routed to Desk Officer, Purok Leader & nearest Tanods`);
    }
  }

  function approveBroadcast(bc: BroadcastItem) {
    setBroadcasts((prev) => prev.map((b) => (b.id === bc.id ? { ...b, status: "sent" } : b)));
    setAuthBroadcast(null);
    setSentBroadcast(bc);
  }

  function remindNonResponder(r: (typeof NON_RESPONDERS)[number]) {
    flash(`Roll-call re-prompt sent to ${r.name} (${r.gps}) — SMS + push`);
  }

  function dispatchNonResponder(r: (typeof NON_RESPONDERS)[number]) {
    setRoutes((prev) => [
      { id: `R-${220 + prev.length}`, alert: `Roll-call follow-up — ${r.name}`, tanod: "Team Alpha", eta: "4 min", distance: "1.3 km", status: "en_route" },
      ...prev,
    ]);
    flash(`Tanod dispatched to ${r.name} — ${r.gps} (no roll-call response)`);
  }

  const onlineCount = devices.filter((d) => d.status !== "offline").length;
  const openAlerts = alerts.filter((a) => a.status === "open").length;
  const openSos = alerts.filter((a) => a.type === "sos" && a.status === "open").length;
  const pendingBc = broadcasts.filter((b) => b.status === "awaiting_approval").length;
  const clusters = buildClusters(alerts).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());

  function toggleCluster(id: string) {
    setExpandedClusters((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const kpis = [
    { label: "SENSORS DEPLOYED", value: `${onlineCount}/${devices.length}`, sub: `${devices.filter((d) => deviceRisk(d) === "critical").length} require attention`, icon: Radio },
    { label: "ACTIVE ALERTS", value: openAlerts, sub: `${openSos} SOS · threshold bypasses live`, icon: BellRing, pulse: !!popAlert },
    { label: "BROADCASTS QUEUED", value: pendingBc, sub: `${pendingBc} awaiting Captain authorization`, icon: Megaphone },
    { label: "ACTIVE ROUTES", value: routes.filter((r) => r.status === "en_route").length, sub: `tanods navigating in field`, icon: Navigation },
  ];

  const confirmedPct = Math.round(((ROLL_CALL.reached - ROLL_CALL.noResponse) / ROLL_CALL.reached) * 100);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">IoT Alert Command Center</h1>
              <p className="mt-1 text-sm text-stone-500">
                Live ESP32 telemetry, threshold breaches &amp; emergency broadcast requests
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Gateway Live
              </span>
            </div>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon, pulse }) => (
            <div
              key={label}
              className={`rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm transition-all duration-300 ${pulse ? "ring-2 ring-rose-300 animate-pulse" : ""}`}
            >
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

        <div className="mb-5">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <BellRing size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Alert Queue</h3>
                  <p className="text-[11px] text-[#94A3B8]">Bypassed standard queues — immediate action</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-600">{openAlerts} open · {clusters.length} cluster{clusters.length === 1 ? "" : "s"}</span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {clusters.length === 0 ? (
                <p className="px-2 py-8 text-center text-[12px] text-stone-400">No alerts in the queue</p>
              ) : (
                clusters.map((cl) => {
                  const members = cl.alertIds
                    .map((id) => alerts.find((a) => a.id === id))
                    .filter((a): a is AlertItem => Boolean(a));
                  const hasCritical = members.some((m) => m.severity === "critical");
                  const isOpen = cl.status === "open";
                  const expanded = expandedClusters.includes(cl.id);
                  const statusPill =
                    cl.status === "open"
                      ? { label: "Open", cls: "bg-rose-100 text-rose-700" }
                      : cl.status === "dispatched"
                        ? { label: "Dispatched", cls: "bg-sky-100 text-sky-700" }
                        : cl.status === "broadcasting"
                          ? { label: "Broadcasting", cls: "bg-violet-100 text-violet-700" }
                          : { label: "Closed", cls: "bg-emerald-100 text-emerald-700" };
                  return (
                    <div key={cl.id} className={`overflow-hidden rounded-lg border ${isOpen ? "border-rose-200 bg-rose-50/60" : "border-stone-200 bg-white"}`}>
                      <div className="px-3.5 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-md ${hasCritical ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-600"}`}>
                              <Layers size={12} />
                            </span>
                            <span className="text-[11px] font-bold text-stone-900">{cl.id}</span>
                            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-600">{cl.memberCount} alerts</span>
                            {hasCritical && (
                              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">High</span>
                            )}
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusPill.cls}`}>{statusPill.label}</span>
                          </div>
                          <button
                            onClick={() => toggleCluster(cl.id)}
                            className="flex h-6 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[9px] font-semibold text-stone-500 transition hover:bg-stone-50"
                          >
                            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            {expanded ? "Collapse" : "Expand"}
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-stone-800">
                          {[...new Set(members.map((m) => m.title))].join(" · ")}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-500">
                          <MapPin size={9} />
                          {cl.area}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-stone-400">
                          <Clock size={9} />
                          {formatTime(cl.firstTime)} – {formatTime(cl.lastTime)}
                          <span className="mx-0.5">&middot;</span>
                          {cl.alertIds.join(", ")}
                        </p>
                      </div>
                      {expanded && (
                        <div className="space-y-2 border-t border-stone-100 bg-white px-3.5 py-3">
                          <p className="text-[9px] font-semibold tracking-wider text-stone-400">CONTRIBUTING ALERTS — ACT ON EACH INDIVIDUALLY</p>
                          {members.map((a) => {
                            const meta = ALERT_TYPE_COLORS[a.type];
                            const Icon = ALERT_TYPE_ICON[a.type] || AlertTriangle;
                            const sev = SEVERITY_MAP[a.severity];
                            return (
                              <div key={a.id} className="rounded-md border border-stone-200 p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`flex h-5 w-5 items-center justify-center rounded-md ${meta.bg} ${meta.text}`}>
                                      <Icon size={10} />
                                    </span>
                                    <span className="text-[10px] font-bold text-stone-900">{a.id}</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${sev.badge}`}>
                                      {a.severity === "critical" ? "High" : "Medium"}
                                    </span>
                                  </div>
                                  <span className="flex items-center gap-1 text-[9px] text-stone-400">
                                    <Clock size={9} />
                                    {formatTime(a.time)}
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] font-semibold text-stone-800">{a.title}</p>
                                <p className="text-[9px] leading-snug text-stone-500">{a.detail}</p>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  {a.status === "open" ? (
                                    <>
                                      <button
                                        onClick={() => setDispatchAlert(a)}
                                        className="flex h-6 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[9px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                                      >
                                        <Navigation size={9} />
                                        Dispatch
                                      </button>
                                      {a.severity === "critical" && (
                                        <button
                                          onClick={() => requestBroadcast(a)}
                                          className="flex h-6 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-[9px] font-semibold text-rose-600 transition hover:bg-rose-50"
                                        >
                                          <Megaphone size={9} />
                                          Request Emergency Broadcast
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-600">
                                      <CheckCircle2 size={9} />
                                      {a.status === "dispatched" ? "Dispatched" : "Broadcast Sent"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Cascading Mass Broadcast Engine</h3>
                  <p className="text-[11px] text-[#94A3B8]">Desk Officer requests → Captain authorization → broadcast sent</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 pb-4 sm:grid-cols-2">
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-stone-900">
                    <Volume2 size={13} className="text-amber-600" />
                    Medium Severity
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">Noise / Disturbance</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-stone-600">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-amber-500" /> Silent / standard mobile push only</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-amber-500" /> Routed to Desk Officer</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-amber-500" /> Local Purok Leader</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-amber-500" /> Nearest on-duty Tanods</li>
                </ul>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-stone-900">
                    <Flame size={13} className="text-rose-600" />
                    High Severity
                  </span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-semibold text-rose-700">Fire / Disaster / SOS</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-stone-600">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-rose-500" /> Simultaneous cellular SMS broadcast</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-rose-500" /> Loud persistent mobile push</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-rose-500" /> All residents inside geofenced zone</li>
                  <li className="flex items-center gap-1.5"><ShieldCheck size={11} className="text-rose-500" /> Requires Captain 1-tap authorization</li>
                </ul>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">BROADCAST QUEUE</p>
              <div className="space-y-2">
                {broadcasts.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-bold text-stone-900">{b.id}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${BROADCAST_CHANNEL_COLORS[b.severity]}`}>
                        {b.severity === "critical" ? "High" : "Medium"}
                      </span>
                      <span className="text-[11px] text-stone-500">{b.target}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-stone-500">{b.channel}</span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-stone-700">
                        <Users size={11} />
                        {b.residents}
                      </span>
                      {b.status === "awaiting_approval" ? (
                        <button
                          onClick={() => setAuthBroadcast(b)}
                          className="flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <ShieldCheck size={10} />
                          Authorize
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-600">
                          <CheckCircle2 size={9} />
                          Sent
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Active Citizen Roll-Call</h3>
                  <p className="text-[11px] text-[#94A3B8]">Four-state resident safety acknowledgment overlay</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-rose-600">
                <Siren size={11} />
                Active
              </span>
            </div>

            <div className="space-y-4 px-5 pb-5">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">AFFECTED ZONE</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-stone-900">
                  <MapPin size={13} className="text-[#0038A8]" />
                  {ROLL_CALL.zone}
                </p>
                <p className="text-[11px] text-stone-500">“Safe / Need Help / Not Sure / Unable to Respond” overlay pushed to {ROLL_CALL.reached} resident phones</p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider text-stone-400">RESPONSE RATE</span>
                  <span className="text-[11px] font-bold text-emerald-600">{confirmedPct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${confirmedPct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700">
                    <BadgeCheck size={12} />
                    SAFE
                  </span>
                  <p className="mt-1 text-[24px] font-bold text-emerald-600">{ROLL_CALL.safe}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-rose-600">
                    <HelpCircle size={12} />
                    NEED HELP
                  </span>
                  <p className="mt-1 text-[24px] font-bold text-rose-600">{ROLL_CALL.needHelp}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700">
                    <AlertTriangle size={12} />
                    NOT SURE
                  </span>
                  <p className="mt-1 text-[24px] font-bold text-amber-600">{ROLL_CALL.notSure}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-stone-500">
                    <PhoneOff size={12} />
                    UNABLE TO RESPOND
                  </span>
                  <p className="mt-1 text-[24px] font-bold text-stone-500">{ROLL_CALL.unable}</p>                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-stone-200 bg-white p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-stone-500">
                    <Users size={12} />
                    REACHED
                  </span>
                  <p className="mt-1 text-[24px] font-bold text-stone-800">{ROLL_CALL.reached}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600">
                    <Timer size={12} />
                    NO RESPONSE
                  </span>
                  <p className="mt-1 text-[24px] font-bold text-amber-600">{ROLL_CALL.noResponse}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Smartphone size={12} className="text-[#0038A8]" />
                <p className="text-[10px] text-stone-500">Priority rescue routing for the {ROLL_CALL.needHelp} residents who tapped “Need Help”</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">NON-RESPONDERS — FOLLOW-UP</p>
                <div className="space-y-2">
                  {NON_RESPONDERS.map((r) => (
                    <div key={r.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[11px] font-semibold text-stone-900">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[8px] font-bold text-amber-600">
                            {r.name.split(" ").map((p) => p[0]).join("")}
                          </span>
                          {r.name}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-stone-400">
                          <MapPin size={9} />
                          {r.gps}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[9px] text-stone-400">No response · last seen {r.lastSeen}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => remindNonResponder(r)}
                            className="flex h-6 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[9px] font-semibold text-stone-600 transition hover:bg-stone-50"
                          >
                            <Smartphone size={9} />
                            Remind
                          </button>
                          <button
                            onClick={() => dispatchNonResponder(r)}
                            className="flex h-6 items-center gap-1 rounded-md border border-[#0038A8]/20 bg-[#0038A8]/5 px-2 text-[9px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                          >
                            <Navigation size={9} />
                            Dispatch
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[9px] text-stone-400">
                  Re-prompted via SMS + push every 5 min; dispatch a Tanod for residents who stay unresponsive. “Not Sure” residents are re-prompts; “Unable to Respond” are queued for a physical check.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Field Dispatch &amp; Hardware Routing</h3>
                  <p className="text-[11px] text-[#94A3B8]">High-priority vibration + audio push with in-app turn-by-turn navigation</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {routes.map((r, i) => (
                <div key={r.id} className={`px-5 py-3 ${i < routes.length - 1 ? "border-b border-black/5" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-bold text-stone-900">{r.id}</span>
                      <span className="text-[11px] text-stone-500">{r.alert}</span>
                      <span className="rounded-full bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">{r.tanod}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[11px] text-stone-500">
                        <Navigation size={11} className="text-[#0038A8]" />
                        {r.distance}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-700">
                        <Timer size={11} className="text-emerald-500" />
                        {r.eta}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${r.status === "en_route" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {r.status === "en_route" ? "En Route" : "On Scene"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {ROUTE_STEPS.map((s, j) => (
                      <span key={j} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] ${j === 0 ? "border-[#0038A8]/20 bg-[#0038A8]/5 text-[#0038A8]" : "border-stone-200 bg-white text-stone-500"}`}>
                        <Navigation size={9} />
                        {s.text}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">On-Duty Tanod Coverage</h3>
                  <p className="text-[11px] text-[#94A3B8]">Nearest responders for routing</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 px-5 pb-5">
              {ON_DUTY_TANODS.map((t) => (
                <div key={t.id} className={`flex items-center justify-between rounded-lg border px-3.5 py-3 ${t.availability === "available" ? "border-stone-200 bg-white" : "border-sky-200 bg-sky-50/60"}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                      {t.name.replace("Team ", "")}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-stone-900">{t.name}</p>
                      <p className="text-[10px] text-stone-400">{t.members} members · {t.purok}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${t.availability === "available" ? "bg-emerald-50 text-emerald-600" : "bg-sky-100 text-sky-700"}`}>
                    {t.availability === "available" ? <CheckCircle2 size={9} /> : <Navigation size={9} />}
                    {t.availability === "available" ? "Available" : "Dispatched"}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Zap size={12} className="text-[#0038A8]" />
                <p className="text-[10px] text-stone-500">High-priority vibration + audio push fired on assignment</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AlertPopUp
        alert={popAlert}
        onDispatch={() => setDispatchAlert(popAlert)}
        onBroadcast={() => popAlert && requestBroadcast(popAlert)}
        onClose={() => setPopAlert(null)}
      />

      {dispatchAlert && (
        <DispatchModal
          alert={dispatchAlert}
          onClose={() => setDispatchAlert(null)}
          onConfirm={(teamId) => confirmDispatch(dispatchAlert, teamId)}
        />
      )}

      {authBroadcast && (
        <CaptainAuthModal
          broadcast={authBroadcast}
          onClose={() => setAuthBroadcast(null)}
          onApprove={approveBroadcast}
        />
      )}

      {sentBroadcast && (
        <ConfirmModal
          type="success"
          title="Broadcast Approved &amp; Sent"
          message={`${sentBroadcast.id} — simultaneous SMS + loud push delivered to ${sentBroadcast.residents} residents inside the ${sentBroadcast.target}. Roll-call overlay now active.`}
          onClose={() => setSentBroadcast(null)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
