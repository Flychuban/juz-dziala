import "server-only";

import { TRPCError } from "@trpc/server";

import { translatorFor } from "~/i18n/server";
import type { Context } from "~/server/api/trpc";
import { caseOr404 } from "~/server/cases/access";
import type { CaseRow } from "~/server/cases/queries";
import { hashToken } from "~/server/domain/case-code";
import { canvasValuesSchema, storedIdeaSchema, type CanvasValues, type StoredIdea } from "./schema";

export type IdeaCase = {
  row: CaseRow;
  idea: StoredIdea;
  canvas: CanvasValues | null;
  /** The private-link token matched. */
  privateLink: boolean;
};

/**
 * An idea Sprawa by its code. The code alone opens it for reading (as every
 * case in the prototype); a token, when given, must be the right one — a wrong
 * token is refused rather than ignored.
 *
 * `write: true` (saving the Canvas, sending the application) also requires the
 * private-link token: the code is printed, read over the phone and shown to
 * staff, so it must not be enough to overwrite the author's work. The author's
 * pages carry the token from the private link (or from this device's list of
 * cases), so their flow is unchanged.
 */
export async function loadIdeaCase(
  ctx: Context,
  code: string,
  token?: string,
  opts: { write?: boolean } = {},
): Promise<IdeaCase> {
  const t = translatorFor(ctx.locale, "ideas");
  const row = await caseOr404(ctx, code);
  if (row.kind !== "idea") throw new TRPCError({ code: "NOT_FOUND", message: t("access.notIdea") });
  if (token && hashToken(token) !== row.tokenHash) throw new TRPCError({ code: "FORBIDDEN", message: t("access.wrongToken") });
  if (opts.write && !token) throw new TRPCError({ code: "FORBIDDEN", message: t("access.needsToken") });
  const idea = storedIdeaSchema.safeParse(row.idea);
  const canvas = canvasValuesSchema.safeParse(row.canvas);
  return {
    row,
    idea: idea.success
      ? idea.data
      : storedIdeaSchema.parse({ title: row.title, description: row.bodyRedacted, targetGroup: "", areas: row.areas }),
    canvas: row.canvas && canvas.success ? canvas.data : null,
    privateLink: token ? true : false,
  };
}
