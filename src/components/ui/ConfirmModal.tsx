import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function ConfirmModal({
  type = "success",
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  loadingLabel,
}: {
  type?: "confirm" | "success";
  title: string;
  message: string;
  onConfirm?: () => void;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  loadingLabel?: string;
}) {
  if (type === "confirm") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 modal-panel-in text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <AlertTriangle size={24} className="text-rose-600" />
          </div>
          <h3 className="mt-3 text-[14px] font-semibold text-stone-900">{title}</h3>
          <p className="mt-1.5 text-[12px] text-stone-500">{message}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1 ${
                tone === "primary" ? "bg-[#15803D] hover:bg-[#166534]" : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading && loadingLabel ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 modal-panel-in text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 size={24} className="text-emerald-600" />
        </div>
        <h3 className="mt-3 text-[14px] font-semibold text-stone-900">{title}</h3>
        <p className="mt-1.5 text-[12px] text-stone-500">{message}</p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#166534]"
        >
          Done
        </button>
      </div>
    </div>
  );
}