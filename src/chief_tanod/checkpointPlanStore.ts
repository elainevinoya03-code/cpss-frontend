import { useEffect, useState } from "react";
import {
  fetchCheckpointPlans,
  fetchCheckpointPlan,
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

function toFrontendPlan(saved: ApiCheckpointPlan): CheckpointPlan {
  return {
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
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|network ?error|load failed|network request failed/i.test(error.message))
  );
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /\(404\)|not found/i.test(error.message);
}

async function fetchServerCopy(planId: string, attempts = 3): Promise<ApiCheckpointPlan> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchCheckpointPlan(planId);
    } catch (error) {
      lastError = error;
      // A 404 is definitive (plan genuinely absent) — don't retry that.
      // Retry only dropped connections, briefly.
      if (!isNetworkError(error) || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError;
}

export async function upsertCheckpointPlan(plan: CheckpointPlan): Promise<CheckpointPlan> {
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
  // The backend bumps updated_at on every committed write — used below to
  // confirm whether an update actually landed.
  const attemptStartedAt = Date.now();
  const write = () =>
    existsLocal ? updateCheckpointPlan(plan.id, apiPlan) : createCheckpointPlan(apiPlan);

  let saved: ApiCheckpointPlan;
  try {
    saved = await write();
  } catch (error) {
    if (!isNetworkError(error)) {
      console.error("Failed to save checkpoint plan:", error);
      throw error;
    }
    // A dropped connection does NOT mean the write failed — the server may
    // have committed before the response was lost. Verify against the server
    // so the UI reports the true save status instead of a false "Failed".
    // No blind re-POST here: re-posting is unnecessary and risks confusion —
    // the write is idempotent, so confirming is enough.
    console.warn(`Save response lost for ${plan.id}, verifying with server…`, error);
    try {
      const serverCopy = await fetchServerCopy(plan.id);
      if (existsLocal) {
        const serverUpdated = serverCopy.updated_at
          ? new Date(serverCopy.updated_at).getTime()
          : NaN;
        if (Number.isNaN(serverUpdated) || serverUpdated < attemptStartedAt - 10_000) {
          // Server copy predates this attempt — our update never landed.
          console.error("Verified: update did not reach the server.", error);
          throw error;
        }
      }
      // Verified: the save actually landed — adopt the server version.
      console.info(`Verified: plan ${plan.id} is saved on the server.`);
      saved = serverCopy;
    } catch (verifyError) {
      if (verifyError !== error && !isNotFoundError(verifyError)) {
        console.error("Could not verify save status:", verifyError);
      } else if (isNotFoundError(verifyError)) {
        console.error(`Verified: plan ${plan.id} was not saved on the server.`, error);
      }
      console.error("Failed to save checkpoint plan:", error);
      throw error;
    }
  }

  // Convert back to frontend format
  const frontendPlan = toFrontendPlan(saved);

  // Update local state
  const exists = plans.some((p) => p.id === frontendPlan.id);
  plans = exists
    ? plans.map((p) => (p.id === frontendPlan.id ? frontendPlan : p))
    : [frontendPlan, ...plans];
  emit();
  return frontendPlan;
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
