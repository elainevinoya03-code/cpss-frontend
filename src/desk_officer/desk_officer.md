# Desk Officer — Role Guide

The Desk Officer runs the operations hub of the barangay. They receive every report that the system
produces — resident app submissions, tanod field reports, CCTV escalations, IoT sensor breaches, and
SOS distress signals — triage them, dispatch Tanod units, monitor the field in real time, and finally
archive each resolved case as a permanent digital blotter. Everything below sits under one role,
`desk_officer`, guarded by `DESK_OFFICER_NAV` in `App.tsx` / `components/layout/sidebar.tsx`.

## Navigation (DESK_OFFICER_NAV in `components/layout/sidebar.tsx`)

| Order | Sidebar label | Nav key | File |
| --- | --- | --- | --- |
| 1 | Dashboard | `dashboard` | `dashboard.tsx` |
| 2 | IoT Alert Command Center | `iot_alerts` | `iot_alert_command_center.tsx` |
| 3 | Active Dispatches | `dispatches` | `active_dispatches.tsx` |
| 4 | Patrol Scheduler & Routes | `patrol` | `patrol_scheduler_routes.tsx` |
| 5 | Digital Barangay Blotter | `blotter` | `digital_blotter.tsx` |
| 6 | Operations Chat Center | `chat` | `operations_chat_center.tsx` |

The officer lands on **Dashboard** by default (`defaultNav` in `App.tsx`). Login routing in
`App.tsx` maps any username starting with `desk` to this role. **Profile and Logout** live in the
shared global `Header`, not the sidebar.

The Dashboard embeds live preview widgets for the other five screens, each with an **Open ›**
shortcut that calls `onNavigate("…")` (`iot_alerts`, `dispatches`, `patrol`, `blotter`, `chat`).

---

## 1. `dashboard.tsx` — Barangay Desk Officer Dashboard

Central hub for triage, IoT alerts, field dispatch and official logs.

### Header actions
- **Anonymous Report Lookup** — `KeyRound` button that opens the `AnonymousLookupModal` token lookup (see below).
- **Mass Broadcast** — `Megaphone` button that opens the severity-graded `BroadcastCompose` (see below).
- **Publish Safety Notice** — `Info` button that opens the teal `SafetyNoticeCompose` (see below).
- Each of the five embedded live preview widgets (IoT Alert Command, Active Dispatches, Operations Chat
  Center, Patrol Scheduler & Routes, Digital Barangay Blotter) shows an **Open ›** shortcut that calls
  `onNavigate("…")`.

### KPIs (top row)
- **ACTIVE INCIDENTS** — count of open (not yet resolved) incidents, broken down by
  `x SOS · y new · z SLA breached` (the breach counter only appears once a `new` incident overruns its target).
- **IOT ALERTS** — count of sensors not in a healthy state, split into critical / warning. The card
  pulses (rose ring + animate) while an instant pop-up alert is live.
- **ACTIVE DISPATCHES** — count of dispatches not yet resolved, plus how many are `responding`.
- **TANODS ON DUTY** — `x/y` teams on duty (not standby) and total field personnel.

### Incident Triage Desk (main queue)
- Intake from all six §10.3.1 sources: **Resident**, **Tanod** (field report), **Desk Officer**,
  **CCTV**, **IoT Sensor**, and **SOS** — **Anonymous** is *not* a source but a flag on a `resident`
  report (§6.1.5, reported with only a tracking token — no identity is ever shown). Each renders as a
  colored source badge with its own icon.
- Each row shows incident ID, severity badge, status badge, **Desk Officer priority chip**
  (desk-officer scale, per §6.1.3: **Low / Medium / High**), source badge, description, purok, time,
  and photo count. **SOS** rows carry a pulsing ping dot. Open incidents sort by **SLA breach first**,
  then newest; breached rows are highlighted rose with an animate-pulse **SLA Breached** badge.
- Additional row badges: **Anonymous** (stone, shows only the tracking token), **Possible Duplicate**
  (amber, when another open incident matches category + purok within the 24-hour window),
  **Escalated** (violet, after the case is pushed to the Captain), and **Reporter Safe** (emerald,
  after a resident indicates safe on an individual SOS — see the review workflow below).
- Status is a strict state machine with a per-state action button
  (`INCIDENT_STATUS_META`): `new → acknowledged → in_progress → resolved` —
  **Acknowledge → Start Work → Resolve →** (none) — plus a terminal **Closed (False Alarm)**
  state for duplicate or invalid reports (`closed_false_alarm`, stone badge). Acknowledging stamps
  `acknowledgedAt`, which stops the SLA clock. Advancing fires a toast confirming the notification
  channel used — **push/in-app on every transition, with SMS layered on only for High-priority
  incidents on Acknowledge and Resolve** (§6.1.11 / §14.9).
- **SLA monitoring** (`SLA_TARGETS`): a `new` (unacknowledged) incident breaches when its age exceeds
  its priority target — **High 15 min, Medium 60 min, Low 240 min** — without an `acknowledgedAt`
  stamp. A breach is a visual **badge + row highlight + toast**, not a status change; once breached it
  also drops a **SLA breach** entry into the shared Captain inbox (`utils/captainInboxStore.ts`).
