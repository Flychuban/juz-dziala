"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { SendIcon } from "lucide-react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  isValidationKey,
  MAX_NEEDS_CHARS,
  type PlanInputs,
  type PlanSource,
} from "~/server/adapt/options";
import { api } from "~/trpc/react";

/**
 * „Poproś ROPS o wsparcie we wdrożeniu" — sends the plan as a Sprawa
 * (kind „adapt") and shows the case code. The e-mail is optional. This is
 * the main action under a finished plan.
 */
export function SupportRequest({
  inputs,
  markdown,
  mode,
}: {
  inputs: PlanInputs;
  markdown: string;
  mode: PlanSource;
}) {
  const id = useId();
  const t = useTranslations("adapt.support");
  const tv = useTranslations("adapt.validation");
  const [email, setEmail] = useState("");
  const send = api.adapt.requestSupport.useMutation();

  if (send.data) {
    return (
      <CaseCreatedPanel
        code={send.data.code}
        token={send.data.accessToken}
        heading={t("sent")}
      />
    );
  }

  const zod = send.error?.data?.zodError;
  const fields = zod?.fieldErrors as Record<string, string[] | undefined> | undefined;
  const rawField = fields?.email?.[0];
  const fieldError = rawField
    ? isValidationKey(rawField)
      ? tv(rawField, { max: MAX_NEEDS_CHARS })
      : rawField
    : undefined;
  const error = send.error
    ? (fieldError ?? (zod ? t("checkData") : send.error.message))
    : null;

  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="font-display text-xl font-bold md:text-2xl">
        {t("heading")}
      </h2>
      <p className="mt-2 max-w-[62ch]">{t("lead")}</p>
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
            {t("emailLabel")}
          </label>
          <p id={`${id}-hint`} className="text-muted-foreground text-[0.9375rem]">
            {t("emailHint")}
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
            <span className="text-destructive">{t("errorPrefix")} </span>
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={send.isPending}>
          <SendIcon aria-hidden="true" />
          {send.isPending ? t("sending") : t("send")}
        </Button>
      </form>
    </section>
  );
}
