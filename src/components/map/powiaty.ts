/**
 * The 22 powiats of Małopolska (TERYT 12xx), used as names when the map
 * file is missing and to normalise keys. Codes 1261–1263 are cities with
 * powiat rights.
 */
export const POWIAT_NAMES: Record<string, string> = {
  "1201": "bocheński",
  "1202": "brzeski",
  "1203": "chrzanowski",
  "1204": "dąbrowski",
  "1205": "gorlicki",
  "1206": "krakowski",
  "1207": "limanowski",
  "1208": "miechowski",
  "1209": "myślenicki",
  "1210": "nowosądecki",
  "1211": "nowotarski",
  "1212": "olkuski",
  "1213": "oświęcimski",
  "1214": "proszowicki",
  "1215": "suski",
  "1216": "tarnowski",
  "1217": "tatrzański",
  "1218": "wadowicki",
  "1219": "wielicki",
  "1261": "Kraków",
  "1262": "Nowy Sącz",
  "1263": "Tarnów",
};

/** Normalises a TERYT code (powiat or gmina, any length ≥ 4) to its 4-digit powiat key. */
export function powiatKey(teryt: string | number): string {
  return String(teryt).replace(/\D/g, "").slice(0, 4);
}

/**
 * English names of the 22 powiats (as English sources write them: the county
 * is named after its seat town). Cities with powiat rights keep their name.
 */
export const POWIAT_NAMES_EN: Record<string, string> = {
  "1201": "Bochnia County",
  "1202": "Brzesko County",
  "1203": "Chrzanów County",
  "1204": "Dąbrowa County",
  "1205": "Gorlice County",
  "1206": "Kraków County",
  "1207": "Limanowa County",
  "1208": "Miechów County",
  "1209": "Myślenice County",
  "1210": "Nowy Sącz County",
  "1211": "Nowy Targ County",
  "1212": "Olkusz County",
  "1213": "Oświęcim County",
  "1214": "Proszowice County",
  "1215": "Sucha County",
  "1216": "Tarnów County",
  "1217": "Tatra County",
  "1218": "Wadowice County",
  "1219": "Wieliczka County",
  "1261": "Kraków",
  "1262": "Nowy Sącz",
  "1263": "Tarnów",
};

/** True for the three cities with powiat rights (1261–1263). */
export function isCityPowiat(key: string): boolean {
  return powiatKey(key).startsWith("126");
}

/** The 4-digit key of a powiat from its Polish name („powiat bocheński", „Kraków"). */
export function powiatKeyByName(name: string): string | null {
  const short = name.replace(/^powiat\s+(m\.\s*)?/i, "").trim();
  for (const [k, v] of Object.entries(POWIAT_NAMES)) if (v === short) return k;
  return null;
}

/**
 * „powiat bocheński" / "Bochnia County"; cities keep their name („Kraków").
 * Unknown names pass through unchanged.
 */
export function powiatName(name: string, locale: string): string {
  const key = powiatKeyByName(name);
  if (!key) return name;
  if (locale === "en") return POWIAT_NAMES_EN[key] ?? name;
  return isCityPowiat(key) ? POWIAT_NAMES[key]! : `powiat ${POWIAT_NAMES[key]}`;
}
