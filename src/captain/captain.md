# Captain — Role Guide

The Captain is the executive over the barangay's Public Safety and Security System. They do not
triage individual incidents or dispatch units directly — that belongs to the **Barangay Desk
Officer**. Instead they oversee: a real-time executive dashboard of sensors, hazards and active
incidents, per-purok peace-and-order analytics, the mass emergency broadcast engine (they hold the
1-tap authorization for high-severity community blasts), live patrol/force oversight, checkpoint
plan drafting & approval, and a closed-incidents review of resolved / closed – false alarm cases
with their update history and resident feedback. Everything below
sits under one role, `captain`, guarded by `CAPTAIN_NAV` in `App.tsx` / `components/layout/sidebar.tsx`.

## Navigation (CAPTAIN_NAV in `App.tsx` / `components/layout/sidebar.tsx`)

| Order | Sidebar label | Nav key | File |
| --- | --- | --- | --- |
| 1 | Executive Safety Dashboard | `dashboard` | `dashboard.tsx` |
| 2 | Purok Analytics & Reports | `analytics` | `purok_analytics.tsx` (rendered inside `dashboard.tsx`) |
| 3 | Emergency Broadcasts | `broadcasts` | `emergency_broadcast.tsx` |
| 4 | Patrol Coverage Map | `patrol` | `live_patrol.tsx` |
| 5 | Checkpoint Plans | `checkpoint_plans` | `checkpoint_plans.tsx` |
| 6 | CCTV Evidence Viewer | `evidence` | `cctv_evidence_viewer.tsx` |
| 7 | News & Bulletins | `bulletins` | `bulletin_publisher.tsx` |
| 8 | Closed Incidents | `cases` | `incident_archive.tsx` |

The captain lands on **Executive Safety Dashboard** by default (`defaultNav` in `App.tsx`). Login
routing in `App.tsx` maps the username `captain` to this role. **Profile and Logout** live in the
shared global `Header`, not the sidebar. The captain's sidebar section is labeled **EXECUTIVE
OVERSIGHT** and the header sublabel reads **Executive Oversight** — the captain observes and directs,
never operates the desk.

The Dashboard and the Analytics screen share one component: `CaptainDashboard` renders the executive
overview for `activeKey === "dashboard"` and the `PurokAnalyticsPage` for `activeKey === "analytics"`.
The dashboard view itself carries two sub-tabs — **Overview** (live safety KPIs, hazard map, incident
queue) and **Operational Reports** (summarized period metrics; see below).

---

## 1. `dashboard.tsx` — Executive Safety Dashboard

Real-time community safety, patrol & hazard oversight, plus the two dashboard entry points for the
captain's daily view.

### KPIs (top row)
- **ACTIVE INCIDENTS** — open (active + investigating) incidents, split `x critical / y
  investigating`. The card pulses with a rose ring whenever the active count increases.
- **AVG RESPONSE TIME** — 4.2 min (last 24 hours).
- **RESOLVED CASES** — resolved incidents, sub-labeled by the selected time range (Today / week /
  total).
- **FALSE ALARM RATIO** — `%` of resolved cases marked as false alarms (`isFalseAlarm` on the incident
  record, e.g. cooking smoke triggering a fire sensor), sub-labeled `x of y resolved were false`. Flags
  sensor sensitivity / dispatch-efficiency issues for review.
- **SENSORS ONLINE** — `x/y` IoT sensors healthy, plus how many require attention.

### Time range & filters
- **Time range** chips (`Today` / `Last 7 Days` / `Last 30 Days` / `All Time`) re-label the resolved
  KPI; **Filters** popover narrows the queue by **Category** (All / Fire-Smoke / Noise) and **Purok**
  (All / Purok 1–6); **Reset** clears everything back to `today` / all / all.

### Sensor & Hazard Map
- SVG map of the six geofenced purok zones (`PUROK_ZONES`). Any zone containing a **warning** or
  **offline** sensor is highlighted as a hazard (rose border) with a red count badge.
- **Tanod Units** toggle overlays the four field teams (Team Alpha/Bravo/Charlie/Delta) as
  brand-blue (`#0038A8`) markers lettered `T` with a soft glow where a unit is present.
- Six live IoT sensors (`SM-GATE-01`, `SM-PLAZA-02`, `DB-HALL-01`, `SM-PUROK3-01`, `DB-MARKET-01`,
  `SM-CHAPEL-01`) render color-coded by status (online/warning/offline) with smoke ppm or noise dB
  values; values jitter every 4s, and any sensor above 80% of threshold pings with a rose ring.
  Hover shows a tooltip (name, live value vs threshold, status); click opens `SensorDetail`.
- **Verification**: any hazard sensor (warning/offline) not yet marked **Verified** by the Desk
  Officer carries a small amber `!` marker on the map and an amber **Pending Verification** badge in
  its tooltip (tracked via the `SecurityAlert`-style statuses `received` /
  `verification_in_progress` / `verified`).
- Legend for Online / Warning / Offline dots in the header.

### Active Incident Queue (right rail)
- Live list of `active` / `investigating` incidents with severity badge, category icon, description,
  time, and photo count. **View** opens the **Incident Review** slide-over (see below); **Broadcast**
  jumps straight into the shared draft compose modal pre-filled with that incident's details.
