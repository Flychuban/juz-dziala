"use client";

import { useEffect, useRef } from "react";
import { CircleAlertIcon, LightbulbIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { type MapaArea } from "~/lib/domain";
import { api } from "~/trpc/react";

/**
 * „Zaproponuj temat naboru" for one white spot. The AI draft is shown
 * labelled as a draft for ROPS staff, never as a decision.
 */
export function CallTopicButton({
  area,
  powiat,
  days,
  label,
}: {
  area: MapaArea | "none";
  powiat: string | null;
  days: number;
  label: string;
}) {
  const propose = api.admin.trends.proposeCallTopic.useMutation();
  const heading = useRef<HTMLHeadingElement>(null);
  const res = propose.data;

  useEffect(() => {
    if (res?.ok) heading.current?.focus();
  }, [res]);

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="secondary"
        disabled={propose.isPending}
        onClick={() => propose.mutate({ area, powiat, days })}
      >
        <LightbulbIcon aria-hidden="true" />
        {propose.isPending
          ? "Przygotowuję propozycję…"
          : "Zaproponuj temat naboru"}
        <span className="sr-only">: {label}</span>
      </Button>
      <div aria-live="polite">
        {propose.error || (res && !res.ok) ? (
          <Alert variant="warning" className="mt-4">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>Brak propozycji</AlertTitle>
            <AlertDescription>
              {res && !res.ok ? res.message : (propose.error?.message ?? "")}
            </AlertDescription>
          </Alert>
        ) : null}
        {res?.ok ? (
          <section className="border-primary bg-background mt-4 rounded-md border-2 p-5">
            <p className="border-input inline-flex rounded-sm border border-dashed px-2 py-0.5 text-sm font-bold">
              Szkic dla zespołu ROPS — do weryfikacji, nie do publikacji
            </p>
            <h4
              ref={heading}
              tabIndex={-1}
              className="font-display mt-3 text-xl font-bold outline-none"
            >
              {res.draft.title}
            </h4>
            <dl className="mt-3 space-y-3 text-base">
              <div>
                <dt className="font-bold">Problem</dt>
                <dd>{res.draft.problem}</dd>
              </div>
              <div>
                <dt className="font-bold">Dla kogo</dt>
                <dd>{res.draft.targetGroup}</dd>
              </div>
              <div>
                <dt className="font-bold">
                  Dlaczego Biblioteka tego nie pokrywa
                </dt>
                <dd>{res.draft.whyNoExistingFits}</dd>
              </div>
              <div>
                <dt className="font-bold">Oczekiwana zmiana</dt>
                <dd>{res.draft.expectedChange}</dd>
              </div>
              {res.draft.questionsForRops.length ? (
                <div>
                  <dt className="font-bold">
                    Do sprawdzenia przed ogłoszeniem
                  </dt>
                  <dd>
                    <ul className="list-disc pl-5">
                      {res.draft.questionsForRops.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="text-muted-foreground mt-4 text-sm">
              Na podstawie {res.basedOn} zanonimizowanych opisów potrzeb i kart
              Biblioteki w tym obszarze. Przygotowane przez asystenta AI.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
