# Prezentacja i film — Już Działa

## Prezentacja (PDF, 10 slajdów)

1. **Już Działa.** „Twój problem ktoś w Małopolsce już rozwiązał. Pokażemy Ci kto — i połączymy Was." Cyfrowe serce Małopolskiego Hubu Innowacji Społecznych. Link do demo.
2. **Problem ROPS-u jego słowami.** Blisko 200 innowacji, 10 lat inkubacji, a mieszkaniec, gmina i NGO nie mają jednego miejsca, które łączy diagnozę, pomysły, testy, upowszechnianie i partnerstwa. Biblioteka jest „w przebudowie".
3. **Pomysł: kojarzenie, nie katalog.** Opis problemu → sprawdzone rozwiązanie → kto je prowadzi → kto pomoże → skąd pieniądze („Twoja ścieżka").
4. **Dlaczego nie ChatGPT.** Tabela: źródło i cytat, uczciwe „nie wiem", sprawa zamiast czatu, wiedza o Małopolsce (GUS, nabory, Ramowe Plany), każda potrzeba zasila trendy ROPS.
5. **Jedna „Sprawa", 7 modułów.** Schemat: potrzeba / pomysł / pytanie / test / opinia / wdrożenie → jedna skrzynka, jeden wątek, jedne powiadomienia, jeden zbiór danych.
6. **Trafność, którą mierzymy.** Zamrożony zestaw 20 przypadków: trafienie w top-3, odmowy na pytania bez odpowiedzi, 0 wycieków danych osobowych. Wyniki: słowa kluczowe vs AI. *(liczby z `eval/results`)*
7. **Dostępność.** WCAG 2.1 AA; 18 px, A+, kontrast, głos, czytanie na głos, jedno pytanie na ekran, brak kont, ETR, PJM, deklaracja. *(zrzut ekranu w trybie kontrastu)*
8. **Dla ROPS: panel i białe plamy.** Skrzynka z oceną AI i szkicem odpowiedzi, edycja biblioteki „od ręki", trendy na mapie powiatów, białe plamy → temat następnego naboru.
9. **Wdrożenie i koszty.** Architektura (Next.js, PostgreSQL w UE, AI przez jedną warstwę z logiem kosztów), otwarte API, bezpieczeństwo (anonimizacja, szyfrowanie kontaktu). Koszt miesięczny *(z KOSZTY.md)*.
10. **Co dalej.** Logowanie przez konto służbowe, SMS, integracja z bazą grantową i Obserwatorem, nagranie PJM, test z seniorami.

## Film (maks. 3 minuty) — scenariusz

Nagranie ekranu (QuickTime) z lektorem. Telefon i laptop obok siebie, gdy pokazujemy powiadomienia.

| Czas | Obraz | Lektor |
|---|---|---|
| 0:00–0:15 | Strona główna | „ROPS Kraków ma blisko 200 sprawdzonych innowacji społecznych. Problem w tym, że osoba, która ich potrzebuje, o nich nie wie. Oto Już Działa." |
| 0:15–0:45 | Córka mówi do telefonu („Powiedz"): „Mama ma 73 lata, owdowiała, mieszka sama pod Limanową, prawie nie wychodzi, myli leki." Wyniki pojawiają się od razu | „Wystarczy opisać problem własnymi słowami — także głosem. Wyniki są od razu. Każdy pokazuje, które słowa zadecydowały, i dosłowny cytat z karty ROPS ze źródłem." |
| 0:45–1:05 | Karta „Sprawdzone przez AI", Twoja ścieżka | „AI sprawdza dopasowanie, ale nie może niczego wymyślić — serwer odrzuca każdy cytat, którego nie ma w karcie. Twoja ścieżka: kto to prowadzi, kto pomoże, skąd pieniądze." |
| 1:05–1:30 | „Poproś ROPS o pomoc" → wybór „Zadzwońcie do mnie" → kod sprawy | „Jeśli potrzebny jest człowiek — jeden przycisk. Bez konta, bez nazwiska. Kod sprawy można wydrukować." |
| 1:30–1:55 | Laptop: dzwonek „(1) Nowa sprawa", wstępna ocena AI, szkic odpowiedzi z cytatami → edycja → wyślij. Telefon: odpowiedź pojawia się w wątku | „Pracownik ROPS dostaje powiadomienie od razu. AI przygotowuje szkic odpowiedzi tylko z wiedzy ROPS — człowiek go poprawia i wysyła. Odpowiedź wraca do autora." |
| 1:55–2:15 | Tryb demonstracyjny → Gmina → profil GUS i potrzeby z powiatu → „Zaplanuj usługę" → Ramowy Plan Wdrożenia się generuje | „Zalogowana gmina widzi profil z GUS i potrzeby zgłaszane w swoim powiecie. Middleman przygotowuje Ramowy Plan Wdrożenia — ten sam dokument, który ROPS dziś pisze ręcznie w programie Usługa Wrażliwa." |
| 2:15–2:35 | Kreator: pomysł → „Podobne rozwiązanie już istnieje" → samoocena 5 kryteriów IWS → „Narysuj szkic pomysłu" | „Nowy pomysł? Asystent sprawdza, czy podobny już istnieje, ocenia go według kryteriów ROPS i rysuje szkic. Wniosek dopasowuje się do wybranego naboru." |
| 2:35–2:48 | Trendy i białe plamy na mapie | „Każda potrzeba zasila trendy. Białe plamy pokazują, gdzie Małopolska potrzebuje innowacji, której jeszcze nie ma — temat następnego naboru." |
| 2:48–2:56 | Przełącznik „English" — ta sama strona po angielsku | „Cały serwis działa też po angielsku — dla cudzoziemców, którzy mieszkają w Małopolsce." |
| 2:56–3:00 | Logo + adres | „Już Działa. Bo dobre rozwiązanie powinno trafić tam, gdzie jest potrzebne." |

## Demo na żywo — kolejność kliknięć

1. `/` → przykład „Mama ma 73 lata…" (albo głos) → Szukaj.
2. Pokaż słowa, cytat, źródło, Twoją ścieżkę; „Czytaj na głos".
3. „Poproś ROPS o pomoc" → telefon → kod.
4. Tryb demonstracyjny → Pracownik ROPS → dzwonek → sprawa → „Użyj szkicu" → Wyślij.
5. Wróć do `/case/<kod>` — odpowiedź jest w wątku.
6. Tryb demonstracyjny → Gmina → `/municipality` → profil → Zaplanuj usługę.
7. `/ideas/new` → pomysł → podobne istnieje → samoocena → „Narysuj szkic pomysłu".
8. `/network#partnerzy` → „Szukam partnera" (partnerstwa przez ROPS).
9. `/admin/trends` → białe plamy.
10. A+, Kontrast i „English" na koniec.
