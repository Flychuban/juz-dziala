# Formularz „Add Project" na HackYeah 2026 — odpowiedzi do wklejenia

Szkic z 3 października 2026 r. Liczby pochodzą z repozytorium: `data/gminas.json` (GUS BDL, 31 XII 2025), `eval/results/ai-2026-10-03T17-17-15-016Z.json` i `docs/KOSZTY.md`. Zadanie wymaga zgłoszenia po polsku.

## Project Name
Już Działa — cyfrowe serce Małopolskiego Hubu Innowacji Społecznych

## Problem
ROPS Kraków od 10 lat inkubuje innowacje społeczne i ma ich w portfolio blisko 200. Osoba, która ich potrzebuje, zwykle jednak o nich nie wie. Córka samotnej mamy spod Limanowej, wójt małej gminy czy lokalne stowarzyszenie nie mają jednego miejsca, w którym opiszą problem i dowiedzą się, że ktoś w Małopolsce już go rozwiązał, kto pomoże wdrożyć rozwiązanie i skąd wziąć pieniądze. Brakuje też miejsca, które łączy diagnozę, nowe pomysły, testy, upowszechnianie i partnerstwa.

Skala potrzeb rośnie (GUS, Bank Danych Lokalnych, stan na 31 XII 2025):
- 658,6 tys. z 3,43 mln mieszkańców Małopolski (19,2%) ma 65 lat lub więcej, a ok. 150 tys. ma 80 lat lub więcej;
- ponad połowa gmin regionu straciła mieszkańców w ciągu 10 lat (2015–2025).

ROPS sam wskazuje te wyzwania: starzenie się, samotność, kryzys zdrowia psychicznego, wykluczenie cyfrowe i depopulację.

Ogólny czat AI nie rozwiąże tego problemu. Nie zna kart ROPS, sieci organizacji ani naborów, zmyśla źródła i nie przekaże sprawy człowiekowi. Wiedza ROPS jest dziś rozproszona w PDF-ach, a każda prośba o wdrożenie innowacji jest obsługiwana ręcznie.

## Solution
Już Działa to platforma ROPS, a nie kolejny czat. Mieszkaniec, organizacja albo gmina opisuje problem własnymi słowami, tekstem lub głosem. Platforma odpowiada wyłącznie na podstawie wiedzy, którą ma tylko ROPS: 114 kart Biblioteki Innowacji Społecznych, Mapy Wyzwań Społecznych, naborów grantowych i sieci organizacji oraz ekspertów.

**Co dostaje użytkownik:**
- **Natychmiastowe wyniki**, które AI weryfikuje w ok. 6 s. Model może wskazać tylko numery zdań z kart, a serwer wstawia ich dokładny tekst, więc cytat nie może zostać wymyślony. Przy każdym wyniku są źródło i data.
- **„Twoja ścieżka”:** rozwiązanie → gdzie już działa → kto pomoże → skąd pieniądze.
- **Uczciwe „nie wiem”:** gdy system nie ma pewności, przekazuje sprawę ekspertowi ROPS.
- **Jeden przycisk „Poproś ROPS o pomoc”:** bez konta i bez nazwiska. Użytkownik dostaje kod sprawy, a odpowiedź wraca kanałem, który wybrał.

**Co dostaje ROPS:**
- Jedną „Sprawę” dla wszystkich 7 modułów: potrzeby, pomysłu, pytania, zgłoszenia do testów, opinii i prośby o wdrożenie.
- Powiadomienie w ciągu kilku sekund, wstępną ocenę AI i szkic odpowiedzi napisany wyłącznie z kart ROPS. Pracownik go poprawia i wysyła.
- Edycję biblioteki widoczną od razu oraz „Dodaj z dokumentu”, gdzie AI szkicuje kartę z PDF.
- Trendy na mapie powiatów i „białe plamy”, czyli potrzeby bez gotowego rozwiązania, jako temat następnego naboru.

**Pozostałe moduły:**
- **Kreator pomysłów:** fiszka, asystent AI, sprawdzenie, czy podobna innowacja już istnieje, samoocena według kryteriów IWS 2.0, Canvas i generator wniosku.
- **Tester innowacji.**
- **Middleman Innowacji:** Ramowy Plan Wdrożenia innowacji jako usługi dla konkretnej gminy, z danymi GUS.

**Dostępność:** WCAG 2.1 AA, tekst 18 px, A+/A−, kontrast, wpisywanie głosem, czytanie na głos, tekst łatwy do czytania (ETR), PJM i jedno pytanie na ekran. Testy axe nie wykazały żadnych naruszeń.

## Challenges
PARTNER TASK [UMWM]: HubMi.pl

