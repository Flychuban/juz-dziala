import "server-only";

import { TRPCError } from "@trpc/server";

import { getServerLocale, translatorFor } from "~/i18n/server";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { api } from "~/trpc/server";

export type IdeaPageData = Awaited<ReturnType<typeof api.ideas.get>>;

/**
 * The idea case behind /ideas/[code]/… pages. Returns a message in the
 * visitor's language instead of throwing, so the page can explain what went
 * wrong and offer the code entry.
 */
export async function loadIdeaForPage(
  rawCode: string,
  token: string | undefined,
): Promise<{ ok: true; data: IdeaPageData; code: string } | { ok: false; message: string; code: string | null }> {
  const t = translatorFor(await getServerLocale(), "ideas");
  const code = normalizeCaseCode(decodeURIComponent(rawCode));
  if (!code) return { ok: false, code: null, message: t("notFound.badCode") };
  try {
    return { ok: true, data: await api.ideas.get({ code, token }), code };
  } catch (e) {
    if (e instanceof TRPCError) {
      // „No such case" comes from the case engine; ours (not an idea, wrong link) are already translated.
      const missing = e.code === "NOT_FOUND" && e.message !== t("access.notIdea");
      return { ok: false, code, message: missing ? t("notFound.missing") : e.message };
    }
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
