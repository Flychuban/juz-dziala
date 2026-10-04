import { type Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BellIcon, CalendarClockIcon, LanguagesIcon, LayoutGridIcon } from "lucide-react";

import { EmptyState, formatDate, PageHeader, SampleBadge, SourceLine } from "~/components/kit";
import { ApplicationGenerator } from "~/components/ideas/application-generator";
import { IdeaNotFound } from "~/components/ideas/idea-not-found";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { canvasToText } from "~/server/ideas/canvas-def";
import { applicationCalls, loadCanvasDef, localizeCall, type LocalizedCall } from "~/server/ideas/data";
import { loadIdeaForPage, tokenParam, withToken } from "~/server/ideas/page-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ideas.meta");
  return { title: t("applicationTitle"), description: t("applicationDescription") };
}

export const dynamic = "force-dynamic";

/** The IWS 2.0 form the first demo call copies (attachment 3 to the IWS 2.0 announcement). */
const IWS_FORM_URL = "https://rops.krakow.pl/mpliki/IS/IWS_20/za._3._Formularz_aplikacyjny_wzor.pdf";

/** Message keys of the demo calls whose origin is explained in plain words. */
const DEMO_KEY: Record<string, "iws" | "uslugaWrazliwa"> = {
  "demo-iws": "iws",
  "demo-usluga-wrazliwa": "uslugaWrazliwa",
};

