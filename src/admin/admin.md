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

The **System Administration and Infrastructure Health Dashboard** — the admin's daily landing page.
It answers one question: *"Is the system configured, accessible, and healthy?"* It is a concise
administrative overview — **not** an incident-response or operational dashboard. It renders in five
sections, top to bottom: **System Overview → Device Health → Infrastructure Health → System Alerts →
Recent Audit Activity**.

### 1. System Overview
- **KPI stat cards** (clickable, with hover highlight, tooltip, and corner-arrow affordance), each
  navigating to its corresponding admin module:
  - **ACTIVE USERS** — `6` active of `7` total accounts → **User Management**.
  - **IOT DEVICES** — `8` deployed (`5 online · 1 offline · 1 pending · 1 maintenance`) → **IoT Provisioning**.
  - **CCTV CAMERAS** — `12` placed (`10 online · 1 offline · 1 pending`) → **CCTV Placement**.
  - **SYSTEM STATUS** — `Healthy` (`99.2%` uptime, last 30 days) → **System Settings**.

### 2. Device Health
- **IoT Device Health** (panel spanning two columns): status chips counting **Online / Offline /
  Pending / Maintenance Required**, plus a compact table of every deployed node — **DEVICE NAME**,
  **TYPE**, **STATUS** (Online / Offline / Pending / **Maintenance Required** amber badge), **BATTERY** (color-coded meter), **LAST PING**, **ACTIONS** (**Ping** — simulated
  heartbeat probe, ~1.5 s, confirmed with a **Ping Complete** modal). **Open IoT Provisioning**
  jumps to the full module.
  - **Maintenance Required** is a passive status/indicator: a device whose battery/fault state needs
    attention (e.g. `DB-HALL-01` at 21%) carries an amber badge; clicking it opens **IoT
    Provisioning** to view the device's maintenance records. There is **no dispatch or ticket
    workflow** — the dashboard only surfaces the indicator and points to the maintenance
    information in IoT Provisioning.
- **CCTV Availability** (right rail): status chips counting **Online / Offline / Pending**, a
  compact camera list (status dot, ID, name · purok, status pill, last-seen), and a **Manage** link
  to **CCTV Placement**.

### 3. Infrastructure Health
- Four simple status cards, each with an icon, service name, one-line description, and a
  **Healthy / Warning / Unavailable** badge:
  - **Database** — Healthy (`Connected · pool at 42% capacity`).
  - **Storage** — Healthy / **Warning** (`1,730 GB of 2,750 GB used · 63%`); the Warning state is
    derived live from the shared `utils/cctvStorage.ts` threshold (live-synced with CCTV Placement
    and System Settings → Data Retention).
  - **Notification Service** — **Warning** (`Push notifications degraded — 4 failures (24h)`).
  - **Backend / API** — Healthy (`All endpoints responding · 12ms latency`).
- Deliberately **no** excessive technical metrics — no per-job detail, queue depths, or per-volume
  breakdowns on this surface.

### 4. System Alerts
- Collapsible banner (border tone follows the **top severity**: rose critical → orange high → amber
  warning → sky informational) listing administrative / system-level alerts only. Seed classes:
  **device offline**, **maintenance required** (low battery), **repeated
  failed logins** (with source IP), **camera offline**, **SMS rate-limit** notice,
  **authentication-service failure**, **audit-log failure**, and a **storage warning** that appears
  only when the shared storage threshold is exceeded.
- Per-alert actions: **Ping** (IoT alerts) or **Details** (a modal with category, detection time,
  source IP where relevant, and the §14.12 escalation-routing explanation).
- **No operational incident queues** — SOS/incident triage, incident-response, and patrol metrics do
  not appear here.

### 5. Recent Audit Activity
- The latest administrative audit events — seed entries (`User Created`, `User Deactivation`,
  `Device Registration`, `Credential Provisioned`, `Camera Registration`, `Patrol Routes`,
  `Geofence Update`, `Data Request Processed`, `Configuration Change`) merged live with entries from
  the shared audit store (`getAuditLogs` / `subscribeAuditLogs`, `utils/auditLog.ts`), newest first.
  Each row shows a color-coded **action-type** badge, the description, and the timestamp · admin.
