import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

import {
  aiStructured,
  type AiResult,
  type Effort,
  type SystemBlock,
} from "~/server/ai/structured";

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

/** One structured Claude call with content blocks — goes through the shared wrapper (logging, fallbacks, cache). */
export function aiStructuredWithDocument<S extends z.ZodType>(opts: {
  fn: string;
  schema: S;
  system: SystemBlock[];
  content: UserContent;
  effort?: Effort;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<AiResult<z.infer<S>>> {
  return aiStructured({
    fn: opts.fn,
    schema: opts.schema,
    system: opts.system,
    user: opts.content,
    effort: opts.effort,
    maxTokens: opts.maxTokens ?? 16000,
    timeoutMs: opts.timeoutMs ?? 90_000,
  });
}
