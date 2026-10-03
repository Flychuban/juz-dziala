import Link from "next/link";
import { cookies } from "next/headers";

import { EXPERT_NAV, PUBLIC_NAV, STAFF_NAV } from "~/config/nav";
import { SITE, STAFF_ROLE_LABEL } from "~/lib/domain";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";
import { AccessibilityToolbar } from "./accessibility-toolbar";
import { DemoRoleSwitcher } from "./demo-role-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { StaffBell } from "./staff-bell";

/**
 * Site header. Desktop (md+): owner line, display toolbar and demo switcher
 * on top; logo and the five main links below. Phone: one compact toolbar row,
 * then the logo and a „Menu" button that holds the navigation, the staff
 * links and the demo switcher — so the page itself starts on the first screen.
 */
export async function SiteHeader() {
  const staff = await verifyStaffSession(
    (await cookies()).get(STAFF_COOKIE)?.value,
  );
  const staffNav =
    staff?.role === "rops"
      ? STAFF_NAV
      : staff?.role === "expert"
        ? EXPERT_NAV
        : [];
  const staffLabel = staff
    ? `${STAFF_ROLE_LABEL[staff.role]}: ${staff.name}`
    : undefined;

  return (
    <header data-site-header className="border-hairline bg-background border-b">
      <div className="border-hairline bg-surface border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="text-muted-foreground hidden min-w-0 md:inline">
            {SITE.ownerShort} · {SITE.ownerLine}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <AccessibilityToolbar />
            <div className="hidden md:block">
              <DemoRoleSwitcher current={staff?.role ?? null} />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 md:py-3">
        <Link href="/" className="group flex min-w-0 grow basis-0 flex-col no-underline md:grow-0 md:basis-auto">
          <span className="font-display text-foreground text-2xl leading-tight font-bold tracking-tight">
            {SITE.name}
          </span>
          <span className="text-muted-foreground text-sm">{SITE.hub}</span>
        </Link>
        <nav aria-label="Główna nawigacja" className="hidden min-w-0 md:block">
          <NavLinks items={PUBLIC_NAV} layout="row" />
        </nav>
        <MobileMenu
          className="md:hidden"
          items={PUBLIC_NAV}
          staffItems={staffNav}
          staffLabel={staffLabel}
        >
          <DemoRoleSwitcher current={staff?.role ?? null} variant="inline" />
        </MobileMenu>
      </div>
      {staff && (
        <div className="border-hairline bg-secondary border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5">
            <span className="min-w-0 text-sm font-semibold">{staffLabel}</span>
            <nav aria-label="Panel pracownika" className="hidden min-w-0 md:block">
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
