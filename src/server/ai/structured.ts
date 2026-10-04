import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { aiCalls } from "~/server/db/schema";
import { count, gte } from "drizzle-orm";

/**
 * The single door to Claude. Every AI feature calls `aiStructured` (JSON,
 * zod-validated) or `aiStream` (Markdown, streamed). Each call is logged to
 * jd_ai_call with tokens, cache hits, latency and cost — the basis of the
 * cost estimate. Server-side refusal fallbacks are enabled on every call.
 */
export const AI_MODEL = "claude-sonnet-5-5";
/** USD per million tokens for claude-sonnet-5-5 (claude-api skill, cached 2026-09-25). */
const PRICE = {
  input: 2,
  output: 10,
  cacheRead: 0.2,
  cacheWrite5m: 2.5,
  cacheWrite1h: 4,
};
const BETAS = ["server-side-fallback-2026-07-01"] as const;

export type Effort = "low" | "medium" | "high";

/** A stable, cacheable system prefix (no dates, no per-request data). */
export type SystemBlock = { text: string; cache?: boolean };

let client: Anthropic | null = null;
export function aiAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Cost guard: refuse new Claude calls once AI_HOURLY_LIMIT calls were made in
 * the last hour, app-wide. Covers every path (public and staff). Fails open on
 * a DB error so a hiccup never takes features down.
 */
async function overHourlyBudget(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ n: count() })
      .from(aiCalls)
      .where(gte(aiCalls.createdAt, new Date(Date.now() - 3_600_000)));
    return (row?.n ?? 0) >= env.AI_HOURLY_LIMIT;
  } catch {
    return false;
  }
}
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return client;
}

function systemParam(blocks: SystemBlock[]) {
  return blocks.map((b) => ({
    type: "text" as const,
    text: b.text,
    ...(b.cache
      ? { cache_control: { type: "ephemeral" as const, ttl: "1h" as const } }
      : {}),
  }));
}

/** Wrap untrusted user text so instructions inside it are treated as data. */
export function userData(label: string, text: string): string {
  const safe = text.replace(/<\s*\/\s*dane\s*>/gi, "< /dane>");
  return `<dane etykieta="${label}">\n${safe}\n</dane>`;
}

type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function costOf(u: Usage): number {
  const inp = u.input_tokens ?? 0;
  const out = u.output_tokens ?? 0;
  const cr = u.cache_read_input_tokens ?? 0;
  const cw = u.cache_creation_input_tokens ?? 0;
  return (
    (inp * PRICE.input +
      out * PRICE.output +
      cr * PRICE.cacheRead +
      cw * PRICE.cacheWrite1h) /
    1_000_000
  );
}

async function logCall(row: {
  fn: string;
  effort: Effort;
  usage: Usage | null;
  latencyMs: number;
  ok: boolean;
  stopReason?: string | null;
  error?: string | null;
}) {
  try {
    await db.insert(aiCalls).values({
      fn: row.fn,
      model: AI_MODEL,
      effort: row.effort,
      inputTokens: row.usage?.input_tokens ?? 0,
      outputTokens: row.usage?.output_tokens ?? 0,
      cacheReadTokens: row.usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: row.usage?.cache_creation_input_tokens ?? 0,
      latencyMs: row.latencyMs,
      ok: row.ok,
      stopReason: row.stopReason ?? null,
      error: row.error?.slice(0, 500) ?? null,
      costUsd: row.usage ? costOf(row.usage) : 0,
    });
  } catch (e) {
    console.error("[ai] failed to log call", e);
  }
}

export type AiResult<T> =
  | { ok: true; data: T; latencyMs: number; costUsd: number }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "refusal"
        | "max_tokens"
        | "invalid"
        | "error"
        | "timeout";
      latencyMs: number;
      message?: string;
    };

/**
 * One structured Claude call. Never throws: callers decide the fallback.
 * Note: the SDK strips min/max constraints from the schema it sends, then
 * validates after parsing — so keep schemas permissive and trim on the server.
 */
export type UserContent = string | Anthropic.Beta.BetaContentBlockParam[];

/** Output language. Polish prompts stay as they are; English adds one directive. */
export type AiLocale = "pl" | "en";

/**
 * The English directive goes at the END of the user turn, never into the system
 * prompt, so the cached system prefix (1 h TTL) is identical in both languages.
 */
const EN_DIRECTIVE =
  "JĘZYK ODPOWIEDZI: angielski (British English). Wszystkie teksty przeznaczone dla człowieka pisz po angielsku, prostymi słowami — także jeśli wyżej jest napisane „po polsku”. Nie tłumacz identyfikatorów, kodów ani nazw własnych organizacji i programów (np. „Usługa Wrażliwa”, „GOPS”). Słowa użytkownika (userTerms) przepisuj dokładnie tak, jak je napisał.";

export function withLocale(user: UserContent, locale: AiLocale | undefined): UserContent {
  if (locale !== "en") return user;
  if (typeof user === "string") return `${user}\n\n${EN_DIRECTIVE}`;
  return [...user, { type: "text", text: EN_DIRECTIVE }];
}

