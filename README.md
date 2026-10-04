# Już Działa — cyfrowe serce Małopolskiego Hubu Innowacji Społecznych

> **Twój problem ktoś w Małopolsce już rozwiązał. Pokażemy Ci kto — i połączymy Was.**

Prototyp przygotowany na **HackYeah 2026** w ramach wyzwania **HubMI.pl** Regionalnego Ośrodka Polityki Społecznej w Krakowie (ROPS Kraków).

**Wersja demonstracyjna:** https://juz-dziala.vercel.app · **English:** https://juz-dziala.vercel.app/?lang=en

## Na czym polega

Mieszkaniec, organizacja albo gmina opisuje problem własnymi słowami (tekstem lub głosem). Platforma odpowiada **wyłącznie na podstawie wiedzy ROPS**:
- Biblioteki Innowacji Społecznych (114 sprawdzonych rozwiązań z Małopolski);
- Mapy Wyzwań Społecznych;
- naborów grantowych;
- sieci organizacji i ekspertów.

Każde dopasowanie pokazuje:
- **słowa użytkownika**, które zadecydowały o wyniku;
- **dosłowny cytat z karty innowacji** ze źródłem i datą (serwer odrzuca cytaty, których nie ma w karcie);
- **Twoją ścieżkę**: rozwiązanie → kto je prowadzi → kto pomoże → skąd pieniądze.

Gdy system nie ma pewności, **nie zgaduje** — mówi „nie wiem” i jednym kliknięciem przekazuje opis ekspertowi ROPS.

**Po polsku i po angielsku.** Polski jest domyślny. Przełącznik „English” (albo link z `?lang=en`) zmienia cały serwis, łącznie z 114 kartami Biblioteki przetłumaczonymi zdanie po zdaniu: cytat pokazuje tłumaczenie razem z polskim oryginałem. Dopasowanie rozumie opisy po angielsku, a odpowiedź ROPS trafia do autora w jego języku. To odpowiedź na obszar Mapy Wyzwań „Integracja cudzoziemców”.

## Dlaczego to nie jest „kolejny czat"

| Ogólny czat AI | Już Działa |
|---|---|
| Odpowiada z ogólnej wiedzy, bez źródła | Odpowiada tylko z kart ROPS, z cytatem i linkiem |
| Zawsze coś odpowie | Uczciwie mówi „nie wiem" i łączy z człowiekiem |
| Zostawia użytkownika z tekstem | Prowadzi sprawę: kod sprawy → ROPS → ekspert → odpowiedź |
| Nie zna Małopolski | Zna gminy (GUS), nabory ROPS, Ramowe Plany Wdrożenia |
| Rozmowa znika | Każda potrzeba zasila trendy i „białe plamy" dla ROPS |

## Moduły (wszystkie 7 z zadania)

| Moduł | Co robi |
|---|---|
| I. Matchmaking społeczny | Opis problemu → natychmiastowe wyniki → weryfikacja przez AI z cytatami → „Poproś ROPS o pomoc" |
| II. Zasobnik wiedzy | Biblioteka z filmami, Kondycja Małopolski (8 obszarów Mapy Wyzwań + dane GUS dla 183 gmin), materiały; trendy i białe plamy tylko dla administratora |
| III. Kreator pomysłów | Fiszka krok po kroku, asystent AI, „Szkic pomysłu” (wizualizacja), samoocena wg 5 kryteriów IWS 2.0, Canvas, generator wniosku dopasowany do wybranego naboru |
| IV. Tester innowacji | Zgłoszenie do testów, ocena, informacja zwrotna, propozycje usprawnień |
| V. Platforma komunikacji | Jedna „Sprawa" dla każdego zgłoszenia: kod, dwustronny wątek, powiadomienia, mentorzy, „Szukam partnera” (partnerstwa międzysektorowe kojarzone przez ROPS), subskrypcje naborów |
| VI. Panel administratora | Skrzynka z wstępną oceną AI i szkicem odpowiedzi, edycja biblioteki (zmiana widoczna od razu), „Dodaj z dokumentu", nabory |
| VII. Middleman Innowacji | Ramowy Plan Wdrożenia innowacji jako usługi dla konkretnej instytucji i gminy (dane GUS); gmina po zalogowaniu widzi potrzeby ze swojego powiatu |

## Dostępność (WCAG 2.1 AA)

