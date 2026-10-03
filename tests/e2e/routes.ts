/**
 * Routes checked by the accessibility suite. Add a route here when a screen
 * lands; nothing else needs to change. `wait` is text that must be visible
 * before the check runs (for screens that load data on the client).
 */
export type Route = { path: string; name: string; wait?: RegExp };

export const PUBLIC_ROUTES: Route[] = [
  { path: "/", name: "Strona główna" },
  { path: "/library", name: "Biblioteka" },
  { path: "/library/mobilne-centrum-pomocy-dla-osob-starszych", name: "Karta innowacji" },
  { path: "/knowledge", name: "Wiedza" },
  { path: "/knowledge/seniors", name: "Wiedza: seniorzy" },
  { path: "/learn", name: "Materiały" },
  { path: "/case", name: "Moja sprawa" },
  { path: "/accessibility", name: "Deklaracja dostępności" },
  { path: "/easy-read", name: "Tekst łatwy do czytania" },
  { path: "/sign-language", name: "Język migowy" },
  { path: "/methodology", name: "Jak działa dopasowanie" },
  { path: "/network", name: "Sieć" },
  { path: "/test", name: "Tester" },
  { path: "/ideas/new", name: "Mam pomysł" },
  { path: "/adapt", name: "Zaplanuj usługę" },
  { path: "/municipality", name: "Dla gminy" },
];

/** Opened after `/api/demo-login?role=rops`. */
export const STAFF_ROUTES: Route[] = [
  { path: "/admin", name: "Pulpit ROPS" },
  { path: "/admin/cases", name: "Sprawy (ROPS)" },
];

/** Created through the UI during the run. */
export const MATCH_ROUTE: Route = { path: "/match/<id>", name: "Wyniki dopasowania" };

export const MATCH_QUERY = "Mama ma 73 lata, mieszka sama na wsi i prawie nie wychodzi z domu, myli leki.";
