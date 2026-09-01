import { Volume2, VolumeX } from "lucide-react";

export default function SoundToggle({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={muted ? "Unmute alerts" : "Mute alerts"}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
        muted
          ? "border-stone-300 bg-white text-stone-400"
          : "border-[#0038A8] bg-white text-[#0038A8] hover:bg-[#0038A8]/5"
      }`}
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      {muted ? "Alerts muted" : "Alerts on"}
    </button>
  );
}
