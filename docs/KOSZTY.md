# Koszt utrzymania i niezbędne zasoby

Ceny sprawdzone 3 października 2026 r. na stronach dostawców (USD, netto). Koszt AI jest **mierzony**: każde wywołanie zapisuje w tabeli `jd_ai_call` liczbę tokenów i koszt, a podsumowanie jest w panelu `/admin/ai`.

## 1. Infrastruktura (wariant chmurowy, jak w prototypie)

| Składnik | Dostawca i plan | Cena | Szacunek miesięczny |
|---|---|---|---|
| Hosting aplikacji | Vercel Pro (1 stanowisko; plan Hobby nie dopuszcza użytku komercyjnego) | 20 $/mies., w cenie 1 TB transferu; dalej od 0,60 $ za 1 mln wywołań funkcji i 0,128 $ za godzinę aktywnego CPU | ok. 20–30 $ |
| Baza danych | Neon Postgres, plan Launch, region Frankfurt (UE) | 0,35 $ za GB-miesiąc, 0,106 $ za CU-godzinę; baza usypia, gdy nie jest używana | ok. 5–20 $ |
| E-mail | Resend: Free (3 000 e-maili/mies.) lub Pro (50 000 e-maili/mies.) | 0 $ albo 20 $/mies. | 0–20 $ |
| Model AI | Claude Sonnet 5.5 (Anthropic): 2 $ za 1 mln tokenów wejściowych, 10 $ za 1 mln wyjściowych, 0,20 $ za 1 mln tokenów z pamięci podręcznej | zob. punkt 2 | zob. punkt 2 |

## 2. Koszt AI — z pomiaru

Koszt jednego dopasowania, jednej wstępnej oceny sprawy i jednego Ramowego Planu Wdrożenia jest zapisywany przy każdym wywołaniu. Opis instrukcji i indeks 114 kart są w pamięci podręcznej modelu, więc kolejne zapytania płacą za nie ok. 20 razy mniej.

Dopasowanie zmierzone 4 października 2026 r. na modelu Claude Sonnet 5.5. Wstępna ocena i Ramowy Plan — pomiar z 3 października na poprzednim modelu (Claude Opus 5.5, dwa razy droższy za token); na Sonnet 5.5 jeszcze ich nie zmierzyliśmy:

| Funkcja | Średni koszt jednego wywołania | Czas | Źródło |
|---|---|---|---|
| Dopasowanie (weryfikacja AI z cytatami) | 0,044 $ | p50 4,3 s | `eval/results/ai-2026-10-04T06-19-13-720Z.json`, 20 przypadków |
| Wstępna ocena sprawy + szkic odpowiedzi | 0,019 $ (Opus 5.5) | 7,6 s | `jd_ai_call` |
| Ramowy Plan Wdrożenia (strumieniowo) | 0,108 $ (Opus 5.5) | 43 s, tekst pojawia się od razu | `jd_ai_call` |

**Scenariusz miesięczny:** 2 000 dopasowań, 300 spraw i 50 planów.

| Pozycja | Wyliczenie | Koszt |
|---|---|---|
| Dopasowania | 2 000 × 0,044 $ | ok. 88 $ |
| Wstępne oceny spraw | 300 × 0,019 $ | ok. 6 $ |
| Ramowe Plany | 50 × 0,108 $ | ok. 5 $ |
| **Razem AI** | | **ok. 100 $ / mies.** |

**Wersja angielska:** tłumaczenie 114 kart, Mapy Wyzwań, naborów, Canvy i materiałów kosztowało jednorazowo ok. 3,3 $ (zmierzone, `scripts/translate-data.ts`). Po zmianie karty skrypt tłumaczy tylko zmienione karty (kilka centów), a do tego czasu serwis pokazuje polski oryginał. Opisy po angielsku kosztują tyle samo co po polsku.

**Jak obniżyć koszt bez utraty jakości:**
- Wyniki ze słów kluczowych są zawsze darmowe i natychmiastowe; AI tylko je weryfikuje.
- Instrukcje i indeks 114 kart są w pamięci podręcznej modelu, więc większość tokenów wejściowych kosztuje ok. 20 razy mniej.
- Tańszy model wybraliśmy po pomiarze: na tym samym zestawie 20 przypadków Claude Sonnet 5.5 trafia częściej niż Opus 5.5 (100% zamiast 94% w top 3, 92% zamiast 85% na pierwszym miejscu), szybciej i za ok. 0,04 $ zamiast 0,07 $. Do rozważenia przez ROPS: weryfikacja AI tylko na życzenie użytkownika.
- Twardy limit: `AI_HOURLY_LIMIT` (domyślnie 400 wywołań na godzinę) oraz limit wydatków w konsoli dostawcy.

Bez klucza AI platforma nadal działa: wyszukiwanie słów kluczowych, ręczna ocena spraw i szablon planu.

## 3. Wariant na infrastrukturze Województwa

Aplikacja to standardowy Node.js 22 i PostgreSQL. Może działać na serwerach Urzędu Marszałkowskiego, w kontenerze albo na maszynie wirtualnej, bez Vercela i Neona. Wtedy koszt infrastruktury to koszt istniejących zasobów. Do wywołań AI w UE można użyć modelu Claude udostępnianego w europejskim regionie chmury (wymaga weryfikacji przy wdrożeniu).

## 4. Zasoby ludzkie

| Rola | Zakres | Wymiar |
|---|---|---|
| Redaktor wiedzy (pracownik ROPS) | Weryfikacja nowych kart („Dodaj z dokumentu"), aktualizacja naborów | ok. 0,2 etatu |
| Koordynator spraw (pracownik ROPS) | Odpowiedzi na sprawy, przydział ekspertów | zależnie od liczby spraw |
| Wsparcie techniczne (zewnętrzne) | Aktualizacje, kopie zapasowe, monitoring | 2–4 dni robocze w miesiącu |

## 5. Czego nie liczymy

- Domeny i certyfikatu: w ramach istniejącej infrastruktury Województwa.
- Bramki SMS: w prototypie symulowana; produkcyjnie np. SMSAPI.pl, rozliczana za wiadomość.
- Nagrania w PJM i audytu dostępności: koszty jednorazowe.
