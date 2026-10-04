import { useLocale } from "next-intl";

import { labelsFor, type Labels } from "~/lib/domain";

/** Label maps (areas, statuses, kinds…) in the current language. */
export function useLabels(): Labels {
  return labelsFor(useLocale());
}
