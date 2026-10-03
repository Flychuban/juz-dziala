import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";

import { EmptyState, PageHeader } from "~/components/kit";
import { Button } from "~/components/ui/button";

/** Shown by the idea sub-pages when the code does not open an idea Sprawa. */
export function IdeaNotFound({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHeader eyebrow="Kreator pomysłów" title={title} breadcrumbs={[{ label: "Mam pomysł", href: "/ideas/new" }]} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState
          icon={<FileQuestionIcon />}
          title="Nie możemy otworzyć tego pomysłu"
          description={<p>{message}</p>}
          action={
            <>
              <Button asChild variant="secondary">
                <Link href="/case">Wpisz kod sprawy</Link>
              </Button>
              <Button asChild>
                <Link href="/ideas/new">Zgłoś nowy pomysł</Link>
              </Button>
            </>
          }
        />
      </div>
    </>
  );
}
