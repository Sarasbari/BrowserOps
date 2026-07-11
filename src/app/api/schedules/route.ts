/**
 * BrowserOps — Schedule API
 * GET  /api/schedules       — List schedules
 * POST /api/schedules       — Create schedule (registers BullMQ repeatable job)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { registerSchedule } from "@/lib/queue";

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

  // ── Register repeatable job with BullMQ ──
  try {
    const job = await registerSchedule(
      schedule.id,
      workflowId,
      cronExpr.trim(),
      timezone || "UTC"
    );
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { bullmqJobKey: job.repeatJobKey || null },
    });
  } catch (err) {
    console.error("Failed to register BullMQ schedule:", err);
    // Schedule is still created in DB — can be retried
  }

  return NextResponse.json({ schedule }, { status: 201 });
}
