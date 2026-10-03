"use client";

import { SendIcon } from "lucide-react";
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

function deliveryText(d: Delivery): string {
  if (!d) return "";
  switch (d.channel) {
    case "email":
      return d.status === "sent"
        ? "E-mail do autora: wysłany."
        : d.status === "skipped"
          ? "E-mail nie został wysłany: poczta nie jest skonfigurowana w tym środowisku. Treść jest w dzienniku wysyłek."
          : `Nie udało się wysłać e-maila${d.error ? `: ${d.error}` : ""}.`;
    case "sms":
      return "SMS zapisany jako symulacja — prototyp nie wysyła SMS-ów.";
    case "phone":
      return "Dodano zadanie: oddzwoń do autora (notatka w wątku).";
    case "none":
      return "";
  }
}

/**
 * Staff reply. A reply always lands in the author's thread; „Wyślij też…"
 * additionally uses the author's channel. In demo mode an e-mail to the
 * author needs an explicit confirmation.
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
  const pref = data.contact.pref;
  const [internal, setInternal] = useState(false);
  const [deliver, setDeliver] = useState(pref !== "none");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [confirming, setConfirming] = useState(false);
  const reply = api.admin.inbox.reply.useMutation();

  const channelLabel =
    pref === "email"
      ? `Wyślij też e-mail do autora (${data.contact.value ?? "adres zapisany"})`
      : pref === "sms"
        ? "Wyślij też SMS do autora (symulacja w prototypie)"
        : pref === "phone"
          ? "Dodaj zadanie: oddzwoń do autora i przekaż odpowiedź"
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
        [
          internal
            ? "Notatka dodana. Autor jej nie widzi."
            : "Odpowiedź jest w wątku — autor zobaczy ją na stronie sprawy.",
          deliveryText(r.delivery),
        ]
          .filter(Boolean)
          .join(" "),
      );
      await onSent(r.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Nie udało się wysłać. Spróbuj ponownie.",
      );
    }
  };

  return (
    <section
      aria-labelledby="staff-reply-heading"
      className="border-hairline rounded-lg border p-4"
    >
      <h2 id="staff-reply-heading" className="text-xl font-bold">
        Odpowiedz
      </h2>
      <form
        noValidate
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setDone("");
          if (body.trim().length < 2) {
            setError("Napisz odpowiedź — co najmniej 2 znaki.");
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
          {internal ? "Notatka wewnętrzna" : "Odpowiedź do autora"}
        </label>
        <p id="staff-reply-hint" className="text-muted-foreground text-sm">
          {internal
            ? "Zobaczą ją tylko pracownicy Hubu i przydzielony ekspert."
            : "Autor zobaczy ją w wątku sprawy. Pisz prosto, krótkimi zdaniami."}
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
          Notatka wewnętrzna — autor jej nie zobaczy
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
            <p className="text-muted-foreground text-sm">
              Autor nie podał kontaktu — sprawdza odpowiedź kodem sprawy.
            </p>
          ))}

        <div>
          <Button
            type="submit"
            disabled={reply.isPending}
            className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
          >
            <SendIcon aria-hidden="true" />
            {reply.isPending
              ? "Wysyłam…"
              : internal
                ? "Dodaj notatkę"
                : "Wyślij odpowiedź"}
          </Button>
        </div>
        <p role="status" className="font-semibold">
          {done}
        </p>
      </form>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Wysłać e-mail do autora?
            </DialogTitle>
            <DialogDescription className="text-base">
              To jest wersja demonstracyjna, dlatego każdy e-mail do autora
              wymaga potwierdzenia. Odpowiedź trafi do wątku sprawy i na adres{" "}
              {data.contact.value ?? "zapisany przy sprawie"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
              onClick={() => setConfirming(false)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              className="h-auto min-h-12 max-w-full px-4 text-base whitespace-normal"
              onClick={() => void send()}
            >
              Tak, wyślij e-mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
