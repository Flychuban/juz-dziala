# Już Działa — cyfrowe serce Małopolskiego Hubu Innowacji Społecznych

HackYeah 2026 prototype for ROPS Kraków (task „HubMI.pl"). A resident, NGO, gmina or ROPS
employee describes a social problem; the platform answers **only from ROPS's own knowledge**
(Biblioteka Innowacji Społecznych, Mapa Wyzwań Społecznych, grant calls, network) and
connects people. Its value over a general chatbot is trust: every claim has a source, nothing
is invented, and an uncertain answer is handed to a human expert.

Read `docs/UX.md` before building a screen.

## Non-negotiable rules

- **Polish is the default; the whole site also works in English.** Every route, file name,
  identifier and JSON key is English; never transliterate a route. See „Languages" below.
- **Never invent.** A match must quote a real card sentence, resolved by sentence id on the
  server (`src/server/domain/verify.ts`). Money, dates and figures come from a source or are
  shown as „[DO UZUPEŁNIENIA]" / „do weryfikacji". If unsure, abstain and route to an expert.
- **A source line under every claim:** the source name, a link and the capture date
  (`SourceLine` component).
- **No real personal data.** Text is redacted (`redactPII`) before it is stored or sent to the
  AI. Contacts are encrypted (`src/server/lib/crypto.ts`) and masked in the UI. People in
  the network are fictional and flagged `isSample`; sample data is labelled „przykładowe".
- **One engine: the Sprawa (`jd_case`).** Needs, ideas, questions, test sign-ups, feedback
  and adaptation requests are all cases. Every state change goes through `notify()`
  (`src/server/notify.ts`), which writes the outbox and fans out notifications.
- **All Claude calls go through `src/server/ai/structured.ts`** (`aiStructured` for JSON,
  `aiStream` for long Markdown). The model is `claude-sonnet-5-5`; server-side refusal
  fallbacks are enabled on every call. Never call the SDK directly elsewhere. Untrusted
  text goes inside `userData()`. Rate-limit public AI procedures with `rateLimit()`
  (per session, not per IP).
- **Accessibility is 20% of the score:** WCAG 2.1 AA, with AAA body contrast.
  - Targets are ≥ 48 px (`min-h-12`), and every input has a visible label.
  - Errors are text, never colour alone. Icons always come with text.
  - Focus moves to new results (`aria-live`). Use one question per screen in resident forms.
  - `<html lang>` follows the visitor's language; wrap untranslated Polish content in
    `lang="pl"`. Use semantic landmarks. Never remove the focus ring.
- **Design:** use the tokens in `src/styles/globals.css` and the shadcn components in
  `src/components/ui` (the UI contract).
  - Use hairlines (`border-hairline`), not shadows.
  - Never: gradients, glass effects, `shadow-xl`, purple, emoji as bullets, or a centred
    hero above three feature cards.

## Languages (next-intl, no URL prefix)

- The language is the `jd_lang` cookie (`pl` default | `en`), set by `/api/lang?to=en&next=…`
  (the toolbar link) or `?lang=en` on any URL. Never detect it from the browser.
- **No user-visible string lives in a component.** Strings live in
  `messages/{pl,en}/<namespace>.json` — one namespace per module, owned by that module. Polish
  is unchanged from what the screen said before; English is plain British English written for
  residents, not a literal translation. Plurals use ICU (`{count, plural, one {…} few {…}
  many {…} other {…}}` in Polish, `one`/`other` in English).
- Server components: `const t = await getTranslations("ns")` (async) or `useTranslations("ns")`
  (non-async). Client components: `useTranslations("ns")`. Code outside React (mail,
  notifications, tRPC errors, route handlers): `translatorFor(locale, "ns")` from
  `~/i18n/server`. tRPC procedures read `ctx.locale`.
- Labels for enums (areas, statuses, kinds…): `useLabels()` (`~/i18n/use-labels`) or
  `labelsFor(locale)` from `~/lib/domain` — never `MAPA_AREA_LABEL` etc. directly in UI.
- Dates and numbers: `formatDate(value, locale)` / `formatNumber(value, locale)` from
  `~/components/kit` (Europe/Warsaw). Relative ages: `relativeAge(d, t)` (`~/i18n/relative`).
- Content: library cards have `innovations.en` (sentence ids kept), calls have `calls.en`;
  knowledge/canvas/learn have `data/*.en.json`. Untranslated content renders in `lang="pl"`.
- AI: pass `locale` to `aiStructured`/`aiStream`; it appends the English directive to the end
  of the user turn (the cached system prompt never changes). A case stores its author's
  `locale`; anything sent to the author uses it.
- `src/i18n/messages.test.ts` fails on a key missing in English or Polish letters in English
  text (proper names: `messages/proper-names.json`; quoted Polish terms „…” are allowed).

## Shape

```
src/app/                routes (English), pages in Polish
src/server/api/routers  one tRPC router per module (registered in root.ts — do not edit root)
src/server/db/schema/   Drizzle tables, one file per domain (prefix jd_)
src/server/domain/      pure logic: redact, crisis, keywords, verify, case-code (unit-tested)
src/server/ai/          Claude wrapper + prompts
src/lib/domain.ts       shared enums + Polish labels (client-safe)
src/config/nav.ts       navigation
data/                   ingested sources (library.json, knowledge.json, calls.json, …) + manifest.json
scripts/                ingest scripts (polite, archived with sha256)
eval/                   frozen 20-case evaluation set + runner
seed/                   DB seed (one file per domain)
docs/                   Polish documentation for the jury
```

```bash
pnpm dev            # local (needs .env with DATABASE_URL)
pnpm db:push        # schema → database (never `generate` in agent worktrees)
pnpm db:seed        # load data/*.json + sample records
pnpm test           # vitest
pnpm eval           # matching accuracy on the frozen set
pnpm build          # must pass before every deploy (runs ESLint)
```

## Working with parallel agents

Agents work in their own worktrees and branches and touch only the folders they own.
Shared contract files may be edited only by the orchestrator: `src/server/db/schema/*`,
`src/server/api/root.ts`, `src/server/api/trpc.ts`, `src/env.js`, `src/lib/domain.ts`,
`src/config/nav.ts`, `src/app/layout.tsx`, `src/styles/globals.css`, `package.json`.
Agents add no dependencies, never merge, never push to `main`, and never deploy.
