# Purok Leader Role — Features &amp; End-to-End Process (Streamlined Prototype)

## Overview

The **Purok Leader** is the community-level authority ("Community Lead") assigned to a single purok. This streamlined prototype collapses the previous five-module build into **four focused modules**: one unified Local Reports workflow (validation → close or escalate), read-only escalation tracking, purok-scoped announcements, and a minimal contacts directory.

- **Assigned jurisdiction:** `Purok 3 — Market Zone` (`PUROK_LEADER_JURISDICTION`)
  - `zoneId`: `p3`
  - `name`: `Purok 3`
- **Auth trigger:** Login username starting with `purok` → role `purok_leader`
- **Header identity:** Initials `PL`, label `Purok Leader`, sub-label `Community Lead`
- **Default landing page:** `reports` (Local Reports)

> **Key design principle:** The Purok Leader has strong *local awareness* (labels, handoff notes, announcements) but the **Barangay Desk Officer retains final authority** over priority assignment and ultimate disposition of any escalated case.

---

## Navigation &amp; Modules

Routing is defined in `src/App.tsx` via `PUROK_LEADER_NAV = ["reports", "escalated", "announcements", "contacts"]`:

| Nav key        | Route / Page        | Component           | File                      |
| -------------- | ------------------- | ------------------- | ------------------------- |
| `reports`      | Local Reports       | `LocalReports`      | `local_reports.tsx`       |
| `escalated`    | Escalated Cases     | `EscalatedCases`    | `escalated_cases.tsx`     |
| `announcements`| Purok Announcements | `PurokAnnouncements`| `purok_announcements.tsx` |
| `contacts`     | Contacts            | `PurokContacts`     | `purok_contacts.tsx`      |

Shared dependencies:
- `src/constants/purok.ts` → assigned jurisdiction, `PUROK_ZONES` polygons
- `src/constants/severity.ts` → `SEVERITY_MAP` (critical / warning / low)
- `src/components/ui` → `Modal`
- `src/hooks/useToast` → feedback toasts
- `src/utils/format` → `formatTime`
- `src/purok_leader/incidentStore.tsx` → the single source of truth for all reports and escalations (`PurokIncidentsProvider`, mounted in `App.tsx`)

> **Removed modules:** the old separate *Escalate to Desk Officer* page, *IoT Alert Inbox*, barangay-wide *Bulletin Board*, and full *Purok Directory* are deleted. Escalation now happens from one place (Local Reports), medium-severity sensor alerts stream into Local Reports directly, announcements are locked to the leader's own purok, and contacts are residents only.

---

## Data Model — Unified Store (`incidentStore.tsx`)

All Purok Leader data lives in one store. A `PurokReport` is created for every incoming concern regardless of source:

- `source`: `"resident"` | `"sensor"` (sensor reports carry `deviceId`)
- `outcome`: `null | "Confirmed" | "Marked Invalid" | "Event-Related"`
- `status`: `"active" | "closed_local" | "escalated"`
- Jurisdiction fields: reporter purok + GPS coordinates; out-of-jurisdiction reports exist in seed data to demonstrate automatic filtering.
- Clarification requests (`clarification?: { message, at }`) and closed-local records (`closedNote`, `closedAt`) live on the report itself.
- Escalation metadata: when escalated, `handoffNote` (required) + `escalatedAt` are stamped on the report.

`escalatedCases` is a **derived view** mapped into a Desk-Officer-compatible shape (`id, category, title, reporter, purok, label, suggestedPriority, adjustedPriority, status, deskOfficer, statusNote, tanodUnit, blottedId, handoffNote, infoRequest, hasUpdate, statusUpdatedAt`) so both roles share one pipeline:

| Status            | Meaning                                        |
| ----------------- | ---------------------------------------------- |
| `sent`            | Just escalated, awaiting Desk Officer triage   |
| `under_review`    | DO triaged / adjusted priority                 |
| `action_assigned` | Tanod unit tasked with field response          |
| `closed`          | Resolved by DO, archived into digital blotter  |