- **View All** / **Open Audit Logs** jumps to the Audit Logs screen.

### Deliberate scope boundary
- **Unprocessed high-priority incidents and per-role SLA breaches are not shown here.** They are
  operational-triage concerns that belong to the **Desk Officer** dashboard (14.5) and its SLA /
  incident queues, and to the **Captain's** escalation view — the Admin's dashboard stops at
  configuration, fleet, and infrastructure health. There is no incident analytics, no API-performance
  or telemetry console, no patrol / Tanod performance metrics, and no field-maintenance dispatch or
  ticket lifecycle anywhere on this page.

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
  - **Reset** — **Reset Password** goes through a **confirm → send → audit** flow: a confirmation
    modal asks to send a password-reset link to the user's email; confirming writes a **Password
    Reset** audit entry and a success modal.
  - **2FA** — shown only for privileged accounts in a **Pending** 2FA state; re-sends the
    two-factor enrollment invitation (audited as a `Configuration Change`).
  - **Disable / Enable** — both go through a **confirm → toggle → audit** flow. **Disable** shows a
    rose confirmation ("They will lose access to the platform"); **Enable** shows a primary
    confirmation ("They will regain access"). Confirming writes a **User Disabled** / **User
    Enabled** audit entry and a success modal; disabling keeps the record but blocks access.
- **2FA status indicator** — privileged roles (Admin / Captain / Desk Officer) show a per-row badge:
  **Enabled** (emerald, guarded by `ShieldCheck`) or **Pending** (amber, guarded by `Clock`).
  Non-privileged roles show a dash — 2FA is optional for them. A privileged account in the Pending
  state renders **"2FA Setup Required"** alongside its status pill and cannot complete as **Active**
  until the invited user finishes enrollment.
- **Pagination** at 5 rows per page when the filtered list exceeds the page size.

### Create / Edit modal
- Fields: **Full Name**, **Email Address**, **Contact Number**, **System Role** (Captain, Desk
  Officer, CCTV Operator, Tanod, Purok Leader, Resident).
- **Assigned Purok / Zone** appears for **Tanod** (patrol zone), **Purok Leader** (report
  feed zone), and **Resident** (home purok), sourced from `PUROK_OPTIONS`.
- **2FA policy notice** — picking **Captain** or **Desk Officer** shows an amber notice that two-factor
  authentication is **mandatory per policy** for that role; on create the account is minted in a
  **Pending 2FA** state (writes a `Configuration Change` entry) and cannot become **Active** until
  enrollment completes. The confirmation modal reads **"User Created — 2FA Pending"**. **Editing a
  role** applies the same policy: promoting a user to a privileged role sets 2FA to **Pending**
  (audited as a `Configuration Change`); demoting out of a privileged role clears the mandatory
  requirement.
- On create, an **AUTHENTICATION** option: *Send email invitation to set password* (checked) or, if
  unchecked, a temporary password is generated and shown on creation.
- Every create / edit writes an audit entry and resolves in a **User Created** / **User Updated**
  success modal; edits describe the changed fields (role, purok, name, email, contact).

### Audit trail
- Actions push to the shared audit store via `pushAuditLog`: **User Created**, **User Updated**,
  **User Enabled** (enable), **User Disabled** (disable — both gated by a confirmation modal),
  **Password Reset** (confirm → send), and **Configuration Change** for every 2FA-policy event
  (privileged account created with enrollment pending, role promoted to a privileged role,
  enrollment invitation re-sent).

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
  for **Online**, **Low Battery** (derived), **Pending**, and **Offline**, plus
  an **`N` active** counter. **Low Battery is a derived indicator from battery voltage, not a stored
  status value** — the stored enum is `pending / online / offline` (plus the
  derived Disabled / Decommissioned power states; both drop the node off the map).

