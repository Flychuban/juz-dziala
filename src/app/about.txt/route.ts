/** Machine-readable description of the service (ustawa o zapewnianiu dostępności, art. 6 pkt 3 lit. c). Filled by the a11y pass. */
export function GET() {
  return new Response(
    "Już Działa — Małopolski Hub Innowacji Społecznych (ROPS Kraków). Opis w przygotowaniu.\n",
    {
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  );
}
