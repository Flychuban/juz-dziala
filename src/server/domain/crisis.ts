/**
 * Detects texts that need a crisis response before (or instead of) a library
 * match: suicidal ideation, self-harm, acute violence, immediate danger to life,
 * a child at risk.
 *
 * Matching runs on folded text (lowercase, Polish diacritics stripped), so
 * "NIE CHCE ZYC" and "nie chcę żyć" are the same. Word edges are written with
 * `\p{L}` lookarounds; `\b` is ASCII-only in JavaScript and would end a word at
 * "ż" or "ł".
 *
 * The bias is deliberately towards flagging: a false alarm costs a box of phone
 * numbers, a miss can cost a life. The only suppression is for neutral,
 * programme-style mentions ("profilaktyka samobójstw").
 */
import { normalize, stripPolishDiacritics } from "./polish";

export type CrisisCategory = "suicide" | "self_harm" | "violence" | "danger" | "child";

export type CrisisResult = {
  urgent: boolean;
  /** The matched phrases, as they appear in the normalised (lowercase) text. */
  matched: string[];
  categories: CrisisCategory[];
};

type CrisisRule = {
  id: string;
  category: CrisisCategory;
  pattern: RegExp;
  /** A mention that may be neutral when it follows a programme/prevention word. */
  neutralizable?: boolean;
};

const S = "(?<![\\p{L}\\p{N}])"; // word start
const E = "(?![\\p{L}\\p{N}])"; // word end
const SEP = "[^\\p{L}\\p{N}]+"; // any run of spaces/punctuation between words
const WORD = "\\p{L}+";

const rx = (source: string) => new RegExp(source, "gu");