### Device Inventory (table)
- Columns: status pill, device ID, type, purok, battery meter, signal meter, last ping,
  **Credential Status**, and actions:
  - **Edit** — type, purok, firmware version, coordinates, and the **Maintenance Records** block (see
    **Device Maintenance Records**). The
    **Device ID is shown read-only and immutable** after registration.
  - **View (info icon)** — opens the **Device Details** modal: the full device overview (operational
    status, type, barangay, purok, firmware, MAC, coordinates, battery/signal, calibration note, last
    ping, power state, **credential status + masked credential**) with the **Maintenance Records**
    below it, read-only.
  - **Provision (key icon)** — shown for devices with **Credential Status: Not Provisioned** or
    **Revoked** (revoked-recovery path); generates a unique credential. See **Device Credential
    Lifecycle**.
  - **Rotate (refresh icon)** — rotates the enrollment credential for devices that already have one
    (Active); see **Device Credential Lifecycle**.
  - **Revoke (shield-x icon)** — revokes the enrollment credential; see **Device Credential
    Lifecycle**. Hidden for Not Provisioned devices (nothing to revoke) and revoked devices.
  - **Power** — enable/disable the device (disabled rows render dimmed and drop off the map); both
    transitions write distinct **Device Enabled** / **Device Disabled** audit entries (§12.14).
  - **Decommission (archive icon)** — gated by a **Confirm Decommission** dialog: the node is
    disabled and dropped from the map, but the record and its operational history are **retained for
    the audit trail — never destroyed** (§10.1).
- **Credential Status column** — a per-device badge with the **Active / Revoked / Not
  Provisioned** status (`KeyRound` icon; emerald / rose / stone), tooltipped: revoked devices
  "cannot authenticate until a new credential is provisioned",
  Not Provisioned devices "registration did not create one".

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
  has an active one; disabled for decommissioned devices. The **Rotate Device
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
- **Rotation never changes operational status** — an Online / Pending / Offline
  device keeps that status; a rotated credential is *not* proof the physical ESP32 has reconnected.
  As in the prototype, credential changes are **not simulated on the physical device** — the UI
  states plainly that changes must be applied to the physical ESP32 during actual deployment, then
  verified with the **Device Connection Test**.
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
- Pick any enabled device and **Test Connection** — a ~1.5 s **acceptance check** (§5.10) that
  verifies four checks: **Credential Authentication**, **Connectivity**, **Telemetry**, and
  **Backend Storage**. The result renders a per-check **PASS / FAIL** checklist plus an overall
  **Result: PASS / FAIL** (latency + RSSI on success); a failed check explains the cause (revoked
  credentials block the run, Not Provisioned devices have no credential to authenticate with,
  offline devices time out).
- **Credential Authentication** ties into the credential lifecycle:
  - **Not Provisioned** — a device registered without a credential fails this check with the notice
    that a valid credential must be **provisioned** before the acceptance test can run; the device
    stays **Pending**.
  - **After Rotate** — the physical ESP32 is *not yet* using the new secret, so this check fails
    with the notice that the previous enrollment credential has been invalidated and the device must
    be updated to the new credential through the real provisioning process before re-running the test.
- A device **must pass** the acceptance check before it can be **Online** (§9.12): a **Pending**
  row that passes is promoted to `online`; a failed run leaves it Pending. Every run stamps
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
- **Thresholds are configured globally here only** — the **Edit Device** modal carries no
  per-device threshold override; every threshold change passes through this justification-gated
  panel (§5.9).

### Audit trail
- **Device Registration** (full record — name, ID, type, module, serial, MAC, barangay, purok,
  coordinates, location, firmware — with status Pending noted), **Geofence Update** (map pin),
  **Device Updated** (incl. what changed), **Device Connectivity Test** (acceptance pass/fail +
  resulting state),
  **Device Disabled** / **Device Enabled** (§12.14), **Device Decommissioned** (record retained),
  **Configuration Change** (threshold
  applies/reverts, incl. justification), **Credential Provisioned**, **Credential Rotated**,
  **Credential Revoked**.

---

## 4. `cctv_placement.tsx` — CCTV Placement & Assignment

Assign CCTV cameras to mapped locations and configure camera hardware — the Admin's configuration
side of the surveillance mesh that the **CCTV Operator** operates and the **Captain** reviews. The
Admin page is **configuration-only**: it carries **no surveillance-operation features** — no live feed
viewing, no event tagging, no incident creation from footage, no recorded-footage search, no evidence
clips or footage export, and no CCTV event investigation. Those functions belong exclusively to the
**CCTV Operator** and other authorized operational roles.

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
- Status pill (Online / Offline / Pending / **Disabled**), camera ID, location name, **assigned
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
  - **Power** — enable/disable the node (disabled rows render dimmed and leave the map; a re-enabled
    camera returns in a **Pending** state and must pass a connection test again).

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

