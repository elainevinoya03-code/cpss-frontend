# Admin — Role Guide

The **System Admin** (a.k.a. Barangay Admin) is the platform operator and root configuration holder
for the Barangay's Public Safety and Security System. They do not run patrols, triage incidents, or
blast broadcasts — those belong to the **Captain**, **Desk Officer**, **CCTV Operator**, and **Purok
Leader**. Instead they administer the *infrastructure*: user accounts and access roles, the IoT
hardware fleet, the CCTV camera fleet and patrol routes, geofenced digital boundaries, Purok
coordination rules, data-privacy requests, the retention and backup posture, the immutable audit
trail, and every platform-wide integration, threshold, feature flag, and preference. Everything
below sits under one role, `admin`, guarded by
`ADMIN_NAV` in `App.tsx` / `components/layout/sidebar.tsx`. Any username that does not map to another
role routes here, making Admin the fallback role.

## Navigation (ADMIN_NAV in `App.tsx` / `components/layout/sidebar.tsx`)

| Order | Sidebar label | Nav key | File |
| --- | --- | --- | --- |
| 1 | Dashboard | `dashboard` | `dashboard.tsx` |
| 2 | User Management | `users` | `user_management.tsx` |
| 3 | IoT Provisioning | `iot` | `iot_provisioning.tsx` |
| 4 | CCTV Placement | `cctv` | `cctv_placement.tsx` |
| 5 | Digital Boundaries | `boundaries` | `digital_boundaries.tsx` |
| 6 | Patrol Routes | `patrol` | `patrol_configuration.tsx` |
| 7 | Audit Logs | `logs` | `system_logs.tsx` |
| 8 | Data Requests | `data_requests` | `data_requests.tsx` |
| 9 | System Settings | `settings` | `system_settings.tsx` |

The admin lands on **Dashboard** by default (`defaultNav` in `App.tsx`). Login routing in `App.tsx`
maps every unrecognized username to the `admin` role (`handleLogin`, the `else` branch). **Profile and
Logout** live in the shared global `Header`, not the sidebar. The admin's sidebar section is labeled
**NAVIGATION**; the Header shows the initials **BA**, label **System Admin**, and sublabel **Barangay
Admin**. The session (page, role, active nav, operator name) is persisted to `localStorage` under the
key `bgyauth` and restored on reload.

---

## 1. `dashboard.tsx` — Dashboard Overview

System health and real-time device monitoring — the admin's daily landing page. This is the
single Administrative Health Dashboard: platform infrastructure health (database, background jobs,
storage, notification providers), fleet status (IoT + CCTV), public-safety operational metrics, and
a consolidated alert / error / maintenance view.

### KPI stat cards (rows 1 + 2)
- **TOTAL ACTIVE USERS** — `6` active of `7` total accounts; click navigates to **User Management**.
- **DEPLOYED IOT DEVICES** — `7` deployed, `4` online · `1` warning · `1` offline · `1` possible
  tamper (sums to 7, matching the device table); click navigates to **IoT Provisioning**.
- **CAMERA AVAILABILITY** — `12` placed, `10` online · `1` offline · `1` pending; click navigates
  to **CCTV Placement**.
- **SYSTEM UPTIME** — `99.2%` (last 30 days average); click navigates to **System Settings**.
- **ACTIVE ALERTS** — total open alerts (default `9`, split `4 critical · 3 high · 1 warning ·
  1 informational`); the card is clickable and toggles the alert panel.
- **API REQUESTS (24H)** — `48.2k` (`▲ 12%` vs. yesterday); click navigates to **Audit Logs**.
- **AVG API RESPONSE** — `184ms` with `p95 410ms · target ≤ 500ms`; click navigates to **System
  Settings**.
- **API ERROR RATE** — `0.42%` against a `1%` threshold; click navigates to **Audit Logs**.
- All clickable KPI cards show a hover highlight, tooltip, and a corner arrow affordance.

### Active Alerts banner
- Collapsible banner shown whenever alerts exist; its border tone follows the **top severity**
  present (rose critical → orange high → amber warning → sky informational). The summary line
  reports all four levels, e.g. `4 critical · 3 high · 1 warning · 1 informational`.
- Each alert lists a **severity badge** (Critical / High / Warning / Informational), an
  **escalation-routing chip** (e.g. `Desk Officer → Captain`, `CCTV Operator → Admin`), the reason
  and time, and scope-appropriate actions:
  - **IoT alerts** (`SM-PUROK3-01` offline, `DB-HALL-01` low battery, `SM-KIOSK-01` tamper):
    - **Ping** — simulated heartbeat probe, confirmed with a **Ping Complete** modal (240 ms
      latency for the offline node).
    - **Dispatch** — opens the **Dispatch Field Maintenance** modal (see below).
  - **Operational / security / CCTV / provider alerts** (failed SOS notification, repeated failed
    logins, camera outage, SMS rate limit, authentication-service failure, audit-log failure) —
    **Details** opens a modal with the full reason, category, detection time, source IP where
    relevant, and the **§14.12 escalation routing** explanation.
- Seed alerts cover all four severities and the Section 14.11 classes: smoke sensor offline,
  low battery, **failed SOS notification** (→ Desk Officer → Captain), **possible tamper**,
  **repeated failed logins** (with source IP), **camera outage** (→ CCTV Operator → Admin),
  **authentication-service failure**, **audit-log failure** (both critical, → Admin), and
  an informational **SMS rate-limit** notice.

### System Health & Infrastructure
A four-column panel (with **Open System Settings** shortcut) covering the Administrative Health
Dashboard infrastructure requirements:
- **Database Connection** — status badge (**Connected**), connection-pool utilization meter
  (`42%`), active/max connections (`7 / 50`), and latency (`12ms`).
- **Background Jobs** — per-job status for **SLA Monitoring**, **Notification Dispatch**
  (**Running**, pulsing dot), **Retention Processing**, and **Backup Verification** (**Healthy**),
  each with its last-run time (14.10).
- **Object Storage** — overall utilized-vs-total (`1,730 / 2,750 GB`, `63%`) with a
  **warning-threshold marker** driven by the shared `utils/cctvStorage.ts` store (live-synced with
  CCTV Placement and System Settings → Data Retention); a **Within threshold** / **Capacity
  warning** badge, plus per-volume rows for CCTV Clip Footage, IoT Telemetry, Audit Trail, and
  Incident & Evidence (3.2.3 / 6.2.13 / 12.6).
- **Notification Providers** — **SMS Gateway (Twilio)** and **Push Notifications (FCM / Web Push)**
  with **Operational** / **Degraded** badges, queue depth, 24h failure counts, and last-send time
  (14.9).

### Public Safety Metrics (system-health panel)
- **Incident Rate** — `12.4` incidents per 1,000 residents this month, with a green `8.2%` down
  badge vs. last month.
- **Average Response Time** — `8.3` minutes with an **On Target** badge against the `≤ 10`-minute
  target and an `83%` meter bar.
- **Incidents Resolved** — `96.8%` closed this month, shown with a `96.8%` completion meter and a
  green badge.
- A **last-7-days incidents-by-day** bar chart renders alongside the KPI blocks: color-coded bars
  (blue < 5, amber 5–6, rose 7+), per-day value labels, a dashed **daily average 4.4** reference
  line, and a summary footer (`31` incidents · peak **Wed** · avg 4.4/day).
- **Backup & Disaster Recovery** — a status row in the same health panel: a **Backup Status** badge
  (**Healthy** / Overdue / Failed), the **last successful backup** timestamp (`2026-07-20 02:00`,
  nightly full backup verified on completion), the **last restoration test** date and result
  (`2026-06-28 · Success`, restore verified end-to-end, next monthly test due late July 2026), and
  **Coverage** (all retention categories — user directory, IoT/CCTV config, audit trail, and
  incident/evidence records subject to retention). This is a read-only operational view; backup
  schedule and retention windows are configured under System Settings → Data Retention.

