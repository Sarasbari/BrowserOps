/**
 * BrowserOps — Credentials API
 * GET  /api/credentials       — List user's credentials (without values)
 * POST /api/credentials       — Create encrypted credential
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { encryptCredential } from "@/lib/crypto";

export async function GET() {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  const credentials = await prisma.credential.findMany({
    where: { userId: dbUserId },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ credentials });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  const body = await req.json();
  const { name, type, value } = body;

  if (!name || !type || !value) {
    return NextResponse.json(
      { error: "name, type, and value are required" },
      { status: 400 }
    );
  }

  const validTypes = ["username_password", "api_key", "oauth_token", "cookie", "custom"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Encrypt the credential value
  const encrypted = encryptCredential(value, dbUserId);

  const credential = await prisma.credential.create({
    data: {
      name: name.trim(),
      type,
      userId: dbUserId,
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ credential }, { status: 201 });
}
