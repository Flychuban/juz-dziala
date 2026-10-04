import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export type Crumb = { label: string; href: string };

/**
 * PageHeader — the editorial top of a page: a surface band with an optional
 * eyebrow, the page's single <h1>, and a lead paragraph (max ~68ch).
 *
 * @param eyebrow     Small line above the title (module or section name).
 * @param title       The page title — rendered as the only <h1>.
 * @param lead        One or two plain sentences under the title.
 * @param breadcrumbs Ancestors (not the current page). The last one is also
 *                    shown on phones as a „Wstecz"-style back link.
 * @param children    Extra content under the lead: tags, badges, actions.
 * @param width       Container width: "default" (max-w-6xl) or "narrow".
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  breadcrumbs,
  children,
  width = "default",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  breadcrumbs?: Crumb[];
  children?: React.ReactNode;
  width?: "default" | "narrow";
  className?: string;
}) {
  const t = useTranslations("common.kit");
  const parent = breadcrumbs?.at(-1);
  return (
    <header
      data-slot="page-header"
      className={cn("border-hairline bg-surface border-b", className)}
    >
      <div
        className={cn(
          "mx-auto px-4 pt-6 pb-10 md:pt-8 md:pb-14",
          width === "narrow" ? "max-w-4xl" : "max-w-6xl",
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label={t("breadcrumb")} className="mb-6 md:mb-8">
            {parent ? (
              <Link
                href={parent.href}
                className="text-foreground inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-1 underline-offset-4 md:hidden"
              >
                <ChevronLeftIcon aria-hidden="true" className="size-5" />
                {t("backTo", { label: parent.label })}
              </Link>
            ) : null}
            <ol className="text-muted-foreground hidden flex-wrap items-center gap-x-2 text-[0.9375rem] md:flex">
              {breadcrumbs.map((c) => (
                <li key={c.href} className="flex items-center gap-2">
                  <Link
                    href={c.href}
                    className="text-foreground inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                  >
                    {c.label}
                  </Link>
                  <span aria-hidden="true">/</span>
                </li>
              ))}
              <li aria-current="page" className="line-clamp-1 max-w-[40ch]">
                {typeof title === "string" ? title : null}
              </li>
            </ol>
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="text-primary mb-3 text-[0.9375rem] font-bold tracking-wide">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-foreground max-w-[22ch] text-[2.125rem] leading-[1.1] font-bold tracking-tight md:max-w-[26ch] md:text-5xl">
          {title}
        </h1>
        {lead ? (
          <div className="text-foreground/85 mt-5 max-w-[62ch] text-lg leading-relaxed md:text-xl">
            {lead}
          </div>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </header>
  );
}
