# Captain — Role Guide

The Captain is the executive over the barangay's Public Safety and Security System. They do not
triage individual incidents or dispatch units directly — that belongs to the **Barangay Desk
Officer**. Instead they oversee: a real-time executive dashboard of sensors, hazards and active
incidents, per-purok peace-and-order analytics, the mass emergency broadcast engine (they hold the
1-tap authorization for high-severity community blasts), live patrol/force oversight, and a
closed-incidents review of resolved / closed – false alarm cases with their update history and
resident feedback. Everything below
sits under one role, `captain`, guarded by `CAPTAIN_NAV` in `App.tsx` / `components/layout/sidebar.tsx`.

## Navigation (CAPTAIN_NAV in `App.tsx` / `components/layout/sidebar.tsx`)

| Order | Sidebar label | Nav key | File |
| --- | --- | --- | --- |
| 1 | Executive Safety Dashboard | `dashboard` | `dashboard.tsx` |
| 2 | Purok Analytics & Reports | `analytics` | `purok_analytics.tsx` (rendered inside `dashboard.tsx`) |
| 3 | Emergency Broadcasts | `broadcasts` | `emergency_broadcast.tsx` |
| 4 | Patrol Coverage Map | `patrol` | `live_patrol.tsx` |
| 5 | CCTV Evidence Viewer | `evidence` | `cctv_evidence_viewer.tsx` |
| 6 | News & Bulletins | `bulletins` | `bulletin_publisher.tsx` |
| 7 | Closed Incidents | `cases` | `incident_archive.tsx` |

The captain lands on **Executive Safety Dashboard** by default (`defaultNav` in `App.tsx`). Login
routing in `App.tsx` maps the username `captain` to this role. **Profile and Logout** live in the
shared global `Header`, not the sidebar. The captain's sidebar section is labeled **PATROL MENU**.

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
  time, and photo count. **View** opens the `IncidentDetail` slide-over; **Broadcast** jumps straight
  into the shared draft compose modal pre-filled with that incident's details.
- Incidents sourced from IoT/CCTV (`source: "IoT Sensor" | "CCTV"`) that are not yet `verified`
  show a pulsing amber **Pending Verification** badge beside the severity badge; `verified`
  IoT/CCTV incidents show an emerald **Verified** badge instead, and non-IoT/CCTV reports carry no
  verification badge.

### IncidentDetail slide-over
- Full record: category + description, reporter, status, **Attached Evidence** thumbnails, and
  **Location Coordinates**. For any non-resolved incident a **Draft Emergency Broadcast** button
  routes to the shared `ComposeBroadcastModal` with the incident hint.
- For IoT/CCTV-sourced records an amber **VERIFICATION** panel lists the current
  `SecurityAlert.status` (`received` / `acknowledged` / `verification_in_progress` /
  `verified` / `false_or_unverified` / `closed`) with a **Pending Verification** indicator unless
  the Desk Officer has already marked it `verified`.

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

### Desk Officer Inbox widget
- A third column on the overview grid (`utils/captainInboxStore.ts`) that surfaces what the Desk
  Officer pushed upstream so the Captain can stay informed without opening every case:
  - **Escalation** items (violet) — incidents the Desk Officer chose to escalate via the slide-over's
    **Escalate to Captain** action, including the Desk's required reason (quoted) and `submittedBy`.
  - **SLA breach** items (rose) — `new` incidents left unacknowledged past their priority target
    (High 15 / Medium 60 / Low 240 min) auto-reported by the system.
- Each card shows the type chip, incident ID, priority, title, purok, time, and a rose **unread dot**;
  clicking a card marks it read, and **Mark all read** clears the queue. An unread count pill shows in
  the widget header, and a **Up to date** state appears once everything is read. Items dedupe by
  type + incident ID while unread, so the same breach/escalation never double-counts.

### Operational Reports tab
- Second sub-tab of the Executive Safety Dashboard (`dashboard.tsx`, `dashTab: "overview" |
  "reports"`), rendered by `operational_reports.tsx`. A lightweight, high-level summary for the
  selected period (This Week / This Month / Last Quarter / Custom) — read-only, with **no drill-down
  into individual infrastructure logs**, consistent with spec §14.6.
