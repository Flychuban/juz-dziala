/**
 * Zod schemas for every JSON file under data/. The site imports these as the contract.
 */
import { z } from "zod";

export const MAPA_AREAS = [
  "family",
  "homelessness",
  "disability",
  "poverty",
  "migrants",
  "health",
  "mental_health",
  "seniors",
] as const;
export const MapaArea = z.enum(MAPA_AREAS);
export type MapaArea = z.infer<typeof MapaArea>;

export const SECTION_KEYS = ["solution", "problems", "targetGroup", "whoCanUse", "doesItWork", "authors"] as const;
export const SectionKey = z.enum(SECTION_KEYS);
export type SectionKey = z.infer<typeof SectionKey>;

const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

// ------------------------------------------------------------------ library.json

export const Sentence = z.object({
  id: z.string().regex(/^c\d{3}\.s\d+$/),
  section: SectionKey,
  text: z.string().min(1),
});
export type Sentence = z.infer<typeof Sentence>;

export const LibraryCard = z.object({
  id: z.string().regex(/^c\d{3}$/),
  slug: z.string().min(1),
  title: z.string().min(1),
  categories: z.array(z.string()).min(1),
  categoryLabels: z.array(z.string()).min(1),
  sections: z.object({
    solution: z.string(),
    problems: z.string(),
    targetGroup: z.string(),
    whoCanUse: z.string(),
    doesItWork: z.string(),
    authors: z.string(),
  }),
  sentences: z.array(Sentence),
  badge: z.string().nullable(),
  videoUrl: z.string().url().nullable(),
  folderUrl: z.string().url().nullable(),
  materialsUrl: z.string().url().nullable(),
  licence: z.string().nullable(),
  licenceUrl: z.string().url().nullable(),
  mapaAreas: z.array(MapaArea).min(1),
  keywords: z.array(z.string()).min(5).max(12),
  sourceUrl: z.string().url(),
  capturedAt: isoDateTime,
  sha256,
});
export type LibraryCard = z.infer<typeof LibraryCard>;

export const Library = z.array(LibraryCard);

export const WithheldCard = z.object({
  id: z.string().regex(/^c\d{3}$/), // reserved, so ids stay stable if the card parses later
  url: z.string().url(),
  slug: z.string(),
  categories: z.array(z.string()),
  reason: z.string(),
  capturedAt: isoDateTime.nullable(),
  sha256: sha256.nullable(),
});
export const LibraryWithheld = z.array(WithheldCard);

// ------------------------------------------------------------------ knowledge.json

export const Figure = z.object({
  value: z.string(), // as printed, e.g. "3,3 mln" or "27,4%"
  label: z.string(),
  scope: z.literal("Polska"),
  year: z.string().nullable(), // as printed; a range such as "2022/2023" stays a string
  page: z.number().int().positive(),
});

export const Persona = z.object({
  name: z.string(),
  age: z.number().int().nullable(),
  description: z.string(),
  goals: z.array(z.string()),
  challenges: z.array(z.string()),
  motivations: z.array(z.string()),
});

export const KnowledgeArea = z.object({
  key: MapaArea,
  label: z.string(),
  definition: z.string(),
  /** „Analiza danych zastanych" bullets, verbatim (absent for some areas in the source). */
  analysis: z.array(z.string()),
  /** The sentence that introduces the challenge list on some slides, e.g. „Realizacja działań na rzecz różnych grup:". */
  keyChallengesIntro: z.string().nullable(),
  keyChallenges: z.array(z.string()),
  /** The first persona of the area (Zdrowie psychiczne has two; both are in `personas`). */
  persona: Persona.nullable(),
  personas: z.array(Persona),
  figures: z.array(Figure),
  reports: z.array(z.object({ title: z.string(), url: z.string().url().nullable(), page: z.number().int().positive() })),
  pages: z.array(z.number().int().positive()),
});

export const Knowledge = z.object({
  source: z.object({
    title: z.string(),
    url: z.string().url(),
    publisher: z.literal("ROPS Kraków"),
    date: z.literal("2024-11"),
    capturedAt: isoDateTime,
    sha256,
    note: z.string(),
  }),
  areas: z.array(KnowledgeArea).length(8),
});

// ------------------------------------------------------------------ calls.json

export const FormField = z.object({ key: z.string(), label: z.string(), hint: z.string().nullable() });
export const Criterion = z.object({
  key: z.string(),
  label: z.string(),
  /** As defined in the call's procedures/regulations. */
  description: z.string(),
  /** As printed on the scoring card, when the call publishes one. */
  cardDescription: z.string().nullable(),
  min: z.number(),
  max: z.number(),
  /** Minimum points in this criterion for a positive assessment, when the call sets one. */
  minToPass: z.number().nullable(),
});