### IoT System Health Monitor (table)
- Real-time status of all deployed nodes: **DEVICE NAME**, **TYPE**, **STATUS** (online /
  warning / offline / **possible tamper** — violet badge — with colored dot + badge), **BATTERY**
  (color-coded meter bar), **UPTIME**, **LAST PING**, **COORDINATES**, **ACTIONS**.
- The **coordinates** button jumps to the **Digital Boundaries** map (`onNavigate("boundaries")`).
- Per-row actions:
  - **Ping / Force Reconnect** (spinner while pinging, ~1.5 s).
  - **Logs** — opens the **Telemetry Stream** modal with simulated MQTT payload lines
    (`MQTT CONNECT`, `SUB sensors/.../telemetry`, `{"temp":…,"smoke_ppm":…,"battery":…}`, `PING OK
    rssi=…`), annotated *"live in production via WebSocket broker"*, with a shortcut to **Adjust
    Thresholds**.
  - **Report** — opens the same **Dispatch Field Maintenance** modal for the device.
- Header actions: **Thresholds** (→ System Settings) and **Refresh**.

### CCTV Fleet Availability (right rail)
- Compact camera health panel: header counts **`12` placed · `10` online · `1` offline ·
  `1` pending**, a scrollable camera list with status dot + pill, location / purok, last-seen, and a
  **coordinates** link that jumps to the **Digital Boundaries** map (cameras carry `location_geom`
  in the data model). **Manage** jumps to **CCTV Placement** (`onNavigate("cctv")`). A footer note
  states that offline cameras route to **CCTV Operator → Admin** per §14.12.

### System Errors (left rail)
- A dedicated infrastructure-fault feed **distinct from user-audit events**: each row shows a
  severity dot (error / warning / info), the fault message, the source worker/component in mono
  (e.g. `notification-worker`, `api-gateway`, `camera-stream`, `auth-service`, `audit-writer`,
  `retention-worker`), and a timestamp. **View All** jumps to the Audit Logs screen.
- **Routing rule (which feed gets what):** **System Errors** carries *infrastructure faults with no
  actor* — a service or worker failing (5xx spikes, stream drops, queue stalls, auth outages,
  audit-writer stalls). **Audit Logs** carries *actions tied to an operator* — including actions
  that *failed* (a rejected configuration change, a failed delete), which are logged with the
  responsible admin, action type, description, and IP. If an infra fault is actionable by an
  operator (e.g. an audit-writer failure requiring intervention), it additionally surfaces as an
  alert in the banner, but the underlying fault row lives only in System Errors.

### Open Maintenance Tickets (center rail)
- Aggregated view of pending field-maintenance work (previously only surfaced per-device through
  the Dispatch modal). Each ticket lists the device, maintenance type, priority chip
  (critical / urgent / routine), assigned team, and open date, with a **`N open`** counter.
  - **Update** — opens the **Dispatch Field Maintenance** modal pre-filled for that device.
  - **Resolve** — marks the ticket resolved, writes a **Maintenance Resolved** audit entry, and
    confirms with a modal.

### Recent Audit Logs (right rail)
- Latest system events with colored type dots (`alert` / `error` / `config` / `login`) and
  timestamps; **View All** jumps to the Audit Logs screen. An `error` dot here marks a *failed
  user/system action* attributed to an operator, not an infrastructure fault (see the routing rule
  under **System Errors**).

### Deliberate scope boundary
- **Unprocessed high-priority incidents and per-role SLA breaches are not shown here.** They are
  operational-triage concerns that belong to the **Desk Officer** dashboard (14.5) and its SLA /
  incident queues, and to the **Captain's** escalation view — the Admin's health dashboard stops at
  infrastructure, fleet, and aggregate public-safety metrics. Their absence is intentional, not an
  oversight.

### Dispatch Field Maintenance (shared modal)
- Reached from IoT alerts, the device table's **Report** action, or a maintenance ticket's
  **Update**: **Maintenance Type** (Battery Replacement / Offline-Reconnect / Sensor Calibration /
  Hardware Inspection / Firmware Update / Other), **Priority** (Routine / Urgent / Critical),
  **Assigned Team** (Field Tech — Team A / Team B, IoT Maintenance Unit, Barangay Facilities,
  External Contractor), and optional **Notes**. Submitting confirms with a **Dispatch Confirmed**
  modal and writes a **Dispatch Created** audit entry.

---

## 2. `user_management.tsx` — User Account Management

Manage personnel accounts and access roles for the whole platform.

### User Directory header
- Title with an **`x active · y deactivated`** summary, a **search** box (name, email, role, phone,
  purok), and a **Create New User** button.

### Filter chips (with live counts)
- **All** / **Captain** / **Desk Officer** / **CCTV Operator** / **Tanod** / **Purok Leader** /
  **Active** / **Deactivated**.

### User table
- **User** (initials avatar, name, email), **Role** (color-coded badge), **Purok / Zone**,
  **Contact**, **Status** (Active / Deactivated pill), **2FA** (per-account two-factor status),
  **Last Login**, **Actions**:
  - **Edit** — opens the update modal.
  - **Reset** — sends a password-reset link to the user's email (audited, confirmed modal).
  - **2FA** — shown only for privileged accounts in a **Pending** 2FA state; re-sends the
    two-factor enrollment invitation.
  - **Disable / Enable** — toggles `active`; disabling a user keeps their record but blocks access.
- **2FA status indicator** — privileged roles (Admin / Captain / Desk Officer) show a per-row badge:
  **Enabled** (emerald, guarded by `ShieldCheck`) or **Pending** (amber, guarded by `Clock`).
  Non-privileged roles show a dash — 2FA is optional for them. A privileged account in the Pending
  state renders **"2FA Setup Required"** alongside its status pill and cannot complete as **Active**
  until the invited user finishes enrollment.
- **Pagination** at 5 rows per page when the filtered list exceeds the page size.

### Create / Edit modal
- Fields: **Full Name**, **Email Address**, **Contact Number**, **System Role** (Captain, Desk
  Officer, CCTV Operator, Tanod, Purok Leader).
- **Assigned Purok / Zone** appears only for **Tanod** (patrol zone) and **Purok Leader** (report
  feed zone), sourced from `PUROK_OPTIONS`.
- **2FA policy notice** — picking **Captain** or **Desk Officer** shows an amber notice that two-factor
  authentication is **mandatory per policy** for that role; on create the account is minted in a
  **Pending 2FA** state (writes a `Configuration Change` entry) and cannot become **Active** until
  enrollment completes. The confirmation modal reads **"User Created — 2FA Pending"**.
- On create, an **AUTHENTICATION** option: *Send email invitation to set password* (checked) or, if
  unchecked, a temporary password is generated and shown on creation.
- Every create / edit writes an audit entry and resolves in a **User Created** / **User Updated**
  success modal; edits describe the changed fields (role, purok, name, email, contact).

### Audit trail
- Actions push to the shared audit store via `pushAuditLog`: **User Created**, **User Updated**,
  **User Deactivation** (activate/deactivate), **Password Reset**, and **Configuration Change** for
  every 2FA-policy event (privileged account created with enrollment pending, enrollment invitation
  re-sent).

---

## 3. `iot_provisioning.tsx` — IoT Hardware Provisioning

Register devices, monitor health, and configure sensor thresholds for the field-deployed fleet.

