"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type NavItem } from "~/config/nav";
import { cn } from "~/lib/utils";

/** The item whose href is the longest prefix of the current path ("/" only on "/"). */
export function activeHref(items: NavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    const hit =
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (hit && (!best || href.length > best.length)) best = href;
  }
  return best;
}

/**
 * Navigation links with aria-current="page" on the current section.
 * `layout="row"` for the desktop bar, `"stack"` for the phone menu panel.
 */
export function NavLinks({
  items,
  layout,
  size = "md",
  onNavigate,
}: {
  items: NavItem[];
  layout: "row" | "stack";
  size?: "md" | "sm";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = activeHref(items, pathname);
  return (
    <ul className={layout === "row" ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-1"}>
      {items.map((item) => {
        const active = item.href === current;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "text-foreground hover:bg-accent inline-flex min-h-12 items-center rounded-md px-3 no-underline",
                size === "sm" ? "text-sm" : "",
                layout === "stack" && "w-full border-b border-transparent px-3",
                active
                  ? "decoration-primary font-bold underline decoration-[3px] underline-offset-[0.4em]"
                  : "font-medium",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
