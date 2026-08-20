import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Download,
  ChevronDown,
  Clock,
  AlertTriangle,
  Shield,
  Star,
  TrendingUp,
  TrendingDown,
  Eye,
  ChevronLeft,
  Flame,
  Volume2,
  Ban,
  Construction,
  Activity,
  Radio,
  FileText,
  Send,
  Camera,
  Video,
  FileBadge,
  Megaphone,
  RotateCcw,
  Flag,
  ChevronRight,
} from "lucide-react";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { Modal } from "../components/ui";
import ExportReportModal from "../components/ExportReportModal";
import { addCaptainInboxItem } from "../utils/captainInboxStore";

const PUROK_NAMES = ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6"];

const DATE_RANGES = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "Last Quarter" },
  { key: "custom", label: "Custom Range" },
];

const CATEGORIES = [
  "All Categories",
  "Fire/Smoke",
  "Noise Disturbance",
  "Crime/Suspicious Activity",
  "Road Obstruction",
  "IoT - Smoke Detected",
  "IoT - Noise Alert",
];

const CATEGORY_ICONS = {
  "Fire/Smoke": Flame,
  "Noise Disturbance": Volume2,
  "Crime/Suspicious Activity": Ban,
  "Road Obstruction": Construction,
  "IoT - Smoke Detected": Radio,
  "IoT - Noise Alert": Volume2,
};

const STATUSES = ["All Statuses", "active", "investigating", "resolved"];

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  investigating: "Investigating",
  resolved: "Resolved",
};

