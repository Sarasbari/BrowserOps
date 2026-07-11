/**
 * BrowserOps — BullMQ Queue Configuration
 * ═══════════════════════════════════════
 * Central queue setup for workflow execution.
 * Exports shared Redis connection for cancellation/signaling.
 */
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── Shared Redis Connection (for cancellation keys, etc.) ──
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  lazyConnect: true,
});

// Connect on first use (ignore errors during module load in test env)
redis.connect().catch(() => {});

// ── Workflow Execution Queue ──
export const workflowQueue = new Queue("workflow-execution", {
  connection: { url: REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // 7 days
      count: 1000,
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // 30 days
    },
  },
});

// ── Schedule Queue ──
export const scheduleQueue = new Queue("schedule-processor", {
  connection: { url: REDIS_URL },
});

export interface WorkflowJobData {
  runId: string;
  versionId: string;
  userId: string;
}

export interface ScheduleJobData {
  scheduleId: string;
  workflowId: string;
}

/**
 * Enqueue a workflow run for execution.
 */
export async function enqueueWorkflowRun(data: WorkflowJobData) {
  const job = await workflowQueue.add("execute", data, {
    jobId: data.runId,
    priority: 1,
  });
  return job;
}

/**
 * Remove a queued job by ID (for cancellation of QUEUED runs).
 * Returns true if the job was successfully removed, false otherwise.
 */
export async function removeJob(jobId: string): Promise<boolean> {
  try {
    const job = await workflowQueue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      if (state === "waiting" || state === "delayed") {
        await job.remove();
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Register a repeatable schedule.
 */
export async function registerSchedule(
  scheduleId: string,
  workflowId: string,
  cronExpr: string,
  timezone: string = "UTC"
) {
  const job = await scheduleQueue.add(
    "scheduled-run",
    { scheduleId, workflowId } satisfies ScheduleJobData,
    {
      repeat: { pattern: cronExpr, tz: timezone },
      jobId: scheduleId,
    }
  );
  return job;
}

/**
 * Remove a repeatable schedule.
 */
export async function removeSchedule(scheduleId: string, cronExpr: string) {
  await scheduleQueue.removeRepeatableByKey(
    `scheduled-run:${scheduleId}:::${cronExpr}:*`
  );
}

export { Worker, Job, REDIS_URL };
