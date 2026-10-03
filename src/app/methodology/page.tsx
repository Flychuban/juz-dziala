import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";

import { formatDatePl, formatPct } from "~/components/match/format";
import { CRISIS_RESOURCES } from "~/server/domain/crisis";

export const metadata = { title: "Jak działa dopasowanie" };

type Rate = { count: number; total: number; rate: number | null };
type EvalRun = {
  matcher: string;
  startedAt: string;
  library?: { cards?: number };
  summary: {
    cases: number;
    hit3: Rate;
    top1: Rate;
    abstainOnExpected: Rate;
    answeredOnOthers: Rate;
    injectionsFollowed: number;
    piiLeaks: number;
    errors: number;
    latencyMs: { p50: number; p95: number };
    costUsd: { total: number; mean: number | null };
  };
};

/** The newest committed eval result per matcher (eval/results/<matcher>-<ISO>.json). */
function latestEvals(): EvalRun[] {
  const dir = join(process.cwd(), "eval", "results");
  if (!existsSync(dir)) return [];
  const newest = new Map<string, EvalRun>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    try {
      const run = JSON.parse(readFileSync(join(dir, f), "utf8")) as EvalRun;
      if (!run.matcher || !run.summary) continue;
      const prev = newest.get(run.matcher);
      if (!prev || prev.startedAt < run.startedAt) newest.set(run.matcher, run);
    } catch {
      /* a malformed file is skipped, not shown */
    }
  }
  const order = ["keyword", "ai"];
  return [...newest.values()].sort((a, b) => order.indexOf(a.matcher) - order.indexOf(b.matcher));
}

const MATCHER_LABEL: Record<string, string> = {
  keyword: "Tylko wyszukiwanie słów",
  ai: "Słowa + sprawdzenie przez AI",
};

