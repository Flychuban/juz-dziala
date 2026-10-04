import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common.notFound");
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-lg">{t("body")}</p>
      <Link href="/" className="mt-6 inline-flex min-h-12 items-center font-semibold">
        {t("home")}
      </Link>
    </div>
  );
}