- Incidents sourced from IoT/CCTV (`source: "IoT Sensor" | "CCTV"`) that are not yet `verified`
  show a pulsing amber **Pending Verification** badge beside the severity badge; `verified`
  IoT/CCTV incidents show an emerald **Verified** badge instead, and non-IoT/CCTV reports carry no
  verification badge.

### Incident Review panel (IncidentDetail slide-over)
- **Executive-only review** of a high-severity incident — informational, with **no operational
  lifecycle controls** (no assign / dispatch / verify / resolve / close; those stay with the Desk
  Officer). Fields shown: incident ID, category, severity, current status, source, date/time, purok,
  location (+ coordinates), description, reporter, attached evidence thumbnails, the Desk Officer's
  latest update, and the current response status.
- For IoT/CCTV-sourced records a **VERIFICATION** panel clearly shows one of four states using
  `VERIFICATION_META`:
  - **Pending Verification** (amber, pulsing) — `received` / `acknowledged` / `verification_in_progress`
  - **Verified** (emerald) — `verified`
  - **False / Unverified** (stone) — `false_or_unverified`
  - **Closed** (stone) — `closed`
- Three executive actions only:
  - **Request Follow-up** → small `RequestFollowUpModal` (reason textarea); **Send Request** pushes an
    `other_request` into the Operational Follow-ups store (`addCaptainInboxItem`, defaults to
    `Pending`) and flashes a confirmation toast.
  - **Prepare Broadcast** → opens the shared `ComposeBroadcastModal` pre-filled from the incident
    (title/message/severity/target). Submitting creates a `DRAFT-0xx` **without sending**, then (when
    composed from this panel) immediately opens the shared `AuthorizeBroadcastModal` for executive
    review; **Cancel** keeps the draft in Pending Authorization for later.
  - **Close Review** → returns to the dashboard.
- Resolved incidents show a muted "Incident resolved" placeholder instead of the broadcast action.

### SensorDetail modal
- Per-sensor card: status pill, smoke density / decibel progress bar vs threshold, **Ping Device** and
  **Telemetry Logs** actions. Hazard sensors (warning/offline) that are not yet `verified` open with
  a **Pending Verification** notice describing the Desk Officer's verification step.

### Purok Incident Breakdown widget
- Per-purok stacked severity bars (Critical / Warning / Low / Resolved) computed live from the incident
  list, with a color legend. The heavier widget form lives on the Analytics screen.

### Recent Activity feed
- Latest patrol sweeps, broadcasts, incident assignments, check-ins, resolutions and sensor heartbeat
  events, each with a colored type dot and timestamp.

### Operational Follow-ups widget
- A third column on the overview grid (`utils/captainInboxStore.ts`) that consolidates the executive
  follow-up trail between the Captain and the Desk Officer — a **simplified tracker**, not a full
  messaging/inbox system. It shows only four categories:
  - **Pending escalations** (`escalation`) — incidents the Desk Officer pushed upstream via
    **Escalate to Captain**, including the Desk's required reason (quoted) and `submittedBy`.
  - **SLA / response concerns** (`sla_breach`) — `new` incidents left unacknowledged past their
    priority target (High 15 / Medium 60 / Low 240 min) auto-reported by the system.
  - **Patrol recommendations** (`patrol_recommendation`) — the Captain's coverage-gap suggestions and
    patrol adjustment recommendations sent to the Desk Officer queue (from **Patrol Coverage &
    Oversight** and **Purok Analytics & Reports**).
  - **Other requests sent to the Desk Officer** (`other_request`) — the Captain's desk escalations and
    follow-ups (e.g. "Desk Officer notified", broadcast follow-up requests).
- Each card shows the six required fields: **Request ID** (`CAP-0xx`), **Type** chip, **Related
  incident/Purok**, **Priority**, **Date/time**, and a **Status** badge drawn from
  `Pending / Acknowledged / In Progress / Completed`. Outbound items default to `Pending` when the
  Captain sends them (`addCaptainInboxItem` defaults `status: "pending"`); Desk Officer pushes arrive
  as `Pending` too. Clicking a card marks it read, and **Mark all read** clears the queue. An unread
  count pill shows in the widget header, and an **Up to date** state appears once everything is read.
  Items dedupe by type + incident ID while unread, so the same breach/escalation never double-counts.

### Operational Reports tab
- Second sub-tab of the Executive Safety Dashboard (`dashboard.tsx`, `dashTab: "overview" |
  "reports"`), rendered by `operational_reports.tsx`. A lightweight, **executive-level summary** for
  the selected period (This Week / This Month / Last Quarter / Custom) — read-only, with **no
  drill-down into individual infrastructure logs**, consistent with spec §14.6.
- Surfaced metrics:
  - **KPIs** — **TOTAL INCIDENTS**, **CRITICAL INCIDENTS**, **RESOLVED INCIDENTS**, and
    **AVG RESPONSE TIME**.
  - **Response & SLA Summary** — average response time, average resolution time, and **SLA breach
    count** (vs the 10 min resolution target).
  - **Resident Satisfaction** — `x / 5` average rating with star display and response count, noted as
    executive evaluation rather than case management.
  - **IoT device health** — uptime % and alert counts by severity (Critical / Warning / Low).
  - **CCTV availability** — `x/y` cameras online with availability bar.
  - **Broadcast delivery** — delivery rate (%), delivered/total and failed counts.
