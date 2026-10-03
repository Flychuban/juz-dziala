/**
 * Już Działa — the shared component kit. Import from "~/components/kit".
 *
 * Server-safe: SourceLine, SampleBadge, PageHeader, EmptyState, Stat,
 *   AreaTag, TwojaSciezka, StatusTimeline, Highlight, UserTerms,
 *   InnovationCard, ExternalLink (+ helpers in ./format).
 * Client ("use client"): CaseCode, ReadAloud, VideoEmbed, Stepper.
 *
 * Map: PowiatMap lives in "~/components/map" (server component; reads
 * data/powiaty.topo.json).
 */
export { AreaTag } from "./area-tag";
export { CaseCode } from "./case-code";
export { EmptyState } from "./empty-state";
export { ExternalLink } from "./external-link";
export {
  countPl,
  fold,
  formatDatePl,
  formatNumberPl,
  isoDate,
  pluralPl,
  spellCode,
} from "./format";
export { findTermRanges, Highlight, UserTerms } from "./highlight";
export { InnovationCard, type InnovationCardData } from "./innovation-card";
export { PageHeader, type Crumb } from "./page-header";
export { ReadAloud } from "./read-aloud";
export { SampleBadge } from "./sample-badge";
export { SourceLine } from "./source-line";
export { Stat } from "./stat";
export { StatusTimeline, type TimelineItem } from "./status-timeline";
export { Stepper, type StepperStep } from "./stepper";
export { PATH_STEP_LABELS, TwojaSciezka, type PathStep } from "./twoja-sciezka";
export { VideoEmbed } from "./video-embed";
export { youtubeId, youtubeThumb } from "./youtube";
