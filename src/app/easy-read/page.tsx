import { type Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader, ReadAloud } from "~/components/kit";
import { MESSAGES } from "~/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.easyRead");
  return { title: t("metaTitle") };
}

/** Easy-to-read sections: short sentences, one idea per line (messages/<lang>/legal.json). */
export default async function EasyReadPage() {
  const [t, locale] = await Promise.all([
    getTranslations("legal.easyRead"),
    getLocale(),
  ]);
  // Plain sentences without ICU arguments, read in file order.
  const sections = Object.entries(MESSAGES[locale].legal.easyRead.sections).map(
    ([key, s]) => ({ key, h: s.h, p: Object.values<string>(s.lines) }),
  );
  const all = sections.flatMap((s) => [s.h, ...s.p]).join(" ");
  return (
    <>
      <PageHeader
        width="narrow"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      >
        <ReadAloud text={all} />
      </PageHeader>
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-10">
        {sections.map((s) => (
          <section key={s.key}>
            <h2 className="text-2xl font-bold">{s.h}</h2>
            <ul className="mt-3 space-y-2 text-xl leading-relaxed">
              {s.p.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xl">
          <Link href="/" className="font-semibold">
            {t("home")}
          </Link>
        </p>
      </div>
    </>
  );
}
