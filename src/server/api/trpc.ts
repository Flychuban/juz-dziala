/**
 * tRPC setup: context (db, staff session, anonymous session id), procedures
 * and the per-session rate limiter. Routers live in ./routers — one per module.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import superjson from "superjson";
import { ZodError, z } from "zod";

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
  return {
    db,
    staff,
    sessionId,
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
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Zaloguj się." });
    }
    if (ctx.staff.role !== "rops" && !roles.includes(ctx.staff.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Brak uprawnień." });
    }
    return next({ ctx: { ...ctx, staff: ctx.staff } });
  });

/**
 * Fixed-window rate limit keyed by the anonymous session cookie (falls back
 * to a shared bucket). Use before every AI call from a public procedure.
 */
export async function rateLimit(
  ctx: Context,
  bucket: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<void> {
  const key = `${bucket}:${ctx.sessionId ?? "anon"}`;
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000,
  );
  const rows = await ctx.db
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
  if ((rows[0]?.count ?? 0) > limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Za dużo zapytań w krótkim czasie. Spróbuj za chwilę.",
    });
  }
}
