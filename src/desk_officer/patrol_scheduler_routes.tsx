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
  Smartphone,
  Wifi,
  WifiOff,
  Upload,
  RefreshCw,
  ImageIcon,
  FileText,
  Megaphone,
  Hand,
  PenTool,
  ShieldAlert,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_ZONES } from "../constants/purok";
import { ConfirmModal, Modal } from "../components/ui";

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
}

const MANUAL_CLEAR_REASONS = [
  { id: "emergency_response", label: "Emergency response assignment" },
  { id: "weather", label: "Weather or environmental condition" },
  { id: "device_failure", label: "Device failure" },
  { id: "network_failure", label: "Network failure" },
  { id: "route_obstruction", label: "Route obstruction" },
  { id: "operational_change", label: "Approved operational change" },
  { id: "other", label: "Other" },
] as const;

type ClearTarget = { id: string; mode: "clear" | "missed_reason" } | null;

interface Team {
  id: string;
  name: string;
  members: string[];
  leader: string;
  shift: string;
  route: string;
  status: "on_patrol" | "standby";
  checkpoints: string;
}

const SHIFT_SCHEDULE = [
  { day: "Mon", morning: "Alpha", night: "Bravo" },
  { day: "Tue", morning: "Bravo", night: "Charlie" },
  { day: "Wed", morning: "Charlie", night: "Delta" },
  { day: "Thu", morning: "Delta", night: "Alpha" },
  { day: "Fri", morning: "Alpha", night: "Charlie" },
  { day: "Sat", morning: "Bravo", night: "Delta" },
  { day: "Sun", morning: "Charlie", night: "Alpha" },
];

const INITIAL_TEAMS: Team[] = [
  { id: "t1", name: "Team Alpha", members: ["J. Ramos", "M. Cruz", "A. Bautista", "L. Reyes"], leader: "J. Ramos", shift: "Mon AM · Thu PM", route: "R1 Market Perimeter", status: "on_patrol", checkpoints: "3/4" },
  { id: "t2", name: "Team Bravo", members: ["S. Torres", "D. Villanueva", "P. Garcia"], leader: "S. Torres", shift: "Tue AM · Sat PM", route: "R2 Commercial Strip", status: "on_patrol", checkpoints: "1/3" },
  { id: "t3", name: "Team Charlie", members: ["K. Lim", "N. Perez", "R. Aquino", "B. Mendoza"], leader: "K. Lim", shift: "Wed AM · Sun PM", route: "R3 Chapel Loop", status: "on_patrol", checkpoints: "2/4" },
  { id: "t4", name: "Team Delta", members: ["C. Navarro", "E. Diaz", "G. Santos"], leader: "C. Navarro", shift: "Thu AM · Sat AM", route: "R2 Commercial Strip", status: "standby", checkpoints: "0/3" },
];

