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

export interface TanodGps {
  lat: number;
  lng: number;
}

export interface TanodMessage {
  id: string;
  from: "chief" | "tanod";
  text: string;
  at: string;
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
  gps?: TanodGps;
  battery?: number;
  signal?: "strong" | "weak" | "offline";
  dutyStarted?: string;
  lastStatusChange?: string;
  markerColor?: string;
  messages?: TanodMessage[];
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
    gps: { lat: 110, lng: 65 },
    battery: 72,
    signal: "strong",
    dutyStarted: isoAgo(180),
    lastStatusChange: isoAgo(133),
    markerColor: "#15803D",
    messages: [
      { id: "m1", from: "tanod", text: "On scene, heavy smoke visible. No casualties.", at: isoAgo(131) },
      { id: "m2", from: "chief", text: "Copy. Hold position, backup en route.", at: isoAgo(130) },
      { id: "m3", from: "tanod", text: "Copy, standing by.", at: isoAgo(129) },
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
    gps: { lat: 155, lng: 320 },
    battery: 88,
    signal: "strong",
    dutyStarted: isoAgo(240),
    lastStatusChange: isoAgo(4),
    markerColor: "#f59e0b",
    messages: [
      { id: "m4", from: "chief", text: "Proceed to Purok 6, commercial strip. Possible altercation.", at: isoAgo(3) },
    ],
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
    gps: { lat: 225, lng: 85 },
    battery: 65,
    signal: "weak",
    dutyStarted: isoAgo(300),
    lastStatusChange: isoAgo(34),
    markerColor: "#3B6BE0",
    messages: [
      { id: "m5", from: "tanod", text: "Group dispersed. Area quiet now.", at: isoAgo(30) },
      { id: "m6", from: "chief", text: "Good work. Stand by for 10 more minutes.", at: isoAgo(28) },
    ],
  },
  {
    id: "t4",
    name: "Team Delta",
    members: 3,
    status: "available",
    purok: "Purok 5",
    statusHistory: [],
    gps: { lat: 160, lng: 340 },
    battery: 95,
    signal: "strong",
    dutyStarted: isoAgo(120),
    lastStatusChange: isoAgo(60),
    markerColor: "#10b981",
    messages: [],
  },
  {
    id: "t5",
    name: "Team Echo",
    members: 4,
    status: "off_duty",
    purok: "Purok 4",
    statusHistory: [],
    gps: { lat: 218, lng: 205 },
    battery: 34,
    signal: "offline",
    dutyStarted: undefined,
    lastStatusChange: isoAgo(600),
    markerColor: "#94A3B8",
    messages: [],
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

// Re-task a Tanod to a new assignment/location (Chief Tanod live tracking).
export function retaskTanod(
  id: string,
  assignment: string,
  purok: string,
  incidentId?: string
): Tanod | null {
  tanods = tanods.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      purok,
      assignment,
      incidentId,
      status: "en_route" as TanodStatus,
      statusHistory: [
        { status: "en_route" as TanodStatus, at: new Date().toISOString(), note: `Re-tasked: ${assignment}` },
        ...t.statusHistory,
      ],
      lastStatusChange: new Date().toISOString(),
    };
  });
  emit();
  return tanods.find((t) => t.id === id) ?? null;
}

// Send a direct operational message to a Tanod.
export function sendMessageToTanod(
  tanodId: string,
  text: string,
  from: "chief" | "tanod" = "chief"
): TanodMessage | null {
  let sent: TanodMessage | null = null;
  tanods = tanods.map((t) => {
    if (t.id !== tanodId) return t;
    const msg: TanodMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from,
      text,
      at: new Date().toISOString(),
    };
    sent = msg;
    return {
      ...t,
      messages: [...(t.messages ?? []), msg],
    };
  });
  emit();
  return sent;
}

export function useTanodStore() {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  return tanods;
}
