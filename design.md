# CPSS Frontend — UI/UX Design Document

## Design Goals

The Community Policing Surveillance System (CPSS) is a real-time, command-center style application for barangay public safety. The UI is designed to support **rapid situational awareness and decisive action** during emergencies.

Four core goals drive every screen:

1. **Clarity under pressure** — Dense data is organized into scannable cards, tables, and queues so responders can act within seconds.
2. **Color = meaning** — A strict, consistent severity/status color language means operators decode urgency instantly without reading text.
3. **Progressive disclosure** — Dashboards show summaries; details live in modals/drawers opened on demand.
4. **Role-scoped focus** — Each of the five roles sees only the tools and data relevant to them.

---

## Tech Stack (Frontend)

| Layer | Technology |
| ----- | ---------- |
| Framework | **React 19** with TypeScript |
| Build tool | **Vite 8** (`@vitejs/plugin-react`) |
| Styling | **Tailwind CSS 4** (`@tailwindcss/vite` plugin, utility-first, no config file) |
| Icons | **lucide-react** |
| Testing | **Vitest** + **jsdom** + **@testing-library/react** |
| Linting | **ESLint 10** (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) |
| Routing | State-based view switching in `App.tsx` (login → role dashboards) |

> Real-time "live" data (pulse, beep, jitter) is simulated with actor/mock stores, designed to map onto future WebSocket/streaming data (§ Notes / Known Gaps).

---

## Design Tokens

All values below are observed conventions used across screens (no centralized theme file; defined per-component).

### Color Palette

| Token | Hex | Usage |
| ----- | --- | ----- |
| **Brand Navy** | `#0038A8` | Primary actions, key values, links, active states, avatar accents |
| **Brand Navy (hover)** | `#002A8C` | Primary button hover |
| **Deep Navy Shell** | `#06122B` | Sidebar / login-left-panel background |
| **App Background** | `#E9EDFB` | Main content + header background (soft periwinkle) |
| **Surface (Card)** | `#FFFFFF` | Cards, tables, modals |
| **Muted surface** | `#F1F5F9` / `#F8FAFC` | Inputs, table row hover, quiet fills |
| **Ink** | `#334155` (slate-700) | Primary text on cards |
| **Muted text** | `#94A3B8` / `#64748B` | Labels, timestamps, descriptions |

### Severity / Status Semantics (Consistent Across Roles)

| Meaning | Badge / Chip | Dot |
| ------- | ------------ | --- |
| **Critical** | `rose` (`rose-50`/`rose-700`) | `rose-500` |
| **High / Emergency** | `orange` or `red` | `orange-500` / `rose-500` |
| **Warning / Pending / Medium** | `amber` | `amber-400` |
| **Info / In-progress / Low** | `sky` | `sky-400` |
| **Healthy / Online / Resolved** | `emerald` | `emerald-500` |
| **Closed / False alarm / Neutral** | `stone` | `stone-400` |
| **Maintenance** | `orange` | `orange-500` |

> Convention: **dot = quick scan, chip/badge = qualified label.** A status dot appears next to names in lists and maps; chips appear in tables, queues, and modals.

### Typography

- **Base font**: system stack (`Inter`, `-apple-system`, `Segoe UI` on login; Tailwind default elsewhere).
- **Screen title**: `text-2xl font-bold` (stone-900/ink).
- **Section title**: `text-[13px] font-semibold uppercase tracking-wider` with muted (often `#94A3B8`) subtitle.
- **Labels above fields**: `text-[10px] font-semibold tracking-wider uppercase`, muted.
- **KPI value**: `text-[26px] font-bold` in brand navy `#0038A8`.
- **Body/labels**: 10–13px on dense dashboards; 15–18px on the login form (larger for a public-facing touch).

### Radius, Elevation, Spacing

