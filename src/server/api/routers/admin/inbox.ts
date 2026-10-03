import { createTRPCRouter } from "~/server/api/trpc";

/** Staff-only (use roleProcedure). Owned by one module agent. */
export const adminInboxRouter = createTRPCRouter({});