### Device Registration
- Registration is a **five-section form** — fields carry **Required / Optional / Auto-generated /
  Read-only** tags and validate inline — that provisions a new ESP32 node:
  1. **Device Identification** — hardware identity of the physical node:
     - **Hardware Type** — Smoke Sensor, Decibel Meter (§5.2).
     - **Sensor Module** — auto-matched from the type: **MQ-2** smoke sensor, **KY-037** decibel
       meter.
     - **Controller / Development Board** — fixed to **ESP32-WROOM** (§5.2).
     - **Device Name / Label** — e.g. `Smoke Sensor — Purok 1 Gate` (required).
     - **Device ID** — auto-generated from the hardware type + purok (e.g. `SM-P1-42`, `DB-P3-07`)
       and regenerated (via **Regenerate**) whenever either changes. Editable **only during
       registration** — once the device is registered the ID is immutable because telemetry,
       SecurityAlert, and audit records key off it (§10.6.2 / §10.6.3). Format
       `[A-Z]{2}-(P[1-9]|MAIN|EVA)-\d{2}`; duplicate IDs are rejected.
     - **Serial Number** — the physical ESP32 identifier (e.g. `ESP32-SN-0042`), required, unique,
       and must differ from the Device ID.
     - **MAC Address** — required network identifier, unique, expected under the Espressif OUI
       prefix `A4:CF:12` (e.g. `A4:CF:12:00:00:00`). **Simulate MAC** generates a simulated
       hardware MAC for prototyping; the real MAC is read off the physical device in production.
  2. **Deployment Location** — where the node is installed within the single-barangay deployment:
     - **Barangay** — fixed to **Culiat** (barangay_id is a required model field, §10.6.1).
     - **Purok / Location Zone** — required, from `PUROK_OPTIONS`.
     - **Installation Location / Landmark** — required, e.g. `Near Barangay Hall Main Entrance`.
     - **Coordinates** (lat/lng) — typed directly or picked with **Click-to-Pin**, which arms the
       map for a single click and backfills the coordinates; the pin disarms after one click and
       re-arms on request.
  3. **Installation Information** — **Installation Date** (defaults to today, editable for
     retroactive registration), **Installed By / Responsible Personnel** (also becomes the initial
     maintenance person responsible), **Power Source** (Battery, USB / External Adapter), and
     **Firmware Version** (e.g. `v2.4.1`).
  4. **Connectivity & Sensor Information** — **Connectivity Type** fixed to **Wi-Fi** (MQTT /
     WebSocket, §5.2); **Network Profile** is a *reference only* (e.g. `Culiat IoT — 2.4 GHz`) —
     **Wi-Fi credentials are managed elsewhere and never captured in this form or the audit
     trail**; **Calibration Status** (`Not Calibrated` / `Calibrated`) with **Calibration Date**
     required when marked calibrated, plus a free-text **Calibration Note** (MQ-2 and KY-037
     readings use the relative 0–100 scale, not standardized ppm/dB, §5.5.1 / §5.5.2).
   5. **Registration Summary** — a live preview of the complete record (name, ID, type, module,
      controller, serial, MAC, barangay, purok, location, coordinates, firmware) with the **Pending**
      initial-status pill, a **Not Provisioned** credential-status pill, and a note that a passing
      connection test is required to go **Active** (§9.12).
- **Register Device** validates the whole form (inline error messages; a failing attempt shows a
  **Registration Incomplete** modal), creates the node in a **Pending** status — a newly registered
  device is *not* randomly healthy (§9.12 / §13.7) — initializes its maintenance record
  (`installedAt` from the install date, `inspector` from Installed By, `lastInspection` /
  `lastTested` as `—`, no faults), and confirms with a **Device Registered** modal summarizing the
  record, plus an audit entry naming the device (name, ID, type, module, serial, MAC, barangay,
  purok, coordinates, location, firmware) with initial status **Pending** and credential status
  **Not Provisioned** — registration does **not** create or assign a credential; one must be
  provisioned explicitly before a connection test can pass. The form resets afterwards.

### Device Map
- Geographic placement of all enabled nodes as color-coded `MapPin` markers with a status dot; legend
  for **Online**, **Low Battery** (derived), **Possible Tamper**, **Pending**, and **Offline**, plus
  an **`N` active** counter. **Low Battery is a derived indicator from battery voltage, not a stored
  status value** — the stored enum is `pending / online / offline / possible_tamper` (plus the
  derived Disabled power state).

### Device Inventory (table)
- Columns: status pill, device ID, type, purok, battery meter, signal meter, last ping,
  **Credential Status**, and actions:
  - **Edit** — type, purok, firmware version, coordinates, the **Maintenance Records** block (see
    **Device Maintenance Records**), and an optional **Custom Threshold Override** (device-specific
    relative smoke / noise thresholds and persistence durations instead of the global defaults). The
    **Device ID is shown read-only and immutable** after registration.
  - **View (info icon)** — opens the **Device Details** modal: the full device overview (operational
    status, type, barangay, purok, firmware, MAC, coordinates, battery/signal, calibration note, last
    ping, power state, **credential status + masked credential**) with the **Maintenance Records**
    below it, read-only.
  - **Provision (key icon)** — shown for devices with **Credential Status: Not Provisioned** or
    **Revoked** (revoked-recovery path); generates a unique credential. See **Device Credential
    Lifecycle**.
  - **Rotate (refresh icon)** — rotates the enrollment credential for devices that already have one
    (Active / Expired); see **Device Credential Lifecycle**.
  - **Revoke (shield-x icon)** — revokes the enrollment credential; see **Device Credential
    Lifecycle**. Hidden for Not Provisioned devices (nothing to revoke) and revoked devices.
  - **Power** — enable/disable the device (disabled rows render dimmed and drop off the map); both
    transitions write distinct **Device Enabled** / **Device Disabled** audit entries (§12.14).
  - **Tamper flag (shield-alert icon)** — flags the device as **Possible Tamper** (§6.5.15), and
    **Tamper clear (shield-check icon)** restores it to Active after inspection; see **Possible
    Tamper** below.
  - **Decommission (archive icon)** — gated by a **Confirm Decommission** dialog: the node is
    disabled and dropped from the map, but the record and its operational history are **retained for
    the audit trail — never destroyed** (§10.1).
- **Credential Status column** — a per-device badge with the **Active / Revoked / Expired / Not
  Provisioned** status (`KeyRound` icon; emerald / rose / amber / stone), tooltipped: revoked devices
  "cannot authenticate until a new credential is provisioned", expired devices "rotate to restore",
  Not Provisioned devices "registration did not create one".

### Possible Tamper (§6.5.15)
- A distinct violet **Possible Tamper** status (the node may still transmit — it is *not* Offline),
  reachable from a documented trigger: unexpected transmission stop with no low-power explanation,
  a location change, repeated disconnects after inspection, or a manual admin flag.
- **Flagging** is gated by a modal that captures the detection/flag reason (and optional notes),
  moves the node to `possible_tamper`, **raises an administrative alert on the Admin dashboard**
  (§14.7), and writes a **Device Tamper Flagged** audit entry. **Clearing** after inspection restores
  the node to Active and writes a **Device Tamper Cleared** audit entry.

### Device Credential Lifecycle (Provision · Rotate · Revoke)
- **Registration does not create or assign a credential.** A newly registered device is **Pending**
  with **Credential Status: Not Provisioned** (stone badge). Credentials are only recorded through
  an explicit, audited admin action. Each credential is **generated by the system** as a unique
  enrollment credential (e.g. `F8K2-91MX-7PQL-4J21`) and **stored masked** (e.g. `••••-••••-••••-4J21`)
  server-side only, shown masked everywhere in the UI, and never written to the audit trail.
