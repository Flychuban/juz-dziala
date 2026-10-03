"use client";

import { ArrowRightIcon, CopyIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { CaseCode, copyText } from "./case-code";
import { rememberCase } from "./my-cases";

/**
 * Shown by any module right after `createCase()` returns: the big code,
 * „Zapisz lub wydrukuj ten kod", copy, print, the private link and a way into
 * the case. Saves the code on this device. Focus moves to the heading so a
 * screen reader announces the result.
 *
 *   <CaseCreatedPanel code={res.code} token={res.accessToken} />
 */
export function CaseCreatedPanel({
  code,
  token,
  heading = "Sprawa przyjęta",
}: {
  code: string;
  token: string;
  heading?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [origin, setOrigin] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const privatePath = `/case/${code}?t=${encodeURIComponent(token)}`;

  useEffect(() => {
    setSaved(rememberCase(code, token));
    setOrigin(window.location.origin);
    headingRef.current?.focus();
  }, [code, token]);

  return (
    <section
      aria-labelledby="case-created-heading"
      className="border-hairline bg-background rounded-lg border-2 p-5 sm:p-8"
    >
      <h2
        id="case-created-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold sm:text-3xl"
      >
        {heading}
      </h2>
      <p className="mt-2 text-lg">
        Odpowiemy zwykle w ciągu 2 dni roboczych. Odpowiedź zobaczysz po
        wpisaniu kodu sprawy w zakładce „Moja sprawa”.
      </p>

      <CaseCode code={code} className="mt-6" />

      <p className="mt-6 text-lg font-semibold">Zapisz lub wydrukuj ten kod.</p>
      <p className="mt-1">
        Dzięki niemu sprawdzisz odpowiedź i dopiszesz wiadomość — bez zakładania
        konta.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild className="min-h-12 px-5 text-base">
          <Link href={privatePath}>
            Przejdź do sprawy
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-12 px-5 text-base">
          <Link href={`/case/${code}/print`}>
            <PrinterIcon aria-hidden="true" />
            Drukuj kod z kodem QR
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <label htmlFor="case-private-link" className="block font-semibold">
          Twój prywatny link do sprawy
        </label>
        <p
          id="case-private-link-hint"
          className="text-muted-foreground text-sm"
        >
          Otwiera sprawę bez wpisywania kodu. Nie udostępniaj go innym osobom.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="case-private-link"
            readOnly
            value={`${origin}${privatePath}`}
            aria-describedby="case-private-link-hint"
            onFocus={(e) => e.currentTarget.select()}
            className="border-input bg-background min-h-12 w-full rounded-md border px-3 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-12 px-4 text-base"
            onClick={async () => {
              const ok = await copyText(`${origin}${privatePath}`);
              setLinkStatus(
                ok
                  ? "Skopiowano link do schowka."
                  : "Nie udało się skopiować. Zaznacz link i skopiuj go ręcznie.",
              );
            }}
          >
            <CopyIcon aria-hidden="true" />
            Kopiuj link
          </Button>
        </div>
        <p role="status" className="mt-1 text-sm">
          {linkStatus}
        </p>
      </div>

      {saved !== null && (
        <p className="text-muted-foreground mt-4 text-sm">
          {saved
            ? "Kod zapisaliśmy też na tym urządzeniu — znajdziesz go w zakładce „Moja sprawa”."
            : "Ta przeglądarka nie pozwala zapisać kodu. Zapisz go lub wydrukuj."}
        </p>
      )}
    </section>
  );
}
