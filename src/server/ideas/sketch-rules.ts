/**
 * „Szkic pomysłu" — a small schematic picture of an idea, drawn by the AI as
 * DATA (shapes with numbers), never as SVG markup. Everything the model returns
 * is checked here (unit-tested): kinds come from a fixed list, every number is
 * finite and clamped to the 400 × 300 canvas, colours come from a fixed
 * palette, texts are cut short. The page renders the result itself.
 */
import { z } from "zod";

export const SKETCH_W = 400;
export const SKETCH_H = 300;
export const SKETCH_MAX_SHAPES = 24;

export const SKETCH_KINDS = ["rect", "circle", "ellipse", "line", "arrow", "text"] as const;
export type SketchKind = (typeof SKETCH_KINDS)[number];

/** Light fills that keep dark text and outlines readable (AAA on every one). */
export const SKETCH_PALETTE = {
  white: "#ffffff",
  blue: "#dce9f7",
  green: "#dcefdc",
  yellow: "#fbf0c4",
  orange: "#fbe1cc",
  grey: "#e6e6e6",
} as const;
export type SketchColour = keyof typeof SKETCH_PALETTE;
export const SKETCH_COLOURS = Object.keys(SKETCH_PALETTE) as SketchColour[];
export const SKETCH_INK = "#1a1a1a";

/**
 * What the model is asked for. Flat and permissive on purpose (the SDK drops
 * min/max): every check happens in `finalizeSketch`.
 *  - rect: x, y = top-left corner; w, h = size
 *  - circle: x, y = centre; r = radius
 *  - ellipse: x, y = centre; w, h = full width and height
 *  - line / arrow: from x, y to x2, y2 (the arrow points at x2, y2)
 *  - text: x, y = middle of the text baseline; label = the text
 */
export const sketchOutputSchema = z.object({
  title: z.string(),
  altText: z.string(),
  shapes: z.array(
    z.object({
      kind: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number().nullable(),
      h: z.number().nullable(),
      r: z.number().nullable(),
      x2: z.number().nullable(),
      y2: z.number().nullable(),
      fill: z.string().nullable(),
      label: z.string().nullable(),
    }),
  ),
});
export type SketchOutput = z.infer<typeof sketchOutputSchema>;

export type SketchShape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: SketchColour; label: string | null }
  | { kind: "circle"; x: number; y: number; r: number; fill: SketchColour; label: string | null }
  | { kind: "ellipse"; x: number; y: number; w: number; h: number; fill: SketchColour; label: string | null }
  | { kind: "line" | "arrow"; x: number; y: number; x2: number; y2: number; label: string | null }
  | { kind: "text"; x: number; y: number; label: string };

export type Sketch = { title: string; altText: string; shapes: SketchShape[] };

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => round(Math.min(hi, Math.max(lo, n)));
const finite = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

function clip(s: string | null | undefined, max: number): string {
  // No markup or control characters survive, even though React escapes text anyway.
  const t = Array.from(s ?? "", (ch) => (ch.charCodeAt(0) < 32 || ch === "<" || ch === ">" ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const colour = (c: string | null): SketchColour =>
  c && (SKETCH_COLOURS as string[]).includes(c.trim().toLowerCase()) ? (c.trim().toLowerCase() as SketchColour) : "white";

/** Turns the model's answer into a safe scene, or null when nothing drawable is left. */
export function finalizeSketch(out: SketchOutput): Sketch | null {
  const shapes: SketchShape[] = [];
  for (const s of out.shapes) {
    if (shapes.length >= SKETCH_MAX_SHAPES) break;
    const kind = s.kind.trim().toLowerCase();
    if (!(SKETCH_KINDS as readonly string[]).includes(kind) || !finite(s.x) || !finite(s.y)) continue;
    const label = clip(s.label, 40) || null;
    const x = clamp(s.x, 0, SKETCH_W);
    const y = clamp(s.y, 0, SKETCH_H);
    switch (kind as SketchKind) {
      case "rect": {
        if (!finite(s.w) || !finite(s.h)) continue;
        const rx = clamp(s.x, 0, SKETCH_W - 4);
        const ry = clamp(s.y, 0, SKETCH_H - 4);
        shapes.push({ kind: "rect", x: rx, y: ry, w: clamp(s.w, 4, SKETCH_W - rx), h: clamp(s.h, 4, SKETCH_H - ry), fill: colour(s.fill), label });
        break;
      }
      case "circle": {
        if (!finite(s.r)) continue;
        const r = clamp(s.r, 2, Math.min(x, y, SKETCH_W - x, SKETCH_H - y, 150));
        if (r < 2) continue;
        shapes.push({ kind: "circle", x, y, r, fill: colour(s.fill), label });
        break;
      }
      case "ellipse": {
        if (!finite(s.w) || !finite(s.h)) continue;
        const w = clamp(s.w, 4, 2 * Math.min(x, SKETCH_W - x));
        const h = clamp(s.h, 4, 2 * Math.min(y, SKETCH_H - y));
        if (w < 4 || h < 4) continue;
        shapes.push({ kind: "ellipse", x, y, w, h, fill: colour(s.fill), label });
        break;
      }
      case "line":
      case "arrow": {
        if (!finite(s.x2) || !finite(s.y2)) continue;
        const x2 = clamp(s.x2, 0, SKETCH_W);
        const y2 = clamp(s.y2, 0, SKETCH_H);
        if (Math.hypot(x2 - x, y2 - y) < 4) continue;
        shapes.push({ kind: kind as "line" | "arrow", x, y, x2, y2, label });
        break;
      }
      case "text": {
        if (!label) continue;
        shapes.push({ kind: "text", x: clamp(s.x, 8, SKETCH_W - 8), y: clamp(s.y, 14, SKETCH_H - 4), label });
        break;
      }
    }
  }
  const title = clip(out.title, 80);
  const altText = clip(out.altText, 700);
  if (shapes.length === 0 || !title || !altText) return null;
  return { title, altText, shapes };
}

/** Where a shape's label is written (centre of the shape, the middle of a line). */
export function labelPoint(s: SketchShape): { x: number; y: number } {
  switch (s.kind) {
    case "rect":
      return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
    case "circle":
    case "ellipse":
    case "text":
      return { x: s.x, y: s.y };
    case "line":
    case "arrow":
      return { x: (s.x + s.x2) / 2, y: (s.y + s.y2) / 2 - 6 };
  }
}
