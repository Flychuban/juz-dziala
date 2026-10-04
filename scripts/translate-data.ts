/**
 * English sidecars for the Polish source data: `pnpm data:translate`.
 *
 *   data/library.json   → data/library.en.json   (per card: title, every sentence by id, keywords)
 *   data/knowledge.json → data/knowledge.en.json  (same structure, prose translated)
 *   data/calls.json     → data/calls.en.json
 *   data/canvas.json    → data/canvas.en.json
 *   data/learn.json     → data/learn.en.json
 *
 * Every Claude call goes through aiStructured (logged with cost). A card is
 * accepted only if every sentence id comes back exactly once; otherwise it is
 * retried, then left untranslated (the site then shows the Polish original).
 * Existing translations whose Polish source is unchanged (sha256) are kept, so
 * re-running only translates what changed. Category labels and badges use the
 * fixed glossary below, never the model.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";

import { z } from "zod";

const SERVER_ONLY_HOOK = `export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(SERVER_ONLY_HOOK)}`);

const DATA = join(process.cwd(), "data");
const CONCURRENCY = 6;

export const CATEGORY_EN: Record<string, string> = {
  "Dla cudzoziemców": "For foreigners",
  "Dla dzieci, młodzieży i rodziny": "For children, young people and families",
  "Dla osób o ograniczonej mobilności": "For people with limited mobility",
  "Dla osób w kryzysie bezdomności": "For people experiencing homelessness",
  "Dla osób z niepełnosprawnością intelektualną": "For people with intellectual disabilities",
  "Dla osób z niepełnosprawnością sensoryczną": "For people with sensory disabilities",
  "Dla rynku pracy": "For the labour market",
  "Dla seniorów": "For older people",
  "Dla zdrowia i medycyny": "For health and medicine",
};

export const BADGE_EN: Record<string, string> = {
  'INNOWACJA WYBRANA DO UPOWSZECHNIANIA W RAMACH PROJEKTU "INKUBATOR DOSTĘPNOŚCI"':
    'INNOVATION SELECTED FOR DISSEMINATION IN THE "INKUBATOR DOSTĘPNOŚCI" (ACCESSIBILITY INCUBATOR) PROJECT',
  'INNOWACJA WYBRANA DO UPOWSZECHNIANIA W RAMACH PROJEKTU "INKUBATOR WŁĄCZENIA SPOŁECZNEGO"':
    'INNOVATION SELECTED FOR DISSEMINATION IN THE "INKUBATOR WŁĄCZENIA SPOŁECZNEGO" (SOCIAL INCLUSION INCUBATOR) PROJECT',
  'INNOWACJA WYBRANA DO UPOWSZECHNIANIA W RAMACH PROJEKTU "MAŁOPOLSKI INKUBATOR INNOWACJI SPOŁECZNYCH"':
    'INNOVATION SELECTED FOR DISSEMINATION IN THE "MAŁOPOLSKI INKUBATOR INNOWACJI SPOŁECZNYCH" (MAŁOPOLSKA SOCIAL INNOVATION INCUBATOR) PROJECT',
  'INNOWACJA WYBRANA DO UPOWSZECHNIANIA W RAMACH PROJEKTU "MAŁOPOLSKIEGO INKUBATORA WŁĄCZENIA SPOŁECZNEGO"':
    'INNOVATION SELECTED FOR DISSEMINATION IN THE "MAŁOPOLSKI INKUBATOR WŁĄCZENIA SPOŁECZNEGO" (MAŁOPOLSKA SOCIAL INCLUSION INCUBATOR) PROJECT',
};

const SYSTEM = `Tłumaczysz materiały Regionalnego Ośrodka Polityki Społecznej w Krakowie (ROPS) z polskiego na angielski (British English) dla serwisu publicznego. Czytelnicy to mieszkańcy, w tym seniorzy i cudzoziemcy.

Zasady:
- Tłumacz wiernie i kompletnie. Niczego nie dodawaj, nie skracaj i nie poprawiaj merytorycznie. Liczby, daty i kwoty przepisuj dokładnie.
- Prosty, naturalny angielski. Bez żargonu, bez ozdobników.
- Nazwy własne organizacji, programów, projektów i miejscowości zostaw po polsku (np. „Fundacja Pestka”, „Usługa Wrażliwa”, „Małopolska”, „Kraków”).
- Stały słownik: Regionalny Ośrodek Polityki Społecznej w Krakowie → Regional Social Policy Centre in Kraków (ROPS); gmina → municipality (gmina); powiat → county (powiat); OPS / GOPS / MOPS → social welfare centre (OPS / GOPS / MOPS); PCPR → county family support centre (PCPR); CUS → social services centre (CUS); ROPS → ROPS; piecza zastępcza → foster care; osoby z niepełnosprawnością → people with disabilities; seniorzy / osoby starsze → older people; JST → local government; NGO / organizacja pozarządowa → NGO; innowacja społeczna → social innovation; nabór → call for proposals; wniosek → application; Mapa Wyzwań Społecznych → Social Challenges Map (Mapa Wyzwań Społecznych).
- Zwracasz dokładnie te same identyfikatory, w tej samej liczbie, każdy raz.`;

type Ai = typeof import("~/server/ai/structured");
let ai: Ai;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]!, i);
      }
    }),
  );
}

/* ───────────────────────── library cards ───────────────────────── */

