import "server-only";

import type { MessageAuthorKind } from "~/lib/domain";
import { db } from "~/server/db";
import { events } from "~/server/db/schema";
import { fanout } from "./notify-fanout";

/**
 * Every domain event goes through `notify`: it writes the outbox (jd_event),
 * then fans out to in-app notifications and deliveries (e-mail real, SMS
 * simulated). Owned by the Sprawy agent — this contract is the signature.
 */
export type NotifyEvent =
  | { type: "case.created"; caseId: string }
  | { type: "case.triaged"; caseId: string; assigneeId?: string | null }
  | { type: "case.assigned"; caseId: string; assigneeId: string }
  | { type: "case.status"; caseId: string; status: string }
  | {
      type: "message.created";
      caseId: string;
      messageId: string;
      authorKind: MessageAuthorKind;
    }
  | { type: "call.published"; callId: string }
  | { type: "call.changed"; callId: string }
  | { type: "innovation.published"; innovationId: string }
  | { type: "idea.similarFound"; caseId: string; innovationId: string };

export async function notify(ev: NotifyEvent): Promise<void> {
  await db.insert(events).values({ type: ev.type, payload: ev });
  try {
    await fanout(ev);
  } catch (e) {
    console.error("[notify] fanout failed", e);
  }
}
