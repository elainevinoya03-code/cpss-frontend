// Deep-link signal: lets Checkpoint Planning open a specific approved plan
// inside the Patrol Schedule wizard. PatrolScheduling consumes the signal
// once on mount.
//

export interface PatrolScheduleTarget {
  planId: string;
}

let pending: PatrolScheduleTarget | null = null;

export function setPatrolScheduleTarget(target: PatrolScheduleTarget): void {
  pending = target;
}

export function consumePatrolScheduleTarget(): PatrolScheduleTarget | null {
  const t = pending;
  pending = null;
  return t;
}