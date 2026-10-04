/**
 * Optional data files produced by the Data agent: data/knowledge.json (facts
 * per Mapa area, with source; English in data/knowledge.en.json) and
 * data/gminas.json (gmina names and TERYT codes). Any may be missing; every
 * reader then returns an empty result. Parsers are tolerant of shape and
 * never invent a value they cannot read.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isMapaArea, type MapaArea } from "~/server/domain/types";

// ---------------------------------------------------------------------------
// knowledge.json: {areas:[{key,label,keyChallenges[],figures[],pages[]}], source:{title,url}}
// ---------------------------------------------------------------------------

export type KnowledgeFact = {
  area: MapaArea;
  areaLabel: string;
  text: string;
  sourceTitle: string;
  sourceUrl: string | null;
  /** Publication date of the source as written there (e.g. "2024-11"), when given. */
  sourceDate: string | null;
  /** Page reference in the source document, when given. */
  page: string | null;
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

function figureText(f: unknown): { text: string; sourceTitle?: string; sourceUrl?: string; page?: string } | null {
  if (typeof f === "string") return f.trim() ? { text: f.trim() } : null;
  if (!isRec(f)) return null;
  const direct = str(f.text) ?? str(f.fact) ?? str(f.description);
  let text = direct;
  if (!text) {
    const label = str(f.label) ?? str(f.name);
    const value = str(f.value);
    if (!label || !value) return null;
    const unit = str(f.unit);
    const year = str(f.year) ?? str(f.period);
    const where = str(f.scope) ?? str(f.region);
    text = `${label}: ${value}${unit ? ` ${unit}` : ""}${where ? ` (${where}${year ? `, ${year}` : ""})` : year ? ` (${year})` : ""}`;
  }
  const src = isRec(f.source) ? f.source : null;
  return {
    text,
    ...(str(src?.title) ?? str(f.sourceTitle) ? { sourceTitle: (str(src?.title) ?? str(f.sourceTitle))! } : {}),
    ...(str(src?.url) ?? str(f.sourceUrl) ? { sourceUrl: (str(src?.url) ?? str(f.sourceUrl))! } : {}),
    ...(str(f.page) ? { page: str(f.page)! } : {}),
  };
}

