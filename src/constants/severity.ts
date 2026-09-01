export const SEVERITY_MAP = {
  critical: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", label: "Critical" },
  warning: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", label: "Warning" },
  low: { badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400", label: "Low" },
  resolved: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", label: "Resolved" },
} as const;

export const INCIDENT_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

export const PRIORITY_META: Record<IncidentPriority, { chip: string; dot: string }> = {
  Low: { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  Medium: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  High: { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  Critical: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};
