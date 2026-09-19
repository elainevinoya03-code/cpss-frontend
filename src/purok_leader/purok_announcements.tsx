import { useMemo, useState } from "react";
import {
  Megaphone,
  Bell,
  ShieldAlert,
  PartyPopper,
  CloudRain,
  MapPin,
  Clock,
  CalendarClock,
  Pencil,
  EyeOff,
  Info,
  Send,
  Lock,
} from "lucide-react";
import { Modal } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";

type AnnouncementType = "Safety Alert" | "Event Notice" | "Weather Warning";
type Severity = "Information" | "Warning" | "Alert";
type AnnouncementStatus = "published" | "unpublished";
type ListFilter = "all" | "live" | "expired" | "unpublished";

interface Announcement {
  id: string;
  type: AnnouncementType;
  headline: string;
  message: string;
  severity: Severity;
  publishDate: string;
  expiryDate: string;
  status: AnnouncementStatus;
  updatedAt?: string;
}

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

const TYPE_META: Record<AnnouncementType, { icon: typeof ShieldAlert; badge: string; active: string }> = {
  "Safety Alert": {
    icon: ShieldAlert,
    badge: "bg-sky-100 text-sky-700",
    active: "border-sky-500 bg-sky-50 text-sky-700",
  },
  "Event Notice": {
    icon: PartyPopper,
    badge: "bg-amber-100 text-amber-700",
    active: "border-amber-500 bg-amber-50 text-amber-700",
  },
  "Weather Warning": {
    icon: CloudRain,
    badge: "bg-violet-100 text-violet-700",
    active: "border-violet-500 bg-violet-50 text-violet-700",
  },
};

