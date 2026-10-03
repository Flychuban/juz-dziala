import "server-only";

import { TRPCError } from "@trpc/server";

import { rateLimit, type Context } from "~/server/api/trpc";
import { normalizeCaseCode } from "./_pending-domain";
import { findCaseByCode, type CaseRow } from "./queries";

/**
 * Public lookup by case code. A wrong code is rate-limited per session, so
 * codes cannot be guessed by brute force, while polling a real case is free.
 */
export async function caseOr404(ctx: Context, raw: string): Promise<CaseRow> {
  const c = await findCaseByCode(raw);
  if (!c) {
    await rateLimit(ctx, "cases.miss", { limit: 30, windowSec: 600 });
    throw new TRPCError({
      code: "NOT_FOUND",
      message: normalizeCaseCode(raw)
        ? "Nie znaleźliśmy sprawy o tym kodzie. Sprawdź kod i spróbuj ponownie."
        : "To nie wygląda na kod sprawy. Kod ma postać JD-XXXX-XXXX.",
    });
  }
  return c;
}
