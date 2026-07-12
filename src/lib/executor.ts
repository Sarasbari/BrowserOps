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
import { chromium, Browser, BrowserContext, Page, BrowserServer } from "playwright";
import { redis } from "./queue";
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
import { isIP } from "net";
import { promises as dns } from "dns";
import { decryptCredential } from "./crypto";
import { registerSensitiveValue, clearSensitiveValues, redactText } from "./redact";
import fs from "fs";
import { uploadFile } from "./storage";

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
  
  clearSensitiveValues();

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
  const workspaceId = run.version.workflow.workspaceId || "default";

  // 2. Mark as running
  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  let browserServer: BrowserServer | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let stepsCompleted = 0;
  let videoPath: string | undefined;
  let totalStorageBytes = 0;

  try {
    // 3. Launch isolated remote BrowserServer
    browserServer = await chromium.launchServer({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const wsEndpoint = browserServer.wsEndpoint();
    browser = await chromium.connect({ wsEndpoint });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: `/tmp/browserops/videos/${runId}`,
        size: { width: 1920, height: 1080 },
      },
    });

    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

    page = await context.newPage();

    // ── Browser Egress Safeguards ──
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = request.url();

      // Block dangerous schemes
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        console.warn(`[Egress Blocked] Dangerous scheme: ${url}`);
        return route.abort("blockedbyclient");
      }

      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;

        // Block local hostnames directly
        if (
          hostname === "localhost" ||
          hostname.endsWith(".local") ||
          hostname === "metadata.google.internal"
        ) {
          console.warn(`[Egress Blocked] Local hostname: ${hostname}`);
          return route.abort("blockedbyclient");
        }

        // Resolve DNS and check for private IPs
        if (isIP(hostname)) {
          if (isPrivateIP(hostname)) {
            console.warn(`[Egress Blocked] Private IP access: ${hostname}`);
            return route.abort("blockedbyclient");
          }
        } else {
          const addresses = await dns.resolve(hostname).catch(() => []);
          for (const addr of addresses) {
            if (isPrivateIP(addr)) {
              console.warn(`[Egress Blocked] Resolved hostname ${hostname} to private IP: ${addr}`);
              return route.abort("blockedbyclient");
            }
          }
        }
      } catch (err) {
        return route.abort("blockedbyclient");
      }

      return route.continue();
    });
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

      // ── CAPTCHA Detection ──
      if (await detectCaptcha(page)) {
        const resumed = await triggerHitlAndWait(runId, workspaceId, browserServer!, "CAPTCHA");
        if (!resumed) {
          throw new Error("Run aborted during CAPTCHA intervention");
        }
        await prisma.workflowRun.update({
          where: { id: runId },
          data: { status: "RUNNING" },
        });
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
        const stepResult = await executeStep(page, step, userId, browserServer!, runId, workspaceId, i);

        if (stepResult.output && typeof stepResult.output.sizeBytes === "number") {
          totalStorageBytes += stepResult.output.sizeBytes;
        }

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
          totalStorageBytes += screenshotBuffer.byteLength;
          const s3Key = `workspaces/${workspaceId}/runs/${runId}/steps/${stepLog.id}.png`;
          await uploadFile(s3Key, screenshotBuffer, "image/png");
          screenshotUrl = s3Key;
        } catch (err) {
          console.error("Failed to capture and upload screenshot:", err);
        }

        const errorMsg = redactText(
          sanitizeSecrets(
            stepError instanceof Error ? stepError.message : String(stepError)
          )
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

    // 5. Stop tracing and close context to finalize video
    let s3TraceUrl: string | null = null;
    try {
      const traceLocalPath = `/tmp/browserops/traces/${runId}/trace.zip`;
      await context.tracing.stop({ path: traceLocalPath });
      if (fs.existsSync(traceLocalPath)) {
        const traceBuffer = await fs.promises.readFile(traceLocalPath);
        totalStorageBytes += traceBuffer.byteLength;
        const s3Key = `workspaces/${workspaceId}/runs/${runId}/trace.zip`;
        await uploadFile(s3Key, traceBuffer, "application/zip");
        s3TraceUrl = s3Key;
        
        // Cleanup local trace
        await fs.promises.unlink(traceLocalPath).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to save and upload trace:", err);
    }

    await context.close();

    let s3VideoUrl: string | null = null;
    const video = page.video();
    if (video) {
      videoPath = await video.path();
      try {
        const videoBuffer = await fs.promises.readFile(videoPath);
        totalStorageBytes += videoBuffer.byteLength;
        const s3Key = `workspaces/${workspaceId}/runs/${runId}/video.webm`;
        await uploadFile(s3Key, videoBuffer, "video/webm");
        s3VideoUrl = s3Key;

        // Cleanup local video
        await fs.promises.unlink(videoPath).catch(() => {});
      } catch (err) {
        console.error("Failed to upload video:", err);
      }
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
        videoUrl: s3VideoUrl,
        traceUrl: s3TraceUrl,
      },
    });

    // Update workspace totals
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        browserMinutesUsed: { increment: durationMs / 60000 },
        storageBytesUsed: { increment: totalStorageBytes },
      },
    }).catch(err => console.error("Failed to update workspace accounting on success:", err));

    await clearCancellation(runId);

    return {
      success: true,
      durationMs,
      stepsCompleted,
      stepsTotal: steps.length,
      videoPath: s3VideoUrl || undefined,
    };
  } catch (error) {
    // 5. Upload trace and video on failure
    let s3TraceUrl: string | null = null;
    let s3VideoUrl: string | null = null;
    
    if (context) {
      try {
        const traceLocalPath = `/tmp/browserops/traces/${runId}/trace.zip`;
        await context.tracing.stop({ path: traceLocalPath }).catch(() => {});
        if (fs.existsSync(traceLocalPath)) {
          const traceBuffer = await fs.promises.readFile(traceLocalPath);
          totalStorageBytes += traceBuffer.byteLength;
          const s3Key = `workspaces/${workspaceId}/runs/${runId}/trace.zip`;
          await uploadFile(s3Key, traceBuffer, "application/zip");
          s3TraceUrl = s3Key;
          await fs.promises.unlink(traceLocalPath).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to upload trace on failure:", err);
      }
      
      try {
        const video = page?.video();
        if (video) {
          videoPath = await video.path();
          const videoBuffer = await fs.promises.readFile(videoPath);
          totalStorageBytes += videoBuffer.byteLength;
          const s3Key = `workspaces/${workspaceId}/runs/${runId}/video.webm`;
          await uploadFile(s3Key, videoBuffer, "video/webm");
          s3VideoUrl = s3Key;
          await fs.promises.unlink(videoPath).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to upload video on failure:", err);
      }
      
      await context.close().catch(() => {});
    }

    const durationMs = Date.now() - startTime;
    const failureReason = redactText(
      sanitizeSecrets(
        error instanceof Error ? error.message : String(error)
      )
    );

    // If it's a step error, we might have a screenshot URL from the failed step. Let's try to query the latest failed step log.
    const latestFailedLog = await prisma.runStepLog.findFirst({
      where: { runId, status: "FAILED" },
      orderBy: { stepIndex: "desc" },
      select: { screenshotUrl: true },
    });

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs,
        failureReason,
        browserMinutes: durationMs / 60000,
        videoUrl: s3VideoUrl,
        traceUrl: s3TraceUrl,
        screenshotUrl: latestFailedLog?.screenshotUrl || null,
      },
    });

    // Update workspace totals on failure too
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        browserMinutesUsed: { increment: durationMs / 60000 },
        storageBytesUsed: { increment: totalStorageBytes },
      },
    }).catch(err => console.error("Failed to update workspace accounting on failure:", err));

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
    if (browserServer) {
      await browserServer.close().catch(() => {});
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
  userId: string,
  browserServer: BrowserServer,
  runId: string,
  workspaceId: string,
  stepIndex: number
): Promise<StepResult> {
  const timeout = ("timeout" in step.config && step.config.timeout) || 30000;

  switch (step.type) {
    case "open_url":
      return executeOpenUrl(page, step, timeout);
    case "click_element":
      return executeClickElement(page, step, timeout, browserServer, runId, workspaceId, stepIndex);
    case "type_text":
      return executeTypeText(page, step, timeout, userId, browserServer, runId, workspaceId, stepIndex);
    case "wait_for_selector":
      return executeWaitForSelector(page, step, timeout);
    case "extract_text":
      return executeExtractText(page, step);
    case "extract_table":
      return executeExtractTable(page, step);
    case "download_file":
      return executeDownloadFile(page, step, timeout, workspaceId, runId);
    case "upload_file":
      return executeUploadFile(page, step);
    case "save_output":
      return executeSaveOutput(step);
    case "human_intervention":
      return executeHumanIntervention(step, timeout, browserServer, runId, workspaceId);
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
  timeout: number,
  browserServer: BrowserServer,
  runId: string,
  workspaceId: string,
  stepIndex: number
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector,
    timeout
  );

  // Exact match safeguard: no blind click if multiple matches found
  if (result.multipleMatches) {
    const resumed = await triggerHitlAndWait(runId, workspaceId, browserServer, "MULTI_MATCH");
    if (!resumed) {
      throw new Error("Aborted run due to unresolved duplicate matches on click target.");
    }
    // Re-resolve target element once resumed
    const retryResult = await resolveElement(page, step.config.selectors as MultiVectorSelector, timeout);
    if (retryResult.element) {
      result.element = retryResult.element;
      result.selfHealed = retryResult.selfHealed;
      result.strategy = retryResult.strategy;
      result.newSelector = retryResult.newSelector;
      result.confidenceScore = retryResult.confidenceScore;
      result.evidenceSnippet = retryResult.evidenceSnippet;
      result.multipleMatches = false;
    } else {
      throw new Error("Element not found after manual takeover.");
    }
  }

  if (result.element) {
    await result.element.click({ timeout });
    await result.element.dispose();
  }

  // Persist self-healing event
  if (result.selfHealed) {
    await prisma.selfHealingEvent.create({
      data: {
        runId,
        stepIndex,
        failedSelector: step.config.selectors.primary,
        healedSelector: result.newSelector || result.strategy || "",
        confidenceScore: result.confidenceScore,
        evidenceSnippet: result.evidenceSnippet || null,
        status: "PENDING",
      },
    }).catch(err => console.error("Failed to log self-healing event:", err));
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
  timeout: number,
  userId: string,
  browserServer: BrowserServer,
  runId: string,
  workspaceId: string,
  stepIndex: number
): Promise<StepResult> {
  const result = await resolveElement(
    page,
    step.config.selectors as MultiVectorSelector,
    timeout
  );

  // Exact match safeguard: no blind fill if multiple matches found
  if (result.multipleMatches) {
    const resumed = await triggerHitlAndWait(runId, workspaceId, browserServer, "MULTI_MATCH");
    if (!resumed) {
      throw new Error("Aborted run due to unresolved duplicate matches on type target.");
    }
    // Re-resolve target element once resumed
    const retryResult = await resolveElement(page, step.config.selectors as MultiVectorSelector, timeout);
    if (retryResult.element) {
      result.element = retryResult.element;
      result.selfHealed = retryResult.selfHealed;
      result.strategy = retryResult.strategy;
      result.newSelector = retryResult.newSelector;
      result.confidenceScore = retryResult.confidenceScore;
      result.evidenceSnippet = retryResult.evidenceSnippet;
      result.multipleMatches = false;
    } else {
      throw new Error("Element not found after manual takeover.");
    }
  }

  let textToType = step.config.text;

  if (step.config.credentialId) {
    const credential = await prisma.credential.findFirst({
      where: { id: step.config.credentialId, userId },
    });
    if (credential) {
      textToType = decryptCredential(
        {
          encryptedValue: credential.encryptedValue,
          iv: credential.iv,
          authTag: credential.authTag,
          encryptedDek: credential.encryptedDek,
        },
        userId
      );
      registerSensitiveValue(textToType);
    } else {
      throw new Error(`Credential ${step.config.credentialId} not found`);
    }
  }

  if (result.element) {
    await result.element.click({ timeout });
    await result.element.fill(textToType);
    await result.element.dispose();
  }

  // Persist self-healing event
  if (result.selfHealed) {
    await prisma.selfHealingEvent.create({
      data: {
        runId,
        stepIndex,
        failedSelector: step.config.selectors.primary,
        healedSelector: result.newSelector || result.strategy || "",
        confidenceScore: result.confidenceScore,
        evidenceSnippet: result.evidenceSnippet || null,
        status: "PENDING",
      },
    }).catch(err => console.error("Failed to log self-healing event:", err));
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
  timeout: number,
  workspaceId: string,
  runId: string
): Promise<StepResult> {
  const downloadPromise = page.waitForEvent("download", { timeout });

  if (step.config.selectors?.primary) {
    const resolveRes = await resolveElement(page, step.config.selectors as MultiVectorSelector, timeout);
    if (resolveRes.element) {
      await resolveRes.element.click({ timeout });
      await resolveRes.element.dispose();
    } else {
      throw new Error(`Click target for download not found: ${step.config.selectors.primary}`);
    }
  } else if (step.config.url) {
    await page.goto(step.config.url);
  }

  const download = await downloadPromise;
  const tempPath = `/tmp/browserops/downloads/${runId}-${download.suggestedFilename()}`;
  await download.saveAs(tempPath);

  // Upload to S3
  let s3Key = "";
  let sizeBytes = 0;
  try {
    const fileBuffer = await fs.promises.readFile(tempPath);
    sizeBytes = fileBuffer.byteLength;
    s3Key = `workspaces/${workspaceId}/runs/${runId}/downloads/${download.suggestedFilename()}`;
    await uploadFile(s3Key, fileBuffer);
    
    // Clean up local temp file
    await fs.promises.unlink(tempPath).catch(() => {});
  } catch (err) {
    console.error("Failed to upload downloaded file to S3:", err);
  }

  return {
    selfHealed: false,
    output: {
      key: step.config.outputKey || "downloadPath",
      value: s3Key || tempPath,
      filename: download.suggestedFilename(),
      isS3: !!s3Key,
      sizeBytes,
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
  timeout: number,
  browserServer: BrowserServer,
  runId: string,
  workspaceId: string
): Promise<StepResult> {
  const resumed = await triggerHitlAndWait(runId, workspaceId, browserServer, "MANUAL");
  if (!resumed) {
    throw new Error("Human intervention step aborted by user or timeout.");
  }
  return {
    selfHealed: false,
    output: { humanActionResolved: true },
  };
}

function isPrivateIP(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;

  // IPv4 Private Ranges
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  return false;
}

async function triggerHitlAndWait(
  runId: string,
  workspaceId: string,
  browserServer: BrowserServer,
  type: "CAPTCHA" | "MULTI_MATCH" | "MANUAL"
): Promise<boolean> {
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  if (redis && redis.status === "ready") {
    await redis.setex(`takeover:${token}`, 300, browserServer.wsEndpoint());
  }

  await prisma.hitlAlert.create({
    data: {
      runId,
      type,
      token,
      expiresAt: new Date(Date.now() + 5 * 60000),
    }
  });

  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "PAUSED" },
  });

  console.log(`[HITL] Run ${runId} paused. Takeover token: ${token}`);

  const checkInterval = 2000;
  const timeoutMs = 5 * 60000; // 5 mins max
  let elapsed = 0;
  
  while (elapsed < timeoutMs) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    
    if (!run || run.status === "CANCELLED" || run.status === "FAILED") {
      return false; // Aborted
    }
    
    if (run.status === "RUNNING") {
      return true; // Resumed
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
  }
  
  // Timeout - mark expired
  await prisma.hitlAlert.updateMany({
    where: { runId, token, status: "PENDING" },
    data: { status: "EXPIRED" }
  });
  
  return false;
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    const content = await page.content();
    const lowerContent = content.toLowerCase();
    
    const captchaKeywords = [
      "g-recaptcha",
      "hcaptcha",
      "cloudflare turnstile",
      "cf-turnstile",
      "cf-challenge",
      "please verify you are a human",
      "complete the security check",
      "enter the code sent to your",
      "solve the puzzle",
      "verification code",
      "authenticator app",
      "2-step verification"
    ];
    
    for (const kw of captchaKeywords) {
      if (lowerContent.includes(kw)) {
        return true;
      }
    }

    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url().toLowerCase();
      if (
        url.includes("recaptcha") || 
        url.includes("hcaptcha") || 
        url.includes("turnstile") ||
        url.includes("challenge-platform")
      ) {
        return true;
      }
    }
  } catch {}
  return false;
}
