"use client";

import { useId, useMemo, useState } from "react";

import { filterGminas, gminaOptionLabel, type GminaOption } from "./format";

/**
 * „Twoja gmina (opcjonalnie)": an ARIA 1.2 combobox — type to filter the
 * 183 gminas of Małopolska, arrows to move, Enter to pick, Escape to close.
 * Calls `onSelect` with the picked gmina, or null when cleared.
 */
export function GminaCombobox({
  options,
  value,
  onSelect,
}: {
  options: readonly GminaOption[];
  value: GminaOption | null;
  onSelect: (g: GminaOption | null) => void;
}) {
  const [text, setText] = useState(value ? gminaOptionLabel(value) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ids = { input: useId(), hint: useId(), list: useId(), status: useId() };
  const matches = useMemo(() => (value ? [] : filterGminas(text, options)), [text, options, value]);
  const expanded = open && matches.length > 0;

  const pick = (g: GminaOption) => {
    onSelect(g);
    setText(gminaOptionLabel(g));
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (matches.length ? (i + 1) % matches.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (matches.length ? (i - 1 + matches.length) % matches.length : 0));
    } else if (e.key === "Enter" && expanded) {
      e.preventDefault();
      const g = matches[active];
      if (g) pick(g);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-2">
      <label htmlFor={ids.input} className="text-lg font-semibold">
        Twoja gmina (opcjonalnie)
      </label>
      <p id={ids.hint} className="text-muted-foreground">
        Zacznij pisać nazwę i wybierz z listy. Pokażemy, ile podobnych spraw jest w Twoim powiecie.
      </p>
      <div className="relative">
        <input
          id={ids.input}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={ids.list}
          aria-activedescendant={expanded ? `${ids.list}-${active}` : undefined}
          aria-describedby={`${ids.hint} ${ids.status}`}
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onSelect(null);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="border-input bg-background min-h-12 w-full rounded-lg border-2 px-3 text-lg"
        />
        <ul
          id={ids.list}
          role="listbox"
          aria-label="Pasujące gminy"
          hidden={!expanded}
          className="border-input bg-background absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border-2"
        >
          {matches.map((g, i) => (
            <li
              key={g.teryt}
              id={`${ids.list}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(g);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-12 cursor-pointer items-center px-3 py-2 ${i === active ? "bg-accent font-semibold" : ""}`}
            >
              {gminaOptionLabel(g)}
            </li>
          ))}
        </ul>
      </div>
      <p id={ids.status} role="status" className="sr-only">
        {open && text.trim() && !value
          ? matches.length === 0
            ? "Brak pasujących gmin."
            : `Pasujące gminy: ${matches.length}. Użyj strzałek, by wybrać.`
          : value
            ? `Wybrano: ${gminaOptionLabel(value)}.`
            : ""}
      </p>
      {value && (
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setText("");
          }}
          className="text-foreground inline-flex min-h-12 w-fit items-center underline underline-offset-4"
        >
          Wyczyść gminę
        </button>
      )}
    </div>
  );
}
