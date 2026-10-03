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
