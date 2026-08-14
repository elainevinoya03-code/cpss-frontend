export type UnblurRequest = {
  id: string;
  clipId: string;
  clipName: string;
  camera: string;
  location: string;
  purok: string;
  incidentId: string | null;
  justification: string;
  requestedAt: string;
  requestedBy: string;
  status: "pending_review";
};

let requests: UnblurRequest[] = [];
let nextRequest = 1;
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getUnblurRequests(): UnblurRequest[] {
  return requests;
}

export function subscribeUnblurRequests(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function addUnblurRequest(input: Omit<UnblurRequest, "id" | "requestedAt" | "requestedBy" | "status">): UnblurRequest {
  const request: UnblurRequest = {
    ...input,
    id: `UR-${String(nextRequest++).padStart(3, "0")}`,
    requestedAt: new Date().toISOString(),
    requestedBy: "Capt. Reyes",
    status: "pending_review",
  };
  requests = [request, ...requests];
  emit();
  return request;
}
