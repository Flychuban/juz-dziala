import "server-only";

import { eq } from "drizzle-orm";

import type { MessageAuthorKind } from "~/lib/domain";
import { db } from "~/server/db";
import { cases, messages } from "~/server/db/schema";

/**
 * Raw thread write — no notification. Use `addMessage` (engine) for anything a
 * person writes; this is for system notes the fan-out itself adds.
 */
export async function insertMessage(m: {
  caseId: string;
  authorKind: MessageAuthorKind;
  authorName: string | null;
  body: string;
  visibleToAuthor?: boolean;
}): Promise<{ id: string; createdAt: Date }> {
  const visible = m.visibleToAuthor ?? true;
  const [row] = await db
    .insert(messages)
    .values({
      caseId: m.caseId,
      authorKind: m.authorKind,
      authorName: m.authorName,
      body: m.body,
      visibleToAuthor: visible,
    })
    .returning({ id: messages.id, createdAt: messages.createdAt });
  if (!row) throw new Error("message insert returned nothing");
  const now = new Date();
  await db
    .update(cases)
    .set(
      visible && m.authorKind !== "system"
        ? { updatedAt: now, lastActivityAt: now }
        : { updatedAt: now },
    )
    .where(eq(cases.id, m.caseId));
  return row;
}
