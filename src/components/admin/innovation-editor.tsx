"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  ExternalLinkIcon,
  SaveIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  INNOVATION_STATUS,
  INNOVATION_STATUS_LABEL,
  MAPA_AREA_LABEL,
  MAPA_AREAS,
  SECTION_KEYS,
  SECTION_LABEL,
  type InnovationStatus,
  type MapaArea,
  type SectionKey,
} from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

/** A drafted field from „Dodaj z dokumentu" (see server/admin/card-from-document). */
export type DraftFieldView = {
  text: string;
  quote: string;
  check: "verified" | "unverified" | "missing" | "not_found";
};

export type EditorCard = {
  id: string | null;
  slug: string | null;
  title: string;
  sections: Record<SectionKey, string>;
  mapaAreas: MapaArea[];
  categories: string[];
  keywords: string[];
  videoUrl: string | null;
  testingOpen: boolean;
  status: InnovationStatus;
  sourceUrl?: string | null;
  licence?: string | null;
};

const STATUS_HINT: Record<InnovationStatus, string> = {
  draft: "Widoczna tylko w panelu. Nikt poza zespołem jej nie zobaczy.",
  verified: "Treść sprawdzona, ale jeszcze niewidoczna dla mieszkańców.",
  published: "Widoczna w Bibliotece i w dopasowaniu — od razu po zapisaniu.",
};

const CHECK_TEXT: Record<DraftFieldView["check"], string> = {
  verified: "Cytat znaleziony w dokumencie.",
  unverified: "Plik PDF: porównaj cytat z dokumentem.",
  not_found:
    "Nie znaleźliśmy tego cytatu w dokumencie — sprawdź szczególnie uważnie.",
  missing:
    "Dokument nie zawiera tej informacji — uzupełnij ręcznie albo zostaw puste.",
};

type FieldKey = "title" | SectionKey;

function QuotePanel({
  field,
  checked,
  onCheck,
  id,
}: {
  field: DraftFieldView;
  checked: boolean;
  onCheck: (v: boolean) => void;
  id: string;
}) {
  const ok = field.check === "verified";
  return (
    <aside
      aria-label="Źródło w dokumencie"
      className="border-hairline bg-surface rounded-md border p-4 text-[0.9375rem]"
    >
      <p className="flex items-start gap-2 font-semibold">
        {ok ? (
          <CheckCircle2Icon
            aria-hidden="true"
            className="text-success mt-0.5 size-5 shrink-0"
          />
        ) : (
          <CircleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
          />
        )}
        {CHECK_TEXT[field.check]}
      </p>
      {field.quote ? (
        <blockquote className="border-primary mt-3 border-l-4 pl-3 italic">
          „{field.quote}”
        </blockquote>
      ) : null}
      {field.text ? (
        <label
          htmlFor={id}
          className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 font-semibold"
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheck(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--primary)]"
          />
          Sprawdziłam/em z dokumentem
        </label>
      ) : null}
    </aside>
  );
}

/**
 * The card editor. `mode="edit"` saves an existing card (sentences are
 * re-derived on the server); `mode="create"` saves a new one — from a
 * document draft (each drafted field must be ticked as checked first) or
 * from an empty form.
 */