- **Cards / modals / inputs**: `rounded-xl` (12px); small buttons `rounded-lg` (8px); pill status chips `rounded-full`.
- **Cards**: `border border-black/5 shadow-sm`.
- **Danger / focus rings**: 3px `rgba(0,56,168,0.12)` when focused; `rgba(220,38,38,0.12)` for errors.
- **Page padding**: `px-3 py-4` mobile → `px-6 py-6` desktop.
- **Section rhythm**: `mb-6` (24px) between sections.

### Iconography

- `lucide-react` stroke icons (16px in section headers/list rows, 18px in card headers, 11–13px in chips/buttons).
- Icons sit inside `rounded-lg` soft brand-tinted chips (`bg-[#E9EDFB] text-[#0038A8]`, or category-colored like `bg-rose-50 text-rose-600`).

---

## Layout System

Three zones compose every logged-in screen:

```
┌──────────┬───────────────────────────────────────┐
│ Sidebar  │  Header (toggle · clock · notif ·    │
│ #06122B  │  profile menu)                        │
│ (nav)    ├───────────────────────────────────────┤
│          │  Page (bg #E9EDFB, scrollable)        │
```

### Sidebar
- Deep navy `#06122B` rail with white/10 logo chip and brand text **"Community Policing · SURVEILLANCE SYSTEM"**.
- **Desktop**: `260px` expanded, collapses to `68px` icon-rail; active item = `bg-white/15 text-white font-medium` + chevron indicator; idle items `text-white/70 hover:bg-white/10`.
- **Mobile**: off-canvas overlay (`260px`), 40% black scrim, closes on backdrop tap; hamburger in header toggles.
- Each role gets its own nav set and uppercase section label (e.g., "DESK OFFICER MENU", "EXECUTIVE OVERSIGHT").

### Header
- Background same as page (`#E9EDFB`), `border-b border-black/5`.
- Left: hamburger (mobile/docked). Right: live clock (e.g., `Wed, Jul 20 · 10:14 AM`, updates every second), notification bell with rose badge dot, and profile chip (initials avatar `bg-[#0038A8]/10 text-[#0038A8]`, role label + sublabel, chevron). Dropdown contains Logout (red, hover `bg-red-50`).

---

## Key Screens — UI/UX Walkthrough

### 1. Login (`pages/login.tsx`)

**Layout**: Full-viewport split-screen. Left panel (desktop+) is a full-bleed Culiát barangay photo under a **90% deep-navy overlay**; right panel is white and houses the form.

**Left panel (branding story)**
- Header hierarchy: `BARANGAY CULIAT` (extrabold, clamp 24–42px) → `DISTRICT 6 QUEZON CITY` (tracked widest) → `Public Safety and Security System` (largest, clamp 28–48px) → supporting tagline.
- Panel slides in with a soft entrance (`translateX(-40px) → 0`, 0.9s cubic-bezier) after 200ms.

**Right panel (form)**
- Logo (~120–160px) above "Welcome Back!" (`#0038A8`, clamp 28–40px) and "Please sign in to continue".
- Elements stagger-in (`translateY(20px)`, 0.7s, 150ms cascade delays) for a composed entrance.
- **Username** & **Password** fields: 1.5px border, `#F1F5F9` fill, large py (16–20px). Focus → brand border + 3px brand-glow ring; error → `#dc2626` border + red glow.
- **Password**: eye toggle (Eye/EyeOff) reveals/hides; hides while loading/success.
- **Validation**: inline error rows with `AlertCircle` icon + message; invalid field plays a **shake animation** (0.4s), clears on typing.
- **Primary CTA**: full-width `#0038A8`, `rounded-xl`, bold. States → idle "Sign In" → loading (spinner + "Signing in…", button scales down) → success (`CheckCircle` + "Success!") for ~1.2s, then redirects.
- After success, a green success banner with `CheckCircle` appears above the fields ("Login successful! Redirecting...").

### 2. Admin Dashboard (`admin/dashboard.tsx`)

**"System administration and infrastructure health" command center.**

