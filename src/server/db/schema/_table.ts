import { pgTableCreator } from "drizzle-orm/pg-core";

/** Every table is prefixed `jd_` so the app can share a database safely. */
export const createTable = pgTableCreator((name) => `jd_${name}`);
