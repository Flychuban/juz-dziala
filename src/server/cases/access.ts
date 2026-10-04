import "server-only";

import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";

import { translatorFor } from "~/i18n/server";
import {
  clientIp,
  createTRPCContext,
  rateLimit,
  type Context,
} from "~/server/api/trpc";
import { hashToken, normalizeCaseCode } from "~/server/domain/case-code";
import { findCaseByCode, type CaseRow } from "./queries";

/**
 * Access model for residents — a deliberate trade-off. The case code alone
 * opens a case for READING: seniors read codes over the phone and copy them
 * from paper. WRITING (a reply in the thread) needs the private-link token as
 * well — it is in the link shown when the case is created, saved on that
 * device, sent in the receipt e-mail/SMS and in the QR code of the printed
 * sheet. A code is 8 characters from a 30-letter alphabet (~6.6 × 10¹¹
 * values), so the guard is on guessing, not on reading: every wrong code (or
 * wrong token) counts against the session AND the client IP, polling a real
 * case costs nothing, and replies are limited per code + IP. Contacts are
 * never returned to the public side.
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
    const t = translatorFor(ctx.locale, "cases");
    throw new TRPCError({
      code: "NOT_FOUND",
      message: normalizeCaseCode(raw)
        ? t("errors.notFound")
        : t("errors.badCode"),
    });
  }
  return c;
}

/** True when `token` is this case's private-link token. */
export function ownsCase(
  c: CaseRow,
  token: string | null | undefined,
): boolean {
  return !!token && hashToken(token) === c.tokenHash;
}

/**
 * Writes need the private-link token, not just the code. A wrong token counts
 * as a miss, like a wrong code.
 */
export async function requireToken(
  ctx: Context,
  c: CaseRow,
  token: string | null | undefined,
): Promise<void> {
  if (ownsCase(c, token)) return;
  if (token) await recordMisses(ctx);
  throw new TRPCError({
    code: "FORBIDDEN",
    message: translatorFor(ctx.locale, "cases")(
      token ? "errors.badToken" : "errors.needToken",
    ),
  });
}

export type PageCase =
  | { ok: true; case: CaseRow }
  | { ok: false; status: "NOT_FOUND" | "TOO_MANY_REQUESTS"; message: string };

/**
 * `caseOr404` for server-rendered pages (print sheet, plan): the same miss
 * counting as the tRPC procedures, so a page cannot be used to guess codes.
 */
export async function caseForPage(raw: string): Promise<PageCase> {
  const ctx = await createTRPCContext({
    headers: new Headers(await headers()),
  });
  try {
    return { ok: true, case: await caseOr404(ctx, raw) };
  } catch (e) {
    if (
      e instanceof TRPCError &&
      (e.code === "NOT_FOUND" || e.code === "TOO_MANY_REQUESTS")
    ) {
      return { ok: false, status: e.code, message: e.message };
    }
    throw e;
  }
}
