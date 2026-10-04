"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, LayoutGridIcon } from "lucide-react";

import { Stepper, type StepperStep } from "~/components/kit";
import { CaseCreatedPanel } from "~/components/cases/case-created-panel";
import { Button } from "~/components/ui/button";
import { useLabels } from "~/i18n/use-labels";
import { IDEA_STAGES, MAPA_AREAS, type IdeaStage, type MapaArea } from "~/lib/domain";
import { IDEA_LIMITS, ideaCoreSchema, type SelfScore, type SimilarInnovation } from "~/server/ideas/schema";
import { api } from "~/trpc/react";
import { safeStorage, useErrorText } from "./client-utils";
import { CheckCards, ChoiceCards, TextAreaField, TextField } from "./form";
import { IdeaAssistant, SimilarCheck, type CriteriaInfo } from "./idea-assistant";
import {
  ContactFieldset,
  GminaPicker,
  gminaOrUndefined,
  useContactError,
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
  /** Kept in memory only — never written to this device's storage. */
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

/** The three steps after sending — the same words as the case page (§6 of the brief). */
export function WhatHappensNext({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const t = useTranslations("ideas.whatHappens");
  const H = headingLevel;
  return (
    <section aria-labelledby="what-happens-h" className="border-hairline border-t pt-6">
      <H id="what-happens-h" className="text-lg font-semibold">
        {t("heading")}
      </H>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-6">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
    </section>
  );
}

/**
 * /ideas/new — the fiszka: four questions, one per screen, autosaved on this
 * device (without the contact). From step 2 the side panel compares the idea
 * with the library (no AI) and offers the AI assistant; the self-assessment,
 * if made, is sent with the idea.
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
  const t = useTranslations("ideas.wizard");
  const labels = useLabels();
  const errorText = useErrorText();
  const contactError = useContactError();
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
      // Older drafts may still hold a contact; it is never restored.
      setDraft({ ...EMPTY, ...saved.draft, contact: "" });
      setStep(Math.min(Math.max(saved.step ?? 0, 0), 3));
      setRestored(true);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || created) return;
    safeStorage.set(DRAFT_KEY, { draft: { ...draft, contact: "" }, step });
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
      // Name the step to go back to, in the visitor's language.
      const field = String(core.error.issues[0]?.path[0] ?? "");
      setSubmitError(
        field === "title" || field === "description"
          ? t("errors.goBackWhat")
          : field === "targetGroup"
            ? t("errors.goBackWho")
            : field === "stage"
              ? t("errors.goBackStage")
              : t("errors.incomplete"),
      );
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
    const tok = encodeURIComponent(created.accessToken);
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <CaseCreatedPanel code={created.code} token={created.accessToken} heading={t("created")} />
        {created.similar.length ? (
          <section aria-labelledby="similar-after">
            <h2 id="similar-after" className="font-display text-2xl font-bold">
              {t("similarAfter.heading")}
            </h2>
            <p className="mt-2">{t("similarAfter.body")}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {created.similar.map((s) => (
                <li key={s.innovationId}>
                  <Link
                    href={`/library/${s.slug}`}
                    lang={s.lang === "en" ? undefined : "pl"}
                    className="text-primary text-lg font-semibold underline underline-offset-4"
                  >
                    {s.title}
                  </Link>
                  {s.authors ? <span className="text-muted-foreground"> — {s.authors}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="next-steps" className="border-hairline border-t pt-6">
          <h2 id="next-steps" className="font-display text-2xl font-bold">
            {t("next.heading")}
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            <li>
              <Button asChild variant="secondary">
                <Link href={`/ideas/${created.code}/canvas?t=${tok}`}>
                  <LayoutGridIcon aria-hidden="true" />
                  {t("next.canvas")}
                </Link>
              </Button>
              <p className="text-muted-foreground mt-1">{t("next.canvasHint")}</p>
            </li>
            {canApply ? (
              <li>
                <Button asChild variant="secondary">
                  <Link href={`/ideas/${created.code}/application?t=${tok}`}>
                    <ArrowRightIcon aria-hidden="true" />
                    {t("next.application")}
                  </Link>
                </Button>
                <p className="text-muted-foreground mt-1">{t("next.applicationHint")}</p>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    );
  }

  // On phones the assistant panel sits under the form; this anchor sits above „Dalej".
  const assistantLink = (
    <a href="#asystent" className="text-primary inline-flex min-h-12 items-center gap-1 font-semibold underline underline-offset-4 lg:hidden">
      {t("assistantLink")} <span aria-hidden="true">↓</span>
    </a>
  );

  const assistDraft = { title: draft.title, description: draft.description, targetGroup: draft.targetGroup, areas: draft.areas, stage: draft.stage };

  const steps: StepperStep[] = [
    {
      id: "what",
      title: t("what.title"),
      description: t("what.description"),
      content: (
        <div className="flex flex-col gap-6">
          <TextField
            label={t("what.name")}
            hint={t("what.nameHint")}
            value={draft.title}
            onChange={(v) => set("title", v)}
            maxLength={IDEA_LIMITS.title.max}
            required
          />
          <TextAreaField
            label={t("what.text")}
            hint={t("what.textHint")}
            value={draft.description}
            onChange={(v) => set("description", v)}
            maxLength={IDEA_LIMITS.description.max}
            rows={7}
          />
        </div>
      ),
      validate: () => {
        if (draft.title.trim().length < IDEA_LIMITS.title.min) return t("errors.title");
        if (draft.description.trim().length < IDEA_LIMITS.description.min) return t("errors.description");
        return null;
      },
    },
    {
      id: "who",
      title: t("who.title"),
      description: t("who.description"),
      content: (
        <div className="flex flex-col gap-6">
          <TextAreaField
            label={t("who.target")}
            hint={t("who.targetHint")}
            value={draft.targetGroup}
            onChange={(v) => set("targetGroup", v)}
            maxLength={IDEA_LIMITS.targetGroup.max}
            rows={4}
          />
          <CheckCards
            legend={t("who.areas")}
            hint={t("who.areasHint")}
            options={MAPA_AREAS.map((a) => ({ value: a, label: labels.area[a] }))}
            values={draft.areas}
            onChange={(v) => set("areas", v)}
            optional
          />
          {assistantLink}
        </div>
      ),
      validate: () => (draft.targetGroup.trim().length < IDEA_LIMITS.targetGroup.min ? t("errors.targetGroup") : null),
    },
    {
      id: "stage",
      title: t("stage.title"),
      content: (
        <div className="flex flex-col gap-6">
          <ChoiceCards
            legend={t("stage.legend")}
            legendClassName="sr-only"
            name="stage"
            options={IDEA_STAGES.map((s) => ({ value: s, label: labels.ideaStage[s], description: stageHints[s] ?? null }))}
            value={draft.stage}
            onChange={(v) => set("stage", v)}
          />
          {assistantLink}
        </div>
      ),
      validate: () => (draft.stage ? null : t("errors.stage")),
    },
    {
      id: "where",
      title: t("where.title"),
      description: t("where.description"),
      content: (
        <div className="flex flex-col gap-8">
          <GminaPicker gminas={gminas} powiaty={powiaty} value={draft.gmina} onChange={(v) => set("gmina", v)} label={t("where.gmina")} />
          <WhoFieldset
            legend={t("where.who")}
            value={{ authorRole: draft.authorRole, onBehalf: draft.onBehalf }}
            onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
          />
          <ContactFieldset
            value={{ contactPref: draft.contactPref, contact: draft.contact }}
            onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
          />
          <WhatHappensNext />
          {submitError ? (
            <p role="alert" className="border-destructive border-l-4 pl-3 font-semibold">
              <span className="text-destructive">{t("notSent")} </span>
              {submitError}
            </p>
          ) : null}
          {assistantLink}
        </div>
      ),
      validate: () => {
        if (draft.gmina && !gminaOrUndefined(draft.gmina)) return t("errors.gmina");
        return contactError({ contactPref: draft.contactPref, contact: draft.contact });
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
      <div className="min-w-0">
        <h2 className="font-display text-muted-foreground mb-4 text-xl font-bold">{t("heading")}</h2>
        {restored ? (
          <div className="border-hairline mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4" role="status">
            <p>{t("restored")}</p>
            <Button type="button" variant="outline" onClick={startOver}>
              {t("startOver")}
            </Button>
          </div>
        ) : null}
        <Stepper
          steps={steps}
          step={step}
          onStepChange={setStep}
          onFinish={finish}
          finishLabel={t("finish")}
          busy={submit.isPending}
          backHref="/"
        />
        <p className="text-muted-foreground mt-6 text-sm">{t("autosave")}</p>
      </div>
      <aside id="asystent" aria-label={t("asideLabel")} className="flex scroll-mt-6 flex-col gap-6">
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
            <h2 className="font-display text-xl font-bold">{t("intro.heading")}</h2>
            <ol className="mt-3 flex list-decimal flex-col gap-1 pl-6">
              <li>{t("intro.step1")}</li>
              <li>{t("intro.step2")}</li>
              <li>{t("intro.step3")}</li>
              <li>{t("intro.step4")}</li>
            </ol>
            <p className="mt-3">{t("intro.after")}</p>
            <p className="border-hairline mt-4 border-t pt-4">
              <Link href="/ideas/canvas" className="text-primary inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
                {t("intro.blankCanvas")}
              </Link>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
