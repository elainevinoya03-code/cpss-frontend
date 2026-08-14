export const PUROK_OPTIONS = [
  "Purok 1 — Riverside",
  "Purok 2 — Chapel Area",
  "Purok 3 — Market Zone",
  "Purok 4 — School District",
  "Main Barangay Boundary",
  "Evacuation Zone Alpha",
];

export const PUROK_ZONES = [
  { id: "p1", name: "Purok 1", path: "M60,40 L160,35 L170,90 L155,140 L55,135 Z", color: "#0038A8", labelX: 108, labelY: 88 },
  { id: "p2", name: "Purok 2", path: "M170,35 L280,30 L295,85 L275,145 L155,140 L160,90 Z", color: "#3B6BE0", labelX: 225, labelY: 85 },
  { id: "p3", name: "Purok 3", path: "M55,140 L155,140 L170,195 L150,260 L45,250 Z", color: "#0038A8", labelX: 105, labelY: 200 },
  { id: "p4", name: "Purok 4", path: "M155,140 L275,145 L290,200 L265,265 L150,260 L170,195 Z", color: "#003FD9", labelX: 218, labelY: 205 },
  { id: "p5", name: "Purok 5", path: "M45,250 L150,260 L265,265 L280,320 L250,370 L40,360 Z", color: "#8a2030", labelX: 155, labelY: 320 },
  { id: "p6", name: "Purok 6", path: "M290,200 L380,190 L395,260 L370,330 L250,370 L280,320 L265,265 Z", color: "#9c2535", labelX: 330, labelY: 290 },
];

export const PUROK_LEADER_JURISDICTION = {
  zoneId: "p3",
  name: "Purok 3",
  label: PUROK_OPTIONS.find((o) => o.startsWith("Purok 3")) ?? "Purok 3 — Assigned",
};