- **Simulated provisioning note:** this deployment has **no real backend credential-generation
  mechanism yet**, so credential generation is a **simulated provisioning operation** for the
  prototype. It never claims that the physical ESP32 automatically received the credential — the
  device must be set up with the generated credential through the real provisioning process and then
  verified with the **Device Connection Test**.
- **Provision Credential** (key icon) — shown for **Not Provisioned** devices (initial enrollment)
  and **Revoked** devices (revoked-recovery path); available when the device is registered and not
  decommissioned. The **Provision Device Credential?** modal restates the device and its credential
  status, explains that registration captured only device information, and states that a **new unique
  credential will be generated and associated with the device** — confirmation is **[Cancel] /
  [Provision Credential]** (no manual entry needed). On success a **Provisioning…** overlay generates
  the credential and a **Credential Provisioned** modal shows the device, **Credential Status ●
  Active**, the masked credential, and Source: *Generated (simulated provisioning)*. Writes a
  **Credential Provisioned** audit entry (Device ID, previous status → new status: active, result:
  Successful) — never the full credential.
- **Rotate Credential** (refresh icon) — rotates the enrollment credential for a device that already
  has an active one (Active / Expired); disabled for decommissioned devices. The **Rotate Device
  Credential?** modal shows the device and its **current masked credential**, explains that the
  current credential will be invalidated and a **new unique credential generated**, and confirms with
  **[Cancel] / [Rotate Credential]**. The flow:
  1. **Rotating… overlay** (~1 s) steps through *Invalidating old credential*, *Generating new
     enrollment credential*, *Updating device credential status*; duplicate operations are blocked
     while processing.
  2. **Credentials Rotated modal** shows the device, **Credential Status ● Active**, the previous
     masked credential (Invalidated), and the new masked credential, plus a note that rotating does
     *not* automatically update the physical ESP32 — the device must use the new credential to
     reconnect (§ see **Device Connection Test** below). Writes a **Credential Rotated** audit entry
     recording the Device ID, previous status → new status: active, and result: Successful — never
     the full credential.
- **Rotation never changes operational status** — an Online / Pending / Offline / Possible Tamper
  device keeps that status; a rotated credential is *not* proof the physical ESP32 has reconnected.
  Rotation also does not clear a **Possible Tamper** flag. A simulated failure state is supported: a
  **Credential Rotation Failed** modal offers **[Close] / [Try Again]** (Try Again reopens the Rotate
  modal); on failure the old credential is not invalidated, no new credential is generated, statuses
  are unchanged, and no successful audit entry is written.
- **Revoke Credential** (shield-x icon) — gated by a **Revoke Device Credential?** modal showing the
  device and its **current masked credential**, noting this is *distinct from powering the device
  off*: the device is **blocked from authenticating even if re-enabled** until a new credential is
  provisioned. Immediately flips the badge to **Revoked**, and the **Device Connection Test** returns
  a blocked-result notice. Writes a **Credential Revoked** audit entry (previous status → revoked,
  result: Successful). A **Revoked** device recovers through **Provision Credential** (old credential
  stays invalid, a new credential is generated, badge returns to **Active**; power state is
  untouched). Hidden for Not Provisioned devices (nothing to revoke).
- **Enable after revoke** — powering a revoked device back on lands on a **"Device Enabled —
  Credentials Blocked"** modal: powered on, but it cannot reconnect until a new credential is
  provisioned.

### Device Maintenance Records
- Every device carries a maintenance history synchronized with the connection-test flow. The records
  are edited in the **Edit Device** modal's **Maintenance Records** block and are visible read-only in
  the **Device Details** modal (info icon in the inventory):
  - **Installation Date** — stamped with today's date at registration, editable afterward.
  - **Last Inspection Date** — manual inspection tracking, e.g. `2026-06-20`.
  - **Last Connectivity Test** — read-only; auto-filled from the most recent **Device Connection
    Test** result (a timestamp is written every time the test runs).
  - **Person Responsible for Inspection** — free text, e.g. `Field Tech — Team A`; initialized at
    registration from the form's **Installed By** value.
  - **Reported Faults / Replacements** — free text describing field issues and hardware swaps, e.g.
    `Microphone element replaced 2026-03`.
- Saving the edit form writes the **Device Updated** audit entry listing which maintenance fields
  changed (installation date, last inspection, inspector, reported faults/replacements).

### Device Connection Test
- Pick any enabled device and **Test Connection** — a ~1.5 s **full acceptance check** (§5.10) that
  verifies, per check: **Credential Authentication**, **MQTT/WebSocket reachability** (latency +
  RSSI), **telemetry payload format** (schema-valid payload), **threshold-event generation** (alert
  emitted on a breach), and **backend storage write** (telemetry persisted). The result renders a
  per-check pass/fail checklist; a failed check explains the cause (revoked credentials block the
  run, Not Provisioned devices have no credential to authenticate with, offline devices time out).
- **Credential Authentication** ties into the credential lifecycle:
  - **Not Provisioned** — a device registered without a credential fails this check with the notice
    that a valid credential must be **provisioned** before the acceptance test can run; the device
    stays **Pending**.
  - **After Rotate** — the physical ESP32 is *not yet* using the new secret, so this check fails
    with the notice that the previous enrollment credential has been invalidated and the device must
    be updated. A **"Mark ESP32 updated with new credential"** toggle appears in the panel for such
    devices — once the device is marked as holding the new credential, re-running the test verifies
    reconnection and the device passes the full acceptance check.
- A device **must pass** the acceptance check before it can be **Active** (§9.12): a **Pending**
  row that passes is promoted to `online` (Active); a failed run leaves it Pending. Every run stamps
  the device's **Last Connectivity Test** and writes a **Device Connectivity Test** audit entry noting
  the pass/fail and the resulting state.

### Threshold Configuration Panel
- Thresholds are on a **relative 0–100 sensor-value scale** — the smoke sensor and decibel meter are
  **uncalibrated**, so readings are explicitly *not* presented as calibrated ppm concentrations or
  standardized dB values (§5.5.1 / §5.5.2).
- Sliders for **Smoke Sensor Threshold (relative)** and **Noise Level Threshold (relative)** with a
  live status verdict (recommended operating band 50–80).
- **Persistence duration** (§5.6, `smoke_persistence_seconds` / `noise_persistence_seconds`): a
  sustained-reading window is required before an alert fires — **Smoke 30s** and **Noise 10s**
  defaults, configurable.
- **Documented testing justification** (§5.9) is **required** before **Apply Thresholds** commits: a
  free-text field captures the authorized test reference and is written verbatim into the
  **Configuration Change** audit entry. The Apply button is disabled until a justification is entered.
- **Revert to Defaults** restores 50 / 50 relative + 30s / 10s persistence and is audited as a
  **Configuration Change** (restoration, not an adjustment).

### Audit trail
- **Device Registration** (full record — name, ID, type, module, serial, MAC, barangay, purok,
  coordinates, location, firmware — with status Pending noted), **Geofence Update** (map pin),
  **Device Updated** (incl. what changed), **Device Connectivity Test** (acceptance pass/fail +
  resulting state),
  **Device Disabled** / **Device Enabled** (§12.14), **Device Decommissioned** (record retained),
  **Device Tamper Flagged** / **Device Tamper Cleared**, **Configuration Change** (threshold
  applies/reverts, incl. justification), **Credential Provisioned**, **Credential Rotated**,
  **Credential Revoked**.

---

## 4. `cctv_placement.tsx` — CCTV Placement & Assignment

Assign CCTV cameras to mapped locations and configure camera hardware — the Admin's configuration
side of the surveillance mesh that the **CCTV Operator** operates and the **Captain** reviews.

