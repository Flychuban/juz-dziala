"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { PrinterIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  labelPoint,
  SKETCH_H,
  SKETCH_INK,
  SKETCH_PALETTE,
  SKETCH_W,
  type Sketch,
  type SketchShape,
} from "~/server/ideas/sketch-rules";

const PRINT_FLAG = "printSketch";

/** Wraps a label into lines of about `max` characters (SVG text does not wrap). */
function lines(label: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of label.split(" ")) {
    if (line && (line + " " + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

function Label({ shape }: { shape: SketchShape }) {
  if (!shape.label) return null;
  const { x, y } = labelPoint(shape);
  const width = shape.kind === "rect" || shape.kind === "ellipse" ? shape.w : shape.kind === "circle" ? shape.r * 2 : 140;
  const ls = lines(shape.label, Math.max(8, Math.floor(width / 7)));
  const top = y - ((ls.length - 1) * 14) / 2;
  return (
    <text
      x={x}
      y={top}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={shape.kind === "text" ? 14 : 12}
      fontWeight={shape.kind === "text" ? 700 : 600}
      fill={SKETCH_INK}
      // A white halo keeps labels readable where they cross lines.
      stroke="#ffffff"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {ls.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function Shape({ shape, arrowId }: { shape: SketchShape; arrowId: string }) {
  const stroke = { stroke: SKETCH_INK, strokeWidth: 2 };
  switch (shape.kind) {
    case "rect":
      return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={6} fill={SKETCH_PALETTE[shape.fill]} {...stroke} />;
    case "circle":
      return <circle cx={shape.x} cy={shape.y} r={shape.r} fill={SKETCH_PALETTE[shape.fill]} {...stroke} />;
    case "ellipse":
      return <ellipse cx={shape.x} cy={shape.y} rx={shape.w / 2} ry={shape.h / 2} fill={SKETCH_PALETTE[shape.fill]} {...stroke} />;
    case "line":
      return <line x1={shape.x} y1={shape.y} x2={shape.x2} y2={shape.y2} strokeLinecap="round" {...stroke} />;
    case "arrow":
      return <line x1={shape.x} y1={shape.y} x2={shape.x2} y2={shape.y2} strokeLinecap="round" markerEnd={`url(#${arrowId})`} {...stroke} />;
    case "text":
      return null;
  }
}

/**
 * „Szkic pomysłu" drawn by the page from checked data (never from model SVG):
 * role="img" named by its title and described by the full alt text. Prints on
 * its own with „Drukuj szkic".
 */
export function IdeaSketch({ sketch }: { sketch: Sketch }) {
  const t = useTranslations("ideas.sketch");
  const uid = useId().replace(/:/g, "");
  const titleId = `sketch-title-${uid}`;
  const descId = `sketch-desc-${uid}`;
  const arrowId = `sketch-arrow-${uid}`;

  useEffect(() => {
    const done = () => delete document.documentElement.dataset[PRINT_FLAG];
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  function print() {
    document.documentElement.dataset[PRINT_FLAG] = "1";
    window.print();
  }

  return (
    <figure id="idea-sketch" className="flex flex-col gap-3">
      <style>{`@media print {
  html[data-print-sketch] body * { visibility: hidden !important; }
  html[data-print-sketch] #idea-sketch, html[data-print-sketch] #idea-sketch * { visibility: visible !important; }
  html[data-print-sketch] #idea-sketch { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 12mm; }
  html[data-print-sketch] #idea-sketch .sketch-actions { display: none; }
}`}</style>
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`}
        className="border-hairline h-auto w-full rounded-md border bg-white"
      >
        <title id={titleId}>{sketch.title}</title>
        <desc id={descId}>{sketch.altText}</desc>
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={SKETCH_INK} />
          </marker>
        </defs>
        {sketch.shapes.map((s, i) => (
          <Shape key={`s${i}`} shape={s} arrowId={arrowId} />
        ))}
        {sketch.shapes.map((s, i) => (
          <Label key={`l${i}`} shape={s} />
        ))}
      </svg>
      <figcaption className="flex flex-col gap-1">
        <span className="font-semibold">{sketch.title}</span>
        <span className="text-muted-foreground text-sm">{t("disclaimer")}</span>
      </figcaption>
      <details className="text-[0.9375rem]">
        <summary className="min-h-12 cursor-pointer py-2 font-semibold">{t("describe")}</summary>
        <p>{sketch.altText}</p>
      </details>
      <div className="sketch-actions">
        <Button type="button" variant="outline" onClick={print}>
          <PrinterIcon aria-hidden="true" />
          {t("print")}
        </Button>
      </div>
    </figure>
  );
}