Tekst 18 px, A+/A−, tryb kontrastu, czytanie na głos, wpisywanie głosem, jedno pytanie na ekran, brak kont dla mieszkańców, mapa zawsze z tabelą.

W serwisie są też [deklaracja dostępności](https://juz-dziala.vercel.app/accessibility), [tekst łatwy do czytania](https://juz-dziala.vercel.app/easy-read), [informacja w PJM](https://juz-dziala.vercel.app/sign-language) oraz [plik tekstowy o serwisie](https://juz-dziala.vercel.app/about.txt).

## Zasady, których się trzymamy

- **Źródło przy każdej informacji.** Bez źródła nie ma twierdzenia.
- **Nic nie wymyślamy.** Kwoty, daty i nazwy pochodzą ze źródeł albo są oznaczone „[DO UZUPEŁNIENIA]".
- **Bez danych osobowych.** Opis jest anonimizowany (PESEL, telefon, e-mail, adres) przed zapisem i przed wysłaniem do AI. Kontakt jest szyfrowany i widoczny tylko dla pracownika ROPS. Dane przykładowe są oznaczone.
- **Mierzona trafność.** Zamrożony zestaw 20 przypadków testowych (`eval/`), spisany przed strojeniem:

  | Miara | Słowa kluczowe | + weryfikacja AI |
  |---|---|---|
  | Właściwa innowacja w top 3 | 83% | **100%** |
  | Najlepsza na pierwszym miejscu | 38% | **92%** |
  | Odmowa, gdy biblioteka nie ma odpowiedzi | 2/2 | 2/2 |
  | Wycieki danych osobowych / wykonane wstrzyknięcia | 0 / 0 | 0 / 0 |
  | Czas (mediana) | 2 ms | 4,3 s |

  Wyniki są też na stronie [Jak działa dopasowanie](https://juz-dziala.vercel.app/methodology).
- **Dostępność sprawdzona testami.** axe-core: 0 naruszeń WCAG 2.1 A/AA na 20 ekranach × telefon i komputer; brak przewijania w poziomie przy 320 px. Wersja angielska jest sprawdzana tym samym axe oraz testem, który przechodzi każdy ekran i nie dopuszcza nieprzetłumaczonego polskiego tekstu poza fragmentami oznaczonymi `lang="pl"` (`tests/e2e`).
- **Trafność po angielsku.** Ten sam zestaw 20 przypadków przetłumaczony na angielski przed testem: 94% w top 3, 85% na pierwszym miejscu, 2/2 odmowy, 0 wycieków.

## Makiety UX/UI

[docs/makiety](docs/makiety) — 18 ekranów (w tym 3 po angielsku) na telefonie i komputerze oraz [PDF](docs/makiety/Makiety-UX-UI-Juz-Dziala.pdf).

## Technologia

- Next.js 15 (App Router), TypeScript, tRPC, Tailwind CSS, shadcn/ui.
- PostgreSQL (Neon, Frankfurt) z Drizzle ORM.
- Vercel (region fra1).
- AI: Claude (Anthropic) przez jedną warstwę z logowaniem kosztu każdego wywołania.
- Otwarte API: `/api/v1/innovations`, `/api/v1/calls` (z wersją angielską). Kolejka zdarzeń dla bazy grantowej i innych systemów Hubu: `/api/v1/events` (klucz w `INTEGRATION_TOKEN`, bez danych osobowych).
- Dwa języki: next-intl, polski domyślny, angielski w ciasteczku (`?lang=en`); treści kart w `data/*.en.json` (`pnpm data:translate`).

```bash
pnpm install
cp .env.example .env      # DATABASE_URL, opcjonalnie ANTHROPIC_API_KEY
pnpm db:push && pnpm db:seed
pnpm dev
pnpm test                 # testy jednostkowe
pnpm eval                 # trafność dopasowania na zamrożonym zestawie
```

## Źródła danych

- Biblioteka Innowacji Społecznych, ROPS Kraków — licencje podane przy każdej karcie.
- Mapa Wyzwań Społecznych (ROPS, listopad 2024; dane ogólnopolskie).
- Dokumentacja IWS 2.0 i „Usługa Wrażliwa" (ROPS).
- Social Innovation Canvas (INNO AGH, wersja 1.0).
- GUS — Bank Danych Lokalnych.
- Granice powiatów: PRG (GUGiK).

Każdy pobrany plik ma sumę sha256 w `data/manifest.json`.
