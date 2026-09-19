import { useState } from "react";
import {
  Map,
  Users,
  Clock,
  Eye,
  EyeOff,
  Send,
  RefreshCw,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Compass,
  TrendingUp,
  FileText,
  Download,
  Printer,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_ZONES } from "../constants/purok";
import { Modal } from "../components/ui";
import { addCaptainInboxItem } from "../utils/captainInboxStore";

const PATROL_TEAMS = [
  {
    id: "t1", name: "Team Alpha", leader: "Ofc. Reyes", members: ["Ofc. Reyes", "Ofc. Santos"],
    purok: "p3", purokName: "Purok 3", assignment: "Market Zone sweep",
    status: "active", checkedInAt: "2026-07-20T06:00:00",
    route: ["r1", "r2", "r3", "r4"], checkpointsCleared: 2, totalCheckpoints: 4,
  },
  {
    id: "t2", name: "Team Bravo", leader: "Ofc. Dela Cruz", members: ["Ofc. Dela Cruz", "Ofc. Garcia"],
    purok: "p4", purokName: "Purok 4", assignment: "School District patrol",
    status: "active", checkedInAt: "2026-07-20T06:05:00",
    route: ["r5", "r6", "r7", "r8"], checkpointsCleared: 1, totalCheckpoints: 4,
  },
  {
    id: "t3", name: "Team Charlie", leader: "Ofc. Torres", members: ["Ofc. Torres", "Ofc. Lim"],
    purok: "p5", purokName: "Purok 5", assignment: "Chapel to Riverside sweep",
    status: "active", checkedInAt: "2026-07-20T06:10:00",
    route: ["r9", "r10", "r11", "r12"], checkpointsCleared: 3, totalCheckpoints: 4,
  },
  {
    id: "t4", name: "Team Delta", leader: "Ofc. Ramos", members: ["Ofc. Ramos", "Ofc. Cruz"],
    purok: "p6", purokName: "Purok 6", assignment: "Commercial strip standby",
    status: "active", checkedInAt: "2026-07-20T06:00:00",
    route: ["r13", "r14", "r15", "r16"], checkpointsCleared: 0, totalCheckpoints: 4,
  },
];

