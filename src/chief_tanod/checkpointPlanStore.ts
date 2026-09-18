import { useEffect, useState } from "react";
import {
  fetchCheckpointPlans,
  createCheckpointPlan,
  updateCheckpointPlan,
  deleteCheckpointPlan,
  type CheckpointPlan as ApiCheckpointPlan,
} from "./patrolConfigurationApi";
import { type CheckpointPlan } from "./patrolShared";

let plans: CheckpointPlan[] = [];
let isLoading = false;
let hasLoaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

async function loadPlans() {
  if (isLoading || hasLoaded) return;
  isLoading = true;
  try {
    const apiPlans = await fetchCheckpointPlans();
    // Convert from backend snake_case to frontend camelCase
    plans = apiPlans.map((plan) => ({
      ...plan,
      targetArea: plan.target_area,
      linkedIncidentIds: plan.linked_incident_ids,
      submittedBy: plan.submitted_by,
      submittedAt: plan.submitted_at,
      decidedBy: plan.decided_by,
      decidedAt: plan.decided_at,
      revisionComment: plan.revision_comment,
      rejectionReason: plan.rejection_reason,
      approvalComments: plan.approval_comments,
      createdAt: plan.created_at,
      coverage: {
        pct: plan.coverage.pct,
        covered: plan.coverage.covered,
        total: plan.coverage.total,
        window: plan.coverage.window,
      },
    }));
    hasLoaded = true;
    emit();
  } catch (error) {
    console.error("Failed to load checkpoint plans:", error);
  } finally {
    isLoading = false;
  }
}

export function getCheckpointPlans(): CheckpointPlan[] {
  return plans;
}

export function subscribeCheckpointPlans(fn: () => void): () => void {
  listeners.add(fn);
  if (!hasLoaded) {
    loadPlans();
  }
  return () => {
    listeners.delete(fn);
  };
}

export async function upsertCheckpointPlan(plan: CheckpointPlan): Promise<CheckpointPlan> {
  try {
    // Transform the plan to match backend API format
    const apiPlan = {
      ...plan,
      target_area: plan.targetArea,
      linked_incident_ids: plan.linkedIncidentIds,
      submitted_by: plan.submittedBy,
      submitted_at: plan.submittedAt,
      decided_by: plan.decidedBy,
      decided_at: plan.decidedAt,
      revision_comment: plan.revisionComment,
      rejection_reason: plan.rejectionReason,
      approval_comments: plan.approvalComments,
      created_at: plan.createdAt,
      updated_at: plan.createdAt, // backend will override
      coverage: {
        pct: plan.coverage.pct,
        covered: plan.coverage.covered,
        total: plan.coverage.total,
        window: plan.coverage.window,
      },
    } as ApiCheckpointPlan;

    // Decide create vs update by whether the plan already exists in the
    // backend (i.e. was loaded or previously saved), NOT by id truthiness —
    // new plans carry freshly generated ids too.
    const existsLocal = plans.some((p) => p.id === plan.id);
    const saved = existsLocal
      ? await updateCheckpointPlan(plan.id, apiPlan)
      : await createCheckpointPlan(apiPlan);
    
    // Convert back to frontend format
    const frontendPlan: CheckpointPlan = {
      ...saved,
      targetArea: saved.target_area,
      linkedIncidentIds: saved.linked_incident_ids,
      submittedBy: saved.submitted_by,
      submittedAt: saved.submitted_at,
      decidedBy: saved.decided_by,
      decidedAt: saved.decided_at,
      revisionComment: saved.revision_comment,
      rejectionReason: saved.rejection_reason,
      approvalComments: saved.approval_comments,
      createdAt: saved.created_at,
    };
    
    // Update local state
    const exists = plans.some((p) => p.id === frontendPlan.id);
    plans = exists 
      ? plans.map((p) => (p.id === frontendPlan.id ? frontendPlan : p)) 
      : [frontendPlan, ...plans];
    emit();
    return frontendPlan;
  } catch (error) {
    console.error("Failed to save checkpoint plan:", error);
    throw error;
  }
}

export async function removeCheckpointPlan(id: string) {
  try {
    await deleteCheckpointPlan(id);
    plans = plans.filter((p) => p.id !== id);
    emit();
  } catch (error) {
    console.error("Failed to delete checkpoint plan:", error);
    throw error;
  }
}

export function getApprovedCheckpointPlans(): CheckpointPlan[] {
  return plans.filter((p) => p.status === "approved");
}

export function useCheckpointPlans(): CheckpointPlan[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeCheckpointPlans(() => setTick((t) => t + 1));
    return unsubscribe;
  }, []);
  return plans;
}
