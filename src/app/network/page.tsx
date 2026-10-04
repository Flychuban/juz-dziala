import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  CalendarClockIcon,
  HandshakeIcon,
  MessageCircleQuestionIcon,
  UsersIcon,
} from "lucide-react";

import {
  AreaTag,
  EmptyState,
  ExternalLink,
  formatDate,
  PageHeader,
  SampleBadge,
  SourceLine,
} from "~/components/kit";
import {
  AskExpertWizard,
  PartnerWizard,
  SubscribeForm,
} from "~/components/network/network-forms";
import { Button } from "~/components/ui/button";
import { labelsFor, mapaAreaSchema } from "~/lib/domain";
import { gminaOptions } from "~/server/ideas/data";
import { api } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("network.meta");
  return { title: t("title"), description: t("description") };
}

export const dynamic = "force-dynamic";

const LIBRARY_URL =
  "https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych";

/** Organisation groups, in this order (`orgs.type`); anything else is „inna". */
const ORG_TYPES = [
  "fundacja",
  "stowarzyszenie",
  "ops",
  "jst",
  "uczelnia",
  "firma",
  "inna",
] as const;
type OrgType = (typeof ORG_TYPES)[number];
const isOrgType = (v: string): v is OrgType =>
  (ORG_TYPES as readonly string[]).includes(v);

/** Section heading row (h2 with an icon). */
const h2Class = "font-display flex items-center gap-2 text-3xl font-bold";
/**
 * The two forms open with an eyebrow, not an h2: the kit Stepper renders each
 * question as the h2 of its section, so the outline stays h1 → h2 (question).
 */
