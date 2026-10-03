"use client";

import { useEffect, useState } from "react";

/**
 * A− / A+, high contrast and „Tekst łatwy" (easy-to-read mode). Each
 * preference is an attribute on <html> (data-text-size, data-contrast,
 * data-easy) applied before paint by the root layout, and persisted in
 * localStorage when allowed; everything works without storage.
 * Toggles use aria-pressed and show their state visibly (filled button).
 */
const SIZES = ["", "lg", "xl"] as const;

function save(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked — preference lasts for this page view */
  }
}

const BTN =
  "border-input bg-background text-foreground hover:bg-accent inline-flex min-h-12 items-center justify-center rounded-md border px-3 text-sm font-semibold disabled:opacity-50 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background";

export function AccessibilityToolbar() {
  const [size, setSize] = useState<(typeof SIZES)[number]>("");
  const [contrast, setContrast] = useState(false);
  const [easy, setEasy] = useState(false);

  useEffect(() => {
    const d = document.documentElement;
    setSize((d.dataset.textSize as (typeof SIZES)[number]) ?? "");
    setContrast(d.dataset.contrast === "high");
    setEasy(d.dataset.easy === "1");
  }, []);

  const applySize = (next: (typeof SIZES)[number]) => {
    setSize(next);
    if (next) document.documentElement.dataset.textSize = next;
    else delete document.documentElement.dataset.textSize;
    save("jd_text_size", next);
  };
  const idx = SIZES.indexOf(size);

  return (
    <div
      role="group"
      aria-label="Ustawienia wyświetlania"
      className="flex flex-wrap items-center gap-1"
    >
      <button
        type="button"
        onClick={() => applySize(SIZES[Math.max(0, idx - 1)] ?? "")}
        disabled={idx <= 0}
        className={`${BTN} min-w-12 px-2`}
        aria-label="A− — zmniejsz tekst"
      >
        A−
      </button>
      <button
        type="button"
        onClick={() =>
          applySize(SIZES[Math.min(SIZES.length - 1, idx + 1)] ?? "xl")
        }
        disabled={idx >= SIZES.length - 1}
        className={`${BTN} min-w-12 px-2 text-base`}
        aria-label="A+ — powiększ tekst"
      >
        A+
      </button>
      <button
        type="button"
        aria-pressed={contrast}
        onClick={() => {
          const next = !contrast;
          setContrast(next);
          if (next) document.documentElement.dataset.contrast = "high";
          else delete document.documentElement.dataset.contrast;
          save("jd_contrast", next ? "high" : "");
        }}
        className={BTN}
      >
        Kontrast
      </button>
      <button
        type="button"
        aria-pressed={easy}
        onClick={() => {
          const next = !easy;
          setEasy(next);
          if (next) document.documentElement.dataset.easy = "1";
          else delete document.documentElement.dataset.easy;
          save("jd_easy", next ? "1" : "");
        }}
        className={BTN}
      >
        Tekst łatwy
      </button>
    </div>
  );
}
