import { Pulpit } from "~/components/cases/staff/pulpit";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = { title: "Pulpit" };

export default async function Page() {
  await api.admin.inbox.stats.prefetch();
  return (
    <HydrateClient>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Panel Hubu
        </p>
        <h1 className="mt-1 text-3xl font-bold">Pulpit</h1>
        <p className="mt-2 max-w-prose">
          Nowe sprawy pojawiają się tu same. O każdej informuje też dzwonek
          „Powiadomienia” u góry strony i licznik w tytule karty przeglądarki.
        </p>
        <div className="mt-8">
          <Pulpit />
        </div>
      </div>
    </HydrateClient>
  );
}
