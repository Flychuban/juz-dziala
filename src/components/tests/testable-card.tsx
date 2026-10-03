import Link from "next/link";
import { AwardIcon, FlaskConicalIcon, StarIcon } from "lucide-react";

import { AreaTag } from "~/components/kit";
import { Button } from "~/components/ui/button";
import type { MapaArea } from "~/lib/domain";

export type TestableCardData = {
  slug: string;
  title: string;
  summary: string;
  areas: MapaArea[];
  badge: string | null;
  testingOpen: boolean;
};

/** One innovation on /test: title (to the library card), summary and the two actions. */
export function TestableCard({ item, headingLevel = "h3" }: { item: TestableCardData; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const base = `/test?innovation=${encodeURIComponent(item.slug)}`;
  return (
    <article className="border-hairline bg-background flex h-full flex-col gap-3 rounded-lg border p-5">
      <div className="flex flex-wrap gap-2">
        {item.testingOpen ? (
          <span className="border-primary text-primary inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-sm font-semibold">
            <FlaskConicalIcon aria-hidden="true" className="size-4" />
            Szuka testerów
          </span>
        ) : null}
        {item.badge ? (
          <span className="border-brand-accent text-brand-accent inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-sm font-semibold">
            <AwardIcon aria-hidden="true" className="size-4" />
            Wybrana do upowszechniania
          </span>
        ) : null}
      </div>
      <H className="font-display text-xl leading-snug font-bold">
        <Link href={`/library/${item.slug}`} className="underline decoration-1 underline-offset-4 hover:decoration-2">
          {item.title}
        </Link>
      </H>
      <p className="line-clamp-3">{item.summary}</p>
      {item.areas.length ? (
        <div className="flex flex-wrap gap-2">
          {item.areas.map((a) => (
            <AreaTag key={a} area={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-3 pt-2">
        <Button asChild size="sm">
          <Link href={`${base}&mode=signup`} aria-label={`Chcę testować: ${item.title}`}>
            <FlaskConicalIcon aria-hidden="true" />
            Chcę testować
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={`${base}&mode=rate`} aria-label={`Oceń: ${item.title}`}>
            <StarIcon aria-hidden="true" />
            Oceń
          </Link>
        </Button>
      </div>
    </article>
  );
}
