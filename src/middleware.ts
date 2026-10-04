import { NextResponse, type NextRequest } from "next/server";

import { isLocale, LOCALE_COOKIE } from "~/i18n/config";

/**
 * 1. Gives every browser an anonymous session id (rate limits, "my cases"). No tracking.
 * 2. `?lang=en` (or pl) on any URL sets the language cookie and drops the parameter,
 *    so a shared link like /?lang=en opens the English version.
 * 3. Passes the current path to server components (x-pathname), e.g. for login redirects.
 */
export function middleware(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang");
  let res: NextResponse;
  if (isLocale(lang)) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("lang");
    res = NextResponse.redirect(clean, 307);
    res.cookies.set(LOCALE_COOKIE, lang, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    const headers = new Headers(req.headers);
    headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
    res = NextResponse.next({ request: { headers } });
  }
  if (!req.cookies.get("jd_sid")) {
    res.cookies.set("jd_sid", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|json|txt)$).*)",
  ],
};
