// AES-256-GCM encryption for user API keys before storing in
// shared.user_ai_settings.api_key_encrypted. Uses a server-side master
// key from env (AI_SETTINGS_MASTER_KEY, hex-encoded 32 bytes). The
// rotating IV makes every ciphertext distinct; the auth tag detects
// tampering. Blob format: base64(iv || ciphertext || authTag).
//
// If AI_SETTINGS_MASTER_KEY is not set, encrypt() throws (so we never
// silently store plaintext) and decrypt() throws (so we error loudly
// when trying to read an unreadable secret instead of leaking it).

import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const IV_LENGTH = 12;          // AES-GCM standard IV size
const AUTH_TAG_LENGTH = 16;    // AES-GCM standard auth tag size

function getKey(): Buffer {
  const hex = process.env.AI_SETTINGS_MASTER_KEY;
  if (!hex) {
    throw new Error(
      "AI_SETTINGS_MASTER_KEY not configured. Set a 64-char hex string in env to encrypt user API keys.",
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "AI_SETTINGS_MASTER_KEY must be 64 hex chars (32 bytes).",
    );
  }
  return buf;
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
}

export function decryptApiKey(blob: string): string {
  const key = getKey();
  const all = Buffer.from(blob, "base64");
  if (all.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted blob too short to be valid.");
  }
  const iv = all.subarray(0, IV_LENGTH);
  const authTag = all.subarray(all.length - AUTH_TAG_LENGTH);
  const ciphertext = all.subarray(IV_LENGTH, all.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// True iff the master key env var is configured. Used by UI to decide
// whether to gate the "managed mode" option.
export function isMasterKeyConfigured(): boolean {
  return !!process.env.AI_SETTINGS_MASTER_KEY;
}
