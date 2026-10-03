/**
 * Keywords for a library card: 5–12 lower-case words or two-word phrases that occur verbatim in
 * the card's own text. No stemming is applied to the OUTPUT and nothing is invented — every
 * keyword is checked to be a substring of the lower-cased card text before it is kept.
 *
 * Heuristics (Polish, no POS tagger): stopwords and verb/adverb-shaped words are never used;
 * adjective-shaped words only appear inside a two-word phrase; phrases and words from the
 * title, or repeated in the card, rank highest; inflected repeats of a chosen word
 * („wózkach" after „wózków") are skipped.
 */

const STOPWORDS = new Set(
  (
    "a aby ach acz aczkolwiek albo ale ależ ani aż bardziej bardzo bez bo bowiem by byli bym być był była było były będzie będą będąc cała cały całej całego chce choć ci cię co cokolwiek coraz coś czasami czasem czemu czy czyli często dla dlaczego dlatego do dobrze dokąd dość dużo dwa dwie dzięki dziś gdy gdyby gdyż gdzie go hab i ich ile im inna inne inny innych innym innymi innego innej iż ja ją jak jaka jaki jakie jakich jakiś jako je jeden jedna jedno jednak jego jej jemu jest jestem jeszcze jeśli jeżeli już każdy każda każde każdego każdej kiedy kilka kto która które którego której który których którym którymi którzy którą ku lecz lub ma mają mam mamy mało mi mimo między mną mnie mogą mogę może można mu musi my na nad nam nas nasz nasza nasze natomiast nawet nic nich nie niech niego niej nim nimi niż o obok od około on ona one oni ono oraz oto po pod podczas pomimo ponad ponieważ poprzez powinien powinna poza prawie przed przez przy również sam sama same samo są się skąd sobie sobą swoje swoich swój swoją swojej swoim swoimi ta tak taka taki takich takie także takim takiej tam te tego tej temu ten teraz też to tobą tu tutaj ty tych tylko tym tymi tę tą u w we według wiele wielu więc więcej wraz wszyscy wszystkich wszystkie wszystko wśród wtedy z za zawsze ze znowu został została zostało zostały zostać że żeby " +
    "innowacja innowacji innowację innowacją innowacje innowacyjne innowacyjny innowacyjna rozwiązanie rozwiązania rozwiązaniu rozwiązaniem osoba osoby osób osobom osobami osobach osobie test testu testów testowania testowanie testy efekt efekty efektem sposób sposobu narzędzie narzędzia narzędziem możliwość możliwości pozwala pozwalają umożliwia umożliwiają daje dają stanowi stanowią dotyczy dotyczące dotyczących odpowiada odpowiedź odpowiedzią problem problemy problemu problemem problemów celu cel celem ramach rzecz zakresie zakres różnymi różnych różne obecnie szczególnie poprzez m.in np tj ok ul tzw itp itd r proc zł tys mln brak braku etapie poziomie stopniu formie postaci części liczba liczby wiele dany danym danej momencie przypadku czasie wyniku podstawie pomocą pomocy dzięki oparciu wydaje wydają związku związane związana różnego różnych przede wszystkim wymaga wymagają wymagających stanie poziom okresie charakterze podmioty podmiotów sytuacji sytuacja rodzaju ramy wykazał wykazała wykazało potwierdził potwierdziła potwierdziło mogą może można także również jednocześnie natomiast właśnie bardzo dużo"
  ).split(/\s+/),
);

/** Verbs, adverbs and participles: never a keyword. */
const VERBISH = /(?:ć|ł|ła|ło|li|ły|liśmy|łem|łam|my|cie|uje|ują|ają|eją|ywa|iwa|awa|ane|ana|any|ani|ony|ona|one|eni|ęty|ęta|ęte|[^aeęioóuy]nie|wo|ąc)$/u;
/** Adjective-shaped: allowed only as the first word of a phrase (or second, after a noun). */
const ADJECTIVISH = /(?:ny|ne|ni|nych|nymi|nej|nym|ną|wy|we|wych|wej|wym|ą|ych|ymi|ich|imi|ej|szy|sze|szych|szej|ski|skie|cki|ckie|czny|czne|owy|owe|owa|alny|alna|alne)$/u;

function tokens(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];
}

const usable = (w: string) => w.length >= 4 && !STOPWORDS.has(w) && !VERBISH.test(w);

/** Two inflected forms of one word: share a prefix of max(4, shorter − 2) letters. */
function sameStem(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length);
  const k = Math.min(n, Math.max(4, n - 2));
  return a.slice(0, k) === b.slice(0, k);
}

export function extractKeywords(title: string, sections: Record<string, string>, max = 10): string[] {
  const parts: [string, number][] = [
    [title, 5],
    [sections.solution ?? "", 1.5],
    [sections.problems ?? "", 1.5],
    [sections.targetGroup ?? "", 2],
    [sections.whoCanUse ?? "", 0.6],
    [sections.doesItWork ?? "", 0.4],
  ];
  const haystack = parts.map(([t]) => t).join("\n").toLowerCase().replace(/\s+/g, " ");

  const words = new Map<string, number>();
  const phrases = new Map<string, number>();
  const count = new Map<string, number>();
  for (const [text, weight] of parts) {
    // Do not form phrases across punctuation.
    for (const clause of text.split(/[.,;:!?()\n„”"–—/]+/)) {
      const ws = tokens(clause);
      for (let i = 0; i < ws.length; i++) {
        const a = ws[i]!;
        if (usable(a)) {
          if (!ADJECTIVISH.test(a)) words.set(a, (words.get(a) ?? 0) + weight);
          count.set(a, (count.get(a) ?? 0) + 1);
        }
        const b = ws[i + 1];
        if (b && usable(a) && usable(b) && !(ADJECTIVISH.test(a) && ADJECTIVISH.test(b) && a.length < 6)) {
          const p = `${a} ${b}`;
          phrases.set(p, (phrases.get(p) ?? 0) + weight * 1.4);
          count.set(p, (count.get(p) ?? 0) + 1);
        }
      }
    }
  }
  const titleLc = title.toLowerCase();
  const eligible = (k: string) => haystack.includes(k) && ((count.get(k) ?? 0) >= 2 || titleLc.includes(k));
  const ranked = [...phrases.entries(), ...words.entries()]
    .filter(([k]) => eligible(k))
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "pl"));

  const chosen: string[] = [];
  const covered = (k: string) => {
    const kw = k.split(" ");
    return chosen.some((c) => {
      const cw = c.split(" ");
      if (kw.length === 1) return cw.some((w) => sameStem(w, kw[0]!));
      return cw.length === kw.length && cw.every((w, i) => sameStem(w, kw[i]!));
    });
  };
  for (const [k] of ranked) {
    if (chosen.length >= max) break;
    if (!covered(k)) chosen.push(k);
  }
  // Short cards: fall back to single words and phrases seen once, still verbatim, until five.
  if (chosen.length < 5) {
    const fallback = [...phrases.entries(), ...words.entries()]
      .filter(([k]) => haystack.includes(k))
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "pl"));
    for (const [k] of fallback) {
      if (chosen.length >= 5) break;
      if (!covered(k)) chosen.push(k);
    }
  }
  if (chosen.length < 5) {
    for (const w of tokens(haystack)) {
      if (chosen.length >= 5) break;
      if (w.length >= 4 && !STOPWORDS.has(w) && !chosen.includes(w)) chosen.push(w);
    }
  }
  return chosen;
}