### Camera Connection Test (pre-Online requirement)
- Mirrors the IoT **Device Connection Test**: a ~1.5 s simulated check that verifies four results —
  **Stream Reachability**, **Authentication**, **Response Time**, and an **Overall Result** rendered
  as a per-check **PASS / FAIL** checklist. A failed check explains the cause (endpoint unreachable
  on timeout, invalid credentials rejected, or response time exceeded).
- A camera **must pass** the test before it can go **Online**: the result flips a Pending row to
  `online`; a failure leaves it Pending (rows already Online re-test cleanly; Offline cameras stay
  Offline on failure). Disabled cameras cannot be tested until re-enabled. Each successful run stamps
  the camera's **Date Last Tested** and writes a **Camera Connectivity Test** audit entry recording
  the per-check pass/fail, the overall result, and the resulting state.

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
  maintenance contact), **Camera Connectivity Test** (per connection-test run, with the per-check
  pass/fail and resulting state), and **Configuration Change** (camera access-credential updates —
  the credential value itself is never recorded in the entry).

---

## 5. `digital_boundaries.tsx` — Digital Boundaries (Geofencing)

Define and manage geographic zones and Purok boundaries — the polygons that power hazard detection,
patrol coverage, and analytics everywhere else in the system.

### Defined Regions (sidebar)
- Lists all configured boundaries with a **status** badge (**Active** / **Inactive**), a badge
  (**Primary** / **Sub-zone**), classification chip, node count, computed area in hectares (shoelace
  formula) and last-edit date. Clicking a region selects it on the map. Each row carries:
  - **Edit** — rename, re-badge (Primary / Sub-zone), reclassify, and adjust status.
  - **Archive** (Active rows) — the **primary boundary cannot be archived** (blocked with an
    explanatory modal); other boundaries go through a **Confirm Archive** dialog. Archiving sets the
    boundary **Inactive** and hides it from the map, but **retains the record** so historical
    geographic references keep resolving — it is never destroyed.
  - **Restore** (Inactive rows) — reactivates an archived boundary (**Active**) and returns it to the
    map.
- **Add New Boundary** opens a modal: name (defaults to `Purok N`), type (Primary / Sub-zone),
  classification, then drops the new region into **draw** mode.
- **Import GeoJSON** — upload a `.geojson` / `.json` file (FeatureCollection, Feature, Polygon, or
  MultiPolygon). Rings are projected into the map canvas preserving aspect ratio, classified from
  `properties.classification` when present, created as sub-zones, and logged as a **Boundary
  Created**; invalid files surface a clear import-failed modal.
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
    **Boundary Updated** audit entry (with computed hectares), and confirms with a modal.
- Non-selected regions render faintly with dash strokes; a legend maps primary / sub-zone / node
  colors.

### Audit trail
- **Boundary Created** — new boundary added via **Add New Boundary** or imported via GeoJSON.
- **Boundary Updated** — boundary renamed, re-badged, reclassified, re-shaped, or restored to
  **Active**.
- **Boundary Archived** — boundary set **Inactive** (retained, hidden from the map).

---

## 6. `patrol_configuration.tsx` — Patrol Routes & Checkpoints

Define and edit patrol routes and checkpoint boundaries — the routes the **Desk Officer** schedules
and the **Captain** tracks live, but defined here by the Admin. This page is **configuration-only**:
the Admin creates routes and checkpoints but never executes patrols. **No patrol execution controls
exist here** — starting/ending patrols, live Tanod tracking, checkpoint verification, Tanod shift
assignment, patrol attendance, and field-status recording remain operational functions for other
roles and are deliberately absent.

### Patrol Routes (sidebar)
- Lists all configured routes with a **status** badge (**Active** / **Draft**), patrol type, zone,
  checkpoint count, computed distance (in km), and last-edit date. Each row carries:
  - **Edit** — jumps to **Edit Checkpoints** mode on the map.
  - **Delete** — gated by a **Confirm Delete** dialog. Routes referenced by active patrol schedules
    (`SCHEDULE_USAGE`) cannot be deleted — an explanatory dialog names the schedule count and tells
    the admin to end/reassign schedules first.