const TANOD_ROSTER = [
  "J. Ramos", "M. Cruz", "A. Bautista", "L. Reyes",
  "S. Torres", "D. Villanueva", "P. Garcia",
  "K. Lim", "N. Perez", "R. Aquino", "B. Mendoza",
  "C. Navarro", "E. Diaz", "G. Santos",
  "R. Domingo", "F. Cabral", "T. Agbayani", "V. Esguerra",
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

const ROUTES = [
  { id: "R1", name: "Market Perimeter Sweep", team: "Team Alpha", zones: ["Purok 1", "Purok 3"], risk: "high", active: true, duration: "45 min", points: [[150, 160], [95, 190], [80, 70]] as [number, number][] },
  { id: "R2", name: "Commercial Strip Patrol", team: "Team Bravo", zones: ["Purok 4", "Purok 6"], risk: "medium", active: true, duration: "35 min", points: [[250, 185], [330, 260]] as [number, number][] },
  { id: "R3", name: "Chapel Residential Loop", team: "Team Charlie", zones: ["Purok 5"], risk: "medium", active: false, duration: "40 min", points: [[85, 305], [150, 160]] as [number, number][] },
];

const INITIAL_CHECKPOINTS: Checkpoint[] = [
  { id: "CP-01", name: "Plaza Junction", purok: "Purok 3", team: "Team Alpha", status: "cleared", radius: 25, lat: 150, lng: 160, time: "2026-07-20T09:40:00", clearedBy: "gps" },
  { id: "CP-02", name: "Market Entrance", purok: "Purok 3", team: "Team Alpha", status: "cleared", radius: 30, lat: 95, lng: 190, time: "2026-07-20T09:52:00", clearedBy: "gps" },
  { id: "CP-07", name: "River Walk Bridge", purok: "Purok 1", team: "Team Alpha", status: "cleared", radius: 25, lat: 60, lng: 120, time: "2026-07-20T09:10:00", clearedBy: "manual", clearReason: "Route obstruction" },
  { id: "CP-03", name: "Gate Sensor Post", purok: "Purok 1", team: "Team Alpha", status: "pending", radius: 25, lat: 80, lng: 70, time: null },
  { id: "CP-04", name: "Chapel Area", purok: "Purok 5", team: "Team Charlie", status: "pending", radius: 20, lat: 85, lng: 305, time: null },
  { id: "CP-05", name: "School District", purok: "Purok 4", team: "Team Bravo", status: "cleared", radius: 25, lat: 250, lng: 185, time: "2026-07-20T08:30:00", clearedBy: "gps" },
  { id: "CP-06", name: "Commercial Strip", purok: "Purok 6", team: "Team Bravo", status: "missed", radius: 30, lat: 330, lng: 260, time: null, missedReason: "Network failure" },
];

interface PatrolShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  routeId: string;
  status: "Scheduled" | "Active" | "Completed" | "Cancelled" | "Missed";
  notes: string;
}

type ShiftStatus = PatrolShift["status"];

const SHIFT_STATUS_STYLES: Record<ShiftStatus, string> = {
  Scheduled: "bg-sky-100 text-sky-700",
  Active: "bg-emerald-100 text-emerald-700",
  Completed: "bg-blue-100 text-blue-700",
  Cancelled: "bg-stone-100 text-stone-500",
  Missed: "bg-rose-100 text-rose-600",
};

const ACTION_BTN_BASE = "flex h-7 items-center gap-1 rounded-md border bg-white px-2.5 text-[10px] font-semibold transition";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

const INITIAL_SHIFTS: PatrolShift[] = [
  { id: "PS-101", date: todayISO(), startTime: "06:00", endTime: "14:00", team: "Team Alpha", routeId: "R1", status: "Active", notes: "Market perimeter sweep" },
  { id: "PS-102", date: todayISO(), startTime: "06:00", endTime: "14:00", team: "Team Bravo", routeId: "R2", status: "Active", notes: "" },
  { id: "PS-103", date: todayISO(), startTime: "14:00", endTime: "22:00", team: "Team Delta", routeId: "R2", status: "Scheduled", notes: "Commercial strip evening sweep" },
];

function getConfigWarnings(teams: Team[]) {
  const warnings: { level: "error" | "warning"; text: string }[] = [];
  ROUTES.forEach((r) => {
    if (!r.active) {
      warnings.push({ level: "error", text: `Route ${r.id} (${r.name}) is marked inactive — no new shifts may be published to it` });
      teams.filter((t) => t.route.startsWith(r.id)).forEach((t) =>
        warnings.push({ level: "error", text: `${t.name} is still assigned to inactive route ${r.id}` }),
      );
    }
  });
  for (let i = 0; i < INITIAL_CHECKPOINTS.length; i++) {
    for (let j = i + 1; j < INITIAL_CHECKPOINTS.length; j++) {
      const a = INITIAL_CHECKPOINTS[i];
      const b = INITIAL_CHECKPOINTS[j];
      const dist = Math.hypot(a.lat - b.lat, a.lng - b.lng);
      if (dist < 40) {
        warnings.push({ level: "warning", text: `${a.id} (${a.name}) and ${b.id} (${b.name}) are only ~${Math.round(dist)} map units apart — verify geofence radii` });
      }
    }
  }
  INITIAL_CHECKPOINTS.forEach((cp) => {
    if (!cp.lat || !cp.lng) warnings.push({ level: "warning", text: `${cp.id} (${cp.name}) is missing coordinates` });
  });
  return warnings;
}

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

