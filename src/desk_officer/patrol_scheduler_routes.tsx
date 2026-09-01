import { useState } from "react";
import {
  CalendarDays,
  Users,
  Map,
  MapPin,
  CheckCircle2,
  Navigation,
  Clock,
  Radio,
  Activity,
  Shield,
  AlertTriangle,
  Wifi,
  WifiOff,
  Upload,
  RefreshCw,
  ImageIcon,
  FileText,
  Hand,
  ShieldAlert,
  ShieldCheck,
  Bell,
  Eye,
  ChevronDown,
  AlertCircle,
  Link as LinkIcon,
  Plus,
  Edit3,
  X,
  Copy,
  UserPlus,
  PenTool,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_ZONES } from "../constants/purok";
import { pushAuditLog } from "../utils/auditLog";
import { Modal } from "../components/ui";
import { SHIFT_SCHEDULE } from "./constants";

/* -------------------------------------------------------------------------- */
/*                              TYPES & INTERFACES                            */
/* -------------------------------------------------------------------------- */

interface Checkpoint {
  id: string;
  name: string;
  purok: string;
  team: string;
  status: "cleared" | "pending" | "missed";
  radius: number;
  lat: number;
  lng: number;
  time: string | null;
  clearedBy?: "gps" | "manual";
  clearReason?: string;
  clearedByPerson?: string;
  missedReason?: string;
  verificationDistance?: number;
  gpsAccuracy?: number;
  deviceId?: string;
}

interface ManualConfirmationRecord {
  id: string;
  checkpointId: string;
  checkpointName: string;
  shiftId: string;
  team: string;
  officer: string;
  reason: string;
  timestamp: string;
  note?: string;
}

interface PatrolUpdate {
  id: string;
  type: string;
  status: "submitted" | "reviewed";
  team: string;
  tanod: string;
  shiftId: string;
  purok: string;
  timestamp: string;
  note: string;
  incidentId?: string;
  incidentCategory?: string;
  incidentPriority?: string;
  incidentStatus?: string;
  locationAvailable?: boolean;
  hasAttachment?: boolean;
}

interface VerificationIssue {
  id: string;
  type: string;
  team: string;
  checkpointId: string;
  description: string;
  timestamp: string;
  status: "open" | "reviewed";
}

interface Team {
  id: string;
  name: string;
  members: string[];
  leader: string;
  leaderId?: string;
  memberIds?: string[];
  routeId?: string;
  shift: string;
  route: string;
  status: "on_patrol" | "standby";
  checkpoints: string;
  createdBy?: string;
  createdAt?: string;
}

interface PatrolShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  teamId?: string;
  tanodIds?: string[];
  teamLeaderId?: string;
  routeId: string;
  dayOfWeek?: DayOfWeek;
  checkpointIds?: string[];
  status: "Scheduled" | "Active" | "Completed" | "Cancelled" | "Missed";
  notes: string;
  published?: boolean;
  createdBy?: string;
  createdAt?: string;
}

interface PatrolNotification {
  id: string;
  type: string;
  team: string;
  message: string;
  timestamp: string;
  read: boolean;
  deliveryStatus: "queued" | "sent" | "delivered" | "failed";
  retryCount?: number;
}

interface PatrolAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  actor: string;
}

interface PatrolActivityEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  team?: string;
  checkpointId?: string;
}

interface Tanod {
  id: string;
  name: string;
  rank: "Tanod" | "Sr. Tanod" | "Tanod Chief";
  purok: string;
  phone: string;
  available: boolean;
}

interface OfflineRecord {
  id: string;
  localId: string;
  type: string;
  team: string;
  deviceId: string;
  createdAt: string;
  syncStatus: "pending" | "syncing" | "synced" | "failed" | "conflict";
  serverId?: string;
  note: string;
  retryCount?: number;
}

type ShiftStatus = PatrolShift["status"];
type ClearTarget = { id: string; mode: "clear" | "missed_reason" } | null;
type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

const PATROL_COVERAGE_WARNING_THRESHOLD = 0.5;

const SHIFT_STATUS_STYLES: Record<ShiftStatus, string> = {
  Scheduled: "bg-sky-100 text-sky-700",
  Active: "bg-emerald-100 text-emerald-700",
  Completed: "bg-blue-100 text-blue-700",
  Cancelled: "bg-stone-100 text-stone-500",
  Missed: "bg-rose-100 text-rose-600",
};

const MANUAL_CLEAR_REASONS = [
  { id: "emergency_response", label: "Emergency response assignment" },
  { id: "weather", label: "Weather or environmental condition" },
  { id: "device_failure", label: "Device failure" },
  { id: "network_failure", label: "Network failure" },
  { id: "route_obstruction", label: "Route obstruction" },
  { id: "operational_change", label: "Approved operational change" },
  { id: "other", label: "Other" },
] as const;

// MISSED_REASONS was identical to MANUAL_CLEAR_REASONS and unused — removed

const PATROL_UPDATE_TYPES = [
  "Arrived at area",
  "Checkpoint issue",
  "Safety observation",
  "Assistance requested",
  "Incident response started",
  "Incident response completed",
  "Equipment or route problem",
];

const DAYS_OF_WEEK: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SHIFT_TIME_SLOTS = [
  { label: "Morning (06:00–14:00)", start: "06:00", end: "14:00" },
  { label: "Afternoon (14:00–22:00)", start: "14:00", end: "22:00" },
  { label: "Night (22:00–06:00)", start: "22:00", end: "06:00" },
] as const;

const VERIFICATION_ISSUE_REASONS = [
  "Location permission denied",
  "GPS signal unavailable",
  "Location accuracy insufficient",
  "Network unavailable",
  "Checkpoint outside permitted radius",
  "Shift not active",
  "Checkpoint already completed",
];

const NOTIFICATION_TYPES = [
  "New shift assignment",
  "Shift change",
  "Shift start reminder",
  "High-priority incident assigned",
  "Missed checkpoint",
  "Manual confirmation request",
  "Route cancellation/change",
  "GPS/location-permission problem",
];

/* -------------------------------------------------------------------------- */
/*                              MOCK DATA                                     */
/* -------------------------------------------------------------------------- */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function purokPolyline(points: [number, number][]) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - oneJan.getTime()) / 86400000);
  return Math.ceil((days + oneJan.getDay() + 1) / 7);
}

function getNextWeekDates(): { date: string; day: DayOfWeek }[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  return DAYS_OF_WEEK.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      day,
    };
  });
}

// SHIFT_SCHEDULE is imported from ./constants

const INITIAL_TEAMS: Team[] = [
  { id: "t1", name: "Team Alpha", members: ["J. Ramos", "M. Cruz", "A. Bautista", "L. Reyes"], leader: "J. Ramos", leaderId: "T01", memberIds: ["T01", "T02", "T03", "T04"], routeId: "R1", shift: "Mon AM · Thu PM", route: "R1 Market Perimeter", status: "on_patrol", checkpoints: "3/4", createdBy: "Desk Officer M. Santos", createdAt: "2026-07-01T08:00:00" },
  { id: "t2", name: "Team Bravo", members: ["S. Torres", "D. Villanueva", "P. Garcia"], leader: "S. Torres", leaderId: "T05", memberIds: ["T05", "T06", "T07"], routeId: "R2", shift: "Tue AM · Sat PM", route: "R2 Commercial Strip", status: "on_patrol", checkpoints: "1/3", createdBy: "Desk Officer M. Santos", createdAt: "2026-07-01T08:00:00" },
  { id: "t3", name: "Team Charlie", members: ["K. Lim", "N. Perez", "R. Aquino", "B. Mendoza"], leader: "K. Lim", leaderId: "T08", memberIds: ["T08", "T09", "T10", "T11"], routeId: "R3", shift: "Wed AM · Sun PM", route: "R3 Chapel Loop", status: "on_patrol", checkpoints: "2/4", createdBy: "Desk Officer M. Santos", createdAt: "2026-07-01T08:00:00" },
  { id: "t4", name: "Team Delta", members: ["C. Navarro", "E. Diaz", "G. Santos"], leader: "C. Navarro", leaderId: "T12", memberIds: ["T12", "T13", "T14"], routeId: "R2", shift: "Thu AM · Sat AM", route: "R2 Commercial Strip", status: "standby", checkpoints: "0/3", createdBy: "Desk Officer M. Santos", createdAt: "2026-07-01T08:00:00" },
];

const ROUTES = [
  { id: "R1", name: "Market Perimeter Sweep", team: "Team Alpha", zones: ["Purok 1", "Purok 3"], risk: "high", active: true, duration: "45 min", points: [[150, 160], [95, 190], [80, 70]] as [number, number][] },
  { id: "R2", name: "Commercial Strip Patrol", team: "Team Bravo", zones: ["Purok 4", "Purok 6"], risk: "medium", active: true, duration: "35 min", points: [[250, 185], [330, 260]] as [number, number][] },
  { id: "R3", name: "Chapel Residential Loop", team: "Team Charlie", zones: ["Purok 5"], risk: "medium", active: false, duration: "40 min", points: [[85, 305], [150, 160]] as [number, number][] },
];

const INITIAL_CHECKPOINTS: Checkpoint[] = [
  { id: "CP-01", name: "Plaza Junction", purok: "Purok 3", team: "Team Alpha", status: "cleared", radius: 25, lat: 150, lng: 160, time: "2026-07-20T09:40:00", clearedBy: "gps", verificationDistance: 12, gpsAccuracy: 8, deviceId: "TANOD-A01" },
  { id: "CP-02", name: "Market Entrance", purok: "Purok 3", team: "Team Alpha", status: "cleared", radius: 30, lat: 95, lng: 190, time: "2026-07-20T09:52:00", clearedBy: "gps", verificationDistance: 18, gpsAccuracy: 12, deviceId: "TANOD-A01" },
  { id: "CP-07", name: "River Walk Bridge", purok: "Purok 1", team: "Team Alpha", status: "cleared", radius: 25, lat: 60, lng: 120, time: "2026-07-20T09:10:00", clearedBy: "manual", clearReason: "Route obstruction" },
  { id: "CP-03", name: "Gate Sensor Post", purok: "Purok 1", team: "Team Alpha", status: "pending", radius: 25, lat: 80, lng: 70, time: null },
  { id: "CP-04", name: "Chapel Area", purok: "Purok 5", team: "Team Charlie", status: "pending", radius: 20, lat: 85, lng: 305, time: null },
  { id: "CP-05", name: "School District", purok: "Purok 4", team: "Team Bravo", status: "cleared", radius: 25, lat: 250, lng: 185, time: "2026-07-20T08:30:00", clearedBy: "gps", verificationDistance: 15, gpsAccuracy: 10, deviceId: "TANOD-B01" },
  { id: "CP-06", name: "Commercial Strip", purok: "Purok 6", team: "Team Bravo", status: "missed", radius: 30, lat: 330, lng: 260, time: null, missedReason: "Network failure" },
];

