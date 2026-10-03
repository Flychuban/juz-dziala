import "server-only";

import type { ContactPref } from "~/lib/domain";
import type { DeliveryStatus } from "~/server/mail/send";

/**
 * A staff reply reaches the author's channel (e-mail, simulated SMS, callback
 * note) only when the staff member asked for it. The `NotifyEvent` contract
 * carries no such flag, so `addMessage` registers the request here between
 * inserting the message and calling `notify()`; the fan-out — which runs inline
 * in the same call — takes it and writes back what happened.
 */
export type DeliveryOutcome = {
  channel: ContactPref;
  status: DeliveryStatus | "none";
  error?: string;
};

export type DeliveryIntent = { outcome?: DeliveryOutcome };

const intents = new Map<string, DeliveryIntent>();

export function requestDelivery(messageId: string): DeliveryIntent {
  const intent: DeliveryIntent = {};
  intents.set(messageId, intent);
  return intent;
}

export function takeDelivery(messageId: string): DeliveryIntent | undefined {
  const intent = intents.get(messageId);
  intents.delete(messageId);
  return intent;
}
