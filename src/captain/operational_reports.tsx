import { useState, useMemo } from "react";
import {
  Activity,
  Clock,
  Radio,
  Camera,
  Send,
  Download,
  ShieldCheck,
  AlertTriangle,
  Heart,
  Star,
  Info,
} from "lucide-react";
import ExportReportModal from "../components/ExportReportModal";

const REPORT_RANGES = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "Last Quarter" },
  { key: "custom", label: "Custom Range" },
];

type OpMetrics = {
  rangeLabel: string;
  totalIncidents: number;
  criticalIncidents: number;
  resolvedIncidents: number;
  responseAvg: string;
  resolutionAvg: string;
  slaTarget: string;
  slaBreaches: number;
  iotUptime: number;
  iotAlerts: { critical: number; warning: number; low: number };
  cctvOnline: number;
  cctvTotal: number;
  broadcastDelivered: number;
  broadcastTotal: number;
  residentRating: number;
  feedbackResponses: number;
};

const MOCK_OPERATIONAL: Record<string, OpMetrics> = {
  week: {
    rangeLabel: "This Week (Jul 14 – Jul 20, 2026)",
    totalIncidents: 42,
    criticalIncidents: 4,
    resolvedIncidents: 38,
    responseAvg: "1.8 min",
    resolutionAvg: "5.4 min",
    slaTarget: "10 min",
    slaBreaches: 1,
    iotUptime: 98.2,
    iotAlerts: { critical: 2, warning: 5, low: 8 },
    cctvOnline: 7,
    cctvTotal: 8,
    broadcastDelivered: 155,
    broadcastTotal: 158,
    residentRating: 4.3,
    feedbackResponses: 21,
  },
  month: {
    rangeLabel: "This Month (Jul 1 – Jul 20, 2026)",
    totalIncidents: 173,
    criticalIncidents: 14,
    resolvedIncidents: 158,
    responseAvg: "2.4 min",
    resolutionAvg: "6.1 min",
    slaTarget: "10 min",
    slaBreaches: 3,
    iotUptime: 97.5,
    iotAlerts: { critical: 6, warning: 18, low: 34 },
    cctvOnline: 7,
    cctvTotal: 8,
    broadcastDelivered: 429,
    broadcastTotal: 441,
    residentRating: 4.2,
    feedbackResponses: 64,
  },
  quarter: {
    rangeLabel: "Last Quarter (Apr 1 – Jun 30, 2026)",
    totalIncidents: 512,
    criticalIncidents: 41,
    resolvedIncidents: 468,
    responseAvg: "2.9 min",
    resolutionAvg: "6.8 min",
    slaTarget: "10 min",
    slaBreaches: 11,
    iotUptime: 96.8,
    iotAlerts: { critical: 19, warning: 51, low: 96 },
    cctvOnline: 7,
    cctvTotal: 8,
    broadcastDelivered: 1211,
    broadcastTotal: 1256,
    residentRating: 4.1,
    feedbackResponses: 187,
  },
  custom: {
    rangeLabel: "Custom Range (Jul 1 – Jul 20, 2026)",
    totalIncidents: 152,
    criticalIncidents: 12,
    resolvedIncidents: 139,
    responseAvg: "2.3 min",
    resolutionAvg: "6.0 min",
    slaTarget: "10 min",
    slaBreaches: 2,
    iotUptime: 97.1,
    iotAlerts: { critical: 5, warning: 15, low: 28 },
    cctvOnline: 8,
    cctvTotal: 8,
    broadcastDelivered: 387,
    broadcastTotal: 397,
    residentRating: 4.2,
    feedbackResponses: 58,
  },
};

function StatBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-stone-300"}
        />
      ))}
    </div>
  );
}

