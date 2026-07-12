import { auth } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";

export interface AuthContext {
  userId: string;
  dbUserId: string;
}

/**
 * Authenticate and resolve the Clerk user to a DB user.
 * Expects the DB user to exist (synced via Webhooks).
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User account is not fully synced yet. Please try again in a moment." }, { status: 401 });
  }

  return { userId, dbUserId: dbUser.id };
}

/**
 * Type guard to check if auth result is an error response.
 */
export function isAuthError(
  result: AuthContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Helper to ensure a user has access to a specific workspace with at least a minimum role.
 */
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export async function requireWorkspaceAccess(
  workspaceId?: string | null,
  minRole: WorkspaceRole = "MEMBER"
): Promise<{ auth: AuthContext; member: { role: WorkspaceRole, workspaceId: string } } | NextResponse> {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  let member;

  if (workspaceId) {
    member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: dbUserId, workspaceId },
      },
    });
  } else {
    // Fallback for UI that doesn't send workspaceId yet.
    member = await prisma.workspaceMember.findFirst({
      where: { userId: dbUserId },
    });

    if (!member) {
      // Lazy-provision a default personal workspace for backward compatibility
      const newWorkspace = await prisma.workspace.create({
        data: {
          name: "Personal Workspace",
          slug: `personal-${dbUserId}`,
          members: {
            create: {
              userId: dbUserId,
              role: "OWNER",
            }
          }
        }
      });
      member = { role: "OWNER" as WorkspaceRole, workspaceId: newWorkspace.id };
    }
  }

  if (!member) {
    return NextResponse.json({ error: "Forbidden: You do not have access to this workspace." }, { status: 403 });
  }

  const userRoleLevel = ROLE_HIERARCHY[member.role];
  const minRoleLevel = ROLE_HIERARCHY[minRole];

  if (userRoleLevel < minRoleLevel) {
    return NextResponse.json({ error: `Forbidden: Requires at least ${minRole} role.` }, { status: 403 });
  }

  return { auth: authResult, member: { role: member.role, workspaceId: member.workspaceId } };
}
