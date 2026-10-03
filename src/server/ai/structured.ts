import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { aiCalls } from "~/server/db/schema";

/**
 * The single door to Claude. Every AI feature calls `aiStructured` (JSON,
 * zod-validated) or `aiStream` (Markdown, streamed). Each call is logged to
 * jd_ai_call with tokens, cache hits, latency and cost — the basis of the
 * cost estimate. Server-side refusal fallbacks are enabled on every call.
 */
export const AI_MODEL = "claude-opus-5-5";
/** USD per million tokens for claude-opus-5-5 (claude-api skill, cached 2026-09-25). */
const PRICE = {
  input: 4,
  output: 20,
  cacheRead: 0.2,
  cacheWrite5m: 5,
  cacheWrite1h: 8,
};
const BETAS = ["server-side-fallback-2026-07-01"] as const;

export type Effort = "low" | "medium" | "high";

/** A stable, cacheable system prefix (no dates, no per-request data). */
export type SystemBlock = { text: string; cache?: boolean };

let client: Anthropic | null = null;
export function aiAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
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
  const safe = text.replaceAll("</dane>", "< /dane>");
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
export async function aiStructured<S extends z.ZodType>(opts: {
  fn: string;
  schema: S;
  system: SystemBlock[];
  user: string;
  effort?: Effort;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<AiResult<z.infer<S>>> {
  const effort = opts.effort ?? "low";
  const started = Date.now();
  if (!aiAvailable()) return { ok: false, reason: "unavailable", latencyMs: 0 };
  try {
    const res = await getClient().beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: opts.maxTokens ?? 8000,
        betas: [...BETAS],
        fallbacks: "default",
        system: systemParam(opts.system),
        messages: [{ role: "user", content: opts.user }],
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
  effort?: Effort;
  maxTokens?: number;
}): ReadableStream<Uint8Array> {
  const effort = opts.effort ?? "medium";
  const started = Date.now();
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!aiAvailable()) {
        controller.enqueue(
          enc.encode("_Asystent AI jest chwilowo niedostępny._"),
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
          messages: [{ role: "user", content: opts.user }],
          output_config: { effort },
        });
        for await (const ev of stream) {
          if (
            ev.type === "content_block_delta" &&
            ev.delta.type === "text_delta"
          ) {
            controller.enqueue(enc.encode(ev.delta.text));
          }
        }
        const final = await stream.finalMessage();
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
            enc.encode("\n\n_Nie udało się wygenerować dokumentu._"),
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
          enc.encode("\n\n_Wystąpił błąd generowania. Spróbuj ponownie._"),
        );
      } finally {
        controller.close();
      }
    },
  });
}
