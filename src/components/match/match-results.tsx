"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SourceLine, UserTerms } from "~/components/kit";
import { useLabels } from "~/i18n/use-labels";
import { api } from "~/trpc/react";
import { CrisisBanner } from "./crisis-banner";
import { gminaKindKey, knowledgeDetail, shortCallName } from "./format";
import { RequestHelp } from "./request-help";
import { FUNDING_ID, ResultCard, useCallWindow, type MatchViewData } from "./result-card";
import { btnPrimary, btnSecondary } from "./styles";

/** When each progress line appears while the AI check runs (ms). */
const PROGRESS = [
  { after: 0, key: "start" },
  { after: 2500, key: "compare" },
  { after: 7000, key: "quotes" },
  { after: 16000, key: "slow" },
] as const;

/** Height kept free at the bottom of the viewport while the sticky help bar is shown (phones). */
const STICKY_BAR_SPACE = "6rem";

/**
 * True while the inline help section or the site footer is on screen: the
 * sticky bar then steps aside, so it never covers the form or the footer.
 */
function useHelpTargetsVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const targets = [document.getElementById("help"), document.querySelector("footer[data-site-footer]")].filter(
      (el): el is Element => el !== null,
    );
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const shown = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) shown.add(e.target);
        else shown.delete(e.target);
      }
      setVisible(shown.size > 0);
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return visible;
}

/**
 * While the fixed bar covers the bottom of a phone screen, keep that much
 * scroll padding so a focused element is never scrolled underneath it
 * (WCAG 2.4.11).
 */
function useStickyBarScrollPadding(shown: boolean) {
  useEffect(() => {
    if (!shown || typeof window === "undefined") return;
    const phone = window.matchMedia("(max-width: 767.98px)");
    const root = document.documentElement;
    const apply = () => {
      root.style.scrollPaddingBottom = phone.matches ? STICKY_BAR_SPACE : "";
    };
    apply();
    phone.addEventListener("change", apply);
    return () => {
      phone.removeEventListener("change", apply);
      root.style.scrollPaddingBottom = "";
    };
  }, [shown]);
}

function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(t);
  }, [active]);
  return elapsed;
}