Helpers exported by the store: `ESCALATION_STATUS_META`, `ESCALATION_STATUS_ORDER`, `nextEscalationStatus()`, `zoneOfPoint()` (ray-casting point-in-polygon), `inJurisdiction()`. Store API also includes `validateReport()`, `requestClarification()`, `closeLocally()`, `escalate()` (returns false if already escalated), `updateCase()` (auto-stamps `hasUpdate: true` + `statusUpdatedAt` on status/note/info-request changes), `markUpdateSeen()`, `markAllUpdatesSeen()`.

---

## Module 1 — Local Reports (`reports`)

One queue for everything the leader must act on: resident reports **and** medium-severity IoT sensor alerts inside the jurisdiction.

### Auto-filtering (jurisdiction matching)
A report enters the queue via `inJurisdiction()`:
1. **Reporter purok match** — `reporterPurok === "Purok 3"`.
2. **GPS boundary match** — coordinates fall inside the p3 polygon in `PUROK_ZONES`.

Match reason chips appear on each card. Out-of-jurisdiction reports never render (seeded examples INC-2090/2092/2095 prove the filter). High-severity sensor events are excluded entirely — they route straight to the Desk Officer's command center; the leader only receives medium alerts (noise/disturbance) per the role matrix.

### Validation outcomes
Exactly one outcome per report, applied via **ActionModal**:

| Outcome           | Meaning                                 | Priority effect                                          |
| ----------------- | --------------------------------------- | -------------------------------------------------------- |
| `Confirmed`       | Verified as a real, local concern       | Priority unchanged                                       |
| `Marked Invalid`  | Report determined invalid/false         | Downgrades `critical→warning`, `warning→low`, `low→low`  |
| `Event-Related`   | Attributable to a scheduled local event | Same downgrade ladder                                    |

An optional validation note can accompany any outcome. Labels are advisory — the Desk Officer still holds final authority after escalation.

### Other local dispositions
- **Request clarification** — asks the reporter for more detail; shows a "Clarification Requested" state on the card until re-submitted.
- **Close locally** — minor issues resolved at purok level without escalation; requires a closing note, moves the report to the **Closed Locally** filter (kept visible for transparency).

### Escalation — the single entry point
Any active report can be sent upward via **EscalateModal**:
- Shows case summary + suggested priority.
- **Handoff note is required** — empty submit is blocked inline ("A handoff note is required...").
- Advisory disclaimer confirms Desk Officer assumes authority on receipt.
- On confirm the report leaves the active queue and appears in Module 2 as `sent`.

### UI
- KPI strip: Active Reports · Awaiting Review · Sensor Alerts · Escalated.
- Filter pills: All Active / Awaiting Review / Confirmed / Event-Related / Marked Invalid / Clarification / Closed Locally.
- Cards: ID, source badge (Resident Report / Sensor Alert with device chip), category, title, description, reporter, time (`formatTime`), GPS + resolved-zone chips, photo count, severity gauge, outcome badges, validation/clarification/closed notes.

---

## Module 2 — Escalated Cases (`escalated`)

Strictly **read-only** monitoring of everything handed to the Desk Officer.

- Header lock chip ("Read-only — managed by the Desk Officer"); no action buttons anywhere.
- KPI strip: Total Escalated · Sent · In Progress · Closed.
- Status filters: All / Sent / Under Review / Action Assigned / Closed.
- Each card shows: status badge, handoff note, desk-officer status note, adjusted priority, assigned tanod unit (when dispatched), blotter reference ID (when closed), and any **info request** from the DO (amber block asking for more context).
- **Update awareness:** DO-driven changes set `hasUpdate`; unread cards show an amber "New update" badge plus a banner with a per-card "Mark seen" button and a global "Mark all seen". Seen markers reset whenever the case changes again.

---

## Module 3 — Purok Announcements (`announcements`)

Publishing is **locked to the leader's assigned purok** (fixed audience chip "Audience: Purok 3 — Market Zone"). No barangay-wide targeting in this prototype.

### Compose modal
- Type tiles: `Safety Alert` | `Event Notice` | `Weather Warning`
- Headline + message (both required).
- Severity: Information / Warning / Alert.
- Publish date + optional expiry date (`type="date"`); expiry must be ≥ publish (validated inline).

