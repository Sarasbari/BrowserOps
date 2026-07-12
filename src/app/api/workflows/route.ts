/**
 * BrowserOps — Workflow CRUD API
 * GET /api/workflows        — List user's workflows
 * POST /api/workflows       — Create new workflow
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
  const workspaceId = url.searchParams.get("workspaceId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  const accessResult = await requireWorkspaceAccess(workspaceId);
  if (isAuthError(accessResult)) return accessResult;
  const { member } = accessResult;

  const where: Record<string, unknown> = { workspaceId: member.workspaceId };
  if (status) where.status = status;

  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: "desc" as const },
          take: 1,
          select: { id: true, version: true, publishedAt: true },
        },
        schedules: {
          where: { isActive: true },
          select: { id: true, cronExpr: true, nextRunAt: true },
        },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workflow.count({ where }),
  ]);

  return NextResponse.json({
    workflows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const accessResult = await requireWorkspaceAccess(workspaceId);
  if (isAuthError(accessResult)) return accessResult;
  const { auth, member } = accessResult;

  const body = await req.json();
  const { name, description } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Workflow name is required" },
      { status: 400 }
    );
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      userId: auth.dbUserId,
      workspaceId: member.workspaceId,
    },
  });

  // Create initial version with empty steps
  await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      steps: [],
      changelog: "Initial version",
    },
  });

  return NextResponse.json({ workflow }, { status: 201 });
}
