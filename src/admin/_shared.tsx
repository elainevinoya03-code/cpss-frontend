import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// ─── Date helpers ──────────────────────────────────────────────────────────────

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export const formatDateTime = (d: Date) => {
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} \u00b7 ${time}`;
};

// ─── Math / geometry helpers ───────────────────────────────────────────────────

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function crossProduct(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function onSegment(p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

export function segmentsIntersect(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const o1 = crossProduct(a, b, c);
  const o2 = crossProduct(a, b, d);
  const o3 = crossProduct(c, d, a);
  const o4 = crossProduct(c, d, b);
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

export function pointInPolygon(p: { x: number; y: number }, nodes: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
    const xi = nodes[i].x, yi = nodes[i].y;
    const xj = nodes[j].x, yj = nodes[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ─── Shared Tailwind class strings ─────────────────────────────────────────────

export const INPUT_CLASS =
  "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]";

export const STYLES = {
  input:
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/15 disabled:cursor-not-allowed disabled:bg-stone-50",
  select:
    "w-full appearance-none rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/15",
  label:
    "mb-1.5 block text-[11px] font-semibold tracking-wide text-stone-500",
  section:
    "rounded-xl border border-stone-200 bg-white p-6 shadow-sm",
  sectionTitle: "text-base font-bold text-stone-900",
  sectionDesc: "mt-1 text-xs text-stone-400",
  primaryBtn:
    "flex items-center justify-center gap-2 rounded-md bg-[#15803D] py-2.5 text-sm font-semibold text-white transition hover:bg-[#166534] active:scale-[0.99]",
  secondaryBtn:
    "flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50",
};

export const ACTION_STYLES: Record<string, string> = {
  "Configuration Change": "bg-green-50 text-green-700",
  "User Deactivation": "bg-red-50 text-red-600",
  "User Disabled": "bg-red-50 text-red-600",
  "User Enabled": "bg-emerald-50 text-emerald-700",
  "Device Registration": "bg-rose-50 text-rose-800",
  "Geofence Update": "bg-purple-50 text-purple-700",
  "Boundary Created": "bg-purple-50 text-purple-700",
  "Boundary Updated": "bg-purple-50 text-purple-700",
  "Boundary Deleted": "bg-rose-50 text-rose-700",
  "User Created": "bg-emerald-50 text-emerald-700",
  "User Updated": "bg-sky-50 text-sky-700",
  "Password Reset": "bg-indigo-50 text-indigo-600",
  "Device Updated": "bg-cyan-50 text-cyan-700",
  "Device Deleted": "bg-rose-50 text-rose-700",
  "Device Decommissioned": "bg-rose-50 text-rose-700",
  "Device Disabled": "bg-amber-50 text-amber-700",
  "Device Enabled": "bg-emerald-50 text-emerald-700",
  "Device Connectivity Test": "bg-cyan-50 text-cyan-700",
  "System Alert": "bg-orange-50 text-orange-600",
  "Camera Registration": "bg-pink-50 text-pink-700",
  "Camera Placement": "bg-violet-50 text-violet-700",
  "Camera Updated": "bg-fuchsia-50 text-fuchsia-700",
  "Camera Deleted": "bg-rose-50 text-rose-700",
  "Patrol Routes": "bg-teal-50 text-teal-700",
  "Data Request Processed": "bg-teal-50 text-teal-700",
  "Credential Provisioned": "bg-sky-50 text-sky-700",
  "Credential Rotated": "bg-indigo-50 text-indigo-700",
  "Credential Revoked": "bg-rose-50 text-rose-700",
  "Camera Connectivity Test": "bg-cyan-50 text-cyan-700",
  "Camera Enabled": "bg-emerald-50 text-emerald-700",
  "Camera Disabled": "bg-amber-50 text-amber-700",
  "Camera Placed Under Maintenance": "bg-sky-50 text-sky-700",
  "Camera Restored": "bg-emerald-50 text-emerald-700",
  "Mass Broadcast": "bg-fuchsia-50 text-fuchsia-700",
};

// ─── Shared UI components ──────────────────────────────────────────────────────

export function MapControlButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active ? "bg-[#15803D] text-white" : "text-stone-600 hover:bg-stone-100"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-stone-400">{label}</span>
      <span className="text-right text-[13px] font-medium text-stone-800">{value}</span>
    </div>
  );
}

export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="mt-0.5 truncate text-[12.5px] font-medium text-stone-800">{children}</div>
    </div>
  );
}

export function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-2 py-2 text-center">
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className={STYLES.section}>
      <h3 className={STYLES.sectionTitle}>{title}</h3>
      {subtitle && <p className={STYLES.sectionDesc}>{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function FormSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-semibold tracking-wide text-stone-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}