const RULES: readonly CrisisRule[] = [
  // Suicidal ideation
  { id: "samoboj", category: "suicide", pattern: rx(`${S}samoboj\\p{L}*`), neutralizable: true },
  { id: "odebrac-sobie-zycie", category: "suicide", pattern: rx(`${S}(?:odebra|odbior|odbier)\\p{L}*${SEP}sobie${SEP}zyci\\p{L}*`) },
  { id: "zabic-sie", category: "suicide", pattern: rx(`${S}(?:zabic|zabije|zabija\\p{L}*|zabil\\p{L}*)${SEP}sie${E}`) },
  { id: "sie-zabic", category: "suicide", pattern: rx(`${S}sie${SEP}(?:zabic|zabije|zabil\\p{L}*)${E}`) },
  { id: "nie-chce-zyc", category: "suicide", pattern: rx(`${S}nie${SEP}chc\\p{L}*${SEP}(?:(?:juz|dluzej|wiecej)${SEP})?zyc${E}`) },
  { id: "nie-chce-mi-sie-zyc", category: "suicide", pattern: rx(`${S}nie${SEP}chc\\p{L}*${SEP}(?:mi|jej|mu|im|nam|ci)${SEP}sie${SEP}(?:juz${SEP})?zyc${E}`) },
  { id: "chce-umrzec", category: "suicide", pattern: rx(`${S}chc\\p{L}*${SEP}(?:juz${SEP})?umrze\\p{L}*`) },
  { id: "skonczyc-ze-soba", category: "suicide", pattern: rx(`${S}(?:skoncz\\p{L}*${SEP}ze${SEP}soba|ze${SEP}soba${SEP}skoncz\\p{L}*)${E}`) },
  { id: "targnac-sie", category: "suicide", pattern: rx(`${S}(?:targn\\p{L}*${SEP}sie|sie${SEP}targn\\p{L}*)${E}`) },
  { id: "powiesic-sie", category: "suicide", pattern: rx(`${S}(?:powies\\p{L}*${SEP}sie|sie${SEP}powies\\p{L}*)${E}`) },
  { id: "nie-ma-sensu-zyc", category: "suicide", pattern: rx(`${S}nie${SEP}(?:ma|widz\\p{L}*)${SEP}sensu${SEP}(?:zyc|zycia)${E}`) },

  // Self-harm
  { id: "samookalecz", category: "self_harm", pattern: rx(`${S}samookalecz\\p{L}*`), neutralizable: true },
  { id: "tnie-sie", category: "self_harm", pattern: rx(`${S}(?:tnie|tne|tniesz|tna|ciac|cial\\p{L}*)${SEP}sie${E}`) },
  { id: "sie-tnie", category: "self_harm", pattern: rx(`${S}sie${SEP}(?:tnie|tne|tna|ciac|cial\\p{L}*)${E}`) },
  { id: "kaleczy-sie", category: "self_harm", pattern: rx(`${S}(?:o?kalecz\\p{L}*${SEP}sie|sie${SEP}o?kalecz\\p{L}*)${E}`) },

  // Acute violence
  { id: "bije-mnie", category: "violence", pattern: rx(`${S}bi(?:je|ja|l|la|li|ly)${SEP}(?:mnie|ja|go|nas|ich|mame|zone|meza)${E}`) },
  { id: "mnie-bije", category: "violence", pattern: rx(`${S}(?:mnie|ja|go|nas|ich)${SEP}bi(?:je|ja|l|la|li|ly)${E}`) },
  { id: "grozi-smiercia", category: "violence", pattern: rx(`${S}grozi\\p{L}*${SEP}(?:${WORD}${SEP}){0,2}smierci\\p{L}*`) },
  { id: "zabije-mnie", category: "violence", pattern: rx(`${S}(?:zabije|zabic|zabijesz)${SEP}(?:mnie|ja|go|nas|cie|dzieci)${E}`) },
  { id: "mnie-zabije", category: "violence", pattern: rx(`${S}(?:mnie|ja|go|nas|cie)${SEP}zabije${E}`) },
  { id: "przemoc-domowa", category: "violence", pattern: rx(`${S}przemoc\\p{L}*${SEP}(?:domow\\p{L}*|w${SEP}(?:rodzinie|domu|zwiazku|malzenstwie))`), neutralizable: true },
  { id: "zneca-sie", category: "violence", pattern: rx(`${S}(?:zneca\\p{L}*${SEP}sie|sie${SEP}zneca\\p{L}*)${E}`) },
  { id: "boje-sie-o-zycie", category: "violence", pattern: rx(`${S}boj\\p{L}*${SEP}sie${SEP}o${SEP}(?:${WORD}${SEP})?zyci\\p{L}*`) },

  // Immediate danger to life
  { id: "nie-oddycha", category: "danger", pattern: rx(`${S}nie${SEP}oddych\\p{L}*`) },
  {
    id: "lezy-nie-odpowiada",
    category: "danger",
    pattern: rx(
      `${S}(?:lezy|upadl\\p{L}*|nieprzytomn\\p{L}*|zemdlal\\p{L}*|nie${SEP}rusza${SEP}sie)(?:${SEP}${WORD}){0,4}?${SEP}nie${SEP}(?:odpowiada|reaguje)${E}`,
    ),
  },
  {
    id: "nie-odpowiada-lezy",
    category: "danger",
    pattern: rx(`${S}nie${SEP}(?:odpowiada|reaguje)(?:${SEP}${WORD}){0,4}?${SEP}(?:lezy|nie${SEP}rusza${SEP}sie)${E}`),
  },
  { id: "nieprzytomny", category: "danger", pattern: rx(`${S}(?:jest${SEP})?nieprzytomn\\p{L}*|${S}stracil\\p{L}*${SEP}przytomn\\p{L}*`) },
  { id: "przedawkowal", category: "danger", pattern: rx(`${S}przedawkow\\p{L}*|${S}polkn\\p{L}*${SEP}(?:${WORD}${SEP})?(?:tabletki|leki)${E}`) },

  // A child at risk
  { id: "bije-dziecko", category: "child", pattern: rx(`${S}bi(?:je|ja|l|la|li|ly)${SEP}(?:dziecko|dzieci|syna|corke|wnuka|wnuczke|malego|mala)${E}`) },
  { id: "dziecko-bite", category: "child", pattern: rx(`${S}(?:dziecko|dzieci|syna|corke)${SEP}(?:(?:jest|sa)${SEP})?bi(?:je|ja|l|la|li|te|ty|ta)${E}`) },
  { id: "molest", category: "child", pattern: rx(`${S}molest\\p{L}*`), neutralizable: true },
  { id: "wykorzystuje-seksualnie", category: "child", pattern: rx(`${S}(?:wykorzyst\\p{L}*${SEP}seksualn\\p{L}*|seksualn\\p{L}*${SEP}wykorzyst\\p{L}*)`), neutralizable: true },
  { id: "dziecko-glodne", category: "child", pattern: rx(`${S}(?:dziecko|dzieci)${SEP}(?:${WORD}${SEP}){0,3}glodn\\p{L}*`) },
];

/**
 * A programme/prevention word shortly before the match, in the same sentence,
 * makes it a neutral mention: "profilaktyka samobójstw", "szkolenie z
 * przeciwdziałania przemocy domowej".
 */
const NEUTRAL_BEFORE = new RegExp(
  `${S}(?:profilakty|zapobieg|prewencj|przeciwdzial|program|szkoleni|kampani|warsztat|konferencj|statysty|badani|raport|edukacj|webinar)\\p{L}*[^.!?]{0,25}$`,
  "u",
);
/** ...unless the same stretch says somebody is thinking of it or doing it. */
const PERSONAL_BEFORE = new RegExp(
  `${S}(?:mysl|mysli|probow|probuj|grozi|chce|chcial|mowi|powiedzial|pisze|pisal)\\p{L}*[^.!?]{0,25}$`,
  "u",
);

