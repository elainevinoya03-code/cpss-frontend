// IoT Alert Command Center — Real-time telemetry ingestion, ESP32 sensor monitoring,
// alert clustering, lifecycle management, cascading mass broadcast, and field dispatch.

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Wifi,
  WifiOff,
  Radio,
  Zap,
  Activity,
  AlertTriangle,
  Siren,
  Shield,
  Megaphone,
  CheckCircle2,
  XCircle,
  MapPin,
  ChevronDown,
  ChevronRight,
  Terminal,
  RefreshCw,
  Layers,
  Info,
  AlertOctagon,
  FileText,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { Modal } from "../components/ui";
import { addIncident } from "./incidentStore";
import {
  getTanods,
  subscribeTanods,
  setTanodStatus,
  type Tanod,
} from "./tanodStore";

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export type DeviceType =
  | "smoke_sensor"
  | "noise_monitor"
  | "motion_detector"
  | "cctv_camera"
  | "gate_sensor"
  | "emergency_button";

export type DeviceHealthStatus =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "critical"
  | "offline";

export interface SensorDevice {
  id: string;
  name: string;
  type: DeviceType;
  purok: string;
  location: string;
  status: "online" | "warning" | "offline";
  value: number;
  threshold: number;
  unit: string;
  batteryPercent: number;
  rssiDbm: number;
  lastSeen: string;
  lat: number;
  lng: number;
}

export type AlertStatus =
  | "open"
  | "acknowledged"
  | "verification_in_progress"
  | "verified"
  | "false_unverified"
  | "dispatched"
  | "broadcasting"
  | "closed";

export interface AlertAuditEntry {
  fromStatus: AlertStatus;
  toStatus: AlertStatus;
  note?: string;
  userId: string;
  timestamp: string;
}

export interface SensorAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  purok: string;
  value: number;
  threshold: number;
  unit: string;
  severity: "critical" | "warning" | "emergency";
  status: AlertStatus;
  message: string;
  createdAt: string;
  acknowledgedAt?: string;
  verifiedAt?: string;
  dispatchedAt?: string;
  closedAt?: string;
  alertNote?: string;
  auditTrail: AlertAuditEntry[];
  linkedIncidentId?: string;
  lat: number;
  lng: number;
  isSos?: boolean;
}

export interface AlertCluster {
  id: string;
  area: string;
  alertIds: string[];
  alerts: SensorAlert[];
  firstAlertTime: string;
  lastAlertTime: string;
  severity: "critical" | "warning" | "emergency";
  status: AlertStatus;
}

export interface FieldRoute {
  id: string;
  alertId: string;
  incidentId?: string;
  tanodId: string;
  tanodName: string;
  destination: string;
  distanceMeters: number;
  etaMinutes: number;
  status: "en_route" | "on_scene" | "completed";
  steps: string[];
  dispatchedAt: string;
}

export interface MassBroadcastItem {
  id: string;
  alertId?: string;
  targetPurok: string;
  severity: string;
  channel: "push" | "push_sms";
  message: string;
  residentCount: number;
  status: "pending_approval" | "sent" | "cancelled";
  createdAt: string;
  sentAt?: string;
}

export type RollCallStatus = "safe" | "needHelp" | "notSure" | "unable";

export interface ResidentRollCall {
  id: string;
  name: string;
  phone: string;
  purok: string;
  lat: number;
  lng: number;
  status: RollCallStatus | "noResponse";
  lastPing: string;
  reminderSent: boolean;
  dispatchedForHelp?: boolean;
}

// ---------------------------------------------------------------------------
// Constants & Metadata
// ---------------------------------------------------------------------------

export const ALERT_STATUS_META: Record<
  AlertStatus,
  { label: string; chip: string; dot: string }
