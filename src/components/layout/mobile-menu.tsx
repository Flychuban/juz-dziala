"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { type NavItem } from "~/config/nav";
import { cn } from "~/lib/utils";
import { NavLinks } from "./nav-links";

/**
 * „Menu" for phones (hidden from md up): a native <details> disclosure, so it
 * opens even before JavaScript loads. The panel drops below the header row and
 * holds the main navigation, the staff links (when signed in) and the
 * demo-mode switcher (children). Closes on navigation and on Escape, returning
 * focus to „Menu".
 */
export function MobileMenu({
  items,
  staffItems,
  staffLabel,
  children,
  className,
}: {
  items: NavItem[];
  staffItems: NavItem[];
  staffLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common.header");
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = ref.current;
      if (e.key === "Escape" && d?.open) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    if (ref.current) ref.current.open = false;
  };

  return (
    <details ref={ref} className={cn("group", className)}>
      <summary className="border-input bg-background text-foreground hover:bg-accent group-open:bg-accent inline-flex min-h-12 shrink-0 cursor-pointer list-none items-center gap-2 rounded-md border px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <MenuIcon aria-hidden="true" className="size-5 group-open:hidden" />
        <XIcon aria-hidden="true" className="hidden size-5 group-open:block" />
        {t("menu")}
      </summary>
      <div className="border-hairline bg-background absolute inset-x-0 top-full z-40 border-y px-4 pt-3 pb-4">
        <nav aria-label={t("mainNav")}>
          <NavLinks items={items} layout="stack" onNavigate={close} />
        </nav>
        {staffItems.length > 0 ? (
          <nav aria-label={t("staffNav")} className="border-hairline mt-3 border-t pt-3">
            {staffLabel ? <p className="text-muted-foreground px-3 pb-1 text-sm font-semibold">{staffLabel}</p> : null}
            <NavLinks items={staffItems} layout="stack" onNavigate={close} />
          </nav>
        ) : null}
        {children ? <div className="border-hairline mt-3 border-t px-3 pt-4">{children}</div> : null}
      </div>
    </details>
  );
}
