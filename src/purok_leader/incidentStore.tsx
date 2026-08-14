import { createContext, useContext, useState, ReactNode } from "react";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";

export type Priority = "critical" | "warning" | "low";
export type ValidationLabel = "Confirmed" | "False Information" | "Event-Related";
export type EscalationStatus = "in_triage" | "priority_adjusted" | "dispatched" | "blotter";

export interface EscalatedCase {
  id: string;
  category: string;
  title: string;
  reporter: string;
  purok: string;
  escalatedAt: string;
  notes: string;
  label?: ValidationLabel;
  suggestedPriority: Priority;
  status: EscalationStatus;
  deskOfficer: string;
  statusNote: string;
  adjustedPriority?: Priority;
  tanodUnit?: string;
  blottedId?: string;
}

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;

export const PRIORITY_ADJUSTMENT: Record<ValidationLabel, Record<Priority, Priority>> = {
  "Confirmed": { critical: "critical", warning: "warning", low: "low" },
  "False Information": { critical: "warning", warning: "low", low: "low" },
  "Event-Related": { critical: "warning", warning: "low", low: "low" },
};

export function suggestedPriorityOf(c: { suggestedPriority: Priority; label?: ValidationLabel }): Priority {
  if (!c.label) return c.suggestedPriority;
  return PRIORITY_ADJUSTMENT[c.label][c.suggestedPriority];
}

export const SEED_ESCALATED_CASES: EscalatedCase[] = [
  {
    id: "INC-2106",
    category: "Road Obstruction",
    title: "Flooding along market side alley",
    reporter: "Bea Torres",
    purok: JURISDICTION_NAME,
    escalatedAt: "2026-07-20T09:20:00",
    notes: "Repeat flooding after last night's rain; drains clogged near stall 12. Recommend clearing before the afternoon thunderstorms.",
    label: "Confirmed",
    suggestedPriority: "warning",
    status: "in_triage",
    deskOfficer: "D.O. Ramos",
    statusNote: "Awaiting triage in the Desk Officer's incident queue.",
  },
  {
    id: "INC-2105",
    category: "Crime/Suspicious Activity",
    title: "Suspicious loitering near school gate",
    reporter: "Sara Lim",
    purok: JURISDICTION_NAME,
    escalatedAt: "2026-07-19T18:40:00",
    notes: "Caught on the school CCTV at dismissal; subjects returned twice. Coordinating with the school guard.",
    suggestedPriority: "warning",
    status: "dispatched",
    deskOfficer: "Sgt. Ramos",
    tanodUnit: "Tanod Unit B",
    statusNote: "Dispatched to an on-duty Tanod for patrol verification near the school gate.",
  },
  {
    id: "INC-2104",
    category: "Noise Disturbance",
    title: "Karaoke fiesta noise at plaza",
    reporter: "Rosa Garcia",
    purok: JURISDICTION_NAME,
    escalatedAt: "2026-07-19T16:05:00",
    notes: "Part of the scheduled fiesta program; residents asked for a cutoff time. Suggest keeping priority low.",
    label: "Event-Related",
    suggestedPriority: "low",
    status: "priority_adjusted",
    deskOfficer: "Ofc. Torres",
    adjustedPriority: "low",
    statusNote: "Priority confirmed at Low — verified as scheduled fiesta activity; cutoff set at 10:00 PM.",
  },
  {
    id: "INC-2103",
    category: "Fire/Smoke",
    title: "Burning garbage at back alley",
    reporter: "Tomas Cruz",
    purok: JURISDICTION_NAME,
    escalatedAt: "2026-07-19T11:30:00",
    notes: "Verified on scene with the tanod; the pile was already extinguished. Likely false alarm.",
    label: "False Information",
    suggestedPriority: "low",
    status: "blotter",
    deskOfficer: "Sgt. Ramos",
    blottedId: "B-2026-0143",
    statusNote: "Closed after scene verification and archived into the digital barangay blotter.",
  },
];

interface PurokIncidentStore {
  escalatedCases: EscalatedCase[];
  escalate: (input: {
    id: string;
    category: string;
    title: string;
    reporter: string;
    purok: string;
    label?: ValidationLabel;
    suggestedPriority: Priority;
    notes: string;
  }) => void;
  updateCase: (id: string, patch: Partial<EscalatedCase>) => void;
  isEscalated: (id: string) => boolean;
}

const ESCALATION_ORDER: EscalationStatus[] = ["in_triage", "priority_adjusted", "dispatched", "blotter"];

export function nextEscalationStatus(status: EscalationStatus): EscalationStatus | null {
  const idx = ESCALATION_ORDER.indexOf(status);
  if (idx < 0 || idx >= ESCALATION_ORDER.length - 1) return null;
  return ESCALATION_ORDER[idx + 1];
}

const PurokIncidentContext = createContext<PurokIncidentStore | null>(null);

export function PurokIncidentsProvider({ children }: { children: ReactNode }) {
  const [escalatedCases, setEscalatedCases] = useState<EscalatedCase[]>(SEED_ESCALATED_CASES);

  function escalate(input: {
    id: string;
    category: string;
    title: string;
    reporter: string;
    purok: string;
    label?: ValidationLabel;
    suggestedPriority: Priority;
    notes: string;
  }) {
    const escalated: EscalatedCase = {
      id: input.id,
      category: input.category,
      title: input.title,
      reporter: input.reporter,
      purok: input.purok,
      escalatedAt: new Date().toISOString(),
      notes: input.notes.trim(),
      label: input.label,
      suggestedPriority: input.suggestedPriority,
      status: "in_triage",
      deskOfficer: "D.O. Ramos",
      statusNote: "Awaiting triage in the Desk Officer's incident queue.",
    };
    setEscalatedCases((prev) => [escalated, ...prev]);
  }

  function isEscalated(id: string) {
    return escalatedCases.some((c) => c.id === id);
  }

  function updateCase(id: string, patch: Partial<EscalatedCase>) {
    setEscalatedCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return <PurokIncidentContext.Provider value={{ escalatedCases, escalate, updateCase, isEscalated }}>{children}</PurokIncidentContext.Provider>;
}

export function usePurokIncidents() {
  const ctx = useContext(PurokIncidentContext);
  if (!ctx) throw new Error("usePurokIncidents must be used within PurokIncidentsProvider");
  return ctx;
}