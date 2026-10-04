import { useLocale, useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { formatDate, isoDate } from "./format";

export type TimelineItem = {
  /** What happens at this stage, e.g. „Sprawa przyjęta". */
  label: string;
  /** When it happened (done/current); omit for future stages. */
  date?: Date | string | null;
  state: "done" | "current" | "todo";
  /** Optional one-line note under the label. */
  note?: string | null;
};


/**
 * StatusTimeline — where a sprawa stands. A vertical ordered list; each
 * stage states its status in words (never colour alone): done stages show a
 * check, the current one is marked „Teraz" and `aria-current="step"`.
 *
 * @param items    Stages in order.
 * @param label    Accessible name of the list; defaults to „Etapy sprawy".
 */
export function StatusTimeline({
  items,
  label,
  className,
}: {
  items: TimelineItem[];
  label?: string;
  className?: string;
}) {
  const t = useTranslations("common.kit.timeline");
  const locale = useLocale();
  return (
    <ol
      data-slot="status-timeline"
      aria-label={label ?? t("label")}
      className={cn("relative", className)}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const date = formatDate(item.date, locale);
        return (
          <li
            key={`${item.label}-${i}`}
            aria-current={item.state === "current" ? "step" : undefined}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-8 bottom-0 left-[0.9375rem] w-0.5",
                  item.state === "done" ? "bg-primary" : "bg-hairline",
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                item.state === "done" &&
                  "border-primary bg-primary text-primary-foreground",
                item.state === "current" &&
                  "border-primary bg-background ring-primary/25 ring-4",
                item.state === "todo" && "border-input bg-background",
              )}
            >
              {item.state === "done" ? (
                <CheckIcon className="size-4" strokeWidth={3} />
              ) : item.state === "current" ? (
                <span className="bg-primary size-3 rounded-full" />
              ) : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "leading-snug",
                  item.state === "current" ? "font-bold" : "font-semibold",
                  item.state === "todo" && "text-muted-foreground font-normal",
                )}
              >
                {item.label}
                <span className="sr-only"> ({t(item.state)})</span>
                {item.state === "current" ? (
                  <span
                    aria-hidden="true"
                    className="border-primary text-primary ml-2 inline-flex rounded-sm border px-1.5 text-sm font-bold"
                  >
                    {t("now")}
                  </span>
                ) : null}
              </p>
              {date ? (
                <p className="text-muted-foreground tabular text-sm">
                  <time dateTime={isoDate(item.date)}>{date}</time>
                </p>
              ) : null}
              {item.note ? (
                <p className="text-foreground/85 mt-1 text-base">{item.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
