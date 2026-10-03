/**
 * Assembles the streamed Ramowy Plan Wdrożenia from the model's Markdown.
 *
 * The model writes sections 1, 3, 4, 5, 6, 8 and 9. This line-based filter:
 *  - prints OUR header first and drops anything the model wrote before its
 *    first numbered section (and any `# title` of its own);
 *  - splices in sections 2, 7 and 10 (scale, budget, funding — computed on
 *    the server) at their place, and drops the model's version if it wrote one;
 *  - fills any AI section the model skipped or never reached (an error, a
 *    refusal, max tokens) with the template's version, in order — so the plan
 *    is always complete;
 *  - replaces each `[[c005.s3]]` with OUR text of that card sentence, cited
 *    by its card section (the id itself is never printed), and deletes ids
 *    that are not on the card. The model never prints a quote.
 *
 * Pure: `createPlanAssembler` works on strings, `assemblePlanStream` wraps it
 * for a byte stream.
 */
import { quoteSentence, SECTION_NUMBERS, type SectionNumber } from "./plan-template";
import type { CardSentence } from "./types";

/** Messages `aiStream` writes into the text when it fails. */
const AI_FAILURE_LINES = new Set([
  "_Asystent AI jest chwilowo niedostępny._",
  "_Wystąpił błąd generowania. Spróbuj ponownie._",
  "_Nie udało się wygenerować dokumentu._",
]);

const SECTION_HEADING = /^##\s+(\d{1,2})\.\s/;
const CITATION = /\[\[\s*([A-Za-z0-9._-]{1,40})\s*\]\]/g;
/** A sentence id the model wrote outside [[…]] — internal, never printed. */
const BARE_ID = /\s*\(?(?:zdani[ea]\s+)?\bc\d{3,4}\.s\d{1,3}\b\)?/g;

export type AssemblerOptions = {
  header: string;
  /** Every section 1–10, heading included (the template). */
  sections: Record<SectionNumber, string>;
  /** Sections always printed from `sections`, never from the model. */
  fixed: readonly SectionNumber[];
  /** Sentence id → our sentence (text + section), for this card only. */
  sentences: ReadonlyMap<string, Pick<CardSentence, "text" | "section">>;
  footer: (o: { fallbackUsed: boolean }) => string;
};

export type PlanAssembler = {
  start(): string;
  push(chunk: string): string;
  end(): string;
  /** True once any AI section had to come from the template. */
  readonly fallbackUsed: boolean;
};

export function createPlanAssembler(opts: AssemblerOptions): PlanAssembler {
  const fixed = new Set<number>(opts.fixed);
  const seen = new Set<number>();
  let buffer = "";
  let dropping = true; // until the model's first numbered section
  let fallbackUsed = false;

  const emitSection = (n: SectionNumber): string => {
    seen.add(n);
    if (!fixed.has(n)) fallbackUsed = true;
    return `\n${opts.sections[n]}\n`;
  };

  /** Everything not yet printed with a number below `n`, in order. */
  const flushBefore = (n: number): string => {
    let out = "";
    for (const k of SECTION_NUMBERS) {
      if (k >= n) break;
      if (!seen.has(k)) out += emitSection(k);
    }
    return out;
  };

  const resolveCitations = (line: string): string =>
    line
      .replace(CITATION, (_m, id: string) => {
        const sentence = opts.sentences.get(id);
        // A NUL marks our own quote so the id scrub below cannot touch it.
        return sentence ? `\u0000${quoteSentence(sentence)}\u0000` : "";
      })
      .split("\u0000")
      .map((part, i) => (i % 2 === 1 ? part : part.replace(BARE_ID, "")))
      .join("");

  const processLine = (line: string): string => {
    const trimmed = line.trim();
    if (AI_FAILURE_LINES.has(trimmed)) {
      dropping = true;
      return "";
    }
    const m = SECTION_HEADING.exec(line);
    if (m) {
      const n = Number(m[1]);
      const known = (SECTION_NUMBERS as readonly number[]).includes(n);
      let out = flushBefore(known ? n : 11);
      if (!known || fixed.has(n) || seen.has(n)) {
        // Ours (or a duplicate / an extra the plan does not have): print
        // our version once and skip what the model wrote under it.
        if (known && !seen.has(n)) out += emitSection(n as SectionNumber);
        dropping = true;
        return out;
      }
      seen.add(n);
      dropping = false;
      // Our wording of the heading, whatever the model called it.
      const heading = opts.sections[n as SectionNumber].split("\n")[0] ?? line;
      return `${out}\n${heading}\n`;
    }
    if (/^#\s/.test(line)) return ""; // the model's own title
    if (dropping) return "";
    const resolved = resolveCitations(line);
    if (resolved !== line && /^\s*>\s*$/.test(resolved)) return "";
    return `${resolved}\n`;
  };

  return {
    start: () => `${opts.header}\n`,
    push(chunk: string) {
      buffer += chunk;
      let out = "";
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        out += processLine(buffer.slice(0, nl).replace(/\r$/, ""));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
      return out;
    },
    end() {
      let out = buffer ? processLine(buffer) : "";
      buffer = "";
      out += flushBefore(11);
      return out + opts.footer({ fallbackUsed });
    },
    get fallbackUsed() {
      return fallbackUsed;
    },
  };
}

/** Byte-stream wrapper for a route handler. */
export function assemblePlanStream(
  source: ReadableStream<Uint8Array>,
  opts: AssemblerOptions,
): ReadableStream<Uint8Array> {
  const asm = createPlanAssembler(opts);
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(asm.start()));
      },
      transform(chunk, c) {
        const s = asm.push(dec.decode(chunk, { stream: true }));
        if (s) c.enqueue(enc.encode(s));
      },
      flush(c) {
        const s = asm.push(dec.decode()) + asm.end();
        if (s) c.enqueue(enc.encode(s));
      },
    }),
  );
}
