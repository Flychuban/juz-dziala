/**
 * „Dla gminy" — a gmina's GUS profile and a simple, printed rule that turns it
 * into a short list of fitting innovations. Pure: the caller loads the data.
 *
 * The rule is deliberately plain so that a gmina employee can check it:
 *   - udział osób 80+ wyższy niż mediana gmin Małopolski → seniorzy;
 *   - ludność maleje (10 lat) → seniorzy + wykluczenie cyfrowe + dojazd;
 *   - gmina wiejska lub miejsko-wiejska → dojazd i usługi mobilne;
 *   - obszary Mapy, w których w powiecie zgłoszono ≥ 5 potrzeb → te obszary.
 */
import { foldWithMap, pluralPl } from "~/components/kit/format";
import { MAPA_AREA_LABEL, type MapaArea } from "~/lib/domain";
import type { Gmina, GminaKind, GminaProfile } from "./types";

const ONE_DECIMAL = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const INTEGER = new Intl.NumberFormat("pl-PL");

/** „4,5" — a percentage figure with one decimal, Polish style. */
export function pct(n: number): string {
  return ONE_DECIMAL.format(n);
}
/** „28 187". */
export function int(n: number): string {
  return INTEGER.format(n);
}
/** „−6,4%" / „+7,2%" — a signed change with a real minus sign. */
export function signedPct(n: number): string {
  if (n === 0) return "0,0%";
  return `${n < 0 ? "−" : "+"}${pct(Math.abs(n))}%`;
}

/** Share of `part` in `total`, in percent, rounded to one decimal. */
export function share(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function median(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round(((v[mid - 1]! + v[mid]!) / 2) * 10) / 10;
}

/** Median 80+ share (one decimal) across every gmina in the list. */
export function medianShare80(all: Gmina[]): number {
  return median(all.map((g) => share(g.pop80, g.population)));
}

export function buildProfile(g: Gmina, all: Gmina[]): GminaProfile {
  return {
    ...g,
    share65: share(g.pop65, g.population),
    share80: share(g.pop80, g.population),
    medianShare80: medianShare80(all),
    depopulating: g.popChange10y === null ? null : g.popChange10y < 0,
  };
}

export const KIND_LABEL: Record<GminaKind, string> = {
  miejska: "gmina miejska",
  wiejska: "gmina wiejska",
  "miejsko-wiejska": "gmina miejsko-wiejska",
};

/** „Bochnia (gmina miejska)" — names repeat, the kind tells them apart. */
export function gminaLabel(g: Pick<Gmina, "name" | "kind">): string {
  return `${g.name} (${KIND_LABEL[g.kind]})`;
}

/** „bocheński" from „powiat bocheński"; cities keep their name. */
export function powiatShort(powiatName: string): string {
  return powiatName.replace(/^powiat\s+/i, "").trim();
}

// ---------------------------------------------------------------------------
// Themes and the rule
// ---------------------------------------------------------------------------

export type ThemeId = "seniors" | "digital" | "mobility" | `area:${MapaArea}`;

type KeywordTheme = {
  label: string;
  /** Word starts (folded) looked for in title, keywords and „Na czym polega". */
  stems: string[];
  /** Exact folded phrases, matched at a word start and ending at a word end. */
  phrases: string[];
};

const KEYWORD_THEMES: Record<"digital" | "mobility", KeywordTheme> = {
  digital: {
    label: "Wykluczenie cyfrowe i usługi na odległość",
    stems: ["cyfrow", "internet", "smartfon", "zdaln", "teleasyst", "telerehab"],
    phrases: ["kody qr", "kodow qr"],
  },
  mobility: {
    label: "Dojazd i usługi mobilne",
    stems: ["transport", "dojazd", "dojezdz", "dowoz"],
    phrases: [
      "mobilne centrum",
      "mobilna pomoc",
      "mobilna gielda",
      "mobilny punkt",
    ],
  },
};

export function themeLabel(id: ThemeId): string {
  if (id === "seniors") return MAPA_AREA_LABEL.seniors;
  if (id === "digital" || id === "mobility") return KEYWORD_THEMES[id].label;
  return MAPA_AREA_LABEL[id.slice(5) as MapaArea] ?? id;
}

export type ProfileCard = {
  id: string;
  slug: string;
  title: string;
  mapaAreas: MapaArea[];
  keywords: string[];
  solution: string;
  badge: string | null;
};

export type ThemeMatch = {
  theme: ThemeId;
  label: string;
  /** Why the card fits, in words: „obszar Mapy: Seniorzy", „w opisie: „internet”". */
  evidence: string;
};

function keywordEvidence(card: ProfileCard, t: KeywordTheme): string | null {
  const raw = `${card.title} | ${card.keywords.join(" | ")} | ${card.solution}`;
  // Match on the folded text, quote the words as the card writes them.
  const { folded: text, map } = foldWithMap(raw);
  const original = (from: number, to: number) =>
    raw.slice(map[from] ?? 0, (map[to - 1] ?? raw.length - 1) + 1);
  const startsWord = (at: number) =>
    at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1]!);
  for (const p of t.phrases) {
    let at = text.indexOf(p);
    while (at >= 0) {
      const after = text[at + p.length] ?? "";
      if (startsWord(at) && !/[\p{L}\p{N}]/u.test(after)) {
        return original(at, at + p.length);
      }
      at = text.indexOf(p, at + 1);
    }
  }
  for (const s of t.stems) {
    let at = text.indexOf(s);
    while (at >= 0) {
      if (startsWord(at)) {
        let end = at + s.length;
        while (end < text.length && /[\p{L}\p{N}]/u.test(text[end]!)) end++;
        return original(at, end);
      }
      at = text.indexOf(s, at + 1);
    }
  }
  return null;
}