/** Lines aiStream writes instead of a document; consumers match them exactly. */
export const AI_STREAM_LINES = {
  pl: {
    unavailable: "_Asystent AI jest chwilowo niedostępny._",
    failed: "_Nie udało się wygenerować dokumentu._",
    error: "_Wystąpił błąd generowania. Spróbuj ponownie._",
  },
  en: {
    unavailable: "_The AI assistant is temporarily unavailable._",
    failed: "_The document could not be generated._",
    error: "_Something went wrong while generating. Please try again._",
  },
} as const;

/** True when a call would actually reach Claude now (key set, hourly budget left). */
export async function aiReady(): Promise<boolean> {
  return aiAvailable() && !(await overHourlyBudget());
}

export async function aiStructured<S extends z.ZodType>(opts: {
  fn: string;
  schema: S;
  system: SystemBlock[];
  /** Plain text, or content blocks (e.g. a PDF document block before the instructions). */
  user: UserContent;
  /** Output language; default Polish. */
  locale?: AiLocale;
  effort?: Effort;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<AiResult<z.infer<S>>> {
  const effort = opts.effort ?? "low";
  const started = Date.now();
  if (!aiAvailable() || (await overHourlyBudget()))
    return { ok: false, reason: "unavailable", latencyMs: 0 };
  try {
    const res = await getClient().beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: opts.maxTokens ?? 8000,
        betas: [...BETAS],
        fallbacks: "default",
        system: systemParam(opts.system),
        messages: [{ role: "user", content: withLocale(opts.user, opts.locale) }],
        output_config: { effort, format: betaZodOutputFormat(opts.schema) },
      },
      { timeout: opts.timeoutMs ?? 45_000 },
    );
    const latencyMs = Date.now() - started;
    const usage: Usage = res.usage;
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
      await logCall({
        fn: opts.fn,
        effort,
        usage,
        latencyMs,
        ok: false,
        stopReason: res.stop_reason,
      });
      return { ok: false, reason: res.stop_reason, latencyMs };
    }
    const data = res.parsed_output;
    if (data == null) {
      await logCall({
        fn: opts.fn,
        effort,
        usage,
        latencyMs,
        ok: false,
        stopReason: res.stop_reason,
        error: "parse",
      });
      return { ok: false, reason: "invalid", latencyMs };
    }
    await logCall({
      fn: opts.fn,
      effort,
      usage,
      latencyMs,
      ok: true,
      stopReason: res.stop_reason,
    });
    return { ok: true, data, latencyMs, costUsd: costOf(usage) };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const message = e instanceof Error ? e.message : String(e);
    const timeout = e instanceof Anthropic.APIConnectionTimeoutError;
    await logCall({
      fn: opts.fn,
      effort,
      usage: null,
      latencyMs,
      ok: false,
      error: message,
    });
    return {
      ok: false,
      reason: timeout ? "timeout" : "error",
      latencyMs,
      message,
    };
  }
}

/**
 * Streamed Markdown generation for long documents (Ramowy Plan Wdrożenia,
 * application drafts). Returns a ReadableStream of UTF-8 text for a route
 * handler; logs usage when the stream ends.
 */
export function aiStream(opts: {
  fn: string;
  system: SystemBlock[];
  user: string;
  /** Output language; default Polish. Failure lines follow it (AI_STREAM_LINES). */
  locale?: AiLocale;
  effort?: Effort;
  maxTokens?: number;
  /** Abort the model after this long; the stream then closes cleanly. */
  deadlineMs?: number;
}): ReadableStream<Uint8Array> {
  const effort = opts.effort ?? "medium";
  const lines = AI_STREAM_LINES[opts.locale ?? "pl"];
  const started = Date.now();
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!aiAvailable() || (await overHourlyBudget())) {
        controller.enqueue(
          enc.encode(lines.unavailable),
        );
        controller.close();
        return;
      }
      try {
        const stream = getClient().beta.messages.stream({
          model: AI_MODEL,
          max_tokens: opts.maxTokens ?? 16000,
          betas: [...BETAS],
          fallbacks: "default",
          system: systemParam(opts.system),
          messages: [{ role: "user", content: withLocale(opts.user, opts.locale) as string }],
          output_config: { effort },
        });
        const deadline = opts.deadlineMs
          ? setTimeout(() => stream.abort(), opts.deadlineMs)
          : null;
        for await (const ev of stream) {
          if (
            ev.type === "content_block_delta" &&
            ev.delta.type === "text_delta"
          ) {
            controller.enqueue(enc.encode(ev.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (deadline) clearTimeout(deadline);
        await logCall({
          fn: opts.fn,
          effort,
          usage: final.usage,
          latencyMs: Date.now() - started,
          ok: final.stop_reason !== "refusal",
          stopReason: final.stop_reason,
        });
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            enc.encode(`\n\n${lines.failed}`),
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await logCall({
          fn: opts.fn,
          effort,
          usage: null,
          latencyMs: Date.now() - started,
          ok: false,
          error: message,
        });
        controller.enqueue(
          enc.encode(`\n\n${lines.error}`),
        );
      } finally {
        controller.close();
      }
    },
  });
}
