import { useEffect, useMemo, useState } from "react";
import {
  Video,
  Camera,
  Play,
  Pause,
  Clock,
  Search,
  Filter,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  ChevronDown,
  X,
  Radio,
  User,
  FileText,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";

const PRIORITY_DOT: Record<string, string> = {
  Critical: "bg-rose-500",
  High: "bg-orange-500",
  Medium: "bg-amber-400",
  Warning: "bg-sky-400",
  Low: "bg-stone-300",
};

const PRIORITY_BADGE: Record<string, string> = {
  Critical: "bg-rose-100 text-rose-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Warning: "bg-sky-100 text-sky-700",
  Low: "bg-stone-100 text-stone-600",
};

const TAG_TYPES = ["Suspicious Behavior", "Unusual Crowd", "Road Blockage", "Other"] as const;

const TAG_TYPE_BADGE: Record<string, string> = {
  "Suspicious Behavior": "bg-stone-100 text-stone-700",
  "Unusual Crowd": "bg-violet-100 text-violet-700",
  "Road Blockage": "bg-amber-100 text-amber-700",
  Other: "bg-sky-100 text-sky-700",
};

const INCIDENT_LOOKUP: Record<string, { title: string; category: string; location: string }> = {
  "INC-2041": { title: "Structure Fire — Purok 4 Residential", category: "Fire / Smoke", location: "Purok 4 — residential district near school" },
  "INC-2040": { title: "Mass Noise Disturbance — Purok 6 Commercial Strip", category: "Noise Disturbance", location: "Purok 6 — commercial strip" },
  "INC-2042": { title: "Suspicious Activity Report — Purok 2 Chapel Area", category: "Suspicious Activity", location: "Purok 2 — chapel area" },
  "INC-2043": { title: "Flash Flood Warning — Purok 3 & 5 Low-Lying Areas", category: "Flood", location: "Purok 3 & 5 — riverside low-lying areas" },
};

const MOCK_CLIPS = [
  { id: "CLIP-2026-0001", incidentId: "INC-2041", camera: "CAM-GATE-01", location: "Main Gate", purok: "Purok 1", tagType: "Suspicious Behavior", priority: "Critical", operator: "CO-01", capturedAt: "2026-07-14T22:08:00", duration: 40, sizeMB: 42, privacyBlurred: true },
  { id: "CLIP-2026-0002", incidentId: "INC-2041", camera: "CAM-PLAZA-03", location: "Hall Plaza", purok: "Purok 2", tagType: "Unusual Crowd", priority: "High", operator: "CO-01", capturedAt: "2026-07-14T22:12:00", duration: 40, sizeMB: 41, privacyBlurred: false },
  { id: "CLIP-2026-0003", incidentId: "INC-2040", camera: "CAM-MARKET-04", location: "Market Zone", purok: "Purok 6", tagType: "Unusual Crowd", priority: "Medium", operator: "CO-02", capturedAt: "2026-07-17T19:28:00", duration: 40, sizeMB: 38, privacyBlurred: false },
  { id: "CLIP-2026-0004", incidentId: "INC-2042", camera: "CAM-CHAPEL-02", location: "Chapel Area", purok: "Purok 2", tagType: "Suspicious Behavior", priority: "High", operator: "CO-01", capturedAt: "2026-07-19T18:43:00", duration: 40, sizeMB: 40, privacyBlurred: true },
  { id: "CLIP-2026-0005", incidentId: "INC-2043", camera: "CAM-RIVER-01", location: "Riverside North", purok: "Purok 3", tagType: "Road Blockage", priority: "Critical", operator: "CO-02", capturedAt: "2026-07-20T06:02:00", duration: 40, sizeMB: 44, privacyBlurred: false },
  { id: "CLIP-2026-0006", incidentId: "INC-2043", camera: "CAM-RIVER-02", location: "Riverside South", purok: "Purok 5", tagType: "Other", priority: "Warning", operator: "CO-01", capturedAt: "2026-07-20T06:10:00", duration: 40, sizeMB: 39, privacyBlurred: false },
  { id: "CLIP-2026-0007", incidentId: "INC-2041", camera: "CAM-ALLEY-07", location: "Residential Alley", purok: "Purok 4", tagType: "Suspicious Behavior", priority: "High", operator: "CO-02", capturedAt: "2026-07-14T22:05:00", duration: 40, sizeMB: 41, privacyBlurred: true },
  { id: "CLIP-2026-0008", incidentId: null, camera: "CAM-HALL-06", location: "Barangay Hall", purok: "Purok 4", tagType: "Unusual Crowd", priority: "Medium", operator: "CO-01", capturedAt: "2026-07-20T09:00:00", duration: 40, sizeMB: 37, privacyBlurred: false },
];

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PlaybackStation({ clip, onClose }: { clip: (typeof MOCK_CLIPS)[number] | null; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!clip) {
      setPlaying(false);
      setProgress(0);
      return;
    }
    setProgress(0);
    setPlaying(false);
  }, [clip]);

  useEffect(() => {
    if (!playing || !clip) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= clip.duration - 1) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, clip]);

  if (!clip) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-black/5 bg-white shadow-sm p-10 text-center">
        <Video size={28} className="mb-3 text-stone-300" />
        <p className="text-[13px] font-medium text-stone-500">No clip selected</p>
        <p className="mt-1 text-[11px] text-stone-400">Select an evidence clip from the list to view it.</p>
      </div>
    );
  }

  const incidentTitle = clip.incidentId ? INCIDENT_LOOKUP[clip.incidentId] : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Video size={16} className="text-[#0038A8]" />
          <div>
            <h3 className="text-[14px] font-semibold text-stone-900">Evidence Playback</h3>
            <p className="text-[11px] text-stone-400">Read-only viewer â€” clips are authored by the CCTV Operator</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div className="relative overflow-hidden rounded-lg bg-stone-900">
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 text-[9px] font-bold tracking-wider text-rose-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            REC
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 text-[9px] font-medium text-white">
            <Camera size={9} />
            {clip.camera}
          </div>
          <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-stone-800 to-stone-900">
            {playing ? (
              <Pause size={40} className="text-white/70" />
            ) : (
              <button
                onClick={() => setPlaying(true)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0038A8] text-white shadow-lg transition hover:bg-[#002A8C]"
                aria-label="Play clip"
              >
                <Play size={24} className="ml-1" />
              </button>
            )}
            <div className="absolute bottom-3 left-3 text-[10px] font-medium text-white/70">
              {formatClock(progress)} / {formatClock(clip.duration)}
            </div>
            <div className="absolute bottom-3 right-3 text-[9px] text-white/60">
              {clip.tagType}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <input
              type="range"
              min={0}
              max={clip.duration}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full cursor-pointer accent-[#0038A8]"
              aria-label="Seek"
            />
          </div>
        </div>

        {clip.privacyBlurred && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <EyeOff size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[11px] font-semibold text-amber-700">Privacy Blurred</p>
              <p className="text-[10px] leading-relaxed text-stone-500">
                Redacted by the CCTV Operator (DPA). Evidence is reviewed in this state — the Captain cannot
                unblur footage. Only the CCTV Operator or Barangay Admin may lift the blur.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">CLIP ID</p>
            <p className="mt-0.5 text-[12px] font-semibold text-stone-900">{clip.id}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">LINKED INCIDENT</p>
            {clip.incidentId ? (
              <p className="mt-0.5 text-[12px] font-semibold text-stone-900">{clip.incidentId}</p>
            ) : (
              <p className="mt-0.5 text-[11px] text-stone-400">Unattached</p>
            )}
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">CAPTURED BY</p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-stone-900">
              <User size={11} className="text-stone-400" />
              {clip.operator}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">CAMERA &amp; LOCATION</p>
            <p className="mt-0.5 text-[12px] font-medium text-stone-900">{clip.location}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">PUROK</p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-stone-900">
              <MapPin size={11} className="text-[#0038A8]" />
              {clip.purok}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">DURATION / SIZE</p>
            <p className="mt-0.5 text-[12px] font-medium text-stone-900">
              {formatClock(clip.duration)} Â· {clip.sizeMB} MB
            </p>
          </div>
        </div>

        {clip.incidentId && incidentTitle && (
          <div className="rounded-lg border border-stone-200 bg-[#0038A8]/5 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#0038A8]">
              <FileText size={11} />
              LINKED INCIDENT
            </p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-4">
                <span className="text-stone-400">Incident ID</span>
                <span className="font-semibold text-stone-900">{clip.incidentId}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-stone-400">Title</span>
                <span className="font-medium text-stone-900">{incidentTitle.title}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-stone-400">Category</span>
                <span className="font-medium text-stone-900">{incidentTitle.category}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-stone-400">Location</span>
                <span className="font-medium text-stone-900">{incidentTitle.location}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-stone-400">Capture time</span>
                <span className="font-medium text-stone-900">{formatTime(clip.capturedAt)}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-stone-400">
              Incident information is read-only — maintained by the Desk Officer / CCTV Operator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CCTVEvidenceViewer() {
  const { ToastPortal } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [privacyFilter, setPrivacyFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedClip, setSelectedClip] = useState<(typeof MOCK_CLIPS)[number] | null>(null);

  useEffect(() => {
    if (!selectedClip) setSelectedClip(MOCK_CLIPS[0]);
  }, []);

  const filtered = useMemo(() => {
    return MOCK_CLIPS.filter((c) => {
      if (typeFilter !== "all" && c.tagType !== typeFilter) return false;
      if (privacyFilter === "blurred" && !c.privacyBlurred) return false;
      if (privacyFilter === "clear" && c.privacyBlurred) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hay = [c.id, c.incidentId ?? "", c.camera, c.location, c.purok, c.operator, c.tagType].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [searchQuery, typeFilter, privacyFilter]);

  const attached = MOCK_CLIPS.filter((c) => c.incidentId).length;
  const blurred = MOCK_CLIPS.filter((c) => c.privacyBlurred).length;
  const totalSize = MOCK_CLIPS.reduce((a, c) => a + c.sizeMB, 0);

  const kpis = [
    { label: "TOTAL CLIPS", value: MOCK_CLIPS.length, sub: "In evidence archive", icon: Video },
    { label: "ATTACHED TO INCIDENTS", value: attached, sub: "Linked to archival records", icon: FileText },
    { label: "PRIVACY BLURRED", value: blurred, sub: "Manually redacted (DPA)", icon: EyeOff },
    { label: "STORAGE USED", value: `${(totalSize / 1024).toFixed(2)} GB`, sub: "vs 2 TB archive budget", icon: Radio },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">CCTV Evidence Viewer</h1>
              <p className="mt-1 text-sm text-stone-500">
                Strictly read-only evidence review — no footage editing, unblurring, tagging, or camera control for the Captain
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-bold tracking-widest text-white">
                <Lock size={13} />
                READ-ONLY
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[10px] text-stone-500">
                <EyeOff size={11} />
                Evidence cannot be modified
              </span>
            </div>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-stone-400">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clip / incident / camera / operator..."
              className="w-64 rounded-lg border border-black/10 bg-white py-1.5 pl-8 pr-3 text-[11px] text-stone-700 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
            {[{ key: "all", label: "All Types" }, ...TAG_TYPES.map((t) => ({ key: t, label: t }))].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  typeFilter === opt.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-900 hover:bg-stone-50"
            >
              <Filter size={12} />
              Privacy
              <ChevronDown size={12} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                {[{ key: "all", label: "All" }, { key: "blurred", label: "Privacy Blurred" }, { key: "clear", label: "Clear" }].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setPrivacyFilter(opt.key); setFilterOpen(false); }}
                    className={`block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition ${
                      privacyFilter === opt.key ? "bg-[#0038A8] text-white" : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { setSearchQuery(""); setTypeFilter("all"); setPrivacyFilter("all"); }}
            className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50"
          >
            <X size={11} />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-stone-900">Evidence Clips</h3>
                  <p className="text-[11px] text-stone-400">{filtered.length} clip{filtered.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pt-1 pb-2">
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Eye size={22} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-[12px] text-stone-400">No clips match your filters</p>
                </div>
              ) : (
                filtered.map((clip, i) => {
                  const sev = PRIORITY_DOT[clip.priority] ?? "bg-stone-300";
                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClip(clip)}
                      className={`cursor-pointer px-5 py-3 transition hover:bg-stone-50/80 ${
                        i < filtered.length - 1 ? "border-b border-black/5" : ""
                      } ${selectedClip?.id === clip.id ? "bg-[#0038A8]/5" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TAG_TYPE_BADGE[clip.tagType] ?? "bg-stone-100 text-stone-500"}`}>
                          <Video size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-stone-900">{clip.id}</span>
                            {clip.incidentId ? (
                              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">{clip.incidentId}</span>
                            ) : (
                              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-400">Unattached</span>
                            )}
                            <span className={`h-1.5 w-1.5 rounded-full ${sev}`} title={clip.priority} />
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-stone-500">
                            {clip.camera} Â· {clip.location}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock size={9} />
                            {formatTime(clip.capturedAt)}
                            {" "}Â· {clip.operator}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${PRIORITY_BADGE[clip.priority] ?? "bg-stone-100 text-stone-600"}`}>
                            {clip.priority}
                          </span>
                          {clip.privacyBlurred ? (
                            <span className="flex items-center gap-0.5 text-[9px] font-medium text-amber-600">
                              <EyeOff size={9} /> Blurred
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-600">
                              <Eye size={9} /> Clear
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="xl:col-span-3">
            <PlaybackStation clip={selectedClip} onClose={() => setSelectedClip(null)} />
          </div>
        </div>
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
