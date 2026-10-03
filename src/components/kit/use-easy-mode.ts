"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-easy"],
  });
  return () => obs.disconnect();
}

/**
 * True while the „Tekst łatwy" toggle in the header is on (data-easy="1" on
 * <html>). Reacts immediately when the toggle changes; false on the server.
 */
export function useEasyMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.easy === "1",
    () => false,
  );
}
