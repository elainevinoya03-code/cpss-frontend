# Purok Leader Role — Features &amp; End-to-End Process

## Overview

The **Purok Leader** is the community-level authority (a "Community Lead") assigned to a single purok within the barangay. They act as the bridge between residents and the Barangay Desk Officer / barangay government: they validate resident-submitted incidents, publish local announcements, escalate cases that need higher authority, and coordinate with residents and tanods on the ground.

- **Assigned jurisdiction:** `Purok 3 — Market Zone` (`PUROK_LEADER_JURISDICTION`)
  - `zoneId`: `p3`
  - `name`: `Purok 3`
- **Auth trigger:** Login username starting with `purok` → role `purok_leader`
- **Header identity:** Initials `PL`, label `Purok Leader`, sub-label `Community Lead`
- **Default landing page:** `incidents` (Purok Incidents Queue)

> **Key design principle:** The Purok Leader has strong *local awareness* (labels, notes, targeting) but the **Barangay Desk Officer retains final authority** over priority assignment and ultimate disposition of any escalated case.

---

## Navigation &amp; Modules

Routing is defined in `src/App.tsx` via `PUROK_LEADER_NAV`:

| Nav key      | Route / Page                         | Component                  | File                                        |
| ------------ | ------------------------------------ | -------------------------- | ------------------------------------------- |
| `incidents`  | Purok Incidents Queue                | `PurokIncidentsQueue`      | `purok_incidents_queue.tsx`                 |
| `bulletins`  | Community Bulletin Board             | `CommunityBulletinBoard`   | `community_bulletin_board.tsx`              |
| `escalate`   | Escalate to Desk Officer             | `EscalateToDeskOfficer`    | `escalate_to_desk_officer.tsx`              |
| `directory`  | Purok Directory                      | `PurokDirectory`           | `purok_directory.tsx`                       |
| `iot_alerts` | IoT Alert Inbox                      | `PurokIotAlerts`           | `purok_iot_alerts.tsx`                      |

Shared dependencies:
- `src/constants/purok.ts` → purok zones, purok options, assigned jurisdiction
- `src/constants/severity.ts` → `SEVERITY_MAP` (critical / warning / low)
- `src/components/ui` → `Modal`
- `src/hooks/useToast` → feedback toasts
- `src/utils/format` → `formatTime`
- `src/purok_leader/incidentStore.tsx` → shared incident store (`PurokIncidentsProvider`) backing Modules 1, 3, and 5, plus the seed escalated-transfer log

---

## Module 1 — Purok Incidents Queue (`incidents`)

Community validation &amp; stream review for the leader's assigned purok.

### Purpose
Auto-filter the live incident stream down to incidents that belong to the leader's jurisdiction, review them, and apply a validation label that tunes the suggested priority.

### Auto-filtering (jurisdiction matching) — `matchesJurisdiction()`
An incident enters the purok leader's stream if **either** condition is true:
1. **Reporter purok match** — the incident's `reporterPurok` equals `Purok 3`.
2. **GPS boundary match** — the incident's `lat`/`lng` falls inside the p3 polygon (ray-casting point-in-polygon against `PUROK_ZONES[].path`).

Both are surfaced to the user as **match reason chips** on each card ("Reporter registered in Purok 3" / "GPS location inside Purok 3 boundaries").

### Validation labels
A leader applies exactly one of three labels per incident:

| Label              | Meaning                                      | Priority effect                                     |
| ------------------ | -------------------------------------------- | --------------------------------------------------- |
| `Confirmed`        | Verified as a real, local concern            | Priority unchanged                                  |
| `False Information`| Report determined to be invalid              | Downgrades `critical→warning`, `warning→low`, `low→low` |
| `Event-Related`    | Attributable to a scheduled local event      | Downgrades `critical→warning`, `warning→low`, `low→low` |

- Applied labels are timestamped (`labeledAt`).
- Cards show the **suggested priority before/after** labeling, plus a "no change" note when applicable.
- The label is advisory — the Desk Officer still holds final authority.

### Incident card contents
- Incident ID, category badge, validation label badge, escalated badge
- Reported time (`formatTime`)
- Title + description
- Reporter (`reporter · reporterPurok`)
- GPS coordinates (`lat, lng`) + resolved purok zone name
- Photo count
- Suggested priority gauge (after label)
- Three label action buttons (`Confirmed` / `False Information` / `Event-Related`)

