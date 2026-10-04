/**
 * English view of a library card (pure, unit-tested; no server imports).
 *
 * A card's English version (`innovations.en`, from scripts/translate-data.ts)
 * is used only while it is fresh: `en.sourceSha` must equal the sha256 of the
 * Polish text it was made from. When staff edit the Polish card, the hash no
 * longer matches and the Polish original is shown instead, marked lang="pl".
 *
 * Other modules (match, municipality, adapt, testing) can use `localizeCard`
 * to show a card in the visitor's language with the same rule. Its
 * `sentences` are the translated card sentences by id (empty in the rare case
 * the stored sentence ids do not match the translation's).
 */
import { createHash } from "node:crypto";

import { SECTION_KEYS, type SectionKey } from "~/lib/domain";
import type { CardSentence, InnovationEn } from "~/server/db/schema";

/** Language the content is actually shown in (not the visitor's choice). */
export type ContentLang = "pl" | "en";

/**
 * sha256 of the Polish sections + title, exactly as the translation script
 * computes it over data/library.json. Postgres jsonb reorders object keys, so
 * the sections are put back in the card's printed order (SECTION_KEYS, then
 * any other key in its stored order) before hashing.
 */
export function sourceShaOf(
  sections: Partial<Record<SectionKey, string>> &
    Record<string, string | undefined>,
  title: string,
): string {
  const keys = [
    ...SECTION_KEYS.filter((k) => k in sections),
    ...Object.keys(sections).filter(
      (k) => !(SECTION_KEYS as readonly string[]).includes(k),
    ),
  ];
  const ordered = Object.fromEntries(keys.map((k) => [k, sections[k]]));
  return createHash("sha256")
    .update(JSON.stringify(ordered) + title)
    .digest("hex");
}

type CardLike = {
  title: string;
  sections: Record<SectionKey, string>;
  sentences: CardSentence[];
  keywords: string[];
  categoryLabels: string[];
  badge: string | null;
  en: InnovationEn | null;
};

/**
 * The card's English version when it was made from the current Polish text
 * (sourceSha matches); otherwise null (missing or stale).
 */
export function freshEnglish(
  card: Omit<CardLike, "keywords" | "categoryLabels" | "badge" | "sentences">,
): InnovationEn | null {
  const en = card.en;
  if (!en?.title?.trim() || !en.sections || !en.sourceSha) return null;
  if (sourceShaOf(card.sections, card.title) !== en.sourceSha) return null;
  return en;
}

/**
 * English section text laid out like the Polish one: each Polish sentence is
 * replaced in place by its translation, so paragraph breaks and „-" list
 * markers survive. When the sentences cannot be found in order, or the text
 * between them is more than whitespace and list markers, the translation's
 * own (single-paragraph) text is used.
 */
export function layoutLike(
  polish: string,
  pairs: { pl: string; en: string }[],
  fallback: string,
): string {
  let out = "";
  let cursor = 0;
  for (const p of pairs) {
    const at = polish.indexOf(p.pl, cursor);
    if (at < 0) return fallback;
    const gap = polish.slice(cursor, at);
    if (!/^[\s\-–•·*]*$/u.test(gap)) return fallback;
    out += gap + p.en;
    cursor = at + p.pl.length;
  }
  const tail = polish.slice(cursor);
  if (!/^[\s\-–•·*]*$/u.test(tail)) return fallback;
  return out + tail;
}

export type LocalizedCard = {
  /** The language of title/sections/sentences below. */
  lang: ContentLang;
  title: string;
  sections: Record<SectionKey, string>;
  sentences: CardSentence[];
  keywords: string[];
  categoryLabels: string[];
  badge: string | null;
};

/**
 * The card in the visitor's language: English when `locale` is "en" and a
 * fresh translation exists, the Polish original otherwise (lang "pl").
 * Category labels use the fixed glossary translation even for a stale card,
 * because they do not depend on the card's text.
 */
export function localizeCard(card: CardLike, locale: string): LocalizedCard {
  const polish: LocalizedCard = {
    lang: "pl",
    title: card.title,
    sections: card.sections,
    sentences: card.sentences,
    keywords: card.keywords,
    categoryLabels: card.categoryLabels,
    badge: card.badge,
  };
  if (locale !== "en") return polish;
  const glossaryLabels =
    card.en?.categoryLabels?.length === card.categoryLabels.length
      ? card.en.categoryLabels
      : card.categoryLabels;
  const en = freshEnglish(card);
  if (!en) return { ...polish, categoryLabels: glossaryLabels };
  // Sentence ids normally all match. If the stored card was split into
  // sentences differently (an older seed), the text is still the translated
  // one — only the sentence-by-sentence layout is unavailable.
  const byId = en.sentences ?? {};
  const allSentences = card.sentences.every((s) => !!byId[s.id]?.trim());
  return {
    lang: "en",
    title: en.title.trim(),
    sections: Object.fromEntries(
      SECTION_KEYS.map((k) => [
        k,
        allSentences
          ? layoutLike(
              card.sections[k] ?? "",
              card.sentences
                .filter((s) => s.section === k)
                .map((s) => ({ pl: s.text, en: byId[s.id]! })),
              en.sections[k] ?? "",
            )
          : (en.sections[k] ?? ""),
      ]),
    ) as Record<SectionKey, string>,
    sentences: allSentences
      ? card.sentences.map((s) => ({ ...s, text: byId[s.id]! }))
      : [],
    keywords: en.keywords ?? [],
    categoryLabels: glossaryLabels,
    badge: card.badge ? (en.badge ?? card.badge) : null,
  };
}
