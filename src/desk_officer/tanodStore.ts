// Shared live Tanod status store.
// Central source of truth for Tanod availability so the Desk Officer
// dashboard, Incident timeline and (future) Chief Tanod view all update in
// real time when a Tanod changes their status from the Mobile App.
//
// Statuses mirror the system's tanod lifecycle:
//   available | en_route | on_scene | off_duty

import { useState, useEffect } from "react";

export type TanodStatus = "available" | "en_route" | "on_scene" | "off_duty";

export interface TanodStatusEntry {
  status: TanodStatus;
  at: string;
  note?: string;
}

export interface Tanod {
  id: string;
  name: string;
  members: number;
  status: TanodStatus;
  purok: string;
  assignment?: string;
  incidentId?: string;
  statusHistory: TanodStatusEntry[];
}

export const TANOD_STATUS_META: Record<
  TanodStatus,
  { label: string; chip: string; dot: string; ring: string }
> = {
  available: { label: "Available", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-300" },
  en_route: { label: "En Route", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", ring: "ring-amber-300" },
  on_scene: { label: "On Scene", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-400", ring: "ring-sky-300" },
  off_duty: { label: "Off Duty", chip: "bg-stone-100 text-stone-500", dot: "bg-stone-400", ring: "ring-stone-300" },
};

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const SEED_TANODS: Tanod[] = [
  {
    id: "t1",
    name: "Team Alpha",
    members: 4,
    status: "on_scene",
    purok: "Purok 1",
    assignment: "Fire/Smoke response",
    incidentId: "INC-2068",
    statusHistory: [
      { status: "en_route", at: isoAgo(138) },
      { status: "on_scene", at: isoAgo(133) },
    ],
  },
  {
    id: "t2",
    name: "Team Bravo",
    members: 3,
    status: "en_route",
    purok: "Purok 5",
    assignment: "SOS altercation response",
    incidentId: "INC-2070",
    statusHistory: [{ status: "en_route", at: isoAgo(4) }],
  },
  {
    id: "t3",
    name: "Team Charlie",
    members: 4,
    status: "on_scene",
    purok: "Purok 2",
    assignment: "Noise disturbance resolution",
    incidentId: "INC-2067",
    statusHistory: [
      { status: "en_route", at: isoAgo(38) },
      { status: "on_scene", at: isoAgo(34) },
    ],
  },
  {
    id: "t4",
    name: "Team Delta",
    members: 3,
    status: "available",
    purok: "Purok 5",
    statusHistory: [],
  },
  {
    id: "t5",
    name: "Team Echo",
    members: 4,
    status: "off_duty",
    purok: "Purok 4",
    statusHistory: [],
  },
];

let tanods: Tanod[] = [...SEED_TANODS];
const listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getTanods(): Tanod[] {
  return tanods;
}

export function subscribeTanods(fn: () => void): () => void {
  return subscribe(fn);
}

export function getTanodById(id: string): Tanod | undefined {
  return tanods.find((t) => t.id === id);
}

export function getTanodByName(name: string): Tanod | undefined {
  return tanods.find((t) => t.name === name);
}

// Update a Tanod's live status (Mobile App / Chief Tanod source). Optionally
// carries the incident assignment so the dashboard, Incident timeline and
// responder info all reflect the change together.
export function setTanodStatus(
  id: string,
  status: TanodStatus,
  opts: { assignment?: string; incidentId?: string; note?: string } = {}
): Tanod | null {
  tanods = tanods.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      status,
      assignment: opts.assignment ?? t.assignment,
      incidentId: opts.incidentId ?? t.incidentId,
      statusHistory: [
        { status, at: new Date().toISOString(), note: opts.note },
        ...t.statusHistory,
      ],
    };
  });
  emit();
  return tanods.find((t) => t.id === id) ?? null;
}

// Mark a Tanod as assigned to a dispatch (used when a dispatch is confirmed).
export function assignTanodToIncident(
  id: string,
  incidentId: string,
  assignment: string
): Tanod | null {
  return setTanodStatus(id, "en_route", { assignment, incidentId });
}

export function useTanodStore() {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  return tanods;
}