### Escalation from the queue — "Transfer to Desk Officer"
- Any incident can be sent to the Desk Officer via the **EscalateModal**.
- The modal shows incident summary, current suggested priority, and a **notes** field for the Desk Officer (see Tech Notes — notes are requested but not enforced; empty notes default to "No additional notes provided.").
- On confirm: `escalated: true`, `escalatedAt` timestamp, and `escalationNotes` are recorded; the card becomes disabled ("Transferred") and shows an Escalated banner with the notes and time.

### KPI cards
- **Active Stream** — incidents in the jurisdiction
- **Awaiting Review** — unlabeled, needs validation
- **Confirmed** — verified local concerns
- **False Information** — invalid reports

### Filter tabs (stream list)
`All` · `Awaiting Review` · `Confirmed` · `Event-Related` · `False Info` · `Escalated`

### Jurisdiction Map (SVG)
- Renders all 6 purok zone polygons, highlighting the leader's own zone (p3).
- Plots all incidents as dots; in-stream dots are larger and colored by label (awaiting = maroon `#6b1530`, confirmed = green, event-related = amber, false info = grey), out-of-stream dots are faint.
- Includes a legend and a **Validation Mix** bar chart (awaiting / confirmed / event-related / false info / escalated).

---

## Module 2 — Community Bulletin Board (`bulletins`)

Compose, post, and manage local announcements for the leader's purok **or** the whole barangay.

### Bulletin fields
- `type`: `Safety Alert` | `Event Notice` | `Weather Warning`
- `severity`: `info` (general update) | `warning` (heads-up) | `alert` (act now)
- `title` (headline), `body` (message)
- `target`: purok-targeted (`purokId = p3`) or barangay-wide (`purokId = null`)
- `source`: optional, e.g. `Weather API`
- `pushState`: `pushing` → `pushed` (after ~1.4s)
- `publishedAt`, `pushedAt`, `archived` flag

### Compose flow
1. Choose **Bulletin Type** (three tiles).
2. Enter **Headline** (required) and **Message** (required). Publish is blocked with a toast if either is empty.
3. **Weather Warning (API):** a "Pull from API" button fetches an advisory (~1.2s simulated network call) and auto-populates type, headline, message, and severity with live temp / wind / rain-chance chips. Source is tagged `Weather API`.
4. Choose **Audience Targeting**: "My Purok" (push to ~165 residents of Purok 3, `purokId = p3`) or "Entire Barangay" (broadcast to all ~1,130 residents, stored with `null purok ID`).
5. Choose **Severity Level**.
6. Click **Publish &amp; Send Push** → creates the bulletin with `pushState: "pushing"`, auto-schedules a push, resets the form, and shows a confirmation toast.

### Bulletin list / management
- For each bulletin: ID, type badge, severity badge, target badge, archived badge, publish time.
- **Push status panel:** shows "Sending push to ~N resident apps..." while pushing, then "Push delivered to ~N resident apps · time".
- Actions: **Re-send** (re-trigger push) and **Archive / Restore** (toggle archived state).

### Filter tabs
`All` · `Safety Alert` · `Event Notice` · `Weather Warning` · `Archived`

### KPI cards
- **Published** — active announcements
- **Purok Targeted** — reaching Purok 3 only
- **Barangay-Wide** — null-purok-ID broadcasts
- **Push Delivered** — pushed to resident apps

---

## Module 3 — Escalate to Desk Officer (`escalate`)

Manually transfer unresolved cases from the leader's **local queue** into the Barangay Desk Officer's triage queue.

> **Shift in authority:** Once escalated, the case falls under the Desk Officer, who can assign an on-duty Tanod for dispatch, adjust the priority, or archive the case into the **digital barangay blotter**. The leader's label and notes merely *inform* the suggested priority.

### Local Queue (left column) — unresolved cases
- Cards list pending cases with category, reporter, optional label, and suggested priority.
- Filter: `All` · `Unlabeled` · `Labeled`.
- Each card has an **Escalate to Desk Officer** button.