- Surfaced metrics:
  - **Period availability** — big % with an amber **Placeholder** pill: backend availability telemetry
    is not connected yet, so the figure is estimated from incident / IoT / CCTV data for the period.
  - **Average acknowledgment & resolution time** plus **SLA breach count** (vs the 10 min resolution
    target) under **Response & SLA Summary**.
  - **IoT device health** — uptime % and alert counts by severity (Critical / Warning / Low).
  - **CCTV camera availability** — `x/y` cameras online with availability bar.
  - **Notification delivery** — success rate, delivered/total and failed counts.
- **Export Report** opens the shared `ExportReportModal` (see §2) pre-loaded with the consolidated
  metric table for the current range; CSV downloads a `.csv` file, PDF opens a print-friendly report
  (browser **Save as PDF**). An **Operational Report Summary** table on screen mirrors the export rows.

### BroadcastCompose (Mass Alert)
- **Mass Alert** header button (and the per-incident **Broadcast** shortcut) open the same
  `ComposeBroadcastModal` used on the Emergency Broadcast screen — severity selector (Critical /
  Warning / Low) and a message auto-pre-filled for emergency incidents. **Submit for Authorization**
  pushes the draft into the shared Pending Authorization store (`submittedBy: Capt. Reyes`) and
  confirms with a **Submitted for Authorization** success modal; nothing distributes from the
  Dashboard — only **Authorize &amp; Blast** inside Pending Authorization sends the broadcast.

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
  - **Authorize & Blast** → `AuthorizeEmergencyBroadcast` modal previewing the draft, target, channel
    and a rose **Confirm Executive Authorization** warning that the action is irreversible; **Confirm &
    Blast** distributes it (creating a `BCAST-0xx` in history) with a **Broadcast Authorized & Sent**
    success modal.
  - **Dismiss** → confirm dialog; **Discard** permanently drops the draft.

### Broadcast History
- All-time list (`BCAST-0xx`) with severity badge, delivery channel pill, SMS + push counts, and
  **Safe / Need Help / ack %** where roll-call data exists. Actions:
  - **Ack Roll-Call** → inline per-purok acknowledgement bars (safe vs need-help per zone).
  - **Details** → `BroadcastDetailDrawer`: message, sent-by / target zone / delivery method / status,
    delivery stats (SMS, push, need-help), and the **Citizen Acknowledgement Roll-Call** per purok.
- **Severity** filter popover + **Reset**.

---

## 4. `live_patrol.tsx` — Patrol Coverage & Oversight

Area-based patrol coverage derived from completed checkpoint logs, with checkpoint status and gap
oversight. Per §6.3.11, continuous individual movement (live GPS positions, per-team markers,
per-second jitter) is **not** shown to the Captain — that operational view belongs to the Desk
Officer. The Captain sees coverage summaries, not movement.

### KPIs
- **ACTIVE UNITS** (`x/y` on patrol) · **CHECKPOINTS CLEARED** (`x/y`, % route coverage) ·
  **ZONES COVERED** (`x/6` puroks at ≥ 40% coverage) · **GAP ZONES** (high-risk unpatrolled areas).

### Time range & layer toggles
- **Live / Today / 7d / 30d** range (drives which cleared checkpoint records count toward coverage);
  toggle layers on the map — **Checkpoints**, **Incidents**, **IoT Alerts**; **Reset** returns to
  live defaults.

### Patrol Coverage Map
- SVG map of the six purok zones with:
  - **Per-zone coverage shading** (emerald = high ≥ 60% / amber = partial ≥ 20% / rose = low),
    computed from the % of the zone's checkpoints cleared within the selected range; each zone shows
    its `% · cleared/total CPs` and a **last patrol activity** timestamp (or "no patrol"), hoverable
    for a summary card.
  - **Checkpoints** (`CP-1 … CP-16`) as static geofence markers — green ✓ = cleared, dashed grey =
    pending (checkpoint data, not continuous movement).
  - **Incident** and **IoT sensor** overlays (toggleable), color-coded by severity/status.
  - No heatmap, no live team markers, no GPS jitter — an explicit note states live GPS positions are
    not shown to the Captain.

### Patrol Teams rail
- Each team (Alpha/Bravo/Charlie/Delta) with on-duty pill, assignment, **last check-in** time and a
  checkpoint progress bar; **Details** opens the drawer and **Request Re-route** opens `RerouteModal`.

