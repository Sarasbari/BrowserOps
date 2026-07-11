/**
 * BrowserOps — Schedule API
 * GET  /api/schedules       — List schedules
 * POST /api/schedules       — Create schedule
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  const schedules = await prisma.schedule.findMany({
    where: {
      workflow: { userId: dbUserId },
    },
    include: {
      workflow: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  const body = await req.json();
  const { workflowId, cronExpr, timezone } = body;

  if (!workflowId || !cronExpr) {
    return NextResponse.json(
      { error: "workflowId and cronExpr are required" },
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

  // Basic cron validation (5-part format)
  const cronParts = cronExpr.trim().split(/\s+/);
  if (cronParts.length !== 5) {
    return NextResponse.json(
      { error: "Invalid cron expression. Must be 5-part format (min hour dom mon dow)." },
      { status: 400 }
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      workflowId,
      cronExpr: cronExpr.trim(),
      timezone: timezone || "UTC",
      isActive: true,
    },
    include: {
      workflow: {
        select: { id: true, name: true },
      },
    },
  });

  // TODO: Register repeatable job with BullMQ
  // await scheduleQueue.add("scheduled-run", { workflowId, scheduleId }, {
  //   repeat: { pattern: cronExpr, tz: timezone },
  //   jobId: schedule.id,
  // });

  return NextResponse.json({ schedule }, { status: 201 });
}
