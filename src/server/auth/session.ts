import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import type { ApiKeyStore } from "@/shared/types";

const COOKIE_NAME = "__Host-rag-session";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SESSION_ENCRYPTION_KEY environment variable is not set");
  }
  return createHash("sha256").update(secret).digest();
}

function encrypt(keys: ApiKeyStore): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(keys);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decrypt(encoded: string): ApiKeyStore | null {
  try {
    const key = getEncryptionKey();
    const parts = encoded.split(":");
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], "base64url");
    const authTag = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as ApiKeyStore;
  } catch {
    return null;
  }
}

/** Read API keys from the encrypted httpOnly cookie. Returns empty object when no session. */
export async function getSessionApiKeys(): Promise<ApiKeyStore> {
  const cookieJar = await cookies();
  const sessionCookie = cookieJar.get(COOKIE_NAME);
  if (!sessionCookie?.value) return {};

  return decrypt(sessionCookie.value) ?? {};
}

/**
 * Store API keys in an encrypted httpOnly, Secure, SameSite=Strict cookie.
 * Cookie is scoped to /api so only sent on API calls — never exposed to JS.
 */
export async function setSessionApiKeys(keys: ApiKeyStore): Promise<void> {
  const cookieJar = await cookies();
  const encrypted = encrypt(keys);

  cookieJar.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api",
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

/** Clear the session cookie (remove API keys). */
export async function clearSessionApiKeys(): Promise<void> {
  const cookieJar = await cookies();
  cookieJar.delete(COOKIE_NAME);
}