- **Export Report** opens the shared `ExportReportModal` (see §2) pre-loaded with the consolidated
  **summary-metric table** for the current range; CSV downloads a `.csv` file, PDF opens a
  print-friendly report (browser **Save as PDF**). An **Operational Report Summary** table on screen
  mirrors the export rows — summary metrics only, never raw infrastructure logs.

### BroadcastCompose (Mass Alert)
- **Mass Alert** header button (and the per-incident **Broadcast** shortcut) open the same
  `ComposeBroadcastModal` used on the Emergency Broadcast screen — severity selector (Critical /
  Warning / Low) and a message auto-pre-filled for emergency incidents. **Submit for Authorization**
  pushes the draft into the shared Pending Authorization store (`submittedBy: Capt. Reyes`). When
  composed from the **Incident Review** panel the dashboard passes `onDraftReady`, so the compose
  modal closes and the shared **Authorize &amp; Blast** confirmation appears immediately —
  **the Dashboard never distributes a broadcast directly**: only **Confirm &amp; Blast** on the
  `AuthorizeBroadcastModal` sends it (writing a `BCAST-0xx` to the shared history store and removing
  the `DRAFT-0xx`). From the **Mass Alert** button the draft instead lands in **Pending
  Authorization** with a **Submitted for Authorization** success modal.

---

## 2. `purok_analytics.tsx` — Purok Analytics & Reports

Weekly & monthly peace-and-order trends across the six zones, with escalation and export actions.

### KPIs
- **TOTAL INCIDENTS LOGGED** (with a vs-prev-period trend badge) · **TOP RISK ZONE** (highest
  critical/warning count) · **AVG RESOLUTION TIME** (dispatch → resolution, resolved only, with trend)
  · **OVERALL SATISFACTION** (`x / 5` aggregate citizen rating).

### Filters
- **Date range** (This Week / This Month / Last Quarter / Custom Range) and **Purok / Category /
  Status** selects (`All Puroks`, 6 categories incl. `IoT - Smoke Detected` / `IoT - Noise Alert`,
  All/Active/Investigating/Resolved). An empty state appears when no data matches.

### Active Incident banner
- Amber banner (shown when any incident is `active`) warning that open incidents may need escalation.

### Charts
- **Incident Distribution by Purok** — stacked severity bars per zone.
- **Category Breakdown** — SVG donut of incident-type share with a total in the center.
- **Response Time Trends** — line chart of barangay average vs high-density purok response across the
  week (Sat peaks).

### Purok Detailed Summary table
- Per-purok row: total incidents, most common type, avg response, citizen rating (star + count), and a
  risk badge (`High Activity` / `Attention Needed` / `Normal`). Each row carries four actions:
  - **Details** → `PurokDetailDrawer` (per-purok totals/critical/resolved, citizen rating, incident
    log; drill into any incident for its **Evidence & Dispatch Notes** — photos, video clips, tanod
    notes).
  - **Broadcast** → `EscalationModal` (type `broadcast`) — priority (Critical = Push + SMS / Urgent =
    push only), subject + message, targeting ~N residents in the zone. Highlighted rose for high-risk
    zones.
  - **Request Re-route** → `EscalationModal` (type `reroute`) — pick a patrol unit, write the request,
    and send it to the **Desk Officer queue** as a high-priority re-route request for confirmation and
    dispatch. Highlighted amber for high/attention zones.
  - **Escalate to Desk Officer** → `EscalationModal` (type `flag`) — assign a specific Desk Officer
    (Sgt. Ramos / Ofc. Dela Cruz / Garcia / Torres) and an action request. Creates an escalation the
    Desk Officer reviews and owns. Highlighted amber for attention zones.
- Every escalation confirms with a success modal summarizing what was sent to the Desk Officer
  (broadcast targets, re-route request, or escalation recipient).

### ExportReport modal
- Shared `ExportReportModal` (`components/ExportReportModal.tsx`) — **PDF Executive Summary**
  (formatted report for council meetings; opens a print-friendly report for browser **Save as PDF**) or
  **CSV / Excel** (real `.csv` download), with a from/to date range. The same modal powers the
  **Operational Reports** tab with its consolidated metric table.

---

## 3. `emergency_broadcast.tsx` — Emergency Broadcast System

Draft, authorize, and track mass community alerts. This screen holds the **Captain's 1-tap
authorization** boundary — high-severity blasts go out only after executive confirmation.

### KPIs
- **TOTAL BROADCASTS SENT** · **PENDING AUTHORIZATION** (drafts awaiting executive approval) ·
  **ACKNOWLEDGEMENT RATE** (% of residents who confirmed safe on the latest critical blast) ·
  **NEEDING HELP** (residents flagged for emergency response).

### New Broadcast (ComposeBroadcastModal)
- Severity (Critical / Warning / Low), **Target Zone** (All Puroks — Community-wide, or a specific
  purok), alert title and message. Delivery is auto-derived from severity: **Critical** = simultaneous
  **Push + SMS** with loud persistent rings; **Warning / Low** = quiet push only. Shows the estimated
  resident count in the target zone. **Submit for Authorization** pushes the draft into the shared
  **Pending Authorization** store as a `DRAFT-0xx` (`submittedBy: Capt. Reyes`); **Save as Draft**
  closes the modal without creating one.

### Pending Authorization
- The queue is backed by a shared, live in-memory store (`utils/broadcastStore.ts`,
  `getPendingBroadcasts` / `addPendingBroadcast` / `removePendingBroadcast` + subscription), so drafts
  submitted by the **Desk Officer** on their dashboard (`submittedBy: Desk Officer`) also stream into
  the Captain's queue instantly, not just drafts composed here.
