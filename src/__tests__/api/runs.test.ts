/**
 * BrowserOps — Runs API Tests
 * ════════════════════════════
 * Tests for POST /api/runs, GET /api/runs, and cancellation.
 * Mocks: Prisma, BullMQ queue, Clerk auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Clerk auth ──
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  workflow: { findFirst: vi.fn() },
  workflowVersion: { findFirst: vi.fn() },
  workflowRun: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  runStepLog: { updateMany: vi.fn() },
  workspaceMember: { findFirst: vi.fn() },
  workspace: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ── Mock Queue ──
const mockEnqueue = vi.fn();
const mockRemoveJob = vi.fn();
vi.mock("@/lib/queue", () => ({
  enqueueWorkflowRun: (...args: unknown[]) => mockEnqueue(...args),
  removeJob: (...args: unknown[]) => mockRemoveJob(...args),
}));

// ── Mock Cancellation ──
const mockRequestCancellation = vi.fn();
const mockSkipRemainingSteps = vi.fn();
vi.mock("@/lib/cancellation", () => ({
  requestCancellation: (...args: unknown[]) => mockRequestCancellation(...args),
  skipRemainingSteps: (...args: unknown[]) => mockSkipRemainingSteps(...args),
}));

// ── Helpers ──
function makeRequest(body: Record<string, unknown> = {}, method = "POST") {
  return new Request("http://localhost:3000/api/runs", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(query = "") {
  return new Request(`http://localhost:3000/api/runs${query}`, {
    method: "GET",
  });
}

function setupAuth(clerkId = "user_123", dbUserId = "db_user_1") {
  mockAuth.mockResolvedValue({ userId: clerkId });
  mockPrisma.user.findUnique.mockResolvedValue({ id: dbUserId, clerkId });
  mockPrisma.workspaceMember.findFirst.mockResolvedValue({
    role: "OWNER",
    workspaceId: "workspace_1",
    workspace: { id: "workspace_1" },
  });
  mockPrisma.workspace.findUnique.mockResolvedValue({
    id: "workspace_1",
    browserMinutesUsed: 0,
    browserMinutesLimit: 1000,
    storageBytesUsed: 0,
    storageBytesLimit: 1000000,
  });
}

function setupPublishedWorkflow() {
  mockPrisma.workflow.findFirst.mockResolvedValue({
    id: "wf_1",
    name: "Test Workflow",
    status: "PUBLISHED",
    userId: "db_user_1",
  });
}

function setupDraftWorkflow() {
  mockPrisma.workflow.findFirst.mockResolvedValue({
    id: "wf_1",
    name: "Draft Workflow",
    status: "DRAFT",
    userId: "db_user_1",
  });
}

function setupVersion() {
  mockPrisma.workflowVersion.findFirst.mockResolvedValue({
    id: "ver_1",
    version: 1,
    workflowId: "wf_1",
    steps: [
      { type: "open_url", label: "Navigate", config: { url: "https://example.com" } },
    ],
  });
}

// ── Import the handler AFTER mocks ──
// We dynamically import to ensure mocks are registered first
let POST: (req: Request) => Promise<Response>;
let GET: (req: Request) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import("@/app/api/runs/route");
  POST = mod.POST;
  GET = mod.GET;
});

describe("POST /api/runs", () => {
  it("creates a run and enqueues successfully", async () => {
    setupAuth();
    setupPublishedWorkflow();
    setupVersion();
    mockPrisma.workflowRun.create.mockResolvedValue({
      id: "run_1",
      status: "QUEUED",
      versionId: "ver_1",
    });
    mockEnqueue.mockResolvedValue({ id: "run_1" });
    mockPrisma.workflowRun.update.mockResolvedValue({});

    const res = await POST(makeRequest({ workflowId: "wf_1" }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.run.status).toBe("QUEUED");

    // Verify enqueue was called
    expect(mockEnqueue).toHaveBeenCalledWith({
      runId: "run_1",
      versionId: "ver_1",
      userId: "db_user_1",
    });
  });

  it("rejects unpublished workflow without testRun flag", async () => {
    setupAuth();
    setupDraftWorkflow();

    const res = await POST(makeRequest({ workflowId: "wf_1" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("published");
  });

  it("allows testRun on draft workflow", async () => {
    setupAuth();
    setupDraftWorkflow();
    setupVersion();
    mockPrisma.workflowRun.create.mockResolvedValue({
      id: "run_2",
      status: "QUEUED",
    });
    mockEnqueue.mockResolvedValue({ id: "run_2" });
    mockPrisma.workflowRun.update.mockResolvedValue({});

    const res = await POST(makeRequest({ workflowId: "wf_1", testRun: true }));
    expect(res.status).toBe(201);
  });

  it("compensates when enqueue fails", async () => {
    setupAuth();
    setupPublishedWorkflow();
    setupVersion();
    mockPrisma.workflowRun.create.mockResolvedValue({
      id: "run_3",
      status: "QUEUED",
    });
    mockEnqueue.mockRejectedValue(new Error("Redis connection failed"));
    mockPrisma.workflowRun.update.mockResolvedValue({});

    const res = await POST(makeRequest({ workflowId: "wf_1" }));
    expect(res.status).toBe(500);

    // Verify compensation: run marked as FAILED
    expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
      where: { id: "run_3" },
      data: expect.objectContaining({
        status: "FAILED",
        failureReason: expect.stringContaining("enqueue"),
      }),
    });
  });

  it("returns 401 for unauthorized access", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await POST(makeRequest({ workflowId: "wf_1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing workflowId", async () => {
    setupAuth();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owned workflow", async () => {
    setupAuth();
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ workflowId: "wf_other" }));
    expect(res.status).toBe(404);
  });

  it("rejects malformed steps in version", async () => {
    setupAuth();
    setupPublishedWorkflow();
    mockPrisma.workflowVersion.findFirst.mockResolvedValue({
      id: "ver_bad",
      version: 1,
      workflowId: "wf_1",
      steps: [{ type: "unknown_type", label: "Bad", config: {} }],
    });

    const res = await POST(makeRequest({ workflowId: "wf_1" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });
});

describe("PATCH /api/runs/[id] (cancellation)", () => {
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/runs/[id]/route");
    PATCH = mod.PATCH;
  });

  it("cancels a QUEUED run and removes from queue", async () => {
    setupAuth();
    mockPrisma.workflowRun.findFirst.mockResolvedValue({
      id: "run_q",
      status: "QUEUED",
      jobId: "job_q",
    });
    mockRemoveJob.mockResolvedValue(true);
    mockSkipRemainingSteps.mockResolvedValue(undefined);
    mockPrisma.workflowRun.update.mockResolvedValue({
      id: "run_q",
      status: "CANCELLED",
    });

    const req = new Request("http://localhost:3000/api/runs/run_q", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run_q" }) });
    expect(res.status).toBe(200);
    expect(mockRemoveJob).toHaveBeenCalledWith("job_q");
    expect(mockSkipRemainingSteps).toHaveBeenCalledWith("run_q");
  });

  it("cancels a RUNNING run via Redis signal", async () => {
    setupAuth();
    mockPrisma.workflowRun.findFirst.mockResolvedValue({
      id: "run_r",
      status: "RUNNING",
      jobId: "job_r",
    });
    mockRequestCancellation.mockResolvedValue(undefined);
    mockSkipRemainingSteps.mockResolvedValue(undefined);
    mockPrisma.workflowRun.update.mockResolvedValue({
      id: "run_r",
      status: "CANCELLED",
    });

    const req = new Request("http://localhost:3000/api/runs/run_r", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run_r" }) });
    expect(res.status).toBe(200);
    expect(mockRequestCancellation).toHaveBeenCalledWith("run_r");
  });

  it("rejects cancellation of completed run", async () => {
    setupAuth();
    mockPrisma.workflowRun.findFirst.mockResolvedValue({
      id: "run_c",
      status: "COMPLETED",
    });

    const req = new Request("http://localhost:3000/api/runs/run_c", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run_c" }) });
    expect(res.status).toBe(400);
  });

  it("rejects cancellation of failed run", async () => {
    setupAuth();
    mockPrisma.workflowRun.findFirst.mockResolvedValue({
      id: "run_f",
      status: "FAILED",
    });

    const req = new Request("http://localhost:3000/api/runs/run_f", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run_f" }) });
    expect(res.status).toBe(400);
  });
});
