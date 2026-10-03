/** Navigation is generated from here; module agents never edit the shell. */
export type NavItem = { href: string; label: string; description?: string };

/** Residents: five items, plain words. */
export const PUBLIC_NAV: NavItem[] = [
  {
    href: "/",
    label: "Opisz problem",
    description: "Znajdź gotowe rozwiązanie",
  },
  {
    href: "/library",
    label: "Gotowe rozwiązania",
    description: "Biblioteka Innowacji Społecznych",
  },
  {
    href: "/ideas/new",
    label: "Mam pomysł",
    description: "Zgłoś pomysł na innowację",
  },
  {
    href: "/knowledge",
    label: "Wiedza",
    description: "Kondycja Małopolski i materiały",
  },
  {
    href: "/case",
    label: "Moja sprawa",
    description: "Sprawdź odpowiedź kodem sprawy",
  },
];

/** Secondary links (home "doors" and footer). */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/test", label: "Testuj innowacje" },
  { href: "/network", label: "Sieć i mentorzy" },
  { href: "/adapt", label: "Zaplanuj usługę (dla instytucji)" },
  { href: "/municipality", label: "Dla gminy" },
  { href: "/learn", label: "Materiały" },
  { href: "/methodology", label: "Jak działa dopasowanie" },
];

export const STAFF_NAV: NavItem[] = [
  { href: "/admin", label: "Pulpit" },
  { href: "/admin/cases", label: "Sprawy" },
  { href: "/admin/library", label: "Biblioteka" },
  { href: "/admin/calls", label: "Nabory" },
  { href: "/admin/trends", label: "Trendy i białe plamy" },
  { href: "/admin/ai", label: "AI: koszty i jakość" },
];

export const EXPERT_NAV: NavItem[] = [
  { href: "/expert", label: "Moje sprawy" },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/accessibility", label: "Deklaracja dostępności" },
  { href: "/easy-read", label: "Tekst łatwy do czytania" },
  { href: "/sign-language", label: "Informacja w PJM" },
  { href: "/about.txt", label: "O serwisie (plik tekstowy)" },
  { href: "/api/v1/innovations", label: "Otwarte API" },
  { href: "/methodology", label: "Jak działa dopasowanie" },
];
