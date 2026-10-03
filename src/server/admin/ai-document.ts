import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import { env } from "~/env";
import {
  AI_MODEL,
  aiAvailable,
  type AiResult,
  type Effort,
  type SystemBlock,
} from "~/server/ai/structured";
import { db } from "~/server/db";
import { aiCalls } from "~/server/db/schema";

/*
 * A sibling of `aiStructured` for calls whose user turn carries content
 * blocks (a PDF document), which `aiStructured` cannot express because it
 * takes `user: string`. It copies the wrapper's conventions exactly: beta
 * parse with a zod output format, server-side refusal fallbacks ("default"),
 * effort, timeout, never throws, and one jd_ai_call row per call.
 *
 * TODO(contract): fold into structured.ts as `user: string | content[]` and
 * delete this file — see the Agent F report.
 */

/** USD per million tokens for claude-opus-5-5 (same table as structured.ts). */
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite1h: 8 };
const BETAS = ["server-side-fallback-2026-07-01"] as const;

type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function costOf(u: Usage): number {
  return (
    ((u.input_tokens ?? 0) * PRICE.input +
      (u.output_tokens ?? 0) * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite1h) /
    1_000_000
  );
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return client;
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
    console.error("[ai-document] failed to log call", e);
  }
}

export type UserContent = Anthropic.Beta.BetaContentBlockParam[];

/** A base64 PDF as a document block (place it before the instructions). */
export function pdfBlock(
  base64: string,
  title?: string,
): Anthropic.Beta.BetaRequestDocumentBlock {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64 },
    ...(title ? { title: title.slice(0, 200) } : {}),
  };
}

/** One structured Claude call with content blocks in the user turn. Never throws. */
export async function aiStructuredWithDocument<S extends z.ZodType>(opts: {
  fn: string;
  schema: S;
  system: SystemBlock[];
  content: UserContent;
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
        max_tokens: opts.maxTokens ?? 16000,
        betas: [...BETAS],
        fallbacks: "default",
        system: opts.system.map((b) => ({
          type: "text" as const,
          text: b.text,
          ...(b.cache
            ? {
                cache_control: {
                  type: "ephemeral" as const,
                  ttl: "1h" as const,
                },
              }
            : {}),
        })),
        messages: [{ role: "user", content: opts.content }],
        output_config: { effort, format: betaZodOutputFormat(opts.schema) },
      },
      { timeout: opts.timeoutMs ?? 120_000 },
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
