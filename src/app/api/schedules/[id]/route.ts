/**
 * BrowserOps — Single Schedule API
 * GET    /api/schedules/[id] — Get schedule
 * PATCH  /api/schedules/[id] — Update schedule (toggle active, change cron)
 * DELETE /api/schedules/[id] — Delete schedule (removes BullMQ repeatable job)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { registerSchedule, removeSchedule } from "@/lib/queue";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const schedule = await prisma.schedule.findFirst({
    where: {
      id,
      workflow: { userId: dbUserId },
    },
    include: {
      workflow: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ schedule });
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const existing = await prisma.schedule.findFirst({
    where: {
      id,
      workflow: { userId: dbUserId },
    },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const { cronExpr, timezone, isActive } = body;

  const updateData: Record<string, unknown> = {};
  if (cronExpr !== undefined) {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) {
      return NextResponse.json(
        { error: "Invalid cron expression" },
        { status: 400 }
      );
    }
    updateData.cronExpr = cronExpr.trim();
  }
  if (timezone !== undefined) updateData.timezone = timezone;
  if (isActive !== undefined) updateData.isActive = isActive;

  const schedule = await prisma.schedule.update({
    where: { id },
    data: updateData,
    include: {
      workflow: {
        select: { id: true, name: true },
      },
    },
  });

  // ── Handle active toggle: register/remove BullMQ repeatable jobs ──
  try {
    if (isActive === false) {
      // Deactivating — remove repeatable job
      await removeSchedule(id, existing.cronExpr);
    } else if (isActive === true) {
      // Re-activating — register repeatable job
      const tz = (timezone as string) || existing.timezone;
      const cron = (cronExpr as string)?.trim() || existing.cronExpr;
      await registerSchedule(id, existing.workflowId, cron, tz);
    } else if (cronExpr !== undefined) {
      // Cron changed — remove old, register new
      await removeSchedule(id, existing.cronExpr);
      const tz = (timezone as string) || existing.timezone;
      await registerSchedule(id, existing.workflowId, cronExpr.trim(), tz);
    }
  } catch (err) {
    console.error("Failed to update BullMQ schedule:", err);
  }

  return NextResponse.json({ schedule });
}

export async function DELETE(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const existing = await prisma.schedule.findFirst({
    where: {
      id,
      workflow: { userId: dbUserId },
    },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  // ── Remove BullMQ repeatable job ──
  try {
    await removeSchedule(id, existing.cronExpr);
  } catch (err) {
    console.error("Failed to remove BullMQ schedule:", err);
  }

  await prisma.schedule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
