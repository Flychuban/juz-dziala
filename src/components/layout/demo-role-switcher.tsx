import { useTranslations } from "next-intl";

import { useLabels } from "~/i18n/use-labels";
import { type StaffRole } from "~/lib/domain";

const ROLES: StaffRole[] = ["rops", "expert", "jst"];
const NEXT: Record<StaffRole, string> = {
  rops: "/admin",
  expert: "/expert",
  jst: "/municipality",
};

/*
 * Plain <a>, never next/link: the login sets a cookie and the whole layout
 * (header, staff bar, bell) must re-render. A soft navigation keeps the cached
 * root layout, so the header would still say „Mieszkaniec" after switching.
 */
function RoleLinks() {
  const t = useTranslations("common.demo");
  const L = useLabels();
  return (
    <ul>
      <li>
        <a
          href="/api/demo-login?role=none&next=/"
          className="hover:bg-accent text-foreground flex min-h-12 items-center rounded px-2 no-underline"
        >
          {t("residentNoLogin")}
        </a>
      </li>
      {ROLES.map((r) => (
        <li key={r}>
          <a
            href={`/api/demo-login?role=${r}&next=${NEXT[r]}`}
            className="hover:bg-accent text-foreground flex min-h-12 items-center rounded px-2 no-underline"
          >
            {L.staffRole[r]}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Public demo only: one-click staff login, clearly marked as a demo mode.
 * `dropdown` (desktop top bar) is a disclosure; `inline` (phone menu panel,
 * footer) is a short titled list.
 */
export function DemoRoleSwitcher({
  current,
  variant = "dropdown",
}: {
  current: StaffRole | null;
  variant?: "dropdown" | "inline";
}) {
  const t = useTranslations("common.demo");
  const L = useLabels();
  const now = current ? L.staffRole[current] : t("resident");
  if (variant === "inline") {
    return (
      <section aria-label={t("mode")}>
        <p className="font-semibold">{t("modeNow", { role: now })}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("hint")}</p>
        <div className="-mx-2 mt-2">
          <RoleLinks />
        </div>
      </section>
    );
  }
  return (
    <details className="relative max-w-full">
      <summary className="border-input bg-background hover:bg-accent inline-flex min-h-12 max-w-full cursor-pointer list-none items-center rounded-md border px-3 py-1 text-left text-sm leading-tight font-medium [&::-webkit-details-marker]:hidden">
        {t("modeNow", { role: now })}
      </summary>
      <div className="border-input bg-popover text-popover-foreground absolute left-0 z-40 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-md border p-2 sm:right-0 sm:left-auto">
        <p className="text-muted-foreground px-2 pb-2 text-sm">{t("hint")}</p>
        <RoleLinks />
      </div>
    </details>
  );
}
