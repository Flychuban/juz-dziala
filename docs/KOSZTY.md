# Koszt utrzymania i niezbędne zasoby

Ceny sprawdzone 3 października 2026 r. na stronach dostawców (USD, netto). Koszt AI jest **mierzony**: każde wywołanie zapisuje w tabeli `jd_ai_call` liczbę tokenów i koszt, a podsumowanie jest w panelu `/admin/ai`.

## 1. Infrastruktura (wariant chmurowy, jak w prototypie)

| Składnik | Dostawca i plan | Cena | Szacunek miesięczny |
|---|---|---|---|
| Hosting aplikacji | Vercel Pro (1 stanowisko; plan Hobby nie dopuszcza użytku komercyjnego) | 20 $/mies., w cenie 1 TB transferu; dalej od 0,60 $ za 1 mln wywołań funkcji i 0,128 $ za godzinę aktywnego CPU | ok. 20–30 $ |
| Baza danych | Neon Postgres, plan Launch, region Frankfurt (UE) | 0,35 $ za GB-miesiąc, 0,106 $ za CU-godzinę; baza usypia, gdy nie jest używana | ok. 5–20 $ |
| E-mail | Resend: Free (3 000 e-maili/mies.) lub Pro (50 000 e-maili/mies.) | 0 $ albo 20 $/mies. | 0–20 $ |
| Model AI | Claude Opus 5.5 (Anthropic): 4 $ za 1 mln tokenów wejściowych, 20 $ za 1 mln wyjściowych, 0,20 $ za 1 mln tokenów z pamięci podręcznej | zob. punkt 2 | zob. punkt 2 |

## 2. Koszt AI — z pomiaru

Koszt jednego dopasowania, jednej wstępnej oceny sprawy i jednego Ramowego Planu Wdrożenia jest zapisywany przy każdym wywołaniu. Opis instrukcji i indeks 114 kart są w pamięci podręcznej modelu, więc kolejne zapytania płacą za nie ok. 20 razy mniej.

| Funkcja | Średni koszt jednego wywołania | Źródło |
|---|---|---|
| Dopasowanie (matchmaking) | *do uzupełnienia po pomiarze* | `/admin/ai`, `eval/results/ai-*.json` |
| Wstępna ocena sprawy | *do uzupełnienia po pomiarze* | `/admin/ai` |
| Ramowy Plan Wdrożenia | *do uzupełnienia po pomiarze* | `/admin/ai` |

**Scenariusz:** 2 000 dopasowań, 300 spraw i 50 planów miesięcznie. Koszt = liczba wywołań × zmierzony średni koszt.

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
