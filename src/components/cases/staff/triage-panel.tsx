"use client";

import {
  AlertTriangleIcon,
  RefreshCwIcon,
  SparklesIcon,
  UserCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SampleBadge } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  CASE_STATUS_LABEL,
  MAPA_AREA_LABEL,
  URGENCY_LABEL,
} from "~/lib/domain";
import { CRISIS_RESOURCES } from "~/server/domain/crisis";
import { api, type RouterOutputs } from "~/trpc/react";
import { fmtDate, plural } from "../format";
import { AI_STATUS_LABEL, caseHref, CRISIS_LABEL } from "./labels";

type Data = RouterOutputs["admin"]["inbox"]["get"];

/**
 * The AI triage panel. The reply draft is editable here and only reaches the
 * reply form through „Użyj szkicu" — nothing is ever sent automatically.
 * Without AI it says so plainly and offers keyword leads instead.
 */
export function TriagePanel({
  data,
  basePath,
  onUseDraft,
}: {
  data: Data;
  basePath: "/admin/cases" | "/expert";
  onUseDraft: (text: string) => void;
}) {
  const t = data.triage;
  const utils = api.useUtils();
  const [draft, setDraft] = useState(t?.replyDraft ?? "");
  const [msg, setMsg] = useState("");
  useEffect(() => setDraft(t?.replyDraft ?? ""), [t?.createdAt, t?.replyDraft]);

  const retriage = api.admin.inbox.retriage.useMutation({
    onSuccess: async (r) => {
      setMsg(
        r.triage?.source === "ai"
          ? "Wstępna ocena AI gotowa."
          : `Wstępna ocena AI nadal niedostępna (${AI_STATUS_LABEL[r.triage?.aiStatus ?? "error"] ?? "błąd"}).`,
      );
      await utils.admin.inbox.get.invalidate({ code: data.case.code });
    },
    onError: (e) => setMsg(e.message),
  });
  const assign = api.admin.inbox.assign.useMutation({
    onSuccess: async () => {
      setMsg("Przydzielono sugerowaną osobę.");
      await utils.admin.inbox.get.invalidate({ code: data.case.code });
    },
    onError: (e) => setMsg(e.message),
  });

  const isRops = data.viewer.role === "rops";

  return (
    <section
      aria-labelledby="triage-heading"
      className="border-hairline flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="triage-heading"
          className="flex items-center gap-2 text-xl font-bold"
        >
          <SparklesIcon aria-hidden="true" className="size-5" />
          Wstępna ocena AI
        </h2>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 max-w-full px-3 text-base whitespace-normal"
          disabled={retriage.isPending}
          onClick={() => {
            setMsg("");
            retriage.mutate({ code: data.case.code });
          }}
        >
          <RefreshCwIcon aria-hidden="true" />
          {retriage.isPending ? "Oceniam…" : "Oceń ponownie"}
        </Button>
      </div>
      <p role="status" className="text-sm font-semibold">
        {msg}
      </p>

      {t?.crisis && (
        <div
          role="note"
          className="border-destructive flex gap-2 rounded-md border-2 p-3"
        >
          <AlertTriangleIcon
            aria-hidden="true"
            className="text-destructive mt-0.5 size-5 shrink-0"
          />
          <div>
            <p className="font-bold">Sygnały kryzysu w zgłoszeniu</p>
            <p className="text-sm">
              {t.crisis.categories.map((c) => CRISIS_LABEL[c] ?? c).join(", ")}
              {t.crisis.matched.length > 0 &&
                ` — np. „${t.crisis.matched.slice(0, 2).join("”, „")}”`}
              . Skontaktuj się z autorem jak najszybciej.
            </p>
          </div>
        </div>
      )}

      {!t ? (
        <p className="text-muted-foreground">
          Trwa wstępna ocena… Wynik pojawi się tu sam.
        </p>
      ) : (
        <>
          {t.source === "keywords" && (
            <div className="bg-warning-bg rounded-md p-3">
              <p className="font-bold">
                Wstępna ocena AI niedostępna — oceń ręcznie.
              </p>
              <p className="text-sm">
                Powód: {AI_STATUS_LABEL[t.aiStatus] ?? t.aiStatus}. Poniżej
                podpowiedzi z dopasowania słów kluczowych (bez AI).
              </p>
            </div>
          )}

          <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
            {t.summary && (
              <>
                <dt className="text-muted-foreground">Streszczenie</dt>
                <dd>{t.summary}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Obszar</dt>
            <dd>
              {t.areas.length
                ? t.areas.map((a) => MAPA_AREA_LABEL[a]).join(", ")
                : "nie rozpoznano"}
              {t.source === "keywords" && t.areas.length > 0 && (
                <span className="text-muted-foreground"> (słowa kluczowe)</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Pilność</dt>
            <dd className={t.urgency === "high" ? "font-bold" : undefined}>
              {t.urgency ? URGENCY_LABEL[t.urgency] : "nieoceniona"}
            </dd>
            {t.powiatGuess && (
              <>
                <dt className="text-muted-foreground">Powiat</dt>
                <dd>
                  {t.powiatGuess}{" "}
                  <span className="text-muted-foreground">
                    (przypuszczenie AI — do weryfikacji)
                  </span>
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Sugerowany ekspert</dt>
            <dd>
              {data.suggestedExpert ? (
                <span className="flex flex-col items-start gap-2">
                  <span>
                    {data.suggestedExpert.displayName}
                    {data.suggestedExpert.title &&
                      ` — ${data.suggestedExpert.title}`}
                    {data.suggestedExpert.isSample && (
                      <>
                        {" "}
                        <SampleBadge className="ml-1" />
                      </>
                    )}
                  </span>
                  {isRops &&
                    data.case.assigneeId !== data.suggestedExpert.id && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-12 max-w-full px-3 text-base whitespace-normal"
                        disabled={assign.isPending}
                        onClick={() =>
                          assign.mutate({
                            code: data.case.code,
                            assigneeId: data.suggestedExpert!.id,
                          })
                        }
                      >
                        <UserCheckIcon aria-hidden="true" />
                        Przydziel tę osobę
                      </Button>
                    )}
                </span>
              ) : (
                "brak sugestii"
              )}
            </dd>
            <dt className="text-muted-foreground">Podobne sprawy</dt>
            <dd>
              {data.similarCases.length ? (
                <ul className="flex flex-col gap-1">
                  {data.similarCases.map((s) => (
                    <li key={s.id}>
                      <Link href={caseHref(basePath, s.code)}>
                        <span className="font-mono">{s.code}</span>: {s.title}
                      </Link>{" "}
                      <span className="text-muted-foreground text-sm">
                        ({CASE_STATUS_LABEL[s.status]})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : data.similarHiddenCount === 0 ? (
                "brak"
              ) : null}
              {data.similarHiddenCount > 0 && (
                <p className="text-muted-foreground text-sm">
                  {data.similarCases.length > 0 ? "Oraz " : ""}
                  {data.similarHiddenCount}{" "}
                  {plural(data.similarHiddenCount, [
                    "podobna sprawa prowadzona",
                    "podobne sprawy prowadzone",
                    "podobnych spraw prowadzonych",
                  ])}{" "}
                  przez inne osoby (bez dostępu).
                </p>
              )}
            </dd>
          </dl>

          <div className="flex flex-col gap-2">
            <label htmlFor="triage-draft" className="font-semibold">
              Szkic odpowiedzi
              {t.source === "ai"
                ? " (AI)"
                : t.crisis
                  ? " (kryzys: telefony wsparcia)"
                  : " (z dopasowania słów kluczowych)"}
            </label>
            <p id="triage-draft-hint" className="text-muted-foreground text-sm">
              Szkic nigdy nie jest wysyłany automatycznie.{" "}
              {t.crisis
                ? "Zawiera wyłącznie zweryfikowane telefony wsparcia (źródła niżej)"
                : "Powstał wyłącznie z cytowanych niżej zdań kart Biblioteki"}{" "}
              — sprawdź go, uzupełnij „[DO UZUPEŁNIENIA]” i dopiero wtedy użyj.
            </p>
            <Textarea
              id="triage-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby="triage-draft-hint"
              rows={10}
              className="min-h-48 text-base"
            />
            <div>
              <Button
                type="button"
                className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
                disabled={!draft.trim()}
                onClick={() => onUseDraft(draft)}
              >
                Użyj szkicu
              </Button>
            </div>
          </div>

          {t.crisis && (
            <div>
              <h3 className="font-semibold">Źródła telefonów wsparcia</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {CRISIS_RESOURCES.map((r) => (
                  <li key={r.phone}>
                    {r.phone} — {r.name}. Źródło:{" "}
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                      strona operatora
                      <span className="sr-only">
                        {" "}
                        (otwiera się w nowej karcie)
                      </span>
                    </a>
                    , sprawdzono {r.verifiedAt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-semibold">
              {t.crisis
                ? "Karty z dopasowania słów kluczowych"
                : "Cytowane karty Biblioteki"}
            </h3>
            {t.cards.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Żadna karta nie pasuje wystarczająco pewnie.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {t.cards.map((k) => {
                  const info = data.cardInfo[k.id];
                  return (
                    <li key={k.id}>
                      <p className="font-semibold">
                        <Link href={`/library/${k.slug}`}>„{k.title}”</Link>
                      </p>
                      {k.matchedTerms && k.matchedTerms.length > 0 && (
                        <p className="text-sm">
                          Pasuje, bo w zgłoszeniu jest:{" "}
                          {k.matchedTerms.slice(0, 5).map((w, i) => (
                            <span key={w}>
                              {i > 0 && ", "}„{w}”
                            </span>
                          ))}
                        </p>
                      )}
                      <blockquote className="border-hairline mt-1 border-l-4 pl-3 italic">
                        {k.sentence}
                      </blockquote>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Źródło:{" "}
                        <a
                          href={info?.sourceUrl ?? `/library/${k.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Biblioteka Innowacji Społecznych ROPS
                          <span className="sr-only">
                            {" "}
                            (otwiera się w nowej karcie)
                          </span>
                        </a>
                        {info?.capturedAt &&
                          `, stan na ${fmtDate(info.capturedAt)}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
