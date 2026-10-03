"use client";

import Link from "next/link";

/**
 * Staff notification bell. Contract placeholder — the Sprawy agent implements
 * polling (refetchInterval 5 s), the unread badge, the tab-title badge
 * „(1) Nowa sprawa" and desktop notifications.
 */
export function StaffBell() {
  return (
    <Link
      href="/admin/cases"
      className="border-input inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium no-underline"
    >
      Powiadomienia
    </Link>
  );
}