const CHECKPOINTS = [
  { id: "r1", name: "CP-1: Market Gate", lat: 110, lng: 180, purok: "p3", radius: 15, clearedBy: "Team Alpha", clearedAt: "2026-07-20T06:25:00" },
  { id: "r2", name: "CP-2: Market Interior", lat: 90, lng: 210, purok: "p3", radius: 15, clearedBy: "Team Alpha", clearedAt: "2026-07-20T06:45:00" },
  { id: "r3", name: "CP-3: Purok 3 Bridge", lat: 75, lng: 235, purok: "p3", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r4", name: "CP-4: Purok 3 End", lat: 120, lng: 250, purok: "p3", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r5", name: "CP-5: School Front", lat: 200, lng: 160, purok: "p4", radius: 15, clearedBy: "Team Bravo", clearedAt: "2026-07-20T06:30:00" },
  { id: "r6", name: "CP-6: School Back", lat: 230, lng: 190, purok: "p4", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r7", name: "CP-7: Purok 4 Center", lat: 250, lng: 220, purok: "p4", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r8", name: "CP-8: Purok 4 Edge", lat: 270, lng: 250, purok: "p4", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r9", name: "CP-9: Chapel Area", lat: 85, lng: 310, purok: "p5", radius: 15, clearedBy: "Team Charlie", clearedAt: "2026-07-20T06:15:00" },
  { id: "r10", name: "CP-10: Riverside Path", lat: 100, lng: 340, purok: "p5", radius: 15, clearedBy: "Team Charlie", clearedAt: "2026-07-20T06:35:00" },
  { id: "r11", name: "CP-11: Purok 5 Mid", lat: 155, lng: 330, purok: "p5", radius: 15, clearedBy: "Team Charlie", clearedAt: "2026-07-20T06:55:00" },
  { id: "r12", name: "CP-12: Purok 5 End", lat: 200, lng: 355, purok: "p5", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r13", name: "CP-13: Commercial Main", lat: 320, lng: 240, purok: "p6", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r14", name: "CP-14: Commercial Side", lat: 350, lng: 270, purok: "p6", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r15", name: "CP-15: Purok 6 Deep", lat: 370, lng: 310, purok: "p6", radius: 15, clearedBy: null, clearedAt: null },
  { id: "r16", name: "CP-16: Purok 6 Edge", lat: 340, lng: 340, purok: "p6", radius: 15, clearedBy: null, clearedAt: null },
];

const RECENT_LOGS = [
  { time: "2026-07-20T06:55:00", team: "Team Charlie", event: "Checkpoint CP-11 cleared", type: "checkpoint" },
  { time: "2026-07-20T06:45:00", team: "Team Alpha", event: "Checkpoint CP-2 cleared", type: "checkpoint" },
  { time: "2026-07-20T06:35:00", team: "Team Charlie", event: "Checkpoint CP-10 cleared", type: "checkpoint" },
  { time: "2026-07-20T06:30:00", team: "Team Bravo", event: "Checkpoint CP-5 cleared", type: "checkpoint" },
  { time: "2026-07-20T06:25:00", team: "Team Alpha", event: "Checkpoint CP-1 cleared", type: "checkpoint" },
  { time: "2026-07-20T06:15:00", team: "Team Charlie", event: "Checkpoint CP-9 cleared", type: "checkpoint" },
  { time: "2026-07-20T06:10:00", team: "Team Charlie", event: "Digital check-in completed", type: "checkin" },
  { time: "2026-07-20T06:05:00", team: "Team Bravo", event: "Digital check-in completed", type: "checkin" },
  { time: "2026-07-20T06:00:00", team: "Team Alpha", event: "Digital check-in completed", type: "checkin" },
  { time: "2026-07-20T06:00:00", team: "Team Delta", event: "Digital check-in completed", type: "checkin" },
];

const TIME_RANGES = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
];

const TEAM_STATUS: Record<string, { badge: string; label: string }> = {
  active: { badge: "bg-emerald-100 text-emerald-700", label: "On Duty" },
  standby: { badge: "bg-amber-100 text-amber-700", label: "Standby" },
  offduty: { badge: "bg-stone-100 text-stone-500", label: "Off Duty" },
};

const COVERAGE_THRESHOLD = 40;

const LATEST_ACTIVITY = CHECKPOINTS.reduce(
  (latest, cp) => (cp.clearedAt && cp.clearedAt > latest ? cp.clearedAt : latest),
  ""
);

function clearedInRange(clearedAt: string | null, range: string): boolean {
  if (!clearedAt || !LATEST_ACTIVITY) return false;
  const cleared = new Date(clearedAt).getTime();
  const anchor = new Date(LATEST_ACTIVITY).getTime();
  if (range === "today" || range === "live") {
    return new Date(clearedAt).toDateString() === new Date(LATEST_ACTIVITY).toDateString();
  }
  const days = range === "7d" ? 7 : 30;
  return anchor - cleared <= days * 86400000;
}

function getZoneCoverage(range: string) {
  return PUROK_ZONES.map((zone) => {
    const zoneCPs = CHECKPOINTS.filter((cp) => cp.purok === zone.id);
    const clearedCPs = zoneCPs.filter((cp) => clearedInRange(cp.clearedAt, range));
    const total = zoneCPs.length;
    const pct = total > 0 ? Math.round((clearedCPs.length / total) * 100) : 0;
    const lastActivity = clearedCPs
      .map((cp) => cp.clearedAt)
      .sort()
      .pop() ?? null;
    return { zone, cleared: clearedCPs.length, total, pct, lastActivity };
  });
}

const MOCK_INCIDENTS = [
  { id: "INC-2047", category: "Fire/Smoke", severity: "critical", purok: "p3", lat: 100, lng: 200, time: "2026-07-20T09:32:00", reportedBy: "Maria Santos" },
  { id: "INC-2046", category: "Noise Disturbance", severity: "warning", purok: "p4", lat: 210, lng: 170, time: "2026-07-20T10:05:00", reportedBy: "Juan Dela Cruz" },
  { id: "INC-2045", category: "Fire/Smoke", severity: "low", purok: "p1", lat: 110, lng: 65, time: "2026-07-20T08:45:00", reportedBy: "Pedro Reyes" },
  { id: "INC-2044", category: "Noise Disturbance", severity: "low", purok: "p6", lat: 330, lng: 240, time: "2026-07-20T07:20:00", reportedBy: "Ana Lim" },
];

const MOCK_IOT_SENSORS = [
  { id: "s1", name: "SM-GATE-01", type: "smoke", lat: 110, lng: 65, status: "online", value: 120, threshold: 500, purok: "p1" },
  { id: "s3", name: "DB-HALL-01", type: "noise", lat: 210, lng: 170, status: "warning", value: 78, threshold: 85, purok: "p4" },
  { id: "s4", name: "SM-PUROK3-01", type: "smoke", lat: 100, lng: 200, status: "offline", value: 0, threshold: 500, purok: "p3" },
  { id: "s5", name: "DB-MARKET-01", type: "noise", lat: 330, lng: 240, status: "online", value: 62, threshold: 85, purok: "p6" },
];

const MOCK_TRENDS = [
  { purok: "Purok 1", id: "p1", currentCoverage: 20, prevCoverage: 8, change: 12, avgCheckpoints: 1.2, incidentsResolved: 14, responseTime: "5.2 min", trend: "up" as const },
  { purok: "Purok 2", id: "p2", currentCoverage: 15, prevCoverage: 22, change: -7, avgCheckpoints: 0.8, incidentsResolved: 11, responseTime: "6.1 min", trend: "down" as const },
  { purok: "Purok 3", id: "p3", currentCoverage: 85, prevCoverage: 72, change: 13, avgCheckpoints: 3.4, incidentsResolved: 18, responseTime: "3.8 min", trend: "up" as const },
  { purok: "Purok 4", id: "p4", currentCoverage: 70, prevCoverage: 65, change: 5, avgCheckpoints: 2.8, incidentsResolved: 12, responseTime: "4.5 min", trend: "up" as const },
  { purok: "Purok 5", id: "p5", currentCoverage: 90, prevCoverage: 88, change: 2, avgCheckpoints: 3.6, incidentsResolved: 9, responseTime: "3.2 min", trend: "up" as const },
  { purok: "Purok 6", id: "p6", currentCoverage: 55, prevCoverage: 60, change: -5, avgCheckpoints: 2.2, incidentsResolved: 7, responseTime: "5.8 min", trend: "down" as const },
];

function PatrolCoverageMap({ coverage, showCheckpoints, showIncidents, showIoT, incidents, sensors, hoveredZone, onHoverZone }) {
  const SEVERITY_DOT: Record<string, string> = {
    critical: "fill-rose-500",
    warning: "fill-amber-400",
    low: "fill-stone-400",
  };
  const SENSOR_DOT: Record<string, { fill: string; stroke: string }> = {
    online: { fill: "#10b981", stroke: "#059669" },
    warning: { fill: "#fbbf24", stroke: "#d97706" },
    offline: { fill: "#f43f5e", stroke: "#e11d48" },
  };
  const BAND_STYLE: Record<string, { fill: string; label: string }> = {
    high: { fill: "#10b981", label: "High Coverage" },
    med: { fill: "#fbbf24", label: "Partial Coverage" },
    low: { fill: "#f43f5e", label: "Low Coverage" },
  };
  function bandFor(pct: number) {
    return pct >= 60 ? BAND_STYLE.high : pct >= 20 ? BAND_STYLE.med : BAND_STYLE.low;
  }
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Map size={16} className="text-[#15803D]" />
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">Patrol Coverage Map</h3>
            <p className="text-[11px] text-stone-400">
              Area-based coverage from cleared checkpoint logs — live GPS positions are not shown to the Captain
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> High
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Partial
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Low
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Cleared
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-full bg-stone-300" /> Pending
          </span>
          {showIncidents && (
            <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Incident
            </span>
          )}
          {showIoT && (
            <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> IoT Alert
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5">
        <div className="relative h-full rounded-lg border border-stone-200 bg-stone-50">
          <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            {coverage.map(({ zone, cleared, total, pct, lastActivity }) => {
              const band = bandFor(pct);
              const isHovered = hoveredZone === zone.id;
              return (
                <g
                  key={zone.id}
                  onMouseEnter={() => onHoverZone(zone.id)}
                  onMouseLeave={() => onHoverZone(null)}
                >
                  <path
                    d={zone.path}
                    fill={band.fill}
                    fillOpacity={isHovered ? 0.3 : 0.16}
                    stroke={zone.color}
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    className="transition-all duration-200"
                  />
                  <text
                    x={zone.labelX}
                    y={zone.labelY}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fontSize="10"
                    fontWeight="500"
                    fill={zone.color}
                    opacity={0.85}
                  >
                    {zone.name}
                  </text>
                  <text
                    x={zone.labelX}
                    y={zone.labelY + 11}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fontSize="6"
                    fontWeight="600"
                    fill={band.fill}
                  >
                    {pct}% &middot; {cleared}/{total} CPs
                  </text>
                  <text
                    x={zone.labelX}
                    y={zone.labelY + 19}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fontSize="5"
                    fill="#9ca3af"
                  >
                    Last {lastActivity ? formatTime(lastActivity) : "no patrol"}
                  </text>
                </g>
              );
            })}

            {showCheckpoints && CHECKPOINTS.map((cp) => (
              <g key={cp.id}>
                <circle
                  cx={cp.lat}
                  cy={cp.lng}
                  r={cp.radius}
                  fill="none"
                  stroke={cp.clearedBy ? "#10b981" : "#d1d5db"}
                  strokeWidth={1}
                  strokeDasharray={cp.clearedBy ? "none" : "3 2"}
                  opacity={0.6}
                />
                <circle
                  cx={cp.lat}
                  cy={cp.lng}
                  r={4}
                  fill={cp.clearedBy ? "#10b981" : "#d1d5db"}
                  stroke="white"
                  strokeWidth={1.5}
                />
                {cp.clearedBy && (
                  <text x={cp.lat} y={cp.lng + 1.5} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">âœ“</text>
                )}
              </g>
            ))}

            {showIncidents && incidents.map((inc) => (
              <g key={inc.id}>
                <circle cx={inc.lat} cy={inc.lng} r={10} fill={SEVERITY_DOT[inc.severity] ?? "fill-stone-400"} opacity={0.25} />
                <circle cx={inc.lat} cy={inc.lng} r={5} fill="white" stroke={inc.severity === "critical" ? "#f43f5e" : inc.severity === "warning" ? "#fbbf24" : "#9ca3af"} strokeWidth={1.5} />
                <text x={inc.lat} y={inc.lng + 1.5} textAnchor="middle" fontSize="5" fontWeight="700" fill={inc.severity === "critical" ? "#f43f5e" : inc.severity === "warning" ? "#d97706" : "#6b7280"}>!</text>
              </g>
            ))}

            {showIoT && sensors.map((s) => (
              <g key={s.id}>
                <circle cx={s.lat} cy={s.lng} r={10} fill={SENSOR_DOT[s.status]?.fill ?? "#d1d5db"} opacity={0.2} />
                <circle cx={s.lat} cy={s.lng} r={5} fill={SENSOR_DOT[s.status]?.fill ?? "#d1d5db"} stroke="white" strokeWidth={1.5} />
                <text x={s.lat} y={s.lng + 1.5} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">
                  {s.type === "smoke" ? "ðŸ”¥" : "ðŸ“¡"}
                </text>
              </g>
            ))}
          </svg>

          {hoveredZone && (() => {
            const c = coverage.find((x) => x.zone.id === hoveredZone);
            if (!c) return null;
            const band = bandFor(c.pct);
            return (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg"
                style={{ left: Math.min(c.zone.labelX + 20, 320), top: Math.max(c.zone.labelY - 40, 10) }}
              >
                <p className="text-[11px] font-semibold text-stone-900">{c.zone.name}</p>
                <p className="text-[10px] text-stone-500">{c.cleared} of {c.total} checkpoints cleared</p>
                <p className="text-[10px] font-medium" style={{ color: band.fill }}>{c.pct}% coverage</p>
                <p className="text-[10px] text-stone-400">
                  Last patrol: {c.lastActivity ? formatTime(c.lastActivity) : "None this shift"}
                </p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function TeamDetailDrawer({ team, onClose, onRecommend }: { team: any; onClose: () => void; onRecommend: (team: any) => void }) {
  if (!team) return null;
  const status = TEAM_STATUS[team.status];
  const teamCheckpoints = CHECKPOINTS.filter((cp) => team.route.includes(cp.id));
  const clearedPct = team.totalCheckpoints > 0 ? ((team.checkpointsCleared / team.totalCheckpoints) * 100).toFixed(0) : "0";

  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={team.name}
      subtitle={`${team.purokName} · Led by ${team.leader}`}
      aside={
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.badge}`}>
          {status.label}
        </span>
      }
      footer={
        <button
          onClick={() => onRecommend(team)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#166534]"
        >
          <Compass size={14} />
          Recommend Patrol Adjustment
        </button>
      }
    >
      <div>
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">ON-DUTY STATUS</p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-stone-900">
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.badge}`}>
                  {status.label}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">LAST CHECK-IN</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{formatTime(team.checkedInAt)}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">ASSIGNMENT</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{team.assignment}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">CHECKPOINT PROGRESS</p>
              <p className="mt-1 text-[12px] font-semibold text-[#15803D]">{clearedPct}%</p>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-stone-900">Route Progress</p>
              <span className="text-[11px] font-semibold text-[#15803D]">{clearedPct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${clearedPct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-stone-400">{team.checkpointsCleared} of {team.totalCheckpoints} checkpoints cleared</p>
          </div>

          <div className="mb-5">
            <p className="mb-2 text-[11px] font-semibold text-stone-900">Team Members</p>
            <div className="space-y-1.5">
              {team.members.map((m) => (
                <div key={m} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DCFCE7] text-[10px] font-bold text-[#15803D]">
                    {m.split(" ").pop()?.[0]}
                  </div>
                  <span className="text-[11px] font-medium text-stone-900">{m}</span>
                  {m === team.leader && (
                    <span className="ml-auto rounded-full bg-[#15803D]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#15803D]">Leader</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold text-stone-900">Checkpoint Log</p>
            <div className="space-y-1.5">
              {teamCheckpoints.map((cp) => (
                <div key={cp.id} className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2">
                  {cp.clearedBy ? (
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                  ) : (
                    <Circle size={14} className="shrink-0 text-stone-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-stone-900">{cp.name}</p>
                    {cp.clearedAt && (
                      <p className="text-[10px] text-stone-400">Cleared at {formatTime(cp.clearedAt)}</p>
                    )}
                  </div>
                  {cp.clearedBy && (
                    <CheckCircle2 size={10} className="text-emerald-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

    </Modal>
  );
}

function RecommendationModal({ preset, onClose, onSend }: {
  preset: { purok: string; coverage: number | null; reason: string; recommendation: string } | null;
  onClose: () => void;
  onSend: (data: { purok: string; coverage: string; reason: string; recommendation: string }) => void;
}) {
  const [purok, setPurok] = useState(preset?.purok ?? "All Puroks");
  const [coverage, setCoverage] = useState(preset?.coverage != null ? String(preset.coverage) : "");
  const [reason, setReason] = useState(preset?.reason ?? "");
  const [recommendation, setRecommendation] = useState(preset?.recommendation ?? "");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !recommendation.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Modal
        size="md"
        icon={<Send size={22} className="text-emerald-600" />}
        iconClass="bg-emerald-100"
        title="Recommendation Sent to Desk Officer"
        subtitle="The Desk Officer will review the recommendation and decide whether to execute the patrol adjustment."
        footer={
          <button
            onClick={() => { onSend({ purok, coverage, reason, recommendation }); onClose(); }}
            className="mt-5 w-full rounded-lg bg-[#15803D] px-6 py-2 text-[12px] font-semibold text-white transition hover:bg-[#166534]"
          >
            Done
          </button>
        }
      >
        <div className="space-y-3 text-left">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">PUROK / ZONE</p>
              <p className="mt-1 text-[12px] font-semibold text-stone-900">{purok}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">CURRENT COVERAGE</p>
              <p className="mt-1 text-[12px] font-semibold text-[#15803D]">{coverage ? `${coverage}%` : "—"}</p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">REASON</p>
            <p className="mt-1 text-[11px] text-stone-600">{reason}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">RECOMMENDATION</p>
            <p className="mt-1 text-[11px] text-stone-600">{recommendation}</p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      icon={<Compass size={16} className="text-[#15803D]" />}
      title="Recommend Patrol Adjustment"
      subtitle="Send an operational recommendation to the Desk Officer"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
            Cancel
          </button>
          <button type="submit" form="recommendation-form" className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]">
            <Send size={12} />
            Send Recommendation
          </button>
        </div>
      }
    >
      <form id="recommendation-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Purok / Zone</p>
            <div className="relative">
              <Map size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <select
                value={purok}
                onChange={(e) => setPurok(e.target.value)}
                className="w-full appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-[12px] text-stone-900 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
              >
                <option value="All Puroks">All Puroks — Barangay-wide</option>
                {PUROK_ZONES.map((z) => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Current Coverage (%)</p>
            <input
              type="number"
              min={0}
              max={100}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              placeholder="e.g. 20"
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Reason</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Low coverage in the zone — checkpoint clears are below target this shift."
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
              required
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Recommendation</p>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={3}
              placeholder="e.g. Increase patrol frequency in this zone or assign an available team to sweep it."
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
              required
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <Compass size={12} className="mt-0.5 shrink-0 text-stone-400" />
            <p className="text-[10px] text-stone-500">
              This is a recommendation only. The <span className="font-semibold text-stone-700">Desk Officer decides</span> whether to
              execute the patrol adjustment and remains responsible for patrol assignment.
            </p>
          </div>
      </form>
    </Modal>
  );
}

export default function LivePatrol() {
  const { flash, ToastPortal } = useToast();

  const teams = PATROL_TEAMS;
  const [timeRange, setTimeRange] = useState("live");
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [recommendationPreset, setRecommendationPreset] = useState<any>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [showIncidents, setShowIncidents] = useState(false);
  const [showIoT, setShowIoT] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const zoneCoverage = getZoneCoverage(timeRange);

  const activeUnits = teams.filter((t) => t.status === "active").length;
  const totalCleared = zoneCoverage.reduce((a, c) => a + c.cleared, 0);
  const totalCPs = zoneCoverage.reduce((a, c) => a + c.total, 0);
  const coveragePct = totalCPs > 0 ? Math.round((totalCleared / totalCPs) * 100) : 0;
  const zonesCovered = zoneCoverage.filter((c) => c.pct >= COVERAGE_THRESHOLD).length;
  const lowCoverageZones = zoneCoverage
    .filter((c) => c.pct < COVERAGE_THRESHOLD)
    .map((c) => ({
      purok: c.zone.name,
      coverage: c.pct,
      lastPatrol: c.lastActivity ? formatTime(c.lastActivity) : "No patrol",
      risk: c.pct < 20 ? "high" : "medium" as const,
    }));

  const kpis = [
    { label: "ACTIVE UNITS", value: `${activeUnits}/${teams.length}`, sub: "On duty this shift", icon: Users },
    { label: "CHECKPOINTS CLEARED", value: `${totalCleared}/${totalCPs}`, sub: "Across all zones", icon: CheckCircle2 },
    { label: "ROUTE COVERAGE", value: `${coveragePct}%`, sub: "Of checkpoints cleared", icon: Map },
    { label: "ZONES COVERED", value: `${zonesCovered}/${zoneCoverage.length}`, sub: "Puroks at ≥ 40% coverage", icon: Compass },
    { label: "LOW-COVERAGE ZONES", value: lowCoverageZones.length, sub: "Below 40% coverage", icon: AlertTriangle },
  ];

  const logTypeColors: Record<string, string> = {
    checkpoint: "bg-emerald-400",
    checkin: "bg-sky-400",
    alert: "bg-rose-400",
  };

  function buildRecommendationPreset(purok: string, coverage: number | null, reason: string, recommendation: string) {
    return { purok, coverage, reason, recommendation };
  }

  function handleRecommendSend(data: { purok: string; coverage: string; reason: string; recommendation: string }) {
    addCaptainInboxItem({
      type: "patrol_recommendation",
      incidentId: "—",
      title: `Patrol adjustment — ${data.purok}`,
      purok: data.purok,
      priority: Number(data.coverage) < 20 ? "High" : "Medium",
      reason: data.recommendation,
      submittedBy: "Capt. Reyes",
    });
    flash(`Recommendation sent to the Desk Officer for ${data.purok}`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Patrol Coverage &amp; Oversight</h1>
              <p className="mt-1 text-sm text-stone-500">
                Executive patrol oversight — coverage, checkpoint status &amp; low-coverage zones, with no live GPS tracking for the Captain
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-900 hover:bg-stone-50"
              >
                <Download size={13} />
                Export Report
              </button>
            </div>
          </div>
        </header>

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                onClick={() => setTimeRange(tr.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  timeRange === tr.key ? "bg-[#15803D] text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCheckpoints((p) => !p)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                showCheckpoints ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {showCheckpoints ? <CheckCircle2 size={12} /> : <Circle size={12} />}
              Checkpoints
            </button>
            <button
              onClick={() => setShowIncidents((p) => !p)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                showIncidents ? "border-rose-200 bg-rose-50 text-rose-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {showIncidents ? <Eye size={12} /> : <EyeOff size={12} />}
              Incidents
            </button>
            <button
              onClick={() => setShowIoT((p) => !p)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                showIoT ? "border-amber-200 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {showIoT ? <Eye size={12} /> : <EyeOff size={12} />}
              IoT Alerts
            </button>
            <button
              onClick={() => { setTimeRange("live"); setShowCheckpoints(true); }}
              className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50"
            >
              <RefreshCw size={11} />
              Reset
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-stone-400">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#15803D]">{value}</div>
              <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 480 }}>
          <div className="xl:col-span-2 min-h-0">
            <PatrolCoverageMap
              coverage={zoneCoverage}
              showCheckpoints={showCheckpoints}
              showIncidents={showIncidents}
              showIoT={showIoT}
              incidents={MOCK_INCIDENTS}
              sensors={MOCK_IOT_SENSORS}
              hoveredZone={hoveredZone}
              onHoverZone={setHoveredZone}
            />
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-stone-900">Patrol Teams</h3>
                  <p className="text-[11px] text-stone-400">{activeUnits} active</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pt-1 pb-2">
              {teams.map((team, i) => {
                const status = TEAM_STATUS[team.status];
                const cpPct = team.totalCheckpoints > 0 ? (team.checkpointsCleared / team.totalCheckpoints) * 100 : 0;
                return (
                  <div
                    key={team.id}
                    className={`px-5 py-3 ${i < teams.length - 1 ? "border-b border-black/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                        <Compass size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-stone-900">{team.name}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${status.badge}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-stone-500">{team.assignment}</p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-stone-400">
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            Last check-in {formatTime(team.checkedInAt)}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                            <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${cpPct}%` }} />
                          </div>
                          <p className="mt-0.5 text-[9px] text-stone-400">{team.checkpointsCleared}/{team.totalCheckpoints} checkpoints</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 pl-10">
                      <button
                        onClick={() => setSelectedTeam(team)}
                        className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        <Eye size={11} />
                        Details
                      </button>
                      <button
                        onClick={() => {
                          const cov = zoneCoverage.find((c) => c.zone.name === team.purokName)?.pct ?? null;
                          setRecommendationPreset(buildRecommendationPreset(
                            team.purokName,
                            cov,
                            `${team.purokName} is at ${cov ?? "n/a"}% coverage on this shift.`,
                            `Review patrol priorities in ${team.purokName} and, if needed, shift an available team to a lower-coverage zone.`
                          ));
                        }}
                        className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        <Compass size={11} />
                        Recommend
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center gap-2 px-5 py-4">
                <AlertTriangle size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-stone-900">Low Coverage Zones</h3>
                  <p className="text-[11px] text-stone-400">Zones below the {COVERAGE_THRESHOLD}% coverage target</p>
                </div>
              </div>

              <div className="flex-1 max-h-80 overflow-y-auto scrollbar-hide space-y-2 px-5 pb-5">
                {lowCoverageZones.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-700">
                    <CheckCircle2 size={13} />
                    All zones are at or above the coverage target.
                  </div>
                ) : (
                  lowCoverageZones.map((z) => (
                    <div key={z.purok} className={`rounded-lg border px-3 py-2.5 ${
                      z.risk === "high" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-stone-900">{z.purok}</span>
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          z.risk === "high" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {z.risk === "high" ? "High Risk" : "Medium"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[9px] text-stone-400">
                        <span className="font-medium text-stone-600">{z.coverage}% coverage</span>
                        <span>Last patrol: {z.lastPatrol}</span>
                      </div>
                      <button
                        onClick={() => setRecommendationPreset(buildRecommendationPreset(
                          z.purok,
                          z.coverage,
                          `${z.purok} has ${z.coverage}% coverage, below the ${COVERAGE_THRESHOLD}% target.`,
                          `Schedule additional patrol sweeps in ${z.purok} to raise coverage above the target.`
                        ))}
                        className="mt-2 flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-700 transition hover:bg-stone-50"
                      >
                        <Send size={10} />
                        Recommend to Desk
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-stone-900">Activity Feed</h3>
                  <p className="text-[11px] text-stone-400">Checkpoint clears, check-ins &amp; system events</p>
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto scrollbar-hide space-y-0">
              {RECENT_LOGS.map((item, i, arr) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-5 py-3 ${
                    i < arr.length - 1 ? "border-b border-black/5" : ""
                  }`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${logTypeColors[item.type] ?? "bg-stone-300"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug text-stone-900">
                      <span className="font-semibold">{item.team}</span> â€” {item.event}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                      <Clock size={10} />
                      {formatTime(item.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {timeRange !== "live" && (
          <div className="mt-5 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4">
              <TrendingUp size={16} className="text-[#15803D]" />
              <div>
                <h3 className="text-[14px] font-semibold text-stone-900">Historical Trend Comparison</h3>
                <p className="text-[11px] text-stone-400">
                  Coverage &amp; performance vs. previous period â€”{" "}
                  {timeRange === "today" ? "vs. yesterday" : timeRange === "7d" ? "vs. previous 7 days" : "vs. previous 30 days"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-6">
              {MOCK_TRENDS.map((t) => (
                <div key={t.id} className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-3">
                  <p className="text-[10px] font-medium tracking-wider text-stone-400">{t.purok}</p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold text-stone-900">{t.currentCoverage}%</span>
                    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${t.trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.trend === "up" ? "â†‘" : "â†“"} {Math.abs(t.change)}%
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-[9px] text-stone-400">
                    <div className="flex justify-between">
                      <span>Avg CPs/day</span>
                      <span className="font-medium text-stone-600">{t.avgCheckpoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Incidents resolved</span>
                      <span className="font-medium text-stone-600">{t.incidentsResolved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg response</span>
                      <span className="font-medium text-stone-600">{t.responseTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <TeamDetailDrawer
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
        onRecommend={(team) => {
          setSelectedTeam(null);
          const cov = zoneCoverage.find((c) => c.zone.name === team.purokName)?.pct ?? null;
          setRecommendationPreset(buildRecommendationPreset(
            team.purokName,
            cov,
            `${team.purokName} is at ${cov ?? "n/a"}% coverage on this shift.`,
            `Review patrol priorities in ${team.purokName} and, if needed, shift an available team to a lower-coverage zone.`
          ));
        }}
      />

      {recommendationPreset && (
        <RecommendationModal
          preset={recommendationPreset}
          onClose={() => setRecommendationPreset(null)}
          onSend={handleRecommendSend}
        />
      )}

      {showExportModal && (
        <Modal
          size="md"
          onClose={() => setShowExportModal(false)}
          icon={<FileText size={16} className="text-[#15803D]" />}
          title="Export Patrol Report"
          footer={
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowExportModal(false); flash("Report exported as PDF"); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-2 text-[12px] font-medium text-white transition hover:bg-[#166534]"
              >
                <Download size={13} />
                Download PDF
              </button>
              <button
                onClick={() => { setShowExportModal(false); flash("Report sent to printer"); }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 transition hover:bg-stone-50"
              >
                <Printer size={13} />
                Print
              </button>
            </div>
          }
        >
          <div className="mt-4 rounded-lg border border-stone-100 bg-stone-50 p-4">
              <p className="text-[12px] font-medium text-stone-700">Report Summary</p>
              <div className="mt-2 space-y-1.5 text-[11px] text-stone-500">
                <div className="flex justify-between"><span>Active Units</span><span className="font-medium text-stone-900">{activeUnits}</span></div>
                <div className="flex justify-between"><span>Checkpoints Cleared</span><span className="font-medium text-stone-900">{totalCleared}/{totalCPs}</span></div>
                <div className="flex justify-between"><span>Zones Covered</span><span className="font-medium text-stone-900">{zonesCovered}/{zoneCoverage.length}</span></div>
                <div className="flex justify-between"><span>Route Coverage</span><span className="font-medium text-stone-900">{coveragePct}%</span></div>
                <div className="flex justify-between"><span>Low-Coverage Zones</span><span className="font-medium text-stone-900">{lowCoverageZones.length}</span></div>
                <div className="flex justify-between"><span>Time Range</span><span className="font-medium text-stone-900">{TIME_RANGES.find((t) => t.key === timeRange)?.label}</span></div>
              </div>
            </div>
        </Modal>
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
