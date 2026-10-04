import { getTranslations } from "next-intl/server";

/** Shown while a dynamic page loads, so a click never feels dead. */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-6xl px-4 py-16" role="status" aria-live="polite">
      <p className="text-muted-foreground flex items-center gap-3 text-lg">
        <span
          aria-hidden="true"
          className="border-primary inline-block size-5 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
        />
        {t("loading")}
      </p>
    </div>
  );
}
