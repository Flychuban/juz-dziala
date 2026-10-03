/**
 * Small client helpers shared by the Kreator, Tester and Sieć screens.
 */

/** A Polish message for any error thrown by a tRPC call. */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || msg.startsWith("[") || msg.startsWith("{")) {
    return "Nie udało się wysłać. Sprawdź pola formularza i spróbuj ponownie.";
  }
  if (/fetch|network|Failed/i.test(msg) && !/[ąęółśżźćń]/i.test(msg)) {
    return "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie — Twoje odpowiedzi są zapisane.";
  }
  return msg;
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
