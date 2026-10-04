/**
 * Invented test cards in the LibraryCard shape. The texts imitate the library's
 * register but are NOT real ROPS cards; tests must not depend on real data.
 */
import { SECTION_KEYS, type LibraryCard, type MapaArea, type SectionKey } from "../types";

type CardSpec = {
  id: string;
  slug: string;
  title: string;
  categoryLabels?: string[];
  sections?: Partial<Record<SectionKey, string>>;
  mapaAreas?: MapaArea[];
  keywords?: string[];
  /** An English translation: the same sections, sentence for sentence (same count per section). */
  en?: { title: string; sections: Partial<Record<SectionKey, string>>; keywords?: string[]; categoryLabels?: string[] };
};

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

/** Splits each section into sentences with ids "<cardId>.s<n>", numbered across the card. */
export function makeCard(spec: CardSpec): LibraryCard {
  const sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, spec.sections?.[k] ?? ""])) as Record<SectionKey, string>;
  const sentences: LibraryCard["sentences"] = [];
  for (const section of SECTION_KEYS) {
    for (const text of splitSentences(sections[section])) {
      sentences.push({ id: `${spec.id}.s${sentences.length + 1}`, section, text });
    }
  }
  let en: LibraryCard["en"] = null;
  if (spec.en) {
    const enSections = Object.fromEntries(SECTION_KEYS.map((k) => [k, spec.en?.sections[k] ?? ""])) as Record<SectionKey, string>;
    const enSentences: Record<string, string> = {};
    for (const section of SECTION_KEYS) {
      const pl = sentences.filter((s) => s.section === section);
      const translated = splitSentences(enSections[section]);
      if (translated.length !== pl.length) throw new Error(`fixture ${spec.id}.${section}: ${translated.length} English sentences for ${pl.length} Polish`);
      pl.forEach((s, i) => (enSentences[s.id] = translated[i]!));
    }
    en = {
      title: spec.en.title,
      sections: enSections,
      sentences: enSentences,
      keywords: spec.en.keywords ?? [],
      categoryLabels: spec.en.categoryLabels ?? [],
    };
  }
  return {
    id: spec.id,
    slug: spec.slug,
    title: spec.title,
    categories: [],
    categoryLabels: spec.categoryLabels ?? [],
    sections,
    sentences,
    badge: null,
    videoUrl: null,
    folderUrl: null,
    materialsUrl: null,
    licence: null,
    licenceUrl: null,
    mapaAreas: spec.mapaAreas ?? [],
    keywords: spec.keywords ?? [],
    sourceUrl: `https://example.org/fixture/${spec.slug}`,
    capturedAt: "2026-10-03T00:00:00Z",
    sha256: "0".repeat(64),
    en,
  };
}

