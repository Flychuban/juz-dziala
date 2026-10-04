/**
 * The twelve sample Sprawy seeded by seed/sample-cases.ts — data only, so the
 * texts can be unit-tested (no personal data, no crisis signals, no noise).
 * Every case is labelled „przykładowe" wherever staff see it.
 */
import type {
  AuthorRole,
  CaseKind,
  CaseStatus,
  ContactPref,
  MapaArea,
  Urgency,
} from "~/lib/domain";
import { REPLY_CLOSING, RESIDENT_TEAM_NAME } from "~/server/cases/types";

/** Every sample case code starts with this; nothing else is ever deleted. */
export const SAMPLE_CASE_PREFIX = "JD-PRZK-";

/** DEMO_STAFF.expert (src/server/auth/session.ts) — the jury's „Ekspert" login. */
export const DEMO_EXPERT = "p-mentor-1";

export type Lang = "pl" | "en";
export type Msg = {
  by: "author" | "rops" | "expert";
  hoursAgo: number;
  body: string;
  internal?: boolean;
};
export type SampleCase = {
  code: string;
  kind: CaseKind;
  status: CaseStatus;
  locale: Lang;
  authorRole: AuthorRole;
  onBehalf?: boolean;
  contactPref: ContactPref;
  contactMasked?: string;
  title: string;
  body: string;
  areas: MapaArea[];
  urgency: Urgency;
  gminaTeryt: string;
  assigneeId?: string;
  /** Library card the case is about (test, feedback, adapt). */
  innovationSlug?: string;
  rating?: number;
  hoursAgo: number;
  thread: Msg[];
  triage: {
    summary: string;
    summaryEn: string;
    powiatGuess: string | null;
    suggestedExpertId: string | null;
    /** Card slugs the draft quotes (first solution sentence of each). */
    cards: string[];
  };
  /** An unread bell item for the ROPS team (and the expert, when assigned). */
  unread?: "created" | "authorMessage";
};

/*
 * Thread texts may use {title:slug} and {quote:slug}: replaced with the card's
 * title and first solution sentence (English translation in an English case),
 * read from the database — the replies never paraphrase a card.
 */
