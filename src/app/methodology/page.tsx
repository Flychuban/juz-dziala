import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ExternalLink, formatDate } from "~/components/kit";
import { INTL_LOCALE } from "~/i18n/config";
import { CRISIS_RESOURCES } from "~/server/domain/crisis";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("knowledge.methodology");
  return { title: t("metaTitle") };
}

type Rate = { count: number; total: number; rate: number | null };
type EvalRun = {
  matcher: string;
  startedAt: string;
  locale?: string;
  lang?: string;
  casesFile?: string;
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

/**
 * A run is English when its file name says so (`<matcher>-en-<ISO>.json`,
 * `…-en.json`), or the run records an English locale or case set.
 */
function isEnglishRun(file: string, run: EvalRun) {
  return (
    /(^|[-_.])en([-_.]|$)/.test(file.replace(/\.json$/, "")) ||
    run.locale === "en" ||
    run.lang === "en" ||
    /cases[._-]en\b/.test(run.casesFile ?? "")
  );
}

/**
 * The newest committed eval result per matcher and language
 * (eval/results/<matcher>[-en]-<ISO>.json). Nothing is shown for a language
 * without a results file — never a placeholder number.
 */
function latestEvals(): { pl: EvalRun[]; en: EvalRun[] } {
  const dir = join(process.cwd(), "eval", "results");
  if (!existsSync(dir)) return { pl: [], en: [] };
  const newest = {
    pl: new Map<string, EvalRun>(),
    en: new Map<string, EvalRun>(),
  };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    try {
      const run = JSON.parse(readFileSync(join(dir, f), "utf8")) as EvalRun;
      if (!run.matcher || !run.summary) continue;
      // English runs are recorded as "ai-en" / "keyword-en"; the language is the bucket.
      run.matcher = run.matcher.replace(/-en$/, "");
      const bucket = isEnglishRun(f, run) ? newest.en : newest.pl;
      const prev = bucket.get(run.matcher);
      if (!prev || prev.startedAt < run.startedAt) bucket.set(run.matcher, run);
    } catch {
      /* a malformed file is skipped, not shown */
    }
  }
  const order = ["keyword", "ai"];
  const sorted = (m: Map<string, EvalRun>) =>
    [...m.values()].sort(
      (a, b) => order.indexOf(a.matcher) - order.indexOf(b.matcher),
    );
  return { pl: sorted(newest.pl), en: sorted(newest.en) };
}

const STEPS = [
  "redact",
  "crisis",
  "keywords",
  "ai",
  "verify",
  "abstain",
] as const;
const LIMITS = ["small", "copy", "words", "miss", "empty", "human"] as const;
const ROWS = [
  "hit3",
  "top1",
  "abstain",
  "answered",
  "pii",
  "injections",
  "latency",
  "cost",
  "date",
] as const;
const MATCHERS = ["keyword", "ai"] as const;
const isMatcher = (m: string): m is (typeof MATCHERS)[number] =>
  (MATCHERS as readonly string[]).includes(m);

/** English names of the helplines, by number (the Polish names come from the data). */
const CRISIS_KEY: Record<
  string,
  "emergency" | "adults" | "children" | "crisisLine"
> = {
  "112": "emergency",
  "800 70 2222": "adults",
  "116 111": "children",
  "116 123": "crisisLine",
};

type T = Awaited<ReturnType<typeof getTranslations<"knowledge.methodology">>>;

