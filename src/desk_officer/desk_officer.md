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
| 2 | Active Dispatches | `dispatches` | `active_dispatches.tsx` |
| 3 | Alert Management | `alert_management` | `alert_management.tsx` |
| 4 | Patrol Scheduler & Routes | `patrol` | `patrol.tsx` |
| 5 | Digital Barangay Blotter | `blotter` | `digital_blotter.tsx` |
| 6 | Operations Chat Center | `chat` | `operations_chat_center.tsx` |

The officer lands on **Dashboard** by default (`defaultNav` in `App.tsx`). Login routing in
`App.tsx` maps any username starting with `desk` to this role. **Profile and Logout** live in the
shared global `Header`, not the sidebar.

The Dashboard embeds live preview widgets for the other screens, each with an **Open ›**
shortcut that calls `onNavigate("…")` (`dispatches`, `patrol`, `blotter`, `chat`).

---

## 1. `dashboard.tsx` — Barangay Desk Officer Dashboard

Central hub for triage, field dispatch and official logs.

### Header actions
- **Anonymous Report Lookup** — `KeyRound` button that opens the `AnonymousLookupModal` token lookup (see below).
- **Mass Broadcast** — `Megaphone` button that opens the severity-graded `BroadcastCompose` (see below).
- **Publish Safety Notice** — `Info` button that opens the teal `SafetyNoticeCompose` (see below).
- Each of the four embedded live preview widgets (Active Dispatches, Operations Chat
  Center, Patrol Scheduler & Routes, Digital Barangay Blotter) shows an **Open ›** shortcut that calls
  `onNavigate("…")`.

### KPIs (top row)
- **ACTIVE INCIDENTS** — count of open (not yet resolved) incidents, broken down by
  `x SOS · y new · z SLA breached` (the breach counter only appears once a `new` incident overruns its target).
- **ACTIVE DISPATCHES** — count of dispatches not yet resolved, plus how many are `responding`.
- **TANODS ON DUTY** — `x/y` teams on duty (not standby) and total field personnel.

### Incident Triage Desk (main queue)
- Intake from all six §10.3.1 sources: **Resident**, **Tanod** (field report), **Desk Officer**,
  **CCTV**, **IoT Sensor**, and **SOS** — **Anonymous** is *not* a source but a flag on a `resident`
  report (§6.1.5, reported with only a tracking token — no identity is ever shown). Each renders as a
  colored source badge with its own icon.
- Each row shows incident ID, severity badge, status badge, **verification status badge** (`new`/`under_review`/`verified`/`unverified` via `VERIFICATION_STATUS_META`),
  **Desk Officer priority chip**
  (desk-officer scale, per §6.1.3: **Low / Medium / High**), source badge, description, purok, time,
  and photo count. **SOS** rows carry a pulsing ping dot. Open incidents sort by **SLA breach first**,
  then newest; breached rows are highlighted rose with an animate-pulse **SLA Breached** badge.
- Additional row badges: **Anonymous** (stone, shows only the tracking token), **Possible Duplicate**
  (amber, when another open incident matches category + purok within the 24-hour window),
  **Escalated** (violet, after the case is pushed to the Captain), and **Reporter Safe** (emerald,
  after a resident indicates safe on an individual SOS — see the review workflow below).
