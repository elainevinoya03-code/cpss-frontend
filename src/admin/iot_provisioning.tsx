import React, { useState, useRef } from "react";
import {
  Cpu,
  MapPin,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Radio,
  Pencil,
  Power,
  Save,
  Activity,
  AudioLines,
  KeyRound,
  ShieldX,
  Clock,
  Info,
  Archive,
  XCircle,
  RefreshCw,
  CircuitBoard,
  Barcode,
  Landmark,
  Network,
  Scale,
  BatteryCharging,
  CalendarDays,
  Globe,
  Factory,
} from "lucide-react";
import { batteryColor, signalColor } from "../utils/colors";
import { PUROK_OPTIONS } from "../constants/purok";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";

type DeviceStatus = "pending" | "online" | "offline";
type CredentialStatus = "active" | "revoked" | "not_provisioned";
type CalibrationStatus = "not_calibrated" | "calibrated";

interface Device {
  id: string;
  name: string;
  type: string;
  sensorModule: string;
  controller: string;
  serialNumber: string;
  mac: string;
  firmware: string;
  purok: string;
  barangay: string;
  location: string;
  lat: string;
  lng: string;
  status: DeviceStatus;
  battery: number;
  signal: number;
  lastPing: string;
  top: number;
  left: number;
  enabled: boolean;
  decommissionedAt?: string | null;
  credentialStatus: CredentialStatus;
  credMasked?: string;
  credentialProvisionedAt?: string;
  installedAt: string;
  installedBy: string;
  powerSource: string;
  connectivityType: string;
  networkProfile: string;
  calibrationStatus: CalibrationStatus;
  calibrationDate: string;
  calibrationNote: string;
  lastInspection: string;
  lastTested: string;
  faults: string;
  inspector: string;
  testIssue?: string;
  lastRotated?: string;
  credentialGeneration?: number;
}

interface PingCheck {
  label: string;
  passed: boolean;
}

interface PingResult {
  deviceId: string;
  success: boolean;
  latency: string;
  rssi: number;
  checks: PingCheck[];
  promoted?: boolean;
  note?: string;
}

interface EditForm {
  type: string;
  name: string;
  purok: string;
  location: string;
  lat: string;
  lng: string;
  firmware: string;
  installedBy: string;
  powerSource: string;
  connectivityType: string;
  networkProfile: string;
  calibrationStatus: CalibrationStatus;
  calibrationDate: string;
  calibrationNote: string;
  installedAt: string;
  lastInspection: string;
  faults: string;
  inspector: string;
}

interface RegErrors {
  deviceName?: string;
  deviceId?: string;
  serialNumber?: string;
  mac?: string;
  purok?: string;
  location?: string;
  lat?: string;
  lng?: string;
  installedAt?: string;
  installedBy?: string;
  firmware?: string;
  calibrationDate?: string;
}

const CREDENTIAL_STYLES: Record<CredentialStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  revoked: "bg-rose-50 text-rose-600 border-rose-200",
  not_provisioned: "bg-stone-100 text-stone-500 border-stone-200",
};

function credentialLabel(status: CredentialStatus): string {
  if (status === "active") return "Active";
  if (status === "revoked") return "Revoked";
  return "Not Provisioned";
}

function maskCredential(value: string): string {
  const tail = value.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
  return `••••-••••-••••-${tail || "N/A"}`;
}

function generateCredential(): string {
  const seg = () =>
    Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const HARDWARE_TYPES = ["Smoke Sensor", "Decibel Meter"];

const SENSOR_MODULES: Record<string, string> = {
  "Smoke Sensor": "MQ-2",
  "Decibel Meter": "KY-037",
};

const CONTROLLER = "ESP32-WROOM";

const BARANGAY = "Culiat";

const POWER_SOURCES = ["Battery", "USB / External Adapter"];

const CONNECTIVITY_TYPES = ["Wi-Fi"];

const NETWORK_PROFILES = ["Culiat IoT — 2.4 GHz"];

const CALIBRATION_OPTIONS: { value: CalibrationStatus; label: string }[] = [
  { value: "not_calibrated", label: "Not Calibrated" },
  { value: "calibrated", label: "Calibrated" },
];

const DEVICE_ID_PATTERN = /^[A-Z]{2}-(P[1-9]|MAIN|EVA)-\d{2}$/;

const MAC_PATTERN = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

const MAC_PREFIX = "A4:CF:12";

const FIRMWARE_VERSIONS = ["v2.4.1", "v2.4.0", "v2.3.8", "v2.3.5"];

const DEFAULT_THRESHOLDS = {
  smoke: 50,
  decibel: 50,
  smokePersistence: 30,
  decibelPersistence: 10,
};

const STYLES = {
  input:
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/15 disabled:cursor-not-allowed disabled:bg-stone-50",
  select:
    "w-full appearance-none rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-[#0038A8]/15",
  label:
    "mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500",
  section:
    "rounded-xl border border-stone-200 bg-white p-6 shadow-sm",
  sectionTitle: "text-base font-bold text-stone-900",
  sectionDesc: "mt-1 text-xs text-stone-400",
  primaryBtn:
    "flex items-center justify-center gap-2 rounded-md bg-[#0038A8] py-2.5 text-sm font-semibold text-white transition hover:bg-[#002A8C] active:scale-[0.99]",
  secondaryBtn:
    "flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50",
};

const STATUS_CONFIG: Record<
  DeviceStatus,
  { dot: string; badge: string; pin: string; label: string; icon: React.ElementType }
> = {
  pending: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    pin: "#1d4ed8",
    label: "Pending",
    icon: Clock,
  },
  online: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pin: "#2f7d4f",
    label: "Online",
    icon: Wifi,
  },
  offline: {
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-600 border-rose-200",
    pin: "#c0392b",
    label: "Offline",
    icon: WifiOff,
  },
};

const LOW_BATTERY = {
  dot: "bg-amber-400",
  badge: "bg-amber-50 text-amber-700 border-amber-200",
  pin: "#c98a1f",
  label: "Low Battery",
  icon: AlertTriangle,
};

const DISABLED = {
  dot: "bg-stone-400",
  badge: "bg-stone-100 text-stone-500 border-stone-200",
  pin: "#78716c",
  label: "Disabled",
  icon: Power,
};

const DECOMMISSIONED = {
  dot: "bg-stone-400",
  badge: "bg-stone-100 text-stone-500 border-stone-200",
  pin: "#78716c",
  label: "Decommissioned",
  icon: Archive,
};

function displayStatus(d: Device) {
  if (d.decommissionedAt) return DECOMMISSIONED;
  if (!d.enabled) return DISABLED;
  if (d.status === "online" && d.battery <= 35) return LOW_BATTERY;
  return STATUS_CONFIG[d.status] ?? STATUS_CONFIG.offline;
}

const INITIAL_DEVICES: Device[] = [
  {
    id: "SM-GATE-01",
    name: "Smoke Sensor — Purok 1 Gate",
    type: "Smoke Sensor",
    sensorModule: "MQ-2",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0001",
    mac: "A4:CF:12:8E:3B:01",
    firmware: "v2.4.1",
    purok: "Purok 1 — Riverside",
    barangay: BARANGAY,
    location: "Near Barangay Hall Main Entrance",
    lat: "14.5995",
    lng: "120.9842",
    status: "online",
    battery: 87,
    signal: 92,
    lastPing: "2 mins ago",
    top: 40,
    left: 26.7,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-FJ21",
    installedAt: "2026-01-12",
    installedBy: "Field Tech — Team A",
    powerSource: "Battery",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "MQ-2 uncalibrated — readings are relative sensor values, not ppm",
    lastInspection: "2026-06-20",
    lastTested: "2026-07-20 09:41",
    faults: "None reported",
    inspector: "Field Tech — Team A",
  },
  {
    id: "SM-PLAZA-02",
    name: "Smoke Sensor — Plaza Chapel",
    type: "Smoke Sensor",
    sensorModule: "MQ-2",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0002",
    mac: "A4:CF:12:8E:3B:02",
    firmware: "v2.4.1",
    purok: "Purok 2 — Chapel Area",
    barangay: BARANGAY,
    location: "Chapel Plaza corner post",
    lat: "14.6001",
    lng: "120.9835",
    status: "online",
    battery: 54,
    signal: 78,
    lastPing: "4 mins ago",
    top: 51.5,
    left: 51.6,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-2QK7",
    installedAt: "2026-02-03",
    installedBy: "IoT Maintenance Unit",
    powerSource: "Battery",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "MQ-2 uncalibrated — readings are relative sensor values, not ppm",
    lastInspection: "2026-05-28",
    lastTested: "2026-07-20 08:52",
    faults: "None reported",
    inspector: "IoT Maintenance Unit",
  },
  {
    id: "DB-MARKET-01",
    name: "Decibel Meter — Market Stall Row",
    type: "Decibel Meter",
    sensorModule: "KY-037",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0003",
    mac: "A4:CF:12:8E:3B:03",
    firmware: "v2.3.8",
    purok: "Purok 3 — Market Zone",
    barangay: BARANGAY,
    location: "Public Market main stall row",
    lat: "14.6010",
    lng: "120.9860",
    status: "online",
    battery: 73,
    signal: 85,
    lastPing: "1 min ago",
    top: 44,
    left: 66.5,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-8MZ4",
    installedAt: "2025-11-18",
    installedBy: "Barangay Facilities",
    powerSource: "USB / External Adapter",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "KY-037 uncalibrated — readings are relative sensor values, not dB",
    lastInspection: "2026-04-02",
    lastTested: "2026-07-19 17:22",
    faults: "Microphone element replaced 2026-03",
    inspector: "Barangay Facilities",
  },
  {
    id: "SM-PUROK3-01",
    name: "Smoke Sensor — Market Residential Row",
    type: "Smoke Sensor",
    sensorModule: "MQ-2",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0004",
    mac: "A4:CF:12:8E:3B:04",
    firmware: "v2.3.5",
    purok: "Purok 3 — Market Zone",
    barangay: BARANGAY,
    location: "Residential row behind market",
    lat: "14.5977",
    lng: "120.9820",
    status: "offline",
    battery: 8,
    signal: 0,
    lastPing: "3 hrs ago",
    top: 74.6,
    left: 15.7,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-P15T",
    installedAt: "2025-12-07",
    installedBy: "Field Tech — Team B",
    powerSource: "Battery",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "MQ-2 uncalibrated — readings are relative sensor values, not ppm",
    lastInspection: "2026-05-14",
    lastTested: "2026-07-20 07:30",
    faults: "Battery low — replacement due",
    inspector: "Field Tech — Team B",
  },
  {
    id: "DB-HALL-01",
    name: "Decibel Meter — Barangay Hall Plaza",
    type: "Decibel Meter",
    sensorModule: "KY-037",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0005",
    mac: "A4:CF:12:8E:3B:05",
    firmware: "v2.4.0",
    purok: "Purok 2 — Chapel Area",
    barangay: BARANGAY,
    location: "Barangay Hall frontage",
    lat: "14.5989",
    lng: "120.9851",
    status: "online",
    battery: 21,
    signal: 45,
    lastPing: "12 mins ago",
    top: 66.8,
    left: 42.2,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-VL90",
    installedAt: "2026-03-21",
    installedBy: "Field Tech — Team A",
    powerSource: "USB / External Adapter",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "KY-037 uncalibrated — readings are relative sensor values, not dB",
    lastInspection: "2026-06-08",
    lastTested: "2026-07-19 21:15",
    faults: "None reported",
    inspector: "Field Tech — Team A",
  },
  {
    id: "SM-KIOSK-01",
    name: "Smoke Sensor — Market Kiosk",
    type: "Smoke Sensor",
    sensorModule: "MQ-2",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0006",
    mac: "A4:CF:12:8E:3B:07",
    firmware: "v2.4.1",
    purok: "Purok 3 — Market Zone",
    barangay: BARANGAY,
    location: "Kiosk cluster, market zone",
    lat: "14.5983",
    lng: "120.9833",
    status: "online",
    battery: 61,
    signal: 88,
    lastPing: "8 mins ago",
    top: 58,
    left: 55,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-K1S0",
    installedAt: "2026-03-15",
    installedBy: "IoT Maintenance Unit",
    powerSource: "Battery",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "MQ-2 uncalibrated — readings are relative sensor values, not ppm",
    lastInspection: "2026-06-30",
    lastTested: "2026-07-19 20:12",
    faults: "Enclosure re-seated and latch verified during routine inspection",
    inspector: "IoT Maintenance Unit",
  },
  {
    id: "SM-CHAPEL-01",
    name: "Smoke Sensor — Chapel Annex",
    type: "Smoke Sensor",
    sensorModule: "MQ-2",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0007",
    mac: "A4:CF:12:8E:3B:06",
    firmware: "v2.4.1",
    purok: "Purok 2 — Chapel Area",
    barangay: BARANGAY,
    location: "Chapel annex corridor",
    lat: "14.5965",
    lng: "120.9845",
    status: "online",
    battery: 92,
    signal: 96,
    lastPing: "3 mins ago",
    top: 82,
    left: 30.9,
    enabled: true,
    credentialStatus: "revoked",
    credMasked: "••••-••••-••••-X33H",
    installedAt: "2026-04-10",
    installedBy: "IoT Maintenance Unit",
    powerSource: "Battery",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "MQ-2 uncalibrated — readings are relative sensor values, not ppm",
    lastInspection: "2026-07-02",
    lastTested: "2026-07-10 10:05",
    faults: "None reported",
    inspector: "IoT Maintenance Unit",
  },
  {
    id: "SM-PUROK4-01",
    name: "Smoke Sensor — School District Gate",
    type: "Smoke Sensor",
    sensorModule: "MQ-2",
    controller: CONTROLLER,
    serialNumber: "ESP32-SN-0008",
    mac: "A4:CF:12:8E:3B:08",
    firmware: "v2.3.5",
    purok: "Purok 4 — School District",
    barangay: BARANGAY,
    location: "School district main gate",
    lat: "14.6008",
    lng: "120.9875",
    status: "pending",
    battery: 78,
    signal: 71,
    lastPing: "—",
    top: 32,
    left: 72,
    enabled: true,
    credentialStatus: "active",
    credMasked: "••••-••••-••••-T4N9",
    installedAt: "2026-07-21",
    installedBy: "Field Tech — Team B",
    powerSource: "Battery",
    connectivityType: "Wi-Fi",
    networkProfile: "Culiat IoT — 2.4 GHz",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "MQ-2 uncalibrated — readings are relative sensor values, not ppm",
    lastInspection: "—",
    lastTested: "—",
    faults: "Firmware v2.3.5 — telemetry payload fails schema validation",
    inspector: "Field Tech — Team B",
    testIssue: "Firmware v2.3.5 sends out-of-spec telemetry payloads (schema validation fails)",
  },
];