const INITIAL_SHIFTS: PatrolShift[] = [
  { id: "PS-101", date: todayISO(), startTime: "06:00", endTime: "14:00", team: "Team Alpha", teamId: "t1", tanodIds: ["T01", "T02", "T03", "T04"], teamLeaderId: "T01", routeId: "R1", dayOfWeek: "Mon", checkpointIds: ["CP-01", "CP-02", "CP-07", "CP-03"], status: "Active", notes: "Market perimeter sweep", published: true, createdBy: "Desk Officer M. Santos", createdAt: "2026-07-15T08:00:00" },
  { id: "PS-102", date: todayISO(), startTime: "06:00", endTime: "14:00", team: "Team Bravo", teamId: "t2", tanodIds: ["T05", "T06", "T07"], teamLeaderId: "T05", routeId: "R2", dayOfWeek: "Mon", checkpointIds: ["CP-05", "CP-06"], status: "Active", notes: "", published: true, createdBy: "Desk Officer M. Santos", createdAt: "2026-07-15T08:00:00" },
  { id: "PS-103", date: todayISO(), startTime: "14:00", endTime: "22:00", team: "Team Delta", teamId: "t4", tanodIds: ["T12", "T13", "T14"], teamLeaderId: "T12", routeId: "R2", dayOfWeek: "Mon", checkpointIds: ["CP-05", "CP-06"], status: "Scheduled", notes: "Commercial strip evening sweep", published: true, createdBy: "Desk Officer M. Santos", createdAt: "2026-07-15T08:00:00" },
];

const PUROK_PRESENCE = [
  { zone: "Purok 1", pct: 100 },
  { zone: "Purok 2", pct: 25 },
  { zone: "Purok 3", pct: 100 },
  { zone: "Purok 4", pct: 75 },
  { zone: "Purok 5", pct: 100 },
  { zone: "Purok 6", pct: 66 },
];

const DUTY_CHECKINS = [
  { team: "Team Alpha", time: "2026-07-20T05:58:00", status: "verified", gps: "Barangay Hall — within 12 m" },
  { team: "Team Bravo", time: "2026-07-20T06:02:00", status: "verified", gps: "Barangay Hall — within 15 m" },
  { team: "Team Charlie", time: "2026-07-20T06:00:00", status: "verified", gps: "Barangay Hall — within 9 m" },
  { team: "Team Delta", time: null, status: "off_duty", gps: "Not checked in" },
];

const INITIAL_OFFLINE: OfflineRecord[] = [
  { id: "OS-034", localId: "loc-os034", type: "checkpoint_attempt", team: "Team Delta", deviceId: "TANOD-D01", createdAt: "2026-07-20T09:40:00", syncStatus: "pending", note: "Checkpoint attempt buffered inside dead zone" },
  { id: "OS-033", localId: "loc-os033", type: "patrol_note", team: "Team Delta", deviceId: "TANOD-D01", createdAt: "2026-07-20T09:41:00", syncStatus: "pending", note: "Patrol note captured offline" },
  { id: "OS-032", localId: "loc-os032", type: "incident_update", team: "Team Charlie", deviceId: "TANOD-C01", createdAt: "2026-07-20T08:55:00", syncStatus: "pending", note: "Incident update buffered locally" },
];

const INITIAL_MANUAL_CONFIRMATIONS: ManualConfirmationRecord[] = [
  { id: "MC-001", checkpointId: "CP-07", checkpointName: "River Walk Bridge", shiftId: "PS-101", team: "Team Alpha", officer: "Desk Officer M. Santos", reason: "Route obstruction", timestamp: "2026-07-20T09:10:00", note: "Fallen tree blocking path" },
];

const INITIAL_PATROL_UPDATES: PatrolUpdate[] = [
  { id: "PU-001", type: "Safety observation", status: "submitted", team: "Team Alpha", tanod: "J. Ramos", shiftId: "PS-101", purok: "Purok 3", timestamp: "2026-07-20T20:42:00", note: "Streetlight near checkpoint 4 is not functioning." },
  { id: "PU-002", type: "Checkpoint issue", status: "submitted", team: "Team Bravo", tanod: "S. Torres", shiftId: "PS-102", purok: "Purok 6", timestamp: "2026-07-20T20:37:00", note: "GPS accuracy insufficient at CP-06." },
  { id: "PU-003", type: "Assistance requested", status: "submitted", team: "Team Charlie", tanod: "K. Lim", shiftId: "PS-102", purok: "Purok 5", timestamp: "2026-07-20T20:31:00", note: "Desk Officer assistance requested at Chapel Area." },
  { id: "PU-004", type: "Arrived at area", status: "reviewed", team: "Team Alpha", tanod: "M. Cruz", shiftId: "PS-101", purok: "Purok 1", timestamp: "2026-07-20T20:21:00", note: "Arrived at Gate Sensor Post area." },
  { id: "PU-005", type: "Incident response started", status: "submitted", team: "Team Delta", tanod: "C. Navarro", shiftId: "PS-101", purok: "Purok 4", timestamp: "2026-07-20T20:15:00", note: "Responding to reported disturbance.", incidentId: "INC-2847", incidentCategory: "Public disturbance", incidentPriority: "High", incidentStatus: "Active" },
];

const INITIAL_VERIFICATION_ISSUES: VerificationIssue[] = [
  { id: "VI-001", type: "Location accuracy insufficient", team: "Team Alpha", checkpointId: "CP-04", description: "GPS accuracy ±38m exceeds checkpoint radius of 25m", timestamp: "2026-07-20T20:42:00", status: "open" },
  { id: "VI-002", type: "Network unavailable", team: "Team Bravo", checkpointId: "CP-06", description: "Unable to submit checkpoint — no network connection", timestamp: "2026-07-20T20:37:00", status: "open" },
  { id: "VI-003", type: "Location permission denied", team: "Team Charlie", checkpointId: "CP-04", description: "Location permission unavailable on device", timestamp: "2026-07-20T20:31:00", status: "open" },
];

const INITIAL_NOTIFICATIONS: PatrolNotification[] = [
  { id: "PN-001", type: "New shift assignment", team: "Team Alpha", message: "Shift PS-101 assigned — Market Perimeter Sweep", timestamp: "2026-07-20T05:30:00", read: false, deliveryStatus: "delivered" },
  { id: "PN-002", type: "Missed checkpoint", team: "Team Bravo", message: "Checkpoint CP-06 missed — Commercial Strip", timestamp: "2026-07-20T20:35:00", read: false, deliveryStatus: "delivered" },
  { id: "PN-003", type: "GPS/location-permission problem", team: "Team Charlie", message: "GPS permission problem reported at CP-04", timestamp: "2026-07-20T20:31:00", read: false, deliveryStatus: "sent" },
  { id: "PN-004", type: "Manual confirmation request", team: "Team Alpha", message: "Manual confirmation requested for CP-07", timestamp: "2026-07-20T20:10:00", read: true, deliveryStatus: "delivered" },
];

const INITIAL_PATROL_AUDIT: PatrolAuditEntry[] = [
  { id: "PA-001", timestamp: "2026-07-20T05:15:00", action: "Week published", details: "Week 30 published — 14 shifts, 6 teams", actor: "Desk Officer M. Santos" },
  { id: "PA-002", timestamp: "2026-07-20T05:20:00", action: "Shift started", details: "PS-101 started — Team Alpha", actor: "System" },
  { id: "PA-003", timestamp: "2026-07-20T05:20:00", action: "Shift started", details: "PS-102 started — Team Bravo", actor: "System" },
  { id: "PA-004", timestamp: "2026-07-20T09:10:00", action: "Manual confirmation", details: "CP-07 manually confirmed — Route obstruction", actor: "Desk Officer M. Santos" },
  { id: "PA-005", timestamp: "2026-07-20T09:40:00", action: "Missed reason added", details: "CP-06 missed — Network failure", actor: "System" },
];

const INITIAL_PATROL_ACTIVITY: PatrolActivityEntry[] = [
  { id: "PH-001", timestamp: "2026-07-20T20:43:00", actor: "Desk Officer", action: "Manually confirmed CP-04", details: "Reason: GPS accuracy insufficient", team: "Team Alpha", checkpointId: "CP-04" },
  { id: "PH-002", timestamp: "2026-07-20T20:31:00", actor: "Team Alpha", action: "Checkpoint CP-03 GPS verified", details: "Distance: 21m · Accuracy: ±12m", team: "Team Alpha", checkpointId: "CP-03" },
  { id: "PH-003", timestamp: "2026-07-20T20:21:00", actor: "Team Alpha", action: "Patrol started", details: "Shift PS-101 commenced", team: "Team Alpha" },
  { id: "PH-004", timestamp: "2026-07-20T05:15:00", actor: "Desk Officer", action: "Shift PS-101 published", details: "Week 30 — Market Perimeter Sweep", team: "Team Alpha" },
];

const TANOD_ROSTER: Tanod[] = [
  { id: "T01", name: "J. Ramos", rank: "Tanod Chief", purok: "Purok 3", phone: "0917-100-0001", available: true },
  { id: "T02", name: "M. Cruz", rank: "Sr. Tanod", purok: "Purok 3", phone: "0917-100-0002", available: true },
  { id: "T03", name: "A. Bautista", rank: "Tanod", purok: "Purok 1", phone: "0917-100-0003", available: true },
  { id: "T04", name: "L. Reyes", rank: "Tanod", purok: "Purok 1", phone: "0917-100-0004", available: true },
  { id: "T05", name: "S. Torres", rank: "Tanod Chief", purok: "Purok 4", phone: "0917-100-0005", available: true },
  { id: "T06", name: "D. Villanueva", rank: "Sr. Tanod", purok: "Purok 6", phone: "0917-100-0006", available: true },
  { id: "T07", name: "P. Garcia", rank: "Tanod", purok: "Purok 4", phone: "0917-100-0007", available: true },
  { id: "T08", name: "K. Lim", rank: "Tanod Chief", purok: "Purok 5", phone: "0917-100-0008", available: true },
  { id: "T09", name: "N. Perez", rank: "Sr. Tanod", purok: "Purok 5", phone: "0917-100-0009", available: true },
  { id: "T10", name: "R. Aquino", rank: "Tanod", purok: "Purok 2", phone: "0917-100-0010", available: true },
  { id: "T11", name: "B. Mendoza", rank: "Tanod", purok: "Purok 2", phone: "0917-100-0011", available: true },
  { id: "T12", name: "C. Navarro", rank: "Tanod Chief", purok: "Purok 4", phone: "0917-100-0012", available: true },
  { id: "T13", name: "E. Diaz", rank: "Sr. Tanod", purok: "Purok 6", phone: "0917-100-0013", available: true },
  { id: "T14", name: "G. Santos", rank: "Tanod", purok: "Purok 6", phone: "0917-100-0014", available: true },
];

/* -------------------------------------------------------------------------- */
/*                            SUB-COMPONENTS                                  */
/* -------------------------------------------------------------------------- */