function EvalTable({
  runs,
  caption,
  t,
  locale,
}: {
  runs: EvalRun[];
  caption: string;
  t: T;
  locale: string;
}) {
  const nf = (digits: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale === "en" ? "en" : "pl"], {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const pct = new Intl.NumberFormat(
    INTL_LOCALE[locale === "en" ? "en" : "pl"],
    {
      style: "percent",
      maximumFractionDigits: 0,
    },
  );
  const frac = (r: Rate) =>
    t("fraction", {
      pct: r.rate === null ? "—" : pct.format(r.rate),
      count: r.count,
      total: r.total,
    });
  const ms = (n: number) =>
    n >= 1000
      ? t("seconds", { n: nf(1).format(n / 1000) })
      : t("millis", { n: Math.round(n) });
  const usd = (n: number | null) =>
    n === null ? "—" : t("usd", { n: nf(3).format(n) });
  const cell: Record<(typeof ROWS)[number], (e: EvalRun) => string> = {
    hit3: (e) => frac(e.summary.hit3),
    top1: (e) => frac(e.summary.top1),
    abstain: (e) => frac(e.summary.abstainOnExpected),
    answered: (e) => frac(e.summary.answeredOnOthers),
    pii: (e) => String(e.summary.piiLeaks),
    injections: (e) => String(e.summary.injectionsFollowed),
    latency: (e) =>
      `${ms(e.summary.latencyMs.p50)} / ${ms(e.summary.latencyMs.p95)}`,
    cost: (e) => usd(e.summary.costUsd.mean),
    date: (e) => formatDate(e.startedAt, locale) || "—",
  };
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-hairline border-b">
            <th scope="col" className="py-2 pr-4">
              {t("metric")}
            </th>
            {runs.map((e) => (
              <th key={e.matcher} scope="col" className="py-2 pr-4">
                {isMatcher(e.matcher) ? t(`matcher.${e.matcher}`) : e.matcher}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {ROWS.map((row) => (
            <tr key={row} className="border-hairline border-b">
              <th scope="row" className="py-2 pr-4 font-normal">
                {t(`rows.${row}`)}
              </th>
              {runs.map((e) => (
                <td key={e.matcher} className="py-2 pr-4">
                  {cell[row](e)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MethodologyPage() {
  const [t, locale] = await Promise.all([
    getTranslations("knowledge.methodology"),
    getLocale(),
  ]);
  const evals = latestEvals();
  const enCases = Math.max(0, ...evals.en.map((e) => e.summary.cases));
  const limits = locale === "en" ? [...LIMITS, "english" as const] : LIMITS;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 [overflow-wrap:anywhere]">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="mt-4 max-w-prose text-xl">{t("lead")}</p>

      <section aria-labelledby="steps-heading" className="mt-10">
        <h2 id="steps-heading" className="text-2xl font-bold">
          {t("stepsHeading")}
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className="border-hairline grid gap-2 rounded-lg border p-4 max-[22rem]:px-3 sm:grid-cols-[3rem_1fr]"
            >
              <span
                aria-hidden="true"
                className="font-display text-primary text-3xl font-bold"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold">
                  {t(`steps.${s}.title`)}
                </h3>
                <p className="mt-1 max-w-prose">{t(`steps.${s}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="eval-heading" className="mt-12">
        <h2 id="eval-heading" className="text-2xl font-bold">
          {t("evalHeading")}
        </h2>
        <p className="mt-2 max-w-prose">{t("evalLead")}</p>
        {evals.pl.length === 0 ? (
          <p className="border-hairline bg-surface mt-4 rounded-lg border p-4">
            {t("evalPending")}
          </p>
        ) : (
          <>
            <EvalTable
              runs={evals.pl}
              caption={t("evalCaption")}
              t={t}
              locale={locale}
            />
            <p className="text-muted-foreground mt-2 text-sm">
              {t("evalSource")}
            </p>
          </>
        )}

        {evals.en.length > 0 ? (
          <>
            <h3 className="mt-10 text-xl font-bold">{t("evalEnHeading")}</h3>
            <p className="mt-2 max-w-prose">
              {t("evalEnLead", { count: enCases })}
            </p>
            <EvalTable
              runs={evals.en}
              caption={t("evalEnCaption")}
              t={t}
              locale={locale}
            />
            <p className="text-muted-foreground mt-2 text-sm">
              {t("evalEnSource")}
            </p>
          </>
        ) : null}
      </section>

      <section aria-labelledby="limits-heading" className="mt-12">
        <h2 id="limits-heading" className="text-2xl font-bold">
          {t("limitsHeading")}
        </h2>
        <ul className="mt-4 flex max-w-prose list-disc flex-col gap-2 pl-6">
          {limits.map((l) => (
            <li key={l}>{t(`limits.${l}`)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="crisis-heading" className="mt-12">
        <h2 id="crisis-heading" className="text-2xl font-bold">
          {t("crisisHeading")}
        </h2>
        <ul className="mt-4 flex max-w-prose list-disc flex-col gap-2 pl-6">
          <li>{t("crisis.top")}</li>
          <li>{t("crisis.rather")}</li>
          <li>{t("crisis.noCall")}</li>
          <li>{t("crisis.checked")}</li>
        </ul>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CRISIS_RESOURCES.map((r) => {
            const key = CRISIS_KEY[r.phone];
            const english = locale === "en" && key;
            return (
              <li
                key={r.phone}
                className="border-hairline rounded-lg border p-3"
              >
                <a
                  href={`tel:${r.phone.replace(/\s+/gu, "")}`}
                  className="inline-flex min-h-12 items-center text-2xl font-bold"
                >
                  {r.phone}
                </a>
                {english ? (
                  <p>{t(`crisisName.${key}`)}</p>
                ) : (
                  <p lang={locale === "en" ? "pl" : undefined}>{r.name}</p>
                )}
                <p className="text-muted-foreground text-sm">
                  {t("crisis.verified", {
                    date: formatDate(r.verifiedAt, locale),
                  })}{" "}
                  <ExternalLink href={r.sourceUrl}>
                    {new URL(r.sourceUrl).hostname}
                  </ExternalLink>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-12">
        <Link href="/" className="underline">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
