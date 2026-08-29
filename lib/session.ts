import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const KEY_COOKIE = "ip_studio_key";

function encryptionKey(): Buffer {
  const secret = process.env.IP_STUDIO_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("IP_STUDIO_SESSION_SECRET is required in production.");
  }
  if (secret && secret.length < 32) {
    throw new Error("IP_STUDIO_SESSION_SECRET must contain at least 32 characters.");
  }
  return createHash("sha256")
    .update(secret || "ip-studio-local-development-session-secret")
    .digest();
}

export function encryptApiKey(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptApiKey(payload: string): string {
  const raw = Buffer.from(payload, "base64url");
  if (raw.byteLength < 29) throw new Error("Invalid session payload.");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function getSessionApiKey(): Promise<string | null> {
  const store = await cookies();
  const payload = store.get(KEY_COOKIE)?.value;
  if (!payload) return null;
  try {
    return decryptApiKey(payload);
  } catch {
    return null;
  }
}
