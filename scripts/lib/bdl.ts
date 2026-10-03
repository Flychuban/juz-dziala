/** Minimal GUS BDL API client: anonymous, ≥1.5 s between calls, every response archived. */
import { politeFetch, sleep } from "./http";

export const BDL = "https://bdl.stat.gov.pl/api/v1";
const MIN_DELAY = 1600;

export async function bdlGet<T>(path: string, params: Record<string, string | number | (string | number)[]> = {}): Promise<{ json: T; capturedAt: string; url: string }> {
  const q = new URLSearchParams();
  q.set("format", "json");
  q.set("lang", "pl");
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) for (const x of v) q.append(k, String(x));
    else q.set(k, String(v));
  }
  const url = `${BDL}${path}?${q.toString()}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await politeFetch(url, { minDelayMs: MIN_DELAY, allowError: true, headers: { Accept: "application/json" } });
    if (r.status === 200 || r.status === undefined) return { json: JSON.parse(r.body.toString("utf8")) as T, capturedAt: r.capturedAt, url };
    if (r.status === 429) {
      const wait = 20_000 * (attempt + 1);
      console.warn(`BDL 429 (rate limit) on ${url}; waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`BDL HTTP ${r.status} for ${url}: ${r.body.toString("utf8").slice(0, 200)}`);
  }
  throw new Error(`BDL rate limit persisted for ${url}`);
}

/** Follow `links.next` pages (page-size 100). */
export async function bdlAll<T>(path: string, params: Record<string, string | number | (string | number)[]>): Promise<{ results: T[]; capturedAt: string }> {
  const results: T[] = [];
  let page = 0;
  let capturedAt = "";
  for (;;) {
    const r = await bdlGet<{ results?: T[]; totalRecords?: number; links?: { next?: string } }>(path, { ...params, "page-size": 100, page });
    capturedAt ||= r.capturedAt;
    results.push(...(r.json.results ?? []));
    if (!r.json.links?.next || (r.json.totalRecords !== undefined && results.length >= r.json.totalRecords)) break;
    page++;
    if (page > 20) throw new Error("too many pages");
  }
  return { results, capturedAt };
}