const STATUS_BADGES: Record<string, string> = {
  active: "bg-rose-100 text-rose-700",
  investigating: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const RISK_BADGES = {
  high: { bg: "bg-rose-100 text-rose-700", label: "High Activity" },
  normal: { bg: "bg-emerald-100 text-emerald-700", label: "Normal" },
  attention: { bg: "bg-amber-100 text-amber-700", label: "Attention Needed" },
};

const MOCK_INCIDENTS = [
  { id: "INC-2047", category: "Fire/Smoke", severity: "critical", purok: "Purok 3", reportedBy: "Maria Santos", time: "2026-07-20T09:32:00", status: "active", responseMin: 6 },
  { id: "INC-2046", category: "Noise Disturbance", severity: "warning", purok: "Purok 4", reportedBy: "Juan Dela Cruz", time: "2026-07-20T10:05:00", status: "active", responseMin: 3 },
  { id: "INC-2045", category: "Fire/Smoke", severity: "low", purok: "Purok 1", reportedBy: "Pedro Reyes", time: "2026-07-20T08:45:00", status: "investigating", responseMin: 5 },
  { id: "INC-2044", category: "Noise Disturbance", severity: "low", purok: "Purok 6", reportedBy: "Ana Lim", time: "2026-07-20T07:20:00", status: "investigating", responseMin: 4 },
  { id: "INC-2043", category: "Fire/Smoke", severity: "resolved", purok: "Purok 2", reportedBy: "System Auto", time: "2026-07-19T22:15:00", status: "resolved", responseMin: 2 },
  { id: "INC-2042", category: "Noise Disturbance", severity: "resolved", purok: "Purok 5", reportedBy: "Rosa Garcia", time: "2026-07-19T20:30:00", status: "resolved", responseMin: 3 },
  { id: "INC-2041", category: "Crime/Suspicious Activity", severity: "critical", purok: "Purok 6", reportedBy: "Mark Villanueva", time: "2026-07-19T18:10:00", status: "active", responseMin: 8 },
  { id: "INC-2040", category: "Road Obstruction", severity: "low", purok: "Purok 1", reportedBy: "Liza Mendoza", time: "2026-07-19T15:45:00", status: "resolved", responseMin: 12 },
  { id: "INC-2039", category: "Noise Disturbance", severity: "warning", purok: "Purok 3", reportedBy: "Carlo Reyes", time: "2026-07-19T14:20:00", status: "investigating", responseMin: 4 },
  { id: "INC-2038", category: "Fire/Smoke", severity: "critical", purok: "Purok 5", reportedBy: "Joy Ramos", time: "2026-07-19T12:00:00", status: "resolved", responseMin: 5 },
  { id: "INC-2037", category: "Crime/Suspicious Activity", severity: "warning", purok: "Purok 2", reportedBy: "Dan Cruz", time: "2026-07-18T21:30:00", status: "resolved", responseMin: 6 },
  { id: "INC-2036", category: "Road Obstruction", severity: "low", purok: "Purok 4", reportedBy: "Sara Lim", time: "2026-07-18T16:00:00", status: "resolved", responseMin: 15 },
  { id: "INC-2035", category: "Noise Disturbance", severity: "low", purok: "Purok 1", reportedBy: "Tom Garcia", time: "2026-07-18T11:45:00", status: "resolved", responseMin: 3 },
  { id: "INC-2034", category: "Fire/Smoke", severity: "warning", purok: "Purok 6", reportedBy: "Nina Santos", time: "2026-07-18T09:15:00", status: "resolved", responseMin: 4 },
  { id: "INC-2033", category: "Crime/Suspicious Activity", severity: "critical", purok: "Purok 3", reportedBy: "Jay Dela PeÃ±a", time: "2026-07-17T23:00:00", status: "resolved", responseMin: 7 },
  { id: "INC-2032", category: "Noise Disturbance", severity: "warning", purok: "Purok 5", reportedBy: "Bea Torres", time: "2026-07-17T19:30:00", status: "resolved", responseMin: 3 },
  { id: "INC-2031", category: "Road Obstruction", severity: "low", purok: "Purok 2", reportedBy: "Rico Navarro", time: "2026-07-17T14:10:00", status: "resolved", responseMin: 10 },
  { id: "INC-2030", category: "Fire/Smoke", severity: "low", purok: "Purok 4", reportedBy: "May Flores", time: "2026-07-17T10:00:00", status: "resolved", responseMin: 2 },
  { id: "INC-2029", category: "IoT - Smoke Detected", severity: "critical", purok: "Purok 3", reportedBy: "IoT Sensor A3", time: "2026-07-20T06:10:00", status: "resolved", responseMin: 2 },
  { id: "INC-2028", category: "IoT - Noise Alert", severity: "warning", purok: "Purok 5", reportedBy: "IoT Sensor B5", time: "2026-07-19T23:45:00", status: "resolved", responseMin: 3 },
  { id: "INC-2027", category: "IoT - Noise Alert", severity: "low", purok: "Purok 6", reportedBy: "IoT Sensor B6", time: "2026-07-18T22:00:00", status: "resolved", responseMin: 1 },
];

const MOCK_PREV_INCIDENTS = [
  { id: "P-INC-1020", category: "Fire/Smoke", severity: "critical", purok: "Purok 2", reportedBy: "System", time: "2026-06-20T09:00:00", status: "resolved", responseMin: 7 },
  { id: "P-INC-1019", category: "Noise Disturbance", severity: "warning", purok: "Purok 4", reportedBy: "System", time: "2026-06-19T14:00:00", status: "resolved", responseMin: 4 },
  { id: "P-INC-1018", category: "Crime/Suspicious Activity", severity: "critical", purok: "Purok 1", reportedBy: "System", time: "2026-06-18T20:00:00", status: "resolved", responseMin: 9 },
  { id: "P-INC-1017", category: "Road Obstruction", severity: "low", purok: "Purok 3", reportedBy: "System", time: "2026-06-17T11:00:00", status: "resolved", responseMin: 14 },
  { id: "P-INC-1016", category: "Fire/Smoke", severity: "warning", purok: "Purok 5", reportedBy: "System", time: "2026-06-16T08:30:00", status: "resolved", responseMin: 5 },
  { id: "P-INC-1015", category: "Noise Disturbance", severity: "low", purok: "Purok 6", reportedBy: "System", time: "2026-06-15T17:00:00", status: "resolved", responseMin: 3 },
  { id: "P-INC-1014", category: "Crime/Suspicious Activity", severity: "warning", purok: "Purok 2", reportedBy: "System", time: "2026-06-14T22:00:00", status: "resolved", responseMin: 6 },
  { id: "P-INC-1013", category: "Fire/Smoke", severity: "critical", purok: "Purok 4", reportedBy: "System", time: "2026-06-13T03:00:00", status: "resolved", responseMin: 8 },
  { id: "P-INC-1012", category: "Road Obstruction", severity: "low", purok: "Purok 1", reportedBy: "System", time: "2026-06-12T10:00:00", status: "resolved", responseMin: 11 },
  { id: "P-INC-1011", category: "Noise Disturbance", severity: "warning", purok: "Purok 3", reportedBy: "System", time: "2026-06-11T19:00:00", status: "resolved", responseMin: 4 },
];

const MOCK_EVIDENCE: Record<string, { photos: number; videoClips: number; tanodNotes: string }> = {
  "INC-2047": { photos: 3, videoClips: 1, tanodNotes: "Fire origin traced to rear kitchen area. Neighbors evacuated. BFP notified at 09:35." },
  "INC-2046": { photos: 1, videoClips: 0, tanodNotes: "Noise source identified: construction work past 10 PM. Warning issued to contractor." },
  "INC-2045": { photos: 2, videoClips: 0, tanodNotes: "Small smoke plume from burning leaves. Resident advised to cease open burning." },
  "INC-2044": { photos: 1, videoClips: 0, tanodNotes: "Loud music from residence. Verbal warning given; residents cooperative." },
  "INC-2043": { photos: 4, videoClips: 2, tanodNotes: "Electrical fire in storage room. Fire contained by BFP. No injuries reported." },
  "INC-2042": { photos: 2, videoClips: 1, tanodNotes: "Noise complaint from karaoke establishment. Owner agreed to lower volume." },
  "INC-2041": { photos: 3, videoClips: 3, tanodNotes: "Suspicious individuals observed casing homes. Patrol units dispatched. Area secured." },
  "INC-2040": { photos: 1, videoClips: 0, tanodNotes: "Fallen tree blocking road. DPWH notified. Road cleared within 2 hours." },
  "INC-2039": { photos: 1, videoClips: 0, tanodNotes: "Party noise exceeds limits. Host issued citation ticket." },
  "INC-2038": { photos: 5, videoClips: 2, tanodNotes: "Structure fire â€” abandoned warehouse. Full BFP response. No casualties." },
  "INC-2037": { photos: 2, videoClips: 1, tanodNotes: "Individuals loitering near school. Checked and escorted from area." },
  "INC-2036": { photos: 1, videoClips: 0, tanodNotes: "Construction materials blocking sidewalk. Contractor given 24-hour compliance notice." },
  "INC-2035": { photos: 1, videoClips: 0, tanodNotes: "Dog barking complaint. Owner agreed to bring pet inside." },
  "INC-2034": { photos: 2, videoClips: 1, tanodNotes: "Barbecue smoke drifting to neighbors. Relocated to ventilated area." },
  "INC-2033": { photos: 3, videoClips: 2, tanodNotes: "Break-in attempt at residence. Suspects fled. CCTV footage handed to police." },
  "INC-2032": { photos: 1, videoClips: 0, tanodNotes: "Loud gathering on street. Dispersed by 9 PM." },
  "INC-2031": { photos: 1, videoClips: 0, tanodNotes: "Parked truck blocking drainage. Vehicle relocated by owner." },
  "INC-2030": { photos: 2, videoClips: 0, tanodNotes: "Smoke from garbage burning. Resident extinguished on advisory." },
  "INC-2029": { photos: 0, videoClips: 1, tanodNotes: "Automated smoke sensor triggered at 06:10. False alarm â€” cooking smoke from adjacent unit." },
  "INC-2028": { photos: 0, videoClips: 0, tanodNotes: "Decibel sensor exceeded threshold at 23:45. Source: loud music from residence. Warning issued." },
  "INC-2027": { photos: 0, videoClips: 0, tanodNotes: "Noise alert triggered by dog barking at 22:00. Minor event, no action required." },
};

const MOCK_RATINGS: Record<string, { avg: number; count: number }> = {
  "Purok 1": { avg: 4.2, count: 2 },
  "Purok 2": { avg: 4.5, count: 4 },
  "Purok 3": { avg: 3.8, count: 3 },
  "Purok 4": { avg: 4.0, count: 2 },
  "Purok 5": { avg: 4.3, count: 2 },
  "Purok 6": { avg: 3.6, count: 2 },
};

const WEEKLY_RESPONSE = [
  { day: "Mon", avg: 5.2, high: 7.1 },
  { day: "Tue", avg: 4.8, high: 6.5 },
  { day: "Wed", avg: 6.1, high: 8.3 },
  { day: "Thu", avg: 4.3, high: 5.9 },
  { day: "Fri", avg: 5.7, high: 7.8 },
  { day: "Sat", avg: 7.2, high: 9.5 },
  { day: "Sun", avg: 3.9, high: 5.2 },
];

function StarRating({ rating, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-stone-200"}
        />
      ))}
      <span className="ml-1 text-[11px] font-semibold text-stone-900">{rating.toFixed(1)}</span>
    </span>
  );
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-[10px] text-stone-400">N/A</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isUp ? "text-rose-600" : "text-emerald-600"}`}>
      {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function StackedBarChart({ incidents }) {
  const data = useMemo(() => {
    return PUROK_NAMES.map((name) => {
      const purokIncidents = incidents.filter((i) => i.purok === name);
      return {
        name,
        critical: purokIncidents.filter((i) => i.severity === "critical").length,
        warning: purokIncidents.filter((i) => i.severity === "warning").length,
        low: purokIncidents.filter((i) => i.severity === "low").length,
        resolved: purokIncidents.filter((i) => i.severity === "resolved").length,
        total: purokIncidents.length,
      };
    });
  }, [incidents]);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4">
        <BarChart3 size={16} className="text-[#0038A8]" />
        <div>
          <h3 className="text-[14px] font-semibold text-stone-900">Incident Distribution by Purok</h3>
          <p className="text-[11px] text-stone-400">Stacked by severity level</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-5 pb-4">
        {data.map((p) => (
          <div key={p.name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-stone-900">{p.name}</span>
              <span className="text-[11px] font-semibold text-[#0038A8]">{p.total}</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded bg-stone-100">
              {p.critical > 0 && (
                <div
                  className="bg-rose-400 transition-all duration-500"
                  style={{ width: `${(p.critical / maxTotal) * 100}%` }}
                  title={`${p.critical} critical`}
                />
              )}
              {p.warning > 0 && (
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${(p.warning / maxTotal) * 100}%` }}
                  title={`${p.warning} warning`}
                />
              )}
              {p.low > 0 && (
                <div
                  className="bg-sky-300 transition-all duration-500"
                  style={{ width: `${(p.low / maxTotal) * 100}%` }}
                  title={`${p.low} low`}
                />
              )}
              {p.resolved > 0 && (
                <div
                  className="bg-emerald-300 transition-all duration-500"
                  style={{ width: `${(p.resolved / maxTotal) * 100}%` }}
                  title={`${p.resolved} resolved`}
                />
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-4 pt-2">
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-rose-400" /> Critical
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-amber-400" /> Warning
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-sky-300" /> Low
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-2 w-2 rounded-sm bg-emerald-300" /> Resolved
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryDonut({ incidents }) {
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((inc) => {
      counts[inc.category] = (counts[inc.category] || 0) + 1;
    });
    const total = incidents.length || 1;
    const colors = ["#0038A8", "#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];
    return Object.entries(counts)
      .map(([name, count], i) => ({
        name,
        count,
        pct: ((count / total) * 100).toFixed(1),
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [incidents]);

  const total = incidents.length;
  const radius = 60;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  const segments = categoryData.reduce<{ accumulated: number; items: Array<{ name: string; count: number; pct: string; color: string; dashLen: number; dashOff: number }> }>((acc, cat) => {
    const pct = total > 0 ? cat.count / total : 0;
    const dashLen = pct * circumference;
    const dashOff = -acc.accumulated * circumference;
    acc.accumulated += pct;
    acc.items.push({ ...cat, dashLen, dashOff });
    return acc;
  }, { accumulated: 0, items: [] }).items;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4">
        <Activity size={16} className="text-[#0038A8]" />
        <div>
          <h3 className="text-[14px] font-semibold text-stone-900">Category Breakdown</h3>
          <p className="text-[11px] text-stone-400">Incident type distribution</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-5">
        {total === 0 ? (
          <p className="text-[12px] text-stone-400">No data available</p>
        ) : (
          <>
            <div className="relative">
              <svg width="150" height="150" viewBox="0 0 150 150">
                {segments.map((seg, i) => (
                  <circle
                    key={i}
                    cx="75"
                    cy="75"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${seg.dashLen} ${circumference - seg.dashLen}`}
                    strokeDashoffset={seg.dashOff}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                    transform="rotate(-90 75 75)"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold text-stone-900">{total}</span>
                <span className="text-[9px] text-stone-400">TOTAL</span>
              </div>
            </div>

            <div className="w-full space-y-1.5">
              {categoryData.map((cat) => {
                const CatIcon = CATEGORY_ICONS[cat.name] || AlertTriangle;
                return (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                    <CatIcon size={11} className="text-stone-500" />
                    <span className="flex-1 truncate text-[11px] text-stone-900">{cat.name}</span>
                    <span className="text-[11px] font-semibold text-[#0038A8]">{cat.pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResponseTimeLineChart() {
  const data = WEEKLY_RESPONSE;
  const maxVal = Math.max(...data.map((d) => d.high), 1);
  const chartW = 280;
  const chartH = 130;
  const padL = 30;
  const padB = 20;
  const padT = 10;
  const plotW = chartW - padL;
  const plotH = chartH - padT - padB;

  function toX(i) {
    return padL + (i / (data.length - 1)) * plotW;
  }
  function toY(v) {
    return padT + plotH - (v / maxVal) * plotH;
  }

  function pathD(key) {
    return data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(" ");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4">
        <TrendingUp size={16} className="text-[#0038A8]" />
        <div>
          <h3 className="text-[14px] font-semibold text-stone-900">Response Time Trends</h3>
          <p className="text-[11px] text-stone-400">Average vs high-density purok response (minutes)</p>
        </div>
      </div>

      <div className="flex-1 px-5 pb-5">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-full w-full">
          {[0, 2, 4, 6, 8, 10].map((v) => {
            if (v > maxVal) return null;
            return (
              <g key={v}>
                <line x1={padL} y1={toY(v)} x2={chartW} y2={toY(v)} stroke="#e5e5e5" strokeWidth={0.5} />
                <text x={padL - 4} y={toY(v) + 3} textAnchor="end" fontSize="8" fill="#a1a1aa">
                  {v}
                </text>
              </g>
            );
          })}

          <path d={pathD("avg")} fill="none" stroke="#0038A8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathD("high")} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />

          {data.map((d, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(d.avg)} r={3} fill="#0038A8" stroke="white" strokeWidth={1.5} />
              <circle cx={toX(i)} cy={toY(d.high)} r={3} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
            </g>
          ))}

          {data.map((d, i) => (
            <text key={i} x={toX(i)} y={chartH - 4} textAnchor="middle" fontSize="8" fill="#a1a1aa">
              {d.day}
            </text>
          ))}
        </svg>

        <div className="flex items-center justify-center gap-5 pt-1">
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-0.5 w-4 rounded bg-[#0038A8]" /> Barangay Avg
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-amber-400" /> High-Density
          </span>
        </div>
      </div>
    </div>
  );
}

function IncidentDetailView({ incident, onBack }: { incident: any; onBack: () => void }) {
  const evidence = MOCK_EVIDENCE[incident.id] || { photos: 0, videoClips: 0, tanodNotes: "No notes recorded." };
  const sev = SEVERITY_MAP[incident.severity];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700">
        <ChevronLeft size={14} />
        Back to incident list
      </button>

      <div className="rounded-lg border border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-stone-900">{incident.id}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${sev.badge}`}>
            {sev.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-stone-500">{incident.category}</p>
        <p className="mt-0.5 text-[10px] text-stone-400">Reported by {incident.reportedBy} &middot; {formatTime(incident.time)}</p>
        <div className="mt-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium ${STATUS_BADGES[incident.status]}`}>
            {STATUS_LABELS[incident.status]}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">EVIDENCE &amp; DISPATCH NOTES</p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-200">
              <Camera size={12} className="text-stone-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-stone-900">{evidence.photos} Photo{evidence.photos !== 1 ? "s" : ""}</p>
              <p className="text-[10px] text-stone-400">Attached by responding tanod</p>
            </div>
            {evidence.photos > 0 && (
              <button className="ml-auto text-[10px] font-medium text-[#0038A8] hover:underline">View</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-200">
              <Video size={12} className="text-stone-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-stone-900">{evidence.videoClips} Video Clip{evidence.videoClips !== 1 ? "s" : ""}</p>
              <p className="text-[10px] text-stone-400">CCTV / body-cam footage</p>
            </div>
            {evidence.videoClips > 0 && (
              <button className="ml-auto text-[10px] font-medium text-[#0038A8] hover:underline">View</button>
            )}
          </div>

          <div className="border-t border-stone-200 pt-3">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">TANOD DISPATCH NOTES</p>
            <p className="text-[11px] leading-relaxed text-stone-600">{evidence.tanodNotes}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurokDetailDrawer({ purokName, incidents, rating, onClose }: {
  purokName: string | null;
  incidents: any[];
  rating: { avg: number; count: number } | null;
  onClose: () => void;
}) {
  const [selectedIncident, setSelectedIncident] = useState<any>(null);

  if (!purokName) return null;
  const purokIncidents = incidents.filter((i) => i.purok === purokName);
  const resolvedIncidents = purokIncidents.filter((i) => i.status === "resolved");
  const rat = rating || { avg: 0, count: 0 };

  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={purokName}
      subtitle={selectedIncident ? selectedIncident.id : `${purokIncidents.length} incidents logged`}
      aside={
        <button
          onClick={selectedIncident ? () => setSelectedIncident(null) : onClose}
          aria-label="Back"
          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ChevronLeft size={18} />
        </button>
      }
    >
      {selectedIncident ? (
        <IncidentDetailView incident={selectedIncident} onBack={() => setSelectedIncident(null)} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-center">
              <p className="text-[18px] font-bold text-[#0038A8]">{purokIncidents.length}</p>
              <p className="text-[10px] text-stone-400">TOTAL</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-center">
              <p className="text-[18px] font-bold text-rose-600">{purokIncidents.filter((i) => i.severity === "critical").length}</p>
              <p className="text-[10px] text-stone-400">CRITICAL</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-center">
              <p className="text-[18px] font-bold text-emerald-600">{resolvedIncidents.length}</p>
              <p className="text-[10px] text-stone-400">RESOLVED</p>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">CITIZEN RATING</p>
            <div className="mt-1.5">
              <StarRating rating={rat.avg} />
              <p className="mt-1 text-[10px] text-stone-400">{rat.count} responses (from {resolvedIncidents.length} resolved incidents)</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold text-stone-900">Incident Logs</p>
            {purokIncidents.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-stone-400">No incidents recorded for this purok.</p>
            ) : (
              <div className="space-y-2">
                {purokIncidents.map((inc) => {
                  const sev = SEVERITY_MAP[inc.severity];
                  return (
                    <button
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-left transition hover:border-[#0038A8]/30 hover:bg-stone-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-stone-900">{inc.id}</span>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                            {sev.label}
                          </span>
                          <ChevronRight size={12} className="text-stone-300" />
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500">{inc.category}</p>
                      <p className="mt-0.5 text-[10px] text-stone-400">{formatTime(inc.time)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

const PATROL_UNITS = ["Tanod Unit A", "Tanod Unit B", "Tanod Unit C", "Barangay Patrol 1"];
const DESK_OFFICERS = ["Sgt. Ramos", "Ofc. Dela Cruz", "Ofc. Garcia", "Ofc. Torres"];

const RESIDENT_COUNTS: Record<string, number> = {
  "Purok 1": 185,
  "Purok 2": 210,
  "Purok 3": 165,
  "Purok 4": 195,
  "Purok 5": 230,
  "Purok 6": 145,
};

function EscalationModal({ type, zone, onClose }: { type: string; zone: string; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("urgent");
  const [patrolUnit, setPatrolUnit] = useState(PATROL_UNITS[0]);
  const [assignTo, setAssignTo] = useState(DESK_OFFICERS[0]);
  const [submitted, setSubmitted] = useState(false);

  const TITLE_MAP: Record<string, string> = {
    broadcast: "Mass Emergency Broadcast",
    reroute: "Request Tanod Patrol Re-route",
    flag: "Escalate to Desk Officer",
  };

  const ICON_MAP: Record<string, any> = {
    broadcast: Megaphone,
    reroute: RotateCcw,
    flag: Flag,
  };

  const SUBMIT_LABEL: Record<string, string> = {
    broadcast: "Send Broadcast",
    reroute: "Request Re-route",
    flag: "Send Escalation",
  };

  const title = TITLE_MAP[type] || type;
  const Icon = ICON_MAP[type] || AlertTriangle;
  const residentCount = RESIDENT_COUNTS[zone] || 200;

  const broadcastPriorities = [
    { key: "critical", label: "Critical", desc: "Push + SMS", bg: "bg-rose-100 text-rose-700 border-rose-200", active: "bg-rose-600 text-white border-rose-600" },
    { key: "urgent", label: "Urgent", desc: "Push only", bg: "bg-amber-100 text-amber-700 border-amber-200", active: "bg-amber-600 text-white border-amber-600" },
  ];

  const defaultPriorities = [
    { key: "critical", label: "Critical", desc: "", bg: "bg-rose-100 text-rose-700 border-rose-200", active: "bg-rose-600 text-white border-rose-600" },
    { key: "urgent", label: "Urgent", desc: "", bg: "bg-amber-100 text-amber-700 border-amber-200", active: "bg-amber-600 text-white border-amber-600" },
    { key: "routine", label: "Routine", desc: "", bg: "bg-stone-100 text-stone-600 border-stone-200", active: "bg-stone-600 text-white border-stone-600" },
  ];

  const priorities = type === "broadcast" ? broadcastPriorities : defaultPriorities;

  const PRIORITY_LABEL: Record<string, string> = {
    critical: "Critical",
    urgent: "High",
    routine: "Low",
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "reroute") {
      addCaptainInboxItem({
        type: "patrol_recommendation",
        incidentId: "—",
        title: `Re-route request — ${patrolUnit} for ${zone}`,
        purok: zone,
        priority: PRIORITY_LABEL[priority] ?? "Medium",
        submittedBy: "Capt. Reyes",
      });
    } else if (type === "flag") {
      addCaptainInboxItem({
        type: "other_request",
        incidentId: "—",
        title: `Escalation sent to ${assignTo} — ${zone}`,
        purok: zone,
        priority: PRIORITY_LABEL[priority] ?? "Medium",
        submittedBy: "Capt. Reyes",
      });
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Modal size="md" onClose={onClose} centered title={`${title} Sent`} subtitle={`Successfully submitted for ${zone}.`}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mx-auto">
          <Shield size={22} className="text-emerald-600" />
        </div>
        <div className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-center">
          {type === "broadcast" && (
            <>
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">DELIVERY SUMMARY</p>
              <p className="mt-1 text-[11px] text-stone-600">
                <span className="font-semibold">{subject}</span>
              </p>
              <p className="mt-1 text-[11px] text-stone-500">{message}</p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-stone-400">
                <span>Priority: <span className={`font-medium ${priority === "critical" ? "text-rose-600" : "text-amber-600"}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span></span>
                <span>&middot;</span>
                <span>{priority === "critical" ? "Push + SMS" : "Push only"} to ~{residentCount} residents</span>
              </div>
            </>
          )}
          {type === "reroute" && (
            <>
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">RE-ROUTE REQUEST SUMMARY</p>
              <p className="mt-1 text-[11px] text-stone-600">
                <span className="font-semibold">{patrolUnit}</span> requested for {zone}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">{message}</p>
              <p className="mt-2 text-[10px] text-stone-400">
                Sent to the <span className="font-semibold text-stone-600">Desk Officer queue</span> — awaiting confirmation and dispatch.
              </p>
            </>
          )}
          {type === "flag" && (
            <>
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">ESCALATION SUMMARY</p>
              <p className="mt-1 text-[11px] text-stone-600">
                Escalation sent to <span className="font-semibold">{assignTo}</span> for review and action
              </p>
              <p className="mt-1 text-[11px] text-stone-500">{message}</p>
              <p className="mt-2 text-[10px] text-stone-400">
                The Desk Officer owns final action on this escalation.
              </p>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      centered
      title={title}
      subtitle={`Target zone: ${zone}`}
      icon={<Icon size={16} className="text-[#0038A8]" />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
            Cancel
          </button>
          <button type="submit" form="escalation-form" className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]">
            <Send size={12} />
            {SUBMIT_LABEL[type] || "Submit"}
          </button>
        </div>
      }
    >
      <form id="escalation-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Priority */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Priority Level</p>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-[11px] font-medium transition ${priority === p.key ? p.active : p.bg}`}
                >
                  {p.label}
                  {p.desc && <span className="ml-1 text-[9px] opacity-70">{p.desc}</span>}
                </button>
              ))}
            </div>
          </div>

          {type === "broadcast" && (
            <>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Broadcast Subject</p>
                <div className="relative">
                  <Megaphone size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Flash Flood Warning â€” Immediate Evacuation"
                    className="w-full rounded-lg border border-stone-200 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                    required
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Broadcast Message</p>
                <div className="relative">
                  <FileText size={13} className="pointer-events-none absolute left-3 top-2.5 text-stone-400" />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Type the emergency message to broadcast to all residents in this zone..."
                    className="w-full resize-none rounded-lg border border-stone-200 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Megaphone size={12} className="text-stone-400" />
                <p className="text-[10px] text-stone-500">
                  Will send <span className={`font-semibold ${priority === "critical" ? "text-rose-600" : "text-amber-600"}`}>{priority === "critical" ? "Push Notification + SMS" : "Push Notification only"}</span> to ~<span className="font-semibold text-stone-700">{residentCount}</span> registered residents in {zone}.
                </p>
              </div>
            </>
          )}

          {type === "reroute" && (
            <>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Assign Patrol Unit</p>
                <div className="relative">
                  <Shield size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <select
                    value={patrolUnit}
                    onChange={(e) => setPatrolUnit(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-[12px] text-stone-900 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                  >
                    {PATROL_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Request / Instructions</p>
                <div className="relative">
                  <FileText size={13} className="pointer-events-none absolute left-3 top-2.5 text-stone-400" />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="e.g. Increase patrol presence near the main plaza. Focus on late-night noise complaints and suspicious activity around the convenience store..."
                    className="w-full resize-none rounded-lg border border-stone-200 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                    required
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Dispatch Route</p>
                <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <FileBadge size={13} className="mt-0.5 shrink-0 text-[#0038A8]" />
                  <p className="text-[10px] text-stone-500">
                    Sent as a <span className="font-semibold text-stone-700">high-priority re-route request</span> to the
                    Desk Officer queue. The Desk Officer confirms and executes the re-route to {patrolUnit}'s mobile app.
                  </p>
                </div>
              </div>
            </>
          )}

          {type === "flag" && (
            <>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Assign to Desk Officer</p>
                <div className="relative">
                  <Eye size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-[12px] text-stone-900 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                  >
                    {DESK_OFFICERS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Action Request / Notes</p>
                <div className="relative">
                  <FileText size={13} className="pointer-events-none absolute left-3 top-2.5 text-stone-400" />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe what action you are requesting the Desk Officer to take. e.g. Review high incident counts in Purok 3, coordinate with the Purok Leader, and schedule a community safety meeting..."
                    className="w-full resize-none rounded-lg border border-stone-200 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                    required
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <Flag size={13} className="mt-0.5 shrink-0 text-[#0038A8]" />
                <p className="text-[10px] text-stone-500">
                  Creates an <span className="font-semibold text-stone-700">escalation request</span> for the selected Desk
                  Officer. The Desk Officer reviews the request and owns the final action.
                </p>
              </div>
            </>
          )}
        </form>
    </Modal>
  );
}

export default function PurokAnalyticsPage() {
  const [dateRange, setDateRange] = useState("month");
  const [purokFilter, setPurokFilter] = useState("All Puroks");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [drawerPurok, setDrawerPurok] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [escalationModal, setEscalationModal] = useState<{ type: string; zone: string } | null>(null);

  const incidents = useMemo(() => {
    let filtered = MOCK_INCIDENTS;
    if (purokFilter !== "All Puroks") {
      filtered = filtered.filter((i) => i.purok === purokFilter);
    }
    if (categoryFilter !== "All Categories") {
      filtered = filtered.filter((i) => i.category === categoryFilter);
    }
    if (statusFilter !== "All Statuses") {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    return filtered;
  }, [purokFilter, categoryFilter, statusFilter]);

  const prevIncidents = useMemo(() => {
    let filtered = MOCK_PREV_INCIDENTS;
    if (purokFilter !== "All Puroks") {
      filtered = filtered.filter((i) => i.purok === purokFilter);
    }
    if (categoryFilter !== "All Categories") {
      filtered = filtered.filter((i) => i.category === categoryFilter);
    }
    return filtered;
  }, [purokFilter, categoryFilter]);

  const totalIncidents = incidents.length;
  const prevTotalIncidents = prevIncidents.length;

  const topRiskZone = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((i) => {
      if (i.severity === "critical" || i.severity === "warning") {
        counts[i.purok] = (counts[i.purok] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "â€”";
  }, [incidents]);

  const avgResponseTime = useMemo(() => {
    const resolved = incidents.filter((i) => i.status === "resolved");
    if (resolved.length === 0) return "â€”";
    const sum = resolved.reduce((acc, i) => acc + (i.responseMin || 0), 0);
    return (sum / resolved.length).toFixed(1) + " min";
  }, [incidents]);

  const prevAvgResponseTime = useMemo(() => {
    const resolved = prevIncidents.filter((i) => i.status === "resolved");
    if (resolved.length === 0) return 0;
    return resolved.reduce((acc, i) => acc + (i.responseMin || 0), 0) / resolved.length;
  }, [prevIncidents]);

  const overallRating = (() => {
    const ratings = Object.values(MOCK_RATINGS);
    if (ratings.length === 0) return "0";
    const sum = ratings.reduce((acc, r) => acc + r.avg, 0);
    return (sum / ratings.length).toFixed(1);
  })();

  const activeIncidents = incidents.filter((i) => i.status === "active").length;

  const kpis = [
    { label: "TOTAL INCIDENTS LOGGED", value: totalIncidents, sub: `Filtered: ${purokFilter === "All Puroks" ? "All zones" : purokFilter}`, icon: AlertTriangle, trend: prevTotalIncidents },
    { label: "TOP RISK ZONE", value: topRiskZone, sub: "Highest critical/warning count", icon: Shield },
    { label: "AVG RESOLUTION TIME", value: avgResponseTime, sub: "Dispatch to resolution (resolved only)", icon: Clock, trendVal: avgResponseTime !== "â€”" ? parseFloat(avgResponseTime) : null },
    { label: "OVERALL SATISFACTION", value: `${overallRating}/5`, sub: "Aggregate citizen rating", icon: Star },
  ];

  const purokTable = useMemo(() => {
    return PUROK_NAMES.map((name) => {
      const pIncidents = incidents.filter((i) => i.purok === name);
      const total = pIncidents.length;
      const catCounts: Record<string, number> = {};
      pIncidents.forEach((i) => {
        catCounts[i.category] = (catCounts[i.category] || 0) + 1;
      });
      const mostCommon = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
      const resolvedPurok = pIncidents.filter((i) => i.status === "resolved");
      const avgResp = resolvedPurok.length > 0
        ? (resolvedPurok.reduce((a, i) => a + (i.responseMin || 0), 0) / resolvedPurok.length).toFixed(1)
        : "â€”";
      const rat = MOCK_RATINGS[name] || { avg: 0, count: 0 };
      const criticalCount = pIncidents.filter((i) => i.severity === "critical").length;
      const warningCount = pIncidents.filter((i) => i.severity === "warning").length;
      let risk = "normal";
      if (criticalCount >= 2 || warningCount >= 3) risk = "high";
      else if (criticalCount === 1 || warningCount >= 2) risk = "attention";

      return {
        name,
        total,
        resolvedCount: resolvedPurok.length,
        mostCommon: mostCommon ? mostCommon[0] : "â€”",
        avgResponse: avgResp === "â€”" ? "â€”" : avgResp + " min",
        rating: rat.avg,
        ratingCount: resolvedPurok.length,
        risk,
        activeCount: pIncidents.filter((i) => i.status === "active").length,
      };
    });
  }, [incidents]);

  const hasData = incidents.length > 0;

  function handleEscalation(type: string, zone: string) {
    setEscalationModal({ type, zone });
  }

  return (
    <>
      <header className="mb-6 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Purok Analytics &amp; Reports</h1>
          <p className="mt-1 text-sm text-stone-500">Weekly &amp; monthly peace and order trends across barangay zones</p>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
          {DATE_RANGES.map((dr) => (
            <button
              key={dr.key}
              onClick={() => setDateRange(dr.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                dateRange === dr.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              {dr.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            value={purokFilter}
            onChange={(e) => setPurokFilter(e.target.value)}
            className="appearance-none rounded-lg border border-black/10 bg-white px-3 py-1.5 pr-8 text-[11px] font-medium text-stone-900 hover:bg-stone-50 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          >
            <option value="All Puroks">All Puroks</option>
            {PUROK_NAMES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
        </div>

        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none rounded-lg border border-black/10 bg-white px-3 py-1.5 pr-8 text-[11px] font-medium text-stone-900 hover:bg-stone-50 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-lg border border-black/10 bg-white px-3 py-1.5 pr-8 text-[11px] font-medium text-stone-900 hover:bg-stone-50 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "All Statuses" ? s : STATUS_LABELS[s]}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
        >
          <Download size={13} />
          Export Report
        </button>
      </div>

      {escalationModal && (
        <EscalationModal
          type={escalationModal.type}
          zone={escalationModal.zone}
          onClose={() => setEscalationModal(null)}
        />
      )}

      {showExportModal && (
        <ExportReportModal
          onClose={() => setShowExportModal(false)}
          reportTitle="Purok Analytics & Reports"
          fileName="purok_analytics"
          rows={[
            ["Metric", "Value"],
            ["Total Incidents", String(totalIncidents)],
            ["Top Risk Zone", topRiskZone],
            ["Avg Resolution Time", avgResponseTime],
            ["Overall Satisfaction", `${overallRating}/5`],
            [],
            ["Purok", "Incidents", "Most Common", "Avg Response", "Rating", "Status"],
            ...purokTable.map((r) => [r.name, String(r.total), r.mostCommon, r.avgResponse, r.rating.toFixed(1), RISK_BADGES[r.risk].label]),
          ]}
        />
      )}

      {!hasData ? (
        <div className="rounded-xl border border-black/5 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
            <BarChart3 size={24} className="text-stone-300" />
          </div>
          <p className="text-[14px] font-medium text-stone-500">No incident data for this selection</p>
          <p className="mt-1 text-[12px] text-stone-400">Try adjusting the date range, purok, category, or status filter.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(({ label, value, sub, icon: Icon, trend, trendVal }) => (
              <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-medium tracking-wider text-stone-400">{label}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                    <Icon size={15} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[26px] font-bold text-[#0038A8]">{value}</span>
                  {trend !== undefined && <TrendBadge current={totalIncidents} previous={prevTotalIncidents} />}
                  {trendVal !== undefined && trendVal !== null && (
                    <TrendBadge current={parseFloat(avgResponseTime)} previous={prevAvgResponseTime} />
                  )}
                </div>
                <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
              </div>
            ))}
          </div>

          {activeIncidents > 0 && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={14} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-amber-800">{activeIncidents} Active Incident{activeIncidents !== 1 ? "s" : ""} Requiring Attention</p>
                <p className="text-[11px] text-amber-600">These incidents have not yet been resolved and may need escalation.</p>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ minHeight: 380 }}>
            <div className="xl:col-span-1 min-h-0">
              <StackedBarChart incidents={incidents} />
            </div>
            <div className="xl:col-span-1 min-h-0">
              <CategoryDonut incidents={incidents} />
            </div>
            <div className="xl:col-span-1 min-h-0">
              <ResponseTimeLineChart />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-black/5 px-5 py-4">
              <BarChart3 size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-stone-900">Purok Detailed Summary</h3>
                <p className="text-[11px] text-stone-400">Zone-by-zone peace and order metrics</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black/5 bg-stone-50">
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">PUROK NAME</th>
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">TOTAL INCIDENTS</th>
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">MOST COMMON TYPE</th>
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">AVG. RESPONSE</th>
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">CITIZEN RATING</th>
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">STATUS</th>
                    <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {purokTable.map((row, i) => {
                    const riskBadge = RISK_BADGES[row.risk];
                    return (
                      <tr key={row.name} className={`${i < purokTable.length - 1 ? "border-b border-black/5" : ""} hover:bg-stone-50/50 transition-colors`}>
                        <td className="px-5 py-3 text-[12px] font-semibold text-stone-900">{row.name}</td>
                        <td className="px-5 py-3 text-[12px] font-medium text-stone-900">{row.total}</td>
                        <td className="px-5 py-3 text-[12px] text-stone-500">{row.mostCommon}</td>
                        <td className="px-5 py-3 text-[12px] text-stone-500">{row.avgResponse}</td>
                        <td className="px-5 py-3">
                          <StarRating rating={row.rating} size={12} />
                          <span className="ml-1 text-[9px] text-stone-400">({row.ratingCount})</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${riskBadge.bg}`}>
                            {riskBadge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setDrawerPurok(row.name)}
                              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Eye size={11} />
                              Details
                            </button>
                            <button
                              onClick={() => handleEscalation("broadcast", row.name)}
                              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                                row.risk === "high"
                                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border-stone-200 text-stone-500 hover:bg-stone-50"
                              }`}
                              title="Trigger Mass Emergency Broadcast"
                            >
                              <Megaphone size={11} />
                              Broadcast
                            </button>
                            <button
                              onClick={() => handleEscalation("reroute", row.name)}
                              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                                row.risk === "high" || row.risk === "attention"
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-stone-200 text-stone-500 hover:bg-stone-50"
                              }`}
                              title="Request Tanod Patrol Re-route"
                            >
                              <RotateCcw size={11} />
                              Request Re-route
                            </button>
                            <button
                              onClick={() => handleEscalation("flag", row.name)}
                              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                                row.risk === "attention"
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-stone-200 text-stone-500 hover:bg-stone-50"
                              }`}
                              title="Escalate to Desk Officer for Review"
                            >
                              <Flag size={11} />
                              Escalate to Desk Officer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <PurokDetailDrawer
        purokName={drawerPurok}
        incidents={MOCK_INCIDENTS}
        rating={drawerPurok ? MOCK_RATINGS[drawerPurok] : null}
        onClose={() => setDrawerPurok(null)}
      />
      {showExportModal && (
        <ExportReportModal
          onClose={() => setShowExportModal(false)}
          reportTitle="Purok Analytics & Reports"
          fileName="purok_analytics"
          rows={[
            ["Metric", "Value"],
            ["Total Incidents", String(totalIncidents)],
            ["Top Risk Zone", topRiskZone],
            ["Avg Resolution Time", avgResponseTime],
            ["Overall Satisfaction", `${overallRating}/5`],
            [],
            ["Purok", "Incidents", "Most Common", "Avg Response", "Rating", "Status"],
            ...purokTable.map((r) => [r.name, String(r.total), r.mostCommon, r.avgResponse, r.rating.toFixed(1), RISK_BADGES[r.risk].label]),
          ]}
        />
      )}
    </>
  );
}
