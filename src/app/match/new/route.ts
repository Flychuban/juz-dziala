import { TRPCError } from "@trpc/server";
import { NextResponse, type NextRequest } from "next/server";

import { MATCH_TEXT_MAX, matchStartInput, startMatchFor } from "~/server/api/routers/match";
import { createTRPCContext } from "~/server/api/trpc";

/**
 * The home page form without JavaScript (before hydration, or with scripts
 * off): the same start as `match.start` — same validation, same rate limit —
 * then a 303 redirect to the results page. Errors go back to the home page as
 * a code the page words in its own language (/?error=short|long|rate|failed),
 * with the picked gmina kept (/?gmina=<TERYT> preselects it).
 *
 * The form posts here, so the description never sits in a URL (browser
 * history, server logs) before it has been redacted. GET is accepted too, for
 * a link such as /match/new?text=…
 */
export const dynamic = "force-dynamic";

const GMINA = /^\d{6,7}$/u;

/** Back to the form with an error code (and the picked gmina, so it stays selected). */
function back(req: NextRequest, error: "short" | "long" | "rate" | "failed", gmina = "") {
  const url = new URL("/", req.url);
  url.searchParams.set("error", error);
  if (GMINA.test(gmina)) url.searchParams.set("gmina", gmina);
  return NextResponse.redirect(url, 303);
}

async function start(req: NextRequest, texts: string[], gmina: string | null) {
  // A clicked example chip is submitted after the (possibly empty) textarea: the last filled value wins.
  const text = [...texts].reverse().find((t) => t.trim()) ?? "";
  const g = gmina?.trim() ?? "";
  const parsed = matchStartInput.safeParse({ text, ...(GMINA.test(g) ? { gminaTeryt: g } : {}) });
  if (!parsed.success) return back(req, text.trim().length > MATCH_TEXT_MAX ? "long" : "short", g);
  const ctx = await createTRPCContext({ headers: req.headers });
  try {
    const view = await startMatchFor(ctx, parsed.data);
    return NextResponse.redirect(new URL(`/match/${view.runId}`, req.url), 303);
  } catch (e) {
    if (e instanceof TRPCError && e.code === "TOO_MANY_REQUESTS") return back(req, "rate", g);
    console.error("[match/new] could not start a match", e);
    return back(req, "failed", g);
  }
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "short");
  }
  const texts = form.getAll("text").filter((v): v is string => typeof v === "string");
  const gmina = form.get("gmina");
  return start(req, texts, typeof gmina === "string" ? gmina : null);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  return start(req, params.getAll("text"), params.get("gmina"));
}
