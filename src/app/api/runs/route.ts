/**
 * BrowserOps — Run Management API
 * GET  /api/runs       — List user's runs
 * POST /api/runs       — Trigger a new workflow run
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";

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
  const { workflowId, versionId } = body;

  if (!workflowId) {
    return NextResponse.json(
      { error: "workflowId is required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, userId: dbUserId },
  });
  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  // Resolve version (use specific or latest)
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
      { error: "No published version found. Save the workflow first." },
      { status: 400 }
    );
  }

  // Create the run record
  const run = await prisma.workflowRun.create({
    data: {
      versionId: version.id,
      triggeredBy: "MANUAL",
      status: "QUEUED",
    },
  });

  // TODO: Enqueue to BullMQ
  // await workflowQueue.add("execute", { runId: run.id }, { jobId: run.id });

  return NextResponse.json({ run }, { status: 201 });
}
