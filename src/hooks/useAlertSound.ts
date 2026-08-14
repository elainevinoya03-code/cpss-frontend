import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_KEY = "cctv_alert_muted";

export type AlertKind = "critical" | "info" | "offline";

const PATTERNS: Record<AlertKind, number[]> = {
  critical: [880, 1100, 880],
  info: [660, 880],
  offline: [440, 330],
};

export function useAlertSound() {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {}
  }, [muted]);

  const beep = useCallback(
    (kind: AlertKind) => {
      if (muted) return;
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = ctxRef.current ?? new Ctor();
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        PATTERNS[kind].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const t = ctx.currentTime + i * 0.16;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
        });
      } catch {}
    },
    [muted]
  );

  return { muted, setMuted, beep };
}
