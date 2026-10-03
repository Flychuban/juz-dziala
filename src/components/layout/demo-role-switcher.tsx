import Link from "next/link";

import { STAFF_ROLE_LABEL, type StaffRole } from "~/lib/domain";

const ROLES: StaffRole[] = ["rops", "expert", "jst"];
const NEXT: Record<StaffRole, string> = {
  rops: "/admin",
  expert: "/expert",
  jst: "/municipality",
};

const HINT =
  "Zobacz platformę oczami różnych użytkowników. Logowanie tylko na potrzeby prezentacji.";

function RoleLinks() {
  return (
    <ul>
      <li>
        <Link
          prefetch={false}
          href="/api/demo-login?role=none&next=/"
          className="hover:bg-accent flex min-h-12 items-center rounded px-2"
        >
          Mieszkaniec (bez logowania)
        </Link>
      </li>
      {ROLES.map((r) => (
        <li key={r}>
          <Link
            prefetch={false}
            href={`/api/demo-login?role=${r}&next=${NEXT[r]}`}
            className="hover:bg-accent flex min-h-12 items-center rounded px-2"
          >
            {STAFF_ROLE_LABEL[r]}
          </Link>
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
  const now = current ? STAFF_ROLE_LABEL[current] : "Mieszkaniec";
  if (variant === "inline") {
    return (
      <section aria-label="Tryb demonstracyjny">
        <p className="font-semibold">Tryb demonstracyjny: {now}</p>
        <p className="text-muted-foreground mt-1 text-sm">{HINT}</p>
        <div className="-mx-2 mt-2">
          <RoleLinks />
        </div>
      </section>
    );
  }
  return (
    <details className="relative max-w-full">
      <summary className="border-input bg-background hover:bg-accent inline-flex min-h-12 max-w-full cursor-pointer list-none items-center rounded-md border px-3 py-1 text-left text-sm leading-tight font-medium [&::-webkit-details-marker]:hidden">
        Tryb demonstracyjny: {now}
      </summary>
      <div className="border-input bg-popover text-popover-foreground absolute left-0 z-40 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-md border p-2 sm:right-0 sm:left-auto">
        <p className="text-muted-foreground px-2 pb-2 text-sm">{HINT}</p>
        <RoleLinks />
      </div>
    </details>
  );
}
