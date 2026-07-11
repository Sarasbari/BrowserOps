/**
 * BrowserOps — Single Schedule API
 * GET    /api/schedules/[id] — Get schedule
 * PATCH  /api/schedules/[id] — Update schedule (toggle active, change cron)
 * DELETE /api/schedules/[id] — Delete schedule
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

  // TODO: Remove BullMQ repeatable job

  await prisma.schedule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
