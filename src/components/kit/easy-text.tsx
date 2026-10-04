"use client";

import { useId, useState } from "react";
import { BookOpenTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ReadAloud } from "./read-aloud";
import { useEasyMode } from "./use-easy-mode";

/**
 * EasyText — the „Tekst łatwy do czytania" version of a library card.
 * Shown automatically while the header's „Tekst łatwy" mode is on, or on
 * demand with this component's own button. The text is generated once by AI
 * from the card (checked: short, no numbers the card lacks), cached and
 * labelled as automatic. Without AI it says the easy version is coming and the
 * original card stays as it is.
 *
 * @param slug     Card slug (library.easyText).
 * @param title    Card title, for the button's accessible name.
 * @param context  "card" on the card page (full text below), "result" on a match result.
 */
export function EasyText({
  slug,
  title,
  context = "card",
  className,
}: {
  slug: string;
  title: string;
  context?: "card" | "result";
  className?: string;
}) {
  const t = useTranslations("common.kit.easy");
  const globalEasy = useEasyMode();
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? globalEasy;
  const panelId = useId();
  const q = api.library.easyText.useQuery(
    { slug },
    {
      enabled: open,
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const sentences = q.data?.text.split("\n").filter(Boolean) ?? [];

  return (
    <div className={cn("w-full", className)} data-slot="easy-text">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOverride(!open)}
      >
        <BookOpenTextIcon aria-hidden="true" />
        {open ? t("hide") : t("show")}
        <span className="sr-only">: {title}</span>
      </Button>
      {/* One short live line, not the whole text: several panels may open at once. */}
      <p aria-live="polite" className="sr-only">
        {open && q.isSuccess && sentences.length ? t("ready") : ""}
      </p>
      <div id={panelId}>
        {open ? (
          <section
            aria-label={t("region")}
            className="border-primary bg-surface mt-4 rounded-md border-l-4 px-5 py-4"
          >
            <p className="text-muted-foreground text-sm font-semibold">{t("auto")}</p>
            {q.isLoading ? (
              <p className="mt-2 text-lg">{t("loading")}</p>
            ) : sentences.length ? (
              <>
                <div className="mt-2 max-w-[60ch] space-y-1.5 text-lg leading-relaxed">
                  {sentences.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </div>
                <ReadAloud text={sentences.join(" ")} className="mt-4" />
              </>
            ) : (
              <p className="mt-2 text-lg">
                {t("soon")} {context === "card" ? t("fullBelow") : t("fullOnDetails")}
              </p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
