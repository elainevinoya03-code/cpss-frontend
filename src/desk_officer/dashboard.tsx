// Barangay Desk Officer Dashboard — Command & Monitoring Center overview.
// Central operational hub: live incident map, priority attention, active
// field responses, pending CCTV footage requests, sensor alert status and
// quick actions. Detailed processes live in their own modules and are
// reached from here via onNavigate shortcuts.

import { useState, useMemo, useEffect, useRef, type ComponentType } from "react";
import {
  ClipboardList,
  Radio,
  Map,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Megaphone,
  Info,
  KeyRound,
  CheckCircle2,
  Clock,
  Zap,
  Send,
  Camera,
  Smartphone,
  UserCheck,
  Siren,
  ArrowRight,
  MapPin,
  Video,
  Navigation,
  PlusCircle,
  FileSearch,
  Inbox,
  Layers,
  AlertOctagon,
  BellRing,
  Link2,
  History,
  Shield,
  Eye,
  Image,
  CloudUpload,
  FileText,
  BadgeCheck,
  Play,
  Download,
  FolderOpen,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useAlertSound } from "../hooks/useAlertSound";
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal } from "../components/ui";
import {
  useIncidentStore,
  getIncidents,
  getDispatches,
  addIncident,
  type Incident,
  type IncidentSource,
  type IncidentStatus,
  type DeskPriority,
} from "./incidentStore";
import { getTanods, subscribeTanods, getTanodByName, TANOD_STATUS_META, type Tanod, type TanodStatus } from "./tanodStore";
import { CATEGORY_ICON } from "./constants";
import {
  addPendingBroadcast,
  type PendingBroadcast,
} from "../utils/broadcastStore";
import { setDeskTriageTarget } from "../utils/deskTriageTarget";
import { setDeskCaseTarget } from "../utils/deskCaseTarget";
import {
  addSafetyNotice,
  getSafetyNotices,
  subscribeSafetyNotices,
  type NoticeCategory,
  type NoticeState,
  type NoticeTarget,
  type NoticeSeverity,
  type NoticeAudience,
  type SafetyNotice,
} from "../utils/safetyNoticeStore";
import {
  getFootageRequests,
  subscribeFootageRequests,
  getPendingFootageRequests,
  getFootageRequestById,
  addFootageRequest,
  setFootageRequestStatus,
  REQUEST_STATUS_META,
  type FootageRequest,
} from "../utils/footageRequestStore";
import { PUROK_ZONES } from "../constants/purok";
import {
  getActivity,
  subscribeActivity,
  recordActivity,
  activityActionLabel,
  type ActivityEvent,
} from "../utils/recentActivityStore";

// ---------------------------------------------------------------------------
// Shared metadata (kept in sync with incident_triage.tsx conventions)
// ---------------------------------------------------------------------------

