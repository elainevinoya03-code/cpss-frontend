import { useMemo, useState } from "react";
import {
  Megaphone,
  Bell,
  BellRing,
  Send,
  ShieldAlert,
  PartyPopper,
  CloudRain,
  LoaderCircle,
  Globe,
  Eye,
  Clock,
  Archive,
  Info,
  User,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { Modal } from "../components/ui";

type BulletinType = "Safety Alert" | "Event Notice" | "Weather Warning";
type Severity = "info" | "warning" | "alert";

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
  author: string;
  pushState: "pushing" | "pushed";
  pushedAt?: string;
  archived?: boolean;
}

const RESIDENT_COUNTS: Record<string, number> = {
  "Purok 1": 185,
  "Purok 2": 210,
  "Purok 3": 165,
  "Purok 4": 195,
  "Purok 5": 230,
  "Purok 6": 145,
};
const BARANGAY_TOTAL = Object.values(RESIDENT_COUNTS).reduce((a, b) => a + b, 0);

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
    desc: "Weather advisories",
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
    id: "BLT-2015",
    title: "Peace and Order Council meeting rescheduled",
    body: "This month's Barangay Peace and Order Council meeting is moved to Saturday at 9:00 AM, Barangay Hall. All Purok Leaders and committee members are requested to attend.",
    type: "Event Notice",
    severity: "info",
    target: { purokId: null, label: "Entire Barangay" },
    publishedAt: "2026-07-20T10:00:00",
    author: "Capt. Reyes",
    pushState: "pushed",
    pushedAt: "2026-07-20T10:00:00",
  },
  {
    id: "BLT-2014",
    title: "Curfew reminder â€” minors out after 10 PM",
    body: "Reminder that the barangay curfew for minors is 10:00 PM. Parents are urged to ensure children are home. Tanod units will enforce the curfew in all puroks.",
    type: "Safety Alert",
    severity: "warning",
    target: { purokId: null, label: "Entire Barangay" },
    publishedAt: "2026-07-19T20:30:00",
    author: "Capt. Reyes",
    pushState: "pushed",
    pushedAt: "2026-07-19T20:30:00",
  },
  {
    id: "BLT-2013",
    title: "Typhoon Signal No. 1 â€” keep prepared",
    body: "PAGASA raised Signal No. 1 over Metro Manila. Residents are advised to secure loose objects and prepare go-bags. Evacuation centers are on standby.",
    type: "Weather Warning",
    severity: "alert",
    target: { purokId: null, label: "Entire Barangay" },
    publishedAt: "2026-07-18T08:00:00",
    author: "Capt. Reyes",
    pushState: "pushed",
    pushedAt: "2026-07-18T08:00:00",
  },
  {
    id: "BLT-2012",
    title: "Road reblocking â€” avoid Purok 3 market access",
    body: "DPWH reblocking along the market access road starts Monday 8:00 AM. Market stall holders should use the alternate route via Purok 2 for the next three days.",
    type: "Safety Alert",
    severity: "info",
    target: { purokId: null, label: "Entire Barangay" },
    publishedAt: "2026-07-17T14:00:00",
    author: "Capt. Reyes",
    pushState: "pushed",
    pushedAt: "2026-07-17T14:00:00",
  },
];