- **Header**: title + subtitle, followed by a `SectionTitle` per block (uppercase label + muted sub + optional "View All" link).
- **System Overview — KPI cards** (4 across on `lg`): white card, `label` small muted uppercase, icon chip top-right (brand tint), **big brand-navy value**, muted sub-line. Cards are **clickable** navigation shortcuts — hover border becomes `#0038A8]/30`, an `ArrowUpRight` affordance fades in.
- **Device Health**: two-column panel (`IoT Device Health` table + `CCTV Availability` list).
  - Header row: icon + "IoT Device Health" + count sub; right-side "Open IoT Provisioning" link.
  - **Status count chips** across the top (e.g., "5 Online · 2 Offline …"), each dot-prefixed.
  - **Table** columns: DEVICE NAME, TYPE, STATUS, BATTERY, LAST PING, ACTIONS. Rows `border-b border-black/5`, hover `#F8FAFC`. Battery shown as mini progress battery (color = `batteryColor()` helper) + %; status = dot + chip (clickable chip when "Maintenance Required").
  - **Ping action**: small bordered button with Zap icon → spinner while pinging → `ConfirmModal` result.
  - **CCTV Availability**: grouped list rows (dot, id, `name · purok`, status chip, last-seen); scroll area `max-h-72`, compact 10px meta text.
- **Infrastructure Health**: 4 service cards, each with icon chip + status pill; derived live from storage config (crosses `warnThresholdPct` → warning).
- **System Alerts**: severity-colored banner — `critical` rose `→ high` orange `→ warning` amber `→ informational` sky. Collapsible (`ChevronDown/Up`). Expanded list = severity-bordered alert rows; each shows title, severity pill, reason, timestamp, and a context action ("Ping" for IoT, "Details" for others). Details open a **Modal** with metadata grid (CATEGORY, DETECTED, SOURCE IP) + an **Escalation Routing (§14.12)** info callout.
- **Recent Audit Activity**: timeline rows (`#0038A8` dot + description + timestamp/admin + color-coded action pill), "Open Audit Logs" footer link.

### 3. Captain Dashboard (`captain/dashboard.tsx`)

**"Executive Safety Dashboard" — real-time community safety, patrol & hazard oversight.**

- **Header row**: title + a **"Mass Alert"** primary button (`Megaphone`); below, a **segmented control** (`Overview` / `Operational Reports`) in a white pill.
- **Toolbar row**: **time range segmented control** (`Today / 7D / 30D / All Time`), a **Filters** dropdown (category + purok chip groups inside a white popover), and **Reset**.
- **KPI row** (5 across on `lg`): same card anatomy as admin, except the first card (Active Incidents) **pulses with a rose ring + sound** when a new critical/emergency incident arrives. Includes AVG RESPONSE TIME, RESOLVED CASES, FALSE ALARM RATIO, SENSORS ONLINE.
- **Sensor & Hazard Map** (2/3 width, fixed 460px height): **SVG-drawn purok boundaries** in `#F8FAFC`, zoned with colored strokes. Hazards tint zones `#fef2f2` + red stroke; an animated `animate-ping` halo marks tracked sensors near threshold; warning/offline sensors get a small **"!" verification badge**. Tanod teams render as navy "T" pins (toggleable via "Tanod Units" chip, with legend = Online/Warning/Offline dots). Hover → map tooltip card (name, reading/threshold, status). Click sensor → **SensorDetail modal** (reading bar with danger color thresholds, Ping Device / Telemetry Logs). Zone hover highlights polygons + incident count bubble.
- **Active Incident Queue** (1/3): scrollable list of open incidents; each row = severity dot, category icon, description, meta, and the row opens the **Incident Review drawer** (`Modal side="right" size="lg"`).
- **Incident Review drawer**: severity + verification pills in header, verification callout (pulsing while pending), **2-column staked field grid** (CURRENT STATUS / SEVERITY / SOURCE / DATE / PUROK / LOCATION / REPORTED BY / RESPONSE STATUS), evidence thumbnails placeholder, "DESK OFFICER UPDATE" callout, and footer actions: **Request Follow-up** (secondary) + **Prepare Broadcast** (primary, hidden if resolved).
  - **Request Follow-up modal**: incident summary bar + "REASON / REQUEST" textarea, "Send Request" disabled until text; flash-toast confirms.
  - **Prepare Broadcast** hands off to `EmergencyBroadcast` compose/authorize flows (`ComposeBroadcastModal` → `AuthorizeBroadcastModal`) with success state + history.