- **Add New Patrol Route** opens a modal: name (must be unique), **description**, **patrol type**
  (Foot / Mobile / Bicycle), and **purok / zone / boundary** (drawn from the configured boundaries),
  then drops the route into **Add Checkpoints** draw mode as a **Draft**.
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
- **Sequence** — each checkpoint is numbered by its position in the route; the arrows beside each
  chip in the details panel **reorder** the sequence (move a checkpoint earlier/later), which the
  map reflects immediately (START/END markers and numbering follow the reorder).

### Route Details panel
- Below the map: route name, patrol type, purok / zone / boundary, **description**, **status**,
  checkpoint count, **total distance (km)**, **estimated duration** (travel time by patrol-type speed
  + stop durations), last updated, created by, and last edited by, plus a chip strip of all
  checkpoints (click to configure, arrows to reorder).
- **Edit Route Info** opens a modal to rename the route, update its **description**, change the
  **patrol type**, or reassign its **purok / zone / boundary** — every change is audited immediately.

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
- **Patrol Routes** — route created, saved/updated (counts, km, status), renamed / description /
  patrol-type / zone changed via **Edit Route Info**, or deleted.

---

## 7. `system_logs.tsx` — System Audit Logs

Immutable record of all administrative actions — a live, searchable, exportable trail.

- The list merges a set of static seed entries with **live entries** emitted by every admin action
  through `pushAuditLog` (`subscribeAuditLogs` refreshes the table in real time across the admin
  screens).
- **Read only** — a **READ ONLY** badge and notice state that logs cannot be edited, deleted,
  re-timed, or re-attributed by any user; the page exposes no row actions, only viewing and export.
- **Columns** — Timestamp, **Actor** (BA avatar + email), **Role** (derived from the actor, e.g.
  System Admin), **Action** (color-coded type badge), **Affected Record** (device / camera / request /
  incident / boundary / account identified from the description, or `—`), **Description**,
  **Result** (Success / Denied / Failed derived from the description), and **IP Address** where
  available.
- **Filters** — free-text **search** (actor, role, action, affected record, result, description, IP),
  **date** (exact day), **actor** dropdown, **action type** dropdown (enumerating every type
  present, seed + live), and **result** dropdown (All / Success / Denied / Failed).
- Action types present include: `Configuration Change`, `User Deactivation`, `User Disabled`,
  `User Enabled`, `Device
  Registration`, `Geofence Update`, `Boundary Created`, `Boundary Updated`, `Boundary Archived`,
  `Boundary Restored`, `User Created`, `User Updated`, `Password Reset`, `Device
  Updated`, `Device Decommissioned`, `Device Disabled`, `Device Enabled`, `Device Connectivity
  Test`, `System Alert`, `Camera Registration`, `Camera Placement`, `Camera Updated`, `Camera
  Deleted`, `Patrol Routes`, `Data Request Processed`,
  `Credential Provisioned`, `Credential Rotated`, `Credential Revoked`, `Camera Connectivity Test`.
- **Export CSV** downloads `system-audit-logs.csv` of the currently filtered rows (quoted, escaped
  header + data), matching the table columns.

---

## 8. `data_requests.tsx` — Data Subject Requests

Admin-facing administration of **Data Privacy Act** access / correction / anonymization / deletion
requests, reachable from the **Data Requests** nav item.

### Incoming Requests
- Lists each request with: **request** ID (`DR-00x`), **Requester** (name + contact), **Type**
  (Access / Correction / Anonymization / Deletion, color-coded), **Date Submitted**, **Status**
  (Pending / In Review / Verified / Approved / Denied / Completed), the **subject** of the request,
  the **Related Record** (e.g. `INC-2068`, `INC-2071`, device/account refs — the data the request
  actually touches, or `—`), and actions.
- **Filter chips** (with live counts) cover **All** plus each status; a **`N pending · M total`**
  summary sits in the card header. A persistent blue notice states the policy upfront: every request
  moves **Pending → In Review → Verified** before a decision, and official incident, audit, and
  evidence records subject to retention are **anonymized, never deleted**; when deletion cannot be
  performed the request is **denied / Retention Required**.

