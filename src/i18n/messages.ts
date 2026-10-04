/**
 * All UI strings, one JSON file per namespace per language (messages/{pl,en}/<ns>.json).
 * Each module owns its namespace file, so parallel work never touches the same file.
 * Polish is the source of truth for the key set; `messages.test.ts` checks English parity.
 */
import enAdapt from "../../messages/en/adapt.json";
import enAdmin from "../../messages/en/admin.json";
import enCases from "../../messages/en/cases.json";
import enCommon from "../../messages/en/common.json";
import enErrors from "../../messages/en/errors.json";
import enHome from "../../messages/en/home.json";
import enIdeas from "../../messages/en/ideas.json";
import enKnowledge from "../../messages/en/knowledge.json";
import enLegal from "../../messages/en/legal.json";
import enLibrary from "../../messages/en/library.json";
import enMail from "../../messages/en/mail.json";
import enMatch from "../../messages/en/match.json";
import enMunicipality from "../../messages/en/municipality.json";
import enNetwork from "../../messages/en/network.json";
import enTester from "../../messages/en/tester.json";
import plAdapt from "../../messages/pl/adapt.json";
import plAdmin from "../../messages/pl/admin.json";
import plCases from "../../messages/pl/cases.json";
import plCommon from "../../messages/pl/common.json";
import plErrors from "../../messages/pl/errors.json";
import plHome from "../../messages/pl/home.json";
import plIdeas from "../../messages/pl/ideas.json";
import plKnowledge from "../../messages/pl/knowledge.json";
import plLegal from "../../messages/pl/legal.json";
import plLibrary from "../../messages/pl/library.json";
import plMail from "../../messages/pl/mail.json";
import plMatch from "../../messages/pl/match.json";
import plMunicipality from "../../messages/pl/municipality.json";
import plNetwork from "../../messages/pl/network.json";
import plTester from "../../messages/pl/tester.json";
import { type Locale } from "./config";

export const MESSAGES_PL = {
  adapt: plAdapt,
  admin: plAdmin,
  cases: plCases,
  common: plCommon,
  errors: plErrors,
  home: plHome,
  ideas: plIdeas,
  knowledge: plKnowledge,
  legal: plLegal,
  library: plLibrary,
  mail: plMail,
  match: plMatch,
  municipality: plMunicipality,
  network: plNetwork,
  tester: plTester,
};

export type Messages = typeof MESSAGES_PL;

export const MESSAGES_EN: Messages = {
  adapt: enAdapt,
  admin: enAdmin,
  cases: enCases,
  common: enCommon,
  errors: enErrors,
  home: enHome,
  ideas: enIdeas,
  knowledge: enKnowledge,
  legal: enLegal,
  library: enLibrary,
  mail: enMail,
  match: enMatch,
  municipality: enMunicipality,
  network: enNetwork,
  tester: enTester,
};

export const MESSAGES: Record<Locale, Messages> = { pl: MESSAGES_PL, en: MESSAGES_EN };