- Each draft shows title, severity badge, message, created time, target purok, delivery channel and
  the submitting officer, with two actions:
  - **Authorize & Blast** → shared `AuthorizeBroadcastModal` (also used straight from the dashboard's
    Incident Review flow) previewing the draft, target, channel and a rose **Confirm Executive
    Authorization** warning that the action is irreversible; **Confirm & Blast** distributes it via the
    shared history store (`addBroadcastRecord` → `BCAST-0xx`) with a **Broadcast Authorized & Sent**
    success modal.
  - **Dismiss** → confirm dialog; **Discard** permanently drops the draft.

### Broadcast History
- All-time list (`BCAST-0xx`) with severity badge, delivery channel pill, SMS + push counts, and an
  acknowledgment line for every broadcast: **Safe**, **No Response**, **ack %**, and **Need Help**
  (shown when > 0). Backed by the shared in-memory history store (`utils/broadcastStore.ts`,
  `getBroadcastHistory` / `addBroadcastRecord` + subscription), so blasts authorized from the
  dashboard's Incident Review flow appear here instantly. Actions:
  - **Ack Roll-Call** → inline per-purok acknowledgement bars (safe vs need-help per zone). Shown
    only when per-purok roll-call data exists.
  - **Follow-up** (rose, only when residents need help) → `BroadcastFollowUpModal`.
  - **Details** → `BroadcastDetailDrawer`: message, sent-by / target zone / delivery method / status,
    delivery stats, and the **Community Acknowledgment** summary (Total reached, Safe, Need Help,
    No Response, Ack rate).
- **Severity** filter popover + **Reset**.

### Community Acknowledgment (Ack Roll-Call / Details)
- The Captain reviews resident acknowledgment after a blast: **Total reached**, **Safe**, **Need Help**,
  **No Response** and the **Acknowledgment rate**. When per-purok roll-call data exists, the drawer
  adds an **Acknowledgement by Purok** table (Purok | Safe | Need Help | No Response).
- When residents need help, the drawer shows a prominent rose **Need Help** banner with a
  **Send Follow-up to Desk Officer** button.