### EscalateModal
1. Shows case summary (category, label, title, reporter, suggested priority).
2. **Accompanying Notes** textarea — attach local context / preliminary findings so the Desk Officer "doesn't start from scratch".
3. On submit shows a success state: "Case Escalated" with a transfer summary card (ID · title · informed suggested priority · label · notes).
4. On confirm the case is **removed from the local queue** and **prepended to the Transfer Log** with status `in_triage`, assigned to a desk officer (e.g. "D.O. Ramos"), escalated-at timestamp, and stored notes.

### Transfer Log (right column) — escalated cases
Tracks cases now under Desk Officer authority. The list is **shared** via `incidentStore` (`SEED_ESCALATED_CASES` plus live escalations), so a case transferred from Module 1 ("Transfer to Desk Officer") or escalated from Module 5 (IoT inbox) also appears here automatically, and is removed from this module's local queue. Each card shows the live **status** the Desk Officer has applied:

| Status              | What it means                                    | Display                                        |
| ------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `in_triage`         | Awaiting triage in the Desk Officer's queue      | Spinner + status note                          |
| `priority_adjusted` | Desk Officer changed priority                    | Status note + new severity badge               |
| `dispatched`        | Assigned to an on-duty Tanod                     | Status note + assigned tanod unit              |
| `blotter`           | Closed and archived into the digital blotter     | Status note + blotter ID (e.g. `B-2026-0143`)  |

Each card also shows: labels, applied priority, assigned desk officer (`UserCheck`), the "Leader Notes", and the note that the Desk Officer retains final authority.

### KPI cards
- **Ready to Escalate** — unresolved in the local queue
- **Transferred** — total cases sent to the Desk Officer
- **Awaiting Triage** — in the Desk Officer's queue
- **Assigned / Archived** — dispatched or blotted

---

## Module 4 — Purok Directory (`directory`)

Local contacts for **residents** (community validation) and **barangay tanods** (on-the-ground coordination) within the leader's jurisdiction.

### Contact model
- `role`: `resident` (badge maroon) | `tanod` (badge sky blue)
- Fields: name, purok, phone, notes; residents may have `block` + `tags`; tanods have `unit`, `zone`, and `onDuty` status.

### List &amp; search
- Global search by name, block, unit, or phone (phone digits normalized for partial matches).
- Role filter: `All` / `Residents` / `Tanods`.
- When tanods visible, a status filter: `Any status` / `On duty`.
- Shows a live count of filtered contacts.

### Contact card
- Initials avatar, name, on/off-duty badge (tanods), purok + block.
- Tanod card shows unit and zone (e.g. "Tanod Unit A · Purok 3 — Market Zone").
- Resident card shows tags.
- Contact phone number, notes, and a 3-button action row:
  - **Call** — initiates call to the contact
  - **Message** — opens a message thread
  - **Validate** (resident) — sends a community-validation request to that resident
  - **Support** (tanod) — pages the on-duty tanod to request support for the purok

### KPI cards
- **Total Contacts** — directory in Purok 3
- **Residents** — community validation contacts
- **Tanods** — tanod personnel
- **On Duty** — tanods available now

---

## Module 5 — IoT Alert Inbox (`iot_alerts`)

Delivers **Medium Severity IoT alerts** (noise and disturbance events) detected within the Purok Leader's jurisdiction. This satisfies the design-doc requirement that Purok Leaders receive push notifications for Medium Severity IoT alerts within their purok (§6.5.3 / §7.6 / §9 role matrix: "Receive Medium Severity alerts only").

### Alert model
- `type`: `noise` | `disturbance` | `smoke`
- `severity`: `medium` | `high`
- Fields: sensor `deviceId`, title, detail, purok, GPS, `occurredAt`, optional `value`/`threshold`, and a tri-state `state` (`unread` | `read` | `escalated`).
- Medium alerts (noise/disturbance) are pushed into the leader's inbox. **High** alerts (e.g. smoke threshold breaches) are still shown but flagged as routed to the Desk Officer's command center — the leader may optionally escalate them.

### Behavior
- **Live ingestion (simulated):** after an initial delay a new Medium noise alert ("DB-MARKET-03") streams into the inbox automatically with a "Listening for sensors..." indicator and a toast. This models delivered push notifications.
- **Mark read / Mark all read:** toggles an alert from `unread` → `read` with an `acknowledgedAt` timestamp.
- **Escalate to Desk Officer:** pushes the alert into the shared `incidentStore` (as `in_triage`), flips the alert to `escalated`, and it then appears in Module 3's Transfer Log — a third entry point into the same incident pipeline.
- Medium alerts show a "Pushed to your inbox" pill to reflect the Medium-only delivery rule.

