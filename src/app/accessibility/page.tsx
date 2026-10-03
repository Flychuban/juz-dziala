import Link from "next/link";

import { PageHeader } from "~/components/kit";

export const metadata = { title: "Deklaracja dostępności" };

/**
 * Deklaracja dostępności — structure required by art. 10 of the ustawa z 4 kwietnia 2019 r.
 * o dostępności cyfrowej (model: gov.pl). Facts a prototype cannot know are marked
 * „do uzupełnienia przez ROPS" instead of being invented.
 */
export default function AccessibilityPage() {
  return (
    <>
      <PageHeader
        width="narrow"
        eyebrow="Dostępność"
        title="Deklaracja dostępności"
        lead="Regionalny Ośrodek Polityki Społecznej w Krakowie zobowiązuje się zapewnić dostępność serwisu „Już Działa” zgodnie z ustawą z dnia 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych."
      />
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 text-lg [&_h2]:text-2xl [&_h2]:font-bold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">
        <p className="border-hairline bg-warning-bg rounded-md border p-4 text-base">
          To deklaracja prototypu przygotowanego na HackYeah 2026. Miejsca
          oznaczone „do uzupełnienia przez ROPS” wymagają danych, których zespół
          prototypu nie zna — nie zostały wymyślone.
        </p>

        <section aria-labelledby="zakres">
          <h2 id="zakres">Zakres deklaracji</h2>
          <ul>
            <li>
              Nazwa serwisu: Już Działa — Małopolski Hub Innowacji Społecznych.
            </li>
            <li>Data publikacji serwisu: 3 października 2026 r. (prototyp).</li>
            <li>
              Data ostatniej istotnej aktualizacji: 4 października 2026 r.
            </li>
          </ul>
        </section>

        <section aria-labelledby="status">
          <h2 id="status">Stan dostępności cyfrowej</h2>
          <p>
            Serwis jest <strong>częściowo zgodny</strong> z ustawą o dostępności
            cyfrowej z powodu niezgodności lub wyłączeń wymienionych poniżej.
          </p>
          <h3 className="mt-4 text-xl font-semibold">
            Niezgodności i wyłączenia
          </h3>
          <ul>
            <li>
              Filmy o innowacjach pochodzą z kanału ROPS w serwisie YouTube. Nie
              wszystkie mają napisy przygotowane ręcznie ani audiodeskrypcję.
            </li>
            <li>
              Dokumenty PDF dołączone do kart innowacji pochodzą od autorów
              innowacji i mogą nie być w pełni dostępne.
            </li>
            <li>
              Nagranie informacji o serwisie w polskim języku migowym jest w
              przygotowaniu (zob.{" "}
              <Link href="/sign-language">Informacja w PJM</Link>).
            </li>
            <li>
              Wpisywanie głosem („Powiedz”) działa tylko w przeglądarkach, które
              je obsługują. Zawsze można wpisać tekst z klawiatury.
            </li>
          </ul>
        </section>

        <section aria-labelledby="przygotowanie">
          <h2 id="przygotowanie">Przygotowanie deklaracji</h2>
          <ul>
            <li>Data sporządzenia deklaracji: 4 października 2026 r.</li>
            <li>
              Metoda: samoocena zespołu prototypu — testy automatyczne (axe),
              obsługa wyłącznie z klawiatury, czytnik ekranu VoiceOver, ekran
              telefonu 360 px, powiększenie do 200%.
            </li>
          </ul>
        </section>

        <section aria-labelledby="ulatwienia">
          <h2 id="ulatwienia">Ułatwienia w serwisie</h2>
          <ul>
            <li>
              Duży tekst domyślnie (18 px) i przyciski A+ / A− w górnym pasku.
            </li>
            <li>Tryb wysokiego kontrastu (przycisk „Kontrast”).</li>
            <li>
              <Link href="/easy-read">Tekst łatwy do czytania</Link>.
            </li>
            <li>Czytanie na głos wyników i opisów innowacji.</li>
            <li>
              Formularze podzielone na pojedyncze pytania, bez limitu czasu.
            </li>
            <li>Mapa zawsze ma wersję w postaci tabeli.</li>
            <li>Nie trzeba zakładać konta ani podawać nazwiska.</li>
          </ul>
        </section>

        <section aria-labelledby="skroty">
          <h2 id="skroty">Skróty klawiaturowe</h2>
          <p>
            Serwis nie definiuje własnych skrótów. Działają standardowe skróty
            przeglądarki. Pierwsze naciśnięcie klawisza Tab pokazuje odnośnik
            „Przejdź do treści”.
          </p>
        </section>

        <section aria-labelledby="kontakt">
          <h2 id="kontakt">Informacje zwrotne i dane kontaktowe</h2>
          <p>
            Jeśli zauważysz problem z dostępnością, napisz do nas. Osoba
            kontaktowa, adres e-mail i telefon:{" "}
            <em>do uzupełnienia przez ROPS</em>. Tą samą drogą możesz poprosić o
            informację niedostępną w serwisie albo o udostępnienie jej w innej
            formie.
          </p>
        </section>

        <section aria-labelledby="procedura">
          <h2 id="procedura">Procedura wnioskowo-skargowa</h2>
          <p>
            Każdy ma prawo zażądać zapewnienia dostępności cyfrowej strony, jej
            elementu albo dostępu alternatywnego. Żądanie powinno zawierać dane
            osoby zgłaszającej, wskazanie strony lub elementu oraz sposób
            kontaktu. ROPS realizuje żądanie niezwłocznie, nie później niż w
            ciągu 7 dni. Jeżeli nie jest to możliwe, informuje o terminie — nie
            dłuższym niż 2 miesiące. W razie odmowy można złożyć skargę, a po
            jej rozpatrzeniu zawiadomić{" "}
            <a href="https://bip.brpo.gov.pl/" rel="noreferrer" target="_blank">
              Rzecznika Praw Obywatelskich (otwiera się w nowym oknie)
            </a>
            .
          </p>
        </section>

        <section aria-labelledby="architektura">
          <h2 id="architektura">Dostępność architektoniczna</h2>
          <p>
            Opis dostępności siedziby ROPS Kraków (wejścia, windy, toalety,
            parking, pętla indukcyjna, pies asystujący):{" "}
            <em>do uzupełnienia przez ROPS</em>.
          </p>
        </section>

        <section aria-labelledby="pjm">
          <h2 id="pjm">Tłumacz języka migowego</h2>
          <p>
            Możliwość skorzystania z tłumacza polskiego języka migowego online:{" "}
            <em>do uzupełnienia przez ROPS</em>.
          </p>
        </section>

        <section aria-labelledby="aplikacje">
          <h2 id="aplikacje">Aplikacje mobilne</h2>
          <p>
            Serwis nie ma aplikacji mobilnej. Działa w przeglądarce telefonu od
            szerokości 320 px.
          </p>
        </section>
      </div>
    </>
  );
}
