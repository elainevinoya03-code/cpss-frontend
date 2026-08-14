import { useState, useRef, useEffect } from "react";
import {
  Send,
  Radio,
  MapPin,
  Clock,
  Users,
  Search,
  BellRing,
  CheckCheck,
  UserCheck,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";

type ContactGroup = "tanod" | "leader";

interface Contact {
  id: string;
  name: string;
  group: ContactGroup;
  role: string;
  status: "online" | "away" | "offline";
  channel: string;
  unread: number;
  initials: string;
  lastSeen: string;
}

interface Msg {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
}

const CONTACTS: Contact[] = [
  { id: "t1", name: "Team Alpha", group: "tanod", role: "Tanod Unit · Responding to DISP-104", status: "online", channel: "Mobile App", unread: 2, initials: "TA", lastSeen: "now" },
  { id: "t2", name: "Team Bravo", group: "tanod", role: "Tanod Unit · On-Scene DISP-105", status: "online", channel: "Mobile App", unread: 0, initials: "TB", lastSeen: "2m ago" },
  { id: "t3", name: "Team Charlie", group: "tanod", role: "Tanod Unit · Patrolling R1", status: "away", channel: "Mobile App", unread: 1, initials: "TC", lastSeen: "11m ago" },
  { id: "l1", name: "Purok 3 Leader", group: "leader", role: "Purok Leader · Web Portal", status: "online", channel: "Web Portal", unread: 1, initials: "P3", lastSeen: "now" },
  { id: "l2", name: "Purok 5 Leader", group: "leader", role: "Purok Leader · Web Portal", status: "online", channel: "Web Portal", unread: 0, initials: "P5", lastSeen: "4m ago" },
  { id: "l3", name: "Purok 6 Leader", group: "leader", role: "Purok Leader · Web Portal", status: "offline", channel: "Web Portal", unread: 0, initials: "P6", lastSeen: "1h ago" },
];

const INITIAL_MESSAGES: Record<string, Msg[]> = {
  t1: [
    { id: "m1", from: "them", text: "On scene at INC-2068, smoke verified, crowd controlled.", time: "2026-07-20T10:03:00" },
    { id: "m2", from: "me", text: "Copy that. Keep us updated with photo evidence.", time: "2026-07-20T10:04:00" },
    { id: "m3", from: "them", text: "Photo uploaded to the evidence stream. Awaiting next instructions.", time: "2026-07-20T10:06:00" },
    { id: "m4", from: "them", text: "Status: scene stabilized, perimeter maintained until cleanup done.", time: "2026-07-20T10:09:00" },
  ],
  t2: [
    { id: "m1", from: "them", text: "Responding to INC-2070 noise call, ETA 3 minutes.", time: "2026-07-20T10:10:00" },
    { id: "m2", from: "me", text: "Acknowledged. Confirm decibel readings once on site.", time: "2026-07-20T10:11:00" },
  ],
  t3: [
    { id: "m1", from: "them", text: "Patrol sweep R1 complete — checkpoint 2 of 3 cleared.", time: "2026-07-20T09:40:00" },
    { id: "m2", from: "me", text: "Good. Move to checkpoint 3 and report anomalies.", time: "2026-07-20T09:41:00" },
  ],
  l1: [
    { id: "m1", from: "them", text: "Requesting clarification on INC-2066 — chapel area reports.", time: "2026-07-20T09:50:00" },
    { id: "m2", from: "me", text: "Can you verify local context on the suspicious activity report?", time: "2026-07-20T09:52:00" },
  ],
  l2: [
    { id: "m1", from: "them", text: "Purok 5 evening patrol coverage confirmed for tonight.", time: "2026-07-20T09:20:00" },
  ],
  l3: [],
};

const UNIT_CONTACT: Record<string, string> = { "Team Alpha": "t1", "Team Bravo": "t2", "Team Charlie": "t3" };
const PUROK_LEADER_CONTACT: Record<string, string> = { "Purok 3": "l1", "Purok 5": "l2", "Purok 6": "l3" };

const ACTIVE_DISPATCHES = [
  { id: "DISP-104", unit: "Team Alpha", type: "Fire/Smoke", purok: "Purok 5", status: "Responding", eta: "2 min" },
  { id: "DISP-105", unit: "Team Bravo", type: "Noise Disturbance", purok: "Purok 2", status: "On-Scene", eta: "Arrived" },
  { id: "DISP-106", unit: "Team Charlie", type: "IoT Alert", purok: "Purok 6", status: "En Route", eta: "5 min" },
];

const IOT_ALERTS = [
  { id: "SN-103", name: "MQ-2 Smoke Sensor", purok: "Purok 5", reading: "High", risk: "warning" },
  { id: "SN-107", name: "KY-037 Noise Sensor", purok: "Purok 6", reading: "Elevated", risk: "warning" },
];

const RESIDENT_REPORTS = [
  { id: "INC-2066", purok: "Purok 3", reporter: "Maria Santos", topic: "Suspicious activity near chapel" },
  { id: "INC-2069", purok: "Purok 5", reporter: "Ben Torres", topic: "Stray dogs causing disturbance" },
];

const DISPATCH_STATUS_STYLE: Record<string, string> = {
  Responding: "bg-sky-50 text-sky-700",
  "On-Scene": "bg-emerald-50 text-emerald-700",
  "En Route": "bg-amber-50 text-amber-700",
};

function groupLabel(g: ContactGroup) {
  return g === "tanod" ? "Field Units · Mobile App" : "Purok Leaders · Web Portal";
}

function statusDot(s: Contact["status"]) {
  if (s === "online") return "bg-emerald-500";
  if (s === "away") return "bg-amber-400";
  return "bg-stone-300";
}

function autoReply(group: ContactGroup, sent: string): string {
  const t = sent.toLowerCase();
  if (t.includes("status")) {
    return group === "tanod"
      ? "Status: on-site, situation under control. Full log synced to the dispatch tracker."
      : "Status check: purok conditions normal, no anomalies observed on my end.";
  }
  if (t.includes("eta") || t.includes("arrival")) return "Confirmed ETA: ~3 minutes, traffic is light on the route.";
  if (t.includes("photo") || t.includes("evidence")) return "Photo evidence uploaded to the dispatch evidence stream now.";
  if (t.includes("verify") || t.includes("context")) return "Confirmed. I verified the local context and noted the details against the report.";
  if (t.includes("reading") || t.includes("sensor")) return "Readings confirmed stable. I'll flag the moment anything shifts.";
  if (group === "leader") return "Noted, Desk Officer. I'll follow up on the ground and update you shortly.";
  return "Copy that, Desk Officer. Standing by — will report back shortly.";
}

const INCOMING_POOL: { from: string; text: string }[] = [
  { from: "t1", text: "Site cleared. Standing down, returning to base." },
  { from: "t3", text: "Checkpoint 3 cleared — no anomalies on R1." },
  { from: "l1", text: "Verified: INC-2066 context confirmed, no escalation needed." },
  { from: "l2", text: "Stray dogs rounded up by residents; situation calm now." },
  { from: "t2", text: "Decibel reading normalizing, residents notified." },
];

export default function OperationsChatCenter() {
  const { flash, ToastPortal } = useToast();

  const [contacts, setContacts] = useState<Contact[]>(CONTACTS);
  const [messages, setMessages] = useState<Record<string, Msg[]>>(INITIAL_MESSAGES);
  const [activeId, setActiveId] = useState("t1");
  const [chatInput, setChatInput] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(activeId);
  const replyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  activeRef.current = activeId;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const pick = INCOMING_POOL[Math.floor(Math.random() * INCOMING_POOL.length)];
      setMessages((prev) => {
        const thread = prev[pick.from] ?? [];
        const last = thread[thread.length - 1];
        if (last && Date.now() - new Date(last.time).getTime() < 9000) return prev;
        const now = new Date().toISOString();
        const next = {
          ...prev,
          [pick.from]: [...thread, { id: `i${Date.now()}`, from: "them" as const, text: pick.text, time: now }],
        };
        const isActive = activeRef.current === pick.from;
        if (!isActive) {
          setContacts((cs) => cs.map((c) => (c.id === pick.from ? { ...c, unread: c.unread + 1 } : c)));
        }
        return next;
      });
    }, 14000);

    return () => {
      clearInterval(interval);
      replyTimers.current.forEach(clearTimeout);
    };
  }, []);

  function selectContact(id: string) {
    setActiveId(id);
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function sendText(text: string, targetId?: string) {
    const body = text.trim();
    if (!body) return;
    const now = new Date().toISOString();
    const id = targetId ?? activeRef.current;
    setMessages((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), { id: `m${Date.now()}`, from: "me", text: body, time: now }],
    }));
    flash("Message sent");
    const contact = contacts.find((c) => c.id === id);
    const reply = autoReply(contact?.group ?? "tanod", body);
    const timer = setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [id]: [...(prev[id] ?? []), { id: `m${Date.now()}r`, from: "them", text: reply, time: new Date().toISOString() }],
      }));
    }, 1800 + Math.random() * 900);
    replyTimers.current.push(timer);
  }

  function sendTo(id: string, text: string) {
    selectContact(id);
    setTimeout(() => sendText(text, id), 40);
  }

  const active = contacts.find((c) => c.id === activeId) ?? contacts[0];
  const activeMsgs = messages[activeId] ?? [];

  const tanods = contacts.filter((c) => c.group === "tanod");
  const leaders = contacts.filter((c) => c.group === "leader");
  const onlineTanods = tanods.filter((c) => c.status === "online").length;
  const onlineLeaders = leaders.filter((c) => c.status === "online").length;
  const totalUnread = contacts.reduce((a, c) => a + c.unread, 0);

  const filteredTanods = tanods.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredLeaders = leaders.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const quickPrompts = active.group === "tanod"
    ? [
        { label: "Status update", text: "Please provide a quick status update on the operation." },
        { label: "Confirm ETA", text: "Confirm your estimated time of arrival." },
        { label: "Send evidence", text: "Upload current photo evidence from the scene." },
        { label: "Check readings", text: "Confirm the current sensor readings at the location." },
        { label: "Acknowledge", text: "Acknowledge this message with a confirm." },
      ]
    : [
        { label: "Verify context", text: "Can you verify local context on the resident report in your purok?" },
        { label: "Status update", text: "Provide a quick status update on conditions in your purok." },
        { label: "Check coverage", text: "Confirm patrol coverage tonight in your purok." },
        { label: "Acknowledge", text: "Acknowledge this message with a confirm." },
      ];

  function renderContactRow(c: Contact) {
    return (
      <button
        key={c.id}
        onClick={() => selectContact(c.id)}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
          activeId === c.id ? "border-[#0038A8]/30 bg-[#0038A8]/5" : "border-transparent hover:bg-stone-50"
        }`}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
          {c.initials}
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${statusDot(c.status)}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-1">
            <span className="truncate text-[12px] font-semibold text-stone-900">{c.name}</span>
            {c.unread > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {c.unread}
              </span>
            )}
          </span>
          <span className="block truncate text-[10px] text-stone-400">{c.role}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[9px] text-stone-300">
            <span className={c.status === "online" ? "text-emerald-500" : "text-stone-400"}>{c.status === "online" ? "Online" : c.status === "away" ? "Away" : "Offline"}</span>
            <span>&middot;</span>
            <span>{c.lastSeen}</span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-4 sm:px-6">
        <header className="mb-4 shrink-0 border-b border-stone-200 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Operations Chat Center</h1>
              <p className="mt-1 text-sm text-stone-500">
                Direct messaging with field Tanods &amp; Purok Leaders for real-time status clarifications
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-stone-600">
                <Radio size={11} className="text-emerald-500" />
                {onlineTanods}/{tanods.length} Tanods online
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-stone-600">
                <Users size={11} className="text-[#0038A8]" />
                {onlineLeaders}/{leaders.length} Leaders online
              </span>
              {totalUnread > 0 && (
                <span className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-600">
                  <BellRing size={11} />
                  {totalUnread} unread
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-4 pb-4">
          <aside className="hidden w-[248px] shrink-0 flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm md:flex">
            <div className="border-b border-stone-100 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-800">Direct Messaging</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
                  {contacts.filter((c) => c.status === "online").length} online
                </span>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-7 pr-2.5 text-[11px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
              <p className="mb-1 px-1.5 text-[9px] font-bold tracking-widest text-[#94A3B8]">{groupLabel("tanod")}</p>
              {filteredTanods.map(renderContactRow)}
              <p className="mb-1 mt-3 px-1.5 text-[9px] font-bold tracking-widest text-[#94A3B8]">{groupLabel("leader")}</p>
              {filteredLeaders.map(renderContactRow)}
              {filteredTanods.length + filteredLeaders.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px] text-stone-400">No contacts match "{search}"</p>
              )}
            </div>
            <div className="border-t border-stone-100 px-4 py-2.5 text-[9px] text-stone-400">
              Tanods reachable via mobile app &middot; Leaders via web portal
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0038A8] text-[10px] font-bold text-white">
                  {active.initials}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${statusDot(active.status)}`} />
                </span>
                <div>
                  <p className="text-[13px] font-bold text-stone-900">{active.name}</p>
                  <p className="flex items-center gap-1 text-[10px] text-stone-400">
                    <span className={active.status === "online" ? "text-emerald-500" : "text-stone-400"}>{active.status === "online" ? "Online" : active.status === "away" ? "Away" : "Offline"}</span>
                    <span>&middot;</span>
                    {active.channel}
                    <span>&middot;</span>
                    {active.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-8 items-center gap-1 rounded-lg border border-stone-200 px-2 text-[10px] font-medium text-stone-500">
                  <CheckCheck size={12} className="text-emerald-500" />
                  Delivered
                </span>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {activeMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      m.from === "me" ? "bg-[#0038A8] text-white" : "border border-stone-200 bg-stone-50 text-stone-800"
                    }`}
                  >
                    <p className="text-[12px] leading-snug">{m.text}</p>
                    <p className={`mt-1 text-[9px] ${m.from === "me" ? "text-white/60" : "text-stone-400"}`}>{formatTime(m.time)}</p>
                  </div>
                </div>
              ))}
              {activeMsgs.length === 0 && (
                <p className="py-10 text-center text-[11px] text-stone-400">No messages yet — ask for a quick status clarification.</p>
              )}
            </div>

            <div className="shrink-0 border-t border-stone-100 px-4 py-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickPrompts.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => sendText(q.text)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:border-[#0038A8]/30 hover:bg-[#0038A8]/5 hover:text-[#0038A8]"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendText(chatInput)}
                  placeholder={`Message ${active.name}...`}
                  className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
                <button
                  onClick={() => sendText(chatInput)}
                  disabled={!chatInput.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0038A8] text-white transition hover:bg-[#002A8C] disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </section>

          <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto pb-4 xl:flex">
            <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Radio size={14} className="text-[#0038A8]" />
                  <span className="text-[11px] font-bold text-stone-800">Active Dispatch Progress</span>
                </div>
                <span className="rounded-full bg-[#0038A8]/5 px-2 py-0.5 text-[9px] font-semibold text-[#0038A8]">{ACTIVE_DISPATCHES.length}</span>
              </div>
              <div className="space-y-2 px-3 py-3">
                {ACTIVE_DISPATCHES.map((d) => (
                  <div key={d.id} className="rounded-lg border border-stone-200 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-900">{d.id}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${DISPATCH_STATUS_STYLE[d.status]}`}>{d.status}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-stone-500">{d.type} · {d.purok} · {d.unit}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[9px] text-stone-400">
                        <Clock size={9} />
                        ETA {d.eta}
                      </span>
                      <button
                        onClick={() => sendTo(UNIT_CONTACT[d.unit], `Please provide a quick status update on ${d.id}.`)}
                        className="rounded-md bg-[#0038A8]/5 px-2 py-1 text-[9px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                      >
                        Ask Status
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BellRing size={14} className="text-[#0038A8]" />
                  <span className="text-[11px] font-bold text-stone-800">IoT Alert Coordination</span>
                </div>
              </div>
              <div className="space-y-2 px-3 py-3">
                {IOT_ALERTS.map((a) => (
                  <div key={a.id} className="rounded-lg border border-stone-200 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-stone-900">{a.name}</span>
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">{a.reading}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-stone-500">{a.id} · {a.purok}</p>
                    <button
                      onClick={() => sendTo(UNIT_CONTACT[a.purok === "Purok 6" ? "Team Charlie" : "Team Alpha"], `Request on-site reading confirmation for ${a.id} (${a.purok}).`)}
                      className="mt-1.5 w-full rounded-md bg-[#0038A8]/5 px-2 py-1.5 text-[9px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                    >
                      Request On-Site Reading
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserCheck size={14} className="text-[#0038A8]" />
                  <span className="text-[11px] font-bold text-stone-800">Resident Report Verification</span>
                </div>
              </div>
              <div className="space-y-2 px-3 py-3">
                {RESIDENT_REPORTS.map((r) => (
                  <div key={r.id} className="rounded-lg border border-stone-200 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-900">{r.id}</span>
                      <span className="flex items-center gap-1 text-[9px] text-stone-400">
                        <MapPin size={9} />
                        {r.purok}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-stone-600">{r.topic}</p>
                    <p className="text-[9px] text-stone-400">reported by {r.reporter}</p>
                    <button
                      onClick={() => sendTo(PUROK_LEADER_CONTACT[r.purok], `Verify local context for ${r.id} (${r.topic}) reported by ${r.reporter}.`)}
                      className="mt-1.5 w-full rounded-md bg-[#0038A8]/5 px-2 py-1.5 text-[9px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                    >
                      Verify With Leader
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
