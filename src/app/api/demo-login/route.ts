import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { staffRoleSchema } from "~/lib/domain";
import {
  DEMO_STAFF,
  signStaffSession,
  STAFF_COOKIE,
} from "~/server/auth/session";

/** Demo-only one-click staff login (DEMO_MODE=1). Production uses SSO. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, req.url));
  const role = staffRoleSchema.safeParse(url.searchParams.get("role"));
  if (!role.success || env.DEMO_MODE !== "1") {
    res.cookies.delete(STAFF_COOKIE);
    return res;
  }
  const token = await signStaffSession(DEMO_STAFF[role.data]);
  res.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
