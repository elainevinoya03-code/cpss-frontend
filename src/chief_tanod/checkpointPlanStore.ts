import { useEffect, useState } from "react";
import { SEED_PLANS, type CheckpointPlan } from "./patrolShared";

let plans: CheckpointPlan[] = SEED_PLANS.map((p) => ({ ...p, points: p.points.map((pt) => ({ ...pt })), routes: p.routes?.map((r) => ({ ...r, points: r.points.map((pt) => ({ ...pt })) })) }));
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getCheckpointPlans(): CheckpointPlan[] {
  return plans;
}

export function subscribeCheckpointPlans(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function upsertCheckpointPlan(plan: CheckpointPlan): CheckpointPlan {
  const exists = plans.some((p) => p.id === plan.id);
  plans = exists ? plans.map((p) => (p.id === plan.id ? plan : p)) : [plan, ...plans];
  emit();
  return plan;
}

export function removeCheckpointPlan(id: string) {
  plans = plans.filter((p) => p.id !== id);
  emit();
}

export function getApprovedCheckpointPlans(): CheckpointPlan[] {
  return plans.filter((p) => p.status === "approved");
}

export function useCheckpointPlans(): CheckpointPlan[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribeCheckpointPlans(() => setTick((t) => t + 1)), []);
  return plans;
}
