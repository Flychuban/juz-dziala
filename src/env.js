import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    /** Claude API. Without it, matching falls back to keywords only. */
    ANTHROPIC_API_KEY: z.string().optional(),
    /** Signs staff session cookies (≥32 chars). */
    SESSION_SECRET: z.string().min(32).default("dev-only-secret-change-me-0123456789abcdef"),
    /** 32-byte base64 key for AES-GCM contact encryption. */
    CONTACT_ENC_KEY: z.string().optional(),
    /** E-mail: Resend (verified domain) or SMTP fallback. */
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    SMTP_URL: z.string().optional(),
    /** Where ROPS staff notifications go. */
    ROPS_INBOX_EMAIL: z.string().optional(),
    /** "1" = public demo: one-click staff login, contacts masked, e-mail needs confirmation. */
    DEMO_MODE: z.enum(["0", "1"]).default("1"),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    NODE_ENV: process.env.NODE_ENV,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
    CONTACT_ENC_KEY: process.env.CONTACT_ENC_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    SMTP_URL: process.env.SMTP_URL,
    ROPS_INBOX_EMAIL: process.env.ROPS_INBOX_EMAIL,
    DEMO_MODE: process.env.DEMO_MODE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
