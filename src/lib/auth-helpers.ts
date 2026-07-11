/**
 * BrowserOps — Auth Helpers
 * Shared Clerk auth utilities for API routes
 */
import { auth } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { NextResponse } from "next/server";

export interface AuthContext {
  userId: string;
  dbUserId: string;
}

/**
 * Authenticate and resolve the Clerk user to a DB user.
 * Creates the DB user on first API call (lazy provisioning).
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Upsert user — create on first API call
  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        email: `${userId}@placeholder.local`, // Updated via webhook
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
