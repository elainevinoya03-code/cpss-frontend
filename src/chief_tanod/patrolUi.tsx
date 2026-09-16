import { type ReactNode } from "react";
import { Check, ChevronRight, MapPin, Route, Trash2 } from "lucide-react";
import { PLAN_STATUS_META, TYPE_LABEL, type CpPoint, type PlanStatus, type PlanType } from "./patrolShared";

export function StatusBadge({ status }: { status: PlanStatus }) {
  const meta = PLAN_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function TypeChip({ type }: { type: PlanType }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
        type === "fixed" ? "bg-violet-50 text-violet-700" : "bg-teal-50 text-teal-700"
      }`}
    >
      {type === "fixed" ? <MapPin size={9} /> : <Route size={9} />}
      {TYPE_LABEL[type]}
    </span>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[#334155]">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30";
export const selectCls = inputCls;
export const textareaCls = `${inputCls} resize-none`;

export function Stepper({ step, onSelect }: { step: number; onSelect: (s: number) => void }) {
  const steps = [
    { n: 1, label: "Details" },
    { n: 2, label: "Location" },
    { n: 3, label: "Coverage" },
    { n: 4, label: "Schedule" },
    { n: 5, label: "Notes" },
    { n: 6, label: "Review" },
  ];
  return (
    <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm sm:gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1 sm:gap-2">
          {i > 0 && <ChevronRight size={12} className="shrink-0 text-stone-300" />}
          <button
            onClick={() => onSelect(s.n)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold transition ${
              step === s.n
                ? "bg-[#0038A8] text-white shadow-sm"
                : step > s.n
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "text-stone-400 hover:bg-stone-100"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
                step === s.n ? "bg-white text-[#0038A8]" : step > s.n ? "bg-emerald-600 text-white" : "bg-stone-200"
              }`}
            >
              {step > s.n ? <Check size={8} strokeWidth={3} /> : s.n}
            </span>
            {s.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function PointEditor({ point, index, onChange, onRemove }: {
  point: CpPoint;
  index: number;
  onChange: (patch: Partial<CpPoint>) => void;
  onRemove: () => void;
}) {
  const color = point.kind === "start" ? "bg-green-600" : point.kind === "end" ? "bg-rose-600" : point.kind === "fixed" ? "bg-violet-600" : "bg-sky-600";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${color}`}>
            {point.label}
          </span>
          <span className="text-[11px] font-semibold text-stone-700">
            {point.kind === "start"
              ? "Point A (Start)"
              : point.kind === "end"
                ? "Point B (End)"
                : point.kind === "fixed"
                  ? "Fixed Location"
                  : `Intermediate Checkpoint ${index}`}
          </span>
          <span className="font-mono text-[9px] text-stone-400">
            {point.lat.toFixed(0)}, {point.lng.toFixed(0)}
          </span>
        </div>
        <button
          onClick={onRemove}
          title="Remove point"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={point.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Location name"
          className={inputCls}
        />
        <input
          value={point.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Address"
          className={inputCls}
        />
        <input
          value={point.landmark}
          onChange={(e) => onChange({ landmark: e.target.value })}
          placeholder="Landmark"
          className={inputCls}
        />
        <input
          value={point.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description"
          className={inputCls}
        />
        <input
          value={point.remarks}
          onChange={(e) => onChange({ remarks: e.target.value })}
          placeholder="Remarks"
          className={`${inputCls} sm:col-span-2`}
        />
      </div>
    </div>
  );
}