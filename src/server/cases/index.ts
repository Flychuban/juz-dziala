/**
 * The Sprawa engine — the one door every module uses to open a case.
 *
 *   import { createCase } from "~/server/cases";
 *   const { code, accessToken } = await createCase({
 *     kind: "idea", title, body, …, locale: ctx.locale, // "pl" | "en", default "pl"
 *   });
 *
 * Then show `<CaseCreatedPanel code={code} token={accessToken} />`
 * (`~/components/cases/case-created-panel`).
 */
export {
  addMessage,
  createCase,
  runInBackground,
  setCaseStatus,
} from "./engine";
export {
  caseLocale,
  receivedText,
  replyClosing,
  residentKindLabel,
  residentStatusLabel,
  residentTeamName,
} from "./author-text";
export { createCaseInputSchema, type CreateCaseInput } from "./input";
export { triageCase } from "./triage";
export type { CaseTriage, TriageCard } from "./types";