### Actions
- **Review** (pending → In Review) — marks the request as under review (audited).
- **Verify** (In Review → Verified) — confirms requester identity and legal basis before a decision;
  the audit entry records the request, type, requester, and the related record (audited). Approve and
  Deny buttons are only offered from **Verified** (or In Review while a case is being triaged).
- **Approve & Process** — gated by a **ConfirmModal** that restates the anonymization rule (and
  names the related record), then resolves the request to **Completed** (audited). Deletion /
  anonymization requests are recorded as *anonymized rather than deleted*; access/correction
  approvals note redaction of third-party data.
- **Deny** — opens a modal requiring a **reason for denial** (button disabled until provided); a
  **Denied / Retention Required** toggle switches the denial to the fixed retention explanation
  (active investigation, legal hold, approved retention, or official incident/blotter/audit
  requirements), locking the reason field. The requester is notified of the grounds and the request
  resolves to **Denied** (audited).

### Audit trail
- Every decision — mark In Review, Verify, Approve & Process, Deny — writes a **Data Request
  Processed** audit entry carrying the request ID, type, requester, and disposition (related record
  on verification; reason on denials, including the fixed Retention Required wording).
- **Boundary:** processing a request never deletes official incident/blotter/audit/evidence records
  (they are anonymized under retention); the Admin has no incident-status or blotter-deletion lever
  here.

---

## 9. `system_settings.tsx` — System Settings

Global configuration for system identity, sensor thresholds, notifications, security, retention, and
feature flags, split across seven tabs (**General**, **IoT Thresholds**, **Notifications & Alerts**,
**Security**, **Data Retention**, **Purok Coordination**, **Feature Flags**). Any edited tab is
flagged **dirty**; switching tabs with unsaved changes prompts an **Unsaved Changes** modal
(**Stay** / **Discard & Switch**). The page deliberately exposes only settings with prototype
behavior — no SMS gateway connection details, no maintenance mode, and no out-of-scope integrations.

### General
- **Barangay Identity**: official **Barangay Name** shown across the system.
- **Language & Regional Format**: default system language (English / Filipino-Tagalog), timezone
  (Asia/Manila or UTC), and date format (YYYY-MM-DD / MM/DD/YYYY / DD/MM/YYYY / MMMM D, YYYY).

### IoT Thresholds
- **Global Sensor Threshold Defaults**: global smoke sensitivity (ppm), global **smoke persistence**
  (seconds), global decibel ceiling (dB), and global **noise persistence** (seconds) — mirroring the
  per-device threshold fields in IoT Provisioning. An amber note explains that these apply to
  *newly* registered devices; existing devices keep their individual limits until overridden.

### Notifications & Alerts
- **Escalation & Broadcast Rules**: automatic escalation timer (minutes before an unacknowledged
  incident escalates to the Admin) and geofence proximity radius (meters for resident mass alerts).
  Toggles: **Require Admin Approval for Broadcasts**, **Enable SMS Mass Broadcast**, **Enable Push
  Notifications**.
- **Notification Sound**: **Enable Notification Sounds** toggle, a **Default Volume Level** slider,
  and a **Test Sound** button that plays a sample tone at the current volume (disabled tones show a
  "Sounds Disabled" notice).
- **Notification Role Matrix**: which roles (Desk Officer, CCTV Operator, Tanod, Purok Leader)
  receive alerts at each severity level (Low / Medium / High / Critical) — click any cell to flip it.

### Security
- **Require Two-Factor Authentication** toggle scoped to the privileged roles (Admin / Captain /
  Desk Officer), with an explanatory note that 2FA is **mandatory per policy** for those roles
  (privileged accounts hold a **Pending 2FA** state in User Management until enrollment) and
  optional for all other roles.
- **Session Timeout** — minutes of inactivity before a signed-in session expires (default 30).
- A note clarifies that login protection (attempt lockouts) is **not implemented** in this prototype
  and is therefore not configurable here.

### Data Retention
- **Data Retention Schedule** — one row per data category (numeric value + **Days / Months / Years**
  unit), pre-populated with the approved initial targets: **Incident Records** (7 years),
  **CCTV Clip Footage** (1 year), **Application / Error Logs** (90 days), **Audit Logs** (10 years),
  **Raw IoT Telemetry** (90 days), **Notification Records** (1 year), **Patrol Checkpoint Logs**
  (2 years).
