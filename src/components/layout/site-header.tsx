import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { EXPERT_NAV, PUBLIC_NAV, resolveNav, STAFF_NAV } from "~/config/nav";
import { labelsFor } from "~/lib/domain";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";
import { AccessibilityToolbar } from "./accessibility-toolbar";
import { DemoRoleSwitcher } from "./demo-role-switcher";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { StaffBell } from "./staff-bell";

/**
 * Site header. Desktop (md+): owner line, display toolbar, language switch and
 * demo switcher on top; logo and the five main links below. Phone: one compact
 * toolbar row, then the logo and a „Menu" disclosure that holds the
 * navigation, the staff links and the demo switcher — so the page itself
 * starts on the first screen.
 */
export async function SiteHeader() {
  const staff = await verifyStaffSession((await cookies()).get(STAFF_COOKIE)?.value);
  const L = labelsFor(await getLocale());
  const t = await getTranslations("common.header");
  const tn = await getTranslations("common.nav");
  const nav = resolveNav(PUBLIC_NAV, tn);
  const staffNav = resolveNav(
    staff?.role === "rops" ? STAFF_NAV : staff?.role === "expert" ? EXPERT_NAV : [],
    tn,
  );
  const staffLabel = staff ? `${L.staffRole[staff.role]}: ${staff.name}` : undefined;

  return (
    <header data-site-header className="border-hairline bg-background border-b">
      <div className="border-hairline bg-surface border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="text-muted-foreground hidden min-w-0 md:inline">
            {L.site.ownerShort} · {L.site.ownerLine}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <AccessibilityToolbar />
            <div className="hidden md:block">
              <DemoRoleSwitcher current={staff?.role ?? null} />
            </div>
          </div>
        </div>
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 md:py-3">
        <Link href="/" className="group flex min-w-0 grow basis-0 flex-col no-underline md:grow-0 md:basis-auto">
          <span className="font-display text-foreground text-2xl leading-tight font-bold tracking-tight whitespace-nowrap max-[359px]:text-xl" lang="pl">
            {L.site.name}
          </span>
          <span className="text-muted-foreground text-sm max-[359px]:hidden">{L.site.hub}</span>
        </Link>
        <nav aria-label={t("mainNav")} className="hidden min-w-0 md:block">
          <NavLinks items={nav} layout="row" />
        </nav>
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Suspense fallback={null}>
            <LanguageSwitch
              compact
              className="border-input bg-background text-foreground hover:bg-accent inline-flex min-h-12 min-w-12 items-center justify-center rounded-md border px-2 text-sm font-semibold no-underline"
            />
          </Suspense>
          <MobileMenu items={nav} staffItems={staffNav} staffLabel={staffLabel}>
            <DemoRoleSwitcher current={staff?.role ?? null} variant="inline" />
          </MobileMenu>
        </div>
      </div>
      {staff && (
        <div className="border-hairline bg-secondary border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5">
            <span className="min-w-0 text-sm font-semibold">{staffLabel}</span>
            <nav aria-label={t("staffNav")} className="hidden min-w-0 md:block">
              <NavLinks items={staffNav} layout="row" size="sm" />
            </nav>
            {(staff.role === "rops" || staff.role === "expert") && (
              <div className="min-w-0 sm:ml-auto">
                <StaffBell />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
