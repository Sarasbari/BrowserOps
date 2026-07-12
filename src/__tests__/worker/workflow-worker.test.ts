/**
 * BrowserOps — Worker / Executor Tests
 * ═════════════════════════════════════
 * Tests for the executor with mocked Playwright and Prisma.
 * Covers: success, failure, retry idempotency, cancellation, duplicate delivery.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Playwright ──
const mockClick = vi.fn();
const mockFill = vi.fn();
const mockDispose = vi.fn();
const mockGoto = vi.fn();
const mockScreenshot = vi.fn().mockResolvedValue(Buffer.from("fake-png"));
const mockVideoPath = vi.fn().mockResolvedValue("/tmp/video.webm");
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockWaitForSelector = vi.fn();
const mockBrowser = {
  newContext: vi.fn().mockResolvedValue({
    newPage: vi.fn().mockResolvedValue({
      goto: (...args: unknown[]) => mockGoto(...args),
      screenshot: (...args: unknown[]) => mockScreenshot(...args),
      video: () => ({ path: () => mockVideoPath() }),
      click: vi.fn(),
      waitForSelector: (...args: unknown[]) => mockWaitForSelector(...args),
      evaluate: vi.fn(),
      waitForEvent: vi.fn(),
      route: vi.fn(),
    }),
    close: () => mockClose(),
    tracing: {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
  }),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowserServer = {
  wsEndpoint: () => "ws://localhost:12345/playwright",
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock("playwright", () => ({
  chromium: {
    launchServer: vi.fn().mockResolvedValue(mockBrowserServer),
    connect: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// ── Mock Self-Healing ──
vi.mock("@/lib/self-healing", () => ({
  resolveElement: vi.fn().mockResolvedValue({
    found: true,
    element: {
      click: (...args: unknown[]) => mockClick(...args),
      fill: (...args: unknown[]) => mockFill(...args),
      dispose: () => mockDispose(),
      innerText: vi.fn().mockResolvedValue("extracted"),
      waitForElementState: vi.fn(),
      setInputFiles: vi.fn(),
    },
    strategy: "primary",
    selfHealed: false,
  }),
}));

// ── Mock Prisma ──
const mockFindUnique = vi.fn();
const mockRunUpdate = vi.fn().mockResolvedValue({});
const mockStepLogCreate = vi.fn().mockResolvedValue({ id: "log_1" });
const mockStepLogUpdate = vi.fn().mockResolvedValue({});
const mockStepLogFindFirst = vi.fn().mockResolvedValue(null);
const mockStepLogUpdateMany = vi.fn().mockResolvedValue({});
const mockWorkspaceUpdate = vi.fn().mockResolvedValue({});
const mockSelfHealingCreate = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowRun: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockRunUpdate(...args),
    },
    runStepLog: {
      create: (...args: unknown[]) => mockStepLogCreate(...args),
      update: (...args: unknown[]) => mockStepLogUpdate(...args),
      findFirst: (...args: unknown[]) => mockStepLogFindFirst(...args),
      updateMany: (...args: unknown[]) => mockStepLogUpdateMany(...args),
    },
    workspace: {
      update: (...args: unknown[]) => mockWorkspaceUpdate(...args),
    },
    selfHealingEvent: {
      create: (...args: unknown[]) => mockSelfHealingCreate(...args),
    },
  },
}));

// ── Mock Cancellation ──
const mockIsCancelled = vi.fn().mockResolvedValue(false);
const mockClearCancellation = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/cancellation", () => ({
  isCancelled: (...args: unknown[]) => mockIsCancelled(...args),
  clearCancellation: (...args: unknown[]) => mockClearCancellation(...args),
  skipRemainingSteps: (...args: unknown[]) => mockStepLogUpdateMany(...args),
  CancellationError: class extends Error {
    constructor(runId: string) {
      super(`Run ${runId} was cancelled`);
      this.name = "CancellationError";
    }
  },
}));

// ── Mock Queue (redis export) ──
vi.mock("@/lib/queue", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    del: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Import executor after mocks ──
let executeWorkflow: typeof import("@/lib/executor").executeWorkflow;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import("@/lib/executor");
  executeWorkflow = mod.executeWorkflow;
});

// ── Helper: mock a run with valid steps ──
function mockRunWithSteps(
  status = "QUEUED" as string,
  steps = [
    { type: "open_url", label: "Navigate", config: { url: "https://example.com" } },
  ]
) {
  mockFindUnique.mockResolvedValue({
    id: "run_1",
    status,
    version: {
      steps,
      workflow: { userId: "user_1" },
    },
  });
}

describe("executeWorkflow", () => {
  it("successfully executes a single-step workflow", async () => {
    mockRunWithSteps("QUEUED");

    const result = await executeWorkflow("run_1");

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(result.stepsTotal).toBe(1);
    expect(mockGoto).toHaveBeenCalledWith("https://example.com", expect.any(Object));

    // Verify run marked RUNNING then COMPLETED
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "RUNNING" }),
      })
    );
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });

  it("marks run as FAILED when a step throws", async () => {
    mockRunWithSteps("QUEUED");
    mockGoto.mockRejectedValueOnce(new Error("Navigation timeout"));

    const result = await executeWorkflow("run_1");

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("Navigation timeout");
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("skips already-completed run (idempotency)", async () => {
    mockRunWithSteps("COMPLETED");

    const result = await executeWorkflow("run_1");

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(0);
    expect(mockGoto).not.toHaveBeenCalled();
    // Should NOT update run status
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });

  it("skips already-cancelled run (idempotency)", async () => {
    mockRunWithSteps("CANCELLED");

    const result = await executeWorkflow("run_1");

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(mockGoto).not.toHaveBeenCalled();
  });

  it("cancels mid-execution when cancellation is detected", async () => {
    const multiStepSteps = [
      { type: "open_url", label: "Step 1", config: { url: "https://a.com" } },
      { type: "open_url", label: "Step 2", config: { url: "https://b.com" } },
    ];
    mockRunWithSteps("QUEUED", multiStepSteps);

    // Cancellation detected after first step
    let callCount = 0;
    const checker = async () => {
      callCount++;
      return callCount > 1; // false for first check, true for second
    };

    const result = await executeWorkflow("run_1", checker);

    expect(result.cancelled).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("skips already-completed steps on retry (no duplicate logs)", async () => {
    const multiStepSteps = [
      { type: "open_url", label: "Step 1", config: { url: "https://a.com" } },
      { type: "open_url", label: "Step 2", config: { url: "https://b.com" } },
    ];
    mockRunWithSteps("QUEUED", multiStepSteps);

    // Step 0 already completed (from previous attempt)
    mockStepLogFindFirst
      .mockResolvedValueOnce({ id: "existing_log", status: "COMPLETED" }) // step 0
      .mockResolvedValueOnce(null); // step 1

    const result = await executeWorkflow("run_1");

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(2);
    // Only one new step log should be created (for step 1)
    expect(mockStepLogCreate).toHaveBeenCalledTimes(1);
  });

  it("fails with validation error for invalid steps", async () => {
    mockFindUnique.mockResolvedValue({
      id: "run_bad",
      status: "QUEUED",
      version: {
        steps: [{ type: "invalid_type", label: "Bad", config: {} }],
        workflow: { userId: "user_1" },
      },
    });

    const result = await executeWorkflow("run_bad");

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("Invalid workflow steps");
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("sanitizes secrets in failure reasons", async () => {
    mockRunWithSteps("QUEUED");
    mockGoto.mockRejectedValueOnce(
      new Error("Failed with password: supersecret123")
    );

    const result = await executeWorkflow("run_1");

    expect(result.success).toBe(false);
    expect(result.failureReason).not.toContain("supersecret123");
    expect(result.failureReason).toContain("[REDACTED]");
  });
});
