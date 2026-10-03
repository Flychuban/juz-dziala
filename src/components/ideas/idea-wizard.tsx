"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, LayoutGridIcon } from "lucide-react";

import { Stepper, type StepperStep } from "~/components/kit";
import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { Button } from "~/components/ui/button";
import { IDEA_STAGE_LABEL, IDEA_STAGES, MAPA_AREA_LABEL, MAPA_AREAS, type IdeaStage, type MapaArea } from "~/lib/domain";
import { IDEA_LIMITS, ideaCoreSchema, type SelfScore, type SimilarInnovation } from "~/server/ideas/schema";
import { api } from "~/trpc/react";
import { errorText, safeStorage } from "./client-utils";
import { CheckCards, ChoiceCards, TextAreaField, TextField } from "./form";
import { IdeaAssistant, SimilarCheck, type CriteriaInfo } from "./idea-assistant";
import {
  ContactFieldset,
  contactError,
  GminaPicker,
  gminaOrUndefined,
  WhoFieldset,
  type GminaOption,
  type PowiatOption,
} from "./people-fields";

const DRAFT_KEY = "jd_idea_draft_v1";

type Draft = {
  title: string;
  description: string;
  targetGroup: string;
  areas: MapaArea[];
  stage: IdeaStage | null;
  gmina: string | undefined;
  authorRole: "resident" | "ngo" | "jst" | "ops" | "other";
  onBehalf: boolean;
  contactPref: "email" | "sms" | "phone" | "none";
  contact: string;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  targetGroup: "",
  areas: [],
  stage: null,
  gmina: undefined,
  authorRole: "resident",
  onBehalf: false,
  contactPref: "none",
  contact: "",
};

type Created = { code: string; accessToken: string; similar: SimilarInnovation[] };

/**
 * /ideas/new — the fiszka: four questions, one per screen, autosaved on this
 * device. From step 2 the side panel compares the idea with the library (no
 * AI) and offers the AI assistant; the self-assessment, if made, is sent with
 * the idea.
 */
