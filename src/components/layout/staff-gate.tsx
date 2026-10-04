import { cookies, headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { labelsFor, type StaffRole } from "~/lib/domain";
import { STAFF_COOKIE, verifyStaffSession, type StaffSession } from "~/server/auth/session";

/** Server-side guard for staff areas. ROPS may enter every staff area. */
export async function requireStaff(roles: StaffRole[]): Promise<StaffSession | null> {
  const s = await verifyStaffSession((await cookies()).get(STAFF_COOKIE)?.value);
  if (!s) return null;
  if (s.role === "rops" || roles.includes(s.role)) return s;
  return null;
}

/**
 * Login prompt for a staff area. After the one-click demo login the person
 * lands on the page they asked for (e.g. a case link from a notification),
 * not on the dashboard: the middleware passes the path as x-pathname.
 * A plain <a> (full page load) so the header and staff bar re-render.
 */
export async function StaffLoginPrompt({ role, next }: { role: StaffRole; next: string }) {
  const t = await getTranslations("common.staffGate");
  const L = labelsFor(await getLocale());
  const asked = (await headers()).get("x-pathname");
  const target = asked?.startsWith("/") && !asked.startsWith("//") ? asked : next;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-lg">{t("body", { role: L.staffRole[role] })}</p>
      <a
        href={`/api/demo-login?role=${role}&next=${encodeURIComponent(target)}`}
        className="bg-primary text-primary-foreground mt-6 inline-flex min-h-12 items-center rounded-md px-5 font-semibold no-underline"
      >
        {t("enter", { role: L.staffRole[role] })}
      </a>
      <p className="text-muted-foreground mt-4 text-sm">{t("sso")}</p>
    </div>
  );
}
