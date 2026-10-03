/**
 * Learning resources → data/learn.json
 *
 *   pnpm exec tsx scripts/build-learn.ts
 *
 * Every URL is fetched (GET, robots.txt respected, archived) and must answer HTTP 200 after
 * redirects, and must be what it claims to be: a PDF must start with %PDF, an HTML page must
 * contain the expected phrase. A resource that fails is dropped from the file and listed in the
 * console output — it is never published unchecked.
 */
import { politeFetch, writeJson } from "./lib/http";
import { Learn, type LearnItem } from "./schemas";

type Candidate = Omit<LearnItem, "checkedAt" | "httpStatus"> & { expect: string | RegExp };

const CANDIDATES: Candidate[] = [
  {
    title: "Mapa Wyzwań Społecznych",
    kind: "raport",
    url: "https://rops.krakow.pl/mpliki/IS/IWS_20/za._nr_2._Mapa_Wyzwa_Spoecznych.pdf",
    description: "Osiem obszarów wyzwań społecznych z definicjami, danymi ogólnopolskimi, kluczowymi wyzwaniami i personami, opracowane przez ROPS w listopadzie 2024 r.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "%PDF",
  },
  {
    title: "Social Innovation Canvas (wersja 1.0)",
    kind: "narzędzie",
    url: "https://rops.krakow.pl/mpliki/IS/Moj_folder/INNO_AGH_-_SOCIAL_CANVAS.pdf",
    description: "Trzy arkusze do rozpisania pomysłu na innowację: problem, aktorzy zmiany, rozwiązanie, koszty, odbiorcy, źródła dochodów, propozycja wartości, kanały, partnerzy i wpływ.",
    publisher: "INNO AGH",
    expect: "%PDF",
  },
  {
    title: "Procedury realizacji projektu grantowego „Inkubator Włączenia Społecznego 2.0”",
    kind: "przewodnik",
    url: "https://rops.krakow.pl/mpliki/IS/IWS_20/za._1._PROCEDURY_REALIZACJI_PROJEKTU_GRANTOWEGO_IWS_2.0.pdf",
    description: "Zasady naboru, oceny formalnej, merytorycznej i strategicznej oraz rozliczania grantów na opracowanie i testowanie innowacji społecznych w IWS 2.0.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "%PDF",
  },
  {
    title: "Wzór formularza aplikacyjnego IWS 2.0",
    kind: "narzędzie",
    url: "https://rops.krakow.pl/mpliki/IS/IWS_20/za._3._Formularz_aplikacyjny_wzor.pdf",
    description: "Pytania, na które odpowiada pomysłodawca innowacji ubiegający się o grant: od opisu i innowacyjności po plan działania, koszty i zespół.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "%PDF",
  },
  {
    title: "Wzór karty oceny merytorycznej IWS 2.0",
    kind: "przewodnik",
    url: "https://rops.krakow.pl/mpliki/IS/IWS_20/za._5._Karta_Oceny_merytorycznej_wzor.pdf",
    description: "Pięć kryteriów oceny wniosku (po 0–10 pkt) i progi punktowe, które musi spełnić pomysł, by przejść dalej.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "%PDF",
  },
  {
    title: "Granty na innowacje społeczne — nabory ROPS",
    kind: "przewodnik",
    url: "https://rops.krakow.pl/nabory-szkolenia-granty-dotacje-wizyty-studyjne-studia-specjalizacje-superwizje/granty-na-innowacje-spoleczne",
    description: "Lista naborów ROPS na granty dla innowacji społecznych wraz z terminami, dokumentami i formularzami.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "GRANTY NA INNOWACJE",
  },
  {
    title: "Biblioteka Innowacji Społecznych",
    kind: "dane",
    url: "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/kategorie",
    description: "Przetestowane innowacje społeczne z małopolskich inkubatorów, pogrupowane według grup odbiorców, z materiałami do pobrania.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "innowacje dla",
  },
  {
    title: "Obserwator Statystyk Społecznych",
    kind: "dane",
    url: "https://obserwator.rops.krakow.pl/",
    description: "Serwis z danymi i analizami o sytuacji społecznej w Małopolsce, prowadzony przez ROPS w Krakowie.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: /obserwator/i,
  },
  {
    title: "Bank Danych Lokalnych GUS",
    kind: "dane",
    url: "https://bdl.stat.gov.pl/bdl/start",
    description: "Oficjalne dane statystyczne dla gmin, powiatów i województw, m.in. o ludności według wieku.",
    publisher: "Główny Urząd Statystyczny",
    expect: /Bank Danych Lokalnych/i,
  },
  {
    title: "Kanał ROPS Kraków w serwisie YouTube",
    kind: "film",
    url: "https://www.youtube.com/channel/UC4KEW7FaoODgDKLxbUwhnVw",
    description: "Nagrania konferencji, gal i materiały filmowe Regionalnego Ośrodka Polityki Społecznej w Krakowie.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: "UC4KEW7FaoODgDKLxbUwhnVw",
  },
  {
    title: "Deklaracja dostępności ROPS w Krakowie",
    kind: "przewodnik",
    url: "https://rops.krakow.pl/deklaracja-dostepnosci",
    description: "Przykład deklaracji dostępności instytucji publicznej — wzór dla innowatorów, którzy muszą zadbać o dostępność cyfrową i architektoniczną.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: /deklaracja dostępności/i,
  },
  {
    title: "Standardy tworzenia dostępnych dokumentów, treści, multimediów i wydarzeń on-line w ROPS w Krakowie",
    kind: "przewodnik",
    url: "https://rops.krakow.pl/dzial-publikacje/standardy-tworzenia-dostepnych-dokumentow-tresci-multimediow-i-wydarzen-on-line-w-rops-w-krakowie-2022-2",
    description: "Praktyczne zasady przygotowania dostępnych dokumentów, materiałów multimedialnych i wydarzeń online.",
    publisher: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    expect: /Standardy tworzenia dostępnych/i,
  },
  {
    title: "Lista innowacji społecznych — innowacjespoleczne.pl",
    kind: "dane",
    url: "https://innowacjespoleczne.pl/innowacje-spoleczne/lista-innowacji/",
    description: "Ogólnopolska baza innowacji społecznych przetestowanych w inkubatorach finansowanych z funduszy europejskich.",
    publisher: "innowacjespoleczne.pl",
    expect: /innowac/i,
  },
  {
    title: "EU Social Innovation Match",
    kind: "dane",
    url: "https://european-social-fund-plus.ec.europa.eu/en/social-innovation-match",
    description: "Europejska baza sprawdzonych innowacji społecznych, która pomaga znaleźć rozwiązania z innych krajów UE i partnerów do ich przeniesienia.",
    publisher: "Komisja Europejska (Europejski Fundusz Społeczny Plus)",
    expect: /Social Innovation Match/i,
  },
];

async function main() {
  const ok: LearnItem[] = [];
  const failed: string[] = [];
  for (const c of CANDIDATES) {
    try {
      const r = await politeFetch(c.url, { allowError: true });
      const head = r.body.subarray(0, 4).toString("latin1");
      const text = r.body.toString("utf8");
      const matches = typeof c.expect === "string" ? (c.expect === "%PDF" ? head === "%PDF" : text.includes(c.expect)) : c.expect.test(text);
      if (r.status !== 200) failed.push(`${c.url} — HTTP ${r.status}`);
      else if (!matches) failed.push(`${c.url} — odpowiedź nie zawiera „${String(c.expect)}"`);
      else {
        const { expect: _expect, ...item } = c;
        ok.push({ ...item, checkedAt: r.capturedAt, httpStatus: r.status! });
      }
    } catch (e) {
      failed.push(`${c.url} — ${(e as Error).message}`);
    }
  }
  writeJson("data/learn.json", Learn.parse(ok));
  console.log(`learn.json: ${ok.length} zasobów sprawdzonych (HTTP 200)`);
  for (const f of failed) console.log(`  pominięto: ${f}`);
}

await main();
