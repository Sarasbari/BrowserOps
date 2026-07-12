import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, isAuthError } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { decision } = body; // "APPROVE" or "REJECT"

    if (decision !== "APPROVE" && decision !== "REJECT") {
      return NextResponse.json({ error: "Invalid decision. Must be APPROVE or REJECT" }, { status: 400 });
    }

    // 1. Fetch SelfHealingEvent
    const event = await prisma.selfHealingEvent.findUnique({
      where: { id },
      include: {
        run: {
          include: {
            version: {
              include: {
                workflow: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Self healing event not found" }, { status: 404 });
    }

    // 2. Validate workspace access
    const workspaceId = event.run.version.workflow.workspaceId;
    const access = await requireWorkspaceAccess(workspaceId, "ADMIN");
    if (isAuthError(access)) return access;

    if (decision === "APPROVE") {
      const workflow = event.run.version.workflow;
      const draftSteps = JSON.parse(JSON.stringify(workflow.draftSteps)) as any[];
      const stepIndex = event.stepIndex;

      if (draftSteps && draftSteps[stepIndex]) {
        // Update the selector to the healed one
        const step = draftSteps[stepIndex];
        if (step.config && step.config.selectors) {
          step.config.selectors.primary = event.healedSelector;
        }

        // Save updated draft steps back to workflow
        await prisma.workflow.update({
          where: { id: workflow.id },
          data: { draftSteps },
        });
      }

      await prisma.selfHealingEvent.update({
        where: { id },
        data: { status: "APPROVED" },
      });
    } else {
      await prisma.selfHealingEvent.update({
        where: { id },
        data: { status: "REJECTED" },
      });
    }

    console.log(`[SelfHealing] Event ${id} ${decision}D by user ${access.auth.dbUserId}`);

    return NextResponse.json({ success: true, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" });
  } catch (error: any) {
    console.error("Failed to resolve self healing event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
