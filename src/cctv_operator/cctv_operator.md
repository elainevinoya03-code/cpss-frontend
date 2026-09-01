# CCTV Operator — Role Guide

The CCTV Operator's flow is the front door of the surveillance system. They watch live feeds and
manually record what they observe as tagged events, then mine the archive for evidence. All triage,
prioritization and dispatch is handled by the **Barangay Desk Officer** — the operator observes and
prepares, the desk decides and dispatches.

## Navigation (CCTV_OPERATOR_NAV in `App.tsx`, labels in `components/layout/sidebar.tsx`)

| Order | Sidebar label | Nav key | File |
| --- | --- | --- | --- |
| 1 | Surveillance Matrix | `surveillance` | `surveillance_matrix.tsx` |
| 2 | CCTV Events & Evidence | `events` | `cctv_events_evidence.tsx` |
| 3 | Video Archives & Playback | `archives` | `video_archives_playback.tsx` |
| 4 | Footage Requests | `footage_requests` | `cctv_footage_requests.tsx` |

The operator lands on **Surveillance Matrix** by default (`defaultNav` in `App.tsx`).

**Profile and Logout** are not sidebar items — the avatar menu in the shared global `Header`
(`App.tsx`, present on every screen and role) provides logout, so no operator-specific nav entry
exists.

> **Legacy files (removed)** — `manual_threat_flags.tsx` and `escalated_clips_dispatches.tsx` were
> deleted in the final role-boundary cleanup. Their responsibilities (anomaly flagging, evidence
> clipping, clip→incident tracking) had already been merged into `cctv_events_evidence.tsx`; nothing
> referenced them. The folder now contains only the four active screens plus the shared mock stores
> (`evidence_activity.ts`, `export_evidence_modal.tsx`) and this guide.

---

## 1. `surveillance_matrix.tsx` — Surveillance Matrix

The main live multi-camera dashboard ("Watch · Observe · Tag Event · Report Camera Problems").

### Process
1. **KPI row** — CAMERAS MONITORED (online/total), HLS STREAMS ACTIVE, FFMPEG TRANSCODING
   (RTSP → HLS), DEGRADED / OFFLINE counts.
2. **Grid loads** — a 3×3 grid renders the registered camera list (`INITIAL_CAMERAS`, 9 feeds) with
   their RTSP/HLS URLs. Cameras are simulated with `status` (`online` / `degraded` / `offline`) and a
   fluctuating `signalPct` (jittered every 4s; < 50% flips the camera to `degraded`).