/** The first readable figure (else key challenge) for each area, with its source. */
export function parseKnowledge(json: unknown): Map<MapaArea, KnowledgeFact> {
  const out = new Map<MapaArea, KnowledgeFact>();
  if (!isRec(json) || !Array.isArray(json.areas)) return out;
  const source = isRec(json.source) ? json.source : {};
  const defaultTitle = str(source.title);
  const defaultUrl = str(source.url);
  const defaultDate = str(source.date);
  for (const a of json.areas) {
    if (!isRec(a) || !isMapaArea(a.key)) continue;
    const label = str(a.label) ?? a.key;
    const figures = Array.isArray(a.figures) ? a.figures : [];
    const challenges = Array.isArray(a.keyChallenges) ? a.keyChallenges : [];
    const pages = Array.isArray(a.pages) ? a.pages.map(str).filter((p): p is string => p !== null) : [];
    const pick = figures.map(figureText).find((x) => x !== null) ?? challenges.map(figureText).find((x) => x !== null);
    if (!pick) continue;
    const sourceTitle = pick.sourceTitle ?? defaultTitle;
    if (!sourceTitle) continue; // a fact without a named source is not shown
    out.set(a.key, {
      area: a.key,
      areaLabel: label,
      text: pick.text,
      sourceTitle,
      sourceUrl: pick.sourceUrl ?? defaultUrl,
      sourceDate: pick.sourceTitle ? null : defaultDate,
      page: pick.page ?? pages[0] ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// gminas.json: tolerant of [{teryt,name,powiat}] / {gminas:[…]} and field aliases
// ---------------------------------------------------------------------------

export type Gmina = {
  teryt: string;
  name: string;
  /** „miejska", „wiejska", „miejsko-wiejska" — tells apart gminas sharing a name. */
  kind: string | null;
  powiatTeryt: string;
  powiatName: string | null;
};

/** A gmina TERYT is WWPPGG(R): województwo, powiat, gmina, type digit. */
export function powiatOf(teryt: string | null | undefined): string | null {
  const digits = (teryt ?? "").replace(/[^0-9]/g, "");
  return digits.length >= 6 ? digits.slice(0, 4) : null;
}

export function parseGminas(json: unknown): Gmina[] {
  const list: unknown[] = Array.isArray(json)
    ? json
    : isRec(json) && Array.isArray(json.gminas)
      ? json.gminas
      : isRec(json) && Array.isArray(json.items)
        ? json.items
        : [];
  const out: Gmina[] = [];
  const seen = new Set<string>();
  for (const g of list) {
    if (!isRec(g)) continue;
    const teryt = (str(g.teryt) ?? str(g.code) ?? str(g.terc) ?? str(g.id) ?? "").replace(/[^0-9]/g, "");
    const name = str(g.name) ?? str(g.nazwa);
    if (!name || teryt.length < 6 || seen.has(teryt)) continue;
    seen.add(teryt);
    const powiat = isRec(g.powiat) ? g.powiat : null;
    const givenPowiat = (str(g.powiatTeryt) ?? "").replace(/[^0-9]/g, "");
    out.push({
      teryt,
      name,
      kind: str(g.kind) ?? str(g.type),
      powiatTeryt: givenPowiat.length === 4 ? givenPowiat : powiatOf(teryt)!,
      powiatName: str(g.powiatName) ?? str(powiat?.name) ?? (typeof g.powiat === "string" ? g.powiat : null),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

// ---------------------------------------------------------------------------
// Readers (cached per process; missing file → empty)
// ---------------------------------------------------------------------------

function readJson(file: string): unknown {
  const path = join(process.cwd(), "data", file);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (e) {
    console.error(`[match] could not read data/${file}`, e);
    return null;
  }
}

let knowledgeCache: Map<MapaArea, KnowledgeFact> | null = null;
export function knowledgeFacts(): Map<MapaArea, KnowledgeFact> {
  knowledgeCache ??= parseKnowledge(readJson("knowledge.json"));
  return knowledgeCache;
}

// ---------------------------------------------------------------------------
// English: data/knowledge.en.json mirrors knowledge.json with the prose translated
// ---------------------------------------------------------------------------

/** „3,5%" → „3.5%" (a decimal comma only; „PLN 1,092" keeps its thousands comma). */
export function englishDecimals(value: string): string {
  return value.replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2");
}

/** Scope words the sources use, in English. Unknown scopes pass through. */
const SCOPE_EN: Record<string, string> = { Polska: "Poland", Małopolska: "Małopolska" };
export function englishScope(scope: string): string {
  return SCOPE_EN[scope.trim()] ?? scope;
}

/** knowledge.en.json with figure values and scopes written the English way. */
export function englishKnowledgeJson(json: unknown): unknown {
  if (!isRec(json) || !Array.isArray(json.areas)) return json;
  return {
    ...json,
    areas: (json.areas as unknown[]).map((a): unknown =>
      isRec(a) && Array.isArray(a.figures)
        ? {
            ...a,
            figures: (a.figures as unknown[]).map((f): unknown =>
              isRec(f)
                ? {
                    ...f,
                    ...(typeof f.value === "string" ? { value: englishDecimals(f.value) } : {}),
                    ...(typeof f.scope === "string" ? { scope: englishScope(f.scope) } : {}),
                  }
                : f,
            ),
          }
        : a,
    ),
  };
}

/** A fact plus the language it is written in ("pl" when no English version exists). */
export type LocalizedKnowledgeFact = KnowledgeFact & { lang: "pl" | "en" };

const localizedCache: Partial<Record<"pl" | "en", Map<MapaArea, LocalizedKnowledgeFact>>> = {};

/**
 * Knowledge facts in the visitor's language: English from
 * data/knowledge.en.json where that area has one, otherwise the Polish fact
 * marked `lang: "pl"` (the page wraps it in lang="pl").
 */
export function knowledgeFactsFor(locale: string): Map<MapaArea, LocalizedKnowledgeFact> {
  const key = locale === "en" ? "en" : "pl";
  const cached = localizedCache[key];
  if (cached) return cached;
  const out = new Map<MapaArea, LocalizedKnowledgeFact>();
  for (const [area, fact] of knowledgeFacts()) out.set(area, { ...fact, lang: "pl" });
  if (key === "en") {
    for (const [area, fact] of parseKnowledge(englishKnowledgeJson(readJson("knowledge.en.json"))))
      out.set(area, { ...fact, lang: "en" });
  }
  localizedCache[key] = out;
  return out;
}

let gminaCache: Gmina[] | null = null;
export function gminas(): Gmina[] {
  gminaCache ??= parseGminas(readJson("gminas.json"));
  return gminaCache;
}

export function gminaByTeryt(teryt: string | null | undefined): Gmina | null {
  if (!teryt) return null;
  return gminas().find((g) => g.teryt === teryt) ?? null;
}

// ---------------------------------------------------------------------------
// calls.json: which cards each call listed (e.g. Usługa Wrażliwa, by card id)
// ---------------------------------------------------------------------------

/** callId → card ids the call document lists as eligible innovations. */
export function parseCallInnovations(json: unknown): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const list = Array.isArray(json) ? json : isRec(json) && Array.isArray(json.calls) ? json.calls : [];
  for (const c of list) {
    if (!isRec(c) || !str(c.id) || !Array.isArray(c.innovations)) continue;
    const ids = new Set<string>();
    for (const i of c.innovations) {
      const id = isRec(i) ? str(i.cardId) : str(i);
      if (id) ids.add(id);
    }
    if (ids.size > 0) out.set(str(c.id)!, ids);
  }
  return out;
}

let callCache: Map<string, Set<string>> | null = null;
export function callInnovations(): Map<string, Set<string>> {
  callCache ??= parseCallInnovations(readJson("calls.json"));
  return callCache;
}

export function powiatName(powiatTeryt: string | null): string | null {
  if (!powiatTeryt) return null;
  return gminas().find((g) => g.powiatTeryt === powiatTeryt && g.powiatName)?.powiatName ?? null;
}
