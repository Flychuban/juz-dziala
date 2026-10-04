"use client";

import {
  ArrowRightIcon,
  FileTextIcon,
  LayoutGridIcon,
  PrinterIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { PlanMarkdown } from "~/components/adapt/plan-markdown";
import { Highlight, SourceLine, UserTerms } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { useLabels } from "~/i18n/use-labels";
import type { CaseKind } from "~/lib/domain";
import type { MatchContext } from "~/server/cases/match-context";
import type { CasePayloads } from "~/server/cases/payloads";
import { fmtDate } from "./format";

/**
 * Module payloads inside a case, shared by the author page and the staff
 * workspace: the Ramowy Plan Wdrożenia (adapt), the idea's fiszka and IWS
 * self-score (+ Canvas and application for staff), the innovation a test or
 * opinion is about, and — staff only — what the resident was shown by the
 * matcher, with their own words and the card quotes.
 */

const box = "border-hairline rounded-lg border p-4";

const withToken = (path: string, token?: string) =>
  token ? `${path}?t=${encodeURIComponent(token)}` : path;

/**
 * The plan is a document in its own language (`plan.locale`): its answers,
 * source and text are shown in it — marked with `lang` when the page is in
 * the other language (WCAG 3.1.2); the row names follow the page.
 */
export function PlanSection({
  plan,
  code,
  defaultOpen = false,
}: {
  plan: NonNullable<CasePayloads["plan"]>;
  code: string;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("cases.modules");
  const locale = useLocale();
  const planLang = plan.locale !== locale ? plan.locale : undefined;
  return (
    <section aria-labelledby="plan-heading" className={box}>
      <h2 id="plan-heading" className="text-xl font-bold">
        {t("plan.heading")}
      </h2>
      <dl className="mt-3 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        {plan.details.map((d) => (
          <div key={d.key} className="contents">
            <dt className="text-muted-foreground">
              {t(`plan.detail.${d.key}`)}
            </dt>
            <dd className="break-words" lang={planLang}>
              {d.value}
            </dd>
          </div>
        ))}
        {plan.modeLabel && (
          <>
            <dt className="text-muted-foreground">{t("plan.madeWith")}</dt>
            <dd lang={planLang}>{plan.modeLabel}</dd>
          </>
        )}
        {plan.submittedAt && (
          <>
            <dt className="text-muted-foreground">{t("plan.sentToRops")}</dt>
            <dd>{fmtDate(plan.submittedAt, locale)}</dd>
          </>
        )}
      </dl>
      {plan.ramowyPlan && (
        <p className="mt-3">
          {t("plan.ropsHasPlan", { call: plan.ramowyPlan.callName })}
          {plan.ramowyPlan.sourceUrl && (
            <>
              {" "}
              <a
                href={plan.ramowyPlan.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("plan.callNotice")}
                <span className="sr-only"> {t("newTab")}</span>
              </a>
            </>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3" data-no-print>
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
        >
          <Link href={`/case/${code}/plan`}>
            <PrinterIcon aria-hidden="true" />
            {t("plan.print")}
          </Link>
        </Button>
      </div>
      <details className="mt-4" open={defaultOpen}>
        <summary className="min-h-12 cursor-pointer py-2 font-semibold underline">
          {t("plan.showAll")}
        </summary>
        <div lang={planLang}>
          <PlanMarkdown markdown={plan.markdown} className="mt-2" />
        </div>
      </details>
    </section>
  );
}

export function IdeaSection({
  idea,
  call,
  code,
  viewer,
  token,
}: {
  idea: NonNullable<CasePayloads["idea"]>;
  call: CasePayloads["call"];
  code: string;
  viewer: "author" | "staff";
  token?: string;
}) {
  const t = useTranslations("cases.modules");
  const locale = useLocale();
  const labels = useLabels();
  const s = idea.selfScore;
  return (
    <section aria-labelledby="idea-heading" className={box}>
      <h2 id="idea-heading" className="text-xl font-bold">
        {t("idea.heading")}
      </h2>
      <dl className="mt-3 flex flex-col gap-3">
        <div>
          <dt className="text-muted-foreground font-semibold">
            {t("idea.name")}
          </dt>
          <dd className="break-words">{idea.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">
            {t("idea.what")}
          </dt>
          <dd className="break-words whitespace-pre-wrap">
            {idea.description}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">
            {t("idea.forWhom")}
          </dt>
          <dd className="break-words whitespace-pre-wrap">
            {idea.targetGroup || t("idea.notGiven")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-semibold">
            {t("idea.stage")}
          </dt>
          <dd>
            {idea.stage ? labels.ideaStage[idea.stage] : t("idea.notGiven")}
          </dd>
        </div>
        {idea.areas.length > 0 && (
          <div>
            <dt className="text-muted-foreground font-semibold">
              {t("idea.area")}
            </dt>
            <dd>{idea.areas.map((a) => labels.area[a]).join(", ")}</dd>
          </div>
        )}
      </dl>

      {s && s.items.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold">{t("idea.score.heading")}</h3>
          <p className="text-muted-foreground text-sm">
            {t("idea.score.note")}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <caption className="sr-only">{t("idea.score.caption")}</caption>
              <thead className="border-hairline border-b">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {t("idea.score.criterion")}
                  </th>
                  <th scope="col" className="px-3 py-2 tabular-nums">
                    {t("idea.score.points")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("idea.score.why")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("idea.score.improve")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((it) => {
                  const below = it.minToPass != null && it.score < it.minToPass;
                  return (
                    <tr
                      key={it.key}
                      className="border-hairline border-t align-top"
                    >
                      <th scope="row" className="px-3 py-2 font-semibold">
                        {it.label}
                      </th>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {it.score} / {it.max}
                        {it.minToPass != null && (
                          <span className="block text-sm">
                            {t("idea.score.min", { n: it.minToPass })}
                            {below && (
                              <span className="text-destructive font-semibold">
                                {" "}
                                {t("idea.score.below")}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{it.reason}</td>
                      <td className="px-3 py-2">{it.improve}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-hairline border-t font-semibold">
                  <th scope="row" className="px-3 py-2">
                    {t("idea.score.total")}
                  </th>
                  <td className="px-3 py-2 tabular-nums" colSpan={3}>
                    {s.total} / {s.max}
                    {s.minScore != null &&
                      ` ${t("idea.score.callMin", { n: s.minScore })}`}
                    {" — "}
                    {s.meetsMinimum
                      ? t("idea.score.meets")
                      : t("idea.score.notYet")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {idea.similar.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold">{t("idea.similar")}</h3>
          <ul className="mt-1 list-disc pl-6">
            {idea.similar.map((x) => (
              <li key={x.innovationId}>
                <Link href={`/library/${x.slug}`}>{x.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(idea.application ?? call) && (
        <p className="mt-5">
          <span className="font-semibold">{t("idea.applied")}</span>{" "}
          {idea.application?.callName ?? call?.name}
          {idea.application &&
            ` (${fmtDate(idea.application.submittedAt, locale)})`}
        </p>
      )}

      {viewer === "author" ? (
        <div className="mt-5 flex flex-wrap gap-3" data-no-print>
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
          >
            <Link href={withToken(`/ideas/${code}/canvas`, token)}>
              <LayoutGridIcon aria-hidden="true" />
              {idea.hasCanvas ? t("idea.yourCanvas") : t("idea.startCanvas")}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
          >
            <Link href={withToken(`/ideas/${code}/application`, token)}>
              <FileTextIcon aria-hidden="true" />
              {idea.application
                ? t("idea.yourApplication")
                : t("idea.startApplication")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {idea.canvas && idea.canvas.length > 0 && (
            <details className="mt-5">
              <summary className="min-h-12 cursor-pointer py-2 font-semibold underline">
                {t("idea.canvasPreview")}
              </summary>
              <dl className="mt-2 flex flex-col gap-3">
                {idea.canvas.map((c) => (
                  <div key={`${c.sheet}-${c.section}`}>
                    <dt className="font-semibold">
                      {c.section}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {c.sheet}
                      </span>
                    </dt>
                    {c.lines.map((l, i) => (
                      <dd key={i} className="break-words whitespace-pre-wrap">
                        {l}
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
            </details>
          )}
          {!idea.hasCanvas && (
            <p className="text-muted-foreground mt-5 text-sm">
              {t("idea.noCanvas")}
            </p>
          )}
          {idea.application?.fields && idea.application.fields.length > 0 && (
            <details className="mt-3">
              <summary className="min-h-12 cursor-pointer py-2 font-semibold underline">
                {t("idea.applicationPreview")}
              </summary>
              <dl className="mt-2 flex flex-col gap-3">
                {idea.application.fields.map((f) => (
                  <div key={f.key}>
                    <dt className="font-semibold">{f.label}</dt>
                    <dd className="break-words whitespace-pre-wrap">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      )}
    </section>
  );
}

const RATINGS = [1, 2, 3, 4, 5] as const;

export function InnovationSection({
  kind,
  innovation,
  rating,
}: {
  kind: CaseKind;
  innovation: NonNullable<CasePayloads["innovation"]>;
  rating: number | null;
}) {
  const t = useTranslations("cases.modules");
  const locale = useLocale();
  const r = RATINGS.find((x) => x === rating);
  return (
    <section aria-labelledby="innovation-heading" className={box}>
      <h2 id="innovation-heading" className="text-xl font-bold">
        {t("innovation.heading", { kind })}
      </h2>
      <p className="mt-2 text-lg font-semibold">
        <Link
          href={`/library/${innovation.slug}`}
          lang={innovation.titleLang !== locale ? innovation.titleLang : undefined}
        >
          {innovation.title}
        </Link>
      </p>
      <SourceLine
        source={t("librarySource")}
        href={innovation.sourceUrl}
        date={innovation.capturedAt}
      />
      {rating != null && (
        <p className="mt-3">
          <span className="font-semibold">{t("innovation.rating")}</span>{" "}
          <span className="tabular-nums">{rating} / 5</span>
          {r ? ` — ${t(`innovation.ratingLabel.${r}`)}` : null}
        </p>
      )}
    </section>
  );
}

/** Staff: what the resident saw before asking for help. */
export function MatchSection({ match }: { match: MatchContext }) {
  const t = useTranslations("cases.modules");
  const locale = useLocale();
  const labels = useLabels();
  return (
    <section aria-labelledby="match-heading" className={box}>
      <h2 id="match-heading" className="text-xl font-bold">
        {t("match.heading")}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {t("match.searched", {
          date: fmtDate(match.createdAt, locale),
          stage: t(`match.stage.${match.stage}`),
        })}
      </p>
      <blockquote className="border-hairline mt-3 border-l-4 pl-3">
        <Highlight text={match.query} terms={match.userTerms} />
      </blockquote>
      {match.crisis && (
        <p className="text-destructive mt-2 font-bold">{t("match.crisis")}</p>
      )}
      {match.results.length === 0 ? (
        <p className="mt-3">{t("match.none")}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-5">
          {match.results.map((r, i) => (
            <li key={r.cardId} className="flex flex-col gap-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground tabular-nums">
                  {i + 1}.
                </span>
                <Link
                  href={`/library/${r.slug}`}
                  className="text-lg font-semibold"
                >
                  {r.title}
                </Link>
                {r.verified ? (
                  <span className="border-success text-success inline-flex items-center gap-1 rounded-sm border px-1.5 text-sm font-semibold">
                    <ShieldCheckIcon aria-hidden="true" className="size-3.5" />
                    {t("match.stage.verified")}
                  </span>
                ) : (
                  <span className="border-input rounded-sm border border-dashed px-1.5 text-sm font-semibold">
                    {t("match.preliminary")}
                  </span>
                )}
              </p>
              <p>{r.why}</p>
              <UserTerms terms={r.userTerms} label={t("match.authorWords")} />
              {r.evidence.map((e) => (
                <blockquote
                  key={e.id}
                  className="border-primary bg-surface border-l-4 px-3 py-2"
                >
                  <Highlight text={e.text} terms={r.userTerms} />
                  <footer className="text-muted-foreground mt-1 text-sm">
                    {t("match.card", { section: labels.section[e.section] })}
                  </footer>
                </blockquote>
              ))}
              {r.firstStep && (
                <p>
                  <span className="font-semibold">{t("match.firstStep")}</span>{" "}
                  {r.firstStep}
                </p>
              )}
              <SourceLine
                source={t("librarySource")}
                href={r.sourceUrl}
                date={r.capturedAt}
              />
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4">
        <Link
          href={`/match/${match.id}`}
          className="inline-flex min-h-12 items-center gap-1"
        >
          {t("match.open")}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </p>
    </section>
  );
}