3. **Monitor** — each cell shows a live-feed placeholder, `LIVE` badge, camera name, quality pill
   (High ≥ 80% / Medium ≥ 50% / Low), protocol badge (`FFmpeg → HLS` for RTSP-only cameras,
   `Native HLS` otherwise), stream URL, status chip + signal bar, and connection info (IP or "last
   seen" when offline). In `auto` quality mode a weak signal is marked **Downgraded**.
4. **Reconfigure the view (live)** —
   - **Grid density** (`1×1` / `2×2` / `3×3`): `changeGridSize` resizes the per-cell assignments
     (`resizeCellIds` keeps existing cameras, auto-fills empty slots).
   - **Per-cell camera picker**: the **Configure Feeds** modal (`ConfigureModal`) shows one dropdown
     per cell and assigns a camera (or Empty); an assigned-count chip tracks fills. Empty cells render
     a dashed "No camera assigned" slot with an **Assign camera** shortcut.
   - **Quality mode**: `auto` / `high` / `medium` / `low` (locked modes skip adaptive downgrade).
   - **Reconnect Streams**: global button simulates a re-fetch of every feed (spinner +
     per-cell `Reconnecting stream...` overlay, then restored signal values + toasts).
   - **Fullscreen**: the expand button on a cell uses the browser Fullscreen API; the cell re-renders
     a rich fullscreen overlay (camera ID, live clock, quality, location, URL, Tag Event + Exit
     Fullscreen). Clicking the cell body opens the **Stream Focus** modal instead (location, signal,
     RTSP source, HLS playback cards + protocol explainer; footer Close / Report Problem / Tag Event —
     disabled while offline).
5. **Tag an event** — the **Tag Event** button on any live cell opens `TagModal`, a **3-step wizard**
   (progress bar: Event Details → Incident Link → Confirm):
    - **Step 1 — Event Details**: event time (live clock), required **event category**
      (`EVENT_CATEGORIES`: `Suspicious Activity` / `Unusual Gathering` / `Road Obstruction` /
      `Public Disturbance` / `Hazard` / `Other`, each with a hint), optional description notes
      ("Record your observation…"). The category describes what the operator saw — it is an
      observation label, not an incident priority.
    - **Step 2 — Incident Link**: choose the incident relationship:
      - **Create New Incident** — a CCTV-Reported incident is created with **Initial Priority:
        Medium** and routed to the Desk Officer triage queue. Priority is *not* operator-selectable:
        "Final priority will be determined by the Desk Officer during triage. The CCTV Operator
        cannot change, promote, or downgrade incident priority."
      - **Link to Existing Incident** — searchable list of open incidents (`MOCK_INCIDENTS`, filter by
        ID/title, priority chips); the event + footage attach as supplementary evidence and no
        duplicate is created.
    - **Step 3 — Confirm**: summary (camera, location, category, timestamp, operator, incident action,
      an **Initial Priority: Medium** row when creating new, linked incident title, notes), an amber
      banner ("Initial Priority: Medium. Final priority will be determined by the Desk Officer during
      triage." — or the no-duplicate evidence note when linking), and a highlighted role-boundary
      statement: **"CCTV Operator records the observation. The Desk Officer determines the final
      priority during triage."**
6. **Safeguards before the tag is accepted** (`confirmTagEvent`):
   - **5-minute dedup guard**: tagging the same camera within 5 minutes of an existing tag is blocked
     (Sec 4.2 dedup rule) with a toast.
   - **Offline mid-tag guard**: if the camera lost signal at confirm time, the tag is rejected
     (`beep("offline")`) — no footage is available, so no event/incident is created.
7. **Event recorded** — on confirm the event is stamped with timestamp + camera +
   the logged-in **operator identity** (`operatorName` prop from login), creating a **Manual CCTV
   Event** (`CCTV-EVT-000X`) whose CCTV-Reported incident resolves to `INC-208x` (creating new) or
   the chosen existing ID (linking). A critical tone plays and a toast summarizes the outcome
   ("…recorded with Initial Priority: Medium, pending Desk Officer triage"). There is no
   clip-generation animation on this screen — the event lands directly in the log below.
8. **Recent CCTV Events** — a read-only session log of Manual CCTV Events: event ID, category chip,
   camera + location/purok, time, operator, linked incident ID, and a status badge
   (`Pending Desk Officer Triage` amber, or `Linked to existing` sky). Events cannot be edited,
   retracted or undone here.
9. **Storage capacity** — the **Storage Capacity** panel is read-only: used GB vs the 2 TB budget
   (1-year retention), flagged **NEAR CAPACITY** past 90%, else **HEALTHY**. No manual purge control
   at operator level.
10. **Camera fault reporting** — **Report Problem** (header button with open-ticket count, wrench
    icon on any cell, or Stream Focus footer) opens `FaultModal`: camera picker, fault type
    (`Hardware failure` / `Network instability` / `Lens obstruction` / `Power supply` /
    `Image quality degradation`), description. Submitting files a maintenance ticket (`MT-2052+`)
    to Barangay Admin/Maintenance, confirmed by a success dialog ("Maintenance/Admin will handle
    resolution. No action is required from the CCTV Operator."). The **Camera Fault Reports** log is
    read-only — tickets stay open until Maintenance resolves them (a seeded `MT-2051` exists for the
    offline hall camera).

### Key models
`CameraFeed` (id, name, location, purok, ip, nativeProtocol, status, signalPct, rtspUrl, hlsUrl) ·
`EventCategory` · `IncidentAction` (`create_new` / `link_existing`) · `ExistingIncident` (MOCK list
for linking) · `CctvEvent` (id, camera*, category, notes, timestamp, operator, incidentAction,
incidentId, incidentStatus) · `CameraFault` (ticket, severity/fault type, status open/resolved).

---

## 2. `cctv_events_evidence.tsx` — CCTV Events & Evidence

The event and evidence management workspace: "Review tagged events, manage evidence clips, and
track incident handoff". Tagging itself lives **only** in the Surveillance Matrix — this screen has
no tag controls; it manages what tagging produced.

### Process
1. **KPI row** — CCTV EVENTS TRACKED (clips linked to incidents), PENDING DESK TRIAGE, BEYOND TRIAGE
   (advanced by the Desk Officer), EVIDENCE CLIPS BOUND (permanent DVR attachments). Header carries
   the Operator badge + sound toggle.
2. **CCTV Event Log** — the primary list of tagged events (seeded `EscalatedClip` records). Each
   event card shows clip ID, tag type chip, camera·ID·location·purok, tagged time, operator, a
   selected-footage timeline (clip start / operator-selected footage / clip end — the segment length
   varies with whatever footage was available around the event),
   operator notes, storage URL and a **Review Clip** button (`ClipReviewModal`: play/pause/seek,
   evidence details with a mock **Integrity: Verified** chip, tag context, evidence link & storage
   badges, plus **Redact PII** (manual masking) and **Export Evidence** actions). Beside it sits the
   incident card:
   ID, `CCTV-Reported` source, current priority (read-only, set by the Desk Officer), category ·
   purok, created time, and the read-only dispatch stepper
   `in_triage → dispatched → on_scene → resolved` (with assigned team + dispatch note when set) —
   "Desk Officer owns triage, prioritization, assignment, dispatch, and resolution." Statuses come from
   seed data; there is no sync/dispatch/tag control on this screen.
3. **Video DVR & Evidence Clipper** — a DVR archive of one-minute clips (`ARC-22xx`) plus a **Bind
   Target** picker that selects which logged event's incident receives extracted clips. **Extract**
   pulls a clip out of the archive and binds it as a permanent digital attachment to the selected
   incident (`EvidenceClip`, listed under "Bound to Incident Files"). With no events available,
   extraction is refused with a toast pointing back to the Surveillance Matrix.
4. **Search** — the search box filters event log entries by ID, incident ID, camera, category,
   note, status, purok or operator.
5. **Evidence Activity** — a mock audit trail (shared store in `evidence_activity.ts`, no backend).
   Every evidence action appends a record — action (`VIEWED` / `GENERATED` / `REDACTED` /
   `ATTACHED` / `EXPORTED`), clip ID, incident ID when available, operator and date/time. Opening
   **Review Clip** logs `Viewed`; **Extract** logs `Attached`. Actions taken on the Video Archives &
   Playback screen (generate / redact / attach) land in the same log.
6. **Export Evidence** — a shared `ExportEvidenceModal` (confirm → simulated preparation → success,
   recording `EXPORTED` in Evidence Activity) is reachable from two places: the **Export Evidence**
   button in `ClipReviewModal` and the per-record **Export** button under CCTV Clip Records in Video
   Archives & Playback. Confirmation copy: "Export CLIP-20xx? This action will export the selected
   CCTV evidence for authorized operational use." (Cancel / Export Evidence).
7. **The Dispatch Boundary** (footer) — a visual handoff confirming the pipeline: **Operator** tags →
   **Operator** preserves (selects footage, generates clip) → **Operator** reviews / redacts /
   exports → HANDOFF ("Pending Desk Officer triage")
   → **Desk Officer** triages & dispatches → **Tanod** on scene → **Desk Officer** resolves, with
   the reminder that triage, prioritization and dispatch belong exclusively to the Desk
   Officer. The operator's pipeline ends at the handoff — prioritize → assign → dispatch → resolve
   are never operator steps.

### Key models
`ArchiveClip` · `EvidenceClip` (id, eventId, camLabel, time, duration, note) · `EscalatedClip`
(clip metadata + storageUrl + operator + nested `incident`) · `IncidentRecord` (source, priority,
category, status, purok, createdAt, assignedTeam?, dispatchNote?) · `DispatchStatus` ·
`EvidenceActivity` (action, clipId, incidentId?, operator, at — mock only).

---

## 3. `video_archives_playback.tsx` — Video Archives & Playback

Search, replay, clip and sanitize recorded footage for evidence use.

### Process
1. **Search the archive** — filter by **date**, **time range**, and **camera** over `RECORDINGS`
   (Archive Index). Matching recordings appear as cards.
2. **Playback Station** — load a recording, then play / pause / seek on the timeline (`REC` badge,
   live clock).
3. **Create a clip** — select available footage surrounding the event: scrub the timeline,
   **Set Clip Start** / **Set Clip End**, optionally **Preview Segment** to replay just the marked
   range, then **Generate Clip**. There is no automatic pre-roll or post-roll — the clip is cut only
   from recorded footage, and its actual selected duration is shown on the record. This writes an
   `.mp4` to the `cctv-clips` Supabase Storage bucket, logs a `Clip` record
   (id, camera, start/end, duration, `storage_url`, **operator**), and lists it under **CCTV Clip
   Records** with an **Evidence Details** block (camera, recorded range, clip duration, created by,
   related incident, privacy processing, status, and a mock **Integrity: Verified** chip). Clip
   generation, redaction and incident attachment all play an info tone and are recorded in the
   shared **Evidence Activity** log (`Generated` / `Redacted` / `Attached`).
4. **Manual privacy redaction** — **Redact** opens `RedactionModal`: draw masking boxes over **faces**
   and **license plates** (drag on canvas; Face / License Plate mask types, Clear All). Applying marks
   the clip `privacy_blurred = true`. Automated blurring is explicitly out of scope this release
   (Data Privacy Act compliance).
5. **Attach to incident** — **Attach to Incident** opens `AttachModal` listing open incidents
   ("Evidence will be linked to the selected incident."); linking starts the **1-year retention
   clock** (`retainedUntil`) and makes the clip reviewable by the Desk Officer / Captain.
6. **Export evidence** — the per-record **Export** button opens the shared `ExportEvidenceModal`
   (confirm → preparation → success) and records `EXPORTED` in Evidence Activity.
7. **Retention & review** — attached clips are retained exactly 1 year (with days-left countdowns);
   unattached clips stay in working storage until linked or pruned.
8. **Archive capacity** — the **Archive Storage Capacity** meter tracks used GB vs the 2 TB budget and
   flags **NEAR CAPACITY** past 90%. The meter is advisory: footage past the 1-year retention window
   is automatically marked for purge; there is no operator purge button.

### Key models
`Recording` (camera, startISO, duration, sizeMB, events) · `Clip` (start/end, storageUrl,
privacyBlurred, masks, incidentId, attachedAt, retainedUntil, operator) · `Mask` (x, y, w, h, label
`Face`/`License Plate`).

---

## 4. `cctv_footage_requests.tsx` — Footage Requests

A **request-queue + fulfillment** workspace. The **Barangay Desk Officer files a footage request** for an
incident (camera, date, start/end time, related incident, event tag, purpose, priority). The CCTV
Operator's job is to **locate and provide the requested recording securely** — the operator does *not*
decide the incident. The request pre-fills the search, the operator finds/reviews the footage, retrieves
a clip, attaches it to the incident, and **fulfills** the request so the Desk Officer can review it.
Every access/view/export/privacy action is written to the audit log.

### Process
1. **KPI row** — FOOTAGE REQUESTS (filed by the Desk Officer), PENDING FULFILLMENT, FULFILLED, CLIP
   RECORDS (with storage & retention metadata). Header carries the Operator badge, sound toggle and an
   **Authorized access only** lock chip.
2. **Archive Storage Capacity** — advisory meter (GB vs 2 TB budget, `HEALTHY` / `NEAR CAPACITY` past
   90%, 1-year retention). Read-only for the operator.
3. **Desk Officer Requests** — a plain queue of requests filed by Desk Officer users (`FR-1xxx`).
   Each card shows the request ID, status chip, urgent flag, requestor name/role, linked incident, camera,
   date/time window, request date/time, and purpose. **Selecting a request auto-fills the search filters**
   with its camera, date, start/end time, incident and event-tag criteria.
4. **Request detail** (below the queue) — shows the full criteria (camera, incident, date/time, event tag),
   a **Description/Reason**, the **Requester's Notes**, and clip counts. **Provide Footage** fulfills the
   request (it requires at least one clip linked to the request's incident); **Mark Unavailable** records a
   reason (no recording / camera offline / recorder unavailable / not accessible / live-only) before marking
   it `Cannot Fulfill` and notifying the Desk Officer.
5. **Search the Available Archive** — filters (camera, date, start/end time, related incident, event
   tag) pre-filled from the selected request, editable, with removable chips, **Clear All** and **Find
   Footage**.
6. **Find Footage (results)** — matched recordings with camera, location/purok, date, duration,
   timestamp range, size, event tag, incident link and a `SYSTEM RECORDER` vs `EXTERNAL RECORDER` badge.
   **Review** / **Select Clip** loads a recording into the playback station and logs `Viewed`; a no-archive
   camera is refused with a live-stream-only toast.
7. **Review & Playback** — play / pause / seek / volume (dependent on recording source), external-recorder
   dependency notice, **Set Clip Start / End**, **Preview Segment** (auto-stops at end). **Retrieve /
   Generate Clip** is enabled on valid marks only; the generated clip is tagged with the selected request
   (`requestId`) and the request's incident when set, and logs `Generated`.
8. **Fulfill / provide** — the operator's **Provide Footage** button fulfills the request (a clip
   must be linked to the request's incident), switching its status to `Fulfilled` and logging the action so
   the Desk Officer can retrieve the footage for incident assessment / response / documentation.
   **Mark Unavailable** records a stated reason and sets `Cannot Fulfill`.
9. **Provided Footage / Clip Records** — each clip carries full metadata: clip_id, camera_id,
   incident_id, request_id, start/end timestamps, storage_reference, file type/size, uploader (operator),
   creation time, retention/legal-hold status, optional content hash, recorder source. Rows expose
   **Evidence Details**, **Privacy Blur** (`RedactionModal`, original preserved), **Export**
   (`ExportEvidenceModal`, logs `EXPORTED`) and **Attach** (`AttachModal` with duplicate-incident warning,
    starts 1-year retention, logs `Attached`).
10. **Evidence Activity — Audit Log** — the shared mock trail lists every `Viewed`, `Generated`,
    `Attached`, `Redacted` and `Exported` action with clip ID, incident (when set), operator and time.

### Key models
`FootageRequest` (id `FR-1xxx`, incidentId?, cameraId?, date?, startTime?, endTime?, eventTag?, purpose,
priority `standard`/`urgent`, requestedBy, requestedByRole, requestedAt, status
`pending`/`in_progress`/`fulfilled`/`cannot_fulfill`, note?) · `RequestStatus` · `Camera` (id, name,
location, purok, status, `hasArchive`, `controlled` — system vs external recorder) · `Recording` (camera,
startISO, duration, sizeMB, events, eventTag?, incidentId?) · `Clip` (id, cameraId, cameraName,
incidentId?, requestId?, start/end, startSec, endSec, durationSec, storageReference, fileType, fileSize,
uploadedBy, createdAt, contentHash?, retentionStatus, privacyStatus, masks?, attachedAt?, retainedUntil?,
recorderSource) · `PrivacyProcessedClip` · `OpenIncident` · `Mask`.

---

## 5. Worked end-to-end scenario

The screens form one pipeline: **watch → tag/route → preserve**. Here is the journey a single
incident takes through the operator's flow.

### 1. Watch & tag — Surveillance Matrix
Operator **CO-01** lands on the 3×3 grid. At **Main Gate** (`CAM-GATE-01`, Purok 1) a group lingers
near the entrance at 01:40 AM.

- Opens the cell's **Tag Event** → wizard Step 1, selects **Suspicious Activity**, adds a description,
  advances.
- Step 2 keeps **Create New Incident** — the modal makes clear the incident will be recorded
  CCTV-Reported with Initial Priority: Medium, and the confirm step states the role boundary:
  the Desk Officer determines the final priority during triage.
- Dedup guard passes (no tag on `CAM-GATE-01` in the last 5 min); the camera is online so the offline
  guard passes too.
- Confirm creates **`CCTV-EVT-0001`** linked to new incident **`INC-2081`**, stamped CO-01, and logs it
  under **Recent CCTV Events** as `Pending Desk Officer Triage`. A second attempt on `CAM-GATE-01`
  within 5 min would be blocked by the dedup guard.
- Alternatively, picking **Link to Existing Incident** and searching `INC-2072` attaches the same
  footage as supplementary evidence without creating a duplicate.

### 2. Preserve evidence — CCTV Events & Evidence
The hall camera is offline, but CO-01 already tagged a loitering event from the Surveillance Matrix
earlier in the shift. CO-01 opens **CCTV Events & Evidence** — the management workspace, not a
tagging station.

- In the **CCTV Event Log**, CO-01 finds `CLIP-2026-0002` → `INC-2069` (Suspicious Behavior,
  Chapel Area) and opens **Review Clip** to replay the segment.
- From the **Video DVR & Evidence Clipper**, CO-01 sets the **Bind Target** to `INC-2069` and hits
  **Extract** on an archive minute — it binds as **`EV-CLIP-02`** to that incident file.

### 3. Watch the handoff — still in CCTV Events & Evidence
All escalations sit in the **CCTV Event Log**, the newest at `in_triage`.
- The tracker is strictly read-only: statuses advance only when the Desk Officer works their queue;
  the stepper (`in_triage → dispatched → on_scene → resolved`) reflects it with team + dispatch note.
- Searching `MARKET` or `Purok 6` filters straight to the clip/incident pair.

### 4. Preserve evidence — Video Archives & Playback
The recording for `CAM-GATE-01` around 01:30–02:00 is in the archive. CO-01 filters by date/time/camera,
loads it in the **Playback Station**, scrubs to the lingering group, sets start/end and **Generate
Clip** → a new clip record stamped CO-01 (appended to the archive capacity meter).

- **Redact** masks the subject's face (privacy_blurred = true).
- **Attach to Incident** links the clip to the gate incident and starts the **1-year retention clock**.

### 5. Fulfill a footage request — Footage Requests
The Desk Officer (Maria Santos) files **`FR-1001`** for `INC-2069`: camera `CAM-MARKET-03` on
2026-07-19, 21:30–21:35, tagged Public Disturbance, urgent. CO-01 opens **Footage Requests**, selects
the request, and the search auto-fills with its criteria.

- The market recording `R-2597` surfaces, is loaded into playback (logged `Viewed`), and CO-01 cuts a
  clip around the noise escalation (**Retrieve / Generate Clip** → logged `Generated`, tagged with the
  request + incident).
- CO-01 **Attaches** the clip to `INC-2069` (1-year retention, logged `Attached`), then **Provide
  Footage / Fulfill** — `FR-1001` turns **Fulfilled** and the Desk Officer can review it for incident
  assessment / response / documentation.
- A request whose exact window is unavailable (e.g. `FR-1005`) can be set to **Cannot Fulfill** rather
  than invented.

### 6. Close the loop
- `CAM-HALL-06` stays dark, so CO-01 files **Report Problem** → **`MT-2052`** (Power supply);
  Maintenance/Admin resolves it — no operator action needed after filing.
- The mute toggle (top-right, any screen) silences all alert tones if the control room goes quiet.

> Every artifact created along the way — event, escalation, clip, fault — carries CO-01's
> `operator` stamp, so the full chain reads back to the person who watched it.

---

## Cross-cutting conventions

- All operator screens use the shared UI language: `#0038A8` accent on a light-blue `#E9EDFB` canvas,
  white cards with stone tones, `useToast` notification modal, and `ConfirmModal` for confirmations.
- **Notification modal** — every action resolves into a centered **Notification** dialog
  (`useToast`, `frontend/src/hooks/useToast.tsx`): a colored icon chip keyed to the outcome, a title
  auto-derived from the message (the segment before the ` — ` separator, or `Notification`), the full
  message, a type label, and a thin accent progress bar. The type is inferred from message keywords —
  `success` (confirmed/created/dispatched/generated/…), `warning` (capacity/degraded/near/…),
  `error` (rejected/blocked/failed/overdue/…), else `info`. The modal **auto-dismisses after 6
  seconds** or closes via **Dismiss**, the backdrop, or the **X**; a `flash(msg, { title, type })`
  overload forces an explicit title/type. The toast itself plays no sound of its own (see Alert
  sound).
- **Incident priority policy** — the operator never picks or edits a priority. Newly recorded
  CCTV-Reported incidents are labeled **Initial Priority: Medium** ("Final priority will be
  determined by the Desk Officer during triage"), and existing incidents show their current priority
  only as read-only information set by the Desk Officer. There are no promote/downgrade/assign/
  dispatch controls anywhere in the operator screens, and no automated threat classification — every
  event category is a manual observation label chosen by the operator.
- **Role boundary** — the prototype is a CCTV control/evidence workstation:
  WATCH → TAG → PRESERVE → HANDOFF. The operator sees limited read-only incident information
  (ID, source, category, status, priority, purok, assigned team if any) under the label "Desk Officer
  owns triage, prioritization, assignment, dispatch, and resolution." Storage meters are read-only;
  there is no purge/delete/retention-override control, no camera-maintenance resolution workflow
  (faults are filed, then "Maintenance/Admin will handle resolution."), and no user/camera/IoT/
  patrol/bulletin/resident management anywhere in the operator nav.
- Mock IDs are consistent across screens so artifacts cross-reference cleanly: `CCTV-EVT-XXXX` (matrix
  events), `CLIP-2026-XXXX` + `INC-20xx` (escalations), `EV-CLIP-xx`
  (bound evidence), `ARC-22xx` / `R-26xx` (archive records), `FR-1xxx` (footage
  requests), `MT-205x` (fault tickets), `CAM-*-XX`
  cameras.
- Data is frontend mock state (no live backend calls in these screens); Supabase Storage URLs and
  `cctv_clips` metadata are simulated per the system design in the specs.
- **Operator identity** — each screen takes `operatorName?: string` (default `"CO-01"`), captured at
   login in `App.tsx` and threaded to all operator screens. Tags, events, escalations, extracted
   evidence and fault reports are stamped with the operator so accountability trails the mock records.
- **Alert sound** — all operator screens share `useAlertSound` (`frontend/src/hooks/useAlertSound.ts`,
  Web Audio, no assets) with three tones: `beep("critical")` on accepted tags/escalations, offline
  rejections use `beep("offline")` (descending), and `beep("info")` on duplicate-block notices, clip/
  redact/attach successes. The header **sound toggle** (`SoundToggle`) mutes all tones, persisted to
  `localStorage` key `cctv_alert_muted`.
- **Sec 4.2 dedup guard** — the single tagging path (Surveillance Matrix event tag) blocks a second
  tag on the same camera within 5 minutes, with a toast explaining the dedup window.
- **Retention budget** — the matrix Storage Capacity meter and the Archive Storage Capacity meter both
  budget 2 TB total storage against 1-year retention and flag **NEAR CAPACITY** at 90%; both are
  advisory/read-only for the operator (purge is handled downstream, not from these panels).
