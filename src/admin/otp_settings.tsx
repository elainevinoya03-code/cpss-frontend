import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Send,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useToast } from "../hooks/useToast";

const API_BASE = import.meta.env.VITE_API_URL || "";

const INPUT_CLASS =
  "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8]";

const PURPOSES = [
  { key: "login", label: "Login" },
  { key: "account_verification", label: "Account Verification" },
  { key: "password_reset", label: "Password Reset" },
];

const SECURITIES = ["STARTTLS", "SSL/TLS"];

type OtpSettingsSnapshot = {
  otpEnabled: boolean;
  deliveryMethod: string;
  emailProvider: string;
  gmailAddress: string;
  gmailPasswordSet: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
  otpLength: number;
  otpExpirationSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  maxResendAttempts: number;
  otpPurpose: string;
};

const DEFAULT_FORM: OtpSettingsSnapshot = {
  otpEnabled: true,
  deliveryMethod: "email",
  emailProvider: "gmail",
  gmailAddress: "",
  gmailPasswordSet: false,
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpSecurity: "STARTTLS",
  otpLength: 6,
  otpExpirationSeconds: 300,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxResendAttempts: 5,
  otpPurpose: "login",
};

async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = Array.isArray(data.detail)
      ? (data.detail[0]?.msg ?? "Request failed")
      : data.detail;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export type OtpSettingsHandle = {
  saveSettings: () => Promise<boolean>;
};

type Props = {
  onDirtyChange: (dirty: boolean) => void;
};

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-bold text-stone-900">{title}</h3>
      <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

