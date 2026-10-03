import "server-only";

import { eq } from "drizzle-orm";
import { after } from "next/server";

import type { CaseStatus, MessageAuthorKind } from "~/lib/domain";
import { db } from "~/server/db";
import { cases, matchRuns } from "~/server/db/schema";
import {
  generateAccessToken,
  generateCaseCode,
  hashToken,
  maskContact,
} from "~/server/domain/case-code";
import { redactPII } from "~/server/domain/redact";
import { encrypt } from "~/server/lib/crypto";
import { notify } from "~/server/notify";
import {
  requestDelivery,
  takeDelivery,
  type DeliveryOutcome,
} from "./delivery-intent";
import {
  createCaseInputSchema,
  normalizePhone,
  type CreateCaseInput,
} from "./input";
import { insertMessage } from "./messages";
import { triageCase } from "./triage";
import { SYSTEM_NAME } from "./types";

export const RECEIVED_TEXT =
  "Sprawa przyjęta. Odpowiemy zwykle w ciągu 2 dni roboczych.";

/**
 * Runs work after the response is sent (`after()` keeps a serverless
 * function alive for it). Outside a request scope — scripts, tests — it falls
 * back to fire-and-forget. Never throws.
 */
export function runInBackground(name: string, fn: () => Promise<unknown>) {
  const run = async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`[cases] background ${name} failed`, e);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) =>
    typeof x === "object" && x !== null && "code" in x
      ? (x as { code: unknown }).code
      : undefined;
  return (
    code(e) === "23505" ||
    (typeof e === "object" && e !== null && "cause" in e
      ? code((e as { cause: unknown }).cause) === "23505"
      : false)
  );
}

/**
 * Opens a Sprawa. Used by every module: needs, ideas, questions, test
 * sign-ups, feedback and adaptation requests. Text is redacted before it is
 * stored, the contact is encrypted (masked copy for display), and only the
 * hash of the private-link token is kept. Triage runs after the response.
 */
export async function createCase(
  input: CreateCaseInput,
): Promise<{ id: string; code: string; accessToken: string }> {
  const v = createCaseInputSchema.parse(input);
  const title = redactPII(v.title).text;
  const body = redactPII(v.body).text;

  let contact: string | null = null;
  if (v.contactPref !== "none" && v.contact) {
    contact =
      v.contactPref === "email"
        ? v.contact.trim().toLowerCase()
        : normalizePhone(v.contact);
  }
  const contactPref = contact ? v.contactPref : "none";

  const accessToken = generateAccessToken();
  const tokenHash = hashToken(accessToken);

  let created: { id: string; code: string } | undefined;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      [created] = await db
        .insert(cases)
        .values({
          code: generateCaseCode(),
          tokenHash,
          kind: v.kind,
          title,
          bodyRedacted: body,
          gminaTeryt: v.gminaTeryt ?? null,
          powiatTeryt: v.powiatTeryt ?? null,
          areas: v.areas ?? [],
          authorRole: v.authorRole,
          onBehalf: v.onBehalf,
          contactPref,
          contactEnc: contact ? encrypt(contact) : null,
          contactMasked: contact ? maskContact(contact) : null,
          matchRunId: v.matchRunId ?? null,
          innovationId: v.innovationId ?? null,
          callId: v.callId ?? null,
          idea: v.idea ?? null,
          canvas: v.canvas ?? null,
          plan: v.plan ?? null,
          rating: v.rating ?? null,
          isSample: v.isSample ?? false,
        })
        .returning({ id: cases.id, code: cases.code });
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 4) throw e;
    }
  }
  if (!created) throw new Error("case insert returned nothing");

  await insertMessage({
    caseId: created.id,
    authorKind: "system",
    authorName: SYSTEM_NAME,
    body: RECEIVED_TEXT,
  });
  if (v.matchRunId) {
    await db
      .update(matchRuns)
      .set({ caseId: created.id })
      .where(eq(matchRuns.id, v.matchRunId));
  }

  await notify({ type: "case.created", caseId: created.id });
  const caseId = created.id;
  runInBackground("triage", () => triageCase(caseId));

  return { id: created.id, code: created.code, accessToken };
}

/**
 * Adds a message a person wrote and announces it. With `deliverToAuthor`, a
 * staff reply also goes out through the author's chosen channel; the outcome
 * comes back so the panel can say what happened.
 */
export async function addMessage(m: {
  caseId: string;
  authorKind: Exclude<MessageAuthorKind, "system">;
  authorName: string;
  body: string;
  visibleToAuthor?: boolean;
  deliverToAuthor?: boolean;
}): Promise<{ id: string; createdAt: Date; delivery?: DeliveryOutcome }> {
  // Residents' text is redacted; staff may legitimately quote an institution's
  // phone number or address, so their replies are stored as written.
  const body = m.authorKind === "author" ? redactPII(m.body).text : m.body;
  const msg = await insertMessage({ ...m, body });
  const intent = m.deliverToAuthor ? requestDelivery(msg.id) : null;
  try {
    await notify({
      type: "message.created",
      caseId: m.caseId,
      messageId: msg.id,
      authorKind: m.authorKind,
    });
  } finally {
    if (intent) takeDelivery(msg.id);
  }
  return { ...msg, delivery: intent?.outcome };
}

/** Status change through the outbox. No-op when nothing changes. */
export async function setCaseStatus(
  caseId: string,
  status: CaseStatus,
): Promise<boolean> {
  const [before] = await db
    .select({ status: cases.status })
    .from(cases)
    .where(eq(cases.id, caseId));
  if (!before || before.status === status) return false;
  await db
    .update(cases)
    .set({ status, updatedAt: new Date() })
    .where(eq(cases.id, caseId));
  await notify({ type: "case.status", caseId, status });
  return true;
}
