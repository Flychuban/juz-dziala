/** Navigation is generated from here; module agents never edit the shell. */
import { type Messages } from "~/i18n/messages";

/** A key of `common.nav` in messages/{pl,en}/common.json. */
export type NavKey = keyof Messages["common"]["nav"];
export type NavDef = { href: string; key: NavKey };
/** A resolved, translated link (what the client components render). */
export type NavItem = { href: string; label: string };

/** Residents: five items, plain words. */
export const PUBLIC_NAV: NavDef[] = [
  { href: "/", key: "home" },
  { href: "/library", key: "library" },
  { href: "/ideas/new", key: "ideas" },
  { href: "/knowledge", key: "knowledge" },
  { href: "/case", key: "case" },
];

/** Secondary links (footer). */
export const SECONDARY_NAV: NavDef[] = [
  { href: "/network", key: "network" },
  { href: "/test", key: "test" },
  { href: "/adapt", key: "adapt" },
  { href: "/municipality", key: "municipality" },
  { href: "/learn", key: "learn" },
  { href: "/methodology", key: "methodology" },
];

export const STAFF_NAV: NavDef[] = [
  { href: "/admin", key: "admin" },
  { href: "/admin/cases", key: "adminCases" },
  { href: "/admin/library", key: "adminLibrary" },
  { href: "/admin/calls", key: "adminCalls" },
  { href: "/admin/trends", key: "adminTrends" },
  { href: "/admin/ai", key: "adminAi" },
];

export const EXPERT_NAV: NavDef[] = [{ href: "/expert", key: "expert" }];

export const FOOTER_NAV: NavDef[] = [
  { href: "/accessibility", key: "accessibility" },
  { href: "/easy-read", key: "easyRead" },
  { href: "/sign-language", key: "signLanguage" },
  { href: "/about.txt", key: "aboutTxt" },
  { href: "/api/v1/innovations", key: "api" },
];

/** Resolves keys to labels with a `common.nav` translator. */
export function resolveNav(defs: NavDef[], t: (key: NavKey) => string): NavItem[] {
  return defs.map((d) => ({ href: d.href, label: t(d.key) }));
}
