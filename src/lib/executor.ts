/**
 * BrowserOps — Playwright Workflow Executor
 * ═════════════════════════════════════════
 * Executes workflow steps using Playwright with self-healing selectors.
 * Implements video recording and step-level logging per TRD Section 4.
 *
 * Supports:
 * - Zod-validated step schemas
 * - Between-step cancellation checks
 * - Secret sanitization in error messages
 */
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { prisma } from "./prisma";
import { resolveElement, type MultiVectorSelector } from "./self-healing";
import {
  parseWorkflowSteps,
  sanitizeSecrets,
  type WorkflowStep,
} from "./workflow-schema";
import {
  isCancelled,
  clearCancellation,
  skipRemainingSteps,
  CancellationError,
} from "./cancellation";

export type { WorkflowStep };

export interface ExecutionResult {
  success: boolean;
  durationMs: number;
  stepsCompleted: number;
  stepsTotal: number;
  failureReason?: string;
  videoPath?: string;
  cancelled?: boolean;
}

/**
 * Main workflow executor — runs a complete workflow version.
 * @param runId - The WorkflowRun ID to execute.
 * @param cancellationChecker - Optional override for cancellation check (for testing).
 */
export async function executeWorkflow(
  runId: string,
  cancellationChecker?: () => Promise<boolean>
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const checkCancelled = cancellationChecker || (() => isCancelled(runId));

  // 1. Load run + version + steps
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      version: {
        include: {
          workflow: { select: { userId: true } },
        },
      },
    },
  });

  if (!run) throw new Error(`Run ${runId} not found`);

  // ── Idempotency guard ──
  // If this run already finished (completed, cancelled, or failed with no retries left),
  // do not re-execute. This prevents BullMQ retries from duplicating work.
  if (
    run.status === "COMPLETED" ||
    run.status === "CANCELLED"
  ) {
    console.log(`⏭ Run ${runId} already ${run.status}, skipping`);
    return {
      success: run.status === "COMPLETED",
      durationMs: 0,
      stepsCompleted: 0,
      stepsTotal: 0,
      cancelled: run.status === "CANCELLED",
    };
  }

  // ── Validate steps with Zod ──
  const rawSteps = run.version.steps;
  const parsed = parseWorkflowSteps(rawSteps);
  if (!parsed.success || !parsed.data) {
    const reason = sanitizeSecrets(
      `Invalid workflow steps: ${parsed.error || "unknown validation error"}`
    );
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        failureReason: reason,
      },
    });
    return {
      success: false,
      durationMs: Date.now() - startTime,
      stepsCompleted: 0,
      stepsTotal: 0,
      failureReason: reason,
    };
  }

  const steps = parsed.data;
  const userId = run.version.workflow.userId;

  // 2. Mark as running
  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let stepsCompleted = 0;
  let videoPath: string | undefined;

  try {
    // 3. Launch browser with video recording
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: `/tmp/browserops/videos/${runId}`,
        size: { width: 1920, height: 1080 },
      },
    });

    page = await context.newPage();

    // 4. Execute each step
    for (let i = 0; i < steps.length; i++) {
      // ── Cancellation check between steps ──
      if (await checkCancelled()) {
        await skipRemainingSteps(runId);
        const durationMs = Date.now() - startTime;
        await prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: "CANCELLED",
            completedAt: new Date(),
            durationMs,
            browserMinutes: durationMs / 60000,
          },
        });
        await clearCancellation(runId);
        return {
          success: false,
          durationMs,
          stepsCompleted,
          stepsTotal: steps.length,
          cancelled: true,
        };
      }

      const step = steps[i];
      const stepStart = Date.now();

      // Check for existing step log (idempotency for retries)
      const existingLog = await prisma.runStepLog.findFirst({
        where: {
          runId,
          stepIndex: i,
          status: { in: ["COMPLETED", "SELF_HEALED"] },
        },
      });
      if (existingLog) {
        stepsCompleted++;
        continue; // Skip already-completed steps on retry
      }

      // Log step start
      const stepLog = await prisma.runStepLog.create({
        data: {
          runId,
          stepIndex: i,
          stepType: step.type,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      try {
        const stepResult = await executeStep(page, step, userId);

        // Log step completion
        await prisma.runStepLog.update({
          where: { id: stepLog.id },
          data: {
            status: stepResult.selfHealed ? "SELF_HEALED" : "COMPLETED",
            selfHealed: stepResult.selfHealed,
            selectorUsed: stepResult.selectorUsed || null,
            originalSelector: stepResult.originalSelector || null,
            output: stepResult.output ? JSON.parse(JSON.stringify(stepResult.output)) : undefined,
            completedAt: new Date(),
            durationMs: Date.now() - stepStart,
          },
        });

        stepsCompleted++;
      } catch (stepError) {
        // Capture screenshot on failure
        let screenshotUrl: string | undefined;
        try {
          const screenshotBuffer = await page.screenshot({ fullPage: true });
          // In production, upload to S3 and get URL
          screenshotUrl = `data:image/png;base64,${screenshotBuffer.toString("base64").substring(0, 100)}...`;
        } catch {
          // Screenshot capture failed, continue
        }

        const errorMsg = sanitizeSecrets(
          stepError instanceof Error ? stepError.message : String(stepError)
        );

        await prisma.runStepLog.update({
          where: { id: stepLog.id },
          data: {
            status: "FAILED",
            error: errorMsg,
            screenshotUrl,
            completedAt: new Date(),
            durationMs: Date.now() - stepStart,
          },
        });

        throw stepError;
      }
    }

    // 5. Close context to finalize video
    await context.close();
    const video = page.video();
    if (video) {
      videoPath = await video.path();
    }

    // 6. Mark run as completed
    const durationMs = Date.now() - startTime;
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs,
        browserMinutes: durationMs / 60000,
        videoUrl: videoPath || null,
      },
    });

    await clearCancellation(runId);

    return {
      success: true,
      durationMs,
      stepsCompleted,
      stepsTotal: steps.length,
      videoPath,
    };
  } catch (error) {
    // Mark run as failed
    const durationMs = Date.now() - startTime;
    const failureReason = sanitizeSecrets(
      error instanceof Error ? error.message : String(error)
    );

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs,
        failureReason,
        browserMinutes: durationMs / 60000,
      },
    });

    await clearCancellation(runId);

    return {
      success: false,
      durationMs,
      stepsCompleted,
      stepsTotal: steps.length,
      failureReason,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// ── Step Execution Result ──

interface StepResult {
  selfHealed: boolean;
  selectorUsed?: string;
  originalSelector?: string;
  output?: Record<string, unknown>;
}

// ── Individual Step Executors ──

async function executeStep(
  page: Page,
  step: WorkflowStep,
  _userId: string
): Promise<StepResult> {
  const timeout = ("timeout" in step.config && step.config.timeout) || 30000;

  switch (step.type) {
    case "open_url":
      return executeOpenUrl(page, step, timeout);
    case "click_element":
      return executeClickElement(page, step, timeout);
    case "type_text":
      return executeTypeText(page, step, timeout);
    case "wait_for_selector":
      return executeWaitForSelector(page, step, timeout);
    case "extract_text":
      return executeExtractText(page, step);
    case "extract_table":
      return executeExtractTable(page, step);
    case "download_file":
      return executeDownloadFile(page, step, timeout);
    case "upload_file":
      return executeUploadFile(page, step);
    case "save_output":
      return executeSaveOutput(step);
    case "human_intervention":
      return executeHumanIntervention(step, timeout);
    default: {
      // Exhaustive check — Zod validation should prevent reaching here
      const _exhaustive: never = step;
      throw new Error(`Unknown step type: ${(_exhaustive as WorkflowStep).type}`);
    }
  }
}

async function executeOpenUrl(
  page: Page,
  step: Extract<WorkflowStep, { type: "open_url" }>,
  timeout: number
): Promise<StepResult> {
  await page.goto(step.config.url, {
    waitUntil: "domcontentloaded",
    timeout,
  });
  return { selfHealed: false };
}

async function executeClickElement(
  page: Page,
  step: Extract<WorkflowStep, { type: "click_element" }>,
  timeout: number
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector,
    timeout
  );

  if (result.element) {
    await result.element.click({ timeout });
    await result.element.dispose();
  }

  return {
    selfHealed: result.selfHealed,
    selectorUsed: result.strategy,
    originalSelector: result.selfHealed ? step.config.selectors.primary : undefined,
  };
}

