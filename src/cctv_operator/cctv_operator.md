# CCTV Operator — Role Guide

The CCTV Operator's flow is the front door of the surveillance system. They watch live feeds, tag
threats, escalate them, and later mine the archive for evidence. All escalation is handled by the
**Barangay Desk Officer** — the operator observes and prepares, the desk decides and dispatches.

## Navigation (CCTV_OPERATOR_NAV in `components/layout/sidebar.tsx`)

| Order | Sidebar label | Nav key | File |
| --- | --- | --- | --- |
| 1 | Surveillance Matrix | `surveillance` | `surveillance_matrix.tsx` |
| 2 | Manual Threat Flags | `threat_flags` | `manual_threat_flags.tsx` |
| 3 | Escalated Clips & Dispatches | `escalated` | `escalated_clips_dispatches.tsx` |
| 4 | Video Archives & Playback | `archives` | `video_archives_playback.tsx` |

The operator lands on **Surveillance Matrix** by default (`defaultNav` in `App.tsx`).

**Profile and Logout** are not sidebar items — the avatar menu in the shared global `Header`
(`App.tsx`, present on every screen and role) provides logout, so no operator-specific nav entry
exists.

---

## 1. `surveillance_matrix.tsx` — Surveillance Matrix

The main live multi-camera dashboard.

### Process
1. **Grid loads** — a 3×3 grid renders the registered camera list (`INITIAL_CAMERAS`, 9 feeds) with
   their RTSP/HLS URLs. Cameras are simulated with `status` (`online` / `degraded` / `offline`) and a
   fluctuating `signalPct` (updated every 4s).
2. **Monitor** — each cell shows a live-feed placeholder, `LIVE` badge, camera name, quality badge,
   protocol badge (`FFmpeg → HLS` for RTSP-only cameras, `Native HLS` otherwise), and the stream URL.
   In `auto` quality mode a weak signal is marked **Downgraded** and the stream visually degrades.
3. **Reconfigure the view (live)** —
   - **Grid density** (`1×1` / `2×2` / `3×3`): `changeGridSize` resizes the per-cell assignments
     (`resizeCellIds` keeps existing cameras, auto-fills empty slots).
   - **Per-cell camera picker**: the **Configure Feeds** modal (`ConfigureModal`) shows the actual grid
     and assigns a camera (or Empty) to each individual cell via a dropdown. Cells can also be left
     empty (dashed "No camera assigned" slot).
   - **Quality mode**: `auto` / `high` / `medium` / `low`.
   - **Reconnect Streams**: global button simulates a re-fetch of every feed (spinner + per-cell
     `Reconnecting stream...` overlay, then fresh signal values + toast).
   - **Fullscreen**: the expand button on a cell uses the browser Fullscreen API; the cell re-renders a
     rich fullscreen overlay (camera ID, live clock, quality, location, URL, Tag + Exit Fullscreen).
     Clicking the cell body opens the **Stream Focus** detail modal instead.
4. **Tag a threat** — the **Tag** button on any live cell opens `TagModal`:
   - Tag type (required): `Suspicious Behavior` / `Unusual Crowd` / `Road Blockage` / `Other`
   - **Incident priority** (default **Medium**, operator-configurable): `Low` / `Medium` / `High` /
     `Critical`, stamped on the auto-created CCTV-Reported incident
   - Optional free-text notes
5. **Safeguards before the tag is accepted** (`confirmTag`):
   - **5-minute dedup guard**: tagging the same camera within 5 minutes of an existing tag is blocked
     (Sec 4.2 dedup rule) with a toast.
   - **Offline mid-tag guard**: if the camera lost signal at confirm time, the tag is rejected — the
     30s pre-roll would be incomplete, so no clip/incident is created.
   - **Pre-roll integrity flag**: if the camera is degraded (< 50% signal) the clip is still created but
     stamped `preRollIncomplete` and the `RoutingModal` shows an amber integrity warning.