type Card = {
  id: string;
  slug: string;
  title: string;
  categoryLabels: string[];
  keywords?: string[];
  badge?: string | null;
  sections: Record<string, string>;
  sentences: { id: string; section: string; text: string }[];
};

const cardOut = z.object({
  title: z.string(),
  sentences: z.array(z.object({ id: z.string(), text: z.string() })),
  keywords: z.array(z.string()),
});

async function translateCard(card: Card) {
  const payload = {
    title: card.title,
    sentences: card.sentences.map((s) => ({ id: s.id, text: s.text })),
    keywords: card.keywords ?? [],
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await ai.aiStructured({
      fn: "i18n.translate",
      schema: cardOut,
      system: [{ text: SYSTEM, cache: true }],
      user: `Przetłumacz na angielski kartę innowacji. Zwróć title, sentences (te same id) i keywords (krótkie hasła po angielsku, tyle samo pozycji).\n\n${JSON.stringify(payload)}`,
      effort: "low",
      maxTokens: 8000,
      timeoutMs: 120_000,
    });
    if (!r.ok) {
      console.warn(`  ${card.id} attempt ${attempt}: ${r.reason} ${r.message ?? ""}`);
      continue;
    }
    const got = new Map(r.data.sentences.map((s) => [s.id, s.text.trim()]));
    const want = card.sentences.map((s) => s.id);
    if (got.size !== want.length || want.some((id) => !got.get(id))) {
      console.warn(`  ${card.id} attempt ${attempt}: sentence ids do not match`);
      continue;
    }
    const sentences = Object.fromEntries(want.map((id) => [id, got.get(id)!]));
    const sections: Record<string, string> = {};
    for (const key of Object.keys(card.sections)) {
      sections[key] = card.sentences
        .filter((s) => s.section === key)
        .map((s) => sentences[s.id])
        .join(" ");
    }
    return {
      title: r.data.title.trim(),
      sections,
      sentences,
      keywords: r.data.keywords.map((k) => k.trim()).filter(Boolean),
      categoryLabels: card.categoryLabels.map((l) => CATEGORY_EN[l] ?? l),
      badge: card.badge ? (BADGE_EN[card.badge] ?? null) : null,
      sourceSha: sha(JSON.stringify(card.sections) + card.title),
      translatedAt: new Date().toISOString(),
      costUsd: r.costUsd,
    };
  }
  return null;
}

async function library() {
  const cards = JSON.parse(readFileSync(join(DATA, "library.json"), "utf8")) as Card[];
  const outFile = join(DATA, "library.en.json");
  const prev = existsSync(outFile)
    ? (JSON.parse(readFileSync(outFile, "utf8")) as Record<string, { sourceSha: string }>)
    : {};
  const out: Record<string, unknown> = {};
  let cost = 0;
  let failed = 0;
  await pool(cards, CONCURRENCY, async (card, i) => {
    const s = sha(JSON.stringify(card.sections) + card.title);
    if (prev[card.id]?.sourceSha === s) {
      out[card.id] = prev[card.id];
      return;
    }
    const en = await translateCard(card);
    if (!en) {
      failed++;
      return;
    }
    const { costUsd, ...rest } = en;
    cost += costUsd;
    out[card.id] = rest;
    console.log(`  [${i + 1}/${cards.length}] ${card.id} ${rest.title}`);
  });
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(outFile, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`library: ${Object.keys(sorted).length}/${cards.length} cards, ${failed} failed, $${cost.toFixed(3)}`);
}

