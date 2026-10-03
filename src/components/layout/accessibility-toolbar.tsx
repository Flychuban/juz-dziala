"use client";

import { useEffect, useState } from "react";

/**
 * A+/A− and high contrast. Preferences persist in localStorage when allowed;
 * everything works without it. (Polished by the a11y pass agent.)
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

export function AccessibilityToolbar() {
  const [size, setSize] = useState<(typeof SIZES)[number]>("");
  const [contrast, setContrast] = useState(false);

  useEffect(() => {
    const d = document.documentElement;
    setSize((d.dataset.textSize as (typeof SIZES)[number]) ?? "");
    setContrast(d.dataset.contrast === "high");
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
      className="flex items-center gap-1"
    >
      <button
        type="button"
        onClick={() => applySize(SIZES[Math.max(0, idx - 1)] ?? "")}
        disabled={idx <= 0}
        className="border-input inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-2 text-sm font-semibold disabled:opacity-50"
        aria-label="Zmniejsz tekst"
      >
        A−
      </button>
      <button
        type="button"
        onClick={() =>
          applySize(SIZES[Math.min(SIZES.length - 1, idx + 1)] ?? "xl")
        }
        disabled={idx >= SIZES.length - 1}
        className="border-input inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-2 text-base font-semibold disabled:opacity-50"
        aria-label="Powiększ tekst"
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
        className="border-input inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium"
      >
        Kontrast
      </button>
    </div>
  );
}