### List management
- Derived states: **Live**, **Expired**, **Unpublished** (publish date in the future).
- Actions: **Edit** (only while Live), **Expire Now**, **Unpublish**.
- Seeds ANN-2401–2403; new IDs follow `ANN-{2404 + count}`.

---

## Module 4 — Contacts (`contacts`)

Minimal, search-only directory of **approved resident/community contacts in Purok 3** for corroborating reports during validation or follow-up.

- Search by name, area, tag, or phone (digits normalized for partial matches); live filtered count.
- Card: initials avatar, name, block/area, tags, phone number, relevance note ("Approved" pill).
- Explicitly **excluded**: Tanod entries, call/message/dispatch/paging buttons, contact history, resident profiling — an info banner states the directory is reference-only and outreach goes through barangay channels.

---

## Desk Officer Integration (shared triage panel)

The Barangay Desk Officer dashboard (`desk_officer/dashboard.tsx`, "Purok Leader Escalations — Triage Desk") consumes the same `incidentStore` and uses the new vocabulary:

- `ESCALATION_META` keyed by `sent / under_review / action_assigned / closed`.
- **Advance** walks the stage flow: `sent → under_review → action_assigned → closed`. Dispatch creates an Active Dispatches entry; closing auto-files a record in the digital blotter (`blottedId`).
- Priority buttons (critical/warning/low) snap the case to `under_review` with a status note.
- **Request Info from Leader** (new): stamps `infoRequest` on the case — it renders as the amber block in Module 2 and flips the leader's update badge.
- Legacy display labels map through `displayValidationLabel` (`"Marked Invalid" → unable_to_verify`).
- Handoff notes surface as "Leader Handoff Note"; until the DO acts, fresh escalations sit at `sent`.

---

## End-to-End Incident Lifecycle (typical)

1. **Resident reports** (or a sensor fires) → stored as a `PurokReport` with reporter purok + GPS.
2. **Auto-filtered** into Local Reports only if in-jurisdiction (chips show why). Medium sensor alerts arrive here too; high-severity events skip the leader entirely.
3. **Leader validates** → Confirmed / Marked Invalid / Event-Related (+optional note), tuning suggested priority (advisory). Or resolves minor issues via clarification request / close-locally.
4. **Leader escalates** (single entry point) with a required handoff note → case becomes `sent` in the shared pipeline and disappears from the local queue.
5. **Desk Officer takes over** → triages (`under_review`), may adjust priority or request more info, dispatches a tanod unit (`action_assigned`), then closes into the blotter (`closed`). Every transition stamps an update for the leader.
6. **Leader monitors** Escalated Cases read-only, sees status changes / info requests via amber badges, marks updates seen.

## End-to-End Announcement Lifecycle (typical)

1. **Leader composes** type, headline, message, severity, publish/expiry dates — audience fixed to their purok.
2. **Publishes** once the publish date arrives (or immediately if today/past).
3. **Manages** the post: edit while live, expire early, or unpublish.
4. **Residents of Purok 3** see the announcement while it is live; expiry is derived automatically.

---

## Tech Notes

- All modules are **front-end mock/UI implementations** (React + TypeScript + Tailwind utility classes). There is no backend call (`backend/main.py` is not wired).
- **Single source of truth:** `incidentStore.tsx` holds all reports (active, closed-local, escalated, out-of-jurisdiction) and derives the Desk-Officer-shaped `escalatedCases`. Both roles' screens read/mutate the same arrays, so statuses, notes, and update badges stay in sync without duplication.
- **Cross-role statuses are live** via the store (see integration section above); everything else (announcements, contacts) is component-local `useState` with seeded constants.
- Brand/accent color: blue `#0038A8` (hover `#002A8C`), base background `#E9EDFB`. Icons: `lucide-react`.
- Default jurisdiction is fixed to **Purok 3** via `PUROK_LEADER_JURISDICTION` and drives auto-filtering, announcement audience locking, and contact scoping across all four modules.
