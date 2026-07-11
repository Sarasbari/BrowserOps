/**
 * BrowserOps — BullMQ Worker
 * ══════════════════════════
 * Processes queued workflow runs using the Playwright executor.
 * Run as a separate process: `npm run worker`
 */
import { Worker, Job, REDIS_URL } from "../lib/queue";
import type { WorkflowJobData, ScheduleJobData } from "../lib/queue";
import { executeWorkflow } from "../lib/executor";
import { prisma } from "../lib/prisma";

console.log("🚀 BrowserOps Worker starting...");

// ── Workflow Execution Worker ──
const workflowWorker = new Worker(
  "workflow-execution",
  async (job: Job<WorkflowJobData>) => {
    const { runId } = job.data;
    console.log(`▶ Executing run: ${runId}`);

    // Update the run with the BullMQ job ID
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { jobId: job.id },
    });

    const result = await executeWorkflow(runId);

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
const scheduleWorker = new Worker(
  "schedule-processor",
  async (job: Job<ScheduleJobData>) => {
    const { workflowId, scheduleId } = job.data;
    console.log(`⏰ Scheduled run for workflow: ${workflowId}`);

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

    // Create a new run
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

    // Execute the workflow directly (already in worker context)
    const result = await executeWorkflow(run.id);
    console.log(
      `⏰ Scheduled run ${run.id} ${result.success ? "completed" : "failed"}`
    );
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