const OtpSettings = forwardRef<OtpSettingsHandle, Props>(function OtpSettings(
  { onDirtyChange },
  ref,
) {
  const { flash, ToastPortal } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<OtpSettingsSnapshot>(DEFAULT_FORM);
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await apiFetch<OtpSettingsSnapshot>("/api/otp/settings");
      setForm({
        ...DEFAULT_FORM,
        ...data,
      });
      setGmailAppPassword("");
      setPasswordDirty(false);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to load OTP settings", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const markDirty = useCallback(() => onDirtyChange(true), [onDirtyChange]);

  function update<K extends keyof OtpSettingsSnapshot>(patch: Pick<OtpSettingsSnapshot, K>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setTestStatus(null);
    markDirty();
  }

  function onPasswordChange(value: string) {
    setGmailAppPassword(value);
    setTestStatus(null);
    if (value.trim().length > 0) {
      setPasswordDirty(true);
      markDirty();
    }
  }

  const saveSettings = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const saved = await apiFetch<OtpSettingsSnapshot>("/api/otp/settings", {
        method: "PUT",
        body: JSON.stringify({
          otpEnabled: form.otpEnabled,
          gmailAddress: form.gmailAddress.trim(),
          gmailAppPassword: passwordDirty ? gmailAppPassword : "",
          smtpHost: form.smtpHost.trim(),
          smtpPort: clampInt(form.smtpPort, 1, 65535, 587),
          smtpSecurity: form.smtpSecurity,
          otpLength: clampInt(form.otpLength, 4, 10, 6),
          otpExpirationSeconds: clampInt(form.otpExpirationSeconds, 30, 7200, 300),
          maxAttempts: clampInt(form.maxAttempts, 1, 20, 5),
          resendCooldownSeconds: clampInt(form.resendCooldownSeconds, 15, 3600, 60),
          maxResendAttempts: clampInt(form.maxResendAttempts, 1, 20, 5),
          otpPurpose: form.otpPurpose,
        }),
      });
      setForm((prev) => ({ ...prev, gmailPasswordSet: saved.gmailPasswordSet }));
      setGmailAppPassword("");
      setPasswordDirty(false);
      onDirtyChange(false);
      flash("OTP settings saved", { type: "success" });
      return true;
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to save OTP settings", { type: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, passwordDirty, gmailAppPassword, flash, onDirtyChange]);

  useImperativeHandle(ref, () => ({ saveSettings }));

  async function sendTest() {
    setTestStatus(null);
    const recipient = testEmail.trim();
    if (!recipient) {
      setTestStatus({ ok: false, message: "Please enter a test recipient email address." });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      setTestStatus({ ok: false, message: "Please enter a valid test recipient email address." });
      return;
    }
    setTesting(true);
    try {
      const data = await apiFetch<{
        success: boolean;
        message: string;
        expiresAt?: string;
        purpose?: string | null;
      }>("/api/otp/test", {
        method: "POST",
        body: JSON.stringify({ email: recipient, purpose: form.otpPurpose }),
      });
      if (data.success) {
        const expires = data.expiresAt ? new Date(data.expiresAt) : null;
        const expiresText = expires
          ? ` Valid until ${expires.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}.`
          : "";
        setTestStatus({
          ok: true,
          message: data.message + expiresText,
        });
      } else {
        setTestStatus({ ok: false, message: data.message || "Failed to send the test OTP." });
      }
    } catch (err) {
      setTestStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to send the test OTP.",
      });
    } finally {
      setTesting(false);
    }
  }

  const otpExpirationMinutes = useMemo(
    () => String(Math.round((form.otpExpirationSeconds || 300) / 60)),
    [form.otpExpirationSeconds],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-6 py-16 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-[#0038A8]" />
        <p className="text-sm text-stone-500">Loading OTP settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <ToastPortal />
      </div>

      <Card title="OTP Configuration" subtitle="Rules applied when verification codes are issued for the platform">
        <Row label="OTP Authentication" hint="Master switch for OTP email verification system-wide">
          <Toggle checked={form.otpEnabled} onChange={(v) => update({ otpEnabled: v })} />
        </Row>

        <Row label="OTP Delivery Method" hint="Codes are always delivered by email">
          <select value="email" disabled className={INPUT_CLASS + " cursor-not-allowed bg-stone-50 text-stone-400"}>
            <option value="email">Email</option>
          </select>
        </Row>

        <Row label="Email Provider" hint="Verification emails are sent through Gmail SMTP">
          <select value="gmail" disabled className={INPUT_CLASS + " cursor-not-allowed bg-stone-50 text-stone-400"}>
            <option value="gmail">Gmail</option>
          </select>
        </Row>

        <Row label="OTP Length" hint="Number of digits in each generated code">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={4}
              max={10}
              value={form.otpLength}
              onChange={(e) => update({ otpLength: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
            <span className="text-xs text-stone-400">digits</span>
          </div>
        </Row>

        <Row label="OTP Expiration" hint="How long a code stays valid before it expires">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={otpExpirationMinutes}
              onChange={(e) => {
                if (e.target.value === "") return;
                update({ otpExpirationSeconds: Math.max(30, Math.round(Number(e.target.value) * 60)) });
              }}
              className={INPUT_CLASS}
            />
            <span className="text-xs text-stone-400">minutes</span>
          </div>
        </Row>

        <Row label="Maximum Verification Attempts" hint="Failed attempts allowed before the code is locked">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={form.maxAttempts}
              onChange={(e) => update({ maxAttempts: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
            <span className="text-xs text-stone-400">attempts</span>
          </div>
        </Row>

        <Row label="Resend Cooldown" hint="Minimum wait before a new code can be requested for the same recipient">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={15}
              max={3600}
              value={form.resendCooldownSeconds}
              onChange={(e) => update({ resendCooldownSeconds: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
            <span className="text-xs text-stone-400">seconds</span>
          </div>
        </Row>

        <Row label="Maximum Resend Attempts" hint="How many times a code can be re-issued before requiring a new session">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={form.maxResendAttempts}
              onChange={(e) => update({ maxResendAttempts: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
            <span className="text-xs text-stone-400">attempts</span>
          </div>
        </Row>

        <Row label="OTP Purpose" hint="Purpose stamped on codes issued by the platform (including the test sender)">
          <select
            value={form.otpPurpose}
            onChange={(e) => update({ otpPurpose: e.target.value })}
            className={INPUT_CLASS}
          >
            {PURPOSES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>
      </Card>

      <Card title="Gmail SMTP Configuration" subtitle="Sender account and server used to deliver verification emails">
        <Row label="Gmail Address" hint="Gmail account that will send the OTP emails">
          <div className="relative">
            <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="email"
              value={form.gmailAddress}
              onChange={(e) => update({ gmailAddress: e.target.value })}
              placeholder="otp@example.com"
              className={INPUT_CLASS + " pl-9"}
            />
          </div>
        </Row>

        <Row
          label="Gmail App Password"
          hint={
            form.gmailPasswordSet
              ? "A password is configured. Leave blank to keep it, or type a new one to replace it."
              : "16-character Google App Password for the sender account"
          }
        >
          <div className="relative">
            <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="password"
              value={gmailAppPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={form.gmailPasswordSet ? "••••••••••••••••" : "Enter Gmail App Password"}
              className={INPUT_CLASS + " pr-9"}
              autoComplete="new-password"
            />
            {form.gmailPasswordSet && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ShieldCheck size={14} className="text-emerald-500" />
              </span>
            )}
          </div>
        </Row>

        <Row label="SMTP Host" hint="Gmail SMTP endpoint">
          <input
            type="text"
            value={form.smtpHost}
            onChange={(e) => update({ smtpHost: e.target.value })}
            className={INPUT_CLASS}
          />
        </Row>

        <Row label="SMTP Port" hint="Standard Gmail STARTTLS port">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={65535}
              value={form.smtpPort}
              onChange={(e) => update({ smtpPort: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
          </div>
        </Row>

        <Row label="Connection Security" hint="STARTTLS (port 587) is the Gmail default">
          <select
            value={form.smtpSecurity}
            onChange={(e) => update({ smtpSecurity: e.target.value })}
            className={INPUT_CLASS}
          >
            {SECURITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Row>

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Credentials stay secure</p>
            <p className="mt-0.5 text-xs opacity-80">
              The Gmail App Password is encrypted on the server and is never shown again after it
              is saved. It is never exposed to the browser, API responses, or logs. Use a Google
              App Password — never the normal account password.
            </p>
          </div>
        </div>
      </Card>

      <Card title="OTP Testing" subtitle="Send a real test code through the configured Gmail account">
        <Row label="Test Recipient Email" hint="Any address you can use to receive the verification email">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => {
              setTestEmail(e.target.value);
              setTestStatus(null);
            }}
            placeholder="recipient@example.com"
            className={INPUT_CLASS}
          />
        </Row>

        <Row label="Send Test OTP" hint="Emails a real code so you can confirm deliverability">
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing}
            className="flex items-center justify-center gap-2 rounded-md bg-[#0038A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
          >
            {testing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Send size={14} />
            )}
            Send Test OTP
          </button>
        </Row>

        {testStatus && (
          <div
            className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
              testStatus.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
            role="status"
          >
            {testStatus.ok ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium">{testStatus.ok ? "Test sent successfully" : "Test failed"}</p>
              <p className="mt-0.5 text-xs opacity-80">{testStatus.message}</p>
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-6 py-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs text-stone-400">
          <KeyRound size={13} />
          OTP configuration changes apply platform-wide upon saving.
        </p>
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-[#0038A8] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-50"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Save size={14} />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
});

export default OtpSettings;