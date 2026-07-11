/**
 * BrowserOps — Single Run API
 * GET   /api/runs/[id]  — Get run details with step logs
 * PATCH /api/runs/[id]  — Cancel a running/queued run
 *
 * Cancellation:
 * - QUEUED: removes job from BullMQ queue
 * - RUNNING: sets Redis cancellation key (worker checks between steps)
 * - Remaining PENDING steps are marked SKIPPED
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { removeJob } from "@/lib/queue";
import { requestCancellation, skipRemainingSteps } from "@/lib/cancellation";

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
    if (
      run.status !== "QUEUED" &&
      run.status !== "RUNNING" &&
      run.status !== "PAUSED"
    ) {
      return NextResponse.json(
        { error: "Can only cancel queued, running, or paused runs" },
        { status: 400 }
      );
    }

    // ── Cancel based on current state ──
    if (run.status === "QUEUED" && run.jobId) {
      // Remove from BullMQ queue
      await removeJob(run.jobId);
    }

    if (run.status === "RUNNING") {
      // Signal the worker via Redis
      await requestCancellation(id);
    }

    // Mark remaining pending step logs as SKIPPED
    await skipRemainingSteps(id);

    // Update run status
    const updated = await prisma.workflowRun.update({
      where: { id },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ run: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
