import { NextResponse, type NextRequest } from "next/server";

import { isLocale, LOCALE_COOKIE } from "~/i18n/config";

/**
 * Language switch: /api/lang?to=en&next=/library. A plain link, so it works
 * before JavaScript loads. Same-origin redirects only (as in /api/demo-login).
 */
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  let target = new URL("/", req.url);
  try {
    const candidate = new URL(url.searchParams.get("next") ?? "/", req.url);
    if (candidate.origin === url.origin) target = candidate;
  } catch {
    /* keep "/" */
  }
  const res = NextResponse.redirect(new URL(target.pathname + target.search, req.url), 303);
  const to = url.searchParams.get("to");
  res.cookies.set(LOCALE_COOKIE, isLocale(to) ? to : "pl", {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
