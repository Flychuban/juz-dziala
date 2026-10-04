/**
 * Everyday English → the language of the English card translations.
 *
 * The English twin of synonyms.ts: same group ids, same Mapa areas. Visitors
 * write "my nan is on her own and mixes up her pills"; the translated cards say
 * "older people", "social isolation", "medicines". Triggers are matched by
 * stem (stemEn), so "pensioners" meets "pensioner"; a trigger may be a phrase
 * whose words must appear in a row. The card words are triggers too.
 *
 * This file is data. Change it here, not in the matcher.
 */
import type { AgeBand, SynonymGroup } from "./synonyms";

export const SYNONYM_GROUPS_EN: readonly SynonymGroup[] = [
  {
    id: "seniors",
    areas: ["seniors"],
    triggers: [
      "mum", "mom", "mother", "dad", "father", "grandma", "grandmother", "granny", "nan", "nana",
      "grandad", "granddad", "grandpa", "grandfather", "pensioner", "retired", "retiree",
      "elderly", "older person", "older people", "old age", "old man", "old woman", "old lady",
      "senior", "seniors", "in her seventies", "in his seventies", "in her eighties", "in his eighties",
      "in her nineties", "in his nineties",
    ],
    expansions: ["older people", "seniors", "elderly", "old age"],
  },
  {
    id: "loneliness",
    areas: [],
    triggers: [
      "alone", "lonely", "loneliness", "isolated", "isolation", "on her own", "on his own", "on my own",
      "by herself", "by himself", "lives alone", "living alone", "no one visits", "nobody visits",
      "nobody comes", "no one comes", "no one to talk to", "nobody to talk to", "never goes out",
      "hardly goes out", "barely goes out", "doesn't go out", "does not go out", "stays at home",
      "stuck at home", "housebound", "leaves the house", "leave the house", "leaves home",
      "rarely goes out", "widow", "widowed", "widower",
    ],
    expansions: ["loneliness", "social isolation", "isolation", "social exclusion", "relationships", "social life"],
  },
  {
    id: "mobility",
    areas: ["disability"],
    triggers: [
      "wheelchair", "in a wheelchair", "wheelchair user", "crutches", "walking frame", "zimmer frame",
      "walker", "can't walk", "cannot walk", "can not walk", "struggles to walk", "amputation", "amputee",
      "amputated", "prosthesis", "prosthetic", "paralysed", "paralyzed", "physical disability",
    ],
    expansions: ["limited mobility", "physical disability", "mobility impairment", "wheelchairs", "wheelchair users"],
  },
  {
    id: "vision",
    areas: ["disability"],
    triggers: [
      "blind", "partially sighted", "visually impaired", "sight loss", "low vision", "losing her sight",
      "losing his sight", "lost her sight", "lost his sight", "lost my sight", "can't see", "cannot see",
    ],
    expansions: ["visual impairment", "blind people", "sight", "sensory disabilities", "partially sighted"],
  },
  {
    id: "hearing",
    areas: ["disability"],
    triggers: [
      "deaf", "hard of hearing", "hearing loss", "hearing aid", "can't hear", "cannot hear",
      "sign language", "pjm",
    ],
    expansions: ["deaf", "Deaf people", "sign language", "Polish Sign Language", "PJM", "sensory disabilities"],
  },
  {
    id: "mental_health",
    areas: ["mental_health"],
    triggers: [
      "depression", "depressed", "sad", "sadness", "anxiety", "anxious", "panic attacks", "panic",
      "psychiatrist", "psychologist", "therapist", "breakdown", "mental health", "mental illness",
      "mental crisis", "mental health crisis", "teenager in crisis", "stress", "stressed", "can't cope",
      "no energy",
    ],
    expansions: ["mental health", "mental health crisis", "depression", "anxiety disorders", "psychological support"],
  },
  {
    id: "homelessness",
    areas: ["homelessness"],
    triggers: [
      "homeless", "homelessness", "on the street", "on the streets", "sleeping rough", "sleeps rough",
      "rough sleeper", "night shelter", "shelter", "nowhere to live", "nowhere to sleep",
      "no roof over", "evicted", "eviction",
    ],
    expansions: ["homelessness", "homelessness crisis", "people experiencing homelessness", "homeless"],
  },
  {
    id: "migrants",
    areas: ["migrants"],
    triggers: [
      "ukrainian", "from ukraine", "foreigner", "migrant", "immigrant", "refugee", "asylum seeker",
      "doesn't speak polish", "does not speak polish", "don't speak polish", "can't speak polish",
      "no polish", "afghan", "chechen",
    ],
    expansions: ["foreigners", "migrants", "refugees", "Polish language", "integration"],
  },
  {
    id: "labour_market",
    areas: [],
    triggers: [
      "unemployed", "unemployment", "out of work", "no job", "job", "work", "looking for work",
      "lost her job", "lost his job", "lost my job", "back to work", "employment",
    ],
    expansions: ["labour market", "employment", "taking up work", "work"],
  },
  {
    id: "family",
    areas: ["family"],
    triggers: [
      "child", "children", "kid", "kids", "son", "daughter", "grandson", "granddaughter", "grandchild",
      "teenager", "teen", "adolescent", "foster family", "foster care", "foster", "children's home",
      "orphanage", "adoption", "adopted", "nursery", "kindergarten", "school", "pupil",
    ],
    expansions: ["family", "families", "children", "young people", "foster care", "care institutions"],
  },
  {
    id: "digital_exclusion",
    areas: [],
    triggers: [
      "phone", "mobile phone", "smartphone", "internet", "online", "atm", "cash machine", "cashpoint",
      "computer", "laptop", "app", "tablet", "ticket machine", "can't use", "doesn't know how to use",
    ],
    expansions: ["digital exclusion", "digital skills", "app", "self-service kiosks"],
  },
  {
    id: "medication",
    areas: ["health"],
    triggers: [
      "pills", "tablets", "medication", "medicine", "medicines", "meds", "mixes up", "forgets her pills",
      "forgets his pills", "insulin", "prescription",
    ],
    expansions: ["medicines", "medication", "taking medicines", "pill organiser"],
  },
  {
    id: "dementia",
    areas: ["health", "seniors"],
    triggers: ["dementia", "memory", "forgetful", "forgets", "forgetting", "alzheimer", "alzheimer's", "confused"],
    expansions: ["dementia", "memory problems", "memory functions", "memory loss", "care"],
  },
  {
    id: "care",
    areas: ["health"],
    triggers: [
      "care", "carer", "caregiver", "nurse", "after hospital", "out of hospital", "discharged",
      "left hospital", "bedridden", "bed-bound",
    ],
    expansions: ["care", "care at home", "place of residence", "nursing", "dependent people"],
  },
  {
    id: "intellectual_disability",
    areas: ["disability"],
    triggers: [
      "intellectual disability", "learning disability", "learning difficulties", "down syndrome",
      "down's syndrome", "autism", "autistic", "autism spectrum", "on the spectrum", "asd",
    ],
    expansions: ["intellectual disabilities", "autism spectrum", "neurodivergent"],
  },
  {
    id: "disability",
    areas: ["disability"],
    triggers: ["disabled", "disability", "disabilities", "handicapped", "special needs", "impairment"],
    expansions: ["people with disabilities", "disability", "accessibility"],
  },
  {
    id: "poverty",
    areas: ["poverty"],
    triggers: [
      "poor", "poverty", "no money", "not enough money", "can't afford", "cannot afford", "debt", "debts",
      "broke", "benefits", "food bank", "nothing to eat",
    ],
    expansions: ["poverty", "people in poverty", "difficult financial situation", "financial difficulties"],
  },
  {
    id: "health",
    areas: ["health"],
    triggers: [
      "illness", "ill", "sick", "disease", "doctor", "gp", "hospital", "clinic", "rehabilitation", "rehab",
      "diabetes", "diabetic", "cancer", "surgery", "operation", "patient",
    ],
    expansions: ["health", "patients", "treatment", "rehabilitation", "diseases"],
  },
  {
    id: "transport",
    areas: [],
    triggers: ["bus", "buses", "tram", "trams", "public transport", "bus stop", "train", "get to town", "travel"],
    expansions: ["public transport", "accessibility", "public spaces", "transport"],
  },
  {
    id: "violence",
    areas: ["family"],
    triggers: ["violence", "abuse", "abused", "abusive", "hits", "beats", "domestic violence"],
    expansions: ["domestic violence", "violence"],
  },
  {
    id: "hygiene",
    areas: [],
    triggers: ["wash", "washing", "shower", "bath", "clean clothes", "laundry", "toilet"],
    expansions: ["hygiene", "hygiene services", "clean clothes", "bathrooms"],
  },
];

/** The same age bands as in Polish, with the English card words for children and teenagers. */
export const AGE_BANDS_EN: readonly AgeBand[] = [
  { min: 60, max: 120, groupId: "seniors", extraExpansions: [] },
  { min: 0, max: 12, groupId: "family", extraExpansions: ["children"] },
  { min: 13, max: 19, groupId: "family", extraExpansions: ["young people", "teenagers"] },
];
