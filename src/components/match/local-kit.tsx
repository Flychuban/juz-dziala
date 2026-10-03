"use client";

/**
 * Minimal local stand-ins for the shared kit (src/components/kit/*, Agent D).
 * Swap each export for the kit version once it is merged:
 * SourceLine, TwojaSciezka, UserTerms, Highlight, ReadAloud, AreaTag, SampleBadge.
 */
import { Fragment, useEffect, useState, type ReactNode } from "react";

import { MAPA_AREA_LABEL, type MapaArea } from "~/lib/domain";
import { formatDatePl, highlightRanges } from "./format";


/** „Źródło: <name>, stan na <date>" + link. */
export function SourceLine({ name, url, date }: { name: string; url?: string | null; date?: string | null }) {
  const when = formatDatePl(date);
  return (
    <p className="text-muted-foreground text-sm">
      Źródło:{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-foreground underline">
          {name}
          <span className="sr-only"> (otwiera się w nowej karcie)</span>
        </a>
      ) : (
        name
      )}
      {when ? `, stan na ${when}` : null}
    </p>
  );
}

export function SampleBadge() {
  return (
    <span className="border-hairline bg-warning-bg text-foreground ml-1 inline-flex items-center rounded border px-1.5 text-xs font-semibold">
      przykładowe
    </span>
  );
}

export function AreaTag({ area }: { area: MapaArea }) {
  return (
    <span className="border-hairline bg-surface text-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-sm">
      {MAPA_AREA_LABEL[area]}
    </span>
  );
}

/** The resident's own words as chips. */
export function UserTerms({ terms, label = "Twoje słowa:" }: { terms: readonly string[]; label?: string }) {
  if (terms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{label}</span>
      <ul className="flex flex-wrap gap-2" aria-label={label.replace(/:$/u, "")}>
        {terms.map((t) => (
          <li key={t}>
            <mark className="bg-warning-bg text-foreground border-hairline rounded border px-2 py-0.5">{t}</mark>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Marks every occurrence of `terms` in `text` (case- and diacritic-insensitive). */
export function Highlight({ text, terms }: { text: string; terms: readonly string[] }) {
  const merged = highlightRanges(text, terms);
  if (merged.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let pos = 0;
  merged.forEach(([s, e], i) => {
    if (s > pos) parts.push(<Fragment key={`t${i}`}>{text.slice(pos, s)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className="bg-warning-bg text-foreground rounded px-0.5">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  if (pos < text.length) parts.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <>{parts}</>;
}

export type PathStep = { label: string; content: ReactNode };

/** Rozwiązanie → Działa już w → Kto pomoże → Skąd pieniądze. */
export function TwojaSciezka({ steps }: { steps: PathStep[] }) {
  return (
    <section aria-label="Twoja ścieżka" className="border-hairline rounded-lg border">
      <h4 className="border-hairline bg-surface border-b px-4 py-2 text-base font-semibold">Twoja ścieżka</h4>
      <ol className="divide-hairline divide-y">
        {steps.map((s, i) => (
          <li key={s.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <span className="font-semibold">
              <span aria-hidden="true" className="text-muted-foreground tabular mr-2">
                {i + 1}.
              </span>
              {s.label}
            </span>
            <div>{s.content}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** speechSynthesis with a pl-PL voice; hidden when the browser cannot speak. */
export function ReadAloud({ text, className }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  if (!supported) return null;
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pl-PL";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("pl"));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className={className}>
      <span aria-hidden="true">{speaking ? "■" : "▶"}</span> {speaking ? "Zatrzymaj czytanie" : "Czytaj na głos"}
    </button>
  );
}
