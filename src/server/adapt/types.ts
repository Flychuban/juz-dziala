/**
 * Shapes shared by the Middleman (plan) and „Dla gminy" (profile) logic.
 * Pure TypeScript — no database, no Next.js — so everything that builds on
 * them can be unit-tested.
 */
import type { CallStatus, MapaArea, SectionKey } from "~/lib/domain";
import type { PlanInputs } from "./options";

export type GminaKind = "miejska" | "wiejska" | "miejsko-wiejska";

/** One row of data/gminas.json (GUS BDL, stan na 31 XII `year`). */
export type Gmina = {
  teryt: string;
  bdlId: string;
  name: string;
  kind: GminaKind;
  powiatTeryt: string;
  powiatName: string;
  population: number;
  pop65: number;
  pop80: number;
  /** % change 10 years back → `year`; null where the territory changed. */
  popChange10y: number | null;
  year: number;
};

/** The GUS figures with what they are compared against. */
export type GminaProfile = Gmina & {
  /** Percent of the population, one decimal. */
  share65: number;
  share80: number;
  /** Median of `share80` across all Małopolska gminas. */
  medianShare80: number;
  /** True when the population fell over 10 years; null when not computed. */
  depopulating: boolean | null;
};

export type GusSource = {
  name: string;
  /** The exact BDL API query behind this gmina's figures. */
  url: string;
  capturedAt: string;
  year: number;
  baseYear: number;
};

export type CardSentence = { id: string; section: SectionKey; text: string };

/** A library card, as much of it as a plan needs. */
export type PlanCard = {
  id: string;
  slug: string;
  title: string;
  sections: Record<SectionKey, string>;
  sentences: CardSentence[];
  mapaAreas: MapaArea[];
  categoryLabels: string[];
  sourceUrl: string;
  capturedAt: string;
  licence: string | null;
  folderUrl: string | null;
  materialsUrl: string | null;
  /** Organisations named as authors (real, public — from the card). */
  orgNames: string[];
};

export type FundingKind = "usluga-wrazliwa" | "iws";

/** A grant call that may finance the service, as ROPS published it. */
export type FundingCall = {
  id: string;
  kind: FundingKind;
  name: string;
  program: string | null;
  operator: string | null;
  amountMax: number | null;
  windowFrom: string | null;
  windowTo: string | null;
  status: CallStatus;
  sourceUrl: string | null;
  /** The call's own one-line purpose (from its announcement). */
  purpose: string | null;
  /** „Wkład własny…" sentence, when the announcement states it. */
  ownContribution: string | null;
  /** Innovations the call was limited to (Usługa Wrażliwa: Ramowe Plany). */
  innovationTitles: string[];
  /** Is THIS innovation one of them? */
  includesInnovation: boolean;
};

export type RamowyPlan = {
  callId: string;
  callName: string;
  sourceUrl: string | null;
};

/** Everything a Ramowy Plan Wdrożenia is built from. */
export type PlanContext = {
  inputs: PlanInputs;
  card: PlanCard;
  profile: GminaProfile;
  gus: GusSource;
  funding: FundingCall[];
  ramowyPlan: RamowyPlan | null;
  /** ISO timestamp; also „stan na" for the calls. */
  generatedAt: string;
};
