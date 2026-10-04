/**
 * Small client helpers shared by the Kreator, Tester and Sieć screens.
 */
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import plIdeas from "../../../messages/pl/ideas.json";

type ErrorKey = "generic" | "network";

/** No answer from the server at all (offline, DNS, a dropped connection). */
function isNetworkError(e: unknown): boolean {
  if (e instanceof TRPCClientError) return !(e as TRPCClientError<never>).shape;
  return e instanceof TypeError;
}

function messageFor(e: unknown, t: (k: ErrorKey) => string): string {
  if (isNetworkError(e)) return t("network");
  const msg = e instanceof Error ? e.message : "";
  // zod issue lists and other machine texts are not for people.
  if (!msg || msg.startsWith("[") || msg.startsWith("{")) return t("generic");
  return msg;
}

/**
 * A message for any error thrown by a tRPC call, in Polish. Screens that follow
 * the visitor's language use `useErrorText()` instead.
 */
export function errorText(e: unknown): string {
  return messageFor(e, (k) => plIdeas.errors[k]);
}

/** `errorText` in the visitor's language (server messages arrive already translated). */
export function useErrorText(): (e: unknown) => string {
  const t = useTranslations("ideas.errors");
  return useCallback((e: unknown) => messageFor(e, (k) => t(k)), [t]);
}

/** localStorage that never throws (private mode, blocked storage, SSR). */
export const safeStorage = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage blocked — nothing to clean */
    }
  },
};

/**
 * Wizard answers kept on this device, so going back, reloading or leaving
 * and returning never loses them (the senior pattern's autosaved draft).
 * `omit` names fields that are never written to storage — a contact e-mail or
 * phone stays in memory only. `clear()` after sending.
 */
export function useAutosavedState<T extends object>(
  key: string,
  initial: T,
  omit: readonly (keyof T)[] = [],
): { value: T; set: React.Dispatch<React.SetStateAction<T>>; restored: boolean; clear: () => void } {
  const [value, set] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const skipFirst = useRef(true);
  const cleared = useRef(false);
  const initialRef = useRef(initial);
  const omitRef = useRef(omit);

  useEffect(() => {
    const saved = safeStorage.get<Partial<T>>(key);
    if (saved && typeof saved === "object") {
      const next = { ...initialRef.current };
      let changed = false;
      for (const k of Object.keys(initialRef.current) as (keyof T)[]) {
        if (k in saved && saved[k] !== undefined && !omitRef.current.includes(k)) {
          next[k] = saved[k];
          if (JSON.stringify(saved[k]) !== JSON.stringify(initialRef.current[k])) changed = true;
        }
      }
      if (changed) {
        set(next);
        setRestored(true);
      }
    }
    loaded.current = true;
  }, [key]);

  useEffect(() => {
    // The first run is the mount itself: nothing typed yet, nothing to save.
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (!loaded.current || cleared.current) return;
    const out: Partial<T> = { ...value };
    for (const k of omitRef.current) delete out[k];
    safeStorage.set(key, out);
  }, [key, value]);

  const clear = useCallback(() => {
    cleared.current = true;
    safeStorage.remove(key);
  }, [key]);

  return { value, set, restored, clear };
}
