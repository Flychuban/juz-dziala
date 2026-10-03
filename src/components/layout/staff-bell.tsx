"use client";

import { BellIcon, BellRingIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ageLabel } from "~/components/cases/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { SITE } from "~/lib/domain";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const BADGE_SUFFIX = `Nowa sprawa · ${SITE.name}`;

/**
 * Staff notification bell: polls every 5 s (also in a background tab), shows
 * the unread count, puts „(N) Nowa sprawa · Już Działa" in the tab title and,
 * when the browser already allows it, raises a desktop notification for each
 * new item. Screen readers hear new items through a polite live region.
 */
export function StaffBell() {
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  const q = api.notifications.forStaff.useQuery(undefined, {
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
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
  }, [unread, pathname]);

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
        ? `Nowe powiadomienie: ${fresh[0]!.title}`
        : `Nowe powiadomienia: ${fresh.length}`,
    );
    if (permission !== "granted") return;
    for (const i of fresh.slice(0, 3)) {
      try {
        const n = new Notification(i.title, {
          body: i.body ?? undefined,
          tag: i.id,
          lang: "pl",
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
  }, [q.data, permission, router, markReadMutate]);

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
          className="border-input hover:bg-accent inline-flex min-h-11 max-w-full items-center rounded-md border px-3 text-left text-sm font-medium"
        >
          Włącz powiadomienia na pulpicie
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "border-input hover:bg-accent inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 text-left text-sm font-medium",
              unread > 0 && "border-primary border-2",
            )}
          >
            {unread > 0 ? (
              <BellRingIcon aria-hidden="true" className="size-4" />
            ) : (
              <BellIcon aria-hidden="true" className="size-4" />
            )}
            Powiadomienia
            {unread > 0 ? (
              <span className="bg-primary text-primary-foreground inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-bold tabular-nums">
                {unread}
                <span className="sr-only">
                  {" "}
                  {unread === 1 ? "nowe" : "nowych"}
                </span>
              </span>
            ) : (
              <span className="sr-only">(brak nowych)</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="border-hairline w-[min(24rem,calc(100vw-2rem))] gap-0 border p-0 shadow-none ring-0"
        >
          <div className="border-hairline flex items-center justify-between gap-2 border-b p-3">
            <p className="font-semibold">
              Powiadomienia{unread > 0 ? ` (${unread} nowe)` : ""}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead.mutate({ all: true })}
                className="hover:bg-accent min-h-11 rounded-md px-2 text-sm underline"
              >
                Oznacz wszystkie jako przeczytane
              </button>
            )}
          </div>
          {q.isPending ? (
            <p className="p-3">Wczytuję…</p>
          ) : q.error ? (
            <p className="p-3">Nie udało się wczytać powiadomień.</p>
          ) : q.data.items.length === 0 ? (
            <p className="p-3">Brak powiadomień.</p>
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
                          Nowe
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
                      {ageLabel(i.createdAt)}
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
              Wszystkie sprawy
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
