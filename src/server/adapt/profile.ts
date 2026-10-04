/**
 * „Dla gminy" — a gmina's GUS profile and a simple, printed rule that turns it
 * into a short list of fitting innovations. Pure: the caller loads the data.
 *
 * The rule is deliberately plain so that a gmina employee can check it:
 *   - udział osób 80+ wyższy niż mediana gmin Małopolski → seniorzy;
 *   - ludność maleje (10 lat) → seniorzy + wykluczenie cyfrowe + dojazd;
 *   - gmina wiejska lub miejsko-wiejska → dojazd i poruszanie się;
 *   - obszary Mapy, w których w powiecie zgłoszono ≥ 5 potrzeb → te obszary.
 */
import { foldWithMap } from "~/components/kit/format";
import { powiatName as powiatNameIn } from "~/components/map/powiaty";
import type { Locale } from "~/i18n/config";
import { labelsFor, type MapaArea } from "~/lib/domain";
import { municipalityT } from "./i18n";
import type { Gmina, GminaKind, GminaProfile } from "./types";

const ONE_DECIMAL: Record<Locale, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
  en: new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
};
const INTEGER: Record<Locale, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat("pl-PL"),
  en: new Intl.NumberFormat("en-GB"),
};
const loc = (l: string | undefined): Locale => (l === "en" ? "en" : "pl");