### TeamDetailDrawer
- Summarized shift info — **On-Duty Status**, **Last Check-in**, **Assignment**, **Checkpoint
  Progress** % — team members (leader tagged), and a **Checkpoint Log** with cleared timestamps. No
  live GPS strength/heading. Footer **Request Re-route** → `RerouteModal`.

### RerouteModal
- Write a request; it is queued as a **high-priority re-route request** for the Desk Officer, who
  confirms and delivers it to the team's mobile app. Confirms with a **Re-route Request Sent** summary.

### Gap Analysis
- High/medium-risk zones below coverage with last-patrol time and a suggested action; per gap:
  **Notify Desk** or **Recommend to Desk** — both send the gap/recommendation to the Desk Officer
  queue for action via a confirm modal, then marked sent inline.

### Activity Feed
- Checkpoint clears, digital check-ins, and events with colored type dots and timestamps.

### Historical Trend Comparison (non-live ranges)
- Per-purok cards comparing current vs previous coverage (↑/↓), avg checkpoints/day, incidents
  resolved, and avg response time.

### Export Patrol Report
- Summary of active units, cleared checkpoints, GPS pings, gap zones and time range → **Download PDF**
  or **Print**.

---

## 5. `incident_archive.tsx` — Closed Incidents

Read-only review of **closed** incidents (Resolved / Closed / Closed – False Alarm) per §9.3 and
§10.3 — no PIR, debrief, phase pipeline, action-item workflow, or sign-off/archival ceremony (none
exist in the data model). Each record carries its **IncidentUpdate history**, the **resolution
timestamp**, the **closure reason**, and the **Resident Feedback** captured on the incident (§6.1.13).

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

### ClosedIncidentDetail (three tabs)
- **Update History** (`n`) — the incident's IncidentUpdate stream (alert → dispatch → broadcast →
  response → milestone → closeout → advisory), each with a type-colored dot.
- **Closure** — description, closure-status banner, the **resolution/closure timestamp**, the
  **closure reason**, and an impact summary (fatalities / injured / displaced / houses damaged /
  ₱ est. damage) plus assistance provided when applicable.
- **Resident Feedback** (`x`) — citizen responses: an **AVG RESIDENT RATING** card (star rating +
  `/5` value + response count) followed by each feedback entry (resident avatar initials, purok,
  timestamp, star rating, comment). Count in the tab label; empty state when no resident has rated
  the incident yet.

---

## 6. `cctv_evidence_viewer.tsx` — CCTV Evidence Viewer

Read-only review of captured surveillance footage and how it ties to incidents. The captain observes,
never manipulates — the module carries a **Read-Only** emerald badge in the header; clips are authored
by the CCTV Operator.

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
  purok, duration/size) and, for linked clips, the **LINKED INCIDENT RECORD** banner (incident title,
  noted as read-only, linked from the Closed Incidents record).
- **Request Unblur** — privacy-blurred clips (`privacyBlurred: true`) show an amber banner with a
  **Request Unblur** action. The Captain never unblurs footage directly: it opens a modal requiring a
  justification note (min 10 chars) and routes the request
  (`utils/unblurRequestStore.ts` → `addUnblurRequest`, `UR-xxx`, status `pending_review`,
  `requestedBy: Capt. Reyes`) to the **CCTV Operator / Barangay Admin queue** for manual review,
  per §6.2.10. Submitting confirms with a success modal: **"Unblur request sent for review"**.
- An empty **No clip selected** state when the list is empty or the panel is cleared.

---

## 7. `bulletin_publisher.tsx` — News & Bulletins

Scheduled community communications — distinct from **Emergency Broadcasts**, which are the urgent,
high-severity blast channel. Bulletins are durable posts pushed to residents' in-app bulletin board.

### KPIs
- **PUBLISHED** (active announcements) · **PUROK TARGETED** (zone-specific bulletins) ·
  **BARANGAY-WIDE** (null purok-ID broadcasts) · **PUSH DELIVERED** (pushed to resident apps).

