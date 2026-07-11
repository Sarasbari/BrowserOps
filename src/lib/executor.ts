/**
 * BrowserOps — Playwright Workflow Executor
 * ═════════════════════════════════════════
 * Executes workflow steps using Playwright with self-healing selectors.
 * Implements video recording and step-level logging per TRD Section 4.
 */
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { prisma } from "./prisma";
import { resolveElement, type MultiVectorSelector } from "./self-healing";

export interface WorkflowStep {
  type: string;
  label: string;
  config: {
    url?: string;
    selectors?: MultiVectorSelector;
    text?: string;
    key?: string;
    timeout?: number;
    waitMs?: number;
    credentialId?: string;
    outputKey?: string;
    [key: string]: unknown;
  };
}

export interface ExecutionResult {
  success: boolean;
  durationMs: number;
  stepsCompleted: number;
  stepsTotal: number;
  failureReason?: string;
  videoPath?: string;
}

/**
 * Main workflow executor — runs a complete workflow version.
 */
export async function executeWorkflow(runId: string): Promise<ExecutionResult> {
  const startTime = Date.now();

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

  const steps = run.version.steps as unknown as WorkflowStep[];
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
      const step = steps[i];
      const stepStart = Date.now();

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

        await prisma.runStepLog.update({
          where: { id: stepLog.id },
          data: {
            status: "FAILED",
            error: stepError instanceof Error ? stepError.message : String(stepError),
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
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs,
        failureReason: error instanceof Error ? error.message : String(error),
        browserMinutes: durationMs / 60000,
      },
    });

    return {
      success: false,
      durationMs,
      stepsCompleted,
      stepsTotal: steps.length,
      failureReason: error instanceof Error ? error.message : String(error),
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
  const timeout = step.config.timeout || 30000;

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
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

async function executeOpenUrl(
  page: Page,
  step: WorkflowStep,
  timeout: number
): Promise<StepResult> {
  if (!step.config.url) throw new Error("URL is required for open_url step");
  await page.goto(step.config.url, {
    waitUntil: "domcontentloaded",
    timeout,
  });
  return { selfHealed: false };
}

async function executeClickElement(
  page: Page,
  step: WorkflowStep,
  timeout: number
): Promise<StepResult> {
  if (!step.config.selectors) throw new Error("Selectors required for click");

  const result = await resolveElement(page, step.config.selectors, timeout);

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
  step: WorkflowStep,
  timeout: number
): Promise<StepResult> {
  if (!step.config.selectors) throw new Error("Selectors required for type_text");
  if (!step.config.text) throw new Error("Text is required for type_text");

  const result = await resolveElement(page, step.config.selectors, timeout);

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
  step: WorkflowStep,
  timeout: number
): Promise<StepResult> {
  if (!step.config.selectors) throw new Error("Selectors required for wait");

  const result = await resolveElement(page, step.config.selectors, timeout);

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
  step: WorkflowStep
): Promise<StepResult> {
  if (!step.config.selectors) throw new Error("Selectors required for extract");

  const result = await resolveElement(page, step.config.selectors);

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
  step: WorkflowStep
): Promise<StepResult> {
  if (!step.config.selectors) throw new Error("Selectors required for table extract");

  const result = await resolveElement(page, step.config.selectors);
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
  step: WorkflowStep,
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
  step: WorkflowStep
): Promise<StepResult> {
  if (!step.config.selectors) throw new Error("Selectors required for upload");

  const result = await resolveElement(page, step.config.selectors);

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

async function executeSaveOutput(step: WorkflowStep): Promise<StepResult> {
  return {
    selfHealed: false,
    output: {
      key: step.config.outputKey || "savedOutput",
      saved: true,
    },
  };
}

async function executeHumanIntervention(
  step: WorkflowStep,
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
