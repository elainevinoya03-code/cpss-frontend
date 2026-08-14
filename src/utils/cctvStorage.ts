const CCTV_STORAGE_KEY = "cctv_storage_config";

export type CctvStorageConfig = {
  totalGb: number;
  usedGb: number;
  warnThresholdPct: number;
};

export const DEFAULT_CCTV_STORAGE: CctvStorageConfig = {
  totalGb: 2000,
  usedGb: 1350,
  warnThresholdPct: 85,
};

const listeners: Set<() => void> = new Set();

export function getCctvStorageConfig(): CctvStorageConfig {
  try {
    const raw = localStorage.getItem(CCTV_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CCTV_STORAGE, ...parsed };
    }
  } catch {}
  return DEFAULT_CCTV_STORAGE;
}

export function setCctvStorageConfig(patch: Partial<CctvStorageConfig>) {
  const next = { ...getCctvStorageConfig(), ...patch };
  localStorage.setItem(CCTV_STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function subscribeCctvStorage(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}