async function executeTypeText(
  page: Page,
  step: Extract<WorkflowStep, { type: "type_text" }>,
  timeout: number
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector,
    timeout
  );

  if (result.element) {
    await result.element.click({ timeout });
    await result.element.fill(step.config.text);
    await result.element.dispose();
  }

  return {
    selfHealed: result.selfHealed,
    selectorUsed: result.strategy,
    originalSelector: result.selfHealed ? step.config.selectors.primary : undefined,
  };
}

async function executeWaitForSelector(
  page: Page,
  step: Extract<WorkflowStep, { type: "wait_for_selector" }>,
  timeout: number
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector,
    timeout
  );

  if (result.element) {
    await result.element.waitForElementState("visible", { timeout });
    await result.element.dispose();
  }

  return {
    selfHealed: result.selfHealed,
    selectorUsed: result.strategy,
  };
}

async function executeExtractText(
  page: Page,
  step: Extract<WorkflowStep, { type: "extract_text" }>
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector
  );

  let text = "";
  if (result.element) {
    text = await result.element.innerText();
    await result.element.dispose();
  }

  return {
    selfHealed: result.selfHealed,
    selectorUsed: result.strategy,
    output: {
      key: step.config.outputKey || "extractedText",
      value: text,
    },
  };
}