### Follow-up to Desk Officer
- `BroadcastFollowUpModal` captures the target purok (defaults to the broadcast's zone), the number
  needing help, and an optional Captain note. Submitting calls `addCaptainInboxItem` with an
  `other_request` (title `Follow-up — <BCAST-id>`, priority **High** when ≥ 10 residents need help),
  fires a **Follow-up Request Sent** success modal, and the request appears under
  **Operational Follow-ups** on the dashboard.
- The Captain only flags the need — the Desk Officer remains responsible for operational response,
  dispatch and follow-up; no dispatch/rescue planning exists on this side.

---

## 4. `live_patrol.tsx` — Patrol Coverage & Oversight

An **executive patrol oversight** screen. The Captain sees coverage and performance summaries, not a
patrol-control view. Per §6.3.11, continuous individual movement (live GPS positions, per-team
markers, per-second jitter, heading, speed, battery, telemetry trails) is **not** shown to the
Captain — that operational view belongs to the Desk Officer. The Captain never assigns Tanods or
directly reroutes teams from this screen; checkpoint **route drafting** lives on the dedicated
**Checkpoint Plans** screen (§5).

### KPIs
- **ACTIVE UNITS** (`x/y` on patrol) · **CHECKPOINTS CLEARED** (`x/y`) · **ROUTE COVERAGE** (`%` of
  checkpoints cleared) · **ZONES COVERED** (`x/6` puroks at ≥ 40% coverage) · **LOW-COVERAGE ZONES**
  (zones below 40% coverage).

### Time range & layer toggles
- **Live / Today / 7d / 30d** range (drives which cleared checkpoint records count toward coverage);
  toggle layers on the map — **Checkpoints**, **Incidents**, **IoT Alerts**; **Reset** returns to
  live defaults.

### Patrol Coverage Map
- SVG map of the six purok zones with:
  - **Per-zone coverage level** — **High Coverage** (emerald, ≥ 60%) / **Partial Coverage** (amber,
    ≥ 20%) / **Low Coverage** (rose, < 20%), computed from the % of the zone's checkpoints cleared
    within the selected range; each zone shows its `% · cleared/total CPs` and a **last patrol
    activity** timestamp (or "no patrol"), hoverable for a summary card.
  - **Checkpoints** (`CP-1 … CP-16`) as static geofence markers — green ✓ = cleared, dashed grey =
    pending (checkpoint data, not continuous movement).
  - **Incident** and **IoT sensor** overlays (toggleable), color-coded by severity/status.
  - No heatmap, no live team markers, no GPS jitter — an explicit note states live GPS positions are
    not shown to the Captain.

### Patrol Teams rail
- Each team (Alpha/Bravo/Charlie/Delta) with on-duty pill, assignment, **last check-in** time and a
  checkpoint progress bar; **Details** opens the drawer and **Recommend** opens `RecommendationModal`
  prefilled for the team's zone. No movement telemetry (no heading, speed, battery, or GPS pings).

### TeamDetailDrawer
- Summarized shift info — **On-Duty Status**, **Last Check-in**, **Assignment**, **Checkpoint
  Progress** % — team members (leader tagged), and a **Checkpoint Log** with cleared timestamps. No
  live GPS strength/heading. Footer **Recommend Patrol Adjustment** → `RecommendationModal`.

### Recommend Patrol Adjustment (replaces Request Re-route)
- Workflow: the Captain identifies a coverage problem → **RecommendationModal** → **Send to Desk
  Officer**. Modal fields: **Purok/Zone** (select), **Current Coverage (%)**, **Reason**, and
  **Recommendation** (required); prefilled from the Low-Coverage Zones row or a team's zone.
- Submitting fires a **Recommendation Sent to Desk Officer** summary, calls `addCaptainInboxItem` as a
  `patrol_recommendation` (priority **High** when coverage < 20%), and the request lands under
  **Operational Follow-ups**.
- It is a **recommendation only** — the **Desk Officer decides** whether to execute the adjustment and
  remains responsible for patrol assignment, dispatch, and route changes.

### Low Coverage Zones (replaces Gap Analysis)
- Simple per-zone rows: **Purok**, **Coverage %**, **Last patrol activity**, **Risk level**
  (High < 20% / Medium), each with a single **Recommend to Desk** action that opens the
  `RecommendationModal` prefilled with that zone. No route builder, no suggestion engine.

### Activity Feed
- Checkpoint clears, digital check-ins, and events with colored type dots and timestamps.

### Historical Trend Comparison (non-live ranges)
- Per-purok cards comparing current vs previous coverage (↑/↓), avg checkpoints/day, incidents
  resolved, and avg response time.

### Export Patrol Report
- Summary of active units, cleared checkpoints, route coverage %, low-coverage zones and time range →
  **Download PDF** or **Print**.

---

## 5. `checkpoint_plans.tsx` — Checkpoint Plans

The Captain's dedicated checkpoint planning screen (previously a tab inside the Chief Tanod's patrol
module — the plans function is now separate from the analyst's **Map & Analysis**). Here the Captain
**drafts, schedules, validates, submits, reviews and finalizes checkpoint plans** — the full plan
lifecycle in one place.

### Plan lifecycle
- **Create Checkpoint Plan** opens the shared 6-step planner:
  1. **Basic Information** — checkpoint name, purpose, objective, reason / basis, target area / zone.
  2. **Checkpoint Type & Location** — **Fixed** (single post) or **Route-based** (Point A → Point B
     with CP stations). Points are placed directly on the same `BarangayMap` used across the patrol
     screens; supporting **routes** can be added from **route suggestions** (derived from incident
     hotspots) or drawn as **custom routes**, then clicking a route line drops intermediate CPs.
  3. **Overlay & Coverage Validation** — the draft is overlaid against incidents and a coverage score
     (`x of y` incidents within range, broken down by severity) is computed live.
  4. **Operational Schedule** — operation / end dates, start / end times, recurrence (daily / specific
     days / one-time), expected duration.
  5. **Operational Notes** — general instructions, safety, equipment, coordination, special
     instructions, other remarks.
  6. **Review Complete Plan** — full summary with a missing-item checklist, then **Submit for
     Approval**.
- **Save as Draft** keeps a half-finished plan as a `draft` (continue editing / delete / duplicate
  later); **Submit for Approval** moves it to **Pending Approval** and records `submittedBy`.

### Plans list & metrics
- Five KPI cards — **Approved / Finalized**, **Pending Approval**, **Drafts**, **Revision Required**,
  **Rejected** — plus **Type** and **Area** filters with a clear/reset.
- Each plan card shows name/code, **StatusBadge**, **TypeChip**, point A→B or supporting-route detail,
  target area, coverage %, schedule window and objective, with actions by status:
  - `pending_approval` — **Review & Decide** (`ApprovalModal`), **View**, **Print / Share w/ PNP**.
  - `draft` — **Continue Editing**, **Delete**.
  - `revision_required` — **Revise & Resubmit** (reopens the planner, revision comment visible).
  - `approved` — **Duplicate**, **Print / Share w/ PNP**, **View** (with approval trail).
  - `rejected` — **Duplicate** (fresh draft from the rejection), **View** (with rejection reason).

### Approval
- **Approval Decision** captures the executive ruling: **Approve & Finalize** (records `decidedBy:
  Punong Barangay` + timestamp + optional remarks), **Request Revision** (required comment → returns
  to `revision_required`), or **Reject** (required reason → closes the plan).
- **Plan Detail** renders the complete plan — map overlay, purpose / target area / coverage, objective,
  rationale, linked incidents, schedule, points & routes, and operational notes, plus the submitted /
  decided trail.

> Checkpoint plan **creation** and the route builder live on this screen; the Chief Tanod's
> **Map & Analysis** module is the analysis-only view that informs those plans.

---

## 6. `incident_archive.tsx` — Closed Incidents

**Read-only executive outcome review** of **closed** incidents (Resolved / Closed / Closed – False
Alarm) per §9.3 and §10.3 — no PIR, debrief, phase pipeline, action-item workflow, or sign-off/archival
ceremony (none exist in the data model). The header carries a blue **READ-ONLY** badge and a banner
stating the records are final: the Captain **cannot reopen, modify resolution, modify closure reason, or
change status**. Each record carries its **IncidentUpdate history**, the **resolution timestamp**, the
**closure reason**, the **impact summary**, and the **Resident Feedback** captured on the incident
(§6.1.13).

### KPIs
- **CLOSED INCIDENTS** (total) · **RESOLVED** (confirmed, closed cases) · **CLOSED – FALSE ALARM**
  (verified, no hazard) · **AVG RESIDENT RATING** (with response count).

### Filters & search
- **Status** chips (All/Resolved/Closed/False Alarm), **Severity** chips
  (All/Critical/Warning/Low), and a **search** box over incident title/ID.

### Closed Incident Records
- List rows with severity dot, ID, severity + closure-status badges, title, purok + detection time,
  closure timestamp and feedback count. **Reset** lives in the header. Clicking a record opens
  `ClosedIncidentDetail`.

### ClosedIncidentDetail (four tabs)
- **Incident Summary** — the incident summary (description), detection time / purok / severity meta,
  and the closure-status banner with the **resolution/closure timestamp** and **closure reason**.
- **Update History** (`n`) — the incident's IncidentUpdate stream (alert → dispatch → broadcast →
  response → milestone → closeout → advisory), each with a type-colored dot.