- **View** opens the `IncidentDetail` slide-over showing: reporter, citizen star rating (pending if
  unresolved), an **Incident Validation** chip for cases with a Purok Leader field label (§10.3.5),
  **Attached Evidence**
  thumbnails, and a **Geotag & Boundary Parsing** block verifying the coordinates fall inside the
  incident's purok boundary. Anonymous incidents render the **Reported By** field as a tracking token
  only — never a name. The slide-over also gives the Desk Officer full incident-management controls:
  - **DESK OFFICER PRIORITY** — manual **Low / Medium / High** assignment (locked once the
    case is closed), overriding the inherited source severity.
  - **INTERNAL NOTES** — desk-only observations appended to the record (not shown to the citizen).
  - **SLA breach panel** — when breached, shows the elapsed time, overrun amount, and target.
  - **Possible Duplicate panel** — when a matching open incident is detected, offers three
    non-destructive choices: **Keep Separate** (requires a note, recorded on the case),
    **Link as Related** (marks the pair as related), or **Close as Duplicate** (the existing terminal
    `closed_false_alarm` action — cases are never auto-merged).
  - **Linked related incident** panel when a case was already marked related.
  - **Escalated to Captain** panel + badge once pushed upstream.
  - Footer actions — the advance button, **Close as False Alarm / Duplicate** (opens
    `CloseFalseAlarmModal` with a **mandatory closure reason** per §6.1.7 — the one-click close is
    gone; the reason is recorded on the record and the reporter is notified), **Assign** (dispatch a
    Tanod team *or* hand local responsibility to a **Purok Leader**), **Escalate to Captain** (requires
    a reason), and the real-time notification note to the reporter on every status change — push on
    every transition, SMS only for High-priority Acknowledge/Resolve (§6.1.11 / §14.9).
- **Anonymous Report Lookup** (header button) — opens `AnonymousLookupModal`, which accepts a tracking
  token (`TK-xxxx`, case-insensitive, `ANON-` auto-normalized) and shows the matching anonymous
  incident's status and purok — it never reveals reporter identity; unknown tokens and the seeded
  `ANONYMOUS_REGISTRY` are shown with a masked-name confirmation.
- **Assign to Purok Leader** (`AssignIncidentModal`) — the Assign action has two tabs: **Tanod Team**
  (existing on-duty teams) and **Purok Leader** (local leaders). Choosing a Purok Leader creates a
  dispatch stamped `assigneeType: "purok_leader"` with `eta "Awaiting leader report"`, shown with a
  teal **Purok Leader** chip in the Active Dispatches widget.
- **Escalate to Captain** (`EscalateToCaptainModal`) — requires a reason, adds an **Escalated to
  Captain** panel/badge on the case, and drops an **escalation** entry into the shared Captain inbox
  (`utils/captainInboxStore.ts`). It only alerts the Captain — it never forwards to external agencies.
- **SOS “I'm Safe” review workflow (§6.5.9)** — when a resident indicates they're safe on an
  *individual* SOS incident (distinct from the geofence-wide roll-call in the broadcast engine), the
  incident is **not** auto-closed. **Simulate Resident “I'm Safe”** (available on open Emergency SOS
  incidents) stamps `reporterSafe` + `reporterSafeAt`, shows the **Reporter Indicates Safe** badge and
  an emerald review banner, notifies the Desk Officer, and appends a note that the case stays open.
  From then on the incident **cannot move to Resolved or Closed** until the Desk Officer explicitly
  reviews it: **Review &amp; Close — Reporter Safe** opens `ReporterSafeReviewModal` (optional review
  note) whose **Confirm Review &amp; Close** resolves the case; the Resolve action and Close-as-False-
  Alarm path are both gated to that review while `reporterSafe` is set.

### Purok Leader Escalations — Triage Desk (shared incident store)
- Live escalations pulled from the shared `usePurokIncidents` store (`purok_leader/incidentStore.tsx`),
  with an `x in transfer` counter for cases not yet archived.
- Each case shows its **stage chip**, effective priority (adjusted or suggested), optional validation
  **label** normalized from the shared store's legacy values to the canonical §10.3.5 five
  (`Locally Confirmed` / `Unverified` / `Likely Duplicate` / `Event-Related` / `Unable to Verify` via
  `displayValidationLabel`), the assigned Desk Officer, title,
  category · reporter · purok, and the **Leader Notes** quote.
- Strict transfer flow `in_triage → priority_adjusted → dispatched → blotter` (`ESCALATION_META`):
  - **Priority chips** (critical / warning / low) override the Purok Leader's suggested priority and
    snap the case to `priority_adjusted` with a status note.
  - **Advance to …** steps the case onward: to `dispatched` it auto-picks a non-standby Tanod team,
    fires the dispatch into the Active Dispatches widget (`DP-118x`, `responding`), and logs a status
    note; to `blotter` it mints the permanent record (`B-2026-0xxx` via `nextBlotterId`, stored back
    as `blottedId`) without duplicating.
