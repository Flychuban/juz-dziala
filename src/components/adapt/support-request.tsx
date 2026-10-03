"use client";

import { useId, useState } from "react";
import { SendIcon } from "lucide-react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { PlanInputs, PlanMode } from "~/server/adapt/options";
import { api } from "~/trpc/react";

/**
 * „Poproś ROPS o wsparcie we wdrożeniu" — sends the plan as a Sprawa
 * (kind „adapt") and shows the case code. The e-mail is optional.
 */
export function SupportRequest({
  inputs,
  markdown,
  mode,
}: {
  inputs: PlanInputs;
  markdown: string;
  mode: PlanMode;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const send = api.adapt.requestSupport.useMutation();

  if (send.data) {
    return (
      <CaseCreatedPanel
        code={send.data.code}
        token={send.data.accessToken}
        heading="Wysłaliśmy plan do ROPS"
      />
    );
  }

  const zod = send.error?.data?.zodError;
  const fieldError = (
    zod?.fieldErrors as Record<string, string[] | undefined> | undefined
  )?.email?.[0];
  const error = send.error
    ? (fieldError ??
      (zod ? "Sprawdź dane i spróbuj ponownie." : send.error.message))
    : null;

  return (
    <section
      aria-labelledby={`${id}-h`}
      className="border-hairline rounded-lg border p-5 md:p-6"
    >
      <h2 id={`${id}-h`} className="font-display text-xl font-bold">
        Poproś ROPS o wsparcie we wdrożeniu
      </h2>
      <p className="mt-2 max-w-[62ch]">
        Wyślemy ten projekt planu do specjalistów ROPS w Krakowie. Dostaniesz
        kod sprawy — po nim sprawdzisz odpowiedź, bez zakładania konta.
      </p>
      <form
        noValidate
        className="mt-4 flex flex-col items-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate({
            inputs,
            markdown,
            mode,
            email: email.trim() || undefined,
          });
        }}
      >
        <div className="w-full max-w-md">
          <label htmlFor={`${id}-email`} className="block font-semibold">
            E-mail instytucji do odpowiedzi (nieobowiązkowo)
          </label>
          <p id={`${id}-hint`} className="text-muted-foreground text-[0.9375rem]">
            Zapiszemy go zaszyfrowany i użyjemy tylko w tej sprawie.
          </p>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
            aria-invalid={fieldError ? true : undefined}
            className="mt-2"
          />
        </div>
        {error ? (
          <p
            id={`${id}-err`}
            role="alert"
            className="border-destructive border-l-4 pl-3 font-semibold"
          >
            <span className="text-destructive">Nie udało się wysłać: </span>
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={send.isPending}>
          <SendIcon aria-hidden="true" />
          {send.isPending ? "Wysyłanie…" : "Wyślij plan do ROPS"}
        </Button>
      </form>
    </section>
  );
}