export default function BulletinPublisher() {
  const { flash, ToastPortal } = useToast();

  const [bulletins, setBulletins] = useState<Bulletin[]>(INITIAL_BULLETINS);
  const [bFilter, setBFilter] = useState<"all" | "archived" | BulletinType>("all");

  const [type, setType] = useState<BulletinType>("Safety Alert");
  const [severity, setSeverity] = useState<Severity>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [viewTarget, setViewTarget] = useState<Bulletin | null>(null);

  const activeBulletins = bulletins.filter((b) => !b.archived);
  const barangayWide = activeBulletins.filter((b) => b.target.purokId === null);
  const pushedActive = activeBulletins.filter((b) => b.pushState === "pushed");

  const kpis = [
    { label: "PUBLISHED", value: activeBulletins.length, sub: "active announcements", icon: Megaphone },
    { label: "BARANGAY-WIDE", value: barangayWide.length, sub: "official barangay bulletins", icon: Globe },
    { label: "PUSH DELIVERED", value: pushedActive.length, sub: "pushed to resident apps", icon: BellRing },
  ];

  const filterTabs: { key: string; label: string; count: number }[] = [
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

  const residentTarget = BARANGAY_TOTAL;
  const targetLabel = "Entire Barangay";

  function schedulePush(id: string) {
    window.setTimeout(() => {
      setBulletins((prev) =>
        prev.map((b) => (b.id === id ? { ...b, pushState: "pushed", pushedAt: new Date().toISOString() } : b))
      );
    }, 1400);
  }

  function openReview() {
    if (!title.trim()) {
      flash("Add a headline before reviewing");
      return;
    }
    if (!body.trim()) {
      flash("Write a message before reviewing");
      return;
    }
    setShowReview(true);
  }

  function confirmPublish() {
    const id = `BLT-${2016 + bulletins.length}`;
    const bulletin: Bulletin = {
      id,
      title: title.trim(),
      body: body.trim(),
      type,
      severity,
      target: {
        purokId: null,
        label: targetLabel,
      },
      publishedAt: new Date().toISOString(),
      author: "Capt. Reyes",
      pushState: "pushing",
    };
    setBulletins((prev) => [bulletin, ...prev]);
    schedulePush(id);
    setShowReview(false);
    flash(`${id} published â€” push notification sending to resident apps`);
    setTitle("");
    setBody("");
    setType("Safety Alert");
    setSeverity("info");
  }

  function archive(id: string) {
    setBulletins((prev) => prev.map((b) => (b.id === id ? { ...b, archived: true } : b)));
    flash(`${id} archived`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">News &amp; Bulletin Publisher</h1>
              <p className="mt-1 text-sm text-stone-500">
                Compose and publish routine bulletins to the entire barangay
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <Megaphone size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">AUTHORITY</p>
                <p className="text-[12px] font-bold text-[#0038A8]">Barangay Captain</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              Official barangay-wide communication:{" "}
              <span className="font-semibold text-stone-800">Safety Alerts</span>,{" "}
              <span className="font-semibold text-stone-800">Event Notices</span>, or{" "}
              <span className="font-semibold text-stone-800">Weather Warnings</span> â€” distinct from the
              severity-graded Emergency Broadcast System. Successful publication triggers an automatic push
              notification to all resident apps. Purok-specific messaging is coordinated through the Desk
              Officer or the Purok Leader, not through bulletins.
            </p>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
              <Megaphone size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-stone-900">Compose Bulletin</h3>
                <p className="text-[11px] text-stone-400">Compose, review, then publish to all residents</p>
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
                  placeholder="e.g. Curfew reminder for all minors"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>

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
                <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Audience</p>
                <div className="flex w-full items-start gap-3 rounded-lg border border-[#0038A8] bg-[#0038A8]/5 px-3 py-2.5 text-left">
                  <Globe size={14} className="mt-0.5 text-[#0038A8]" />
                  <div className="flex-1">
                    <p className="text-[11px] font-medium text-stone-900">Entire Barangay</p>
                    <p className="text-[10px] text-stone-400">
                      Broadcast to ~{BARANGAY_TOTAL} registered residents. No purok targeting â€” for
                      purok-specific messages, coordinate with the Desk Officer or Purok Leader.
                    </p>
                  </div>
                  <CheckCircle2 size={14} className="mt-0.5 text-[#0038A8]" />
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
                onClick={openReview}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Send size={13} />
                Review &amp; Publish
              </button>
              <p className="mt-1.5 text-center text-[10px] text-stone-400">
                Push to ~{residentTarget} residents in {targetLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-stone-900">Published Bulletins</h3>
                  <p className="text-[11px] text-stone-400">Announcements &amp; their push delivery status</p>
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
                  onClick={() => setBFilter(t.key as any)}
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-600">
                            <Globe size={9} />
                            {b.target.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
                            <User size={9} />
                            {b.author}
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

                      <div
                        className={`mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                          b.pushState === "pushed" ? "border-emerald-200 bg-emerald-50/60" : "border-stone-200 bg-stone-50"
                        }`}
                      >
                        <p className="flex items-center gap-1.5 text-[10px] font-medium text-stone-600">
                          {b.pushState === "pushing" ? (
                            <>
                              <LoaderCircle size={11} className="animate-spin text-stone-400" />
                              Sending push to ~{BARANGAY_TOTAL} resident apps...
                            </>
                          ) : (
                            <>
                              <BellRing size={11} className="text-emerald-600" />
                              Push delivered to ~{BARANGAY_TOTAL} resident apps
                              {b.pushedAt ? ` Â· ${formatTime(b.pushedAt)}` : ""}
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setViewTarget(b)}
                            className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                          >
                            <Eye size={10} />
                            View
                          </button>
                          {!b.archived && (
                            <button
                              onClick={() => archive(b.id)}
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Archive size={10} />
                              Archive
                            </button>
                          )}
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

      {showReview && (
        <Modal
          onClose={() => setShowReview(false)}
          icon={<Megaphone size={16} />}
          iconClass="bg-[#0038A8]/10 text-[#0038A8]"
          title="Publish Barangay Bulletin"
          subtitle="Review the bulletin before publishing to the entire barangay"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReview(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublish}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Send size={12} />
                Publish
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">HEADLINE</p>
              <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] font-semibold text-stone-900">
                {title.trim()}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">MESSAGE</p>
              <p className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] leading-relaxed text-stone-700">
                {body.trim()}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">TYPE</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${TYPE_META[type].badge}`}>
                  {(() => {
                    const Icon = TYPE_META[type].icon;
                    return <Icon size={10} />;
                  })()}
                  {type}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">SEVERITY</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${SEVERITY_META[severity].badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[severity].dot}`} />
                  {SEVERITY_META[severity].label}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">AUDIENCE</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600">
                  <Globe size={10} />
                  {targetLabel}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {viewTarget && (
        <Modal
          onClose={() => setViewTarget(null)}
          icon={<Bell size={16} />}
          iconClass="bg-[#0038A8]/10 text-[#0038A8]"
          title={viewTarget.title}
          subtitle={`${viewTarget.id} Â· published ${formatTime(viewTarget.publishedAt)}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_META[viewTarget.type].badge}`}>
                {(() => {
                  const Icon = TYPE_META[viewTarget.type].icon;
                  return <Icon size={10} />;
                })()}
                {viewTarget.type}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_META[viewTarget.severity].badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[viewTarget.severity].dot}`} />
                {SEVERITY_META[viewTarget.severity].label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                <Globe size={10} />
                {viewTarget.target.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                <User size={10} />
                {viewTarget.author}
              </span>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-stone-400">MESSAGE</p>
              <p className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[12px] leading-relaxed text-stone-700">
                {viewTarget.body}
              </p>
            </div>

            <div
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
                viewTarget.pushState === "pushed" ? "border-emerald-200 bg-emerald-50/60" : "border-stone-200 bg-stone-50"
              }`}
            >
              {viewTarget.pushState === "pushing" ? (
                <>
                  <LoaderCircle size={11} className="animate-spin text-stone-400" />
                  <span className="text-[10px] font-medium text-stone-600">
                    Sending push to ~{BARANGAY_TOTAL} resident apps...
                  </span>
                </>
              ) : (
                <>
                  <BellRing size={11} className="text-emerald-600" />
                  <span className="text-[10px] font-medium text-stone-600">
                    Delivered to ~{BARANGAY_TOTAL} resident apps
                    {viewTarget.pushedAt ? ` Â· ${formatTime(viewTarget.pushedAt)}` : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