6. **System processes the tag** — on confirm the system:
   - captures timestamp + camera ID + the logged-in **operator identity** (from the `operatorName` prop,
     set at login)
   - generates a **40-second clip (30s pre-roll + 10s post-roll)** written to Supabase Storage, metadata
     to `cctv_clips` (ids like `CLIP-2026-0001`)
   - auto-creates an incident (`INC-xxxx`, source **CCTV-Reported**, priority **Medium by default
     but operator-selected** at tag time (Low/Medium/High/Critical), location derived from the
     camera's registered position, clip attached) and pushes it into the Desk Officer triage queue
   - plays an animated `RoutingModal` (generate → store → create incident → map location → attach clip →
     push to triage), plays a critical alert tone, and finishes with a success dialog showing the clip +
     incident IDs.
7. **Undo / retract** — every tag made this session appears in **Session Tags & Undo**. A tag can be
   **Retract / Undo**-ed (before dispatch) which recalls the incident from Desk Officer triage.
8. **Storage capacity** — the **DVR Storage Capacity** meter shows used GB vs the 2 TB budget; each new
   clip appends to it. Past **90%** it flags **NEAR CAPACITY**; **Purge > Retention** reclaims footage
   beyond the 1-year retention window.
9. **Camera fault reporting** — **Report Fault** opens `FaultModal` (camera, fault type, description) and
   files a maintenance ticket (`MT-xxxx`) to Barangay Admin. Open tickets appear in **Camera Fault &
   Maintenance**; **Mark Resolved & Restore Feed** clears the ticket and brings the camera back online.

### Key models
`CameraFeed` (id, name, location, purok, ip, nativeProtocol, status, signalPct, rtspUrl, hlsUrl) ·
`Escalation` (clip metadata + storageUrl + incidentId + operator + priority + preRollIncomplete) ·
`CameraFault` (ticket, severity, status open/resolved) · `cellIds: (string | null)[]` (per-cell assignment).

---

## 2. `manual_threat_flags.tsx` — Manual Threat Flags

A faster anomaly-flagging tool on a second camera set (gate, hall plaza, alley, market) rendered as SVG
scene mockups (`junction` / `plaza` / `alley` / `market`).

### Process
1. **Live Multi-View Matrix** — four feeds; hit **Flag** on any feed to open `TagModal` (button is
   disabled while that camera already has a pending flag).
2. **Tag an anomaly** — choose a threat category (each with a preset severity):
   - **Nighttime Crowd Gathering** (critical)
   - **Prolonged Loitering** (warning)
   - **Road Blockage** (critical)
   - plus an optional operator note. Timestamp + geocoordinates are auto-captured.
   - A **5-minute dedup guard** blocks re-flagging a camera that was already flagged (Sec 4.2).
3. **Two outcomes**:
   - **Flag Threat** → snapshot + coordinates packaged into a pre-filled report, flag sits as
     `flagged` in the **Dispatch Escalator** (pending), stamped with the operator identity.
   - **Flag & Escalate** → immediately injected as a high-priority ticket (`HQ-xxxx`) into the Desk
     Officer queue (`injected`), shown in the **Desk Officer Queue Injection** panel.
   - Pending flags can be escalated later (per-flag button or the **Escalate Next Flag** shortcut macro).
4. **SLA & aging** — pending flags have a **15-minute SLA** shown as a live countdown (green → amber
   below 5 min → red overdue). When the SLA expires the flag **auto-escalates** into the Desk Officer
   queue with a critical tone + toast.
5. **Retract** — a pending (not yet escalated) flag can be **Retract**-ed with confirmation; it is
   withdrawn from the dispatch queue before escalation (retracted count shown in the panel).
6. **Search** — the search box filters flags and injected tickets by ID, ticket, camera, category,
   note or operator.
7. **Video DVR & Evidence Clipper** — one-minute clips from the DVR archive can be **Extracted** and
   bound as permanent digital attachments to an incident file (`EvidenceClip`, shown under "Bound to
   Incident Files").

### Key models
`ThreatFlag` (id, camId, category, severity, note, time, stage `flagged`/`injected`/`retracted`, ticket,
operator) · `FeedCam` · `ArchiveClip` · `EvidenceClip`.

---

## 3. `video_archives_playback.tsx` — Video Archives & Playback

Search, replay, clip and sanitize recorded footage for evidence use.

### Process
1. **Search the archive** — filter by **date**, **time range**, and **camera** over `RECORDINGS`
   (Archive Index). Matching recordings appear as cards.
2. **Playback Station** — load a recording, then play / pause / seek on the timeline (`REC` badge,
   live clock). 
3. **Create a clip** — scrub the timeline, **Set Clip Start** / **Set Clip End**, then **Generate
   Clip**. This writes an `.mp4` to the `cctv-clips` Supabase Storage bucket, logs a `Clip` record
   (id, camera, start/end, duration, `storage_url`, **operator**), and lists it under **CCTV Clip
   Records**. Clip generation, redaction and incident attachment all play an info tone.
4. **Manual privacy redaction** — **Redact** opens `RedactionModal`: draw masking boxes over **faces**
   and **license plates** (drag on canvas; Face / License Plate mask types, Clear All). Applying marks
   the clip `privacy_blurred = true`. Automated blurring is explicitly out of scope this release
   (Data Privacy Act compliance).
5. **Attach to incident** — **Attach to Incident** opens `AttachModal` listing open incidents; linking
   starts the **1-year retention clock** (`retainedUntil`) and makes the clip reviewable by the Desk
   Officer / Captain.
6. **Retention & review** — attached clips are retained exactly 1 year; unattached clips stay in
   working storage until linked or pruned.
7. **Archive capacity** — the amber **Archive Storage Capacity** meter tracks used GB vs the 2 TB
   budget; **Purge Expired** reclaims footage past the 1-year retention window (flagged as
   **NEAR CAPACITY** past 90%).

### Key models
`Recording` (camera, startISO, duration, sizeMB, events) · `Clip` (start/end, storageUrl,
privacyBlurred, masks, incidentId, attachedAt, retainedUntil, operator) · `Mask` (x, y, w, h, label
`Face`/`License Plate`).

---

## 4. `escalated_clips_dispatches.tsx` — Escalated Clips & Dispatches

Read-only tracker of every tagged clip and the incident it produced. **Triage, prioritization and
dispatch belong to the Desk Officer; the operator only observes.**

### Process
1. **Surveillance Matrix — Live Tag** (left rail): pick a feed camera and tag directly (same
   30s-pre/10s-post clip + CCTV-Reported incident flow as `surveillance_matrix.tsx`).
2. **Escalated Clips → Incidents** (main list): each escalated clip shows clip ID, tag type, camera +
   location, tag time, operator, storage URL, and a **Review Clip** button (`ClipReviewModal`
   with play/pause/seek). Beside it is the linked incident card: ID, source `CCTV-Reported`,
   priority (operator-set at tag time, badge colored `Low`/`Medium`/`High`/`Critical`), category/purok,
   created time, and dispatch status stepper:
   `in_triage → dispatched → on_scene → resolved` (with assigned team + dispatch note when set).
3. **Dispatch feedback loop** — **Sync Desk Officer Dispatch** simulates the Desk Officer advancing the
   oldest active incident one stage (assigns a team on dispatch, timestamps, sets a dispatch note). A
   green **Dispatch feedback received** banner + tone + toast notify the operator, so statuses move in
   real time instead of sitting read-only.
4. **Search** — the search box filters clips by ID, incident ID, camera, tag type, status, team, purok
   or operator.
5. **The Dispatch Boundary** (footer): a visual handoff confirming the pipeline — operator tags →
   system clips → system creates incident/evidence → **Desk Officer** triages and dispatches a Barangay
   Tanod. Statuses sync back read-only from the Desk Officer's queue (simulated by the sync button).

### Key models
`EscalatedClip` (clip + camera + tag metadata + operator) · `IncidentRecord` (source, priority,
category, status, purok, assignedTeam, dispatchTime, dispatchNote) · `DispatchStatus`.

## 5. Worked end-to-end scenario

The four screens are one pipeline: **watch → tag → escalate → dispatch → preserve**. Here is the
journey a single incident takes through the operator's flow.

### 1. Watch & tag — Surveillance Matrix
Operator **CO-01** lands on the 3×3 grid. At **Main Gate** (`CAM-GATE-01`, Purok 1) a group lingers
near the entrance at 01:40 AM.

- Opens the cell's **Tag** → `TagModal`, selects **Suspicious Behavior**, keeps priority **Medium**
  (the default), adds a note, confirms.
- Dedup guard passes (no tag on `CAM-GATE-01` in the last 5 min); the camera is online so the offline
  guard passes too.
- `confirmTag` stamps the tag with CO-01, generates **`CLIP-2026-0001`** (30s pre-roll + 10s post-roll),
  auto-creates **`INC-2026-0001`** (CCTV-Reported, Medium, Purok 1) with the clip attached, plays the
  `RoutingModal` + critical tone, and pushes the incident into Desk Officer triage.
- The tag now sits in **Session Tags & Undo**. A second attempt on `CAM-GATE-01` within 5 min is blocked
  by the dedup guard.

### 2. Flag a faster catch — Manual Threat Flags
The hall camera (`CAM-HALL-06`) is offline, so CO-01 switches to the second camera set. On **Alley**
(`ALY-07`) someone lingers near the dark entrance.

- **Flag Threat** → pending **`FLG-1183`** (Prolonged Loitering, warning) in the **Dispatch Escalator**,
  stamped CO-01. The **15-minute SLA countdown** starts ticking.
- CO-01 spots the SLA risk and hits **Flag & Escalate** instead → **`HQ-4092`** ticket injected straight
  into the Desk Officer queue (`injected`).
- A later pending flag could be **Retract**-ed (with confirmation) if it was a false alarm, or left to
  **auto-escalate** when its SLA expires (critical tone + toast).

### 3. Watch the handoff — Escalated Clips & Dispatches
Back on the matrix feed, CO-01 opens **Escalated Clips & Dispatches**. Both `CLIP-2026-0001` →
`INC-2026-0001` and `HQ-4092` are listed with dispatch status `in_triage`.

- CO-01 hits **Sync Desk Officer Dispatch**: the oldest active incident advances one stage
  (assigns a Barangay Tanod team + dispatch note on `dispatched`), shows the green **Dispatch feedback
  received** banner + info tone + toast.
- Searching `GATE` or `Purok 1` filters straight to the incident.

### 4. Preserve evidence — Video Archives & Playback
The recording for `CAM-GATE-01` at 01:30–02:00 is in the archive. CO-01 filters by date/time/camera,
loads it in the **Playback Station**, scrubs to the lingering group, and **Generate Clip** →
**`CLIP-2026-0009`** (stamped CO-01, appended to the archive capacity meter).

- **Redact** masks the subject's face (privacy_blurred = true).
- **Attach to Incident** links the clip to `INC-2026-0001` and starts the **1-year retention clock**.
- Archive now above 90%? **Purge Expired** reclaims footage past retention.

### 5. Close the loop
- `CAM-HALL-06` stays dark, so CO-01 files **Report Fault** → **`MT-2052`** (Power supply) to Barangay
  Admin; **Mark Resolved & Restore Feed** brings it back online.
- The mute toggle (top-right, any screen) silences all alert tones if the control room goes quiet.

> Every artifact created along the way — tag, clip, incident, ticket, fault — carries CO-01's
> `operator` stamp, so the full chain reads back to the person who watched it.

---

## Cross-cutting conventions

- All four screens use the shared UI language: `#6b1530` accent, cream `#f4f1ea` background, stone
  tones, `useToast` notification modal, and `ConfirmModal` for confirmations.
- **Notification modal** — every action resolves into a centered **Notification** dialog
  (`useToast`, `frontend/src/hooks/useToast.tsx`): a colored icon chip keyed to the outcome, a title
  auto-derived from the message (the segment before the ` — ` separator, or `Notification`), the full
  message, a type label, and a thin accent progress bar. The type is inferred from message keywords —
  `success` (confirmed/created/dispatched/generated/…), `warning` (capacity/degraded/near/…),
  `error` (rejected/blocked/failed/overdue/…), else `info`. The modal **auto-dismisses after 6
  seconds** or closes via **Dismiss**, the backdrop, or the **X**; a `flash(msg, { title, type })`
  overload forces an explicit title/type. The toast itself plays no sound of its own (see Alert
  sound).
- **Incident priority** — both tag flows share `INCIDENT_PRIORITIES` / `PRIORITY_META` from
  `constants/severity.ts` (`Low` / `Medium` / `High` / `Critical`, default **Medium**). The operator
  picks it in `TagModal`, it is stamped on the auto-created CCTV-Reported incident, and it renders as a
  severity-colored badge in the Escalated Clips list.
- Camera/incident/clip IDs are mock-consistent across screens (`CLIP-2026-XXXX`, `INC-XXXX`,
  `CAM-*-XX`), so escalation created in the Matrix shows up in Escalated Clips.
- Data is frontend mock state (no live backend calls in these screens); Supabase Storage URLs and
  `cctv_clips` metadata are simulated per the system design in the specs.
- **Operator identity** — each screen takes `operatorName?: string` (default `"CO-01"`), captured at
  login in `App.tsx` and threaded to all four screens. Tags, escalations, clips, retracts and fault
  reports are stamped with the operator so accountability trails the mock records.
- **Alert sound** — all four screens share `useAlertSound` (`frontend/src/hooks/useAlertSound.ts`, Web
  Audio, no assets). `beep("critical")` fires on SLA auto-escalation, offline tag rejection and fault
  auto-creation; `beep("info")` on successful tag/clip/redact/sync/retract. The header **sound toggle**
  (`SoundToggle`) mutes all tones, persisted to `localStorage` key `cctv_alert_muted`.
- **Sec 4.2 dedup guard** — both tagging paths (matrix tag, manual flag) block a second tag on the same
  camera within 5 minutes, with a toast explaining the dedup rule.
- **Retention budget** — the matrix DVR meter and the archive capacity meter both budget 2 TB total
  storage and flag **NEAR CAPACITY** at 90%; both offer a purge action for footage past retention.
