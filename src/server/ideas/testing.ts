import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import type { MapaArea } from "~/lib/domain";
import { FEEDBACK_THEMES_SYSTEM } from "~/server/ai/prompts/ideas-feedback";
import { aiStructured, userData } from "~/server/ai/structured";
import { firstSentence } from "~/server/api/routers/library";
import { db } from "~/server/db";
import { cases, innovations } from "~/server/db/schema";

/**
 * Module IV — Tester innowacji. Which innovations take testers, and the
 * staff-side summary of what testers said.
 */
export type TestableInnovation = {
  id: string;
  slug: string;
  title: string;
  areas: MapaArea[];
  categoryLabels: string[];
  summary: string;
  videoUrl: string | null;
  badge: string | null;
  testingOpen: boolean;
  sourceUrl: string;
  capturedAt: Date;
};

const columns = {
  id: innovations.id,
  slug: innovations.slug,
  title: innovations.title,
  mapaAreas: innovations.mapaAreas,
  categoryLabels: innovations.categoryLabels,
  sections: innovations.sections,
  sentences: innovations.sentences,
  videoUrl: innovations.videoUrl,
  badge: innovations.badge,
  testingOpen: innovations.testingOpen,
  sourceUrl: innovations.sourceUrl,
  capturedAt: innovations.capturedAt,
};

function toItem(r: {
  id: string;
  slug: string;
  title: string;
  mapaAreas: MapaArea[];
  categoryLabels: string[];
  sections: Parameters<typeof firstSentence>[1];
  sentences: Parameters<typeof firstSentence>[0];
  videoUrl: string | null;
  badge: string | null;
  testingOpen: boolean;
  sourceUrl: string;
  capturedAt: Date;
}): TestableInnovation {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    areas: r.mapaAreas,
    categoryLabels: r.categoryLabels,
    summary: firstSentence(r.sentences, r.sections),
    videoUrl: r.videoUrl,
    badge: r.badge,
    testingOpen: r.testingOpen,
    sourceUrl: r.sourceUrl,
    capturedAt: r.capturedAt,
  };
}

/**
 * Innovations open for testers (`testingOpen`, set by ROPS). When none is
 * flagged, the cards ROPS chose for dissemination („wybrana do
 * upowszechniania") are offered as candidates — and the page says so.
 */
export async function testingList(): Promise<{ mode: "open" | "candidates"; items: TestableInnovation[] }> {
  const open = await db
    .select(columns)
    .from(innovations)
    .where(and(eq(innovations.status, "published"), eq(innovations.testingOpen, true)));
  if (open.length > 0) {
    return { mode: "open", items: open.map(toItem).sort((a, b) => a.title.localeCompare(b.title, "pl")) };
  }
  const candidates = await db
    .select(columns)
    .from(innovations)
    .where(and(eq(innovations.status, "published"), isNotNull(innovations.badge)));
  return { mode: "candidates", items: candidates.map(toItem).sort((a, b) => a.title.localeCompare(b.title, "pl")) };
}

export async function testableBySlug(slug: string): Promise<TestableInnovation | null> {
  const [row] = await db
    .select(columns)
    .from(innovations)
    .where(and(eq(innovations.slug, slug), eq(innovations.status, "published")));
  return row ? toItem(row) : null;
}

export async function testableById(id: string): Promise<TestableInnovation | null> {
  const [row] = await db
    .select(columns)
    .from(innovations)
    .where(and(eq(innovations.id, id), eq(innovations.status, "published")));
  return row ? toItem(row) : null;
}

// ------------------------------------------------------------------ staff summary

const themesSchema = z.object({
  themes: z.array(
    z.object({ name: z.string(), kind: z.string(), summary: z.string(), opinionNumbers: z.array(z.number()) }),
  ),
});

export type FeedbackTheme = { name: string; kind: "works" | "improve" | "idea"; summary: string; caseCodes: string[] };
export type FeedbackComment = { code: string; rating: number | null; body: string; createdAt: Date };

export type FeedbackSummary = {
  innovationId: string;
  feedbackCount: number;
  testSignUps: number;
  averageRating: number | null;
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  comments: FeedbackComment[];
  /** AI grouping; null when the assistant is unavailable or failed (the page shows the raw list). */
  themes: FeedbackTheme[] | null;
  aiStatus: "ok" | "unavailable" | "failed" | "skipped";
};

export async function feedbackSummary(innovationId: string): Promise<FeedbackSummary> {
  const rows = await db
    .select({ code: cases.code, kind: cases.kind, rating: cases.rating, body: cases.bodyRedacted, createdAt: cases.createdAt })
    .from(cases)
    .where(eq(cases.innovationId, innovationId));
  const feedback = rows.filter((r) => r.kind === "feedback").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const ratings = feedback.map((r) => r.rating).filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const r of ratings) ratingCounts[r as 1 | 2 | 3 | 4 | 5]++;
  const comments = feedback.map((r) => ({ code: r.code, rating: r.rating, body: r.body, createdAt: r.createdAt }));
  const base = {
    innovationId,
    feedbackCount: feedback.length,
    testSignUps: rows.filter((r) => r.kind === "test").length,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    ratingCounts,
    comments,
  };
  if (comments.length < 2) return { ...base, themes: null, aiStatus: "skipped" };

  const sample = comments.slice(0, 60);
  const res = await aiStructured({
    fn: "tests.summary",
    schema: themesSchema,
    system: [{ text: FEEDBACK_THEMES_SYSTEM, cache: true }],
    user: userData("opinie", sample.map((c, i) => `Opinia ${i + 1}:\n${c.body}`).join("\n\n")),
    effort: "low",
    maxTokens: 2500,
  });
  if (!res.ok) return { ...base, themes: null, aiStatus: res.reason === "unavailable" ? "unavailable" : "failed" };
  const themes: FeedbackTheme[] = res.data.themes
    .map((t) => {
      const kind: FeedbackTheme["kind"] = t.kind === "works" || t.kind === "improve" || t.kind === "idea" ? t.kind : "improve";
      const codes = [...new Set(t.opinionNumbers)]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= sample.length)
        .map((n) => sample[n - 1]!.code);
      return { name: t.name.trim().slice(0, 80), kind, summary: t.summary.trim().slice(0, 400), caseCodes: codes };
    })
    // A theme must rest on at least one real opinion.
    .filter((t) => t.name && t.caseCodes.length > 0)
    .slice(0, 6);
  return { ...base, themes, aiStatus: "ok" };
}
