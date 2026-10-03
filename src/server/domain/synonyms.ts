/**
 * Everyday Polish → the formal language of the library cards.
 *
 * Residents write "mama nie wychodzi z domu"; cards say "osoby starsze",
 * "izolacja społeczna". Each group lists the words a resident might type
 * (`triggers`, any inflection: matching is by stem) and the words the cards use
 * (`expansions`). A trigger may be a phrase; its words must appear in a row.
 * The formal words are also triggers, so a resident who types "bezdomność" is
 * detected in the same area as one who types "na ulicy".
 *
 * `areas` are the Mapa areas a group points to. Groups with no single area
 * (loneliness, the labour market, digital exclusion, transport) leave it empty
 * rather than force one.
 *
 * "lęki" (fears) and "leki" (medicines) fold to the same letters. The matcher
 * therefore compares diacritics whenever the resident's text uses them at all,
 * and falls back to folded comparison only for text typed without diacritics.
 *
 * This file is data. Change it here, not in the matcher.
 */
import type { MapaArea } from "./types";

export type SynonymGroup = {
  id: string;
  areas: MapaArea[];
  triggers: string[];
  expansions: string[];
};

export const SYNONYM_GROUPS: readonly SynonymGroup[] = [
  {
    id: "seniors",
    areas: ["seniors"],
    triggers: [
      "mama", "mamą", "mamie", "tata", "taty", "tacie", "tatą",
      "babcia", "babci", "babcią", "dziadek", "dziadka", "dziadkiem", "dziadkowi",
      "emeryt", "emerytka", "emeryci", "emerytura", "starszy", "starsza", "starsi",
      "staruszek", "staruszka", "senior", "seniorka", "w podeszłym wieku",
      "po siedemdziesiątce", "po osiemdziesiątce",
    ],
    expansions: ["senior", "seniorzy", "osoby starsze", "osób starszych"],
  },
  {
    id: "loneliness",
    areas: [],
    triggers: [
      "sama", "sam", "samotna", "samotny", "samotnie", "samotność", "osamotniona", "osamotniony",
      "nikt nie odwiedza", "nikt nie przychodzi", "nie ma z kim porozmawiać", "nie ma do kogo",
      "nie wychodzi z domu", "nie wychodzi", "prawie nie wychodzi", "siedzi w domu",
      "owdowiała", "owdowiał", "wdowa", "wdowiec",
    ],
    expansions: ["samotność", "osamotnienie", "osamotnione", "izolacja", "izolacja społeczna", "wykluczenie społeczne", "relacje społeczne"],
  },
  {
    id: "mobility",
    areas: ["disability"],
    triggers: [
      "wózek", "wózku", "na wózku", "wózkiem", "nie chodzi", "nie może chodzić", "kule", "o kulach",
      "balkonik", "chodzik", "porusza się z trudem", "amputacja", "amputacji", "proteza", "protezy",
      "sparaliżowany", "sparaliżowana", "niepełnosprawność ruchowa",
    ],
    expansions: ["ograniczona mobilność", "niepełnosprawność ruchowa", "ograniczenia ruchowe", "dysfunkcje ruchu", "wózek inwalidzki"],
  },
  {
    id: "vision",
    areas: ["disability"],
    triggers: [
      "niewidomy", "niewidoma", "niewidomi", "niewidzący", "słabowidzący", "słabowidząca", "nie widzi",
      "traci wzrok", "stracił wzrok", "straciła wzrok", "ślepy", "ślepa", "ociemniały", "ociemniała",
    ],
    expansions: ["niepełnosprawność sensoryczna", "niepełnosprawność wzroku", "dysfunkcja wzroku", "niewidomych", "niewidzących", "słabowidzących", "ociemniałych"],
  },
  {
    id: "hearing",
    areas: ["disability"],
    triggers: [
      "głuchy", "głucha", "głusi", "niesłyszący", "niesłysząca", "niedosłyszący", "nie słyszy",
      "aparat słuchowy", "migowy", "migowego", "pjm",
    ],
    expansions: ["niepełnosprawność sensoryczna", "niepełnosprawność słuchu", "g/Głuchych", "głuchych", "polski język migowy", "PJM"],
  },
  {
    id: "mental_health",
    areas: ["mental_health"],
    triggers: [
      "depresja", "depresję", "depresji", "smutny", "smutna", "smutek", "myśli", "lęk", "lęki", "lęku", "lękowe",
      "ataki paniki", "psychiatra", "psychiatry", "psycholog", "psychologa", "nerwica", "załamanie",
      "nastolatek w kryzysie", "kryzys psychiczny", "nie ma sił", "stres",
    ],
    expansions: ["zdrowie psychiczne", "kryzys psychiczny", "kryzysów psychicznych", "depresja", "stany depresyjne", "zaburzenia lękowe", "wsparcie psychologiczne"],
  },
  {
    id: "homelessness",
    areas: ["homelessness"],
    triggers: [
      "bezdomny", "bezdomna", "bezdomni", "bezdomność", "na ulicy", "noclegownia", "noclegowni",
      "nie ma gdzie mieszkać", "nie ma gdzie spać", "śpi na dworcu", "bez dachu nad głową", "eksmisja", "pustostan",
    ],
    expansions: ["bezdomność", "kryzys bezdomności", "osoby bezdomne", "bezdomnych"],
  },
  {
    id: "migrants",
    areas: ["migrants"],
    triggers: [
      "ukrainiec", "ukrainka", "ukraińcy", "z ukrainy", "cudzoziemiec", "cudzoziemka", "cudzoziemcy",
      "migrant", "migrantka", "uchodźca", "uchodźczyni", "obcokrajowiec", "nie zna polskiego",
      "nie mówi po polsku", "afgańczyk", "czeczen",
    ],
    expansions: ["cudzoziemcy", "cudzoziemców", "migranci", "uchodźcy", "obcokrajowcy", "język polski"],
  },
  {
    id: "labour_market",
    areas: [],
    triggers: [
      "bez pracy", "bezrobotny", "bezrobotna", "bezrobocie", "praca", "pracy", "pracę", "szukam pracy",
      "stracił pracę", "straciła pracę", "wrócić do pracy", "zatrudnienie",
    ],
    expansions: ["rynek pracy", "aktywizacja zawodowa", "zatrudnienie", "praca"],
  },
  {
    id: "family",
    areas: ["family"],
    triggers: [
      "dziecko", "dzieci", "syn", "syna", "córka", "córkę", "wnuk", "wnuczka", "nastolatek", "nastolatka",
      "rodzina zastępcza", "piecza", "dom dziecka", "adopcja", "adopcyjna", "przedszkole", "szkoła", "szkole", "uczeń",
    ],
    expansions: ["rodzina", "rodziny", "dzieci", "młodzież", "piecza zastępcza", "placówki opiekuńczo-wychowawcze"],
  },
  {
    id: "digital_exclusion",
    areas: [],
    triggers: [
      "telefon", "telefonu", "smartfon", "komórka", "internet", "internetu", "bankomat", "bankomatu",
      "komputer", "komputera", "aplikacja", "aplikacji", "tablet", "biletomat", "nie umie obsłużyć",
    ],
    expansions: ["wykluczenie cyfrowe", "kompetencje cyfrowe", "wykluczonych cyfrowo", "aplikacja", "kiosk samoobsługowy"],
  },
  {
    id: "medication",
    areas: ["health"],
    triggers: ["leki", "leków", "lekami", "myli leki", "zapomina o lekach", "tabletki", "insulina", "insulinę"],
    expansions: ["leków", "przyjmowanie leków", "organizer na leki"],
  },
  {
    id: "dementia",
    areas: ["health", "seniors"],
    triggers: ["demencja", "demencję", "pamięć", "pamięcią", "zapomina", "alzheimer", "alzheimera", "otępienie"],
    expansions: ["demencja", "choroby otępienne", "choroby dementywne", "zaniki pamięci", "problemy z pamięcią", "opieka"],
  },
  {
    id: "care",
    areas: ["health"],
    triggers: ["opieka", "opieki", "opiekunka", "pielęgniarka", "po szpitalu", "wypis ze szpitala", "leżący", "leżąca"],
    expansions: ["opieka", "opieka w miejscu zamieszkania", "pielęgniarska", "osoby niesamodzielne"],
  },
  {
    id: "intellectual_disability",
    areas: ["disability"],
    triggers: [
      "niepełnosprawność intelektualna", "niepełnosprawnością intelektualną", "upośledzenie", "zespół downa",
      "autyzm", "autyzmem", "autystyczny", "autystyczna", "spektrum", "asd",
    ],
    expansions: ["niepełnosprawność intelektualna", "spektrum autyzmu", "osoby neuroatypowe"],
  },
  {
    id: "disability",
    areas: ["disability"],
    triggers: ["niepełnosprawny", "niepełnosprawna", "niepełnosprawność", "orzeczenie", "niepełnosprawnością"],
    expansions: ["niepełnosprawność", "osoby z niepełnosprawnością", "dostępność"],
  },
  {
    id: "poverty",
    areas: ["poverty"],
    triggers: ["bieda", "biedzie", "nie starcza", "brakuje na", "brakuje pieniędzy", "nie mam za co", "ubogi", "uboga", "długi", "zasiłek"],
    expansions: ["ubóstwo", "osoby ubogie", "trudna sytuacja materialna"],
  },
  {
    id: "health",
    areas: ["health"],
    triggers: ["choroba", "chory", "chora", "lekarz", "lekarza", "szpital", "przychodnia", "rehabilitacja", "cukrzyca", "cukrzycę", "rak", "nowotwór", "onkologia"],
    expansions: ["zdrowie", "pacjent", "pacjentów", "leczenie", "rehabilitacja", "choroby"],
  },
  {
    id: "transport",
    areas: [],
    triggers: ["autobus", "autobusem", "tramwaj", "tramwajem", "komunikacja miejska", "przystanek", "dojazd", "dojechać"],
    expansions: ["transport publiczny", "komunikacja miejska", "dostępność", "przestrzeń publiczna"],
  },
  {
    id: "violence",
    areas: ["family"],
    triggers: ["przemoc", "przemocy", "bije", "znęca się", "awantury"],
    expansions: ["przemoc w rodzinie", "przemocy"],
  },
  {
    id: "hygiene",
    areas: [],
    triggers: ["umyć się", "umyć", "prysznic", "łaźnia", "pranie", "czyste ubrania"],
    expansions: ["higiena", "usługi higieniczne", "czysta odzież"],
  },
];

/**
 * An age written in the text ("ma 73 lata", "16-latek", "po 70") points to a
 * group: 60 and over → seniors; under 20 → family, with the card words for
 * children or teenagers. "od 5 lat" and "5 lat temu" are durations, not ages.
 */
export type AgeBand = { min: number; max: number; groupId: string; extraExpansions: string[] };

export const AGE_BANDS: readonly AgeBand[] = [
  { min: 60, max: 120, groupId: "seniors", extraExpansions: [] },
  { min: 0, max: 12, groupId: "family", extraExpansions: ["dzieci"] },
  { min: 13, max: 19, groupId: "family", extraExpansions: ["młodzież", "nastolatki"] },
];