> = {
  open: { label: "Open (Triggered)", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  verification_in_progress: {
    label: "Verifying Telemetry",
    chip: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-400",
  },
  verified: { label: "Verified Confirmed", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  false_unverified: {
    label: "False / Unverified",
    chip: "bg-stone-100 text-stone-600",
    dot: "bg-stone-400",
  },
  dispatched: { label: "Field Dispatched", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  broadcasting: { label: "Mass Broadcasting", chip: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  closed: { label: "Resolved & Closed", chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
};

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  smoke_sensor: "Optical Smoke Detector",
  noise_monitor: "Acoustic Decibel Sensor",
  motion_detector: "PIR Motion Sensor",
  cctv_camera: "Smart CCTV Node",
  gate_sensor: "Barrier Gate Sensor",
  emergency_button: "Physical Panic Button",
};

// Initial simulated sensor fleet
const INITIAL_SENSORS: SensorDevice[] = [
  {
    id: "SM-GATE-01",
    name: "Main Entrance Smoke Node",
    type: "smoke_sensor",
    purok: "Purok 1",
    location: "Barangay Main Gate Highway Junction",
    status: "online",
    value: 512,
    threshold: 500,
    unit: "ppm",
    batteryPercent: 88,
    rssiDbm: -62,
    lastSeen: new Date().toISOString(),
    lat: 14.712,
    lng: 121.015,
  },
  {
    id: "SM-PLAZA-02",
    name: "Plaza Pavilion Smoke Sensor",
    type: "smoke_sensor",
    purok: "Purok 2",
    location: "Covered Court & Plaza Canopy",
    status: "online",
    value: 95,
    threshold: 500,
    unit: "ppm",
    batteryPercent: 94,
    rssiDbm: -55,
    lastSeen: new Date().toISOString(),
    lat: 14.714,
    lng: 121.017,
  },
  {
    id: "DB-HALL-01",
    name: "Hall Complex Noise Monitor",
    type: "noise_monitor",
    purok: "Purok 4",
    location: "Barangay Hall Multi-Purpose Wing",
    status: "warning",
    value: 82,
    threshold: 85,
    unit: "dB",
    batteryPercent: 42,
    rssiDbm: -78,
    lastSeen: new Date().toISOString(),
    lat: 14.711,
    lng: 121.018,
  },
  {
    id: "SM-PUROK3-01",
    name: "Market Perimeter Smoke Node",
    type: "smoke_sensor",
    purok: "Purok 3",
    location: "Purok 3 Public Market South Gate",
    status: "offline",
    value: 0,
    threshold: 500,
    unit: "ppm",
    batteryPercent: 12,
    rssiDbm: -95,
    lastSeen: new Date(Date.now() - 15 * 60_000).toISOString(),
    lat: 14.71,
    lng: 121.013,
  },
  {
    id: "DB-MARKET-01",
    name: "Market Alley Acoustic Node",
    type: "noise_monitor",
    purok: "Purok 6",
    location: "Wet Market Center Aisle",
    status: "online",
    value: 64,
    threshold: 85,
    unit: "dB",
    batteryPercent: 79,
    rssiDbm: -68,
    lastSeen: new Date().toISOString(),
    lat: 14.709,
    lng: 121.02,
  },
  {
    id: "SM-CHAPEL-01",
    name: "Chapel Community Smoke Sensor",
    type: "smoke_sensor",
    purok: "Purok 5",
    location: "St. Jude Chapel Annex",
    status: "online",
    value: 45,
    threshold: 500,
    unit: "ppm",
    batteryPercent: 91,
    rssiDbm: -59,
    lastSeen: new Date().toISOString(),
    lat: 14.707,
    lng: 121.012,
  },
];

// Initial seeded alerts
const INITIAL_ALERTS: SensorAlert[] = [
  {
    id: "ALT-118",
    deviceId: "SM-GATE-01",
    deviceName: "Main Entrance Smoke Node",
    deviceType: "smoke_sensor",
    purok: "Purok 1",
    value: 512,
    threshold: 500,
    unit: "ppm",
    severity: "critical",
    status: "open",
    message: "Smoke concentration (512 ppm) exceeded safety limit of 500 ppm.",
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    lat: 14.712,
    lng: 121.015,
    auditTrail: [
      {
        fromStatus: "open",
        toStatus: "open",
        note: "Triggered automatically by ESP32 optical sensor breach.",
        userId: "System / MQTT-Gateway",
        timestamp: new Date(Date.now() - 4 * 60_000).toISOString(),
      },
    ],
  },
  {
    id: "ALT-119",
    deviceId: "DB-HALL-01",
    deviceName: "Hall Complex Noise Monitor",
    deviceType: "noise_monitor",
    purok: "Purok 4",
    value: 82,
    threshold: 85,
    unit: "dB",
    severity: "warning",
    status: "acknowledged",
    message: "Elevated decibel readings sustained near barangay hall complex.",
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    lat: 14.711,
    lng: 121.018,
    auditTrail: [
      {
        fromStatus: "open",
        toStatus: "acknowledged",
        note: "Desk Officer acknowledged potential hall event spillover.",
        userId: "D.O. Ramos",
        timestamp: new Date(Date.now() - 8 * 60_000).toISOString(),
      },
    ],
  },
];

// Sample simulated residents for roll call
const INITIAL_ROLL_CALL: ResidentRollCall[] = [
  { id: "res-1", name: "Corazon Aquino", phone: "+63 917 123 4567", purok: "Purok 1", lat: 14.7122, lng: 121.0152, status: "safe", lastPing: "1m ago", reminderSent: false },
  { id: "res-2", name: "Rodrigo Duterte", phone: "+63 918 234 5678", purok: "Purok 1", lat: 14.7119, lng: 121.0148, status: "needHelp", lastPing: "2m ago", reminderSent: false },
  { id: "res-3", name: "Maria Lourdes Sereno", phone: "+63 919 345 6789", purok: "Purok 1", lat: 14.7125, lng: 121.0156, status: "notSure", lastPing: "3m ago", reminderSent: false },
  { id: "res-4", name: "Benigno Ramos", phone: "+63 920 456 7890", purok: "Purok 1", lat: 14.7115, lng: 121.016, status: "noResponse", lastPing: "Never", reminderSent: false },
  { id: "res-5", name: "Elena Bautista", phone: "+63 921 567 8901", purok: "Purok 1", lat: 14.7128, lng: 121.0145, status: "unable", lastPing: "4m ago", reminderSent: false },
  { id: "res-6", name: "Felipe Calderon", phone: "+63 922 678 9012", purok: "Purok 1", lat: 14.7112, lng: 121.0155, status: "safe", lastPing: "30s ago", reminderSent: false },
];

// Compute device health status
function computeDeviceHealth(d: SensorDevice): DeviceHealthStatus {
  if (d.status === "offline") return "offline";
  if (d.batteryPercent < 15 || d.rssiDbm < -90) return "critical";
  if (d.batteryPercent < 30 || d.rssiDbm < -80) return "poor";
  if (d.batteryPercent < 60 || d.rssiDbm < -70) return "fair";
  if (d.batteryPercent < 85) return "good";
  return "excellent";
}

const HEALTH_META: Record<DeviceHealthStatus, { label: string; badge: string }> = {
  excellent: { label: "Excellent", badge: "bg-emerald-100 text-emerald-700" },
  good: { label: "Good", badge: "bg-teal-100 text-teal-700" },
  fair: { label: "Fair", badge: "bg-amber-100 text-amber-700" },
  poor: { label: "Degraded", badge: "bg-orange-100 text-orange-700" },
  critical: { label: "Critical Risk", badge: "bg-rose-100 text-rose-700" },
  offline: { label: "Device Offline", badge: "bg-stone-200 text-stone-600" },
};

// ---------------------------------------------------------------------------
// Main Component: IotAlertCommandCenter
// ---------------------------------------------------------------------------

export default function IotAlertCommandCenter() {
  const { flash } = useToast();
  const { beep } = useAlertSound();

  // State
  const [sensors, setSensors] = useState<SensorDevice[]>(INITIAL_SENSORS);
  const [alerts, setAlerts] = useState<SensorAlert[]>(INITIAL_ALERTS);
  const [selectedAlert, setSelectedAlert] = useState<SensorAlert | null>(null);
  const [activePopupAlert, setActivePopupAlert] = useState<SensorAlert | null>(null);
  const [mqttLogs, setMqttLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] MQTT Broker connected: tls://iot.barangay.gov.ph:8883`,
    `[${new Date().toLocaleTimeString()}] Subscribed to topic: sensors/+/telemetry`,
    `[${new Date().toLocaleTimeString()}] Subscribed to topic: sensors/+/alert`,
  ]);

  // Modals
  const [falseReasonModalAlert, setFalseReasonModalAlert] = useState<SensorAlert | null>(null);
  const [dispatchAlert, setDispatchAlert] = useState<SensorAlert | null>(null);
  const [broadcastAlert, setBroadcastAlert] = useState<SensorAlert | null>(null);
  const [createIncidentAlert, setCreateIncidentAlert] = useState<SensorAlert | null>(null);
  const [captainAuthBroadcast, setCaptainAuthBroadcast] = useState<MassBroadcastItem | null>(null);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  // Field Routing & Broadcast Queues
  const [routes, setRoutes] = useState<FieldRoute[]>([
    {
      id: "R-221",
      alertId: "ALT-118",
      tanodId: "t1",
      tanodName: "Team Alpha",
      destination: "Purok 1 Gate (SM-GATE-01)",
      distanceMeters: 450,
      etaMinutes: 3,
      status: "en_route",
      steps: ["Departing Barangay Hall Plaza", "Turn right onto Rizal Ave", "Arriving at Main Gate Perimeter"],
      dispatchedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    },
  ]);

  const [broadcastQueue, setBroadcastQueue] = useState<MassBroadcastItem[]>([
    {
      id: "BC-081",
      alertId: "ALT-118",
      targetPurok: "Purok 1",
      severity: "High",
      channel: "push_sms",
      message: "URGENT SAFETY ALERT: Smoke detection at Main Gate (Purok 1). Responders en route. Avoid gate perimeter.",
      residentCount: 342,
      status: "pending_approval",
      createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
  ]);

  const [rollCallResidents, setRollCallResidents] = useState<ResidentRollCall[]>(INITIAL_ROLL_CALL);
  const [showRollCallModal, setShowRollCallModal] = useState(false);

  // Guard refs for triggers
  const triggeredRef = useRef<Set<string>>(new Set(["SM-GATE-01", "DB-HALL-01"]));
  const sosTriggeredRef = useRef(false);

  // Live Tanods
  const [tanods, setLocalTanods] = useState<Tanod[]>(() => getTanods());
  useEffect(() => {
    return subscribeTanods(() => setLocalTanods([...getTanods()]));
  }, []);

  // Telemetry simulation & MQTT stream timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSensors((prev) =>
        prev.map((s) => {
          if (s.status === "offline") return s;
          // Random slight fluctuation
          const jitter = s.type === "smoke_sensor" ? Math.floor(Math.random() * 9) - 4 : Math.floor(Math.random() * 5) - 2;
          const nextVal = Math.max(10, s.value + jitter);
          const isBreach = nextVal >= s.threshold;
          const status = isBreach ? "warning" : "online";

          // If threshold crossed and not triggered yet
          if (isBreach && !triggeredRef.current.has(s.id)) {
            triggeredRef.current.add(s.id);
            const newAlert: SensorAlert = {
              id: `ALT-${Math.floor(120 + Math.random() * 800)}`,
              deviceId: s.id,
              deviceName: s.name,
              deviceType: s.type,
              purok: s.purok,
              value: nextVal,
              threshold: s.threshold,
              unit: s.unit,
              severity: "critical",
              status: "open",
              message: `${s.name} crossed safety threshold (${nextVal} ${s.unit} >= ${s.threshold} ${s.unit}).`,
              createdAt: new Date().toISOString(),
              lat: s.lat,
              lng: s.lng,
              auditTrail: [
                {
                  fromStatus: "open",
                  toStatus: "open",
                  note: "Threshold breach detected via live telemetry stream.",
                  userId: "System / MQTT-Gateway",
                  timestamp: new Date().toISOString(),
                },
              ],
            };
            setAlerts((a) => [newAlert, ...a]);
            setActivePopupAlert(newAlert);
            beep("info");
            flash(`New sensor alert triggered on ${s.id}!`, { title: "Telemetry Breach" });
          }

          return {
            ...s,
            value: nextVal,
            status,
            lastSeen: new Date().toISOString(),
          };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [flash, beep]);

  // Periodic MQTT stream logging
  useEffect(() => {
    const mqttTimer = setInterval(() => {
      setSensors((currentSensors) => {
        const randomSensor = currentSensors[Math.floor(Math.random() * currentSensors.length)];
        if (!randomSensor) return currentSensors;
        const logLine =
          randomSensor.status === "offline"
            ? `[${new Date().toLocaleTimeString()}] sensors/${randomSensor.id}/telemetry: NO RESPONSE (rssi=-999, status=TIMEOUT)`
            : `[${new Date().toLocaleTimeString()}] sensors/${randomSensor.id}/telemetry: {"val":${randomSensor.value},"unit":"${randomSensor.unit}","bat":${randomSensor.batteryPercent},"rssi":${randomSensor.rssiDbm}}`;

        setMqttLogs((prev) => [logLine, ...prev.slice(0, 40)]);
        return currentSensors;
      });
    }, 2500);

    return () => clearInterval(mqttTimer);
  }, []);

  // SOS Distress event trigger ~9 seconds after mount
  useEffect(() => {
    const sosTimer = setTimeout(() => {
      if (sosTriggeredRef.current) return;
      sosTriggeredRef.current = true;

      const sosAlert: SensorAlert = {
        id: "SOS-043",
        deviceId: "SOS-PUROK3-MARKET",
        deviceName: "Citizen Panic / SOS Terminal #03",
        deviceType: "emergency_button",
        purok: "Purok 3",
        value: 100,
        threshold: 1,
        unit: "SIG",
        severity: "emergency",
        status: "open",
        message: "EMERGENCY SOS: Physical panic beacon activated at Market Zone. Immediate response required!",
        createdAt: new Date().toISOString(),
        lat: 14.71,
        lng: 121.013,
        isSos: true,
        auditTrail: [
          {
            fromStatus: "open",
            toStatus: "open",
            note: "Instant distress beacon signal verified at hardware layer.",
            userId: "Emergency-Relay-Daemon",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      setAlerts((prev) => [sosAlert, ...prev]);
      setActivePopupAlert(sosAlert);
      beep("critical");
      flash("EMERGENCY SOS SIGNAL RECEIVED AT PUROK 3 MARKET ZONE!", {
        title: "CRITICAL SOS ALERT",
      });
    }, 9000);

    return () => clearTimeout(sosTimer);
  }, [flash, beep]);

  // Force Ping handler
  const handleForcePing = () => {
    const timestamp = new Date().toLocaleTimeString();
    const pingLog = `[${timestamp}] CMD: PING sent to all 6 gateway nodes... ALL NODES ACKNOWLEDGED (latency: 14ms)`;
    setMqttLogs((prev) => [pingLog, ...prev]);
    flash("Gateway ping broadcasted to all sensor nodes. 6/6 ACKs received.", {
      title: "Telemetry Ping Confirmed",
    });
  };

  // Alert Clusters Builder (§6.5.6)
  // Groups alerts by same device (10m) or same area (15m)
  const clusters = useMemo(() => {
    const grouped: Record<string, SensorAlert[]> = {};
    alerts.forEach((alert) => {
      const key = `${alert.purok}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(alert);
    });

    const list: AlertCluster[] = [];
    Object.entries(grouped).forEach(([purok, groupAlerts], idx) => {
      const sorted = [...groupAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const isCritical = sorted.some((a) => a.severity === "emergency" || a.severity === "critical");
      list.push({
        id: `CL-${String(idx + 1).padStart(3, "0")}`,
        area: purok,
        alertIds: sorted.map((a) => a.id),
        alerts: sorted,
        firstAlertTime: sorted[sorted.length - 1].createdAt,
        lastAlertTime: sorted[0].createdAt,
        severity: isCritical ? "critical" : "warning",
        status: sorted[0].status,
      });
    });

    return list;
  }, [alerts]);

  // KPIs
  const totalSensors = sensors.length;
  const onlineSensors = sensors.filter((s) => s.status !== "offline").length;
  const sensorsNeedingAttention = sensors.filter(
    (s) => s.status === "warning" || s.status === "offline" || s.batteryPercent < 25
  ).length;

  const openAlertsCount = alerts.filter((a) => a.status === "open").length;
  const sosAlertsCount = alerts.filter((a) => a.isSos && a.status !== "closed").length;
  const broadcastsQueuedCount = broadcastQueue.filter((b) => b.status === "pending_approval").length;
  const activeRoutesCount = routes.filter((r) => r.status === "en_route").length;
  const devicesInAlertCount = sensors.filter((s) => s.status !== "online").length;

  // Status transition helper
  const transitionAlertStatus = (
    alertId: string,
    newStatus: AlertStatus,
    note?: string
  ) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== alertId) return a;
        const entry: AlertAuditEntry = {
          fromStatus: a.status,
          toStatus: newStatus,
          note: note || `Status transitioned to ${newStatus}`,
          userId: "D.O. Ramos",
          timestamp: new Date().toISOString(),
        };
        const updated = {
          ...a,
          status: newStatus,
          alertNote: note ?? a.alertNote,
          acknowledgedAt: newStatus === "acknowledged" ? new Date().toISOString() : a.acknowledgedAt,
          verifiedAt: newStatus === "verified" ? new Date().toISOString() : a.verifiedAt,
          dispatchedAt: newStatus === "dispatched" ? new Date().toISOString() : a.dispatchedAt,
          closedAt: newStatus === "closed" ? new Date().toISOString() : a.closedAt,
          auditTrail: [entry, ...a.auditTrail],
        };
        if (selectedAlert?.id === alertId) setSelectedAlert(updated);
        return updated;
      })
    );
  };

  // Roll-Call Handlers
  const handleRollCallRemind = (resId: string) => {
    setRollCallResidents((prev) =>
      prev.map((r) => (r.id === resId ? { ...r, reminderSent: true, lastPing: "Just now" } : r))
    );
    flash("High-priority SMS & In-app reminder re-sent to citizen.", {
      title: "Reminder Dispatched",
    });
  };

  const handleRollCallTanodDispatch = (res: ResidentRollCall) => {
    setRollCallResidents((prev) =>
      prev.map((r) => (r.id === res.id ? { ...r, dispatchedForHelp: true } : r))
    );
    // Find available Tanod
    const avail = tanods.find((t) => t.status === "available") || tanods[0];
    const newRoute: FieldRoute = {
      id: `R-${Math.floor(230 + Math.random() * 700)}`,
      alertId: "ROLL-CALL-CHECK",
      tanodId: avail.id,
      tanodName: avail.name,
      destination: `${res.name} — ${res.purok} (GPS: ${res.lat.toFixed(4)}, ${res.lng.toFixed(4)})`,
      distanceMeters: 380,
      etaMinutes: 2,
      status: "en_route",
      steps: ["Direct welfare check assigned", "Navigating to resident GPS coordinates"],
      dispatchedAt: new Date().toISOString(),
    };
    setRoutes((r) => [newRoute, ...r]);
    setTanodStatus(avail.id, "en_route", { assignment: `Welfare check for ${res.name}` });
    flash(`Tanod ${avail.name} dispatched to verify safety of non-responder ${res.name}.`, {
      title: "Welfare Route Created",
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      {/* ------------------------------------------------------------------- */}
      {/* Top Header & Telemetry Status Bar */}
      {/* ------------------------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0038A8] text-white shadow-md shadow-blue-900/10">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-stone-900 tracking-tight">
                  IoT Alert Command Center
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                  Gateway Live
                </span>
                {sosAlertsCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm animate-bounce">
                    <Siren size={12} />
                    {sosAlertsCount} SOS ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Real-time ESP32 edge telemetry, hardware threshold triggers, and cascading emergency dispatches.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRollCallModal(true)}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 shadow-sm"
            >
              <Activity size={14} />
              Resident Roll-Call ({rollCallResidents.filter((r) => r.status === "safe").length}/{rollCallResidents.length} Safe)
            </button>

            <button
              onClick={handleForcePing}
              className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 shadow-sm"
            >
              <RefreshCw size={14} />
              Force Ping Gateway
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* 5 Core Command KPIs */}
      {/* ------------------------------------------------------------------- */}
      <section className="px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* KPI 1 */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Sensors Deployed
              </span>
              <Radio size={16} className="text-[#0038A8]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-stone-900">
                {onlineSensors}/{totalSensors}
              </span>
              <span className="text-xs font-medium text-emerald-600">Online</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              {sensorsNeedingAttention > 0 ? (
                <span className="text-amber-600 font-semibold">{sensorsNeedingAttention} need check</span>
              ) : (
                "All nodes healthy"
              )}
            </p>
          </div>

          {/* KPI 2 */}
          <div
            className={`rounded-xl border p-4 shadow-sm transition ${
              openAlertsCount > 0
                ? "border-rose-300 bg-rose-50/50 ring-2 ring-rose-200 animate-pulse"
                : "border-stone-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Active Alerts
              </span>
              <AlertTriangle size={16} className="text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-700">{openAlertsCount}</span>
              <span className="text-xs font-semibold text-rose-600">Pending Triage</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              {sosAlertsCount > 0 ? `${sosAlertsCount} SOS Distress Signal` : "Hardware threshold triggers"}
            </p>
          </div>

          {/* KPI 3 */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Broadcasts Queued
              </span>
              <Megaphone size={16} className="text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-stone-900">{broadcastsQueuedCount}</span>
              <span className="text-xs font-medium text-purple-600">Captain Gate</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              {broadcastsQueuedCount > 0 ? "Awaiting 1-tap authorization" : "No pending mass alerts"}
            </p>
          </div>

          {/* KPI 4 */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Active Routes
              </span>
              <MapPin size={16} className="text-sky-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-stone-900">{activeRoutesCount}</span>
              <span className="text-xs font-medium text-sky-600">En Route</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-500">Turn-by-turn field dispatches</p>
          </div>

          {/* KPI 5 */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Devices in Alert
              </span>
              <Shield size={16} className="text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-700">{devicesInAlertCount}</span>
              <span className="text-xs font-medium text-amber-600">Threshold Breached</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-500">Smoke / Noise above safety limits</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* Main Command Workspace */}
      {/* ------------------------------------------------------------------- */}
      <main className="flex-1 px-6 pb-10">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* LEFT 2 COLUMNS: Sensors Grid + Clustered Alert Queue */}
          <div className="space-y-6 xl:col-span-2">
            {/* ------------------------------------------------------------- */}
            {/* IoT Telemetry Ingestion Gateway & Sensor Fleet */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-stone-200 px-5 py-3.5 bg-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-[#0038A8]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Live Telemetry Ingestion Fleet (ESP32 Nodes)
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-stone-500">
                  Auto-refreshed every 4s via MQTT stream
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sensors.map((sensor) => {
                  const health = computeDeviceHealth(sensor);
                  const isBreach = sensor.value >= sensor.threshold && sensor.status !== "offline";
                  const pct = Math.min(100, Math.round((sensor.value / (sensor.threshold * 1.2)) * 100));

                  return (
                    <div
                      key={sensor.id}
                      className={`rounded-xl border p-4 transition hover:shadow-md ${
                        sensor.status === "offline"
                          ? "border-stone-200 bg-stone-50 opacity-75"
                          : isBreach
                          ? "border-rose-300 bg-rose-50/40 ring-1 ring-rose-200"
                          : "border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-stone-900">{sensor.id}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${HEALTH_META[health].badge}`}>
                              {HEALTH_META[health].label}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 font-medium truncate max-w-[150px]">
                            {sensor.name}
                          </p>
                        </div>
                        {sensor.status === "offline" ? (
                          <WifiOff size={16} className="text-stone-400" />
                        ) : (
                          <Wifi size={16} className={isBreach ? "text-rose-600 animate-pulse" : "text-emerald-500"} />
                        )}
                      </div>

                      {/* Live Gauge */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] font-semibold text-stone-600 mb-1">
                          <span>Reading: <strong className={isBreach ? "text-rose-600" : "text-stone-900"}>{sensor.value} {sensor.unit}</strong></span>
                          <span className="text-stone-400">Limit: {sensor.threshold} {sensor.unit}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isBreach ? "bg-rose-500" : pct > 60 ? "bg-amber-400" : "bg-emerald-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Device meta footer */}
                      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                        <span>{sensor.purok}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span>Bat: {sensor.batteryPercent}%</span>
                          <span>{sensor.rssiDbm} dBm</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dark MQTT Terminal */}
              <div className="border-t border-stone-200 bg-stone-900 p-4 text-emerald-400 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-emerald-400" />
                    <span className="font-bold text-stone-200">MQTT STREAM (telemetry/+/raw)</span>
                  </div>
                  <span className="text-[10px] text-stone-400">TLS port 8883 • QoS 1</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] scrollbar-thin">
                  {mqttLogs.map((log, i) => (
                    <div key={i} className="truncate text-stone-300">
                      {log.includes("NO RESPONSE") ? (
                        <span className="text-rose-400">{log}</span>
                      ) : log.includes("PING") ? (
                        <span className="text-sky-300">{log}</span>
                      ) : (
                        log
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Clustered Alert Queue (§6.5.6) & Lifecycle Control */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-stone-200 px-5 py-3.5 bg-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-[#0038A8]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Clustered Alert Queue & 8-State Lifecycle
                  </h2>
                </div>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                  {openAlertsCount} open · {clusters.length} clusters
                </span>
              </div>

              <div className="divide-y divide-stone-100">
                {clusters.map((cluster) => {
                  const isExpanded = expandedClusterId === cluster.id;

                  return (
                    <div key={cluster.id} className="p-4 transition hover:bg-stone-50/60">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExpandedClusterId(isExpanded ? null : cluster.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-900">{cluster.id}</span>
                              <span className="rounded bg-[#0038A8]/10 px-2 py-0.5 text-[10px] font-bold text-[#0038A8]">
                                {cluster.area}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                cluster.severity === "emergency"
                                  ? "bg-rose-600 text-white animate-pulse"
                                  : "bg-amber-100 text-amber-700"
                              }`}>
                                {cluster.alerts.length} contributing alerts
                              </span>
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">
                              First alert: {new Date(cluster.firstAlertTime).toLocaleTimeString()} → Latest: {new Date(cluster.lastAlertTime).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedClusterId(isExpanded ? null : cluster.id)}
                            className="text-xs font-semibold text-[#0038A8] hover:underline"
                          >
                            {isExpanded ? "Collapse" : "Expand Alerts"}
                          </button>
                        </div>
                      </div>

                      {/* Contributing Alert Rows */}
                      {isExpanded && (
                        <div className="mt-4 pl-10 space-y-3">
                          {cluster.alerts.map((alert) => {
                            const statusMeta = ALERT_STATUS_META[alert.status];

                            return (
                              <div
                                key={alert.id}
                                className="rounded-lg border border-stone-200 bg-stone-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-stone-900">{alert.id}</span>
                                    <span className="text-xs font-medium text-stone-600">• {alert.deviceName}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusMeta.chip}`}>
                                      {statusMeta.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-stone-700">{alert.message}</p>
                                  <p className="text-[10px] text-stone-400">
                                    Recorded at: {new Date(alert.createdAt).toLocaleString()} (Sensor: {alert.value} {alert.unit})
                                  </p>
                                </div>

                                {/* Per-Alert Lifecycle Actions */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {alert.status === "open" && (
                                    <button
                                      onClick={() => {
                                        transitionAlertStatus(alert.id, "acknowledged", "Acknowledged by Desk Officer.");
                                        flash(`Alert ${alert.id} acknowledged.`, { title: "Status Updated" });
                                      }}
                                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                                    >
                                      Acknowledge
                                    </button>
                                  )}

                                  {alert.status === "acknowledged" && (
                                    <button
                                      onClick={() => {
                                        transitionAlertStatus(alert.id, "verification_in_progress", "Started live sensor reading verification.");
                                        flash(`Verification started on ${alert.id}.`, { title: "Under Verification" });
                                      }}
                                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                    >
                                      Start Verification
                                    </button>
                                  )}

                                  {alert.status === "verification_in_progress" && (
                                    <>
                                      <button
                                        onClick={() => {
                                          transitionAlertStatus(alert.id, "verified", "Sensor reading confirmed real via CCTV/telemetry.");
                                          flash(`Alert ${alert.id} marked verified.`, { title: "Alert Verified" });
                                        }}
                                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                      >
                                        Verify — Confirmed
                                      </button>
                                      <button
                                        onClick={() => setFalseReasonModalAlert(alert)}
                                        className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                                      >
                                        Mark False / Unverified
                                      </button>
                                    </>
                                  )}

                                  {alert.status === "verified" && (
                                    <>
                                      <button
                                        onClick={() => setCreateIncidentAlert(alert)}
                                        className="rounded-lg bg-[#0038A8] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800"
                                      >
                                        Create Incident
                                      </button>
                                      <button
                                        onClick={() => setDispatchAlert(alert)}
                                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                                      >
                                        Dispatch Tanod
                                      </button>
                                      <button
                                        onClick={() => setBroadcastAlert(alert)}
                                        className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                                      >
                                        Broadcast
                                      </button>
                                    </>
                                  )}

                                  {alert.status === "dispatched" && (
                                    <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
                                      Responder En Route
                                    </span>
                                  )}

                                  {alert.status === "broadcasting" && (
                                    <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">
                                      Broadcast Active
                                    </span>
                                  )}

                                  {alert.status !== "closed" && (
                                    <button
                                      onClick={() => setSelectedAlert(alert)}
                                      className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                    >
                                      Details
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Broadcast Queue & Field Hardware Routing */}
          <div className="space-y-6">
            {/* ------------------------------------------------------------- */}
            {/* Cascading Mass Broadcast Engine */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-stone-200 px-5 py-3.5 bg-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-purple-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Cascading Mass Broadcasts
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-purple-700">
                  {broadcastQueue.length} Active in Pipeline
                </span>
              </div>

              <div className="p-4 space-y-3">
                {broadcastQueue.map((bc) => (
                  <div
                    key={bc.id}
                    className={`rounded-xl border p-4 space-y-2 ${
                      bc.status === "pending_approval"
                        ? "border-purple-300 bg-purple-50/40"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{bc.id}</span>
                        <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                          {bc.targetPurok}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase text-stone-500">
                        {bc.channel === "push_sms" ? "Push + SMS" : "Quiet Push"}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 font-medium leading-relaxed">{bc.message}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 text-[11px] text-stone-500">
                      <span>Reach: <strong>{bc.residentCount}</strong> residents</span>
                      {bc.status === "pending_approval" ? (
                        <button
                          onClick={() => setCaptainAuthBroadcast(bc)}
                          className="rounded-lg bg-purple-700 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-purple-800"
                        >
                          Authorize (Captain Gate)
                        </button>
                      ) : (
                        <span className="font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Broadcast Sent
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Field Dispatch & Hardware Routing */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-stone-200 px-5 py-3.5 bg-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-sky-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Field Hardware Routing & Tanods
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-sky-700">
                  {routes.length} Active Routes
                </span>
              </div>

              <div className="p-4 space-y-3">
                {routes.map((route) => (
                  <div key={route.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{route.id}</span>
                        <span className="text-xs font-semibold text-sky-800">{route.tanodName}</span>
                      </div>
                      <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-900">
                        ETA ~{route.etaMinutes}m ({route.distanceMeters}m)
                      </span>
                    </div>

                    <p className="text-xs text-stone-600">
                      Destination: <strong className="text-stone-900">{route.destination}</strong>
                    </p>

                    {/* Steps guidance */}
                    <div className="space-y-1 pt-1">
                      {route.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-stone-600">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-200 text-[9px] font-bold text-sky-800">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRoutes((prev) =>
                            prev.map((r) => (r.id === route.id ? { ...r, status: "on_scene" } : r))
                          );
                          flash(`${route.tanodName} confirmed ON SCENE.`, { title: "Status Updated" });
                        }}
                        className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                      >
                        Mark On Scene
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* On-Duty Tanod Coverage */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  On-Duty Responders
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  {tanods.filter((t) => t.status === "available").length} Available
                </span>
              </div>
              <div className="space-y-2">
                {tanods.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{t.name}</span>
                      <span className="text-stone-400">({t.members} members)</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.status === "available"
                        ? "bg-emerald-100 text-emerald-700"
                        : t.status === "en_route"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-stone-200 text-stone-600"
                    }`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* EmergencyPopUp (Instant Bypass-the-Queue Modal) */}
      {/* ------------------------------------------------------------------- */}
      {activePopupAlert && (
        <Modal
          onClose={() => setActivePopupAlert(null)}
          title={`INSTANT CRITICAL POP-UP: ${activePopupAlert.id}`}
          subtitle={activePopupAlert.deviceName}
          icon={<AlertOctagon size={20} />}
          iconClass="bg-rose-100 text-rose-700"
          size="lg"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                <Siren size={18} className="animate-spin" />
                <span>{activePopupAlert.isSos ? "CITIZEN SOS DISTRESS SIGNAL" : "CRITICAL SENSOR THRESHOLD BREACH"}</span>
              </div>
              <p className="mt-2 text-xs text-rose-900 leading-relaxed font-medium">
                {activePopupAlert.message}
              </p>
              <div className="mt-3 flex gap-4 text-xs text-rose-800">
                <span>Location: <strong>{activePopupAlert.purok}</strong></span>
                <span>Telemetry: <strong>{activePopupAlert.value} {activePopupAlert.unit}</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActivePopupAlert(null)}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Hold / Dismiss
              </button>
              <button
                onClick={() => {
                  const target = activePopupAlert;
                  setActivePopupAlert(null);
                  setDispatchAlert(target);
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-sm"
              >
                Dispatch Tanod Team
              </button>
              <button
                onClick={() => {
                  const target = activePopupAlert;
                  setActivePopupAlert(null);
                  setBroadcastAlert(target);
                }}
                className="rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 shadow-sm"
              >
                Cascade Mass Broadcast
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Alert Detail Panel / Modal */}
      {/* ------------------------------------------------------------------- */}
      {selectedAlert && (
        <Modal
          onClose={() => setSelectedAlert(null)}
          title={`Alert Details — ${selectedAlert.id}`}
          subtitle={selectedAlert.deviceName}
          icon={<Info size={18} />}
          iconClass="bg-blue-100 text-[#0038A8]"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-stone-200 p-3 bg-stone-50">
                <span className="text-[10px] uppercase font-bold text-stone-400">Device ID / Type</span>
                <p className="font-semibold text-stone-900 mt-0.5">{selectedAlert.deviceId} ({DEVICE_TYPE_LABELS[selectedAlert.deviceType]})</p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3 bg-stone-50">
                <span className="text-[10px] uppercase font-bold text-stone-400">Location / Purok</span>
                <p className="font-semibold text-stone-900 mt-0.5">{selectedAlert.purok} (Lat: {selectedAlert.lat}, Lng: {selectedAlert.lng})</p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3 bg-stone-50">
                <span className="text-[10px] uppercase font-bold text-stone-400">Telemetry Value vs Threshold</span>
                <p className="font-bold text-rose-600 mt-0.5">{selectedAlert.value} {selectedAlert.unit} (Limit: {selectedAlert.threshold} {selectedAlert.unit})</p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3 bg-stone-50">
                <span className="text-[10px] uppercase font-bold text-stone-400">Current Status</span>
                <p className="font-bold text-stone-900 mt-0.5 capitalize">{selectedAlert.status.replace("_", " ")}</p>
              </div>
            </div>

            {/* Audit Trail */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                Audit Trail & Officer Notes
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-stone-200 p-3 bg-white text-xs">
                {selectedAlert.auditTrail.map((audit, i) => (
                  <div key={i} className="border-b border-stone-100 pb-2 last:border-0">
                    <div className="flex justify-between text-[10px] text-stone-400">
                      <span>{audit.userId}</span>
                      <span>{new Date(audit.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-stone-800 mt-0.5 font-medium">{audit.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Dispatch Modal */}
      {/* ------------------------------------------------------------------- */}
      {dispatchAlert && (
        <Modal
          onClose={() => setDispatchAlert(null)}
          title={`Field Dispatch for ${dispatchAlert.id}`}
          subtitle={`Target: ${dispatchAlert.purok} (${dispatchAlert.deviceName})`}
          icon={<MapPin size={18} />}
          iconClass="bg-sky-100 text-sky-700"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Select an available Tanod team. High-priority audio alarm and vibration will fire to the team's terminal.
            </p>

            <div className="space-y-2">
              {tanods
                .filter((t) => t.status === "available")
                .map((tanod) => (
                  <div
                    key={tanod.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:bg-stone-50"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{tanod.name}</h4>
                      <p className="text-[11px] text-stone-500">{tanod.members} members • Stationed near {tanod.purok}</p>
                    </div>
                    <button
                      onClick={() => {
                        const newRoute: FieldRoute = {
                          id: `R-${Math.floor(220 + Math.random() * 700)}`,
                          alertId: dispatchAlert.id,
                          tanodId: tanod.id,
                          tanodName: tanod.name,
                          destination: `${dispatchAlert.purok} (${dispatchAlert.deviceName})`,
                          distanceMeters: 420,
                          etaMinutes: 3,
                          status: "en_route",
                          steps: [
                            "Depart from post",
                            `Turn onto main road towards ${dispatchAlert.purok}`,
                            "Establish perimeter around sensor node",
                          ],
                          dispatchedAt: new Date().toISOString(),
                        };
                        setRoutes((prev) => [newRoute, ...prev]);
                        setTanodStatus(tanod.id, "en_route", {
                          assignment: `Responding to ${dispatchAlert.id}`,
                        });
                        transitionAlertStatus(dispatchAlert.id, "dispatched", `Dispatched ${tanod.name} to scene.`);
                        flash(`${tanod.name} dispatched! High-priority notification fired.`, {
                          title: "Dispatch Confirmed",
                        });
                        setDispatchAlert(null);
                      }}
                      className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
                    >
                      Dispatch Now
                    </button>
                  </div>
                ))}
              {tanods.filter((t) => t.status === "available").length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                  No Tanod teams currently marked available. Please reassign an existing en-route unit.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* False Reason Modal */}
      {/* ------------------------------------------------------------------- */}
      {falseReasonModalAlert && (
        <Modal
          onClose={() => setFalseReasonModalAlert(null)}
          title={`Mark False / Unverified: ${falseReasonModalAlert.id}`}
          icon={<XCircle size={18} />}
          iconClass="bg-stone-100 text-stone-600"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Please enter an official explanation for why this sensor reading was determined to be false or unverified:
            </p>
            <textarea
              id="falseReasonText"
              rows={3}
              placeholder="e.g. Cooking smoke at adjacent kitchen, confirmed no fire hazard."
              className="w-full rounded-lg border border-stone-300 p-2.5 text-xs focus:border-[#0038A8] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFalseReasonModalAlert(null)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = (document.getElementById("falseReasonText") as HTMLTextAreaElement)?.value || "Marked false alarm.";
                  transitionAlertStatus(falseReasonModalAlert.id, "false_unverified", input);
                  flash(`Alert ${falseReasonModalAlert.id} closed as false/unverified.`, { title: "Alert Updated" });
                  setFalseReasonModalAlert(null);
                }}
                className="rounded-lg bg-stone-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800"
              >
                Confirm False / Unverified
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Create Incident Modal */}
      {/* ------------------------------------------------------------------- */}
      {createIncidentAlert && (
        <Modal
          onClose={() => setCreateIncidentAlert(null)}
          title={`Create Incident from ${createIncidentAlert.id}`}
          icon={<FileText size={18} />}
          iconClass="bg-blue-100 text-[#0038A8]"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Spawn a formal barangay incident ticket linked to this sensor detection:
            </p>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Category</label>
              <select id="incCat" className="w-full rounded-lg border border-stone-300 p-2 text-xs">
                <option value="Fire or Smoke">Fire or Smoke</option>
                <option value="Noise Disturbance">Noise Disturbance</option>
                <option value="Hazard or Obstruction">Hazard or Obstruction</option>
                <option value="Public Disturbance">Public Disturbance</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Description</label>
              <input
                id="incDesc"
                defaultValue={createIncidentAlert.message}
                className="w-full rounded-lg border border-stone-300 p-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateIncidentAlert(null)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cat = (document.getElementById("incCat") as HTMLSelectElement).value;
                  const desc = (document.getElementById("incDesc") as HTMLInputElement).value;
                  const newInc = addIncident({
                    category: cat,
                    purok: createIncidentAlert.purok,
                    severity: createIncidentAlert.severity === "emergency" ? "critical" : createIncidentAlert.severity,
                    priority: "High",
                    status: "new",
                    source: "iot",
                    reporter: createIncidentAlert.deviceName,
                    description: desc,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    photos: 0,
                    lat: createIncidentAlert.lat,
                    lng: createIncidentAlert.lng,
                    relatedAlertId: createIncidentAlert.id,
                    verificationStatus: "verified",
                  });
                  transitionAlertStatus(createIncidentAlert.id, "verified", `Spawned official incident ticket ${newInc.id}`);
                  flash(`Incident ${newInc.id} spawned from ${createIncidentAlert.id}!`, { title: "Incident Created" });
                  setCreateIncidentAlert(null);
                }}
                className="rounded-lg bg-[#0038A8] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
              >
                Generate Ticket
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Broadcast Compose Modal */}
      {/* ------------------------------------------------------------------- */}
      {broadcastAlert && (
        <Modal
          onClose={() => setBroadcastAlert(null)}
          title={`Draft Emergency Broadcast — ${broadcastAlert.purok}`}
          icon={<Megaphone size={18} />}
          iconClass="bg-purple-100 text-purple-700"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Severity-based routing: High severity requires Captain 1-tap approval before simultaneous cellular SMS + persistent push is pushed.
            </p>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Message Text</label>
              <textarea
                id="bcMsg"
                rows={3}
                defaultValue={`SAFETY ALERT: Sensor breach detected in ${broadcastAlert.purok}. Responders are on the way. Please stay clear.`}
                className="w-full rounded-lg border border-stone-300 p-2.5 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBroadcastAlert(null)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const msg = (document.getElementById("bcMsg") as HTMLTextAreaElement).value;
                  const newItem: MassBroadcastItem = {
                    id: `BC-${Math.floor(100 + Math.random() * 800)}`,
                    alertId: broadcastAlert.id,
                    targetPurok: broadcastAlert.purok,
                    severity: "High",
                    channel: "push_sms",
                    message: msg,
                    residentCount: 420,
                    status: "pending_approval",
                    createdAt: new Date().toISOString(),
                  };
                  setBroadcastQueue((prev) => [newItem, ...prev]);
                  transitionAlertStatus(broadcastAlert.id, "broadcasting", `Queued mass broadcast ${newItem.id} for Captain gate.`);
                  flash(`Broadcast ${newItem.id} queued for Captain Authorization.`, { title: "Broadcast Queued" });
                  setBroadcastAlert(null);
                }}
                className="rounded-lg bg-purple-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-800"
              >
                Queue for Authorization
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Captain 1-Tap Auth Modal */}
      {/* ------------------------------------------------------------------- */}
      {captainAuthBroadcast && (
        <Modal
          onClose={() => setCaptainAuthBroadcast(null)}
          title={`Captain Authorization Required: ${captainAuthBroadcast.id}`}
          icon={<Shield size={18} />}
          iconClass="bg-purple-100 text-purple-700"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <p className="font-bold text-purple-900">Broadcast Target: {captainAuthBroadcast.targetPurok}</p>
              <p className="text-purple-800 mt-1">{captainAuthBroadcast.message}</p>
              <p className="text-[11px] text-purple-600 mt-2">
                Estimated Blast Radius: <strong>{captainAuthBroadcast.residentCount}</strong> cellular SMS & In-app pushes.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCaptainAuthBroadcast(null)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Keep Queued
              </button>
              <button
                onClick={() => {
                  setBroadcastQueue((prev) =>
                    prev.map((b) =>
                      b.id === captainAuthBroadcast.id
                        ? { ...b, status: "sent", sentAt: new Date().toISOString() }
                        : b
                    )
                  );
                  flash(`Broadcast ${captainAuthBroadcast.id} APPROVED & TRANSMITTED to ${captainAuthBroadcast.residentCount} citizens!`, {
                    title: "Broadcast Live",
                  });
                  setCaptainAuthBroadcast(null);
                  setShowRollCallModal(true);
                }}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                Approve & Transmit Now
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Resident Roll-Call Overlay Modal (§6.5.13) */}
      {/* ------------------------------------------------------------------- */}
      {showRollCallModal && (
        <Modal
          onClose={() => setShowRollCallModal(false)}
          title="Active Citizen Safety Roll-Call"
          subtitle="4-State Safety Acknowledgment (Safe / Need Help / Not Sure / Unable to Respond)"
          icon={<Activity size={18} />}
          iconClass="bg-purple-100 text-purple-700"
          size="xl"
        >
          <div className="space-y-4">
            {/* 4-bucket response breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Safe</span>
                <p className="text-xl font-black text-emerald-800 mt-1">
                  {rollCallResidents.filter((r) => r.status === "safe").length}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Need Help</span>
                <p className="text-xl font-black text-rose-800 mt-1">
                  {rollCallResidents.filter((r) => r.status === "needHelp").length}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Not Sure</span>
                <p className="text-xl font-black text-amber-800 mt-1">
                  {rollCallResidents.filter((r) => r.status === "notSure").length}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-100 p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">No Response</span>
                <p className="text-xl font-black text-stone-800 mt-1">
                  {rollCallResidents.filter((r) => r.status === "noResponse" || r.status === "unable").length}
                </p>
              </div>
            </div>

            {/* Non-Responders & Need Help List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Actionable Resident Roster
              </h4>
              <div className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white overflow-hidden text-xs">
                {rollCallResidents.map((res) => (
                  <div key={res.id} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{res.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          res.status === "safe"
                            ? "bg-emerald-100 text-emerald-700"
                            : res.status === "needHelp"
                            ? "bg-rose-600 text-white animate-pulse"
                            : res.status === "notSure"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-stone-200 text-stone-600"
                        }`}>
                          {res.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">{res.phone} • {res.purok} (GPS: {res.lat.toFixed(4)}, {res.lng.toFixed(4)})</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {res.status !== "safe" && (
                        <>
                          <button
                            onClick={() => handleRollCallRemind(res.id)}
                            disabled={res.reminderSent}
                            className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                          >
                            {res.reminderSent ? "Reminder Sent" : "Remind (SMS/Push)"}
                          </button>
                          <button
                            onClick={() => handleRollCallTanodDispatch(res)}
                            disabled={res.dispatchedForHelp}
                            className="rounded bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                          >
                            {res.dispatchedForHelp ? "Tanod Dispatched" : "Dispatch Tanod Check"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}