- **CCTV Clip Storage Warning Threshold** — percentage (default 85%, range 10–100) that drives the
  warning banner in CCTV Placement; saved through the shared `utils/cctvStorage.ts` store so the
  Placement screen updates live.
- A **retention-shortening** warning: shortening a period does **not** retroactively delete records
  under **active legal hold** or tied to **unresolved incidents** — purge jobs only reclaim records
  past their retention window.
- A **configuration values, not legal advice** notice: the retention values are scheduling inputs for
  this prototype, not legal advice; real periods must comply with applicable data protection laws.

### Purok Coordination
- **Module Status & Oversight**: an **Enable Purok Coordination Module** toggle, plus an
  in-scope note clarifying this covers the Purok Leader's validation-label and escalation
  capabilities (resident-organized watch-group membership and submission programs are out of scope).
- **Community-Validation Labels**: enable/disable each validation note Purok Leaders may apply to
  resident reports (advisory only — the Desk Officer retains final authority).

### Feature Flags
- **Module Feature Flags**: an enable/disable toggle for each whole existing module — CCTV, IoT
  Monitoring, Digital Boundaries, Patrol Management, Purok Coordination, SMS Mass Broadcast, Push
  Notifications, and Emergency Broadcast — each with a short description. A note states that
  experimental or out-of-scope capabilities (AI, facial recognition, predictive analytics, national
  emergency / PNP / 911 integration, drones, payments, multi-barangay tenancy) are not part of the
  prototype and are not configurable here.

### Save / Revert
- Footer bar: **Revert to Defaults** (restores retention, CCTV warning threshold, persistence, and
  session timeout) and **Save Settings** (both confirm with a **Settings Saved** / **Settings
  Reverted** modal and write a **Configuration Change** audit entry).

---

## End-to-end scenario (the Admin's day)

The nine screens form one administrative loop: **monitor → provision people → provision hardware →
place the eyes → map the territory → define the routes → tune the rules → honor the data → prove the
record**. Here is a representative day.

### 1. Monitor — Dashboard
The admin signs in (any non-special username routes to `admin`) and lands on **Dashboard**. The
**System Alerts** banner shows open alerts split across all four severities. The admin expands the
banner and **Pings** `SM-PUROK3-01` (240 ms latency — node is alive, likely a radio drop). The
**IoT Device Health** table confirms `SM-PUROK3-01` is the only red row; the **Infrastructure
Health** cards show
Database, Storage, Notification Service, and Backend/API all healthy at a glance; and the
**CCTV Availability** rail flags `CAM-MARKET-03` offline.

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
then runs the **Device Connection Test**, which confirms credential authentication, connectivity,
telemetry, and backend storage, and promotes the node to **Online** (§9.12). The
fleet status map is verified, and the admin tunes sensitivity in the **Threshold Configuration
Panel** — documenting the
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
a **Stream Reachability / Authentication / Response Time / Overall Result** PASS-FAIL breakdown and
marks the camera **Online** on success (a failed run keeps it Pending). Registration
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
lands on the map with its own **Boundary Created** audit entry. An obsolete sub-zone is later
**Archived** (retained as **Inactive** for historical references) instead of deleted — a **Boundary
Archived** entry — then **Restored** when it is needed again.

### 6. Define the routes — Patrol Routes & Checkpoints
On **Patrol Routes**, the admin creates a **Foot Patrol** route for the market district with a short
**description**, adds five numbered checkpoints along the stall front, configures each one (type,
stop duration, notes) through the checkpoint modal, and uses the chip-strip **arrows to reorder**
two checkpoints so the sequence matches the intended walking order. The validation banner is clear,
so **Saves** marks it **Active** (~2.1 km) and audits the change; undoing a stray click with
**Undo** is a no-op on the saved layout. Later the admin opens **Edit Route Info** to rename the
route and update its description. A draft **Riverside Flood Line** mobile route stays **Draft** until
the next patrol cycle, and its **Delete** is blocked while it remains referenced by active patrol
schedules. Throughout, the page offers **no patrol execution controls** — starting patrols, live
tracking, checkpoint verification, shift assignment, and attendance stay with the Desk Officer,
Captain, and Tanod roles.

