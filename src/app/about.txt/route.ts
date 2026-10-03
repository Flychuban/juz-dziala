/** Machine-readable description of the service (ustawa o zapewnianiu dostępności, art. 6 pkt 3 lit. c). */
const TEXT = `Już Działa — Małopolski Hub Innowacji Społecznych
Prowadzi: Regionalny Ośrodek Polityki Społecznej w Krakowie (ROPS Kraków), instytucja Województwa Małopolskiego.

Serwis łączy problemy społeczne zgłaszane przez mieszkańców, organizacje i gminy z rozwiązaniami sprawdzonymi w Małopolsce i opisanymi w Bibliotece Innowacji Społecznych ROPS Kraków.

Co można zrobić:
1. Opisać problem (tekstem lub głosem) i otrzymać pasujące innowacje z cytatem ze źródła.
2. Poprosić ROPS o pomoc i sprawdzać odpowiedź kodem sprawy, bez zakładania konta.
3. Przeglądać Bibliotekę Innowacji Społecznych, filmy i materiały.
4. Poznać wyzwania społeczne z Mapy Wyzwań Społecznych.
5. Zgłosić pomysł na innowację i przygotować szkic wniosku w otwartym naborze.
6. Zgłosić chęć testowania innowacji i ocenić rozwiązania.
7. Zadać pytanie ekspertowi i zapisać się na powiadomienia o naborach.
8. (Instytucje) Przygotować projekt Ramowego Planu Wdrożenia innowacji jako usługi.

Dostępność: /accessibility (deklaracja), /easy-read (tekst łatwy), /sign-language (PJM).
Dane: Biblioteka Innowacji Społecznych ROPS Kraków; GUS BDL. Otwarte API: /api/v1/innovations, /api/v1/calls
`;

export function GET() {
  return new Response(TEXT, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
