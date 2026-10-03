import "server-only";

import type { NotifyEvent } from "./notify";

/** Fan-out of domain events to notifications + deliveries. Owned by the Sprawy agent. */
export async function fanout(_ev: NotifyEvent): Promise<void> {
  // implemented in module V/VI
}
