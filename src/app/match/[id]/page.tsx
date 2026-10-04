import { TRPCError } from "@trpc/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { MatchResults } from "~/components/match/match-results";
import { api } from "~/trpc/server";

export async function generateMetadata() {
  const t = await getTranslations("match.meta");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let view;
  try {
    view = await api.match.get({ runId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 [overflow-wrap:anywhere]">
      <MatchResults runId={id} initial={view} />
    </div>
  );
}
