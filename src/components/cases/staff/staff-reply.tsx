"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type RefObject } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { api, type RouterOutputs } from "~/trpc/react";

type Data = RouterOutputs["admin"]["inbox"]["get"];
type Delivery = RouterOutputs["admin"]["inbox"]["reply"]["delivery"];

/**
 * Staff reply. A reply always lands in the author's thread; „Wyślij też…"
 * additionally uses the author's channel. In demo mode an e-mail to the
 * author needs an explicit confirmation. The one primary action is „Wyślij".
 */
export function StaffReply({
  data,
  body,
  setBody,
  onSent,
  inputRef,
}: {
  data: Data;
  body: string;
  setBody: (s: string) => void;
  onSent: (messageId: string) => Promise<void>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useTranslations("admin.reply");
  const pref = data.contact.pref;
  const [internal, setInternal] = useState(false);
  const [deliver, setDeliver] = useState(pref !== "none");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [confirming, setConfirming] = useState(false);
  const reply = api.admin.inbox.reply.useMutation();

  const deliveryText = (d: Delivery): string => {
    if (!d) return "";
    switch (d.channel) {
      case "email":
        return d.status === "sent"
          ? t("emailSent")
          : d.status === "skipped"
            ? t("emailSkipped")
            : d.error
              ? t("emailFailedWith", { error: d.error })
              : t("emailFailed");
      case "sms":
        return t("smsSimulated");
      case "phone":
        return t("phoneTask");
      case "none":
        return "";
    }
  };

  const channelLabel =
    pref === "email"
      ? t("sendEmail", { address: data.contact.value ?? t("savedAddress") })
      : pref === "sms"
        ? t("sendSms")
        : pref === "phone"
          ? t("callback")
          : null;

  const send = async () => {
    setConfirming(false);
    try {
      const r = await reply.mutateAsync({
        code: data.case.code,
        body,
        sendEmail: !internal && deliver && pref !== "none",
        internal,
      });
      setBody("");
      setError("");
      setDone(
        [internal ? t("noteAdded") : t("replied"), deliveryText(r.delivery)]
          .filter(Boolean)
          .join(" "),
      );
      await onSent(r.id);
    } catch (e) {
      // Validation comes back as a message key (reply.tooShort / reply.tooLong).
      const field = (
        e as { data?: { zodError?: { fieldErrors?: { body?: string[] } } } }
      ).data?.zodError?.fieldErrors?.body?.[0];
      setError(
        field === "reply.tooShort" || field === "reply.tooLong"
          ? t(field === "reply.tooShort" ? "tooShort" : "tooLong")
          : e instanceof Error
            ? e.message
            : t("sendFailed"),
      );
    }
  };

  return (
    <section
      aria-labelledby="staff-reply-heading"
      className="border-hairline rounded-lg border p-4"
    >
      <h2 id="staff-reply-heading" className="text-xl font-bold">
        {t("heading")}
      </h2>
      <form
        noValidate
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setDone("");
          if (body.trim().length < 2) {
            setError(t("tooShort"));
            inputRef.current?.focus();
            return;
          }
          setError("");
          if (data.env.demoMode && !internal && deliver && pref === "email") {
            setConfirming(true);
            return;
          }
          void send();
        }}
      >
        <label htmlFor="staff-reply" className="font-semibold">
          {internal ? t("internalLabel") : t("replyLabel")}
        </label>
        <p id="staff-reply-hint" className="text-muted-foreground text-sm">
          {internal
            ? t("internalHint")
            : data.case.locale === "en"
              ? t("replyHintEnglish")
              : t("replyHint")}
        </p>
        <Textarea
          ref={inputRef}
          id="staff-reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={6000}
          aria-describedby={
            error ? "staff-reply-hint staff-reply-error" : "staff-reply-hint"
          }
          aria-invalid={error ? true : undefined}
          className="min-h-40 text-base"
        />
        {error && (
          <p
            id="staff-reply-error"
            role="alert"
            className="text-destructive font-semibold"
          >
            {error}
          </p>
        )}

        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
            className="size-5"
          />
          {t("internalToggle")}
        </label>
        {!internal &&
          (channelLabel ? (
            <label className="flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                checked={deliver}
                onChange={(e) => setDeliver(e.target.checked)}
                className="size-5"
              />
              {channelLabel}
            </label>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noContact")}</p>
          ))}

        <div>
          <Button
            type="submit"
            disabled={reply.isPending}
            className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
          >
            <SendIcon aria-hidden="true" />
            {reply.isPending
              ? t("sending")
              : internal
                ? t("addNote")
                : t("send")}
          </Button>
        </div>
        <p role="status" className="font-semibold">
          {done}
        </p>
      </form>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("confirmTitle")}</DialogTitle>
            <DialogDescription className="text-base">
              {t("confirmBody", {
                address: data.contact.value ?? t("savedOnCase"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
              onClick={() => setConfirming(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
              onClick={() => void send()}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
