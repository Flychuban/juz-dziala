/**
 * Assembles the streamed Ramowy Plan Wdrożenia from the model's Markdown.
 *
 * The model writes sections 1, 3, 4, 5, 6, 8 and 9. This line-based filter:
 *  - prints OUR header first and drops anything the model wrote before its
 *    first numbered section (and any `# title` of its own);
 *  - holds each model section until it is complete (the next heading, or the
 *    end of a stream that finished normally), so a section cut off by the
 *    deadline, an error or a refusal is never printed half-written — the
 *    template's version stands in for it;
 *  - splices in sections 2, 7 and 10 (scale, budget, funding — computed on
 *    the server) at their place, and drops the model's version if it wrote one;
 *  - fills any AI section the model skipped or never reached with the
 *    template's version, in order — so the plan is always complete;
 *  - replaces each `[[c005.s3]]` with OUR text of that card sentence, cited
 *    by its card section (the id itself is never printed), and deletes ids
 *    that are not on the card. The model never prints a quote;
 *  - recognises the failure lines `aiStream` writes, in every language;
 *  - knows at the end who wrote the plan („ai" | „mixed" | „template") and
 *    says so in the footer (and the trailer, for the browser).
 *
 * Pure: `createPlanAssembler` works on strings, `assemblePlanStream` wraps it
 * for a byte stream.
 */
import type { Locale } from "~/i18n/config";
import type { PlanSource } from "./options";
import {
  quoteSentence,
  SECTION_NUMBERS,
  TODO,
  type QuotedSentence,
  type SectionNumber,
} from "./plan-template";

const SECTION_HEADING = /^##\s+(\d{1,2})\.\s/;
const CITATION = /\[\[\s*([A-Za-z0-9._-]{1,40})\s*\]\]/g;
/** A sentence id the model wrote outside [[…]] — internal, never printed. */
const BARE_ID =
  /\s*\(?(?:(?:zdani[ea]|sentence)\s+)?\bc\d{3,4}\.s\d{1,3}\b\)?/gi;
/** The Polish gap marker the (Polish) system prompt asks the model to write. */
const TODO_PL = new RegExp(TODO.replace(/[[\]]/g, "\\$&"), "g");

export type AssemblerOptions = {
  header: string;
  /** Every section 1–10, heading included (the template). */
  sections: Record<SectionNumber, string>;
  /** Sections always printed from `sections`, never from the model. */
  fixed: readonly SectionNumber[];
  /** Sentence id → our sentence (text + section), for this card only. */
  sentences: ReadonlyMap<string, QuotedSentence>;
  /** Language of the plan (citations). Default Polish. */
  locale?: Locale;
  /** The gap marker in the plan's language; replaces „[DO UZUPEŁNIENIA]". */
  todo?: string;
  /**
   * Lines `aiStream` writes instead of text when it fails (both languages:
   * AI_STREAM_LINES in ~/server/ai/structured). Matched after trimming.
   */
  failureLines: readonly string[];
  footer: (source: PlanSource) => string;
  /** Printed after the footer, e.g. the source marker for the browser. */
  trailer?: (source: PlanSource) => string;
};

export type PlanAssembler = {
  start(): string;
  push(chunk: string): string;
  end(): string;
  /** True once any AI section had to come from the template. */
  readonly fallbackUsed: boolean;
  /** Who wrote the narrative sections (final after `end()`). */
  readonly source: PlanSource;
  /** True once a failure line arrived. */
  readonly failed: boolean;
};

export function createPlanAssembler(opts: AssemblerOptions): PlanAssembler {
  const fixed = new Set<number>(opts.fixed);
  const failures = new Set(opts.failureLines.map((l) => l.trim()));
  const locale = opts.locale ?? "pl";
  const seen = new Set<number>();
  const fromModel = new Set<number>();
  let fromTemplate = 0;
  let buffer = "";
  let dropping = true; // until the model's first numbered section
  let failed = false;
  /** The model section being written, held until it is complete. */
  let current: { n: SectionNumber; heading: string; lines: string[] } | null =
    null;

  const emitTemplate = (n: SectionNumber): string => {
    seen.add(n);
    if (!fixed.has(n)) fromTemplate++;
    return `\n${opts.sections[n]}\n`;
  };

  /** Everything not yet printed with a number below `n`, in order. */
  const flushBefore = (n: number): string => {
    let out = "";
    for (const k of SECTION_NUMBERS) {
      if (k >= n) break;
      if (!seen.has(k)) out += emitTemplate(k);
    }
    return out;
  };

  /** Prints the held model section — or the template's, if it said nothing. */
  const closeCurrent = (): string => {
    if (!current) return "";
    const { n, heading, lines } = current;
    current = null;
    if (!lines.some((l) => l.trim())) return emitTemplate(n);
    seen.add(n);
    fromModel.add(n);
    return `\n${heading}\n${lines.join("")}`;
  };

  const resolveCitations = (line: string): string =>
    line
      .replace(CITATION, (_m, id: string) => {
        const sentence = opts.sentences.get(id);
        // A NUL marks our own quote so the id scrub below cannot touch it.
        return sentence ? `\u0000${quoteSentence(sentence, locale)}\u0000` : "";
      })
      .split("\u0000")
      .map((part, i) => (i % 2 === 1 ? part : part.replace(BARE_ID, "")))
      .join("");

  const processLine = (line: string): string => {
    if (failed) return "";
    if (failures.has(line.trim())) {
      // The model stopped mid-way: what it was writing is incomplete.
      failed = true;
      current = null;
      dropping = true;
      return "";
    }
    const m = SECTION_HEADING.exec(line);
    if (m) {
      const n = Number(m[1]);
      const known = (SECTION_NUMBERS as readonly number[]).includes(n);
      let out = closeCurrent();
      out += flushBefore(known ? n : 11);
      if (!known || fixed.has(n) || seen.has(n)) {
        // Ours (or a duplicate / an extra the plan does not have): print
        // our version once and skip what the model wrote under it.
        if (known && !seen.has(n)) out += emitTemplate(n as SectionNumber);
        dropping = true;
        return out;
      }
      dropping = false;
      // Our wording of the heading, whatever the model called it.
      const heading = opts.sections[n as SectionNumber].split("\n")[0] ?? line;
      current = { n: n as SectionNumber, heading, lines: [] };
      return out;
    }
    if (/^#\s/.test(line)) return ""; // the model's own title
    if (dropping || !current) return "";
    let resolved = resolveCitations(line);
    if (resolved !== line && /^\s*>\s*$/.test(resolved)) return "";
    if (opts.todo && opts.todo !== TODO) {
      resolved = resolved.replace(TODO_PL, opts.todo);
    }
    current.lines.push(`${resolved}\n`);
    return "";
  };

  const source = (): PlanSource =>
    fromTemplate === 0 ? "ai" : fromModel.size === 0 ? "template" : "mixed";

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
      let out = buffer ? processLine(buffer.replace(/\r$/, "")) : "";
      buffer = "";
      out += closeCurrent();
      out += flushBefore(11);
      const s = source();
      return out + opts.footer(s) + (opts.trailer?.(s) ?? "");
    },
    get fallbackUsed() {
      return fromTemplate > 0;
    },
    get source() {
      return source();
    },
    get failed() {
      return failed;
    },
  };
}

/**
 * Byte-stream wrapper for a route handler. `flush` runs when the source
 * closes — also after a deadline abort or an error, since `aiStream` then
 * writes its failure line and closes cleanly — so the plan always ends with
 * every section, the footer and the trailer.
 */
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
