"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, PrinterIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { spellCode } from "./format";

/**
 * CaseCode — the resident's case code (JD-XXXX-XXXX), shown large in
 * monospace so it can be read over the phone or copied by hand. Screen
 * readers hear it spelled character by character. Includes „Kopiuj kod"
 * and (optionally) „Drukuj".
 *
 * @param code       The case code.
 * @param label      Caption above the code; defaults to „Twój kod sprawy".
 * @param showPrint  Show a „Drukuj" button (prints the whole page).
 */
export function CaseCode({
  code,
  label = "Twój kod sprawy",
  showPrint = true,
  className,
}: {
  code: string;
  label?: string;
  showPrint?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      ok = false;
    }
    setStatus(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 4000);
  }

  return (
    <div
      data-slot="case-code"
      className={cn(
        "border-primary bg-background rounded-lg border-2 p-5 md:p-6",
        className,
      )}
    >
      <p className="text-muted-foreground text-base font-semibold">{label}</p>
      <p className="mt-2">
        <span className="sr-only">{spellCode(code)}</span>
        <span
          aria-hidden="true"
          className="text-foreground block font-mono text-[2rem] leading-tight font-bold tracking-[0.12em] break-all select-all sm:text-5xl"
        >
          {code}
        </span>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3" data-no-print>
        <Button type="button" variant="secondary" onClick={copy}>
          {status === "copied" ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {status === "copied" ? "Skopiowano" : "Kopiuj kod"}
        </Button>
        {showPrint ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
          >
            <PrinterIcon aria-hidden="true" />
            Drukuj
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="mt-2 min-h-6 text-base">
        {status === "copied"
          ? "Kod sprawy jest w schowku."
          : status === "failed"
            ? "Nie udało się skopiować. Zapisz kod ręcznie."
            : ""}
      </p>
    </div>
  );
}