/** „Skąd wziąć pieniądze na wdrożenie" — once, under all results. */
function FundingBlock({ funding, anyListed }: { funding: MatchViewData["funding"]; anyListed: boolean }) {
  const t = useTranslations("match.funding");
  const labels = useLabels();
  const locale = useLocale();
  const callWindow = useCallWindow();
  const name = funding ? shortCallName(locale === "en" && funding.nameEn ? funding.nameEn : funding.name) : null;
  return (
    <section id={FUNDING_ID} aria-labelledby="funding-heading" className="border-hairline scroll-mt-6 rounded-lg border p-5">
      <h2 id="funding-heading" className="text-xl font-bold">
        {t("heading")}
      </h2>
      {funding ? (
        <>
          <p className="mt-2 text-lg font-semibold" lang={locale === "en" && !funding.nameEn ? "pl" : undefined}>
            {name}
          </p>
          <p className="mt-1">
            {t("general", { status: labels.callStatus[funding.status].toLowerCase(), window: callWindow(funding) })}
            {funding.status === "demo" ? ` ${t("demo")}` : ""}
          </p>
          {funding.sourceUrl && (
            <p className="mt-2">
              <a href={funding.sourceUrl} className="text-foreground inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
                {t("link")}
              </a>
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 max-w-prose">{t("none")}</p>
          <p className="mt-2">
            <Link href="/network#nabory" className="text-foreground inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
              {t("noneLink")}
            </Link>
          </p>
        </>
      )}
      {anyListed && <p className="text-muted-foreground mt-2 max-w-prose text-sm">{t("listedNote")}</p>}
    </section>
  );
}

export function MatchResults({ runId, initial }: { runId: string; initial: MatchViewData }) {
  const t = useTranslations("match");
  const tk = useTranslations("home.gmina.kind");
  const labels = useLabels();
  const locale = useLocale();
  const utils = api.useUtils();
  const query = api.match.get.useQuery({ runId }, { initialData: initial, staleTime: Infinity });
  const view = query.data;
  const refine = api.match.refine.useMutation({
    onSuccess: (v) => utils.match.get.setData({ runId }, v),
  });
  const asked = useRef(false);
  const [help, setHelp] = useState<{ open: boolean; innovation: { id: string; title: string } | null }>({
    open: false,
    innovation: null,
  });
  const [helpSent, setHelpSent] = useState(false);
  const openHelp = (innovation: { id: string; title: string } | null) => setHelp({ open: true, innovation });
  const helpTargetsVisible = useHelpTargetsVisible();
  const h1 = useRef<HTMLHeadingElement>(null);
  const crisisHeading = useRef<HTMLHeadingElement>(null);
  const urgent = view.crisis.urgent;

  // Focus the first thing to read: the emergency numbers when the text suggests danger, else the heading.
  useEffect(() => {
    if (urgent) crisisHeading.current?.focus();
    else h1.current?.focus({ preventScroll: true });
    // Only on arrival: later updates (AI result) must not move focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view.stage === "preliminary" && !asked.current) {
      asked.current = true;
      refine.mutate({ runId });
    }
  }, [view.stage, runId, refine]);

  const pending = (view.stage === "preliminary" && !refine.isError) || refine.isPending;
  const elapsed = useElapsed(pending);
  const progress = [...PROGRESS].reverse().find((p) => elapsed >= p.after) ?? PROGRESS[0];

  // The AI check failed: on the server (stored as an error) or on the way (network).
  const failed = view.note === "ai_error" || (view.stage === "preliminary" && refine.isError);
  const abstained = view.stage === "abstained";
  const failedNone = failed && view.results.length === 0;
  const canRetry = failed && view.aiAvailable && !refine.isPending;
  const retry = () => refine.mutate({ runId, retry: view.note === "ai_error" });

  let liveText = "";
  if (pending)
    liveText = refine.isPending && view.note === "ai_error"
      ? t("live.retrying")
      : t(`progress.${progress.key}`, { count: view.libraryCount, seconds: view.aiDeadlineSec });
  else if (view.stage === "verified") liveText = t("live.verified", { count: view.results.length });
  else if (abstained) liveText = t("live.abstained");
  else if (failedNone) liveText = t("live.failedNone");
  else if (failed) liveText = t("live.failed");

  const topArea = view.areas[0];
  const note = failed ? (failedNone ? "ai_error_none" : "ai_error") : view.note;
  const stickyShown = !help.open && !helpSent && !helpTargetsVisible;
  useStickyBarScrollPadding(stickyShown);

  const placeKind = view.place?.gminaKind ? gminaKindKey(view.place.gminaKind) : null;
  const helpSection = (
    <RequestHelp
      runId={runId}
      query={view.query}
      areas={view.areas}
      gminaTeryt={view.place?.gminaTeryt ?? null}
      powiatTeryt={view.place?.powiatTeryt ?? null}
      resultTitles={abstained ? [] : view.results.map((r) => r.card.title)}
      abstained={abstained}
      open={help.open}
      onOpenChange={(open) => setHelp((h) => ({ open, innovation: open ? h.innovation : null }))}
      innovation={help.innovation}
      onCreated={() => setHelpSent(true)}
    />
  );

  return (
    <div className="flex flex-col gap-8 max-md:pb-24">
      {urgent && <CrisisBanner headingRef={crisisHeading} />}

      <header className="flex flex-col gap-3">
        <h1 ref={h1} tabIndex={-1} className="text-4xl font-bold outline-none">
          {t("heading")}
        </h1>
        {view.userTerms.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-lg font-semibold">{t("yourWords")}</span>
            <UserTerms terms={view.userTerms} />
          </div>
        )}
        {view.place && (
          <p className="text-muted-foreground">
            {t("placeLabel")} {view.place.gminaName ?? view.place.gminaTeryt}
            {view.place.gminaKind
              ? ` (${placeKind ? tk(placeKind) : tk("other", { kind: view.place.gminaKind })})`
              : ""}
            {view.place.powiatName ? `, ${view.place.powiatName}` : ""}
          </p>
        )}
        <p className="text-muted-foreground">
          {t("searchedIn", { count: view.libraryCount })}{" "}
          <Link href="/" className="text-foreground underline" data-no-print>
            {t("changeQuery")}
          </Link>
        </p>
      </header>

      <p role="status" aria-live="polite" className={pending ? "border-hairline bg-surface rounded-lg border p-4 text-lg" : "sr-only"}>
        {pending && (
          <span aria-hidden="true" className="border-primary mr-3 inline-block size-4 animate-spin rounded-full border-2 border-t-transparent align-middle" />
        )}
        {liveText}
      </p>

      {abstained ? (
        <>
          <section aria-labelledby="abstain-heading" className="border-foreground rounded-lg border-2 p-5">
            <h2 id="abstain-heading" className="text-2xl font-bold">
              {t("abstain.heading")}
            </h2>
            <p className="mt-2 max-w-prose text-lg">{t("abstain.body")}</p>
            <p className="text-muted-foreground mt-2 max-w-prose">
              {t.rich("abstain.alternatives", {
                rephrase: (chunks) => (
                  <Link href="/" className="text-foreground underline">
                    {chunks}
                  </Link>
                ),
                browse: (chunks) => (
                  <Link href="/library" className="text-foreground underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>
          {/* The one-click hand-over sits right under the promise that it exists. */}
          {helpSection}
        </>
      ) : (
        <section aria-label={t("resultsLabel")} className="flex flex-col gap-5">
          {note && !pending && (
            <div className="border-hairline bg-surface flex flex-col items-start gap-3 rounded-lg border p-4">
              <p>{t(`notes.${note}`)}</p>
              {canRetry && (
                <button type="button" className={failedNone ? btnPrimary : btnSecondary} onClick={retry}>
                  {t("notes.retry")}
                </button>
              )}
            </div>
          )}
          {view.results.map((r, i) => (
            <ResultCard
              key={r.card.id}
              r={r}
              index={i}
              pending={pending}
              onRequestHelp={() => openHelp({ id: r.card.id, title: r.card.title })}
            />
          ))}
          {view.results.length > 0 && (
            <FundingBlock funding={view.funding} anyListed={view.results.some((r) => r.path.funding?.reason === "listed")} />
          )}
        </section>
      )}

      {(view.knowledge ?? view.similar) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {view.knowledge && (
            <section aria-labelledby="fact-heading" className="border-hairline rounded-lg border p-5">
              <h2 id="fact-heading" className="text-xl font-bold">
                {t("fact.heading")}
              </h2>
              <div lang={view.knowledge.lang !== locale ? view.knowledge.lang : undefined}>
                <p className="text-muted-foreground mt-1 text-sm">{view.knowledge.areaLabel}</p>
                <p className="mt-2 text-lg">{view.knowledge.text}</p>
              </div>
              <div className="mt-2">
                <SourceLine
                  source={view.knowledge.sourceTitle}
                  href={view.knowledge.sourceUrl}
                  detail={knowledgeDetail(view.knowledge.page, view.knowledge.sourceDate, {
                    locale: locale === "en" ? "en" : "pl",
                    page: (page) => t("fact.page", { page }),
                    edition: (month) => t("fact.edition", { month }),
                  })}
                />
              </div>
            </section>
          )}
          {view.similar && topArea && (
            <section aria-labelledby="similar-heading" className="border-hairline rounded-lg border p-5">
              <h2 id="similar-heading" className="text-xl font-bold">
                {t("similar.heading")}
              </h2>
              <p className="mt-2 text-lg">
                {view.similar.count === 0
                  ? t("similar.none", { days: view.similar.days, area: labels.area[topArea] })
                  : t("similar.some", { days: view.similar.days, count: view.similar.count, area: labels.area[topArea] })}
                {view.similar.powiatCount !== null && view.similar.count > 0
                  ? ` ${
                      view.similar.powiatName
                        ? t("similar.powiatNamed", { count: view.similar.powiatCount, name: view.similar.powiatName })
                        : t("similar.powiat", { count: view.similar.powiatCount })
                    }`
                  : ""}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{t("similar.privacy")}</p>
            </section>
          )}
        </div>
      )}

      {!abstained && helpSection}

      <div data-no-print>
        <button type="button" className={btnSecondary} onClick={() => window.print()}>
          {t("print")}
        </button>
      </div>

      {stickyShown && (
        <div data-no-print className="border-hairline bg-background fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 md:hidden">
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => openHelp(null)}>
            {t("stickyHelp")}
          </button>
        </div>
      )}
    </div>
  );
}
