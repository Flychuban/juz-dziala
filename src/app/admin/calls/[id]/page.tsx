import { type Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { AdminHeader } from "~/components/admin/admin-header";
import { CallEditor, type CallForm } from "~/components/admin/call-editor";
import { Alert, AlertTitle } from "~/components/ui/alert";
import { api } from "~/trpc/server";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("admin.callPage");
  return { title: id === "new" ? t("metaNew") : t("metaEdit") };
}

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  const isNew = id === "new";
  const [call, subscribers, t, tc, locale] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : api.admin.calls.get({ id: decodeURIComponent(id) }),
    api.admin.calls.subscribers(),
    getTranslations("admin.callPage"),
    getTranslations("admin.calls"),
    getLocale(),
  ]);
  if (!isNew && !call) notFound();

  const initial: CallForm = call
    ? {
        id: call.id,
        name: call.name,
        program: call.program ?? "",
        operator: call.operator ?? "",
        amountMax: call.amountMax?.toString() ?? "",
        amountAvg: call.amountAvg?.toString() ?? "",
        windowFrom: call.windowFrom ?? "",
        windowTo: call.windowTo ?? "",
        status: call.status,
        eligibility: call.eligibility.join("\n"),
        areas: call.areas,
        sourceUrl: call.sourceUrl ?? "",
        notes: call.notes ?? "",
      }
    : {
        id: null,
        name: "",
        program: "",
        operator: "Regionalny Ośrodek Polityki Społecznej w Krakowie",
        amountMax: "",
        amountAvg: "",
        windowFrom: "",
        windowTo: "",
        status: "planned",
        eligibility: "",
        areas: [],
        sourceUrl: "",
        notes: "",
      };

  return (
    <>
      <AdminHeader
        title={call ? t("titleEdit") : t("titleNew")}
        breadcrumbs={[{ label: tc("title"), href: "/admin/calls" }]}
        lead={
          <>
            {call ? (
              <p lang={locale === "en" ? "pl" : undefined}>{call.name}</p>
            ) : (
              <p>{t("leadNew")}</p>
            )}
            {locale === "en" ? (
              <p className="mt-2 text-base">{t("englishNote")}</p>
            ) : null}
          </>
        }
      />
      <div className="mx-auto max-w-6xl px-4 py-10">
        {saved ? (
          <Alert variant="success" role="status" className="mb-8">
            <CheckCircle2Icon aria-hidden="true" />
            <AlertTitle>{t("saved")}</AlertTitle>
          </Alert>
        ) : null}
        <CallEditor initial={initial} subscribers={subscribers} />
      </div>
    </>
  );
}