### Camera Registration
- **Camera ID** (required, e.g. `CAM-PUROK5-01`), **Display Name / Location Label**, **Purok /
  Location Zone**, and **Assign to Mapped Location** (a boundary from the Digital Boundaries
  vocabulary), **Resolution** (`1080p` / `4K` / `2K` / `720p`), and **Placement Coordinates** —
  typed or picked with **Click-to-Pin** on the placement map.
- **Camera Access Credentials** — an optional masked **username + password/token** pair captured at
  registration in a `KeyRound`-headed blue card: the username is a plain service-account handle and
  the token is a masked input with a show/hide toggle. Credentials are stored **server-side only**
  and never rendered in plaintext outside that masked field (see **Camera Access Credentials**).
- Registering validates uniqueness, assigns an IP, creates the node in a **Pending** state (it is
  *not* immediately online), auto-stamps **Date Registered**, and if no username/token was entered
  generates a default masked credential. The **Camera Registered** confirmation notes that a
  connection test must pass before the camera is marked **Active** (audit entry written). Seed data
  includes one pending camera (`CAM-EVAC-06`) to demonstrate the flow.

### Camera Placement Map
- All placed cameras as color-coded `CCTV` markers with a status dot and an **`N` placed · `M`
  online** counter (plus a `· K pending` count when any camera waits on its first test); the map
  doubles as the click-to-place surface when arming Click-to-Pin.

### Camera Inventory (table)
- Status pill (Online / Degraded / Offline / **Pending**), camera ID, location name, **assigned
  boundary**, resolution, network IP, and actions:
  - **Test Connection (radio icon)** — runs the ~1.5 s connectivity check; see below.
  - **View (info icon)** — opens the **Camera Details** modal: overview (status, location, purok,
    assigned boundary, resolution, IP, power state) plus **Maintenance & Credentials** — maintenance
    contact, date registered, date last tested, and the masked access username/token.
  - **Credentials (key icon)** — opens the **Camera Access Credentials** editor; see the dedicated
    section below. Also reachable via **Manage Credentials** in the detail view.
  - **Edit** — rename, reassign purok / mapped location, change resolution, and set the
    **Responsible Maintenance Contact**; **Date Registered** and **Date Last Tested** render
    read-only (the latter auto-filled from connection-test runs).
  - **Power** — enable/disable the node (disabled rows render dimmed and leave the map).
  - **Delete** — gated by a **Confirm Delete** dialog.

### Camera Maintenance Records
- Registered cameras track the same maintenance-facing fields the IoT fleet does:
  - **Responsible Maintenance Contact** — free text, e.g. `Field Tech — Team A`; editable in the
    **Edit Camera** modal.
  - **Date Registered** — auto-set to today when the camera is created; read-only thereafter.
  - **Date Last Tested** — read-only; auto-filled from the most recent **Camera Connection Test**
    run.
- The full set (plus the masked access credentials) is visible read-only in the **Camera Details**
  modal (info icon in the inventory actions).

### Camera Access Credentials
- Each camera carries a masked **Camera Access Credentials** value (`svc_…` username + password /
  token) that is stored **server-side only** and shown masked everywhere in the UI — mirroring how
  the SMS **API Key** is masked in System Settings. It is captured (optionally) at registration and
  managed afterward from the **key icon** in the inventory or the **Manage Credentials** button in
  the detail view.
- **Edit flow** — the editor prefills the username and a masked token; typing a new token rotates
  it (empty = keep the current value). **Save Credentials** is gated by an **Update Camera Access
  Credentials** confirm modal: the current credential is invalidated and the new one is stored
  server-side only. Confirming writes a **Configuration Change** audit entry that never includes the
  username or token value, then resolves with a **Credentials Updated** modal.

### Camera Connection Test (pre-Active requirement)
- Mirrors the IoT **Device Connection Test**: a ~1.5 s simulated check that verifies the camera
  stream endpoint, returning latency on success or a connection failure on timeout.
- A camera **must pass** the test before it can be marked **Active**: the result flips a Pending row
  to `Online`; a failure leaves it Pending (rows already Online re-test cleanly, Offline cameras
  fail, Degraded may pass or fall back to Pending). Each successful run stamps the camera's
  **Date Last Tested** and writes a **Camera Connectivity Test** audit entry noting the pass/fail and
  the resulting state.

### CCTV Clip Storage
- A **Storage Usage** panel between the placement grid and the inventory shows **utilized vs.
  available** clip storage (`1,350 GB used of 2,000 GB`), a used-percent meter with the configured
  **warning-threshold** marker, and a small **`N% used`** badge.
- The threshold is configured in **System Settings → Data Retention → CCTV Clip Storage Warning
  Threshold** (shared `utils/cctvStorage.ts` store keeps both screens in sync live).
- Crossing the threshold raises a **rose warning banner** — "CCTV clip storage warning" — advising a
  review of the retention schedule or expanded allocation before capacity is exhausted.

### Audit trail
- **Camera Registration**, **Camera Placement** (map pin), **Camera Updated** (incl. reassignment,
  maintenance contact), **Camera Deleted**, **Camera Connectivity Test** (per connection-test run,
  with pass/fail and resulting state), and **Configuration Change** (camera access-credential
  updates — the credential value itself is never recorded in the entry).

---

## 5. `digital_boundaries.tsx` — Digital Boundaries (Geofencing)

Define and manage geographic zones and Purok boundaries — the polygons that power hazard detection,
patrol coverage, and analytics everywhere else in the system.

### Defined Regions (sidebar)
- Lists all configured boundaries with a badge (**Primary** / **Sub-zone**), classification chip,
  node count, computed area in hectares (shoelace formula) and last-edit date. Clicking a region
  selects it on the map. Each row carries:
  - **Edit** — rename, re-badge (Primary / Sub-zone), and reclassify.
  - **Delete** — the **primary boundary cannot be deleted** (blocked with an explanatory modal);
    others go through a **Confirm Delete** dialog.
- **Add New Boundary** opens a modal: name (defaults to `Purok N`), type (Primary / Sub-zone), and
  classification, then drops the new region into **draw** mode.
- **Import GeoJSON** — upload a `.geojson` / `.json` file (FeatureCollection, Feature, Polygon, or
  MultiPolygon). Rings are projected into the map canvas preserving aspect ratio, classified from
  `properties.classification` when present, created as sub-zones, and logged as a **Geofence
  Update**; invalid files surface a clear import-failed modal.
- Seed data includes Main Barangay Boundary, Purok 1–4, and Evacuation Zone Alpha.

### Zone Classifications
- `Standard`, `Residential`, `Market`, `Evacuation / Emergency`, `Hazard Zone` — the latter two
  render an **Emergency** stroke/badge so they surface visually on every map that consumes the zones.

### Map panel (SVG editor)
- **Draw Polygon** — click to append nodes to the selected region; **Undo** removes the last node;
  an on-map toast hints "Click the map to add nodes".
- **Edit Nodes** — drag nodes to reposition; each node's `×` removes it (min 3 kept). Touch input is
  supported alongside mouse.
- Live validation:
  - **Self-intersection** detection (segment-intersection algorithm) — amber banner "Polygon
    self-intersects — drag nodes to fix".
  - **Containment** check — sub-zones whose nodes fall outside the primary boundary get "Nodes
    outside primary boundary".
  - **Save Boundary** is disabled until the polygon is valid; saving stamps the edit date, logs a
    **Geofence Update** audit entry (with computed hectares), and confirms with a modal.
- Non-selected regions render faintly with dash strokes; a legend maps primary / sub-zone / node
  colors.

### Audit trail
- **Geofence Update** — boundary created, updated, reclassified, or deleted.

---

## 6. `patrol_configuration.tsx` — Patrol Routes & Checkpoints