## Cover image
`docs/makiety/02-wyniki-komputer.png` (wyniki z cytatem i źródłem). Rezerwowo `01-start-komputer.png`.

## Idea stage
New Idea. Kod powstał od zera podczas HackYeah 3–4 października 2026 r., a historia commitów to potwierdza.

## What's done so far and goal of your project
Wszystko powstało podczas HackYeah, od zera, w nowym repozytorium. Wcześniej niczego nie było.

**Gotowe (stan na sobotę wieczór):**
- Działające demo na https://juz-dziala.vercel.app ze wszystkimi 7 modułami zadania.
- Matchmaking z weryfikacją AI i cytatami ze źródeł oraz „Twoja ścieżka”.
- Jedna „Sprawa” z kodem, wątkiem i powiadomieniami dla ROPS.
- Panel administratora z oceną AI i szkicem odpowiedzi.
- Zasobnik wiedzy: 114 kart, Kondycja Małopolski na podstawie Mapy Wyzwań i dane GUS dla 182 gmin.
- Kreator pomysłów, Tester i Middleman z Ramowym Planem Wdrożenia.

**Zmierzona trafność** na zamrożonym zestawie 20 przypadków:
- 94% w top 3 (same słowa kluczowe: 83%);
- 85% na pierwszym miejscu;
- 2/2 poprawne odmowy;
- 0 wycieków danych osobowych.

Koszt jednego dopasowania to 0,07 $. AI kosztuje ok. 150 $ miesięcznie przy 2 000 dopasowań.

**Do niedzieli (cel):**
- Test dostępności z klawiaturą i czytnikiem ekranu.
- Dopracowanie przepływu dla seniora na telefonie.
- Prezentacja PDF (10 slajdów) i film do 3 minut.

**Cel po hackathonie:** pilotaż w ROPS Kraków na infrastrukturze Województwa, logowanie kontem służbowym, bramka SMS, integracja z bazą grantową i nagranie w PJM.

## Team status
Team complete (zespół jednoosobowy).

## Current team size
1

## Needed skills
Nic nie zaznaczać.

## Skills comment
Projekt jednoosobowy: full-stack (Next.js, TypeScript, PostgreSQL), integracja AI (Claude) i dostępność (WCAG 2.1 AA).

## Video (YouTube)
Na razie puste. Po nagraniu dodać link „Niepubliczny” (Listed).

## Website
https://juz-dziala.vercel.app

## Code Repository
https://github.com/Flychuban/juz-dziala

## Instructions on how to open project
**Demo bez instalacji:** https://juz-dziala.vercel.app

1. Na stronie głównej wpisz problem, np. „Mama ma 73 lata, owdowiała, mieszka sama pod Limanową, prawie nie wychodzi, myli leki”, albo wybierz przykład i kliknij „Szukaj rozwiązań”. Wyniki ze słów kluczowych pojawiają się od razu, a po ok. 6 s są zweryfikowane przez AI i mają cytat ze źródła.
2. Kliknij „Poproś ROPS o pomoc”. Dostaniesz kod sprawy, bez zakładania konta.
3. W przełączniku „Tryb demonstracyjny” na górze strony wybierz „Pracownik ROPS”. Zobaczysz nową sprawę, wstępną ocenę AI i szkic odpowiedzi. Wyślij odpowiedź, a pojawi się ona w wątku sprawy (`/case/<kod>`).
4. W tym samym przełączniku wybierz „Gmina”. Otworzy się `/municipality` z profilem gminy: dane GUS i „Zaplanuj usługę” (Ramowy Plan Wdrożenia).
5. Inne miejsca warte zobaczenia: `/ideas/new` (Kreator pomysłów), `/admin/trends` (trendy i białe plamy) i `/methodology` (jak mierzymy trafność). Przyciski A+ i „Kontrast” są w nagłówku.

**Lokalnie** (Node.js 22, pnpm, PostgreSQL):
```
git clone https://github.com/Flychuban/juz-dziala && cd juz-dziala
pnpm install
cp .env.example .env   # DATABASE_URL; opcjonalnie ANTHROPIC_API_KEY
pnpm db:push && pnpm db:seed
pnpm dev               # http://localhost:3000
pnpm test              # testy jednostkowe
pnpm eval              # trafność na zamrożonym zestawie 20 przypadków
```
Bez klucza AI platforma też działa: wyszukuje po słowach kluczowych, a pomocnicy AI pokazują wersję zastępczą.

## Presentation
Na razie puste. Dodać PDF (10 slajdów, plan w `docs/PREZENTACJA.md`) przed terminem: 4 X, godz. 11:00.
