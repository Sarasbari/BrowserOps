/**
 * BrowserOps — Run Management API
 * GET  /api/runs       — List user's runs
 * POST /api/runs       — Trigger a new workflow run
 *
 * POST supports:
 * - Version gating: only published workflows can execute (unless testRun=true)
 * - Atomic create + enqueue with compensation on failure
 * - Zod validation of workflow steps before enqueue
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError, requireWorkspaceAccess } from "@/lib/auth-helpers";
import { enqueueWorkflowRun } from "@/lib/queue";
import { parseWorkflowSteps } from "@/lib/workflow-schema";

export async function GET(req: Request) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const workflowId = url.searchParams.get("workflowId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  // Build where clause — runs belong to workflows that belong to user
  const where: Record<string, unknown> = {
    version: {
      workflow: { userId: dbUserId },
    },
  };
  if (status) where.status = status;
  if (workflowId) {
    (where.version as Record<string, unknown>).workflowId = workflowId;
  }

  const [runs, total] = await Promise.all([
    prisma.workflowRun.findMany({
      where,
      include: {
        version: {
          select: {
            id: true,
            version: true,
            workflow: {
              select: { id: true, name: true },
            },
          },
        },
        _count: { select: { stepLogs: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workflowRun.count({ where }),
  ]);

  return NextResponse.json({
    runs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  const body = await req.json();
  const { workflowId, versionId, testRun } = body;

  if (!workflowId) {
    return NextResponse.json(
      { error: "workflowId is required" },
      { status: 400 }
    );
  }

  // Verify ownership and workspace access
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId },
  });
  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  const access = await requireWorkspaceAccess(workflow.workspaceId);
  if (isAuthError(access)) return access;

  // Quota enforcement
  const workspace = await prisma.workspace.findUnique({
    where: { id: workflow.workspaceId },
  });

  if (workspace) {
    if (workspace.browserMinutesUsed >= workspace.browserMinutesLimit) {
      return NextResponse.json(
        { error: `Workspace browser minutes quota exceeded. Converted: ${workspace.browserMinutesUsed}/${workspace.browserMinutesLimit}` },
        { status: 402 }
      );
    }
    if (workspace.storageBytesUsed >= workspace.storageBytesLimit) {
      return NextResponse.json(
        { error: `Workspace storage quota exceeded. Converted: ${workspace.storageBytesUsed}/${workspace.storageBytesLimit}` },
        { status: 402 }
      );
    }
  }

  // ── Version gating (Requirement 6) ──
  if (!testRun && workflow.status !== "PUBLISHED") {
    return NextResponse.json(
      {
        error:
          "Only published workflows can be executed. Use testRun: true for draft workflows, or publish the workflow first.",
      },
      { status: 400 }
    );
  }

  // Resolve version
  let version;
  if (versionId) {
    version = await prisma.workflowVersion.findFirst({
      where: { id: versionId, workflowId },
    });
  } else {
    version = await prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: "desc" },
    });
  }

  if (!version) {
    return NextResponse.json(
      { error: "No version found. Save the workflow first." },
      { status: 400 }
    );
  }

  // ── Validate steps ──
  const parsed = parseWorkflowSteps(version.steps);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow steps", details: parsed.error },
      { status: 400 }
    );
  }

  // ── Atomic create + enqueue with compensation ──
  const run = await prisma.workflowRun.create({
    data: {
      versionId: version.id,
      triggeredBy: testRun ? "MANUAL" : "MANUAL",
      status: "QUEUED",
    },
  });

  try {
    const job = await enqueueWorkflowRun({
      runId: run.id,
      versionId: version.id,
      userId: dbUserId,
    });

    // Persist the BullMQ job ID
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { jobId: job.id },
    });
  } catch (enqueueError) {
    // ── Compensation: mark run as failed if enqueue fails ──
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        failureReason: "Failed to enqueue job for execution",
      },
    });

    console.error("Enqueue failed:", enqueueError);
    return NextResponse.json(
      { error: "Failed to enqueue workflow run", run: { id: run.id, status: "FAILED" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ run: { id: run.id, status: "QUEUED", jobId: run.id } }, { status: 201 });
}
