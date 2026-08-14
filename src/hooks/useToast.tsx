import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, X, XCircle } from "lucide-react";

export type ToastType = "info" | "success" | "warning" | "error";

interface ToastState {
  message: string;
  title: string;
  type: ToastType;
}

const AUTO_DISMISS_MS = 6000;

const TYPE_META: Record<ToastType, { icon: typeof Bell; chip: string; bar: string; label: string }> = {
  success: { icon: CheckCircle2, chip: "bg-emerald-50 text-emerald-600", bar: "#059669", label: "Success" },
  info: { icon: Bell, chip: "bg-[#0038A8]/10 text-[#0038A8]", bar: "#0038A8", label: "Info" },
  warning: { icon: AlertTriangle, chip: "bg-amber-50 text-amber-600", bar: "#d97706", label: "Warning" },
  error: { icon: XCircle, chip: "bg-rose-50 text-rose-600", bar: "#e11d48", label: "Error" },
};

const ERROR_WORDS = ["rejected", "blocked", "failed", "error", "incomplete", "overdue", "cannot", "unable"];
const WARN_WORDS = ["capacity", "warning", "degraded", "caution", "near"];
const SUCCESS_WORDS = [
  "confirmed",
  "created",
  "generated",
  "dispatched",
  "saved",
  "linked",
  "restored",
  "reclaimed",
  "published",
  "sent",
  "authorized",
  "recorded",
  "submitted",
  "opened",
  "resolved",
  "completed",
  "queued",
  "delivered",
  "bound",
  "extracted",
  "redacted",
  "escalated",
  "injected",
  "retracted",
  "purged",
  "reconnected",
  "cleared",
  "marked",
  "routing",
  "routed",
];

function inferType(message: string): ToastType {
  const lower = message.toLowerCase();
  if (ERROR_WORDS.some((w) => lower.includes(w))) return "error";
  if (WARN_WORDS.some((w) => lower.includes(w))) return "warning";
  if (SUCCESS_WORDS.some((w) => lower.includes(w))) return "success";
  return "info";
}

function deriveTitle(message: string): string {
  const idx = message.indexOf(" \u2014 ");
  if (idx > 0) {
    const head = message.slice(0, idx).trim();
    if (head.length <= 80) return head;
  }
  return "Notification";
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const flash = useCallback(
    (msg: string, opts?: { title?: string; type?: ToastType }) => {
      setToast({
        message: msg,
        title: opts?.title ?? deriveTitle(msg),
        type: opts?.type ?? inferType(msg),
      });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  const ToastPortal = useMemo(() => {
    if (!toast) return null;
    const meta = TYPE_META[toast.type];
    const Icon = meta.icon;
    return function ToastPortal() {
      return (
        <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center px-4">
          <div
            className="toast-modal-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl"
            role="status"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-stone-100">
              <div className="toast-progress h-full" style={{ background: meta.bar }} />
            </div>
            <div className="p-6 pt-7">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.chip}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[14px] font-semibold text-stone-900">{toast.title}</h3>
                    <button
                      onClick={dismiss}
                      aria-label="Close"
                      className="rounded p-0.5 text-stone-400 transition hover:text-stone-600"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-stone-500">{toast.message}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${meta.chip}`}>
                      {meta.label}
                    </span>
                    <span className="text-[9px] text-[#94A3B8]">just now</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={dismiss}
                  className="rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#002A8C]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    };
  }, [toast, dismiss]);

  return { toast, flash, dismiss, ToastPortal };
}
