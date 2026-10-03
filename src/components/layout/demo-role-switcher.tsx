import Link from "next/link";

import { STAFF_ROLE_LABEL, type StaffRole } from "~/lib/domain";

/** Public demo only: one-click staff login. Marked clearly as a demo mode. */
export function DemoRoleSwitcher({ current }: { current: StaffRole | null }) {
  const roles: StaffRole[] = ["rops", "expert", "jst"];
  return (
    <details className="relative">
      <summary className="border-input inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border px-3 text-sm font-medium">
        Tryb demonstracyjny:{" "}
        {current ? STAFF_ROLE_LABEL[current] : "Mieszkaniec"}
      </summary>
      <div className="border-hairline bg-popover text-popover-foreground absolute right-0 z-40 mt-1 w-72 rounded-md border p-2">
        <p className="text-muted-foreground px-2 pb-2 text-sm">
          Zobacz platformę oczami różnych użytkowników. Logowanie tylko na
          potrzeby prezentacji.
        </p>
        <ul>
          <li>
            <Link
              prefetch={false}
              href="/api/demo-login?role=none&next=/"
              className="hover:bg-accent flex min-h-11 items-center rounded px-2"
            >
              Mieszkaniec (bez logowania)
            </Link>
          </li>
          {roles.map((r) => (
            <li key={r}>
              <Link
                prefetch={false}
                href={`/api/demo-login?role=${r}&next=${r === "rops" ? "/admin" : r === "expert" ? "/expert" : "/municipality"}`}
                className="hover:bg-accent flex min-h-11 items-center rounded px-2"
              >
                {STAFF_ROLE_LABEL[r]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
