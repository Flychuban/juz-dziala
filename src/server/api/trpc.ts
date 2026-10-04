/**
 * tRPC setup: context (db, staff session, anonymous session id), procedures
 * and the per-session rate limiter. Routers live in ./routers — one per module.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import superjson from "superjson";
import { ZodError, z } from "zod";

import { localeFromCookieHeader } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { type StaffRole } from "~/lib/domain";
import {
  readCookie,
  SESSION_COOKIE,
  STAFF_COOKIE,
  verifyStaffSession,
} from "~/server/auth/session";
import { db } from "~/server/db";
import { rateLimits } from "~/server/db/schema";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const staff = await verifyStaffSession(
    readCookie(opts.headers, STAFF_COOKIE),
  );
  const sessionId = readCookie(opts.headers, SESSION_COOKIE) ?? null;
  /** The visitor's language ("pl" | "en"), from the jd_lang cookie. */
  const locale = localeFromCookieHeader(opts.headers.get("cookie"));
  return {
    db,
    staff,
    sessionId,
    locale,
    ...opts,
  };
};
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  if (t._config.isDev)
    console.log(`[TRPC] ${path} took ${Date.now() - start}ms`);
  return result;
});

/** Anyone. Residents use only public procedures. */
export const publicProcedure = t.procedure.use(timingMiddleware);

/** Staff only, by role. ROPS can do everything staff can. */
export const roleProcedure = (...roles: StaffRole[]) =>
  publicProcedure.use(({ ctx, next }) => {
    if (!ctx.staff) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: translatorFor(ctx.locale, "errors")("login") });
    }
    if (ctx.staff.role !== "rops" && !roles.includes(ctx.staff.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: translatorFor(ctx.locale, "errors")("forbidden") });
    }
    return next({ ctx: { ...ctx, staff: ctx.staff } });
  });

/** Client IP as seen by Vercel (x-real-ip), else the first x-forwarded-for hop. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function hit(
  db: Context["db"],
  key: string,
  windowSec: number,
): Promise<number> {
  const now = Date.now();
  const windowStart = new Date(
    Math.floor(now / (windowSec * 1000)) * windowSec * 1000,
  );
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = ${windowStart.toISOString()}::timestamptz then ${rateLimits.count} + 1 else 1 end`,
        windowStart,
      },
    })
    .returning({ count: rateLimits.count });
  return rows[0]?.count ?? 0;
}

/**
 * Fixed-window rate limit with three buckets: the anonymous session cookie
 * (`limit`), the client IP (`limit × 10` — judges at the venue share one IP),
 * and a global ceiling (`limit × 60`) so a script rotating cookies and IPs still
 * cannot run up the AI bill. Use before every AI call from a public procedure.
 */
export async function rateLimit(
  ctx: Context,
  bucket: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<void> {
  const checks: [string, number][] = [
    [`${bucket}:s:${ctx.sessionId ?? "anon"}`, limit],
    [`${bucket}:ip:${clientIp(ctx.headers)}`, limit * 10],
    [`${bucket}:all`, limit * 60],
  ];
  for (const [key, max] of checks) {
    if ((await hit(ctx.db, key, windowSec)) > max) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: translatorFor(ctx.locale, "errors")("rateLimit"),
      });
    }
  }
}
