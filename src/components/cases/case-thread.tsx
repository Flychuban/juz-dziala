import { EyeOffIcon } from "lucide-react";

import type { MessageAuthorKind } from "~/lib/domain";
import { ReadAloud } from "~/components/kit";
import { cn } from "~/lib/utils";
import { RESIDENT_TEAM_NAME } from "~/server/cases/types";
import { fmtDateTime } from "./format";

export type ThreadMessage = {
  id: string;
  authorKind: MessageAuthorKind;
  authorName: string | null;
  body: string;
  createdAt: Date | string;
  visibleToAuthor?: boolean;
};

const TEAM = "Zespół Hubu ROPS";

/**
 * Plain text with its line breaks. Modules sometimes post a Markdown summary
 * (e.g. a submitted application); its „## Heading" lines are shown as bold
 * lines rather than raw hashes. Nothing else is interpreted.
 */
function MessageBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <p className="whitespace-pre-wrap">
      {lines.map((line, i) => {
        const h = /^#{1,6}\s+(.+)$/u.exec(line);
        return (
          <span key={i}>
            {h ? <strong className="font-bold">{h[1]}</strong> : line}
            {i < lines.length - 1 ? "\n" : null}
          </span>
        );
      })}
    </p>
  );
}

function who(m: ThreadMessage, viewer: "author" | "staff"): string {
  switch (m.authorKind) {
    case "author":
      return viewer === "author" ? "Ty" : "Autor sprawy";
    case "rops":
      return viewer === "author" ? RESIDENT_TEAM_NAME : (m.authorName ?? TEAM);
    case "expert":
      return m.authorName ?? "Ekspert Hubu";
    case "system":
      return viewer === "author" ? "Informacja" : "System";
  }
}

/**
 * The two-way thread. Author and staff are told apart by a visible name
 * line, side and border — never by colour alone. Internal notes (staff view
 * only) say so in words.
 */
export function CaseThread({
  messages,
  viewer,
  readAloud = false,
}: {
  messages: ThreadMessage[];
  viewer: "author" | "staff";
  /** „Czytaj na głos" under every ROPS/expert message. */
  readAloud?: boolean;
}) {
  if (!messages.length) {
    return <p className="text-muted-foreground">Brak wiadomości.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((m) => {
        const internal = m.visibleToAuthor === false;
        const mine =
          (viewer === "author" && m.authorKind === "author") ||
          (viewer === "staff" &&
            (m.authorKind === "rops" || m.authorKind === "expert"));
        return (
          <li
            key={m.id}
            id={`msg-${m.id}`}
            tabIndex={-1}
            className={cn(
              "rounded-md border p-4 break-words print:break-inside-avoid",
              m.authorKind === "system"
                ? "border-hairline text-muted-foreground border-dashed"
                : mine
                  ? "border-hairline bg-background border-l-primary border-l-4 sm:ml-10"
                  : "border-hairline bg-surface sm:mr-10",
              internal && "bg-warning-bg border-dashed",
            )}
          >
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                {who(m, viewer)}
                {viewer === "staff" && m.authorKind === "author" && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (mieszkaniec lub instytucja)
                  </span>
                )}
              </p>
              <time
                dateTime={new Date(m.createdAt).toISOString()}
                className="text-muted-foreground text-sm"
              >
                {fmtDateTime(m.createdAt)}
              </time>
            </div>
            {internal && (
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                <EyeOffIcon aria-hidden="true" className="size-4" />
                Notatka wewnętrzna — autor jej nie widzi
              </p>
            )}
            <MessageBody text={m.body} />
            {readAloud &&
              (m.authorKind === "rops" || m.authorKind === "expert") && (
                <div className="mt-2" data-no-print>
                  <ReadAloud
                    text={`${who(m, viewer)}: ${m.body.replace(/^#{1,6}\s+/gmu, "")}`}
                    label="Czytaj odpowiedź na głos"
                  />
                </div>
              )}
          </li>
        );
      })}
    </ol>
  );
}
