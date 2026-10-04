"use client";

import { BellRingIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import {
  ChoiceCards,
  TextAreaField,
  TextField,
} from "~/components/ideas/form";
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
import { useLabels } from "~/i18n/use-labels";
import { MAPA_AREAS, type MapaArea } from "~/lib/domain";
import {
  PARTNER_LIMITS,
  PARTNER_TYPES,
  type PartnerType,
} from "~/server/cases/partnership";
import { normalizeSubscriptionContact } from "~/server/ideas/network-rules";
import type { SubscriptionTopic } from "~/server/ideas/schema";
import { api } from "~/trpc/react";

const UNKNOWN = "unknown" as const;

type NetworkT = ReturnType<typeof useTranslations<"network">>;

/** A server message when it is a sentence; otherwise a plain one of ours. */
function errorMessage(e: unknown, t: NetworkT): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || msg.startsWith("[") || msg.startsWith("{")) {
    return t("errors.generic");
  }
  if (/fetch|network|Failed/i.test(msg)) return t("errors.offline");
  return msg;
}

/** The contact step's problem in the visitor's language, or null. */
function contactMessage(v: ContactValue, t: NetworkT): string | null {
  if (!contactError(v)) return null;
  return v.contactPref === "email" ? t("errors.email") : t("errors.phone");
}

function SendError({ text, t }: { text: string; t: NetworkT }) {
  if (!text) return null;
  return (
    <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
      <span className="text-destructive">{t("errors.notSent")} </span>
      {text}
    </p>
  );
}

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
  const t = useTranslations("network");
  const labels = useLabels();
  const [question, setQuestion] = useState("");
  const [area, setArea] = useState<MapaArea | typeof UNKNOWN | null>(
    initialArea ?? null,
  );
  const [who, setWho] = useState<WhoFields>({
    authorRole: "resident",
    onBehalf: false,
  });
  const [gmina, setGmina] = useState<string | undefined>();
  const [contact, setContact] = useState<ContactValue>({
    contactPref: "none",
    contact: "",
  });
  const [created, setCreated] = useState<{
    code: string;
    accessToken: string;
  } | null>(null);
  const [error, setError] = useState("");
  const ask = api.network.ask.useMutation();

  if (created)
    return (
      <CaseCreatedPanel
        code={created.code}
        token={created.accessToken}
        heading={t("ask.created")}
      />
    );

  const steps: StepperStep[] = [
    {
      id: "question",
      title: t("ask.question.title"),
      description: t("ask.question.hint"),
      content: (
        <TextAreaField
          label={t("ask.question.label")}
          hint={t("ask.question.example")}
          value={question}
          onChange={setQuestion}
          maxLength={4000}
          rows={6}
        />
      ),
      validate: () =>
        question.trim().length < 15 ? t("ask.question.error") : null,
    },
    {
      id: "area",
      title: t("ask.area.title"),
      description: t("ask.area.hint"),
      content: (
        <ChoiceCards
          legend={t("ask.area.legend")}
          legendClassName="sr-only"
          name="ask-area"
          options={[
            ...MAPA_AREAS.map((a) => ({ value: a, label: labels.area[a] })),
            { value: UNKNOWN, label: t("ask.area.unknown") },
          ]}
          value={area}
          onChange={setArea}
          columns={2}
        />
      ),
      validate: () => (area ? null : t("ask.area.error")),
    },
    {
      id: "contact",
      title: t("ask.contact.title"),
      description: t("ask.contact.hint"),
      content: (
        <div className="flex flex-col gap-8">
          <WhoFieldset
            value={who}
            onChange={setWho}
            legend={t("ask.contact.who")}
          />
          <GminaPicker
            gminas={gminas}
            powiaty={powiaty}
            value={gmina}
            onChange={setGmina}
          />
          <ContactFieldset value={contact} onChange={setContact} />
          <SendError text={error} t={t} />
        </div>
      ),
      validate: () => {
        if (gmina && !gminaOrUndefined(gmina)) return t("errors.gminaInPowiat");
        return contactMessage(contact, t);
      },
    },
  ];

  return (
    <Stepper
      steps={steps}
      finishLabel={t("ask.finish")}
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
              contact:
                contact.contactPref === "none"
                  ? undefined
                  : contact.contact.trim(),
            }),
          );
        } catch (e) {
          setError(errorMessage(e, t));
        }
      }}
    />
  );
}

