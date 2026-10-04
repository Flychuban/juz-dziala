# Zgłoszenie na HackTribe — teksty do wklejenia

## Nazwa rozwiązania
Już Działa — cyfrowe serce Małopolskiego Hubu Innowacji Społecznych

## Krótki opis (1–2 zdania)
Mieszkaniec, organizacja albo gmina opisuje problem własnymi słowami, a Już Działa pokazuje sprawdzone w Małopolsce innowacje z Biblioteki ROPS — z cytatem ze źródła, informacją, kto pomoże i skąd wziąć pieniądze — oraz łączy z człowiekiem z ROPS przez jedną „Sprawę” z kodem, bez zakładania konta.

## Opis rozwiązania
ROPS Kraków od 10 lat inkubuje innowacje społeczne, ale osoba, która ich potrzebuje, zwykle o nich nie wie. Już Działa jest platformą ROPS — nie kolejnym czatem. Jej wartość to wiedza i sieć, które ma tylko ROPS: 114 kart Biblioteki Innowacji Społecznych, Mapa Wyzwań Społecznych, nabory IWS 2.0 i „Usługa Wrażliwa”, organizacje autorów innowacji i mentorzy.

**Matchmaking społeczny.**
- Opis problemu, także głosem, daje natychmiastowe wyniki ze słów kluczowych.
- AI weryfikuje je w ok. 4 s. Model może wskazać tylko numery zdań z kart, a serwer wstawia ich dokładny tekst, więc cytat nie może zostać wymyślony.
- Każdy wynik pokazuje słowa użytkownika, które zadecydowały, oraz „Twoją ścieżkę”: rozwiązanie → kto je prowadzi → kto pomoże → skąd pieniądze.
- Gdy system nie ma pewności, mówi „nie wiem” i jednym kliknięciem przekazuje opis ekspertowi ROPS jako sprawę z kodem.
- Trafność na zamrożonym zestawie 20 przypadków: 100% w top 3 (same słowa kluczowe: 83%), 92% na pierwszym miejscu, 2/2 poprawne odmowy, 0 wycieków danych osobowych.

**Jedna „Sprawa” dla 7 modułów.**
- Potrzeba, pomysł, pytanie, zgłoszenie do testów, opinia i prośba o wdrożenie dostają kod sprawy i dwustronny wątek.
- Pracownik ROPS widzi powiadomienie w ciągu kilku sekund. AI wstępnie ocenia sprawę i pisze szkic odpowiedzi wyłącznie z kart ROPS; człowiek go poprawia i wysyła.
- Odpowiedź wraca do autora na stronę sprawy (kod i prywatny link) oraz kanałem, który wybrał. W prototypie e-mail działa, a SMS i oddzwonienie są symulowane.
- Po wysłaniu autor widzi, co dzieje się dalej: powiadomienie zespołu → wstępna ocena AI → odpowiedź człowieka.
- **„Szukam partnera”:** gmina, OPS, NGO czy szkoła opisuje, co oferuje i czego szuka, a ROPS kojarzy partnerów międzysektorowych przez tę samą Sprawę.

**Pozostałe moduły:**
- **Zasobnik wiedzy:**
  - biblioteka z filmami;
  - Kondycja Małopolski: Mapa Wyzwań plus dane GUS dla 183 gmin, np. 19,2% mieszkańców w wieku 65+, 101 gmin traci mieszkańców;
  - materiały edukacyjne;
  - tylko dla administratora: trendy na mapie powiatów i „białe plamy”, czyli potrzeby bez gotowego rozwiązania, z propozycją tematu naboru.
- **Kreator pomysłów:**
  - fiszka krok po kroku i asystent AI;
  - sprawdzenie, czy podobna innowacja już istnieje;
  - samoocena według 5 kryteriów IWS 2.0;
  - „Szkic pomysłu”, czyli wizualizacja innowacyjnego przedmiotu;
  - Canvas INNO AGH, także pusty do wydruku;
  - generator wniosku dopasowany do wybranego naboru: inne pola i kryteria dla IWS 2.0, inne dla „Usługi Wrażliwej”.
- **Tester innowacji:** zgłoszenie do testów, ocena, informacja zwrotna, propozycje usprawnień.
- **Middleman Innowacji:** Ramowy Plan Wdrożenia innowacji jako usługi dla konkretnej instytucji i gminy, z danymi GUS i cytatami z karty — dokument, który ROPS dziś przygotowuje ręcznie w programie „Usługa Wrażliwa”. Plan uczciwie podaje, które części napisała AI, a które pochodzą z szablonu.
- **Dla gminy:** profil gminy z GUS i pasujące innowacje. Po zalogowaniu gmina widzi też potrzeby zgłaszane w swoim powiecie (zanonimizowane).
- **Panel administratora:**
  - skrzynka spraw z oceną AI i szkicem odpowiedzi;
  - edycja biblioteki widoczna od razu;
  - „Dodaj z dokumentu”: AI szkicuje kartę z PDF;
  - nabory z powiadomieniem subskrybentów;
  - koszty i jakość AI;
  - panel eksperta.

**Polski i angielski.** Cały serwis działa też po angielsku, łącznie z 114 kartami Biblioteki przetłumaczonymi zdanie po zdaniu. To odpowiedź na obszar Mapy Wyzwań „Integracja cudzoziemców”.
- Dopasowanie rozumie opisy po angielsku: 94% w top 3 na tym samym zestawie testów przetłumaczonym na angielski.
- Cytat pokazuje tłumaczenie razem z polskim oryginałem.
- Odpowiedź ROPS trafia do autora w jego języku.

**Dostępność (WCAG 2.1 AA):**
- tekst 18 px, A+/A−, kontrast, „Tekst łatwy”, czytanie na głos, wpisywanie głosem;
- jedno pytanie na ekran, brak kont dla mieszkańców, mapa zawsze z tabelą;
- deklaracja dostępności, ETR, strona PJM i plik tekstowy o serwisie;
- testy automatyczne axe: 0 naruszeń na 20 ekranach na telefonie i komputerze;
- wersja angielska sprawdzona tak samo, a fragmenty po polsku są oznaczone `lang="pl"`.

**Wdrożenie:**
- Next.js, PostgreSQL w UE i model Claude przez jedną warstwę z limitami i zapisem kosztu każdego wywołania.
- Otwarte API, a dla bazy grantowej kolejka zdarzeń odbierana przez `/api/v1/events` (z kluczem, bez danych osobowych).
- Może działać na infrastrukturze Województwa.
- Koszt: infrastruktura ok. 25–70 $ i AI ok. 100 $ miesięcznie przy 2 000 dopasowań (zmierzone: 0,04 $ za dopasowanie).

## Linki
- Demo: https://juz-dziala.vercel.app — przełącznik „Tryb demonstracyjny” pozwala wejść jako mieszkaniec, pracownik ROPS, ekspert albo gmina. Wersja angielska: https://juz-dziala.vercel.app/?lang=en
- Repozytorium: https://github.com/Flychuban/juz-dziala
- Makiety UX/UI: `docs/makiety/` w repozytorium (zrzuty ekranów: telefon i komputer).
- Koszty i zasoby: `docs/KOSZTY.md`.
- Prezentacja: PDF (10 slajdów) — załącznik.
- Film: MP4 (do 3 minut) — załącznik.