export const CallInnovation = z.object({
  category: z.string(), // e.g. „Kategoria I"
  title: z.string(),
  url: z.string().url(),
  slug: z.string(),
  cardId: z.string().nullable(), // library.json id, null if the card is not in the library
});

export const Call = z.object({
  id: z.string(),
  name: z.string(),
  program: z.string(),
  operator: z.string(),
  amountMax: z.number().nullable(),
  amountAvg: z.number().nullable(),
  currency: z.literal("PLN"),
  window: z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  status: z.enum(["closed", "open", "planned", "demo"]),
  eligibility: z.array(z.string()),
  formFields: z.array(FormField),
  criteria: z.array(Criterion),
  minScore: z.number().nullable(),
  /** Innovations a call is restricted to (Usługa Wrażliwa: one Ramowy Plan Wdrożenia each). */
  innovations: z.array(CallInnovation),
  resultsPlanned: z.string().nullable(),
  applyUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
  capturedAt: isoDateTime,
  notes: z.string(),
});
export const Calls = z.array(Call);

// ------------------------------------------------------------------ canvas.json

export const CanvasOption = z.object({ label: z.string(), description: z.string().nullable() });
export const CanvasField = z.object({
  key: z.string(),
  label: z.string(),
  prompt: z.string().nullable(),
  /** single = tick one box; multi = tick several; text = write; matrix = mark cells. */
  kind: z.enum(["single", "multi", "text", "matrix"]),
  options: z.array(CanvasOption),
  questions: z.array(z.string()), // „Pytania pomocnicze" and similar
});
export const CanvasSection = z.object({
  key: z.string(),
  label: z.string(),
  prompt: z.string().nullable(), // null when the sheet prints no prompt at section level
  subfields: z.array(z.string()), // labels of the section's parts, in order
  fields: z.array(CanvasField),
});
export const Canvas = z.object({
  source: z.object({
    title: z.string(),
    url: z.string().url(),
    publisher: z.string(),
    basedOn: z.string(),
    version: z.string().nullable(),
    versionDate: z.string().nullable(),
    capturedAt: isoDateTime,
    sha256,
  }),
  sheets: z.array(z.object({ key: z.string(), title: z.string(), page: z.number().int(), sections: z.array(CanvasSection) })),
});

// ------------------------------------------------------------------ geo + GUS

export const Powiat = z.object({ teryt: z.string().regex(/^12\d{2}$/), name: z.string(), isCity: z.boolean() });
export const Powiaty = z.array(Powiat).length(22);

export const Gmina = z.object({
  teryt: z.string().regex(/^12\d{5}$/),
  bdlId: z.string().regex(/^\d{12}$/),
  name: z.string(),
  kind: z.enum(["miejska", "wiejska", "miejsko-wiejska"]),
  powiatTeryt: z.string().regex(/^12\d{2}$/),
  powiatName: z.string(),
  population: z.number().int().nullable(),
  pop65: z.number().int().nullable(),
  pop80: z.number().int().nullable(),
  popChange10y: z.number().nullable(), // percent change against the population ten years earlier
  year: z.number().int().nullable(),
});
export const Gminas = z.array(Gmina);

// ------------------------------------------------------------------ learn + network

export const LearnItem = z.object({
  title: z.string(),
  kind: z.enum(["raport", "narzędzie", "film", "przewodnik", "dane"]),
  url: z.string().url(),
  description: z.string(),
  publisher: z.string(),
  checkedAt: isoDateTime,
  httpStatus: z.number().int(),
});
export const Learn = z.array(LearnItem).min(8).max(15);

export const Network = z.object({
  orgs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["fundacja", "stowarzyszenie", "uczelnia", "jst", "ops", "firma", "inna"]),
      innovationIds: z.array(z.string()).min(1),
      isSample: z.literal(false),
      sourceUrl: z.string().url(),
    }),
  ),
  sites: z.array(
    z.object({
      innovationId: z.string(),
      place: z.string(),
      sentenceId: z.string(),
      isSample: z.literal(false),
    }),
  ),
});

// ------------------------------------------------------------------ inferred types

export type FormField = z.infer<typeof FormField>;
export type Criterion = z.infer<typeof Criterion>;
export type Call = z.infer<typeof Call>;
export type KnowledgeArea = z.infer<typeof KnowledgeArea>;
export type Knowledge = z.infer<typeof Knowledge>;
export type Canvas = z.infer<typeof Canvas>;
export type Powiat = z.infer<typeof Powiat>;
export type Gmina = z.infer<typeof Gmina>;
export type LearnItem = z.infer<typeof LearnItem>;
export type Network = z.infer<typeof Network>;