- **Verification-first workflow (§12.9):** newly received incidents start at `verification_status: new`
  (Pending Review). The incident must pass through verification before it can be classified, prioritized,
  or assigned. Flow: `new → under_review → verified | unverified`. The **Start Review** button (violet)
  transitions to `under_review`; from there, **Mark Verified** (emerald) stamps `verified` or **Mark
  Unverified** (rose) opens `UnverifiedReasonModal` requiring a structured reason. Unverified incidents
  remain in the audit trail but do not proceed to dispatch. **SOS emergency exception:** SOS incidents
  can be assigned before verification via **Emergency Assign**.
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
  - **VERIFICATION STATUS** — every newly received incident starts at `new` (Pending Review) and
    must pass through a **verification-first workflow** before it can be classified, prioritized, or
    assigned. Status flow: `new → under_review → verified | unverified` (`VERIFICATION_STATUS_META`).
    - `new`: **Start Review** button (violet) transitions to `under_review`.
    - `under_review`: **Mark Verified** (emerald) transitions to `verified`, or **Mark Unverified**
      (rose) opens `UnverifiedReasonModal` requiring a reason from `UNVERIFIED_REASONS`
      (`Insufficient information` / `Unable to confirm` / `Incorrect report` /
      `Outside operational scope` / `Sensor signal could not be confirmed` / `Other`). Unverified
      incidents stay in the audit trail but do not proceed to classification or dispatch.
    - `verified`: normal status advance and assignment actions become available. A
      **VERIFIED BY DESK OFFICER** panel shows who verified and when.
    - **SOS emergency exception (§12.9)**: SOS incidents can be assigned even before verification
      via **Emergency Assign** + **Escalate to Captain** buttons, so life-safety responses are not
      delayed by the review gate.
  - **CATEGORY CHANGE (§12.7)** — during review or after verification (while not closed), the Desk
    Officer can confirm or change the incident category via `CategoryChangeModal`. Canonical
    categories: `Fire or Smoke` / `Noise Disturbance` / `Public Disturbance` /
    `Hazard or Obstruction` / `Suspicious Activity` / `Medical or Welfare Concern` / `Other`
    (`INCIDENT_CATEGORIES`). Changes are recorded in `categoryHistory` with the officer and
    timestamp.
  - **DESK OFFICER PRIORITY** — manual **Low / Medium / High** assignment (locked once the
    case is closed), overriding the inherited source severity.
  - **INTERNAL NOTES** — desk-only observations appended to the record (not shown to the citizen).
  - **SLA breach panel** — when breached, shows the elapsed time, overrun amount, and target.
  - **Possible Duplicate panel** — when a matching open incident is detected, offers three
    non-destructive choices: **Keep Separate** (requires a note, recorded on the case),
    **Link as Related** (marks the pair as related), or **Close as Duplicate** (the existing terminal
    `closed_false_alarm` action — cases are never auto-merged). Enhanced duplicate details now
    show category, purok, time, and similarity between the matched incidents.
  - **Linked related incident** panel when a case was already marked related.
  - **Escalated to Captain** panel + badge once pushed upstream.
  - **CLOSURE HISTORY (§15.2)** — every closure (normal resolution, false alarm, reporter safe)
    records a structured `ClosureHistoryEntry` with `previousStatus`, `finalStatus`,
    `closureReason`, `closureNote`, `closedBy`, and `closedAt`. Displayed as a panel in the
    slide-over with full audit trail.
  - Footer actions — the advance button, **Close as False Alarm / Duplicate** (opens
    `CloseFalseAlarmModal` — see below), **Assign** (dispatch a
    Tanod team *or* hand local responsibility to a **Purok Leader**), **Escalate to Captain** (requires
    a reason), and the real-time notification note to the reporter on every status change — push on
    every transition, SMS only for High-priority Acknowledge/Resolve (§6.1.11 / §14.9).
  - **CloseFalseAlarmModal** — structured closure flow replacing the old one-click close. Requires:
    - **Closure reason** from `CLOSURE_REASONS`: `False alarm / Duplicate / Incomplete report / Resolved by resident / Withdrawn by reporter / Other`.
    - **Closure note** (optional free text).
    - On confirm, the incident moves to `closed_false_alarm` with `closureReason`, `closureNote`,
      `closedBy`, and `closedAt` stamped. A `ClosureHistoryEntry` is appended to the record's
      `closureHistory` array.
  - **ResolutionSummaryModal** — shown when advancing to `resolved`. Requires:
    - **Resolution summary** (what happened, what action was taken).
    - **Response completed** toggle (was the original complaint fully addressed?).
    - **Evidence attached** toggle.
    - **Internal notes** (optional — desk-only observations).
    - On confirm, the incident is stamped with `resolutionSummary`, `resolvedBy`, `resolvedAt`,
      and all fields are preserved in the blotter conversion.
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

## 2. `active_dispatches.tsx` — Active Dispatches