- **Impact Summary** — fatalities / injured / displaced / houses damaged / ₱ est. damage plus
  assistance provided when applicable; noted as final at closure and not modifiable by the Captain.
- **Resident Feedback** (`x`) — citizen responses: an **AVG RESIDENT RATING** card (star rating +
  `/5` value + response count) followed by each feedback entry (resident avatar initials, purok,
  timestamp, star rating, comment). Count in the tab label; empty state when no resident has rated
  the incident yet. Noted as **executive evaluation of service quality**, not individual case
  management.
- The modal footer repeats the read-only guarantee ("cannot reopen or modify").

---

## 7. `cctv_evidence_viewer.tsx` — CCTV Evidence Viewer

**Strictly read-only evidence review.** The captain observes and reviews evidence; the module carries a
prominent blue **READ-ONLY** badge in the header plus a "Evidence cannot be modified" tag, and clips
are authored by the CCTV Operator. The Captain cannot unblur footage, edit footage, create clips, tag
CCTV events, modify privacy settings, delete evidence, or change camera configuration — those remain
CCTV Operator / Admin responsibilities. There is no export (no authorization model permits it).

### KPIs
- **TOTAL CLIPS** (in evidence archive) · **ATTACHED TO INCIDENTS** (clips linked to an `INC-xxxx`) ·
  **PRIVACY BLURRED** (manually redacted per DPA) · **STORAGE USED** (GB, vs a 2 TB archive budget).

### Clip list & filters
- `CLIP-2026-xxxx` clips with camera (CAM-*), location, purok, capture time, operator, priority badge,
  and state chips: **Unattached** vs the linked `INC-xxxx`, plus **Blurred / Clear** privacy state.
- **Search** (clip / incident / camera / operator), **type** chips (All Types + Suspicious Behavior /
  Unusual Crowd / Road Blockage / Other), a **Privacy** popover (All / Privacy Blurred / Clear), and
  **Reset**. Clicking a row selects the clip and loads it into the playback station.

### PlaybackStation (right panel)
- Mock player with **play/pause**, a draggable **seek bar** (1s real-time tick), a pulsing **REC**
  overlay, camera tag, live timecode (`MM:SS / MM:SS`) and the clip's tag type.
- Below it the **CLIP DETAIL GRID** (clip ID, linked incident, captured-by operator, camera & location,
  purok, duration/size).
- **Privacy Blurred** — clips with `privacyBlurred: true` show an amber banner stating the clip is
  redacted by the CCTV Operator (DPA) and that the Captain cannot unblur footage; only the CCTV
  Operator / Barangay Admin may lift the blur. There is **no Request Unblur workflow** on this side.
- **LINKED INCIDENT** — for linked clips, a read-only block showing **Incident ID**, **Title**,
  **Category**, **Location**, and the clip's **Capture time**, sourced from the incident record and
  never editable here.
- An empty **No clip selected** state when the list is empty or the panel is cleared.

---

## 8. `bulletin_publisher.tsx` — News & Bulletins

Scheduled community communications — distinct from **Emergency Broadcasts**, which are the urgent,
high-severity blast channel. Bulletins are durable posts pushed to residents' in-app bulletin board.

### KPIs
- **PUBLISHED** (active announcements) · **BARANGAY-WIDE** (official barangay bulletins) ·
  **PUSH DELIVERED** (pushed to resident apps).