const INCIDENT_STATUS_META: Record<IncidentStatus, { label: string; badge: string; dot: string }> = {
  new: { label: "New", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  acknowledged: { label: "Acknowledged", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  in_progress: { label: "In Progress", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  resolved: { label: "Resolved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  closed_false_alarm: { label: "Closed", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

const SOURCE_META: Record<IncidentSource, { label: string; icon: typeof Smartphone }> = {
  resident: { label: "Resident", icon: Smartphone },
  tanod: { label: "Tanod", icon: UserCheck },
  desk_officer: { label: "Desk Officer", icon: ClipboardList },
  cctv: { label: "CCTV", icon: Camera },
  iot: { label: "IoT Sensor", icon: Zap },
  iot_cctv: { label: "IoT via CCTV", icon: Camera },
  sos: { label: "SOS", icon: Siren },
};

const DESK_PRIORITY_META: Record<DeskPriority, { chip: string; dot: string; ring: string }> = {
  Low: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400", ring: "stroke-sky-400" },
  Medium: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", ring: "stroke-amber-400" },
  High: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", ring: "stroke-rose-500" },
};

const ACTIVITY_ICON: Record<ActivityEvent["kind"], ComponentType<{ size?: number; className?: string }>> = {
  incident: ClipboardList,
  tanod: UserCheck,
  cctv: Camera,
  request: Video,
  alert: Megaphone,
  closure: CheckCircle2,
};

const ACTIVITY_KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  incident: "bg-[#0038A8]/10 text-[#0038A8]",
  tanod: "bg-emerald-100 text-emerald-700",
  cctv: "bg-sky-100 text-sky-700",
  request: "bg-violet-100 text-violet-700",
  alert: "bg-amber-100 text-amber-700",
  closure: "bg-stone-100 text-stone-600",
};


type AttentionAction = "respond" | "dispatch" | "triage" | "follow_up" | "clip";

interface AttentionItem {
  id: string;
  kind: "incident" | "clip";
  rank: number;
  category: string;
  location: string;
  receivedAt: string;
  urgencyLabel: string;
  urgencyChip: string;
  statusLabel: string;
  statusBadge: string;
  tanod: string | null;
  action: string;
  actionType: AttentionAction;
  incident: Incident;
  clipId?: string;
}

const ATTENTION_ACTION_TEXT: Record<Exclude<AttentionAction, "clip">, string> = {
  respond: "Respond immediately",
  dispatch: "Assign & dispatch response",
  triage: "Triage new report",
  follow_up: "Resolve / follow up",
};

const EMERGENCY_URGENCY = { label: "Emergency", chip: "bg-red-100 text-red-700" };

const SLA_TARGETS: Record<DeskPriority, { minutes: number; label: string }> = {
  High: { minutes: 15, label: "15 min" },
  Medium: { minutes: 60, label: "1 hr" },
  Low: { minutes: 240, label: "4 hr" },
};

const INCIDENT_CATEGORY_OPTIONS = [
  "Fire or Smoke",
  "Noise Disturbance",
  "Public Disturbance",
  "Hazard or Obstruction",
  "Suspicious Activity",
  "Medical or Welfare Concern",
  "Other",
] as const;

const INCIDENT_SEVERITY_OPTIONS = ["critical", "warning", "low"] as const;

const PUROK_COORDS: Record<string, { lat: number; lng: number }> = {
  "Purok 1": { lat: 14.712, lng: 121.015 },
  "Purok 2": { lat: 14.714, lng: 121.017 },
  "Purok 3": { lat: 14.71, lng: 121.013 },
  "Purok 4": { lat: 14.711, lng: 121.018 },
  "Purok 5": { lat: 14.707, lng: 121.012 },
  "Purok 6": { lat: 14.709, lng: 121.02 },
};

function formatTimeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatElapsed(isoStr?: string) {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function isSlaBreached(inc: Incident): boolean {
  if (inc.status !== "new" || inc.acknowledgedAt) return false;
  const target = SLA_TARGETS[inc.priority].minutes * 60_000;
  return Date.now() - new Date(inc.time).getTime() > target;
}

function sensorRisk(s: { status: string; value: number; threshold: number }): string {
  if (s.status === "offline") return "critical";
  if (s.value >= s.threshold) return "critical";
  if (s.status === "warning") return "warning";
  return "online";
}

function zoneByName(name: string) {
  return PUROK_ZONES.find((z) => z.name === name);
}

function SectionTitle({
  title,
  sub,
  onAction,
  actionLabel = "View All",
}: {
  title: string;
  sub?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#334155]">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[11px] text-[#94A3B8]">{sub}</p>}
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-[11px] font-medium text-[#0038A8] hover:underline"
        >
          {actionLabel}
          <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header compose / lookup modals
// ---------------------------------------------------------------------------

function BroadcastCompose({
  onClose,
  onQueued,
}: {
  onClose: () => void;
  onQueued: (draft: PendingBroadcast) => void;
}) {
  const [severity, setSeverity] = useState<"Info" | "Warning" | "High">("Info");
  const [message, setMessage] = useState<string>("");
  const defaultMessage =
    "Emergency alert issued by the Barangay Desk. Please stay safe and follow the guidance of barangay responders.";

  const sev = { Info: "info", Warning: "warning", High: "high" }[severity];
  const [confirmOpen, setConfirmOpen] = useState(false);

  function submit() {
    const draft = addPendingBroadcast({
      title: severity === "High" ? "High-Severity Community Alert" : `${severity} Community Notice`,
      severity: sev,
      purok: "All Puroks",
      message: message.trim() || defaultMessage,
      category: "Emergency Broadcast",
      deliveryMethod: sev === "high" ? "push+sms" : "push",
      createdAt: new Date().toISOString(),
      submittedBy: "D.O. Ramos",
    });
    onQueued(draft);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Compose Mass Broadcast"
      subtitle="Severity-graded community alert (severity §10.6.5)"
      icon={<Megaphone size={18} />}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-white transition ${
              severity === "High" ? "bg-rose-600 hover:bg-rose-700" : "bg-[#0038A8] hover:bg-[#002A8C]"
            }`}
          >
            <Send size={13} />
            {severity === "High" ? "Send for Captain Authorization" : "Send Quiet Push"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">SEVERITY</p>
          <div className="grid grid-cols-3 gap-2">
            {(["Info", "Warning", "High"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                  severity === s
                    ? s === "High"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-stone-500">
            {severity === "High"
              ? "Simultaneous SMS + loud push to every resident in the geofence — requires Captain 1-tap authorization."
              : "Silent / standard push to Desk Officer, local Purok Leader, and on-duty Tanods. Sent immediately."}
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">MESSAGE</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={defaultMessage}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
      </div>

      {confirmOpen && (
        <ConfirmModal
          type="confirm"
          tone={severity === "High" ? "danger" : "primary"}
          title={severity === "High" ? "Send this High-Severity broadcast?" : "Send this broadcast?"}
          message={
            severity === "High"
              ? `A High-severity broadcast sends simultaneous SMS + loud push to every resident in the geofence. This is distributed broadly and requires Captain authorization.`
              : "This sends a community broadcast to field units and residents immediately. Broadcasts are distributed and cannot be recalled once sent."
          }
          confirmLabel={severity === "High" ? "Request Authorization" : "Send Broadcast"}
          cancelLabel="Back"
          onConfirm={() => { setConfirmOpen(false); submit(); }}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </Modal>
  );
}

function SafetyNoticeCompose({
  onClose,
  onSaved,
  preselectIncident,
  mode = "notice",
}: {
  onClose: () => void;
  onSaved: (state: NoticeState, notice: SafetyNotice) => void;
  preselectIncident?: { id: string; category: string; purok: string };
  mode?: "notice" | "security";
}) {
  const isSecurity = mode === "security";
  const descriptor = isSecurity ? "Create Security Alert" : "Publish Safety Notice";

  const [title, setTitle] = useState(
    preselectIncident ? `Alert for ${preselectIncident.id} (${preselectIncident.category})` : ""
  );
  const [category, setCategory] = useState<NoticeCategory>("Safety Alert");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<NoticeTarget>(
    preselectIncident ? { kind: "purok", purok: preselectIncident.purok } : { kind: "barangay" }
  );
  const [purok, setPurok] = useState(preselectIncident?.purok ?? "Purok 1");

  const [severity, setSeverity] = useState<NoticeSeverity>("Warning");
  const [audience, setAudience] = useState<NoticeAudience[]>(["all"]);
  const [incidentId, setIncidentId] = useState<string>(preselectIncident?.id ?? "");
  const [pendingSave, setPendingSave] = useState<NoticeState | null>(null);

  const requiresApproval = isSecurity && severity === "High";
  const openIncidentIds = getIncidents()
    .filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm")
    .map((i) => i.id);

  const AUDIENCE_OPTIONS: { value: NoticeAudience; label: string }[] = [
    { value: "all", label: "Entire Barangay" },
    { value: "tanods", label: "Tanods" },
    { value: "neighborhood_watch", label: "Neighborhood Watch" },
    { value: "residents", label: "Residents" },
  ];

  function toggleAudience(a: NoticeAudience) {
    setAudience((prev) =>
      a === "all"
        ? ["all"]
        : prev.includes("all")
          ? [a]
          : prev.includes(a)
            ? prev.filter((x) => x !== a)
            : [...prev, a]
    );
  }

  function save(state: NoticeState) {
    if (!title.trim() || !message.trim()) return;
    const actualState: NoticeState = requiresApproval ? "draft" : state;
    const notice = addSafetyNotice({
      title: title.trim(),
      category,
      message: message.trim(),
      target: target.kind === "purok" ? { kind: "purok", purok } : { kind: "barangay" },
      state: actualState,
      author: "D.O. Ramos",
      createdAt: new Date().toISOString(),
      incidentId: incidentId || preselectIncident?.id,
      severity: isSecurity ? severity : undefined,
      audience: isSecurity ? audience : undefined,
      approvalStatus: requiresApproval ? "pending" : undefined,
    });
    onSaved(actualState, notice);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title={descriptor}
      subtitle={
        isSecurity
          ? "Severity-graded security alert to field units and residents — do not bypass authorization"
          : "Routine informational bulletin — no severity selector, no Captain approval"
      }
      icon={isSecurity ? <AlertTriangle size={18} /> : <Info size={18} />}
      iconClass="bg-[#0f766e]/10 text-[#0f766e]"
      size={isSecurity ? "lg" : "md"}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={() => save("draft")}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            {requiresApproval ? "Save Draft for Approval" : "Save as Draft"}
          </button>
          <button
            onClick={() => setPendingSave("published")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-white transition ${
              requiresApproval
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-[#0f766e] hover:bg-[#115e59]"
            }`}
          >
            <Send size={13} />
            {requiresApproval ? "Send to Punong Barangay for Approval" : "Publish Now"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {isSecurity && (
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">SEVERITY</p>
            <div className="grid grid-cols-3 gap-2">
              {(["Info", "Warning", "High"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                    severity === s
                      ? s === "High"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-stone-500">
              {requiresApproval
                ? "High-severity alerts require Punong Barangay 1-tap authorization before distribution."
                : "Lower-severity alerts are distributed immediately to the selected target zone."}
            </p>
          </div>
        )}

        {isSecurity && (
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET AUDIENCE</p>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCE_OPTIONS.map((o) => {
                const active = audience.includes(o.value) || (o.value === "all" && audience.length === 0);
                return (
                  <button
                    key={o.value}
                    onClick={() => toggleAudience(o.value)}
                    className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                      active ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {preselectIncident && (
          <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-[#E9EDFB]/60 px-3 py-2 text-[11px] font-medium text-[#0038A8]">
            <Link2 size={12} />
            Linked to incident&nbsp;<span className="font-bold">{preselectIncident.id}</span>
            <span className="text-[#64748B]">&middot; {preselectIncident.purok}</span>
          </div>
        )}

        {isSecurity && (
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">INCIDENT ID (OPTIONAL)</p>
            <input
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              list="alert-incident-list"
              placeholder="Select or type an incident ID…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 font-mono text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
            />
            <datalist id="alert-incident-list">
              {openIncidentIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TITLE</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Alert headline"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">CATEGORY</p>
          <div className="flex flex-wrap gap-2">
            {(["General", "Safety Alert", "Event Notice", "Weather Warning"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  category === c
                    ? "bg-[#0038A8]/10 text-[#0038A8] ring-1 ring-[#0038A8]/30"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TARGET ZONE</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTarget({ kind: "barangay" })}
              className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                target.kind === "barangay"
                  ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                  : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              Entire Barangay
            </button>
            <button
              onClick={() => setTarget({ kind: "purok", purok })}
              className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                target.kind === "purok"
                  ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                  : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              Specific Purok
            </button>
          </div>
          {target.kind === "purok" && (
            <div className="mt-2">
              <input
                value={purok}
                onChange={(e) => setPurok(e.target.value)}
                list="purok-list"
                className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
              />
              <datalist id="purok-list">
                {PUROK_ZONES.map((z) => (
                  <option key={z.id} value={z.name} />
                ))}
              </datalist>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">MESSAGE</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Alert details"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
      </div>

      {pendingSave && (
        <ConfirmModal
          type="confirm"
          tone={requiresApproval ? "danger" : "primary"}
          title={requiresApproval ? "Send this security alert for approval?" : "Publish this notice now?"}
          message={
            requiresApproval
              ? "This High-severity security alert will be sent to the Punong Barangay for approval before it reaches residents. Proceed?"
              : "This notice will be immediately published to the selected audience(s) across the barangay. It can be seen by residents and field units right away."
          }
          confirmLabel={requiresApproval ? "Send for Approval" : "Publish Now"}
          cancelLabel="Back"
          onConfirm={() => {
            const state = pendingSave;
            setPendingSave(null);
            save(state);
          }}
          onClose={() => setPendingSave(null)}
        />
      )}
    </Modal>
  );
}

function CreateManualIncidentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (inc: Incident) => void;
}) {
  const [category, setCategory] = useState<string>("Public Disturbance");
  const [severity, setSeverity] = useState<string>("warning");
  const [priority, setPriority] = useState<DeskPriority>("Medium");
  const [purok, setPurok] = useState<string>("Purok 1");
  const [description, setDescription] = useState("");
  const [reporter, setReporter] = useState("Desk Officer");
  const [notes, setNotes] = useState("");

  const valid = category && description.trim().length >= 3;

  const severityMeta = { critical: "Critical", warning: "Warning", low: "Low" }[severity];
  const [confirmOpen, setConfirmOpen] = useState(false);

  function submit() {
    if (!valid) return;
    const coord = PUROK_COORDS[purok] ?? PUROK_COORDS["Purok 1"];
    const inc = addIncident({
      category,
      severity: severity as "critical" | "warning" | "low",
      purok,
      description: description.trim(),
      source: "desk_officer",
      reporter: reporter.trim() || "Desk Officer",
      time: new Date().toISOString(),
      status: "new",
      photos: 0,
      lat: coord.lat,
      lng: coord.lng,
      priority,
      notes: notes.trim() ? [notes.trim()] : undefined,
      verificationStatus: "new",
    });
    onCreated(inc);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Create Manual Incident"
      subtitle="Log a new incident direct to the dashboard, live map and work queues"
      icon={<PlusCircle size={18} />}
      iconClass="bg-[#0038A8]/10 text-[#0038A8]"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!valid}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
          >
            <PlusCircle size={13} />
            Create Incident
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">CATEGORY</p>
            <div className="flex flex-wrap gap-1.5">
              {INCIDENT_CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition ${
                    category === c
                      ? "bg-[#0038A8]/10 text-[#0038A8] ring-1 ring-[#0038A8]/30"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">PUROK / ZONE</p>
            <input
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              list="purok-list"
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
            />
            <datalist id="purok-list">
              {PUROK_ZONES.map((z) => (
                <option key={z.id} value={z.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">SEVERITY</p>
            <div className="grid grid-cols-3 gap-2">
              {INCIDENT_SEVERITY_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-medium capitalize transition ${
                    severity === s
                      ? s === "critical"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">PRIORITY</p>
            <div className="grid grid-cols-3 gap-2">
              {(["Low", "Medium", "High"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                    priority === p
                      ? "border-[#0038A8]/40 bg-[#E9EDFB] text-[#0038A8]"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <Info size={13} className="mt-0.5 shrink-0 text-[#0038A8]" />
          <p className="text-[11px] leading-relaxed text-stone-600">
            {priority === "High" || severity === "critical"
              ? "High urgency — on creation the incident is added to the priority queue and a CCTV footage request is auto-initiated."
              : "Standard urgency — the incident is added to the dashboard, live map and work queues for triage."}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">DESCRIPTION</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the incident…"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">REPORTER</p>
            <input
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">NOTES (OPTIONAL)</p>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
            />
          </div>
        </div>

        <p className="text-[10px] text-[#94A3B8]">
          An incident ID will be generated automatically on submission. The record uses the standard incidental
          structure (source: Desk Officer · verification: new · severity: {severityMeta}).
        </p>
      </div>

      {confirmOpen && (
        <ConfirmModal
          type="confirm"
          tone="primary"
          title="Create this incident?"
          message={`This logs a new ${category} incident in ${purok} (${severityMeta} · ${priority} priority). It is added to the live map and work queues immediately.`}
          confirmLabel="Create Incident"
          cancelLabel="Back"
          onConfirm={() => { setConfirmOpen(false); submit(); }}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </Modal>
  );
}


function AnonymousLookupModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (inc: Incident | null, token: string) => void;
}) {
  const [token, setToken] = useState("");
  const incidents = getIncidents();

  function lookup() {
    const t = token.trim().toUpperCase().replace(/^ANON-/, "TK-");
    if (!t) return;
    const match = incidents.find((i) => i.anonymous && i.trackingToken === t);
    onResult(match ?? null, t);
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title="Anonymous Report Lookup"
      subtitle="Look up an anonymous report by tracking token — identity is never revealed"
      icon={<KeyRound size={18} />}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={lookup}
            className="flex-1 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#002A8C]"
          >
            Lookup
          </button>
        </div>
      }
    >
      <div>
        <p className="mb-1.5 text-[10px] font-medium tracking-wider text-[#94A3B8]">TRACKING TOKEN</p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? lookup() : undefined)}
          placeholder="TK-xxxx"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 font-mono text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
          Returns only the report status and purok. Reporter identity is masked behind the tracking
          token and is never displayed.
        </p>
        <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3">
          <p className="text-[10px] font-medium tracking-wider text-[#94A3B8]">ANONYMOUS REGISTRY</p>
          <p className="mt-1 font-mono text-[11px] text-stone-500">TK-4823 · TK-8842 · TK-7719 · TK-0000(T)</p>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  const block = "animate-pulse rounded-xl border border-black/5 bg-white/80";
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 border-b border-stone-200 pb-5">
          <div className={`${block} h-7 w-72`} />
          <div className={`${block} mt-3 h-4 w-96 max-w-full`} />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={`${block} h-16`} />
          <div className={`${block} h-16`} />
          <div className={`${block} h-16`} />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-28`} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={`${block} h-64`} />
          <div className={`${block} h-64`} />
          <div className={`${block} h-64`} />
        </div>
      </main>
    </div>
  );
}

function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <AlertTriangle size={14} className="text-amber-600" />
      <span className="text-[12px] font-medium text-amber-800">
        Connection interrupted — live data may be delayed. Showing the last received data.
      </span>
    </div>
  );
}

function SectionError({
  section,
  message,
  onRetry,
}: {
  section: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-4 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertTriangle size={16} />
      </div>
      <p className="text-[13px] font-semibold text-stone-800">{section} unavailable</p>
      <p className="max-w-sm text-[12px] text-stone-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-1 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
      >
        <RotateCcw size={12} />
        Retry
      </button>
    </div>
  );
}

interface SummaryCard {
  id: string;
  label: string;
  value: string;
  sub: string;
  icon: ComponentType<{ size?: number }>;
  onClick: () => void;
  accent: string;
  ring?: string;
  live?: boolean;
  priority?: boolean;
  pulse?: boolean;
}

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { incidents, dispatches } = useIncidentStore();
  const { flash, ToastPortal } = useToast();
  const { beep } = useAlertSound();
  const [composeBroadcast, setComposeBroadcast] = useState(false);
  const [composeNotice, setComposeNotice] = useState(false);
  const [composeSecurityAlert, setComposeSecurityAlert] = useState(false);
  const [composeManualIncident, setComposeManualIncident] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ inc: Incident | null; token: string } | null>(null);
  const [recentNotices, setRecentNotices] = useState(() => getSafetyNotices());
  const [requests, setRequests] = useState(() => getFootageRequests());
  const [tanods, setTanods] = useState<Tanod[]>(() => getTanods());
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [activeNoticeIncident, setActiveNoticeIncident] = useState<Incident | null>(null);
  const [selectedTanod, setSelectedTanod] = useState<Tanod | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<FootageRequest | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>(() => getActivity());
  const [emergencyPulse, setEmergencyPulse] = useState(false);
  const seenEmergencyRef = useRef<string[]>(
    incidents
      .filter((i) => i.priority === "High" || i.severity === "critical" || i.source === "sos")
      .map((i) => i.id)
  );

  const [booted, setBooted] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [failedSections, setFailedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 650);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      resyncAll();
      flash("Reconnected — live data refreshed", { title: "Live", type: "success" });
    };
    const onOffline = () => {
      setIsOnline(false);
      setFailedSections({ priority: true, responses: true, iot: true });
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function resyncAll() {
    setRecentNotices([...getSafetyNotices()]);
    setRequests([...getFootageRequests()]);
    setTanods([...getTanods()]);
    setActivity([...getActivity()]);
    setFailedSections({});
  }

  useEffect(() => {
    return subscribeSafetyNotices(() => {
      setRecentNotices([...getSafetyNotices()]);
    });
  }, []);

  useEffect(() => {
    return subscribeActivity(() => setActivity([...getActivity()]));
  }, []);

  useEffect(() => {
    return subscribeFootageRequests(() => setRequests([...getFootageRequests()]));
  }, []);

  useEffect(() => {
    return subscribeTanods(() => setTanods([...getTanods()]));
  }, []);

  // Card 3 — realtime High/Emergency arrival: highlight card, alert sound,
  // and initiate the linked CCTV footage-review workflow for new arrivals.
  const emergencyIncidents = useMemo(
    () =>
      incidents.filter(
        (i) =>
          i.status !== "resolved" &&
          i.status !== "closed_false_alarm" &&
          (i.priority === "High" || i.severity === "critical" || i.source === "sos")
      ),
    [incidents]
  );

  useEffect(() => {
    const fresh = emergencyIncidents.filter((i) => !seenEmergencyRef.current.includes(i.id));
    if (fresh.length === 0) return;
    seenEmergencyRef.current = [...seenEmergencyRef.current, ...fresh.map((i) => i.id)];
    setEmergencyPulse(true);
    const t = setTimeout(() => setEmergencyPulse(false), 5000);
    flash(
      `${fresh.map((i) => i.id).join(", ")} — High/Emergency incident requires attention`,
      { title: "Priority Alert" }
    );
    beep("critical");
    fresh.forEach((inc) => {
      const req = addFootageRequest({
        incidentId: inc.id,
        cameraId: "CAM-GATE-01",
        cameraName: "Main Gate",
        date: inc.time.slice(0, 10),
        startTime: "00:00",
        endTime: "10:00",
        eventTag: inc.category,
        purpose: `Auto-initiated CCTV review for ${inc.id} (${inc.category}).`,
        priority: "urgent",
        requestedBy: "Desk Officer",
        requestedByRole: "Barangay Desk Officer",
      });
      recordActivity({
        action: "video_request_submitted",
        kind: "request",
        incidentId: inc.id,
        refId: req?.id,
        actor: "Desk Officer",
        state: "Pending",
        target: "footage_requests",
      });
    });
    return () => clearTimeout(t);
  }, [emergencyIncidents, beep, flash]);

  const openIncidents = useMemo(
    () =>
      incidents
        .filter((i) => i.status !== "resolved" && i.status !== "closed_false_alarm")
        .sort((a, b) => {
          const ba = isSlaBreached(a) ? 1 : 0;
          const bb = isSlaBreached(b) ? 1 : 0;
          if (ba !== bb) return bb - ba;
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        }),
    [incidents]
  );

  const activeDispatches = useMemo(
    () => dispatches.filter((d) => d.status !== "resolved"),
    [dispatches]
  );

  const pendingRequests = useMemo(() => getPendingFootageRequests(), [requests]);

  const panelRequests = useMemo(
    () =>
      requests
        .filter((r) => r.status === "pending" || r.status === "in_progress" || r.status === "completed")
        .sort((a, b) => {
          if (a.status === "completed" && b.status !== "completed") return 1;
          if (b.status === "completed" && a.status !== "completed") return -1;
          return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
        }),
    [requests]
  );

  const viewRequest = (id: string) => setSelectedRequest(getFootageRequestById(id) ?? null);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const urgentClips = pendingRequests.filter((r) => r.priority === "urgent");

    const tierOf = (inc: Incident): number => {
      if (inc.source === "sos" || inc.severity === "critical") return 1;
      if (inc.priority === "High") return 2;
      if (inc.status === "new") return 3;
      const hasActiveDispatch = dispatches.some(
        (d) => d.incident === inc.id && d.status !== "resolved"
      );
      if (!hasActiveDispatch && !inc.assignedTeam) return 4;
      return 6;
    };

    const kindOf = (tier: number): Exclude<AttentionAction, "clip"> =>
      tier === 1 ? "respond" : tier === 2 || tier === 4 ? "dispatch" : tier === 3 ? "triage" : "follow_up";

    const incidentItems: AttentionItem[] = openIncidents.map((inc) => {
      const tier = tierOf(inc);
      const emergency = inc.source === "sos" || inc.severity === "critical";
      const tanod =
        inc.assignedTeam ?? dispatches.find((d) => d.incident === inc.id)?.team ?? null;
      const hasUrgentClip = urgentClips.some((r) => r.incidentId === inc.id);
      const clipId = urgentClips.find((r) => r.incidentId === inc.id)?.id;
      return {
        id: inc.id,
        kind: "incident",
        rank: tier,
        category: inc.category,
        location: inc.purok,
        receivedAt: inc.time,
        urgencyLabel: emergency ? EMERGENCY_URGENCY.label : inc.priority,
        urgencyChip: emergency ? EMERGENCY_URGENCY.chip : DESK_PRIORITY_META[inc.priority].chip,
        statusLabel: INCIDENT_STATUS_META[inc.status].label,
        statusBadge: INCIDENT_STATUS_META[inc.status].badge,
        tanod,
        action: hasUrgentClip
          ? "Review urgent video request"
          : ATTENTION_ACTION_TEXT[kindOf(tier)],
        actionType: hasUrgentClip ? "clip" : kindOf(tier),
        incident: inc,
        clipId,
      };
    });

    const clipItems: AttentionItem[] = urgentClips
      .filter((r) => !openIncidents.some((i) => i.id === r.incidentId))
      .map((r) => {
        const inc = incidents.find((i) => i.id === r.incidentId);
        return {
          id: r.id,
          kind: "clip" as const,
          rank: 5,
          category: inc?.category ?? "Video Clip Request",
          location: inc?.purok ?? "—",
          receivedAt: r.requestedAt,
          urgencyLabel: "Urgent",
          urgencyChip: "bg-rose-100 text-rose-700",
          statusLabel: r.status === "in_progress" ? "In Progress" : "Pending",
          statusBadge: r.status === "in_progress" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700",
          tanod: null,
          action: "Review video clip request",
          actionType: "clip" as const,
          incident: inc ?? ({} as Incident),
          clipId: r.id,
        };
      });

    return [...incidentItems, ...clipItems].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
  }, [openIncidents, dispatches, incidents, pendingRequests]);

  const activeResponseItems = useMemo(
    () =>
      activeDispatches.map((d) => {
        const incident = incidents.find((i) => i.id === d.incident) ?? null;
        const tanod = getTanodByName(d.team) ?? null;
        const clip = requests.find(
          (r) => r.incidentId === d.incident && (r.status === "pending" || r.status === "in_progress")
        );
        const cctvLabel = clip
          ? clip.status === "in_progress"
            ? "Reviewing"
            : "Requested"
          : "Not requested";
        const tanodStatus: TanodStatus = tanod
          ? tanod.status
          : d.status === "on_scene"
            ? "on_scene"
            : d.status === "responding"
              ? "en_route"
              : "available";
        return { dispatch: d, incident, tanod, cctvLabel, tanodStatus };
      }),
    [activeDispatches, incidents, requests, tanods]
  );

  const sensors = [
    { name: "SM-GATE-01", type: "Smoke", purok: "Purok 1", status: "online", value: 512, threshold: 500 },
    { name: "SM-PUROK3-01", type: "Smoke", purok: "Purok 3", status: "offline", value: 0, threshold: 500 },
    { name: "DB-HALL-01", type: "Noise", purok: "Purok 4", status: "warning", value: 78, threshold: 85 },
    { name: "DB-MARKET-01", type: "Noise", purok: "Purok 6", status: "online", value: 62, threshold: 85 },
    { name: "SM-CHAPEL-01", type: "Smoke", purok: "Purok 5", status: "online", value: 45, threshold: 500 },
    { name: "SM-PLAZA-02", type: "Smoke", purok: "Purok 2", status: "online", value: 85, threshold: 500 },
  ];

  const newIncidents = openIncidents.filter((i) => i.status === "new");
  const highIncidents = openIncidents.filter((i) => i.priority === "High");
  const emergencyIncidentsOpen = openIncidents.filter(
    (i) => i.severity === "critical" || i.source === "sos"
  );
  const completedRequests = requests.filter(
    (r) => r.status === "completed"
  ).length;

  const summaryCards: SummaryCard[] = [
    {
      id: "new",
      label: "NEW / PENDING REPORTS",
      value: String(newIncidents.length),
      sub: `${newIncidents.filter((i) => i.source === "sos").length} SOS · ${newIncidents.filter((i) => i.verificationStatus === "new").length} pending review`,
      icon: Inbox,
      live: newIncidents.some((i) => i.source === "sos" || i.verificationStatus === "new"),
      onClick: () => goTriage("new"),
      accent: "bg-sky-50 text-sky-600",
      ring: emergencyPulse ? "" : "hover:border-sky-300",
    },
    {
      id: "active",
      label: "ACTIVE CASES",
      value: String(openIncidents.length),
      sub: `${openIncidents.length} open · ${activeDispatches.length} active responses`,
      icon: Layers,
      onClick: () => go("incident_triage"),
      accent: "bg-[#E9EDFB] text-[#0038A8]",
      ring: "hover:border-[#0038A8]/30",
    },
    {
      id: "emergency",
      label: "HIGH / EMERGENCY",
      value: String(highIncidents.length),
      sub: `${emergencyIncidentsOpen.length} emergency · ${highIncidents.length} high`,
      icon: AlertOctagon,
      priority: true,
      pulse: emergencyPulse,
      onClick: () => goTriage("high"),
      accent: "bg-rose-100 text-rose-600",
      ring: emergencyPulse ? "animate-pulse border-rose-400" : "hover:border-rose-300",
    },
    {
      id: "video",
      label: "PENDING VIDEO CLIP REQUESTS",
      value: String(pendingRequests.length),
      sub: `${pendingRequests.filter((r) => r.status === "in_progress").length} in progress · ${completedRequests} completed`,
      icon: Video,
      onClick: () => go("footage_requests"),
      accent: "bg-teal-50 text-teal-700",
      ring: "hover:border-teal-300",
    },
  ];

  function go(page: string) {
    if (onNavigate) onNavigate(page);
  }

  function goTriage(target?: "new" | "high") {
    if (target) setDeskTriageTarget(target);
    go("incident_triage");
  }

  // Part 9 — Recent Activity row → associated record (deep-link where possible).
  function openActivityTarget(ev: ActivityEvent) {
    if (ev.incidentId && (ev.kind === "incident" || ev.kind === "closure")) {
      setDeskCaseTarget({ incidentId: ev.incidentId });
      go("incident_triage");
      return;
    }
    go(ev.target);
  }

  function quickAction(label: string, sub: string, onClick: () => void, icon: typeof PlusCircle) {
    const Icon = icon;
    return (
      <button
        key={label}
        onClick={onClick}
        className="group flex flex-1 items-center gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm transition hover:border-[#0038A8]/30 hover:bg-[#E9EDFB]/50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[12px] font-semibold text-[#334155]">{label}</p>
          <p className="truncate text-[10px] text-[#94A3B8]">{sub}</p>
        </div>
        <ArrowUpRight size={14} className="text-[#94A3B8] opacity-0 transition group-hover:opacity-100" />
      </button>
    );
  }

  function handleManualIncidentCreated(inc: Incident) {
    setActiveIncident(inc);
    const urgent = inc.priority === "High" || inc.severity === "critical";
    let newRequest: FootageRequest | undefined;
    if (urgent) {
      newRequest = addFootageRequest({
        incidentId: inc.id,
        cameraId: "CAM-GATE-01",
        cameraName: "Main Gate",
        date: inc.time.slice(0, 10),
        startTime: "00:00",
        endTime: "10:00",
        eventTag: inc.category,
        purpose: `Auto-initiated CCTV review for manually logged ${inc.id} (${inc.category}).`,
        priority: "urgent",
        requestedBy: "Desk Officer",
        requestedByRole: "Barangay Desk Officer",
      });
    }
    recordActivity({
      action: "incident_received",
      kind: "incident",
      incidentId: inc.id,
      actor: inc.reporter || "Desk Officer",
      state: `New · ${inc.category}`,
      severity: inc.severity === "critical" ? "high" : undefined,
      target: "incident_triage",
    });
    if (newRequest) {
      recordActivity({
        action: "video_request_submitted",
        kind: "request",
        incidentId: inc.id,
        refId: newRequest.id,
        actor: "Desk Officer",
        state: "Pending",
        target: "footage_requests",
      });
    }
    beep("info");
    flash(
      `${inc.id} created — ${inc.category} (${inc.priority}) at ${inc.purok}.` +
        (urgent ? " High urgency: CCTV footage request auto-initiated and added to the queue." : " Added to the dashboard, live map and work queues."),
      { title: "Manual Incident Created" }
    );
  }

  return !booted ? (
    <LoadingSkeleton />
  ) : (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      {!isOnline && <OfflineBanner />}
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Command &amp; Monitoring Center</h1>
              <p className="mt-1 text-sm text-stone-500">
                Live operational overview — incidents, responses, alerts &amp; field status
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setLookupOpen(true)}
                title="Anonymous Report Lookup"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
              >
                <KeyRound size={13} />
                <span className="hidden sm:inline">Anonymous Lookup</span>
              </button>
              <button
                onClick={() => setComposeNotice(true)}
                title="Publish Safety Notice"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-[12px] font-medium text-white transition hover:bg-[#115e59]"
              >
                <Info size={13} />
                <span className="hidden sm:inline">Publish Notice</span>
              </button>
              <button
                onClick={() => setComposeBroadcast(true)}
                title="Mass Broadcast"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[12px] font-medium text-white transition hover:bg-[#002A8C]"
              >
                <Megaphone size={13} />
                <span className="hidden sm:inline">Mass Broadcast</span>
              </button>
            </div>
          </div>
        </header>

        {/* Quick Actions */}
        <section className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            {quickAction(
              "Create Manual Incident",
              "Log a manual incident to the dashboard",
              () => setComposeManualIncident(true),
              PlusCircle
            )}
            {quickAction(
              "Create Alert",
              "Send a security alert to field units & residents",
              () => setComposeSecurityAlert(true),
              AlertTriangle
            )}
            {quickAction(
              "Open Blotter Search",
              "Search the official blotter by ID, date, type, location & status",
              () => go("blotter"),
              FileSearch
            )}
          </div>
        </section>

        {/* Operational Summary Cards */}
        <section className="mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.id}
                onClick={card.onClick}
                className={`group relative rounded-xl border bg-white px-5 py-4 shadow-sm transition ${
                  onNavigate ? "cursor-pointer" : ""
                } ${card.pulse ? "border-rose-400 shadow-[0_0_0_4px_rgba(244,63,94,0.15)]" : card.ring ?? "hover:border-stone-300"} ${
                  card.priority ? "border-rose-200" : "border-black/5"
                }`}
              >
                {card.id === "new" && card.live && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-semibold text-sky-700">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                    </span>
                    New
                  </span>
                )}
                {card.id === "emergency" && card.pulse && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600">
                    <BellRing size={9} />
                    Alert
                  </span>
                )}
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                    {card.label}
                  </span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.accent}`}>
                    <card.icon size={15} />
                  </div>
                </div>
                <div className={`mt-2 text-[26px] font-bold ${card.priority ? "text-rose-600" : "text-[#0038A8]"}`}>
                  {card.value}
                </div>
                <div className={`mt-1 text-[11px] ${card.priority ? "text-rose-500" : "text-[#94A3B8]"}`}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main content: Live Incident Map + Priority Attention */}
        <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Live Incident Map */}
          <div className="xl:col-span-2 rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Live Incident Map</h3>
                  <p className="text-[11px] text-[#94A3B8]">Open incidents plotted by purok zone</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-stone-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Low
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> High
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-600 ring-2 ring-red-200" /> Emergency
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="relative mx-auto max-w-[640px]">
                <svg viewBox="0 0 440 400" preserveAspectRatio="xMidYMid meet" className="h-auto w-full">
                  {PUROK_ZONES.map((zone) => {
                    const zoneIncidents = openIncidents.filter((i) => i.purok === zone.name);
                    const hasCritical =
                      zoneIncidents.some(
                        (i) => i.severity === "critical" || i.source === "sos" || i.priority === "High"
                      ) ||
                      sensorRisk(sensors.find((s) => s.purok === zone.name) ?? { status: "online", value: 0, threshold: 1 }) !== "online";
                    const isHovered = hoveredZone === zone.id;
                    return (
                      <g
                        key={zone.id}
                        onMouseEnter={() => setHoveredZone(zone.id)}
                        onMouseLeave={() => setHoveredZone(null)}
                        onClick={() => {
                          const first = zoneIncidents[0];
                          if (first) setActiveIncident(first);
                        }}
                        className="cursor-pointer"
                      >
                        <path
                          d={zone.path}
                          fill={isHovered ? "#dbe3fb" : hasCritical ? "#fef2f2" : "#F8FAFC"}
                          stroke={hasCritical ? "#dc2626" : zone.color}
                          strokeWidth={hasCritical ? 2 : 1.5}
                          strokeOpacity={isHovered ? 1 : 0.6}
                          className="transition-colors duration-200"
                        />
                        <text
                          x={zone.labelX}
                          y={zone.labelY}
                          textAnchor="middle"
                          className="pointer-events-none select-none"
                          fontSize="10"
                          fontWeight="500"
                          fill={zone.color}
                          opacity={0.85}
                        >
                          {zone.name}
                        </text>
                        {zoneIncidents.length > 0 && (
                          <g className="pointer-events-none">
                            <circle cx={zone.labelX + 32} cy={zone.labelY - 8} r={8} fill="#0038A8" opacity={0.9} />
                            <text x={zone.labelX + 32} y={zone.labelY - 4.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
                              {zoneIncidents.length}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {openIncidents.slice(0, 14).map((inc, idx) => {
                    const zone = zoneByName(inc.purok);
                    if (!zone) return null;
                    const others = openIncidents.filter((i) => i.purok === inc.purok && i.id !== inc.id).length;
                    const slot = others > 0 ? idx % 5 : 0;
                    const ox = slot === 0 ? 0 : (slot - 1) * 8;
                    const oy = slot === 1 ? -10 : slot === 2 ? 10 : slot === 3 ? -18 : 18;
                    const cx = zone.labelX + ox;
                    const cy = zone.labelY + 8 + oy;
                    const isSos = inc.source === "sos";
                    const emergency = isSos || inc.severity === "critical";
                    const color = emergency
                      ? "#dc2626"
                      : inc.priority === "High"
                        ? "#f43f5e"
                        : inc.priority === "Medium"
                          ? "#f59e0b"
                          : "#0ea5e9";
                    const urgency = emergency ? "Emergency" : `${inc.priority} priority`;
                    const isActive = activeIncident?.id === inc.id;
                    const status = INCIDENT_STATUS_META[inc.status];
                    return (
                      <g key={inc.id} onClick={() => setActiveIncident(inc)} className="cursor-pointer">
                        <title>
                          {`${inc.id} — ${inc.category}\nUrgency: ${urgency}\nLocation: ${inc.purok}\nStatus: ${status.label}`}
                        </title>
                        {emergency && (
                          <circle cx={cx} cy={cy} r={10} fill="none" stroke="#dc2626" strokeWidth={1.5} opacity={0.5} className="animate-ping" />
                        )}
                        {isActive && (
                          <circle cx={cx} cy={cy} r={emergency ? 12 : 10} fill="none" stroke="#0038A8" strokeWidth={1.5} />
                        )}
                        <circle cx={cx} cy={cy} r={emergency ? 7 : 5.5} fill={color} stroke="white" strokeWidth={1.5} className="drop-shadow" />
                        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="5" fontWeight="700" fill="white">
                          {isSos ? "!" : emergency ? "E" : ""}
                        </text>
                        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="7" fontWeight="600" fill="#334155">
                          {inc.id}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {activeIncident ? (
                <IncidentPreviewPanel
                  inc={activeIncident}
                  handlers={{
                    onClose: () => setActiveIncident(null),
                    onOpenCase: () => {
                      setDeskCaseTarget({ incidentId: activeIncident.id });
                      go("incident_triage");
                    },
                    onAssign: () => {
                      setDeskCaseTarget({ incidentId: activeIncident.id, openDispatch: true });
                      go("incident_triage");
                    },
                    onRequestClip: () => {
                      const req = addFootageRequest({
                        incidentId: activeIncident.id,
                        cameraId: "CAM-GATE-01",
                        cameraName: "Main Gate",
                        date: activeIncident.time.slice(0, 10),
                        startTime: "00:00",
                        endTime: "10:00",
                        eventTag: activeIncident.category,
                        purpose: `Video clip requested for ${activeIncident.id} (${activeIncident.category}), ${activeIncident.purok}.`,
                        priority: activeIncident.priority === "High" ? "urgent" : "standard",
                        requestedBy: "Desk Officer",
                        requestedByRole: "Barangay Desk Officer",
                      });
                      recordActivity({
                        action: "video_request_submitted",
                        kind: "request",
                        incidentId: activeIncident.id,
                        refId: req?.id,
                        actor: "Desk Officer",
                        state: "Pending",
                        target: "footage_requests",
                      });
                      flash(`${activeIncident.id} CCTV review requested`, { title: "Video Clip Request Filed" });
                      go("footage_requests");
                    },
                    onCreateAlert: () => {
                      setActiveNoticeIncident(activeIncident);
                      setComposeNotice(true);
                    },
                  }}
                />
              ) : (
                <p className="mt-3 text-center text-[11px] text-[#94A3B8]">
                  Hover a purok to highlight it · click a pin for incident details
                </p>
              )}
            </div>
          </div>

          {/* Priority Attention */}
          <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
              <Siren size={16} className="text-rose-600" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Priority Attention</h3>
                <p className="text-[11px] text-[#94A3B8]">High-priority &amp; SOS incidents requiring immediate awareness</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto db-scroll">
              {failedSections.priority ? (
                <div className="px-5 py-8">
                  <SectionError
                    section="Priority Attention"
                    message="Live incident feed could not be refreshed from the command channel."
                    onRetry={() => resyncAll()}
                  />
                </div>
              ) : attentionItems.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-400" />
                  <p className="mt-2 text-[13px] font-medium text-stone-500">No items require attention</p>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">All clear — nothing needs action right now</p>
                </div>
              ) : (
                attentionItems.slice(0, 8).map((item) => {
                  const emergency = item.rank === 1;
                  const ic = item.incident;
                  const CatIcon = item.kind === "clip" ? Video : (CATEGORY_ICON[ic.category] ?? ClipboardList);
                  const openIncident = () => {
                    if (!ic.id) return;
                    setDeskCaseTarget({ incidentId: ic.id });
                    go("incident_triage");
                  };
                  const dispatch = () => {
                    if (!ic.id) return;
                    setDeskCaseTarget({ incidentId: ic.id, openDispatch: true });
                    go("incident_triage");
                  };
                  const openClip = () => go("footage_requests");
                  return (
                    <div
                      key={item.kind === "clip" ? item.id : item.incident.id}
                      className={`border-b border-black/5 px-5 py-3 last:border-0 ${
                        emergency ? "border-l-2 border-l-red-500 bg-rose-50/70" : "border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          emergency
                            ? "bg-rose-100 text-rose-600"
                            : item.actionType === "clip"
                              ? "bg-teal-50 text-teal-700"
                              : "bg-[#E9EDFB] text-[#0038A8]"
                        }`}>
                          <CatIcon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${item.urgencyChip}`}>
                              {item.urgencyLabel}
                            </span>
                            <span className="text-[12px] font-semibold text-[#334155]">{item.id}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${item.statusBadge}`}>{item.statusLabel}</span>
                            {emergency && (
                              <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600">
                                <Siren size={9} /> {ic.source === "sos" ? "SOS" : "Now"}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium text-[#334155]">{item.category}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#94A3B8]">
                            <span className="flex items-center gap-1"><MapPin size={10} /> {item.location}</span>
                            <span className="flex items-center gap-1"><Clock size={10} /> {formatTimeAgo(item.receivedAt)}</span>
                            {item.tanod && (
                              <span className="flex items-center gap-1"><UserCheck size={10} /> {item.tanod}</span>
                            )}
                          </div>
                          <p className={`mt-1.5 text-[10px] font-medium ${emergency ? "text-rose-600" : "text-[#0f766e]"}`}>
                            Action: {item.action}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.kind === "incident" && ic.id && (
                              <button
                                onClick={openIncident}
                                className="inline-flex items-center gap-1 rounded-md bg-[#0038A8] px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-[#002A8C]"
                              >
                                Open Incident <ArrowUpRight size={10} />
                              </button>
                            )}
                            {item.actionType === "dispatch" && ic.id && (
                              <button
                                onClick={dispatch}
                                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                              >
                                Dispatch <ArrowRight size={10} />
                              </button>
                            )}
                            {item.actionType === "clip" && (
                              <button
                                onClick={openClip}
                                className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-white px-2.5 py-1 text-[10px] font-medium text-teal-700 transition hover:bg-teal-50"
                              >
                                Video Request <Video size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Secondary: Active Responses + Pending Video Clip Requests */}
        <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Active Responses */}
          <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Active Responses</h3>
                  <p className="text-[11px] text-[#94A3B8]">Field units currently responding</p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => go("dispatches")}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#0038A8] hover:underline"
                >
                  Open Dispatches <ArrowRight size={11} />
                </button>
              )}
            </div>

            {/* Compact responder availability indicator */}
            <div className="border-b border-stone-100 px-5 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Responder Availability</p>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {tanods.filter((t) => t.status === "available").length} available
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tanods.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTanod(t);
                      setActiveIncident(null);
                    }}
                    title={`${t.name} — ${TANOD_STATUS_META[t.status].label}`}
                    className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
                  >
                    <span className={`h-2 w-2 rounded-full ${TANOD_STATUS_META[t.status].dot}`} />
                    {t.name}
                    <span className="text-[9px] text-stone-400">{TANOD_STATUS_META[t.status].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Tanod info panel */}
            {selectedTanod && (
              <div className="border-b border-stone-100 bg-[#E9EDFB]/40 px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0038A8] text-white">
                      <UserCheck size={14} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-[#334155]">{selectedTanod.name}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TANOD_STATUS_META[selectedTanod.status].chip}`}>
                        {TANOD_STATUS_META[selectedTanod.status].label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTanod(null)}
                    className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-500 hover:bg-stone-100"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[#64748B] sm:grid-cols-3">
                  <span>Assignment: <b className="text-stone-700">{selectedTanod.assignment ?? "None"}</b></span>
                  <span>Incident: <b className="text-stone-700">{selectedTanod.incidentId ?? "None"}</b></span>
                  <span>Location: <b className="text-stone-700">{selectedTanod.purok}</b></span>
                </div>
                {selectedTanod.statusHistory.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-medium text-[#0038A8] hover:underline">
                      Status history ({selectedTanod.statusHistory.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {selectedTanod.statusHistory.slice(0, 4).map((h, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#64748B]">
                          <span className={`h-1.5 w-1.5 rounded-full ${TANOD_STATUS_META[h.status].dot}`} />
                          {TANOD_STATUS_META[h.status].label} · {formatElapsed(h.at)} ago
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-2 text-[10px] text-[#94A3B8]">No status changes recorded yet.</p>
                )}
                <button
                  onClick={() => {
                    const assignId =
                      selectedTanod.incidentId ??
                      openIncidents.find((i) => !i.assignedTeam && i.priority === "High")?.id ??
                      openIncidents.find((i) => !i.assignedTeam)?.id;
                    if (!assignId) {
                      flash("No unassigned open incident is available to assign to this responder.", {
                        title: "Nothing to Assign",
                      });
                      return;
                    }
                    setDeskCaseTarget({ incidentId: assignId, openDispatch: true });
                    go("incident_triage");
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#0038A8] px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-[#002A8C]"
                >
                  Assign Incident <Navigation size={10} />
                </button>
              </div>
            )}

            <div className="max-h-[360px] overflow-y-auto db-scroll">
              {failedSections.responses ? (
                <div className="px-5 py-8">
                  <SectionError
                    section="Active Responses"
                    message="Live field response tracking could not be refreshed. Responder positions may be stale."
                    onRetry={() => resyncAll()}
                  />
                </div>
              ) : activeResponseItems.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-400" />
                  <p className="mt-2 text-[13px] font-medium text-stone-500">No active responses</p>
                </div>
              ) : (
                activeResponseItems.map((item) => {
                  const { dispatch: d, incident, tanod, cctvLabel, tanodStatus } = item;
                  const incId = incident?.id ?? d.incident;
                  const lastUpdate =
                    d.status === "resolved"
                      ? `${d.team} completed response`
                      : d.status === "on_scene"
                        ? `${d.team} on scene`
                        : d.status === "resolving"
                          ? `${d.team} handling on scene`
                          : `${d.team} en route — ${d.eta}`;
                  const openCase = () => {
                    setDeskCaseTarget({ incidentId: incId });
                    go("incident_triage");
                  };
                  return (
                    <div
                      key={d.id}
                      onClick={openCase}
                      className="cursor-pointer border-b border-black/5 px-5 py-3 transition last:border-0 hover:bg-[#E9EDFB]/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                          <Navigation size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-[#334155]">{incId}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TANOD_STATUS_META[tanodStatus].chip}`}>
                              {TANOD_STATUS_META[tanodStatus].label}
                            </span>
                            <span className={`flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-semibold text-teal-700`}>
                              <Video size={9} /> {cctvLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{incident?.category ?? "Unknown type"}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <UserCheck size={10} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (tanod) setSelectedTanod(tanod);
                                }}
                                className={`font-medium ${tanod ? "cursor-pointer text-[#0038A8] hover:underline" : "cursor-default"}`}
                              >
                                {d.team}
                              </button>
                            </span>
                            <span className="flex items-center gap-1"><MapPin size={10} /> {d.purok}</span>
                            <span className="flex items-center gap-1"><Clock size={10} /> {formatElapsed(d.dispatchedAt)}</span>
                          </div>
                          <p className="mt-1 truncate text-[10px] text-[#334155]">{lastUpdate}</p>
                        </div>
                        <ArrowUpRight size={14} className="mt-1 shrink-0 text-[#94A3B8]" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending Video Clip Requests */}
          <div className="flex flex-col rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-[#0f766e]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Pending Video Clip Requests</h3>
                  <p className="text-[11px] text-[#94A3B8]">Desk Officer ↔ CCTV Operator · footage requests</p>
                </div>
              </div>
              <span className="rounded-full bg-[#0f766e]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0f766e]">
                {panelRequests.filter((r) => r.status !== "completed").length} open
              </span>
            </div>
            <div className="max-h-[360px] overflow-y-auto db-scroll">
              {panelRequests.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-400" />
                  <p className="mt-2 text-[13px] font-medium text-stone-500">No video clip requests</p>
                  <p className="text-[11px] text-[#94A3B8]">All footage requests have been resolved.</p>
                </div>
              ) : (
                panelRequests.map((r: FootageRequest) => {
                  const meta = REQUEST_STATUS_META[r.status];
                  const evidenceReady = r.status === "completed";
                  return (
                    <div
                      key={r.id}
                      onClick={() => viewRequest(r.id)}
                      className={`flex items-start gap-3 border-b border-black/5 px-5 py-3 transition last:border-0 ${
                        evidenceReady ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "cursor-pointer hover:bg-[#E9EDFB]/40"
                      }`}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        r.priority === "urgent" ? "bg-rose-100 text-rose-600" : "bg-teal-50 text-teal-700"
                      }`}>
                        {evidenceReady ? <BadgeCheck size={14} /> : <Video size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-[#334155]">{r.id}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.badge}`}>
                            {meta.label}
                          </span>
                          {r.priority === "urgent" && r.status !== "completed" && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600">
                              Urgent
                            </span>
                          )}
                          {evidenceReady && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                              <BadgeCheck size={9} /> Evidence Ready
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5 text-[10px] text-[#64748B]">
                          <p className="truncate">
                            <span className="text-[#94A3B8]">Incident:</span> <span className="font-semibold text-[#0038A8]">{r.incidentId ?? "—"}</span>
                          </p>
                          <p className="truncate"><span className="text-[#94A3B8]">Camera:</span> {r.cameraName || r.cameraId || "Any"}</p>
                          <p className="truncate">
                            <span className="text-[#94A3B8]">Time:</span>{" "}
                            <span className="font-mono">{r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "Any"}</span>
                            {r.date ? ` · ${r.date}` : ""}
                          </p>
                          <p className="line-clamp-1 italic text-[#94A3B8]">{r.purpose}</p>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                          <Clock size={10} /> Requested {formatTimeAgo(r.requestedAt)}
                        </p>
                      </div>
                      <ArrowUpRight size={14} className="mt-1 shrink-0 text-[#94A3B8]" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Part 9 — Recent Activity */}
        <section className="mb-6">
          {/* Recent Activity */}
          <div className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">Recent Activity</h3>
                  <p className="text-[11px] text-[#94A3B8]">Chronological operational feed</p>
                </div>
              </div>
            </div>
            <div className="max-h-[360px] divide-y divide-stone-50 overflow-y-auto">
              {activity.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Activity size={24} className="mx-auto text-stone-300" />
                  <p className="mt-2 text-[12px] text-stone-400">No activity recorded yet</p>
                </div>
              ) : (
                activity.slice(0, 10).map((ev) => {
                  const Icon = ACTIVITY_ICON[ev.kind];
                  const color = ACTIVITY_KIND_COLOR[ev.kind];
                  return (
                    <button
                      key={ev.id}
                      onClick={() => openActivityTarget(ev)}
                      className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-[#E9EDFB]/40"
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-[12px] font-medium text-stone-800">
                          {activityActionLabel(ev.action)}
                          {ev.incidentId && (
                            <span className="rounded bg-[#0038A8]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#0038A8]">
                              {ev.incidentId}
                            </span>
                          )}
                          {ev.refId && !ev.incidentId && (
                            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-500">
                              {ev.refId}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{ev.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[#94A3B8]">
                          <Clock size={9} /> {formatTimeAgo(ev.at)}
                          <span>·</span>
                          <span>{ev.actor}</span>
                          <span>·</span>
                          <span className="font-medium text-stone-500">{ev.state}</span>
                        </div>
                      </div>
                      <ArrowUpRight size={12} className="mt-1 shrink-0 text-[#94A3B8]" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Recent Notices */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-[#0f766e]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#334155]">Recent Notices</h3>
                <p className="text-[11px] text-[#94A3B8]">Safety notices &amp; bulletins</p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => setComposeNotice(true)}
                className="text-[11px] font-medium text-[#0f766e] hover:underline"
              >
                New
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentNotices.length === 0 ? (
              <div className="col-span-full px-5 py-8 text-center">
                <Info size={24} className="mx-auto text-stone-300" />
                <p className="mt-2 text-[12px] text-stone-400">No notices published yet</p>
              </div>
            ) : (
              recentNotices.slice(0, 6).map((n) => (
                <div key={n.id} className="rounded-lg border border-stone-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[#334155]">{n.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      n.state === "published"
                        ? "bg-emerald-50 text-emerald-700"
                        : n.state === "draft"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-stone-100 text-stone-500"
                    }`}>
                      {n.state}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {n.category} · {n.target.kind === "barangay" ? "Entire Barangay" : n.target.purok}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                    <Clock size={10} /> {formatTimeAgo(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Header modals */}
      {composeBroadcast && (
        <BroadcastCompose
          onClose={() => setComposeBroadcast(false)}
          onQueued={(draft) => {
            const needsApproval = draft.deliveryMethod === "push+sms";
            recordActivity({
              action: needsApproval ? "alert_created" : "alert_sent",
              kind: "alert",
              refId: draft.id,
              actor: "Desk Officer",
              state: needsApproval ? "Pending Approval" : "Sent",
              severity: needsApproval ? "high" : undefined,
              target: "security_alerts",
            });
            flash(
              needsApproval
                ? `${draft.id} — ${draft.title} queued for Punong Barangay approval. Nothing was broadcast until approved.`
                : `${draft.id} — quiet push sent to relevant field roles.`,
              { title: needsApproval ? "Awaiting Captain Authorization" : "Broadcast Sent" }
            );
          }}
        />
      )}
      {composeNotice && (
        <SafetyNoticeCompose
          onClose={() => setComposeNotice(false)}
          onSaved={(state, notice) => {
            recordActivity({
              action: state === "published" ? "alert_sent" : "alert_created",
              kind: "alert",
              incidentId: notice.incidentId,
              refId: notice.id,
              actor: notice.author,
              state: state === "published" ? "Sent" : "Draft",
              target: "security_alerts",
            });
            flash(
              `Notice ${state === "published" ? "published" : "saved"} successfully.`,
              { title: state === "published" ? "Safety Notice Published" : "Safety Notice Saved as Draft" }
            );
          }}
          preselectIncident={
            activeNoticeIncident
              ? {
                  id: activeNoticeIncident.id,
                  category: activeNoticeIncident.category,
                  purok: activeNoticeIncident.purok,
                }
              : undefined
          }
        />
      )}
      {composeSecurityAlert && (
        <SafetyNoticeCompose
          mode="security"
          onClose={() => setComposeSecurityAlert(false)}
          onSaved={(_state, notice) => {
            if (!notice) return;
            const pending = notice.severity === "High" && notice.approvalStatus === "pending";
            recordActivity({
              action: pending ? "alert_created" : "alert_sent",
              kind: "alert",
              incidentId: notice.incidentId,
              refId: notice.id,
              actor: notice.author,
              state: pending ? "Pending Approval" : "Sent",
              severity: notice.severity === "High" ? "high" : notice.severity === "Warning" ? "high" : "normal",
              target: "security_alerts",
            });
            if (pending) {
              flash(
                `${notice.id} — High-severity alert queued. Awaiting Punong Barangay authorization before distribution.`,
                { title: "Pending Captain Approval" }
              );
            } else {
              flash(
                `${notice.id} — Security alert published to the selected target zone.`,
                { title: "Security Alert Sent" }
              );
            }
          }}
          preselectIncident={
            activeNoticeIncident
              ? {
                  id: activeNoticeIncident.id,
                  category: activeNoticeIncident.category,
                  purok: activeNoticeIncident.purok,
                }
              : undefined
          }
        />
      )}
      {composeManualIncident && (
        <CreateManualIncidentModal
          onClose={() => setComposeManualIncident(false)}
          onCreated={handleManualIncidentCreated}
        />
      )}
      {lookupOpen && (
        <AnonymousLookupModal
          onClose={() => setLookupOpen(false)}
          onResult={(inc, token) => setLookupResult({ inc, token })}
        />
      )}
      {lookupResult && (
        <ConfirmModal
          type="success"
          title={lookupResult.inc ? `Report ${lookupResult.inc.id} Found` : "No Matching Report"}
          message={
            lookupResult.inc
              ? `Token ${lookupResult.token} — status: ${INCIDENT_STATUS_META[lookupResult.inc.status].label} · ${lookupResult.inc.purok}.`
              : `No anonymous report matched token ${lookupResult.token}. Reporter identity remains protected.`
          }
          onClose={() => setLookupResult(null)}
        />
      )}
      {selectedRequest && (
        <VideoRequestDetail
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onMarkCompleted={() => {
            setFootageRequestStatus(selectedRequest.id, "completed");
            setSelectedRequest(getFootageRequestById(selectedRequest.id) ?? null);
            setRequests([...getFootageRequests()]);
            recordActivity({
              action: "video_request_completed",
              kind: "request",
              incidentId: selectedRequest.incidentId,
              refId: selectedRequest.id,
              actor: selectedRequest.requestedBy,
              state: "Completed",
              target: "footage_requests",
            });
            beep("info");
            flash(`${selectedRequest.id} marked as completed — Evidence Ready.`, { title: "Evidence Ready" });
          }}
          onAttachToBlotter={() => {
            const clipRef = selectedRequest.clips?.[0]?.id ?? selectedRequest.id;
            recordActivity({
              action: "cctv_update",
              kind: "cctv",
              incidentId: selectedRequest.incidentId,
              refId: clipRef,
              actor: "Desk Officer",
              state: "Completed",
              target: "blotter",
            });
            flash(
              `${clipRef} attached to the record for ${selectedRequest.incidentId} — complete archival in the Official Blotter.`,
              { title: "Evidence Attached" }
            );
            go("blotter");
            setSelectedRequest(null);
          }}
        />
      )}
      {ToastPortal && <ToastPortal />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident spotlight card (shown below the live map when a pin is selected)
// ---------------------------------------------------------------------------

const CCTV_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function IncidentPreviewPanel({
  inc,
  handlers,
}: {
  inc: Incident;
  handlers: {
    onClose: () => void;
    onOpenCase: () => void;
    onAssign: () => void;
    onRequestClip: () => void;
    onCreateAlert: () => void;
  };
}) {
  const sev = SEVERITY_MAP[inc.severity as keyof typeof SEVERITY_MAP] ?? SEVERITY_MAP.low;
  const status = INCIDENT_STATUS_META[inc.status];
  const source = SOURCE_META[inc.source];
  const CatIcon = CATEGORY_ICON[inc.category] ?? ClipboardList;
  const breachedFlag = isSlaBreached(inc);
  const emergency = inc.source === "sos" || inc.severity === "critical";
  const urgency = emergency
    ? { label: "Emergency", chip: "bg-red-100 text-red-700" }
    : { label: inc.priority, chip: DESK_PRIORITY_META[inc.priority].chip };

  const footReq = getFootageRequests().find((r) => r.incidentId === inc.id);
  const cctvLabel = footReq
    ? CCTV_STATUS_LABEL[footReq.status] ?? footReq.status
    : "Not requested";
  const alertStatus = inc.relatedAlertId ? inc.relatedAlertId : null;

  const assigned = inc.assignedTeam ?? getDispatches().find((d) => d.incident === inc.id)?.team ?? null;

  const latestUpdate = useMemo(() => {
    const upd: { at: number; text: string }[] = [
      { at: new Date(inc.time).getTime(), text: `Report received — ${inc.reporter}` },
    ];
    if (inc.acknowledgedAt) {
      upd.push({ at: new Date(inc.acknowledgedAt).getTime(), text: "Acknowledged by desk officer" });
    }
    const disp = getDispatches().find((d) => d.incident === inc.id);
    if (disp) {
      upd.push({
        at: new Date(disp.dispatchedAt ?? inc.time).getTime(),
        text: `${disp.team} ${disp.status === "resolved" ? "completed" : disp.status.replace(/_/g, " ")}`,
      });
    }
    if (inc.resolvedAt) upd.push({ at: new Date(inc.resolvedAt).getTime(), text: "Incident resolved" });
    upd.sort((a, b) => b.at - a.at);
    return upd[0]?.text ?? "—";
  }, [inc]);

  return (
    <div className="mt-3 rounded-xl border border-[#0038A8]/15 bg-[#E9EDFB]/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0038A8] text-white">
            <CatIcon size={17} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-[#334155]">{inc.id}</span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${urgency.chip}`}>
                {inc.source === "sos" ? "SOS" : urgency.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${status.badge}`}>{status.label}</span>
              {breachedFlag && (
                <span className="animate-pulse rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600">
                  SLA Breached
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] font-medium text-[#334155]">{inc.category}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#94A3B8]">
              <span className="flex items-center gap-1"><MapPin size={10} /> {inc.purok}</span>
              <span className="flex items-center gap-1"><source.icon size={10} /> {source.label}</span>
              <span className="flex items-center gap-1"><Clock size={10} /> {formatTimeAgo(inc.time)}</span>
              <span className="text-emerald-500 font-medium">{sev.label}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handlers.onClose}
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-500 hover:bg-stone-100"
        >
          Close
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-[#0038A8]/10 bg-white/70 p-3 sm:grid-cols-3">
        <PreviewField label="Assigned Tanod" value={assigned ?? "Unassigned"} />
        <PreviewField label="CCTV Review" value={cctvLabel} />
        <PreviewField label="Alert Status" value={alertStatus ?? "None"} />
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[10px] text-[#64748B]">
        <Activity size={11} className="mt-0.5 shrink-0 text-[#0038A8]" />
        <span>
          <span className="font-semibold text-[#334155]">Latest update:</span> {latestUpdate}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={handlers.onOpenCase}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0038A8] px-3 py-2 text-[11px] font-medium text-white transition hover:bg-[#002A8C]"
        >
          Open Incident <ArrowUpRight size={11} />
        </button>
        <button
          onClick={handlers.onAssign}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
        >
          {inc.assignedTeam || getDispatches().some((d) => d.incident === inc.id) ? "Reassign" : "Assign"} <Navigation size={11} />
        </button>
        <button
          onClick={handlers.onRequestClip}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
        >
          Request Video Clip <Video size={11} />
        </button>
        <button
          onClick={handlers.onCreateAlert}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
        >
          Create Alert <BellRing size={11} />
        </button>
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
      <p className="truncate text-[11px] font-medium text-[#334155]">{value}</p>
    </div>
  );
}

function RequestField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-stone-800">{value}</p>
    </div>
  );
}

function VideoRequestDetail({
  request,
  onClose,
  onMarkCompleted,
  onAttachToBlotter,
}: {
  request: FootageRequest;
  onClose: () => void;
  onMarkCompleted: () => void;
  onAttachToBlotter: () => void;
}) {
  const meta = REQUEST_STATUS_META[request.status];
  const evidenceReady = request.status === "completed";
  const cancelled = request.status === "cancelled";
  const history = request.requestHistory ?? [];
  const clips = request.clips ?? [];
  const stills = request.stills ?? [];
  const custody = request.chainOfCustody ?? [];
  const metadata = request.metadata ?? {};

  const fmtStamp = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const fmtDuration = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  return (
    <Modal
      side="right"
      size="3xl"
      onClose={onClose}
      icon={<Video size={18} />}
      iconClass="bg-[#0f766e]/10 text-[#0f766e]"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-stone-900">{request.id}</span>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.badge}`}>
            {meta.label}
          </span>
          {request.priority === "urgent" && !evidenceReady && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600">Urgent</span>
          )}
        </span>
      }
      subtitle={`Incident ${request.incidentId ?? "—"} · requested by ${request.requestedBy} (${request.requestedByRole})`}
    >
      <div className="space-y-5">
        {/* Complete request information */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            <FileText size={12} /> Request Information
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <RequestField label="Request ID" value={request.id} />
            <RequestField label="Incident" value={request.incidentId ?? "—"} />
            <RequestField label="Camera" value={request.cameraName || request.cameraId || "Any"} />
            <RequestField label="Requested Window" value={request.startTime && request.endTime ? `${request.startTime} – ${request.endTime}` : "Any"} />
            <RequestField label="Date" value={request.date ?? "—"} />
            <RequestField label="Event Tag" value={request.eventTag ?? "—"} />
            <RequestField label="Priority" value={request.priority === "urgent" ? "Urgent" : "Standard"} />
            <RequestField label="Time Submitted" value={fmtStamp(request.requestedAt)} />
          </div>
          <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">Purpose</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-700">{request.purpose}</p>
          </div>
        </section>

        {/* CCTV Operator processing status */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            <Shield size={12} /> CCTV Operator Processing Status
          </h4>
          <div className="flex items-start gap-2.5 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3 py-2.5">
            {evidenceReady ? (
              <BadgeCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : cancelled ? (
              <RotateCcw size={16} className="mt-0.5 shrink-0 text-rose-500" />
            ) : (
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full ${meta.dot}`} />
            )}
            <div>
              <p className="text-[12px] font-semibold text-stone-800">
                {evidenceReady ? "Evidence Ready" : cancelled ? "Request Cancelled" : meta.label}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-600">{request.operatorStatus ?? "Awaiting operator."}</p>
              {request.completedBy && (
                <p className="mt-0.5 text-[10px] text-[#94A3B8]">Completed by {request.completedBy} · {fmtStamp(request.completedAt ?? "")}</p>
              )}
            </div>
          </div>
        </section>

        {/* Request history */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            <History size={12} /> Request History
          </h4>
          <div className="space-y-0">
            {history.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8]">No history recorded.</p>
            ) : (
              history.map((h, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${REQUEST_STATUS_META[h.status].dot}`} />
                    {i < history.length - 1 && <span className="w-px flex-1 bg-stone-200" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${REQUEST_STATUS_META[h.status].badge}`}>
                        {REQUEST_STATUS_META[h.status].label}
                      </span>
                      <span className="text-[10px] font-medium text-stone-700">{h.by}</span>
                    </div>
                    {h.note && <p className="mt-0.5 text-[10px] text-stone-500">{h.note}</p>}
                    <p className="mt-0.5 text-[9px] text-[#94A3B8]">{fmtStamp(h.at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {evidenceReady && (
          <>
            {/* Evidence-ready banner */}
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <BadgeCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-emerald-800">Evidence Ready</p>
                <p className="text-[10px] leading-relaxed text-emerald-700">
                  {clips.length} clip{clips.length !== 1 ? "s" : ""} · {stills.length} still{stills.length !== 1 ? "s" : ""} attached and
                  verified. You may view, review metadata, inspect chain-of-custody, and attach this evidence to the official blotter.
                </p>
              </div>
            </div>

            {/* Attached clips */}
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <Play size={12} /> Attached Clips {clips.length > 0 && <span className="text-[#94A3B8]">({clips.length})</span>}
              </h4>
              {clips.length === 0 ? (
                <p className="text-[11px] text-[#94A3B8]">No clips attached.</p>
              ) : (
                <div className="space-y-2">
                  {clips.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-stone-800">
                          <Video size={12} className="text-[#0f766e]" /> {c.id}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-stone-500">
                          {c.cameraName} · {new Date(c.start).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}–{new Date(c.end).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {fmtDuration(c.durationSec)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">{c.fileType} · {c.sizeMB} MB</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${c.privacyProcessed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {c.privacyProcessed ? "Privacy processed" : "Unredacted"}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <a
                          href={c.storageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-[#0038A8] px-2 py-1 text-[10px] font-medium text-white hover:bg-[#002A8C]"
                        >
                          <Play size={10} /> View
                        </a>
                        <a
                          href={c.storageUrl}
                          download
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-50"
                        >
                          <Download size={10} /> Save
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Attached stills */}
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <Image size={12} /> Attached Stills {stills.length > 0 && <span className="text-[#94A3B8]">({stills.length})</span>}
              </h4>
              {stills.length === 0 ? (
                <p className="text-[11px] text-[#94A3B8]">No stills attached.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {stills.map((s) => (
                    <div key={s.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                      <div className="flex h-24 items-center justify-center bg-stone-100">
                        <Image size={22} className="text-stone-300" />
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-semibold text-stone-700">{s.id}</p>
                          <p className="truncate text-[9px] text-stone-400">{s.cameraName} · {new Date(s.at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <a href={s.storageUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-md bg-stone-100 p-1 text-stone-500 hover:bg-stone-200">
                          <Eye size={12} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Metadata */}
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <FolderOpen size={12} /> Metadata
              </h4>
              <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                {Object.entries(metadata).map(([k, v], i, arr) => (
                  <div key={k} className={`flex items-start justify-between gap-3 px-3 py-2 ${i < arr.length - 1 ? "border-b border-stone-100" : ""}`}>
                    <span className="text-[10px] font-medium text-stone-500">{k}</span>
                    <span className="max-w-[60%] text-right text-[10px] font-semibold text-stone-700">{v}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Chain of custody */}
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <Shield size={12} /> Chain of Custody
              </h4>
              <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                <div className="space-y-0">
                  {custody.length === 0 ? (
                    <p className="text-[11px] text-[#94A3B8]">No custody log available.</p>
                  ) : (
                    custody.map((c, i) => (
                      <div key={i} className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#0038A8]" />
                          {i < custody.length - 1 && <span className="w-px flex-1 bg-stone-200" />}
                        </div>
                        <div className="min-w-0 flex-1 pb-2.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[10px] font-semibold text-stone-700">{c.actor}</span>
                            <span className="rounded-full bg-[#0038A8]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#0038A8]">
                              {c.action}
                            </span>
                          </div>
                          {c.note && <p className="mt-0.5 text-[10px] text-stone-500">{c.note}</p>}
                          <p className="mt-0.5 text-[9px] text-[#94A3B8]">{fmtStamp(c.at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {cancelled && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <RotateCcw size={16} className="mt-0.5 shrink-0 text-rose-500" />
            <div>
              <p className="text-[12px] font-bold text-rose-700">Request Cancelled</p>
              <p className="text-[10px] text-rose-600">{request.note ?? "No reason provided."}</p>
              {request.cancelledBy && (
                <p className="mt-0.5 text-[9px] text-rose-400">Cancelled by {request.cancelledBy}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-6 space-y-2 border-t border-stone-100 pt-4">
        {!evidenceReady && !cancelled && (
          <button
            onClick={onMarkCompleted}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#0b5f59]"
          >
            <BadgeCheck size={13} /> Mark as Completed (demo)
          </button>
        )}
        {evidenceReady && (
          <button
            onClick={onAttachToBlotter}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C]"
          >
            <CloudUpload size={13} /> Attach Evidence to Official Blotter
          </button>
        )}
      </div>
    </Modal>
  );
}


