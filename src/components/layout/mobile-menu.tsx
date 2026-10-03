"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";

import { type NavItem } from "~/config/nav";
import { cn } from "~/lib/utils";
import { NavLinks } from "./nav-links";

/**
 * „Menu" for phones (hidden from md up): one 48 px disclosure button that
 * opens the main navigation, the staff panel links (when signed in) and the
 * demo-mode switcher (passed as children). Closes on navigation and Escape,
 * returning focus to the button.
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border-input bg-background text-foreground hover:bg-accent inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md border px-4 font-semibold aria-expanded:bg-accent",
          className,
        )}
      >
        {open ? (
          <XIcon aria-hidden="true" className="size-5" />
        ) : (
          <MenuIcon aria-hidden="true" className="size-5" />
        )}
        Menu
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="border-hairline basis-full border-t pt-3 pb-1 md:hidden"
      >
        <nav aria-label="Główna nawigacja">
          <NavLinks items={items} layout="stack" onNavigate={() => setOpen(false)} />
        </nav>
        {staffItems.length > 0 ? (
          <nav aria-label="Panel pracownika" className="border-hairline mt-3 border-t pt-3">
            {staffLabel ? <p className="text-muted-foreground px-3 pb-1 text-sm font-semibold">{staffLabel}</p> : null}
            <NavLinks items={staffItems} layout="stack" onNavigate={() => setOpen(false)} />
          </nav>
        ) : null}
        {children ? <div className="border-hairline mt-3 border-t px-3 pt-4">{children}</div> : null}
      </div>
    </>
  );
}
