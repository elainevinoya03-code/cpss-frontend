import { useState, useEffect } from "react";
import {
  Radio,
  Bell,
  Globe,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Shield,
  ShieldCheck,
  ToggleLeft,
  Volume2,
  Database,
} from "lucide-react";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import { getCctvStorageConfig, setCctvStorageConfig, DEFAULT_CCTV_STORAGE } from "../utils/cctvStorage";
import { INPUT_CLASS } from "./_shared";

const TABS = [
  { key: "general", label: "General", icon: Globe },
  { key: "iot", label: "IoT Thresholds", icon: Radio },
  { key: "notifications", label: "Notifications & Alerts", icon: Bell },
  { key: "security", label: "Security", icon: Shield },
  { key: "retention", label: "Data Retention", icon: Database },
  { key: "purok", label: "Purok Coordination", icon: ShieldCheck },
  { key: "flags", label: "Feature Flags", icon: ToggleLeft },
];

const RETENTION_UNITS = ["Days", "Months", "Years"];

const RETENTION_CATEGORIES = [
  { key: "incidents", label: "Incident Records", description: "Incident reports and blotter-relevant case files", default: 7, unit: "Years" },
  { key: "cctv", label: "CCTV Clip Footage", description: "Recorded clips attached to incidents and archives", default: 1, unit: "Years" },
  { key: "appLogs", label: "Application / Error Logs", description: "System runtime and error diagnostics", default: 90, unit: "Days" },
  { key: "auditLogs", label: "Audit Logs", description: "Immutable administrative action trail", default: 10, unit: "Years" },
  { key: "iotTelemetry", label: "Raw IoT Telemetry", description: "Unprocessed sensor payload streams", default: 90, unit: "Days" },
  { key: "notificationRecords", label: "Notification Records", description: "Push / SMS delivery history and acknowledgements", default: 1, unit: "Years" },
  { key: "patrolCheckpoints", label: "Patrol Checkpoint Logs", description: "Checkpoint clearances and missed-checkpoint records", default: 2, unit: "Years" },
] as const;

export type RetentionRow = { value: string; unit: string };

type RetentionState = Record<(typeof RETENTION_CATEGORIES)[number]["key"], RetentionRow>;

function defaultRetentionState(): RetentionState {
  return RETENTION_CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = { value: String(cat.default), unit: cat.unit };
    return acc;
  }, {} as RetentionState);
}

function SettingsCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-bold text-stone-900">{title}</h3>
      <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p>}
      </div>
      <div className="shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? "bg-[#0038A8]" : "bg-stone-300"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());

  function markDirty() {
    setDirtyTabs((prev) => new Set(prev).add(activeTab));
  }

  const [barangayName, setBarangayName] = useState("Barangay Sample");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Asia/Manila");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");

  const [smokePpm, setSmokePpm] = useState("500");
  const [decibelDb, setDecibelDb] = useState("85");
  const [smokePersistence, setSmokePersistence] = useState("30");
  const [decibelPersistence, setDecibelPersistence] = useState("10");

  const [escalationMin, setEscalationMin] = useState("15");
  const [geofenceRadius, setGeofenceRadius] = useState("500");
  const [requireCaptainApproval, setRequireCaptainApproval] = useState(true);
  const [enableSmsBroadcast, setEnableSmsBroadcast] = useState(true);
  const [enablePushNotif, setEnablePushNotif] = useState(true);

  const [roleMatrix, setRoleMatrix] = useState([
    { role: "Desk Officer", low: false, med: true, high: true, crit: true },
    { role: "CCTV Operator", low: false, med: false, high: true, crit: true },
    { role: "Chief Tanod", low: false, med: true, high: true, crit: true },
    { role: "Tanod", low: false, med: true, high: true, crit: false },
    { role: "Purok Leader", low: false, med: true, high: true, crit: false },
  ]);

  const [notifSoundEnabled, setNotifSoundEnabled] = useState(true);
  const [notifVolume, setNotifVolume] = useState("70");
  const [testingNotifSound, setTestingNotifSound] = useState(false);

  const [requireTwoFactor, setRequireTwoFactor] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30");

  const [purokEnabled, setPurokEnabled] = useState(true);
  const [validationLabels, setValidationLabels] = useState([
    { key: "locally_confirmed", label: "Locally Confirmed", desc: "Verified as a real, local concern by the Purok Leader", enabled: true },
    { key: "unverified", label: "Unverified", desc: "No local confirmation has been established yet", enabled: true },
    { key: "likely_duplicate", label: "Likely Duplicate", desc: "Report appears to duplicate an existing case", enabled: true },
    { key: "event_related", label: "Event-Related", desc: "Attributable to a scheduled local event", enabled: true },
    { key: "unable_to_verify", label: "Unable to Verify", desc: "Local context cannot confirm the report", enabled: true },
  ]);
  const [retention, setRetention] = useState<RetentionState>(defaultRetentionState());
  const [cctvWarnThreshold, setCctvWarnThreshold] = useState(() => String(getCctvStorageConfig().warnThresholdPct));

  useEffect(() => {
    setCctvWarnThreshold(String(getCctvStorageConfig().warnThresholdPct));
  }, []);

  const [featureFlags, setFeatureFlags] = useState([
    { key: "cctv", label: "CCTV Module", desc: "Surveillance matrix and clip archiving", enabled: true },
    { key: "iot", label: "IoT Monitoring", desc: "Field sensor telemetry and health monitoring", enabled: true },
    { key: "boundaries", label: "Digital Boundaries", desc: "Geofencing, hazard zones, and purok polygons", enabled: true },
    { key: "patrol", label: "Patrol Management", desc: "Patrol routes, checkpoints, and live tracking", enabled: true },
    { key: "purok", label: "Purok Coordination", desc: "Community validation notes and escalation for Purok Leaders", enabled: true },
    { key: "sms", label: "SMS Mass Broadcast", desc: "Cascading SMS broadcasts via the gateway", enabled: true },
    { key: "push", label: "Push Notifications", desc: "In-app push alerts to logged-in users", enabled: true },
    { key: "broadcast", label: "Emergency Broadcast", desc: "Captain emergency broadcast approvals", enabled: true },
  ]);
  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);

  function toggleFeatureFlag(key: string) {
    setFeatureFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
    markDirty();
  }

  function toggleValidationLabel(key: string) {
    setValidationLabels((prev) =>
      prev.map((l) => (l.key === key ? { ...l, enabled: !l.enabled } : l))
    );
    markDirty();
  }

  function updateRetention(catKey: string, patch: Partial<RetentionRow>) {
    setRetention((prev) => ({
      ...prev,
      [catKey]: { ...prev[catKey], ...patch },
    }));
    markDirty();
  }

  function playTestSound(critical: boolean) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const freqs = critical ? [880, 1100, 880] : [660, 880];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18 * (Number(notifVolume) / 100 || 0.7), t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch {}
  }

  function toggleMatrixCell(roleIdx: number, level: string) {
    setRoleMatrix((prev) =>
      prev.map((r, i) => (i === roleIdx ? { ...r, [level]: !r[level] } : r))
    );
    markDirty();
  }

  function handleSave() {
    setDirtyTabs(new Set());
    const warn = Math.min(100, Math.max(10, Number(cctvWarnThreshold) || DEFAULT_CCTV_STORAGE.warnThresholdPct));
    setCctvStorageConfig({ warnThresholdPct: warn });
    pushAuditLog("Configuration Change", "Saved platform settings (general, IoT thresholds, notifications & alert rules, security policy, data retention, purok coordination, feature flags)");
    setModalMessage({ title: "Settings Saved", message: "Settings saved successfully" });
  }

  function handleRevert() {
    setDirtyTabs(new Set());
    setRetention(defaultRetentionState());
    setCctvWarnThreshold(String(DEFAULT_CCTV_STORAGE.warnThresholdPct));
    setCctvStorageConfig({ warnThresholdPct: DEFAULT_CCTV_STORAGE.warnThresholdPct });
    setSmokePersistence("30");
    setDecibelPersistence("10");
    setSessionTimeout("30");
    pushAuditLog("Configuration Change", "Reverted platform settings to defaults");
    setModalMessage({ title: "Settings Reverted", message: "Reverted to defaults" });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">System Settings</h1>
          <p className="mt-1 text-sm text-stone-500">
            Global configuration for system identity, sensor thresholds, notifications, security,
            retention, and feature flags
          </p>
        </header>

        
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                if (dirtyTabs.has(activeTab) && key !== activeTab) {
                  setPendingTab(key);
                } else {
                  setActiveTab(key);
                }
              }}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-medium transition ${
                activeTab === key
                  ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]"
                  : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        
        {activeTab === "general" && (
          <div className="space-y-5">
            <SettingsCard
              title="Barangay Identity"
              subtitle="Official identity shown across the system"
            >
              <SettingRow
                label="Barangay Name"
                hint="Official name displayed across the system"
              >
                <input
                  type="text"
                  value={barangayName}
                  onChange={(e) => { setBarangayName(e.target.value); markDirty(); }}
                  className={INPUT_CLASS}
                />
              </SettingRow>
            </SettingsCard>

            <SettingsCard
              title="Language & Regional Format"
              subtitle="Standardize display language, timezone, and date formatting"
            >
              <SettingRow
                label="Default System Language"
                hint="Controls the app interface language for all admin users"
              >
                <select
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); markDirty(); }}
                  className={INPUT_CLASS}
                >
                  <option value="en">English</option>
                  <option value="fil">Filipino / Tagalog</option>
                </select>
              </SettingRow>

              <SettingRow
                label="Timezone"
                hint="Standardizes timestamps shown throughout the system"
              >
                <select
                  value={timezone}
                  onChange={(e) => { setTimezone(e.target.value); markDirty(); }}
                  className={INPUT_CLASS}
                >
                  <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                </select>
              </SettingRow>

              <SettingRow
                label="Date Format"
                hint="Display format for dates throughout the system"
              >
                <select
                  value={dateFormat}
                  onChange={(e) => { setDateFormat(e.target.value); markDirty(); }}
                  className={INPUT_CLASS}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-20)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (07/20/2026)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (20/07/2026)</option>
                  <option value="MMMM D, YYYY">MMMM D, YYYY (July 20, 2026)</option>
                </select>
              </SettingRow>
            </SettingsCard>
          </div>
        )}

        
        {activeTab === "iot" && (
          <SettingsCard
            title="Global Sensor Threshold Defaults"
            subtitle="Baseline safety limits for field-deployed ESP32 hardware nodes"
          >
            <SettingRow
              label="Global Smoke Sensitivity (PPM)"
              hint="MQ-2 sensor threshold before triggering a high-severity smoke alert"
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={smokePpm}
                  onChange={(e) => { setSmokePpm(e.target.value); markDirty(); }}
                  min="50"
                  max="1000"
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-stone-400">ppm</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Global Smoke Persistence"
              hint="Seconds a smoke reading must exceed the threshold before triggering an alert"
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={smokePersistence}
                  onChange={(e) => { setSmokePersistence(e.target.value); markDirty(); }}
                  min="1"
                  max="300"
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-stone-400">seconds</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Global Decibel Ceiling (dB)"
              hint="KY-037 noise sensor limit before triggering a medium-severity incident"
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={decibelDb}
                  onChange={(e) => { setDecibelDb(e.target.value); markDirty(); }}
                  min="50"
                  max="120"
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-stone-400">dB</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Global Noise Persistence"
              hint="Seconds a noise reading must exceed the ceiling before triggering an incident"
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={decibelPersistence}
                  onChange={(e) => { setDecibelPersistence(e.target.value); markDirty(); }}
                  min="1"
                  max="300"
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-stone-400">seconds</span>
              </div>
            </SettingRow>

            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Threshold propagation</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Changes here set the default for newly registered devices. Existing devices
                  retain their individual thresholds until manually overridden in IoT Provisioning.
                </p>
              </div>
            </div>
          </SettingsCard>
        )}

        
        {activeTab === "notifications" && (
          <div className="space-y-5">
            <SettingsCard
              title="Escalation & Broadcast Rules"
              subtitle="Control how notifications escalate and broadcast across user roles"
            >
              <SettingRow
                label="Automatic Escalation Timer"
                hint="Minutes before an unacknowledged incident escalates to the Barangay Admin"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={escalationMin}
                    onChange={(e) => { setEscalationMin(e.target.value); markDirty(); }}
                    min="1"
                    max="60"
                    className={INPUT_CLASS}
                  />
                  <span className="text-xs text-stone-400">minutes</span>
                </div>
              </SettingRow>

              <SettingRow
                label="Geofence Proximity Radius"
                hint="Buffer zone around a triggered sensor for resident mass alerts"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={geofenceRadius}
                    onChange={(e) => { setGeofenceRadius(e.target.value); markDirty(); }}
                    min="100"
                    max="5000"
                    step="50"
                    className={INPUT_CLASS}
                  />
                  <span className="text-xs text-stone-400">meters</span>
                </div>
              </SettingRow>

              <div className="h-px bg-stone-100" />

              <SettingRow
                label="Require Admin Approval for Broadcasts"
                hint="When enabled, community-wide SMS broadcasts require 1-tap authorization from the Admin"
              >
                <Toggle
                  checked={requireCaptainApproval}
                  onChange={(v) => { setRequireCaptainApproval(v); markDirty(); }}
                />
              </SettingRow>

              <SettingRow
                label="Enable SMS Mass Broadcast"
                hint="Master toggle for the Cascading Mass Broadcast Engine"
              >
                <Toggle checked={enableSmsBroadcast} onChange={(v) => { setEnableSmsBroadcast(v); markDirty(); }} />
              </SettingRow>

              <SettingRow
                label="Enable Push Notifications"
                hint="Send in-app push alerts to logged-in admin users"
              >
                <Toggle checked={enablePushNotif} onChange={(v) => { setEnablePushNotif(v); markDirty(); }} />
              </SettingRow>
            </SettingsCard>

            <SettingsCard
              title="Notification Role Matrix"
              subtitle="Which roles receive alerts at each severity level"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400">
                      <th className="pb-2 pr-4 font-semibold">Role</th>
                      <th className="pb-2 px-4 font-semibold text-center">Low</th>
                      <th className="pb-2 px-4 font-semibold text-center">Medium</th>
                      <th className="pb-2 px-4 font-semibold text-center">High</th>
                      <th className="pb-2 px-4 font-semibold text-center">Critical</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] text-stone-600">
                    {roleMatrix.map((row, ri) => (
                      <tr key={row.role} className="border-b border-stone-50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-stone-800">{row.role}</td>
                        {["low", "med", "high", "crit"].map((lvl) => (
                          <td key={lvl} className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => toggleMatrixCell(ri, lvl)}
                              className="mx-auto flex items-center justify-center"
                              title={`Toggle ${lvl} for ${row.role}`}
                            >
                              {row[lvl] ? (
                                <CheckCircle2 size={16} className="text-emerald-500 hover:text-emerald-700 transition cursor-pointer" />
                              ) : (
                                <span className="text-stone-300 hover:text-stone-500 transition cursor-pointer text-lg leading-none">—</span>
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Notification Sound"
              subtitle="Control audible alerts for in-app notifications"
            >
              <SettingRow
                label="Enable Notification Sounds"
                hint="Play an audible tone when a new alert or incident arrives"
              >
                <Toggle
                  checked={notifSoundEnabled}
                  onChange={(v) => { setNotifSoundEnabled(v); markDirty(); }}
                />
              </SettingRow>

              <SettingRow
                label="Default Volume Level"
                hint="Default loudness applied to all alert tones"
              >
                <div className="flex items-center gap-3">
                  <Volume2 size={15} className="shrink-0 text-stone-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={notifVolume}
                    disabled={!notifSoundEnabled}
                    onChange={(e) => { setNotifVolume(e.target.value); markDirty(); }}
                    className="flex-1 cursor-pointer accent-[#0038A8]"
                  />
                  <span className="w-8 text-right text-sm font-semibold text-stone-700">
                    {notifVolume}%
                  </span>
                </div>
              </SettingRow>

              <SettingRow
                label="Preview Alert Tone"
                hint="Hear a sample of the current volume setting"
              >
                <button
                  onClick={() => {
                    if (!notifSoundEnabled) {
                      setModalMessage({ title: "Sounds Disabled", message: "Enable notification sounds before testing the alert tone." });
                      return;
                    }
                    setTestingNotifSound(true);
                    playTestSound(false);
                    setTimeout(() => setTestingNotifSound(false), 600);
                  }}
                  disabled={testingNotifSound}
                  className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                >
                  {testingNotifSound ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-[#0038A8]" />
                  ) : (
                    <Volume2 size={14} />
                  )}
                  Test Sound
                </button>
              </SettingRow>
            </SettingsCard>
          </div>
        )}

        
        {activeTab === "security" && (
          <div className="space-y-5">
            <SettingsCard
              title="Authentication & Session Policy"
              subtitle="Login security policy and session controls for the platform"
            >
              <SettingRow
                label="Require Two-Factor Authentication"
                hint="Accounts for Admin, Captain, and Desk Officer must complete 2FA enrollment before activation"
              >
                <Toggle
                  checked={requireTwoFactor}
                  onChange={(v) => { setRequireTwoFactor(v); markDirty(); }}
                />
              </SettingRow>
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Mandatory per policy</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Two-factor authentication is mandatory for Admin, Captain, and Desk Officer
                    accounts. Privileged accounts created while this toggle is on stay in a{" "}
                    <strong>Pending 2FA</strong> state in User Management until the invited user
                    completes enrollment. It remains optional for all other roles.
                  </p>
                </div>
              </div>

              <SettingRow
                label="Session Timeout"
                hint="Minutes of inactivity before a signed-in session expires"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={sessionTimeout}
                    onChange={(e) => { setSessionTimeout(e.target.value); markDirty(); }}
                    min="5"
                    max="240"
                    className={INPUT_CLASS}
                  />
                  <span className="text-xs text-stone-400">minutes</span>
                </div>
              </SettingRow>

              <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <Shield size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs">
                  Login protection (attempt lockouts and credential-based access controls) is not
                  implemented in this prototype and is therefore not configurable here.
                </p>
              </div>
            </SettingsCard>
          </div>
        )}

        
        {activeTab === "retention" && (
          <div className="space-y-5">
            <SettingsCard
              title="Data Retention Schedule"
              subtitle="Approved retention periods per data category — applied by the system scheduler"
            >
              {RETENTION_CATEGORIES.map((cat) => (
                <SettingRow
                  key={cat.key}
                  label={cat.label}
                  hint={cat.description}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={36500}
                      value={retention[cat.key].value}
                      onChange={(e) => updateRetention(cat.key, { value: e.target.value })}
                      className={INPUT_CLASS}
                    />
                    <select
                      value={retention[cat.key].unit}
                      onChange={(e) => updateRetention(cat.key, { unit: e.target.value })}
                      className={INPUT_CLASS + " w-24"}
                    >
                      {RETENTION_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </SettingRow>
              ))}

              <div className="h-px bg-stone-100" />

              <SettingRow
                label="CCTV Clip Storage Warning Threshold"
                hint="Percent of CCTV clip storage used that triggers a warning banner in CCTV Placement"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={cctvWarnThreshold}
                    onChange={(e) => { setCctvWarnThreshold(e.target.value); markDirty(); }}
                    className={INPUT_CLASS}
                  />
                  <span className="text-xs text-stone-400">%</span>
                </div>
              </SettingRow>

              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Retention shortening</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Shortening a retention period does <strong>not</strong> retroactively delete
                    records that are under active legal hold or tied to unresolved incidents.
                    Purge jobs only reclaim records past their retention window.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <Database size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Configuration values, not legal advice</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Retention values are <strong>configuration values</strong> entered for this
                    prototype — they are scheduling inputs, not legal advice. Actual retention
                    periods must comply with applicable data protection laws and the Barangay's
                    approved policies.
                  </p>
                </div>
              </div>
            </SettingsCard>
          </div>
        )}

        
        {activeTab === "purok" && (
          <div className="space-y-5">
            <SettingsCard
              title="Module Status &amp; Oversight"
              subtitle="Global controls for the Purok Coordination capability"
            >
              <SettingRow
                label="Enable Purok Coordination Module"
                hint="Turn community validation notes and escalation on or off platform-wide"
              >
                <Toggle
                  checked={purokEnabled}
                  onChange={(v) => { setPurokEnabled(v); markDirty(); }}
                />
              </SettingRow>

              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">In scope — community validation only</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    This covers the in-scope Purok Leader capabilities: applying validation labels to
                    resident reports and escalating cases to the Desk Officer. Resident-organized
                    watch-group membership and submission programs are out of scope and are not
                    configured here.
                  </p>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Community-Validation Labels"
              subtitle="Which validation notes Purok Leaders may apply to resident reports"
            >
              {purokEnabled ? (
                <div className="divide-y divide-stone-100">
                  {validationLabels.map((label) => (
                    <div
                      key={label.key}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-800">{label.label}</p>
                        <p className="mt-0.5 text-[11px] text-stone-400">{label.desc}</p>
                      </div>
                      <div className="shrink-0">
                        <Toggle
                          checked={label.enabled}
                          onChange={() => toggleValidationLabel(label.key)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400">
                  Enable the Purok Coordination module to configure validation labels.
                </p>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs">
                  Purok-level notification routing is governed by the{" "}
                  <strong>Notification Role Matrix</strong> under Notifications &amp; Alerts — this
                  tab only controls which validation labels exist. Labels are advisory; the Desk
                  Officer retains final authority.
                </p>
              </div>
            </SettingsCard>
          </div>
        )}

        {activeTab === "flags" && (
          <div className="space-y-5">
            <SettingsCard
              title="Module Feature Flags"
              subtitle="Enable or disable whole existing modules platform-wide"
            >
              <div className="divide-y divide-stone-100">
                {featureFlags.map((flag) => (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-800">{flag.label}</p>
                      <p className="mt-0.5 text-[11px] text-stone-400">{flag.desc}</p>
                    </div>
                    <div className="shrink-0">
                      <Toggle
                        checked={flag.enabled}
                        onChange={() => toggleFeatureFlag(flag.key)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <ToggleLeft size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs">
                  Flags cover the major existing modules only. Experimental or out-of-scope
                  capabilities (AI, facial recognition, predictive analytics, national emergency /
                  PNP / 911 integration, drones, payments, multi-barangay tenancy) are not part of
                  this prototype and are not configurable here.
                </p>
              </div>
            </SettingsCard>
          </div>
        )}

        
        <div className="mt-6 flex items-center justify-between rounded-xl border border-stone-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs text-stone-400">
            Changes apply platform-wide upon saving.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRevert}
              className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              <RotateCcw size={14} />
              Revert to Defaults
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-md bg-[#0038A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#002A8C]"
            >
              <Save size={14} />
              Save Settings
            </button>
          </div>
        </div>
      </main>

      
      {pendingTab && (
        <Modal open size="sm" onClose={() => setPendingTab(null)}>
          <div className="text-center">
            <AlertTriangle size={24} className="mx-auto text-amber-500" />
            <h3 className="mt-3 text-[14px] font-semibold text-stone-900">Unsaved Changes</h3>
            <p className="mt-1.5 text-[12px] text-stone-500">
              You have unsaved changes on this tab. Discard them and switch?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setPendingTab(null)}
                className="flex-1 rounded-lg border border-stone-200 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setDirtyTabs((prev) => { const next = new Set(prev); next.delete(activeTab); return next; });
                  setActiveTab(pendingTab);
                  setPendingTab(null);
                }}
                className="flex-1 rounded-lg bg-[#0038A8] py-2 text-[12px] font-medium text-white hover:bg-[#002A8C]"
              >
                Discard & Switch
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modalMessage && (
        <ConfirmModal
          title={modalMessage.title}
          message={modalMessage.message}
          onClose={() => setModalMessage(null)}
        />
      )}
    </div>
  );
}
