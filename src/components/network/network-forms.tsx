"use client";

import { useId, useState } from "react";
import { BellRingIcon } from "lucide-react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { errorText } from "~/components/ideas/client-utils";
import { ChoiceCards, TextAreaField, TextField } from "~/components/ideas/form";
import {
  ContactFieldset,
  contactError,
  GminaPicker,
  gminaOrUndefined,
  WhoFieldset,
  type ContactValue,
  type GminaOption,
  type PowiatOption,
  type WhoFields,
} from "~/components/ideas/people-fields";
import { Stepper, type StepperStep } from "~/components/kit";
import { Button } from "~/components/ui/button";
import { MAPA_AREA_LABEL, MAPA_AREAS, type MapaArea } from "~/lib/domain";
import { normalizeSubscriptionContact } from "~/server/ideas/network-rules";
import type { SubscriptionTopic } from "~/server/ideas/schema";
import { api } from "~/trpc/react";

const UNKNOWN = "unknown" as const;

/** „Zapytaj eksperta" — question, area, contact → Sprawa kind "question". */
export function AskExpertWizard({
  gminas,
  powiaty,
  initialArea,
}: {
  gminas: GminaOption[];
  powiaty: PowiatOption[];
  initialArea?: MapaArea;
}) {
  const [question, setQuestion] = useState("");
  const [area, setArea] = useState<MapaArea | typeof UNKNOWN | null>(initialArea ?? null);
  const [who, setWho] = useState<WhoFields>({ authorRole: "resident", onBehalf: false });
  const [gmina, setGmina] = useState<string | undefined>();
  const [contact, setContact] = useState<ContactValue>({ contactPref: "none", contact: "" });
  const [created, setCreated] = useState<{ code: string; accessToken: string } | null>(null);
  const [error, setError] = useState("");
  const ask = api.network.ask.useMutation();

  if (created) return <CaseCreatedPanel code={created.code} token={created.accessToken} heading="Pytanie przyjęte" />;

  const steps: StepperStep[] = [
    {
      id: "question",
      title: "Jakie masz pytanie?",
      description: "Napisz tak, jak powiedział(a)byś to przez telefon. Nie podawaj nazwisk ani adresów.",
      content: (
        <TextAreaField
          label="Twoje pytanie"
          hint="Np. „Jak zorganizować w gminie wsparcie wytchnieniowe dla opiekunów?”"
          value={question}
          onChange={setQuestion}
          maxLength={4000}
          rows={6}
        />
      ),
      validate: () => (question.trim().length < 15 ? "Napisz pytanie w co najmniej jednym zdaniu." : null),
    },
    {
      id: "area",
      title: "Którego obszaru dotyczy?",
      description: "To pomoże dobrać eksperta.",
      content: (
        <ChoiceCards
          legend="Obszar Mapy Wyzwań Społecznych"
          legendClassName="sr-only"
          name="ask-area"
          options={[...MAPA_AREAS.map((a) => ({ value: a, label: MAPA_AREA_LABEL[a] })), { value: UNKNOWN, label: "Nie wiem / inny" }]}
          value={area}
          onChange={setArea}
          columns={2}
        />
      ),
      validate: () => (area ? null : "Wybierz obszar albo „Nie wiem / inny”."),
    },
    {
      id: "contact",
      title: "Jak mamy odpowiedzieć?",
      description: "Odpowiedź zobaczysz zawsze po kodzie sprawy.",
      content: (
        <div className="flex flex-col gap-8">
          <WhoFieldset value={who} onChange={setWho} legend="Pytasz jako" />
          <GminaPicker gminas={gminas} powiaty={powiaty} value={gmina} onChange={setGmina} />
          <ContactFieldset value={contact} onChange={setContact} />
          {error ? (
            <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
              <span className="text-destructive">Nie wysłano: </span>
              {error}
            </p>
          ) : null}
        </div>
      ),
      validate: () => {
        if (gmina && !gminaOrUndefined(gmina)) return "Wybierz gminę w wybranym powiecie albo „— nie wybieram —”.";
        return contactError(contact);
      },
    },
  ];

  return (
    <Stepper
      steps={steps}
      finishLabel="Wyślij pytanie"
      busy={ask.isPending}
      onFinish={async () => {
        setError("");
        try {
          setCreated(
            await ask.mutateAsync({
              question: question.trim(),
              area: area && area !== UNKNOWN ? area : undefined,
              ...who,
              gminaTeryt: gminaOrUndefined(gmina),
              contactPref: contact.contactPref,
              contact: contact.contactPref === "none" ? undefined : contact.contact.trim(),
            }),
          );
        } catch (e) {
          setError(errorText(e));
        }
      }}
    />
  );
}