/**
 * „Szukam partnera" — five short questions → a Sprawa („Partnerstwo: …").
 * ROPS brokers the contact and answers in the case thread; nobody's contact
 * details are shown. `initialOrg` comes from „Połącz mnie z tą organizacją"
 * (/network?org=<name>#partnerzy, also linked from library cards).
 */
export function PartnerWizard({
  gminas,
  powiaty,
  initialOrg,
}: {
  gminas: GminaOption[];
  powiaty: PowiatOption[];
  initialOrg?: string;
}) {
  const t = useTranslations("network");
  const [type, setType] = useState<PartnerType | null>(null);
  const [gmina, setGmina] = useState<string | undefined>();
  const [offer, setOffer] = useState("");
  const [need, setNeed] = useState("");
  const [org, setOrg] = useState(initialOrg ?? "");
  const [contact, setContact] = useState<ContactValue>({
    contactPref: "none",
    contact: "",
  });
  const [created, setCreated] = useState<{
    code: string;
    accessToken: string;
  } | null>(null);
  const [error, setError] = useState("");
  const partner = api.network.partner.useMutation();
  const min = PARTNER_LIMITS.text.min;

  if (created)
    return (
      <CaseCreatedPanel
        code={created.code}
        token={created.accessToken}
        heading={t("partner.created")}
      />
    );

  const steps: StepperStep[] = [
    {
      id: "who",
      title: t("partner.who.title"),
      description: t("partner.who.hint"),
      content: (
        <ChoiceCards
          legend={t("partner.who.legend")}
          legendClassName="sr-only"
          name="partner-type"
          options={PARTNER_TYPES.map((v) => ({
            value: v,
            label: t(`partner.type.${v}`),
          }))}
          value={type}
          onChange={setType}
          columns={2}
        />
      ),
      validate: () => (type ? null : t("partner.who.error")),
    },
    {
      id: "gmina",
      title: t("partner.gmina.title"),
      description: t("partner.gmina.hint"),
      content: (
        <GminaPicker
          gminas={gminas}
          powiaty={powiaty}
          value={gmina}
          onChange={setGmina}
          label={t("partner.gmina.label")}
        />
      ),
      validate: () =>
        gmina && !gminaOrUndefined(gmina) ? t("errors.gminaInPowiat") : null,
    },
    {
      id: "offer",
      title: t("partner.offer.title"),
      description: t("partner.offer.hint"),
      content: (
        <TextAreaField
          label={t("partner.offer.label")}
          value={offer}
          onChange={setOffer}
          maxLength={PARTNER_LIMITS.text.max}
          rows={5}
        />
      ),
      validate: () =>
        offer.trim().length < min ? t("partner.offer.error") : null,
    },
    {
      id: "need",
      title: t("partner.need.title"),
      description: t("partner.need.hint"),
      content: (
        <div className="flex flex-col gap-6">
          <TextAreaField
            label={t("partner.need.label")}
            value={need}
            onChange={setNeed}
            maxLength={PARTNER_LIMITS.text.max}
            rows={5}
          />
          <TextField
            label={t("partner.need.orgLabel")}
            hint={t("partner.need.orgHint")}
            value={org}
            onChange={setOrg}
            maxLength={PARTNER_LIMITS.org.max}
          />
        </div>
      ),
      validate: () =>
        need.trim().length < min ? t("partner.need.error") : null,
    },
    {
      id: "contact",
      title: t("partner.contact.title"),
      description: t("partner.contact.hint"),
      content: (
        <div className="flex flex-col gap-8">
          <ContactFieldset value={contact} onChange={setContact} />
          <SendError text={error} t={t} />
        </div>
      ),
      validate: () => contactMessage(contact, t),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {org.trim() ? (
        <p className="border-primary border-l-4 pl-3 text-lg">
          {t.rich("partner.withOrg", {
            org: org.trim(),
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
          })}
        </p>
      ) : null}
      <Stepper
        steps={steps}
        finishLabel={t("partner.finish")}
        busy={partner.isPending}
        onFinish={async () => {
          setError("");
          if (!type) return;
          try {
            setCreated(
              await partner.mutateAsync({
                partnerType: type,
                gminaTeryt: gminaOrUndefined(gmina),
                offer: offer.trim(),
                need: need.trim(),
                org: org.trim() || undefined,
                contactPref: contact.contactPref,
                contact:
                  contact.contactPref === "none"
                    ? undefined
                    : contact.contact.trim(),
              }),
            );
          } catch (e) {
            setError(errorMessage(e, t));
          }
        }}
      />
    </div>
  );
}

/** „Powiadamiaj mnie…" — one short form: topic, channel, contact. */
export function SubscribeForm() {
  const t = useTranslations("network");
  const locale = useLocale();
  const labels = useLabels();
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
      setError(channel === "email" ? t("errors.email") : t("errors.phone"));
      return;
    }
    const topic: SubscriptionTopic =
      kind === "calls" ? "calls" : `area:${area}`;
    try {
      const res = await subscribe.mutateAsync({
        topic,
        channel,
        contact: contact.trim(),
      });
      const values = {
        what: kind,
        area: labels.area[area],
        contact: res.masked,
      };
      setDone(
        res.created
          ? t("subscribe.done", values)
          : t("subscribe.already", values),
      );
      setContact("");
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void onSubmit(e)}
      className="flex max-w-2xl flex-col gap-6"
    >
      {locale !== "pl" ? (
        <p className="border-input border-l-4 pl-3">
          {t("subscribe.languageNote")}
        </p>
      ) : null}
      <ChoiceCards
        legend={t("subscribe.topic")}
        name="sub-topic"
        options={[
          {
            value: "calls",
            label: t("subscribe.calls"),
            description: t("subscribe.callsHint"),
          },
          {
            value: "area",
            label: t("subscribe.area"),
            description: t("subscribe.areaHint"),
          },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "area" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={areaId} className="text-lg font-semibold">
            {t("subscribe.areaLabel")}
          </label>
          <select
            id={areaId}
            value={area}
            onChange={(e) => setArea(e.target.value as MapaArea)}
            className="border-input bg-background min-h-12 w-full rounded-md border-2 px-3 py-2 text-lg"
          >
            {MAPA_AREAS.map((a) => (
              <option key={a} value={a}>
                {labels.area[a]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <ChoiceCards
        legend={t("subscribe.channel")}
        name="sub-channel"
        options={[
          { value: "email", label: t("subscribe.email") },
          {
            value: "sms",
            label: t("subscribe.sms"),
            description: t("subscribe.smsHint"),
          },
        ]}
        value={channel}
        onChange={setChannel}
        columns={2}
      />
      <TextField
        label={
          channel === "email"
            ? t("subscribe.emailLabel")
            : t("subscribe.phoneLabel")
        }
        hint={t("subscribe.contactHint")}
        type={channel === "email" ? "email" : "tel"}
        inputMode={channel === "email" ? "email" : "tel"}
        autoComplete={channel === "email" ? "email" : "tel"}
        value={contact}
        onChange={setContact}
        maxLength={200}
        required
      />
      {error ? (
        <p
          role="alert"
          className="border-destructive border-l-4 pl-3 font-semibold"
        >
          <span className="text-destructive">{t("subscribe.notSaved")} </span>
          {error}
        </p>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={
          done
            ? "border-hairline bg-surface rounded-md border border-l-4 p-4 font-semibold"
            : "sr-only"
        }
      >
        {done}
      </p>
      <Button
        type="submit"
        className="w-fit"
        disabled={subscribe.isPending}
      >
        <BellRingIcon aria-hidden="true" />
        {subscribe.isPending ? t("subscribe.saving") : t("subscribe.submit")}
      </Button>
    </form>
  );
}
