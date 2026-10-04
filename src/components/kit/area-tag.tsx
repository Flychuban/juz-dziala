import Link from "next/link";

import { useLabels } from "~/i18n/use-labels";
import { type MapaArea } from "~/lib/domain";
import { cn } from "~/lib/utils";

/**
 * AreaTag — the Mapa Wyzwań area of a card („Seniorzy", „Bezdomność" …),
 * labelled from MAPA_AREA_LABEL. With `href` it becomes a 44 px link.
 */
export function AreaTag({
  area,
  href,
  className,
}: {
  area: MapaArea;
  href?: string;
  className?: string;
}) {
  const label = useLabels().area[area] ?? area;
  const base =
    "border-hairline bg-surface text-foreground inline-flex w-fit max-w-full items-center gap-1.5 rounded-sm border px-2 py-0.5 text-sm leading-snug font-semibold [overflow-wrap:anywhere]";
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "border-input bg-background hover:bg-surface min-h-11 px-3 no-underline",
          className,
        )}
      >
        <span aria-hidden="true" className="bg-primary size-1.5 rounded-full" />
        {label}
      </Link>
    );
  }
  return (
    <span data-slot="area-tag" className={cn(base, className)}>
      <span aria-hidden="true" className="bg-primary size-1.5 rounded-full" />
      {label}
    </span>
  );
}