/** „Powiadamiaj mnie…" — one short form: topic, channel, contact. */
export function SubscribeForm() {
  const [kind, setKind] = useState<"calls" | "area">("calls");
  const [area, setArea] = useState<MapaArea>("seniors");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string>("");
  const subscribe = api.network.subscribe.useMutation();
  const areaId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!normalizeSubscriptionContact(channel, contact)) {
      setError(channel === "email" ? "Podaj adres e-mail, np. imie@przyklad.pl." : "Podaj numer telefonu — 9 cyfr, np. 600 100 200.");
      return;
    }
    const topic: SubscriptionTopic = kind === "calls" ? "calls" : `area:${area}`;
    try {
      const res = await subscribe.mutateAsync({ topic, channel, contact: contact.trim() });
      const what = kind === "calls" ? "nowych naborach" : `nowych rozwiązaniach w obszarze „${MAPA_AREA_LABEL[area]}”`;
      setDone(
        res.created
          ? `Zapisane. Powiadomimy Cię o ${what}: ${res.masked}.`
          : `Ten kontakt (${res.masked}) jest już zapisany na powiadomienia o ${what}.`,
      );
      setContact("");
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex max-w-2xl flex-col gap-6">
      <ChoiceCards
        legend="O czym mamy Cię powiadamiać?"
        name="sub-topic"
        options={[
          { value: "calls", label: "O nowych naborach", description: "Granty i programy ROPS, gdy tylko ruszą." },
          { value: "area", label: "O nowych rozwiązaniach w wybranym obszarze", description: "Gdy w Bibliotece pojawi się nowe rozwiązanie." },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "area" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={areaId} className="text-lg font-semibold">
            Obszar
          </label>
          <select
            id={areaId}
            value={area}
            onChange={(e) => setArea(e.target.value as MapaArea)}
            className="border-input bg-background min-h-12 w-full rounded-md border-2 px-3 py-2 text-lg"
          >
            {MAPA_AREAS.map((a) => (
              <option key={a} value={a}>
                {MAPA_AREA_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <ChoiceCards
        legend="Kanał"
        name="sub-channel"
        options={[
          { value: "email", label: "E-mail" },
          { value: "sms", label: "SMS", description: "W prototypie SMS-y są tylko symulowane." },
        ]}
        value={channel}
        onChange={setChannel}
        columns={2}
      />
      <TextField
        label={channel === "email" ? "Adres e-mail" : "Numer telefonu"}
        hint="Zaszyfrujemy go. W systemie widać tylko skrót, np. j***@g***.pl."
        type={channel === "email" ? "email" : "tel"}
        inputMode={channel === "email" ? "email" : "tel"}
        autoComplete={channel === "email" ? "email" : "tel"}
        value={contact}
        onChange={setContact}
        maxLength={200}
        required
      />
      {error ? (
        <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
          <span className="text-destructive">Nie zapisano: </span>
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className={done ? "border-hairline bg-surface rounded-md border border-l-4 p-4 font-semibold" : "sr-only"}>
        {done}
      </p>
      <Button type="submit" className="w-fit" disabled={subscribe.isPending}>
        <BellRingIcon aria-hidden="true" />
        {subscribe.isPending ? "Zapisujemy…" : "Zapisz mnie"}
      </Button>
    </form>
  );
}
