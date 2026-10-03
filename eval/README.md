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
pnpm eval --matcher=ai             # dopasowanie AI przez src/server/ai/match-eval-adapter.ts
pnpm eval --library=inny-plik.json # inna wersja biblioteki
```

Każdy tekst przechodzi przez `redactPII` przed dopasowaniem. Wynik trafia do `eval/results/<matcher>-<czas>.json`, a w terminalu pojawia się tabela: trafienie w top-3, top-1, poprawność odmowy, wycieki danych osobowych, wykonane wstrzyknięcia, opóźnienie p50/p95 i koszt.

Jeśli `data/library.json` jeszcze nie istnieje, skrypt wypisze komunikat i zakończy się bez błędu.

Adapter AI eksportuje `createMatcher()` (albo `matcher` lub domyślną funkcję) zwracającą `(tekst) => Promise<{ slugs, abstained, latencyMs, costUsd?, redactedText?, confidence? }>`.

## Próg niskiej pewności

`LOW_CONFIDENCE_THRESHOLD` w `src/server/domain/keywords.ts` skalibrowano na tym zestawie, na przybliżeniu biblioteki (opisy z list kategorii), bo pełna biblioteka jeszcze nie istniała. Po każdym przebiegu skrypt podaje sugerowany próg — sprawdźcie go, gdy pojawi się prawdziwe `data/library.json`.
