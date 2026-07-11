/**
 * BrowserOps — BullMQ Worker
 * ══════════════════════════
 * Processes queued workflow runs using the Playwright executor.
 * Run as a separate process: `npm run worker`
 *
 * Features:
 * - Idempotency: skips completed/cancelled runs on retry
 * - Cancellation: checks Redis key between steps
 * - Schedule worker enqueues into the normal execution queue
 */
import { Worker, Job, REDIS_URL } from "../lib/queue";
import type { WorkflowJobData, ScheduleJobData } from "../lib/queue";
import { enqueueWorkflowRun } from "../lib/queue";
import { executeWorkflow } from "../lib/executor";
import { prisma } from "../lib/prisma";
import { CancellationError } from "../lib/cancellation";

console.log("🚀 BrowserOps Worker starting...");

// ── Workflow Execution Worker ──
const workflowWorker = new Worker(
  "workflow-execution",
  async (job: Job<WorkflowJobData>) => {
    const { runId } = job.data;
    console.log(`▶ Processing job ${job.id} for run: ${runId}`);

    // ── Idempotency check ──
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });

    if (!run) {
      console.log(`⚠ Run ${runId} not found, skipping`);
      return { skipped: true, reason: "run_not_found" };
    }

    if (run.status === "COMPLETED" || run.status === "CANCELLED") {
      console.log(`⏭ Run ${runId} already ${run.status}, skipping duplicate delivery`);
      return { skipped: true, reason: `already_${run.status.toLowerCase()}` };
    }

    // Update the run with the BullMQ job ID
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { jobId: job.id },
    });

    const result = await executeWorkflow(runId);

    if (result.cancelled) {
      console.log(`🚫 Run ${runId} was cancelled`);
      // Don't throw — cancellation is not a failure to retry
      return result;
    }

    if (result.success) {
      console.log(
        `✅ Run ${runId} completed: ${result.stepsCompleted}/${result.stepsTotal} steps in ${result.durationMs}ms`
      );
    } else {
      console.log(
        `❌ Run ${runId} failed at step ${result.stepsCompleted + 1}/${result.stepsTotal}: ${result.failureReason}`
      );
      throw new Error(result.failureReason); // Trigger BullMQ retry
    }

    return result;
  },
  {
    connection: { url: REDIS_URL },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3"),
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute
    },
  }
);

// ── Schedule Worker ──
// Enqueues into the normal workflow execution queue instead of calling
// executeWorkflow directly. This ensures scheduled runs go through the
// same idempotency/cancellation pipeline as manual runs.
const scheduleWorker = new Worker(
  "schedule-processor",
  async (job: Job<ScheduleJobData>) => {
    const { workflowId, scheduleId } = job.data;
    console.log(`⏰ Scheduled trigger for workflow: ${workflowId}`);

    // Get latest published version
    const version = await prisma.workflowVersion.findFirst({
      where: {
        workflowId,
        workflow: { status: "PUBLISHED" },
      },
      orderBy: { version: "desc" },
      include: {
        workflow: { select: { userId: true } },
      },
    });

    if (!version) {
      console.log(`⚠ Workflow ${workflowId} has no published version, skipping`);
      return;
    }

    // Create a new run record
    const run = await prisma.workflowRun.create({
      data: {
        versionId: version.id,
        triggeredBy: "SCHEDULED",
        status: "QUEUED",
      },
    });

    // Update schedule last run time
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { lastRunAt: new Date() },
    });

    // ── Enqueue into the normal workflow execution queue ──
    try {
      const enqueuedJob = await enqueueWorkflowRun({
        runId: run.id,
        versionId: version.id,
        userId: version.workflow.userId,
      });

      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { jobId: enqueuedJob.id },
      });

      console.log(`⏰ Scheduled run ${run.id} enqueued as job ${enqueuedJob.id}`);
    } catch (err) {
      // Compensation: mark run as failed if enqueue fails
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          failureReason: "Failed to enqueue scheduled run",
        },
      });
      console.error(`⏰ Failed to enqueue scheduled run ${run.id}:`, err);
    }
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 2,
  }
);

// ── Worker Event Handlers ──
workflowWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

workflowWorker.on("failed", (job, err) => {
  if (err instanceof CancellationError) {
    console.log(`🚫 Job ${job?.id} cancelled (not retrying)`);
    return;
  }
  console.log(`❌ Job ${job?.id} failed: ${err.message}`);
});

workflowWorker.on("error", (err) => {
  console.error("Worker error:", err);
});

scheduleWorker.on("completed", (job) => {
  console.log(`⏰ Schedule job ${job.id} completed`);
});

scheduleWorker.on("failed", (job, err) => {
  console.log(`⏰ Schedule job ${job?.id} failed: ${err.message}`);
});

// ── Graceful Shutdown ──
async function shutdown() {
  console.log("🛑 Shutting down workers...");
  await workflowWorker.close();
  await scheduleWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("✅ BrowserOps Worker ready and listening for jobs");