export const FIXTURE_CARDS: LibraryCard[] = [
  makeCard({
    id: "c001",
    slug: "mobilne-wsparcie-seniorow",
    title: "Mobilne wsparcie seniorów",
    categoryLabels: ["Dla seniorów"],
    mapaAreas: ["seniors"],
    sections: {
      solution: "Zespół specjalistów dojeżdża do domu seniora. Oferuje coaching, poradę prawną i rehabilitację.",
      problems: "Osoby starsze czują się osamotnione i odtrącone. Doświadczają izolacji społecznej.",
      targetGroup: "Osoby starsze, niesamodzielne, mieszkające na wsi.",
      whoCanUse: "Ośrodki pomocy społecznej, organizacje pozarządowe.",
    },
    en: {
      title: "Mobile support for older people",
      categoryLabels: ["For older people"],
      sections: {
        solution: "A team of specialists visits the older person at home. It offers coaching, legal advice and rehabilitation.",
        problems: "Older people feel lonely and rejected. They experience social isolation.",
        targetGroup: "Older, dependent people living in the countryside.",
        whoCanUse: "Social welfare centres, non-governmental organisations.",
      },
    },
  }),
  makeCard({
    id: "c002",
    slug: "psychoedukacja-mlodziezy",
    title: "Psychoedukacja dla młodzieży",
    categoryLabels: ["Dla dzieci, młodzieży i rodziny"],
    mapaAreas: ["mental_health", "family"],
    sections: {
      solution: "Komplet materiałów psychoedukacyjnych dla szkół.",
      problems: "Dzieci i młodzież doświadczają depresji i kryzysów psychicznych.",
      targetGroup: "Młodzież szkolna i nastolatki w kryzysie.",
      whoCanUse: "Szkoły, poradnie psychologiczno-pedagogiczne.",
    },
    en: {
      title: "Psychoeducation for young people",
      categoryLabels: ["For children, young people and families"],
      sections: {
        solution: "A set of psychoeducational materials for schools.",
        problems: "Children and young people experience depression and mental health crises.",
        targetGroup: "School pupils and teenagers in crisis.",
        whoCanUse: "Schools, psychological and educational counselling centres.",
      },
    },
  }),
  makeCard({
    id: "c003",
    slug: "modul-do-wozka",
    title: "Elektryczny moduł do wózka",
    categoryLabels: ["Dla osób o ograniczonej mobilności"],
    mapaAreas: ["disability"],
    sections: {
      solution: "Moduł elektryczny montowany do wózka inwalidzkiego.",
      problems: "Osoby poruszające się na wózku mają trudności na chodnikach, podjazdach i w transporcie publicznym.",
      targetGroup: "Osoby z niepełnosprawnością ruchową.",
      whoCanUse: "Organizacje pozarządowe, wypożyczalnie sprzętu.",
    },
  }),
  makeCard({
    id: "c004",
    slug: "aplikacja-dla-niewidomych",
    title: "Aplikacja dla osób niewidomych",
    categoryLabels: ["Dla osób z niepełnosprawnością sensoryczną"],
    mapaAreas: ["disability"],
    sections: {
      solution: "Aplikacja na telefon podaje głosem numer nadjeżdżającego autobusu.",
      problems: "Osoby niewidome i słabowidzące nie mogą samodzielnie korzystać z komunikacji miejskiej.",
      targetGroup: "Osoby z niepełnosprawnością wzroku.",
    },
    en: {
      title: "An app for blind people",
      categoryLabels: ["For people with sensory disabilities"],
      sections: {
        solution: "A phone app announces the number of the approaching bus.",
        problems: "Blind and partially sighted people cannot use public transport on their own.",
        targetGroup: "People with a visual impairment.",
      },
    },
  }),
  makeCard({
    id: "c005",
    slug: "punkt-higieniczny",
    title: "Mobilny punkt higieniczny",
    categoryLabels: ["Dla osób w kryzysie bezdomności"],
    mapaAreas: ["homelessness"],
    sections: {
      solution: "Samochód z prysznicem i pralką dojeżdża w miejsca, gdzie przebywają osoby bezdomne.",
      problems: "Osoby w kryzysie bezdomności nie mają dostępu do usług higienicznych i czystej odzieży.",
      targetGroup: "Osoby w kryzysie bezdomności.",
    },
  }),
  makeCard({
    id: "c006",
    slug: "organizer-na-leki",
    title: "Inteligentny organizer na leki",
    categoryLabels: ["Dla zdrowia i medycyny"],
    mapaAreas: ["health", "seniors"],
    sections: {
      solution: "Organizer przypomina o porze przyjęcia leków i powiadamia opiekuna.",
      problems: "Seniorzy mylą leki i zapominają o ich przyjmowaniu.",
      targetGroup: "Osoby starsze przyjmujące wiele leków.",
    },
    en: {
      title: "Smart pill organiser",
      categoryLabels: ["For health and medicine"],
      sections: {
        solution: "The organiser reminds you when to take your medicines and notifies a carer.",
        problems: "Older people mix up their medicines and forget to take them.",
        targetGroup: "Older people who take many medicines.",
      },
    },
  }),
  makeCard({
    id: "c007",
    slug: "gra-integracyjna-dla-cudzoziemcow",
    title: "Gra integracyjna dla cudzoziemców",
    categoryLabels: ["Dla cudzoziemców"],
    mapaAreas: ["migrants"],
    keywords: ["uchodźcy", "integracja"],
    sections: {
      solution: "Gra karciana, która uczy codziennych zwrotów i zwyczajów.",
      problems: "Uchodźcy i migranci mają trudności z integracją i językiem polskim.",
      targetGroup: "Grupy uchodźcze i migracyjne.",
    },
  }),
];
