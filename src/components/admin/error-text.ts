import { useTranslations } from "next-intl";

/**
 * Validation messages the admin schemas send as message keys (zod messages in
 * src/server/admin/library.ts and calls.ts), shown in the staff member's
 * language. Anything else (a server text) is shown as it came.
 */
const KEYS = [
  "editor.errors.videoUrl",
  "editor.errors.fullUrl",
  "editor.errors.titleShort",
  "callEditor.errors.date",
  "callEditor.errors.nameShort",
  "callEditor.errors.fullUrl",
  "callEditor.errors.window",
] as const;
type Key = (typeof KEYS)[number];

export function useErrorText(): (message: string) => string {
  const t = useTranslations("admin");
  return (m) => ((KEYS as readonly string[]).includes(m) ? t(m as Key) : m);
}

/** Field errors of a failed tRPC mutation (zod), translated, without repeats. */
export function fieldErrorsOf(
  error: { data?: unknown } | null | undefined,
  text: (m: string) => string,
): string[] {
  const z = (
    error?.data as
      | { zodError?: { fieldErrors?: Record<string, string[]> } }
      | undefined
  )?.zodError?.fieldErrors;
  return z
    ? [...new Set(Object.values(z).flat().filter(Boolean).map(text))]
    : [];
}