Define and edit patrol routes and checkpoint boundaries — the routes the **Desk Officer** schedules
and the **Captain** tracks live, but defined here by the Admin (no scheduling / live-tracking /
dispatch features live on this page).

### Patrol Routes (sidebar)
- Lists all configured routes with a **status** badge (**Active** / **Draft**), patrol type, zone,
  checkpoint count, computed distance (in km), and last-edit date. Each row carries:
  - **Edit** — jumps to **Edit Checkpoints** mode on the map.
  - **Delete** — gated by a **Confirm Delete** dialog. Routes referenced by active patrol schedules
    (`SCHEDULE_USAGE`) cannot be deleted — an explanatory dialog names the schedule count and tells
    the admin to end/reassign schedules first.
- **Add New Patrol Route** opens a modal: name (must be unique), **patrol type** (Foot / Mobile /
  Bicycle), and **assigned zone**, then drops the route into **Add Checkpoints** draw mode as a
  **Draft**.
- Seed data includes a Purok 1 perimeter patrol, a market-row sweep, and a draft flood-line route.

### Route map (SVG editor)
- The selected route is drawn as a polyline with **directional arrows** at each segment midpoint and
  **numbered markers**; the **START** (green) and **END** (rose) checkpoints are labelled. Visual
  states: **Active** = solid blue line, **Draft** = amber dashed line; **High-risk** checkpoints get
  a dashed rose halo. Other routes, the primary boundary, and a legend render faintly; a scaled
  distance is computed via `PX_TO_KM`.
- **Add Checkpoints** — click to append a numbered checkpoint and open its config modal; an on-map
  toast hints "Click the map to add checkpoint". **Undo** reverses the last change.
- **Edit Checkpoints** — drag to reposition (mouse + touch); each node's `×` removes it (min 2
  kept); the gear icon opens the checkpoint config modal.
- **Undo / Redo / Reset** are available while adding or editing; **Reset** restores the last saved
  checkpoint layout.

### Checkpoint configuration
- Clicking a marker (map or the details-panel chip strip) opens a modal to edit: **name**, **type**
  (Regular / High-risk / Entry-Exit), **stop duration** (minutes, feeds the estimated patrol time),
  and **notes**; a **Delete** action removes it when more than 2 remain.

### Route Details panel
- Below the map: route name, patrol type, assigned zone, **status**, checkpoint count, **total
  distance (km)**, **estimated duration** (travel time by patrol-type speed + stop durations), last
  updated, created by, and last edited by, plus a chip strip of all checkpoints (click to configure).

### Status & validation
- Routes are **Draft** or **Active**; saving a valid route stamps the edit date and marks it
  **Active**.
- Live validation (amber banner, one entry per issue; **Save Route** stays disabled until clean):
  - **Too few checkpoints** — fewer than 2.
  - **Containment** — a checkpoint, or the route path between two checkpoints, outside the primary
    boundary.
  - **Spacing** — checkpoints overlapping or too close together; zero-length segments.
  - **Self-intersection** — the route path crosses itself.
  - **Zero length** — route total below a minimum scale.
  - **Duplicate name** — another route already uses the same name.
- Saving logs a **Patrol Routes** audit entry with checkpoint count, before/after km, and any status
  change, then confirms with a modal.

### Unsaved-changes protection
- Attempting to **switch routes**, **exit edit mode**, or **leave the page** with unsaved checkpoint
  changes opens a prompt: **Cancel** stays put, **Discard Changes** drops them, **Save Route** saves
  (disabled while validation errors exist). Leave-page is guarded by a nav-guard in `App.tsx` plus a
  `beforeunload` handler.

### Audit trail
- **Patrol Routes** — route created, saved/updated (counts, km, status), or deleted.

---

## 7. `system_logs.tsx` — System Audit Logs

Immutable record of all administrative actions — a live, searchable, exportable trail.

- The list merges a set of static seed entries with **live entries** emitted by every admin action
  through `pushAuditLog` (`subscribeAuditLogs` refreshes the table in real time across the admin
  screens).
- **Search** spans admin, action type, description, and IP; a **filter** dropdown enumerates every
  action type present (seed + live): `Configuration Change`, `User Deactivation`, `Device
  Registration`, `Geofence Update`, `User Created`, `User Updated`, `Password Reset`, `Device
  Updated`, `Device Decommissioned`, `Device Disabled`, `Device Enabled`, `Device Tamper Flagged`,
  `Device Tamper Cleared`, `Device Connectivity Test`, `System Alert`, `Camera Registration`,
  `Camera Placement`, `Camera Updated`, `Camera Deleted`, `Patrol Routes`, `Dispatch Created`,
  `Maintenance Resolved`, `Data Request Processed`,
  `Credential Provisioned`, `Credential Rotated`, `Credential Revoked`, `Camera Connectivity Test`.
- Rows show timestamp, admin (BA avatar + email), color-coded **Action Type** badge, description,
  and IP address. The new action types carry their own badge colors (teal for data requests, sky for
  credential provisioning, indigo for credential rotation, rose for revocation/credential
  deletion, cyan for connectivity tests).
- **Export CSV** downloads `system-audit-logs.csv` of the currently filtered rows (quoted, escaped
  header + data).

---

## 8. `data_requests.tsx` — Data Subject Requests

Admin-facing administration of **Data Privacy Act** access / correction / anonymization / deletion
requests, reachable from the **Data Requests** nav item.

### Incoming Requests
- Lists each request with: **request** ID (`DR-00x`), **Requester** (name + contact), **Type**
  (Access / Correction / Anonymization / Deletion, color-coded), **Date Submitted**, **Status**
  (Pending / In Review / Approved / Denied / Completed), the **subject** of the request, and actions.
- **Filter chips** (with live counts) cover **All** plus each status; a **`N pending · M total`**
  summary sits in the card header. A persistent blue notice states the policy upfront: official
  incident, audit, and evidence records subject to retention are **anonymized, never deleted**;
  deletion applies only to personal account and notification data.

### Actions
- **Review** (pending → In Review) — marks the request as under review (audited).
- **Approve & Process** — gated by a **ConfirmModal** that restates the anonymization rule, then
  resolves the request to **Completed** (audited). Deletion / anonymization requests are recorded as
  *anonymized rather than deleted*; access/correction approvals note redaction of third-party data.
- **Deny** — opens a modal requiring a **reason for denial** (button disabled until provided); the
  requester is notified of the grounds and the request resolves to **Denied** (audited).

### Audit trail
- Every decision — mark In Review, Approve & Process, Deny — writes a **Data Request Processed**
  audit entry carrying the request ID, type, requester, and disposition (reason on denials).
- **Boundary:** processing a request never deletes official incident/blotter/audit/evidence records
  (they are anonymized under retention); the Admin has no incident-status or blotter-deletion lever
  here.

---

## 9. `system_settings.tsx` — System Settings

Global configuration for integrations, thresholds, feature flags, retention, and platform
preferences, split across seven tabs (**SMS API Config**, **IoT Thresholds**, **Alert Rules**,
**Data Retention**, **Purok Coordination**, **Feature Flags**, **Localization**). Any edited tab is
flagged **dirty**; switching tabs with unsaved changes prompts an **Unsaved Changes** modal
(**Stay** / **Discard & Switch**).

### SMS API Config
- **SMS Gateway Connection**: API endpoint URL (default Twilio `…/2010-04-01/Accounts/{AccountSID}/Messages.json`), masked **API Key** with show/hide toggle, **Sender Name / ID** (`BRGY-ALERT`), and **Rate Limit** per minute.
- **Credit Monitoring**: remaining credits balance plus a **Test SMS** recipient field with a
  **Send Test** button (~1.5 s, "Test SMS Sent" modal).

