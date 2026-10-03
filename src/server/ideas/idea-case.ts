import "server-only";

import { TRPCError } from "@trpc/server";

import type { Context } from "~/server/api/trpc";
import { caseOr404 } from "~/server/cases/access";
import type { CaseRow } from "~/server/cases/queries";
import { hashToken } from "~/server/domain/case-code";
import { canvasValuesSchema, storedIdeaSchema, type CanvasValues, type StoredIdea } from "./schema";

export type IdeaCase = {
  row: CaseRow;
  idea: StoredIdea;
  canvas: CanvasValues | null;
  /** The private-link token matched (the code alone also opens it in the prototype). */
  privateLink: boolean;
};

/**
 * An idea Sprawa by its code. The code is the key (as for every case in the
 * prototype); a token, when given, must be the right one — a wrong token is
 * refused rather than ignored.
 */
export async function loadIdeaCase(ctx: Context, code: string, token?: string): Promise<IdeaCase> {
  const row = await caseOr404(ctx, code);
  if (row.kind !== "idea") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ta sprawa nie jest pomysłem — Canvas i wniosek są dostępne tylko dla pomysłów." });
  }
  if (token && hashToken(token) !== row.tokenHash) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ten link prywatny jest nieprawidłowy. Otwórz sprawę samym kodem albo z linku, który dostałeś." });
  }
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
