import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the connection in development (HMR). `prepare: false` because Neon's
 * pooled URL runs PgBouncer in transaction mode.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false, max: 5 });
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export type Db = typeof db;
