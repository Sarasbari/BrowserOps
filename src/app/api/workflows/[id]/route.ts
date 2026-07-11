/**
 * BrowserOps — Single Workflow API
 * GET    /api/workflows/[id]  — Get workflow details
 * PATCH  /api/workflows/[id]  — Update workflow
 * DELETE /api/workflows/[id]  — Delete workflow
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

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: dbUserId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          steps: true,
          changelog: true,
          publishedAt: true,
        },
      },
      schedules: true,
      _count: {
        select: { versions: true },
      },
    },
  });

  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ workflow });
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const body = await req.json();
  const { name, description, status } = body;

  const existing = await prisma.workflow.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (status !== undefined) updateData.status = status;

  const workflow = await prisma.workflow.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ workflow });
}

export async function DELETE(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const existing = await prisma.workflow.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  await prisma.workflow.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
