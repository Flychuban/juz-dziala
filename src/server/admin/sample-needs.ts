import { existsSync, readFileSync } from "node:fs";

import { eq } from "drizzle-orm";

import { type MapaArea } from "~/lib/domain";
import { db } from "~/server/db";
import { innovations, matchRuns } from "~/server/db/schema";

/*
 * ~60 sample matching runs (isSample = true) so the trends page and „Białe
 * plamy" have something to show on a fresh database. Plain everyday Polish,
 * no personal data. About a quarter are deliberately unmatched — rural
 * transport and respite care for parents of disabled children are the two
 * gaps the Biblioteka does not cover, and they are the „białe plamy".
 *
 * Re-running replaces every earlier sample run (isSample = true) and
 * refreshes the dates, so the sample always spans the last 30 days.
 */

type Outcome = "match" | "low" | "none";
type SampleNeed = [
  text: string,
  areas: MapaArea[],
  powiat: string,
  outcome: Outcome,
];

export const SAMPLE_NEEDS: SampleNeed[] = [
  [
    "Mama ma 82 lata, mieszka sama na wsi i całymi dniami z nikim nie rozmawia.",
    ["seniors"],
    "1216",
    "match",
  ],
  [
    "Szukam zajęć dla seniorów, żeby tata wychodził z domu i poznał ludzi.",
    ["seniors"],
    "1261",
    "match",
  ],
  [
    "Babcia zaczyna zapominać, gubi klucze. Jak ćwiczyć jej pamięć w domu?",
    ["seniors"],
    "1201",
    "match",
  ],
  [
    "Sąsiad po udarze potrzebuje kogoś, kto pomoże mu przystosować mieszkanie.",
    ["seniors"],
    "1263",
    "match",
  ],
  [
    "Starsza pani z bloku boi się wychodzić, bo nie ma windy, a schody są strome.",
    ["seniors", "disability"],
    "1212",
    "match",
  ],
  [
    "Seniorzy w naszej gminie nie umieją korzystać z telefonu ani z e-recepty.",
    ["seniors"],
    "1218",
    "match",
  ],
  [
    "Dziadek ma demencję, a my pracujemy. Kto może z nim posiedzieć kilka godzin?",
    ["seniors"],
    "1219",
    "match",
  ],
  [
    "Na naszą wieś nie dojeżdża już żaden autobus. Starsi ludzie nie mają jak dojechać do lekarza.",
    ["seniors", "poverty"],
    "1204",
    "none",
  ],
  [
    "Bez samochodu nie da się stąd dojechać do przychodni ani do sklepu, autobus jeździ raz dziennie.",
    ["poverty"],
    "1208",
    "none",
  ],
  [
    "Mama musi jeździć na rehabilitację do miasta, a z naszej wioski nie ma żadnego transportu.",
    ["seniors", "disability"],
    "1214",
    "none",
  ],
  [
    "Młodzież z wiosek nie ma czym dojechać na zajęcia po szkole, ostatni autobus odjeżdża o 15.",
    ["family", "poverty"],
    "1204",
    "none",
  ],
  [
    "Brakuje dowozu dla osób starszych do urzędu i apteki w gminie.",
    ["seniors"],
    "1208",
    "none",
  ],
  [
    "Nie ma komunikacji między naszą wsią a miastem powiatowym, ludzie bez prawa jazdy są odcięci.",
    ["poverty"],
    "1215",
    "none",
  ],
  [
    "Mam syna z autyzmem i od lat nie miałam ani jednego dnia odpoczynku. Nikt nie może go przypilnować.",
    ["disability", "family"],
    "1210",
    "none",
  ],
  [
    "Opiekuję się córką na wózku całą dobę. Potrzebuję chociaż kilku godzin wytchnienia w tygodniu.",
    ["disability"],
    "1211",
    "none",
  ],
  [
    "Rodzice dzieci z niepełnosprawnością w naszej gminie są wykończeni, nie ma żadnej opieki wytchnieniowej.",
    ["disability", "family"],
    "1207",
    "none",
  ],
  [
    "Szukam miejsca, gdzie mogłabym zostawić dziecko z niepełnosprawnością intelektualną na weekend.",
    ["disability"],
    "1210",
    "none",
  ],
  [
    "Jestem sama z dwójką dzieci z niepełnosprawnością i nie mam jak pójść nawet do lekarza.",
    ["disability", "family"],
    "1211",
    "none",
  ],
  [
    "Kto zajmie się dorosłym synem z niepełnosprawnością, kiedy ja trafię do szpitala?",
    ["disability"],
    "1207",
    "low",
  ],
  [
    "Syn niedowidzi i potrzebuje pomocy w nauce samodzielnego poruszania się po mieście.",
    ["disability"],
    "1261",
    "match",
  ],
  [
    "Szukam pomocy dla dziecka ze spektrum autyzmu w szkole.",
    ["disability", "family"],
    "1262",
    "match",
  ],
  [
    "Głucha osoba z rodziny nie może się dogadać w urzędzie.",
    ["disability"],
    "1206",
    "match",
  ],
  [
    "Osoba na wózku nie wjedzie do domu kultury, nie ma podjazdu.",
    ["disability"],
    "1213",
    "match",
  ],
  [
    "Nasz ośrodek szuka pomocy dydaktycznych dla uczniów z niepełnosprawnością intelektualną.",
    ["disability"],
    "1205",
    "match",
  ],
  [
    "Nastolatek zamknął się w pokoju i nie chodzi do szkoły. Nie wiemy, jak mu pomóc.",
    ["family", "mental_health"],
    "1209",
    "match",
  ],
  [
    "Rodzina zastępcza potrzebuje wsparcia, dzieci są po trudnych przejściach.",
    ["family"],
    "1216",
    "match",
  ],
  [
    "Szukamy zajęć po szkole dla dzieci z rodzin w trudnej sytuacji.",
    ["family", "poverty"],
    "1203",
    "match",
  ],
  [
    "Młodzi rodzice nie radzą sobie z noworodkiem, a do najbliższej poradni jest daleko.",
    ["family"],
    "1205",
    "match",
  ],
  [
    "Dziecko po leczeniu psychiatrycznym wraca do szkoły, a klasa nie wie, jak się zachować.",
    ["family", "mental_health"],
    "1261",
    "match",
  ],
  [
    "Mąż od miesięcy ma depresję i nie chce iść do lekarza. Co mogę zrobić?",
    ["mental_health"],
    "1218",
    "match",
  ],
  [
    "Młodzież w naszej gminie nie ma gdzie porozmawiać z psychologiem, kolejki są na pół roku.",
    ["mental_health", "family"],
    "1202",
    "match",
  ],
  [
    "Po śmierci żony tata przestał wychodzić z domu i ciągle płacze.",
    ["mental_health", "seniors"],
    "1203",
    "match",
  ],
  [
    "Szukam grupy wsparcia dla osób z zaburzeniami lękowymi blisko domu.",
    ["mental_health"],
    "1262",
    "match",
  ],
  [
    "Pan z naszej wsi śpi w altance na działkach, a zbliża się zima.",
    ["homelessness"],
    "1263",
    "match",
  ],
  [
    "Osoba w kryzysie bezdomności chce wrócić do pracy, ale nikt jej nie zatrudni.",
    ["homelessness", "poverty"],
    "1261",
    "match",
  ],
  [
    "Po wyjściu z noclegowni nie ma żadnego wsparcia w znalezieniu mieszkania.",
    ["homelessness"],
    "1262",
    "match",
  ],
  [
    "Starszego pana nie stać na opał na zimę, mieszka w starym domu.",
    ["poverty", "seniors"],
    "1205",
    "match",
  ],
  [
    "Długo bezrobotny sąsiad chciałby dorobić, ale nie da rady pracować na etacie.",
    ["poverty"],
    "1261",
    "match",
  ],
  [
    "Rodziny w naszej wsi nie mają dostępu do taniej żywności, najbliższy sklep jest daleko.",
    ["poverty"],
    "1214",
    "match",
  ],
  [
    "Rodzina z Ukrainy nie zna polskiego, dzieci mają kłopoty w szkole.",
    ["migrants", "family"],
    "1206",
    "match",
  ],
  [
    "Cudzoziemcy pracujący w zakładzie nie rozumieją pism z urzędu.",
    ["migrants"],
    "1213",
    "match",
  ],
  [
    "Szukamy wieczornego kursu polskiego dla dorosłych cudzoziemców.",
    ["migrants"],
    "1261",
    "match",
  ],
  [
    "Mamy z Ukrainy nie mają z kim zostawić małych dzieci, żeby pójść do pracy.",
    ["migrants", "family"],
    "1219",
    "match",
  ],
  [
    "Na specjalistę czeka się rok, a dojazd do Krakowa trwa dwie godziny.",
    ["health"],
    "1211",
    "match",
  ],
  [
    "Po wyjściu ze szpitala nie ma kto pomóc przy opatrunkach w domu.",
    ["health", "seniors"],
    "1209",
    "match",
  ],
  [
    "W gminie brakuje profilaktyki zdrowotnej dla starszych mieszkańców.",
    ["health", "seniors"],
    "1201",
    "match",
  ],
  [
    "Chorzy przewlekle na wsiach nie mają jak dojechać na badania kontrolne.",
    ["health"],
    "1215",
    "none",
  ],
  [
    "Samotna sąsiadka nie ma do kogo zadzwonić, gdy w nocy źle się czuje.",
    ["seniors"],
    "1217",
    "match",
  ],
  [
    "Potrzebujemy pomysłu na zajęcia w klubie seniora, coś więcej niż kawa i ciasto.",
    ["seniors"],
    "1202",
    "match",
  ],
  [
    "Osoby z niepełnosprawnością ruchową z naszej wsi nie mają jak dojechać na warsztaty terapii.",
    ["disability"],
    "1216",
    "match",
  ],
  [
    "Starsi ludzie w bloku nie umieją zamówić zakupów przez internet.",
    ["seniors"],
    "1262",
    "match",
  ],
  [
    "Dziecko z niepełnosprawnością sensoryczną potrzebuje pomocy na lekcjach wychowania fizycznego.",
    ["disability", "family"],
    "1203",
    "match",
  ],
  [
    "Opiekunka babci rezygnuje, a nie stać nas na prywatną opiekę.",
    ["seniors", "poverty"],
    "1210",
    "match",
  ],
  [
    "Mieszkańcy górskich przysiółków nie mają zimą dostępu do żadnych zajęć.",
    ["seniors"],
    "1217",
    "match",
  ],
  [
    "Rodzicom dzieci z niepełnosprawnością brakuje w powiecie grupy wsparcia i chwili oddechu.",
    ["disability", "family"],
    "1207",
    "none",
  ],
  [
    "Senior po złamaniu nogi nie może sam wyjść z domu po zakupy.",
    ["seniors"],
    "1219",
    "match",
  ],
  [
    "W szkole jest kilku uczniów z Ukrainy, nauczyciele nie wiedzą, jak ich włączyć.",
    ["migrants", "family"],
    "1218",
    "match",
  ],
  [
    "Starsze małżeństwo żyje w zimnym domu i wstydzi się poprosić o pomoc.",
    ["poverty", "seniors"],
    "1204",
    "match",
  ],
  [
    "Chłopak po opuszczeniu domu dziecka nie ma gdzie mieszkać ani kogo poprosić o radę.",
    ["family", "homelessness"],
    "1206",
    "match",
  ],
  [
    "Kobieta, która słabo widzi, chce pracować, ale nie wie, od czego zacząć.",
    ["disability", "poverty"],
    "1212",
    "match",
  ],
  [
    "W wakacje nie ma dowozu dzieci z niepełnosprawnością na zajęcia rehabilitacyjne.",
    ["disability", "family"],
    "1210",
    "match",
  ],
  [
    "Seniorzy z sąsiednich wsi chcą się spotykać, ale nie mają jak dojechać do klubu.",
    ["seniors"],
    "1214",
    "none",
  ],
];

