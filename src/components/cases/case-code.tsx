"use client";

import { CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The case code, large and monospaced, with a copy button. */
export function CaseCode({
  code,
  className,
  showCopy = true,
}: {
  code: string;
  className?: string;
  showCopy?: boolean;
}) {
  const [status, setStatus] = useState("");
  // Screen readers spell it out character by character.
  const spelled = code.replaceAll("-", " – ").split("").join(" ");
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-muted-foreground text-sm font-semibold">Kod sprawy</p>
      <p className="font-mono text-[clamp(1.75rem,9vw,3rem)] leading-tight font-bold tracking-wider">
        <span aria-hidden="true">{code}</span>
        <span className="sr-only">{spelled}</span>
      </p>
      {showCopy && (
        <div className="flex flex-wrap items-center gap-3" data-no-print>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
            onClick={async () => {
              const ok = await copyText(code);
              setStatus(
                ok
                  ? "Skopiowano kod do schowka."
                  : "Nie udało się skopiować. Zaznacz kod i skopiuj go ręcznie.",
              );
            }}
          >
            <CopyIcon aria-hidden="true" />
            Kopiuj kod
          </Button>
          <p role="status" className="text-sm">
            {status}
          </p>
        </div>
      )}
    </div>
  );
}

export { copyText };
