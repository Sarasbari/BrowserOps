/**
 * BrowserOps — Single Run API
 * GET /api/runs/[id]        — Get run details with step logs
 * POST /api/runs/[id]/cancel — Cancel a running/queued run
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const run = await prisma.workflowRun.findFirst({
    where: {
      id,
      version: { workflow: { userId: dbUserId } },
    },
    include: {
      version: {
        select: {
          id: true,
          version: true,
          steps: true,
          workflow: {
            select: { id: true, name: true, description: true },
          },
        },
      },
      stepLogs: {
        orderBy: { stepIndex: "asc" },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const body = await req.json();
  const { action } = body;

  const run = await prisma.workflowRun.findFirst({
    where: {
      id,
      version: { workflow: { userId: dbUserId } },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (action === "cancel") {
    if (run.status !== "QUEUED" && run.status !== "RUNNING" && run.status !== "PAUSED") {
      return NextResponse.json(
        { error: "Can only cancel queued, running, or paused runs" },
        { status: 400 }
      );
    }

    const updated = await prisma.workflowRun.update({
      where: { id },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    // TODO: Cancel BullMQ job if running

    return NextResponse.json({ run: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
