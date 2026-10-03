# Już Działa — cyfrowe serce Małopolskiego Hubu Innowacji Społecznych

HackYeah 2026 prototype for ROPS Kraków (task „HubMI.pl"). A resident, NGO, gmina or ROPS
employee describes a social problem; the platform answers **only from ROPS's own knowledge**
(Biblioteka Innowacji Społecznych, Mapa Wyzwań Społecznych, grant calls, network) and
connects people. Its value over a general chatbot is trust: every claim has a source, nothing
is invented, and an uncertain answer is handed to a human expert.

Read `docs/UX.md` before building a screen.

## Non-negotiable rules

- **Every word a user sees is Polish. Every route, file name, identifier and JSON key is
  English.** Never transliterate a route.
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
  `aiStream` for long Markdown). The model is `claude-opus-5-5`; server-side refusal
  fallbacks are enabled on every call. Never call the SDK directly elsewhere. Untrusted
  text goes inside `userData()`. Rate-limit public AI procedures with `rateLimit()`
  (per session, not per IP).
- **Accessibility is 20% of the score:** WCAG 2.1 AA, with AAA body contrast.
  - Targets are ≥ 48 px (`min-h-12`), and every input has a visible label.
  - Errors are text, never colour alone. Icons always come with text.
  - Focus moves to new results (`aria-live`). Use one question per screen in resident forms.
  - Use `lang="pl"` and semantic landmarks. Never remove the focus ring.
- **Design:** use the tokens in `src/styles/globals.css` and the shadcn components in
  `src/components/ui` (the UI contract).
  - Use hairlines (`border-hairline`), not shadows.
  - Never: gradients, glass effects, `shadow-xl`, purple, emoji as bullets, or a centred
    hero above three feature cards.

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
