import { useMemo, useState, useEffect } from "react";
import { Search, Filter, Download, Lock, ShieldAlert } from "lucide-react";
import { getAuditLogs, subscribeAuditLogs } from "../utils/auditLog";
import { ACTION_STYLES } from "./_shared";

const STATIC_LOGS = [
  {
    timestamp: "2026-07-20 08:44:12",
    admin: "admin@brgy.gov.ph",
    actionType: "Configuration Change",
    description: "Adjusted Decibel Threshold to 85 dB for DB-MARKET-01",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-20 08:31:05",
    admin: "admin@brgy.gov.ph",
    actionType: "User Deactivation",
    description: "Deactivated account for Carlo Mendoza (Purok Leader)",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-20 07:58:43",
    admin: "admin@brgy.gov.ph",
    actionType: "Device Registration",
    description: "Registered new device SM-CHAPEL-01 at Purok 2, Chapel Area",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-19 22:15:30",
    admin: "admin@brgy.gov.ph",
    actionType: "Geofence Update",
    description: "Updated boundary polygon for Purok 3 — 8 nodes modified",
    ip: "192.168.1.11",
  },
  {
    timestamp: "2026-07-19 18:02:11",
    admin: "admin@brgy.gov.ph",
    actionType: "Configuration Change",
    description: "Smoke sensitivity threshold set to 70 (relative scale) for SM-GATE-01",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-19 15:44:59",
    admin: "admin@brgy.gov.ph",
    actionType: "User Created",
    description: "New account created for Liza Flores (Tanod, Purok 5)",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-19 11:30:22",
    admin: "admin@brgy.gov.ph",
    actionType: "System Alert",
    description: "Offline alert triggered — SM-PUROK3-01 unreachable for 30 min",
    ip: "192.168.1.12",
  },
  {
    timestamp: "2026-07-19 09:08:04",
    admin: "admin@brgy.gov.ph",
    actionType: "Geofence Update",
    description: "Created new boundary for Main Barangay Hall perimeter",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-18 16:55:17",
    admin: "admin@brgy.gov.ph",
    actionType: "Configuration Change",
    description: "Adjusted Decibel Threshold to 90 dB for DB-HALL-01",
    ip: "192.168.1.10",
  },
  {
    timestamp: "2026-07-18 14:21:38",
    admin: "admin@brgy.gov.ph",
    actionType: "User Created",
    description: "New account created for Benito Cruz (Purok Leader, Purok 6)",
    ip: "192.168.1.10",
  },
];

function ActionBadge({ type }) {
  const style = ACTION_STYLES[type] || "bg-stone-100 text-stone-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {type}
    </span>
  );
}

const RESULT_STYLES: Record<string, string> = {
  Success: "bg-emerald-50 text-emerald-700",
  Denied: "bg-rose-50 text-rose-600",
  Failed: "bg-red-50 text-red-600",
};

function roleFor(admin: string): string {
  const a = admin.toLowerCase();
  if (a.startsWith("admin")) return "System Admin";
  if (a.includes("captain")) return "Captain";
  if (a.includes("desk")) return "Desk Officer";
  if (a.includes("operator") || a.includes("cctv")) return "CCTV Operator";
  if (a.includes("chief") && a.includes("tanod")) return "Chief Tanod";
  if (a.includes("tanod")) return "Tanod";
  if (a.includes("patrol")) return "Patrol Leader";
  return "System Admin";
}

function affectedRecordFor(desc: string): string {
  const patterns = [
    /\b(?:DR|INC)-\d+/i,
    /\b[A-Z]{2,3}-[A-Z0-9]+-\d{2}\b/,
    /\bCAM-[A-Z0-9-]+/i,
    /\bboundary\s+["']?([^"',.]+)["']?/i,
    /\baccount (?:created )?for ([A-Z][a-z]+ [A-Z][a-z]+)/,
    /\broute\s+["']?([^"',.]+)["']?/i,
    /(?:Purok|Zone|zone)\s+[^ ,.;]+/i,
  ];
  for (const re of patterns) {
    const m = desc.match(re);
    if (m) return (m[1] ?? m[0]).trim();
  }
  return "—";
}

function resultFor(desc: string): string {
  const d = desc.toLowerCase();
  if (/\bdenied\b/.test(d)) return "Denied";
  if (/\bfailed\b|\bfailure\b|\bunreachable\b|\bblocked\b|\bcannot be\b|\bcould not\b|\berror\b/.test(d)) return "Failed";
  return "Success";
}

function ResultBadge({ result }: { result: string }) {
  const style = RESULT_STYLES[result] || "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {result}
    </span>
  );
}