/* ─────────────── generic JSON (knowledge, calls, canvas, learn) ─────────────── */

/** Keys whose values are never prose: identifiers, links, dates, hashes, enums. */
const SKIP_KEYS = new Set([
  "key", "id", "url", "href", "sourceUrl", "sha256", "date", "capturedAt", "checkedAt", "versionDate",
  "version", "status", "currency", "kind", "scope", "unit", "slug", "areas", "innovations", "page", "pages",
  "from", "to", "year", "httpStatus", "videoUrl", "icon", "type", "field",
]);

function isProse(s: string) {
  return /\p{L}{2,}/u.test(s) && !/^https?:\/\//.test(s) && !/^[a-z0-9_-]+$/.test(s);
}

function collect(node: unknown, path: (string | number)[], out: { path: (string | number)[]; text: string }[]) {
  if (typeof node === "string") {
    if (isProse(node)) out.push({ path, text: node });
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, [...path, i], out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      collect(v, [...path, k], out);
    }
  }
}

function setAt(root: unknown, path: (string | number)[], value: string) {
  let n = root as Record<string | number, unknown>;
  for (const p of path.slice(0, -1)) n = n[p] as Record<string | number, unknown>;
  n[path[path.length - 1]!] = value;
}

const stringsOut = z.object({ items: z.array(z.object({ i: z.number(), text: z.string() })) });

async function translateFile(name: string) {
  const src = JSON.parse(readFileSync(join(DATA, `${name}.json`), "utf8")) as unknown;
  const leaves: { path: (string | number)[]; text: string }[] = [];
  collect(src, [], leaves);
  const out = structuredClone(src);
  const batches: { i: number; text: string }[][] = [];
  let cur: { i: number; text: string }[] = [];
  let size = 0;
  leaves.forEach((l, i) => {
    if (size + l.text.length > 2500 && cur.length) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push({ i, text: l.text });
    size += l.text.length;
  });
  if (cur.length) batches.push(cur);
  let done = 0;
  let cost = 0;
  await pool(batches, CONCURRENCY, async (batch) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const r = await ai.aiStructured({
        fn: "i18n.translate",
        schema: stringsOut,
        system: [{ text: SYSTEM, cache: true }],
        user: `Przetłumacz na angielski każdy tekst. Zwróć items z tym samym i.\n\n${JSON.stringify(batch)}`,
        effort: "low",
        maxTokens: 12000,
        timeoutMs: 150_000,
      });
      if (!r.ok) {
        console.warn(`  ${name}: batch attempt ${attempt}: ${r.reason} ${r.message ?? ""}`);
        continue;
      }
      const got = new Map(r.data.items.map((x) => [x.i, x.text.trim()]));
      if (batch.some((b) => !got.get(b.i))) {
        console.warn(`  ${name}: batch attempt ${attempt}: indices do not match`);
        continue;
      }
      for (const b of batch) setAt(out, leaves[b.i]!.path, got.get(b.i)!);
      done += batch.length;
      cost += r.costUsd;
      return;
    }
    console.warn(`  ${name}: a batch of ${batch.length} stayed in Polish`);
  });
  writeFileSync(join(DATA, `${name}.en.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(`${name}: ${done}/${leaves.length} strings, $${cost.toFixed(3)}`);
}

async function main() {
  ai = await import("~/server/ai/structured");
  if (!ai.aiAvailable()) throw new Error("ANTHROPIC_API_KEY is not set.");
  const only = process.argv.slice(2);
  const want = (n: string) => only.length === 0 || only.includes(n);
  const jobs: Promise<void>[] = [];
  if (want("library")) jobs.push(library());
  for (const f of ["knowledge", "calls", "canvas", "learn"]) if (want(f)) jobs.push(translateFile(f));
  await Promise.all(jobs);
  process.exit(0);
}

void main();