/** Does the card fit the theme, and how do we know? */
export function matchTheme(card: ProfileCard, theme: ThemeId): ThemeMatch | null {
  if (theme === "seniors") {
    return card.mapaAreas.includes("seniors")
      ? {
          theme,
          label: themeLabel(theme),
          evidence: `obszar Mapy Wyzwań: ${MAPA_AREA_LABEL.seniors}`,
        }
      : null;
  }
  if (theme === "digital" || theme === "mobility") {
    const word = keywordEvidence(card, KEYWORD_THEMES[theme]);
    return word
      ? { theme, label: themeLabel(theme), evidence: `w opisie: „${word}”` }
      : null;
  }
  const area = theme.slice(5) as MapaArea;
  return card.mapaAreas.includes(area)
    ? {
        theme,
        label: themeLabel(theme),
        evidence: `obszar Mapy Wyzwań: ${MAPA_AREA_LABEL[area]}`,
      }
    : null;
}

export type ReportedArea = { area: MapaArea; count: number | null };

export type ProfileSignal = {
  id: "share80" | "depopulation" | "rural" | "reported" | "none";
  /** The rule, printed for the reader. */
  text: string;
  themes: ThemeId[];
  /** How strongly the signal pulls its themes (reported needs count double). */
  weight: number;
};

export const K_ANONYMITY = 5;

/**
 * The printed rule. `reported` are the powiat's need counts, already
 * k-anonymised: only areas with a visible count (≥ 5) drive the rule.
 */
export function profileSignals(
  p: GminaProfile,
  reported: ReportedArea[] = [],
  powiatName = p.powiatName,
): ProfileSignal[] {
  const out: ProfileSignal[] = [];
  if (p.share80 > p.medianShare80) {
    out.push({
      id: "share80",
      text: `Udział osób w wieku 80+ wyższy niż mediana gmin Małopolski (${pct(p.share80)}% wobec ${pct(p.medianShare80)}%) → rozwiązania dla seniorów.`,
      themes: ["seniors"],
      weight: 1,
    });
  }
  if (p.depopulating && p.popChange10y !== null) {
    out.push({
      id: "depopulation",
      text: `Liczba mieszkańców spadła o ${pct(Math.abs(p.popChange10y))}% w latach ${p.year - 10}–${p.year} → rozwiązania dla seniorów, przeciw wykluczeniu cyfrowemu i ułatwiające dojazd.`,
      themes: ["seniors", "digital", "mobility"],
      weight: 1,
    });
  }
  if (p.kind !== "miejska") {
    out.push({
      id: "rural",
      text: `${p.kind === "wiejska" ? "Gmina wiejska" : "Gmina miejsko-wiejska (z obszarami wiejskimi)"} — do usług trzeba często dojechać → rozwiązania ułatwiające dojazd i usługi mobilne.`,
      themes: ["mobility"],
      weight: 1,
    });
  }
  const visible = reported
    .filter((r) => r.count !== null && r.count >= K_ANONYMITY)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  for (const r of visible) {
    out.push({
      id: "reported",
      text: `W ${powiatLocative(powiatName)} w ostatnich 90 dniach zgłoszono ${r.count} ${pluralPl(r.count ?? 0, "potrzebę", "potrzeby", "potrzeb")} w obszarze „${MAPA_AREA_LABEL[r.area]}” → rozwiązania z tego obszaru.`,
      themes: [`area:${r.area}`],
      weight: 2,
    });
  }
  if (out.length === 0) {
    out.push({
      id: "none",
      text: `Dane GUS nie wskazują tu szczególnych potrzeb (udział osób 80+ nie wyższy niż mediana, ludność nie maleje, gmina miejska) → pokazujemy rozwiązania wybrane przez ROPS do upowszechniania.`,
      themes: [],
      weight: 0,
    });
  }
  return out;
}

