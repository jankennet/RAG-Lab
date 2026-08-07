import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { LlmProvider } from "@/shared/types";

const ALGO = "aes-256-gcm";
const COOKIE_PREFIX = "ms_rag_key_";

// process.env.SESSION_KEY_SECRET must be a 32-byte value, e.g.:
//   openssl rand -hex 32
function getSecret(): Buffer {
  const raw = process.env.SESSION_KEY_SECRET;
  if (!raw) throw new Error("SESSION_KEY_SECRET is not set");
  return Buffer.from(raw, "hex"); // 32 bytes
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getSecret(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // pack iv + tag + ciphertext into one base64url string
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decrypt(packed: string): string | null {
  try {
    const buf = Buffer.from(packed, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getSecret(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null; // tampered, expired secret rotation, etc.
  }
}

export async function setProviderKeyCookie(provider: LlmProvider, key: string) {
  const store = await cookies();
  store.set(`${COOKIE_PREFIX}${provider}`, encrypt(key), {
    httpOnly: true,
    // secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h — tune to taste; this is a session-length key, not a permanent one
  });
}

export async function getProviderKey(provider: LlmProvider): Promise<string | null> {
  const store = await cookies();
  const packed = store.get(`${COOKIE_PREFIX}${provider}`)?.value;
  if (!packed) return null;
  return decrypt(packed);
}

export async function clearProviderKeyCookie(provider: LlmProvider) {
  const store = await cookies();
  store.delete(`${COOKIE_PREFIX}${provider}`);
}

export async function clearAllProviderKeyCookies() {
  const store = await cookies();
  for (const p of ["nvidia", "openai", "anthropic"] as LlmProvider[]) {
    store.delete(`${COOKIE_PREFIX}${p}`);
  }
}