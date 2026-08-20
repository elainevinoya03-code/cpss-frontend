import { useState } from "react";
import {
  Archive,
  FileText,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  ImageIcon,
  Users,
  Eye,
  MessageSquare,
  Gauge,
  TrendingUp,
  ClipboardList,
  Search,
  Download,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal } from "../components/ui";

// §15.12 — Pending cases now track closure reason. Only properly resolved incidents
// (status === "resolved") appear here. False alarms, duplicates, and unverified closures
// are excluded from blotter conversion.
interface PendingCase {
  id: string;
  category: string;
  purok: string;
  severity: string;
  title: string;
  reporter: string;
  time: string;
  resolvedAt: string;
  photos: number;
  notes: string[];
  rating: number;
  feedback: string;
  lat: number;
  lng: number;
  closureReason?: string;
  eligible: boolean;
}

interface Blotter {
  id: string;
  incident: string;
  category: string;
  purok: string;
  title: string;
  filed: string;
  officer: string;
  rating: number;
  feedback?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
  "Public Disturbance": { bg: "bg-sky-50", text: "text-sky-600" },
  "IoT/SOS Alerts": { bg: "bg-violet-50", text: "text-violet-600" },
};

// §15.13 — Only eligible (resolved) cases appear. False alarm / duplicate closures are excluded.
const INITIAL_PENDING: PendingCase[] = [
  {
    id: "INC-2065",
    category: "Fire/Smoke",
    purok: "Purok 5",
    severity: "low",
    title: "Cooking smoke false alarm",
    reporter: "Rosa Garcia",
    time: "2026-07-19T20:30:00",
    resolvedAt: "2026-07-19T21:05:00",
    photos: 3,
    notes: ["Smoke source verified at residential kitchen", "Sensor readings within acceptable limits"],
    rating: 5,
    feedback: "Mabilis at malinaw ang pagtugon ng mga tanod. Salamat po!",
    lat: 85,
    lng: 310,
    closureReason: "Normal Resolution",
    eligible: true,
  },
  {
    id: "INC-2064",
    category: "Noise Disturbance",
    purok: "Purok 2",
    severity: "low",
    title: "Event noise verified within limits",
    reporter: "Juan Dela Cruz",
    time: "2026-07-19T18:40:00",
    resolvedAt: "2026-07-19T19:15:00",
    photos: 2,
    notes: ["Sound check at chapel area", "Decibel levels confirmed within allowable"],
    rating: 4,
    feedback: "Na-address agad ang concern. Salamat sa mabilis na aksyon.",
    lat: 225,
    lng: 60,
    closureReason: "Normal Resolution",
    eligible: true,
  },
  {
    id: "INC-2063",
    category: "Public Disturbance",
    purok: "Purok 6",
    severity: "warning",
    title: "Street altercation mediated",
    reporter: "Ana Lim",
    time: "2026-07-19T16:20:00",
    resolvedAt: "2026-07-19T17:30:00",
    photos: 4,
    notes: ["Parties identified and separated", "Ammicable settlement reached on scene"],
    rating: 3,
    feedback: "Naresolba naman pero sana mas mabilis ang response next time.",
    lat: 330,
    lng: 240,
    closureReason: "Normal Resolution",
    eligible: true,
  },
];

const INITIAL_BLOTTERS: Blotter[] = [
  { id: "B-2026-0142", incident: "INC-2043", category: "Fire/Smoke", purok: "Purok 2", title: "False alarm — cooking smoke", filed: "2026-07-20T10:00:00", officer: "D.O. Ramos", rating: 5 },
  { id: "B-2026-0141", incident: "INC-2042", category: "Noise Disturbance", purok: "Purok 5", title: "Event noise — verified within limits", filed: "2026-07-19T21:05:00", officer: "D.O. Ramos", rating: 4 },
  { id: "B-2026-0140", incident: "INC-2041", category: "Fire/Smoke", purok: "Purok 1", title: "Sensor false trigger — gate area", filed: "2026-07-19T12:40:00", officer: "D.O. Torres", rating: 5 },
];

