"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { GminaCombobox, type GminaChoice } from "./gmina-combobox";

/** „Znajdź swoją gminę" → /municipality/[teryt]. */
export function GminaSearch({ options }: { options: GminaChoice[] }) {
  const router = useRouter();
  const t = useTranslations("municipality.search");
  const [teryt, setTeryt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      role="search"
      aria-label={t("form")}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!teryt) {
          setError(t("pick"));
          return;
        }
        setError(null);
        setBusy(true);
        router.push(`/municipality/${teryt}`);
      }}
      className="flex flex-col items-start gap-4"
    >
      <GminaCombobox
        options={options}
        value={teryt}
        onChange={(t) => {
          setTeryt(t);
          if (t) setError(null);
        }}
        label={t("label")}
        description={t("hint")}
        error={error}
      />
      <Button type="submit" disabled={busy}>
        {busy ? t("opening") : t("submit")}
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </form>
  );
}
