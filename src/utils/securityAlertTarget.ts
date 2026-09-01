// Minimal deep-link signal: lets the Desk Officer dashboard open the Security
// Alert Center focused on a specific alert when an alert row is clicked.
// SecurityAlertCenter consumes it once on mount. `setSecurityAlertTarget(null)`
// or an empty string just opens the center without a specific highlight.
let pending: string | null = null;

export function setSecurityAlertTarget(id: string | null): void {
  pending = id ?? null;
}

export function consumeSecurityAlertTarget(): string | null {
  const t = pending;
  pending = null;
  return t;
}

export function peekSecurityAlertTarget(): string | null {
  return pending;
}
