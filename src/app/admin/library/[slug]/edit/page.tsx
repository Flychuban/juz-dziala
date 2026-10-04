import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2Icon, LanguagesIcon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { InnovationEditor } from "~/components/admin/innovation-editor";
import { StatusBadge } from "~/components/admin/status-badge";
import { formatDate } from "~/components/kit";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { api } from "~/trpc/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("admin.libraryEdit");
  const res = await api.admin.library.get({ slug: decodeURIComponent(slug) });
  return {
    title: res ? t("metaTitle", { title: res.card.title }) : t("metaFallback"),
  };
}

const ACTIONS = {
  "innovation.create": "create",
  "innovation.update": "update",
  "innovation.publish": "publish",
} as const;

export default async function EditInnovationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const created = (await searchParams).created === "1";
  const [res, categories, t, tl, locale] = await Promise.all([
    api.admin.library.get({ slug: decodeURIComponent(slug) }),
    api.admin.library.categories(),
    getTranslations("admin.libraryEdit"),
    getTranslations("admin.library"),
    getLocale(),
  ]);
  if (!res) notFound();
  const { card, history, english } = res;

  return (
    <>
      <AdminHeader
        title={card.title}
        breadcrumbs={[{ label: tl("title"), href: "/admin/library" }]}
        lead={<p>{t("lead", { id: card.id })}</p>}
      >
        <div className="flex flex-wrap items-center gap-3 text-[0.9375rem]">
          <StatusBadge status={card.status} />
          <span>
            {t("lastChange", { date: formatDate(card.updatedAt, locale) })}
          </span>
          {card.status === "published" ? (
            <Link
              href={`/library/${card.slug}`}
              className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
            >
              {t("viewInLibrary")}
            </Link>
          ) : null}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[0.9375rem]">
          <LanguagesIcon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
          />
          {english === "current"
            ? t("englishCurrent")
            : english === "stale"
              ? t("englishStale")
              : t("englishMissing")}
        </p>
      </AdminHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {created ? (
          <Alert variant="success" role="status" className="mb-8">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>{t("savedTitle")}</AlertTitle>
            <AlertDescription>{t("savedBody")}</AlertDescription>
          </Alert>
        ) : null}
        <InnovationEditor
          mode="edit"
          categories={categories}
          initial={{
            id: card.id,
            slug: card.slug,
            title: card.title,
            sections: card.sections,
            mapaAreas: card.mapaAreas,
            categories: card.categories,
            keywords: card.keywords,
            videoUrl: card.videoUrl,
            testingOpen: card.testingOpen,
            status: card.status,
          }}
        />

        <section
          aria-labelledby="history-heading"
          className="border-hairline mt-14 border-t pt-8"
        >
          <h2 id="history-heading" className="font-display text-xl font-bold">
            {t("historyHeading")}
          </h2>
          {history.length ? (
            <ol className="mt-3 space-y-2 text-[0.9375rem]">
              {history.map((h) => {
                const diff = (h.diff ?? {}) as Record<string, unknown>;
                const fields = Object.keys(diff).filter(
                  (k) => k !== "sentences",
                );
                const action =
                  h.action in ACTIONS
                    ? t(`action.${ACTIONS[h.action as keyof typeof ACTIONS]}`)
                    : h.action;
                return (
                  <li key={h.id}>
                    <span className="font-semibold">
                      {formatDate(h.createdAt, locale)}
                    </span>{" "}
                    — {action}
                    {fields.length
                      ? ` ${t("historyFields", { count: fields.length })}`
                      : ""}
                    <span className="text-muted-foreground">
                      {" "}
                      · {h.actor.startsWith("rops") ? tl("byTeam") : h.actor}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-foreground/85 mt-3">{t("historyNone")}</p>
          )}
        </section>
      </div>
    </>
  );
}