export function IdeaWizard({
  gminas,
  powiaty,
  criteria,
  stageHints,
  canApply,
}: {
  gminas: GminaOption[];
  powiaty: PowiatOption[];
  criteria: CriteriaInfo;
  stageHints: Partial<Record<IdeaStage, string>>;
  canApply: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selfScore, setSelfScore] = useState<SelfScore | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [submitError, setSubmitError] = useState("");
  const submit = api.ideas.submit.useMutation();

  useEffect(() => {
    const saved = safeStorage.get<{ draft: Draft; step: number }>(DRAFT_KEY);
    if (saved?.draft && (saved.draft.title || saved.draft.description)) {
      setDraft({ ...EMPTY, ...saved.draft });
      setStep(Math.min(Math.max(saved.step ?? 0, 0), 3));
      setRestored(true);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !created) safeStorage.set(DRAFT_KEY, { draft, step });
  }, [draft, step, loaded, created]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function startOver() {
    safeStorage.remove(DRAFT_KEY);
    setDraft(EMPTY);
    setStep(0);
    setRestored(false);
    setSelfScore(null);
  }

  async function finish() {
    setSubmitError("");
    const core = ideaCoreSchema.safeParse({ ...draft, stage: draft.stage ?? undefined });
    if (!core.success) {
      setSubmitError(core.error.issues[0]?.message ?? "Uzupełnij fiszkę.");
      return;
    }
    try {
      const res = await submit.mutateAsync({
        ...core.data,
        gminaTeryt: gminaOrUndefined(draft.gmina),
        authorRole: draft.authorRole,
        onBehalf: draft.onBehalf,
        contactPref: draft.contactPref,
        contact: draft.contactPref === "none" ? undefined : draft.contact.trim(),
        selfScore: selfScore ?? undefined,
      });
      safeStorage.remove(DRAFT_KEY);
      setCreated(res);
    } catch (e) {
      setSubmitError(errorText(e));
    }
  }

  if (created) {
    const t = encodeURIComponent(created.accessToken);
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <CaseCreatedPanel code={created.code} token={created.accessToken} heading="Pomysł przyjęty" />
        {created.similar.length ? (
          <section aria-labelledby="similar-after" className="border-hairline rounded-lg border p-5">
            <h2 id="similar-after" className="font-display text-2xl font-bold">
              Podobne rozwiązania już istnieją
            </h2>
            <p className="mt-2">Zespół ROPS zobaczy je przy Twoim pomyśle. Może warto skontaktować się z ich autorami?</p>
            <ul className="mt-3 flex flex-col gap-2">
              {created.similar.map((s) => (
                <li key={s.innovationId}>
                  <Link href={`/library/${s.slug}`} className="text-primary text-lg font-semibold underline underline-offset-4">
                    {s.title}
                  </Link>
                  {s.authors ? <span className="text-muted-foreground"> — {s.authors}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="next-steps" className="border-hairline rounded-lg border p-5">
          <h2 id="next-steps" className="font-display text-2xl font-bold">
            Co dalej?
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            <li>
              <Button asChild variant="secondary">
                <Link href={`/ideas/${created.code}/canvas?t=${t}`}>
                  <LayoutGridIcon aria-hidden="true" />
                  Rozpisz pomysł na Canvasie innowacji
                </Link>
              </Button>
              <p className="text-muted-foreground mt-1">Trzy arkusze INNO AGH: problem, odbiorcy, koszty, partnerzy i wpływ.</p>
            </li>
            {canApply ? (
              <li>
                <Button asChild variant="secondary">
                  <Link href={`/ideas/${created.code}/application?t=${t}`}>
                    <ArrowRightIcon aria-hidden="true" />
                    Przygotuj szkic wniosku o grant
                  </Link>
                </Button>
                <p className="text-muted-foreground mt-1">Pola formularza naboru wypełnione z Twojej fiszki.</p>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    );
  }

  const assistDraft = { title: draft.title, description: draft.description, targetGroup: draft.targetGroup, areas: draft.areas, stage: draft.stage };

  const steps: StepperStep[] = [
    {
      id: "what",
      title: "Na czym polega Twój pomysł?",
      description: "Napisz własnymi słowami. Nie musi być idealnie — możesz to później poprawić.",
      content: (
        <div className="flex flex-col gap-6">
          <TextField
            label="Nazwa pomysłu"
            hint="Krótko, np. „Wspólne zakupy dla seniorów z naszej wsi”."
            value={draft.title}
            onChange={(v) => set("title", v)}
            maxLength={IDEA_LIMITS.title.max}
            required
          />
          <TextAreaField
            label="Opis pomysłu"
            hint="Co chcesz zrobić? Jak to będzie działać? Jaki problem rozwiązuje?"
            value={draft.description}
            onChange={(v) => set("description", v)}
            maxLength={IDEA_LIMITS.description.max}
            rows={7}
          />
        </div>
      ),
      validate: () => {
        if (draft.title.trim().length < IDEA_LIMITS.title.min) return "Nazwij pomysł — co najmniej 3 znaki.";
        if (draft.description.trim().length < IDEA_LIMITS.description.min) return "Opisz pomysł w co najmniej dwóch zdaniach.";
        return null;
      },
    },
    {
      id: "who",
      title: "Komu pomaga?",
      description: "Opisz osoby, którym pomysł ma pomóc, i wybierz obszary Mapy Wyzwań Społecznych.",
      content: (
        <div className="flex flex-col gap-6">
          <TextAreaField
            label="Komu ma pomóc?"
            hint="Np. „samotnym seniorom z małych miejscowości, którzy rzadko wychodzą z domu”."
            value={draft.targetGroup}
            onChange={(v) => set("targetGroup", v)}
            maxLength={IDEA_LIMITS.targetGroup.max}
            rows={4}
          />
          <CheckCards
            legend="Obszary Mapy Wyzwań Społecznych (nieobowiązkowe)"
            hint="Zaznacz jeden lub kilka. Asystent AI może podpowiedzieć, które pasują."
            options={MAPA_AREAS.map((a) => ({ value: a, label: MAPA_AREA_LABEL[a] }))}
            values={draft.areas}
            onChange={(v) => set("areas", v)}
          />
        </div>
      ),
      validate: () => (draft.targetGroup.trim().length < IDEA_LIMITS.targetGroup.min ? "Napisz, komu pomysł ma pomóc." : null),
    },
    {
      id: "stage",
      title: "Na jakim etapie jest?",
      content: (
        <ChoiceCards
          legend="Etap pomysłu"
          legendClassName="sr-only"
          name="stage"
          options={IDEA_STAGES.map((s) => ({ value: s, label: IDEA_STAGE_LABEL[s], description: stageHints[s] ?? null }))}
          value={draft.stage}
          onChange={(v) => set("stage", v)}
        />
      ),
      validate: () => (draft.stage ? null : "Wybierz etap — to pomoże dobrać wsparcie."),
    },
    {
      id: "where",
      title: "Gdzie i kto?",
      description: "Ostatni krok. Kontakt i gmina są nieobowiązkowe — odpowiedź zobaczysz też po kodzie sprawy.",
      content: (
        <div className="flex flex-col gap-8">
          <GminaPicker gminas={gminas} powiaty={powiaty} value={draft.gmina} onChange={(v) => set("gmina", v)} label="Gmina, w której chcesz działać" />
          <WhoFieldset
            legend="Kto zgłasza pomysł?"
            value={{ authorRole: draft.authorRole, onBehalf: draft.onBehalf }}
            onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
          />
          <ContactFieldset
            value={{ contactPref: draft.contactPref, contact: draft.contact }}
            onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
          />
          {submitError ? (
            <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
              <span className="text-destructive">Nie wysłano: </span>
              {submitError}
            </p>
          ) : null}
        </div>
      ),
      validate: () => {
        if (draft.gmina && !gminaOrUndefined(draft.gmina)) return "Wybierz gminę w wybranym powiecie albo „— nie wybieram —”.";
        return contactError({ contactPref: draft.contactPref, contact: draft.contact });
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
      <div className="min-w-0">
        {restored ? (
          <div className="border-hairline bg-surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4" role="status">
            <p>Przywróciliśmy szkic zapisany na tym urządzeniu.</p>
            <Button type="button" variant="outline" size="sm" onClick={startOver}>
              Zacznij od nowa
            </Button>
          </div>
        ) : null}
        <Stepper
          steps={steps}
          step={step}
          onStepChange={setStep}
          onFinish={finish}
          finishLabel="Wyślij pomysł do ROPS"
          busy={submit.isPending}
          backHref="/"
        />
        <p className="text-muted-foreground mt-6 text-sm">Szkic zapisuje się automatycznie na tym urządzeniu. Nie zakładasz konta.</p>
      </div>
      <aside aria-label="Pomoc przy pomyśle" className="flex flex-col gap-6">
        {step >= 1 ? (
          <>
            <SimilarCheck text={`${draft.title}\n${draft.description}\n${draft.targetGroup}`} />
            <IdeaAssistant
              draft={assistDraft}
              criteria={criteria}
              onAddArea={(a) => setDraft((d) => (d.areas.includes(a) ? d : { ...d, areas: [...d.areas, a] }))}
              onSelfScore={setSelfScore}
            />
          </>
        ) : (
          <div className="border-hairline bg-surface rounded-lg border p-5">
            <h2 className="font-display text-xl font-bold">Co Cię czeka</h2>
            <ol className="mt-3 flex list-decimal flex-col gap-1 pl-6">
              <li>Opis pomysłu</li>
              <li>Komu pomaga — tu sprawdzimy, czy coś podobnego już istnieje, i włączymy asystenta AI</li>
              <li>Etap</li>
              <li>Gdzie i kto</li>
            </ol>
            <p className="mt-3">Potem dostaniesz kod sprawy, a ROPS odpowie zwykle w ciągu 2 dni roboczych.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