export default function OperationalReports() {
  const [range, setRange] = useState("month");
  const [showExportModal, setShowExportModal] = useState(false);

  const m = MOCK_OPERATIONAL[range];
  const cctvAvail = (m.cctvOnline / m.cctvTotal) * 100;
  const broadcastRate = (m.broadcastDelivered / m.broadcastTotal) * 100;
  const iotTotalAlerts = m.iotAlerts.critical + m.iotAlerts.warning + m.iotAlerts.low;

  const exportRows = useMemo(() => {
    const mm = MOCK_OPERATIONAL[range];
    const rate = ((mm.broadcastDelivered / mm.broadcastTotal) * 100).toFixed(1);
    return [
      ["Metric", "Value", "Note"],
      ["Total Incidents", String(mm.totalIncidents), "All incidents reported in period"],
      ["Critical Incidents", String(mm.criticalIncidents), "Critical-severity incidents in period"],
      ["Resolved Incidents", String(mm.resolvedIncidents), "Resolved or closed in period"],
      ["Avg Response Time", mm.responseAvg, "Time from detection to first response"],
      ["Avg Resolution Time", mm.resolutionAvg, `SLA target: ${mm.slaTarget}`],
      ["SLA Breaches", String(mm.slaBreaches), `Cases exceeding the ${mm.slaTarget} resolution target`],
      ["IoT Device Health", `${mm.iotUptime.toFixed(1)}%`, "Uptime across all deployed sensors"],
      ["CCTV Availability", `${mm.cctvOnline}/${mm.cctvTotal}`, `${((mm.cctvOnline / mm.cctvTotal) * 100).toFixed(1)}% cameras online`],
      ["Broadcast Delivery Rate", `${rate}%`, `${mm.broadcastDelivered}/${mm.broadcastTotal} broadcasts delivered`],
      ["Resident Satisfaction", `${mm.residentRating.toFixed(1)} / 5`, `Based on ${mm.feedbackResponses} feedback responses`],
    ];
  }, [range]);

  const kpis = [
    { label: "TOTAL INCIDENTS", value: String(m.totalIncidents), sub: "Reported in period", icon: Activity },
    { label: "CRITICAL INCIDENTS", value: String(m.criticalIncidents), sub: "Critical-severity cases", icon: AlertTriangle },
    { label: "RESOLVED INCIDENTS", value: String(m.resolvedIncidents), sub: "Resolved or closed", icon: ShieldCheck },
    { label: "AVG RESPONSE TIME", value: m.responseAvg, sub: "Detection to first response", icon: Clock },
  ];

  return (
    <>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <Info size={14} className="mt-0.5 shrink-0 text-sky-600" />
        <p className="text-[11px] leading-relaxed text-sky-800">
          Executive operational summary for {m.rangeLabel.toLowerCase()}. Summary metrics only — no
          drill-down into individual infrastructure logs (spec §14.6).
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
          {REPORT_RANGES.map((dr) => (
            <button
              key={dr.key}
              onClick={() => setRange(dr.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                range === dr.key ? "bg-[#15803D] text-white" : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              {dr.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
        >
          <Download size={13} />
          Export Report
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={16} className="text-[#15803D]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Response &amp; SLA Summary</h3>
              <p className="text-[11px] text-stone-400">Average response and resolution vs. target</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <span className="text-[11px] font-medium text-stone-500">Avg Response Time</span>
              <span className="text-[14px] font-bold text-stone-900">{m.responseAvg}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <span className="text-[11px] font-medium text-stone-500">Avg Resolution Time</span>
              <span className="text-[14px] font-bold text-stone-900">{m.resolutionAvg}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700">
                <AlertTriangle size={12} />
                SLA Breaches ({m.slaTarget} target)
              </span>
              <span className="text-[14px] font-bold text-rose-600">{m.slaBreaches}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Heart size={16} className="text-[#15803D]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Resident Satisfaction</h3>
              <p className="text-[11px] text-stone-400">Executive evaluation, not case management</p>
            </div>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-[30px] font-bold text-[#15803D]">{m.residentRating.toFixed(1)}</span>
            <span className="text-[11px] text-stone-400">/ 5 average rating</span>
          </div>
          <StarRating rating={m.residentRating} />
          <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
            Based on <span className="font-semibold text-stone-600">{m.feedbackResponses}</span> resident
            feedback responses this period. Individual comments, puroks and ratings are reviewable per
            closed incident.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Radio size={16} className="text-[#15803D]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">IoT Device Health</h3>
              <p className="text-[11px] text-stone-400">Uptime &amp; alerts by severity</p>
            </div>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-[22px] font-bold text-stone-900">{m.iotUptime.toFixed(1)}%</span>
            <span className="text-[10px] text-stone-400">uptime</span>
          </div>
          <StatBar pct={m.iotUptime} color="bg-emerald-500" />
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-stone-500"><span className="h-2 w-2 rounded-full bg-rose-500" /> Critical</span>
              <span className="font-semibold text-stone-900">{m.iotAlerts.critical}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-stone-500"><span className="h-2 w-2 rounded-full bg-amber-400" /> Warning</span>
              <span className="font-semibold text-stone-900">{m.iotAlerts.warning}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-stone-500"><span className="h-2 w-2 rounded-full bg-sky-300" /> Low</span>
              <span className="font-semibold text-stone-900">{m.iotAlerts.low}</span>
            </div>
            <div className="border-t border-stone-100 pt-2 text-[10px] text-stone-400">{iotTotalAlerts} total alerts in period</div>
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Camera size={16} className="text-[#15803D]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">CCTV Availability</h3>
              <p className="text-[11px] text-stone-400">Online feeds across the barangay</p>
            </div>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-[22px] font-bold text-stone-900">{m.cctvOnline}/{m.cctvTotal}</span>
            <span className="text-[10px] text-stone-400">cameras online</span>
          </div>
          <StatBar pct={cctvAvail} color={cctvAvail >= 90 ? "bg-emerald-500" : "bg-amber-400"} />
          <p className="mt-3 text-[10px] text-stone-400">{cctvAvail.toFixed(1)}% available · {m.cctvTotal - m.cctvOnline} feed(s) offline</p>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Send size={16} className="text-[#15803D]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Broadcast Delivery</h3>
              <p className="text-[11px] text-stone-400">Push &amp; SMS broadcast success</p>
            </div>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-[22px] font-bold text-stone-900">{broadcastRate.toFixed(1)}%</span>
            <span className="text-[10px] text-stone-400">delivery rate</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-emerald-500" style={{ width: `${broadcastRate}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${100 - broadcastRate}%` }} />
          </div>
          <div className="mt-4 space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-stone-500">
              <span>Delivered</span>
              <span className="font-semibold text-emerald-600">{m.broadcastDelivered}/{m.broadcastTotal}</span>
            </div>
            <div className="flex items-center justify-between text-stone-500">
              <span>Failed</span>
              <span className="font-semibold text-rose-600">{m.broadcastTotal - m.broadcastDelivered}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-black/5 px-5 py-4">
          <ShieldCheck size={16} className="text-[#15803D]" />
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">Operational Report Summary</h3>
            <p className="text-[11px] text-stone-400">Consolidated executive metrics for {m.rangeLabel.toLowerCase()} — exported as PDF / CSV</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/5 bg-stone-50">
                <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">METRIC</th>
                <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">VALUE</th>
                <th className="px-5 py-3 text-[10px] font-semibold tracking-wider text-stone-400">NOTE</th>
              </tr>
            </thead>
            <tbody>
              {exportRows.slice(1).map((row, i) => (
                <tr key={row[0]} className={`${i < exportRows.length - 2 ? "border-b border-black/5" : ""} hover:bg-stone-50/50 transition-colors`}>
                  <td className="px-5 py-3 text-[12px] font-semibold text-stone-900">{row[0]}</td>
                  <td className="px-5 py-3 text-[12px] font-medium text-[#15803D]">{row[1]}</td>
                  <td className="px-5 py-3 text-[11px] text-stone-400">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showExportModal && (
        <ExportReportModal
          onClose={() => setShowExportModal(false)}
          reportTitle="Operational Reports — Executive Safety Dashboard"
          fileName="operational_report"
          rows={exportRows}
        />
      )}
    </>
  );
}