const sampleId = (i: number) =>
  `5a3e0000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;

/** First gmina of each powiat (data/gminas.json), so runs carry a realistic gmina code. */
function gminaByPowiat(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync("data/gminas.json")) return map;
  const gminas = JSON.parse(readFileSync("data/gminas.json", "utf8")) as {
    teryt: string;
    powiatTeryt: string;
  }[];
  for (const g of gminas)
    if (!map.has(g.powiatTeryt)) map.set(g.powiatTeryt, g.teryt);
  return map;
}

const userTerms = (text: string) =>
  [...new Set(text.toLowerCase().match(/\p{L}{7,}/gu) ?? [])].slice(0, 2);

/** Seeds the sample runs. Safe to run again. */
export async function seedSampleNeeds(): Promise<void> {
  const cards = await db
    .select({ id: innovations.id, mapaAreas: innovations.mapaAreas })
    .from(innovations)
    .where(eq(innovations.status, "published"));
  const cardsIn = (area: MapaArea) =>
    cards.filter((c) => c.mapaAreas.includes(area)).map((c) => c.id);
  const gminas = gminaByPowiat();
  const now = Date.now();

  // Replace, not merge: earlier sample runs (any version of this list) go first.
  await db.delete(matchRuns).where(eq(matchRuns.isSample, true));

  for (const [i, [text, areas, powiat, outcome]] of SAMPLE_NEEDS.entries()) {
    const day = (i * 13) % 30;
    const at = new Date(now - day * 86_400_000);
    at.setUTCHours(6 + ((i * 5) % 12), (i * 17) % 60, 0, 0);
    const pool = cardsIn(areas[0]!);
    const results =
      outcome === "none"
        ? []
        : pool
            .slice(
              i % Math.max(1, pool.length - 3),
              (i % Math.max(1, pool.length - 3)) + (outcome === "low" ? 1 : 3),
            )
            .map((cardId, k) => {
              const score = outcome === "low" ? 14 : 78 - k * 12;
              return {
                cardId,
                score,
                normScore: score / 100,
                matchedUserTerms: userTerms(text),
                matchedCardTerms: [],
              };
            });
    const row = {
      queryRedacted: text,
      gminaTeryt: gminas.get(powiat) ?? null,
      powiatTeryt: powiat,
      areas,
      // Same shape the matcher stores (StoredKeyword v1, src/server/match/core.ts).
      keywordResult: {
        v: 1,
        hits: results,
        detectedAreas: areas,
        isLowConfidence: outcome !== "match",
        userTerms: results.length ? userTerms(text) : [],
      },
      aiResult: null,
      status:
        outcome === "none" ? ("abstained" as const) : ("keyword" as const),
      crisis: false,
      abstained: outcome === "none",
      isSample: true,
      createdAt: at,
    };
    await db.insert(matchRuns).values({ id: sampleId(i), ...row });
  }
  const unmet = SAMPLE_NEEDS.filter(([, , , o]) => o !== "match").length;
  console.log(
    `[seed] sample needs: ${SAMPLE_NEEDS.length} runs (isSample), ${unmet} without a confident match`,
  );
}
