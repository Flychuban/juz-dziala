import "server-only";

import { type Locale } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import { gminaByTeryt, powiatOf } from "~/server/match/data-files";
import { powiatName } from "./needs";

const KINDS = ["miejska", "wiejska", "miejsko-wiejska"] as const;

/**
 * A gmina code in words for staff screens: „Bochnia (gmina wiejska), powiat
 * bocheński" / "Bochnia (rural municipality), Bochnia County". Unknown codes
 * fall back to the powiat, then to null — never to the bare TERYT number.
 */
export function placeLabel(
  gminaTeryt: string | null,
  powiatTeryt: string | null,
  locale: Locale,
): string | null {
  const t = translatorFor(locale, "admin");
  const g = gminaByTeryt(gminaTeryt);
  const powiat = powiatTeryt ?? g?.powiatTeryt ?? powiatOf(gminaTeryt);
  const where = powiat ? powiatName(powiat, locale) : null;
  if (!g) return where;
  const kind = (KINDS as readonly string[]).includes(g.kind ?? "")
    ? t(`place.kind.${g.kind as (typeof KINDS)[number]}`)
    : null;
  const name = kind ? t("place.gmina", { name: g.name, kind }) : g.name;
  // A city with powiat rights („Kraków, Kraków") needs no second name.
  return where && where !== g.name ? `${name}, ${where}` : name;
}