const eyebrowClass =
  "text-muted-foreground flex items-center gap-2 text-base font-semibold tracking-wide uppercase";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const areaParam = mapaAreaSchema.safeParse(
    typeof sp.area === "string" ? sp.area : undefined,
  );
  const orgParam =
    typeof sp.org === "string" ? sp.org.trim().slice(0, 200) : "";
  const [t, locale, orgs, people, calls, { gminas, powiaty }] =
    await Promise.all([
      getTranslations("network"),
      getLocale(),
      api.network.orgs(),
      api.network.people(),
      api.network.openCalls(),
      gminaOptions(),
    ]);
  const labels = labelsFor(locale);
  /** `lang` for Polish content on an English page (WCAG 3.1.2). */
  const langOf = (l: string) => (l !== locale ? l : undefined);
  const polishName = locale === "pl" ? undefined : "pl";

  const groups = ORG_TYPES.map((type) => ({
    type,
    items: orgs.filter((o) =>
      type === "inna"
        ? o.type === "inna" || !isOrgType(o.type)
        : o.type === type,
    ),
  })).filter((g) => g.items.length);

  const callDates = (from: string | null, to: string | null) =>
    t("calls.dates", {
      range: from && to ? "both" : to ? "to" : "none",
      from: formatDate(from, locale),
      to: formatDate(to, locale),
    });

  const sections = [
    { id: "nabory", label: t("nav.calls") },
    { id: "zapytaj", label: t("nav.ask") },
    { id: "mentorzy", label: t("nav.people") },
    { id: "organizacje", label: t("nav.orgs") },
    { id: "partnerzy", label: t("nav.partners") },
    { id: "powiadomienia", label: t("nav.subscribe") },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={<p>{t("lead")}</p>}
      >
        <nav aria-label={t("nav.label")} className="mt-6">
          <ul className="flex flex-wrap gap-3">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="border-input bg-background hover:bg-surface inline-flex min-h-12 max-w-full items-center rounded-md border-2 px-4 font-semibold [overflow-wrap:anywhere]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 md:py-12">
        <section id="nabory" aria-labelledby="nabory-h" className="scroll-mt-6">
          <h2 id="nabory-h" className={h2Class}>
            <CalendarClockIcon aria-hidden="true" className="size-7" />
            {t("calls.heading")}
          </h2>
          {calls.length ? (
            <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {calls.map((c) => (
                <li
                  key={c.id}
                  className="border-hairline flex flex-col gap-2 rounded-lg border p-5"
                >
                  <p className="text-muted-foreground text-sm font-semibold">
                    {labels.callStatus[c.status]}
                  </p>
                  <h3
                    lang={langOf(c.lang)}
                    className="font-display text-xl leading-snug font-bold"
                  >
                    {c.name}
                  </h3>
                  <p>
                    <span className="font-semibold">{t("calls.when")} </span>
                    {callDates(c.windowFrom, c.windowTo)}
                  </p>
                  {c.eligibility.length ? (
                    <p>
                      <span className="font-semibold">{t("calls.forWhom")} </span>
                      <span lang={langOf(c.lang)}>
                        {c.eligibility.slice(0, 3).join("; ")}
                      </span>
                    </p>
                  ) : null}
                  {c.operator ? (
                    <p className="text-muted-foreground text-[0.9375rem]">
                      {t("calls.operator")}{" "}
                      <span lang={langOf(c.lang)}>{c.operator}</span>
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-3 pt-2">
                    {c.status === "demo" ? (
                      <Button asChild>
                        <Link href="/ideas/new">{t("calls.demoAction")}</Link>
                      </Button>
                    ) : null}
                    {c.sourceUrl ? (
                      <ExternalLink href={c.sourceUrl}>
                        {t("calls.page")}
                      </ExternalLink>
                    ) : null}
                  </div>
                  {c.sourceUrl && c.status !== "demo" ? (
                    <SourceLine source={t("calls.source")} href={c.sourceUrl} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-6"
              headingLevel="h3"
              icon={<CalendarClockIcon />}
              title={t("calls.emptyTitle")}
              description={<p>{t("calls.emptyBody")}</p>}
            />
          )}
        </section>

        <section
          id="zapytaj"
          aria-labelledby="zapytaj-h"
          className="scroll-mt-6"
        >
          <p id="zapytaj-h" className={eyebrowClass}>
            <MessageCircleQuestionIcon aria-hidden="true" className="size-5" />
            {t("ask.heading")}
          </p>
          <p className="mt-2 max-w-prose text-lg">{t("ask.lead")}</p>
          <div className="mt-6">
            <AskExpertWizard
              key={areaParam.success ? areaParam.data : "any"}
              gminas={gminas}
              powiaty={powiaty}
              initialArea={areaParam.success ? areaParam.data : undefined}
            />
          </div>
        </section>

        <section
          id="mentorzy"
          aria-labelledby="mentorzy-h"
          className="scroll-mt-6"
        >
          <h2 id="mentorzy-h" className={h2Class}>
            <UsersIcon aria-hidden="true" className="size-7" />
            {t("people.heading")}
          </h2>
          {people.length ? (
            <>
              <p className="mt-2 max-w-prose">{t("people.sample")}</p>
              <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="border-hairline flex flex-col gap-2 rounded-lg border p-5"
                  >
                    <h3 className="font-display flex flex-wrap items-center gap-2 text-xl font-bold">
                      <span lang={polishName}>{p.displayName}</span>
                      {p.isSample ? <SampleBadge /> : null}
                    </h3>
                    <p
                      lang={p.title ? langOf(p.lang) : undefined}
                      className="text-muted-foreground font-semibold"
                    >
                      {p.title ?? t(`people.role.${p.role}`)}
                    </p>
                    {p.orgName ? (
                      <p lang={langOf(p.lang)}>{p.orgName}</p>
                    ) : null}
                    {p.bio ? <p lang={langOf(p.lang)}>{p.bio}</p> : null}
                    {p.areas.length ? (
                      <div className="flex flex-wrap gap-2">
                        {p.areas.map((a) => (
                          <AreaTag key={a} area={a} />
                        ))}
                      </div>
                    ) : null}
                    <Button asChild variant="secondary" className="mt-2 w-fit">
                      <Link href={`/network?area=${p.areas[0] ?? ""}#zapytaj`}>
                        {t("people.askInArea")}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              className="mt-6"
              headingLevel="h3"
              icon={<UsersIcon />}
              title={t("people.emptyTitle")}
              description={<p>{t("people.emptyBody")}</p>}
            />
          )}
        </section>

        <section
          id="organizacje"
          aria-labelledby="organizacje-h"
          className="scroll-mt-6"
        >
          <h2 id="organizacje-h" className="font-display text-3xl font-bold">
            {t("orgs.heading")}
          </h2>
          <p className="mt-2 max-w-prose">
            {t("orgs.lead", { count: orgs.length })}
          </p>
          <p className="mt-2 max-w-prose">{t("orgs.connectLead")}</p>
          <div className="mt-6 flex flex-col gap-8">
            {groups.map((g) => (
              <section key={g.type} aria-labelledby={`org-${g.type}`}>
                <h3 id={`org-${g.type}`} className="font-display text-xl font-bold">
                  {t(`orgs.type.${g.type}`)}{" "}
                  <span className="text-muted-foreground tabular font-semibold">
                    ({g.items.length})
                  </span>
                </h3>
                <ul className="border-hairline mt-3 grid grid-cols-1 border-t md:grid-cols-2 md:gap-x-8">
                  {g.items.map((o) => (
                    <li
                      key={o.id}
                      className="border-hairline flex flex-col gap-1 border-b py-3"
                    >
                      <p className="font-semibold">
                        <span lang={polishName}>{o.name}</span>{" "}
                        {o.isSample ? <SampleBadge /> : null}
                      </p>
                      {o.innovations.length ? (
                        <p className="text-[0.9375rem]">
                          {t("orgs.solutions", { count: o.innovations.length })}{" "}
                          {o.innovations.map((i, idx) => (
                            <span key={i.id}>
                              {idx ? ", " : ""}
                              <Link
                                href={`/library/${i.slug}`}
                                lang={langOf(i.lang)}
                                className="text-primary underline underline-offset-4"
                              >
                                {i.title}
                              </Link>
                            </span>
                          ))}
                        </p>
                      ) : null}
                      <Link
                        href={`/network?org=${encodeURIComponent(o.name)}#partnerzy`}
                        prefetch={false}
                        className="text-primary inline-flex min-h-12 w-fit items-center gap-2 font-semibold underline underline-offset-4"
                      >
                        <HandshakeIcon aria-hidden="true" className="size-5" />
                        {t("orgs.connect")}
                        <span className="sr-only">
                          {t("orgs.connectSr", { org: o.name })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <SourceLine
            className="mt-6"
            source={t("orgs.source")}
            href={LIBRARY_URL}
          />
        </section>

        <section
          id="partnerzy"
          aria-labelledby="partnerzy-h"
          className="scroll-mt-6"
        >
          <p id="partnerzy-h" className={eyebrowClass}>
            <HandshakeIcon aria-hidden="true" className="size-5" />
            {t("partner.heading")}
          </p>
          <p className="mt-2 max-w-prose text-lg">{t("partner.lead")}</p>
          <p className="mt-2 max-w-prose">{t("partner.broker")}</p>
          <div className="mt-6">
            <PartnerWizard
              key={orgParam || "any"}
              gminas={gminas}
              powiaty={powiaty}
              initialOrg={orgParam || undefined}
            />
          </div>
        </section>

        <section
          id="powiadomienia"
          aria-labelledby="powiadomienia-h"
          className="scroll-mt-6"
        >
          <h2 id="powiadomienia-h" className="font-display text-3xl font-bold">
            {t("subscribe.heading")}
          </h2>
          <p className="mt-2 mb-6 max-w-prose text-lg">{t("subscribe.lead")}</p>
          <SubscribeForm />
        </section>
      </div>
    </>
  );
}
