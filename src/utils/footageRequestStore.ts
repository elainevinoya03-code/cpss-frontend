// Shared footage request store — the formal connection between the Barangay
// Desk Officer (requester) and the CCTV Operator (fulfiller).
//
// Status lifecycle: pending → in_progress → completed  (or cancelled)
// Completed requests carry downloadable clips, stills, metadata and a full
// chain-of-custody log so the Desk Officer can attach evidence to the official
// blotter. The CCTV Operator workflow lives in cctv_operator/ and drives these
// transitions; this store is the single source of truth the dashboard listens to.

export type FootageRequestStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface RequestEvent {
  at: string;
  status: FootageRequestStatus;
  by: string;
  note?: string;
}

export interface RequestClip {
  id: string;
  cameraName: string;
  start: string;
  end: string;
  durationSec: number;
  fileType: string;
  sizeMB: number;
  storageUrl: string;
  privacyProcessed: boolean;
}

export interface RequestStill {
  id: string;
  cameraName: string;
  at: string;
  storageUrl: string;
}

export interface CustodyEvent {
  at: string;
  actor: string;
  action: string;
  note?: string;
}

export interface FootageRequest {
  id: string;
  incidentId?: string;
  cameraId?: string;
  cameraName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  eventTag?: string;
  purpose: string;
  priority: "standard" | "urgent";
  requestedBy: string;
  requestedByRole: string;
  requestedAt: string;
  status: FootageRequestStatus;
  note?: string;

