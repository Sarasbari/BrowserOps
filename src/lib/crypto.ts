/**
 * BrowserOps — AES-256-GCM Credential Encryption
 * ═══════════════════════════════════════════════
 * Per-credential unique DEK, encrypted with user master key.
 * Follows TRD Section 4.5: Secure Credential Management.
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256-bit key

/**
 * Derives a 256-bit encryption key from the master key and a salt.
 * Uses scrypt for key derivation (CPU/memory-hard to resist brute-force).
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * Gets the master key from environment.
 * In production, this should come from a KMS (AWS KMS, HashiCorp Vault).
 */
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY environment variable is not set. " +
        "This is required for credential encryption."
    );
  }
  return key;
}

export interface EncryptedPayload {
  /** Base64-encoded encrypted data */
  encryptedValue: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded GCM authentication tag */
  authTag: string;
}

/**
 * Encrypts a plaintext credential value using AES-256-GCM.
 *
 * @param plaintext - The credential value to encrypt
 * @param userId - The user ID (used as additional authenticated data)
 * @returns Encrypted payload with IV and auth tag
 */
export function encryptCredential(
  plaintext: string,
  userId: string
): EncryptedPayload {
  const masterKey = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  // Derive a unique key using the IV as salt (unique per encryption)
  const key = deriveKey(masterKey, iv);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Use userId as Additional Authenticated Data (AAD)
  // Prevents encrypted values from being moved between users
  cipher.setAAD(Buffer.from(userId, "utf8"));

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted credential.
 *
 * @param payload - The encrypted payload (value, IV, authTag)
 * @param userId - The user ID (must match the userId used during encryption)
 * @returns The decrypted plaintext credential value
 */
export function decryptCredential(
  payload: EncryptedPayload,
  userId: string
): string {
  const masterKey = getMasterKey();
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");

  // Derive the same key using the same IV as salt
  const key = deriveKey(masterKey, iv);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Set AAD (must match encryption)
  decipher.setAAD(Buffer.from(userId, "utf8"));
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.encryptedValue, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates a random encryption key (for testing / initial setup).
 * Returns a 64-character hex string (32 bytes).
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