export const SAMPLE_CASES: SampleCase[] = [
  {
    code: "JD-PRZK-A2B3",
    kind: "need",
    status: "new",
    locale: "pl",
    authorRole: "resident",
    contactPref: "none",
    title: "Mama po upadku boi się zostać sama w domu",
    body: "Moja mama ma 79 lat i mieszka sama na wsi pod Limanową. Dwa tygodnie temu przewróciła się w kuchni i od tego czasu boi się zostawać sama. Ja pracuję w Krakowie i przyjeżdżam tylko w weekendy. Szukam kogoś, kto mógłby do niej zaglądać w tygodniu, albo rozwiązania, dzięki któremu mama łatwo wezwie pomoc.",
    areas: ["seniors"],
    urgency: "medium",
    gminaTeryt: "1207112",
    hoursAgo: 0.4,
    thread: [],
    triage: {
      summary:
        "Seniorka (79 l.) mieszkająca samotnie na wsi w powiecie limanowskim po upadku boi się zostawać sama; rodzina szuka wsparcia w tygodniu.",
      summaryEn:
        "A 79-year-old woman living alone in a village in Limanowa County is afraid to stay alone after a fall; her family is looking for help on weekdays.",
      powiatGuess: "powiat limanowski",
      suggestedExpertId: DEMO_EXPERT,
      cards: [
        "mobilne-centrum-pomocy-dla-osob-starszych",
        "organizator-kompleksowej-opieki-w-miejscu-zamieszkania",
      ],
    },
    unread: "created",
  },
  {
    code: "JD-PRZK-C4D5",
    kind: "need",
    status: "triaged",
    locale: "pl",
    authorRole: "resident",
    onBehalf: true,
    contactPref: "phone",
    contactMasked: "+48 *** *** 418",
    title: "Sąsiad od tygodnia nocuje w piwnicy bloku",
    body: "Starszy sąsiad stracił mieszkanie i od tygodnia śpi w piwnicy naszego bloku w Nowej Hucie. Robi się coraz zimniej, a on kaszle. Nie chce iść do noclegowni, bo mówi, że tam jest za głośno. Zgłaszam w jego imieniu, bo nie ma telefonu. Co możemy zrobić jako sąsiedzi?",
    areas: ["homelessness"],
    urgency: "high",
    gminaTeryt: "1261011",
    hoursAgo: 5,
    thread: [
      {
        by: "author",
        hoursAgo: 3,
        body: "Dopiszę jeszcze: sąsiad zgodził się, żeby ktoś z pomocy społecznej do niego przyszedł. Najlepiej po południu, rano wychodzi zbierać puszki.",
      },
    ],
    triage: {
      summary:
        "Starszy mężczyzna w kryzysie bezdomności od tygodnia nocuje w piwnicy bloku w Krakowie; robi się zimno, sąsiedzi pytają, jak pomóc.",
      summaryEn:
        "An older man experiencing homelessness has been sleeping in a block's basement in Kraków for a week; it is getting cold and the neighbours ask how to help.",
      powiatGuess: "Kraków",
      suggestedExpertId: "p-mentor-2",
      cards: ["szlakiem-ludzi-bezdomnych"],
    },
    unread: "created",
  },
  {
    code: "JD-PRZK-E6F7",
    kind: "question",
    status: "triaged",
    locale: "pl",
    authorRole: "resident",
    contactPref: "email",
    contactMasked: "r***@o***.pl",
    title: "Gdzie szukać wsparcia dla rodziców nastolatka po leczeniu?",
    body: "Nasza córka (16 lat) wraca do szkoły po kilku miesiącach leczenia depresji. Lekarze się nią opiekują, ale my jako rodzice czujemy się zagubieni. Czy w Nowym Sączu albo w okolicy działa grupa wsparcia dla rodziców albo są jakieś materiały o tym, jak pomóc dziecku wrócić do klasy?",
    areas: ["mental_health", "family"],
    urgency: "low",
    gminaTeryt: "1262011",
    hoursAgo: 80,
    thread: [
      {
        by: "author",
        hoursAgo: 76,
        body: "Dodam, że chodzi nam też o to, jak przygotować wychowawczynię i klasę na powrót córki.",
      },
    ],
    triage: {
      summary:
        "Rodzice 16-latki wracającej do szkoły po leczeniu depresji szukają grupy wsparcia i materiałów w Nowym Sączu.",
      summaryEn:
        "Parents of a 16-year-old returning to school after treatment for depression are looking for a support group and materials in Nowy Sącz.",
      powiatGuess: "Nowy Sącz",
      suggestedExpertId: "p-mentor-3",
      cards: ["bez-presji-z-depresji"],
    },
  },
  {
    code: "JD-PRZK-G8H9",
    kind: "idea",
    status: "in_progress",
    locale: "pl",
    authorRole: "ngo",
    contactPref: "email",
    contactMasked: "k***@w***.pl",
    title: "Wypożyczalnia sprzętu rehabilitacyjnego przy klubie seniora",
    body: "Jesteśmy małym stowarzyszeniem z gminy Wadowice. Wielu seniorów po pobycie w szpitalu potrzebuje na kilka tygodni balkonika, wózka albo łóżka, a kupno jest drogie. Chcemy założyć przy klubie seniora wypożyczalnię sprzętu z dyżurem wolontariuszy, którzy pokażą, jak z niego korzystać. Szukamy podpowiedzi, jak to dobrze zorganizować i skąd wziąć pierwszy sprzęt.",
    areas: ["seniors", "disability"],
    urgency: "low",
    gminaTeryt: "1218093",
    assigneeId: DEMO_EXPERT,
    hoursAgo: 30,
    thread: [
      {
        by: "rops",
        hoursAgo: 26,
        body: `Dzień dobry,

dziękujemy za opis pomysłu. Przekazaliśmy go mentorce Hubu, która zajmuje się usługami dla seniorów — odezwie się w tym wątku.

Żeby mogła lepiej doradzić: ilu seniorów przychodzi do Waszego klubu i czy macie już miejsce na przechowywanie sprzętu?

${REPLY_CLOSING}

${RESIDENT_TEAM_NAME}`,
      },
      {
        by: "author",
        hoursAgo: 20,
        body: "Do klubu przychodzi około 40 osób w tygodniu. Gmina wstępnie zgodziła się użyczyć nam garażu przy ośrodku kultury.",
      },
    ],
    triage: {
      summary:
        "Stowarzyszenie z gminy Wadowice chce uruchomić przy klubie seniora wypożyczalnię sprzętu rehabilitacyjnego z dyżurem wolontariuszy.",
      summaryEn:
        "An association in Wadowice municipality wants to open a loan service for rehabilitation equipment at a seniors' club, staffed by volunteers.",
      powiatGuess: "powiat wadowicki",
      suggestedExpertId: DEMO_EXPERT,
      cards: ["organizator-kompleksowej-opieki-w-miejscu-zamieszkania"],
    },
  },
  {
    code: "JD-PRZK-J2K3",
    kind: "test",
    status: "answered",
    locale: "pl",
    authorRole: "other",
    contactPref: "email",
    contactMasked: "m***@g***.com",
    title: "Zgłoszenie do testów: Senior CUDER",
    body: `Chcę testować rozwiązanie „Senior CUDER”.

Zgłasza: Inna instytucja.

Gmina: Myślenice (gmina miejsko-wiejska).

Od siebie: Prowadzę zajęcia w klubie seniora. Spotyka się u nas co tydzień kilkanaście osób. Chętnie przetestujemy grę przez miesiąc i opiszemy, co się sprawdziło, a co trzeba poprawić.`,
    areas: ["mental_health", "seniors"],
    urgency: "low",
    gminaTeryt: "1209033",
    assigneeId: DEMO_EXPERT,
    innovationSlug: "senior-cuder",
    hoursAgo: 144,
    thread: [
      {
        by: "expert",
        hoursAgo: 120,
        body: `Dzień dobry,

dziękuję za zgłoszenie do testów. {title:senior-cuder} — z karty: {quote:senior-cuder}

Napisz proszę, ile osób weźmie udział i w które dni się spotykacie — wtedy ustalimy szczegóły testu.

${REPLY_CLOSING}`,
      },
      {
        by: "author",
        hoursAgo: 100,
        body: "W teście weźmie udział 12 osób. Spotykamy się we wtorki i czwartki przed południem.",
      },
      {
        by: "expert",
        hoursAgo: 96,
        body: `Dziękuję! Zapisałam Wasz klub jako grupę testową. Po miesiącu poproszę o krótką opinię w tym wątku: co działa, a co poprawić.

${REPLY_CLOSING}`,
      },
    ],
    triage: {
      summary:
        "Osoba prowadząca klub seniora w Myślenicach zgłasza grupę kilkunastu osób do miesięcznego testu gry „Senior CUDER”.",
      summaryEn:
        "The leader of a seniors' club in Myślenice signs up a group of about a dozen people for a one-month test of the „Senior CUDER” game.",
      powiatGuess: "powiat myślenicki",
      suggestedExpertId: DEMO_EXPERT,
      cards: ["senior-cuder"],
    },
  },
  {
    code: "JD-PRZK-M4R5",
    kind: "feedback",
    status: "closed",
    locale: "pl",
    authorRole: "resident",
    contactPref: "none",
    title: "Opinia (4/5): Merkury",
    body: `Ocena: 4/5 — Dobrze

Co działa: Ćwiczyliśmy z tatą na symulatorze przez dwa tygodnie. Bankomat i paczkomat poszły dobrze — w zeszłym tygodniu tata sam odebrał paczkę.

Co poprawić: Kasa samoobsługowa była dla niego za szybka. Przydałby się wolniejszy tryb i większe przyciski.`,
    areas: ["seniors"],
    urgency: "low",
    gminaTeryt: "1216092",
    innovationSlug: "merkury",
    rating: 4,
    assigneeId: "rops",
    hoursAgo: 288,
    thread: [
      {
        by: "rops",
        hoursAgo: 264,
        body: `Dzień dobry,

dziękujemy za opinię i za konkretne uwagi. Wpisaliśmy je do podsumowania testów rozwiązania „Merkury”, które zespół Hubu przekazuje autorom.

${REPLY_CLOSING}

${RESIDENT_TEAM_NAME}`,
      },
      {
        by: "author",
        hoursAgo: 250,
        body: "Dziękuję. Tata pyta, czy będzie można przetestować nową wersję.",
      },
    ],
    triage: {
      summary:
        "Opinia testera: symulator „Merkury” pomógł seniorowi w obsłudze bankomatu i paczkomatu; kasa samoobsługowa okazała się za szybka.",
      summaryEn:
        "Tester feedback: the „Merkury” simulator helped an older man use a cash machine and a parcel locker; the self-service checkout was too fast.",
      powiatGuess: "powiat tarnowski",
      suggestedExpertId: DEMO_EXPERT,
      cards: ["merkury"],
    },
  },
  {
    code: "JD-PRZK-N6P7",
    kind: "adapt",
    status: "in_progress",
    locale: "pl",
    authorRole: "ops",
    contactPref: "email",
    contactMasked: "o***@g***.pl",
    title: "Wdrożenie „Kodów QR na pomoc seniorom” w gminie",
    body: "Pracujemy w ośrodku pomocy społecznej w jednej z gmin powiatu gorlickiego. Rozważamy wdrożenie rozwiązania „Kody QR na pomoc seniorom” dla osób starszych z demencją, które zdarza się, że gubią drogę. Prosimy o kontakt z autorami oraz informację, ile trwa przygotowanie i jakie są koszty.",
    areas: ["seniors"],
    urgency: "low",
    gminaTeryt: "1205042",
    assigneeId: "rops",
    innovationSlug: "kody-qr-na-pomoc-seniorom",
    hoursAgo: 120,
    thread: [
      {
        by: "rops",
        hoursAgo: 104,
        body: `Dzień dobry,

dziękujemy za zainteresowanie. Z karty Biblioteki: {quote:kody-qr-na-pomoc-seniorom}

Koszty i czas przygotowania nie są opisane na karcie, dlatego zapytamy o nie autorów rozwiązania. Żeby pytanie było konkretne: dla ilu osób planujecie wdrożenie?

${REPLY_CLOSING}

${RESIDENT_TEAM_NAME}`,
      },
      {
        by: "author",
        hoursAgo: 98,
        body: "Na początek dla około 30 osób, we współpracy z dwoma sołectwami.",
      },
    ],
    triage: {
      summary:
        "Ośrodek pomocy społecznej z powiatu gorlickiego chce wdrożyć „Kody QR na pomoc seniorom” dla osób z demencją i pyta o koszty oraz czas przygotowania.",
      summaryEn:
        "A social welfare centre in Gorlice County wants to introduce „QR codes to help older people” for people with dementia and asks about costs and set-up time.",
      powiatGuess: "powiat gorlicki",
      suggestedExpertId: DEMO_EXPERT,
      cards: ["kody-qr-na-pomoc-seniorom"],
    },
  },
  {
    code: "JD-PRZK-Q8R9",
    kind: "need",
    status: "answered",
    locale: "pl",
    authorRole: "resident",
    contactPref: "sms",
    contactMasked: "+48 *** *** 207",
    title: "Szukam opieki wytchnieniowej dla dorosłego syna",
    body: "Opiekuję się dorosłym synem z niepełnosprawnością intelektualną. Od kilku lat nie miałam ani jednego wolnego dnia. Czy w powiecie nowotarskim jest jakaś opieka wytchnieniowa, choćby na kilka godzin w tygodniu?",
    areas: ["disability", "family"],
    urgency: "medium",
    gminaTeryt: "1211033",
    assigneeId: "rops",
    hoursAgo: 96,
    thread: [
      {
        by: "rops",
        hoursAgo: 70,
        body: `Dzień dobry,

dziękujemy, że napisałaś. W Bibliotece Innowacji Społecznych nie ma jeszcze rozwiązania opieki wytchnieniowej, które działałoby w Twoim powiecie. Dopisaliśmy Twoją potrzebę do „białych plam” — na ich podstawie zespół ROPS planuje tematy naborów na innowacje.

Następny krok: zapytaj w ośrodku pomocy społecznej w swojej gminie o usługi opiekuńcze i opiekę wytchnieniową. Jeśli chcesz, pomożemy przygotować to pytanie.

${REPLY_CLOSING}

${RESIDENT_TEAM_NAME}`,
      },
      {
        by: "author",
        hoursAgo: 60,
        body: "Dziękuję. Zapytam w ośrodku w przyszłym tygodniu i napiszę, czego się dowiedziałam.",
      },
    ],
    triage: {
      summary:
        "Rodzic opiekujący się dorosłym synem z niepełnosprawnością intelektualną w powiecie nowotarskim szuka opieki wytchnieniowej; w Bibliotece brak pasującej karty.",
      summaryEn:
        "A parent caring for an adult son with an intellectual disability in Nowy Targ County is looking for respite care; no Library card fits.",
      powiatGuess: "powiat nowotarski",
      suggestedExpertId: DEMO_EXPERT,
      cards: [],
    },
  },
  {
    code: "JD-PRZK-S2T3",
    kind: "question",
    status: "triaged",
    locale: "en",
    authorRole: "resident",
    contactPref: "email",
    contactMasked: "h***@g***.com",
    title: "Where can my mother find a GP who speaks English or Ukrainian?",
    body: "My mother moved to Kraków from Ukraine last year to live with us. She needs regular check-ups for her blood pressure, but she does not speak Polish yet and gets lost in the system. Is there a guide to Polish public health care in English or Ukrainian, or someone who could help her register with a family doctor?",
    areas: ["migrants", "health"],
    urgency: "low",
    gminaTeryt: "1261011",
    hoursAgo: 20,
    thread: [
      {
        by: "author",
        hoursAgo: 2,
        body: "She is insured through my husband's job, if that matters.",
      },
    ],
    triage: {
      summary:
        "Osoba z Krakowa pyta o przewodnik po publicznej opiece zdrowotnej po angielsku lub ukraińsku dla matki z Ukrainy i o pomoc w zapisie do lekarza rodzinnego.",
      summaryEn:
        "A Kraków resident asks for an English or Ukrainian guide to public health care for their mother from Ukraine, and for help registering with a GP.",
      powiatGuess: "Kraków",
      suggestedExpertId: "p-mentor-4",
      cards: ["health-guide-pl"],
    },
    unread: "authorMessage",
  },
  {
    code: "JD-PRZK-V4W5",
    kind: "need",
    status: "answered",
    locale: "en",
    authorRole: "resident",
    contactPref: "email",
    contactMasked: "d***@o***.uk",
    title: "My father-in-law keeps forgetting his medicines",
    body: "My father-in-law is 84 and lives on his own near Wieliczka. He takes five different medicines and often forgets an evening dose or takes one twice. We live in Kraków and call him every day, but it is not enough. Is there a device or a service that could remind him and let us know if he misses a dose?",
    areas: ["seniors", "health"],
    urgency: "medium",
    gminaTeryt: "1219053",
    assigneeId: "rops",
    hoursAgo: 72,
    thread: [
      {
        by: "rops",
        hoursAgo: 50,
        body: `Hello,

thank you for getting in touch. The ROPS Social Innovation Library has a solution that may fit — {title:inteligentny-organizer-do-lekow}: {quote:inteligentny-organizer-do-lekow}

Next step: read the description at {link:inteligentny-organizer-do-lekow} and tell us whether it would suit your father-in-law. The solution is open for testing, so we can put you in touch with its authors.

If you have any questions, reply here — we'll answer in this thread.

${RESIDENT_TEAM_NAME}`,
      },
      {
        by: "author",
        hoursAgo: 30,
        body: "Thank you, this looks right. Yes, please put us in touch — he would be happy to test it.",
      },
    ],
    triage: {
      summary:
        "Rodzina 84-letniego seniora mieszkającego samotnie w okolicy Wieliczki szuka urządzenia lub usługi, które przypomni o lekach i powiadomi o pominiętej dawce.",
      summaryEn:
        "The family of an 84-year-old man living alone near Wieliczka is looking for a device or service that reminds him about his medicines and tells them about a missed dose.",
      powiatGuess: "powiat wielicki",
      suggestedExpertId: DEMO_EXPERT,
      cards: ["inteligentny-organizer-do-lekow"],
    },
  },
  {
    code: "JD-PRZK-X6Y7",
    kind: "idea",
    status: "new",
    locale: "pl",
    authorRole: "resident",
    contactPref: "email",
    contactMasked: "n***@w***.pl",
    title: "Lodówka społeczna przy szkole podstawowej",
    body: "Jestem nauczycielką w szkole podstawowej w Tarnowie. Po stołówce i szkolnych uroczystościach zostaje dużo jedzenia, a część rodzin naszych uczniów ledwo wiąże koniec z końcem. Pomysł: lodówka i regał przy wejściu do szkoły, gdzie każdy może zostawić albo zabrać jedzenie i ubrania. Prowadzilibyśmy to razem z radą rodziców.",
    areas: ["poverty", "family"],
    urgency: "low",
    gminaTeryt: "1263011",
    hoursAgo: 1.5,
    thread: [],
    triage: {
      summary:
        "Nauczycielka z Tarnowa proponuje lodówkę społeczną i regał wymiany jedzenia i ubrań przy szkole, prowadzone razem z radą rodziców.",
      summaryEn:
        "A teacher in Tarnów suggests a community fridge and a food and clothes swap shelf at a primary school, run together with the parents' council.",
      powiatGuess: "Tarnów",
      suggestedExpertId: "p-mentor-2",
      cards: ["oddawacze"],
    },
  },
  {
    code: "JD-PRZK-Z8A2",
    kind: "need",
    status: "closed",
    locale: "pl",
    authorRole: "resident",
    contactPref: "none",
    title: "Brak dojazdu do przychodni z naszej wsi",
    body: "Z naszej wsi w gminie Miechów autobus jeździ tylko w dni szkolne, raz rano i raz po południu. Starsze osoby bez samochodu nie mają jak dojechać do przychodni i apteki. Czy jest jakiś sposób, żeby zorganizować dowóz?",
    areas: ["poverty", "seniors"],
    urgency: "low",
    gminaTeryt: "1208053",
    assigneeId: "rops",
    hoursAgo: 216,
    thread: [
      {
        by: "rops",
        hoursAgo: 190,
        body: `Dzień dobry,

dziękujemy za zgłoszenie. Biblioteka Innowacji Społecznych nie ma jeszcze rozwiązania dowozu dla mieszkańców wsi — to jedna z „białych plam”, które zespół ROPS bierze pod uwagę, planując nabory na innowacje.

Następny krok: jeśli w Twojej okolicy jest organizacja albo grupa sąsiedzka, która chciałaby przygotować taki dowóz, może opisać pomysł w serwisie w części „Mam pomysł”.

${REPLY_CLOSING}

${RESIDENT_TEAM_NAME}`,
      },
      {
        by: "author",
        hoursAgo: 180,
        body: "Dziękuję, przekażę to sołtysowi i kołu gospodyń.",
      },
    ],
    triage: {
      summary:
        "Mieszkańcy wsi w gminie Miechów nie mają dojazdu do przychodni i apteki; autobus kursuje tylko w dni szkolne.",
      summaryEn:
        "People in a village in Miechów municipality cannot get to the clinic or the pharmacy; the bus only runs on school days.",
      powiatGuess: "powiat miechowski",
      suggestedExpertId: "p-mentor-2",
      cards: [],
    },
  },
];
