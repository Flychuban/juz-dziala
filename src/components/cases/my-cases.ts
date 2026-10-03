/**
 * „Twoje sprawy na tym urządzeniu": codes (and private-link tokens) kept in
 * this browser only. Storage may be blocked — every access is wrapped and
 * the pages work without it.
 */
const KEY = "jd_my_cases";
const MAX = 20;

export type SavedCase = {
  code: string;
  token?: string;
  savedAt: string;
  lastSeenAt?: string;
};

export function readMyCases(): SavedCase[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedCase =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as SavedCase).code === "string",
    );
  } catch {
    return [];
  }
}

function write(list: SavedCase[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    return true;
  } catch {
    return false;
  }
}

/** Saves (or refreshes) a case on this device. Returns false when storage is blocked. */
export function rememberCase(code: string, token?: string): boolean {
  const list = readMyCases();
  const prev = list.find((c) => c.code === code);
  const next: SavedCase = {
    code,
    token: token ?? prev?.token,
    savedAt: prev?.savedAt ?? new Date().toISOString(),
    lastSeenAt: prev?.lastSeenAt,
  };
  return write([next, ...list.filter((c) => c.code !== code)]);
}

export function markSeen(code: string): void {
  const list = readMyCases();
  const i = list.findIndex((c) => c.code === code);
  if (i < 0) return;
  list[i] = { ...list[i]!, lastSeenAt: new Date().toISOString() };
  write(list);
}

export function forgetCase(code: string): void {
  write(readMyCases().filter((c) => c.code !== code));
}