### Compose form
- **Type** cards: **Safety Alert**, **Event Notice**, **Weather Warning** (shared `BulletinType` with
  the Purok Leader's `community_bulletin_board.tsx`), each with its own accent color and description.
- Headline and message inputs; when type is **Weather Warning** a **Weather API** panel exposes a
  **Pull from API** button that fetches a fake PAGASA advisory (1.2s, spinner) and auto-populates
  headline, message and severity, showing temp / wind / rain chips and a `Populated via Weather API`
  source tag on the published bulletin.
- **Audience Targeting**: fixed to **Entire Barangay** (all ~N registered residents, stored as `null
  purok ID`) — the Captain cannot target a single purok; purok-level targeting stays with the Purok
  Leader's bulletin board.
- **Severity Level**: `info` / `warning` / `alert` cards with colored dots and descriptions.
- **Publish & Send Push** validates headline + message, creates the bulletin (`BLT-2xxx`), lists it
  immediately as **pushing**, then flips to **pushed** after a 1.4s simulated delivery; the footer
  shows the target label and resident reach.

### Published list
- Filter tabs with counts (**All** / **Safety Alert** / **Event Notice** / **Weather Warning** /
  **Archived**); each bulletin card shows ID, type + severity badges, target (purok or barangay-wide),
  author, publish time, title, body, and a **push status** row (sending spinner → delivered count +
  time). Actions: **Re-send** (re-pushes to residents), **Archive** / **Restore** (archived cards
  render dimmed).

---

## 8. End-to-end scenario (the Captain's view of one incident)

The seven screens are one oversight pipeline: **observe → analyze → alert → direct → preserve → inform
→ preserve**. Here is a flash-flood event (`INC-2043`) as the Captain experiences it.

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

### 4. Direct — Patrol Coverage Map
The captain opens the **Patrol Coverage Map**. The zone shading shows Purok 3 & 5 at high coverage
and Purok 1, 2 & 6 as low/no-patrol (rose) with their last-patrol timestamps; the cleared-checkpoint
markers and the flood incident overlay sit over Purok 3 & 5. **Gap Analysis** flags Purok 1 & 2
(<40% coverage) — the captain **Recommends to the Desk** the routing of Team Alpha through them after
their sweep and **Notifies the Desk** about Purok 6. From the patrol rail the captain drills into Team
Alpha (**Details**) and sends a **Request Re-route** that lands in the Desk Officer queue.

### 5. Preserve — Closed Incidents
Days later the captain opens **Closed Incidents**. `INC-2043` (Flash Flood Warning) sits in the
resolved list with its closure timestamp and reason. The captain opens it and reviews the **Update
History** (river sensor trigger → broadcast → evacuation → area secured), then the **Closure** tab
(45 displaced, ₱1.8M damage, assistance provided) and the **Resident Feedback** tab — the evacuees'
ratings (avg 4.0) and comments, noting the "hot meals were slow" complaint for the DSWD follow-up.
Cross-referencing the **CCTV Evidence Viewer**, the captain pulls the flood footage clips
(`CLIP-2026-*`, `CAM-RIVER-01/02`) linked to the incident and reviews them in the playback station to
confirm the evacuation timeline.

### 6. Inform — News & Bulletins
As the water recedes the captain posts a **Weather Warning** bulletin on **News & Bulletins**, pulling
the PAGASA advisory from the **Weather API**, targeting the low-lying puroks (Purok 3 & 5) with a
residents' push, so the community stays informed through the recovery period — a durable companion to
the one-off emergency blast sent earlier.

> Every artifact the captain touches — incident, broadcast, dispatch, directive, action item, archive
> — carries the responsible officer and a consistent ID, so the executive trail reads back from the
> sensor breach to the signed archive.

---

## Cross-cutting conventions

- **UI language** — all seven screens use the shared design system: `#0038A8` accent (hover
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
  orders: re-route requests, escalations, and gap recommendations route through the **Desk Officer
  queue**, which confirms and executes them. Patrol **route creation** stays
  with the Desk Officer / Admin per spec §2.3 — the Captain's patrol screen is view / re-route only and,
  per §6.3.11, shows **area-based coverage summaries**, never continuous individual movement tracking
  (no live GPS markers, jitter or telemetry pings). CCTV evidence is **read-only**
  for the captain (view / export / **request unblur** only — no edits): unblur requests route to the
  CCTV Operator / Barangay Admin queue for manual review, and bulletins are a shared channel
  with the Purok Leader.
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
  patrol, 1.4s push simulation, 1.2s weather fetch); no live backend calls in these screens.
