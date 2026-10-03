"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { GminaCombobox, type GminaChoice } from "./gmina-combobox";

/** „Znajdź swoją gminę" → /municipality/[teryt]. */
export function GminaSearch({ options }: { options: GminaChoice[] }) {
  const router = useRouter();
  const [teryt, setTeryt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      role="search"
      aria-label="Profil gminy"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!teryt) {
          setError("Wybierz gminę z listy podpowiedzi.");
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
        label="Twoja gmina"
        description="Wpisz początek nazwy i wybierz gminę z listy."
        error={error}
      />
      <Button type="submit" disabled={busy}>
        {busy ? "Otwieram profil…" : "Pokaż profil gminy"}
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </form>
  );
}
