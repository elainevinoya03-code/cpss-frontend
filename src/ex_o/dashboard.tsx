import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Users,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Clock,
  Radio,
  MapPin,
  Shield,
  Database,
  HardDrive,
  MessageSquare,
  ServerCog,
  BatteryLow,
  WifiOff,
  Video,
  Lock,
} from "lucide-react";
import { Modal } from "../components/ui";
import {
  useIncidentStore,
  getDispatches,
  type Incident,
} from "../desk_officer/incidentStore";
import {
  useTanodStore,
  TANOD_STATUS_META,
} from "../desk_officer/tanodStore";
import { getAuditLogs, subscribeAuditLogs } from "../utils/auditLog";

const INCIDENT_STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  new: { label: "New", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  in_progress: { label: "In Progress", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  closed_false_alarm: { label: "Closed", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

const SEVERITY_META: Record<string, { label: string; dot: string }> = {
  critical: { label: "Critical", dot: "bg-rose-500" },
  high: { label: "High", dot: "bg-orange-500" },
  warning: { label: "Warning", dot: "bg-amber-400" },
  low: { label: "Low", dot: "bg-sky-400" },
};

const SUPPORT_TEAMS = [
  { name: "Desk Officer", status: "on_duty", note: "Triage & dispatch center", icon: Radio },
  { name: "Chief Tanod", status: "on_duty", note: "Field operations command", icon: Shield },
  { name: "CCTV Operators", status: "on_duty", note: "4 of 2 stations active", icon: Camera },
  { name: "Purok Leaders", status: "partial", note: "6 of 7 puroks reporting", icon: Users },
];

const SUPPORT_STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  on_duty: { label: "On Duty", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  partial: { label: "Partial", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  off: { label: "Off", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

const INFRA_HEALTH = [
  { label: "Database", icon: Database, desc: "Connected · pool at 42% capacity" },
  { label: "Storage", icon: HardDrive, desc: "1,730 GB of 2,750 GB used · 63%" },
  { label: "Notification Service", icon: MessageSquare, desc: "All channels operational" },
  { label: "Backend / API", icon: ServerCog, desc: "All endpoints responding · 12ms latency" },
];

const INFRA_STATUS = {
  healthy: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Healthy" },
  warning: { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-400", label: "Warning" },
  unavailable: { badge: "bg-rose-50 text-rose-600", dot: "bg-rose-500", label: "Unavailable" },
} as const;

const ACTIVITY_ICONS: Record<string, typeof AlertTriangle> = {
  offline: WifiOff,
  low_battery: BatteryLow,
  failed_login: Lock,
  camera_offline: Video,
  incident: AlertTriangle,
};

const ACTION_BADGE: Record<string, string> = {
  "User Created": "bg-emerald-50 text-emerald-700",
  "User Updated": "bg-sky-50 text-sky-700",
  "User Disabled": "bg-red-50 text-red-600",
  "User Enabled": "bg-emerald-50 text-emerald-700",
  "Incident Resolved": "bg-emerald-50 text-emerald-700",
  "Broadcast Sent": "bg-amber-50 text-amber-700",
  "Access Requested": "bg-violet-50 text-violet-700",
};

const RECENT_ACTIVITY_SEED = [
  {
    timestamp: "2026-07-20 10:16",
    actionType: "Incident Resolved",
    description: "INC-2068 fire smoke response closed — team stood down after area check",
    admin: "chief@tanod.gov.ph",
  },
  {
    timestamp: "2026-07-20 10:08",
    actionType: "Broadcast Sent",
    description: "High-severity safety notice published to Puroks 3 and 6 residents",
    admin: "desk@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 09:52",
    actionType: "User Enabled",
    description: "Reactivated account for Liza Flores (Tanod, Purok 5)",
    admin: "admin@brgy.gov.ph",
  },
  {
    timestamp: "2026-07-20 09:31",
    actionType: "Access Requested",
    description: "DR-021 data-access request submitted by barangay secretary",
    admin: "desk@brgy.gov.ph",
  },
];

function SectionTitle({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#334155]">{title}</h2>
        {sub && <p className="mt-0.5 text-[11px] text-[#94A3B8]">{sub}</p>}
      </div>
    </div>
  );
}

function formatElapsed(isoStr?: string) {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ExOfficerDashboard() {
  console.log("ExOfficerDashboard component called");
  
  const { incidents } = useIncidentStore();
  const tanods = useTanodStore();
  const [showAlerts, setShowAlerts] = useState(false);
  const [incidentDetail, setIncidentDetail] = useState<Incident | null>(null);
  const [liveLogs, setLiveLogs] = useState(() => getAuditLogs());

  useEffect(() => subscribeAuditLogs(() => setLiveLogs([...getAuditLogs()])), []);

  const openIncidents = useMemo(
    () => [...incidents]
      .filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm")
      .sort((a, b) => (a.time > b.time ? -1 : 1)),
    [incidents]
  );
  const resolvedToday = incidents.filter((i) => i.status === "resolved").length;
  const dispatches = useMemo(() => getDispatches(), []);
  const activeDispatches = dispatches.filter((d) => d.status !== "resolved").length;

  const onDutyTanods = tanods.filter((t) => t.status !== "off_duty");
  const teamsInField = onDutyTanods.filter((t) => t.status !== "available").length;

  const criticalOpen = openIncidents.filter((i) => i.severity === "critical" || i.severity === "high").length;
  const alertTone = criticalOpen > 0 ? "rose" : openIncidents.length > 0 ? "amber" : "emerald";

  const kpiCards = [
    {
      label: "OPEN INCIDENTS",
      value: String(openIncidents.length),
      sub: `${criticalOpen} critical/high · ${activeDispatches} active dispatch${activeDispatches !== 1 ? "es" : ""}`,
      icon: AlertTriangle,
    },
    {
      label: "FIELD TEAMS",
      value: String(onDutyTanods.length),
      sub: `${teamsInField} currently responding`,
      icon: Users,
    },
    {
      label: "RESOLVED (24H)",
      value: String(resolvedToday),
      sub: "cases closed by response teams",
      icon: CheckCircle2,
    },
    {
      label: "SURVEILLANCE",
      value: "12",
      sub: "CCTV cameras · 11 online · 1 offline",
      icon: Camera,
    },
  ];

  const infraCards = INFRA_HEALTH.map((c) => ({
    ...c,
    status: (c.label === "Storage" ? "warning" : "healthy") as keyof typeof INFRA_STATUS,
  }));

  const alertBanner = {
    rose: { chip: "bg-rose-100 text-rose-600", text: "text-rose-800", sub: "text-rose-500", icon: "text-rose-400", border: "border-rose-200", divider: "border-rose-100", hover: "hover:bg-rose-50/40" },
    amber: { chip: "bg-amber-100 text-amber-700", text: "text-amber-800", sub: "text-amber-600", icon: "text-amber-400", border: "border-amber-200", divider: "border-amber-100", hover: "hover:bg-amber-50/40" },
    emerald: { chip: "bg-emerald-100 text-emerald-700", text: "text-emerald-800", sub: "text-emerald-600", icon: "text-emerald-500", border: "border-emerald-200", divider: "border-emerald-100", hover: "hover:bg-emerald-50/40" },
  }[alertTone];

  const recentActivity = useMemo(() => {
    const merged = [...RECENT_ACTIVITY_SEED, ...liveLogs.map((l) => ({
      timestamp: l.timestamp,
      actionType: l.actionType,
      description: l.description,
      admin: l.admin,
    }))];
    return [...merged].sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1)).slice(0, 6);
  }, [liveLogs]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">Executive Officer Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">
            Executive oversight of community safety and field response operations
          </p>
        </header>

        {/* System Overview */}
        <section className="mb-6">
          <SectionTitle title="Operational Overview" sub="Barangay-wide safety posture at a glance" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map(({ label, value, sub, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm"
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
        </section>

        {/* Operational Situation */}
        <section className="mb-6">
          <SectionTitle title="Operational Situation" sub="Live incidents and field response status" />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Active incident queue */}
            <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-[#0038A8]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#334155]">Active Incident Queue</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      {openIncidents.length} open · {activeDispatches} active dispatch{activeDispatches !== 1 ? "es" : ""}
                    </p>
                  </div>
                </div>
              </div>

              {openIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                  <p className="mt-3 text-[13px] font-medium text-[#334155]">No active incidents</p>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">All reported incidents have been resolved.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {openIncidents.map((inc, i) => {
                    const st = INCIDENT_STATUS_META[inc.status] ?? INCIDENT_STATUS_META.new;
                    const sev = SEVERITY_META[inc.severity] ?? SEVERITY_META.warning;
                    const display = inc.description || inc.category;
                    return (
                      <button
                        key={inc.id}
                        onClick={() => setIncidentDetail(inc)}
                        className={`flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-[#F8FAFC] ${
                          i < openIncidents.length - 1 ? "border-b border-black/5" : ""
                        }`}
                      >
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-semibold text-[#334155]">{inc.id}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.badge}`}>{st.label}</span>
                            {sev.label !== "Low" && (
                              <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">{sev.label}</span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#64748B]">{display}</p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-[#94A3B8]">
                            <MapPin size={10} />
                            {inc.purok} · {inc.category} · {formatElapsed(inc.time)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#0038A8]">
                          View
                          <ArrowUpRight size={11} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Field response */}
            <div className="rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
                <Radio size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Field Response</h3>
                  <p className="text-[11px] text-[#94A3B8]">{onDutyTanods.length} tanod teams on shift</p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {onDutyTanods.map((t, i) => {
                  const meta = TANOD_STATUS_META[t.status];
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 px-5 py-2.5 ${
                        i < onDutyTanods.length - 1 ? "border-b border-black/5" : ""
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-[#334155]">
                          {t.name}
                          <span className="ml-1.5 font-normal text-[#94A3B8]">({t.members})</span>
                        </p>
                        <p className="truncate text-[10px] text-[#94A3B8]">
                          {t.purok}{t.assignment ? ` · ${t.assignment}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.chip}`}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-stone-100 px-5 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Support Units
                </p>
                <div className="space-y-2">
                  {SUPPORT_TEAMS.map((team) => {
                    const meta = SUPPORT_STATUS_META[team.status];
                    const Icon = team.icon;
                    return (
                      <div key={team.name} className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-[#334155]">{team.name}</p>
                          <p className="truncate text-[10px] text-[#94A3B8]">{team.note}</p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Infrastructure Health */}
        <section className="mb-6">
          <SectionTitle title="Infrastructure Health" sub="Core platform services supporting the operation" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {infraCards.map(({ label, icon: Icon, desc, status }) => {
              const st = INFRA_STATUS[status];
              return (
                <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                      <Icon size={15} />
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold text-[#334155]">{label}</p>
                  <p className="mt-0.5 text-[11px] text-[#94A3B8]">{desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Attention items */}
        <section className="mb-6">
          <SectionTitle title="Attention Items" sub="Items flagged for executive awareness" />
          <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ${alertBanner.border}`}>
            <button
              onClick={() => setShowAlerts((s) => !s)}
              className={`flex w-full items-center justify-between px-5 py-3.5 transition ${alertBanner.hover}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${alertBanner.chip}`}>
                  <AlertTriangle size={16} />
                </div>
                <div className="text-left">
                  <p className={`text-[13px] font-semibold ${alertBanner.text}`}>
                    {criticalOpen > 0
                      ? `${criticalOpen} Critical Item${criticalOpen !== 1 ? "s" : ""} Requiring Awareness`
                      : openIncidents.length > 0
                        ? `${openIncidents.length} Open Incident${openIncidents.length !== 1 ? "s" : ""} In Progress`
                        : "No Active Concerns"}
                  </p>
                  <p className={`text-[11px] ${alertBanner.sub}`}>
                    {criticalOpen > 0
                      ? "Sensor offline · low battery · camera offline items detected"
                      : openIncidents.length > 0
                        ? "Team dispatch and response progressing"
                        : "All monitored areas reporting within normal limits"}
                  </p>
                </div>
              </div>
              {showAlerts ? (
                <ChevronUp size={16} className={alertBanner.icon} />
              ) : (
                <ChevronDown size={16} className={alertBanner.icon} />
              )}
            </button>

            {showAlerts && (
              <div className={`border-t px-5 py-4 ${alertBanner.divider}`}>
                <div className="space-y-3">
                  {[
                    { id: "i1", title: "SM-PUROK3-01 — Smoke Sensor Offline", type: "offline", reason: "Device offline — no heartbeat for 3 hours", time: "10:32 AM" },
                    { id: "i2", title: "CAM-MARKET-03 — Camera Offline", type: "camera_offline", reason: "No stream for 20 minutes — live feed unavailable", time: "09:51 AM" },
                    { id: "i3", title: "DB-HALL-01 — Battery Low", type: "low_battery", reason: "Sensor battery critically low at 21% — maintenance scheduled", time: "10:05 AM" },
                  ].map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type] ?? AlertTriangle;
                    return (
                      <div key={a.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                        <Icon size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-amber-900">{a.title}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-amber-800/80">{a.reason}</p>
                          <p className="mt-1 text-[11px] text-amber-700/70">{a.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <SectionTitle title="Recent Operational Activity" sub="Latest actions across the barangay safety operation" />
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            {recentActivity.map((log, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-5 py-3 ${i < recentActivity.length - 1 ? "border-b border-black/5" : ""}`}
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0038A8]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug text-[#334155]">{log.description}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#94A3B8]">
                    <Clock size={10} />
                    {log.timestamp} · {log.admin}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  ACTION_BADGE[log.actionType] ?? "bg-stone-100 text-stone-700"
                }`}>
                  {log.actionType}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {incidentDetail && (
        <Modal
          onClose={() => setIncidentDetail(null)}
          title={`Incident ${incidentDetail.id}`}
          subtitle={incidentDetail.category}
          icon={<AlertTriangle size={18} />}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                INCIDENT_STATUS_META[incidentDetail.status]?.badge ?? ""
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${INCIDENT_STATUS_META[incidentDetail.status]?.dot ?? ""}`} />
                {INCIDENT_STATUS_META[incidentDetail.status]?.label ?? incidentDetail.status}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                incidentDetail.severity === "critical" ? "bg-rose-50 text-rose-700" : incidentDetail.severity === "high" ? "bg-orange-50 text-orange-700" : incidentDetail.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[incidentDetail.severity]?.dot ?? ""}`} />
                {SEVERITY_META[incidentDetail.severity]?.label ?? incidentDetail.severity}
              </span>
            </div>

            <p className="text-[13px] leading-relaxed text-stone-600">{incidentDetail.description}</p>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-[11px]">
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">PUROK / ZONE</p>
                <p className="mt-0.5 font-medium text-[#334155]">{incidentDetail.purok}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">REPORTED</p>
                <p className="mt-0.5 font-medium text-[#334155]">{formatElapsed(incidentDetail.time)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">SOURCE</p>
                <p className="mt-0.5 font-medium text-[#334155]">{incidentDetail.source}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">REPORTER</p>
                <p className="mt-0.5 font-medium text-[#334155]">{incidentDetail.reporter}</p>
              </div>
              {incidentDetail.priority && (
                <div>
                  <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">PRIORITY</p>
                  <p className="mt-0.5 font-medium text-[#334155]">{incidentDetail.priority}</p>
                </div>
              )}
              {incidentDetail.assignedTeam && (
                <div>
                  <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">ASSIGNED TEAM</p>
                  <p className="mt-0.5 font-medium text-[#334155]">{incidentDetail.assignedTeam}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIncidentDetail(null)}
                className="rounded-md border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
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