### IoT Thresholds
- **Global Sensor Threshold Defaults**: global smoke sensitivity (ppm) and global decibel ceiling (dB).
  An amber note explains that these apply to *newly* registered devices; existing devices keep their
  individual limits until overridden in IoT Provisioning.

### Alert Rules
- **Escalation & Broadcast Rules**: automatic escalation timer (minutes before an unacknowledged
  incident escalates to the Admin) and geofence proximity radius (meters for resident mass alerts).
  Toggles: **Require Admin Approval for Broadcasts**, **Enable SMS Mass Broadcast**, **Enable Push
  Notifications**.
- **Notification Sound**: **Enable Notification Sounds** toggle, a **Default Volume Level** slider,
  and a **Test Sound** button that plays a sample tone at the current volume (disabled tones show a
  "Sounds Disabled" notice).
- **Notification Role Matrix**: which roles (Desk Officer, CCTV Operator, Tanod, Purok Leader)
  receive alerts at each severity level (Low / Medium / High / Critical) — click any cell to flip it.
- **Security & Access**: a **Require Two-Factor Authentication** toggle scoped to the privileged
  roles (Admin / Captain / Desk Officer), with an explanatory note that 2FA is **mandatory per
  policy** for those roles (privileged accounts hold a **Pending 2FA** state in User Management
  until enrollment) and optional for all other roles. The **Save Settings** commit writes a
  **Configuration Change** audit entry; 2FA state changes in User Management audit the same way
  every time.

### Data Retention
- **Data Retention Schedule** — one row per data category (numeric value + **Days / Months / Years**
  unit), pre-populated with the approved initial targets: **Incident Records** (7 years),
  **CCTV Clip Footage** (1 year), **Application / Error Logs** (90 days), **Audit Logs** (10 years),
  **Raw IoT Telemetry** (90 days), **Notification Records** (1 year), **Patrol Checkpoint Logs**
  (2 years).
- **CCTV Clip Storage Warning Threshold** — percentage (default 85%, range 10–100) that drives the
  warning banner in CCTV Placement; saved through the shared `utils/cctvStorage.ts` store so the
  Placement screen updates live.
- A persistent **retention-shortening** warning: shortening a period does **not** retroactively
  delete records that are under **active legal hold** or tied to **unresolved incidents** — purge
  jobs only reclaim records past their retention window.
- **Save / Revert** follows the same footer pattern as the other tabs and writes a **Configuration
  Change** entry.

### Purok Coordination
- **Module Status & Oversight**: an **Enable Purok Coordination Module** toggle, plus an
  in-scope note clarifying this covers the Purok Leader's validation-label and escalation
  capabilities (resident-organized watch-group membership and submission programs are out of scope).
- **Community-Validation Labels**: enable/disable each validation note Purok Leaders may apply to
  resident reports (advisory only — the Desk Officer retains final authority).

### Feature Flags
- **Module Feature Flags**: an enable/disable toggle for each whole module — CCTV, IoT Monitoring,
  Digital Boundaries, Patrol Management, Purok Coordination, SMS Mass Broadcast, Push
  Notifications, and Emergency Broadcast — each with a short description.
- **Maintenance Mode**: **Enable Maintenance Mode** toggle plus a **Maintenance Notice** message.
  While active, non-admin roles see the notice and cannot perform operations; an amber notice
  surfaces on this tab.

### Localization
- **Language & Regional Format**: default system language (English / Filipino-Tagalog), timezone
  (Asia/Manila or UTC), date format (YYYY-MM-DD / MM/DD/YYYY / DD/MM/YYYY / MMMM D, YYYY).
- **Barangay Identity**: official barangay name and seal/logo upload (PNG/SVG, max 2 MB) used on
  printable blotter reports and headers.

### Save / Revert
- Footer bar: **Revert to Defaults** and **Save Settings** (both confirm with a **Settings Saved** /
  **Settings Reverted** modal and write a **Configuration Change** audit entry).

---

## End-to-end scenario (the Admin's day)

The nine screens form one administrative loop: **monitor → provision people → provision hardware →
place the eyes → map the territory → define the routes → tune the rules → honor the data → prove the
record**. Here is a representative day.

### 1. Monitor — Dashboard
The admin signs in (any non-special username routes to `admin`) and lands on **Dashboard**. The
**ACTIVE ALERTS** card shows 9 open alerts split across all four severities. The admin expands the
banner and **Pings** `SM-PUROK3-01` (240 ms latency — node is alive, likely a radio drop), then
**Dispatches** the low-battery decibel meter `DB-HALL-01` through the **Dispatch Field
Maintenance** modal — Offline-Reconnect type, Urgent priority, Field Tech — Team A — landing on a
**Dispatch Confirmed** modal and a **Dispatch Created** audit entry. The
**IoT System Health Monitor** confirms `SM-PUROK3-01` is the only red row (and that `SM-KIOSK-01`
carries the distinct violet **Possible Tamper** status); clicking its coordinates
opens the boundaries map to confirm where it sits. The **System Health & Infrastructure** panel
shows the DB pool, background jobs, storage, and notification providers all healthy at a glance;
the **CCTV Fleet Availability** rail flags `CAM-MARKET-03` offline; and the **Open Maintenance
Tickets** rail aggregates the day's dispatches. The **Public Safety Metrics** panel shows a
healthy incident rate and response time.

### 2. Provision people — User Management
A new Tanod joins. The admin goes to **User Management**, clicks **Create New User**, fills name /
email / phone, picks the **Tanod** role, assigns **Purok 1 — Riverside**, and sends the email
invitation. The account appears at the top of the directory and a **User Created** audit entry is
written. A Purok Leader who left is located by search, then **Disabled** (retained for history).
When a Desk Officer forgets their password, the admin hits **Reset** to send a recovery link — and,
because **Desk Officer** is a privileged role, the account carries a **Pending 2FA** badge and is
re-invited via the **2FA** row action (each step auditing a **Configuration Change**); it only turns
**Active** once enrollment completes.

### 3. Provision hardware — IoT Provisioning
The admin registers a new smoke sensor for the market zone: **Hardware Type** = Smoke Sensor, purok =
Purok 3 — Market Zone (the **Device ID** auto-generates as `SM-P3-…`), and coordinates picked with
**Click-to-Pin** on the device map. **Register Device** places the node in **Pending** — the admin
then runs the **Device Connection Test**, which confirms reachability, telemetry format,
threshold-event generation, and backend storage, and promotes the node to **Active** (§9.12). The
fleet status map is verified (including the violet **Possible Tamper** node, which is inspected and
cleared), and the admin tunes sensitivity in the **Threshold Configuration Panel** — documenting the
field test in the required justification field (§5.9) — then **Applies** it. Every node's
maintenance records — installation date, last inspection, connectivity-test timestamp, inspector, and
reported faults — are kept in the **Edit Device** modal and readable from the **Device Details** view.
A retired unit is **Decommissioned** (record and history retained), its credentials **Revoked**
(blocked from reconnecting) and later **Rotated** / re-provisioned
for redeployment, each writing its own audit entry and flipping the **Credential Status** badge from
Active → Revoked → Active.

### 4. Place the eyes — CCTV Placement
On **CCTV Placement**, the admin registers `CAM-MARKET-03`, assigns it to **Purok 3 — Market Zone**,
picks a **4K** camera, and places it with **Click-to-Pin** on the map. The new node appears on the
placement map in a **Pending** state — to go live, the admin runs **Test Connection**, which returns
a latency on success and marks the camera **Active** (a failed run keeps it Pending). Registration
captures the camera's masked **access credentials** (server-side only); the admin later opens the
inventory's key icon to rotate the token — gated by a confirm modal and audited as a **Configuration
Change** without the value — records `Field Tech — Team A` as the maintenance contact, and checks the
auto-stamped **Date Registered** / **Date Last Tested** in the **Camera Details** view. The
**CCTV Clip Storage** panel shows `1,350 GB / 2,000 GB` at 68% used, safely under the 85% threshold;
the registration, placement, and connectivity-test runs each write their audit entries.

