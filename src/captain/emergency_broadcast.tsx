import { useState, useMemo, useEffect } from "react";
import {
  Megaphone,
  Send,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  X,
  ChevronDown,
  Filter,
  RefreshCw,
  Radio,
  Users,
  MapPin,
  Bell,
  Smartphone,
  Eye,
  Flame,
  Volume2,
  Zap,
  LifeBuoy,
  UserX,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { Modal, ConfirmModal } from "../components/ui";
import { PUROK_ZONES } from "../constants/purok";
import { SEVERITY_MAP } from "../constants/severity";
import {
  getPendingBroadcasts,
  subscribePendingBroadcasts,
  seedPendingBroadcasts,
  removePendingBroadcast,
  addPendingBroadcast,
  getBroadcastHistory,
  subscribeBroadcastHistory,
  seedBroadcastHistory,
  addBroadcastRecord,
} from "../utils/broadcastStore";
import type { PendingBroadcast, BroadcastRecord } from "../utils/broadcastStore";
import { addCaptainInboxItem } from "../utils/captainInboxStore";

export const MOCK_BROADCAST_HISTORY: BroadcastRecord[] = [
  { id: "BCAST-007", title: "Flash Flood Warning â€” Purok 3 & 5", severity: "critical", purok: "All Puroks", message: "Rising water levels detected in Purok 3 and 5. Residents in low-lying areas must evacuate immediately to the Barangay Hall evacuation center.", sentAt: "2026-07-20T11:15:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 1247, pushCount: 1247, safeCount: 1089, helpCount: 42, category: "Fire/Smoke", deliveryMethod: "push+sms" },
  { id: "BCAST-006", title: "Fire Alarm â€” Purok 4 Residential", severity: "critical", purok: "Purok 4", message: "Structure fire reported near the school district. All residents within a 200m radius must evacuate. Tanod units and BFP dispatched.", sentAt: "2026-07-19T22:30:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 312, pushCount: 312, safeCount: 285, helpCount: 8, category: "Fire/Smoke", deliveryMethod: "push+sms" },
  { id: "BCAST-005", title: "Noise Disturbance Advisory", severity: "warning", purok: "Purok 6", message: "Sustained noise complaint near the commercial strip. Desk Officer and Purok 6 Leader have been notified. Residents advised to keep noise to a minimum.", sentAt: "2026-07-19T14:10:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 0, pushCount: 28, safeCount: 28, helpCount: 0, category: "Noise Disturbance", deliveryMethod: "push" },
  { id: "BCAST-004", title: "Community Meeting Reminder", severity: "low", purok: "All Puroks", message: "Monthly Barangay Peace and Order Council meeting this Saturday at 9:00 AM, Barangay Hall. All Purok Leaders and residents welcome.", sentAt: "2026-07-18T08:00:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 0, pushCount: 1247, safeCount: 0, helpCount: 0, category: "General", deliveryMethod: "push" },
  { id: "BCAST-003", title: "Suspicious Activity Alert â€” Purok 2", severity: "warning", purok: "Purok 2", message: "Reports of suspicious individuals near the Chapel area. Patrol Team Bravo dispatched. Residents are advised to stay vigilant and report any unusual activity.", sentAt: "2026-07-17T19:45:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 0, pushCount: 210, safeCount: 198, helpCount: 3, category: "Crime/Suspicious Activity", deliveryMethod: "push" },
  { id: "BCAST-002", title: "Scheduled Power Interruption", severity: "low", purok: "All Puroks", message: "Barangay-wide power interruption scheduled for July 16, 10:00 AM to 4:00 PM for line maintenance. Please prepare accordingly.", sentAt: "2026-07-15T16:00:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 0, pushCount: 1247, safeCount: 0, helpCount: 0, category: "General", deliveryMethod: "push" },
  { id: "BCAST-001", title: "Typhoon Signal No. 2 Warning", severity: "critical", purok: "All Puroks", message: "Typhoon approaching. Signal No. 2 raised over the area. All residents must secure belongings and prepare for possible evacuation. Evacuation centers are on standby.", sentAt: "2026-07-14T06:00:00", sentBy: "Capt. Reyes", status: "delivered", smsCount: 1247, pushCount: 1247, safeCount: 1102, helpCount: 18, category: "Disaster", deliveryMethod: "push+sms" },
];

const MOCK_PENDING_ALERTS = [
  { id: "DRAFT-042", title: "Gas Leak Report â€” Purok 1 Market Area", severity: "critical", purok: "Purok 1", message: "Residents near the market entrance report a strong gas odor. Evacuate a 100m radius. BFP and utility company have been contacted.", createdAt: "2026-07-20T11:50:00", category: "Fire/Smoke", deliveryMethod: "push+sms" },
  { id: "DRAFT-041", title: "Road Obstruction Advisory", severity: "low", purok: "Purok 4", message: "Fallen tree blocking the main road near the school. DPWH notified. Residents should use alternate routes via Purok 2.", createdAt: "2026-07-20T11:30:00", category: "Road Obstruction", deliveryMethod: "push" },
  { id: "DRAFT-040", title: "Noise Complaint Escalation â€” Purok 5", severity: "warning", purok: "Purok 5", message: "Ongoing loud construction work past permitted hours. Desk Officer and Purok 5 Leader notified. Residents advised of potential citation.", createdAt: "2026-07-20T11:05:00", category: "Noise Disturbance", deliveryMethod: "push" },
];

const MOCK_ACK_DATA: Record<string, { purok: string; safe: number; help: number; total: number }[]> = {
  "BCAST-007": [
    { purok: "Purok 1", safe: 172, help: 3, total: 185 },
    { purok: "Purok 2", safe: 201, help: 2, total: 210 },
    { purok: "Purok 3", safe: 140, help: 18, total: 165 },
    { purok: "Purok 4", safe: 188, help: 4, total: 195 },
    { purok: "Purok 5", safe: 210, help: 12, total: 230 },
    { purok: "Purok 6", safe: 138, help: 3, total: 145 },
  ],
  "BCAST-002": [
    { purok: "Purok 1", safe: 178, help: 0, total: 185 },
    { purok: "Purok 2", safe: 205, help: 0, total: 210 },
    { purok: "Purok 3", safe: 160, help: 0, total: 165 },
    { purok: "Purok 4", safe: 192, help: 0, total: 195 },
    { purok: "Purok 5", safe: 225, help: 0, total: 230 },
    { purok: "Purok 6", safe: 142, help: 0, total: 145 },
  ],
};

function ackSummary(broadcast: any) {
  const ackData = MOCK_ACK_DATA[broadcast.id] || null;
  const totalReached = ackData ? ackData.reduce((a, d) => a + d.total, 0) : (broadcast.pushCount || 0);
  const safe = ackData ? ackData.reduce((a, d) => a + d.safe, 0) : (broadcast.safeCount || 0);
  const help = ackData ? ackData.reduce((a, d) => a + d.help, 0) : (broadcast.helpCount || 0);
  const noResponse = Math.max(0, totalReached - safe - help);
  const ackRate = totalReached > 0 ? Math.round((safe / totalReached) * 100) : 0;
  return { ackData, totalReached, safe, help, noResponse, ackRate };
}

const CATEGORY_ICONS: Record<string, any> = {
  "Fire/Smoke": Flame,
  "Noise Disturbance": Volume2,
  "Crime/Suspicious Activity": AlertTriangle,
  "Road Obstruction": AlertTriangle,
  "Disaster": Zap,
  "General": Megaphone,
};

const TIME_RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "all", label: "All Time" },
];

const SEVERITY_FILTERS = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "low", label: "Low" },
];

const DELIVERY_LABELS: Record<string, { icon: any; label: string; color: string }> = {
  "push+sms": { icon: Radio, label: "Push + SMS", color: "text-rose-600" },
  "push": { icon: Bell, label: "Push Only", color: "text-amber-600" },
};

export function ComposeBroadcastModal({ onClose, onSend, incidentHint, onDraftReady }: { onClose: () => void; onSend: (alert: any) => PendingBroadcast | void; incidentHint?: any; onDraftReady?: (draft: PendingBroadcast) => void }) {
  const [title, setTitle] = useState(
    incidentHint ? `EMERGENCY ALERT: ${incidentHint.id} — ${incidentHint.category} reported in ${incidentHint.purok}` : ""
  );
  const [message, setMessage] = useState(incidentHint ? incidentHint.description : "");
  const [severity, setSeverity] = useState<string>(incidentHint?.severity ?? "warning");
  const [purok, setPurok] = useState(() => {
    if (!incidentHint) return "All Puroks";
    return PUROK_ZONES.some((z) => z.name === incidentHint.purok) ? incidentHint.purok : "All Puroks";
  });
  const [submitted, setSubmitted] = useState(false);

  const deliveryMethod = severity === "critical" ? "push+sms" : "push";
  const deliveryInfo = DELIVERY_LABELS[deliveryMethod];
  const DelIcon = deliveryInfo.icon;

  const residentCount = purok === "All Puroks"
    ? PUROK_ZONES.reduce((acc, z) => acc + (MOCK_ACK_DATA["BCAST-002"]?.find((d) => d.purok === z.name)?.total ?? 200), 0)
    : MOCK_ACK_DATA["BCAST-002"]?.find((d) => d.purok === purok)?.total ?? 200;

  function handleSubmit() {
    if (!title.trim() || !message.trim()) return;
    const draft = onSend({ title: title.trim(), message: message.trim(), severity, purok, deliveryMethod });
    if (onDraftReady && draft) {
      onClose();
      onDraftReady(draft);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    const sev = SEVERITY_MAP[severity];
    return (
      <Modal
        size="md"
        icon={<Shield size={22} className="text-emerald-600" />}
        iconClass="bg-emerald-100"
        title="Draft Submitted"
        subtitle="Broadcast draft is now pending executive authorization."
        footer={
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-lg bg-[#0038A8] px-6 py-2 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            Done
          </button>
        }
      >
        <div className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-left">
              <p className="text-[10px] font-semibold tracking-wider text-stone-400">DRAFT SUMMARY</p>
              <p className="mt-1 text-[12px] font-semibold text-stone-900">{title}</p>
              <p className="mt-0.5 text-[11px] text-stone-500">{message}</p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-stone-400">
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${sev.badge}`}>
                  {sev.label}
                </span>
                <span>&middot;</span>
                <span>{purok}</span>
                <span>&middot;</span>
                <span className={`font-medium ${deliveryInfo.color}`}>{deliveryInfo.label}</span>
                <span>&middot;</span>
                <span>~{residentCount} residents</span>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-stone-400">
              Go to <span className="font-semibold text-stone-600">Pending Authorization</span> to approve and blast this alert.
            </p>
      </Modal>
    );
  }

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={<Megaphone size={18} className="text-rose-600" />}
      iconClass="bg-rose-100"
      title="Draft Emergency Broadcast"
      subtitle="Compose a mass community alert for executive authorization"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50">
            Save as Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !message.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
          >
            <Send size={13} />
            Submit for Authorization
          </button>
        </div>
      }
    >
      <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SEVERITY</p>
            <div className="flex gap-2">
              {["critical", "warning", "low"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition ${
                    severity === sev
                      ? `${SEVERITY_MAP[sev].badge} border-current`
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {SEVERITY_MAP[sev].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TARGET ZONE</p>
            <div className="relative">
              <MapPin size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <select
                value={purok}
                onChange={(e) => setPurok(e.target.value)}
                className="w-full appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-[12px] text-stone-900 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              >
                <option value="All Puroks">All Puroks â€” Community-wide</option>
                {PUROK_ZONES.map((z) => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">ALERT TITLE</p>
            <div className="relative">
              <AlertTriangle size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Flash Flood Warning â€” Immediate Evacuation"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">MESSAGE</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type the emergency broadcast message..."
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <DelIcon size={12} className="text-stone-400" />
            <p className="text-[10px] text-stone-500">
              Delivery: <span className={`font-semibold ${deliveryInfo.color}`}>{deliveryInfo.label}</span> to ~<span className="font-semibold text-stone-700">{residentCount}</span> residents in {purok === "All Puroks" ? "all zones" : purok}.
              {severity === "critical" ? " Will trigger simultaneous loud push rings + SMS." : " Will send a quiet push notification."}
            </p>
          </div>
      </div>
    </Modal>
  );
}

export function AuthorizeBroadcastModal({ alert, onConfirm, onClose }: { alert: any; onConfirm: () => void; onClose: () => void }) {
  if (!alert) return null;
  const sev = SEVERITY_MAP[alert.severity];
  const delInfo = DELIVERY_LABELS[alert.deliveryMethod];
  const DelIcon = delInfo.icon;
  const CatIcon = CATEGORY_ICONS[alert.category] || AlertTriangle;
  return (
    <Modal
      size="md"
      onClose={onClose}
      icon={<ShieldCheck size={16} className="text-[#0038A8]" />}
      title="Authorize Emergency Broadcast"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <ShieldCheck size={14} />
            Confirm &amp; Blast
          </button>
        </div>
      }
    >
      <div>
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sev.badge.split(" ")[0]}`}>
            <CatIcon size={14} className={sev.badge.split(" ")[1]} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-stone-900">{alert.title}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                {sev.label}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-stone-500">{alert.message}</p>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-stone-400">
              <span className="flex items-center gap-1"><MapPin size={9} /> {alert.purok}</span>
              <span className={`flex items-center gap-1 font-medium ${delInfo.color}`}><DelIcon size={9} /> {delInfo.label}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="text-[11px] font-semibold text-amber-800">Confirm Executive Authorization</p>
              <p className="mt-0.5 text-[11px] text-amber-600">
                This action is <span className="font-semibold">irreversible</span>. The alert will be immediately distributed to
                {alert.deliveryMethod === "push+sms"
                  ? " all residents via simultaneous push notification + SMS broadcast."
                  : " targeted recipients via push notification."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BroadcastFollowUpModal({ broadcast, summary, onClose, onSubmit }: { broadcast: any; summary: any; onClose: () => void; onSubmit: (targetPurok: string, note: string) => void }) {
  const [purok, setPurok] = useState(() =>
    PUROK_ZONES.some((z) => z.name === broadcast.purok) ? broadcast.purok : "All Puroks"
  );
  const [note, setNote] = useState("");
  return (
    <Modal
      size="md"
      onClose={onClose}
      icon={<LifeBuoy size={16} className="text-rose-600" />}
      title="Send Follow-up to Desk Officer"
      subtitle="Forward the Need Help report for operational response"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(purok, note.trim())}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-700"
          >
            <Send size={13} />
            Send Follow-up
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">BROADCAST ID</p>
            <p className="mt-1 text-[12px] font-semibold text-stone-900">{broadcast.id}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">NEEDING HELP</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-rose-600">
              <HelpCircle size={12} />
              {summary.help} resident{summary.help !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">TARGET PUROK</p>
          <div className="relative">
            <MapPin size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <select
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              className="w-full appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-[12px] text-stone-900 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            >
              <option value="All Puroks">All Puroks â€” Community-wide</option>
              {PUROK_ZONES.map((z) => (
                <option key={z.id} value={z.name}>{z.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">CAPTAIN NOTE (OPTIONAL)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Priority check on the low-lying area â€” please verify residents are accounted for."
            className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
          />
        </div>

        <p className="text-[10px] text-stone-400">
          The Desk Officer remains responsible for operational response; this request only identifies the need for follow-up.
        </p>
      </div>
    </Modal>
  );
}

function BroadcastDetailDrawer({ broadcast, onClose, onFollowUp }: { broadcast: any; onClose: () => void; onFollowUp: (broadcast: any) => void }) {
  if (!broadcast) return null;
  const sev = SEVERITY_MAP[broadcast.severity];
  const CatIcon = CATEGORY_ICONS[broadcast.category] || AlertTriangle;
  const summary = ackSummary(broadcast);
  const ackData = summary.ackData;

  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={broadcast.id}
      subtitle={formatTime(broadcast.sentAt)}
      aside={
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${sev.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
          {sev.label}
        </span>
      }
    >
      <div>
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <CatIcon size={16} />
              </div>
              <span className="text-[12px] font-semibold text-stone-900">{broadcast.category}</span>
            </div>
            <h3 className="text-[13px] font-bold text-stone-900">{broadcast.title}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-stone-500">{broadcast.message}</p>
          </div>

          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">SENT BY</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{broadcast.sentBy}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">TARGET ZONE</p>
              <p className="mt-1 text-[12px] font-medium text-stone-900">{broadcast.purok}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">DELIVERY METHOD</p>
              <p className={`mt-1 text-[12px] font-medium ${DELIVERY_LABELS[broadcast.deliveryMethod]?.color ?? "text-stone-900"}`}>
                {DELIVERY_LABELS[broadcast.deliveryMethod]?.label ?? "â€”"}
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] font-medium tracking-wider text-stone-400">STATUS</p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
                <CheckCircle2 size={12} />
                {broadcast.status === "delivered" ? "Delivered" : "Pending"}
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-stone-400">DELIVERY STATS</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[18px] font-bold text-[#0038A8]">{broadcast.smsCount.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">SMS Sent</p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold text-[#0038A8]">{broadcast.pushCount.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">Push Sent</p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold text-[#0038A8]">{broadcast.helpCount}</p>
                <p className="text-[10px] text-stone-400">Need Help</p>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-stone-400">
              <Users size={11} />
              COMMUNITY ACKNOWLEDGMENT
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="text-center">
                <p className="text-[18px] font-bold text-[#0038A8]">{summary.totalReached.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">Total Reached</p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold text-emerald-600">{summary.safe.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">Safe</p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold text-rose-600">{summary.help.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">Need Help</p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold text-stone-500">{summary.noResponse.toLocaleString()}</p>
                <p className="text-[10px] text-stone-400">No Response</p>
              </div>
              <div className="text-center">
                <p className="text-[18px] font-bold text-[#0038A8]">{summary.ackRate}%</p>
                <p className="text-[10px] text-stone-400">Ack Rate</p>
              </div>
            </div>
          </div>

          {summary.help > 0 && (
            <div className="mb-5 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <HelpCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                <div>
                  <p className="text-[12px] font-semibold text-rose-700">
                    {summary.help} resident{summary.help !== 1 ? "s" : ""} need help
                  </p>
                  <p className="text-[11px] text-rose-600">Residents marked Need Help after this broadcast.</p>
                </div>
              </div>
              <button
                onClick={() => onFollowUp(broadcast)}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-700"
              >
                <LifeBuoy size={13} />
                Send Follow-up to Desk Officer
              </button>
            </div>
          )}

          {ackData && (
            <div className="mb-5 overflow-hidden rounded-lg border border-stone-200">
              <p className="border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[11px] font-semibold text-stone-900">
                Acknowledgement by Purok
              </p>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-stone-200 bg-white text-[9px] uppercase tracking-wider text-stone-400">
                    <th className="px-4 py-2 font-medium">Purok</th>
                    <th className="px-2 py-2 text-center font-medium">Safe</th>
                    <th className="px-2 py-2 text-center font-medium">Need Help</th>
                    <th className="px-4 py-2 text-right font-medium">No Response</th>
                  </tr>
                </thead>
                <tbody>
                  {ackData.map((row) => {
                    const rowNoResponse = Math.max(0, row.total - row.safe - row.help);
                    return (
                      <tr key={row.purok} className="border-b border-stone-100 bg-white text-[11px] last:border-0">
                        <td className="px-4 py-2 font-medium text-stone-900">{row.purok}</td>
                        <td className="px-2 py-2 text-center text-emerald-600">{row.safe}</td>
                        <td className={`px-2 py-2 text-center ${row.help > 0 ? "font-semibold text-rose-600" : "text-stone-400"}`}>{row.help}</td>
                        <td className="px-4 py-2 text-right text-stone-500">{rowNoResponse}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </Modal>
  );
}

export default function EmergencyBroadcast() {
  const { ToastPortal } = useToast();

  const [history, setHistory] = useState<BroadcastRecord[]>(getBroadcastHistory());
  const [pendingAlerts, setPendingAlerts] = useState<PendingBroadcast[]>(getPendingBroadcasts());
  const [timeRange, setTimeRange] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<any>(null);
  const [showAckPanel, setShowAckPanel] = useState<string | null>(null);
  const [authorizeTarget, setAuthorizeTarget] = useState<any>(null);
  const [dismissTarget, setDismissTarget] = useState<any>(null);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string; detail?: string; icon?: any } | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<any>(null);

  useEffect(() => {
    seedPendingBroadcasts(
      MOCK_PENDING_ALERTS.map((a) => ({
        ...a,
        category: a.category ?? "General",
        deliveryMethod: (a.deliveryMethod === "push+sms" ? "push+sms" : "push") as "push+sms" | "push",
        submittedBy: "Capt. Reyes",
      }))
    );
    setPendingAlerts(getPendingBroadcasts());
    seedBroadcastHistory(MOCK_BROADCAST_HISTORY);
    setHistory(getBroadcastHistory());
    const unsubPending = subscribePendingBroadcasts(() => {
      setPendingAlerts(getPendingBroadcasts());
    });
    const unsubHistory = subscribeBroadcastHistory(() => {
      setHistory(getBroadcastHistory());
    });
    return () => {
      unsubPending();
      unsubHistory();
    };
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((b) => {
      if (severityFilter !== "all" && b.severity !== severityFilter) return false;
      return true;
    });
  }, [history, severityFilter]);

  const totalBroadcasts = history.length;
  const pendingCount = pendingAlerts.length;
  const latestCritical = history.find((b) => b.severity === "critical");
  const latestAckData = latestCritical ? MOCK_ACK_DATA[latestCritical.id] : null;
  const totalSafe = latestAckData
    ? latestAckData.reduce((a, d) => a + d.safe, 0)
    : latestCritical?.safeCount ?? 0;
  const totalResidents = latestAckData
    ? latestAckData.reduce((a, d) => a + d.total, 0)
    : 1247;
  const ackRate = totalResidents > 0 ? Math.min(100, (totalSafe / totalResidents) * 100).toFixed(0) : "0";
  const totalHelp = latestAckData
    ? latestAckData.reduce((a, d) => a + d.help, 0)
    : latestCritical?.helpCount ?? 0;

  const kpis = [
    { label: "TOTAL BROADCASTS SENT", value: totalBroadcasts, sub: "All-time broadcast count", icon: Megaphone },
    { label: "PENDING AUTHORIZATION", value: pendingCount, sub: "Drafts awaiting executive approval", icon: Shield },
    { label: "ACKNOWLEDGEMENT RATE", value: `${ackRate}%`, sub: "Residents confirmed safe", icon: CheckCircle2 },
    { label: "NEEDING HELP", value: totalHelp, sub: "Requires emergency response", icon: HelpCircle },
  ];

  function handleAuthorizeAlert(alert: any) {
    addBroadcastRecord({
      title: alert.title,
      severity: alert.severity,
      purok: alert.purok,
      message: alert.message,
      sentAt: new Date().toISOString(),
      sentBy: "Capt. Reyes",
      status: "delivered",
      smsCount: alert.deliveryMethod === "push+sms" ? 1247 : 0,
      pushCount: alert.deliveryMethod === "push+sms" ? 1247 : 28,
      safeCount: 0,
      helpCount: 0,
      category: alert.category,
      deliveryMethod: alert.deliveryMethod,
    });
    removePendingBroadcast(alert.id);
    setSuccessModal({ title: "Broadcast Authorized & Sent", message: `${alert.title} has been distributed to all residents.`, detail: alert.deliveryMethod === "push+sms" ? "Push notification + SMS delivered simultaneously." : "Push notification delivered to targeted recipients." });
  }

  function handleDismissAlert(alertId: string) {
    removePendingBroadcast(alertId);
    setDismissTarget(null);
    setSuccessModal({ title: "Draft Dismissed", message: "The draft alert has been permanently discarded." });
  }

  function handleNewBroadcast(alert: any) {
    addPendingBroadcast({
      title: alert.title,
      severity: alert.severity,
      purok: alert.purok,
      message: alert.message,
      category: alert.category ?? "General",
      deliveryMethod: alert.deliveryMethod,
      createdAt: new Date().toISOString(),
      submittedBy: "Capt. Reyes",
    });
  }

  function handleFollowUpSubmit(targetPurok: string, note: string) {
    if (!followUpTarget) return;
    const summary = ackSummary(followUpTarget);
    const bcastId = followUpTarget.id;
    addCaptainInboxItem({
      type: "other_request",
      incidentId: "—",
      title: `Follow-up — ${bcastId}`,
      purok: targetPurok,
      priority: summary.help >= 10 ? "High" : "Medium",
      reason: note || `${summary.help} resident${summary.help !== 1 ? "s" : ""} in ${targetPurok} marked Need Help after ${bcastId}.`,
      submittedBy: "Capt. Reyes",
    });
    setFollowUpTarget(null);
    setSuccessModal({
      title: "Follow-up Request Sent",
      message: `Follow-up for ${bcastId} sent to the Desk Officer.`,
      detail: "The request is tracked under Operational Follow-ups on the dashboard.",
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Emergency Broadcast System</h1>
              <p className="mt-1 text-sm text-stone-500">
                Draft, authorize, and track mass community alerts &amp; emergency notifications
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
              >
                <Megaphone size={13} />
                New Broadcast
              </button>
            </div>
          </div>
        </header>

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                onClick={() => setTimeRange(tr.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  timeRange === tr.key ? "bg-[#0038A8] text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-900 hover:bg-stone-50"
              >
                <Filter size={12} />
                Severity
                <ChevronDown size={12} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wider text-stone-400">SEVERITY</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SEVERITY_FILTERS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => { setSeverityFilter(opt.key); setFilterOpen(false); }}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                          severityFilter === opt.key ? "bg-[#0038A8] text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { setSeverityFilter("all"); setTimeRange("all"); }}
              className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50"
            >
              <RefreshCw size={11} />
              Reset
            </button>
          </div>
        </div>

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

        {pendingAlerts.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Shield size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-stone-900">Pending Authorization</h3>
                <p className="text-[11px] text-stone-400">{pendingAlerts.length} draft{pendingAlerts.length !== 1 ? "s" : ""} awaiting executive approval</p>
              </div>
            </div>

            <div className="space-y-3">
              {pendingAlerts.map((alert) => {
                const sev = SEVERITY_MAP[alert.severity];
                const CatIcon = CATEGORY_ICONS[alert.category] || AlertTriangle;
                const delInfo = DELIVERY_LABELS[alert.deliveryMethod];
                const DelIcon = delInfo.icon;

                return (
                  <div key={alert.id} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sev.badge.split(" ")[0]}`}>
                          <CatIcon size={14} className={sev.badge.split(" ")[1]} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-stone-900">{alert.title}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                              {sev.label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-stone-500">{alert.message}</p>
                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-stone-400">
                            <span className="flex items-center gap-1"><Clock size={9} /> {formatTime(alert.createdAt)}</span>
                            <span className="flex items-center gap-1"><MapPin size={9} /> {alert.purok}</span>
                            <span className={`flex items-center gap-1 font-medium ${delInfo.color}`}><DelIcon size={9} /> {delInfo.label}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 pl-11">
                      <button
                        onClick={() => setAuthorizeTarget(alert)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
                      >
                        <ShieldCheck size={14} />
                        Authorize &amp; Blast
                      </button>
                      <button
                        onClick={() => setDismissTarget(alert)}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-500 hover:bg-stone-50"
                      >
                        <X size={12} />
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-[#0038A8]" />
              <div>
                <h3 className="text-[14px] font-semibold text-stone-900">Broadcast History</h3>
                <p className="text-[11px] text-stone-400">{filteredHistory.length} broadcast{filteredHistory.length !== 1 ? "s" : ""} sent</p>
              </div>
            </div>
          </div>

          <div className="min-h-0">
            {filteredHistory.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                  <Megaphone size={20} className="text-stone-300" />
                </div>
                <p className="text-[12px] text-stone-400">No broadcasts match this filter</p>
              </div>
            ) : (
              filteredHistory.map((broadcast, i) => {
                const sev = SEVERITY_MAP[broadcast.severity];
                const CatIcon = CATEGORY_ICONS[broadcast.category] || AlertTriangle;
                const delInfo = DELIVERY_LABELS[broadcast.deliveryMethod];
                const DelIcon = delInfo.icon;
                const summary = ackSummary(broadcast);

                return (
                  <div
                    key={broadcast.id}
                    className={`px-5 py-4 ${i < filteredHistory.length - 1 ? "border-b border-black/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sev.badge.split(" ")[0]}`}>
                        <CatIcon size={14} className={sev.badge.split(" ")[1]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-stone-900">{broadcast.id}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                            {sev.label}
                          </span>
                          <span className={`flex items-center gap-1 text-[9px] font-medium ${delInfo.color}`}>
                            <DelIcon size={9} /> {delInfo.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] font-medium text-stone-900">{broadcast.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-stone-500">{broadcast.message}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-stone-400">
                          <span className="flex items-center gap-1"><Clock size={9} /> {formatTime(broadcast.sentAt)}</span>
                          <span className="flex items-center gap-1"><MapPin size={9} /> {broadcast.purok}</span>
                          {broadcast.smsCount > 0 && <span className="flex items-center gap-1"><Smartphone size={9} /> {broadcast.smsCount.toLocaleString()} SMS</span>}
                          <span className="flex items-center gap-1"><Bell size={9} /> {broadcast.pushCount.toLocaleString()} Push</span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                            <CheckCircle2 size={10} /> {summary.safe} Safe
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-stone-500">
                            <UserX size={10} /> {summary.noResponse} No Response
                          </span>
                          <span className="text-[10px] text-stone-400">{summary.ackRate}% ack</span>
                          {summary.help > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600">
                              <HelpCircle size={10} /> {summary.help} Need Help
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {summary.ackData && (
                          <button
                            onClick={() => setShowAckPanel(showAckPanel === broadcast.id ? null : broadcast.id)}
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                              showAckPanel === broadcast.id
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-stone-200 text-stone-500 hover:bg-stone-50"
                            }`}
                          >
                            <Users size={11} />
                            Ack Roll-Call
</button>
                        )}
                        {summary.help > 0 && (
                          <button
                            onClick={() => setFollowUpTarget(broadcast)}
                            className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-100"
                          >
                            <LifeBuoy size={11} />
                            Follow-up
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedBroadcast(broadcast)}
                          className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <Eye size={11} />
                          Details
                        </button>
                      </div>
                    </div>

                    {showAckPanel === broadcast.id && summary.ackData && (
                      <div className="mt-3 ml-11 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                        <div className="mb-2 flex items-center gap-2">
                          <Users size={12} className="text-[#0038A8]" />
                          <span className="text-[11px] font-semibold text-stone-900">Acknowledgement Roll-Call</span>
                        </div>
                        <div className="space-y-1.5">
                          {summary.ackData!.map((row) => {
                            const rowAckPct = row.total > 0 ? ((row.safe / row.total) * 100).toFixed(0) : "0";
                            return (
                              <div key={row.purok} className="flex items-center gap-3">
                                <span className="w-16 text-[10px] font-medium text-stone-700">{row.purok}</span>
                                <div className="flex-1">
                                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                                    <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${rowAckPct}%` }} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className="flex items-center gap-0.5 text-emerald-600">
                                    <CheckCircle2 size={9} /> {row.safe}
                                  </span>
                                  {row.help > 0 && (
                                    <span className="flex items-center gap-0.5 text-rose-600">
                                      <HelpCircle size={9} /> {row.help}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {showCompose && (
        <ComposeBroadcastModal
          onClose={() => setShowCompose(false)}
          onSend={handleNewBroadcast}
        />
      )}

      {authorizeTarget && (
        <AuthorizeBroadcastModal
          alert={authorizeTarget}
          onClose={() => setAuthorizeTarget(null)}
          onConfirm={() => { handleAuthorizeAlert(authorizeTarget); setAuthorizeTarget(null); }}
        />
      )}

      {dismissTarget && (() => {
        const alert = dismissTarget;
        return (
          <ConfirmModal
            type="confirm"
            title="Dismiss Draft Alert"
            message={`Are you sure you want to discard the draft ${alert.title}? This action cannot be undone.`}
            confirmLabel="Discard"
            cancelLabel="Keep Draft"
            onConfirm={() => handleDismissAlert(alert.id)}
            onClose={() => setDismissTarget(null)}
          />
        );
      })()}

      <BroadcastDetailDrawer
        broadcast={selectedBroadcast}
        onClose={() => setSelectedBroadcast(null)}
        onFollowUp={setFollowUpTarget}
      />

      {followUpTarget && (
        <BroadcastFollowUpModal
          broadcast={followUpTarget}
          summary={ackSummary(followUpTarget)}
          onClose={() => setFollowUpTarget(null)}
          onSubmit={handleFollowUpSubmit}
        />
      )}

      {successModal && (() => {
        return (
          <ConfirmModal
            type="success"
            title={successModal.title}
            message={successModal.detail ? `${successModal.message} ${successModal.detail}` : successModal.message}
            onClose={() => setSuccessModal(null)}
          />
        );
      })()}

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
