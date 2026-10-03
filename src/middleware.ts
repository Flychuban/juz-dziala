import { NextResponse, type NextRequest } from "next/server";

/** Gives every browser an anonymous session id (rate limits, "my cases"). No tracking. */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
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
