# Ewaluacja dopasowania

`cases.json` to 20 przypadków, na których mierzymy, czy „Już Działa” trafnie łączy opis problemu mieszkańca z kartą z Biblioteki Innowacji Społecznych ROPS:

- 5 zapytań dwuwyrazowych, tak jak wpisuje je jury („samotny senior”),
- 6 jasnych historii,
- 3 wypowiedzi potoczne, głosem seniora lub rodziny,
- 2 przypadki z kilku obszarów naraz,
- 2 przypadki bez odpowiedzi w bibliotece (oczekiwana odmowa),
- 2 przypadki wrogie: dane osobowe (PESEL z poprawną sumą kontrolną, telefon, e-mail — wszystko fikcyjne) oraz próba wstrzyknięcia polecenia.

Trafienie oznacza, że któraś z kart z `acceptableSlugs` jest w pierwszej trójce i dopasowanie nie odmówiło odpowiedzi. Slugi pochodzą z list kategorii na rops.krakow.pl z 3.10.2026 (`library-slugs.json`).

## Zestaw jest zamrożony

Przypadki napisano 3.10.2026, przed jakimkolwiek strojeniem dopasowania. **Nie edytujemy ich po rozpoczęciu strojenia** — inaczej wynik mierzy nasze poprawki, a nie jakość dopasowania. Nowe przypadki trafiają do osobnego pliku.

## Uruchomienie

```bash
pnpm eval                          # dopasowanie słownikowe (keywords.ts) na data/library.json
pnpm eval -- --matcher=ai          # pełny potok (słowa → Claude → weryfikacja), wymaga ANTHROPIC_API_KEY
pnpm eval --library=inny-plik.json # inna wersja biblioteki
```

Każdy tekst przechodzi przez `redactPII` przed dopasowaniem. Wynik trafia do `eval/results/<matcher>-<czas>.json`, a w terminalu pojawia się tabela: trafienie w top-3, top-1, poprawność odmowy, wycieki danych osobowych, wykonane wstrzyknięcia, opóźnienie p50/p95 i koszt.

Jeśli `data/library.json` jeszcze nie istnieje, skrypt wypisze komunikat i zakończy się bez błędu.

Adapter AI eksportuje `createMatcher()` (albo `matcher` lub domyślną funkcję) zwracającą `(tekst) => Promise<{ slugs, abstained, latencyMs, costUsd?, redactedText?, confidence? }>`.

## Wersja angielska

`cases.en.json` to wierne tłumaczenie tych samych 20 przypadków (te same id, oczekiwania, dane osobowe i zakazane slugi), napisane 4.10.2026 przed pierwszym przebiegiem po angielsku. `cases.en.test.ts` pilnuje, że oczekiwania się nie różnią.

```bash
pnpm eval -- --cases=eval/cases.en.json --locale=en               # słowa: indeks angielski + polski
pnpm eval -- --cases=eval/cases.en.json --matcher=ai --locale=en  # pełny potok po angielsku
```

`--locale=en` redaguje dane osobowe z angielskimi znacznikami (`[phone]`), dołącza tłumaczenia kart z `data/library.en.json`, przeszukuje oba indeksy i prosi AI o odpowiedź po angielsku. Wynik zapisuje się jako matcher `<matcher>-en` (`eval/results/ai-en-<czas>.json`), więc nie zastępuje polskiego wyniku na stronie metodologii.

Pierwszy przebieg (4.10.2026): słowa — trafienie w top-3 94% (17/18), top-1 54% (7/13), odmowa 2/2; AI — trafienie w top-3 100% (18/18), top-1 85% (11/13), odmowa 2/2, wycieki danych 0, wstrzyknięcia 0, koszt 1,39 USD.

## Próg niskiej pewności

`LOW_CONFIDENCE_THRESHOLD = 0.6` w `src/server/domain/keywords.ts` skalibrowano 3.10.2026 na tym zestawie i prawdziwej bibliotece (114 kart). Pewność (`normScore`) liczymy w skali logarytmicznej, bo surowy wynik rośnie z długością opisu: dwa przypadki bez odpowiedzi mają 0,37 i 0,40, najsłabsza trafna odpowiedź 0,79. Po każdym przebiegu skrypt podaje sugerowany próg.

## Uwaga o k04

Slug `lekki-wozek-aktywny` (k04) jest prawdziwą kartą z listy kategorii na rops.krakow.pl, ale nie trafił do `data/library.json` (114 z 115 kart). To nie literówka, więc zgodnie z zasadą zamrożenia przypadek zostaje bez zmian; k04 ma inne akceptowalne karty.
