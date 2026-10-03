import Link from "next/link";
import { cookies } from "next/headers";

import { PUBLIC_NAV, STAFF_NAV, EXPERT_NAV } from "~/config/nav";
import { SITE, STAFF_ROLE_LABEL } from "~/lib/domain";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";
import { AccessibilityToolbar } from "./accessibility-toolbar";
import { DemoRoleSwitcher } from "./demo-role-switcher";
import { StaffBell } from "./staff-bell";

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

  return (
    <header data-site-header className="border-hairline bg-background border-b">
      <div className="border-hairline bg-surface border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="text-muted-foreground">
            {SITE.ownerShort} · {SITE.ownerLine}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <AccessibilityToolbar />
            <DemoRoleSwitcher current={staff?.role ?? null} />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="group flex flex-col no-underline">
          <span className="font-display text-foreground text-2xl font-bold tracking-tight">
            {SITE.name}
          </span>
          <span className="text-muted-foreground text-sm">{SITE.hub}</span>
        </Link>
        <nav aria-label="Główna nawigacja">
          <ul className="flex flex-wrap items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-foreground hover:bg-accent inline-flex min-h-12 items-center rounded-md px-3 font-medium no-underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {staff && (
        <div className="border-hairline bg-secondary border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5">
            <span className="text-sm font-semibold">
              {STAFF_ROLE_LABEL[staff.role]}: {staff.name}
            </span>
            <nav aria-label="Panel pracownika">
              <ul className="flex flex-wrap gap-1">
                {staffNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="hover:bg-accent inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium no-underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {(staff.role === "rops" || staff.role === "expert") && (
              <div className="ml-auto">
                <StaffBell />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
