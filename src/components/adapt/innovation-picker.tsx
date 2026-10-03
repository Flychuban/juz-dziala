"use client";

import { useId, useMemo, useState } from "react";
import { AwardIcon, FileCheckIcon } from "lucide-react";

import { fold } from "~/components/kit/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import type { AdaptInnovationOption } from "~/server/api/routers/adapt";

const PAGE = 12;

/**
 * Step 1 — „Którą innowację chcesz wdrożyć?": a search box over the 114
 * library cards and a list of native radio buttons (one tab stop, arrows
 * move between options). The chosen card stays on top of the list.
 */
export function InnovationPicker({
  options,
  value,
  onChange,
}: {
  options: AdaptInnovationOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const selected = options.find((o) => o.id === value) ?? null;

  const matches = useMemo(() => {
    const words = fold(query)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2);
    const list = words.length
      ? options.filter((o) => {
          const text = fold(
            `${o.title} ${o.categoryLabels.join(" ")} ${o.areaLabels.join(" ")} ${o.summary}`,
          );
          return words.every((w) => text.includes(w));
        })
      : options;
    // Ramowy Plan and „wybrana do upowszechniania" first when not searching.
    return words.length
      ? list
      : [...list].sort(
          (a, b) =>
            Number(!!b.ramowyPlan) - Number(!!a.ramowyPlan) ||
            Number(b.badge) - Number(a.badge) ||
            a.title.localeCompare(b.title, "pl"),
        );
  }, [options, query]);

  const visible = useMemo(() => {
    const list = matches.slice(0, limit);
    if (selected && !list.some((o) => o.id === selected.id)) {
      return [selected, ...list];
    }
    return list;
  }, [matches, limit, selected]);

  return (
    <div>
      <label htmlFor={`${id}-q`} className="block font-semibold">
        Szukaj w Bibliotece Innowacji Społecznych
      </label>
      <p id={`${id}-qh`} className="text-muted-foreground text-[0.9375rem]">
        Wpisz słowo z tytułu lub tematu, np. „senior”, „autyzm”, „rodzina”.
      </p>
      <Input
        id={`${id}-q`}
        type="search"
        aria-describedby={`${id}-qh`}
        className="mt-2 max-w-xl"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
        onKeyDown={(e) => {
          // Enter in the search box filters; it must not jump to the next step.
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <p role="status" className="text-muted-foreground mt-2 text-[0.9375rem]">
        {query.trim()
          ? matches.length
            ? `Znaleziono: ${matches.length}.`
            : "Nic nie znaleźliśmy. Spróbuj innego słowa."
          : `W Bibliotece: ${options.length}. Najpierw te z Ramowym Planem ROPS.`}
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Innowacja do wdrożenia</legend>
        <ul className="grid gap-3">
          {visible.map((o) => (
            <li key={o.id}>
              <label
                className={cn(
                  "border-input hover:bg-surface flex cursor-pointer items-start gap-3 rounded-md border-2 p-4",
                  "has-[:checked]:border-primary has-[:checked]:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-innovation`}
                  value={o.id}
                  checked={o.id === value}
                  onChange={() => onChange(o.id)}
                  className="accent-primary mt-1 size-5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-lg leading-snug font-bold">
                    {o.title}
                  </span>
                  {o.categoryLabels.length ? (
                    <span className="text-muted-foreground block text-sm font-semibold">
                      {o.categoryLabels.join(" · ")}
                    </span>
                  ) : null}
                  <span className="text-foreground/85 mt-1 line-clamp-2 block text-[0.9375rem] leading-snug">
                    {o.summary}
                  </span>
                  {o.ramowyPlan || o.badge ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {o.ramowyPlan ? (
                        <span className="border-brand-accent text-foreground inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-sm font-semibold">
                          <FileCheckIcon aria-hidden="true" className="size-4" />
                          Ramowy Plan ROPS
                        </span>
                      ) : null}
                      {o.badge ? (
                        <span className="border-hairline text-foreground inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-sm font-semibold">
                          <AwardIcon aria-hidden="true" className="size-4" />
                          Wybrana do upowszechniania
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {matches.length > limit ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => setLimit((l) => l + PAGE * 2)}
        >
          Pokaż więcej ({matches.length - limit})
        </Button>
      ) : null}
    </div>
  );
}
