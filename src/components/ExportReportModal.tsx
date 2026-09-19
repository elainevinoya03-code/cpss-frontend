import { useState } from "react";
import { Download, FileText, FileBadge } from "lucide-react";
import { Modal } from "./ui";

const EXPORT_FORMATS = [
  { key: "pdf", label: "PDF Executive Summary", desc: "Formatted report for council meetings", icon: FileText },
  { key: "csv", label: "CSV / Excel", desc: "Raw data for analysis", icon: FileBadge },
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadCSV(fileName: string, from: string, to: string, reportTitle: string, rows: string[][]) {
  const lines = [
    [`${reportTitle}`],
    [`Generated: ${new Date().toLocaleString()} · Range: ${from} to ${to}`],
    [],
    ...rows,
  ];
  const csv = lines.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}_${from}_to_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openPrintPDF(reportTitle: string, range: string, rows: string[][]) {
  const [head, ...body] = rows;
  const thead = head
    ? `<thead><tr>${head.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
    : "";
  const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(reportTitle)}</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#1c1917;padding:32px;margin:0}
      h1{font-size:20px;margin:0 0 4px;color:#1c1917}
      p.meta{color:#78716c;font-size:12px;margin:0 0 20px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e7e5e4;vertical-align:top}
      th{color:#78716c;font-size:10px;letter-spacing:.08em;text-transform:uppercase;background:#fafaf9}
      tbody tr:last-child td{border-bottom:none}
    </style></head><body>
    <h1>${escapeHtml(reportTitle)}</h1>
    <p class="meta">Generated: ${new Date().toLocaleString()} · Range: ${escapeHtml(range)}</p>
    <table>${thead}${tbody}</table>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export default function ExportReportModal({
  onClose,
  title = "Export Report",
  reportTitle = "Report",
  fileName = "report",
  rows = [],
}: {
  onClose: () => void;
  title?: string;
  reportTitle?: string;
  fileName?: string;
  rows?: string[][];
}) {
  const [format, setFormat] = useState("pdf");
  const [dateFrom, setDateFrom] = useState("2026-07-01");
  const [dateTo, setDateTo] = useState("2026-07-20");

  function handleExport() {
    if (format === "csv") {
      downloadCSV(fileName, dateFrom, dateTo, reportTitle, rows);
    } else {
      openPrintPDF(reportTitle, `${dateFrom} to ${dateTo}`, rows);
    }
    onClose();
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      centered
      title={title}
      icon={<Download size={16} className="text-[#15803D]" />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
          >
            <Download size={12} />
            Export {format.toUpperCase()}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-stone-700">File Format</p>
          <div className="space-y-2">
            {EXPORT_FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <label
                  key={f.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    format === f.key ? "border-[#15803D] bg-[#15803D]/5" : "border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={f.key}
                    checked={format === f.key}
                    onChange={() => setFormat(f.key)}
                    className="accent-[#15803D]"
                  />
                  <Icon size={14} className="text-stone-500" />
                  <div>
                    <p className="text-[12px] font-medium text-stone-900">{f.label}</p>
                    <p className="text-[10px] text-stone-400">{f.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold text-stone-700">Date Range</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-900 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
            />
            <span className="text-[11px] text-stone-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-900 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
