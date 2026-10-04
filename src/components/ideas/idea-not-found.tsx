import { useTranslations } from "next-intl";
import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";

import { EmptyState, PageHeader } from "~/components/kit";
import { Button } from "~/components/ui/button";

/** Shown by the idea sub-pages when the code does not open an idea Sprawa. */
export function IdeaNotFound({ title, message }: { title: string; message: string }) {
  const t = useTranslations("ideas.notFound");
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={title} breadcrumbs={[{ label: t("crumb"), href: "/ideas/new" }]} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState
          icon={<FileQuestionIcon />}
          title={t("title")}
          description={<p>{message}</p>}
          action={
            <>
              <Button asChild variant="secondary">
                <Link href="/case">{t("enterCode")}</Link>
              </Button>
              <Button asChild>
                <Link href="/ideas/new">{t("newIdea")}</Link>
              </Button>
            </>
          }
        />
      </div>
    </>
  );
}
