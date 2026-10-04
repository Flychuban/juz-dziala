"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

export type MapShape = {
  key: string;
  name: string;
  d: string;
  value: number | null;
  fill: string;
  highlighted: boolean;
  href: string | null;
};

const NUM: Record<"pl" | "en", Intl.NumberFormat> = {
  pl: new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }),
};

/**
 * The interactive SVG for PowiatMap (client). Every powiat is focusable
 * (a link when `href` is set); hover or focus outlines it and shows
 * „Powiat X: N" under the map. Use PowiatMap, not this, in pages.
 */
export function PowiatMapSvg({
  width,
  height,
  shapes,
  label,
  locale = "pl",
}: {
  width: number;
  height: number;
  shapes: MapShape[];
  label: string;
  /** Number format of the values; default Polish. */
  locale?: "pl" | "en";
}) {
  const t = useTranslations("municipality.map");
  const describe = (s: MapShape) => {
    const name = s.name.charAt(0).toUpperCase() + s.name.slice(1);
    return `${name}: ${s.value === null ? t("noData") : NUM[locale].format(s.value)}`;
  };
  const [active, setActive] = useState<string | null>(null);
  const titleId = useId();
  const current = shapes.find((s) => s.key === active) ?? null;
  const highlighted = shapes.filter((s) => s.highlighted);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={titleId}
        className="h-auto w-full"
        onMouseLeave={() => setActive(null)}
      >
        <title id={titleId}>{t("svgTitle", { label })}</title>
        {shapes.map((s) => {
          const path = (
            <path
              d={s.d}
              fill={s.fill}
              stroke="var(--input)"
              strokeWidth={0.75}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="outline-none"
            />
          );
          const common = {
            onMouseEnter: () => setActive(s.key),
            onFocus: () => setActive(s.key),
            onBlur: () => setActive((a) => (a === s.key ? null : a)),
            "aria-label": describe(s),
          };
          return s.href ? (
            <a key={s.key} href={s.href} {...common} className="outline-none">
              {path}
            </a>
          ) : (
            <g
              key={s.key}
              tabIndex={0}
              role="img"
              {...common}
              className="outline-none"
            >
              {path}
            </g>
          );
        })}
        {/* highlight + active outlines drawn on top so neighbours never cover them */}
        <g aria-hidden="true" pointerEvents="none">
          {highlighted.map((s) => (
            <path
              key={`hl-${s.key}`}
              d={s.d}
              fill="none"
              stroke="var(--brand-accent)"
              strokeWidth={3}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {current ? (
            <>
              <path
                d={current.d}
                fill="none"
                stroke="var(--focus)"
                strokeWidth={7}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={current.d}
                fill="none"
                stroke="var(--ring)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
        </g>
      </svg>
      <figcaption
        aria-hidden="true"
        className="border-hairline mt-2 min-h-12 border-t pt-2 text-base"
      >
        {current ? (
          <span className="font-semibold">{describe(current)}</span>
        ) : (
          <span className="text-muted-foreground">{t("hint")}</span>
        )}
      </figcaption>
    </figure>
  );
}