function ReasonModal({
  cp,
  mode,
  onClose,
  onConfirm,
}: {
  cp: Checkpoint;
  mode: "clear" | "missed_reason";
  onClose: () => void;
  onConfirm: (id: string, reason: string, officer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [officer, setOfficer] = useState("Desk Officer");
  const [touched, setTouched] = useState(false);

  const otherSelected = selected === "other";
  const reason = otherSelected ? other.trim() : MANUAL_CLEAR_REASONS.find((r) => r.id === selected)?.label ?? "";
  const valid = reason.length > 0;

  const isClear = mode === "clear";

  function submit() {
    setTouched(true);
    if (!valid) return;
    onConfirm(cp.id, reason, officer.trim() || "Desk Officer");
  }

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<ShieldAlert size={18} />}
      iconClass={isClear ? "bg-amber-100 text-amber-600" : "bg-violet-100 text-violet-600"}
      title={isClear ? `Manual confirmation — ${cp.name}` : `Missed reason — ${cp.name}`}
      subtitle={`${cp.team} · ${cp.purok} · ${cp.radius} m radius`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold text-white transition ${isClear ? "bg-amber-500 hover:bg-amber-600" : "bg-violet-600 hover:bg-violet-700"} ${!valid ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {isClear ? "Confirm Manual Clear" : "Record Reason"}
          </button>
        </div>
      }
    >
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] text-amber-800">
        {isClear
          ? "This checkpoint is being cleared manually. It will be recorded as a manual override, never as GPS verification. A reason is required."
          : "Annotation only — recording a reason does NOT clear this checkpoint or change its Missed status."}
      </div>

      {isClear && (
        <label className="mb-3 block">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">CONFIRMING OFFICER</span>
          <input
            value={officer}
            onChange={(e) => setOfficer(e.target.value)}
            placeholder="e.g., Desk Officer M. Santos"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-amber-400"
          />
        </label>
      )}

      <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">
        {isClear ? "SELECT A REASON" : "WHY WAS THIS CHECKPOINT MISSED?"}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MANUAL_CLEAR_REASONS.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setSelected(r.id);
              setTouched(false);
            }}
            className={`rounded-lg border px-3 py-2 text-left text-[11px] font-medium transition ${selected === r.id ? "border-amber-500 bg-amber-50 text-amber-800" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {otherSelected && (
        <input
          autoFocus
          value={other}
          onChange={(e) => {
            setOther(e.target.value);
            setTouched(false);
          }}
          placeholder="Enter a reason…"
          className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-amber-400"
        />
      )}

      {touched && !valid && <p className="mt-2 text-[10px] font-medium text-rose-600">A reason is required before confirming.</p>}
    </Modal>
  );
}

function PatrolUpdateDetailsModal({ update, onClose }: { update: PatrolUpdate; onClose: () => void }) {
  return (
    <Modal
      size="xl"
      onClose={onClose}
      icon={<FileText size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      title={`Patrol Update ${update.id}`}
      subtitle={`${update.type} · ${update.team}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">UPDATE</p>
            <p className="text-[12px] font-medium text-stone-800">{update.id}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">TYPE</p>
            <p className="text-[12px] font-medium text-stone-800">{update.type}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">TIMESTAMP</p>
            <p className="text-[12px] font-medium text-stone-800">{formatTime(update.timestamp)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">STATUS</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${update.status === "reviewed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
              {update.status === "reviewed" ? "Reviewed" : "Submitted"}
            </span>
          </div>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-400">PATROL</p>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-stone-400">Shift ID</p>
              <p className="text-[11px] font-medium text-stone-800">{update.shiftId}</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400">Team</p>
              <p className="text-[11px] font-medium text-stone-800">{update.team}</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400">Tanod</p>
              <p className="text-[11px] font-medium text-stone-800">{update.tanod}</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400">Purok</p>
              <p className="text-[11px] font-medium text-stone-800">{update.purok}</p>
            </div>
          </div>
        </div>

        {update.incidentId && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">INCIDENT</p>
            <div className="mt-1 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-stone-400">Incident ID</p>
                  <p className="text-[11px] font-medium text-stone-800">{update.incidentId}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400">Category</p>
                  <p className="text-[11px] font-medium text-stone-800">{update.incidentCategory}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400">Priority</p>
                  <p className="text-[11px] font-medium text-stone-800">{update.incidentPriority}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400">Status</p>
                  <p className="text-[11px] font-medium text-stone-800">{update.incidentStatus}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!update.incidentId && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">INCIDENT</p>
            <p className="text-[11px] text-stone-400 italic">No linked incident</p>
          </div>
        )}

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-400">LOCATION</p>
          {update.locationAvailable ? (
            <p className="text-[11px] text-stone-600">Location data available for this update</p>
          ) : (
            <p className="text-[11px] text-stone-400 italic">No location data for this update</p>
          )}
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-400">NOTE</p>
          <p className="text-[12px] text-stone-700">{update.note}</p>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-400">ATTACHMENTS</p>
          {update.hasAttachment ? (
            <div className="mt-1 flex items-center gap-2">
              <ImageIcon size={14} className="text-[#0038A8]" />
              <span className="text-[11px] text-stone-600">Photo attachment available</span>
            </div>
          ) : (
            <p className="text-[11px] text-stone-400 italic">No attachments</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ManualConfirmReviewPanel({ confirmations, onClose }: { confirmations: ManualConfirmationRecord[]; onClose: () => void }) {
  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<Hand size={18} />}
      iconClass="bg-violet-100 text-violet-600"
      title="Manual Confirmations"
      subtitle="Review manual checkpoint overrides"
    >
      <div className="space-y-3">
        {confirmations.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-[12px] font-medium text-stone-500">No manual confirmations recorded</p>
          </div>
        ) : (
          confirmations.map((c) => (
            <div key={c.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-900">{c.checkpointName}</span>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600">
                  <Hand size={8} className="mr-1 inline" />Manual
                </span>
              </div>
              <p className="mt-1 text-[10px] text-stone-500">{c.team} · {c.shiftId}</p>
              <p className="text-[10px] text-stone-500">Reason: {c.reason}</p>
              <p className="text-[10px] text-stone-400">Confirmed by {c.officer} · {formatTime(c.timestamp)}</p>
              {c.note && <p className="mt-1 text-[10px] italic text-stone-400">{c.note}</p>}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function VerificationIssuesPanel({ issues, onReview }: { issues: VerificationIssue[]; onReview: (id: string) => void }) {
  const openIssues = issues.filter((i) => i.status === "open");
  const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
    "Location permission denied": ShieldAlert,
    "GPS signal unavailable": WifiOff,
    "Location accuracy insufficient": AlertTriangle,
    "Network unavailable": WifiOff,
    "Checkpoint outside permitted radius": MapPin,
    "Shift not active": Clock,
    "Checkpoint already completed": CheckCircle2,
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-600" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#334155]">Verification Issues</h3>
            <p className="text-[11px] text-[#94A3B8]">GPS/device problems requiring review</p>
          </div>
        </div>
        {openIssues.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
            <AlertCircle size={10} />
            {openIssues.length} open
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
        {openIssues.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-[12px] font-medium text-stone-500">All verification systems clear</p>
            <p className="text-[10px] text-stone-400">No unresolved GPS or device issues</p>
          </div>
        ) : (
          openIssues.map((issue) => {
            const Icon = TYPE_ICONS[issue.type] || AlertTriangle;
            return (
              <div key={issue.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[11px] font-bold text-stone-900">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                      <Icon size={12} />
                    </span>
                    {issue.type}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">Open</span>
                </div>
                <p className="mt-1 text-[10px] text-stone-500">{issue.team} · {issue.checkpointId}</p>
                <p className="text-[10px] text-stone-500">{issue.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-stone-400">{formatTime(issue.timestamp)}</span>
                  <button
                    onClick={() => onReview(issue.id)}
                    className="flex h-6 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 text-[9px] font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    <Eye size={9} />
                    Review
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NotificationPanel({ notifications, onMarkRead }: { notifications: PatrolNotification[]; onMarkRead: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const DELIVERY_STYLES: Record<string, string> = {
    queued: "bg-stone-100 text-stone-500",
    sent: "bg-sky-100 text-sky-600",
    delivered: "bg-emerald-100 text-emerald-600",
    failed: "bg-rose-100 text-rose-600",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
      >
        <Bell size={13} className="text-[#0038A8]" />
        Notifications
        {unreadCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
            {unreadCount}
          </span>
        )}
        <ChevronDown size={11} className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-[85] mt-2 w-80 rounded-xl border border-stone-200 bg-white shadow-2xl">
            <div className="border-b border-stone-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-bold text-stone-900">Patrol Notifications</h4>
                <span className="text-[10px] text-stone-400">{notifications.length} total</span>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Bell size={16} className="mx-auto mb-1 text-stone-300" />
                  <p className="text-[11px] text-stone-400">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => onMarkRead(n.id)}
                    className={`flex cursor-pointer items-start gap-3 border-b border-stone-50 px-4 py-3 transition hover:bg-stone-50 ${!n.read ? "bg-[#0038A8]/[0.03]" : ""}`}
                  >
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-[#0038A8]" : "bg-stone-200"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-medium ${!n.read ? "text-stone-900" : "text-stone-600"}`}>{n.type}</p>
                      <p className="text-[10px] text-stone-400 truncate">{n.team} · {n.message}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[9px] text-stone-400">{formatTime(n.timestamp)}</span>
                        <span className={`rounded-full px-1.5 py-px text-[8px] font-semibold ${DELIVERY_STYLES[n.deliveryStatus]}`}>
                          {n.deliveryStatus === "failed" ? "Failed" : n.deliveryStatus.charAt(0).toUpperCase() + n.deliveryStatus.slice(1)}
                        </span>
                        {n.deliveryStatus === "failed" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="rounded bg-rose-50 px-1.5 py-px text-[8px] font-semibold text-rose-600 transition hover:bg-rose-100"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RouteMap({ checkpoints, onRequestClear }: { checkpoints: Checkpoint[]; onRequestClear: (id: string) => void }) {
  const [hoveredCp, setHoveredCp] = useState<string | null>(null);

  return (
    <div className="relative h-full min-h-0 rounded-lg border border-stone-200 bg-stone-50">
      <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {PUROK_ZONES.map((zone) => {
          const riskRoute = ROUTES.find((r) => r.zones.includes(zone.name) && r.risk === "high");
          const isHovered = hoveredCp === zone.id;
          return (
            <g key={zone.id}>
              <path
                d={zone.path}
                fill={isHovered ? "#fde8e8" : riskRoute ? "#fef2f2" : "#F8FAFC"}
                stroke={riskRoute ? "#dc2626" : zone.color}
                strokeWidth={riskRoute ? 2 : 1.5}
                strokeOpacity={0.7}
                className="transition-colors duration-200"
              />
              <text x={zone.labelX} y={zone.labelY} textAnchor="middle" fontSize="10" fontWeight="500" fill={zone.color} opacity={0.85} pointerEvents="none" className="select-none">
                {zone.name}
              </text>
              {riskRoute && (
                <text x={zone.labelX} y={zone.labelY + 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#dc2626" pointerEvents="none">
                  HIGH-RISK
                </text>
              )}
            </g>
          );
        })}

        {ROUTES.map((route) => (
          <g key={route.id}>
            <path
              d={purokPolyline(route.points)}
              fill="none"
              stroke={!route.active ? "#a8a29e" : route.risk === "high" ? "#b91c1c" : "#0038A8"}
              strokeWidth={route.active ? 2.5 : 1.5}
              strokeDasharray={route.active ? "7 5" : "3 4"}
              opacity={route.active ? 0.7 : 0.4}
            />
            {route.points.map(([x, y], i) => (
              <circle key={`${route.id}-${i}`} cx={x} cy={y} r={3} fill="#fff" stroke={route.active ? (route.risk === "high" ? "#b91c1c" : "#0038A8") : "#a8a29e"} strokeWidth={1.5} />
            ))}
          </g>
        ))}

        {checkpoints.map((cp) => (
          <g
            key={cp.id}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredCp(cp.id)}
            onMouseLeave={() => setHoveredCp(null)}
            onClick={() => cp.status !== "cleared" && onRequestClear(cp.id)}
          >
            {(cp.status === "pending" || cp.status === "missed") && (
              <circle
                cx={cp.lat}
                cy={cp.lng}
                r={hoveredCp === cp.id ? 16 : 12}
                fill="none"
                stroke={cp.status === "missed" ? "#dc2626" : "#f59e0b"}
                strokeWidth={1.5}
                opacity={0.5}
                className="animate-ping"
              />
            )}
            <circle
              cx={cp.lat}
              cy={cp.lng}
              r={hoveredCp === cp.id ? 10 : 7}
              fill={cp.status === "cleared" ? (cp.clearedBy === "manual" ? "#8b5cf6" : "#10b981") : cp.status === "missed" ? "#dc2626" : "#f59e0b"}
              stroke="white"
              strokeWidth={2}
              className="transition-all duration-200 drop-shadow"
            />
            <text x={cp.lat} y={cp.lng + 2.5} textAnchor="middle" fontSize={cp.status === "cleared" && cp.clearedBy === "manual" ? 5.5 : 7} fontWeight="700" fill="white">
              {cp.status === "cleared" ? (cp.clearedBy === "manual" ? "M" : "✓") : cp.status === "missed" ? "✗" : "•"}
            </text>
          </g>
        ))}
      </svg>

      {hoveredCp && (() => {
        const cp = checkpoints.find((c) => c.id === hoveredCp);
        if (!cp) return null;
        return (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: Math.min(cp.lat + 14, 340), top: Math.max(cp.lng - 40, 10) }}
          >
            <p className="text-[11px] font-semibold text-stone-900">{cp.name}</p>
            <p className="text-[10px] text-stone-500">{cp.team} · {cp.purok}</p>
            {cp.status === "cleared" ? (
              <p className={`text-[10px] font-medium ${cp.clearedBy === "manual" ? "text-violet-600" : "text-emerald-600"}`}>
                {cp.clearedBy === "manual" ? `Manual override — not GPS verified${cp.clearedByPerson ? ` · ${cp.clearedByPerson}` : ""}` : "Cleared — GPS verified"} · {cp.radius} m radius
              </p>
            ) : cp.status === "missed" ? (
              <>
                <p className="text-[10px] font-medium text-rose-600">Missed — Overdue · {cp.radius} m radius</p>
                {cp.missedReason && <p className="mt-0.5 text-[9px] font-medium text-amber-700">Reason: {cp.missedReason}</p>}
              </>
            ) : (
              <p className="text-[10px] font-medium text-amber-600">Pending · {cp.radius} m radius</p>
            )}
            {cp.status === "cleared" && cp.clearedBy === "manual" && cp.clearReason && (
              <p className="mt-0.5 text-[9px] font-medium text-amber-700">Reason: {cp.clearReason}</p>
            )}
          </div>
        );
      })()}

      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
        {ROUTES.map((r) => (
          <span key={r.id} title={r.active ? `${r.name} · ~${r.duration}` : `${r.name} — marked inactive`} className={`flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[9px] font-semibold shadow-sm ${r.active ? (r.risk === "high" ? "text-rose-600" : "text-sky-600") : "text-stone-400"}`}>
            <Navigation size={9} />
            {r.id}
            {!r.active && <span className="rounded-sm bg-stone-200 px-1 text-[8px] font-bold text-stone-500">INACTIVE</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function PresenceMap() {
  const gapZones = PUROK_PRESENCE.filter((p) => p.pct < PATROL_COVERAGE_WARNING_THRESHOLD * 100).map((p) => p.zone);

  return (
    <div className="relative h-full min-h-0 rounded-lg border border-stone-200 bg-stone-50">
      <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {PUROK_ZONES.map((zone) => {
          const isGap = gapZones.includes(zone.name);
          const presence = PUROK_PRESENCE.find((p) => p.zone === zone.name);
          return (
            <g key={zone.id}>
              <path
                d={zone.path}
                fill={isGap ? "#fef2f2" : "#F8FAFC"}
                stroke={isGap ? "#dc2626" : zone.color}
                strokeWidth={isGap ? 2 : 1.5}
                strokeOpacity={0.6}
              />
              <text x={zone.labelX} y={zone.labelY} textAnchor="middle" fontSize="10" fontWeight="500" fill={zone.color} opacity={0.85} pointerEvents="none" className="select-none">
                {zone.name}
              </text>
              {isGap && (
                <g pointerEvents="none">
                  <circle cx={zone.labelX + 34} cy={zone.labelY - 8} r={8} fill="#dc2626" opacity={0.9} />
                  <text x={zone.labelX + 34} y={zone.labelY - 4.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">!</text>
                </g>
              )}
              {presence && presence.pct < 100 && (
                <text x={zone.labelX} y={zone.labelY + 13} textAnchor="middle" fontSize="8" fontWeight="700" fill={isGap ? "#dc2626" : "#f59e0b"} pointerEvents="none">
                  {presence.pct}% coverage
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1.5">
        {gapZones.length > 0 && (
          <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-600 shadow-sm">
            <AlertTriangle size={9} />
            {gapZones.length} coverage {gapZones.length > 1 ? "gaps" : "gap"}
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         TEAM MANAGEMENT MODALS                             */
/* -------------------------------------------------------------------------- */

function NewTeamModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (team: Team) => void;
}) {
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [routeId, setRouteId] = useState(ROUTES[0]?.id ?? "");
  const [touched, setTouched] = useState(false);

  function toggleMember(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setTouched(true);
    if (!name.trim() || !leaderId || selectedIds.length === 0) return;
    const leader = TANOD_ROSTER.find((t) => t.id === leaderId);
    const members = selectedIds.map((id) => TANOD_ROSTER.find((t) => t.id === id)?.name ?? "").filter(Boolean);
    const route = ROUTES.find((r) => r.id === routeId);
    const now = new Date().toISOString();
    const teamId = `t${Date.now()}`;
    onCreate({
      id: teamId,
      name: name.trim(),
      members,
      leader: leader?.name ?? "",
      leaderId,
      memberIds: selectedIds,
      routeId,
      shift: "",
      route: route ? `${routeId} ${route.name}` : routeId,
      status: "standby",
      checkpoints: "0/0",
      createdBy: "Desk Officer",
      createdAt: now,
    });
  }

  const available = TANOD_ROSTER.filter((t) => t.available);

  return (
    <Modal
      size="xl"
      onClose={onClose}
      icon={<UserPlus size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      title="Create New Team"
      subtitle="Assemble a patrol team from the Tanod roster"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold text-white transition bg-[#0038A8] hover:bg-[#002A8C] ${!name.trim() || !leaderId || selectedIds.length === 0 ? "cursor-not-allowed opacity-40" : ""}`}
          >
            Create Team
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TEAM NAME</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Team Echo"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
          />
          {touched && !name.trim() && <p className="mt-1 text-[10px] font-medium text-rose-600">Team name is required</p>}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">ASSIGNED ROUTE</label>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
          >
            {ROUTES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.name} {!r.active ? "(INACTIVE)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TEAM LEADER</label>
          <select
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
          >
            <option value="">Select a leader…</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.rank}) — {t.purok}
              </option>
            ))}
          </select>
          {touched && !leaderId && <p className="mt-1 text-[10px] font-medium text-rose-600">A team leader must be assigned</p>}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">
            TEAM MEMBERS <span className="text-stone-300">({selectedIds.length} selected)</span>
          </label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
            {available.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition ${selectedIds.includes(t.id) ? "bg-[#0038A8]/5 text-[#0038A8]" : "text-stone-600 hover:bg-stone-50"}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleMember(t.id)}
                  className="h-3.5 w-3.5 rounded border-stone-300 text-[#0038A8] focus:ring-[#0038A8]"
                />
                <span className="font-medium">{t.name}</span>
                <span className="text-[9px] text-stone-400">({t.rank})</span>
                <span className="ml-auto text-[9px] text-stone-400">{t.purok}</span>
              </label>
            ))}
          </div>
          {touched && selectedIds.length === 0 && <p className="mt-1 text-[10px] font-medium text-rose-600">At least one member is required</p>}
        </div>
      </div>
    </Modal>
  );
}

function EditTeamModal({
  team,
  onClose,
  onSave,
}: {
  team: Team;
  onClose: () => void;
  onSave: (updated: Team) => void;
}) {
  const [leaderId, setLeaderId] = useState(team.leaderId ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(team.memberIds ?? []);
  const [routeId, setRouteId] = useState(team.routeId ?? ROUTES[0]?.id ?? "");

  function toggleMember(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (!leaderId || selectedIds.length === 0) return;
    const leader = TANOD_ROSTER.find((t) => t.id === leaderId);
    const members = selectedIds.map((id) => TANOD_ROSTER.find((t) => t.id === id)?.name ?? "").filter(Boolean);
    const route = ROUTES.find((r) => r.id === routeId);
    onSave({
      ...team,
      members,
      leader: leader?.name ?? team.leader,
      leaderId,
      memberIds: selectedIds,
      routeId,
      route: route ? `${routeId} ${route.name}` : routeId,
    });
  }

  const available = TANOD_ROSTER.filter((t) => t.available);

  return (
    <Modal
      size="xl"
      onClose={onClose}
      icon={<Edit3 size={18} />}
      iconClass="bg-amber-100 text-amber-600"
      title={`Edit ${team.name}`}
      subtitle="Modify team membership and assignments"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold text-white transition bg-[#0038A8] hover:bg-[#002A8C] ${!leaderId || selectedIds.length === 0 ? "cursor-not-allowed opacity-40" : ""}`}
          >
            Save Changes
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">ASSIGNED ROUTE</label>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
          >
            {ROUTES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.name} {!r.active ? "(INACTIVE)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TEAM LEADER</label>
          <select
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
          >
            <option value="">Select a leader…</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.rank}) — {t.purok}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">
            TEAM MEMBERS <span className="text-stone-300">({selectedIds.length} selected)</span>
          </label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
            {available.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition ${selectedIds.includes(t.id) ? "bg-[#0038A8]/5 text-[#0038A8]" : "text-stone-600 hover:bg-stone-50"}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleMember(t.id)}
                  className="h-3.5 w-3.5 rounded border-stone-300 text-[#0038A8] focus:ring-[#0038A8]"
                />
                <span className="font-medium">{t.name}</span>
                <span className="text-[9px] text-stone-400">({t.rank})</span>
                <span className="ml-auto text-[9px] text-stone-400">{t.purok}</span>
              </label>
            ))}
          </div>
          {selectedIds.length === 0 && <p className="mt-1 text-[10px] font-medium text-rose-600">At least one member is required</p>}
        </div>
      </div>
    </Modal>
  );
}

function TeamDetailsModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const members = (team.memberIds ?? []).map((id) => TANOD_ROSTER.find((t) => t.id === id)).filter(Boolean) as Tanod[];
  const route = ROUTES.find((r) => r.id === team.routeId);
  const teamShifts = INITIAL_SHIFTS.filter((s) => s.teamId === team.id);

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<Users size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      title={team.name}
      subtitle={`${team.status === "on_patrol" ? "On Patrol" : "Standby"} · ${members.length} members`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">LEADER</p>
            <p className="text-[12px] font-medium text-stone-800">{team.leader}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">STATUS</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${team.status === "on_patrol" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
              {team.status === "on_patrol" ? "On Patrol" : "Standby"}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">ROUTE</p>
            <p className="text-[12px] font-medium text-stone-800">{route ? `${team.routeId} ${route.name}` : team.route}</p>
            {route && !route.active && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600">Inactive</span>}
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">CHECKPOINTS</p>
            <p className="text-[12px] font-medium text-stone-800">{team.checkpoints} cleared</p>
          </div>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10px] font-semibold tracking-wider text-stone-400">MEMBERS</p>
          <div className="mt-2 space-y-1.5">
            {members.length > 0 ? members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0038A8] text-[8px] font-bold text-white">
                    {m.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-stone-900">{m.name}</p>
                    <p className="text-[9px] text-stone-400">{m.rank} · {m.purok}</p>
                  </div>
                </div>
                <span className="text-[9px] text-stone-400">{m.phone}</span>
              </div>
            )) : (
              <p className="text-[11px] text-stone-400 italic">No member details available</p>
            )}
          </div>
        </div>

        {(team.createdBy || team.createdAt) && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">CREATED</p>
            <p className="text-[11px] text-stone-600">
              {team.createdBy}{team.createdAt ? ` · ${formatTime(team.createdAt)}` : ""}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                         SHIFT MANAGEMENT MODALS                            */
/* -------------------------------------------------------------------------- */

function NewShiftModal({
  onClose,
  onCreate,
  teams: teamList,
  shifts: existingShifts,
}: {
  onClose: () => void;
  onCreate: (shift: PatrolShift) => void;
  teams: Team[];
  shifts: PatrolShift[];
}) {
  const [teamId, setTeamId] = useState("");
  const [routeId, setRouteId] = useState(ROUTES[0]?.id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("Mon");
  const [timeSlot, setTimeSlot] = useState(0);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [overlapError, setOverlapError] = useState("");

  const selectedTeam = teamList.find((t) => t.id === teamId);
  const slot = SHIFT_TIME_SLOTS[timeSlot];

  function checkOverlap(teamId: string, day: DayOfWeek, start: string, end: string): string | null {
    const conflicting = existingShifts.find(
      (s) =>
        s.teamId === teamId &&
        s.dayOfWeek === day &&
        s.status !== "Cancelled" &&
        timesOverlap(s.startTime, s.endTime, start, end),
    );
    if (conflicting) {
      return `Double-booking: ${conflicting.team} already has shift ${conflicting.id} on ${day} ${conflicting.startTime}–${conflicting.endTime}`;
    }
    return null;
  }

  function submit() {
    setTouched(true);
    if (!teamId || !routeId) return;

    const overlap = checkOverlap(teamId, dayOfWeek, slot.start, slot.end);
    if (overlap) {
      setOverlapError(overlap);
      return;
    }

    const team = teamList.find((t) => t.id === teamId);
    const route = ROUTES.find((r) => r.id === routeId);
    const weekDates = getNextWeekDates();
    const dayDate = weekDates.find((d) => d.day === dayOfWeek);
    const now = new Date().toISOString();
    const shiftId = `PS-${Date.now()}`;

    onCreate({
      id: shiftId,
      date: dayDate?.date ?? todayISO(),
      startTime: slot.start,
      endTime: slot.end,
      team: team?.name ?? "",
      teamId,
      tanodIds: team?.memberIds ?? [],
      teamLeaderId: team?.leaderId,
      routeId,
      dayOfWeek,
      checkpointIds: [],
      status: "Scheduled",
      notes,
      published: false,
      createdBy: "Desk Officer",
      createdAt: now,
    });
  }

  return (
    <Modal
      size="xl"
      onClose={onClose}
      icon={<CalendarDays size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      title="Create New Shift"
      subtitle="Schedule a patrol shift for the upcoming week"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold text-white transition bg-[#0038A8] hover:bg-[#002A8C] ${!teamId || !routeId ? "cursor-not-allowed opacity-40" : ""}`}
          >
            Create Shift
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {overlapError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
            <div className="flex items-start justify-between">
              <span className="font-semibold">{overlapError}</span>
              <button onClick={() => setOverlapError("")}><X size={12} /></button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TEAM</label>
            <select
              value={teamId}
              onChange={(e) => { setTeamId(e.target.value); setOverlapError(""); }}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
            >
              <option value="">Select team…</option>
              {teamList.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.members.length} members)</option>
              ))}
            </select>
            {touched && !teamId && <p className="mt-1 text-[10px] font-medium text-rose-600">Team is required</p>}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">ROUTE</label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
            >
              {ROUTES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.name} {!r.active ? "(INACTIVE)" : ""}
                </option>
              ))}
            </select>
            {touched && !routeId && <p className="mt-1 text-[10px] font-medium text-rose-600">Route is required</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">DAY OF WEEK</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d}
                  onClick={() => { setDayOfWeek(d); setOverlapError(""); }}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${dayOfWeek === d ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TIME SLOT</label>
            <div className="space-y-1.5">
              {SHIFT_TIME_SLOTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setTimeSlot(i); setOverlapError(""); }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium transition ${timeSlot === i ? "border border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]" : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">NOTES</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional shift notes…"
            rows={2}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]"
          />
        </div>

        {selectedTeam && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">PREVIEW</p>
            <p className="text-[12px] font-medium text-stone-800">
              {selectedTeam.name} on {dayOfWeek} {slot.start}–{slot.end} · Route {routeId}
            </p>
            <p className="text-[10px] text-stone-500">
              Leader: {selectedTeam.leader} · {selectedTeam.members.length} members
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ShiftDetailsModal({ shift, onClose }: { shift: PatrolShift; onClose: () => void }) {
  const route = ROUTES.find((r) => r.id === shift.routeId);
  const members = (shift.tanodIds ?? []).map((id) => TANOD_ROSTER.find((t) => t.id === id)).filter(Boolean) as Tanod[];

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<CalendarDays size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      title={`Shift ${shift.id}`}
      subtitle={`${shift.team} · ${shift.dayOfWeek ?? ""} ${shift.startTime}–${shift.endTime}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">STATUS</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${SHIFT_STATUS_STYLES[shift.status]}`}>
              {shift.status}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">TEAM</p>
            <p className="text-[12px] font-medium text-stone-800">{shift.team}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">DATE</p>
            <p className="text-[12px] font-medium text-stone-800">{shift.date}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">TIME</p>
            <p className="text-[12px] font-medium text-stone-800">{shift.startTime}–{shift.endTime}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">ROUTE</p>
            <p className="text-[12px] font-medium text-stone-800">{route ? `${shift.routeId} ${route.name}` : shift.routeId}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">PUBLISHED</p>
            <p className="text-[12px] font-medium text-stone-800">{shift.published ? "Yes" : "Draft"}</p>
          </div>
        </div>

        {members.length > 0 && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">ASSIGNED TANODS</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span key={m.id} className="flex items-center gap-1.5 rounded-full border border-stone-200 px-2 py-1 text-[10px] font-medium text-stone-600">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0038A8] text-[7px] font-bold text-white">{m.name.charAt(0)}</span>
                  {m.name}
                  {m.id === shift.teamLeaderId && <span className="rounded-full bg-amber-100 px-1 text-[7px] font-bold text-amber-700">LDR</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {shift.notes && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">NOTES</p>
            <p className="text-[12px] text-stone-700">{shift.notes}</p>
          </div>
        )}

        {(shift.createdBy || shift.createdAt) && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-[10px] font-semibold tracking-wider text-stone-400">CREATED</p>
            <p className="text-[11px] text-stone-600">
              {shift.createdBy}{shift.createdAt ? ` · ${formatTime(shift.createdAt)}` : ""}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                           PUBLISH WEEK MODAL                               */
/* -------------------------------------------------------------------------- */

function PublishWeekModal({
  onClose,
  onPublish,
  shifts,
}: {
  onClose: () => void;
  onPublish: () => void;
  shifts: PatrolShift[];
}) {
  const draftShifts = shifts.filter((s) => !s.published && s.status === "Scheduled");
  const inactiveRoutes = draftShifts.filter((s) => {
    const route = ROUTES.find((r) => r.id === s.routeId);
    return route && !route.active;
  });
  const hasIssues = inactiveRoutes.length > 0;

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<Upload size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      title="Publish Weekly Schedule"
      subtitle={`Week ${getWeekNumber(new Date())} — ${draftShifts.length} draft shifts ready`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => { onPublish(); onClose(); }}
            className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold text-white transition bg-emerald-600 hover:bg-emerald-700 ${hasIssues ? "cursor-not-allowed opacity-40" : ""}`}
            disabled={hasIssues}
          >
            Publish {draftShifts.length} Shift{draftShifts.length !== 1 ? "s" : ""}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {hasIssues && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
            <p className="font-semibold">Cannot publish — inactive route warnings:</p>
            <ul className="mt-1 list-inside list-disc">
              {inactiveRoutes.map((s) => (
                <li key={s.id}>{s.id} — {s.team} uses route {s.routeId} (inactive)</li>
              ))}
            </ul>
          </div>
        )}

        {draftShifts.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-[12px] font-medium text-stone-500">All shifts are already published</p>
            <p className="text-[10px] text-stone-400">No draft shifts to publish</p>
          </div>
        ) : (
          <div className="space-y-2">
            {draftShifts.map((s) => {
              const route = ROUTES.find((r) => r.id === s.routeId);
              const routeInactive = route && !route.active;
              return (
                <div key={s.id} className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 ${routeInactive ? "border-rose-200 bg-rose-50/50" : "border-stone-200 bg-white"}`}>
                  <div>
                    <p className="text-[11px] font-bold text-stone-900">{s.id} — {s.team}</p>
                    <p className="text-[10px] text-stone-500">{s.dayOfWeek} {s.startTime}–{s.endTime} · Route {s.routeId}</p>
                  </div>
                  {routeInactive && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-semibold text-rose-600">Inactive Route</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-lg border border-stone-100 bg-stone-50 px-3.5 py-2.5">
          <p className="text-[10px] text-stone-500">
            Publishing will mark all draft shifts as published and notify assigned teams. Historical shift data will be snapshotted.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                             MAIN COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export default function PatrolSchedulerRoutes() {
  const { flash, ToastPortal } = useToast();

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(INITIAL_CHECKPOINTS);
  const [offline, setOffline] = useState<OfflineRecord[]>(INITIAL_OFFLINE);
  const [syncing, setSyncing] = useState(false);
  const [clearTarget, setClearTarget] = useState<ClearTarget>(null);
  const [shifts, setShifts] = useState<PatrolShift[]>(INITIAL_SHIFTS);
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [manualConfirmations, setManualConfirmations] = useState<ManualConfirmationRecord[]>(INITIAL_MANUAL_CONFIRMATIONS);
  const [patrolUpdates, setPatrolUpdates] = useState<PatrolUpdate[]>(INITIAL_PATROL_UPDATES);
  const [verificationIssues, setVerificationIssues] = useState<VerificationIssue[]>(INITIAL_VERIFICATION_ISSUES);
  const [notifications, setNotifications] = useState<PatrolNotification[]>(INITIAL_NOTIFICATIONS);
  const [patrolAudit, setPatrolAudit] = useState<PatrolAuditEntry[]>(INITIAL_PATROL_AUDIT);
  const [patrolActivity, setPatrolActivity] = useState<PatrolActivityEntry[]>(INITIAL_PATROL_ACTIVITY);

  const [selectedUpdate, setSelectedUpdate] = useState<PatrolUpdate | null>(null);
  const [showManualReview, setShowManualReview] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);

  const [showNewTeam, setShowNewTeam] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [viewTeam, setViewTeam] = useState<Team | null>(null);
  const [showNewShift, setShowNewShift] = useState(false);
  const [viewShift, setViewShift] = useState<PatrolShift | null>(null);
  const [showPublishWeek, setShowPublishWeek] = useState(false);

  function requestClear(id: string) {
    setClearTarget({ id, mode: "clear" });
  }

  function requestMissedReason(id: string) {
    setClearTarget({ id, mode: "missed_reason" });
  }

  function confirmManualClear(id: string, reason: string, officer: string) {
    const cp = checkpoints.find((c) => c.id === id);
    if (!cp) return;
    const now = new Date().toISOString();
    setCheckpoints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "cleared", clearedBy: "manual", clearReason: reason, clearedByPerson: officer, time: now } : c)),
    );
    const mc: ManualConfirmationRecord = {
      id: `MC-${Date.now()}`,
      checkpointId: cp.id,
      checkpointName: cp.name,
      shiftId: shifts[0]?.id ?? "PS-101",
      team: cp.team,
      officer,
      reason,
      timestamp: now,
    };
    setManualConfirmations((prev) => [mc, ...prev]);
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: now,
      action: "Manual confirmation",
      details: `${cp.id} manually confirmed — ${reason}`,
      actor: officer,
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog("patrol_manual_confirm", `${cp.id} manually confirmed by ${officer}: ${reason}`);
    flash(`${cp.name} CLEARED — manual override (${reason}) by ${officer} · ${cp.team}`);
  }

  function attachMissedReason(id: string, reason: string) {
    const cp = checkpoints.find((c) => c.id === id);
    if (!cp) return;
    const now = new Date().toISOString();
    setCheckpoints((prev) => prev.map((c) => (c.id === id ? { ...c, missedReason: reason } : c)));
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: now,
      action: "Missed reason added",
      details: `${cp.id} missed — ${reason}`,
      actor: "System",
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog("patrol_missed_reason", `${cp.id} missed reason: ${reason}`);
    flash(`Reason recorded for ${cp.name} — status unchanged (Missed — Overdue)`);
  }

  function syncOffline() {
    setSyncing(true);
    setOffline((prev) => prev.map((r) => ({ ...r, syncStatus: "syncing" as const })));
    setTimeout(() => {
      setOffline((prev) =>
        prev.map((r) => ({
          ...r,
          syncStatus: "synced" as const,
          serverId: r.serverId ?? `SRV-${Math.floor(Math.random() * 9000 + 1000)}`,
        })),
      );
      setSyncing(false);
      const now = new Date().toISOString();
      const syncEntry: PatrolAuditEntry = {
        id: `PA-${Date.now()}`,
        timestamp: now,
        action: "Offline sync completed",
        details: "Offline queue synchronized",
        actor: "System",
      };
      setPatrolAudit((prev) => [syncEntry, ...prev]);
      flash("Offline queue synchronized — records pushed to server");
    }, 1400);
  }

  function setShiftStatus(id: string, to: ShiftStatus, verb: string) {
    const sh = shifts.find((s) => s.id === id);
    if (!sh) return;
    const now = new Date().toISOString();
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, status: to } : s)));
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: now,
      action: `Shift ${to.toLowerCase()}`,
      details: `${sh.id} ${verb} — ${sh.team} · ${sh.date} ${sh.startTime}–${sh.endTime}`,
      actor: "Desk Officer",
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog(`patrol_shift_${to.toLowerCase()}`, `${sh.id} ${verb} for ${sh.team}`);
    flash(`${sh.team} shift ${sh.id} ${verb} — ${sh.date} ${sh.startTime}–${sh.endTime}`);
  }

  function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function reviewVerificationIssue(id: string) {
    setVerificationIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status: "reviewed" as const } : i)));
    flash(`Verification issue ${id} marked as reviewed`);
  }

  function createTeam(team: Team) {
    setTeams((prev) => [...prev, team]);
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "Team created",
      details: `${team.name} — ${team.members.length} members, route ${team.routeId}`,
      actor: "Desk Officer",
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog("patrol_team_created", `${team.name} created with ${team.members.length} members`);
    setShowNewTeam(false);
  }

  function saveTeam(updated: Team) {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "Team updated",
      details: `${updated.name} — ${updated.members.length} members, route ${updated.routeId}`,
      actor: "Desk Officer",
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog("patrol_team_updated", `${updated.name} updated`);
    setEditTeam(null);
  }

  function createShift(shift: PatrolShift) {
    setShifts((prev) => [...prev, shift]);
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "Shift created",
      details: `${shift.id} — ${shift.team} · ${shift.dayOfWeek} ${shift.startTime}–${shift.endTime}`,
      actor: "Desk Officer",
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog("patrol_shift_created", `${shift.id} created for ${shift.team}`);
    setShowNewShift(false);
  }

  function publishWeek() {
    const now = new Date().toISOString();
    setShifts((prev) =>
      prev.map((s) =>
        s.status === "Scheduled" && !s.published ? { ...s, published: true, createdAt: now } : s,
      ),
    );
    const publishedCount = shifts.filter((s) => !s.published && s.status === "Scheduled").length;
    const auditEntry: PatrolAuditEntry = {
      id: `PA-${Date.now()}`,
      timestamp: now,
      action: "Week published",
      details: `Week ${getWeekNumber(new Date())} published — ${publishedCount} shifts, ${teams.length} teams`,
      actor: "Desk Officer",
    };
    setPatrolAudit((prev) => [auditEntry, ...prev]);
    pushAuditLog("patrol_week_published", `Week ${getWeekNumber(new Date())} published — ${publishedCount} shifts`);
    flash(`Week ${getWeekNumber(new Date())} published — ${publishedCount} shifts released to teams`);
  }

  const clearedCount = checkpoints.filter((c) => c.status === "cleared").length;
  const missedCount = checkpoints.filter((c) => c.status === "missed").length;
  const manualCount = checkpoints.filter((c) => c.clearedBy === "manual").length;
  const manualByTeam = (teamName: string) => checkpoints.filter((c) => c.clearedBy === "manual" && c.team === teamName).length;
  const onDuty = teams.filter((t) => t.status === "on_patrol").length;
  const gapZones = PUROK_PRESENCE.filter((p) => p.pct < PATROL_COVERAGE_WARNING_THRESHOLD * 100);
  const gaps = gapZones.length;
  const pendingSync = offline.filter((r) => r.syncStatus === "pending" || r.syncStatus === "syncing").length;
  const failedSync = offline.filter((r) => r.syncStatus === "failed").length;
  const syncedToday = offline.filter((r) => r.syncStatus === "synced").length;

  const publishedShifts = shifts.filter((s) => s.published).length;
  const draftShifts = shifts.filter((s) => !s.published && s.status === "Scheduled").length;

  const kpis = [
    { label: "SHIFTS PUBLISHED", value: publishedShifts, sub: `${draftShifts} draft · ${shifts.length} total shifts`, icon: CalendarDays },
    { label: "TEAMS ON DUTY", value: `${onDuty}/${teams.length}`, sub: `${teams.reduce((a, t) => a + t.members.length, 0)} tanods rostered`, icon: Users },
    { label: "CHECKPOINTS CLEARED", value: `${clearedCount}/${checkpoints.length}`, sub: `${missedCount} missed · ${manualCount} manual override${manualCount === 1 ? "" : "s"} — review`, icon: CheckCircle2 },
    { label: "COVERAGE GAPS", value: gaps, sub: `zones below ${PATROL_COVERAGE_WARNING_THRESHOLD * 100}% threshold`, icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* === HEADER === */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Patrol Operations</h1>
              <p className="mt-1 text-sm text-stone-500">
                Patrol planning, checkpoint verification &amp; coverage monitoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewShift(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Plus size={12} />
                New Shift
              </button>
              {draftShifts > 0 && (
                <button
                  onClick={() => setShowPublishWeek(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Upload size={12} />
                  Publish Week ({draftShifts})
                </button>
              )}
              <button
                onClick={() => setShowNewTeam(true)}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <Plus size={12} />
                New Team
              </button>
              <span
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700"
                title="GPS location is collected only during active patrol and authorized checkpoint-verification workflows. Collection stops when the shift ends, the Tanod logs out, or required permission is withdrawn."
              >
                <Radio size={12} />
                Patrol GPS Verification Active
              </span>
            </div>
          </div>
        </header>

        {/* === KPI ROW === */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* === SHIFT LIFECYCLE === */}
        <div className="mb-5 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Shift Lifecycle</h3>
                <p className="text-[11px] text-[#94A3B8]">Active and scheduled patrol shifts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{shifts.length} shifts</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-5 pb-3">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-y border-black/5 text-left">
                  <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">SHIFT</th>
                  <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">TEAM</th>
                  <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">DATE</th>
                  <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">TIME</th>
                  <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">ROUTE</th>
                  <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">STATUS</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold tracking-wider text-[#94A3B8]">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {[...shifts]
                  .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
                  .map((sh) => {
                    const route = ROUTES.find((r) => r.id === sh.routeId);
                    const team = teams.find((t) => t.name === sh.team);
                    return (
                      <tr key={sh.id} className="border-b border-black/5 last:border-0">
                        <td className="px-3 py-2.5 text-[11px] font-bold text-stone-900">{sh.id}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0038A8] text-[8px] font-bold text-white">{sh.team.replace("Team ", "")}</span>
                            {sh.team}
                            <span className="text-[9px] font-normal text-stone-400">({team?.members.length ?? 0} tanods)</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-stone-600">{sh.date}</td>
                        <td className="px-3 py-2.5 text-[11px] text-stone-600">{sh.startTime}–{sh.endTime}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-stone-700">{route?.name ?? sh.routeId}</span>
                          {route && !route.active && (
                            <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600" title="Route is inactive — pre-publish validation blocks this">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${SHIFT_STATUS_STYLES[sh.status]}`}>{sh.status}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {sh.status === "Scheduled" && (
                              <>
                                <button onClick={() => setShiftStatus(sh.id, "Active", "STARTED")} className="flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-50">Start</button>
                                <button onClick={() => setShiftStatus(sh.id, "Cancelled", "CANCELLED")} className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 text-[10px] font-semibold text-stone-500 transition hover:bg-stone-50">Cancel</button>
                              </>
                            )}
                            {sh.status === "Active" && (
                              <>
                                <button onClick={() => setShiftStatus(sh.id, "Completed", "COMPLETED")} className="flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-50">Complete</button>
                                <button onClick={() => setShiftStatus(sh.id, "Missed", "MARKED MISSED")} className="flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50">Mark Missed</button>
                                <button onClick={() => setShiftStatus(sh.id, "Cancelled", "CANCELLED")} className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 text-[10px] font-semibold text-stone-500 transition hover:bg-stone-50">Cancel</button>
                              </>
                            )}
                            {(sh.status === "Completed" || sh.status === "Cancelled" || sh.status === "Missed") && (
                              <span className="text-[10px] text-stone-400">Terminal state</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* === PATROL DUTY PLANNER + TEAM ORG === */}
        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 440 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Patrol Duty Planner</h3>
                  <p className="text-[11px] text-[#94A3B8]">Weekly shift assignments driven by published schedule</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
                  Week {getWeekNumber(new Date())} · {publishedShifts} published
                </span>
                <button
                  onClick={() => setShowNewShift(true)}
                  className="flex h-7 items-center gap-1 rounded-md bg-[#0038A8] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                >
                  <Plus size={10} />
                  Add
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
              {shifts.filter((s) => s.status !== "Cancelled").length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <CalendarDays size={24} className="mx-auto mb-2 text-stone-300" />
                    <p className="text-[12px] font-medium text-stone-500">No shifts scheduled</p>
                    <p className="text-[10px] text-stone-400">Create shifts using the "New Shift" button</p>
                    <button
                      onClick={() => setShowNewShift(true)}
                      className="mt-3 flex h-7 mx-auto items-center gap-1 rounded-md bg-[#0038A8] px-3 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                    >
                      <Plus size={10} />
                      New Shift
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead>
                      <tr className="border-y border-black/5 text-left">
                        <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">SHIFT</th>
                        {DAYS_OF_WEEK.map((d) => (
                          <th key={d} className="px-2 py-2 text-center text-[10px] font-semibold tracking-wider text-[#94A3B8]">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SHIFT_TIME_SLOTS.map((slot) => (
                        <tr key={slot.start} className="border-b border-black/5 last:border-0">
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${slot.start === "06:00" ? "bg-amber-100 text-amber-700" : slot.start === "14:00" ? "bg-sky-100 text-sky-700" : "bg-indigo-100 text-indigo-700"}`}>
                              <Clock size={10} />
                              {slot.start === "06:00" ? "Morning" : slot.start === "14:00" ? "Afternoon" : "Night"}
                            </span>
                          </td>
                          {DAYS_OF_WEEK.map((day) => {
                            const cellShift = shifts.find(
                              (s) => s.dayOfWeek === day && s.startTime === slot.start && s.status !== "Cancelled",
                            );
                            return (
                              <td key={day} className="px-2 py-2 text-center">
                                {cellShift ? (
                                  <button
                                    onClick={() => setViewShift(cellShift)}
                                    className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-semibold transition hover:opacity-80 ${
                                      cellShift.published
                                        ? "bg-[#0038A8]/10 text-[#0038A8]"
                                        : "bg-amber-100 text-amber-700 border border-dashed border-amber-300"
                                    }`}
                                    title={`${cellShift.id} — ${cellShift.team} · ${cellShift.notes || "No notes"}`}
                                  >
                                    {cellShift.team.replace("Team ", "")}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-stone-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold tracking-wider text-stone-400">LEGEND</span>
                    <span className="flex items-center gap-1 rounded-full border border-stone-200 px-2 py-0.5 text-[9px] font-medium text-stone-600">
                      <span className="h-2 w-2 rounded-sm bg-[#0038A8]/30" /> Published
                    </span>
                    <span className="flex items-center gap-1 rounded-full border border-dashed border-amber-300 px-2 py-0.5 text-[9px] font-medium text-amber-600">
                      <span className="h-2 w-2 rounded-sm bg-amber-200" /> Draft
                    </span>
                    {teams.map((t) => (
                      <span key={t.id} className="flex items-center gap-1.5 rounded-full border border-stone-200 px-2 py-1 text-[10px] font-medium text-stone-600">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0038A8] text-[8px] font-bold text-white">
                          {t.name.replace("Team ", "")}
                        </span>
                        {t.name} · {t.members.length} tanods
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Team Organization</h3>
                  <p className="text-[11px] text-[#94A3B8]">Rostered teams for designated shifts</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewTeam(true)}
                className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                <Plus size={10} />
                New
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {teams.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Users size={24} className="mx-auto mb-2 text-stone-300" />
                    <p className="text-[12px] font-medium text-stone-500">No teams created</p>
                    <p className="text-[10px] text-stone-400">Create a team to start scheduling patrols</p>
                    <button
                      onClick={() => setShowNewTeam(true)}
                      className="mt-3 flex h-7 mx-auto items-center gap-1 rounded-md bg-[#0038A8] px-3 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                    >
                      <Plus size={10} />
                      New Team
                    </button>
                  </div>
                </div>
              ) : (
                teams.map((t) => (
                <div key={t.id} className={`rounded-lg border px-3.5 py-3 ${t.status === "on_patrol" ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                        {t.name.replace("Team ", "")}
                      </span>
                      <span className="text-[12px] font-bold text-stone-900">{t.name}</span>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${t.status === "on_patrol" ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500"}`}>
                      {t.status === "on_patrol" ? <Navigation size={9} /> : <Clock size={9} />}
                      {t.status === "on_patrol" ? "On Patrol" : "Standby"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-stone-500">
                    <span className="font-medium text-stone-700">Leader:</span> {t.leader} · {t.members.length} members
                  </p>
                  <p className="text-[10px] text-stone-500">
                    <span className="font-medium text-stone-700">Shift:</span> {t.shift || "No shifts assigned"}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    <span className="font-medium text-stone-700">Route:</span> {t.route}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[8px] font-bold text-emerald-600">
                        <CheckCircle2 size={9} />
                      </span>
                      <span className="text-[10px] font-medium text-stone-600">{t.checkpoints} cleared</span>
                      {manualByTeam(t.name) > 0 && (
                        <button
                          onClick={() => setShowManualReview(true)}
                          className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600 transition hover:bg-violet-100"
                          title={`${manualByTeam(t.name)} manual checkpoint confirmation${manualByTeam(t.name) > 1 ? "s" : ""} — click to review`}
                        >
                          <Hand size={9} />
                          {manualByTeam(t.name)} manual
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setViewTeam(t)}
                        className="flex h-6 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[9px] font-semibold text-stone-600 transition hover:bg-stone-50"
                      >
                        <Eye size={9} />
                        View
                      </button>
                      <button
                        onClick={() => setEditTeam(t)}
                        className="flex h-6 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 text-[9px] font-semibold text-amber-700 transition hover:bg-amber-50"
                      >
                        <Edit3 size={9} />
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>

        {/* === ROUTE MAPPING + FIELD EXECUTION === */}
        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 460 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Map size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Route Mapping &amp; Geofences</h3>
                  <p className="text-[11px] text-[#94A3B8]">Mandatory checkpoint routes through purok zones</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Cleared (GPS)
                </span>
                <span className="flex items-center gap-1 text-[10px] text-violet-600">
                  <span className="h-2 w-2 rounded-full bg-violet-500" /> Manual override
                </span>
                <span className="flex items-center gap-1 text-[10px] text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Pending
                </span>
                <span className="flex items-center gap-1 text-[10px] text-rose-600">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Missed
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-5 pb-5">
              <RouteMap checkpoints={checkpoints} onRequestClear={requestClear} />
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Field Execution &amp; GPS Verify</h3>
                  <p className="text-[11px] text-[#94A3B8]">Duty check-in &amp; geofence checkpoint clearing</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">DUTY CHECK-IN</p>
              <div className="space-y-2">
                {DUTY_CHECKINS.map((d) => (
                  <div key={d.team} className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 ${d.status === "verified" ? "border-emerald-200 bg-emerald-50/50" : "border-stone-200 bg-stone-50"}`}>
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-stone-900">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0038A8] text-[9px] font-bold text-white">
                        {d.team.replace("Team ", "")}
                      </span>
                      {d.team}
                    </span>
                    <span className="text-right">
                      {d.status === "verified" ? (
                        <>
                          <span className="block flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 size={9} />
                            GPS Verified
                          </span>
                          <span className="block text-[9px] text-stone-400">{formatTime(d.time!)} · {d.gps}</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium text-stone-400">Not checked in</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mb-2 mt-4 text-[10px] font-semibold tracking-wider text-stone-400">CHECKPOINT CLEARING</p>
              <div className="space-y-2">
                {checkpoints.map((cp) => (
                  <div key={cp.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${cp.status === "cleared" ? "bg-emerald-100 text-emerald-600" : cp.status === "missed" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                        {cp.status === "cleared" ? <CheckCircle2 size={12} /> : cp.status === "missed" ? <AlertTriangle size={12} /> : <MapPin size={12} />}
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold text-stone-900">{cp.name}</p>
                        <p className="text-[9px] text-stone-400">{cp.team} · {cp.purok} · {cp.radius} m radius</p>
                      </div>
                    </div>
                    {cp.status === "cleared" ? (
                      <div className="text-right">
                        {cp.clearedBy === "manual" ? (
                          <>
                            <span className="flex items-center justify-end gap-1 text-[10px] font-semibold text-violet-600">
                              <Hand size={9} />
                              Manual override
                            </span>
                            <span className="block text-[9px] text-stone-400">{formatTime(cp.time!)} · {cp.clearReason}{cp.clearedByPerson ? ` · ${cp.clearedByPerson}` : ""}</span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center justify-end gap-1 text-[10px] font-semibold text-emerald-600">
                              <CheckCircle2 size={9} />
                              GPS verified
                            </span>
                            <span className="block text-[9px] text-stone-400">{formatTime(cp.time!)}{cp.gpsAccuracy ? ` · ±${cp.gpsAccuracy}m accuracy` : ""}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {cp.status === "missed" && (
                          <>
                            <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-600">
                              <AlertTriangle size={9} />
                              Missed
                            </span>
                            {cp.missedReason && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700" title={cp.missedReason}>
                                <PenTool size={9} />
                                {cp.missedReason}
                              </span>
                            )}
                            <button
                              onClick={() => requestMissedReason(cp.id)}
                              className="flex h-7 items-center gap-1 rounded-md border border-violet-200 bg-white px-2 text-[10px] font-semibold text-violet-600 transition hover:bg-violet-50"
                            >
                              <PenTool size={10} />
                              {cp.missedReason ? "Edit Reason" : "Add Reason"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => requestClear(cp.id)}
                          className="flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 text-[10px] font-semibold text-amber-600 transition hover:bg-amber-50"
                        >
                          <MapPin size={10} />
                          {cp.status === "missed" ? "Clear Now" : "Simulate Clear"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* === PATROL COVERAGE MAP + RECENT UPDATES + VERIFICATION ISSUES === */}
        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Patrol Coverage Map (2 cols) */}
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Patrol Coverage Map</h3>
                  <p className="text-[11px] text-[#94A3B8]">Checkpoint-based area coverage summary</p>
                </div>
              </div>
              <span
                className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500"
                title="Privacy: only aggregated checkpoint-based coverage is shown. Individual movement history is excluded by design."
              >
                <ShieldCheck size={11} className="text-emerald-600" />
                Aggregated only
              </span>
            </div>

            <div className="min-h-0 flex-1 px-5 pb-4">
              <div className="mb-3 h-56 min-h-0 rounded-lg">
                <PresenceMap />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PUROK_PRESENCE.map((p) => (
                  <div key={p.zone}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-stone-600">{p.zone}</span>
                      <span className={`text-[10px] font-bold ${p.pct < PATROL_COVERAGE_WARNING_THRESHOLD * 100 ? "text-rose-600" : p.pct < 80 ? "text-amber-600" : "text-emerald-600"}`}>{p.pct < PATROL_COVERAGE_WARNING_THRESHOLD * 100 ? "Gap" : p.pct < 80 ? "Partial" : "Covered"}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                      <div className={`h-full rounded-full ${p.pct < PATROL_COVERAGE_WARNING_THRESHOLD * 100 ? "bg-rose-500" : p.pct < 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Patrol Updates (1 col) */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Recent Patrol Updates</h3>
                  <p className="text-[11px] text-[#94A3B8]">Field updates from Tanods</p>
                </div>
              </div>
              {patrolUpdates.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[#0038A8]/10 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8]">
                  {patrolUpdates.filter((u) => u.status === "submitted").length} new
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {patrolUpdates.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FileText size={20} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No recent patrol updates</p>
                  <p className="text-[10px] text-stone-400">Field updates will appear here when Tanods submit them</p>
                </div>
              ) : (
                patrolUpdates.map((u) => (
                  <div key={u.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-stone-400">{formatTime(u.timestamp)}</span>
                      {u.hasAttachment && <ImageIcon size={10} className="text-stone-400" />}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-stone-900">{u.team} · {u.purok}</p>
                    <p className="mt-0.5 rounded-full inline-flex bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">{u.type}</p>
                    <p className="mt-1 text-[10px] text-stone-500 line-clamp-2">{u.note}</p>
                    {u.incidentId && (
                      <p className="mt-1 text-[9px] font-medium text-amber-600">
                        <LinkIcon size={8} className="mr-0.5 inline" />Linked: {u.incidentId}
                      </p>
                    )}
                    <button
                      onClick={() => setSelectedUpdate(u)}
                      className="mt-2 flex h-6 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[9px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <Eye size={9} />
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* === VERIFICATION ISSUES + OFFLINE SYNC === */}
        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Verification Issues */}
          <VerificationIssuesPanel issues={verificationIssues} onReview={reviewVerificationIssue} />

          {/* Offline Data Synchronization */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Offline Data Synchronization</h3>
                  <p className="text-[11px] text-[#94A3B8]">Dead-zone queue auto-pushes on reconnect</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingSync > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600">
                    <WifiOff size={10} />
                    {pendingSync} queued
                  </span>
                )}
                {failedSync > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-600">
                    <AlertCircle size={10} />
                    {failedSync} failed
                  </span>
                )}
              </div>
            </div>

            {/* Sync Status Summary */}
            <div className="border-b border-stone-100 px-5 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold tracking-wider text-stone-400">OFFLINE SYNC</span>
                  <span className="text-[10px] text-stone-500">{pendingSync} queued · {syncedToday} synced today · {failedSync} failed</span>
                </div>
                {pendingSync > 0 && (
                  <button
                    onClick={syncOffline}
                    disabled={syncing}
                    className="flex h-6 items-center gap-1 rounded-md bg-[#0038A8] px-2.5 text-[9px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
                  >
                    {syncing ? <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white" /> : <RefreshCw size={9} />}
                    {syncing ? "Syncing…" : `Sync ${pendingSync} Item${pendingSync > 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
              {offline.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Wifi size={20} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-[12px] font-medium text-stone-500">All patrol data synced</p>
                  <p className="text-[10px] text-stone-400">No queued offline records</p>
                </div>
              ) : (
                offline.map((item) => (
                  <div key={item.id} className={`rounded-lg border px-3.5 py-3 ${item.syncStatus === "failed" ? "border-rose-200 bg-rose-50/50" : item.syncStatus === "synced" ? "border-emerald-200 bg-emerald-50/50" : "border-stone-200 bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[11px] font-bold text-stone-900">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-100 text-stone-500">
                          <FileText size={12} />
                        </span>
                        {item.id}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${item.syncStatus === "synced" ? "bg-emerald-50 text-emerald-600" : item.syncStatus === "failed" ? "bg-rose-50 text-rose-600" : item.syncStatus === "syncing" ? "bg-sky-50 text-sky-600" : item.syncStatus === "conflict" ? "bg-amber-50 text-amber-600" : "bg-amber-50 text-amber-600"}`}>
                        {item.syncStatus === "synced" ? "Synced" : item.syncStatus === "syncing" ? "Syncing…" : item.syncStatus === "failed" ? "Failed" : item.syncStatus === "conflict" ? "Conflict" : "Pending Sync"}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-stone-500">{item.note}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-stone-400">
                      <span>{item.team} · {item.deviceId} · {item.type.replace(/_/g, " ")}</span>
                      <span>{formatTime(item.createdAt)}</span>
                    </div>
                    {item.serverId && (
                      <p className="mt-0.5 text-[9px] font-medium text-emerald-600">Server ID: {item.serverId}</p>
                    )}
                    {item.syncStatus === "failed" && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setOffline((prev) => prev.map((r) => r.id === item.id ? { ...r, syncStatus: "pending" as const, retryCount: (r.retryCount ?? 0) + 1 } : r));
                            flash(`Retry queued for ${item.id}`);
                          }}
                          className="flex h-6 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-[9px] font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <RefreshCw size={9} />
                          Retry
                        </button>
                      </div>
                    )}
                    {item.syncStatus === "conflict" && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                        <p className="text-[9px] font-medium text-amber-800">SYNC CONFLICT — This record has conflicting updates. Review required.</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* === PATROL ACTIVITY HISTORY + AUDIT TRAIL === */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Patrol Activity */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Patrol Activity History</h3>
                  <p className="text-[11px] text-[#94A3B8]">Recent operational activity</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{patrolActivity.length} entries</span>
            </div>

            <div className="min-h-0 flex-1 space-y-0 overflow-y-auto px-5 pb-4">
              {patrolActivity.map((entry, i) => (
                <div key={entry.id} className="flex gap-3 py-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-[#0038A8]" />
                    {i < patrolActivity.length - 1 && <div className="mt-1 w-px flex-1 bg-stone-200" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-[10px] font-medium text-stone-400">{formatTime(entry.timestamp)}</p>
                    <p className="text-[11px] font-semibold text-stone-900">{entry.actor}</p>
                    <p className="text-[11px] text-stone-600">{entry.action}</p>
                    {entry.details && <p className="text-[10px] text-stone-400">{entry.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Administrative Audit Trail</h3>
                  <p className="text-[11px] text-[#94A3B8]">Schedule &amp; config change history</p>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{patrolAudit.length} entries</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <div className="space-y-2">
                {patrolAudit.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50/50 px-3.5 py-2.5">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0038A8]/10">
                      <ShieldCheck size={10} className="text-[#0038A8]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-stone-900">{entry.action}</p>
                        <span className="text-[9px] text-stone-400">{formatTime(entry.timestamp)}</span>
                      </div>
                      <p className="text-[10px] text-stone-500">{entry.details}</p>
                      <p className="text-[9px] text-stone-400">by {entry.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* === MODALS === */}
      {clearTarget && (() => {
        const cp = checkpoints.find((c) => c.id === clearTarget.id);
        if (!cp) return null;
        return (
          <ReasonModal
            key={`${clearTarget.id}-${clearTarget.mode}`}
            cp={cp}
            mode={clearTarget.mode}
            onClose={() => setClearTarget(null)}
            onConfirm={clearTarget.mode === "clear" ? confirmManualClear : attachMissedReason}
          />
        );
      })()}

      {selectedUpdate && (
        <PatrolUpdateDetailsModal
          update={selectedUpdate}
          onClose={() => setSelectedUpdate(null)}
        />
      )}

      {showManualReview && (
        <ManualConfirmReviewPanel
          confirmations={manualConfirmations}
          onClose={() => setShowManualReview(false)}
        />
      )}

      {showNewTeam && (
        <NewTeamModal
          onClose={() => setShowNewTeam(false)}
          onCreate={createTeam}
        />
      )}

      {editTeam && (
        <EditTeamModal
          team={editTeam}
          onClose={() => setEditTeam(null)}
          onSave={saveTeam}
        />
      )}

      {viewTeam && (
        <TeamDetailsModal
          team={viewTeam}
          onClose={() => setViewTeam(null)}
        />
      )}

      {showNewShift && (
        <NewShiftModal
          onClose={() => setShowNewShift(false)}
          onCreate={createShift}
          teams={teams}
          shifts={shifts}
        />
      )}

      {viewShift && (
        <ShiftDetailsModal
          shift={viewShift}
          onClose={() => setViewShift(null)}
        />
      )}

      {showPublishWeek && (
        <PublishWeekModal
          onClose={() => setShowPublishWeek(false)}
          onPublish={publishWeek}
          shifts={shifts}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
