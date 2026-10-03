import "server-only";

import { TRPCError } from "@trpc/server";

import { clientIp, rateLimit, type Context } from "~/server/api/trpc";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { findCaseByCode, type CaseRow } from "./queries";

/**
 * Access model for residents — a deliberate trade-off. The case code alone
 * opens a case (read and reply): seniors read codes over the phone and copy
 * them from paper, and a private-link token would lock them out. A code is
 * 8 characters from a 30-letter alphabet (~6.6 × 10¹¹ values), so the guard
 * is on guessing, not on reading: every wrong code counts against the session
 * AND the client IP, polling a real case costs nothing, and replies are
 * limited per code + IP. Contacts are never returned to the public side.
 */
const MISS = { limit: 30, windowSec: 600 } as const;
/** Wrong codes per IP (a jury room shares one; 60 typos in 10 min is not a person). */
const MISS_PER_IP = { limit: 60, windowSec: 600 } as const;

/** Counts `n` wrong codes against the session and the client IP; throws when over. */
export async function recordMisses(ctx: Context, n = 1): Promise<void> {
  const ipCtx = { ...ctx, sessionId: `ip:${clientIp(ctx.headers)}` };
  for (let i = 0; i < n; i++) {
    await rateLimit(ctx, "cases.miss", MISS);
    await rateLimit(ipCtx, "cases.miss.ip", MISS_PER_IP);
  }
}

/** Limits author replies per case code + client IP (on top of the session limit). */
export async function limitReplyPerCode(
  ctx: Context,
  code: string,
): Promise<void> {
  await rateLimit(
    { ...ctx, sessionId: `${code}:${clientIp(ctx.headers)}` },
    "cases.reply.code",
    { limit: 10, windowSec: 600 },
  );
}

/** Public lookup by case code; a miss is counted (see above). */
export async function caseOr404(ctx: Context, raw: string): Promise<CaseRow> {
  const c = await findCaseByCode(raw);
  if (!c) {
    await recordMisses(ctx);
    throw new TRPCError({
      code: "NOT_FOUND",
      message: normalizeCaseCode(raw)
        ? "Nie znaleźliśmy sprawy o tym kodzie. Sprawdź kod i spróbuj ponownie."
        : "To nie wygląda na kod sprawy. Kod ma postać JD-XXXX-XXXX.",
    });
  }
  return c;
}
