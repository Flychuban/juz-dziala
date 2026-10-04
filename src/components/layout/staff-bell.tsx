"use client";

import { BellIcon, BellRingIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { relativeAge } from "~/i18n/relative";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { SITE } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

/**
 * Staff notification bell: polls every 5 s (also in a background tab), shows
 * the unread count, puts „(N) Nowa sprawa · Już Działa" in the tab title and,
 * when the browser already allows it, raises a desktop notification for each
 * new item. Screen readers hear new items through a polite live region.
 */
export function StaffBell() {
  const hiddenSince = useRef(Date.now());
  const t = useTranslations("common.bell");
  const tt = useTranslations("common.time");
  const tc = useTranslations("common");
  const locale = useLocale();
  const BADGE_SUFFIX = `${t("tabBadge")} · ${SITE.name}`;
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  // 5 s while the tab is visible; 30 s in a background tab, so the tab title
  // still shows „(1) Nowa sprawa"; nothing after 30 min hidden (a forgotten tab
  // must not poll all night). Coming back to the tab refetches at once.
  const q = api.notifications.forStaff.useQuery(undefined, {
    refetchInterval: () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") return 5000;
      return Date.now() - hiddenSince.current > 30 * 60_000 ? false : 30_000;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const markRead = api.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.forStaff.invalidate(),
  });
  const markReadMutate = markRead.mutate;
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [live, setLive] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const unread = q.data?.unread ?? 0;

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenSince.current = Date.now();
      else void q.refetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Tab title badge. Next.js rewrites the title on navigation, so watch <head>.
  useEffect(() => {
    let base: string | null = null;
    const badge = `(${unread}) ${BADGE_SUFFIX}`;
    const apply = () => {
      const t = document.title;
      if (unread > 0) {
        if (t !== badge) {
          if (!/^\(\d+\) /.test(t)) base = t;
          document.title = badge;
        }
      } else if (/^\(\d+\) /.test(t) && t.endsWith(BADGE_SUFFIX)) {
        document.title = base ?? SITE.name;
      }
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      obs.disconnect();
      if (base && document.title === badge) document.title = base;
    };
  }, [unread, pathname, BADGE_SUFFIX]);

  // New items → live region + desktop notification (never on first load).
  useEffect(() => {
    if (!q.data) return;
    if (seen.current === null) {
      seen.current = new Set(q.data.items.map((i) => i.id));
      return;
    }
    const known = seen.current;
    const fresh = q.data.items.filter((i) => !i.readAt && !known.has(i.id));
    for (const i of q.data.items) known.add(i.id);
    if (!fresh.length) return;
    setLive(
      fresh.length === 1
        ? t("liveOne", { title: fresh[0]!.title })
        : t("liveMany", { count: fresh.length }),
    );
    if (permission !== "granted") return;
    for (const i of fresh.slice(0, 3)) {
      try {
        const n = new Notification(i.title, {
          body: i.body ?? undefined,
          tag: i.id,
          lang: locale,
        });
        n.onclick = () => {
          window.focus();
          if (i.href) router.push(i.href);
          markReadMutate({ ids: [i.id] });
          n.close();
        };
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
  }, [q.data, permission, router, markReadMutate, t, locale]);

  const allHref = q.data?.role === "expert" ? "/expert" : "/admin/cases";

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      {permission === "default" && (
        <button
          type="button"
          onClick={async () => {
            try {
              setPermission(await Notification.requestPermission());
            } catch {
              setPermission("denied");
            }
          }}
          className="border-input hover:bg-accent inline-flex min-h-12 max-w-full items-center rounded-md border px-3 text-left text-sm font-medium"
        >
          {t("enableDesktop")}
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "border-input hover:bg-accent inline-flex min-h-12 max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 text-left text-sm font-medium",
              unread > 0 && "border-primary border-2",
            )}
          >
            {unread > 0 ? (
              <BellRingIcon aria-hidden="true" className="size-4" />
            ) : (
              <BellIcon aria-hidden="true" className="size-4" />
            )}
            {t("title")}
            {unread > 0 ? (
              <span className="bg-primary text-primary-foreground inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-bold tabular-nums">
                {unread}
                <span className="sr-only"> {t("unreadSr", { count: unread })}</span>
              </span>
            ) : (
              <span className="sr-only">{t("noneNew")}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="border-hairline w-[min(24rem,calc(100vw-2rem))] gap-0 border p-0 shadow-none ring-0"
        >
          <div className="border-hairline flex items-center justify-between gap-2 border-b p-3">
            <p className="font-semibold">
              {unread > 0 ? t("titleWithCount", { count: unread }) : t("title")}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead.mutate({ all: true })}
                className="hover:bg-accent min-h-11 rounded-md px-2 text-sm underline"
              >
                {t("markAll")}
              </button>
            )}
          </div>
          {q.isPending ? (
            <p className="p-3">{tc("loading")}</p>
          ) : q.error ? (
            <p className="p-3">{t("loadError")}</p>
          ) : q.data.items.length === 0 ? (
            <p className="p-3">{t("empty")}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {q.data.items.map((i) => (
                <li
                  key={i.id}
                  className="border-hairline border-b last:border-0"
                >
                  <Link
                    href={i.href ?? allHref}
                    onClick={() => {
                      setOpen(false);
                      if (!i.readAt) markRead.mutate({ ids: [i.id] });
                    }}
                    className="hover:bg-accent flex min-h-12 flex-col gap-0.5 px-3 py-2 no-underline"
                  >
                    <span className="flex items-baseline gap-2 font-semibold">
                      {!i.readAt && (
                        <span className="text-brand-accent text-xs font-bold uppercase">
                          {t("new")}
                        </span>
                      )}
                      <span className="text-foreground">{i.title}</span>
                    </span>
                    {i.body && (
                      <span className="text-muted-foreground line-clamp-2 text-sm">
                        {i.body}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {relativeAge(i.createdAt, tt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-hairline border-t p-2">
            <Link
              href={allHref}
              onClick={() => setOpen(false)}
              className="hover:bg-accent flex min-h-11 items-center rounded-md px-2 text-sm font-medium"
            >
              {t("all")}
            </Link>
          </div>
        </PopoverContent>
      </Popover>
      <p aria-live="polite" role="status" className="sr-only">
        {live}
      </p>
    </div>
  );
}
