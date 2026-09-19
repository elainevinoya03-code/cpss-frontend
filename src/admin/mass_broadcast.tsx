import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Send,
  Bell,
  Pencil,
  Trash2,
  Eye,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  Flame,
  Volume2,
  Zap,
  FileText,
  CheckCircle2,
  Sparkles,
  Link,
  HeartPulse,
  Droplets,
  Shield,
  Siren,
  Lock,
  Home,
  ShieldAlert,
  Car,
  PawPrint,
  HelpCircle,
  Building2,
  Flag,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useDigitalBoundaries } from "../hooks/useDigitalBoundaries";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import { formatTime } from "../utils/format";
import { STYLES, Field } from "./_shared";
import { fetchIncidents, type Incident } from "../desk_officer/incidentsApi";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SEVERITY_META: Record<string, { badge: string; dot: string; label: string; icon: any }> = {
  critical: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", label: "Critical", icon: Flame },
  high: { badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500", label: "High", icon: AlertTriangle },
  medium: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", label: "Medium", icon: Volume2 },
  low: { badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", label: "Low", icon: Megaphone },
};

const CATEGORY_ICONS: Record<string, any> = {
  // New mass broadcast categories
  "Fire": Flame,
  "Medical": HeartPulse,
  "Flood": Droplets,
  "Crime": AlertTriangle,
  
  // Incident triage categories from constants.ts
  "Fire or Smoke": Flame,
  "Medical or Welfare Concern": Shield,
  "Public Safety & Peace and Order": Siren,
  "Crime & Property": Lock,
  "Domestic & Family": Home,
  "Community Disputes": Users,
  "Violence & Gender-Related": ShieldAlert,
  "Traffic & Road": Car,
  "Environmental & Sanitation": Trash2,
  "Animal-Related": PawPrint,
  "Missing / Welfare": HelpCircle,
  "Barangay / Administrative": Building2,
  "Public Disturbance": Siren,
  "Hazard or Obstruction": AlertTriangle,
  "Suspicious Activity": Eye,
  "Other": Flag,
  
  // Legacy mass broadcast categories
  "Fire/Smoke": Flame,
  "Disaster": Zap,
  "Crime/Suspicious Activity": AlertTriangle,
  "Noise Disturbance": Volume2,
  "Road Obstruction": AlertTriangle,
  "Health/Safety": Sparkles,
  "Community Event": Users,
  "General": Megaphone,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  // New mass broadcast categories
  "Fire": { bg: "bg-rose-50", text: "text-rose-600" },
  "Medical": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "Flood": { bg: "bg-blue-50", text: "text-blue-600" },
  "Crime": { bg: "bg-slate-100", text: "text-slate-700" },
  
  // Incident triage categories from constants.ts
  "Fire or Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Medical or Welfare Concern": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "Public Safety & Peace and Order": { bg: "bg-rose-50", text: "text-rose-600" },
  "Crime & Property": { bg: "bg-slate-100", text: "text-slate-700" },
  "Domestic & Family": { bg: "bg-blue-50", text: "text-blue-600" },
  "Community Disputes": { bg: "bg-blue-50", text: "text-blue-600" },
  "Violence & Gender-Related": { bg: "bg-rose-50", text: "text-rose-700" },
  "Traffic & Road": { bg: "bg-amber-50", text: "text-amber-600" },
  "Environmental & Sanitation": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "Animal-Related": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Missing / Welfare": { bg: "bg-sky-50", text: "text-sky-600" },
  "Barangay / Administrative": { bg: "bg-stone-100", text: "text-stone-600" },
  "Public Disturbance": { bg: "bg-orange-50", text: "text-orange-600" },
  "Hazard or Obstruction": { bg: "bg-yellow-50", text: "text-yellow-600" },
  "Suspicious Activity": { bg: "bg-violet-50", text: "text-violet-600" },
  "Other": { bg: "bg-stone-100", text: "text-stone-600" },
  
  // Legacy mass broadcast categories
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Disaster": { bg: "bg-orange-50", text: "text-orange-600" },
  "Crime/Suspicious Activity": { bg: "bg-violet-50", text: "text-violet-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
  "Road Obstruction": { bg: "bg-yellow-50", text: "text-yellow-600" },
  "Health/Safety": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "Community Event": { bg: "bg-blue-50", text: "text-blue-600" },
  "General": { bg: "bg-stone-100", text: "text-stone-600" },
};

interface AnnouncementRecord {
  id: number;
  announcementId: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  targetPurok: string;
  status: string;
  createdBy: string;
  publishedBy: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  incidentId?: string | null;
}

interface ResidentUser {
  id: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  purok: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function MassBroadcast() {
  const { ToastPortal, flash } = useToast();
  const { boundaries, loading: boundariesLoading, error: boundariesError } = useDigitalBoundaries();

  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [residents, setResidents] = useState<ResidentUser[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [editTarget, setEditTarget] = useState<AnnouncementRecord | null>(null);
  const [publishTarget, setPublishTarget] = useState<AnnouncementRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<AnnouncementRecord | null>(null);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    category: "",
    severity: "low",
    targetPurok: "All Puroks",
    publishNow: true,
    incidentId: "",
    location: "",
  });

  const fetchAll = useCallback(async () => {
    try {
      const data = (await apiFetch("/api/announcements")) as AnnouncementRecord[];
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      setAnnouncements([]);
      console.error("Failed to fetch announcements:", err);
      flash(err instanceof Error ? err.message : "Failed to load announcements", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [flash]);

  const fetchResidents = useCallback(async () => {
    try {
      const data = (await apiFetch("/api/users")) as ResidentUser[];
      setResidents(Array.isArray(data) ? data.filter((u) => u.role === "Resident") : []);
    } catch {
      setResidents([]);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      setIncidentsLoading(true);
      const data = await fetchIncidents();
      // Filter out false alarms and unverified incidents, only show emergency incidents
      const emergencyIncidents = Array.isArray(data) 
        ? data.filter(incident => 
            incident.status !== "closed_false_alarm" && 
            incident.verification_status !== "unverified"
          ) 
        : [];
      setIncidents(emergencyIncidents);
    } catch {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchResidents();
    loadIncidents();
  }, [fetchAll, fetchResidents, loadIncidents]);

  // Auto-populate category, location, and severity when incident is selected
  useEffect(() => {
    if (form.incidentId) {
      const selectedIncident = incidents.find((i) => i.id === form.incidentId);
      if (selectedIncident) {
        // Map incident severity to announcement severity
        const incidentSeverity = selectedIncident.severity.toLowerCase();
        const validSeverities = Object.keys(SEVERITY_META);
        const mappedSeverity = validSeverities.includes(incidentSeverity) ? incidentSeverity : "low";

        // Use the exact category from the source report if available, otherwise use incident category
        const exactCategory = selectedIncident.report?.category || selectedIncident.category;

        setForm((f) => ({
          ...f,
          category: exactCategory,
          location: selectedIncident.purok,
          severity: mappedSeverity,
        }));
      }
    } else {
      setForm((f) => ({
        ...f,
        category: "",
        location: "",
        severity: "low",
      }));
    }
  }, [form.incidentId, incidents]);

  const publishedList = announcements.filter((a) => a.status === "published");
  const draftList = announcements.filter((a) => a.status === "draft");
  const latestPublished = publishedList[0] ? (publishedList[0].announcementId as string) : "—";
  const recipientCount = residents.length;

  // Generate target zones from digital boundaries
  const digitalBoundaryZones = boundaries
    .filter((b) => b.status === "Active")
    .map((b) => b.name)
    .sort();

  // Fallback to standard purok names if no digital boundaries are configured or there's an error
  const fallbackZones = digitalBoundaryZones.length === 0 || boundariesError
    ? ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6"]
    : [];

  const targetZones = ["All Puroks", ...digitalBoundaryZones, ...fallbackZones];

  // Ensure current form value is in the list (for legacy data or missing boundaries)
  const availableTargetZones = targetZones.includes(form.targetPurok)
    ? targetZones
    : [form.targetPurok, ...targetZones];

  const kpis = [
    { label: "PUBLISHED ANNOUNCEMENTS", value: publishedList.length, sub: "Living on recipient devices", icon: Bell },
    { label: "DRAFT ANNOUNCEMENTS", value: draftList.length, sub: "Not yet notified to anyone", icon: FileText },
    { label: "RECIPIENTS", value: recipientCount.toLocaleString(), sub: "Registered resident accounts", icon: Users },
    { label: "TARGET ZONES", value: digitalBoundaryZones.length, sub: boundariesLoading ? "Loading..." : "Active digital boundaries", icon: MapPin },
    { label: "LATEST BROADCAST", value: latestPublished, sub: publishedList[0] ? formatTime(publishedList[0].publishedAt || publishedList[0].createdAt) : "Nothing published yet", icon: Clock },
  ];

  function handleComposeSuccess(record: AnnouncementRecord) {
    setShowCompose(false);
    setSuccessModal({
      title: record.status === "published" ? "Announcement Published" : "Announcement Drafted",
      message: record.status === "published"
        ? `${record.announcementId} is now being delivered to resident devices as a notification.`
        : `${record.announcementId} was saved as a draft. Publish it from the Drafts list to notify users.`,
    });
  }

  async function handleSaveAnnouncement() {
    if (!form.title.trim() || !form.message.trim()) {
      flash("Title and message are required.", { type: "warning" });
      return;
    }
    if (!form.incidentId) {
      flash("An incident must be selected before creating a broadcast.", { type: "warning" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        category: form.category,
        severity: form.severity,
        targetPurok: form.targetPurok,
        createdBy: "System Admin",
        publish: form.publishNow,
        incidentId: form.incidentId,
      };
      const record = (await apiFetch("/api/announcements", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as AnnouncementRecord;
      pushAuditLog(
        "Mass Broadcast",
        record.status === "published"
          ? `Mass Broadcast published — ${record.announcementId} "${record.title}" for ${record.targetPurok} (${record.severity}). Users will receive a notification.`
          : `Mass Broadcast draft created — ${record.announcementId} "${record.title}" for ${record.targetPurok} (${record.severity}).`
      );
      await fetchAll();
      handleComposeSuccess(record);
      setForm({ title: "", message: "", category: "", severity: "low", targetPurok: "All Puroks", publishNow: true, incidentId: "", location: "" });
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to save announcement", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!publishTarget) return;
    setSaving(true);
    try {
      const record = (await apiFetch(`/api/announcements/${publishTarget.id}/publish?created_by=${encodeURIComponent("System Admin")}`, {
        method: "POST",
      })) as AnnouncementRecord;
      pushAuditLog(
        "Configuration Change",
        `Mass Broadcast published — ${record.announcementId} "${record.title}" for ${record.targetPurok} (${record.severity}). Users will receive a notification.`
      );
      setPublishTarget(null);
      setSuccessModal({
        title: "Announcement Published",
        message: `${record.announcementId} is now being delivered to recipient devices as a notification.`,
      });
      await fetchAll();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to publish announcement", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/announcements/${deleteTarget.id}`, { method: "DELETE" });
      pushAuditLog("Configuration Change", `Mass Broadcast draft deleted — ${deleteTarget.announcementId} "${deleteTarget.title}".`);
      setDeleteTarget(null);
      await fetchAll();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to delete announcement", { type: "error" });
    }
  }

  function openEdit(record: AnnouncementRecord) {
    setEditTarget(record);
    const selectedIncident = incidents.find((i) => i.id === record.incidentId);
    // When editing, if there's a linked incident, use the exact category from the source report
    // Otherwise use the saved category from the announcement record
    const exactCategory = selectedIncident?.report?.category || record.category || "";
    setForm({
      title: record.title,
      message: record.message,
      category: exactCategory,
      severity: record.severity,
      targetPurok: record.targetPurok,
      publishNow: false,
      incidentId: record.incidentId || "",
      location: selectedIncident?.purok || "",
    });
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    if (!form.title.trim() || !form.message.trim()) {
      flash("Title and message are required.", { type: "warning" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/announcements/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title.trim(),
          message: form.message.trim(),
          category: form.category,
          severity: form.severity,
          targetPurok: form.targetPurok,
          incidentId: form.incidentId,
        }),
      });
      pushAuditLog("Configuration Change", `Mass Broadcast draft updated — ${editTarget.announcementId} "${form.title.trim()}".`);
      setEditTarget(null);
      flash("Announcement draft updated.", { type: "success" });
      await fetchAll();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to update announcement", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const composeOpen = showCompose || editTarget !== null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <ToastPortal />
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Mass Broadcast</h1>
              <p className="mt-1 text-sm text-stone-500">
                Create and publish community announcements linked to incidents to notify users about events or emergencies. Target zones are based on configured digital boundaries.
              </p>
            </div>
            <button
              onClick={() => {
                setEditTarget(null);
                setForm({ title: "", message: "", category: "", severity: "low", targetPurok: "All Puroks", publishNow: true, incidentId: "", location: "" });
                setShowCompose(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
            >
              <Megaphone size={13} />
              Compose Announcement
            </button>
          </div>

        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-black/5 bg-white py-16 shadow-sm">
            <p className="text-[12px] text-stone-400">Loading announcements…</p>
          </div>
        ) : (
          <>
            {draftList.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <FileText size={15} className="text-[#0038A8]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-stone-900">Draft Announcements</h3>
                    <p className="text-[11px] text-stone-400">{draftList.length} saved — publish to notify users</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {draftList.map((record) => {
                    const sev = SEVERITY_META[record.severity] || SEVERITY_META.low;
                    // Try to get the exact category from the linked incident's source report
                    const linkedIncident = incidents.find((i) => i.id === record.incidentId);
                    const exactCategory = linkedIncident?.report?.category || record.category;
                    const CatIcon = CATEGORY_ICONS[exactCategory] || Megaphone;
                    const catColor = CATEGORY_COLORS[exactCategory] || { bg: "bg-stone-100", text: "text-stone-600" };
                    return (
                      <div key={record.id} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catColor.bg} ${catColor.text}`}>
                              <CatIcon size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-semibold text-stone-900">{record.announcementId}</span>
                                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                                <span className="text-[10px] font-medium text-stone-400">{exactCategory}</span>
                              </div>
                              <p className="mt-0.5 text-[12px] font-medium text-stone-900">{record.title}</p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">{record.message}</p>
                              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-stone-400">
                                <span className="flex items-center gap-1"><Clock size={9} /> {formatTime(record.createdAt)}</span>
                                <span className="flex items-center gap-1"><MapPin size={9} /> {record.targetPurok}</span>
                                {record.incidentId && (
                                  <span className="flex items-center gap-1"><Link size={9} /> {record.incidentId}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => openEdit(record)}
                              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              <Pencil size={11} />
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(record)}
                              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-rose-600"
                            >
                              <Trash2 size={11} />
                              Delete
                            </button>
                            <button
                              onClick={() => setPublishTarget(record)}
                              className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                            >
                              <Send size={12} />
                              Publish
                            </button>
                          </div>
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
                  <Bell size={15} className="text-[#0038A8]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-stone-900">Published Announcements</h3>
                    <p className="text-[11px] text-stone-400">{publishedList.length} broadcast{publishedList.length !== 1 ? "s" : ""} delivered to user notifications</p>
                  </div>
                </div>
              </div>

              {publishedList.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                    <Megaphone size={20} className="text-stone-300" />
                  </div>
                  <p className="text-[12px] text-stone-400">No announcements published yet</p>
                  <p className="mt-1 text-[11px] text-stone-400">Use “Compose Announcement” to create the first broadcast.</p>
                </div>
              ) : (
                publishedList.map((record, i) => {
                  const sev = SEVERITY_META[record.severity] || SEVERITY_META.low;
                  // Try to get the exact category from the linked incident's source report
                  const linkedIncident = incidents.find((i) => i.id === record.incidentId);
                  const exactCategory = linkedIncident?.report?.category || record.category;
                  const CatIcon = CATEGORY_ICONS[exactCategory] || Megaphone;
                  const catColor = CATEGORY_COLORS[exactCategory] || { bg: "bg-stone-100", text: "text-stone-600" };
                  return (
                    <div key={record.id} className={`px-5 py-4 ${i < publishedList.length - 1 ? "border-b border-black/5" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catColor.bg} ${catColor.text}`}>
                            <CatIcon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12px] font-semibold text-stone-900">{record.announcementId}</span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                                {sev.label}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                <CheckCircle2 size={9} />
                                Published
                              </span>
                              <span className="text-[10px] font-medium text-stone-400">{exactCategory}</span>
                            </div>
                            <p className="mt-0.5 text-[12px] font-medium text-stone-900">{record.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">{record.message}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-stone-400">
                              <span className="flex items-center gap-1"><Clock size={9} /> {formatTime(record.publishedAt || record.createdAt)}</span>
                              <span className="flex items-center gap-1"><MapPin size={9} /> {record.targetPurok}</span>
                              <span className="flex items-center gap-1"><CheckCircle2 size={9} /> by {record.publishedBy || record.createdBy || "System Admin"}</span>
                              {record.incidentId && (
                                <span className="flex items-center gap-1"><Link size={9} /> {record.incidentId}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setDetailTarget(record)}
                          className="flex shrink-0 items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <Eye size={11} />
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      {composeOpen && (
        <Modal
          size="lg"
          onClose={() => {
            setShowCompose(false);
            setEditTarget(null);
          }}
          icon={<Megaphone size={18} className="text-[#0038A8]" />}
          iconClass="bg-[#E9EDFB]"
          title={editTarget ? `Edit Announcement — ${editTarget.announcementId}` : "Compose Announcement"}
          subtitle="Create a community announcement linked to an incident to notify users on their devices"
          footer={
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCompose(false);
                  setEditTarget(null);
                }}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-900 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={editTarget ? handleSaveEdit : handleSaveAnnouncement}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
              >
                <Send size={13} />
                {saving ? "Saving…" : editTarget ? "Save Changes" : form.publishNow ? "Publish Announcement" : "Save as Draft"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">LINKED INCIDENT (REQUIRED)</p>
              <select
                value={form.incidentId}
                onChange={(e) => setForm((f) => ({ ...f, incidentId: e.target.value }))}
                className={STYLES.select}
                required
                disabled={editTarget !== null || incidentsLoading}
              >
                <option value="">
                  {incidentsLoading ? "Loading incidents..." : "Select an incident..."}
                </option>
                {incidents.map((incident) => {
                  const exactCategory = incident.report?.category || incident.category;
                  return (
                    <option key={incident.id} value={incident.id}>
                      {incident.id} — {exactCategory} in {incident.purok} ({incident.status})
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-[10px] text-stone-400">
                {editTarget
                  ? "Linked incident cannot be changed after creation."
                  : incidentsLoading
                    ? "Loading available incidents..."
                    : "An incident must be selected before creating a broadcast."}
              </p>
            </div>

            {form.incidentId && (() => {
              const selectedIncident = incidents.find((i) => i.id === form.incidentId);
              if (!selectedIncident) return null;
              const sev = SEVERITY_META[selectedIncident.severity.toLowerCase()] || SEVERITY_META.low;
              // Use the exact category from the source report if available, otherwise use incident category
              const exactCategory = selectedIncident.report?.category || selectedIncident.category;
              const CatIcon = CATEGORY_ICONS[exactCategory] || Megaphone;
              const catColor = CATEGORY_COLORS[exactCategory] || { bg: "bg-stone-100", text: "text-stone-600" };
              return (
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">INCIDENT DETAILS REVIEW</p>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catColor.bg} ${catColor.text}`}>
                      <CatIcon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-stone-900">{selectedIncident.id}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                          {sev.label}
                        </span>
                        <span className="text-[10px] font-medium text-stone-400">{exactCategory}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-600">{selectedIncident.description}</p>
                      
                      {/* Prominent Location Display */}
                      <div className="mt-2 rounded-md border border-stone-200 bg-white px-3 py-2">
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-[#0038A8]" />
                          <div>
                            <p className="text-[10px] font-semibold text-stone-400">LOCATION</p>
                            <p className="text-[11px] font-medium text-stone-900">{selectedIncident.purok}</p>
                            {(selectedIncident.lat || selectedIncident.lng) && (
                              <p className="text-[10px] text-stone-500">
                                Coordinates: {selectedIncident.lat?.toFixed(6)}, {selectedIncident.lng?.toFixed(6)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-stone-400">
                        <span className="flex items-center gap-1"><Clock size={9} /> {formatTime(selectedIncident.time)}</span>
                        <span className="flex items-center gap-1"><Users size={9} /> {selectedIncident.reporter}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">SEVERITY</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.keys(SEVERITY_META).map((sev) => {
                  const meta = SEVERITY_META[sev];
                  const active = form.severity === sev;
                  return (
                    <button
                      key={sev}
                      onClick={() => !form.incidentId && setForm((f) => ({ ...f, severity: sev }))}
                      disabled={!!form.incidentId}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition ${
                        active ? `${meta.badge} border-current` : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                      } ${form.incidentId ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              {form.incidentId && (
                <p className="mt-1 text-[10px] text-stone-400">Auto-populated from linked incident</p>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-stone-400">ANNOUNCEMENT DETAILS</p>
              <div className="space-y-4">
                <Field label="Title">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Fire Incident — Immediate Evacuation (Purok 3)"
                    className={STYLES.input}
                  />
                </Field>
                <Field label="Message" hint="The full details users will read in the notification (e.g. incident details and safety instructions).">
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    rows={5}
                    placeholder="Type the announcement message…"
                    className={`${STYLES.input} resize-none`}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={STYLES.input}
                  disabled={!!form.incidentId}
                  placeholder="Category will be auto-populated from incident"
                />
                {form.incidentId && (
                  <p className="mt-1 text-[10px] text-stone-400">Auto-populated from linked incident</p>
                )}
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Incident location"
                  className={STYLES.input}
                  disabled={!!form.incidentId}
                />
                {form.incidentId && (
                  <p className="mt-1 text-[10px] text-stone-400">Auto-populated from linked incident</p>
                )}
              </Field>
              <Field label="Target Zone">
                <select
                  value={form.targetPurok}
                  onChange={(e) => setForm((f) => ({ ...f, targetPurok: e.target.value }))}
                  className={STYLES.select}
                  disabled={boundariesLoading}
                >
                  {availableTargetZones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone === "All Puroks" ? "All Puroks — Community-wide" : zone}
                    </option>
                  ))}
                </select>
                {boundariesLoading && (
                  <p className="mt-1 text-[10px] text-stone-400">Loading digital boundaries...</p>
                )}
              </Field>
            </div>

            {!editTarget && (
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <input
                  type="checkbox"
                  id="publish-now"
                  checked={form.publishNow}
                  onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
                  className="h-3.5 w-3.5 accent-[#0038A8]"
                />
                <label htmlFor="publish-now" className="text-[11px] text-stone-600">
                  Publish immediately — users will receive a notification. Uncheck to save as a draft.
                </label>
              </div>
            )}


          </div>
        </Modal>
      )}

      {publishTarget && (
        <ConfirmModal
          type="confirm"
          tone="primary"
          title="Publish Announcement?"
          message={`"${publishTarget.title}" will be delivered to users as a notification. This cannot be reverted.`}
          confirmLabel="Publish"
          cancelLabel="Cancel"
          onClose={() => setPublishTarget(null)}
          onConfirm={handlePublish}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          type="confirm"
          title="Delete Draft?"
          message={`"${deleteTarget.title}" will be permanently removed.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {successModal && (
        <ConfirmModal
          type="success"
          title={successModal.title}
          message={successModal.message}
          onClose={() => setSuccessModal(null)}
        />
      )}

      {detailTarget && (
        <Modal
          size="md"
          onClose={() => setDetailTarget(null)}
          title={detailTarget.announcementId}
          subtitle={formatTime(detailTarget.publishedAt || detailTarget.createdAt)}
          icon={<Eye size={16} className="text-[#0038A8]" />}
          iconClass="bg-[#E9EDFB]"
        >
          {(() => {
            const sev = SEVERITY_META[detailTarget.severity] || SEVERITY_META.low;
            // Try to get the exact category from the linked incident's source report
            const linkedIncident = incidents.find((i) => i.id === detailTarget.incidentId);
            const exactCategory = linkedIncident?.report?.category || detailTarget.category;
            const CatIcon = CATEGORY_ICONS[exactCategory] || Megaphone;
            const catColor = CATEGORY_COLORS[exactCategory] || { bg: "bg-stone-100", text: "text-stone-600" };
            return (
              <div>
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catColor.bg} ${catColor.text}`}>
                    <CatIcon size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-stone-900">{detailTarget.title}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}>{sev.label}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{detailTarget.message}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[10px] font-medium tracking-wider text-stone-400">CATEGORY</p>
                    <p className="mt-1 text-[12px] font-medium text-stone-900">{exactCategory}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[10px] font-medium tracking-wider text-stone-400">TARGET ZONE</p>
                    <p className="mt-1 text-[12px] font-medium text-stone-900">{detailTarget.targetPurok}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[10px] font-medium tracking-wider text-stone-400">PUBLISHED BY</p>
                    <p className="mt-1 text-[12px] font-medium text-stone-900">{detailTarget.publishedBy || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[10px] font-medium tracking-wider text-stone-400">RECIPIENTS</p>
                    <p className="mt-1 text-[12px] font-medium text-stone-900">{recipientCount.toLocaleString()} resident{recipientCount !== 1 ? "s" : ""}</p>
                  </div>
                  {detailTarget.incidentId && (
                    <div className="col-span-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                      <p className="text-[10px] font-medium tracking-wider text-stone-400">LINKED INCIDENT</p>
                      <p className="mt-1 text-[12px] font-medium text-stone-900">{detailTarget.incidentId}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}