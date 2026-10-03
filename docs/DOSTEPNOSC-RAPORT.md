# Raport dostępności — test automatyczny WCAG 2.1 AA

Stan na: 3 października 2026 18:49. Narzędzie: axe-core (@axe-core/playwright) w przeglądarce Chromium uruchamianej przez Playwright.
Reguły: WCAG 2.0 i 2.1, poziomy A i AA (wcag2a, wcag2aa, wcag21a, wcag21aa). Ekrany: telefon 360 px i komputer 1280 px.
Na telefonie sprawdzamy też powiększenie 200% (WCAG 1.4.10): strona ułożona na 180 px szerokości nie może przewijać się w poziomie.

Wynik: 38 z 38 sprawdzeń bez naruszeń poważnych i krytycznych; 19 ekranów przewija się w poziomie przy 200%.

Test automatyczny nie zastępuje sprawdzenia z czytnikiem ekranu i samą klawiaturą — część kryteriów WCAG ocenia tylko człowiek.

## Wyniki według ekranów

| Ekran | Adres | Telefon 360 px | Komputer 1280 px |
|---|---|---|---|
| Deklaracja dostępności | `/accessibility` | zaliczone (0 naruszeń) · 200%: przewijanie (226 px) | zaliczone (0 naruszeń) |
| Zaplanuj usługę | `/adapt` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Sprawy (ROPS) | `/admin/cases` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Pulpit ROPS | `/admin` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Moja sprawa | `/case` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Tekst łatwy do czytania | `/easy-read` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Strona główna | `/` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Mam pomysł | `/ideas/new` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Wiedza: seniorzy | `/knowledge/seniors` | zaliczone (0 naruszeń) · 200%: przewijanie (279 px) | zaliczone (0 naruszeń) |
| Wiedza | `/knowledge` | zaliczone (0 naruszeń) · 200%: przewijanie (261 px) | zaliczone (0 naruszeń) |
| Materiały | `/learn` | zaliczone (0 naruszeń) · 200%: przewijanie (271 px) | zaliczone (0 naruszeń) |
| Karta innowacji | `/library/mobilne-centrum-pomocy-dla-osob-starszych` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Biblioteka | `/library` | zaliczone (0 naruszeń) · 200%: przewijanie (332 px) | zaliczone (0 naruszeń) |
| Wyniki dopasowania | `/match/<id>` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Jak działa dopasowanie | `/methodology` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Dla gminy | `/municipality` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Sieć | `/network` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Język migowy | `/sign-language` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |
| Tester | `/test` | zaliczone (0 naruszeń) · 200%: przewijanie (214 px) | zaliczone (0 naruszeń) |

## Naruszenia poważne i krytyczne

Brak.

## Naruszenia umiarkowane i drobne

Brak.

## Przewijanie w poziomie przy powiększeniu 200%

- `/accessibility`: szerokość strony 226 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/adapt`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/admin/cases`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Pracown”
  - div.ml-auto (164 px) „Powiadomienia(brak nowych)”
  - div.flex.min-w-0.flex-col.gap-1 (195 px) „JD-EGA6-9ZNF·PotrzebaMama ma 73 lata, mi”
  - dl.grid.grid-cols-[auto_1fr].content-start.gap-x-2 (195 px) „Status:OdpowiedzianoPilność:nieocenionaZ”
  - div.flex.min-w-0.flex-col.gap-1 (195 px) „JD-XHXT-33G9·PotrzebaMama ma 73 lata, mi”
- `/admin`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Pracown”
  - div.ml-auto (164 px) „Powiadomienia(brak nowych)”
  - a.border-hairline.hover:bg-accent.flex.flex-col (165 px) „Nowe0Jeszcze nikt ich nie podjął.”
  - a.border-hairline.hover:bg-accent.flex.flex-col (165 px) „Czekają ponad 48 h0Otwarte, bez ruchu od”
  - a.border-hairline.hover:bg-accent.flex.flex-col (165 px) „Otwarte0Nowe, ocenione i w toku.”
- `/case`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/easy-read`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/ideas/new`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/knowledge/seniors`: szerokość strony 279 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
  - section (221 px) „Kluczowe wyzwania1.Konieczność dostosowa”
  - section.border-hairline.bg-surface.self-start.rounded-lg (221 px) „Persona z Mapy WyzwańPoznaj: Janina, 73M”
  - a.group/button.inline-flex.shrink-0.items-center (261 px) „Zobacz wszystkie (20)”
  - li (237 px) „Dla seniorówBaWitaNarzędzie rehabilitacy”
- `/knowledge`: szerokość strony 261 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
  - li (243 px) „01Rodzina i piecza zastępczaKluczowe wyz”
  - li (243 px) „02BezdomnośćKluczowe wyzwanie: rośnie li”
  - li (243 px) „03NiepełnosprawnośćKluczowe wyzwanie: Zw”
  - li (243 px) „04UbóstwoKluczowe wyzwanie: ubóstwo dzie”
- `/learn`: szerokość strony 271 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
  - li (171 px) „Regionalny Ośrodek Polityki Społecznej w”
  - li (174 px) „INNO AGHSocial Innovation Canvas (wersja”
  - li (174 px) „Regionalny Ośrodek Polityki Społecznej w”
  - li (182 px) „Regionalny Ośrodek Polityki Społecznej w”
- `/library/mobilne-centrum-pomocy-dla-osob-starszych`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
  - aside.lg:sticky.lg:top-6.lg:col-start-2.lg:row-start-1 (178 px) „Co możesz zrobićChcę to wdrożyćDla gminy”
  - article.min-w-0.lg:col-start-1.lg:row-start-1 (178 px) „Na czym polega rozwiązanie?Innowacja to ”
- `/library`: szerokość strony 332 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
  - span.text-muted-foreground.tabular.text-[0.9375rem] (16 px) „, liczba rozwiązań: 21”
  - span.text-muted-foreground.tabular.text-[0.9375rem] (9 px) „, liczba rozwiązań: 2”
  - span.flex-1.font-medium (159 px) „Niepełnosprawność”
  - span.text-muted-foreground.tabular.text-[0.9375rem] (16 px) „, liczba rozwiązań: 51”
- `/match/<id>`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/methodology`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/municipality`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/network`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/sign-language`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”
- `/test`: szerokość strony 214 px przy oknie 180 px
  - div.flex.flex-wrap.items-center.gap-2 (196 px) „A−A+KontrastTryb demonstracyjny: Mieszka”

Jak powtórzyć: `pnpm test:e2e tests/e2e/a11y.spec.ts`, potem `pnpm exec tsx scripts/a11y-report.ts`.