### 7. Tune the rules — System Settings
In **System Settings**, the admin adjusts the escalation timer, flips the **Notification Role
Matrix** so CCTV Operator stops receiving low-severity alerts, disables **Push Notifications** via
the **Feature Flags** tab, and confirms the platform identity in **General**. The **Security** tab
keeps **Require Two-Factor Authentication** enforced for privileged roles and confirms the
**Session Timeout**. The **Data Retention** tab confirms the approved schedule (7-year incidents,
10-year audit trail, 90-day app/telemetry — with the **configuration values, not legal advice**
notice visible) and lowers the **CCTV Clip Storage Warning Threshold** to 80%. The **IoT
Thresholds** tab sets the global smoke/noise thresholds and their persistence durations, and the
**Purok Coordination** tab caps which validation labels leaders may use. Switching an edited tab
triggers the **Unsaved Changes** guard before **Save Settings** commits everything as a
**Configuration Change** audit entry.

### 8. Honor the data — Data Requests
Later, a resident files a **Deletion** request (`DR-007`, related to official blotter records under
`INC-2071`) and another an **Access** request (`DR-008`). The admin opens **Data Requests** and
drives the first through **Pending → In Review → Verified** (Verify records the related record), then
**Approve & Process** — the confirm modal restates that official incident/audit/evidence records
under retention are *anonymized rather than deleted* — and the personal account data is purged. For
`DR-007`-type deletions that cannot proceed because the records sit under an active investigation,
the admin toggles **Denied / Retention Required** so the fixed retention explanation is sent to the
requester. The second request is **Denied** with a required reason (no legal basis identified). All
decisions write **Data Request Processed** audit entries.

### 9. Prove the record — Audit Logs
Finally the admin opens **Audit Logs** — a read-only trail. The day's session shows in real time: the
user creation, the device registration and credential provisioning/replacement, the camera assignment
and connectivity tests, the boundary created/updated/archived entries, the patrol-route save and
route-info rename, the settings commit, the feature-flag flip, and the data-request decisions with
their **Result** (Success / Denied / Failed) and **Affected Record**. The admin filters by
**Boundary Created**, narrows by **date** and **actor**, then **Export CSV** to produce
`system-audit-logs.csv` for the council — an immutable, attributed record of every administrative
action, each tied to an admin email, role, action type, affected record, result, and IP address.

> Every artifact the admin touches — account, device, boundary, threshold, log — carries a
> consistent ID and an audit entry, so the platform trail reads back from a sensor's low battery to
> the connectivity test that verified it.

---

## Cross-cutting conventions

- **UI language** — all nine screens use the shared design system: `#0038A8` accent (hover
  `#002A8C`), `#E9EDFB` panel background, slate text tones (`#334155` / `#94A3B8` / `#64748B`), and a
  navy `#06122B` sidebar; `ConfirmModal` / `Modal` patterns, and centered confirmation/success
  modals for irreversible or notable actions (delete device, archive boundary, delete route, delete
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
- **Status conventions** — device status uses the shared `pending / online / offline` scale
  (§10.6.1): a **Pending** node becomes **Online** only after a
  passing connection-test acceptance check (§9.12), and **Low Battery** is a *derived* indicator from
  battery voltage, not a stored status. Disabled and **Decommissioned** power states are also derived
  (dimmed, off-map; decommissioning retains the record and its history, §10.1).
  Battery/signal meters reuse `batteryColor` / `signalColor` (`utils/colors.ts`), identical to the
  Captain's dashboard sensor readings. CCTV cameras add a **Pending** pre-Active state with its own
  status pill and map badge, and a compact **CCTV Availability** panel on the Dashboard
  mirrors the same online/offline/pending scale. Alerts follow the four-severity scale from §14.11
  (Critical / High / Warning / Informational).
- **Admin boundary** — the Admin owns *configuration, not operations*: no incident triage, no
  broadcast authorization, no incident dispatch, no field-maintenance dispatch, no CCTV footage
  review, no audit-record or blotter/incident deletion. The sole operational lever is
  **data-request processing** (anonymize/deny — never delete retained official records). Broadcast
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
