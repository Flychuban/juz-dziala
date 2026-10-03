import "server-only";

import { jwtVerify, SignJWT } from "jose";

import { env } from "~/env";
import { type StaffRole, staffRoleSchema } from "~/lib/domain";

/**
 * Staff sessions: a signed cookie. Residents never log in — they hold a case
 * code + private link. Production: Entra ID SSO for ROPS staff (roadmap).
 */
export const STAFF_COOKIE = "jd_staff";
/** Anonymous per-browser id for rate limiting and "my cases". */
export const SESSION_COOKIE = "jd_sid";

export type StaffSession = {
  role: StaffRole;
  /** people.id for experts; "rops-demo" etc. for demo logins. */
  personId: string;
  name: string;
};

const key = () => new TextEncoder().encode(env.SESSION_SECRET);

export async function signStaffSession(s: StaffSession): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
}

export async function verifyStaffSession(
  token: string | undefined,
): Promise<StaffSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const role = staffRoleSchema.safeParse(payload.role);
    if (!role.success) return null;
    return {
      role: role.data,
      personId: typeof payload.personId === "string" ? payload.personId : "",
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}

/** Minimal cookie-header parser (works for fetch Headers in tRPC context). */
export function readCookie(headers: Headers, name: string): string | undefined {
  const raw = headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Demo identities for the one-click role switcher (fictional people). */
export const DEMO_STAFF: Record<StaffRole, StaffSession> = {
  rops: { role: "rops", personId: "rops-demo", name: "Zespół Hubu (demo)" },
  expert: { role: "expert", personId: "p-mentor-1", name: "Ekspert (demo)" },
  jst: { role: "jst", personId: "jst-demo", name: "Urząd Gminy (demo)" },
};
