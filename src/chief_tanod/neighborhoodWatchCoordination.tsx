import { useState, useMemo } from "react";
import {
  Eye,
  Users,
  Megaphone,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  BellRing,
  Plus,
  AlertTriangle,
  Shield,
  MessageSquare,
} from "lucide-react";
import {
  getSafetyNotices,
  subscribeSafetyNotices,
  type SafetyNotice,
} from "../utils/safetyNoticeStore";
import { PUROK_ZONES } from "../constants/purok";

const NOTICE_CATEGORIES = ["Safety Alert", "Event Notice", "General Advisory", "Emergency"];

export default function NeighborhoodWatchCoordination({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [notices, setNotices] = useState<SafetyNotice[]>(() => getSafetyNotices());
  const [showCompose, setShowCompose] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("Safety Alert");
  const [newTarget, setNewTarget] = useState<"barangay" | "purok">("barangay");
  const [newPurok, setNewPurok] = useState("Purok 1");

  const publishedNotices = useMemo(
    () => notices.filter((n) => n.state === "published"),
    [notices]
  );

  const watchAlerts = useMemo(
    () =>
      publishedNotices.filter(
        (n) =>
          n.category === "Safety Alert" &&
          (n.audience?.includes("neighborhood_watch") || n.audience?.includes("all"))
      ),
    [publishedNotices]
  );

  const activeVolunteers = 14;
  const totalActivations = watchAlerts.length;

  function handlePublish() {
    if (!newTitle.trim() || !newMessage.trim()) return;
    setShowCompose(false);
    setNewTitle("");
    setNewMessage("");
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Neighborhood Watch Coordination</h1>
              <p className="mt-1 text-sm text-stone-500">Manage vigilance notices, volunteer alerts & zone coverage</p>
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#115e59]"
            >
              <Send size={13} /> Issue Notice
            </button>
          </div>
        </header>

        {/* KPI */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">ACTIVE VOLUNTEERS</span>
              <Users size={14} className="text-[#0f766e]" />
            </div>
            <div className="mt-1 text-[22px] font-bold text-[#0f766e]">{activeVolunteers}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">WATCH ALERTS</span>
              <BellRing size={14} className="text-amber-500" />
            </div>
            <div className="mt-1 text-[22px] font-bold text-amber-600">{totalActivations}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">PUBLISHED NOTICES</span>
              <Megaphone size={14} className="text-[#15803D]" />
            </div>
            <div className="mt-1 text-[22px] font-bold text-[#15803D]">{publishedNotices.length}</div>
          </div>
          <div className="rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">ZONES COVERED</span>
              <Shield size={14} className="text-[#0f766e]" />
            </div>
            <div className="mt-1 text-[22px] font-bold text-[#0f766e]">{PUROK_ZONES.length}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Recent notices */}
          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[#334155]">Recent Notices</h3>
            </div>
            <div className="divide-y divide-black/5">
              {publishedNotices.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <Megaphone size={32} className="mx-auto text-stone-300" />
                  <p className="mt-3 text-[13px] text-stone-400">No notices published yet</p>
                </div>
              ) : (
                publishedNotices.slice(0, 8).map((notice) => (
                  <div key={notice.id} className="px-5 py-3.5 transition hover:bg-stone-50/50">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        notice.category === "Safety Alert" ? "bg-rose-100 text-rose-600" : "bg-[#15803D]/10 text-[#15803D]"
                      }`}>
                        {notice.category === "Safety Alert" ? <AlertTriangle size={14} /> : <Megaphone size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-[13px] font-semibold text-stone-800">{notice.title}</span>
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-medium text-stone-500">{notice.category}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{notice.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-[9px] text-[#94A3B8]">
                          <Clock size={8} /> {new Date(notice.publishedAt ?? notice.createdAt).toLocaleDateString()}
                          <span>·</span>
                          <span>{notice.audience?.includes("all") ? "Barangay-wide" : "Targeted"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Volunteer zone status */}
          <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-[14px] font-semibold text-[#334155]">Zone Volunteer Status</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {PUROK_ZONES.map((zone, idx) => {
                  const active = idx < 3;
                  return (
                    <div key={zone.id} className={`rounded-lg border px-3.5 py-3 ${active ? "border-[#0f766e]/30 bg-[#f0fdfa]/60" : "border-stone-200 bg-stone-50"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-stone-800">{zone.name}</span>
                        <div className="flex items-center gap-1.5">
                          <Users size={10} className={active ? "text-[#0f766e]" : "text-stone-400"} />
                          <span className={`text-[10px] font-medium ${active ? "text-[#0f766e]" : "text-stone-400"}`}>
                            {active ? `${2 + idx} volunteers` : "No volunteers"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Compose modal */}
        {showCompose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCompose(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[16px] font-bold text-stone-900">Issue Zone Notice</h3>
              <p className="mt-0.5 text-[11px] text-[#64748B]">Send a vigilance notice to Neighborhood Watch volunteers</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setNewTarget("barangay")} className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${newTarget === "barangay" ? "border-[#15803D]/40 bg-[#DCFCE7] text-[#15803D]" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
                      Entire Barangay
                    </button>
                    <button onClick={() => setNewTarget("purok")} className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${newTarget === "purok" ? "border-[#15803D]/40 bg-[#DCFCE7] text-[#15803D]" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
                      Specific Purok
                    </button>
                  </div>
                  {newTarget === "purok" && (
                    <select value={newPurok} onChange={(e) => setNewPurok(e.target.value)} className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none focus:border-[#15803D]/50">
                      {PUROK_ZONES.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium tracking-wider text-[#94A3B8]">CATEGORY</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none focus:border-[#15803D]/50">
                    {NOTICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium tracking-wider text-[#94A3B8]">TITLE</label>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Zone awareness notice" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none focus:border-[#15803D]/50" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium tracking-wider text-[#94A3B8]">MESSAGE</label>
                  <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={3} placeholder="Instruct volunteers to observe and report..." className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none focus:border-[#15803D]/50" />
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                <button onClick={() => setShowCompose(false)} className="flex-1 rounded-lg border border-stone-200 px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50">
                  Cancel
                </button>
                <button onClick={handlePublish} disabled={!newTitle.trim() || !newMessage.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#115e59] disabled:opacity-40">
                  <Send size={13} /> Publish Notice
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