const SEVERITY_META: Record<Severity, { label: string; badge: string; dot: string; active: string }> = {
  Information: { label: "Information", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", active: "border-sky-500 bg-sky-50 text-sky-700" },
  Warning: { label: "Warning", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", active: "border-amber-500 bg-amber-50 text-amber-700" },
  Alert: { label: "Alert", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", active: "border-rose-500 bg-rose-50 text-rose-700" },
};

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ANN-2403",
    type: "Event Notice",
    headline: "Fiesta tonight — street mass & karaoke at the plaza",
    message:
      "The scheduled barangay fiesta celebration continues tonight. Street mass at 6:00 PM followed by karaoke at the plaza. Expect moderate noise until the 10:00 PM cutoff.",
    severity: "Information",
    publishDate: "2026-07-20",
    expiryDate: "2026-07-21",
    status: "published",
  },
  {
    id: "ANN-2402",
    type: "Safety Alert",
    headline: "Avoid riverside path at night — loitering reports",
    message:
      "Several residents reported unknown individuals loitering along the riverside after dark. Please avoid the area at night and report anything suspicious to the barangay hall.",
    severity: "Alert",
    publishDate: "2026-07-19",
    expiryDate: "2026-07-26",
    status: "published",
  },
  {
    id: "ANN-2401",
    type: "Weather Warning",
    headline: "Heavy afternoon rains expected — secure belongings",
    message:
      "Scattered thunderstorms are expected between 2:00 PM and 6:00 PM. Possible localized flooding in low-lying areas near the market alley. Secure loose items outdoors.",
    severity: "Warning",
    publishDate: "2026-07-18",
    expiryDate: "2026-07-19",
    status: "published",
  },
];

function toDateInput(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isLive(a: Announcement): boolean {
  return a.status === "published" && a.expiryDate >= todayInput();
}

// ─── Compose / edit form ──────────────────────────────────────────────────────

interface FormState {
  type: AnnouncementType;
  headline: string;
  message: string;
  severity: Severity;
  publishDate: string;
  expiryDate: string;
}

function emptyForm(): FormState {
  return {
    type: "Safety Alert",
    headline: "",
    message: "",
    severity: "Information",
    publishDate: todayInput(),
    expiryDate: "",
  };
}

function AnnouncementForm({
  form,
  onChange,
  errors,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Announcement Type</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(TYPE_META) as AnnouncementType[]).map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const selected = form.type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ type: t })}
                className={`flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition ${
                  selected ? meta.active : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <Icon size={15} className={selected ? "" : "text-stone-400"} />
                <span className={`text-[11px] font-semibold ${selected ? "" : "text-stone-700"}`}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-stone-700">
          Headline <span className="text-rose-500">*</span>
        </p>
        <input
          type="text"
          value={form.headline}
          onChange={(e) => onChange({ headline: e.target.value })}
          placeholder="e.g. Avoid riverside tonight — suspicious loitering"
          className={`w-full rounded-lg border px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 ${
            errors.headline
              ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/30"
              : "border-stone-200 focus:border-[#15803D] focus:ring-[#15803D]/30"
          }`}
        />
        {errors.headline && <p className="mt-1 text-[10px] font-medium text-rose-600">{errors.headline}</p>}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-stone-700">
          Message <span className="text-rose-500">*</span>
        </p>
        <textarea
          value={form.message}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={4}
          placeholder="Write the announcement residents will read..."
          className={`w-full resize-none rounded-lg border px-3 py-2.5 text-[12px] text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-1 ${
            errors.message
              ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/30"
              : "border-stone-200 focus:border-[#15803D] focus:ring-[#15803D]/30"
          }`}
        />
        {errors.message && <p className="mt-1 text-[10px] font-medium text-rose-600">{errors.message}</p>}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Severity</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SEVERITY_META) as Severity[]).map((s) => {
            const meta = SEVERITY_META[s];
            const selected = form.severity === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ severity: s })}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 transition ${
                  selected ? meta.active : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <span className="text-[11px] font-semibold">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-stone-700">Publish Date</p>
          <input
            type="date"
            value={form.publishDate}
            onChange={(e) => onChange({ publishDate: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-900 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-stone-700">
            Expiry Date <span className="text-rose-500">*</span>
          </p>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => onChange({ expiryDate: e.target.value })}
            min={form.publishDate}
            className={`w-full rounded-lg border px-3 py-2 text-[12px] text-stone-900 focus:outline-none focus:ring-1 ${
              errors.expiryDate
                ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/30"
                : "border-stone-200 focus:border-[#15803D] focus:ring-[#15803D]/30"
            }`}
          />
          {errors.expiryDate && <p className="mt-1 text-[10px] font-medium text-rose-600">{errors.expiryDate}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
        <Lock size={13} className="shrink-0 text-stone-400" />
        <p className="text-[10px] leading-snug text-stone-500">
          Audience is locked to your assigned purok — <span className="font-semibold text-stone-700">{JURISDICTION_LABEL}</span>. Barangay-wide publishing is not available to Purok Leaders.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurokAnnouncements() {
  const { flash, ToastPortal } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const live = announcements.filter(isLive);
  const expired = announcements.filter((a) => a.status === "published" && !isLive(a));
  const unpublished = announcements.filter((a) => a.status === "unpublished");

  const filteredList = useMemo(() => {
    switch (listFilter) {
      case "live":
        return live;
      case "expired":
        return expired;
      case "unpublished":
        return unpublished;
      default:
        return announcements;
    }
  }, [listFilter, announcements, live, expired, unpublished]);

  const filterTabs: { key: ListFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: announcements.length },
    { key: "live", label: "Live", count: live.length },
    { key: "expired", label: "Expired", count: expired.length },
    { key: "unpublished", label: "Unpublished", count: unpublished.length },
  ];

  function validate(f: FormState): boolean {
    const next: Record<string, string> = {};
    if (!f.headline.trim()) next.headline = "Add a headline before publishing.";
    if (!f.message.trim()) next.message = "Write a message before publishing.";
    if (!f.expiryDate) next.expiryDate = "Set an expiry date.";
    else if (f.expiryDate < f.publishDate) next.expiryDate = "Expiry must be on or after the publish date.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function openCompose() {
    setForm(emptyForm());
    setEditingId(null);
    setErrors({});
    setComposeOpen(true);
  }

  function openEdit(a: Announcement) {
    setForm({
      type: a.type,
      headline: a.headline,
      message: a.message,
      severity: a.severity,
      publishDate: toDateInput(a.publishDate),
      expiryDate: toDateInput(a.expiryDate),
    });
    setEditingId(a.id);
    setErrors({});
    setComposeOpen(true);
  }

  function submit() {
    if (!validate(form)) return;
    if (editingId) {
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                ...form,
                headline: form.headline.trim(),
                message: form.message.trim(),
                updatedAt: new Date().toISOString(),
              }
            : a
        )
      );
      flash(`${editingId} updated — still visible to ${JURISDICTION_NAME} until expiry`);
    } else {
      const id = `ANN-${2404 + announcements.length}`;
      setAnnouncements((prev) => [
        {
          id,
          type: form.type,
          headline: form.headline.trim(),
          message: form.message.trim(),
          severity: form.severity,
          publishDate: form.publishDate,
          expiryDate: form.expiryDate,
          status: "published",
        },
        ...prev,
      ]);
      flash(`${id} published to ${JURISDICTION_NAME} residents`);
    }
    setComposeOpen(false);
  }

  function expireNow(id: string) {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, expiryDate: todayInput(), updatedAt: new Date().toISOString() } : a))
    );
    flash(`${id} expired — no longer shown to residents`);
  }

  function unpublish(id: string) {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "unpublished", updatedAt: new Date().toISOString() } : a))
    );
    flash(`${id} unpublished`);
  }

  const editingExisting = editingId ? announcements.find((a) => a.id === editingId) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Purok Announcements</h1>
              <p className="mt-1 text-sm text-stone-500">Publish local announcements for your assigned purok only</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#15803D]/20 bg-white px-3.5 py-2 shadow-sm">
              <MapPin size={15} className="text-[#15803D]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">AUDIENCE (LOCKED)</p>
                <p className="text-[12px] font-bold text-[#15803D]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#15803D]/15 bg-[#15803D]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#15803D]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              Every announcement you publish is addressed exclusively to <span className="font-semibold text-stone-800">{JURISDICTION_LABEL}</span>. You can <span className="font-semibold text-stone-800">edit an announcement any time before its expiry date</span>, then unpublish or let it expire.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Compose panel */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
              <Megaphone size={16} className="text-[#15803D]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">New Announcement</h3>
                <p className="text-[11px] text-[#94A3B8]">Delivered to {JURISDICTION_NAME} residents only</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex-1 px-5 py-4">
                <button
                  onClick={openCompose}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534]"
                >
                  <Send size={13} />
                  Compose Announcement
                </button>
                <ul className="mt-4 space-y-2.5">
                  {[
                    { icon: ShieldAlert, text: "Types: Safety Alert, Event Notice, Weather Warning" },
                    { icon: CalendarClock, text: "Set a publish date and an expiry date" },
                    { icon: Pencil, text: "Edit freely until the expiry date passes" },
                    { icon: EyeOff, text: "Unpublish or expire early at any time" },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-2 text-[11px] leading-snug text-stone-500">
                      <Icon size={12} className="mt-0.5 shrink-0 text-stone-300" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Published list */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#15803D]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Published Announcements</h3>
                  <p className="text-[11px] text-[#94A3B8]">Visible only to {JURISDICTION_NAME} residents</p>
                </div>
              </div>
              <span className="rounded-full bg-[#15803D]/5 px-2.5 py-1 text-[10px] font-semibold text-[#15803D]">
                {live.length} live
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-stone-100 px-5 py-3">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setListFilter(t.key)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    listFilter === t.key
                      ? "border-[#15803D] bg-[#15803D] text-white"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 opacity-70">({t.count})</span>
                </button>
              ))}
            </div>

            <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
              {filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <Megaphone size={22} className="mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">No announcements in this view</p>
                  <p className="text-[10px] text-stone-400">Compose one to reach your purok</p>
                </div>
              ) : (
                filteredList.map((a) => {
                  const TypeIcon = TYPE_META[a.type].icon;
                  const sev = SEVERITY_META[a.severity];
                  const liveNow = isLive(a);
                  const isExpired = a.status === "published" && !liveNow;
                  return (
                    <div key={a.id} className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm ${(isExpired || a.status === "unpublished") ? "border-stone-200 opacity-75" : "border-stone-200"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">{a.id}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${TYPE_META[a.type].badge}`}>
                            <TypeIcon size={9} />
                            {a.type}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                            {sev.label}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              liveNow
                                ? "bg-emerald-100 text-emerald-700"
                                : a.status === "unpublished"
                                  ? "bg-stone-200 text-stone-600"
                                  : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {liveNow ? "Live" : a.status === "unpublished" ? "Unpublished" : "Expired"}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-stone-400">
                          <Clock size={10} />
                          Published {formatTime(`${a.publishDate}T08:00:00`)}
                        </span>
                      </div>

                      <h4 className="mt-2 text-[13px] font-semibold text-stone-900">{a.headline}</h4>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">{a.message}</p>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[10px] text-stone-500">
                          <CalendarClock size={11} className="text-stone-400" />
                          Runs {toDateInput(a.publishDate)} → expires {toDateInput(a.expiryDate)}
                          <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#15803D]">
                            <MapPin size={8} />
                            {JURISDICTION_NAME} only
                          </span>
                          {a.updatedAt && <span className="text-stone-400">· edited {formatTime(a.updatedAt)}</span>}
                        </p>
                        {liveNow && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEdit(a)}
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              onClick={() => expireNow(a.id)}
                              className="flex h-7 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <CalendarClock size={10} />
                              Expire Now
                            </button>
                            <button
                              onClick={() => unpublish(a.id)}
                              className="flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 text-[10px] font-medium text-rose-600 transition hover:bg-rose-50"
                            >
                              <EyeOff size={10} />
                              Unpublish
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {composeOpen && (
        <Modal
          onClose={() => setComposeOpen(false)}
          title={editingId ? `Edit Announcement — ${editingId}` : "New Announcement"}
          subtitle={
            editingExisting
              ? `Editable until ${toDateInput(editingExisting.expiryDate)} · audience locked to ${JURISDICTION_LABEL}`
              : `Audience locked to ${JURISDICTION_LABEL}`
          }
          icon={<Megaphone size={15} />}
          iconClass="bg-[#15803D]/5 text-[#15803D]"
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setComposeOpen(false)} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100">
                Cancel
              </button>
              <button
                onClick={submit}
                className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#166534]"
              >
                <Send size={12} />
                {editingId ? "Save Changes" : "Publish"}
              </button>
            </div>
          }
        >
          <div className="mt-4">
            <AnnouncementForm form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} errors={errors} />
          </div>
        </Modal>
      )}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
