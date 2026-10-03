import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "~/env";

/** AES-256-GCM for contact details. Key: CONTACT_ENC_KEY (base64, 32 bytes) or derived from SESSION_SECRET. */
function key(): Buffer {
  if (env.CONTACT_ENC_KEY) {
    const k = Buffer.from(env.CONTACT_ENC_KEY, "base64");
    if (k.length === 32) return k;
  }
  return createHash("sha256").update(`contact:${env.SESSION_SECRET}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function decrypt(blob: string): string | null {
  try {
    const [iv, tag, enc] = blob
      .split(".")
      .map((p) => Buffer.from(p, "base64url"));
    if (!iv || !tag || !enc) return null;
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
