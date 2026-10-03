import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations need a direct (unpooled) connection on Neon.
    url: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL,
  },
  tablesFilter: ["jd_*"],
} satisfies Config;
