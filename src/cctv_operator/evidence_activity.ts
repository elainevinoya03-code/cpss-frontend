import { useEffect, useState } from "react";

export type EvidenceAction = "Viewed" | "Generated" | "Redacted" | "Attached" | "Exported";

export interface EvidenceActivity {
  id: number;
  action: EvidenceAction;
  clipId: string;
  incidentId?: string;
  operator: string;
  at: string;
}

let seq = 1;

let activities: EvidenceActivity[] = [
  { id: seq++, action: "Generated", clipId: "CLIP-2026-0001", incidentId: "INC-2065", operator: "CO-01", at: "2026-07-19T16:04:45" },
  { id: seq++, action: "Attached", clipId: "CLIP-2026-0001", incidentId: "INC-2065", operator: "CO-01", at: "2026-07-19T16:05:02" },
  { id: seq++, action: "Generated", clipId: "CLIP-2026-0002", incidentId: "INC-2069", operator: "CO-01", at: "2026-07-19T18:49:30" },
  { id: seq++, action: "Redacted", clipId: "CLIP-2026-0002", incidentId: "INC-2069", operator: "CO-01", at: "2026-07-19T18:51:00" },
  { id: seq++, action: "Attached", clipId: "CLIP-2026-0002", incidentId: "INC-2069", operator: "CO-01", at: "2026-07-19T18:52:00" },
  { id: seq++, action: "Generated", clipId: "CLIP-2026-0003", incidentId: "INC-2071", operator: "CO-01", at: "2026-07-20T09:39:20" },
  { id: seq++, action: "Attached", clipId: "CLIP-2026-0003", incidentId: "INC-2071", operator: "CO-01", at: "2026-07-20T09:40:02" },
  { id: seq++, action: "Generated", clipId: "CLIP-2026-0004", incidentId: "INC-2072", operator: "CO-01", at: "2026-07-20T10:04:35" },
  { id: seq++, action: "Attached", clipId: "CLIP-2026-0004", incidentId: "INC-2072", operator: "CO-01", at: "2026-07-20T10:05:01" },
];

const listeners = new Set<() => void>();

export function addEvidenceActivity(entry: { action: EvidenceAction; clipId: string; incidentId?: string; operator: string; at?: string }) {
  const record: EvidenceActivity = {
    id: seq++,
    action: entry.action,
    clipId: entry.clipId,
    incidentId: entry.incidentId,
    operator: entry.operator,
    at: entry.at ?? new Date().toISOString(),
  };
  activities = [record, ...activities];
  listeners.forEach((l) => l());
}

export function useEvidenceActivities(): EvidenceActivity[] {
  const [list, setList] = useState<EvidenceActivity[]>(activities);
  useEffect(() => {
    const notify = () => setList([...activities]);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);
  return list;
}