- **Purok Incident Breakdown** sidebar panel: stacked horizontal stacked-bar charts per purok (rose/amber/sky/emerald segments) with legend.

### 4. Desk Officer Dashboard (`desk_officer/dashboard.tsx`)

**"Command & Monitoring Center" — the busiest operational surface.**

- **Boot / resilience UX**: 650ms **loading skeleton** (pulsing card blocks) on mount; **offline banner** (`amber-50`, "Connection interrupted — showing last received data") when `navigator.onLine` goes false; **section-level error cards** with Retry button for failed live feeds; reconnection triggers a "Reconnected — live data refreshed" success toast.
- **Live data feel**: sensor values jitter every 4s, timestamps format as relative time ("2 min ago", "3h ago"), and new High/Emergency incidents trigger a **rhythm: card pulse ring + `beep()` alert sound + priority toast + auto-initiated urgent CCTV footage request**.
- **Attention / Priority queue**: rank-ordered tickets (Emergency/SOS → High → New → undispatch → follow-up) with urgency chips (`Emergency = red`, `High = rose`, `Medium`/`Low` = amber/sky), status badges, team assignment, and a contextual CTA per tier ("Respond immediately", "Assign & dispatch response", "Triage new report", "Review urgent video request").
- **Summary cards**: accent-colored icon chips + value + sub; `live` edge indicators; critical card gets `priority` styling and rings when emergencies arrive.
- **Quick-compose actions** reachable in-module, all as modals:
  - **Compose Mass Broadcast**: severity segmented control (Info/quiet push vs High = push+SMS to geofence), message textarea, confirm modal that routes High-severity to **Captain 1-tap authorization**.
  - **Create Security Alert / Publish Safety Notice**: severity + target audience (residents/tanods/neighborhood watch), title/category/target zone (Entire Barangay vs Specific Purok via datalist), optional incident link; High-severity security alerts require Punong Barangay approval (amber CTA).
  - **Create Manual Incident**: jargon-light wizard — category chips, purok, severity + priority segmented controls, description, reporter, notes; live info callout that changes by urgency; confirm modal summarizes before creation.
  - **Anonymous Report Lookup**: tracking-token lookup field (mono font), explanatory copy about masked reporter identity, sample "ANONYMOUS REGISTRY" tokens.
- Other panels include the live incident map, active field responses (dispatch → team → CCTV clip status), sensor alert status, recent activity feed, and pending footage requests — reusing the same card/queue/chip patterns.

---

## Shared Component Patterns

### Cards
- Anatomy: header row (`icon chip` + `13px semibold title` + `11px muted sub` + optional action link) → body. `border border-black/5 bg-white rounded-xl shadow-sm`.
- KPI variant: label-top, value `26px bold brand-navy`, muted sub, top-right icon chip; optional click-to-navigate with hover affordance.

### SectionTitle
- `13px semibold uppercase tracking-wider` heading + `11px muted` subtitle; right-aligned "View All" / "Open …" link (brand navy, hover underline). Used identically across admin, captain, and desk-officer screens → consistent vertical rhythm.

### Buttons
- **Primary**: `bg-[#0038A8] text-white rounded-lg font-semibold` → hover `#002A8C`; often with leading lucide icon (16–20px height rows).
- **Secondary**: `border border-stone-200 bg-white text-stone-900` → hover `bg-stone-50`.
- **Danger CTA** (High-severity actions): `bg-rose-600` → `hover:bg-rose-700`.
- **Ghost/link**: brand-navy text, `hover:underline`; used for "View All".
- Deterministic padding: dense panels `px-2 py-1`, row buttons `h-7/h-10`.
- Disabled = `opacity-40/50`; loading = inline spinner.