Assignment, routing and live on-scene monitoring of field responders.

### Header
- **`x Units Available`** pill counts the on-duty Tanod teams that are not yet dispatched.
- **Assign Next** dispatches the top unassigned Triage Intake incident straight through the
  `AssignModal` (see below) without opening the queue first.

### KPIs
- **ACTIVE DISPATCHES** — `responding` / `on scene` split · **RESOLVING NOW** · **UNASSIGNED QUEUE**
  (with available units) · **RESOLVED TODAY** · **SLA BREACHED** (dispatches that exceeded their target response time).

### Filters & Sorting
- **FilterType**: `all | responding | on_scene | resolving | resolved` — filters the dispatch queue by status.
- **SortType**: `newest | oldest | priority | sla` — sorts dispatches by creation time, priority level, or SLA breach urgency.
- Filter and sort state are preserved while navigating between sub-tabs.

### Active Dispatch Queue
- Strict state machine `responding → on_scene → resolving → resolved` (`DISPATCH_META`), with advance
  buttons (**Mark On-Scene / Mark Resolving / Mark Resolved**). Each dispatch shows team, ETA, distance,
  reporter, time, and evidence count, plus **Route**, **Message**, and **Evidence** quick actions.
- **SLA badges**: dispatches that breach their response-time target show a rose **SLA Breached** badge
  with the elapsed time. SLA targets: High 15 min, Medium 60 min, Low 240 min (from dispatch creation).

### Dispatch Detail Drawer
- Opens on dispatch click; shows full dispatch details, activity history (audit trail of all status changes with timestamps), linked incident, assigned team, and evidence items.
- **Reassign** — allows reassigning the dispatch to a different Tanod team; requires a reason from `ReassignReason` (`Team unavailable / Route change / Specialist needed / Coverage gap / Other`). Reassignment is logged in the activity history.
- **Escalate to Captain** — pushes the dispatch upstream; requires a reason from `EscalationReason` (`Prolonged response / Resource shortage / Safety concern / Complex incident / Escalation requested`). Adds an **Escalated to Captain** panel on the dispatch.
- **Activity History** — chronological log of all actions on the dispatch: status transitions, reassignments, escalations, notes, and evidence uploads.

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

## 3. `patrol.tsx` — Patrol Scheduler & Routes

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

## 4. `digital_blotter.tsx` — Digital Barangay Blotter

One-click archival of resolved incidents, ratings and executive oversight.

### KPIs
- **TOTAL BLOTTERS FILED** (permanent records) · **PENDING CONVERSION** (resolved cases ready to
  archive) · **AVG CITIZEN RATING** (`x / 5`) · **AVG RESPONSE TIME** (dispatch → on-scene).

### Resolved Cases — Pending Archival
- Completed incident lifecycles (photos, field notes, GPS tag, rating, citizen feedback) with
  **Convert to Blotter** (or the header **Convert Next** macro). Conversion:
  - Calls `convertIncidentToBlotter(incident)` from `incidentStore.ts` which:
    - Mints the permanent record (`B-2026-0xxx` via `nextBlotterId`).
    - Copies structured fields: `resolutionSummary`, `resolvedBy`, `resolvedAt`, `categoryHistory`,
      `closureHistory` (full audit trail of all closures), `blotterDisposition`, `blotterNotes`.
    - Preserves the incident's `ClosureHistoryEntry[]` for full lifecycle traceability.
  - Removes the case from pending.
  - Pops a success modal noting the photos, GPS tags, field notes and rating are now archival.

### Structured Disposition (§15.4)
- Each archived blotter carries a `blotterDisposition` field (`DISPOSITION_OPTIONS`):
  - **Resolved** (`resolved`) — incident addressed and confirmed resolved.
  - **False Alarm** (`false_alarm`) — no real incident; sensor error,误报, etc.
  - **Duplicate** (`duplicate`) — merged with or closed in favor of another incident.
  - **Unverified** (`unverified`) — could not be confirmed during review.
  - **No Action Required** (`no_action`) — assessed as not needing response.
  - **Transferred** (`transferred`) — handed to another agency or authority.