### KPI cards
- **IoT Alerts** — alerts within the purok
- **Unread** — needing review
- **Medium Severity** — delivered to this role
- **Escalated** — sent to the desk officer

### Filter tabs
`All` · `Unread` · `Noise` · `Disturbance`

---

## End-to-End Incident Lifecycle (typical)

1. **Resident reports** → system routes the incident with a reporter purok + GPS coordinates.
2. **Auto-filter into leader stream** → incident appears in the Purok Incidents Queue *only if* reporter purok = Purok 3 or GPS is inside the p3 boundary (with match-reason chips).
3. **Leader reviews &amp; validates** → applies `Confirmed` / `False Information` / `Event-Related`, which tunes the suggested priority (advisory only).
4. **Leader escalates** (three entry points, all sharing the `incidentStore`):
   - Directly from the Incidents Queue ("Transfer to Desk Officer"),
   - From the Escalate module's local queue ("Escalate Case"), typically after labeling, or
   - From the IoT Alert Inbox ("Escalate to Desk Officer") for sensor-driven events.
   - Notes are attached; the case now lives in the shared **Transfer Log** as `in_triage`, visible in Module 3 regardless of which entry point was used.
5. **Desk Officer takes over** (final authority) → triages, may adjust priority (`priority_adjusted`), dispatch an on-duty Tanod (`dispatched`), or close into the digital blotter (`blotter`).
6. **Leader monitors** the Transfer Log in Escalate to Desk Officer to see the live disposition of everything they escalated.

## End-to-End Announcement Lifecycle (typical)

1. **Leader composes** a bulletin choosing type, headline, message, severity, and audience (purok vs. barangay).
2. *(Optional)* **Pull weather data** from the API to auto-fill a Weather Warning.
3. **Publish** → bulletin is stored (purok-targeted holds `purokId = p3`; barangay-wide holds `null`), push is queued, then **delivered** to the mobile apps of the targeted residents.
4. **Manage** → re-send pushes if needed, or archive / restore as announcements go stale or reopen.
5. **Residents** receive / see the announcement; support for localized incidents can be requested afterward via the Purok Directory.

---

## Tech Notes

- All Purok Leader modules are **front-end mock/UI implementations** (React + TypeScript + Tailwind-ish utility classes); most data is held in component `useState` with seeded `INITIAL_*` constants. There is no backend call from these modules (`backend/main.py` is not wired to them).
- **Simulated / stubbed (labeled explicitly):**
  - **Cross-role statuses are seeded, not live.** In Module 3's Transfer Log, the downstream statuses `priority_adjusted` / `dispatched` / `blotter` exist only in the `SEED_ESCALATED_CASES` constant; nothing at runtime transitions a case past `in_triage` (no Desk Officer session drives it). New escalations always enter as `in_triage`.
  - **Directory actions are toast-level stubs.** Call / Message / Validate / Support in Module 4 only fire a toast; there is no call, thread, validation tracking, or history/persistence behind them.
  - **Escalation notes are not enforced.** Module 1's and Module 3's EscalateModals accept empty notes and fall back to `"No additional notes provided."`; Module 1's spec claims notes are required.
  - **IoT ingestion is simulated** (Module 5) via a timer that streams one noise alert after a delay.
- **Shared state across modules:** `src/purok_leader/incidentStore.tsx` (`PurokIncidentsProvider`, mounted in `App.tsx`) is the single source of truth for escalated cases. Module 1 escalation, Module 3 escalation, and Module 5 escalation all write to it; Module 3's Transfer Log reads from it, and its local queue hides IDs already escalated. Seed incident *lists* themselves are still per-component (`INITIAL_INCIDENTS` in Module 1 vs `INITIAL_LOCAL_CASES` in Module 3 are separate copies).
- Brand/accent color: maroon `#6b1530` (hover `#571124`), base background `#f4f1ea`.
- Icons: `lucide-react`.
- Default jurisdiction is fixed to **Purok 3** via `PUROK_LEADER_JURISDICTION` and drives auto-filtering, bulletin targeting, directory labeling, and IoT alert coverage throughout all five modules.