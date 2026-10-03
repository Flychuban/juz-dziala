/**
 * Organisations and test sites named in the library cards → data/network.json
 *
 *   pnpm exec tsx scripts/build-network.ts   (run after ingest-library.ts)
 *
 * orgs: every organisation line of a card's (already anonymised) „Autorzy" section. Spelling
 * variants of one name („Fundacja Human Doc" / „Fundacja HumanDoc", „TKK" / „T.K.K.", „Ich" /
 * „ich") are merged on a key that ignores case, spaces and punctuation; differently worded
 * names are kept apart even when they may be the same body. Type comes from the name only:
 * ops > jst > fundacja > stowarzyszenie > uczelnia > firma > inna.
 *
 * sites: places a card's OWN text says the innovation was tested or implemented, from the
 * „Czy to działa?" and „Na czym polega rozwiązanie?" sections, only when clearly stated. The
 * candidates are found by pattern (test/implementation wording next to a named place or
 * institution) and every accepted site is checked to occur verbatim in its sentence. In the
 * current library no card names such a place — the only named place (Warszawa, c021) is in
 * the target-group text and says nothing about testing — so `sites` is empty, by evidence
 * rather than by omission. The scan still runs on every build.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { ROOT, writeJson } from "./lib/http";
import { AND_PRIVATE_PERSONS, PRIVATE_PERSONS } from "./lib/authors";
import { Network, type LibraryCard } from "./schemas";

type OrgType = "fundacja" | "stowarzyszenie" | "uczelnia" | "jst" | "ops" | "firma" | "inna";

export function orgType(name: string): OrgType {
  const n = name.toLowerCase();
  if (/ośrod\p{L}* pomocy społecznej|(^|[^\p{L}])(m|g|mg)?ops([^\p{L}]|$)|pcpr|centrum usług społecznych/u.test(n)) return "ops";
  if (/^(gmina|powiat|miasto|województwo|urząd)([^\p{L}]|$)/u.test(n)) return "jst";
  if (/fundacj|fudacj/u.test(n)) return "fundacja";
  if (/stowarzysz/u.test(n)) return "stowarzyszenie";
  if (/uniwersytet|politechnik|akademi|uczelni/u.test(n)) return "uczelnia";
  if (/sp\.?\s*z\s*o\.?\s*o|(^|\s)s\.\s?c\.|(^|\s)s\.\s?a\.|spółk/u.test(n)) return "firma";
  return "inna";
}

export const orgKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Wording that says the innovation was tested or put to use somewhere. */
const TESTED = /(test|przetestow|testow|pilota|wdroż|wdrożon|realizowan|zastosowan|sprawdzon)/i;
/** A named place: locative with a capitalised name, or a gmina/powiat/town phrase. */
const PLACE = /(?:\b(?:w|we|na terenie)\s+(?:gminie|gminy|powiecie|powiatu|mieście|miejscowości)\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)*))|(?:\b(?:w|we)\s+(\p{Lu}\p{Ll}+(?:[\s-]\p{Lu}\p{Ll}+)*))/u;
const NOT_PLACES = /^(Polsce|Polskim|Polskiej|Internecie|Centrum Referencyjnym|Klubach|Domach|Domu|Warsztatach|LimeSurvey|PJM|Polskim Języku Migowym)$/u;

async function main() {
  const lib = JSON.parse(readFileSync(join(ROOT, "data/library.json"), "utf8")) as LibraryCard[];

  // ---- orgs
  const byKey = new Map<string, { names: Map<string, number>; cards: LibraryCard[] }>();
  for (const card of lib) {
    for (const line of card.sections.authors.split("\n").map((l) => l.trim())) {
      if (!line || line === PRIVATE_PERSONS || line === AND_PRIVATE_PERSONS) continue;
      const key = orgKey(line);
      const entry = byKey.get(key) ?? { names: new Map<string, number>(), cards: [] as LibraryCard[] };
      entry.names.set(line, (entry.names.get(line) ?? 0) + 1);
      if (!entry.cards.includes(card)) entry.cards.push(card);
      byKey.set(key, entry);
    }
  }
  const orgs = [...byKey.values()]
    .map((e) => {
      // most frequent spelling; ties keep the first-seen one (Map order, stable sort)
      const name = [...e.names.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const cards = e.cards.sort((a, b) => a.id.localeCompare(b.id));
      return { name, type: orgType(name), innovationIds: cards.map((c) => c.id), isSample: false as const, sourceUrl: cards[0]!.sourceUrl, variants: [...e.names.keys()] };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pl"))
    .map((o, i) => ({ id: `o${String(i + 1).padStart(3, "0")}`, ...o }));

  // ---- sites
  const candidates: { innovationId: string; sentenceId: string; place: string; text: string }[] = [];
  for (const card of lib) {
    for (const s of card.sentences) {
      if (s.section !== "doesItWork" && s.section !== "solution") continue;
      if (!TESTED.test(s.text)) continue;
      const m = PLACE.exec(s.text.slice(1)); // skip a sentence-initial capital
      const place = m?.[1] ?? m?.[2];
      if (place && !NOT_PLACES.test(place)) candidates.push({ innovationId: card.id, sentenceId: s.id, place, text: s.text });
    }
  }
  // Accepted sites are listed explicitly after reading each candidate; none qualify today.
  const ACCEPTED: { innovationId: string; sentenceId: string; place: string }[] = [];
  const sites = ACCEPTED.map((a) => {
    const s = lib.find((c) => c.id === a.innovationId)?.sentences.find((x) => x.id === a.sentenceId);
    if (!s || !s.text.includes(a.place)) throw new Error(`site ${a.place} not found verbatim in ${a.sentenceId}`);
    return { ...a, isSample: false as const };
  });

  const network = Network.parse({ orgs: orgs.map(({ variants: _v, ...o }) => o), sites });
  writeJson("data/network.json", network);

  console.log(`network.json: ${network.orgs.length} organizacji, ${network.sites.length} miejsc testowania`);
  const types = network.orgs.reduce<Record<string, number>>((a, o) => ((a[o.type] = (a[o.type] ?? 0) + 1), a), {});
  console.log(`  typy: ${JSON.stringify(types)}`);
  for (const o of orgs.filter((x) => x.variants.length > 1)) console.log(`  scalono: ${o.variants.join(" | ")}`);
  console.log(`  kandydaci na miejsca (do przeglądu): ${candidates.length}`);
  for (const c of candidates) console.log(`    ${c.sentenceId} „${c.place}": ${c.text.slice(0, 160)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
