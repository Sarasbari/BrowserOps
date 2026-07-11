/**
 * BrowserOps — Workflow Versions API
 * GET  /api/workflows/[id]/versions       — List versions
 * POST /api/workflows/[id]/versions       — Publish new version (validates steps with Zod)
 *
 * On publish: validates steps, creates version, clears draftSteps, and
 * sets workflow status to PUBLISHED.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { parseWorkflowSteps } from "@/lib/workflow-schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  // Verify ownership
  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId: id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      changelog: true,
      publishedAt: true,
      _count: { select: { runs: true } },
    },
  });

  return NextResponse.json({ versions });
}

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  // Verify ownership
  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const body = await req.json();
  const { steps, changelog } = body;

  if (!steps || !Array.isArray(steps)) {
    return NextResponse.json(
      { error: "Steps array is required" },
      { status: 400 }
    );
  }

  // ── Validate steps with Zod ──
  const parsed = parseWorkflowSteps(steps);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow steps", details: parsed.error },
      { status: 400 }
    );
  }

  // Get latest version number
  const latest = await prisma.workflowVersion.findFirst({
    where: { workflowId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  // Create version + update workflow in a transaction
  const [version] = await prisma.$transaction([
    prisma.workflowVersion.create({
      data: {
        workflowId: id,
        version: nextVersion,
        steps: parsed.data!,
        changelog: changelog || `Version ${nextVersion}`,
      },
    }),
    // Clear draft steps and set status to PUBLISHED
    prisma.workflow.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        draftSteps: Prisma.DbNull, // Clear draft on publish
      },
    }),
  ]);

  return NextResponse.json({ version }, { status: 201 });
}
