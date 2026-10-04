"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";

import { fold } from "~/components/kit/format";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export type GminaChoice = {
  teryt: string;
  name: string;
  /** „Bochnia (gmina miejska)" / "Bochnia (urban municipality)". */
  label: string;
  /** The powiat as the reader names it („powiat bocheński" / "Bochnia County"). */
  powiatName: string;
};

const MAX_SHOWN = 40;

function rank(g: GminaChoice, q: string): number {
  const name = fold(g.name);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  if (fold(g.powiatName).includes(q)) return 4;
  return -1;
}

/**
 * GminaCombobox — pick one of Małopolska's 183 gminas by typing its name
 * (diacritics optional: „zabierzow" finds „Zabierzów"). An ARIA 1.2
 * combobox: arrows move through the list, Enter picks, Escape closes; the
 * number of matches is announced. Names repeat (Bochnia miejska / wiejska),
 * so every option shows its kind and powiat.
 */
export function GminaCombobox({
  options,
  value,
  onChange,
  label,
  description,
  error,
  className,
}: {
  options: GminaChoice[];
  value: string | null;
  onChange: (teryt: string | null) => void;
  label?: string;
  description?: string;
  error?: string | null;
  className?: string;
}) {
  const t = useTranslations("municipality.combobox");
  const locale = useLocale();
  label ??= t("label");
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const descId = `${id}-desc`;
  const errId = `${id}-err`;
  const selected = options.find((o) => o.teryt === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // A value set from outside (a restored draft, a ?gmina= link) shows its name.
  const selectedLabel = selected?.label;
  useEffect(() => {
    if (selectedLabel) setQuery(selectedLabel);
  }, [selectedLabel]);

  const showingSelected = query === selected?.label;
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q || showingSelected) return options;
    return options
      .map((o) => ({ o, r: rank(o, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.o.name.localeCompare(b.o.name, locale))
      .map((x) => x.o);
  }, [options, query, showingSelected, locale]);
  const shown = matches.slice(0, MAX_SHOWN);

  function choose(o: GminaChoice) {
    onChange(o.teryt);
    setQuery(o.label);
    setOpen(false);
  }

  function move(delta: number) {
    if (!open) setOpen(true);
    setActive((a) => {
      const next = Math.min(Math.max(a + delta, 0), Math.max(shown.length - 1, 0));
      const el = listRef.current?.children[next] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
      return next;
    });
  }

  const activeId = open && shown[active] ? `${id}-opt-${shown[active].teryt}` : undefined;
  const describedBy = [description ? descId : null, error ? errId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("relative w-full max-w-xl", className)}>
      <label htmlFor={inputId} className="block text-base font-semibold">
        {label}
      </label>
      {description ? (
        <p id={descId} className="text-muted-foreground mt-1 text-[0.9375rem]">
          {description}
        </p>
      ) : null}
      <Input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        className="mt-2"
        placeholder={t("placeholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Enter") {
            if (open && shown[active]) {
              e.preventDefault();
              choose(shown[active]);
            } else if (!value && shown.length === 1 && shown[0]) {
              e.preventDefault();
              choose(shown[0]);
            }
          } else if (e.key === "Escape") {
            if (open) {
              e.preventDefault();
              setOpen(false);
            }
          }
        }}
      />
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={t("listLabel", { label })}
        hidden={!open || shown.length === 0}
        className="border-input bg-popover text-popover-foreground absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border-2"
      >
        {shown.map((o, i) => (
          <li
            key={o.teryt}
            id={`${id}-opt-${o.teryt}`}
            role="option"
            aria-selected={o.teryt === value}
            onMouseDown={(e) => {
              e.preventDefault();
              choose(o);
            }}
            onMouseMove={() => setActive(i)}
            className={cn(
              "flex min-h-12 cursor-pointer items-start gap-2 px-3 py-2",
              i === active && "bg-accent outline-primary outline-2 -outline-offset-2",
            )}
          >
            <CheckIcon
              aria-hidden="true"
              className={cn(
                "text-primary mt-1 size-4 shrink-0",
                o.teryt === value ? "visible" : "invisible",
              )}
            />
            <span>
              <span className="font-semibold">{o.label}</span>
              <span className="text-muted-foreground block text-sm">
                {o.powiatName}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {open && query.trim() && !showingSelected
          ? matches.length === 0
            ? t("noneLive")
            : t("foundLive", { count: matches.length })
          : ""}
      </p>
      {open && query.trim() && matches.length === 0 ? (
        <p className="mt-2 text-base">{t("none", { query: query.trim() })}</p>
      ) : null}
      {matches.length > MAX_SHOWN && open ? (
        <p className="text-muted-foreground mt-2 text-sm">
          {t("showing", { shown: MAX_SHOWN, count: matches.length })}
        </p>
      ) : null}
      {selected && !open ? (
        <p className="mt-2 text-base">
          {t.rich("selected", {
            label: selected.label,
            powiat: selected.powiatName,
            b: (chunks) => <span className="font-semibold">{chunks}</span>,
          })}
        </p>
      ) : null}
      {error ? (
        <p
          id={errId}
          className="border-destructive mt-2 border-l-4 pl-3 font-semibold"
        >
          <span className="text-destructive">{t("errorPrefix")} </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