function isNeutralMention(folded: string, start: number): boolean {
  const before = folded.slice(Math.max(0, start - 60), start);
  return NEUTRAL_BEFORE.test(before) && !PERSONAL_BEFORE.test(before);
}

export function detectCrisis(text: string): CrisisResult {
  const norm = normalize(text);
  // stripPolishDiacritics maps one character to one, so offsets agree with `norm`.
  const folded = stripPolishDiacritics(norm);
  const matched: string[] = [];
  const categories: CrisisCategory[] = [];
  for (const rule of RULES) {
    for (const m of folded.matchAll(rule.pattern)) {
      if (rule.neutralizable && isNeutralMention(folded, m.index)) continue;
      const phrase = norm.slice(m.index, m.index + m[0].length);
      if (!matched.includes(phrase)) matched.push(phrase);
      if (!categories.includes(rule.category)) categories.push(rule.category);
    }
  }
  return { urgent: matched.length > 0, matched, categories };
}

export type CrisisResource = {
  name: string;
  phone: string;
  /** Hours as the operator states them; null when the operator's page does not state them. */
  hours: string | null;
  who: string;
  /** The operator's own page on which number, name and hours were checked. */
  sourceUrl: string;
  verifiedAt: string;
  /** The operator's own words that the entry rests on, quoted verbatim. */
  evidence: string;
};

/**
 * Each entry checked on 2026-10-03 against the operator's own website.
 *
 * 112: gov.pl states it is free and reachable from any phone, even without a
 * SIM card, but none of the pages read states hours, so `hours` is null rather
 * than an assumption.
 *
 * 116 123: the 116sos.pl platform states "telefon 116 123 dostępny 24/7". The
 * Instytut Psychologii Zdrowia PTP page for the line still carries an older
 * "codziennie od 14.00 do 22.00" next to the statement that the line has been
 * turned into the 116sos.pl platform, available 24 hours a day, 7 days a week.
 * The platform's own statement is used; re-check before launch.
 */
export const CRISIS_RESOURCES: readonly CrisisResource[] = [
  {
    name: "Numer alarmowy 112",
    phone: "112",
    hours: null,
    who: "Zagrożenie życia, zdrowia, bezpieczeństwa, mienia lub środowiska (sytuacje nagłe). Bezpłatnie, z telefonu stacjonarnego i komórkowego, także bez karty SIM.",
    sourceUrl: "https://www.gov.pl/web/numer-alarmowy-112/numer-alarmowy",
    verifiedAt: "2026-10-03",
    evidence:
      "112 to numer alarmowy, bezpłatny i dostępny na terenie całej Unii Europejskiej zarówno z telefonów stacjonarnych, jak i komórkowych. Numer alarmowy 112 można wybrać w telefonie nieposiadającym karty SIM.",
  },
  {
    name: "Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym",
    phone: "800 70 2222",
    hours: "całodobowo, 7 dni w tygodniu",
    who: "Osoby dorosłe w kryzysie psychicznym i ich bliscy: rozmowa, porada, wsparcie psychologiczne lub rozmowa z psychiatrą. Numer bezpłatny.",
    sourceUrl: "https://centrumwsparcia.pl/centrum-wsparcia/",
    verifiedAt: "2026-10-03",
    evidence:
      "Centrum Wsparcia 24 godziny na dobę 7 dni w tygodniu … Zadzwoń pod bezpłatny numer 800 70 2222 (logo: „Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym”).",
  },
  {
    name: "Telefon Zaufania dla Dzieci i Młodzieży (Fundacja Dajemy Dzieciom Siłę)",
    phone: "116 111",
    hours: "codziennie, 24 godziny na dobę",
    who: "Dzieci i młodzież. Rozmowy są poufne.",
    sourceUrl: "https://116111.pl/",
    verifiedAt: "2026-10-03",
    evidence:
      "116111 - telefon zaufania dla dzieci i młodzieży … Telefon działa codziennie – 7 dni w tygodniu, 24 godziny na dobę! … © Fundacja Dajemy Dzieciom Siłę",
  },
  {
    name: "Kryzysowy Telefon Zaufania (platforma 116sos.pl)",
    phone: "116 123",
    hours: "całodobowo (24/7)",
    who: "Osoby dorosłe w kryzysie emocjonalnym i ich bliscy. Bezpłatnie i anonimowo.",
    sourceUrl: "https://116sos.pl/",
    verifiedAt: "2026-10-03",
    evidence: "Zadzwoń telefon 116 123 dostępny 24/7 … Wsparcie dla osób dorosłych 24/7 Bezpłatne Bezpieczne Anonimowo",
  },
];
