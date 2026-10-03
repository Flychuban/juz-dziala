import "server-only";

import { and, eq, gte, ne } from "drizzle-orm";

import type { MapaArea } from "~/lib/domain";
import { db } from "~/server/db";
import { cases, innovations } from "~/server/db/schema";

/**
 * Cheap, deterministic keyword matching used by triage: the library cards the
 * reply draft may quote, and earlier cases that look alike. Polish inflects
 * heavily, so single words compare on a short prefix („senior", „seniorów",
 * „seniorami" → „senio").
 */
const STOP = new Set([
  "jest", "są", "był", "była", "było", "będzie", "mam", "mamy", "nie", "tak",
  "się", "oraz", "albo", "lub", "ale", "dla", "przez", "który", "która",
  "które", "którzy", "jak", "jaki", "jaka", "jakie", "gdzie", "kiedy", "tego",
  "tej", "tym", "ten", "ta", "to", "te", "ich", "jego", "jej", "nas", "nam",
  "was", "wam", "mój", "moja", "moje", "mnie", "bardzo", "także", "również",
  "może", "można", "czy", "żeby", "aby", "bez", "pod", "nad", "przy", "od",
  "do", "na", "po", "za", "we", "ze", "co", "ktoś", "coś", "chcę", "chce",
  "chcemy", "potrzebuję", "potrzeba", "pomoc", "pomocy", "proszę", "dzień",
  "dobry", "osoba", "osoby", "osób", "ludzi", "ludzie", "gmina", "gminie",
  "gminy", "jako", "tylko", "już", "jeszcze", "wiele", "dużo", "mało",
]);

export function stem(word: string): string {
  return word.length >= 6 ? word.slice(0, 5) : word;
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}+/gu) ?? []).filter(
    (w) => w.length >= 4 && !STOP.has(w),
  );
}

export function stems(text: string): Set<string> {
  return new Set(tokens(text).map(stem));
}

export type LibraryCandidate = {
  id: string;
  slug: string;
  title: string;
  mapaAreas: MapaArea[];
  score: number;
  /** First sentences of „Na czym polega rozwiązanie?" — the only text a draft may use. */
  sentences: { id: string; text: string }[];
};

export async function libraryCandidates(
  text: string,
  limit = 3,
): Promise<LibraryCandidate[]> {
  const lower = text.toLowerCase();
  const textStems = stems(text);
  const cards = await db
    .select({
      id: innovations.id,
      slug: innovations.slug,
      title: innovations.title,
      keywords: innovations.keywords,
      mapaAreas: innovations.mapaAreas,
      sentences: innovations.sentences,
    })
    .from(innovations)
    .where(eq(innovations.status, "published"));

  const scored = cards.map((c) => {
    let score = 0;
    const seen = new Set<string>();
    for (const raw of c.keywords) {
      const kw = raw.toLowerCase().trim();
      if (!kw || seen.has(kw)) continue;
      seen.add(kw);
      if (kw.includes(" ")) {
        if (lower.includes(kw)) score += 2;
        else if (kw.split(/\s+/).every((w) => textStems.has(stem(w))))
          score += 1.5;
      } else if (kw.length >= 4 && textStems.has(stem(kw))) {
        score += 1;
      }
    }
    for (const t of new Set(tokens(c.title).map(stem))) {
      if (textStems.has(t)) score += 1.5;
    }
    return { c, score };
  });

  return scored
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score }) => {
      const solution = c.sentences.filter((s) => s.section === "solution");
      const pool = solution.length ? solution : c.sentences;
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        mapaAreas: c.mapaAreas,
        score,
        sentences: pool.slice(0, 2).map((s) => ({ id: s.id, text: s.text })),
      };
    });
}

export type SimilarCaseCandidate = {
  id: string;
  code: string;
  title: string;
  excerpt: string;
  overlap: number;
};

/** Earlier cases (180 days) sharing the most word stems with this one. */
export async function similarCaseCandidates(
  caseId: string,
  text: string,
  limit = 8,
): Promise<SimilarCaseCandidate[]> {
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: cases.id,
      code: cases.code,
      title: cases.title,
      body: cases.bodyRedacted,
    })
    .from(cases)
    .where(and(ne(cases.id, caseId), gte(cases.createdAt, since)))
    .limit(500);
  const mine = stems(text);
  return rows
    .map((r) => {
      const theirs = stems(`${r.title} ${r.body}`);
      let overlap = 0;
      for (const s of theirs) if (mine.has(s)) overlap++;
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        excerpt: r.body.slice(0, 200),
        overlap,
      };
    })
    .filter((r) => r.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);
}
