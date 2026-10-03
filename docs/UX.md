# UX specification — screens, flows, words

This is the single source of truth for screens and wording. The UI is Polish, addresses the
user as „Ty", and uses short sentences. Resident screens avoid jargon; staff screens may be
denser.

## Principles
1. **One big action per screen.** On the home page that action is describing the problem.
2. **Instant answer first, then a better one.** Keyword results appear in < 300 ms, labelled
   „Wstępne wyniki". When the AI answers, the cards upgrade in place and get the badge
   „Sprawdzone przez AI".
3. **Always show why.** Highlight the user's words: „Pasuje, bo napisałaś/eś: „mieszka
   sama”". Under the explanation, quote the ROPS card in a blockquote, with the source and
   date.
4. **Always a way to a human.** On every result there is „Poproś ROPS o pomoc"; on an
   abstain, „Przekażemy to ekspertowi ROPS".
5. **No accounts for residents.** A case code (`JD-XXXX-XXXX`) is shown large and can be
   printed. A private link is shown too. A contact method is optional.
6. **Senior pattern.** Use one question per screen in resident forms, „Wstecz" everywhere,
   no time limits, and an autosaved draft.

## Words (glossary — use exactly these)
| Concept | Polish UI word |
|---|---|
| case | **sprawa**, „kod sprawy" |
| innovation | **rozwiązanie** (resident screens) / **innowacja** (staff, library) |
| library | **Biblioteka Innowacji Społecznych** |
| matching results | „Gotowe rozwiązania dla Ciebie" |
| path strip | **Twoja ścieżka**: Rozwiązanie → Działa już w → Kto pomoże → Skąd pieniądze |
| abstain | „Nie mamy pewnego dopasowania" |
| grant call | **nabór** |
| implementation plan | **Ramowy Plan Wdrożenia** |
| unmet needs | **białe plamy** |
| sample data | „przykładowe" (badge) |
| easy to read | „Tekst łatwy do czytania" |
| read aloud | „Czytaj na głos" |
| voice input | „Powiedz" |

## Screens
| Route | Module | Purpose | Key elements |
|---|---|---|---|
| `/` | I | Describe the problem | H1 „Z czym przychodzisz?"; big textarea with label; „Powiedz" (mic, only if supported); optional gmina picker; example chips; primary „Szukaj rozwiązań"; secondary doors: Mam pomysł · Szukam rozwiązań dla gminy · Chcę testować · Mam kod sprawy |
| `/match/[id]` | I | Results | Highlighted user terms; 1–3 cards (title, film button, „Pasuje, bo…", quote + source, Twoja ścieżka, „Czytaj na głos", „Tekst łatwy"); „Warto wiedzieć" (fact from Mapa/GUS with source); „Podobne zgłoszenia" (count in powiat); CTA „Poproś ROPS o pomoc"; Drukuj; crisis banner on top when needed |
| `/library` | II | Biblioteka | Search; filters (obszar Mapy, kategoria, grupa docelowa); cards with film thumbnail, badge „wybrana do upowszechniania" |
| `/library/[slug]` | II | Card | 6 sections; film; Działa już w; licence + source; „Chcę to wdrożyć" → /adapt; „Testuj / oceń" |
| `/knowledge` | II | Kondycja Małopolski | 8 area tiles → `/knowledge/[area]`: definicja, kluczowe wyzwania, persona, liczby (Polska vs Małopolska labelled), innowacje, raporty |
| `/learn` | II | Materiały | Cards for raporty, narzędzia (Canvas), filmy, przewodnik „jak powstaje innowacja" |
| `/ideas/new` | III | Fiszka | 4 steps: Na czym polega? Komu pomaga? Na jakim etapie? Gdzie i kto? + AI panel (pytania, nietuzinkowe pomysły, „to już istnieje", samoocena 5 kryteriów IWS) → submit = sprawa |
| `/ideas/[code]/canvas` | III | Canvas | 3 sheets of the INNO AGH canvas, printable |
| `/ideas/[code]/application` | III | Generator wniosku | Only during an open call: fields of the call form prefilled, „[DO UZUPEŁNIENIA]" gaps, streamed |
| `/test` | IV | Tester | Innovations open for testing → „Chcę testować"; rating 1–5 + „Co działa / co poprawić" |
| `/case`, `/case/[code]` | V | My case | Code entry; thread (two-way), status timeline, print, contact preference |
| `/network` | V | Sieć | Organisations (from cards), mentors (przykładowi), „Zapytaj eksperta", subscriptions to calls/areas |
| `/municipality/[teryt]` | VII | Dla gminy | GUS profile; needs in powiat (k≥5); fitting innovations; „Zaplanuj usługę" |
| `/adapt` | VII | Middleman | Innovation + institution form → streamed Ramowy Plan Wdrożenia → print / send to ROPS |
| `/admin` | VI | Pulpit | Counters (nowe, czekają > 48 h, potrzeby w tym tygodniu), latest cases, białe plamy teaser |
| `/admin/cases[/code]` | VI | Inbox / case | Filters; AI triage (obszar, powiat, pilność, podobne, ekspert, szkic odpowiedzi z cytatami); assign; status; reply |
| `/admin/library…` | VI | Library editor | List with status; edit; „Dodaj z dokumentu"; publish = live now |
| `/admin/calls` | VI | Nabory | Edit/publish → notifies subscribers |
| `/admin/trends` | II | Trendy + białe plamy | Map of 22 powiats + table + CSV; unmet needs → „Zaproponuj temat naboru" |
| `/admin/ai` | VI | AI | Table: calls, tokens, cache, latency, cost; latest eval |

## Components (kit)
- `SourceLine`: „Źródło: <name>, stan na <date>" plus a link.
- `TwojaSciezka`: 4 connected steps.
- `StatusTimeline`.
- `CaseCode`: large, monospace, with copy and print.
- `SampleBadge`: „przykładowe".
- `UserTerms`: highlighted chips.
- `ReadAloud`: speechSynthesis with a pl-PL voice.
- `EasyToggle`.
- `Stepper`: one question per screen.
