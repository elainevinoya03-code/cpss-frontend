import { useMemo, useState } from "react";
import { Users, MapPin, Phone, Search, Info } from "lucide-react";
import { PUROK_LEADER_JURISDICTION } from "../constants/purok";

interface CommunityContact {
  id: string;
  name: string;
  purok: string;
  area: string;
  phone: string;
  relevance: string;
  tags: string[];
}

const JURISDICTION_NAME = PUROK_LEADER_JURISDICTION.name;
const JURISDICTION_LABEL = PUROK_LEADER_JURISDICTION.label;

// Approved community contacts for the leader's assigned purok — reference only.
const INITIAL_CONTACTS: CommunityContact[] = [
  {
    id: "R-01",
    name: "Maria Santos",
    purok: JURISDICTION_NAME,
    area: "Block A · Market stall row",
    phone: "0917-304-1122",
    relevance: "Contact for market-area concerns; active in community meetings.",
    tags: ["Market stall", "Community liaison"],
  },
  {
    id: "R-02",
    name: "Carlo Reyes",
    purok: JURISDICTION_NAME,
    area: "Block B · Eatery row",
    phone: "0918-552-3410",
    relevance: "Runs the eatery beside the market gate; witnesses street activity daily.",
    tags: ["Eatery owner"],
  },
  {
    id: "R-03",
    name: "Rosa Garcia",
    purok: JURISDICTION_NAME,
    area: "Block A · Plaza side",
    phone: "0920-813-4765",
    relevance: "Point person for scheduled barangay events and fiesta programming.",
    tags: ["Senior citizen", "Fiesta committee"],
  },
  {
    id: "R-04",
    name: "Jay Dela Peña",
    purok: JURISDICTION_NAME,
    area: "Block C · Market gate corner",
    phone: "0917-990-2041",
    relevance: "Frequent reporter of street incidents near his store.",
    tags: ["Sari-sari store"],
  },
  {
    id: "R-05",
    name: "Ana Lim",
    purok: JURISDICTION_NAME,
    area: "Block B · Homeowners row",
    phone: "0916-407-8893",
    relevance: "Treasurer of the homeowners association; coordinates block-level concerns.",
    tags: ["Homeowners assoc."],
  },
  {
    id: "R-06",
    name: "Tomas Cruz",
    purok: JURISDICTION_NAME,
    area: "Block C · Stall 12 alley",
    phone: "0921-308-1167",
    relevance: "Market vendor; previously flagged recurring alley drainage issues.",
    tags: ["Market vendor"],
  },
  {
    id: "R-07",
    name: "Liza Mendoza",
    purok: JURISDICTION_NAME,
    area: "Block A · Riverside corner",
    phone: "0919-205-7734",
    relevance: "Manages rental units along the riverside corner; eyes on night-time activity.",
    tags: ["Rental units"],
  },
  {
    id: "R-08",
    name: "Bea Torres",
    purok: JURISDICTION_NAME,
    area: "Block B · Chapel vicinity",
    phone: "0917-612-9840",
    relevance: "Barangay volunteer for health & safety drives; helps verify welfare reports.",
    tags: ["Barangay volunteer"],
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PurokContacts() {
  const [contacts] = useState<CommunityContact[]>(INITIAL_CONTACTS);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    const qDigits = q.replace(/[^0-9]/g, "");
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        (qDigits && c.phone.replace(/[^0-9]/g, "").includes(qDigits)) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [contacts, query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Contacts</h1>
              <p className="mt-1 text-sm text-stone-500">Approved community contacts in your purok for report validation &amp; follow-up</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#15803D]/20 bg-white px-3.5 py-2 shadow-sm">
              <Users size={15} className="text-[#15803D]" />
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-stone-400">ASSIGNED JURISDICTION</p>
                <p className="text-[12px] font-bold text-[#15803D]">{JURISDICTION_LABEL}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#15803D]/15 bg-[#15803D]/5 px-3.5 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-[#15803D]" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              Reference directory only — use these contacts to corroborate local reports during validation or follow-up. Calling, messaging, resident profiling, and Tanod paging are not part of this tool.
            </p>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-black/5 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, area, tag, or phone..."
              className="w-full rounded-lg border border-stone-200 py-2 pl-8 pr-3 text-[12px] text-stone-900 placeholder:text-stone-300 focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]/30"
            />
          </div>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">
            {filtered.length} approved contact{filtered.length === 1 ? "" : "s"} · {JURISDICTION_NAME}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white py-16">
            <Search size={22} className="mb-2 text-stone-300" />
            <p className="text-[12px] font-medium text-stone-500">No matching contacts</p>
            <p className="text-[10px] text-stone-400">Adjust your search to browse the approved directory</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#15803D]/10 text-[13px] font-bold text-[#15803D]">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-stone-900">{c.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                      <MapPin size={9} />
                      {c.area}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                    Approved
                  </span>
                </div>

                {c.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-md bg-[#15803D]/5 px-2 py-1 text-[9px] font-medium text-[#15803D]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2.5">
                  <p className="text-[9px] font-semibold tracking-wider text-stone-400">CONTACT</p>
                  <p className="flex items-center gap-1 font-mono text-[11px] font-medium text-stone-700">
                    <Phone size={10} className="text-stone-400" />
                    {c.phone}
                  </p>
                </div>

                <p className="mt-2 text-[10px] italic leading-snug text-stone-500">{c.relevance}</p>

                <p className="mt-auto pt-3 text-[9px] text-stone-300">Reference only — reach out through barangay channels</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