  operatorStatus?: string;
  requestHistory?: RequestEvent[];
  clips?: RequestClip[];
  stills?: RequestStill[];
  metadata?: Record<string, string>;
  chainOfCustody?: CustodyEvent[];
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export const REQUEST_STATUS_META: Record<
  FootageRequestStatus,
  { label: string; badge: string; dot: string }
> = {
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  in_progress: { label: "In Progress", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  completed: { label: "Completed", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

const SEED: FootageRequest[] = [
  {
    id: "FR-1001",
    incidentId: "INC-2069",
    cameraId: "CAM-MARKET-03",
    cameraName: "Camera 3 · Public Market",
    date: "2026-09-01",
    startTime: "22:14:30",
    endTime: "22:16:00",
    eventTag: "Public Disturbance",
    purpose: "Evidence for blotter — document the sustained noise escalation reported at the market strip.",
    priority: "urgent",
    requestedBy: "Maria Santos",
    requestedByRole: "Barangay Desk Officer",
    requestedAt: "2026-09-01T22:16:30",
    status: "in_progress",
    operatorStatus: "Scanning archive for the exact requested window…",
    requestHistory: [
      { at: "2026-09-01T22:16:30", status: "pending", by: "Maria Santos", note: "Request filed and forwarded to CCTV Operator." },
      { at: "2026-09-01T22:18:05", status: "in_progress", by: "CO-01", note: "Operator acknowledged and began archive search." },
    ],
    metadata: {
      Camera: "CAM-MARKET-03 · Public Market · Purok 6",
      "Requested Window": "22:14:30 – 22:16:00",
      "Event Tag": "Public Disturbance",
      Recorder: "System (managed)",
      Format: "video/mp4 · H.264",
    },
    chainOfCustody: [
      { at: "2026-09-01T22:16:30", actor: "Maria Santos (Desk Officer)", action: "Request filed", note: "Forwarded to CCTV Operator queue." },
      { at: "2026-09-01T22:18:05", actor: "CO-01 (CCTV Operator)", action: "Request acknowledged", note: "Archive search started." },
    ],
  },
  {
    id: "FR-1002",
    incidentId: "INC-2070",
    cameraId: "CAM-PLAZA-02",
    cameraName: "Camera 2 · Plaza & Court",
    date: "2026-09-01",
    startTime: "10:00:00",
    endTime: "10:15:00",
    eventTag: "Suspicious Activity",
    purpose: "Review group loitering near the basketball court flagged by the operator.",
    priority: "standard",
    requestedBy: "Maria Santos",
    requestedByRole: "Barangay Desk Officer",
    requestedAt: "2026-09-01T10:20:00",
    status: "pending",
    operatorStatus: "Queued — awaiting operator.",
    requestHistory: [
      { at: "2026-09-01T10:20:00", status: "pending", by: "Maria Santos", note: "Request filed and forwarded to CCTV Operator." },
    ],
    metadata: {
      Camera: "CAM-PLAZA-02 · Plaza & Court · Purok 2",
      "Requested Window": "10:00:00 – 10:15:00",
      "Event Tag": "Suspicious Activity",
      Recorder: "System (managed)",
    },
    chainOfCustody: [
      { at: "2026-09-01T10:20:00", actor: "Maria Santos (Desk Officer)", action: "Request filed", note: "Forwarded to CCTV Operator queue." },
    ],
  },
  {
    id: "FR-1003",
    incidentId: "INC-2068",
    cameraId: "CAM-GATE-01",
    cameraName: "Camera 1 · Main Gate",
    date: "2026-09-01",
    startTime: "09:00:00",
    endTime: "09:15:00",
    eventTag: "Suspicious Activity",
    purpose: "Confirm which vehicle entered the gate when the smoke density sensor tripped.",
    priority: "urgent",
    requestedBy: "Ramon Cruz",
    requestedByRole: "Barangay Desk Officer",
    requestedAt: "2026-09-01T09:20:00",
    status: "pending",
    operatorStatus: "Queued — awaiting operator.",
    requestHistory: [
      { at: "2026-09-01T09:20:00", status: "pending", by: "Ramon Cruz", note: "Request filed and forwarded to CCTV Operator." },
    ],
    metadata: {
      Camera: "CAM-GATE-01 · Main Gate · Purok 1",
      "Requested Window": "09:00:00 – 09:15:00",
      "Event Tag": "Suspicious Activity",
      Recorder: "System (managed)",
    },
    chainOfCustody: [
      { at: "2026-09-01T09:20:00", actor: "Ramon Cruz (Desk Officer)", action: "Request filed", note: "Forwarded to CCTV Operator queue." },
    ],
  },
  {
    id: "FR-1004",
    incidentId: "INC-2071",
    cameraId: "CAM-ROAD-05",
    cameraName: "Camera 5 · Crossing Road",
    date: "2026-09-01",
    startTime: "17:00:00",
    endTime: "17:10:00",
    eventTag: "Road Obstruction",
    purpose: "Evidence for blotter — document the post-rain traffic build-up for a road-safety report.",
    priority: "standard",
    requestedBy: "Ramon Cruz",
    requestedByRole: "Barangay Desk Officer",
    requestedAt: "2026-09-01T17:05:00",
    status: "completed",
    operatorStatus: "Delivered.",
    completedAt: "2026-09-01T17:12:00",
    completedBy: "CO-01",
    requestHistory: [
      { at: "2026-09-01T17:05:00", status: "pending", by: "Ramon Cruz", note: "Request filed and forwarded to CCTV Operator." },
      { at: "2026-09-01T17:07:00", status: "in_progress", by: "CO-01", note: "Operator located footage in archive." },
      { at: "2026-09-01T17:12:00", status: "completed", by: "CO-01", note: "Clip and stills generated, privacy-processed, and delivered." },
    ],
    clips: [
      {
        id: "CLIP-2026-0003",
        cameraName: "Crossing Road",
        start: "2026-09-01T17:01:10",
        end: "2026-09-01T17:01:45",
        durationSec: 35,
        fileType: "video/mp4",
        sizeMB: 7.1,
        storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/CLIP-2026-0003.mp4",
        privacyProcessed: true,
      },
    ],
    stills: [
      {
        id: "STL-2026-0101",
        cameraName: "Crossing Road",
        at: "2026-09-01T17:01:22",
        storageUrl: "https://brgyculiat.supabase.co/storage/v1/object/public/cctv-clips/STL-2026-0101.jpg",
      },
    ],
    metadata: {
      Camera: "CAM-ROAD-05 · Crossing Road · Purok 3",
      "Requested Window": "17:00:00 – 17:10:00",
      "Event Tag": "Road Obstruction",
      Recorder: "External (off-grid)",
      Format: "video/mp4 · H.264",
      "Retention Status": "Legal hold · 1 year",
      Completed: "CO-01 · 17:12",
      "Content Hash": "sha256:9b1e0d…4f2a",
    },
    chainOfCustody: [
      { at: "2026-09-01T17:05:00", actor: "Ramon Cruz (Desk Officer)", action: "Request filed", note: "Forwarded to CCTV Operator queue." },
      { at: "2026-09-01T17:07:00", actor: "CO-01 (CCTV Operator)", action: "Footage located", note: "Crossing Road archive for requested window." },
      { at: "2026-09-01T17:12:00", actor: "CO-01 (CCTV Operator)", action: "Clip delivered", note: "1 clip + 1 still attached; privacy-processed." },
      { at: "2026-09-01T17:15:00", actor: "Ramon Cruz (Desk Officer)", action: "Evidence reviewed", note: "Reviewed clip + still before blotter attachment." },
    ],
  },
  {
    id: "FR-1005",
    incidentId: "INC-2067",
    cameraId: "CAM-MARKET-03",
    cameraName: "Camera 3 · Public Market",
    date: "2026-08-31",
    startTime: "16:00:00",
    endTime: "16:10:00",
    eventTag: "Public Disturbance",
    purpose: "Review the street altercation to support the late-night noise complaint file.",
    priority: "standard",
    requestedBy: "Maria Santos",
    requestedByRole: "Barangay Desk Officer",
    requestedAt: "2026-08-31T16:15:00",
    status: "cancelled",
    operatorStatus: "Cancelled — recording unavailable for exact window.",
    cancelledAt: "2026-08-31T16:30:00",
    cancelledBy: "CO-01",
    requestHistory: [
      { at: "2026-08-31T16:15:00", status: "pending", by: "Maria Santos", note: "Request filed and forwarded to CCTV Operator." },
      { at: "2026-08-31T16:30:00", status: "cancelled", by: "CO-01", note: "Recording for the exact window is unavailable in the archive." },
    ],
    metadata: {
      Camera: "CAM-MARKET-03 · Public Market · Purok 6",
      "Requested Window": "16:00:00 – 16:10:00",
      "Event Tag": "Public Disturbance",
    },
    chainOfCustody: [
      { at: "2026-08-31T16:15:00", actor: "Maria Santos (Desk Officer)", action: "Request filed", note: "Forwarded to CCTV Operator queue." },
      { at: "2026-08-31T16:30:00", actor: "CO-01 (CCTV Operator)", action: "Request cancelled", note: "Recording unavailable in archive." },
    ],
  },
];

let requests: FootageRequest[] = [...SEED];
let nextRequest = 1006;
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function stamp(iso?: string) {
  return iso ?? new Date().toISOString();
}

export function getFootageRequests(): FootageRequest[] {
  return requests;
}

export function subscribeFootageRequests(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getPendingFootageRequests(): FootageRequest[] {
  return requests.filter((r) => r.status === "pending" || r.status === "in_progress");
}

export function getCompletedFootageRequests(): FootageRequest[] {
  return requests.filter((r) => r.status === "completed");
}

export function getFootageRequestById(id: string): FootageRequest | undefined {
  return requests.find((r) => r.id === id);
}

export function addFootageRequest(input: Omit<FootageRequest, "id" | "requestedAt" | "status">): FootageRequest {
  const now = new Date().toISOString();
  const request: FootageRequest = {
    ...input,
    id: `FR-${String(nextRequest++).padStart(4, "0")}`,
    requestedAt: now,
    status: "pending",
    operatorStatus: "Queued — awaiting operator.",
    requestHistory: [{ at: now, status: "pending", by: input.requestedBy, note: "Request filed and forwarded to CCTV Operator." }],
    metadata: {
      Camera: `${input.cameraId ?? "Any"}${input.cameraName ? ` · ${input.cameraName}` : ""}`,
      "Requested Window": input.startTime && input.endTime ? `${input.startTime} – ${input.endTime}` : "Any",
      "Event Tag": input.eventTag ?? "—",
    },
    chainOfCustody: [{ at: now, actor: `${input.requestedBy} (${input.requestedByRole})`, action: "Request filed", note: "Forwarded to CCTV Operator queue." }],
  };
  requests = [request, ...requests];
  emit();
  return request;
}

export function setFootageRequestStatus(id: string, status: FootageRequestStatus): void {
  updateFootageRequest(id, { status });
}

// The CCTV Operator drives these transitions; the dashboard only reflects them.
export function updateFootageRequest(id: string, patch: Partial<FootageRequest>): FootageRequest | undefined {
  let updated: FootageRequest | undefined;
  requests = requests.map((r) => {
    if (r.id !== id) return r;
    const status = patch.status ?? r.status;
    const history = [...(r.requestHistory ?? [])];
    if (patch.status && patch.status !== r.status) {
      history.push({
        at: new Date().toISOString(),
        status: patch.status,
        by: patch.requestedBy ?? r.requestedBy,
        note: patch.note,
      });
    }
    updated = { ...r, ...patch, status, requestHistory: history };
    return updated;
  });
  if (updated) emit();
  return updated;
}

// Helpers used by the dashboard to simulate the operator completing a request
// in the demo flow (real production flow comes from the CCTV Operator workflow).
export function markRequestInProgress(id: string, by = "CO-01", note = "Operator began processing."): void {
  setFootageRequestStatus(id, "in_progress");
  updateFootageRequest(id, { operatorStatus: note, note });
}

export function completeFootageRequest(id: string, input: { by?: string; clipId?: string; clipCount?: number; stillCount?: number } = {}): void {
  const now = new Date().toISOString();
  updateFootageRequest(id, {
    status: "completed",
    operatorStatus: "Delivered.",
    completedAt: now,
    completedBy: input.by ?? "CO-01",
  });
}

export function cancelFootageRequest(id: string, by = "CO-01", note = "Recording unavailable for the exact window."): void {
  const now = new Date().toISOString();
  updateFootageRequest(id, {
    status: "cancelled",
    operatorStatus: `Cancelled — ${note}`,
    cancelledAt: now,
    cancelledBy: by,
    note,
  });
}
