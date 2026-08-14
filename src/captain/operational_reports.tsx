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
  availability: number;
  ackAvg: string;
  resolutionAvg: string;
  slaTarget: string;
  slaBreaches: number;
  iotUptime: number;
  iotAlerts: { critical: number; warning: number; low: number };
  cctvOnline: number;
  cctvTotal: number;
  notifSuccess: number;
  notifDelivered: number;
  notifTotal: number;
  notifFailed: number;
};

const MOCK_OPERATIONAL: Record<string, OpMetrics> = {
  week: {
    rangeLabel: "This Week (Jul 14 – Jul 20, 2026)",
    availability: 98.6,
    ackAvg: "1.8 min",
    resolutionAvg: "5.4 min",
    slaTarget: "10 min",
    slaBreaches: 1,
    iotUptime: 98.2,
    iotAlerts: { critical: 2, warning: 5, low: 8 },
    cctvOnline: 7,
    cctvTotal: 8,
    notifSuccess: 98.1,
    notifDelivered: 155,
    notifTotal: 158,
    notifFailed: 3,
  },
  month: {
    rangeLabel: "This Month (Jul 1 – Jul 20, 2026)",
    availability: 99.2,
    ackAvg: "2.4 min",
    resolutionAvg: "6.1 min",
    slaTarget: "10 min",
    slaBreaches: 3,
    iotUptime: 97.5,
    iotAlerts: { critical: 6, warning: 18, low: 34 },
    cctvOnline: 7,
    cctvTotal: 8,
    notifSuccess: 97.3,
    notifDelivered: 429,
    notifTotal: 441,
    notifFailed: 12,
  },
  quarter: {
    rangeLabel: "Last Quarter (Apr 1 – Jun 30, 2026)",
    availability: 98.9,
    ackAvg: "2.9 min",
    resolutionAvg: "6.8 min",
    slaTarget: "10 min",
    slaBreaches: 11,
    iotUptime: 96.8,
    iotAlerts: { critical: 19, warning: 51, low: 96 },
    cctvOnline: 7,
    cctvTotal: 8,
    notifSuccess: 96.4,
    notifDelivered: 1211,
    notifTotal: 1256,
    notifFailed: 45,
  },
  custom: {
    rangeLabel: "Custom Range (Jul 1 – Jul 20, 2026)",
    availability: 99.1,
    ackAvg: "2.3 min",
    resolutionAvg: "6.0 min",
    slaTarget: "10 min",
    slaBreaches: 2,
    iotUptime: 97.1,
    iotAlerts: { critical: 5, warning: 15, low: 28 },
    cctvOnline: 8,
    cctvTotal: 8,
    notifSuccess: 97.6,
    notifDelivered: 387,
    notifTotal: 397,
    notifFailed: 10,
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

export default function OperationalReports() {
  const [range, setRange] = useState("month");
  const [showExportModal, setShowExportModal] = useState(false);

  const m = MOCK_OPERATIONAL[range];
  const cctvAvail = (m.cctvOnline / m.cctvTotal) * 100;
  const iotTotalAlerts = m.iotAlerts.critical + m.iotAlerts.warning + m.iotAlerts.low;

  const exportRows = useMemo(() => {
    const mm = MOCK_OPERATIONAL[range];
    return [
      ["Metric", "Value", "Note"],
      ["Operational Availability", `${mm.availability.toFixed(1)}%`, "Placeholder — awaiting backend telemetry"],
      ["Avg Acknowledgment Time", mm.ackAvg, "Time to Desk Officer acknowledgment"],
      ["Avg Resolution Time", mm.resolutionAvg, `SLA target: ${mm.slaTarget}`],
      ["SLA Breaches", String(mm.slaBreaches), `Cases exceeding the ${mm.slaTarget} resolution target`],
      ["IoT Uptime", `${mm.iotUptime.toFixed(1)}%`, "Across all deployed sensors"],
      ["IoT Alerts — Critical", String(mm.iotAlerts.critical), ""],
      ["IoT Alerts — Warning", String(mm.iotAlerts.warning), ""],
      ["IoT Alerts — Low", String(mm.iotAlerts.low), ""],
      ["CCTV Cameras Online", `${mm.cctvOnline}/${mm.cctvTotal}`, `${((mm.cctvOnline / mm.cctvTotal) * 100).toFixed(1)}% available`],
      ["Notification Success Rate", `${mm.notifSuccess.toFixed(1)}%`, `${mm.notifDelivered}/${mm.notifTotal} delivered`],
      ["Notification Failures", String(mm.notifFailed), "Push/SMS send failures in period"],
    ];
  }, [range]);

  const kpis = [
    { label: "PERIOD AVAILABILITY", value: `${m.availability.toFixed(1)}%`, sub: "Estimated — backend telemetry pending", icon: Activity, placeholder: true },
    { label: "AVG ACKNOWLEDGMENT", value: m.ackAvg, sub: "Time to Desk Officer acknowledgment", icon: Clock, placeholder: false },
    { label: "AVG RESOLUTION TIME", value: m.resolutionAvg, sub: `SLA target: ${m.slaTarget}`, icon: ShieldCheck, placeholder: false },
    { label: "SLA BREACHES", value: String(m.slaBreaches), sub: `Cases exceeding the ${m.slaTarget} target`, icon: AlertTriangle, placeholder: false },
  ];

  return (
    <>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <Info size={14} className="mt-0.5 shrink-0 text-sky-600" />
        <p className="text-[11px] leading-relaxed text-sky-800">
          High-level, read-only operational summary for {m.rangeLabel.toLowerCase()}. Summarized metrics
          only — no drill-down into individual infrastructure logs (spec §14.6).
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
          {REPORT_RANGES.map((dr) => (
            <button
              key={dr.key}
              onClick={() => setRange(dr.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                range === dr.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              {dr.label}
            </button>
          ))}
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, sub, icon: Icon, placeholder }) => (
          <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-stone-400">{label}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                <Icon size={15} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[26px] font-bold text-[#0038A8]">{value}</span>
              {placeholder && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Placeholder</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[#0038A8]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Operational Availability</h3>
              <p className="text-[11px] text-stone-400">{m.rangeLabel}</p>
            </div>
          </div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-[30px] font-bold text-[#0038A8]">{m.availability.toFixed(1)}%</span>
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
              Placeholder metric
            </span>
          </div>
          <StatBar pct={m.availability} color="bg-[#0038A8]" />
          <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
            Backend availability telemetry is not yet connected — this figure is estimated from incident,
            IoT and CCTV data for the period. Monthly/period availability will roll up automatically once
            backend uptime data is available.
          </p>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={16} className="text-[#0038A8]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Response &amp; SLA Summary</h3>
              <p className="text-[11px] text-stone-400">Dispatch to acknowledgment and resolution</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <span className="text-[11px] font-medium text-stone-500">Avg Acknowledgment Time</span>
              <span className="text-[14px] font-bold text-stone-900">{m.ackAvg}</span>
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
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Radio size={16} className="text-[#0038A8]" />
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
            <Camera size={16} className="text-[#0038A8]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">CCTV Camera Availability</h3>
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
            <Send size={16} className="text-[#0038A8]" />
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Notification Delivery</h3>
              <p className="text-[11px] text-stone-400">Push &amp; SMS success / failure</p>
            </div>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-[22px] font-bold text-stone-900">{m.notifSuccess.toFixed(1)}%</span>
            <span className="text-[10px] text-stone-400">delivery success</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-emerald-500" style={{ width: `${m.notifSuccess}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${100 - m.notifSuccess}%` }} />
          </div>
          <div className="mt-4 space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-stone-500">
              <span>Delivered</span>
              <span className="font-semibold text-emerald-600">{m.notifDelivered}/{m.notifTotal}</span>
            </div>
            <div className="flex items-center justify-between text-stone-500">
              <span>Failed</span>
              <span className="font-semibold text-rose-600">{m.notifFailed}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-black/5 px-5 py-4">
          <ShieldCheck size={16} className="text-[#0038A8]" />
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">Operational Report Summary</h3>
            <p className="text-[11px] text-stone-400">Consolidated metrics for {m.rangeLabel.toLowerCase()} — exported as PDF / CSV</p>
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
                  <td className="px-5 py-3 text-[12px] font-medium text-[#0038A8]">{row[1]}</td>
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
