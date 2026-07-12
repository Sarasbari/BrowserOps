import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, isAuthError } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    
    const access = await requireWorkspaceAccess(workspaceId);
    if (isAuthError(access)) return access;

    const events = await prisma.selfHealingEvent.findMany({
      where: {
        run: {
          version: {
            workflow: {
              workspaceId: access.member.workspaceId,
            },
          },
        },
        status: "PENDING",
      },
      include: {
        run: {
          select: {
            id: true,
            version: {
              select: {
                version: true,
                workflow: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch self-healing events:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