- The disposition is recorded at archival time and displayed as a color-coded badge in the blotter archive.

### Blotter Detail (`BlotterDetail`)
- **Official Entry** section: blotter ID, title, category, filed time, recorded-by officer.
- **Incident Information** section: original incident ID, source, severity, description, purok, GPS coordinates.
- **Response Summary** section: resolution summary, resolved-by, resolved-at, response time.
- **Closure History** section: full audit trail of all `ClosureHistoryEntry` records (previous status → final status, reason, note, closed-by, closed-at).
- **GPS & Evidence** section: geotag verification, evidence thumbnails with lightbox.
- **Citizen Feedback** section: star rating, feedback quote, reporter name (or tracking token if anonymous).
- **Record History** section: amendment log, archival timestamp, officer who archived.

### Resolution & Feedback Analyzer
- Average satisfaction score, **rating distribution** bar chart (5★→1★), and recent qualitative
  feedback quotes (Filipino) with incident + resident attribution.

### Blotter Archive
- Official archival logs (ID, category, title, filed time, incident, purok, officer, rating, disposition badge). **View**
  opens `BlotterDetail` (see above).
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

## 5. `operations_chat_center.tsx` — Operations Chat Center

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

---

## 5b. `alert_management.tsx` — Alert Management Control Center

Operational interface to **receive, review, acknowledge, escalate, broadcast, and track** alerts across
two surfaces:

### Incoming System Alerts Queue
- Local `SystemAlert` model spanning **IoT Smoke Sensor**, **IoT Noise Sensor**, and **Manual System Flag**
  sources, each with a colored source chip/icon, severity pill (Low/Medium/High/Emergency), status pill, and
  purok location.
- Lifecycle statuses: `unacknowledged → acknowledged`, plus `linked`, `converted`, and `dismissed` terminal
  states (`ALERT_STATUS_META`).
- **Filter selects** (All + source / severity / status) re-filter the table live. Rows expose **Review**,
  **Ack** (unacknowledged only), and **Link** actions; linked rows show the target incident ID.
- **Alert Detail Drawer** (`Modal side="right"`): telemetry metadata tiles, an inline **SVG sensor graph**
  with a dashed threshold line + breach highlight, **LINKED CCTV VISUALS** camera cards, and footer actions —
  **Confirm & Acknowledge**, **Link to Incident**, **Convert to Incident**, **Dismiss (False Alarm)**. The
  drawer can also **Escalate to Security Broadcast**, which hands off to the Create Security Alert modal.

### Outgoing Broadcast Alert History
- Renders the shared `safetyNoticeStore` security alerts (severity/audience-only) with target audience,
  severity, broadcast time, and lifecycle status (**Active / Pending Approval / Resolved (All-Clear) / Draft**).
- **All-Clear** action (teal) opens the **All-Clear dialog** — requires a resolution advisory, broadcasts to
  the original audience, and moves the alert to Resolved.
- **Create Security Alert** modal: linked incident selector, severity segmented control (High → **Punong
  Barangay approval queue**), audience toggles, target location, message templates, and custom narrative.

### Metrics & quick actions
- **Active Alerts / Pending Approval / IoT Breaches / Sent Today** summary cards.
- Quick actions: **Create Security Alert** and **Acknowledge Audio Alerts** (`useAlertSound`).
- `recordActivity` + `addSafetyNotice` + `addBroadcastRecord` + `addIncident` integrations keep the shared
  activity feed, broadcast store, incident store, and approval queues in sync.

---

## 6. End-to-end scenario (single incident lifecycle)

The six screens are one pipeline: **ingest → verify → triage → dispatch → field → resolve → archive**. Here is
the journey of one fire-smoke incident.