- A `statusNote` trail and a **Blotter created** tag appear once archived — the same record the
  Digital Barangay Blotter converts.

### IoT Alert Command widget (live ESP32 telemetry)
- Six simulated sensors (`SM-GATE-01`, `SM-PLAZA-02`, `DB-HALL-01`, `SM-PUROK3-01`, `DB-MARKET-01`,
  `SM-CHAPEL-01`) across puroks, with smoke (ppm) or noise (dB) values and thresholds. Values jitter
  every 4s; a threshold breach fires the `EmergencyPopUp` **and** creates a `SensorAlert` record
  (`ALT-1xx`, status `received`).
- Risk is derived (`sensorRisk`): offline → critical, value ≥ threshold → critical, warning status →
  warning, else online. Each row shows a progress bar, live value, and status pill (`Wifi`/`WifiOff`/
  `Zap`).
- **SecurityAlert lifecycle (§6.5.3–6.5.4)** — each breached sensor row carries its alert chip
  (`ALERT_STATUS_META`): `received → acknowledged → verification_in_progress → verified | false_or_unverified → closed`. While anything but verified/false/closed, the row shows an amber
  **Sensor Alert Pending Verification** chip, and per-status action buttons (**Acknowledge → Start
  Verification → Verify — Confirmed / Mark False / Unverified → Close**). The raw sensor event
  (device, value, threshold, trigger time) is preserved even when marked false. Alert status drives
  the **IOT ALERTS** KPI sub (`x pending verification`).

### EmergencyPopUp (instant alert, bypasses the queue)
- Auto-appears ~9s after load for an **Emergency SOS** (simulated Ana Lim, Purok 6, live GPS locked at
  the commercial strip, top-priority ticket `INC-2070` created) and only on **critical** IoT breaches
  (sensor risk `critical` = offline or value ≥ threshold); pre-existing breaches at load and
  warning-level states do not pop.
- Actions: **Silence Alert**, **Acknowledge & Dispatch** (routes the IoT breach straight into triage as
  `INC-2068` with `source: "iot"` + `relatedAlertId`, acknowledges the matching alert to
  `acknowledged` / starts dispatch), and **Escalate to Captain — Mass Alert** (opens the BroadcastCompose
  pre-filled with an emergency message).
- Only one pop-up at a time; a breach triggers it once per sensor (`triggeredRef` guard, pre-seeded with
  already-critical sensors at load so only fresh critical crossings alert).

### Active Dispatches widget
- Field response tracked through `responding → on_scene → resolving → resolved` (`DISPATCH_META`),
  each stage with an advance button (Responding → On-Scene → Resolving → Resolved) and ETA. Photos and
  citizen star ratings appear inline.

### Operations Chat Center widget
- Contact pills for Tanod units and Purok Leaders with online/away dots and unread badges; switching
  contacts swaps the thread. Messages render left/right with timestamps and a composer with Enter to
  send.

### Patrol Scheduler & Routes widget
- 7-day shift mini-calendar (morning/night teams), team status pills (`on_patrol` / `dispatched` /
  `standby`), and purok coverage bars (green ≥80%, amber ≥50%, rose below).

### Digital Barangay Blotter widget
- Highlights a resolved case ready for archival (`INC-2065`); **Convert** creates a blotter
  (`B-2026-0xxx`) and pops a success modal. Recent blotters listed with filed time and officer.

### Recent Activity feed
- Latest operational events (triage, SOS, dispatch upload, IoT breach, patrol publish) with colored
  type dots and timestamps.

### BroadcastCompose (Mass Broadcast)
- **Mass Broadcast** button opens a compose modal: severity selector with the canonical §10.6.5 scale
  **Info / Warning / High** (each with a one-line description) and a message pre-filled for emergency
  alerts. Only **High** severity requires the Captain gate (§6.5.10) — the button reads **Send for
  Captain Authorization** for High and **Send Quiet Push** for Info/Warning. Sending writes the draft
  into the shared broadcast store (`utils/broadcastStore.ts`, `addPendingBroadcast`) and pops a
  **Queued for Authorization** modal.

### Publish Safety Notice (Bulletin — §9.8/§9.11)
- A distinct header action from **Mass Broadcast**: routine informational notices only. **No
  severity selector and no Captain-approval gate** — this is the lightweight Bulletin counterpart
  to the severity-graded SafetyBroadcast flow above.
- **SafetyNoticeCompose** takes a **Title**, a **Category** (§10.7.1 — `General` / `Safety Alert` /
  `Event Notice` / `Weather Warning`, rendered as a `Tag` chip on each notice), a **Message**, and a
  **Target Audience** — either **Entire Barangay** (all six puroks) or a **Specific Purok**
  (Purok 1–6). The officer chooses **Save as Draft** or **Publish Now**; drafts and published notices
  land in the store (`utils/safetyNoticeStore.ts`, `NTC-0xx`) with `draft` / `published` / `archived`
  states.
