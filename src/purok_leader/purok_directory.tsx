import { useMemo, useState } from "react";
import {
  Users,
  Home,
  Shield,
  RadioTower,
  MapPin,
  Phone,
  MessageSquare,
  UserCheck,
  Search,
  Info,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";

type ContactRole = "resident" | "tanod";
type RoleFilter = "all" | ContactRole;

interface DirectoryContact {
  id: string;
  name: string;
  role: ContactRole;
  purok: string;
  phone: string;
  notes: string;
  block?: string;
  tags?: string[];
  unit?: string;
  zone?: string;
  onDuty?: boolean;
}

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

const ROLE_META: Record<ContactRole, { label: string; badge: string; avatar: string }> = {
  resident: { label: "Resident", badge: "bg-[#0038A8]/5 text-[#0038A8]", avatar: "bg-[#0038A8]/10 text-[#0038A8]" },
  tanod: { label: "Barangay Tanod", badge: "bg-sky-100 text-sky-700", avatar: "bg-sky-100 text-sky-700" },
};

const INITIAL_CONTACTS: DirectoryContact[] = [
  {
    id: "R-01",
    name: "Maria Santos",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0917-304-1122",
    notes: "Contact for market-area concerns; active in community meetings.",
    block: "A",
    tags: ["Market stall", "Community liaison"],
  },
  {
    id: "R-02",
    name: "Carlo Reyes",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0918-552-3410",
    notes: "Runs the eatery beside the market gate.",
    block: "B",
    tags: ["Eatery owner"],
  },
  {
    id: "R-03",
    name: "Rosa Garcia",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0920-813-4765",
    notes: "Point person for the annual fiesta program.",
    block: "A",
    tags: ["Senior citizen", "Fiesta committee"],
  },
  {
    id: "R-04",
    name: "Jay Dela Peña",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0917-990-2041",
    notes: "Frequent reporter of street incidents near the store.",
    block: "C",
    tags: ["Sari-sari store"],
  },
  {
    id: "R-05",
    name: "Ana Lim",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0916-407-8893",
    notes: "Treasurer of the homeowners association.",
    block: "B",
    tags: ["Homeowners assoc."],
  },
  {
    id: "R-06",
    name: "Tomas Cruz",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0921-308-1167",
    notes: "Stall 12; flagged recurring alley flooding.",
    block: "C",
    tags: ["Market vendor"],
  },
  {
    id: "R-07",
    name: "Liza Mendoza",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0919-205-7734",
    notes: "Manages rental units along Riverside corner.",
    block: "A",
    tags: ["Rental units"],
  },
  {
    id: "R-08",
    name: "Bea Torres",
    role: "resident",
    purok: JURISDICTION_NAME,
    phone: "0917-612-9840",
    notes: "Helps with barangay health & safety drives.",
    block: "B",
    tags: ["Barangay volunteer"],
  },
  {
    id: "T-01",
    name: "Tanod Rey Castillo",
    role: "tanod",
    purok: JURISDICTION_NAME,
    phone: "0918-770-2233",
    notes: "Team lead; familiar with market-area incidents.",
    unit: "Tanod Unit A",
    zone: "Purok 3 — Market Zone",
    onDuty: true,
  },
  {
    id: "T-02",
    name: "Tanod Jun Bautista",
    role: "tanod",
    purok: JURISDICTION_NAME,
    phone: "0917-334-5589",
    notes: "Night patrol rotation partner.",
    unit: "Tanod Unit A",
    zone: "Purok 3 — Market Zone",
    onDuty: true,
  },
  {
    id: "T-03",
    name: "Tanod Noli Mercado",
    role: "tanod",
    purok: JURISDICTION_NAME,
    phone: "0916-281-9056",
    notes: "Covers the school district border.",
    unit: "Tanod Unit B",
    zone: "Purok 3 / Purok 4 border",
    onDuty: false,
  },
  {
    id: "T-04",
    name: "Tanod Dante Villar",
    role: "tanod",
    purok: JURISDICTION_NAME,
    phone: "0920-144-6721",
    notes: "Riverside & evac zone coverage.",
    unit: "Tanod Unit C",
    zone: "Purok 3 — Riverside",
    onDuty: true,
  },
];

function initials(name: string) {
  return name
    .replace(/^Tanod\s+/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PurokDirectory() {
  const { flash, ToastPortal } = useToast();

  const [contacts] = useState<DirectoryContact[]>(INITIAL_CONTACTS);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "on_duty">("all");
  const [query, setQuery] = useState("");

  const residents = contacts.filter((c) => c.role === "resident");
  const tanods = contacts.filter((c) => c.role === "tanod");
  const onDuty = tanods.filter((c) => c.onDuty);

  const kpis = [
    { label: "TOTAL CONTACTS", value: contacts.length, sub: `directory in ${JURISDICTION_NAME}`, icon: Users },
    { label: "RESIDENTS", value: residents.length, sub: "community validation contacts", icon: Home },
    { label: "TANODS", value: tanods.length, sub: "barangay tanod personnel", icon: Shield },
    { label: "ON DUTY", value: onDuty.length, sub: "tanods available now", icon: RadioTower },
  ];

  const filtered = useMemo(() => {
    let list = contacts;
    if (roleFilter !== "all") list = list.filter((c) => c.role === roleFilter);
    if (roleFilter !== "resident" && statusFilter === "on_duty") list = list.filter((c) => c.role === "tanod" && c.onDuty);
    const q = query.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/[^0-9]/g, "");
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits && c.phone.replace(/[^0-9]/g, "").includes(qDigits)) ||
        (c.block ?? "").toLowerCase().includes(q) ||
        (c.unit ?? "").toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, roleFilter, statusFilter, query]);

  function callContact(c: DirectoryContact) {
    flash(`Calling ${c.name} (${c.phone})...`);
  }

  function messageContact(c: DirectoryContact) {
    flash(`Message thread opened with ${c.name}`);
  }

  function requestValidation(c: DirectoryContact) {
    flash(`Validation request sent to ${c.name} — asking for community confirmation`);
  }

  function requestSupport(c: DirectoryContact) {
    flash(`${c.name} (${c.unit ?? "on duty"}) notified — support requested for ${JURISDICTION_NAME}`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Purok Directory</h1>
              <p className="mt-1 text-sm text-stone-500">
                Local contacts for residents and barangay tanods in your jurisdiction
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#0038A8]/20 bg-white px-3.5 py-2 shadow-sm">
              <Users size={15} className="text-[#0038A8]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">ASSIGNED JURISDICTION</p>
                <p className="text-[12px] font-bold text-[#0038A8]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#0038A8]/15 bg-[#0038A8]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#0038A8]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              With immediate access to this contact list, you can quickly reach out to <span className="font-semibold text-stone-800">residents</span> for community validation or coordinate with <span className="font-semibold text-stone-800">nearby Barangay Tanods</span> during local events or localized incidents.
            </p>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">{label}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">{value}</div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, block, unit, or phone..."
              className="w-full rounded-lg border border-stone-200 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "resident", label: "Residents" },
              { key: "tanod", label: "Tanods" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setRoleFilter(f.key as RoleFilter);
                  if (f.key === "resident") setStatusFilter("all");
                }}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  roleFilter === f.key
                    ? "border-[#0038A8] bg-[#0038A8] text-white"
                    : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                {f.label}
              </button>
            ))}
            {(roleFilter === "all" || roleFilter === "tanod") && (
              <>
                <span className="mx-1 h-4 w-px bg-stone-200" />
                {[
                  { key: "all", label: "Any status" },
                  { key: "on_duty", label: "On duty" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key as "all" | "on_duty")}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                      statusFilter === f.key
                        ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </>
            )}
            <span className="ml-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">
              {filtered.length} contacts
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white py-16">
            <Search size={22} className="mb-2 text-stone-300" />
            <p className="text-[12px] font-medium text-stone-500">No matching contacts</p>
            <p className="text-[10px] text-stone-400">Adjust the search or filters to see directory entries</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => {
              const meta = ROLE_META[c.role];
              return (
                <div key={c.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${meta.avatar}`}>
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-bold text-stone-900">{c.name}</p>
                        {c.role === "tanod" && c.onDuty && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            On duty
                          </span>
                        )}
                        {c.role === "tanod" && !c.onDuty && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                            Off duty
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                        <MapPin size={9} />
                        {c.purok}
                        {c.block ? ` · Block ${c.block}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${meta.badge}`}>{meta.label}</span>
                  </div>

                  {c.role === "tanod" && (
                    <div className="mt-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[10px] text-stone-500">
                      <p className="flex items-center gap-1.5">
                        <RadioTower size={10} className="text-sky-500" />
                        {c.unit}
                        <span className="mx-0.5">&middot;</span>
                        {c.zone}
                      </p>
                    </div>
                  )}

                  {c.role === "resident" && c.tags && c.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {c.tags.map((t) => (
                        <span key={t} className="rounded-md bg-[#0038A8]/5 px-2 py-1 text-[9px] font-medium text-[#0038A8]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2.5">
                    <p className="text-[9px] font-semibold tracking-wider text-stone-400">CONTACT</p>
                    <p className="font-mono text-[11px] font-medium text-stone-700">{c.phone}</p>
                  </div>

                  <p className="mt-2 text-[10px] italic leading-snug text-stone-500">{c.notes}</p>

                  <div className="mt-auto grid grid-cols-3 gap-1.5 pt-3">
                    <button
                      onClick={() => callContact(c)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <Phone size={11} />
                      Call
                    </button>
                    <button
                      onClick={() => messageContact(c)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-[10px] font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <MessageSquare size={11} />
                      Message
                    </button>
                    {c.role === "resident" ? (
                      <button
                        onClick={() => requestValidation(c)}
                        className="flex items-center justify-center gap-1 rounded-lg bg-[#0038A8] px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                      >
                        <UserCheck size={11} />
                        Validate
                      </button>
                    ) : (
                      <button
                        onClick={() => requestSupport(c)}
                        className="flex items-center justify-center gap-1 rounded-lg bg-[#0038A8] px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#002A8C]"
                      >
                        <Shield size={11} />
                        Support
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {ToastPortal && <ToastPortal />}
    </div>
  );
}
