export function batteryColor(pct: number) {
  if (pct <= 15) return "bg-rose-500";
  if (pct <= 35) return "bg-amber-400";
  return "bg-emerald-500";
}

export function signalColor(pct: number) {
  if (pct === 0) return "bg-rose-500";
  if (pct <= 40) return "bg-amber-400";
  return "bg-emerald-500";
}
