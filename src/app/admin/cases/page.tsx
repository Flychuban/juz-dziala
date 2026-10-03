import { Suspense } from "react";

import { InboxList } from "~/components/cases/staff/inbox-list";

export const metadata = { title: "Sprawy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold">Sprawy</h1>
      <p className="mt-2 max-w-prose">
        Potrzeby, pomysły, pytania, zgłoszenia do testów, opinie i wnioski o
        wdrożenie — wszystko w jednej skrzynce. Lista odświeża się sama.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p role="status">Wczytuję sprawy…</p>}>
          <InboxList basePath="/admin/cases" />
        </Suspense>
      </div>
    </div>
  );
}