function toCsv(rows) {
  const header = ["Timestamp", "Actor", "Role", "Action", "Affected Record", "Description", "Result", "IP Address"];
  const escape = (val) => `"${String(val).replace(/"/g, '""')}"`;
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.timestamp,
        r.admin,
        roleFor(r.admin),
        r.actionType,
        affectedRecordFor(r.description),
        r.description,
        resultFor(r.description),
        r.ip,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export default function SystemLogs() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [liveEntries, setLiveEntries] = useState(() => getAuditLogs());

  useEffect(() => subscribeAuditLogs(() => setLiveEntries([...getAuditLogs()])), []);

  const allLogs = useMemo(() => [...STATIC_LOGS, ...liveEntries], [liveEntries]);

  const actionTypes = useMemo(
    () => ["All", ...Array.from(new Set(allLogs.map((l) => l.actionType)))],
    [allLogs]
  );

  const actorOptions = useMemo(
    () => ["All", ...Array.from(new Set(allLogs.map((l) => l.admin)))],
    [allLogs]
  );

  const resultOptions = useMemo(
    () => ["All", ...Array.from(new Set(allLogs.map((l) => resultFor(l.description))))],
    [allLogs]
  );

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const matchesAction = filter === "All" || log.actionType === filter;
      const matchesActor = actorFilter === "All" || log.admin === actorFilter;
      const matchesResult = resultFilter === "All" || resultFor(log.description) === resultFilter;
      const matchesDate = dateFilter === "" || log.timestamp.slice(0, 10) === dateFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        log.admin.toLowerCase().includes(q) ||
        roleFor(log.admin).toLowerCase().includes(q) ||
        log.actionType.toLowerCase().includes(q) ||
        affectedRecordFor(log.description).toLowerCase().includes(q) ||
        resultFor(log.description).toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        log.ip.toLowerCase().includes(q);
      return matchesAction && matchesActor && matchesResult && matchesDate && matchesSearch;
    });
  }, [search, filter, dateFilter, actorFilter, resultFilter, allLogs]);

  const handleExport = () => {
    const csv = toCsv(filteredLogs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "system-audit-logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">System Audit Logs</h1>
              <p className="mt-1 text-sm text-stone-500">
                Immutable record of all administrative actions
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Lock size={12} /> READ ONLY
            </span>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-stone-400">
            <ShieldAlert size={13} className="mt-0.5 shrink-0" />
            This trail is write-once and shared across every administrative action. Logs cannot be
            edited, deleted, re-timed, or re-attributed by any user.
          </p>
        </header>

        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">System Audit Logs</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Immutable record of all admin actions — {filteredLogs.length} entries shown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full rounded-md border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-sm text-stone-700 placeholder-stone-400 outline-none focus:border-stone-400"
                />
              </div>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                title="Filter by date"
                aria-label="Filter by date"
                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none focus:border-stone-400"
              />

              <div className="relative min-w-[140px]">
                <select
                  value={actorFilter}
                  onChange={(e) => setActorFilter(e.target.value)}
                  title="Filter by actor"
                  className="w-full appearance-none rounded-md border border-stone-200 bg-white py-1.5 pl-3 pr-7 text-sm text-stone-700 outline-none focus:border-stone-400"
                >
                  {actorOptions.map((a) => (
                    <option key={a} value={a}>
                      {a === "All" ? "All Actors" : a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-[150px]">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  title="Filter by action type"
                  className="w-full appearance-none rounded-md border border-stone-200 bg-white py-1.5 pl-8 pr-7 text-sm text-stone-700 outline-none focus:border-stone-400"
                >
                  {actionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-[130px]">
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  title="Filter by result"
                  className="w-full appearance-none rounded-md border border-stone-200 bg-white py-1.5 pl-3 pr-7 text-sm text-stone-700 outline-none focus:border-stone-400"
                >
                  {resultOptions.map((r) => (
                    <option key={r} value={r}>
                      {r === "All" ? "All Results" : r}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-stone-400">
                  <th className="whitespace-nowrap px-5 py-2 font-medium">Timestamp</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Actor</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Role</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Affected Record</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Result</th>
                  <th className="whitespace-nowrap px-5 py-2 text-right font-medium">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-stone-500">
                      {log.timestamp}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-900 text-[10px] font-semibold text-white">
                          BA
                        </div>
                        <span className="text-stone-600">{log.admin}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-stone-500">{roleFor(log.admin)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <ActionBadge type={log.actionType} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-stone-500">
                      {affectedRecordFor(log.description)}
                    </td>
                    <td className="whitespace-pre-line px-3 py-3 text-stone-700">{log.description}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <ResultBadge result={resultFor(log.description)} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-xs text-stone-400">
                      {log.ip}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-stone-400">
                      No log entries match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}