function one(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.length <= 64 ? s : undefined;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp, locale, t] = await Promise.all([params, searchParams, getLocale(), getTranslations("ideas.applicationPage")]);
  const token = tokenParam(sp);
  const [loaded, open, def] = await Promise.all([loadIdeaForPage(raw, token), applicationCalls(), loadCanvasDef()]);
  if (!loaded.ok) return <IdeaNotFound title={t("title")} message={loaded.message} />;
  const { data, code } = loaded;
  const calls = open.map((c) => localizeCall(c, locale));
  const wanted = one(sp.call);
  const call = calls.find((c) => c.id === wanted) ?? calls.find((c) => c.id === data.idea.application?.callId) ?? calls[0];
  const caseHref = withToken(`/case/${code}`, token);
  const here = `/ideas/${code}/application?${new URLSearchParams({ ...(token ? { t: token } : {}), ...(call ? { call: call.id } : {}) }).toString()}`;

  const header = (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={t("title")}
      lead={<p>{t("lead", { title: data.idea.title, code })}</p>}
      breadcrumbs={[
        { label: t("crumbIdeas"), href: "/ideas/new" },
        { label: t("crumbCase", { code }), href: caseHref },
      ]}
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={withToken(`/ideas/${code}/canvas`, token)}>
            <LayoutGridIcon aria-hidden="true" />
            {data.canvas ? t("canvasEdit") : t("canvasFirst")}
          </Link>
        </Button>
      </div>
    </PageHeader>
  );

  if (!call) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-4 py-10">
          <EmptyState
            icon={<CalendarClockIcon />}
            title={t("noCall.title")}
            description={<p>{t("noCall.body")}</p>}
            action={
              <Button asChild>
                <Link href="/network#powiadomienia">
                  <BellIcon aria-hidden="true" />
                  {t("noCall.notify")}
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const sources = [
    data.idea.title,
    data.idea.description,
    data.idea.targetGroup,
    def && data.canvas ? canvasToText(def, data.canvas) : "",
  ];
  const callLang = call.lang === "pl" && locale === "en" ? "pl" : undefined;
  const demoKey = DEMO_KEY[call.id];
  const existing = data.idea.application?.callId === call.id ? data.idea.application : null;
  const windowLine = (c: LocalizedCall) =>
    c.windowTo ? t("window.until", { date: formatDate(c.windowTo, locale) }) : c.status === "demo" ? t("window.demo") : t("window.none");
  const who = (c: LocalizedCall) => {
    const k = DEMO_KEY[c.id];
    return k ? t(`who.${k}`) : c.eligibility.join("; ");
  };

  return (
    <>
      {header}
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 md:py-12">
        {locale === "en" ? (
          <Alert role="note">
            <LanguagesIcon aria-hidden="true" />
            <AlertTitle>{t("polishOnly.title")}</AlertTitle>
            <AlertDescription>
              <p>{t("polishOnly.body")}</p>
              <p>
                <a href={`/api/lang?to=pl&next=${encodeURIComponent(here)}`} className="font-semibold underline underline-offset-4">
                  {t("polishOnly.switch")}
                </a>
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {calls.length > 1 ? (
          <section aria-labelledby="calls-h">
            <h2 id="calls-h" className="font-display text-2xl font-bold">
              {t("pick.heading")}
            </h2>
            <p className="mt-2">{t("pick.body", { count: calls.length })}</p>
            <form method="get" action={`/ideas/${code}/application`} className="mt-4 flex flex-col gap-4">
              {token ? <input type="hidden" name="t" value={token} /> : null}
              <fieldset className="min-w-0">
                <legend className="sr-only">{t("pick.legend")}</legend>
                <div className="flex flex-col gap-3">
                  {calls.map((c) => (
                    <label
                      key={c.id}
                      className="border-input bg-background hover:bg-surface has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-focus flex min-h-12 cursor-pointer items-start gap-3 rounded-md border-2 px-4 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2"
                    >
                      <input
                        type="radio"
                        name="call"
                        value={c.id}
                        defaultChecked={c.id === call.id}
                        className="accent-primary mt-0.5 size-6 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-semibold" lang={c.lang === "pl" && locale === "en" ? "pl" : undefined}>
                          {c.name}
                        </span>
                        <span className="text-muted-foreground block text-[0.9375rem]">{windowLine(c)}</span>
                        <span className="text-muted-foreground block text-[0.9375rem]">{t("pick.who", { who: who(c) })}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" variant="outline" className="w-fit">
                {t("pick.submit")}
              </Button>
            </form>
          </section>
        ) : null}

        {call.status === "demo" ? (
          <Alert role="note">
            <CalendarClockIcon aria-hidden="true" />
            <AlertTitle>
              <span lang={callLang}>{call.name}</span> <SampleBadge />
            </AlertTitle>
            <AlertDescription>
              <p>{windowLine(call)}</p>
              <p>{demoKey ? t(`demoNote.${demoKey}`) : t("demoNote.other")}</p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="note">
            <CalendarClockIcon aria-hidden="true" />
            <AlertTitle>
              <span lang={callLang}>{call.name}</span>
            </AlertTitle>
            <AlertDescription>
              <p>{windowLine(call)}</p>
            </AlertDescription>
          </Alert>
        )}

        <section aria-labelledby="fields-h">
          <h2 id="fields-h" className="font-display text-2xl font-bold">
            {t("fields", { count: call.formFields.length })}
          </h2>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-6" lang={callLang}>
            {call.formFields.map((f) => (
              <li key={f.key}>
                <span className="font-semibold">{f.label}</span>
                {f.hint ? <span className="text-muted-foreground block text-[0.9375rem]">{f.hint}</span> : null}
              </li>
            ))}
          </ol>
          {call.criteria.length ? (
            <details className="border-hairline mt-6 border-y py-2">
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{t("criteria", { count: call.criteria.length })}</summary>
              <ul className="mt-2 flex flex-col gap-2 pb-2" lang={callLang}>
                {call.criteria.map((c) => (
                  <li key={c.key}>
                    <span className="font-semibold">{t("criterion", { label: c.label, max: c.max })}</span> {c.description}
                  </li>
                ))}
              </ul>
              {demoKey === "uslugaWrazliwa" ? <p className="text-muted-foreground pb-2 text-sm">{t("criteriaSample")}</p> : null}
            </details>
          ) : null}
          <SourceLine
            className="mt-4"
            source={demoKey === "iws" ? t("source.iws") : demoKey === "uslugaWrazliwa" ? t("source.uslugaWrazliwa") : call.name}
            href={demoKey === "iws" ? IWS_FORM_URL : call.sourceUrl}
            detail={demoKey === "uslugaWrazliwa" ? t("source.uslugaWrazliwaDetail") : null}
          />
        </section>

        <ApplicationGenerator
          key={call.id}
          code={code}
          token={token}
          call={{ id: call.id, name: call.name, formFields: call.formFields }}
          existing={existing}
          sources={sources}
        />
      </div>
    </>
  );
}