const RATING_DISTRIBUTION = [
  { stars: 5, count: 18 },
  { stars: 4, count: 9 },
  { stars: 3, count: 4 },
  { stars: 2, count: 1 },
  { stars: 1, count: 0 },
];

const FEEDBACK_QUOTES = [
  { incident: "INC-2042", rating: 5, text: "Mabilis ang pagdating ng tanod at maayos ang pag-uusap sa amin.", resident: "Rosa G." },
  { incident: "INC-2039", rating: 4, text: "Na-resolve agad bago pa lumala. Salamat sa serbisyo.", resident: "Juan D." },
  { incident: "INC-2035", rating: 5, text: "Mahusay na handling ng response team sa fire alarm.", resident: "Maria S." },
];

const MONTHLY_REPORT = [
  { category: "Fire/Smoke", count: 12, resolved: 11, avgRating: 4.8 },
  { category: "Noise Disturbance", count: 9, resolved: 9, avgRating: 4.2 },
  { category: "Public Disturbance", count: 6, resolved: 5, avgRating: 3.8 },
  { category: "IoT/SOS Alerts", count: 7, resolved: 7, avgRating: 4.5 },
];

const WEEKLY_TREND = [
  { week: "W1", cases: 8 },
  { week: "W2", cases: 11 },
  { week: "W3", cases: 7 },
  { week: "W4", cases: 12 },
];

function RatingStars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < value ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
      ))}
    </span>
  );
}

