import type { CaseKind } from "~/lib/domain";

/** Staff-screen wording for things the shared domain file does not label. */
export const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail",
  sms: "SMS",
  phone: "Telefon",
  none: "Brak kanału",
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  sent: "Wysłano",
  simulated: "Symulacja (prototyp)",
  skipped: "Nie wysłano — poczta nie jest skonfigurowana",
  failed: "Błąd wysyłki",
  none: "Bez wysyłki",
};

export const AI_STATUS_LABEL: Record<string, string> = {
  unavailable: "AI nie jest skonfigurowane w tym środowisku",
  refusal: "model odmówił odpowiedzi",
  max_tokens: "odpowiedź modelu była za długa",
  invalid: "odpowiedź modelu była nieprawidłowa",
  error: "błąd połączenia z AI",
  timeout: "AI nie odpowiedziało na czas",
};

export const CRISIS_LABEL: Record<string, string> = {
  suicide: "myśli samobójcze",
  self_harm: "samookaleczenie",
  violence: "przemoc",
  danger: "zagrożenie życia",
  child: "dziecko w zagrożeniu",
};

export const caseHref = (basePath: "/admin/cases" | "/expert", code: string) =>
  basePath === "/expert" ? `/expert?code=${code}` : `/admin/cases/${code}`;

/** Plural kind names for counters and headings. */
export const KIND_PLURAL: Record<CaseKind, string> = {
  need: "Potrzeby",
  idea: "Pomysły",
  question: "Pytania",
  test: "Testy",
  feedback: "Opinie",
  adapt: "Wdrożenia",
};
