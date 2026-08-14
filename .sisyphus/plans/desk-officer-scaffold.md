# Desk Officer Role — File Structure & Integration

## Context
Add a new "Desk Officer" role to the frontend. Create the folder/file structure mirroring `src/admin/` and `src/captain/`, then integrate into navigation, header, and login/routing. No page content — only placeholders.

## Conventions (from existing code)
- Folder: `src/admin/`, `src/captain/` → create `src/desk_officer/`
- Filenames: `snake_case.tsx`, e.g. `iot_provisioning.tsx`, `emergency_broadcast.tsx`
- Each folder has an `index.ts` barrel file with named exports
- Sidebar nav items: `{ key, label, icon }` from lucide-react
- App.tsx: `handleLogin(e, nextRole)` determines role from username/login logic

---

## Files to Create

### 1. `src/desk_officer/dashboard.tsx`
Placeholder component with header "Dashboard Overview" (matching admin pattern).

### 2. `src/desk_officer/iot_alert_command_center.tsx`
Placeholder component with header "IoT Alert Command Center".

### 3. `src/desk_officer/active_dispatches.tsx`
Placeholder component with header "Active Dispatches".

### 4. `src/desk_officer/patrol_scheduler_routes.tsx`
Placeholder component with header "Patrol Scheduler & Routes".

### 5. `src/desk_officer/digital_blotter.tsx`
Placeholder component with header "Digital Barangay Blotter".

### 6. `src/desk_officer/operations_chat_center.tsx`
Placeholder component with header "Operations Chat Center".

### 7. `src/desk_officer/index.ts`
Barrel exports:
```
export { default as DeskOfficerDashboard } from "./dashboard";
export { default as IotAlertCommandCenter } from "./iot_alert_command_center";
export { default as ActiveDispatches } from "./active_dispatches";
export { default as PatrolSchedulerRoutes } from "./patrol_scheduler_routes";
export { default as DigitalBlotter } from "./digital_blotter";
export { default as OperationsChatCenter } from "./operations_chat_center";
```

---

## Files to Modify

### 8. `src/components/layout/sidebar.tsx`
Add `DESK_OFFICER_NAV_ITEMS` array with 6 nav items:
- `dashboard` → Dashboard (LayoutGrid)
- `iot_alerts` → IoT Alert Command Center (AlertTriangle)
- `dispatches` → Active Dispatches (Radio)
- `patrol` → Patrol Scheduler & Routes (Map)
- `blotter` → Digital Barangay Blotter (FileText)
- `chat` → Operations Chat Center (MessageSquare)

Update component logic:
- `items` selection: add `role === "desk_officer"` check
- `sectionLabel`: add "DESK OFFICER MENU" for desk_officer role
- Header subtitle: add "DESK OFFICER VIEW" for desk_officer role
- Import `MessageSquare` from lucide-react

### 9. `src/components/layout/header.tsx`
No changes needed — Header already accepts `initials`, `label`, `sublabel` as props and renders them generically. The role-specific values are set in App.tsx.

### 10. `src/App.tsx`
- Import desk_officer barrel exports
- Add `DESK_OFFICER_NAV` array: `["dashboard", "iot_alerts", "dispatches", "patrol", "blotter", "chat"]`
- Update `canAccess()` to include desk_officer role
- Update `handleLogin()` to recognize `"desk_officer"` role (derive from username pattern, e.g. `"desk"` → `"desk_officer"`)
- Add `currentInitials`, `currentLabel`, `currentSubLabel` for desk_officer
- Add rendering block for desk_officer role pages

### 11. `src/pages/login.tsx`
No changes needed — login.tsx passes raw username to `onLogin`. Role detection happens in App.tsx's `handleLogin` (username-based: `desk` prefix → desk_officer role).

---

## Verification
- TypeScript compiles without errors
- Sidebar renders 6 desk officer nav items when role is "desk_officer"
- Login with username "desk" routes to desk_officer role
- All 6 placeholder pages render without crashing
