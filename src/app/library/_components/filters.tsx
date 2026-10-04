import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useLabels } from "~/i18n/use-labels";
import { type MapaArea } from "~/lib/domain";
import { cn } from "~/lib/utils";

export type LibraryParams = {
  q?: string;
  area?: MapaArea;
  category?: string;
  video?: boolean;
};

/** Builds a /library URL from the current params plus changes (undefined removes). */
export function libraryHref(
  current: LibraryParams,
  change: Partial<
    Record<keyof LibraryParams, string | boolean | undefined>
  > = {},
) {
  const next = { ...current, ...change } as Record<string, unknown>;
  const sp = new URLSearchParams();
  if (typeof next.q === "string" && next.q) sp.set("q", next.q);
  if (typeof next.area === "string" && next.area) sp.set("area", next.area);
  if (typeof next.category === "string" && next.category)
    sp.set("category", next.category);
  if (next.video === true) sp.set("video", "1");
  const s = sp.toString();
  return s ? `/library?${s}` : "/library";
}

/** One filter option: a full-width row with a radio- or check-like marker. */
function Option({
  href,
  selected,
  count,
  marker = "radio",
  children,
}: {
  href: string;
  selected: boolean;
  count?: number;
  marker?: "radio" | "check";
  children: React.ReactNode;
}) {
  const t = useTranslations("library.filters");
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "text-foreground hover:bg-surface flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left leading-snug no-underline transition-colors",
        selected && "bg-accent hover:bg-accent",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-background flex size-5 shrink-0 items-center justify-center border-2",
          marker === "radio" ? "rounded-full" : "rounded-sm",
          selected ? "border-primary" : "border-input",
          selected &&
            marker === "check" &&
            "bg-primary text-primary-foreground",
        )}
      >
        {selected ? (
          marker === "radio" ? (
            <span className="bg-primary size-2.5 rounded-full" />
          ) : (
            <CheckIcon className="size-3.5" strokeWidth={3} />
          )
        ) : null}
      </span>
      <span
        className={cn("min-w-0 flex-1", selected ? "font-bold" : "font-medium")}
      >
        {children}
      </span>
      {count !== undefined ? (
        <span className="text-muted-foreground tabular text-[0.9375rem]">
          <span className="sr-only">{t("countSr")} </span>
          {count}
        </span>
      ) : null}
      {selected ? <span className="sr-only"> {t("selectedSr")}</span> : null}
    </Link>
  );
}

/**
 * Filter groups as links (work without JavaScript, shareable URLs).
 * One choice per group; clicking the chosen option removes it.
 */
export function LibraryFilters({
  params,
  areas,
  categories,
  withVideo,
}: {
  params: LibraryParams;
  areas: { key: MapaArea; count: number }[];
  categories: { slug: string; label: string; count: number }[];
  withVideo: number;
}) {
  const t = useTranslations("library.filters");
  const labels = useLabels();
  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-lg font-bold">{t("area")}</h3>
        <ul className="-mx-2 mt-2 flex flex-col gap-0.5">
          {areas.map((a) => {
            const selected = params.area === a.key;
            return (
              <li key={a.key}>
                <Option
                  href={libraryHref(params, {
                    area: selected ? undefined : a.key,
                  })}
                  selected={selected}
                  count={a.count}
                >
                  {labels.area[a.key]}
                </Option>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="font-display text-lg font-bold">{t("category")}</h3>
        <ul className="-mx-2 mt-2 flex flex-col gap-0.5">
          {categories.map((c) => {
            const selected = params.category === c.slug;
            return (
              <li key={c.slug}>
                <Option
                  href={libraryHref(params, {
                    category: selected ? undefined : c.slug,
                  })}
                  selected={selected}
                  count={c.count}
                >
                  {c.label}
                </Option>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="font-display text-lg font-bold">{t("video")}</h3>
        <ul className="-mx-2 mt-2 flex flex-col">
          <li>
            <Option
              href={libraryHref(params, { video: !params.video })}
              selected={!!params.video}
              count={withVideo}
              marker="check"
            >
              {t("videoOnly")}
            </Option>
          </li>
        </ul>
      </section>
    </div>
  );
}

/** „Wybrane filtry" — each active filter as a removable link. */
export function ActiveFilters({
  params,
  categoryLabel,
}: {
  params: LibraryParams;
  categoryLabel?: string;
}) {
  const t = useTranslations("library.filters");
  const labels = useLabels();
  const items: { label: string; href: string }[] = [];
  if (params.q)
    items.push({
      label: t("query", { q: params.q }),
      href: libraryHref(params, { q: undefined }),
    });
  if (params.area)
    items.push({
      label: labels.area[params.area],
      href: libraryHref(params, { area: undefined }),
    });
  if (params.category)
    items.push({
      label: categoryLabel ?? params.category,
      href: libraryHref(params, { category: undefined }),
    });
  if (params.video)
    items.push({
      label: t("videoOnly"),
      href: libraryHref(params, { video: false }),
    });
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-[0.9375rem] font-semibold">
        {t("chosen")}
      </span>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              scroll={false}
              className="border-input bg-surface text-foreground hover:border-foreground inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-[0.9375rem] font-semibold no-underline"
            >
              <span className="sr-only">{t("removeSr")} </span>
              {i.label}
              <XIcon aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 1 ? (
        <Link
          href="/library"
          scroll={false}
          className="text-foreground inline-flex min-h-11 items-center px-1 text-[0.9375rem] font-semibold underline decoration-1 underline-offset-4"
        >
          {t("clearAll")}
        </Link>
      ) : null}
    </div>
  );
}