### 1. Ingest — IoT Alert Command Center
An ESP32 smoke sensor (`SM-GATE-01`, Purok 1) crosses the 500 ppm threshold. The **IoT Telemetry
Ingestion Gateway** logs the MQTT payload, auto-creates alert **`ALT-118`** (status: `open`), and `AlertPopUp` fires
instantly (bypassing the queue). The officer acknowledges the alert (`acknowledged`), starts verification
(`verification_in_progress`), and confirms the reading is real (`verified`). They then press **Create Incident**
to spawn **`INC-2068`** and **Dispatch Tanod** — route **`R-221`** (Team Alpha, 4 min ETA) is created with
turn-by-turn navigation and a high-priority vibration + audio push.

### 2. Verify — Dashboard (Verification-First Workflow)
**`INC-2068`** arrives at the Dashboard with `verification_status: new` (Pending Review). The officer clicks
**Start Review** → `under_review`. They examine the attached evidence and IoT data, then click
**Mark Verified** → `verified`. A **VERIFIED BY DESK OFFICER** panel is stamped on the record. Now the
incident is eligible for classification and assignment.

> **SOS exception:** Had this been an SOS incident, the officer could have used **Emergency Assign** to
> dispatch a unit before completing verification — life-safety responses are never gated.

### 3. Triage — Dashboard
The verified incident now appears in the **Incident Triage Desk** as **`INC-2068`** (Fire/Smoke,
IoT Sensor source, `new`). **View** opens the detail slide-over: the officer confirms the category via
**Category Change** (`Fire or Smoke`), assigns a **High priority**, and logs an
**internal note** ("Gate sensor confirmed climbing past 500 ppm"), and the
geotag is verified inside Purok 1's boundary. Every status advance — Acknowledge → Start Work →
Resolve — pushes the reporter in-app; because **`INC-2068`** is **High** priority, **Acknowledge** and
**Resolve** also fire **SMS** (§6.1.11 / §14.9). If a citizen report turns out to be a duplicate
or false alarm, the officer can **Close as False Alarm / Duplicate** (with a structured `ClosureReason`
from `CLOSURE_REASONS`), landing it in the terminal `closed_false_alarm` state. A `ClosureHistoryEntry`
records the full audit trail.

### 4. Dispatch — Active Dispatches
**`INC-2068`** sits in **Triage Intake**; the officer hits **Assign & Dispatch** and assigns **Team
Alpha**. This creates **`DP-1181`** (`responding`) and an **Automated Resident Update** (`RU-0xx`,
**Push + SMS** — High priority, tracking ID) telling the reporter a unit is responding. The officer
monitors the **Active Dispatch Queue** (sorted by SLA breach priority) and advances Team Alpha
On-Scene → Resolving → Resolved as field updates arrive, with a new resident update on every transition.
Photos from the team stream into the **On-Scene Evidence Stream**. If the dispatch exceeds its SLA
target, a rose **SLA Breached** badge appears.

### 5. Coordinate — Operations Chat Center
Mid-response the officer uses the chat to ask Team Alpha for a **status update** and a **sensor
reading confirmation** (right-rail **IoT Alert Coordination**), and verifies resident context with a
Purok Leader. Auto-replies confirm readings are stable.

### 6. Patrol context — Patrol Scheduler & Routes
The officer checks the **Live Force Heatmap** — Purok 2 is a coverage gap (<50%), so they keep Team
Charlie's route visible. When the unit arrives at **`CP-03` Gate Sensor Post**, the checkpoint is
confirmed through the **Manual Confirmation** modal with a required reason (e.g. *Approved
operational change*) and renders as a violet **Manual override** — never as GPS verification.
Meanwhile **`CP-06` Commercial Strip** shows up rose as **Missed** (not cleared within its time
window); the officer attaches a missed-checkpoint reason (*Network failure*) — annotation only, the
Missed status is unchanged — and routes Team Bravo back. Offline dead-zone reports from Team Delta
are later **synchronized**.

### 7. Resolve & Close — Resolution Summary Modal
When the officer or responder clicks **Resolve**, the `ResolutionSummaryModal` opens requiring:
- **Resolution summary** (what happened, what action was taken).
- **Response completed** toggle (yes/no — was the original complaint fully addressed?).
- **Evidence attached** toggle.
- **Internal notes** (optional — desk-only observations).
The resolution is recorded with `resolvedBy`, `resolvedAt`, and the full summary. If the case is later
closed as false alarm or duplicate, the `CloseFalseAlarmModal` captures the `ClosureReason` and
`closureNote`, and a `ClosureHistoryEntry` is appended to the record.

