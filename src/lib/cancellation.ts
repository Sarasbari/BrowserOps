/**
 * BrowserOps — Run Cancellation via Redis
 * ════════════════════════════════════════
 * Uses Redis keys to signal cancellation to running workers.
 * Workers check between steps; queued jobs are removed directly.
 */
import { redis } from "./queue";
import { prisma } from "./prisma";

const CANCEL_KEY_PREFIX = "browserops:cancel:";
const CANCEL_TTL_SECONDS = 300; // 5 minutes

/**
 * Request cancellation of a run.
 * Sets a Redis key that the worker checks between steps.
 */
export async function requestCancellation(runId: string): Promise<void> {
  await redis.set(
    `${CANCEL_KEY_PREFIX}${runId}`,
    "1",
    "EX",
    CANCEL_TTL_SECONDS
  );
}

/**
 * Check if a run has been cancelled.
 * Checks Redis first (fast), then falls back to DB status.
 */
export async function isCancelled(runId: string): Promise<boolean> {
  // Fast path: check Redis
  const cancelled = await redis.get(`${CANCEL_KEY_PREFIX}${runId}`);
  if (cancelled === "1") return true;

  // Slow path: check DB (handles edge case where Redis key expired)
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  return run?.status === "CANCELLED";
}

/**
 * Clear cancellation key after run finishes (cleanup).
 */
export async function clearCancellation(runId: string): Promise<void> {
  await redis.del(`${CANCEL_KEY_PREFIX}${runId}`);
}

/**
 * Mark remaining PENDING step logs as SKIPPED for a cancelled run.
 */
export async function skipRemainingSteps(runId: string): Promise<void> {
  await prisma.runStepLog.updateMany({
    where: {
      runId,
      status: "PENDING",
    },
    data: {
      status: "SKIPPED",
      completedAt: new Date(),
    },
  });
}

/**
 * Custom error class for cancellation — not retried by BullMQ.
 */
export class CancellationError extends Error {
  constructor(runId: string) {
    super(`Run ${runId} was cancelled`);
    this.name = "CancellationError";
  }
}
