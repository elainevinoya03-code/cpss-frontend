import {
  Flame,
  Volume2,
  Siren,
  AlertTriangle,
  Eye,
  Shield,
  Flag,
  Smartphone,
  Camera,
  Zap,
  ImageIcon,
  Lock,
  Home,
  Users,
  ShieldAlert,
  Car,
  Trash2,
  PawPrint,
  HelpCircle,
  Building2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// §12.2 — Category icon and colour maps shared across Desk Officer modules.
// ---------------------------------------------------------------------------

export const CATEGORY_ICON: Record<string, typeof Flame> = {
  "Fire or Smoke": Flame,
  "Noise Disturbance": Volume2,
  "Public Disturbance": Siren,
  "Hazard or Obstruction": AlertTriangle,
  "Suspicious Activity": Eye,
  "Medical or Welfare Concern": Shield,
  Other: Flag,
  // Canonical categories from the resident app report specification
  // (resident_app/lib/frontend/report.dart)
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
  // Alternate labels used by active_dispatches
  "Fire/Smoke": Flame,
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Fire or Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
  "Noise Disturbance": { bg: "bg-amber-50", text: "text-amber-600" },
  "Public Disturbance": { bg: "bg-orange-50", text: "text-orange-600" },
  "Hazard or Obstruction": { bg: "bg-yellow-50", text: "text-yellow-600" },
  "Suspicious Activity": { bg: "bg-violet-50", text: "text-violet-600" },
  "Medical or Welfare Concern": { bg: "bg-emerald-50", text: "text-emerald-600" },
  Other: { bg: "bg-stone-100", text: "text-stone-600" },
  // Canonical categories from the resident app report specification
  "Public Safety & Peace and Order": { bg: "bg-rose-50", text: "text-rose-600" },
  "Crime & Property": { bg: "bg-slate-100", text: "text-slate-700" },
  "Domestic & Family": { bg: "bg-green-50", text: "text-green-600" },
  "Community Disputes": { bg: "bg-green-50", text: "text-green-600" },
  "Violence & Gender-Related": { bg: "bg-rose-50", text: "text-rose-700" },
  "Traffic & Road": { bg: "bg-amber-50", text: "text-amber-600" },
  "Environmental & Sanitation": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "Animal-Related": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Missing / Welfare": { bg: "bg-sky-50", text: "text-sky-600" },
  "Barangay / Administrative": { bg: "bg-stone-100", text: "text-stone-600" },
  // Alternate labels used by active_dispatches
  "Fire/Smoke": { bg: "bg-rose-50", text: "text-rose-600" },
};

// ---------------------------------------------------------------------------
// §12.4 — Dispatch status metadata shared across dashboard and dispatches.
// ---------------------------------------------------------------------------

export type DispatchStatus = "responding" | "on_scene" | "resolving" | "resolved";

export const DISPATCH_META: Record<
  DispatchStatus,
  { label: string; action: string | null; next?: DispatchStatus; badge: string; dot: string }
> = {
  responding: {
    label: "Responding",
    action: "On-Scene",
    next: "on_scene",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-400",
  },
  on_scene: {
    label: "On-Scene",
    action: "Resolving",
    next: "resolving",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
  },
  resolving: {
    label: "Resolving",
    action: "Resolved",
    next: "resolved",
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-400",
  },
  resolved: {
    label: "Resolved",
    action: null,
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-400",
  },
};

// ---------------------------------------------------------------------------
// §13.2 — On-duty Tanod teams shared across dispatches and IoT alert center.
// ---------------------------------------------------------------------------

export const ON_DUTY_TANODS = [
  { id: "t1", name: "Team Alpha", members: 4, availability: "dispatched" as const, purok: "Purok 1" },
  { id: "t2", name: "Team Bravo", members: 3, availability: "available" as const, purok: "Purok 5" },
  { id: "t3", name: "Team Charlie", members: 4, availability: "available" as const, purok: "Purok 2" },
  { id: "t4", name: "Team Delta", members: 3, availability: "available" as const, purok: "Purok 5" },
];

// ---------------------------------------------------------------------------
// §13.3 — Navigation route steps for dispatch directions.
// ---------------------------------------------------------------------------

export const ROUTE_STEPS = [
  { text: "Head north on Barangay Road toward Plaza", dist: "400 m" },
  { text: "Turn left at Plaza Junction", dist: "50 m" },
  { text: "Continue straight — incident point on right", dist: "120 m" },
];

// ---------------------------------------------------------------------------
// §14.1 — Weekly shift schedule shared across dashboard and patrol scheduler.
// ---------------------------------------------------------------------------

export const SHIFT_SCHEDULE = [
  { day: "Mon", morning: "Alpha", night: "Bravo" },
  { day: "Tue", morning: "Bravo", night: "Charlie" },
  { day: "Wed", morning: "Charlie", night: "Delta" },
  { day: "Thu", morning: "Delta", night: "Alpha" },
  { day: "Fri", morning: "Alpha", night: "Charlie" },
  { day: "Sat", morning: "Bravo", night: "Delta" },
  { day: "Sun", morning: "Charlie", night: "Alpha" },
];
