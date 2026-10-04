/**
 * Text processing for English: the English card translations (innovations.en)
 * and what a visitor types in English mode.
 *
 * Tokenising reuses `tokenize` / `tokenizeWithOffsets` from polish.ts, which
 * split on Unicode letters and digits (never `\b` or `\w`), so a Polish word
 * typed in English mode is still one word.
 */
import { normalize } from "./polish";

/**
 * Function words dropped for retrieval. Deliberately kept: "alone", "no",
 * "nobody", "without", "own" — they carry meaning ("lives alone", "no food",
 * "on her own"). Phrase triggers in synonyms.en.ts still see every word,
 * stopwords included.
 */
const STOPWORD_LIST = [
  "a", "about", "above", "after", "again", "against", "all", "also", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "could", "did", "do", "does", "doing", "done", "down", "during", "each", "even", "ever",
  "every", "few", "for", "from", "further", "get", "gets", "getting", "got", "had", "has", "have",
  "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in",
  "into", "is", "it", "its", "itself", "just", "let", "like", "may", "me", "might", "more", "most",
  "much", "must", "my", "myself", "nor", "now", "of", "off", "on", "once", "only", "or", "other",
  "our", "ours", "ourselves", "out", "over", "please", "quite", "rather", "really", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
  "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "us", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
  "will", "with", "would", "you", "your", "yours", "yourself", "yourselves",
  // contractions split by the tokenizer ("doesn't" → "doesn", "t")
  "don", "doesn", "didn", "isn", "aren", "wasn", "weren", "won", "wouldn", "couldn", "shouldn",
  "hasn", "haven", "hadn", "ll", "re", "ve",
  // filler that otherwise prefix-matches card words ("almost" → "almost", "hello" → "hell…")
  "hello", "hi", "dear", "thanks", "thank", "almost", "already", "always", "still", "lot", "lots",
  "something", "anything", "everything", "someone", "anyone", "everyone", "somebody", "anybody",
  "thing", "things", "way", "know", "think", "want", "wants", "wanted", "tell", "said", "say", "says",
];
const STOPWORDS: ReadonlySet<string> = new Set(STOPWORD_LIST);

export function isStopwordEn(word: string): boolean {
  return STOPWORDS.has(normalize(word));
}

/** Irregular plurals and forms a suffix rule cannot reach. */
const IRREGULAR: Readonly<Record<string, string>> = {
  children: "child",
  people: "person",
  persons: "person",
  women: "woman",
  men: "man",
  teeth: "tooth",
  feet: "foot",
  mice: "mouse",
  lives: "life",
  wives: "wife",
  knives: "knife",
  elderly: "elder",
  older: "old",
  oldest: "old",
};

const VOWEL = /[aeiouy]/u;
const LETTERS = /[\p{L}\p{N}]+/gu;

/** A doubled final consonant left by "-ing"/"-ed" ("stopped" → "stopp" → "stop"), except l, s, z. */
function undouble(w: string): string {
  const a = w.at(-1);
  if (a && a === w.at(-2) && !"aeiouylsz".includes(a)) return w.slice(0, -1);
  return w;
}

/**
 * A light, deterministic English suffix stemmer (a small subset of Porter's
 * rules), enough to make the families residents and cards use meet:
 * lonely/loneliness → "loneli", family/families → "famili",
 * disabled/disability → "disabl", isolated/isolation → "isolat",
 * depressed/depression → "depress", wheelchairs → "wheelchair".
 * Words of three letters or fewer are left alone.
 */
export function stemEn(word: string): string {
  let w = (normalize(word).match(LETTERS) ?? []).join("");
  if (w.length <= 3) return w;
  const irregular = IRREGULAR[w];
  if (irregular) return irregular;

  // plurals
  if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (/(?:[sxz]|ch|sh)es$/u.test(w) && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/[su]s$/u.test(w) && w.length > 3) w = w.slice(0, -1);

  // derivational endings, longest first; each must leave a stem with a vowel
  const rules: [string, string][] = [
    ["ibility", "ibl"],
    ["ability", "abl"],
    ["ational", "at"],
    ["ation", "at"],
    ["ness", ""],
    ["ment", ""],
    ["ities", ""],
    ["ity", ""],
    ["ive", ""],
    ["ful", ""],
  ];
  for (const [suffix, replacement] of rules) {
    if (w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length) + replacement;
      if (base.length >= 3 && VOWEL.test(base)) {
        w = base;
        break;
      }
    }
  }

  // "-ion" after s/t: depression → depress, isolation handled above
  if (/[st]ion$/u.test(w) && w.length > 5) w = w.slice(0, -3);

  // inflections
  if (w.endsWith("ing") && w.length > 5 && VOWEL.test(w.slice(0, -3))) w = undouble(w.slice(0, -3));
  else if (w.endsWith("ed") && w.length > 4 && VOWEL.test(w.slice(0, -2))) w = undouble(w.slice(0, -2));

  // "-able"/"-ible" → "-abl"/"-ibl" (disable → disabl, meets disability)
  if (/[ai]ble$/u.test(w)) w = w.slice(0, -1);
  // final y → i (family → famili, meets families → famili)
  else if (w.endsWith("y") && w.length > 3 && VOWEL.test(w.slice(0, -1))) w = `${w.slice(0, -1)}i`;
  // final silent e (care → car, home → hom), keeping very short stems
  else if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);

  return w;
}

/** Index-time term processing for English text: lowercase, drop stopwords and single letters, stem. */
export function processTermEn(term: string): string | null {
  const n = normalize(term);
  if (n.length < 2 || isStopwordEn(n)) return null;
  return stemEn(n);
}