- The **Recent Notices** panel (bottom of the dashboard, separate from the Broadcast Queue) lists
  notices newest-first with title, target, state pill and timestamp, and quick actions —
  **Publish** (draft → published) and **Archive**. The existing **Mass Broadcast /**
  **CaptainAuthModal** flow is untouched.

---

## 2. `iot_alert_command_center.tsx` — IoT Alert Command Center

Live ESP32 telemetry ingestion, threshold bypasses and cascading mass broadcasts.

### Header
- **Gateway Live** emerald pill (pulsing dot) + **Force Ping** button that appends a
  connection-confirmation line to the MQTT terminal.

### KPIs
- **SENSORS DEPLOYED** — `online/total`, with the number requiring attention.
- **ACTIVE ALERTS** — open alerts (SOS count shown), pulses while a pop-up is live.
- **BROADCASTS QUEUED** — broadcasts awaiting Captain approval.
- **ACTIVE ROUTES** — Tanods currently navigating in the field.

### IoT Telemetry Ingestion Gateway
- Six sensor devices with **battery %** and **RSSI** alongside live value/threshold bars. Values
  jitter every 4s; a threshold breach auto-creates an alert (`ALT-1xx`) and pops `AlertPopUp` (once per
  device via `triggeredRef`).
- A dark **MQTT STREAM** terminal shows live `MQTT sensors/<unit>/telemetry` payloads (and
  `NO RESPONSE rssi=-999` for offline units), refreshed every 2.5s. **Force Ping** appends a
  connection-confirmation line.
- An SOS alert (`SOS-043`, Purok 3 Market Zone) fires ~9s after load.

### Alert Queue
- **Clustered view (§6.5.6)** — alerts are grouped into **cluster cards** (`CL-0xx`) when multiple
  alerts come from the **same device within a short window**, or from **multiple devices inside the
  same area within a configured window** (10 min same-device / 15 min same-area, `buildClusters`).
  Each cluster card shows the cluster ID, contributing alert IDs, area, **first → last alert time**,
  member count, severity and current status — reducing duplicate top-level noise.
- Clustering never hides originals: **Expand** reveals each contributing alert with its own
  **Dispatch** and **Broadcast** actions (or dispatched/broadcasting pill), so the officer acts on
  every alert individually. The **ACTIVE ALERTS** KPI and the `x open · y clusters` queue badge still
  count raw open alerts.

### AlertPopUp (instant pop-up)
- Same bypass-the-queue behavior as the Dashboard: **Hold** (dismiss), **Dispatch Tanod** (opens the
  Dispatch modal), and **Cascade Mass Broadcast** (routes through the broadcast engine).

### DispatchModal (Field Dispatch)
- Lists **available** on-duty Tanod units (dispatched ones are filtered out) with member counts and
  nearest purok; shows turn-by-turn route guidance; **Dispatch Now** creates a route (`R-22x`, en
  route), marks the alert `dispatched`, and confirms high-priority vibration + audio push fired on
  assignment.

### Cascading Mass Broadcast Engine
- Severity-based notification routing:
  - **Medium (Noise / Disturbance)** — silent/standard push only, routed to the Desk Officer, local
    Purok Leader, and nearest on-duty Tanods. Sends immediately (`sent`).
  - **High (Fire / Disaster / SOS)** — simultaneous cellular SMS + loud persistent push to **every
    resident inside the affected geofence**; requires **Captain 1-tap authorization**.
- **Broadcast Queue** lists each broadcast (`BC-0xx`) with target, channel, resident count, and an
  **Authorize** button for pending ones. `CaptainAuthModal` previews the broadcast (target, channel,
  trigger, resident count in the geofenced zone) with **Keep Queued** / **Approve & Send**; approval
  flips it to `sent` and opens the roll-call overlay.

### Active Citizen Roll-Call
- **Four-state resident safety acknowledgment (§6.5.13)** — the overlay pushed to `reached` resident
  phones offers **Safe / Need Help / Not Sure / Unable to Respond**. The response-rate breakdown shows
  all four buckets (`safe`, `needHelp`, `notSure`, `unable`) plus `reached` and `noResponse`.
- **Need Help** keeps its priority behavior: those residents are flagged for **priority rescue
  routing**. **Not Sure** residents are re-prompted; **Unable to Respond** are queued for a physical
  check by a Tanod.
- **Non-Responders — Follow-Up**: an actionable list of the residents who haven't answered the
  roll-call, each with their last known GPS and two actions — **Remind** (re-prompt via SMS + push)
  and **Dispatch** (creates an en-route dispatch in the Field Routing panel to their location).
  Non-responders are re-prompted every 5 min until they confirm or a Tanod reaches them.

### Field Dispatch & Hardware Routing
- Route list (`R-22x`) per alert with assigned Tanod, distance, ETA, and `en_route` / `on_scene`
  status plus the turn-by-turn step pills.

### On-Duty Tanod Coverage
- Nearest responders for routing with Available / Dispatched pills.

---

## 3. `active_dispatches.tsx` — Active Dispatches

Assignment, routing and live on-scene monitoring of field responders.

### Header
- **`x Units Available`** pill counts the on-duty Tanod teams that are not yet dispatched.
- **Assign Next** dispatches the top unassigned Triage Intake incident straight through the
  `AssignModal` (see below) without opening the queue first.

### KPIs
- **ACTIVE DISPATCHES** — `responding` / `on scene` split · **RESOLVING NOW** · **UNASSIGNED QUEUE**
  (with available units) · **RESOLVED TODAY**.

### Active Dispatch Queue
- Strict state machine `responding → on_scene → resolving → resolved` (`DISPATCH_META`), with advance
  buttons (**Mark On-Scene / Mark Resolving / Mark Resolved**). Each dispatch shows team, ETA, distance,
  reporter, time, and evidence count, plus **Route**, **Message**, and **Evidence** quick actions.

### Triage Intake
- Verified-but-unassigned incidents (from Citizen App, Emergency SOS, CCTV Escalation) ready for
  assignment; **Assign & Dispatch** opens the `AssignModal`.

### AssignModal (Assign & Dispatch)
- Shows the incident summary (category, severity, description, purok, reporter) and the **available**
  on-duty Tanod units (nearest first) with turn-by-turn route guidance and a note that a
  high-priority vibration + audio push fires on assignment. **Dispatch Now**:
  - creates the dispatch (`DP-11xx`, status `responding`),
  - fires an **Automated Resident Update** (`RU-0xx`, channel **Push**, or **Push + SMS** when the
    incident is High priority — §6.1.11 / §14.9) telling the citizen their report is being responded to,
  - removes the incident from the unassigned queue, and toasts the resident notification.

### RouteModal (Route Guidance)
- SVG route map from HQ to the incident with turn-by-turn steps, distances, ETA, and a "Push
  navigation active" confirmation.

### ChatModal (Operations Chat)
- Direct thread with a team unit (seeded messages) with a composer; replies toasts on send.

### On-Scene Evidence Stream
- Photos / videos / situation notes uploaded by field Tanods (`EV-0xx`), each with author, linked
  dispatch, note, and time; **View** toasts the item. Live-uploads indicator in the header.

### Automated Resident Updates
- Every dispatch transition pushes a `RU-0xx` with a citizen tracking ID and a **dynamic channel pill**:
  **Push** for ordinary updates, **Push + SMS** only when the linked incident is **High priority**
  (§6.1.11 / §14.9). The message follows the transition (`TRANSITION_MESSAGE`): responding / arrived
  on scene / resolving / resolved.
- Each update carries a **delivery status** (`NOTIFICATION_STATUS_META`): **Queued** / **Sent** /
  **Delivered** / **Failed**. A **failed** update renders rose with a **Retry** affordance that
  re-queues and re-sends the notification.

### On-Duty Tanod Coverage & Operations Chat
- Availability list for assignment; field-unit chat previews with a prompt to open the full
  Operations Chat Center.

---

## 4. `patrol_scheduler_routes.tsx` — Patrol Scheduler & Routes

Weekly shift planning, geofenced routes and live force heatmapping.

### Header
- **GPS Tracking Active** emerald pill.
- **New Shift** opens the create-shift modal (see *Shift Lifecycle & Review*).
- **Publish Week** pushes the whole calendar to Tanod apps (gated by the validation chips).

### KPIs
- **SHIFTS PUBLISHED** (7-day × 2 shifts) · **TEAMS ON DUTY** (`x/y`, total rostered tanods) ·
  **CHECKPOINTS CLEARED** (`cleared/total`; sub-label also counts **missed** and **manual overrides** for
  review) · **COVERAGE GAPS** (zones below 50% presence).

### Patrol Duty Planner
- Weekly calendar table (Morning / Night rows) assigning teams per day, plus a **Team Legend**
  (leader, member counts). **Publish Week** confirms the calendar is pushed to Tanod apps.

### Shift Lifecycle & Review
- **New Shift** (header) opens the create-shift modal with full **pre-publish validation** gating the
  schedule before it reaches Tanod apps: date / start & end times required, end must be after start,
  the chosen route must exist **and be active**, the assigned team must be staffed, and the team must
  have **no overlapping shift** in the same time window (no double-booking).
- Created shifts (`PS-1xx`) follow the spec lifecycle — **Scheduled → Active → Completed / Cancelled /
  Missed** — with contextual actions per state (Start / Cancel while Scheduled; Complete / Mark Missed
  / Cancel while Active). Completed / Cancelled / Missed are terminal states.
- The panel footer shows the live **PRE-PUBLISH VALIDATION** summary (no overlaps, all routes active,
  teams staffed) as pass/fail chips; the header badge flips to *Validation blocked* when any check
  fails. The **Publish Week** confirmation message reflects whether validation passed.

### Team Organization
- Rostered teams: leader, members, shift, assigned route, and checkpoint progress (`x/y` cleared) with
  `on_patrol` / `standby` pills.
- **New Team** (card header) opens the create-team modal: required team name (must be unique), team
  leader, tanod members, and an assigned route. **TANOD MEMBERS** is a hover-select picker over the
  tanod roster — hovering the field opens a searchable list; clicking toggles a tanod on/off.
  Tanods already rostered to another team are shown as `in <team>` and disabled; selected tanods
  render as removable chips and are reserved for this team. Only **active** routes are assignable —
  inactive routes are blocked. New teams start on **standby** with no shift, appear in the Team
  Organization list, Team Legend, and become selectable when creating a patrol shift.
- **Manual-override counter** (violet `n manual` chip per team): how many checkpoints that team has
  cleared manually recently, so repeated manual overrides are visible for maintenance review instead
  of silently accumulating.

### Route Mapping & Geofences
- SVG map of the six purok zones with **high-risk zones** highlighted (rose), route polylines
  (`R1 Market Perimeter`, `R2 Commercial Strip`, `R3 Chapel Loop`), and geofenced checkpoint circles
  (green ✓ = cleared via GPS, violet `M` = **manual override**, amber • = pending, rose ✗ =
  **missed**). Hovering shows the checkpoint name, team, purok and radius, plus how it was cleared
  (GPS vs manual with its reason) and any missed-checkpoint reason annotation.
- Clicking a pending or missed checkpoint (or **Simulate Clear** / **Clear Now**) opens the **Manual
  Confirmation** modal. A reason from the standard set (Emergency response assignment / Weather or
  environmental condition / Device failure / Network failure / Route obstruction / Approved
  operational change / Other) is **required** before the checkpoint clears, and a **Confirming
  Officer** is recorded (defaults to `Desk Officer`, editable). Manual confirmations are stored as
  `clearedBy: "manual"` + `clearReason` + `clearedByPerson` and render distinctly — they are **never**
  recorded or labelled as GPS verification.
- A checkpoint becomes **missed** when it isn't cleared within its time window — it renders as a rose
  `✗` with a pulsing ring and a **Missed — Overdue** tooltip, and is flagged for Desk Officer review
  (counted in the **CHECKPOINTS CLEARED** KPI sub-label).
- **Route status & config warnings**: each route carries an `active` flag and an expected `duration`;
  inactive routes (e.g. `R3 Chapel Loop`) render dashed and greyed on the map, tagged `INACTIVE`, and
  are disabled in the shift-compose route picker. A warning strip below the map surfaces
  system-generated configuration issues (inactive route, team still assigned to an inactive route,
  checkpoints too close together, missing coordinates).

### Field Execution & GPS Verify
- **Duty Check-In** list (verified GPS time + distance-from-hall per team) and **Checkpoint Clearing**
  list. Cleared rows show either **GPS verified** (emerald) or **Manual override** (violet) with the
  recorded reason and timestamp.
- **Missed-checkpoint reason capture**: missed rows show an **Add Reason** / **Edit Reason** action
  (violet) that opens the same reason-set modal in *annotation* mode. Recording a reason is stored as
  `missedReason`, visible in the map tooltip and the row — it does **not** clear the checkpoint or
  change its Missed status.

### Live Force Heatmap
- `PresenceMap`: **aggregated, checkpoint-based area coverage** over the purok zones; zones below 50%
  presence are flagged rose with a `!` badge. Per-purok coverage bars below (rose <50%, amber <80%,
  emerald ≥80%). Privacy-aware by design: **no individual tanod GPS pings or movement history are
  shown** — only the limited coverage summary (see *Desk Officer Guide: Patrol Scheduling & Routes*,
  §11).

### Offline Data Synchronization
- Dead-zone queue (`OS-0xx`: status reports / photos buffered locally while offline). **Sync … Queued
  Item(s)** drains the queue with a spinner and a toast; note that data auto-pushes the moment
  connectivity returns.

---

## 5. `digital_blotter.tsx` — Digital Barangay Blotter

One-click archival of resolved incidents, ratings and executive oversight.

### KPIs
- **TOTAL BLOTTERS FILED** (permanent records) · **PENDING CONVERSION** (resolved cases ready to
  archive) · **AVG CITIZEN RATING** (`x / 5`) · **AVG RESPONSE TIME** (dispatch → on-scene).

### Resolved Cases — Pending Archival
- Completed incident lifecycles (photos, field notes, GPS tag, rating, citizen feedback) with
  **Convert to Blotter** (or the header **Convert Next** macro). Conversion:
  - mints the permanent record (`B-2026-0xxx`),
  - removes the case from pending,
  - pops a success modal noting the photos, GPS tags, field notes and rating are now archival.

### Resolution & Feedback Analyzer
- Average satisfaction score, **rating distribution** bar chart (5★→1★), and recent qualitative
  feedback quotes (Filipino) with incident + resident attribution.

### Blotter Archive
- Official archival logs (ID, category, title, filed time, incident, purok, officer, rating). **View**
  opens `BlotterDetail`: official entry copy, filed/recorded-by fields, **GPS tag & evidence**
  thumbnails, resolution summary, and the **Citizen Feedback** quote.
- **Records management**: a live **search** box filters records by ID, incident, category, purok,
  title or officer; **category filter** chips (`All` / Fire-Smoke / Noise / Public Disturbance /
  IoT-SOS) narrow the list; a **Export CSV** button downloads the currently filtered records as a
  real `.csv` file (with feedback quotes) for official use. An empty-state shows when no records
  match.

### Executive Review & Oversight (Captain-accessible)
- Responsiveness score (94%), **Peace & Order Report** category performance (cases / resolved /
  avg rating), weekly case trend chart, and **Generate Peace & Order Report** → success modal noting it
  is dispatched to the Barangay Captain for review.

---

## 6. `operations_chat_center.tsx` — Operations Chat Center

Direct messaging with field Tanods & Purok Leaders for real-time status clarifications.

### Header
- Live counters: `x/y Tanods online`, `x/y Leaders online`, and a rose **unread** pill.

### Contact list (left rail)
- Grouped **Field Units · Mobile App** (Team Alpha/Bravo/Charlie) and **Purok Leaders · Web Portal**
  (Purok 3/5/6), each with online/away/offline dot, role, last-seen, and unread badge. Search filters
  both groups.

### Conversation
- Conversation header shows the contact's status + channel + role and a **Delivered** read-receipt chip.
- Thread per contact; **quick prompt chips** tailored to the group
  (Tanod: Status update / Confirm ETA / Send evidence / Check readings / Acknowledge; Leader: Verify
  context / Status update / Check coverage / Acknowledge). Sending simulates a contextual **auto-reply**
  (keyword-matched: status / eta / photo / verify / sensor / leader fallback). Incoming messages
  stream in from an `INCOMING_POOL` every ~14s; a toast fires if you're not viewing that contact.

### Right rail (context cards)
- **Active Dispatch Progress** (`DISP-104/105/106` with status + ETA and **Ask Status** shortcuts) ·
  **IoT Alert Coordination** (sensor readings with **Request On-Site Reading**) · **Resident Report
  Verification** (incidents with **Verify With Leader**). Each shortcut pre-fills and sends the
  appropriate question to the right contact.

---

## 7. End-to-end scenario (single incident lifecycle)

The six screens are one pipeline: **ingest → triage → dispatch → field → resolve → archive**. Here is
the journey of one fire-smoke incident.

### 1. Ingest — IoT Alert Command Center
An ESP32 smoke sensor (`SM-GATE-01`, Purok 1) crosses the 500 ppm threshold. The **IoT Telemetry
Ingestion Gateway** logs the MQTT payload, auto-creates alert **`ALT-118`**, and `AlertPopUp` fires
instantly (bypassing the queue). The officer presses **Dispatch Tanod**, picks an available unit, and
**Dispatch Now** — route **`R-221`** (Team Alpha, 4 min ETA) is created with turn-by-turn navigation
and a high-priority vibration + audio push.

### 2. Triage — Dashboard
The Dashboard's **IoT Alert widget** now shows the breach as critical; the officer acknowledges the
pop-up and the incident lands in the **Incident Triage Desk** as **`INC-2068`** (Fire/Smoke,
IoT Sensor source, `in_progress`). **View** opens the detail slide-over: the officer assigns a **High
priority** and logs an **internal note** ("Gate sensor confirmed climbing past 500 ppm"), and the
geotag is verified inside Purok 1's boundary. Every status advance — Acknowledge → Start Work →
Resolve — pushes the reporter in-app; because **`INC-2068`** is **High** priority, **Acknowledge** and
**Resolve** also fire **SMS** (§6.1.11 / §14.9). If a citizen report turns out to be a duplicate
or false alarm, the officer can **Close as False Alarm / Duplicate** instead, landing it in the
terminal `closed_false_alarm` state.

### 3. Dispatch — Active Dispatches
**`INC-2068`** sits in **Triage Intake**; the officer hits **Assign & Dispatch** and assigns **Team
Alpha**. This creates **`DP-1181`** (`responding`) and an **Automated Resident Update** (`RU-0xx`,
**Push + SMS** — High priority, tracking ID) telling the reporter a unit is responding. The officer
monitors the **Active Dispatch Queue** and advances Team Alpha On-Scene → Resolving → Resolved as
field updates arrive, with a new resident update on every transition. Photos from the team stream into
the **On-Scene Evidence Stream**.

### 4. Coordinate — Operations Chat Center
Mid-response the officer uses the chat to ask Team Alpha for a **status update** and a **sensor
reading confirmation** (right-rail **IoT Alert Coordination**), and verifies resident context with a
Purok Leader. Auto-replies confirm readings are stable.

### 5. Patrol context — Patrol Scheduler & Routes
The officer checks the **Live Force Heatmap** — Purok 2 is a coverage gap (<50%), so they keep Team
Charlie's route visible. When the unit arrives at **`CP-03` Gate Sensor Post**, the checkpoint is
confirmed through the **Manual Confirmation** modal with a required reason (e.g. *Approved
operational change*) and renders as a violet **Manual override** — never as GPS verification.
Meanwhile **`CP-06` Commercial Strip** shows up rose as **Missed** (not cleared within its time
window); the officer attaches a missed-checkpoint reason (*Network failure*) — annotation only, the
Missed status is unchanged — and routes Team Bravo back. Offline dead-zone reports from Team Delta
are later **synchronized**.

### 6. Archive — Digital Barangay Blotter
Once the case is `resolved`, the citizen leaves a rating + feedback. **`INC-2065`** appears under
**Resolved Cases — Pending Archival**; the officer clicks **Convert to Blotter** → **`B-2026-0142`**
(permanent record: photos, GPS tags, field notes, 5-star rating, feedback). The **Resolution &
Feedback Analyzer** updates, and the Captain can review the case in **Executive Review & Oversight**
and generate the monthly **Peace & Order Report**. For the Captain's records, the officer uses the
Blotter Archive **search / category filter** to find the Fire/Smoke cases and **Export CSV** for
official use.

> Every artifact — alert, dispatch, route, resident update, checkpoint, blotter — carries the Desk
> Officer's context and a citizen tracking ID, so the full chain reads back from sensor breach to
> permanent archive.

---

## Cross-cutting conventions

- **UI language** — all six screens use the `#0038A8` royal-blue accent, a light-blue `#E9EDFB`
  canvas, stone tones, rose reserved for danger / SOS / emergency (pop-ups, threshold breaches,
  missed checkpoints), violet reserved for **manual overrides** (patrol checkpoint manual
  confirmations), `useToast` notifications, and `ConfirmModal` for confirmations (blotter archived,
  broadcast approved, report generated, shift published). The reason-selection `Modal` (patrol manual
  confirmations / missed-reason annotations) requires a value from the shared reason set before
  confirming.
- **Notification modal** — every action resolves into a centered **Notification** dialog
  (`useToast`, `frontend/src/hooks/useToast.tsx`): a colored icon chip, a title auto-derived from the
  message (segment before ` — `), the full message, a type label, and a thin accent progress bar.
  Type is inferred from keywords — `success` (confirmed/created/dispatched/generated/…), `warning`
  (capacity/near/…), `error` (rejected/blocked/…), else `info`. Auto-dismisses after 6s or via
  **Dismiss** / backdrop / **X**.
- **Incident sources** — all screens share the six §10.3.1 `IncidentSource`s (**resident**, **tanod**,
  **desk_officer**, **cctv**, **iot**, **sos**) in `SOURCE_META` (`dashboard.tsx`); **Anonymous** is a
  flag on a `resident` report (identity masked behind a tracking token), not a source. `displayValidationLabel`
  normalizes legacy three-value labels from the shared Purok Leader store to the canonical §10.3.5 five,
  and `SEVERITY_MAP` (`constants/severity.ts`) keeps badges consistent across screens.
- **Broadcast severity** — the canonical §10.6.5 scale (**info / warning / high**) drives the compose
  gate: only **high** requires Captain 1-tap authorization (§6.5.10); info/warning go out as quiet push.
- **SecurityAlert lifecycle** — IoT threshold breaches create `SensorAlert` records
  (`received → acknowledged → verification_in_progress → verified | false_or_unverified → closed`,
  §6.5.3–6.5.4) kept independent of any spawned incident; the dashboard labels them **Sensor Alert
  Pending Verification** until reviewed and preserves the raw sensor event either way.
- **Purok data** — purok zones / boundaries come from `PUROK_ZONES` (`constants/purok.ts`); geotags
  are verified against the zone polygons, and force presence / coverage is computed per purok.
- **State machines** — incidents, dispatches and Purok Leader escalations are strict one-way state
  machines (`new → acknowledged → in_progress → resolved`, plus the terminal `closed_false_alarm`
  for duplicates/invalid reports; `responding → on_scene → resolving → resolved`; and
  `in_triage → priority_adjusted → dispatched → blotter`); every incident / dispatch transition
  fires an automatic **push** to the citizen tracking ID, with **SMS layered on only for
  high-priority events** (§6.1.11 / §14.9).
- **Instant alerts** — IoT threshold breaches and Emergency SOS bypass the standard queue as an
  `AlertPopUp` / `EmergencyPopUp` (once per sensor via a ref guard) with actions to acknowledge,
  dispatch, or escalate to the Captain.
- **Captain boundary** — high-severity community broadcasts require **Captain 1-tap authorization**
  (CaptainAuthModal); the Desk Officer can only compose/queue them, whether queued from the IoT
  Command Center or the Dashboard (both route through the shared broadcast store). Silent pushes
  (medium/low severity) go out without approval.
- **Shared stores** — Purok Leader escalations flow in through `usePurokIncidents`
  (`purok_leader/incidentStore.tsx`), mass broadcasts through `addPendingBroadcast`
  (`utils/broadcastStore.ts`), and Captain notifications through
  `addCaptainInboxItem` / `seedCaptainInbox` (`utils/captainInboxStore.ts`), so the Dashboard,
  the dedicated screens, and the Captain's Desk Officer Inbox always read the same live records.
- **IDs** — mock-consistent across screens (`INC-2xxx`, `DP-11xx`, `ALT-1xx`, `SOS-0xx`, `R-22x`,
  `CP-0x`, `RU-0xx`, `B-2026-0xxx`, `OS-0xx`), so an alert created in the IoT center appears in the
  dispatch queue and a converted case becomes a numbered blotter.
- **Data** — frontend mock state with simulated live streams (4s telemetry jitter, 2.5s MQTT log,
  14s chat inflow, ~9s SOS triggers); no live backend calls in these screens.
