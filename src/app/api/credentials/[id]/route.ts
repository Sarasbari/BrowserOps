/**
 * BrowserOps — Single Credential API
 * GET    /api/credentials/[id]  — Get credential details (no value)
 * PATCH  /api/credentials/[id]  — Update credential name or value
 * DELETE /api/credentials/[id]  — Delete credential
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { encryptCredential, decryptCredential } from "@/lib/crypto";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const credential = await prisma.credential.findFirst({
    where: { id, userId: dbUserId },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!credential) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ credential });
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const existing = await prisma.credential.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const { name, value } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();

  // If value is provided, re-encrypt
  if (value !== undefined) {
    const encrypted = encryptCredential(value, dbUserId);
    updateData.encryptedValue = encrypted.encryptedValue;
    updateData.iv = encrypted.iv;
    updateData.authTag = encrypted.authTag;
    updateData.encryptedDek = encrypted.encryptedDek;
    updateData.version = encrypted.version;
  }

  const credential = await prisma.credential.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      type: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ credential });
}

export async function DELETE(_req: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;
  const { id } = await params;

  const existing = await prisma.credential.findFirst({
    where: { id, userId: dbUserId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 404 }
    );
  }

  await prisma.credential.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

/**
 * Internal utility — used by the execution engine to get decrypted values.
 * NOT exposed as an API route.
 */
export async function _getDecryptedValue(
  credentialId: string,
  userId: string
): Promise<string | null> {
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
  });

  if (!credential) return null;

  return decryptCredential(
    {
      encryptedValue: credential.encryptedValue,
      iv: credential.iv,
      authTag: credential.authTag,
      encryptedDek: credential.encryptedDek,
    },
    userId
  );
}