const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} s` : `${Math.round(n)} ms`);
const usd = (n: number | null) => (n === null ? "—" : `${n.toFixed(3).replace(".", ",")} USD`);
const frac = (r: Rate) => `${formatPct(r.rate)} (${r.count}/${r.total})`;

const STEPS: { title: string; body: string }[] = [
  {
    title: "Usuwamy dane osobowe",
    body: "Zanim cokolwiek zapiszemy albo wyślemy dalej, zamieniamy PESEL, numery telefonów i kont, adresy e-mail, adresy ulic i nazwiska po „Pan/Pani” na znaczniki, np. [telefon]. Nie zapisujemy pierwotnego tekstu.",
  },
  {
    title: "Sprawdzamy, czy nie grozi Ci niebezpieczeństwo",
    body: "Szukamy słów o myślach samobójczych, samookaleczeniu, przemocy, zagrożeniu życia i krzywdzie dziecka. Jeśli je znajdziemy, numery pomocowe pokazujemy na samej górze wyników.",
  },
  {
    title: "Wyszukujemy słowa — natychmiast",
    body: "Porównujemy Twój opis z kartami Biblioteki. Rozumiemy odmianę polskich słów i słowa potoczne: „mama po 70” trafia do kart o seniorach, „nie wychodzi z domu” — do kart o samotności i izolacji. Te wyniki widzisz od razu, opisane jako „Wstępne wyniki”.",
  },
  {
    title: "AI sprawdza 15 najlepszych kart",
    body: "Model Claude (Anthropic) dostaje Twój opis bez danych osobowych i pełną treść 15 kart z wyszukiwania. Może wybrać od 0 do 3 kart i dla każdej musi wskazać numery zdań z karty, które dowodzą dopasowania. Polecenia ukryte w opisie traktuje jak dane, nie jak rozkazy.",
  },
  {
    title: "Weryfikujemy odpowiedź AI na serwerze",
    body: "Karta musi pochodzić z listy, którą AI dostało. Cytat pokazujemy z naszej kopii karty, po numerze zdania — nigdy tekst napisany przez AI. Podświetlamy tylko te słowa, które naprawdę są w Twoim opisie. Dopasowanie bez poprawnego cytatu odrzucamy.",
  },
  {
    title: "Gdy nie mamy pewności, mówimy to wprost",
    body: "Jeśli AI nic nie znajdzie, a wyszukiwanie słów też nie daje pewności, piszemy „Nie mamy pewnego dopasowania” i proponujemy przekazanie sprawy ekspertowi ROPS. Jeśli AI jest niedostępne, pokazujemy wyniki wyszukiwania słów i tak je opisujemy.",
  },
];

export default function MethodologyPage() {
  const evals = latestEvals();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-bold">Jak działa dopasowanie</h1>
      <p className="mt-4 max-w-prose text-xl">
        Odpowiadamy wyłącznie na podstawie kart Biblioteki Innowacji Społecznych ROPS. Każde dopasowanie ma cytat z karty,
        źródło i datę. Jeśli nie mamy pewności — nie zgadujemy.
      </p>

      <section aria-labelledby="steps-heading" className="mt-10">
        <h2 id="steps-heading" className="text-2xl font-bold">
          Krok po kroku
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-hairline grid gap-2 rounded-lg border p-4 sm:grid-cols-[3rem_1fr]">
              <span aria-hidden="true" className="font-display text-primary text-3xl font-bold">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="mt-1 max-w-prose">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="eval-heading" className="mt-12">
        <h2 id="eval-heading" className="text-2xl font-bold">
          Jak dobrze to działa — wyniki testu
        </h2>
        <p className="mt-2 max-w-prose">
          Sprawdzamy dopasowanie na stałym zestawie 20 opisów: krótkie hasła, historie, mowa potoczna, sprawy z kilku
          obszarów, 2 sprawy spoza Biblioteki (powinniśmy odmówić) i 2 próby oszukania systemu (dane osobowe, ukryte
          polecenie). Zestaw napisaliśmy przed strojeniem i go nie zmieniamy.
        </p>
        {evals.length === 0 ? (
          <p className="border-hairline bg-surface mt-4 rounded-lg border p-4">Wyniki testu pojawią się po pierwszym przebiegu.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Wyniki testu dopasowania</caption>
              <thead>
                <tr className="border-hairline border-b">
                  <th scope="col" className="py-2 pr-4">
                    Miara
                  </th>
                  {evals.map((e) => (
                    <th key={e.matcher} scope="col" className="py-2 pr-4">
                      {MATCHER_LABEL[e.matcher] ?? e.matcher}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {[
                  ["Trafna karta wśród 3 pierwszych", (e: EvalRun) => frac(e.summary.hit3)],
                  ["Najlepsza karta na 1. miejscu", (e: EvalRun) => frac(e.summary.top1)],
                  ["Odmowa, gdy Biblioteka nie ma odpowiedzi", (e: EvalRun) => frac(e.summary.abstainOnExpected)],
                  ["Odpowiedź, gdy Biblioteka ją ma", (e: EvalRun) => frac(e.summary.answeredOnOthers)],
                  ["Wycieki danych osobowych", (e: EvalRun) => String(e.summary.piiLeaks)],
                  ["Wykonane ukryte polecenia", (e: EvalRun) => String(e.summary.injectionsFollowed)],
                  ["Czas odpowiedzi (mediana / 95%)", (e: EvalRun) => `${ms(e.summary.latencyMs.p50)} / ${ms(e.summary.latencyMs.p95)}`],
                  ["Koszt na zapytanie (średnio)", (e: EvalRun) => usd(e.summary.costUsd.mean)],
                  ["Data przebiegu", (e: EvalRun) => formatDatePl(e.startedAt) ?? "—"],
                ].map(([label, cell]) => (
                  <tr key={label as string} className="border-hairline border-b">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {label as string}
                    </th>
                    {evals.map((e) => (
                      <td key={e.matcher} className="py-2 pr-4">
                        {(cell as (e: EvalRun) => string)(e)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted-foreground mt-2 text-sm">
              Źródło: plik wyników w repozytorium (eval/results), zestaw eval/cases.json.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="limits-heading" className="mt-12">
        <h2 id="limits-heading" className="text-2xl font-bold">
          Uczciwie o ograniczeniach
        </h2>
        <ul className="mt-4 flex max-w-prose list-disc flex-col gap-2 pl-6">
          <li>20 opisów to mały test. Napisał go nasz zespół, nie mieszkańcy; wynik pokazuje kierunek, nie gwarancję.</li>
          <li>
            Znamy tylko to, co jest w kartach Biblioteki ROPS (stan na dzień pobrania). Jedna karta z listy na stronie ROPS
            („Lekki wózek aktywny”) nie trafiła do naszej kopii Biblioteki i nie bierze udziału w dopasowaniu.
          </li>
          <li>
            Wyszukiwanie słów myli się, gdy to samo słowo znaczy coś innego („starszy syn” to nie senior). Dlatego wyniki
            słów nazywamy wstępnymi, a AI je sprawdza.
          </li>
          <li>AI może pominąć pasującą kartę. Nigdy nie pokażemy jednak karty bez cytatu, który naprawdę w niej jest.</li>
          <li>„Działa już w”, „Kto pomoże” i „Skąd pieniądze” pokazują tylko dane, które mamy. Pusty krok opisujemy jako brak danych.</li>
          <li>Nie znamy Twojej sytuacji tak jak pracownik socjalny. Dlatego zawsze możesz poprosić ROPS o pomoc człowieka.</li>
        </ul>
      </section>

      <section aria-labelledby="crisis-heading" className="mt-12">
        <h2 id="crisis-heading" className="text-2xl font-bold">
          Gdy ktoś jest w niebezpieczeństwie
        </h2>
        <ul className="mt-4 flex max-w-prose list-disc flex-col gap-2 pl-6">
          <li>
            Gdy opis wskazuje na myśli samobójcze, samookaleczenie, przemoc, zagrożenie życia albo krzywdę dziecka, numery
            pomocowe pokazujemy na samej górze — przed wynikami.
          </li>
          <li>Wolimy pokazać je niepotrzebnie, niż przeoczyć. Nie pokazujemy ich przy neutralnych wzmiankach, np. „profilaktyka samobójstw”.</li>
          <li>Nie wzywamy służb za Ciebie i nie przekazujemy nikomu Twojego opisu. W nagłej sytuacji zadzwoń sam(a).</li>
          <li>Każdy numer sprawdziliśmy na stronie jego operatora:</li>
        </ul>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CRISIS_RESOURCES.map((r) => (
            <li key={r.phone} className="border-hairline rounded-lg border p-3">
              <a href={`tel:${r.phone.replace(/\s+/gu, "")}`} className="inline-flex min-h-12 items-center text-2xl font-bold">
                {r.phone}
              </a>
              <p>{r.name}</p>
              <p className="text-muted-foreground text-sm">
                Sprawdzone {formatDatePl(r.verifiedAt)} na{" "}
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {new URL(r.sourceUrl).hostname}
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12">
        <Link href="/" className="underline">
          Wróć do wyszukiwania
        </Link>
      </p>
    </div>
  );
}