export function InnovationEditor({
  mode,
  initial,
  categories,
  draft,
}: {
  mode: "edit" | "create";
  initial: EditorCard;
  categories: { slug: string; label: string }[];
  draft?: Partial<Record<FieldKey, DraftFieldView>> & { warnings?: string[] };
}) {
  const router = useRouter();
  const [card, setCard] = useState<EditorCard>(initial);
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [checked, setChecked] = useState<Partial<Record<FieldKey, boolean>>>(
    {},
  );
  const save = api.admin.library.save.useMutation();
  const create = api.admin.library.create.useMutation();
  const busy = save.isPending || create.isPending;
  const error = save.error ?? create.error;

  const drafted = useMemo(
    () =>
      (Object.entries(draft ?? {}) as [FieldKey, DraftFieldView][]).filter(
        ([k, f]) => k !== ("warnings" as string) && f?.text,
      ),
    [draft],
  );
  const unchecked = drafted.filter(([k]) => !checked[k]).length;

  const set = <K extends keyof EditorCard>(k: K, v: EditorCard[K]) =>
    setCard((c) => ({ ...c, [k]: v }));
  const setSection = (k: SectionKey, v: string) =>
    setCard((c) => ({ ...c, sections: { ...c.sections, [k]: v } }));
  const toggle = <T extends string>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const payload = () => ({
    title: card.title,
    sections: card.sections,
    mapaAreas: card.mapaAreas,
    categories: card.categories,
    keywords: keywords
      .split(/[,;\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 2),
    videoUrl: card.videoUrl ?? "",
    testingOpen: card.testingOpen,
    status: card.status,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "edit" && card.id) {
      await save
        .mutateAsync({ id: card.id, input: payload() })
        .catch(() => null);
      router.refresh();
    } else {
      const res = await create
        .mutateAsync({
          ...payload(),
          sourceUrl: card.sourceUrl ?? "",
          licence: card.licence ?? undefined,
        })
        .catch(() => null);
      if (res) router.push(`/admin/library/${res.slug}/edit?created=1`);
    }
  }

  const fieldErrors = (() => {
    const z = (
      error?.data as
        { zodError?: { fieldErrors?: Record<string, string[]> } } | undefined
    )?.zodError?.fieldErrors;
    return z ? Object.values(z).flat().filter(Boolean) : [];
  })();

  const field = (k: FieldKey) => draft?.[k];
  const twoCol = (k: FieldKey) =>
    field(k)
      ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6"
      : "";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      {draft?.warnings && draft.warnings.length > 0 ? (
        <Alert role="note">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Uwagi asystenta do dokumentu</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {draft.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className={twoCol("title")}>
        <div>
          <label htmlFor="f-title" className="block text-lg font-bold">
            Tytuł
          </label>
          <Input
            id="f-title"
            value={card.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className="mt-2"
          />
        </div>
        {field("title") ? (
          <div className="mt-3 lg:mt-0">
            <QuotePanel
              id="chk-title"
              field={field("title")!}
              checked={!!checked.title}
              onCheck={(v) => setChecked((c) => ({ ...c, title: v }))}
            />
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-8">
        <legend className="font-display mb-4 text-2xl font-bold">
          Sześć sekcji karty
        </legend>
        {SECTION_KEYS.map((k) => (
          <div key={k} className={twoCol(k)}>
            <div>
              <label htmlFor={`f-${k}`} className="block text-lg font-bold">
                {SECTION_LABEL[k]}
              </label>
              {k === "authors" ? (
                <p
                  id={`f-${k}-hint`}
                  className="text-foreground/85 mt-1 text-[0.9375rem]"
                >
                  Tylko organizacje, każda w osobnym wierszu. Imiona i nazwiska
                  osób prywatnych usuwamy przy zapisie.
                </p>
              ) : null}
              <Textarea
                id={`f-${k}`}
                value={card.sections[k]}
                onChange={(e) => setSection(k, e.target.value)}
                aria-describedby={k === "authors" ? `f-${k}-hint` : undefined}
                className="mt-2 min-h-36"
              />
            </div>
            {field(k) ? (
              <div className="mt-3 lg:mt-8">
                <QuotePanel
                  id={`chk-${k}`}
                  field={field(k)!}
                  checked={!!checked[k]}
                  onCheck={(v) => setChecked((c) => ({ ...c, [k]: v }))}
                />
              </div>
            ) : null}
          </div>
        ))}
      </fieldset>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <fieldset>
          <legend className="text-lg font-bold">Obszary Mapy Wyzwań</legend>
          <ul className="mt-2 space-y-1">
            {MAPA_AREAS.map((a) => (
              <li key={a}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={card.mapaAreas.includes(a)}
                    onChange={() => set("mapaAreas", toggle(card.mapaAreas, a))}
                    className="size-5 accent-[var(--primary)]"
                  />
                  {MAPA_AREA_LABEL[a]}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <fieldset>
          <legend className="text-lg font-bold">Kategorie Biblioteki</legend>
          <ul className="mt-2 space-y-1">
            {categories.map((c) => (
              <li key={c.slug}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={card.categories.includes(c.slug)}
                    onChange={() =>
                      set("categories", toggle(card.categories, c.slug))
                    }
                    className="size-5 accent-[var(--primary)]"
                  />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <label htmlFor="f-keywords" className="block text-lg font-bold">
            Słowa kluczowe
          </label>
          <p
            id="f-keywords-hint"
            className="text-foreground/85 mt-1 text-[0.9375rem]"
          >
            Oddziel przecinkami. Puste pole — wybierzemy je z treści karty.
          </p>
          <Textarea
            id="f-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            aria-describedby="f-keywords-hint"
            className="mt-2 min-h-24"
          />
        </div>
        <div className="space-y-6">
          <div>
            <label htmlFor="f-video" className="block text-lg font-bold">
              Film na YouTube (adres)
            </label>
            <Input
              id="f-video"
              type="url"
              inputMode="url"
              value={card.videoUrl ?? ""}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="mt-2"
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <input
              type="checkbox"
              checked={card.testingOpen}
              onChange={(e) => set("testingOpen", e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            Otwarta dla testerów (moduł „Testuj innowacje”)
          </label>
        </div>
      </div>

      {mode === "create" ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <label htmlFor="f-source" className="block text-lg font-bold">
              Źródło (adres strony lub dokumentu)
            </label>
            <p
              id="f-source-hint"
              className="text-foreground/85 mt-1 text-[0.9375rem]"
            >
              Pokażemy je pod kartą jako „Źródło”. Wymagane.
            </p>
            <Input
              id="f-source"
              type="url"
              inputMode="url"
              required
              value={card.sourceUrl ?? ""}
              onChange={(e) => set("sourceUrl", e.target.value)}
              aria-describedby="f-source-hint"
              placeholder="https://rops.krakow.pl/…"
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="f-licence" className="block text-lg font-bold">
              Licencja
            </label>
            <p
              id="f-licence-hint"
              className="text-foreground/85 mt-1 text-[0.9375rem]"
            >
              Np. „CC BY 4.0”. Zostaw puste, jeśli nie wiadomo.
            </p>
            <Input
              id="f-licence"
              value={card.licence ?? ""}
              onChange={(e) => set("licence", e.target.value)}
              aria-describedby="f-licence-hint"
              className="mt-2"
            />
          </div>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-lg font-bold">Status</legend>
        <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          {INNOVATION_STATUS.map((s) => (
            <li key={s}>
              <label
                className={cn(
                  "flex h-full min-h-12 cursor-pointer gap-3 rounded-md border p-3",
                  card.status === s
                    ? "border-primary bg-accent"
                    : "border-input",
                )}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={card.status === s}
                  onChange={() => set("status", s)}
                  className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-bold">
                    {INNOVATION_STATUS_LABEL[s]}
                  </span>
                  <span className="text-foreground/85 block text-[0.9375rem]">
                    {STATUS_HINT[s]}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div aria-live="polite" className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>Nie zapisano</AlertTitle>
            <AlertDescription>
              {fieldErrors.length ? (
                <ul className="list-disc pl-5">
                  {fieldErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p>{error.message}</p>
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        {save.data ? (
          <Alert variant="success" role="status">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>
              Zapisano. Zmiana widoczna od razu na stronie.
            </AlertTitle>
            <AlertDescription>
              <p>
                {save.data.changed.length
                  ? `Zmienione pola: ${save.data.changed.length}. `
                  : "Bez zmian w treści. "}
                Zdania: {save.data.sentences.kept} bez zmian,{" "}
                {save.data.sentences.added} nowe, {save.data.sentences.removed}{" "}
                usunięte.
                {save.data.published
                  ? " Karta opublikowana — subskrybenci obszaru dostaną powiadomienie."
                  : ""}
              </p>
              {save.data.status === "published" ? (
                <p>
                  <Link
                    href={`/library/${save.data.slug}`}
                    className="font-semibold"
                  >
                    Zobacz kartę w Bibliotece
                    <ExternalLinkIcon
                      aria-hidden="true"
                      className="ml-1 inline size-4"
                    />
                  </Link>
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="border-hairline flex flex-wrap items-center gap-3 border-t pt-6">
        <Button
          type="submit"
          size="lg"
          disabled={busy || (mode === "create" && unchecked > 0)}
        >
          <SaveIcon aria-hidden="true" />
          {busy
            ? "Zapisywanie…"
            : mode === "edit"
              ? "Zapisz zmiany"
              : card.status === "draft"
                ? "Zapisz jako szkic"
                : "Zapisz kartę"}
        </Button>
        {mode === "create" && drafted.length > 0 ? (
          <p className="tabular text-base font-semibold" aria-live="polite">
            Sprawdzone: {drafted.length - unchecked} z {drafted.length}
            {unchecked > 0
              ? " — zaznacz każde pole po porównaniu z dokumentem."
              : ""}
          </p>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/admin/library">Wróć do listy</Link>
        </Button>
      </div>
    </form>
  );
}
