import Link from "next/link";
import { cookies } from "next/headers";

import { STAFF_ROLE_LABEL, type StaffRole } from "~/lib/domain";
import {
  STAFF_COOKIE,
  verifyStaffSession,
  type StaffSession,
} from "~/server/auth/session";

/** Server-side guard for staff areas. ROPS may enter every staff area. */
export async function requireStaff(
  roles: StaffRole[],
): Promise<StaffSession | null> {
  const s = await verifyStaffSession(
    (await cookies()).get(STAFF_COOKIE)?.value,
  );
  if (!s) return null;
  if (s.role === "rops" || roles.includes(s.role)) return s;
  return null;
}

export function StaffLoginPrompt({
  role,
  next,
}: {
  role: StaffRole;
  next: string;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Strefa pracownika</h1>
      <p className="mt-3 text-lg">
        Ta część platformy jest dostępna po zalogowaniu. W prototypie możesz
        wejść jednym kliknięciem jako {STAFF_ROLE_LABEL[role].toLowerCase()}.
      </p>
      <Link
        prefetch={false}
        href={`/api/demo-login?role=${role}&next=${encodeURIComponent(next)}`}
        className="bg-primary text-primary-foreground mt-6 inline-flex min-h-12 items-center rounded-md px-5 font-semibold no-underline"
      >
        Wejdź jako {STAFF_ROLE_LABEL[role].toLowerCase()} (demo)
      </Link>
      <p className="text-muted-foreground mt-4 text-sm">
        W wersji produkcyjnej: logowanie przez konto służbowe (SSO).
      </p>
    </div>
  );
}
