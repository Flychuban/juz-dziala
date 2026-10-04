/**
 * k-anonymity for „Potrzeby zgłaszane w powiecie": a count is published only
 * when at least K people are behind it; otherwise it becomes null and the
 * page says „mniej niż 5". Pure, so the rule is unit-tested.
 */
import { MAPA_AREAS, type MapaArea, type StaffRole } from "~/lib/domain";
import { K_ANONYMITY } from "./profile";

export type PowiatNeeds = {
  /** null = fewer than K_ANONYMITY. */
  total: number | null;
  areas: { area: MapaArea; count: number | null }[];
  includesSample: boolean;
  since: string;
};

export function kAnonymize(raw: {
  total: number;
  counts: Record<MapaArea, number>;
  includesSample: boolean;
  since: string;
}): PowiatNeeds {
  const visible = (n: number) => (n >= K_ANONYMITY ? n : null);
  return {
    total: visible(raw.total),
    areas: MAPA_AREAS.map((area) => ({
      area,
      count: visible(raw.counts[area] ?? 0),
    })).sort((a, b) => (b.count ?? -1) - (a.count ?? -1)),
    includesSample: raw.includesSample,
    since: raw.since,
  };
}

/**
 * Needs reported by residents (and their trends) are for the administrator
 * (ROPS) and the logged-in gmina only — never on a public page, not even as
 * a count. Experts do not see them either.
 */
export function canSeeNeeds(
  staff: { role: StaffRole } | null | undefined,
): boolean {
  return staff?.role === "rops" || staff?.role === "jst";
}
