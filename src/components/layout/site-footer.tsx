import Link from "next/link";
import { cookies } from "next/headers";

import { FOOTER_NAV, SECONDARY_NAV } from "~/config/nav";
import { SITE } from "~/lib/domain";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";
import { DemoRoleSwitcher } from "./demo-role-switcher";

export async function SiteFooter() {
  const staff = await verifyStaffSession(
    (await cookies()).get(STAFF_COOKIE)?.value,
  );
  return (
    <footer
      data-site-footer
      className="border-hairline bg-surface mt-16 border-t"
    >
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold">{SITE.name}</p>
          <p className="text-muted-foreground mt-1">{SITE.hub}</p>
          <p className="text-muted-foreground mt-3 text-sm">
            Prowadzi: {SITE.owner}. Prototyp przygotowany na HackYeah 2026. Dane
            przykładowe są oznaczone jako „przykładowe".
          </p>
        </div>
        <nav aria-label="Na skróty">
          <ul className="space-y-1">
            {SECONDARY_NAV.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className="inline-flex min-h-11 items-center"
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Dostępność i informacje">
          <ul className="space-y-1">
            {FOOTER_NAV.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className="inline-flex min-h-11 items-center"
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-hairline border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 md:max-w-6xl">
          <div className="max-w-md">
            <DemoRoleSwitcher current={staff?.role ?? null} variant="inline" />
          </div>
        </div>
      </div>
      <div className="border-hairline border-t">
        <p className="text-muted-foreground mx-auto max-w-6xl px-4 py-4 text-sm">
          Opisy innowacji pochodzą z Biblioteki Innowacji Społecznych ROPS
          Kraków (licencje podane przy każdej karcie). Każda informacja ma
          podane źródło.
        </p>
      </div>
    </footer>
  );
}
