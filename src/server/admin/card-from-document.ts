import "server-only";

import { z } from "zod";

import { env } from "~/env";
import { type Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { MAPA_AREAS, SECTION_KEYS, type SectionKey } from "~/lib/domain";
import { userData } from "~/server/ai/structured";
import {
  ADMIN_CARD_INSTRUCTION,
  ADMIN_CARD_SYSTEM,
} from "~/server/ai/prompts/admin-card";
import { redactPII } from "~/server/domain/redact";
import {
  aiStructuredWithDocument,
  pdfBlock,
  type UserContent,
} from "./ai-document";
import { htmlToText, quoteFound } from "./document-text";

export { htmlToText, quoteFound };

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 150_000;

const draftField = z.object({
  found: z.boolean(),
  text: z.string(),
  sourceQuote: z.string(),
});

/** What the model returns (kept permissive — trimmed on the server). */
export const cardDraftSchema = z.object({
  title: draftField,
  sections: z.object({
    solution: draftField,
    problems: draftField,
    targetGroup: draftField,
    whoCanUse: draftField,
    doesItWork: draftField,
    authors: draftField,
  }),
  mapaAreas: z.array(z.enum(MAPA_AREAS)),
  keywords: z.array(z.string()),
  videoUrl: z.string().nullable(),
  warnings: z.array(z.string()),
});

/** One drafted field, with the quote that supports it and whether we found that quote. */
export type DraftField = {
  text: string;
  quote: string;
  /** "verified": the quote occurs in the document text; "unverified": PDF, check by eye; "missing": no quote. */
  check: "verified" | "unverified" | "missing" | "not_found";
};

export type CardDraft = {
  title: DraftField;
  sections: Record<SectionKey, DraftField>;
  mapaAreas: (typeof MAPA_AREAS)[number][];
  keywords: string[];
  videoUrl: string | null;
  warnings: string[];
  source: { kind: "pdf" | "text" | "url"; name: string; url: string | null };
};

export type DocumentInput =
  | { kind: "pdf"; base64: string; filename: string }
  | { kind: "text"; text: string }
  | { kind: "url"; url: string };

export type DraftResult =
  | { ok: true; draft: CardDraft; costUsd: number }
  | { ok: false; reason: "unavailable" | "failed" | "input"; message: string };

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

type T = ReturnType<typeof translatorFor<"admin">>;

/** Fetches a public page or PDF for drafting (http/https only, 10 MB, 20 s). */
async function fetchUrl(
  raw: string,
  t: T,
): Promise<
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string }
  | { error: string }
> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: t("document.badAddress") };
  }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname))
    return { error: t("document.publicAddress") };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "user-agent": "JuzDziala/1.0 (ROPS Krakow; HackYeah prototype)",
      },
    });
    if (!res.ok)
      return { error: t("document.httpStatus", { status: res.status }) };
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_DOCUMENT_BYTES) return { error: t("document.tooBig") };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_DOCUMENT_BYTES)
      return { error: t("document.tooBig") };
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("pdf") || buf.subarray(0, 5).toString() === "%PDF-")
      return { kind: "pdf", base64: buf.toString("base64") };
    const text = type.includes("html")
      ? htmlToText(buf.toString("utf8"))
      : buf.toString("utf8");
    return { kind: "text", text };
  } catch {
    return { error: t("document.fetchFailed") };
  }
}

function clean(s: string, max = 4000) {
  return redactPII(s.trim()).text.slice(0, max);
}

/**
 * Drafts the six sections of a card from a document. Each field comes with a
 * verbatim quote; for text and web pages the quote is checked against the
 * source on the server, for PDFs it is marked for a person to check.
 * Pasted text and web pages are redacted (redactPII) before they reach the
 * model; a PDF is sent as is, so only public documents should be used.
 * The card is always drafted in Polish (the Library's source language);
 * only the messages follow the staff member's language.
 */
export async function cardFromDocument(
  input: DocumentInput,
  locale: Locale = "pl",
): Promise<DraftResult> {
  const t = translatorFor(locale, "admin");
  let content: UserContent;
  let sourceText: string | null = null;
  let source: CardDraft["source"];

  if (input.kind === "url") {
    if (env.DEMO_MODE === "1") {
      return { ok: false, reason: "input", message: t("document.demoNoUrl") };
    }
    const got = await fetchUrl(input.url, t);
    if ("error" in got)
      return { ok: false, reason: "input", message: got.error };
    source = { kind: "url", name: input.url, url: input.url };
    if (got.kind === "pdf") {
      content = [
        pdfBlock(got.base64, input.url),
        { type: "text", text: ADMIN_CARD_INSTRUCTION },
      ];
    } else {
      sourceText = redactPII(got.text.slice(0, MAX_TEXT_CHARS)).text;
      content = [
        {
          type: "text",
          text: `${userData("dokument", sourceText)}\n\n${ADMIN_CARD_INSTRUCTION}`,
        },
      ];
    }
  } else if (input.kind === "text") {
    if (input.text.trim().length < 80)
      return {
        ok: false,
        reason: "input",
        message: t("document.textTooShort"),
      };
    sourceText = redactPII(input.text.slice(0, MAX_TEXT_CHARS)).text;
    source = { kind: "text", name: t("document.pastedText"), url: null };
    content = [
      {
        type: "text",
        text: `${userData("dokument", sourceText)}\n\n${ADMIN_CARD_INSTRUCTION}`,
      },
    ];
  } else {
    const bytes = Math.floor((input.base64.length * 3) / 4);
    if (bytes > MAX_DOCUMENT_BYTES)
      return { ok: false, reason: "input", message: t("document.tooBig") };
    if (
      !Buffer.from(input.base64.slice(0, 8), "base64")
        .toString()
        .startsWith("%PDF")
    )
      return { ok: false, reason: "input", message: t("document.notPdf") };
    source = { kind: "pdf", name: input.filename, url: null };
    content = [
      pdfBlock(input.base64, input.filename),
      { type: "text", text: ADMIN_CARD_INSTRUCTION },
    ];
  }

  const res = await aiStructuredWithDocument({
    fn: "admin.cardFromDocument",
    schema: cardDraftSchema,
    system: [{ text: ADMIN_CARD_SYSTEM, cache: true }],
    content,
    effort: "medium",
  });
  if (!res.ok) {
    return res.reason === "unavailable"
      ? {
          ok: false,
          reason: "unavailable",
          message: t("document.aiUnavailable"),
        }
      : { ok: false, reason: "failed", message: t("document.failed") };
  }

  const field = (f: z.infer<typeof draftField>, max?: number): DraftField => {
    const text = f.found ? clean(f.text, max) : "";
    const quote = f.found ? f.sourceQuote.trim().slice(0, 400) : "";
    const check: DraftField["check"] = !quote
      ? "missing"
      : sourceText === null
        ? "unverified"
        : quoteFound(quote, sourceText)
          ? "verified"
          : "not_found";
    return { text, quote, check };
  };

  const d = res.data;
  const video = d.videoUrl?.trim() ?? "";
  return {
    ok: true,
    costUsd: res.costUsd,
    draft: {
      title: field(d.title, 200),
      sections: Object.fromEntries(
        SECTION_KEYS.map((k) => [k, field(d.sections[k])]),
      ) as Record<SectionKey, DraftField>,
      mapaAreas: [...new Set(d.mapaAreas)],
      keywords: [
        ...new Set(
          d.keywords
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k.length >= 2),
        ),
      ].slice(0, 12),
      videoUrl: /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(video)
        ? video
        : null,
      warnings: d.warnings
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 8),
      source,
    },
  };
}