/** „4,5" / "4.5" — a percentage figure with one decimal. */
export function pct(n: number, locale = "pl"): string {
  return ONE_DECIMAL[loc(locale)].format(n);
}
/** „28 187" / "28,187". */
export function int(n: number, locale = "pl"): string {
  return INTEGER[loc(locale)].format(n);
}
/** „−6,4%" / „+7,2%" — a signed change with a real minus sign. */
export function signedPct(n: number, locale = "pl"): string {
  if (n === 0) return `${pct(0, locale)}%`;
  return `${n < 0 ? "−" : "+"}${pct(Math.abs(n), locale)}%`;
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
const KIND_LABEL_EN: Record<GminaKind, string> = {
  miejska: "urban municipality",
  wiejska: "rural municipality",
  "miejsko-wiejska": "urban-rural municipality",
};
/** „gmina wiejska" / "rural municipality". */
export function kindLabel(kind: GminaKind, locale = "pl"): string {
  return (locale === "en" ? KIND_LABEL_EN : KIND_LABEL)[kind];
}

/** „Bochnia (gmina miejska)" — names repeat, the kind tells them apart. */
export function gminaLabel(
  g: Pick<Gmina, "name" | "kind">,
  locale = "pl",
): string {
  return `${g.name} (${kindLabel(g.kind, locale)})`;
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
  /** Run on the folded text (no diacritics, lower case). */
  pattern: RegExp;
  /** Which part of the card is read. */
  text: (card: ProfileCard) => string;
  /** When set, only cards in one of these Mapa areas can match. */
  areas?: MapaArea[];
};

const W = "(?<![\\p{L}\\p{N}])"; // word start
const L = "\\p{L}*"; // rest of the word

const KEYWORD_THEMES: Record<"digital" | "mobility", KeywordTheme> = {
  digital: {
    pattern: new RegExp(
      `${W}(cyfrow${L}|internet${L}|smartfon${L}|zdaln${L}|teleasyst${L}|telerehab${L}|kod(?:y|ow) qr)`,
      "u",
    ),
    text: (c) => `${c.title} | ${c.keywords.join(" | ")} | ${c.solution}`,
  },
  /*
   * Getting around: only cards for people with disabilities or seniors, and
   * only what the card says the solution IS or SOLVES. „przewóz" is the noun
   * (transporting people), not „przewozić dziecko w wózku". „mobilny" counts as
   * mobility (mobilność) or a service that comes to people (mobilne
   * centrum / usługi / pomoc / punkt) — not „aplikacja mobilna".
   */
  mobility: {
    pattern: new RegExp(
      `${W}(dojazd${L}|dojezdz${L}|przewoz(?:u|em|ie|y|ow)?(?!\\p{L})|przewozeni${L}|transport${L} publiczn${L}|mobilnosc${L}|mobiln${L} (?:centrum|pomoc${L}|uslug${L}|punkt${L}|zesp${L}))`,
      "u",
    ),
    text: (c) => `${c.solution} | ${c.problems}`,
    areas: ["disability", "seniors"],
  },
};

/** „Seniorzy", „Dojazd i poruszanie się"… in the reader's language. */
export function themeLabel(id: ThemeId, locale = "pl"): string {
  const labels = labelsFor(locale);
  if (id === "seniors") return labels.area.seniors;
  if (id === "digital" || id === "mobility") {
    return municipalityT(loc(locale))(`themes.${id}`);
  }
  return labels.area[id.slice(5) as MapaArea] ?? id;
}

export type ProfileCard = {
  id: string;
  slug: string;
  title: string;
  mapaAreas: MapaArea[];
  keywords: string[];
  solution: string;
  problems: string;
  badge: string | null;
};

export type ThemeMatch = {
  theme: ThemeId;
  label: string;
  /** Why the card fits, in words: „obszar Mapy: Seniorzy", „w opisie: „internet”". */
  evidence: string;
};

/** The words that made the match, as the card writes them; null = no match. */
function keywordEvidence(card: ProfileCard, t: KeywordTheme): string | null {
  if (t.areas && !t.areas.some((a) => card.mapaAreas.includes(a))) return null;
  const raw = t.text(card);
  const { folded, map } = foldWithMap(raw);
  const m = t.pattern.exec(folded);
  if (!m?.[1]) return null;
  const from = m.index + m[0].length - m[1].length;
  const to = from + m[1].length;
  return raw.slice(map[from] ?? 0, (map[to - 1] ?? raw.length - 1) + 1);
}

/**
 * Does the card fit the theme, and how do we know? The rule always reads the
 * Polish card (the source); in English the evidence quotes the Polish word.
 */
export function matchTheme(
  card: ProfileCard,
  theme: ThemeId,
  locale = "pl",
): ThemeMatch | null {
  const t = municipalityT(loc(locale));
  const labels = labelsFor(locale);
  if (theme === "seniors") {
    return card.mapaAreas.includes("seniors")
      ? {
          theme,
          label: themeLabel(theme, locale),
          evidence: t("rule.evidenceArea", { area: labels.area.seniors }),
        }
      : null;
  }
  if (theme === "digital" || theme === "mobility") {
    const word = keywordEvidence(card, KEYWORD_THEMES[theme]);
    return word
      ? {
          theme,
          label: themeLabel(theme, locale),
          evidence: t("rule.evidenceWord", { word }),
        }
      : null;
  }
  const area = theme.slice(5) as MapaArea;
  return card.mapaAreas.includes(area)
    ? {
        theme,
        label: themeLabel(theme, locale),
        evidence: t("rule.evidenceArea", { area: labels.area[area] }),
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
 * k-anonymised: only areas with a visible count (≥ 5) drive the rule. Pass
 * them only for a reader allowed to see them (ROPS, a logged-in gmina):
 * a „reported" line states the count.
 */
export function profileSignals(
  p: GminaProfile,
  reported: ReportedArea[] = [],
  opts: { powiatName?: string; locale?: string; windowDays?: number } = {},
): ProfileSignal[] {
  const locale = loc(opts.locale);
  const t = municipalityT(locale);
  const labels = labelsFor(locale);
  const out: ProfileSignal[] = [];
  if (p.share80 > p.medianShare80) {
    out.push({
      id: "share80",
      text: t("rule.share80", {
        share: pct(p.share80, locale),
        median: pct(p.medianShare80, locale),
      }),
      themes: ["seniors"],
      weight: 1,
    });
  }
  if (p.depopulating && p.popChange10y !== null) {
    out.push({
      id: "depopulation",
      text: t("rule.depopulation", {
        change: pct(Math.abs(p.popChange10y), locale),
        from: String(p.year - 10),
        to: String(p.year),
      }),
      themes: ["seniors", "digital", "mobility"],
      weight: 1,
    });
  }
  if (p.kind !== "miejska") {
    out.push({
      id: "rural",
      text: t(p.kind === "wiejska" ? "rule.rural" : "rule.urbanRural"),
      themes: ["mobility"],
      weight: 1,
    });
  }
  const visible = reported
    .filter((r) => r.count !== null && r.count >= K_ANONYMITY)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const where =
    locale === "en"
      ? powiatNameIn(opts.powiatName ?? p.powiatName, "en")
      : powiatLocative(opts.powiatName ?? p.powiatName);
  for (const r of visible) {
    out.push({
      id: "reported",
      text: t("rule.reported", {
        where,
        count: r.count ?? 0,
        days: opts.windowDays ?? 90,
        area: labels.area[r.area],
      }),
      themes: [`area:${r.area}`],
      weight: 2,
    });
  }
  if (out.length === 0) {
    out.push({
      id: "none",
      text: t("rule.none"),
      themes: [],
      weight: 0,
    });
  }
  return out;
}

/**
 * „powiat bocheński" as is, a city with powiat rights says so; in English
 * "Bochnia County" / "Kraków (a city with county rights)".
 */
export function powiatDisplay(powiatName: string, locale = "pl"): string {
  const isLand = /^powiat\s/i.test(powiatName);
  const l = loc(locale);
  const name = l === "en" ? powiatNameIn(powiatName, "en") : powiatName;
  return isLand ? name : municipalityT(l)("cityCounty", { name });
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
  opts: {
    limit?: number;
    ramowyPlanIds?: ReadonlySet<string>;
    locale?: string;
  } = {},
): Recommendation[] {
  const limit = opts.limit ?? 6;
  const locale = opts.locale ?? "pl";
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
      const m = matchTheme(card, theme, locale);
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
  // The per-reason picks lead (in the order of the reasons' weight), so the
  // list opens with what the profile asks for most; the fill follows by score.
  return picked;
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
