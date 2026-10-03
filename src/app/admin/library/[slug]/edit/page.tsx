import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { InnovationEditor } from "~/components/admin/innovation-editor";
import { StatusBadge } from "~/components/admin/status-badge";
import { formatDatePl } from "~/components/kit";
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
  const res = await api.admin.library.get({ slug: decodeURIComponent(slug) });
  return { title: res ? `Edycja: ${res.card.title}` : "Edycja karty" };
}

const ACTION_LABEL: Record<string, string> = {
  "innovation.create": "utworzono kartę",
  "innovation.update": "zapisano zmiany",
  "innovation.publish": "opublikowano",
};

export default async function EditInnovationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const created = (await searchParams).created === "1";
  const [res, categories] = await Promise.all([
    api.admin.library.get({ slug: decodeURIComponent(slug) }),
    api.admin.library.categories(),
  ]);
  if (!res) notFound();
  const { card, history } = res;

  return (
    <>
      <AdminHeader
        title={card.title}
        breadcrumbs={[{ label: "Biblioteka — edycja", href: "/admin/library" }]}
        lead={
          <p>
            Karta {card.id}. Po zapisaniu zdania karty są dzielone na nowo:
            niezmienione zachowują swoje numery, więc wcześniejsze cytaty w
            dopasowaniach nadal działają.
          </p>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-[0.9375rem]">
          <StatusBadge status={card.status} />
          <span>Ostatnia zmiana: {formatDatePl(card.updatedAt)}</span>
          {card.status === "published" ? (
            <Link
              href={`/library/${card.slug}`}
              className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4"
            >
              Zobacz w Bibliotece
            </Link>
          ) : null}
        </div>
      </AdminHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {created ? (
          <Alert variant="success" role="status" className="mb-8">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>Karta zapisana.</AlertTitle>
            <AlertDescription>
              Możesz ją dalej poprawiać. Mieszkańcy zobaczą ją po zmianie
              statusu na „Opublikowana”.
            </AlertDescription>
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
            Ostatnie zmiany
          </h2>
          {history.length ? (
            <ol className="mt-3 space-y-2 text-[0.9375rem]">
              {history.map((h) => {
                const diff = (h.diff ?? {}) as Record<string, unknown>;
                const fields = Object.keys(diff).filter(
                  (k) => k !== "sentences",
                );
                return (
                  <li key={h.id}>
                    <span className="font-semibold">
                      {formatDatePl(h.createdAt)}
                    </span>{" "}
                    — {ACTION_LABEL[h.action] ?? h.action}
                    {fields.length ? ` (pola: ${fields.length})` : ""}
                    <span className="text-muted-foreground">
                      {" "}
                      · {h.actor.startsWith("rops") ? "zespół ROPS" : h.actor}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-foreground/85 mt-3">
              Karta nie była jeszcze edytowana w panelu — treść pochodzi z
              importu Biblioteki ROPS.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
