/**
 * Polite, archiving HTTP for the data scripts.
 *
 * - one request at a time (callers await), >= `minDelayMs` between requests to the same host;
 * - identifies itself with a fixed User-Agent;
 * - reads robots.txt once per host and refuses disallowed paths;
 * - archives the raw bytes of every fetch under data/raw/ (gitignored) and records
 *   {url, capturedAt, sha256, bytes, file} in data/manifest.json (committed);
 * - reuses an archived copy when one exists (set REFRESH=1 to fetch again), so re-running a
 *   parser never hits the server twice for the same page.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const USER_AGENT = "JuzDziala-HackYeah2026/0.1 (+https://github.com/Flychuban/juz-dziala)";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA_DIR = join(ROOT, "data");
export const RAW_DIR = join(DATA_DIR, "raw");
const MANIFEST = join(DATA_DIR, "manifest.json");

export type ManifestEntry = {
  url: string;
  capturedAt: string;
  sha256: string;
  bytes: number;
  file: string; // path relative to the repo root
  status?: number;
  contentType?: string | null;
};

export type Fetched = ManifestEntry & { body: Buffer; fromArchive: boolean; finalUrl: string };

let manifestCache: ManifestEntry[] | null = null;

export function readManifest(): ManifestEntry[] {
  if (manifestCache) return manifestCache;
  manifestCache = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as ManifestEntry[]) : [];
  return manifestCache;
}

function writeManifest(entries: ManifestEntry[]): void {
  entries.sort((a, b) => a.url.localeCompare(b.url) || a.capturedAt.localeCompare(b.capturedAt));
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + "\n");
}

function record(entry: ManifestEntry): void {
  const entries = readManifest();
  // One row per (url, content). Re-fetching identical bytes refreshes capturedAt.
  const i = entries.findIndex((e) => e.url === entry.url && e.sha256 === entry.sha256);
  if (i >= 0) entries[i] = entry;
  else entries.push(entry);
  writeManifest(entries);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const lastHit = new Map<string, number>();
async function waitForHost(host: string, minDelayMs: number): Promise<void> {
  const last = lastHit.get(host);
  if (last !== undefined) {
    const wait = last + minDelayMs - Date.now();
    if (wait > 0) await sleep(wait);
  }
  lastHit.set(host, Date.now());
}

// ---------------------------------------------------------------- robots.txt

type Rule = { allow: boolean; path: string };
const robotsCache = new Map<string, Rule[]>();

export function parseRobots(text: string, agent = "juzdziala"): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow" && value) current.rules.push({ allow: false, path: value });
      if (key === "allow" && value) current.rules.push({ allow: true, path: value });
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(rulePath: string, path: string): boolean {
  const anchored = rulePath.endsWith("$");
  const body = anchored ? rulePath.slice(0, -1) : rulePath;
  const re = new RegExp(
    "^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""),
  );
  return re.test(path);
}

export function isAllowed(rules: Rule[], path: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

async function robotsFor(origin: string, minDelayMs: number): Promise<Rule[]> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  const host = new URL(origin).host;
  await waitForHost(host, minDelayMs);
  let rules: Rule[] = [];
  try {
    const res = await fetch(origin + "/robots.txt", { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    const text = await res.text();
    // A 404, or an HTML page served in place of robots.txt, means there are no rules.
    if (res.ok && !/html/i.test(type) && !/^\s*</.test(text)) rules = parseRobots(text);
  } catch {
    rules = [];
  }
  robotsCache.set(origin, rules);
  return rules;
}

// ---------------------------------------------------------------- fetch

function archivePath(url: string, sha: string, contentType: string | null): string {
  const u = new URL(url);
  const extFromPath = /\.([a-z0-9]{2,5})$/i.exec(u.pathname)?.[1]?.toLowerCase();
  const ext =
    extFromPath ??
    (contentType?.includes("json") ? "json" : contentType?.includes("html") ? "html" : contentType?.includes("pdf") ? "pdf" : "bin");
  const slug = (u.pathname + (u.search ? "_" + u.search.slice(1) : ""))
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^A-Za-z0-9._,-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 150) || "index";
  return join(RAW_DIR, u.host, `${slug}.${sha.slice(0, 12)}.${ext}`);
}

export type FetchOptions = {
  minDelayMs?: number;
  headers?: Record<string, string>;
  /** Reuse the newest archived copy if present (default true unless REFRESH=1). */
  useArchive?: boolean;
  /** Do not throw on non-2xx; still archived. */
  allowError?: boolean;
};

export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<Fetched> {
  const minDelayMs = opts.minDelayMs ?? 1100;
  const useArchive = opts.useArchive ?? process.env.REFRESH !== "1";

  if (useArchive) {
    const prior = readManifest()
      .filter((e) => e.url === url && (e.status === undefined || (e.status >= 200 && e.status < 300)))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
    if (prior && existsSync(join(ROOT, prior.file))) {
      return { ...prior, body: readFileSync(join(ROOT, prior.file)), fromArchive: true, finalUrl: url };
    }
  }

  const u = new URL(url);
  const rules = await robotsFor(u.origin, minDelayMs);
  if (!isAllowed(rules, u.pathname + u.search)) throw new Error(`robots.txt disallows ${url}`);

  await waitForHost(u.host, minDelayMs);
  const capturedAt = new Date().toISOString(); // the clock is read once per fetch
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...opts.headers }, redirect: "follow" });
  const body = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  const contentType = res.headers.get("content-type");
  const abs = archivePath(url, sha256, contentType);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  const entry: ManifestEntry = {
    url,
    capturedAt,
    sha256,
    bytes: body.length,
    file: relative(ROOT, abs),
    status: res.status,
    contentType,
  };
  record(entry);
  if (!res.ok && !opts.allowError) throw new Error(`HTTP ${res.status} for ${url}`);
  return { ...entry, body, fromArchive: false, finalUrl: res.url };
}

/** HEAD-or-GET status check used for link verification; also archived when GET is needed. */
export async function checkUrl(url: string, minDelayMs = 1100): Promise<{ status: number; finalUrl: string }> {
  const u = new URL(url);
  const rules = await robotsFor(u.origin, minDelayMs);
  if (!isAllowed(rules, u.pathname + u.search)) return { status: -1, finalUrl: url };
  await waitForHost(u.host, minDelayMs);
  let res = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
  if (res.status === 405 || res.status === 403 || res.status === 404) {
    await waitForHost(new URL(res.url || url).host, minDelayMs);
    res = await fetch(url, { method: "GET", headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    await res.arrayBuffer();
  }
  return { status: res.status, finalUrl: res.url };
}

export function writeJson(relPath: string, value: unknown): void {
  const abs = join(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(value, null, 2) + "\n");
}