### Status Chips / Badges
- Pill (`rounded-full px-2 py-0.5` to `px-2.5 py-1`), soft tinted bg + saturated low-700 text, optional leading dot (`h-1.5 w-1.5 rounded-full`) or 11px lucide icon. Pending/attention states **pulse the dot** (`animate-pulse`).

### Segmented Controls & Filter Chips
- White pill container (`border border-black/10 bg-white p-1`) with pill options; **active option = `bg-[#0038A8] text-white`**, idle = `text-stone-500 hover:bg-stone-100`. Used for tabs, time ranges, category/purok filters, severity selectors.

### Modals & Drawers (`components/ui/Modal.tsx`)
- Center modal sizes `sm/md/lg`; **right-side drawer** via `side="right"` (Incident Review). Header = icon + title + subtitle; footer hosts action buttons (show/hide per context); body scrolls on overflow.
- `ConfirmModal`: `type="confirm"`, `tone="primary"|"danger"`, explicit `confirmLabel`/`cancelLabel` ("Send Broadcast", "Back"). Danger tone surfaces `rose` accent.
- Entrance animation: `modal-in` / `drawer-in` (0.18–0.2s fade+drift).

### Toasts (`hooks/useToast.tsx`)
- Slide-in bottom/corner toast with `title` + `flash(message)` body; auto-dismiss progress bar (`toast-progress`, 6s linear), `toast-in` animation. Tone variants: `success` (emerald), plus default/`type` for alerts. Tied to `useAlertSound` beep on critical.

### Feedback & Empty States
- **Loading**: skeleton card blocks (pulsing) for boot; inline spinners for in-flight actions.
- **Errors**: dashed rose-bordered section card with centered icon, "…unavailable" title, explanation, and Retry button; persistent connectivity banner while offline.
- **Empty**: centered muted text ("No active incidents") in whitespace; never a broken-looking blank.

### Microcopy & Wording Tone
- Tech-consistent nouns: *unchanged* — "Request Follow-up", "Prepare Broadcast", "Assign & dispatch response", "Issue All-Clear".
- Uppercase tracking-wider labels act as tiny group headers for fields/table columns, keeping dense screens legible.
- Numbers formatted (`26px bold`) in `#0038A8` read instantly as the "answer" on every KPI card.

---

## Interaction & Motion Guidelines

| Purpose | Behavior |
| ------- | -------- |
| Page entry | Staggered fade + translate-up (login) or immediate content (dashboards) |
| Navigation | Immediate pending-delay guard: dirty forms trigger a **discard-confirm dialog** before leaving (nav guard) |
| Danger signals | Realtime: critical incident → card pulse + beep + toast; pending verification dots pulse |
| Hover affordance | Clickable filters/chips/cards shift border color + reveal directional arrow (`ArrowUpRight`) |
| Confirm heavy actions | Every irreversible send (`broadcast`, `publish`, `dispatch`) requires `ConfirmModal` with severity-specific tone |
| Duration | Micro-interactions 150–300ms `ease-out`; entrances ~0.7–0.9s cubic ease |

---

## Accessibility Notes

- All icon buttons carry `aria-label` (sidebar toggle, password reveal, notification).
- Icons are paired with text labels citywide (labels not icon-only).
- Status uses **tint + dot + text** triple encoding (never color alone).
- Focus is always explicit: branded glow ring on inputs, `outline-none` replaced with ring on form fields.
- Interactive rows/buttons have adequate hit targets (h-8 to h-10) and hover/disabled states.
- Motion is auto-triggered on mount (login entrances) but alert pulses are time-limited (2–5s) to reduce distraction.

---

## Notes / Known Gaps

- Status colors live inline per-file (no centralized semantic token map) — recommend a `theme/status.ts` export to guarantee cross-role consistency.
- Accessibility polish (focus trap in drawers, `prefers-reduced-motion`) is not yet implemented.
- Real-time data is simulated with actor/mock stores; the "live" affordances (pulse, beep, jitter) are designed to map 1:1 onto future WebSocket/streaming data.