/** „powiat bocheński" as is; a city with powiat rights says so. */
export function powiatDisplay(powiatName: string): string {
  return /^powiat\s/i.test(powiatName)
    ? powiatName
    : `miasto na prawach powiatu ${powiatName}`;
}

/** „powiecie bocheńskim" / „Krakowie" — good enough for the 22 powiats. */
export function powiatLocative(powiatName: string): string {
  const short = powiatShort(powiatName);
  const cities: Record<string, string> = {
    Kraków: "Krakowie",
    "Nowy Sącz": "Nowym Sączu",
    Tarnów: "Tarnowie",
  };
  if (cities[short]) return cities[short];
  if (/^powiat\s/i.test(powiatName) && /ski$|cki$|zki$/.test(short)) {
    return `powiecie ${short.replace(/i$/, "im")}`;
  }
  return `powiecie ${short}`;
}

export type Recommendation = {
  card: ProfileCard;
  matches: ThemeMatch[];
  score: number;
};

/**
 * Up to `limit` cards for the profile. Each active theme first gets its best
 * card (so a rural, ageing gmina sees seniors AND transport), then the rest
 * fill by score. Ties: „wybrana do upowszechniania", then a ROPS Ramowy
 * Plan, then title. With no signal: cards ROPS selected for dissemination.
 */
export function recommend(
  cards: ProfileCard[],
  signals: ProfileSignal[],
  opts: { limit?: number; ramowyPlanIds?: ReadonlySet<string> } = {},
): Recommendation[] {
  const limit = opts.limit ?? 6;
  const ramowy = opts.ramowyPlanIds ?? new Set<string>();
  const weights = new Map<ThemeId, number>();
  for (const s of signals)
    for (const t of s.themes) weights.set(t, (weights.get(t) ?? 0) + s.weight);

  const tie = (a: Recommendation, b: Recommendation) =>
    b.score - a.score ||
    Number(!!b.card.badge) - Number(!!a.card.badge) ||
    Number(ramowy.has(b.card.id)) - Number(ramowy.has(a.card.id)) ||
    b.matches.length - a.matches.length ||
    a.card.title.localeCompare(b.card.title, "pl");

  if (weights.size === 0) {
    return cards
      .filter((c) => !!c.badge)
      .map((card) => ({ card, matches: [], score: 0 }))
      .sort(tie)
      .slice(0, limit);
  }

  const scored: Recommendation[] = [];
  for (const card of cards) {
    const matches: ThemeMatch[] = [];
    let score = 0;
    for (const [theme, w] of weights) {
      const m = matchTheme(card, theme);
      if (m) {
        matches.push(m);
        score += w;
      }
    }
    if (score > 0) scored.push({ card, matches, score });
  }
  scored.sort(tie);

  const picked: Recommendation[] = [];
  const taken = new Set<string>();
  const themesByWeight = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  for (const theme of themesByWeight) {
    if (picked.length >= limit) break;
    const best = scored.find(
      (r) => !taken.has(r.card.id) && r.matches.some((m) => m.theme === theme),
    );
    if (best) {
      picked.push(best);
      taken.add(best.card.id);
    }
  }
  for (const r of scored) {
    if (picked.length >= limit) break;
    if (!taken.has(r.card.id)) {
      picked.push(r);
      taken.add(r.card.id);
    }
  }
  return picked.sort(tie);
}

/**
 * The example shown first on /municipality: among rural gminas whose
 * population fell, the one with the highest 80+ share. Deterministic.
 */
export function featuredRuralGmina(all: Gmina[]): Gmina | null {
  const pool = all.filter(
    (g) =>
      g.kind === "wiejska" && g.popChange10y !== null && g.popChange10y < 0,
  );
  pool.sort(
    (a, b) =>
      share(b.pop80, b.population) - share(a.pop80, a.population) ||
      a.name.localeCompare(b.name, "pl"),
  );
  return pool[0] ?? null;
}

/** 80+ share per powiat (sum over its gminas), keyed by 4-digit TERYT. */
export function powiatShares80(all: Gmina[]): Record<string, number> {
  const sums = new Map<string, { pop: number; pop80: number }>();
  for (const g of all) {
    const s = sums.get(g.powiatTeryt) ?? { pop: 0, pop80: 0 };
    s.pop += g.population;
    s.pop80 += g.pop80;
    sums.set(g.powiatTeryt, s);
  }
  return Object.fromEntries(
    [...sums.entries()].map(([k, v]) => [k, share(v.pop80, v.pop)]),
  );
}