async function executeExtractTable(
  page: Page,
  step: Extract<WorkflowStep, { type: "extract_table" }>
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector
  );
  let tableData: string[][] = [];

  if (result.element) {
    const handle = result.element;
    tableData = await page.evaluate((el) => {
      const table = el as HTMLTableElement;
      const rows: string[][] = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll("td, th").forEach((td) => {
          cells.push((td as HTMLElement).innerText.trim());
        });
        if (cells.length > 0) rows.push(cells);
      });
      return rows;
    }, handle);
    await handle.dispose();
  }

  return {
    selfHealed: result.selfHealed,
    selectorUsed: result.strategy,
    output: {
      key: step.config.outputKey || "tableData",
      value: tableData,
    },
  };
}

async function executeDownloadFile(
  page: Page,
  step: Extract<WorkflowStep, { type: "download_file" }>,
  timeout: number
): Promise<StepResult> {
  const downloadPromise = page.waitForEvent("download", { timeout });

  if (step.config.selectors?.primary) {
    await page.click(step.config.selectors.primary);
  } else if (step.config.url) {
    await page.goto(step.config.url);
  }

  const download = await downloadPromise;
  const path = `/tmp/browserops/downloads/${download.suggestedFilename()}`;
  await download.saveAs(path);

  return {
    selfHealed: false,
    output: {
      key: step.config.outputKey || "downloadPath",
      value: path,
      filename: download.suggestedFilename(),
    },
  };
}

async function executeUploadFile(
  page: Page,
  step: Extract<WorkflowStep, { type: "upload_file" }>
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector
  );

  if (result.element) {
    const filePath = step.config.text || "";
    await result.element.setInputFiles(filePath);
    await result.element.dispose();
  }

  return {
    selfHealed: result.selfHealed,
    selectorUsed: result.strategy,
  };
}

async function executeSaveOutput(
  step: Extract<WorkflowStep, { type: "save_output" }>
): Promise<StepResult> {
  return {
    selfHealed: false,
    output: {
      key: step.config.outputKey || "savedOutput",
      saved: true,
    },
  };
}

async function executeHumanIntervention(
  step: Extract<WorkflowStep, { type: "human_intervention" }>,
  timeout: number
): Promise<StepResult> {
  // In production: pause the run, send WebSocket notification, wait for user
  // For MVP: wait the configured time or default 60s
  const waitMs = step.config.waitMs || Math.min(timeout, 60000);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  return {
    selfHealed: false,
    output: { humanActionRequired: true, waitedMs: waitMs },
  };
}