function simulateMac(): string {
  const seg = () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `${MAC_PREFIX}:${seg()}:${seg()}:${seg()}`;
}

function isValidLat(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

function isValidLng(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function generateDeviceId(hardwareType: string, purok: string): string {
  const typePrefix =
    hardwareType === "Smoke Sensor" ? "SM" : "DB";
  const zoneMap: Record<string, string> = {
    "Purok 1 — Riverside": "P1",
    "Purok 2 — Chapel Area": "P2",
    "Purok 3 — Market Zone": "P3",
    "Purok 4 — School District": "P4",
    "Main Barangay Boundary": "MAIN",
    "Evacuation Zone Alpha": "EVA",
  };
  const zone = zoneMap[purok] ?? purok.replace(/\W+/g, "").slice(0, 4).toUpperCase();
  return `${typePrefix}-${zone}-${String(randomBetween(1, 99)).padStart(2, "0")}`;
}

function generateUniqueDeviceId(
  hardwareType: string,
  purok: string,
  existing: Device[],
): string {
  let id = generateDeviceId(hardwareType, purok);
  let guard = 0;
  while (existing.some((d) => d.id.toUpperCase() === id.toUpperCase()) && guard < 200) {
    id = generateDeviceId(hardwareType, purok);
    guard += 1;
  }
  return id;
}

function MapPinMarker({
  device,
}: {
  device: Device;
}) {
  const cfg = displayStatus(device);
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={{ top: `${device.top}%`, left: `${device.left}%` }}
    >
      <span className="mb-1 whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm bg-[#0038A8]">
        {device.id}
      </span>
      <div className="relative">
        <MapPin
          size={22}
          strokeWidth={1.5}
          color={cfg.pin}
          fill={cfg.pin}
          className="drop-shadow-sm"
        />
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${cfg.dot}`}
        />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={STYLES.label}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={STYLES.input}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div>
      <label className={STYLES.label}>{label}</label>
      <select value={value} onChange={onChange} className={STYLES.select}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

const TAG_STYLES = {
  required:
    "inline-flex rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-500",
  optional:
    "inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-400",
  auto: "inline-flex rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-600",
  readonly:
    "inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-500",
};

function FieldTag({
  kind,
  children,
}: {
  kind: keyof typeof TAG_STYLES;
  children: React.ReactNode;
}) {
  return <span className={TAG_STYLES[kind]}>{children}</span>;
}

function inputClass(hasError?: boolean): string {
  return `${STYLES.input} ${
    hasError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : ""
  }`;
}

function selectClass(hasError?: boolean): string {
  return `${STYLES.select} ${
    hasError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : ""
  }`;
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-stone-100 pt-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0038A8]/10 text-[10px] font-bold text-[#0038A8]">
          {step}
        </span>
        <h3 className="text-[13px] font-bold text-stone-800">{title}</h3>
      </div>
      {description && <p className="mb-3 text-[11px] text-stone-400">{description}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  labelIcon,
  tag,
  helper,
  error,
  className = "",
  children,
}: {
  label: string;
  labelIcon?: React.ReactNode;
  tag?: React.ReactNode;
  helper?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-2">
        <label className="text-[11px] font-semibold tracking-wide text-stone-500">
          {labelIcon && (
            <span className="mr-1 inline-flex translate-y-[-1px] text-stone-400">
              {labelIcon}
            </span>
          )}
          {label}
        </label>
        {tag}
      </div>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>
      ) : helper ? (
        <p className="mt-1 text-[10px] text-stone-400">{helper}</p>
      ) : null}
    </div>
  );
}

function ReadOnlyValue({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
      {icon && <span className="shrink-0 text-stone-400">{icon}</span>}
      <span className="truncate">{children}</span>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p
        className={`truncate text-[12px] font-medium text-stone-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function MeterBar({
  value,
  colorFn,
}: {
  value: number;
  colorFn: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-10 rounded-sm border border-stone-200 p-[1px]">
        <div
          className={`h-full rounded-[1px] ${colorFn(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[12px] text-stone-600">{value}%</span>
    </div>
  );
}

function SectionCard({
  title,
  description,
  className = "",
  headerRight,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`${STYLES.section} ${className}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className={STYLES.sectionTitle}>{title}</h2>
          <p className={STYLES.sectionDesc}>{description}</p>
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 py-2.5 last:border-0">
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-stone-400">
        {label}
      </span>
      <span
        className={`text-right text-[12px] text-stone-800 ${mono ? "font-mono" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}

function DeviceDetailModal({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  const s = displayStatus(device);

  return (
    <Modal
      onClose={onClose}
      title="Device Details"
      subtitle={device.id}
      size="lg"
      footer={
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-stone-200 py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
        >
          Close
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0038A8]">
            Overview
          </p>
          <DetailRow label="OPERATIONAL STATUS">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          </DetailRow>
          <DetailRow label="DEVICE NAME">{device.name}</DetailRow>
          <DetailRow label="HARDWARE TYPE">{device.type}</DetailRow>
          <DetailRow label="SENSOR MODULE">{device.sensorModule}</DetailRow>
          <DetailRow label="CONTROLLER">{device.controller}</DetailRow>
          <DetailRow label="SERIAL NUMBER" mono>
            {device.serialNumber}
          </DetailRow>
          <DetailRow label="BARANGAY">
            {device.barangay}{" "}
            <span className="text-stone-400">(fixed — single-barangay deployment)</span>
          </DetailRow>
          <DetailRow label="PUROK / LOCATION ZONE">{device.purok}</DetailRow>
          <DetailRow label="INSTALLATION LOCATION">
            {device.location || "—"}
          </DetailRow>
          <DetailRow label="FIRMWARE VERSION">{device.firmware}</DetailRow>
          <DetailRow label="MAC ADDRESS" mono>
            {device.mac}
          </DetailRow>
          <DetailRow label="COORDINATES" mono>
            {device.lat}, {device.lng}
          </DetailRow>
          <DetailRow label="BATTERY">
            <MeterBar value={device.battery} colorFn={batteryColor} />
          </DetailRow>
          <DetailRow label="SIGNAL">
            <MeterBar value={device.signal} colorFn={signalColor} />
          </DetailRow>
          <DetailRow label="CALIBRATION">
            {device.calibrationStatus === "calibrated" ? (
              <>
                Calibrated{device.calibrationDate ? ` — ${device.calibrationDate}` : ""}
              </>
            ) : (
              <>
                Not calibrated — readings shown as relative sensor values, not ppm/dB
                (§5.5.1, §5.5.2)
              </>
            )}
            {device.calibrationNote && (
              <span className="mt-1 block text-stone-400">{device.calibrationNote}</span>
            )}
          </DetailRow>
          <DetailRow label="POWER SOURCE">{device.powerSource}</DetailRow>
          <DetailRow label="CONNECTIVITY">
            {device.connectivityType}
            {device.networkProfile ? ` · ${device.networkProfile}` : ""}
          </DetailRow>
          <DetailRow label="LAST PING">{device.lastPing}</DetailRow>
          <DetailRow label="POWER STATE">
            {device.enabled ? "Enabled" : "Disabled"}
          </DetailRow>
          {device.decommissionedAt && (
            <DetailRow label="DECOMMISSIONED">{device.decommissionedAt}</DetailRow>
          )}
          <DetailRow label="CREDENTIAL STATUS">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${CREDENTIAL_STYLES[device.credentialStatus]}`}
            >
              <KeyRound size={10} />
              {credentialLabel(device.credentialStatus)}
            </span>
          </DetailRow>
          <DetailRow label="CREDENTIAL (MASKED)" mono>
            {device.credMasked ? device.credMasked : "Not provisioned"}
          </DetailRow>
          {device.credentialProvisionedAt && (
            <DetailRow label="PROVISIONED">{device.credentialProvisionedAt}</DetailRow>
          )}
          {device.credentialGeneration !== undefined && (
            <DetailRow label="CREDENTIAL GENERATION">
              Generation {device.credentialGeneration}
            </DetailRow>
          )}
          {device.lastRotated && (
            <DetailRow label="LAST REPLACED">{device.lastRotated}</DetailRow>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0038A8]">
            Maintenance Records
          </p>
          <DetailRow label="INSTALLATION DATE">
            {device.installedAt || "—"}
          </DetailRow>
          <DetailRow label="INSTALLED BY">
            {device.installedBy || "—"}
          </DetailRow>
          <DetailRow label="LAST INSPECTION DATE">
            {device.lastInspection || "—"}
          </DetailRow>
          <DetailRow label="LAST CONNECTIVITY TEST">
            {device.lastTested || "—"}
          </DetailRow>
          <DetailRow label="PERSON RESPONSIBLE">
            {device.inspector || "—"}
          </DetailRow>
          <DetailRow label="REPORTED FAULTS / REPLACEMENTS">
            {device.faults || "None reported"}
          </DetailRow>
        </div>
      </div>
    </Modal>
  );
}

function ThresholdSlider({
  icon,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  unit,
  minLabel,
  maxLabel,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
  minLabel: string;
  maxLabel: string;
  status: { ok: boolean; message: string };
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex-1">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-stone-500">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-stone-800">{label}</p>
            <p className="text-xs text-stone-400">{hint}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-14 border-none bg-transparent text-right text-sm text-stone-800 outline-none"
          />
          <span className="text-xs text-stone-400">{unit}</span>
        </div>
      </div>

      <div className="relative py-2">
        <div className="h-1.5 rounded-full bg-stone-200">
          <div
            className="h-1.5 rounded-full bg-[#0038A8]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 top-0 h-full w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0038A8]
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#0038A8]"
        />
      </div>

      <div className="mb-3 flex justify-between text-[11px] text-stone-400">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>

      <div
        className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-xs ${
          status.ok
            ? "bg-emerald-50 text-emerald-800"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        {status.ok ? (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
        )}
        <span>{status.message}</span>
      </div>
    </div>
  );
}

function DeviceRegistrationSection({
  hardwareType,
  onHardwareTypeChange,
  deviceName,
  onDeviceNameChange,
  deviceId,
  onDeviceIdChange,
  onRegenerateDeviceId,
  serialNumber,
  onSerialNumberChange,
  mac,
  onMacChange,
  onSimulateMac,
  purok,
  onPurokChange,
  installationLocation,
  onInstallationLocationChange,
  lat,
  onLatChange,
  lng,
  onLngChange,
  pickingPin,
  onTogglePickingPin,
  installedAt,
  onInstalledAtChange,
  installedBy,
  onInstalledByChange,
  powerSource,
  onPowerSourceChange,
  firmware,
  onFirmwareChange,
  connectivityType,
  onConnectivityTypeChange,
  networkProfile,
  onNetworkProfileChange,
  calibrationStatus,
  onCalibrationStatusChange,
  calibrationDate,
  onCalibrationDateChange,
  calibrationNote,
  onCalibrationNoteChange,
  errors,
  onRegister,
  onReset,
}: {
  hardwareType: string;
  onHardwareTypeChange: (v: string) => void;
  deviceName: string;
  onDeviceNameChange: (v: string) => void;
  deviceId: string;
  onDeviceIdChange: (v: string) => void;
  onRegenerateDeviceId: () => void;
  serialNumber: string;
  onSerialNumberChange: (v: string) => void;
  mac: string;
  onMacChange: (v: string) => void;
  onSimulateMac: () => void;
  purok: string;
  onPurokChange: (v: string) => void;
  installationLocation: string;
  onInstallationLocationChange: (v: string) => void;
  lat: string;
  onLatChange: (v: string) => void;
  lng: string;
  onLngChange: (v: string) => void;
  pickingPin: boolean;
  onTogglePickingPin: () => void;
  installedAt: string;
  onInstalledAtChange: (v: string) => void;
  installedBy: string;
  onInstalledByChange: (v: string) => void;
  powerSource: string;
  onPowerSourceChange: (v: string) => void;
  firmware: string;
  onFirmwareChange: (v: string) => void;
  connectivityType: string;
  onConnectivityTypeChange: (v: string) => void;
  networkProfile: string;
  onNetworkProfileChange: (v: string) => void;
  calibrationStatus: CalibrationStatus;
  onCalibrationStatusChange: (v: CalibrationStatus) => void;
  calibrationDate: string;
  onCalibrationDateChange: (v: string) => void;
  calibrationNote: string;
  onCalibrationNoteChange: (v: string) => void;
  errors: RegErrors;
  onRegister: () => void;
  onReset: () => void;
}) {
  const sensorModule = SENSOR_MODULES[hardwareType] ?? "—";
  const hasErr = (k: keyof RegErrors) => !!errors[k];

  const legend = (
    <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-stone-500 lg:flex">
      <FieldTag kind="required">Required</FieldTag>
      <FieldTag kind="optional">Optional</FieldTag>
      <FieldTag kind="auto">Auto-generated</FieldTag>
      <FieldTag kind="readonly">Read-only</FieldTag>
    </div>
  );

  return (
    <SectionCard
      title="Register New Device"
      description="Provision a new ESP32 hardware node into the IoT network"
      headerRight={legend}
    >
      <FormSection
        step="1"
        title="Device Identification"
        description="Hardware identity of the physical node — separate the system identifier from the physical identifiers."
      >
        <Field
          label="HARDWARE TYPE"
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="Approved types for this deployment (§5.2)."
          error={hasErr("deviceName") && !hardwareType ? "Select a hardware type." : undefined}
        >
          <select
            value={hardwareType}
            onChange={(e) => onHardwareTypeChange(e.target.value)}
            className={selectClass(false)}
          >
            {HARDWARE_TYPES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="SENSOR MODULE"
          tag={<FieldTag kind="auto">Auto-matched</FieldTag>}
          helper="Determined by the hardware type. Matched automatically."
        >
          <ReadOnlyValue icon={<CircuitBoard size={13} />}>{sensorModule}</ReadOnlyValue>
        </Field>

        <Field
          label="CONTROLLER / DEVELOPMENT BOARD"
          tag={<FieldTag kind="readonly">Fixed</FieldTag>}
          helper="All nodes run on the same dev board for this deployment (§5.2)."
        >
          <ReadOnlyValue icon={<Cpu size={13} />}>{CONTROLLER}</ReadOnlyValue>
        </Field>

        <Field
          label="DEVICE NAME / LABEL"
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="e.g. Smoke Sensor — Purok 1 Gate"
          error={errors.deviceName}
        >
          <input
            type="text"
            value={deviceName}
            onChange={(e) => onDeviceNameChange(e.target.value)}
            placeholder="e.g. Smoke Sensor — Purok 1 Gate"
            className={inputClass(hasErr("deviceName"))}
          />
        </Field>

        <Field
          label="DEVICE ID"
          tag={
            <>
              <FieldTag kind="auto">Auto-generated</FieldTag>
              <FieldTag kind="readonly">Immutable after registration</FieldTag>
            </>
          }
          helper="Automatically generated from hardware type + purok (e.g. SM-P1-42). Editable only during registration and immutable afterwards — telemetry, alerts, and audit records key off this identifier (§10.6.2, §10.6.3)."
          error={errors.deviceId}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={deviceId}
              onChange={(e) => onDeviceIdChange(e.target.value)}
              placeholder="e.g. SM-P1-42"
              className={`${inputClass(hasErr("deviceId"))} font-mono`}
            />
            <button
              onClick={onRegenerateDeviceId}
              title="Regenerate Device ID from hardware type + purok"
              className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-[#0038A8]"
            >
              <RefreshCw size={13} />
              Regenerate
            </button>
          </div>
        </Field>

        <Field
          label="SERIAL NUMBER"
          labelIcon={<Barcode size={12} />}
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="Physical hardware identifier of the ESP32 — must differ from the Device ID and be unique."
          error={errors.serialNumber}
        >
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => onSerialNumberChange(e.target.value)}
            placeholder="e.g. ESP32-SN-0042"
            className={`${inputClass(hasErr("serialNumber"))} font-mono`}
          />
        </Field>

        <Field
          label="MAC ADDRESS"
          tag={
            <>
              <FieldTag kind="required">Required</FieldTag>
              <FieldTag kind="optional">Simulated when prototype MAC is unavailable</FieldTag>
            </>
          }
          helper="Physical network identifier of the ESP32 device (Espressif OUI A4:CF:12). Must be unique."
          error={errors.mac}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={mac}
              onChange={(e) => onMacChange(e.target.value)}
              placeholder="A4:CF:12:00:00:00"
              className={`${inputClass(hasErr("mac"))} font-mono`}
            />
            <button
              onClick={onSimulateMac}
              title="Generate a simulated hardware MAC for prototyping (ESP32 OUI prefix)"
              className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-[#0038A8]"
            >
              <Cpu size={13} />
              Simulate MAC
            </button>
          </div>
        </Field>
      </FormSection>

      <FormSection
        step="2"
        title="Deployment Location"
        description="Where the physical node is installed within the single-barangay deployment."
      >
        <Field
          label="BARANGAY"
          tag={<FieldTag kind="readonly">Fixed</FieldTag>}
          helper="Single-barangay deployment — fixed to Culiat (§10.6.1)."
        >
          <ReadOnlyValue icon={<Globe size={13} />}>{BARANGAY}</ReadOnlyValue>
        </Field>

        <Field
          label="PUROK / LOCATION ZONE"
          tag={<FieldTag kind="required">Required</FieldTag>}
          error={errors.purok}
        >
          <select
            value={purok}
            onChange={(e) => onPurokChange(e.target.value)}
            className={selectClass(hasErr("purok"))}
          >
            {PUROK_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="INSTALLATION LOCATION / LANDMARK"
          labelIcon={<Landmark size={12} />}
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="e.g. Near Barangay Hall Main Entrance"
          error={errors.location}
          className="md:col-span-2"
        >
          <input
            type="text"
            value={installationLocation}
            onChange={(e) => onInstallationLocationChange(e.target.value)}
            placeholder="e.g. Near Barangay Hall Main Entrance"
            className={inputClass(hasErr("location"))}
          />
        </Field>

        <div className="md:col-span-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className={STYLES.label}>COORDINATES</span>
            <button
              onClick={onTogglePickingPin}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                pickingPin
                  ? "bg-[#0038A8] text-white"
                  : "border border-stone-200 text-stone-500 hover:bg-stone-50"
              }`}
            >
              <MapPin size={11} />
              {pickingPin ? "Click map to place pin…" : "Click-to-Pin"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <input
                type="text"
                value={lat}
                onChange={(e) => onLatChange(e.target.value)}
                placeholder="Latitude (e.g. 14.5995)"
                disabled={pickingPin}
                className={`${inputClass(hasErr("lat"))} font-mono`}
              />
              {errors.lat && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.lat}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                value={lng}
                onChange={(e) => onLngChange(e.target.value)}
                placeholder="Longitude (e.g. 120.9842)"
                disabled={pickingPin}
                className={`${inputClass(hasErr("lng"))} font-mono`}
              />
              {errors.lng && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.lng}</p>
              )}
            </div>
          </div>
          <p
            className={`mt-2 text-[10px] ${
              pickingPin ? "font-medium text-[#0038A8] animate-pulse" : "text-stone-400"
            }`}
          >
            {pickingPin
              ? "Location selection active — click the map once to pin these coordinates."
              : "Pinning sets latitude/longitude from the map. The pin disarms after one click; re-arm it to pin again."}
          </p>
        </div>
      </FormSection>

      <FormSection
        step="3"
        title="Installation Information"
        description="Who installed the node, when, and how it is powered."
      >
        <Field
          label="INSTALLATION DATE"
          labelIcon={<CalendarDays size={12} />}
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="Defaults to today — adjust only if registering retroactively."
          error={errors.installedAt}
        >
          <input
            type="date"
            value={installedAt}
            onChange={(e) => onInstalledAtChange(e.target.value)}
            className={inputClass(hasErr("installedAt"))}
          />
        </Field>

        <Field
          label="INSTALLED BY / RESPONSIBLE PERSONNEL"
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="e.g. Field Tech — Team A. Also becomes the initial maintenance person responsible."
          error={errors.installedBy}
        >
          <input
            type="text"
            value={installedBy}
            onChange={(e) => onInstalledByChange(e.target.value)}
            placeholder="e.g. Field Tech — Team A"
            className={inputClass(hasErr("installedBy"))}
          />
        </Field>

        <Field
          label="POWER SOURCE"
          labelIcon={<BatteryCharging size={12} />}
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="Supported sources for the ESP32 node in this deployment."
        >
          <select
            value={powerSource}
            onChange={(e) => onPowerSourceChange(e.target.value)}
            className={selectClass(false)}
          >
            {POWER_SOURCES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="FIRMWARE VERSION"
          labelIcon={<Factory size={12} />}
          tag={<FieldTag kind="required">Required</FieldTag>}
          helper="Firmware present on the node at registration time."
          error={errors.firmware}
        >
          <select
            value={firmware}
            onChange={(e) => onFirmwareChange(e.target.value)}
            className={selectClass(hasErr("firmware"))}
          >
            {FIRMWARE_VERSIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection
        step="4"
        title="Connectivity & Sensor Information"
        description="Expected connectivity profile and sensor calibration state. Network credentials are never stored here."
      >
        <Field
          label="CONNECTIVITY TYPE"
          tag={<FieldTag kind="readonly">Fixed</FieldTag>}
          helper="ESP32-WROOM nodes connect over Wi-Fi (MQTT/WebSocket) (§5.2)."
        >
          <ReadOnlyValue icon={<Wifi size={13} />}>{connectivityType}</ReadOnlyValue>
        </Field>

        <Field
          label="NETWORK PROFILE"
          labelIcon={<Network size={12} />}
          tag={<FieldTag kind="optional">Reference only</FieldTag>}
          helper="Reference to the configured IoT network profile — Wi-Fi credentials are managed elsewhere and never captured in this form."
        >
          <select
            value={networkProfile}
            onChange={(e) => onNetworkProfileChange(e.target.value)}
            className={selectClass(false)}
          >
            {NETWORK_PROFILES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="CALIBRATION STATUS"
          tag={<FieldTag kind="optional">Optional</FieldTag>}
          helper="MQ-2 and KY-037 readings use relative sensor values and are not standardized ppm/dB measurements (§5.5.1, §5.5.2)."
        >
          <select
            value={calibrationStatus}
            onChange={(e) =>
              onCalibrationStatusChange(e.target.value as CalibrationStatus)
            }
            className={selectClass(false)}
          >
            {CALIBRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="CALIBRATION DATE"
          tag={<FieldTag kind="optional">Optional</FieldTag>}
          helper="Required only when the device is marked calibrated."
          error={errors.calibrationDate}
        >
          <input
            type="date"
            value={calibrationDate}
            onChange={(e) => onCalibrationDateChange(e.target.value)}
            disabled={calibrationStatus !== "calibrated"}
            className={inputClass(hasErr("calibrationDate"))}
          />
        </Field>

        <Field
          label="CALIBRATION NOTE"
          tag={<FieldTag kind="optional">Optional</FieldTag>}
          helper="Relevant installation / calibration notes."
          className="md:col-span-2"
        >
          <textarea
            value={calibrationNote}
            onChange={(e) => onCalibrationNoteChange(e.target.value)}
            rows={2}
            placeholder="e.g. Sensor mounted 3m from ground; baseline readings recorded on install"
            className={STYLES.input}
          />
        </Field>
      </FormSection>

      <FormSection
        step="5"
        title="Registration Summary"
        description="Review the complete registration record before provisioning."
      >
        <div className="md:col-span-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
            <SummaryItem label="Device Name" value={deviceName} />
            <SummaryItem label="Device ID" value={deviceId} mono />
            <SummaryItem label="Hardware Type" value={hardwareType} />
            <SummaryItem label="Sensor Module" value={sensorModule} />
            <SummaryItem label="Controller" value={CONTROLLER} />
            <SummaryItem label="Serial Number" value={serialNumber} mono />
            <SummaryItem label="MAC Address" value={mac} mono />
            <SummaryItem label="Barangay" value={BARANGAY} />
            <SummaryItem label="Purok" value={purok} />
            <SummaryItem label="Installation Location" value={installationLocation} />
            <SummaryItem label="Coordinates" value={lat && lng ? `${lat}, ${lng}` : ""} mono />
            <SummaryItem label="Firmware" value={firmware} mono />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              Initial Status:
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Pending
            </span>
            <span className="ml-auto text-[11px] text-stone-500">
              <Scale size={11} className="mr-1 inline" />
              {calibrationStatus === "calibrated"
                ? `Calibrated${calibrationDate ? ` — ${calibrationDate}` : ""}`
                : "Not Calibrated — relative sensor values"}
            </span>
          </div>
          <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
            The device is created as <strong>Pending</strong> with <strong>no credential
            provisioned</strong> (registration does not create a credential). Provision an existing
            credential explicitly, then confirm it passes the Device Connection Test (credential
            authentication, connectivity, telemetry, backend storage) before it is promoted to{" "}
            <strong>Online</strong> (§9.12).
          </p>
        </div>
      </FormSection>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <button onClick={onReset} className={STYLES.secondaryBtn}>
          <RotateCcw size={14} />
          Reset Form
        </button>
        <button onClick={onRegister} className={`${STYLES.primaryBtn} flex-1`}>
          <Cpu size={15} />
          Register Device
        </button>
      </div>
    </SectionCard>
  );
}

function DeviceRegisteredModal({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Device Registered"
      subtitle={`${device.id} · ${device.name}`}
      size="lg"
      icon={<CheckCircle2 size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      footer={
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-[#0038A8] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#002A8C]"
        >
          Done
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0038A8]">
            Registration Summary
          </p>
          <DetailRow label="DEVICE NAME">{device.name}</DetailRow>
          <DetailRow label="DEVICE ID" mono>
            {device.id}
          </DetailRow>
          <DetailRow label="HARDWARE TYPE">{device.type}</DetailRow>
          <DetailRow label="SENSOR MODULE">{device.sensorModule}</DetailRow>
          <DetailRow label="SERIAL NUMBER" mono>
            {device.serialNumber}
          </DetailRow>
          <DetailRow label="MAC ADDRESS" mono>
            {device.mac}
          </DetailRow>
          <DetailRow label="BARANGAY">{device.barangay}</DetailRow>
          <DetailRow label="PUROK">{device.purok}</DetailRow>
          <DetailRow label="INSTALLATION LOCATION">{device.location}</DetailRow>
          <DetailRow label="COORDINATES" mono>
            {device.lat}, {device.lng}
          </DetailRow>
          <DetailRow label="INITIAL STATUS">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Pending
            </span>
          </DetailRow>
          <DetailRow label="CREDENTIAL STATUS">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500">
              <KeyRound size={10} />
              Not Provisioned
            </span>
          </DetailRow>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-[12px] leading-relaxed text-sky-800">
          The device is registered as <strong>Pending</strong> with <strong>no credential
          provisioned</strong>. Registration only captured the device information — no enrollment
          credential was created or assigned. Provision an existing credential from the{" "}
          <strong>Provision Credential</strong> action, then run the Device Connection Test —
          credential authentication, connectivity, telemetry, and backend storage — before it becomes{" "}
          <strong>Online</strong> (§9.12).
        </div>
      </div>
    </Modal>
  );
}

function RotateConfirmModal({
  device,
  onConfirm,
  onClose,
}: {
  device: Device;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Rotate Device Credential?"
      subtitle="Invalidate the current credential and generate a new one"
      size="md"
      icon={<RefreshCw size={18} />}
      iconClass="bg-amber-100 text-amber-600"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C] sm:flex-1"
          >
            Rotate Credential
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Device
            </span>
            <span className="font-mono text-[13px] font-semibold text-stone-800">{device.id}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Current Credential
            </span>
            <span className="font-mono text-[13px] text-stone-700">{device.credMasked}</span>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            What will happen
          </p>
          <ul className="mt-1.5 space-y-1.5 text-[12px] text-stone-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              The current credential will be invalidated.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              A new unique enrollment credential will be generated (simulated provisioning).
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              The Device ID, hardware information, and operational status will not change.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              The device must use the new credential to reconnect.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function ProvisionCredentialModal({
  device,
  onConfirm,
  onClose,
}: {
  device: Device;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isRevoked = device.credentialStatus === "revoked";
  return (
    <Modal
      onClose={onClose}
      title="Provision Device Credential?"
      subtitle={isRevoked ? `${device.id} · recover revoked credential` : `${device.id} · no credential was created at registration`}
      size="md"
      icon={<KeyRound size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C] sm:flex-1"
          >
            Provision Credential
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Device
            </span>
            <span className="font-mono text-[13px] font-semibold text-stone-800">{device.id}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Device Name
            </span>
            <span className="text-[12px] text-stone-600">{device.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Credential Status
            </span>
            {isRevoked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Revoked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500">
                <KeyRound size={10} /> Not Provisioned
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-[12px] leading-relaxed text-sky-800">
          A unique enrollment credential will be generated and associated with this device. The
          credential will be used to authenticate the device when connecting to the IoT
          backend/MQTT service. Registration only created the device record — it did not create a
          credential.
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            What will happen
          </p>
          <ul className="mt-1.5 space-y-1.5 text-[12px] text-stone-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              A new unique enrollment credential will be generated (simulated provisioning
              operation).
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              Credential status becomes <strong>Active</strong>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              Operational status does <strong>not</strong> change — the device still must pass the
              Connection Test.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-stone-400">•</span>
              The credential is stored masked and never written to the audit trail.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function RevokeCredentialModal({
  device,
  onConfirm,
  onClose,
}: {
  device: Device;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Revoke Device Credential?"
      subtitle="Invalidate the current credential and block the device from authenticating"
      size="md"
      icon={<ShieldX size={18} />}
      iconClass="bg-rose-100 text-rose-600"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-medium text-white hover:bg-rose-700 sm:flex-1"
          >
            Revoke Credential
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Device
            </span>
            <span className="font-mono text-[13px] font-semibold text-stone-800">{device.id}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Current Credential
            </span>
            <span className="font-mono text-[13px] text-stone-700">{device.credMasked}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Credential Status
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] leading-relaxed text-rose-800">
          This will invalidate the current credential and prevent the device from authenticating
          with the IoT backend. This action is <strong>different from disabling the device</strong>{" "}
          — it does not power the device off or change its operational status. The device can be
          re-enabled physically, but it cannot reconnect until a new credential is provisioned.
        </div>
      </div>
    </Modal>
  );
}

const ROTATION_STEPS = [
  "Invalidating old credential...",
  "Generating new enrollment credential...",
  "Updating device credential status...",
];

const PROVISION_STEPS = [
  "Generating enrollment credential...",
  "Associating credential with device...",
  "Updating device credential status...",
];

function CredentialProcessingModal({
  title,
  deviceId,
  steps,
  step,
}: {
  title: string;
  deviceId: string;
  steps: string[];
  step: number;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0038A8]/10">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0038A8]/30 border-t-[#0038A8]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">{title}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-stone-400">{deviceId}</p>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2.5 text-[12px]">
              {i < step ? (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
              ) : i === step ? (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#0038A8]/30 border-t-[#0038A8]" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-stone-200" />
              )}
              <span className={i <= step ? "text-stone-700" : "text-stone-400"}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CredentialsRotatedModal({
  deviceId,
  prevMasked,
  newMasked,
  onClose,
}: {
  deviceId: string;
  prevMasked: string | undefined;
  newMasked: string;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Credentials Rotated"
      subtitle={`${deviceId} · new enrollment credential issued`}
      size="md"
      icon={<CheckCircle2 size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      footer={
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C]"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Device
            </span>
            <span className="font-mono text-[13px] font-semibold text-stone-800">{deviceId}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Credential Status
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Previous Credential
            </span>
            <span className="font-mono text-[13px] text-stone-400 line-through">{prevMasked}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Invalidated
            </span>
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
              Yes
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              New Credential
            </span>
            <span className="font-mono text-[13px] font-semibold text-emerald-700">{newMasked}</span>
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-800">
          The previous credential can no longer be used. The device must use the new credential to
          reconnect — rotating does not automatically update the physical ESP32. Run the{" "}
          <strong>Device Connection Test</strong> to verify it can authenticate after the device has
          been updated.
        </div>
      </div>
    </Modal>
  );
}

function CredentialProvisionedModal({
  deviceId,
  masked,
  onClose,
}: {
  deviceId: string;
  masked: string;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Credential Provisioned"
      subtitle={`${deviceId} · unique enrollment credential generated`}
      size="md"
      icon={<CheckCircle2 size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      footer={
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C]"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Device
            </span>
            <span className="font-mono text-[13px] font-semibold text-stone-800">{deviceId}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Credential Status
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Credential (Masked)
            </span>
            <span className="font-mono text-[13px] font-semibold text-emerald-700">{masked}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Source
            </span>
            <span className="text-[12px] text-stone-600">Generated (simulated provisioning)</span>
          </div>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-[12px] leading-relaxed text-sky-800">
          The device can now attempt to authenticate. Run the <strong>Device Connection Test</strong>{" "}
          to confirm it passes acceptance checks and becomes <strong>Online</strong>.
        </div>
      </div>
    </Modal>
  );
}

function DeviceMapSection({
  devices,
  pickingPin,
  onMapClick,
  mapRef,
}: {
  devices: Device[];
  pickingPin: boolean;
  onMapClick: (e: React.MouseEvent) => void;
  mapRef: React.RefObject<HTMLDivElement | null>;
}) {
  const enabledCount = devices.filter((d) => d.enabled).length;

  return (
    <SectionCard
      title="Device Map"
      description="Geographic placement of all IoT nodes"
      headerRight={
        <div className="flex items-center gap-2">
          {pickingPin && (
            <span className="rounded-md bg-[#0038A8] px-2.5 py-1 text-[11px] font-medium text-white animate-pulse">
              Click map to place pin
            </span>
          )}
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500">
            {enabledCount} active
          </span>
        </div>
      }
    >
      <div
        ref={mapRef}
        onClick={onMapClick}
        className="relative h-72 overflow-hidden rounded-lg border border-stone-200"
        style={{
          backgroundColor: "#d9e6de",
          backgroundImage:
            "linear-gradient(rgba(120,140,130,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(120,140,130,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          cursor: pickingPin ? "crosshair" : "default",
        }}
      >
        {devices
          .filter((d) => d.enabled)
          .map((d) => (
            <MapPinMarker key={d.id} device={d} />
          ))}
        <span className="absolute bottom-3 right-3 rounded-md bg-white/90 px-2.5 py-1 text-[11px] text-stone-500 shadow-sm">
          Brgy. Culiat, Metro Manila
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Low Battery
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Pending
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> Offline
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-stone-400">
        Low Battery is a derived indicator from battery voltage — not a stored device status.
        Disabled and Decommissioned nodes drop off the map.
      </p>
    </SectionCard>
  );
}

function DeviceTableSection({
  devices,
  onView,
  onEdit,
  onToggleEnable,
  onDecommission,
  onRotate,
  onProvision,
  onRevoke,
}: {
  devices: Device[];
  onView: (d: Device) => void;
  onEdit: (d: Device) => void;
  onToggleEnable: (id: string) => void;
  onDecommission: (d: Device) => void;
  onRotate: (d: Device) => void;
  onProvision: (d: Device) => void;
  onRevoke: (d: Device) => void;
}) {
  const columns = [
    "STATUS",
    "DEVICE ID",
    "TYPE",
    "PUROK",
    "BATTERY",
    "SIGNAL",
    "LAST PING",
    "CREDENTIAL STATUS",
    "ACTIONS",
  ];

  return (
    <section className="mt-5 rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className={STYLES.sectionTitle}>Device Inventory</h2>
          <p className="mt-0.5 text-xs text-stone-400">
            Manage all registered hardware nodes — {devices.length} total
          </p>
        </div>
      </div>

      <div className="db-scroll overflow-x-auto">
        <table className="w-full min-w-[1150px] border-collapse">
          <thead>
            <tr className="border-y border-stone-100 text-left">
              {columns.map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const s = displayStatus(d);
              return (
                <tr
                  key={d.id}
                  className={`border-b border-stone-100 last:border-0 ${
                    d.enabled
                      ? "hover:bg-stone-50/50"
                      : "bg-stone-50 opacity-60"
                  }`}
                >
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-semibold text-stone-800">
                    {d.id}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-stone-600">
                    {d.type}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-stone-500">
                    {d.purok}
                  </td>
                  <td className="px-5 py-3">
                    <MeterBar value={d.battery} colorFn={batteryColor} />
                  </td>
                  <td className="px-5 py-3">
                    <MeterBar value={d.signal} colorFn={signalColor} />
                  </td>
                  <td className="px-5 py-3 text-[12px] text-stone-500">
                    {d.lastPing}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${CREDENTIAL_STYLES[d.credentialStatus]}`}
                      title={
                        d.credentialStatus === "not_provisioned"
                          ? "No credential provisioned — registration did not create one"
                          : d.credentialStatus === "revoked"
                            ? "Credentials revoked — device cannot authenticate until a new credential is provisioned"
                            : "Credentials active"
                      }
                    >
                      <KeyRound size={10} />
                      {credentialLabel(d.credentialStatus)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onView(d)}
                        title="View device details & maintenance records"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                      >
                        <Info size={13} />
                      </button>
                      <button
                        onClick={() => onEdit(d)}
                        title="Edit device"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-stone-400 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-600"
                      >
                        <Pencil size={13} />
                      </button>
                      {(d.credentialStatus === "not_provisioned" || d.credentialStatus === "revoked") ? (
                        <button
                          onClick={() => onProvision(d)}
                          disabled={!!d.decommissionedAt}
                          title={
                            d.decommissionedAt
                              ? "Cannot provision — device is decommissioned"
                              : d.credentialStatus === "revoked"
                                ? "Provision a new credential to restore access"
                                : "Provision credential (generated)"
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            d.decommissionedAt
                              ? "cursor-not-allowed border-stone-100 text-stone-300"
                              : "border-sky-200 text-sky-500 hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                          }`}
                        >
                          <KeyRound size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onRotate(d)}
                          disabled={!!d.decommissionedAt}
                          title={
                            d.decommissionedAt
                              ? "Cannot rotate — device is decommissioned"
                              : "Rotate device credential"
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            d.decommissionedAt
                              ? "cursor-not-allowed border-stone-100 text-stone-300"
                              : "border-stone-200 text-stone-400 hover:border-[#0038A8] hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                          }`}
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                      {d.credentialStatus !== "not_provisioned" && d.credentialStatus !== "revoked" && (
                        <button
                          onClick={() => onRevoke(d)}
                          disabled={!!d.decommissionedAt}
                          title={
                            d.decommissionedAt
                              ? "Cannot revoke — device is decommissioned"
                              : "Revoke device credential"
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            d.decommissionedAt
                              ? "cursor-not-allowed border-stone-100 text-stone-300"
                              : "border-rose-200 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                          }`}
                        >
                          <ShieldX size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => onToggleEnable(d.id)}
                        title={d.enabled ? "Disable device" : "Enable device"}
                        className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                          d.enabled
                            ? "border-amber-200 text-amber-500 hover:bg-amber-50"
                            : "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
                        }`}
                      >
                        <Power size={13} />
                      </button>
                      <button
                        onClick={() => onDecommission(d)}
                        title="Decommission device (record retained)"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Archive size={13} />
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
  );
}

function ConnectionTestSection({
  devices,
  testingDevice,
  pingResult,
  onTestConnection,
}: {
  devices: Device[];
  testingDevice: string | null;
  pingResult: PingResult | null;
  onTestConnection: (dev: Device) => void;
}) {
  const [selectedId, setSelectedId] = useState(
    () => devices.find((d) => d.enabled)?.id ?? "",
  );
  const selectedDev =
    devices.find((d) => d.id === selectedId) ??
    devices.find((d) => d.enabled) ??
    null;

  return (
    <SectionCard
      title="Device Connection Test"
      description="Run the acceptance check against a device — credential authentication, connectivity, telemetry, and backend storage (§5.10)"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className={STYLES.label}>SELECT DEVICE</label>
          <select
            value={selectedDev?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className={STYLES.select}
          >
            {devices
              .filter((d) => d.enabled)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} — {d.purok}
                </option>
              ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (selectedDev) onTestConnection(selectedDev);
          }}
          disabled={testingDevice !== null || !selectedDev}
          className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
        >
          {testingDevice ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-[#0038A8]" />
              Pinging...
            </>
          ) : (
            <>
              <Radio size={14} />
              Test Connection
            </>
          )}
        </button>
      </div>

      {pingResult && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            pingResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-3">
            {pingResult.success ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            ) : (
              <WifiOff size={16} className="shrink-0 text-rose-600" />
            )}
            <div>
              <span className="font-semibold">{pingResult.deviceId}</span>
              {pingResult.success ? (
                <>
                  {" "}
                  — <strong>Result: PASS.</strong> Latency:{" "}
                  <strong>{pingResult.latency}</strong>. Signal:{" "}
                  <strong>{pingResult.rssi}%</strong>
                  {pingResult.promoted && (
                    <span className="mt-0.5 block text-[12px]">
                      Device promoted to <strong>Online</strong> — telemetry confirmed by the Admin
                      (§9.12).
                    </span>
                  )}
                </>
              ) : (
                <>
                  {pingResult.note ||
                    " — Result: FAIL. Device may be offline or out of range."}
                </>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-1.5">
            {pingResult.checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-[12px]">
                {c.passed ? (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                ) : (
                  <XCircle size={13} className="shrink-0 text-rose-600" />
                )}
                <span className={c.passed ? "" : "font-medium"}>{c.label}</span>
                <span className="ml-auto">{c.passed ? "PASS" : "FAIL"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ThresholdSection({
  smokeThreshold,
  onSmokeChange,
  decibelThreshold,
  onDecibelChange,
  smokePersistence,
  onSmokePersistenceChange,
  decibelPersistence,
  onDecibelPersistenceChange,
  justification,
  onJustificationChange,
  onRevert,
  onApply,
}: {
  smokeThreshold: number;
  onSmokeChange: (v: number) => void;
  decibelThreshold: number;
  onDecibelChange: (v: number) => void;
  smokePersistence: number;
  onSmokePersistenceChange: (v: number) => void;
  decibelPersistence: number;
  onDecibelPersistenceChange: (v: number) => void;
  justification: string;
  onJustificationChange: (v: string) => void;
  onRevert: () => void;
  onApply: () => void;
}) {
  const inBand = (v: number) => v >= 50 && v <= 80;

  const smokeStatus = inBand(smokeThreshold)
    ? {
        ok: true,
        message:
          "Relative threshold within recommended operating band (50–80). Calibrated ppm display requires field calibration of the MQ-2 sensor (§5.5.1).",
      }
    : {
        ok: false,
        message:
          "Threshold outside recommended band — uncalibrated values are relative sensor readings, not calibrated ppm concentrations.",
      };

  const decibelStatus = inBand(decibelThreshold)
    ? {
        ok: true,
        message:
          "Relative threshold within recommended operating band. Calibrated dB display requires field calibration of the KY-037 module (§5.5.2).",
      }
    : {
        ok: false,
        message:
          "Threshold outside recommended band — uncalibrated values are relative sensor readings, not standardized dB values.",
      };

  return (
    <SectionCard
      title="Threshold Configuration Panel"
      description="Adjust sensitivity, alert persistence, and trigger values for each sensor type"
    >
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <ThresholdSlider
          icon={<Activity size={16} />}
          label="Smoke Sensor Threshold (relative)"
          hint="Alert triggers above this raw sensor reading — uncalibrated, not ppm (§5.5.1)"
          value={smokeThreshold}
          onChange={onSmokeChange}
          min={0}
          max={100}
          unit="rel."
          minLabel="0 — Low sensitivity"
          maxLabel="100 — High sensitivity"
          status={smokeStatus}
        />
        <ThresholdSlider
          icon={<AudioLines size={16} />}
          label="Noise Level Threshold (relative)"
          hint="Alert triggers above this raw sensor reading — uncalibrated, not dB (§5.5.2)"
          value={decibelThreshold}
          onChange={onDecibelChange}
          min={0}
          max={100}
          unit="rel."
          minLabel="0 — Low sensitivity"
          maxLabel="100 — High sensitivity"
          status={decibelStatus}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={STYLES.label}>
            SMOKE PERSISTENCE DURATION (SECONDS)
          </label>
          <input
            type="number"
            min={1}
            max={300}
            value={smokePersistence}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v))
                onSmokePersistenceChange(Math.min(300, Math.max(1, v)));
            }}
            className={STYLES.input}
          />
          <p className="mt-1 text-[10px] text-stone-400">
            Sustained reading above threshold before an alert fires. Default 30s (§5.6).
          </p>
        </div>
        <div>
          <label className={STYLES.label}>
            NOISE PERSISTENCE DURATION (SECONDS)
          </label>
          <input
            type="number"
            min={1}
            max={300}
            value={decibelPersistence}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v))
                onDecibelPersistenceChange(Math.min(300, Math.max(1, v)));
            }}
            className={STYLES.input}
          />
          <p className="mt-1 text-[10px] text-stone-400">
            Sustained reading above threshold before an alert fires. Default 10s (§5.6).
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className={STYLES.label}>
          DOCUMENTED TESTING JUSTIFICATION (REQUIRED)
        </label>
        <textarea
          value={justification}
          onChange={(e) => onJustificationChange(e.target.value)}
          rows={2}
          placeholder="e.g. Verified against reference MQ-2 rig on 2026-07-20 — documented test #DT-042"
          className={STYLES.input}
        />
        <p className="mt-1 text-[10px] text-stone-400">
          §5.9 — thresholds may be adjusted only by an authorized administrator or technician after
          documented testing. The justification is recorded in the audit trail.
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onRevert} className={STYLES.secondaryBtn}>
          <RotateCcw size={14} />
          Revert to Defaults
        </button>
        <button
          onClick={onApply}
          disabled={!justification.trim()}
          className="flex items-center gap-1.5 rounded-md bg-[#0038A8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#002A8C] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          Apply Thresholds
        </button>
      </div>
    </SectionCard>
  );
}

function EditDeviceModal({
  editId,
  editForm,
  device,
  onEditFormChange,
  onSave,
  onClose,
}: {
  editId: string;
  editForm: EditForm;
  device?: Device | null;
  onEditFormChange: (f: EditForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} title="Edit Device" subtitle={editId} footer={
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-stone-200 py-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002A8C]"
        >
          <Save className="h-4 w-4" /> Save Changes
        </button>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label className={STYLES.label}>DEVICE ID (IMMUTABLE)</label>
          <div className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <span className="font-mono">{editId}</span>
            <span className="text-[10px] text-stone-400">Locked after registration</span>
          </div>
          <p className="mt-1 text-[10px] text-stone-400">
            Auto-generated at registration and immutable thereafter — telemetry, SecurityAlert, and
            audit records key off this identifier (§10.6.2, §10.6.3).
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Physical Identifiers (locked)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={STYLES.label}>SERIAL NUMBER</label>
              <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
                <Barcode size={13} className="shrink-0 text-stone-400" />
                <span className="truncate font-mono">{device?.serialNumber || "—"}</span>
              </div>
            </div>
            <div>
              <label className={STYLES.label}>MAC ADDRESS</label>
              <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
                <Network size={13} className="shrink-0 text-stone-400" />
                <span className="truncate font-mono">{device?.mac || "—"}</span>
              </div>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-stone-400">
            Serial number and MAC address are physical hardware identifiers captured at
            registration — they are not editable after registration.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={STYLES.label}>HARDWARE TYPE</label>
            <select
              value={editForm.type}
              onChange={(e) =>
                onEditFormChange({ ...editForm, type: e.target.value })
              }
              className={STYLES.select}
            >
              {HARDWARE_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={STYLES.label}>SENSOR MODULE</label>
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
              <CircuitBoard size={13} className="shrink-0 text-stone-400" />
              <span>{SENSOR_MODULES[editForm.type] ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={STYLES.label}>DEVICE NAME / LABEL</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) =>
                onEditFormChange({ ...editForm, name: e.target.value })
              }
              placeholder="e.g. Smoke Sensor — Purok 1 Gate"
              className={STYLES.input}
            />
          </div>
          <div>
            <label className={STYLES.label}>INSTALLATION LOCATION / LANDMARK</label>
            <input
              type="text"
              value={editForm.location}
              onChange={(e) =>
                onEditFormChange({ ...editForm, location: e.target.value })
              }
              placeholder="e.g. Near Barangay Hall Main Entrance"
              className={STYLES.input}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="PUROK / LOCATION ZONE"
            value={editForm.purok}
            onChange={(e) =>
              onEditFormChange({ ...editForm, purok: e.target.value })
            }
            options={PUROK_OPTIONS}
          />
          <SelectField
            label="FIRMWARE VERSION"
            value={editForm.firmware}
            onChange={(e) =>
              onEditFormChange({ ...editForm, firmware: e.target.value })
            }
            options={FIRMWARE_VERSIONS}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label="LATITUDE"
            placeholder="Latitude"
            value={editForm.lat}
            onChange={(e) =>
              onEditFormChange({ ...editForm, lat: e.target.value })
            }
          />
          <LabeledInput
            label="LONGITUDE"
            placeholder="Longitude"
            value={editForm.lng}
            onChange={(e) =>
              onEditFormChange({ ...editForm, lng: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={STYLES.label}>INSTALLED BY / RESPONSIBLE PERSONNEL</label>
            <input
              type="text"
              value={editForm.installedBy}
              onChange={(e) =>
                onEditFormChange({ ...editForm, installedBy: e.target.value })
              }
              placeholder="e.g. Field Tech — Team A"
              className={STYLES.input}
            />
          </div>
          <div>
            <label className={STYLES.label}>POWER SOURCE</label>
            <select
              value={editForm.powerSource}
              onChange={(e) =>
                onEditFormChange({ ...editForm, powerSource: e.target.value })
              }
              className={STYLES.select}
            >
              {POWER_SOURCES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={STYLES.label}>CONNECTIVITY TYPE</label>
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
              <Wifi size={13} className="shrink-0 text-stone-400" />
              <span>{editForm.connectivityType || "Wi-Fi"}</span>
            </div>
          </div>
          <SelectField
            label="NETWORK PROFILE"
            value={editForm.networkProfile}
            onChange={(e) =>
              onEditFormChange({ ...editForm, networkProfile: e.target.value })
            }
            options={NETWORK_PROFILES}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Calibration
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={STYLES.label}>CALIBRATION STATUS</label>
              <select
                value={editForm.calibrationStatus}
                onChange={(e) =>
                  onEditFormChange({
                    ...editForm,
                    calibrationStatus: e.target.value as CalibrationStatus,
                  })
                }
                className={STYLES.select}
              >
                {CALIBRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={STYLES.label}>CALIBRATION DATE</label>
              <input
                type="date"
                value={editForm.calibrationDate}
                onChange={(e) =>
                  onEditFormChange({ ...editForm, calibrationDate: e.target.value })
                }
                disabled={editForm.calibrationStatus !== "calibrated"}
                className={STYLES.input}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className={STYLES.label}>CALIBRATION NOTE</label>
            <input
              type="text"
              value={editForm.calibrationNote}
              onChange={(e) =>
                onEditFormChange({ ...editForm, calibrationNote: e.target.value })
              }
              placeholder="e.g. MQ-2 uncalibrated — readings are relative sensor values, not ppm"
              className={STYLES.input}
            />
          </div>
          <p className="mt-1 text-[10px] text-stone-400">
            MQ-2 and KY-037 readings use relative sensor values and are not standardized ppm/dB
            measurements (§5.5.1, §5.5.2).
          </p>
        </div>

        <div className="space-y-4 border-t border-stone-200 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={STYLES.label}>INSTALLATION DATE</label>
              <input
                type="date"
                value={editForm.installedAt}
                onChange={(e) =>
                  onEditFormChange({ ...editForm, installedAt: e.target.value })
                }
                className={STYLES.input}
              />
            </div>
            <div>
              <label className={STYLES.label}>LAST INSPECTION DATE</label>
              <input
                type="date"
                value={editForm.lastInspection}
                onChange={(e) =>
                  onEditFormChange({ ...editForm, lastInspection: e.target.value })
                }
                className={STYLES.input}
              />
            </div>
          </div>

          <div>
            <label className={STYLES.label}>LAST CONNECTIVITY TEST</label>
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
              <Clock size={13} className="shrink-0 text-stone-400" />
              {device?.lastTested || "—"}
            </div>
            <p className="mt-1 text-[10px] text-stone-400">
              Auto-filled from the results of the Device Connection Test.
            </p>
          </div>

          <LabeledInput
            label="PERSON RESPONSIBLE FOR INSPECTION"
            placeholder="e.g. Field Tech — Team A"
            value={editForm.inspector}
            onChange={(e) =>
              onEditFormChange({ ...editForm, inspector: e.target.value })
            }
          />

          <LabeledInput
            label="REPORTED FAULTS / REPLACEMENTS"
            placeholder="e.g. Microphone element replaced, battery swap due"
            value={editForm.faults}
            onChange={(e) =>
              onEditFormChange({ ...editForm, faults: e.target.value })
            }
          />
        </div>

        <div className="rounded-md border border-sky-100 bg-sky-50 px-4 py-3 text-[11px] leading-relaxed text-sky-800">
          Sensor thresholds (smoke / noise sensitivity and persistence durations) are configured
          globally in the <strong>Threshold Configuration Panel</strong> and require documented
          testing justification before they can be applied (§5.9).
        </div>
      </div>
    </Modal>
  );
}

export default function IotProvisioning() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [decommissionConfirmId, setDecommissionConfirmId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [hardwareType, setHardwareType] = useState(HARDWARE_TYPES[0]);
  const [deviceName, setDeviceName] = useState("");
  const [deviceId, setDeviceId] = useState(() =>
    generateDeviceId(HARDWARE_TYPES[0], PUROK_OPTIONS[0]),
  );
  const [serialNumber, setSerialNumber] = useState("");
  const [mac, setMac] = useState(`${MAC_PREFIX}:`);
  const [purok, setPurok] = useState(PUROK_OPTIONS[0]);
  const [installationLocation, setInstallationLocation] = useState("");
  const [lat, setLat] = useState("14.5995");
  const [lng, setLng] = useState("120.9842");
  const [pickingPin, setPickingPin] = useState(false);
  const [installedAt, setInstalledAt] = useState(today());
  const [installedBy, setInstalledBy] = useState("");
  const [powerSource, setPowerSource] = useState(POWER_SOURCES[0]);
  const [firmware, setFirmware] = useState(FIRMWARE_VERSIONS[0]);
  const [connectivityType, setConnectivityType] = useState(CONNECTIVITY_TYPES[0]);
  const [networkProfile, setNetworkProfile] = useState(NETWORK_PROFILES[0]);
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>(
    "not_calibrated",
  );
  const [calibrationDate, setCalibrationDate] = useState("");
  const [calibrationNote, setCalibrationNote] = useState("");
  const [regErrors, setRegErrors] = useState<RegErrors>({});
  const [registeredDevice, setRegisteredDevice] = useState<Device | null>(null);
  const [smokeThreshold, setSmokeThreshold] = useState(DEFAULT_THRESHOLDS.smoke);
  const [decibelThreshold, setDecibelThreshold] = useState(DEFAULT_THRESHOLDS.decibel);
  const [smokePersistence, setSmokePersistence] = useState(DEFAULT_THRESHOLDS.smokePersistence);
  const [decibelPersistence, setDecibelPersistence] = useState(DEFAULT_THRESHOLDS.decibelPersistence);
  const [justification, setJustification] = useState("");
  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    type: "",
    name: "",
    purok: "",
    location: "",
    lat: "",
    lng: "",
    firmware: "",
    installedBy: "",
    powerSource: "",
    connectivityType: "",
    networkProfile: "",
    calibrationStatus: "not_calibrated",
    calibrationDate: "",
    calibrationNote: "",
    installedAt: "",
    lastInspection: "",
    faults: "",
    inspector: "",
  });
  const [rotateConfirmId, setRotateConfirmId] = useState<string | null>(null);
  const [provisionConfirmId, setProvisionConfirmId] = useState<string | null>(null);
  const [credRotating, setCredRotating] = useState<{ deviceId: string; step: number } | null>(null);
  const [credProvisioning, setCredProvisioning] = useState<{ deviceId: string; step: number } | null>(null);
  const [credRotated, setCredRotated] = useState<{
    deviceId: string;
    prevMasked?: string;
    newMasked: string;
  } | null>(null);
  const [credProvisioned, setCredProvisioned] = useState<{
    deviceId: string;
    masked: string;
  } | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  function validateRegistration(): RegErrors {
    const errors: RegErrors = {};

    if (!hardwareType) {
      errors.deviceName = "Select a hardware type.";
    }

    if (!deviceName.trim()) {
      errors.deviceName = "Device name is required.";
    }

    const normId = deviceId.trim().toUpperCase();
    if (!DEVICE_ID_PATTERN.test(normId)) {
      errors.deviceId = "Device ID must follow the format e.g. SM-P1-42 (type-purok-number).";
    } else if (devices.some((d) => d.id.toUpperCase() === normId)) {
      errors.deviceId = "This Device ID is already registered.";
    }

    const normSerial = serialNumber.trim().toUpperCase();
    if (!serialNumber.trim()) {
      errors.serialNumber = "Serial number is required.";
    } else if (devices.some((d) => d.serialNumber.trim().toUpperCase() === normSerial)) {
      errors.serialNumber = "This serial number is already registered.";
    } else if (normSerial === normId) {
      errors.serialNumber = "Serial number must differ from the Device ID.";
    }

    const normMac = mac.trim().toUpperCase();
    if (!MAC_PATTERN.test(mac.trim())) {
      errors.mac = "Enter a valid MAC address (e.g. A4:CF:12:00:00:00).";
    } else if (devices.some((d) => d.mac.trim().toUpperCase() === normMac)) {
      errors.mac = "This MAC address is already registered.";
    }

    if (!purok) {
      errors.purok = "Select a purok / location zone.";
    }

    if (!installationLocation.trim()) {
      errors.location = "Installation location / landmark is required.";
    }

    if (!lat.trim() || !isValidLat(lat)) {
      errors.lat = "Enter a valid latitude between -90 and 90.";
    }

    if (!lng.trim() || !isValidLng(lng)) {
      errors.lng = "Enter a valid longitude between -180 and 180.";
    }

    if (!installedAt) {
      errors.installedAt = "Installation date is required.";
    } else if (Number.isNaN(new Date(installedAt).getTime())) {
      errors.installedAt = "Enter a valid installation date.";
    }

    if (!installedBy.trim()) {
      errors.installedBy = "Enter the responsible installation personnel.";
    }

    if (!firmware) {
      errors.firmware = "Select a firmware version.";
    }

    if (calibrationStatus === "calibrated" && !calibrationDate) {
      errors.calibrationDate = "Provide the calibration date when marked calibrated.";
    }

    return errors;
  }

  function handleRegister() {
    const errors = validateRegistration();
    setRegErrors(errors);

    if (Object.keys(errors).length > 0) {
      setModalMessage({
        title: "Registration Incomplete",
        message: "Fix the highlighted registration fields before provisioning the device.",
      });
      return;
    }

    const macValue = mac.trim().toUpperCase();
    const idValue = deviceId.trim().toUpperCase();

    const newDevice: Device = {
      id: idValue,
      name: deviceName.trim(),
      type: hardwareType,
      sensorModule: SENSOR_MODULES[hardwareType],
      controller: CONTROLLER,
      serialNumber: serialNumber.trim(),
      mac: macValue,
      firmware,
      purok,
      barangay: BARANGAY,
      location: installationLocation.trim(),
      lat,
      lng,
      status: "pending",
      battery: randomBetween(70, 100),
      signal: randomBetween(60, 96),
      lastPing: "—",
      top: 30 + Math.random() * 50,
      left: 20 + Math.random() * 55,
      enabled: true,
      decommissionedAt: null,
      credentialStatus: "not_provisioned",
      credMasked: undefined,
      installedAt,
      installedBy: installedBy.trim(),
      powerSource,
      connectivityType,
      networkProfile,
      calibrationStatus,
      calibrationDate: calibrationStatus === "calibrated" ? calibrationDate : "",
      calibrationNote: calibrationNote.trim(),
      lastInspection: "—",
      lastTested: "—",
      faults: "",
      inspector: installedBy.trim(),
    };

    setDevices((prev) => [...prev, newDevice]);
    pushAuditLog(
      "Device Registration",
      `Registered new device ${newDevice.id} — name: ${newDevice.name}, type: ${hardwareType} (${newDevice.sensorModule} on ${CONTROLLER}), serial: ${newDevice.serialNumber}, MAC: ${newDevice.mac}, barangay: ${BARANGAY}, purok: ${purok}, coordinates: ${lat}, ${lng}, location: ${newDevice.location}, firmware: ${firmware} — initial status: Pending, credential status: Not Provisioned; registration did not create or assign a credential. A credential must be provisioned explicitly before the device can pass a connection test`,
    );
    setRegisteredDevice(newDevice);
    resetRegistrationForm();
  }

  function resetRegistrationForm() {
    setRegErrors({});
    setHardwareType(HARDWARE_TYPES[0]);
    setDeviceName("");
    setDeviceId(generateUniqueDeviceId(HARDWARE_TYPES[0], PUROK_OPTIONS[0], devices));
    setSerialNumber("");
    setMac(`${MAC_PREFIX}:`);
    setPurok(PUROK_OPTIONS[0]);
    setInstallationLocation("");
    setLat("14.5995");
    setLng("120.9842");
    setPickingPin(false);
    setInstalledAt(today());
    setInstalledBy("");
    setPowerSource(POWER_SOURCES[0]);
    setFirmware(FIRMWARE_VERSIONS[0]);
    setConnectivityType(CONNECTIVITY_TYPES[0]);
    setNetworkProfile(NETWORK_PROFILES[0]);
    setCalibrationStatus("not_calibrated");
    setCalibrationDate("");
    setCalibrationNote("");
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!pickingPin || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const newLat = (14.595 + (yPct / 100) * 0.01).toFixed(4);
    const newLng = (120.980 + (xPct / 100) * 0.015).toFixed(4);

    setLat(newLat);
    setLng(newLng);
    setPickingPin(false);
    setRegErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }));
    pushAuditLog("Geofence Update", `Pinned coordinates ${newLat}, ${newLng} for device registration`);
    setModalMessage({ title: "Coordinates Set", message: `Coordinates set: ${newLat}, ${newLng}` });
  }

  function handleTestConnection(dev: Device) {
    setTestingDevice(dev.id);
    setPingResult(null);

    setTimeout(() => {
      const revoked = dev.credentialStatus === "revoked";
      const notProvisioned = dev.credentialStatus === "not_provisioned";
      const credAuthOk = !revoked && !notProvisioned;
      const reachable = !revoked && !notProvisioned && dev.status !== "offline";
      const checks: PingCheck[] = [
        { label: "Credential Authentication", passed: credAuthOk },
        { label: "Connectivity", passed: reachable },
        {
          label: "Telemetry",
          passed: credAuthOk && reachable && !dev.testIssue && Math.random() > 0.08,
        },
        {
          label: "Backend Storage",
          passed: credAuthOk && reachable && !dev.testIssue && Math.random() > 0.08,
        },
      ];
      const allPassed = checks.every((c) => c.passed);
      const promoted = allPassed && dev.status === "pending";
      const latency = allPassed
        ? `${12 + Math.floor(Math.random() * 40)}ms`
        : revoked || notProvisioned
          ? "Blocked"
          : dev.status === "offline"
            ? "Timeout"
            : "Failed";

      setPingResult({
        deviceId: dev.id,
        success: allPassed,
        latency,
        rssi: revoked || notProvisioned ? 0 : dev.signal,
        checks,
        promoted,
        note: revoked
          ? " — Connection blocked: device credentials are revoked. Reissue credentials before the device can reconnect."
          : notProvisioned
            ? " — Device credential has not been provisioned. Provision a valid device credential before running the connection acceptance test."
            : dev.status === "offline"
              ? " — Device offline — no MQTT session could be established."
              : dev.testIssue
                ? ` — Acceptance test failed: ${dev.testIssue}`
                : undefined,
      });
      const tested = new Date().toISOString().replace("T", " ").slice(0, 16);
      setDevices((prev) =>
        prev.map((d) =>
          d.id === dev.id
            ? {
                ...d,
                lastTested: tested,
                ...(promoted ? { status: "online" as DeviceStatus } : {}),
              }
            : d,
        ),
      );
      pushAuditLog(
        "Device Connectivity Test",
        allPassed
          ? `Connection test for ${dev.id} passed all acceptance checks (credential authentication, connectivity, telemetry, backend storage) — ${promoted ? "device promoted to Online" : "device remains Online"} — ${latency}`
          : `Connection test for ${dev.id} failed acceptance checks — device stays ${dev.status}`,
      );
      setTestingDevice(null);
    }, 1500);
  }

  function openEdit(dev: Device) {
    setEditId(dev.id);
    setEditForm({
      type: dev.type,
      name: dev.name,
      purok: dev.purok,
      location: dev.location,
      lat: dev.lat,
      lng: dev.lng,
      firmware: dev.firmware,
      installedBy: dev.installedBy,
      powerSource: dev.powerSource,
      connectivityType: dev.connectivityType,
      networkProfile: dev.networkProfile,
      calibrationStatus: dev.calibrationStatus,
      calibrationDate: dev.calibrationDate || "",
      calibrationNote: dev.calibrationNote || "",
      installedAt: dev.installedAt,
      lastInspection: dev.lastInspection,
      faults: dev.faults || "",
      inspector: dev.inspector || "",
    });
  }

  function saveEdit() {
    const prev = devices.find((d) => d.id === editId);
    setDevices((prevDevices) =>
      prevDevices.map((d) =>
        d.id === editId
          ? {
              ...d,
              type: editForm.type,
              name: editForm.name,
              purok: editForm.purok,
              location: editForm.location,
              lat: editForm.lat,
              lng: editForm.lng,
              firmware: editForm.firmware,
              installedBy: editForm.installedBy,
              powerSource: editForm.powerSource,
              connectivityType: editForm.connectivityType,
              networkProfile: editForm.networkProfile,
              calibrationStatus: editForm.calibrationStatus,
              calibrationDate:
                editForm.calibrationStatus === "calibrated" ? editForm.calibrationDate : "",
              calibrationNote: editForm.calibrationNote,
              installedAt: editForm.installedAt,
              lastInspection: editForm.lastInspection,
              faults: editForm.faults,
              inspector: editForm.inspector,
            }
          : d,
      ),
    );

    const changed: string[] = [];
    if (prev) {
      if (prev.lat !== editForm.lat || prev.lng !== editForm.lng) changed.push("coordinates");
      if (prev.purok !== editForm.purok) changed.push("purok");
      if (prev.type !== editForm.type) changed.push("type");
      if (prev.name !== editForm.name) changed.push("device name");
      if (prev.location !== editForm.location) changed.push("installation location");
      if (prev.firmware !== editForm.firmware) changed.push("firmware");
      if (prev.installedBy !== editForm.installedBy) changed.push("installed by");
      if (prev.powerSource !== editForm.powerSource) changed.push("power source");
      if (prev.connectivityType !== editForm.connectivityType) changed.push("connectivity type");
      if (prev.networkProfile !== editForm.networkProfile) changed.push("network profile");
      if (prev.calibrationStatus !== editForm.calibrationStatus) changed.push("calibration status");
      if (prev.calibrationDate !== editForm.calibrationDate) changed.push("calibration date");
      if (prev.calibrationNote !== editForm.calibrationNote) changed.push("calibration note");
      if (prev.installedAt !== editForm.installedAt) changed.push("installation date");
      if (prev.lastInspection !== editForm.lastInspection) changed.push("last inspection");
      if (prev.faults !== editForm.faults) changed.push("reported faults/replacements");
      if (prev.inspector !== editForm.inspector) changed.push("inspector");
    }
    const detail = changed.length ? ` (${changed.join(", ")})` : "";
    pushAuditLog("Device Updated", `Updated device ${editId}${detail}`);

    setEditId(null);
    setModalMessage({ title: "Device Updated", message: `Updated "${editId}"` });
  }

  function decommissionDevice(id: string) {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              enabled: false,
              decommissionedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
            }
          : d,
      ),
    );
    pushAuditLog(
      "Device Decommissioned",
      `Decommissioned device ${id} — node disabled; record and historical telemetry/alert/audit data retained (§10.1)`,
    );
    setModalMessage({
      title: "Device Decommissioned",
      message: `"${id}" decommissioned. The node is disabled and removed from the map, but its record and operational history are retained for the audit trail — they are never destroyed through the UI (§10.1).`,
    });
  }

  function toggleEnable(id: string) {
    const dev = devices.find((d) => d.id === id);
    if (!dev) return;
    const next = !dev.enabled;
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, enabled: next } : d)),
    );
    pushAuditLog(
      next ? "Device Enabled" : "Device Disabled",
      `${next ? "Enabled" : "Disabled"} device ${id}`,
    );
    if (next && dev.credentialStatus === "revoked") {
      setModalMessage({
        title: "Device Enabled — Credentials Blocked",
        message: `${id} is powered on, but its credentials are revoked. It cannot reconnect until a new credential is provisioned.`,
      });
    }
  }

  function rotateCredentials(dev: Device) {
    if (credRotating) return;
    setRotateConfirmId(null);
    setCredRotated(null);
    setCredRotating({ deviceId: dev.id, step: 0 });

    setTimeout(() => {
      setCredRotating({ deviceId: dev.id, step: 1 });
    }, 330);

    setTimeout(() => {
      setCredRotating({ deviceId: dev.id, step: 2 });
    }, 660);

    setTimeout(() => {
      const newCredential = generateCredential();
      const newMasked = maskCredential(newCredential);
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const prevStatus = dev.credentialStatus;
      setDevices((prev) =>
        prev.map((d) =>
          d.id === dev.id
            ? {
                ...d,
                credentialStatus: "active",
                credMasked: newMasked,
                lastRotated: now,
                credentialGeneration: (d.credentialGeneration ?? 1) + 1,
              }
            : d
        )
      );
      pushAuditLog(
        "Credential Rotated",
        `Rotated enrollment credential for device ${dev.id} — previous status: ${prevStatus}, new status: active, result: Successful — new credential generated (masked); previous credential invalidated. Device must use the new credential to reconnect.`
      );
      setCredRotating(null);
      setCredRotated({
        deviceId: dev.id,
        prevMasked: dev.credMasked,
        newMasked,
      });
    }, 1000);
  }

  function provisionCredentials(dev: Device) {
    if (credProvisioning) return;
    setProvisionConfirmId(null);
    setCredProvisioned(null);
    setCredProvisioning({ deviceId: dev.id, step: 0 });

    setTimeout(() => {
      setCredProvisioning({ deviceId: dev.id, step: 1 });
    }, 330);

    setTimeout(() => {
      setCredProvisioning({ deviceId: dev.id, step: 2 });
    }, 660);

    setTimeout(() => {
      const credential = generateCredential();
      const masked = maskCredential(credential);
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const prevStatus = dev.credentialStatus;
      setDevices((prev) =>
        prev.map((d) =>
          d.id === dev.id
            ? {
                ...d,
                credentialStatus: "active",
                credMasked: masked,
                credentialProvisionedAt: now,
                credentialGeneration: 1,
              }
            : d
        )
      );
      pushAuditLog(
        "Credential Provisioned",
        `Provisioned enrollment credential for device ${dev.id} — previous status: ${prevStatus}, new status: active, result: Successful — new unique credential generated and associated with the device (masked); registration did not create a credential.`
      );
      setCredProvisioning(null);
      setCredProvisioned({ deviceId: dev.id, masked });
    }, 1000);
  }

  function revokeCredentials(dev: Device) {
    setRevokeConfirmId(null);
    const prevStatus = dev.credentialStatus;
    setDevices((prev) =>
      prev.map((d) => (d.id === dev.id ? { ...d, credentialStatus: "revoked" } : d))
    );
    pushAuditLog("Credential Revoked", `Revoked enrollment credential for device ${dev.id} — previous status: ${prevStatus}, new status: revoked, result: Successful — device blocked from authenticating until a new credential is provisioned.`);
    setModalMessage({
      title: "Credentials Revoked",
      message: `${dev.id} credentials revoked. The device is blocked from authenticating — even if re-enabled — until a new credential is provisioned.`,
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <style>{`
        .db-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .db-scroll::-webkit-scrollbar-track { background: transparent; }
        .db-scroll::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
        .db-scroll { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
      `}</style>

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">
            IoT Hardware Provisioning
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Register devices, monitor health, and configure sensor thresholds
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5">
          <div>
            <DeviceRegistrationSection
              hardwareType={hardwareType}
              onHardwareTypeChange={(v) => {
                setHardwareType(v);
                setDeviceId(generateUniqueDeviceId(v, purok, devices));
                setRegErrors((prev) => ({
                  ...prev,
                  deviceName: prev.deviceName === "Select a hardware type." ? undefined : prev.deviceName,
                  deviceId: undefined,
                }));
              }}
              deviceName={deviceName}
              onDeviceNameChange={setDeviceName}
              deviceId={deviceId}
              onDeviceIdChange={setDeviceId}
              onRegenerateDeviceId={() => {
                setDeviceId(generateUniqueDeviceId(hardwareType, purok, devices));
                setRegErrors((prev) => ({ ...prev, deviceId: undefined }));
              }}
              serialNumber={serialNumber}
              onSerialNumberChange={setSerialNumber}
              mac={mac}
              onMacChange={setMac}
              onSimulateMac={() => {
                setMac(simulateMac());
                setRegErrors((prev) => ({ ...prev, mac: undefined }));
              }}
              purok={purok}
              onPurokChange={(v) => {
                setPurok(v);
                setDeviceId(generateUniqueDeviceId(hardwareType, v, devices));
                setRegErrors((prev) => ({
                  ...prev,
                  purok: undefined,
                  deviceId: undefined,
                }));
              }}
              installationLocation={installationLocation}
              onInstallationLocationChange={setInstallationLocation}
              lat={lat}
              onLatChange={setLat}
              lng={lng}
              onLngChange={setLng}
              pickingPin={pickingPin}
              onTogglePickingPin={() => setPickingPin((p) => !p)}
              installedAt={installedAt}
              onInstalledAtChange={setInstalledAt}
              installedBy={installedBy}
              onInstalledByChange={setInstalledBy}
              powerSource={powerSource}
              onPowerSourceChange={setPowerSource}
              firmware={firmware}
              onFirmwareChange={setFirmware}
              connectivityType={connectivityType}
              onConnectivityTypeChange={setConnectivityType}
              networkProfile={networkProfile}
              onNetworkProfileChange={setNetworkProfile}
              calibrationStatus={calibrationStatus}
              onCalibrationStatusChange={(v) => {
                setCalibrationStatus(v);
                if (v !== "calibrated") {
                  setCalibrationDate("");
                  setRegErrors((prev) => ({ ...prev, calibrationDate: undefined }));
                }
              }}
              calibrationDate={calibrationDate}
              onCalibrationDateChange={setCalibrationDate}
              calibrationNote={calibrationNote}
              onCalibrationNoteChange={setCalibrationNote}
              errors={regErrors}
              onRegister={handleRegister}
              onReset={resetRegistrationForm}
            />
          </div>

          <DeviceMapSection
            devices={devices}
            pickingPin={pickingPin}
            onMapClick={handleMapClick}
            mapRef={mapRef}
          />
        </div>

        <DeviceTableSection
          devices={devices}
          onView={(d) => setViewId(d.id)}
          onEdit={openEdit}
          onToggleEnable={toggleEnable}
          onDecommission={(d) => setDecommissionConfirmId(d.id)}
          onRotate={(d) => setRotateConfirmId(d.id)}
          onProvision={(d) => setProvisionConfirmId(d.id)}
          onRevoke={(d) => setRevokeConfirmId(d.id)}
        />

        <div className="mt-5">
          <ConnectionTestSection
            devices={devices}
            testingDevice={testingDevice}
            pingResult={pingResult}
            onTestConnection={handleTestConnection}
          />
        </div>

        <div className="mt-5">
          <ThresholdSection
            smokeThreshold={smokeThreshold}
            onSmokeChange={setSmokeThreshold}
            decibelThreshold={decibelThreshold}
            onDecibelChange={setDecibelThreshold}
            smokePersistence={smokePersistence}
            onSmokePersistenceChange={setSmokePersistence}
            decibelPersistence={decibelPersistence}
            onDecibelPersistenceChange={setDecibelPersistence}
            justification={justification}
            onJustificationChange={setJustification}
            onRevert={() => {
              setSmokeThreshold(DEFAULT_THRESHOLDS.smoke);
              setDecibelThreshold(DEFAULT_THRESHOLDS.decibel);
              setSmokePersistence(DEFAULT_THRESHOLDS.smokePersistence);
              setDecibelPersistence(DEFAULT_THRESHOLDS.decibelPersistence);
              pushAuditLog(
                "Configuration Change",
                `Reverted global thresholds to defaults (smoke: ${DEFAULT_THRESHOLDS.smoke} rel., decibel: ${DEFAULT_THRESHOLDS.decibel} rel., smoke persistence: ${DEFAULT_THRESHOLDS.smokePersistence}s, decibel persistence: ${DEFAULT_THRESHOLDS.decibelPersistence}s)`,
              );
            }}
            onApply={() => {
              pushAuditLog(
                "Configuration Change",
                `Updated global thresholds — smoke: ${smokeThreshold} (relative), decibel: ${decibelThreshold} (relative), smoke persistence: ${smokePersistence}s, decibel persistence: ${decibelPersistence}s — justification: ${justification.trim()}`,
              );
              setModalMessage({
                title: "Thresholds Updated",
                message: "Thresholds applied to all matching sensors. Change recorded with the documented-testing justification (§5.9).",
              });
            }}
          />
        </div>

        {editId && (
          <EditDeviceModal
            editId={editId}
            editForm={editForm}
            device={devices.find((d) => d.id === editId) || null}
            onEditFormChange={setEditForm}
            onSave={saveEdit}
            onClose={() => setEditId(null)}
          />
        )}

        {viewId && (() => {
          const dev = devices.find((d) => d.id === viewId);
          if (!dev) return null;
          return (
            <DeviceDetailModal device={dev} onClose={() => setViewId(null)} />
          );
        })()}

        {rotateConfirmId && (() => {
          const dev = devices.find((d) => d.id === rotateConfirmId);
          if (!dev) return null;
          return (
            <RotateConfirmModal
              device={dev}
              onConfirm={() => rotateCredentials(dev)}
              onClose={() => setRotateConfirmId(null)}
            />
          );
        })()}

        {provisionConfirmId && (() => {
          const dev = devices.find((d) => d.id === provisionConfirmId);
          if (!dev) return null;
          return (
            <ProvisionCredentialModal
              device={dev}
              onConfirm={() => provisionCredentials(dev)}
              onClose={() => setProvisionConfirmId(null)}
            />
          );
        })()}

        {revokeConfirmId && (() => {
          const dev = devices.find((d) => d.id === revokeConfirmId);
          if (!dev) return null;
          return (
            <RevokeCredentialModal
              device={dev}
              onConfirm={() => revokeCredentials(dev)}
              onClose={() => setRevokeConfirmId(null)}
            />
          );
        })()}

        {credRotating && (
          <CredentialProcessingModal
            title="Rotating Device Credential..."
            deviceId={credRotating.deviceId}
            steps={ROTATION_STEPS}
            step={credRotating.step}
          />
        )}

        {credProvisioning && (
          <CredentialProcessingModal
            title="Provisioning Device Credential..."
            deviceId={credProvisioning.deviceId}
            steps={PROVISION_STEPS}
            step={credProvisioning.step}
          />
        )}

        {credRotated && (
          <CredentialsRotatedModal
            deviceId={credRotated.deviceId}
            prevMasked={credRotated.prevMasked}
            newMasked={credRotated.newMasked}
            onClose={() => setCredRotated(null)}
          />
        )}

        {credProvisioned && (
          <CredentialProvisionedModal
            deviceId={credProvisioned.deviceId}
            masked={credProvisioned.masked}
            onClose={() => setCredProvisioned(null)}
          />
        )}

        {registeredDevice && (
          <DeviceRegisteredModal
            device={registeredDevice}
            onClose={() => setRegisteredDevice(null)}
          />
        )}

        {decommissionConfirmId && (
          <ConfirmModal
            type="confirm"
            title="Confirm Decommission"
            message={`Decommission device "${decommissionConfirmId}"? The node is disabled and removed from the map, but its record and historical telemetry / alert / audit data are retained for the audit trail and never destroyed (§10.1).`}
            confirmLabel="Decommission"
            onConfirm={() => {
              decommissionDevice(decommissionConfirmId);
              setDecommissionConfirmId(null);
            }}
            onClose={() => setDecommissionConfirmId(null)}
          />
        )}

        {modalMessage && (
          <ConfirmModal
            title={modalMessage.title}
            message={modalMessage.message}
            onClose={() => setModalMessage(null)}
          />
        )}
      </main>
    </div>
  );
}
