import { type Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "~/components/kit";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.signLanguage");
  return { title: t("metaTitle") };
}

/** Required by the ustawa o zapewnianiu dostępności (art. 6 pkt 3 lit. c). Recording to be made by a PJM interpreter. */
export default async function SignLanguagePage() {
  const t = await getTranslations("legal.signLanguage");
  return (
    <>
      <PageHeader
        width="narrow"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-lg">
        <div
          role="img"
          aria-label={t("placeholderLabel")}
          className="border-input bg-surface text-muted-foreground flex aspect-video items-center justify-center rounded-md border-2 border-dashed p-6 text-center"
        >
          {t("placeholder")}
        </div>
        <p>
          {t.rich("meanwhile", {
            easy: (chunks) => <Link href="/easy-read">{chunks}</Link>,
            ask: (chunks) => <Link href="/network">{chunks}</Link>,
          })}
        </p>
      </div>
    </>
  );
}
