import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";

export interface AuthContext {
  userId: string;
  dbUserId: string;
}

/**
 * Authenticate and resolve the Clerk user to a DB user.
 * Auto-provisions the DB user if not present (e.g. in dev without webhooks).
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!dbUser) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@placeholder.com`;
    const name = clerkUser ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") : null;
    const avatarUrl = clerkUser?.imageUrl || null;

    dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {
        email,
        name: name || null,
        avatarUrl: avatarUrl || null,
      },
      create: {
        clerkId: userId,
        email,
        name: name || null,
        avatarUrl: avatarUrl || null,
      },
    });
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