function nextBlotterId(blotters: { id: string }[]) {
  const max = blotters.reduce((acc, b) => {
    const n = parseInt(b.id.replace(/^B-\d+-/, ""), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `B-2026-${max + 1}`;
}

function BlotterDetail({ blotter, onClose }) {
  if (!blotter) return null;
  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={blotter.id}
      subtitle={`${blotter.incident} · ${blotter.purok}`}
      aside={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 size={12} />
          Archived
        </span>
      }
      footer={
        <button
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#002A8C]"
        >
          <CheckCircle2 size={14} />
          Close Record
        </button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${CATEGORY_COLORS[blotter.category]?.bg ?? "bg-stone-100"} ${CATEGORY_COLORS[blotter.category]?.text ?? "text-stone-600"}`}>
          {blotter.category}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
          <RatingStars value={blotter.rating} />
          {blotter.rating}.0
        </span>
      </div>

      <div className="mb-5">
        <p className="text-[10px] font-medium tracking-wider text-stone-400">OFFICIAL BLOTTER ENTRY</p>
        <h3 className="mt-1 text-[16px] font-bold text-stone-900">{blotter.title}</h3>
        <p className="mt-1 text-[12px] text-stone-500">
          This permanent archival record consolidates the complete incident lifecycle — triage ticket, evidence, GPS tags, field notes, resolution summary, and citizen feedback.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">FILED</p>
          <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-stone-900">
            <Clock size={12} />
            {formatTime(blotter.filed)}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">RECORDED BY</p>
          <p className="mt-1 text-[12px] font-medium text-stone-900">{blotter.officer}</p>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">GPS TAG &amp; EVIDENCE</p>
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-[#0038A8]" />
          <span className="font-mono text-[11px] text-stone-900">{blotter.incident === "INC-2043" ? "225, 60" : "85, 310"}</span>
        </div>
        <div className="mt-2 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex h-16 w-16 items-center justify-center rounded-lg border border-stone-200 bg-white">
              <ImageIcon size={16} className="text-stone-300" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="mb-1 text-[10px] font-medium tracking-wider text-stone-400">RESOLUTION SUMMARY</p>
        <p className="text-[12px] text-stone-700">
          Incident {blotter.incident} closed successfully. {blotter.category} resolved on scene, parties informed, and scene cleared. Archival record linked to resident satisfaction rating of {blotter.rating}/5.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
        <p className="mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wider text-amber-600">
          <MessageSquare size={11} />
          CITIZEN FEEDBACK
        </p>
        <p className="text-[12px] italic text-stone-700">
          "{blotter.feedback ?? "Naging maayos at mabilis ang pagresolba ng aking reklamo. Salamat sa inyong serbisyo."}"
        </p>
      </div>
    </Modal>
  );
}

export default function DigitalBlotter() {
  const { flash, ToastPortal } = useToast();

  const [pending, setPending] = useState<PendingCase[]>(INITIAL_PENDING);
  const [blotters, setBlotters] = useState<Blotter[]>(INITIAL_BLOTTERS);
  const [selected, setSelected] = useState<Blotter | null>(null);
  const [converted, setConverted] = useState<Blotter | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // §15.14 — Only eligible (resolved) cases can be converted. Unresolved/false alarm cases are blocked.
  function convertCase(inc: PendingCase) {
    if (!inc.eligible) {
      flash(`${inc.id} is not eligible for blotter conversion — only resolved incidents can be archived`);
      return;
    }
    const nextId = nextBlotterId(blotters);
    const blotter: Blotter = {
      id: nextId,
      incident: inc.id,
      category: inc.category,
      purok: inc.purok,
      title: inc.title,
      filed: new Date().toISOString(),
      officer: "D.O. Ramos",
      rating: inc.rating,
      feedback: inc.feedback,
    };
    setBlotters((prev) => [blotter, ...prev]);
    setPending((prev) => prev.filter((p) => p.id !== inc.id));
    setConverted(blotter);
    flash(`${inc.id} converted into permanent archival blotter ${nextId}`);
  }

  function exportBlotters() {
    const header = ["ID", "Incident", "Category", "Purok", "Title", "Filed", "Officer", "Rating", "Feedback"];
    const rows = filteredBlotters.map((b) => [
      b.id,
      b.incident,
      b.category,
      b.purok,
      b.title,
      formatTime(b.filed),
      b.officer,
      String(b.rating),
      b.feedback ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "barangay_blotter_export.csv";
    a.click();
    URL.revokeObjectURL(url);
    flash(`${filteredBlotters.length} blotter record${filteredBlotters.length === 1 ? "" : "s"} exported as CSV for official use`);
  }

  const filteredBlotters = blotters.filter((b) => {
    const matchesCategory = categoryFilter === "All" || b.category === categoryFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      [b.id, b.incident, b.category, b.purok, b.title, b.officer].some((f) => f.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const totalRatings = RATING_DISTRIBUTION.reduce((a, r) => a + r.count, 0);
  const avgRating = (RATING_DISTRIBUTION.reduce((a, r) => a + r.stars * r.count, 0) / totalRatings).toFixed(1);
  const pendingTotal = pending.length;

  const kpis = [
    { label: "TOTAL BLOTTERS FILED", value: blotters.length, sub: "permanent archival records", icon: Archive },
    { label: "PENDING CONVERSION", value: pendingTotal, sub: "resolved cases ready to archive", icon: ClipboardList },
    { label: "AVG CITIZEN RATING", value: `${avgRating} / 5`, sub: "across all closed cases", icon: Star },
    { label: "AVG RESPONSE TIME", value: "4.2 min", sub: "dispatch to on-scene", icon: Gauge },
  ];

  const maxTrend = Math.max(...WEEKLY_TREND.map((w) => w.cases));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Digital Barangay Blotter</h1>
              <p className="mt-1 text-sm text-stone-500">
                One-click archival of resolved incidents, ratings &amp; executive oversight
              </p>
            </div>
            <button
              onClick={() => pending[0] && convertCase(pending[0])}
              disabled={pending.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
            >
              <FileText size={13} />
              Convert Next
            </button>
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

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3" style={{ height: 480 }}>
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Resolved Cases — Pending Archival</h3>
                  <p className="text-[11px] text-[#94A3B8]">Completed lifecycles ready for single-click conversion</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{pending.length} ready</span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <CheckCircle2 size={22} className="mb-2 text-emerald-400" />
                  <p className="text-[12px] font-medium text-stone-500">All resolved cases archived</p>
                  <p className="text-[10px] text-stone-400">No pending conversions</p>
                </div>
              ) : (
                pending.map((inc) => {
                  const sev = SEVERITY_MAP[inc.severity];
                  return (
                    <div key={inc.id} className={`rounded-lg border bg-white px-4 py-3.5 ${inc.eligible ? "border-stone-200" : "border-rose-200 opacity-60"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{inc.id}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CATEGORY_COLORS[inc.category]?.bg ?? "bg-stone-100"} ${CATEGORY_COLORS[inc.category]?.text ?? "text-stone-600"}`}>
                            {inc.category}
                          </span>
                          {/* §15.18 — Eligibility badge */}
                          {inc.eligible ? (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">Eligible</span>
                          ) : (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-medium text-rose-700">Not Eligible</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <RatingStars value={inc.rating} />
                          <span className="text-[10px] font-semibold text-stone-500">{inc.rating}.0</span>
                        </div>
                      </div>

                      <p className="mt-1.5 text-[12px] font-semibold text-stone-900">{inc.title}</p>
                      <p className="text-[10px] text-stone-400">
                        {inc.purok} · reported by {inc.reporter} · resolved {formatTime(inc.resolvedAt)}
                      </p>
                      {inc.closureReason && (
                        <p className="mt-0.5 text-[10px] text-stone-500">Closure: <span className="font-medium text-stone-600">{inc.closureReason}</span></p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <ImageIcon size={10} />
                          {inc.photos} photos
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <FileText size={10} />
                          {inc.notes.length} field notes
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <MapPin size={10} />
                          GPS {inc.lat}, {inc.lng}
                        </span>
                      </div>

                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
                        <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                          <MessageSquare size={10} />
                          Citizen Feedback
                        </p>
                        <p className="mt-0.5 text-[11px] italic text-stone-700">"{inc.feedback}"</p>
                      </div>

                      <button
                        onClick={() => convertCase(inc)}
                        disabled={!inc.eligible}
                        className={`mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold text-white transition ${
                          inc.eligible ? "bg-[#0038A8] hover:bg-[#002A8C]" : "bg-stone-400 cursor-not-allowed"
                        }`}
                      >
                        <Archive size={12} />
                        {inc.eligible ? "Convert to Blotter" : "Not Eligible"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Resolution &amp; Feedback Analyzer</h3>
                  <p className="text-[11px] text-[#94A3B8]">Secured post-incident ratings &amp; qualitative feedback</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">AVERAGE SATISFACTION</p>
                <p className="mt-1 text-[30px] font-bold text-[#0038A8]">{avgRating}</p>
                <div className="mt-1 flex justify-center">
                  <RatingStars value={Math.round(parseFloat(avgRating))} size={14} />
                </div>
                <p className="mt-1 text-[10px] text-stone-400">across {totalRatings} closed-case ratings</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">RATING DISTRIBUTION</p>
                <div className="space-y-1.5">
                  {RATING_DISTRIBUTION.map((r) => (
                    <div key={r.stars} className="flex items-center gap-2">
                      <span className="flex w-10 items-center gap-0.5 text-[10px] font-semibold text-stone-600">
                        <Star size={10} className="fill-amber-400 text-amber-400" />
                        {r.stars}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className={`h-full rounded-full ${r.stars >= 4 ? "bg-emerald-500" : r.stars === 3 ? "bg-amber-400" : "bg-rose-400"}`}
                          style={{ width: `${(r.count / totalRatings) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] font-medium text-stone-500">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">RECENT FEEDBACK</p>
                <div className="space-y-2">
                  {FEEDBACK_QUOTES.map((f) => (
                    <div key={f.incident} className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <RatingStars value={f.rating} size={10} />
                        <span className="text-[9px] text-stone-400">{f.incident} · {f.resident}</span>
                      </div>
                      <p className="mt-1 text-[11px] italic leading-snug text-stone-600">"{f.text}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Blotter Archive</h3>
                  <p className="text-[11px] text-[#94A3B8]">Official archival incident logs</p>
                </div>
              </div>
              <button
                onClick={exportBlotters}
                disabled={filteredBlotters.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-2.5 py-1.5 text-[10px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:opacity-40"
              >
                <Download size={12} />
                Export CSV
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-5 pb-3">
              <div className="relative min-w-[180px] flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ID, incident, category, purok, title…"
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-7 pr-2.5 text-[11px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>
              <div className="flex gap-1.5">
                {["All", ...Object.keys(CATEGORY_COLORS)].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                      categoryFilter === c
                        ? "border-[#0038A8]/30 bg-[#0038A8]/5 text-[#0038A8]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-stone-400">{filteredBlotters.length} record{filteredBlotters.length === 1 ? "" : "s"}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {filteredBlotters.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Archive size={20} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No blotter records match your search</p>
                  <p className="text-[10px] text-stone-400">Adjust the search or category filter</p>
                </div>
              ) : (
              filteredBlotters.map((b, i) => (
                <div key={b.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${i < filteredBlotters.length - 1 ? "border-b border-black/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0038A8]/5 text-[#0038A8]">
                      <FileText size={15} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-stone-900">{b.id}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CATEGORY_COLORS[b.category]?.bg ?? "bg-stone-100"} ${CATEGORY_COLORS[b.category]?.text ?? "text-stone-600"}`}>
                          {b.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600">{b.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                        <Clock size={9} />
                        {formatTime(b.filed)}
                        <span className="mx-0.5">&middot;</span>
                        {b.incident} · {b.purok} · {b.officer}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] font-medium text-stone-500">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      {b.rating}.0
                    </span>
                    <button
                      onClick={() => setSelected(b)}
                      className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      <Eye size={11} />
                      View
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Executive Review &amp; Oversight</h3>
                  <p className="text-[11px] text-[#94A3B8]">Captain-accessible responsiveness metrics</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-[#0038A8]">
                <Users size={11} />
                Captain
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">RESPONSIVENESS SCORE</p>
                <p className="mt-1 text-[24px] font-bold text-emerald-600">94%</p>
                <p className="text-[10px] text-stone-400">cases responded within target window this month</p>
              </div>

              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">PEACE &amp; ORDER REPORT — CATEGORY PERFORMANCE</p>
              <div className="mb-3 space-y-2">
                {MONTHLY_REPORT.map((m) => (
                  <div key={m.category} className="rounded-lg border border-stone-200 px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-stone-900">{m.category}</span>
                      <span className="text-[10px] font-medium text-stone-500">{m.count} cases</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                        <div className="h-full rounded-full bg-[#0038A8]" style={{ width: `${(m.resolved / m.count) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-emerald-600">{m.resolved}/{m.count} resolved</span>
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-500">
                        <Star size={8} className="fill-amber-400 text-amber-400" />
                        {m.avgRating}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">WEEKLY CASE TREND</p>
              <div className="mb-3 flex items-end gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                {WEEKLY_TREND.map((w) => (
                  <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[9px] font-semibold text-stone-600">{w.cases}</span>
                    <div className="w-full rounded-t bg-[#0038A8]/15" style={{ height: `${(w.cases / maxTrend) * 56}px` }}>
                      <div className="h-full w-full rounded-t bg-[#0038A8]/70" style={{ height: "100%" }} />
                    </div>
                    <span className="text-[9px] text-stone-400">{w.week}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setReportReady(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-4 py-2.5 text-[12px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
              >
                <FileText size={13} />
                Generate Peace &amp; Order Report
              </button>
            </div>
          </div>
        </div>
      </main>

      {selected && <BlotterDetail blotter={selected} onClose={() => setSelected(null)} />}

      {converted && (
        <ConfirmModal
          type="success"
          title="Blotter Archived"
          message={`${converted.id} created — incident ${converted.incident} with its photos, GPS tags, field notes and ${converted.rating}-star rating is now a permanent archival record.`}
          onClose={() => setConverted(null)}
        />
      )}

      {reportReady && (
        <ConfirmModal
          type="success"
          title="Report Generated"
          message="Monthly Peace & Order report compiled from archival blotters — dispatched to the Barangay Captain for review."
          onClose={() => setReportReady(false)}
        />
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
