import { useMemo, useState } from "react";
import {
  Megaphone,
  Bell,
  BellRing,
  Send,
  ShieldAlert,
  PartyPopper,
  CloudRain,
  CloudSun,
  RefreshCw,
  LoaderCircle,
  Sun,
  Wind,
  Droplets,
  Home,
  Globe,
  MapPin,
  Clock,
  Archive,
  RotateCcw,
  Info,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";

type BulletinType = "Safety Alert" | "Event Notice" | "Weather Warning";
type Severity = "info" | "warning" | "alert";
type BulletinFilter = "all" | "archived" | BulletinType;

interface BulletinTarget {
  purokId: string | null;
  label: string;
}

interface Bulletin {
  id: string;
  title: string;
  body: string;
  type: BulletinType;
  severity: Severity;
  target: BulletinTarget;
  publishedAt: string;
  source?: string;
  pushState: "pushing" | "pushed";
  pushedAt?: string;
  archived?: boolean;
}

interface WeatherAdvisory {
  headline: string;
  body: string;
  severity: Severity;
  temp: number;
  wind: number;
  rainChance: number;
}

const JURISDICTION_ZONE_ID = PUROK_LEADER_JURISDICTION.zoneId;
const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

const RESIDENT_COUNTS: Record<string, number> = {
  "Purok 1": 185,
  "Purok 2": 210,
  "Purok 3": 165,
  "Purok 4": 195,
  "Purok 5": 230,
  "Purok 6": 145,
};
const BARANGAY_TOTAL = Object.values(RESIDENT_COUNTS).reduce((a, b) => a + b, 0);

const ZONE_TO_NAME: Record<string, string> = {
  p1: "Purok 1",
  p2: "Purok 2",
  p3: "Purok 3",
  p4: "Purok 4",
  p5: "Purok 5",
  p6: "Purok 6",
};

function residentsFor(purokId: string | null): number {
  if (purokId === null) return BARANGAY_TOTAL;
  return RESIDENT_COUNTS[ZONE_TO_NAME[purokId] ?? JURISDICTION_NAME] ?? 0;
}

const TYPE_META: Record<BulletinType, { icon: any; badge: string; desc: string; active: string }> = {
  "Safety Alert": {
    icon: ShieldAlert,
    badge: "bg-sky-100 text-sky-700",
    desc: "Security & safety updates",
    active: "border-sky-500 bg-sky-50 text-sky-700",
  },
  "Event Notice": {
    icon: PartyPopper,
    badge: "bg-amber-100 text-amber-700",
    desc: "Gatherings & scheduled events",
    active: "border-amber-500 bg-amber-50 text-amber-700",
  },
  "Weather Warning": {
    icon: CloudRain,
    badge: "bg-violet-100 text-violet-700",
    desc: "Weather advisories (API)",
    active: "border-violet-500 bg-violet-50 text-violet-700",
  },
};

const SEVERITY_META: Record<Severity, { label: string; badge: string; dot: string; desc: string; active: string }> = {
  info: { label: "Info", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", desc: "General update", active: "border-sky-500 bg-sky-50 text-sky-700" },
  warning: { label: "Warning", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", desc: "Heads-up", active: "border-amber-500 bg-amber-50 text-amber-700" },
  alert: { label: "Alert", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", desc: "Act now", active: "border-rose-500 bg-rose-50 text-rose-700" },
};

const INITIAL_BULLETINS: Bulletin[] = [
  {
    id: "BLT-1021",
    title: "Fiesta tonight — street mass & karaoke at the plaza",
    body: "The scheduled barangay fiesta celebration continues tonight. Street mass at 6:00 PM followed by karaoke at the plaza. Residents are welcome to join; expect moderate noise until 10:00 PM.",
    type: "Event Notice",
    severity: "info",
    target: { purokId: "p3", label: JURISDICTION_LABEL },
    publishedAt: "2026-07-20T08:30:00",
    pushState: "pushed",
    pushedAt: "2026-07-20T08:30:00",
  },
  {
    id: "BLT-1020",
    title: "Avoid riverside at night — loitering reports",
    body: "Several residents reported unknown individuals loitering along the riverside after dark. Patrol visibility is increased, but please avoid the area at night and report anything suspicious to the tanod.",
    type: "Safety Alert",
    severity: "alert",
    target: { purokId: "p3", label: JURISDICTION_LABEL },
    publishedAt: "2026-07-20T07:45:00",
    pushState: "pushed",
    pushedAt: "2026-07-20T07:45:00",
  },
  {
    id: "BLT-1019",
    title: "Heat index advisory — stay hydrated",
    body: "Afternoon heat index is expected to reach 40°C. Residents, especially seniors and children, are advised to stay hydrated, limit outdoor activity between 11:00 AM and 3:00 PM, and keep pets indoors.",
    type: "Weather Warning",
    severity: "warning",
    target: { purokId: null, label: "Entire Barangay" },
    publishedAt: "2026-07-19T11:00:00",
    source: "Weather API",
    pushState: "pushed",
    pushedAt: "2026-07-19T11:00:00",
  },
  {
    id: "BLT-1018",
    title: "Curb-side repair works along the main road",
    body: "DPWH curb-side repair works will run along the main road from 8:00 AM to 4:00 PM. Expect minor traffic delays; please follow flagmen directions.",
    type: "Safety Alert",
    severity: "info",
    target: { purokId: null, label: "Entire Barangay" },
    publishedAt: "2026-07-18T06:20:00",
    pushState: "pushed",
    pushedAt: "2026-07-18T06:20:00",
  },
];

function fetchWeatherAdvisory(): Promise<WeatherAdvisory> {
  return new Promise((resolve) => {
    window.setTimeout(
      () =>
        resolve({
          headline: "Moderate rain expected this afternoon",
          body: "Integrated weather feed (PAGASA): scattered thunderstorms expected 2:00 PM – 6:00 PM over District 6. Possible localized flooding in low-lying areas near the market. Secure loose items and avoid the riverside during peak hours.",
          severity: "warning",
          temp: 31,
          wind: 14,
          rainChance: 70,
        }),
      1200
    );
  });
}

export default function CommunityBulletinBoard() {
  const { flash, ToastPortal } = useToast();

  const [bulletins, setBulletins] = useState<Bulletin[]>(INITIAL_BULLETINS);
  const [bFilter, setBFilter] = useState<BulletinFilter>("all");

  const [type, setType] = useState<BulletinType>("Safety Alert");
  const [severity, setSeverity] = useState<Severity>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"purok" | "barangay">("purok");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherAdvisory | null>(null);

  const activeBulletins = bulletins.filter((b) => !b.archived);
  const pushedActive = activeBulletins.filter((b) => b.pushState === "pushed");
  const purokTargeted = activeBulletins.filter((b) => b.target.purokId !== null);
  const barangayWide = activeBulletins.filter((b) => b.target.purokId === null);

  const kpis = [
    { label: "PUBLISHED", value: activeBulletins.length, sub: "active announcements", icon: Megaphone },
    { label: "PUROK TARGETED", value: purokTargeted.length, sub: `reaching ${JURISDICTION_NAME} only`, icon: Home },
    { label: "BARANGAY-WIDE", value: barangayWide.length, sub: "null purok ID broadcasts", icon: Globe },
    { label: "PUSH DELIVERED", value: pushedActive.length, sub: "pushed to resident apps", icon: BellRing },
  ];

  const filterTabs: { key: BulletinFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: activeBulletins.length },
    { key: "Safety Alert", label: "Safety Alert", count: activeBulletins.filter((b) => b.type === "Safety Alert").length },
    { key: "Event Notice", label: "Event Notice", count: activeBulletins.filter((b) => b.type === "Event Notice").length },
    { key: "Weather Warning", label: "Weather Warning", count: activeBulletins.filter((b) => b.type === "Weather Warning").length },
    { key: "archived", label: "Archived", count: bulletins.filter((b) => b.archived).length },
  ];

  const filteredBulletins = useMemo(() => {
    if (bFilter === "archived") return bulletins.filter((b) => b.archived);
    if (bFilter === "all") return activeBulletins;
    return activeBulletins.filter((b) => b.type === bFilter);
  }, [bFilter, bulletins, activeBulletins]);

  function schedulePush(id: string) {
    window.setTimeout(() => {
      setBulletins((prev) =>
        prev.map((b) => (b.id === id ? { ...b, pushState: "pushed", pushedAt: new Date().toISOString() } : b))
      );
    }, 1400);
  }

  async function pullWeather() {
    setWeatherLoading(true);
    const data = await fetchWeatherAdvisory();
    setWeatherData(data);
    setType("Weather Warning");
    setTitle(data.headline);
    setBody(data.body);
    setSeverity(data.severity);
    setWeatherLoading(false);
    flash("Weather advisory auto-populated from the weather API");
  }

  function publish() {
    if (!title.trim()) {
      flash("Add a headline before publishing");
      return;
    }
    if (!body.trim()) {
      flash("Write a message before publishing");
      return;
    }
    const id = `BLT-${1024 + bulletins.length}`;
    const isBarangay = target === "barangay";
    const bulletin: Bulletin = {
      id,
      title: title.trim(),
      body: body.trim(),
      type,
      severity,
      target: {
        purokId: isBarangay ? null : JURISDICTION_ZONE_ID,
        label: isBarangay ? "Entire Barangay" : JURISDICTION_LABEL,
      },
      publishedAt: new Date().toISOString(),
      source: type === "Weather Warning" && weatherData ? "Weather API" : undefined,
      pushState: "pushing",
    };
    setBulletins((prev) => [bulletin, ...prev]);
    schedulePush(id);
    flash(`${id} published — push notification sending to resident apps`);
    setTitle("");
    setBody("");
    setWeatherData(null);
    setType("Safety Alert");
    setSeverity("info");
  }

  function rePush(id: string) {
    setBulletins((prev) => prev.map((b) => (b.id === id ? { ...b, pushState: "pushing" } : b)));
    schedulePush(id);
    flash(`${id} push notification re-sent`);
  }

  function archive(id: string) {
    setBulletins((prev) => prev.map((b) => (b.id === id ? { ...b, archived: true } : b)));
    flash(`${id} archived`);
  }

  function restore(id: string) {
    setBulletins((prev) => prev.map((b) => (b.id === id ? { ...b, archived: false } : b)));
    flash(`${id} restored`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Community Bulletin Board</h1>
              <p className="mt-1 text-sm text-stone-500">
                Compose, post, and manage local announcements for your purok or the whole barangay
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <Megaphone size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">ASSIGNED JURISDICTION</p>
                <p className="text-[12px] font-bold text-[#0038A8]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              Publish a bulletin targeted exclusively at <span className="font-semibold text-stone-800">{JURISDICTION_LABEL}</span> or broadcast to the entire barangay — barangay-wide broadcasts are stored with a <span className="font-mono text-[10px] font-semibold text-stone-800">null purok ID</span>. Successful publication triggers an automatic <span className="font-semibold text-stone-800">push notification</span> to the mobile apps of the targeted resident audience.
            </p>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
              <Megaphone size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Compose Bulletin</h3>
                <p className="text-[11px] text-[#94A3B8]">Publishes &amp; pushes to target residents</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Bulletin Type</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(Object.keys(TYPE_META) as BulletinType[]).map((t) => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    const selected = type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition ${
                          selected ? meta.active : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        <Icon size={15} className={selected ? "" : "text-stone-400"} />
                        <span className={`text-[11px] font-semibold ${selected ? "" : "text-stone-700"}`}>{t}</span>
                        <span className="text-[9px] leading-tight opacity-80">{meta.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Headline</p>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Avoid riverside tonight — suspicious loitering"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>

              {type === "Weather Warning" && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CloudSun size={14} className="text-violet-600" />
                      <p className="text-[11px] font-semibold text-violet-700">Weather API</p>
                      <span className="text-[9px] text-violet-400">third-party integrated feed</span>
                    </div>
                    <button
                      onClick={pullWeather}
                      disabled={weatherLoading}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition ${
                        weatherLoading
                          ? "border-violet-200 text-violet-400"
                          : "border-violet-300 bg-white text-violet-700 hover:bg-violet-100"
                      }`}
                    >
                      {weatherLoading ? <LoaderCircle size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      {weatherLoading ? "Fetching forecast..." : "Pull from API"}
                    </button>
                  </div>
                  {weatherData && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[9px] font-medium text-stone-600">
                          <Sun size={9} className="text-amber-500" /> {weatherData.temp}°C
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[9px] font-medium text-stone-600">
                          <Wind size={9} className="text-sky-500" /> {weatherData.wind} km/h
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[9px] font-medium text-stone-600">
                          <Droplets size={9} className="text-violet-500" /> {weatherData.rainChance}% rain
                        </span>
                      </div>
                      <p className="text-[10px] text-violet-500">
                        Auto-populated headline, message, and severity from the weather feed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Message</p>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Write the announcement content residents will read..."
                  className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Audience Targeting</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setTarget("purok")}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      target === "purok" ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <Home size={14} className="mt-0.5 text-[#0038A8]" />
                    <div>
                      <p className="text-[11px] font-medium text-stone-900">My Purok — {JURISDICTION_LABEL}</p>
                      <p className="text-[10px] text-stone-400">
                        Push to ~{RESIDENT_COUNTS[JURISDICTION_NAME]} registered residents · purok ID:{" "}
                        <span className="font-mono text-[9px]">{JURISDICTION_ZONE_ID}</span>
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setTarget("barangay")}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      target === "barangay" ? "border-[#0038A8] bg-[#0038A8]/5" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <Globe size={14} className="mt-0.5 text-[#0038A8]" />
                    <div>
                      <p className="text-[11px] font-medium text-stone-900">Entire Barangay</p>
                      <p className="text-[10px] text-stone-400">
                        Broadcast to ~{BARANGAY_TOTAL} registered residents · stored with{" "}
                        <span className="font-mono text-[9px]">null purok ID</span>
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Severity Level</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SEVERITY_META) as Severity[]).map((s) => {
                    const meta = SEVERITY_META[s];
                    const selected = severity === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 transition ${
                          selected ? meta.active : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                          <span className="text-[11px] font-semibold">{meta.label}</span>
                        </span>
                        <span className="text-[9px] opacity-80">{meta.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 px-5 py-4">
              <button
                onClick={publish}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Send size={13} />
                Publish &amp; Send Push
              </button>
              <p className="mt-1.5 text-center text-[10px] text-stone-400">
                Publishing triggers an automatic push to {target === "barangay" ? "all barangay" : JURISDICTION_NAME} resident apps
              </p>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Published Bulletins</h3>
                  <p className="text-[11px] text-[#94A3B8]">Announcements &amp; their push delivery status</p>
                </div>
              </div>
              <span className="rounded-full bg-[#0038A8]/5 px-2.5 py-1 text-[10px] font-semibold text-[#0038A8]">
                {activeBulletins.length} live
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-stone-100 px-5 py-3">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBFilter(t.key)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    bFilter === t.key
                      ? "border-[#0038A8] bg-[#0038A8] text-white"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 opacity-70">({t.count})</span>
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {filteredBulletins.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <BellRing size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No bulletins in this view</p>
                  <p className="text-[10px] text-stone-400">Compose and publish one from the form</p>
                </div>
              ) : (
                filteredBulletins.map((b) => {
                  const TypeIcon = TYPE_META[b.type].icon;
                  const sev = SEVERITY_META[b.severity];
                  const count = residentsFor(b.target.purokId);
                  return (
                    <div key={b.id} className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm ${b.archived ? "border-stone-200 opacity-60" : "border-stone-200"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{b.id}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${TYPE_META[b.type].badge}`}>
                            <TypeIcon size={9} />
                            {b.type}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                            {sev.label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              b.target.purokId === null ? "bg-stone-100 text-stone-600" : "bg-[#0038A8]/5 text-[#0038A8]"
                            }`}
                          >
                            {b.target.purokId === null ? <Globe size={9} /> : <MapPin size={9} />}
                            {b.target.label}
                          </span>
                          {b.archived && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-600">
                              <Archive size={9} />
                              Archived
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-stone-400">
                          <Clock size={10} />
                          {formatTime(b.publishedAt)}
                        </span>
                      </div>

                      <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{b.title}</h4>
                      <p className="mt-0.5 text-[11px] text-stone-500">{b.body}</p>

                      {b.source && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[9px] font-medium text-violet-600">
                            <CloudRain size={9} />
                            Populated via {b.source}
                          </span>
                        </div>
                      )}

                      <div
                        className={`mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                          b.pushState === "pushed" ? "border-emerald-200 bg-emerald-50/60" : "border-stone-200 bg-stone-50"
                        }`}
                      >
                        <p className="flex items-center gap-1.5 text-[10px] font-medium text-stone-600">
                          {b.pushState === "pushing" ? (
                            <>
                              <LoaderCircle size={11} className="animate-spin text-stone-400" />
                              Sending push to ~{count} resident apps...
                            </>
                          ) : (
                            <>
                              <BellRing size={11} className="text-emerald-600" />
                              Push delivered to ~{count} resident apps
                              {b.pushedAt ? ` · ${formatTime(b.pushedAt)}` : ""}
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {!b.archived && (
                            <button
                              onClick={() => rePush(b.id)}
                              disabled={b.pushState === "pushing"}
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"
                            >
                              <RefreshCw size={10} />
                              Re-send
                            </button>
                          )}
                          <button
                            onClick={() => (b.archived ? restore(b.id) : archive(b.id))}
                            className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                          >
                            {b.archived ? (
                              <>
                                <RotateCcw size={10} />
                                Restore
                              </>
                            ) : (
                              <>
                                <Archive size={10} />
                                Archive
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
