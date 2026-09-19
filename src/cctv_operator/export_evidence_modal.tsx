import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { Modal } from "../components/ui";
import { addEvidenceActivity } from "./evidence_activity";

type Stage = "confirm" | "preparing" | "done";

export function ExportEvidenceModal({
  clipId,
  incidentId,
  operator,
  subtitle,
  onClose,
}: {
  clipId: string;
  incidentId?: string;
  operator: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("confirm");

  useEffect(() => {
    if (stage !== "preparing") return;
    const t = setTimeout(() => {
      addEvidenceActivity({ action: "Exported", clipId, incidentId, operator });
      setStage("done");
    }, 1400);
    return () => clearTimeout(t);
  }, [stage, clipId, incidentId, operator]);

  const footer =
    stage === "confirm" ? (
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          onClick={() => setStage("preparing")}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
        >
          <Download size={13} />
          Export Evidence
        </button>
      </div>
    ) : stage === "preparing" ? (
      <div className="flex justify-end">
        <button disabled className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white opacity-70">
          <Loader2 size={13} className="animate-spin" />
          Preparing…
        </button>
      </div>
    ) : (
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534]"
        >
          <CheckCircle2 size={13} />
          Close
        </button>
      </div>
    );

  return (
    <Modal
      onClose={onClose}
      title={`Export Evidence — ${clipId}`}
      subtitle={subtitle}
      icon={<Download size={18} />}
      iconClass="bg-emerald-50 text-emerald-600"
      size="md"
      footer={footer}
    >
      <div className="flex flex-col items-center justify-center py-8 text-center">
        {stage === "confirm" && (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Download size={22} />
            </span>
            <p className="text-[15px] font-bold text-stone-900">Export {clipId}?</p>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-stone-500">
              This action will export the selected CCTV evidence for authorized operational use.
            </p>
          </>
        )}
        {stage === "preparing" && (
          <>
            <Loader2 size={26} className="mb-3 animate-spin text-[#15803D]" />
            <p className="text-[14px] font-bold text-stone-900">Preparing export…</p>
            <p className="mt-1 text-[11px] text-stone-400">Packaging {clipId} — simulated preparation, no file leaves the system.</p>
          </>
        )}
        {stage === "done" && (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={24} />
            </span>
            <p className="text-[15px] font-bold text-stone-900">Evidence Exported</p>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-stone-500">
              {clipId} was exported for authorized operational use. The action has been recorded as{" "}
              <span className="font-semibold">EXPORTED</span> in Evidence Activity.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