const INITIAL_OFFLINE = [
  { id: "OS-034", author: "Team Delta", type: "status_report", dispatch: "DP-1180", queuedAt: "2026-07-20T09:40:00", size: "24 KB", note: "On-scene status queued inside dead zone" },
  { id: "OS-033", author: "Team Delta", type: "photo", dispatch: "DP-1180", queuedAt: "2026-07-20T09:41:00", size: "1.8 MB", note: "Scene photo captured offline" },
  { id: "OS-032", author: "Team Charlie", type: "status_report", dispatch: "DP-1182", queuedAt: "2026-07-20T08:55:00", size: "18 KB", note: "Checkpoint report buffered locally" },
];

const OFFLINE_TYPE_ICON: Record<string, typeof FileText> = {
  status_report: FileText,
  photo: ImageIcon,
};

function purokPolyline(points: [number, number][]) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
}

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

function ShiftComposeModal({
  teams,
  shifts,
  onClose,
  onSave,
}: {
  teams: Team[];
  shifts: PatrolShift[];
  onClose: () => void;
  onSave: (shift: Omit<PatrolShift, "id" | "status">) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [team, setTeam] = useState(teams[0]?.name ?? "");
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const route = ROUTES.find((r) => r.id === routeId);
  const selectedTeam = teams.find((t) => t.name === team);

  const errors: string[] = [];
  if (!date) errors.push("Shift date is required");
  if (!startTime || !endTime) errors.push("Start and end times are required");
  else if (endTime <= startTime) errors.push("End time must be after start time");
  if (route && !route.active) errors.push(`Route ${route.id} (${route.name}) is inactive and cannot be scheduled`);
  if (!route) errors.push("A route must be selected");
  if (selectedTeam && selectedTeam.members.length === 0) errors.push(`${team} has no rostered members — staffing incomplete`);
  const overlap = shifts.some(
    (s) => s.status !== "Cancelled" && s.team === team && s.date === date && timesOverlap(s.startTime, s.endTime, startTime, endTime),
  );
  if (overlap) errors.push(`${team} already has a shift overlapping this time window — no double-booking allowed`);

  const valid = errors.length === 0;

  function submit() {
    setTouched(true);
    if (!valid) return;
    onSave({ date, startTime, endTime, team, routeId, notes: notes.trim() });
  }

  const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]";

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<Plus size={18} />}
      iconClass="bg-[#E9EDFB] text-[#0038A8]"
      title="Create Patrol Shift"
      subtitle="Pre-publish validation gates the schedule before it reaches Tanod apps"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-lg bg-[#0038A8] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] ${!valid ? "cursor-not-allowed opacity-40" : ""}`}
          >
            Validate &amp; Create Shift
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">SHIFT DATE</span>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setTouched(false); }} className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">START</span>
            <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setTouched(false); }} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">END</span>
            <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setTouched(false); }} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">ASSIGNED TEAM</span>
          <select value={team} onChange={(e) => { setTeam(e.target.value); setTouched(false); }} className={inputCls}>
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} · {t.members.length} tanods · {t.status === "on_patrol" ? "On patrol" : "Standby"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">ROUTE</span>
          <select value={routeId} onChange={(e) => { setRouteId(e.target.value); setTouched(false); }} className={inputCls}>
            {ROUTES.map((r) => (
              <option key={r.id} value={r.id} disabled={!r.active}>
                {r.id} — {r.name} · {r.zones.join(", ")} · ~{r.duration}{r.active ? "" : " (INACTIVE)"}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">NOTES (OPTIONAL)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., Focus on the market side after 10 AM" className={inputCls} />
        </label>
      </div>

      <div className={`mt-4 rounded-lg border px-3.5 py-2.5 ${valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
        {valid ? (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck size={12} />
            All pre-publish checks passed — shift is ready to be created.
          </p>
        ) : (
          <>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
              <AlertTriangle size={12} />
              Pre-publish validation
            </p>
            <ul className="space-y-0.5">
              {errors.map((e) => (
                <li key={e} className="flex items-center gap-1 text-[10px] font-medium text-rose-600">
                  <span className="h-1 w-1 rounded-full bg-rose-500" />
                  {e}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {touched && !valid && <p className="mt-2 text-[10px] font-medium text-rose-600">Fix the items above to create this shift.</p>}
    </Modal>
  );
}

function TeamComposeModal({
  teams,
  onClose,
  onSave,
}: {
  teams: Team[];
  onClose: () => void;
  onSave: (team: Omit<Team, "id" | "shift" | "checkpoints">) => void;
}) {
  const [name, setName] = useState("");
  const [leader, setLeader] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const [touched, setTouched] = useState(false);

  const parsed = selected;
  const route = ROUTES.find((r) => r.id === routeId);

  const assignedTo: Record<string, string> = {};
  teams.forEach((t) => t.members.forEach((m) => { if (!assignedTo[m]) assignedTo[m] = t.name; }));
  const filtered = TANOD_ROSTER.filter((n) => n.toLowerCase().includes(query.toLowerCase()));

  function toggle(name: string) {
    setTouched(false);
    setSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

  const errors: string[] = [];
  if (!name.trim()) errors.push("Team name is required");
  else if (teams.some((t) => t.name.toLowerCase() === name.trim().toLowerCase())) errors.push(`A team named "${name.trim()}" already exists`);
  if (!leader.trim()) errors.push("Team leader is required");
  if (parsed.length === 0) errors.push("Select at least one tanod member");
  if (route && !route.active) errors.push(`Route ${route.id} (${route.name}) is inactive and cannot be assigned`);

  const valid = errors.length === 0;

  function submit() {
    setTouched(true);
    if (!valid) return;
    onSave({
      name: name.trim(),
      leader: leader.trim(),
      members: parsed,
      route: route ? `${route.id} ${route.name}` : "",
      status: "standby",
    });
  }

  const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] text-stone-800 outline-none transition focus:border-[#0038A8]";

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<Users size={18} />}
      iconClass="bg-[#E9EDFB] text-[#0038A8]"
      title="Create Patrol Team"
      subtitle="New teams start on standby and are available for future shift assignments"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-lg bg-[#0038A8] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] ${!valid ? "cursor-not-allowed opacity-40" : ""}`}
          >
            Create Team
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TEAM NAME</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setTouched(false); }} placeholder="e.g., Team Echo" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TEAM LEADER</span>
          <input value={leader} onChange={(e) => { setLeader(e.target.value); setTouched(false); }} placeholder="e.g., R. Domingo" className={inputCls} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">TANOD MEMBERS</span>
          <div className="relative" onMouseEnter={() => setPickerOpen(true)} onMouseLeave={() => setPickerOpen(false)}>
            <div className={`flex min-h-[38px] cursor-pointer items-center rounded-lg border bg-white px-3 py-2 transition ${pickerOpen ? "border-[#0038A8]" : "border-stone-200"} ${selected.length === 0 ? "text-stone-400" : ""}`}>
              {selected.length === 0 ? (
                <span className="flex items-center gap-2 text-[12px]">
                  <Users size={13} className="text-stone-400" />
                  Hover to select tanods…
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggle(n)}
                      title="Click to remove"
                      className="flex items-center gap-1 rounded-full bg-[#0038A8] px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                    >
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 text-[7px] font-bold">{initials(n)}</span>
                      {n}
                      <span className="text-white/70">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pickerOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-stone-200 bg-white shadow-lg">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tanod…"
                  className="w-full rounded-t-lg border-b border-stone-100 px-3 py-2 text-[12px] text-stone-800 outline-none"
                />
                <div className="max-h-44 overflow-y-auto p-1.5">
                  {filtered.length === 0 && <p className="px-3 py-2 text-[11px] text-stone-400">No matching tanods.</p>}
                  {filtered.map((n) => {
                    const isSel = selected.includes(n);
                    const taken = !isSel && assignedTo[n];
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={!!taken}
                        onClick={() => toggle(n)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] ${isSel ? "bg-[#E9EDFB] font-semibold text-[#0038A8]" : taken ? "cursor-not-allowed text-stone-400" : "text-stone-700 hover:bg-stone-50"}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold ${isSel ? "bg-[#0038A8] text-white" : "bg-stone-200 text-stone-500"}`}>{initials(n)}</span>
                        {n}
                        <span className="ml-auto">
                          {isSel ? (
                            <CheckCircle2 size={12} className="text-[#0038A8]" />
                          ) : taken ? (
                            <span className="text-[9px] font-medium text-stone-400">in {assignedTo[n]}</span>
                          ) : (
                            <Plus size={12} className="text-stone-400" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <span className="mt-1 block text-[9px] text-stone-400">Hover the field to browse the tanod roster and click to select — selected tanods are reserved for this team.</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-stone-400">ASSIGNED ROUTE</span>
          <select value={routeId} onChange={(e) => { setRouteId(e.target.value); setTouched(false); }} className={inputCls}>
            {ROUTES.filter((r) => r.active).map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.name} · {r.zones.join(", ")} · ~{r.duration}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[9px] text-stone-400">Only active routes are assignable — inactive routes are blocked.</span>
        </label>
      </div>

      <div className={`mt-4 rounded-lg border px-3.5 py-2.5 ${valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
        {valid ? (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck size={12} />
            Team is ready — {parsed.length} tanod{parsed.length === 1 ? "" : "s"} led by {leader.trim() || "—"}.
          </p>
        ) : (
          <>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
              <AlertTriangle size={12} />
              Team details
            </p>
            <ul className="space-y-0.5">
              {errors.map((e) => (
                <li key={e} className="flex items-center gap-1 text-[10px] font-medium text-rose-600">
                  <span className="h-1 w-1 rounded-full bg-rose-500" />
                  {e}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {touched && !valid && <p className="mt-2 text-[10px] font-medium text-rose-600">Fix the items above to create this team.</p>}
    </Modal>
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
  const gapZones = PUROK_PRESENCE.filter((p) => p.pct < 50).map((p) => p.zone);

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

export default function PatrolSchedulerRoutes() {
  const { flash, ToastPortal } = useToast();

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(INITIAL_CHECKPOINTS);
  const [offline, setOffline] = useState(INITIAL_OFFLINE);
  const [syncing, setSyncing] = useState(false);
  const [published, setPublished] = useState(false);
  const [clearTarget, setClearTarget] = useState<ClearTarget>(null);
  const [shifts, setShifts] = useState<PatrolShift[]>(INITIAL_SHIFTS);
  const [showCompose, setShowCompose] = useState(false);
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [showTeamCompose, setShowTeamCompose] = useState(false);

  function requestClear(id: string) {
    setClearTarget({ id, mode: "clear" });
  }

  function requestMissedReason(id: string) {
    setClearTarget({ id, mode: "missed_reason" });
  }

  function confirmManualClear(id: string, reason: string, officer: string) {
    const cp = checkpoints.find((c) => c.id === id);
    if (!cp) return;
    setCheckpoints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "cleared", clearedBy: "manual", clearReason: reason, clearedByPerson: officer, time: new Date().toISOString() } : c)),
    );
    flash(`${cp.name} CLEARED — manual override (${reason}) by ${officer} · ${cp.team}`);
  }

  function attachMissedReason(id: string, reason: string) {
    const cp = checkpoints.find((c) => c.id === id);
    if (!cp) return;
    setCheckpoints((prev) => prev.map((c) => (c.id === id ? { ...c, missedReason: reason } : c)));
    flash(`Reason recorded for ${cp.name} — status unchanged (Missed — Overdue)`);
  }

  function syncOffline() {
    setSyncing(true);
    setTimeout(() => {
      setOffline([]);
      setSyncing(false);
      flash("Offline queue synchronized — status reports & photos pushed to dashboard");
    }, 1400);
  }

  function setShiftStatus(id: string, to: ShiftStatus, verb: string) {
    const sh = shifts.find((s) => s.id === id);
    if (!sh) return;
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, status: to } : s)));
    flash(`${sh.team} shift ${sh.id} ${verb} — ${sh.date} ${sh.startTime}–${sh.endTime}`);
  }

  function saveShift(input: Omit<PatrolShift, "id" | "status">) {
    const id = `PS-${104 + shifts.length}`;
    const route = ROUTES.find((r) => r.id === input.routeId);
    setShifts((prev) => [...prev, { ...input, id, status: "Scheduled" }]);
    flash(`Shift ${id} created — ${input.team} · ${input.date} ${input.startTime}–${input.endTime} · ${route?.name ?? input.routeId} (Scheduled)`);
    setShowCompose(false);
  }

  function saveTeam(input: Omit<Team, "id" | "shift" | "checkpoints">) {
    const id = `t${teams.length + 1}`;
    setTeams((prev) => [...prev, { ...input, id, shift: "Unassigned", checkpoints: "0/0" }]);
    flash(`Team ${input.name} created — ${input.members.length} tanod${input.members.length === 1 ? "" : "s"}, leader ${input.leader} (standby)`);
    setShowTeamCompose(false);
  }

  const clearedCount = checkpoints.filter((c) => c.status === "cleared").length;
  const missedCount = checkpoints.filter((c) => c.status === "missed").length;
  const manualCount = checkpoints.filter((c) => c.clearedBy === "manual").length;
  const manualByTeam = (teamName: string) => checkpoints.filter((c) => c.clearedBy === "manual" && c.team === teamName).length;
  const onDuty = teams.filter((t) => t.status === "on_patrol").length;
  const gaps = PUROK_PRESENCE.filter((p) => p.pct < 50).length;
  const configWarnings = getConfigWarnings(teams);

  const validation = (() => {
    const items: { label: string; ok: boolean }[] = [];
    const overlaps = shifts.some((s, i) =>
      s.status !== "Cancelled" &&
      shifts.some((o, j) => j !== i && o.status !== "Cancelled" && o.team === s.team && o.date === s.date && timesOverlap(s.startTime, s.endTime, o.startTime, o.endTime)),
    );
    items.push({ label: "No overlapping shifts", ok: !overlaps });
    const badRoute = shifts.some((s) => {
      const r = ROUTES.find((x) => x.id === s.routeId);
      return !r || !r.active;
    });
    items.push({ label: "All routes exist & are active", ok: !badRoute });
    const understaffed = shifts.some((s) => {
      const t = teams.find((x) => x.name === s.team);
      return !t || t.members.length === 0;
    });
    items.push({ label: "Assigned teams staffed", ok: !understaffed });
    return items;
  })();
  const validationPass = validation.every((v) => v.ok);

  const kpis = [
    { label: "SHIFTS PUBLISHED", value: SHIFT_SCHEDULE.length * 2, sub: `${SHIFT_SCHEDULE.length}-day weekly calendar`, icon: CalendarDays },
    { label: "TEAMS ON DUTY", value: `${onDuty}/${teams.length}`, sub: `${teams.reduce((a, t) => a + t.members.length, 0)} tanods rostered`, icon: Users },
    { label: "CHECKPOINTS CLEARED", value: `${clearedCount}/${checkpoints.length}`, sub: `${missedCount} missed · ${manualCount} manual override${manualCount === 1 ? "" : "s"} — review`, icon: CheckCircle2 },
    { label: "COVERAGE GAPS", value: gaps, sub: "zones below 50% presence", icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Patrol Scheduler &amp; Routes</h1>
              <p className="mt-1 text-sm text-stone-500">
                Weekly shift planning, geofenced routes &amp; live force heatmapping
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                <Radio size={12} />
                GPS Tracking Active
              </span>
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#0038A8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#E9EDFB]"
              >
                <Plus size={13} />
                New Shift
              </button>
              <button
                onClick={() => setPublished(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Megaphone size={13} />
                Publish Week
              </button>
            </div>
          </div>
        </header>

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

        <div className="mb-5 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Shift Lifecycle &amp; Review</h3>
                <p className="text-[11px] text-[#94A3B8]">Create &amp; publish shifts — every schedule is gated by pre-publish validation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${validationPass ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                {validationPass ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />}
                {validationPass ? "Validation passed" : "Validation blocked"}
              </span>
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
                                <button onClick={() => setShiftStatus(sh.id, "Active", "STARTED")} className={`${ACTION_BTN_BASE} border-emerald-200 text-emerald-600 hover:bg-emerald-50`}>Start</button>
                                <button onClick={() => setShiftStatus(sh.id, "Cancelled", "CANCELLED")} className={`${ACTION_BTN_BASE} border-stone-200 text-stone-500 hover:bg-stone-50`}>Cancel</button>
                              </>
                            )}
                            {sh.status === "Active" && (
                              <>
                                <button onClick={() => setShiftStatus(sh.id, "Completed", "COMPLETED")} className={`${ACTION_BTN_BASE} border-emerald-200 text-emerald-600 hover:bg-emerald-50`}>Complete</button>
                                <button onClick={() => setShiftStatus(sh.id, "Missed", "MARKED MISSED")} className={`${ACTION_BTN_BASE} border-rose-200 text-rose-600 hover:bg-rose-50`}>Mark Missed</button>
                                <button onClick={() => setShiftStatus(sh.id, "Cancelled", "CANCELLED")} className={`${ACTION_BTN_BASE} border-stone-200 text-stone-500 hover:bg-stone-50`}>Cancel</button>
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

          <div className="border-t border-stone-100 px-5 py-3">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">PRE-PUBLISH VALIDATION</p>
            <div className="flex flex-wrap gap-2">
              {validation.map((v) => (
                <span key={v.label} className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${v.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {v.ok ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                  {v.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 440 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Patrol Duty Planner</h3>
                  <p className="text-[11px] text-[#94A3B8]">Weekly shift assignments &amp; team calendar</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Week 30 · Published</span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-y border-black/5 text-left">
                    <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#94A3B8]">SHIFT</th>
                    {SHIFT_SCHEDULE.map((d) => (
                      <th key={d.day} className="px-2 py-2 text-center text-[10px] font-semibold tracking-wider text-[#94A3B8]">{d.day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["morning", "night"].map((shift) => (
                    <tr key={shift} className="border-b border-black/5 last:border-0">
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${shift === "morning" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                          <Clock size={10} />
                          {shift === "morning" ? "Morning" : "Night"}
                        </span>
                      </td>
                      {SHIFT_SCHEDULE.map((d) => (
                        <td key={d.day} className="px-2 py-2 text-center">
                          <span className="inline-flex items-center justify-center rounded-md bg-[#0038A8]/5 px-2 py-1 text-[11px] font-semibold text-[#0038A8]">
                            {shift === "morning" ? d.morning : d.night}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-stone-400">TEAM LEGEND</span>
                {teams.map((t) => (
                  <span key={t.id} className="flex items-center gap-1.5 rounded-full border border-stone-200 px-2 py-1 text-[10px] font-medium text-stone-600">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0038A8] text-[8px] font-bold text-white">
                      {t.name.replace("Team ", "")}
                    </span>
                    {t.name} · {t.members.length} tanods
                  </span>
                ))}
              </div>
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
                onClick={() => setShowTeamCompose(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#0038A8] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#E9EDFB]"
              >
                <Plus size={11} />
                New Team
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {teams.map((t) => (
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
                    <span className="font-medium text-stone-700">Shift:</span> {t.shift}
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
                        <span
                          className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600"
                          title={`${manualByTeam(t.name)} manual checkpoint confirmation${manualByTeam(t.name) > 1 ? "s" : ""} recently — review for repeated overrides`}
                        >
                          <Hand size={9} />
                          {manualByTeam(t.name)} manual
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-stone-400">
                      <Users size={9} />
                      {t.members.slice(0, 3).join(", ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 460 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Map size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Route Mapping &amp; Geofences</h3>
                  <p className="text-[11px] text-[#94A3B8]">Mandatory checkpoint routes through high-risk purok zones</p>
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
                <span className="flex items-center gap-1 text-[10px] text-rose-600">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> High-Risk
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-5 pb-5">
              <RouteMap checkpoints={checkpoints} onRequestClear={requestClear} />
              {configWarnings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {configWarnings.map((w, i) => (
                    <p key={i} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-medium ${w.level === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      <AlertTriangle size={11} />
                      {w.text}
                    </p>
                  ))}
                </div>
              )}
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
                            <span className="block text-[9px] text-stone-400">{formatTime(cp.time!)}</span>
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Live Force Heatmap</h3>
                  <p className="text-[11px] text-[#94A3B8]">Checkpoint-based area coverage summary — no individual location history</p>
                </div>
              </div>
              <span
                className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500"
                title="Privacy policy: only aggregated, checkpoint-based coverage is shown. Individual movement history is excluded by design."
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
                      <span className={`text-[10px] font-bold ${p.pct < 50 ? "text-rose-600" : p.pct < 80 ? "text-amber-600" : "text-emerald-600"}`}>{p.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                      <div className={`h-full rounded-full ${p.pct < 50 ? "bg-rose-500" : p.pct < 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Offline Data Synchronization</h3>
                  <p className="text-[11px] text-[#94A3B8]">Dead-zone queue auto-pushes on reconnect</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-amber-600">
                <WifiOff size={10} />
                {offline.length} queued
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {offline.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Wifi size={20} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-[12px] font-medium text-stone-500">All offline data synchronized</p>
                  <p className="text-[10px] text-stone-400">No queued reports or photos</p>
                </div>
              ) : (
                offline.map((item) => {
                  const Icon = OFFLINE_TYPE_ICON[item.type] || FileText;
                  return (
                    <div key={item.id} className="rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[11px] font-bold text-stone-900">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-100 text-stone-500">
                            <Icon size={12} />
                          </span>
                          {item.id}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-600">Buffered</span>
                      </div>
                      <p className="mt-1 text-[10px] text-stone-500">{item.note}</p>
                      <p className="mt-1 flex items-center justify-between text-[9px] text-stone-400">
                        <span>{item.author} · {item.dispatch} · {item.size}</span>
                        <span>{formatTime(item.queuedAt)}</span>
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-stone-100 px-5 py-3">
              <button
                onClick={syncOffline}
                disabled={offline.length === 0 || syncing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
              >
                {syncing ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <RefreshCw size={13} />
                )}
                {syncing ? "Synchronizing…" : offline.length > 0 ? `Sync ${offline.length} Queued Item${offline.length > 1 ? "s" : ""}` : "Queue Empty"}
              </button>
              <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-stone-400">
                <Smartphone size={10} />
                Auto-pushes the moment connectivity returns
              </p>
            </div>
          </div>
        </div>
      </main>

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

      {showCompose && (
        <ShiftComposeModal teams={teams} shifts={shifts} onClose={() => setShowCompose(false)} onSave={saveShift} />
      )}

      {showTeamCompose && (
        <TeamComposeModal teams={teams} onClose={() => setShowTeamCompose(false)} onSave={saveTeam} />
      )}

      {published && (
        <ConfirmModal
          type="success"
          title="Shift Calendar Published"
          message={`Week 30 shift calendar published — ${SHIFT_SCHEDULE.length * 2} weekly shifts plus ${shifts.length} created shift${shifts.length === 1 ? "" : "s"} assigned. Pre-publish validation ${validationPass ? "passed — no overlapping shifts, all routes active, all teams staffed" : "has blockers — review the Shift Lifecycle panel before publishing"}. Tanod apps now reflect their duty schedules.`}
          onClose={() => setPublished(false)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
