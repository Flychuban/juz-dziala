import Link from "next/link";
import { AwardIcon, PlayCircleIcon } from "lucide-react";

import { type MapaArea } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { AreaTag } from "./area-tag";
import { Highlight } from "./highlight";

export type InnovationCardData = {
  slug: string;
  title: string;
  areas: MapaArea[];
  categoryLabels?: string[];
  summary: string;
  videoUrl?: string | null;
  badge?: string | null;
};

/**
 * InnovationCard — one Biblioteka card in a grid: category eyebrow, title
 * (the whole card is the link), Mapa areas, a two-line summary and the
 * „Film" / „Wybrana do upowszechniania" markers in words.
 *
 * @param item          A row from `library.list`.
 * @param headingLevel  h2 (default) or h3 to fit the page outline.
 * @param terms         Words to mark in the title and summary (e.g. the search).
 */
export function InnovationCard({
  item,
  headingLevel = "h2",
  terms,
  className,
}: {
  item: InnovationCardData;
  headingLevel?: "h2" | "h3";
  terms?: readonly string[];
  className?: string;
}) {
  const H = headingLevel;
  return (
    <article
      data-slot="innovation-card"
      className={cn(
        "group border-hairline bg-card hover:border-input focus-within:border-input relative flex h-full flex-col rounded-lg border p-5 transition-colors md:p-6",
        className,
      )}
    >
      {item.categoryLabels && item.categoryLabels.length > 0 ? (
        <p className="text-muted-foreground mb-2 text-sm font-bold tracking-wide">
          {item.categoryLabels.join(" · ")}
        </p>
      ) : null}
      <H className="font-display text-xl leading-snug font-bold tracking-tight">
        <Link
          href={`/library/${item.slug}`}
          className="text-foreground decoration-primary decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-lg"
        >
          {terms?.length ? (
            <Highlight text={item.title} terms={terms} />
          ) : (
            item.title
          )}
        </Link>
      </H>
      <p className="text-foreground/85 mt-2 line-clamp-2 text-base leading-snug">
        {terms?.length ? (
          <Highlight text={item.summary} terms={terms} />
        ) : (
          item.summary
        )}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {item.areas.map((a) => (
          <AreaTag key={a} area={a} />
        ))}
        {item.videoUrl ? (
          <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
            <PlayCircleIcon
              aria-hidden="true"
              className="text-primary size-5"
            />
            Film
          </span>
        ) : null}
      </div>
      {item.badge ? (
        <p className="border-hairline text-brand-accent mt-4 flex items-center gap-2 border-t pt-3 text-sm font-bold">
          <AwardIcon aria-hidden="true" className="size-5 shrink-0" />
          Wybrana do upowszechniania
        </p>
      ) : null}
    </article>
  );
}
