/**
 * BrowserOps — AES-256-GCM Credential Encryption
 * ═══════════════════════════════════════════════
 * Per-credential unique DEK, encrypted with user master key.
 * Implements Envelope Encryption for Data Encryption Keys (DEKs).
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
  /** Packed encrypted DEK for envelope encryption (format: iv:authTag:ciphertext) */
  encryptedDek?: string | null;
  /** Key version for rotation */
  version?: number;
}

/**
 * Encrypts a plaintext credential value using AES-256-GCM and Envelope Encryption.
 *
 * @param plaintext - The credential value to encrypt
 * @param userId - The user ID (used as additional authenticated data)
 * @returns Encrypted payload with IV, auth tag, and encrypted DEK
 */
export function encryptCredential(
  plaintext: string,
  userId: string
): EncryptedPayload {
  const masterKey = getMasterKey();
  
  // 1. Generate DEK (Data Encryption Key)
  const dek = randomBytes(KEY_LENGTH);
  
  // 2. Encrypt plaintext with DEK
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dek, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Use userId as Additional Authenticated Data (AAD)
  cipher.setAAD(Buffer.from(userId, "utf8"));

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // 3. Encrypt DEK with KEK (Master Key)
  const dekIv = randomBytes(IV_LENGTH);
  const kek = deriveKey(masterKey, dekIv); // Key Encryption Key
  
  const dekCipher = createCipheriv(ALGORITHM, kek, dekIv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  dekCipher.setAAD(Buffer.from(userId, "utf8"));
  
  let encryptedDekBase64 = dekCipher.update(dek).toString("base64");
  encryptedDekBase64 += dekCipher.final("base64");
  const dekAuthTag = dekCipher.getAuthTag();
  
  // Pack encrypted DEK string
  const encryptedDek = `${dekIv.toString("base64")}:${dekAuthTag.toString("base64")}:${encryptedDekBase64}`;

  return {
    encryptedValue: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    encryptedDek,
    version: 1
  };
}

/**
 * Decrypts an AES-256-GCM encrypted credential (supports legacy v0 and v1 Envelope Encryption).
 *
 * @param payload - The encrypted payload (value, IV, authTag, encryptedDek)
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

  let dek: Buffer;

  if (payload.encryptedDek) {
    // v1 Envelope Encryption
    const parts = payload.encryptedDek.split(':');
    if (parts.length !== 3) {
      throw new Error("Invalid encryptedDek format");
    }
    const dekIv = Buffer.from(parts[0], "base64");
    const dekAuthTag = Buffer.from(parts[1], "base64");
    const kek = deriveKey(masterKey, dekIv);
    
    const dekDecipher = createDecipheriv(ALGORITHM, kek, dekIv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    dekDecipher.setAAD(Buffer.from(userId, "utf8"));
    dekDecipher.setAuthTag(dekAuthTag);
    
    dek = dekDecipher.update(parts[2], "base64");
    dek = Buffer.concat([dek, dekDecipher.final()]);
  } else {
    // Legacy v0 fallback
    dek = deriveKey(masterKey, iv);
  }

  const decipher = createDecipheriv(ALGORITHM, dek, iv, {
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
