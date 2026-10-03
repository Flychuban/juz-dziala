# Zgłoszenie na HackTribe — teksty do wklejenia

## Nazwa rozwiązania
Już Działa — cyfrowe serce Małopolskiego Hubu Innowacji Społecznych

## Krótki opis (1–2 zdania)
Mieszkaniec, organizacja albo gmina opisuje problem własnymi słowami, a Już Działa pokazuje sprawdzone w Małopolsce innowacje z Biblioteki ROPS — z cytatem ze źródła, informacją, kto pomoże i skąd wziąć pieniądze — oraz łączy z człowiekiem z ROPS przez jedną „Sprawę” z kodem, bez zakładania konta.

## Opis rozwiązania
ROPS Kraków od 10 lat inkubuje innowacje społeczne, ale osoba, która ich potrzebuje, zwykle o nich nie wie. Już Działa jest platformą ROPS — nie kolejnym czatem. Jej wartość to wiedza i sieć, które ma tylko ROPS: 114 kart Biblioteki Innowacji Społecznych, Mapa Wyzwań Społecznych, nabory IWS 2.0 i „Usługa Wrażliwa”, organizacje autorów innowacji i mentorzy.

**Matchmaking społeczny.**
- Opis problemu, także głosem, daje natychmiastowe wyniki ze słów kluczowych.
- AI weryfikuje je w ok. 6 s. Model może wskazać tylko numery zdań z kart, a serwer wstawia ich dokładny tekst, więc cytat nie może zostać wymyślony.
- Każdy wynik pokazuje słowa użytkownika, które zadecydowały, oraz „Twoją ścieżkę”: rozwiązanie → gdzie działa → kto pomoże → skąd pieniądze.
- Gdy system nie ma pewności, mówi „nie wiem” i przekazuje sprawę ekspertowi.
- Trafność na zamrożonym zestawie 20 przypadków: 94% w top 3 (same słowa kluczowe: 83%), 85% na pierwszym miejscu, 2/2 poprawne odmowy, 0 wycieków danych osobowych.

**Jedna „Sprawa” dla 7 modułów.**
- Potrzeba, pomysł, pytanie, zgłoszenie do testów, opinia i prośba o wdrożenie dostają kod sprawy i dwustronny wątek.
- Pracownik ROPS widzi powiadomienie w ciągu kilku sekund. AI wstępnie ocenia sprawę i pisze szkic odpowiedzi wyłącznie z kart ROPS; człowiek go poprawia i wysyła.
- Odpowiedź wraca do autora kanałem, który wybrał: e-mail, SMS, telefon albo kod sprawy.

**Pozostałe moduły:**
- **Zasobnik wiedzy:** biblioteka z filmami, Kondycja Małopolski na bazie Mapy Wyzwań, materiały; dla administratora trendy na mapie powiatów i „białe plamy”, czyli potrzeby bez gotowego rozwiązania, z propozycją tematu naboru.
- **Kreator pomysłów:** fiszka krok po kroku, asystent AI, sprawdzenie, czy podobna innowacja już istnieje, samoocena według 5 kryteriów IWS 2.0, Canvas INNO AGH, generator wniosku w trakcie naboru.
- **Tester innowacji:** zgłoszenie do testów, ocena, informacja zwrotna, propozycje usprawnień.
- **Middleman Innowacji:** Ramowy Plan Wdrożenia innowacji jako usługi dla konkretnej instytucji i gminy, z danymi GUS i cytatami z karty — dokument, który ROPS dziś przygotowuje ręcznie w programie „Usługa Wrażliwa”.
- **Panel administratora:** skrzynka spraw, edycja biblioteki widoczna od razu, „Dodaj z dokumentu” (AI szkicuje kartę z PDF), nabory z powiadomieniem subskrybentów, koszty AI.

**Dostępność (WCAG 2.1 AA):**
- tekst 18 px, A+/A−, kontrast, „Tekst łatwy”, czytanie na głos, wpisywanie głosem;
- jedno pytanie na ekran, brak kont dla mieszkańców, mapa zawsze z tabelą;
- deklaracja dostępności, ETR, strona PJM i plik tekstowy o serwisie;
- testy automatyczne axe: 0 naruszeń na 19 ekranach, telefon i komputer.

**Wdrożenie:**
- Next.js, PostgreSQL w UE i model Claude przez jedną warstwę z limitami i zapisem kosztu każdego wywołania.
- Otwarte API i kolejka zdarzeń do integracji.
- Może działać na infrastrukturze Województwa.
- Koszt: infrastruktura ok. 25–70 $ i AI ok. 150 $ miesięcznie przy 2 000 dopasowań (zmierzone: 0,07 $ za dopasowanie).

## Linki
- Demo: https://juz-dziala.vercel.app — przełącznik „Tryb demonstracyjny” pozwala wejść jako mieszkaniec, pracownik ROPS, ekspert albo gmina.
- Repozytorium: https://github.com/Flychuban/juz-dziala
- Makiety UX/UI: `docs/makiety/` w repozytorium (zrzuty ekranów: telefon i komputer).
- Koszty i zasoby: `docs/KOSZTY.md`.
- Prezentacja: PDF (10 slajdów) — załącznik.
- Film: MP4 (do 3 minut) — załącznik.
