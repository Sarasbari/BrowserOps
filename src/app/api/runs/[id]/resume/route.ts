import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, isAuthError } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // 1. Fetch run details
    const run = await prisma.workflowRun.findUnique({
      where: { id },
      include: {
        version: {
          include: {
            workflow: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.status !== "PAUSED") {
      return NextResponse.json({ error: "Only paused runs can be resumed" }, { status: 400 });
    }

    // 2. Validate workspace access
    const workspaceId = run.version.workflow.workspaceId;
    const access = await requireWorkspaceAccess(workspaceId, "MEMBER");
    if (isAuthError(access)) return access;

    // 3. Mark the run as RUNNING (which breaks the worker's polling loop)
    await prisma.workflowRun.update({
      where: { id },
      data: { status: "RUNNING" },
    });

    // 4. Resolve the pending HITL alerts
    await prisma.hitlAlert.updateMany({
      where: { runId: id, status: "PENDING" },
      data: { status: "RESOLVED" },
    });

    console.log(`[HITL] Resumed run ${id} by user ${access.auth.dbUserId}`);

    return NextResponse.json({ success: true, status: "RUNNING" });
  } catch (error: any) {
    console.error("Failed to resume run:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