### Compose form
- **Type** cards: **Safety Alert**, **Event Notice**, **Weather Warning** (shared `BulletinType` with
  the Purok Leader's `community_bulletin_board.tsx`), each with its own accent color and description.
- Headline and message inputs. **No weather API** — there is no fake PAGASA fetch, no auto-population;
  a Weather Warning is composed by hand from the captain's own information.
- **Audience**: fixed to **Entire Barangay** (all ~N registered residents) with a checkmark — the
  Captain cannot target a single purok. The audience box notes that purok-specific messages are
  coordinated through the **Desk Officer** or **Purok Leader** instead of a bulletin.
- **Severity Level**: `info` / `warning` / `alert` cards with colored dots and descriptions.
- **Compose → Review → Publish**: **Review & Publish** validates headline + message, then opens a
  **Publish Barangay Bulletin** confirmation modal showing **Headline**, **Message**, **Type**,
  **Severity**, and **Audience** with **Cancel** / **Publish** buttons. Publishing creates the bulletin
  (`BLT-2xxx`), lists it immediately as **pushing**, then flips to **pushed** after a 1.4s simulated
  delivery; the footer shows the target label and resident reach.

### Published list
- Filter tabs with counts (**All** / **Safety Alert** / **Event Notice** / **Weather Warning** /
  **Archived**); each bulletin card shows ID, type + severity badges, audience (**Entire Barangay**),
  author, publish time, title, body, and a **delivery status** row (sending spinner → delivered count +
  time). Actions: **View** (read-only detail modal with full message, badges and delivery status) and
  **Archive** (archived cards render dimmed, shown under the **Archived** tab). There is **no
  Restore or Re-send** — bulletin lifecycle stays minimal.

---

## 9. End-to-end scenario (the Captain's view of one incident)

The eight screens are one oversight pipeline: **observe → analyze → alert → oversee → plan → review →
inform → report**. Here is a flash-flood event (`INC-2043`) as the Captain experiences it.

### 1. Observe — Executive Safety Dashboard
The captain opens the Dashboard. The river-level sensor breach has flagged Purok 3 & 5 as a hazard on
the **Sensor & Hazard Map** (rose-bordered zones with count badges). `INC-2047` (Fire/Smoke, critical,
Purok 3) sits at the top of the **Active Incident Queue**; the **ACTIVE INCIDENTS** KPI pulses. The
captain clicks **View** on the incident to see the evidence thumbnails and location coordinates, then
**Broadcast** to jump straight into the emergency compose.

### 2. Analyze — Purok Analytics & Reports
On **Purok Analytics**, the captain sets the range to **This Month** and sees Purok 3 & 5 with the
highest critical/warning counts (Top Risk Zone KPI), a 45-family displacement in the incident logs,
and a response-time spike on the weekly chart. From the **Purok Detailed Summary** table the captain
**Requests a Re-route** of Team Delta toward the Purok 3 & 5 low-lying area (sent to the **Desk
Officer queue** for confirmation and dispatch) and **Escalates** the drainage gap to a specific Desk
Officer.

### 3. Alert — Emergency Broadcast System
The Desk Officer's high-severity flood broadcast lands in **Pending Authorization**. The captain
reviews the draft (target zone Purok 3 & 5, **Push + SMS**, ~N residents) and hits **Authorize &
Blast** — the **Confirm Executive Authorization** warning is accepted, the alert distributes
simultaneously, and the history now shows a new `BCAST-0xx` with the acknowledgement roll-call live.
Residents who answer **Need Help** are tracked in the **NEEDING HELP** KPI and routed for rescue.

### 4. Oversee — Patrol Coverage & Low-Coverage Zones
The captain opens the **Patrol Coverage Map**. The zone shading shows Purok 3 & 5 at **High Coverage**
and Purok 1, 2, 4 & 6 as **Low Coverage** (rose) with their last-patrol timestamps; the cleared-checkpoint
markers and the flood incident overlay sit over Purok 3 & 5. **Low Coverage Zones** lists Purok 1 & 2
(<40% coverage, high risk) — the captain hits **Recommend to Desk**, fills the **Recommend Patrol
Adjustment** modal (zone, coverage, reason, recommendation) and sends it; the **Recommendation Sent to
Desk Officer** confirmation appears and the request lands in the Desk Officer queue. From the patrol
rail the captain drills into Team Alpha (**Details**) and sends a **Recommend Patrol Adjustment** for
their zone.

### 5. Plan — Checkpoint Plans
On **Checkpoint Plans**, the captain opens a route-based plan submitted for the flood hit zones and
hits **Review & Decide** → **Approve & Finalize**; the plan card flips to Approved with the `Punong
Barangay` decision trail. Seeing the low-lying river bridge gap from the coverage map, the captain
then drafts a new **Fixed** checkpoint with the 6-step planner — sets the exact bridge post on the
map, validates it against the flood incidents (coverage %), schedules it for the recovery window and
notes the PNP coordination, then **Submits it for Approval** to queue it under Pending Approval.

### 6. Preserve — Closed Incidents
Days later the captain opens **Closed Incidents**. `INC-2043` (Flash Flood Warning) sits in the
resolved list with its closure timestamp and reason. The captain opens it and, under the blue
**READ-ONLY** badge, reviews the **Incident Summary** (description, detection time, closure reason),
the **Update History** (river sensor trigger → broadcast → evacuation → area secured), the **Impact
Summary** (45 displaced, ₱1.8M damage, assistance provided) and the **Resident Feedback** tab — the
evacuees' ratings (avg 4.0) and comments, noting the "hot meals were slow" complaint for the DSWD
follow-up. Cross-referencing the **CCTV Evidence Viewer**, the captain pulls the flood footage clips
(`CLIP-2026-*`, `CAM-RIVER-01/02`) linked to the incident and reviews them in the playback station to
confirm the evacuation timeline.

### 7. Inform — News & Bulletins
As the water recedes the captain posts a **Weather Warning** bulletin on **News & Bulletins**, composing
headline, message and severity by hand (no external weather API), and pushing it to the **Entire
Barangay** through **Compose → Review → Publish**, so the community stays informed through the recovery
period — a durable companion to the one-off emergency blast sent earlier. Since the advisory concerns
the whole barangay, no purok targeting is needed; if only the low-lying puroks (Purok 3 & 5) needed it,
the captain would coordinate that through the **Desk Officer** instead of a bulletin.

### 8. Report — Operational Reports
On the dashboard's **Operational Reports** tab the captain picks **This Month** and reviews the
executive summary: **TOTAL / CRITICAL / RESOLVED incidents**, **avg response & resolution time**,
**SLA breaches**, **IoT device health**, **CCTV availability**, **broadcast delivery rate** and
**resident satisfaction** (4.2 / 5). Satisfied with the numbers, the captain clicks **Export Report**,
picks **PDF Executive Summary**, and saves the print-ready summary for the Sangguniang Barangay meeting —
the workflow closes the loop: **Monitor → Respond/Authorize → Follow Up → Review Outcome → Report**.

> Every artifact the captain touches — incident, broadcast, dispatch, directive, action item, archive
> — carries the responsible officer and a consistent ID, so the executive trail reads back from the
> sensor breach to the signed archive.

---

## Cross-cutting conventions

- **UI language** — all eight screens use the shared design system: `#0038A8` accent (hover
  `#002A8C`), `#E9EDFB` panel background, stone/slate text tones, and a navy `#06122B` sidebar;
  `useToast` notifications, and centered confirmation/success modals (`ConfirmModal` pattern) for
  irreversible actions (authorize blast, dismiss draft, advance phase, sign-off, archive bulletin) and
  confirmation for requests the Captain sends to the Desk Officer (request re-route, escalate to desk,
  recommend to desk).
- **Notification modal** — every action resolves into a centered **Notification** dialog
  (`useToast`, `frontend/src/hooks/useToast.tsx`): a colored icon chip, a title auto-derived from the
  message (segment before ` — `), the full message, a type label, and a thin accent progress bar. Type
  is inferred from keywords — `success` (sent/authorized/exported/created/…), `warning`
  (capacity/attention/…), `error` (rejected/blocked/…), else `info`. Auto-dismisses after 6s or via
  **Dismiss** / backdrop / **X**.
- **Severity & priority** — severity badges come from `SEVERITY_MAP` (`constants/severity.ts`);
  broadcast/critical escalation uses the **Critical / Urgent** priority scale, and incident categories
  share the same `Fire/Smoke`, `Noise Disturbance`, `Crime/Suspicious Activity`, `Road Obstruction`,
  and IoT sensor categories used by the other roles. Bulletins reuse the shared `BulletinType`
  (`Safety Alert` / `Event Notice` / `Weather Warning`) and `info / warning / alert` severity scale
  with the Purok Leader's bulletin board.
- **Purok data** — all zones, boundaries and labels come from `PUROK_ZONES` (`constants/purok.ts`);
  hazard highlighting, coverage and analytics are computed per purok polygon, so a hazard flagged on
  the Dashboard matches the analytics row on the Reports screen, and bulletin targeting reuses
  `RESIDENT_COUNTS` for reach estimates.
- **Captain boundary** — the Captain is the sole approver of **high-severity community broadcasts**
  (`AuthorizeEmergencyBroadcast`); the Desk Officer can only compose/queue them. Medium/low severity
  pushes go out without executive approval. All Captain dispatch-type actions are requests, not direct
  orders: patrol adjustment recommendations, escalations, and broadcast follow-ups route through the
  **Desk Officer queue**, which confirms and executes them. The **Patrol Coverage Map** remains
  view / recommend only and, per §6.3.11, shows **area-based coverage summaries**, never continuous
  individual movement tracking (no live GPS markers, jitter or telemetry pings); checkpoint **route
  creation, drafting and approval** now live on the Captain's dedicated **Checkpoint Plans** screen
  (§5), the executive end of the plan lifecycle. CCTV evidence is **strictly read-only**
  for the captain (search / filter / play / seek / view metadata — **no edits, no unblur, no export, no
  camera control**): privacy-blurred clips stay blurred and unblurring remains the CCTV Operator /
  Barangay Admin responsibility, and bulletins are a shared channel with the Purok Leader.
- **Broadcast store** — the **Pending Authorization** queue is a shared, live in-memory store
  (`utils/broadcastStore.ts`: `getPendingBroadcasts` / `addPendingBroadcast` / `removePendingBroadcast`
  + `subscribePendingBroadcasts`). A draft submitted by the Desk Officer's dashboard
  (`submittedBy: Desk Officer`) lands in the Captain's queue instantly, and one composed here
  (`submittedBy: Capt. Reyes`) drops straight into Pending Authorization; neither side re-fetches —
  both subscribe to the same store. Authorizing removes the draft from the store and mints a `BCAST-0xx`
  row in Broadcast History.
- **State machines** — the Closed Incidents screen is read-only and holds no PIR / phase pipeline
  (per §9.3 / §10.3); incident records come from the shared `active / investigating / resolved` /
  `false alarm` lifecycle managed by the Desk Officer.
- **IDs** — mock-consistent across screens (`INC-2xxx`, `BCAST-0xx`, `DRAFT-0xx`, `CP-xx`,
  `FLG`/`HQ` for escalations, `CLIP-2026-xxxx` + `CAM-*` for evidence, `BLT-2xxx` for bulletins), so a
  broadcast authorized here shows in history, a re-route request reaches the Desk Officer queue, and a
  clip links back to its incident.
- **Data** — frontend mock state with simulated live streams (4s sensor jitter, 3s GPS jitter on live
  patrol, 1.4s push simulation); no live backend calls in these screens. Bulletins are composed by hand —
  there is no weather API integration.
