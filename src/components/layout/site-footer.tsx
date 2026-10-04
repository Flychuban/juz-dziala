import Link from "next/link";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { FOOTER_NAV, resolveNav, SECONDARY_NAV } from "~/config/nav";
import { labelsFor } from "~/lib/domain";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";
import { DemoRoleSwitcher } from "./demo-role-switcher";

export async function SiteFooter() {
  const staff = await verifyStaffSession((await cookies()).get(STAFF_COOKIE)?.value);
  const L = labelsFor(await getLocale());
  const t = await getTranslations("common.footer");
  const tn = await getTranslations("common.nav");
  const columns: [string, ReturnType<typeof resolveNav>][] = [
    [t("shortcuts"), resolveNav(SECONDARY_NAV, tn)],
    [t("info"), resolveNav(FOOTER_NAV, tn)],
  ];
  return (
    <footer data-site-footer className="border-hairline bg-surface mt-16 border-t print:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold" lang="pl">
            {L.site.name}
          </p>
          <p className="text-muted-foreground mt-1">{L.site.hub}</p>
          <p className="text-muted-foreground mt-3 text-sm">{t("runBy", { owner: L.site.owner })}</p>
        </div>
        {columns.map(([label, items]) => (
          <nav key={label} aria-label={label}>
            <ul className="space-y-1">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="inline-flex min-h-11 items-center">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-hairline border-t">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="max-w-md">
            <DemoRoleSwitcher current={staff?.role ?? null} variant="inline" />
          </div>
        </div>
      </div>
      <div className="border-hairline border-t">
        <p className="text-muted-foreground mx-auto max-w-6xl px-4 py-4 text-sm">{t("sources")}</p>
      </div>
    </footer>
  );
}
