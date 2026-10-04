import { eq } from "drizzle-orm";
import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CaseWorkspace } from "~/components/cases/staff/case-workspace";
import { InboxList } from "~/components/cases/staff/inbox-list";
import { inboxInput } from "~/components/cases/staff/labels";
import { SampleBadge } from "~/components/kit";
import { requireStaff } from "~/components/layout/staff-gate";
import { personTitle } from "~/server/cases/sample-people";
import { db } from "~/server/db";
import { people } from "~/server/db/schema";
import { normalizeCaseCode } from "~/server/domain/case-code";
import { api, HydrateClient } from "~/trpc/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.expert");
  return { title: t("metaTitle") };
}

/** The signed-in expert, so the page says whose cases these are. */
async function signedInPerson() {
  const staff = await requireStaff(["expert"]);
  if (staff?.role !== "expert") return null;
  const [p] = await db
    .select({
      id: people.id,
      displayName: people.displayName,
      title: people.title,
      isSample: people.isSample,
    })
    .from(people)
    .where(eq(people.id, staff.personId));
  return p ?? null;
}

/** An expert's cases: the list, or one case with ?code=JD-…. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? normalizeCaseCode(sp.code) : null;
  if (code) {
    await api.admin.inbox.get.prefetch({ code });
    return (
      <HydrateClient>
        <CaseWorkspace code={code} basePath="/expert" />
      </HydrateClient>
    );
  }
  const input = inboxInput((k) => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  });
  const [t, locale, me] = await Promise.all([
    getTranslations("admin.expert"),
    getLocale(),
    signedInPerson(),
    // The expert's cases arrive with the HTML, not after a spinner.
    api.admin.inbox.list.prefetch(input),
  ]);
  const title = me ? personTitle(me, locale) : null;
  return (
    <HydrateClient>
      <div className="mx-auto max-w-6xl px-4 py-8 [overflow-wrap:anywhere]">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        {me && (
          <p className="mt-2 flex flex-wrap items-center gap-2 font-semibold">
            {title
              ? t("signedInAs", { name: me.displayName, title })
              : me.displayName}
            {me.isSample && <SampleBadge />}
          </p>
        )}
        <p className="mt-2 max-w-prose">{t("lead")}</p>
        <div className="mt-6">
          <Suspense fallback={<p role="status">{t("loading")}</p>}>
            <InboxList basePath="/expert" />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