### 8. Archive — Digital Barangay Blotter
Once the case is `resolved`, the citizen leaves a rating + feedback. **`INC-2065`** appears under
**Resolved Cases — Pending Archival**; the officer clicks **Convert to Blotter** → **`B-2026-0142`**
(permanent record: photos, GPS tags, field notes, 5-star rating, feedback, structured disposition,
closure history). The **Resolution &
Feedback Analyzer** updates, and the Captain can review the case in **Executive Review & Oversight**
and generate the monthly **Peace & Order Report**. For the Captain's records, the officer uses the
Blotter Archive **search / category filter** to find the Fire/Smoke cases and **Export CSV** for
official use.

> Every artifact — alert, dispatch, route, resident update, checkpoint, blotter — carries the Desk
> Officer's context and a citizen tracking ID, so the full chain reads back from sensor breach to
> permanent archive.

---

## Cross-cutting conventions

- **Shared incident store** — `incidentStore.ts` provides the canonical `useIncidentStore` hook with a pub/sub pattern (`subscribe`, `getSnapshot`). All incident state — `IncidentStatus`, `IncidentSource`, `VerificationStatus`, `DeskPriority`, `ClosureReason`, `FinalDisposition`, `ClosureHistoryEntry` — lives here. The Dashboard, Active Dispatches, Digital Blotter, and IoT Command Center all read from this store, ensuring a single source of truth. The store also exports `convertIncidentToBlotter()` for one-click archival.
- **Notification tracking** — every resident notification (`NotificationRecord`) tracks `type` (status_update / escalation / broadcast / sms_only), `channel` (push / sms / in_app), `status` (queued / sent / delivered / failed), and `isSafetyCritical` flag. High-priority incidents trigger SMS on Acknowledge and Resolve; all other transitions use push/in-app only.
- **Service alerts** — `ServiceAlert` records (`service_alerts` field on `Incident`) monitor device health for CCTV and IoT sensors, with severity (`info | warning | critical`) and resolution tracking.
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
- **Incident categories** — canonical categories (`INCIDENT_CATEGORIES`): `Fire or Smoke` / `Noise Disturbance` / `Public Disturbance` / `Hazard or Obstruction` / `Suspicious Activity` / `Medical or Welfare Concern` / `Other`. Category changes are tracked in `categoryHistory` with the officer and timestamp.
- **Broadcast severity** — the canonical §10.6.5 scale (**info / warning / high**) drives the compose
  gate: only **high** requires Captain 1-tap authorization (§6.5.10); info/warning go out as quiet push.
- **SecurityAlert lifecycle** — IoT threshold breaches create `SensorAlert` records
  (`open → acknowledged → verification_in_progress → verified | false_unverified → dispatched → broadcasting → closed`,
  §6.5.3–6.5.4) kept independent of any spawned incident; the dashboard labels them **Sensor Alert
  Pending Verification** until reviewed and preserves the raw sensor event either way.
- **Purok data** — purok zones / boundaries come from `PUROK_ZONES` (`constants/purok.ts`); geotags
  are verified against the zone polygons, and force presence / coverage is computed per purok.
- **State machines** — incidents, dispatches, IoT alerts, and Purok Leader escalations are strict one-way state
  machines. Incidents have two parallel flows: **verification** (`new → under_review → verified | unverified`) and
  **status** (`new → acknowledged → in_progress → resolved`, plus the terminal `closed_false_alarm`
  for duplicates/invalid reports). Dispatches follow `responding → on_scene → resolving → resolved`.
  IoT alerts follow `open → acknowledged → verification_in_progress → verified | false_unverified → dispatched → broadcasting → closed`.
  Purok Leader escalations follow `in_triage → priority_adjusted → dispatched → blotter`.
  Every incident / dispatch transition fires an automatic **push** to the citizen tracking ID, with
  **SMS layered on only for high-priority events** (§6.1.11 / §14.9).
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
