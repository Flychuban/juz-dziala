import { CheckIcon, CircleDotIcon, CircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { CaseStatus } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { fmtDateTime } from "./format";

export type TimelineStep = {
  status: CaseStatus;
  reached: boolean;
  current: boolean;
  at: Date | string | null;
};

/**
 * Przyjęta → Czytamy → Szukamy odpowiedzi → Masz odpowiedź, in resident words
 * (messages `cases.status.*`). State is in text, not colour.
 */
export function StatusTimeline({
  steps,
  className,
}: {
  steps: TimelineStep[];
  className?: string;
}) {
  const t = useTranslations("cases");
  const locale = useLocale();
  return (
    <ol
      className={cn(
        "grid gap-2 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none",
        className,
      )}
    >
      {steps.map((s, i) => (
        <li
          key={s.status}
          aria-current={s.current ? "step" : undefined}
          className={cn(
            "border-hairline flex gap-3 rounded-md border p-3",
            s.current && "border-primary border-2",
            !s.reached && "text-muted-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
              s.reached && !s.current && "bg-primary text-primary-foreground",
              s.current && "border-primary text-primary border-2",
            )}
          >
            {s.current ? (
              <CircleDotIcon className="size-4" />
            ) : s.reached ? (
              <CheckIcon className="size-4" />
            ) : (
              <CircleIcon className="size-3" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">
              <span className="sr-only">
                {t("timeline.step", { n: i + 1 })}{" "}
              </span>
              {t(`status.${s.status}`)}
            </span>
            <span className="text-sm">
              {s.current
                ? t("timeline.now")
                : s.reached
                  ? t("timeline.done")
                  : t("timeline.next")}
              {s.at ? ` · ${fmtDateTime(s.at, locale)}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