### 5. Map the territory — Digital Boundaries
On **Digital Boundaries**, the admin selects **Purok 3 — Market Zone**, hits **Draw Polygon**, clicks
four points to extend the boundary, and **Saves** it (the self-intersection/containment checks
pass). A new **Evacuation Zone Bravo** is created with an **Evacuation / Emergency** classification,
then drawn on the map. The admin also **Imports GeoJSON** for an updated coastal polygon, which
lands on the map with its own **Geofence Update** audit entry.

### 6. Define the routes — Patrol Routes & Checkpoints
On **Patrol Routes**, the admin creates a **Foot Patrol** route for the market district, adds five
numbered checkpoints along the stall front, and configures each one (type, stop duration, notes)
through the checkpoint modal. The validation banner is clear, so **Saves** marks it **Active**
(~2.1 km) and audits the change; undoing a stray click with **Undo** is a no-op on the saved layout.
A draft **Riverside Flood Line** mobile route stays **Draft** until the next patrol cycle, and its
**Delete** is blocked while it remains referenced by active patrol schedules.

### 7. Tune the rules — System Settings
In **System Settings**, the admin tests the Twilio SMS gateway (**Send Test**), adjusts the heartbeat
interval and escalation timer, flips the **Notification Role Matrix** so CCTV Operator stops
receiving low-severity alerts, disables **Push Notifications** via the **Feature Flags** tab, and
sets **Maintenance Mode** ahead of a peek. The **Alert Rules → Security & Access** card keeps
**Require Two-Factor Authentication** enforced for privileged roles, the **Data Retention** tab
confirms the approved schedule (7-year incidents, 10-year audit trail, 90-day app/telemetry) and
lowers the **CCTV Clip Storage Warning Threshold** to 80%, and the **Purok Coordination** tab caps
which validation labels leaders may use. Switching an edited tab triggers the **Unsaved Changes**
guard before **Save Settings** commits everything as a **Configuration Change** audit entry.

### 8. Honor the data — Data Requests
Later, a resident files a **Deletion** request (`DR-007`) and another an **Access** request
(`DR-008`). The admin opens **Data Requests**, marks the first **In Review**, then **Approve &
Process** — the confirm modal restates that official incident/audit/evidence records under retention
are *anonymized rather than deleted* — and the personal account data is purged. The second is
**Denied** with a required reason (no legal basis identified). Both decisions resolve to
**Completed** / **Denied** and write **Data Request Processed** audit entries.

### 9. Prove the record — Audit Logs
Finally the admin opens **Audit Logs**. The day's session shows in real time: the user creation, the
device registration and credential provisioning/replacement, the camera assignment and connectivity
tests, the two
geofence updates, the patrol-route save, the settings commit, the feature-flag flip, and the two
data-request decisions. The admin filters by **Geofence Update**, then **Export CSV** to produce
`system-audit-logs.csv` for the council — an immutable, attributed record of every administrative
action, each tied to an admin email, action type, description, and IP address.

> Every artifact the admin touches — account, device, boundary, threshold, log — carries a
> consistent ID and an audit entry, so the platform trail reads back from a sensor's low battery to
> the maintenance dispatch that resolved it.

---

## Cross-cutting conventions

- **UI language** — all nine screens use the shared design system: `#0038A8` accent (hover
  `#002A8C`), `#E9EDFB` panel background, slate text tones (`#334155` / `#94A3B8` / `#64748B`), and a
  navy `#06122B` sidebar; `ConfirmModal` / `Modal` patterns, and centered confirmation/success
  modals for irreversible or notable actions (delete device, delete boundary, delete route, delete
  camera, disable user, save settings).
- **Notification modal** — every action resolves into a centered dialog via the shared
  `ConfirmModal` (`components/ui`) — a title, message, and dismiss — matching the toast conventions
  used across the other roles.
- **Audit trail** — `pushAuditLog` (`utils/auditLog.ts`) writes a shared, in-memory audit store
  (timestamp, admin, action type, description, IP); the actor is resolved dynamically from the
  active session (`bgyauth`), falling back to `admin@brgy.gov.ph`. `SystemLogs` subscribes and
  renders it live alongside seed entries. Audit action types are color-coded and CSV-exportable;
  every action described in this guide (including 2FA policy changes, retention saves, data-request
  dispositions, credential provisioning/replacement/revocation, and camera connectivity tests) writes
  an entry.
- **Data protection** — two-factor authentication is **mandatory** for privileged roles (Admin,
  Captain, Desk Officer) with a **Pending 2FA** gate in User Management and a **Require
  Two-Factor Authentication** policy toggle in System Settings; data-retention windows are
  configured in the **Data Retention** tab (applied by the scheduler, never retroactively against
  legal hold or unresolved incidents); and CCTV clip storage monitors itself against the configured
  warning threshold. Shared stores (`utils/cctvStorage.ts`) keep settings and the placement screen
  live in sync.
- **Purok data** — zones and options come from `PUROK_OPTIONS` (`constants/purok.ts`); device
  coordinates and boundary polygons reuse the same zone vocabulary used by the Captain's maps and
  the Desk Officer's scheduling, so a device pinned here matches a purok on the hazard map.
- **Status conventions** — device status uses the shared `pending / online / offline /
  possible_tamper` scale (§10.6.1 / §6.5.15): a **Pending** node becomes **Active** only after a
  passing connection-test acceptance check (§9.12); **possible tamper** is a violet state distinct
  from offline (the node still transmits); and **Low Battery** is a *derived* indicator from
  battery voltage, not a stored status. Disabled power state is also derived (dimmed, off-map).
  Battery/signal meters reuse `batteryColor` / `signalColor` (`utils/colors.ts`), identical to the
  Captain's dashboard sensor readings. CCTV cameras add a **Pending** pre-Active state with its own
  status pill and map badge, and a compact **CCTV Fleet Availability** panel on the Dashboard
  mirrors the same online/offline/pending scale. Alerts follow the four-severity scale from §14.11
  (Critical / High / Warning / Informational).
- **Admin boundary** — the Admin owns *configuration, not operations*: no incident triage, no
  broadcast authorization, no incident dispatch, no CCTV footage review, no audit-record or
  blotter/incident deletion. The sole operational levers are **field-maintenance dispatch** and
  **ticket resolution** for IoT nodes from the Dashboard (writes a `Dispatch Created` /
  `Maintenance Resolved` audit entry) and **data-request
  processing** (anonymize/deny — never delete retained official records). Broadcast
  approval lives with the Captain (`AuthorizeEmergencyBroadcast`); incident routing and dispatch stay
  with the Desk Officer. The Admin's broadcast-relevant levers are the **Alert Rules** toggles in
  System Settings (approval requirement, SMS master switch, push notifications) and the
  **Notification Role Matrix**.
- **Session** — login routing in `App.tsx` maps unrecognized usernames to `admin`; the session is
  persisted in `localStorage` (`bgyauth`) so the admin returns to their last screen on refresh;
  **Logout** clears it and returns to the login page.
- **Data** — frontend mock state with simulated actions (1.5 s pings, 1.5 s test SMS, 1.2 s
  simulated responses, randomized telemetry); no live backend calls in these screens. The FastAPI
  backend (`backend/main.py`) is a CORS-enabled stub exposing `/` and `/api/hello`.
