"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CircleAlertIcon, LightbulbIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { type MapaArea } from "~/lib/domain";
import { api } from "~/trpc/react";

/**
 * „Zaproponuj temat naboru" for one white spot. The AI draft is shown
 * labelled as a draft for ROPS staff, never as a decision, and is written in
 * the staff member's language.
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
  const t = useTranslations("admin.trends.topic");
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
        {propose.isPending ? t("proposing") : t("propose")}
        <span className="sr-only">: {label}</span>
      </Button>
      <div aria-live="polite">
        {propose.error || (res && !res.ok) ? (
          <Alert variant="warning" className="mt-4">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{t("noProposal")}</AlertTitle>
            <AlertDescription>
              {res && !res.ok ? res.message : (propose.error?.message ?? "")}
            </AlertDescription>
          </Alert>
        ) : null}
        {res?.ok ? (
          <section className="border-primary mt-4 border-l-4 pl-4">
            <p className="border-input inline-flex rounded-sm border border-dashed px-2 py-0.5 text-sm font-bold">
              {t("draftBadge")}
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
                <dt className="font-bold">{t("problem")}</dt>
                <dd>{res.draft.problem}</dd>
              </div>
              <div>
                <dt className="font-bold">{t("targetGroup")}</dt>
                <dd>{res.draft.targetGroup}</dd>
              </div>
              <div>
                <dt className="font-bold">{t("whyNoExistingFits")}</dt>
                <dd>{res.draft.whyNoExistingFits}</dd>
              </div>
              <div>
                <dt className="font-bold">{t("expectedChange")}</dt>
                <dd>{res.draft.expectedChange}</dd>
              </div>
              {res.draft.questionsForRops.length ? (
                <div>
                  <dt className="font-bold">{t("questions")}</dt>
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
              {t("basedOn", { count: res.basedOn })}
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
