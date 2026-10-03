"use client";

import { formatDatePl } from "~/components/kit";
import { api } from "~/trpc/react";

const KIND_LABEL = { works: "Co działa", improve: "Co poprawić", idea: "Pomysły na ulepszenie" } as const;

/**
 * Staff view of what testers said about one innovation (`tests.summary`):
 * count, average, distribution and the comments grouped into themes by AI —
 * or, without the AI, simply listed. Drop it into an admin page:
 *
 *   <FeedbackSummary innovationId="c004" />
 */
export function FeedbackSummary({ innovationId }: { innovationId: string }) {
  const q = api.tests.summary.useQuery({ innovationId });
  if (q.isPending) return <p role="status">Wczytujemy opinie testerów…</p>;
  if (q.isError) return <p role="alert">Nie udało się wczytać opinii: {q.error.message}</p>;
  const s = q.data;
  return (
    <section aria-labelledby={`fb-${innovationId}`} className="flex flex-col gap-4">
      <h2 id={`fb-${innovationId}`} className="font-display text-xl font-bold">
        Opinie testerów
      </h2>
      <p>
        Opinii: <span className="tabular font-bold">{s.feedbackCount}</span>
        {s.averageRating !== null ? (
          <>
            {" "}
            · średnia ocena <span className="tabular font-bold">{s.averageRating.toLocaleString("pl-PL")} / 5</span>
          </>
        ) : null}{" "}
        · zgłoszeń do testów: <span className="tabular font-bold">{s.testSignUps}</span>
      </p>
      {s.feedbackCount ? (
        <ul className="tabular flex flex-wrap gap-x-4 gap-y-1 text-[0.9375rem]">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <li key={n}>
              {n}/5: {s.ratingCounts[n]}
            </li>
          ))}
        </ul>
      ) : null}
      {s.themes?.length ? (
        <div>
          <h3 className="text-lg font-semibold">Tematy (pogrupowane przez AI)</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {s.themes.map((t) => (
              <li key={t.name} className="border-hairline rounded-md border p-3">
                <p className="font-semibold">
                  {KIND_LABEL[t.kind]}: {t.name}
                </p>
                <p>{t.summary}</p>
                <p className="text-muted-foreground text-sm">Opinie: {t.caseCodes.join(", ")}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : s.aiStatus === "unavailable" || s.aiStatus === "failed" ? (
        <p className="text-muted-foreground">Asystent AI chwilowo niedostępny — poniżej wszystkie opinie.</p>
      ) : null}
      {s.comments.length ? (
        <details open={!s.themes?.length}>
          <summary className="min-h-12 cursor-pointer py-2 font-semibold">Wszystkie opinie ({s.comments.length})</summary>
          <ul className="mt-2 flex flex-col gap-3">
            {s.comments.map((c) => (
              <li key={c.code} className="border-hairline rounded-md border p-3">
                <p className="text-muted-foreground text-sm">
                  {c.code} · {formatDatePl(c.createdAt)}
                  {c.rating ? ` · ${c.rating}/5` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p>Nikt jeszcze nie ocenił tej innowacji.</p>
      )}
    </section>
  );
}
