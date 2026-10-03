import "server-only";

import { TRPCError } from "@trpc/server";

import { normalizeCaseCode } from "~/server/domain/case-code";
import { api } from "~/trpc/server";

export type IdeaPageData = Awaited<ReturnType<typeof api.ideas.get>>;

/**
 * The idea case behind /ideas/[code]/… pages. Returns a Polish message instead
 * of throwing, so the page can explain what went wrong and offer the code entry.
 */
export async function loadIdeaForPage(
  rawCode: string,
  token: string | undefined,
): Promise<{ ok: true; data: IdeaPageData; code: string } | { ok: false; message: string; code: string | null }> {
  const code = normalizeCaseCode(decodeURIComponent(rawCode));
  if (!code) return { ok: false, code: null, message: "To nie wygląda na kod sprawy. Kod ma postać JD-XXXX-XXXX." };
  try {
    return { ok: true, data: await api.ideas.get({ code, token }), code };
  } catch (e) {
    if (e instanceof TRPCError) return { ok: false, code, message: e.message };
    throw e;
  }
}

export function tokenParam(sp: Record<string, string | string[] | undefined>): string | undefined {
  const t = sp.t;
  return typeof t === "string" && t.length <= 200 ? t : undefined;
}

export function withToken(path: string, token: string | undefined): string {
  return token ? `${path}?t=${encodeURIComponent(token)}` : path;
}
