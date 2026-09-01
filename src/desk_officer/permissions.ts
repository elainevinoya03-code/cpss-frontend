// Role-based permissions matrix and access control helpers for Desk Officer blotter and operations.

export type BlotterRole = "desk_officer" | "captain" | "staff";

export type PermissionKey =
  | "convert_resolved_incidents"
  | "export_authorized_records"
  | "generate_official_reports"
  | "view_oversight_metrics"
  | "verify_incident"
  | "assign_responder"
  | "escalate_incident"
  | "archive_record"
  | "edit_blotter"
  | "delete_blotter"
  | "view_gps";

export const ROLE_PERMISSIONS: Record<BlotterRole, PermissionKey[]> = {
  desk_officer: [
    "convert_resolved_incidents",
    "export_authorized_records",
    "generate_official_reports",
    "view_oversight_metrics",
    "verify_incident",
    "assign_responder",
    "escalate_incident",
    "archive_record",
    "edit_blotter",
    "view_gps",
  ],
  captain: [
    "convert_resolved_incidents",
    "export_authorized_records",
    "generate_official_reports",
    "view_oversight_metrics",
    "verify_incident",
    "assign_responder",
    "escalate_incident",
    "archive_record",
    "edit_blotter",
    "delete_blotter",
    "view_gps",
  ],
  staff: [
    "generate_official_reports",
  ],
};

let currentRole: BlotterRole = "desk_officer";

export function getCurrentRole(): BlotterRole {
  return currentRole;
}

export function setCurrentRole(role: BlotterRole): void {
  currentRole = role;
}

export function hasPermission(permission: PermissionKey, role: BlotterRole = currentRole): boolean {
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  return allowed.includes(permission);
}

export function getRolePermissions(role: BlotterRole): PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function shouldAnonymizeReporter(incidentAnonymous?: boolean, role: BlotterRole = currentRole): boolean {
  if (role === "captain" || role === "desk_officer") {
    // Authorized roles can view reporter unless strictly anonymized
    return Boolean(incidentAnonymous);
  }
  return true;
}

export function canViewGPS(role: BlotterRole = currentRole): boolean {
  return hasPermission("view_gps", role);
}
