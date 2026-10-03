import { EyeOffIcon } from "lucide-react";

import type { MessageAuthorKind } from "~/lib/domain";
import { cn } from "~/lib/utils";
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

function who(m: ThreadMessage, viewer: "author" | "staff"): string {
  switch (m.authorKind) {
    case "author":
      return viewer === "author" ? "Ty" : "Autor sprawy";
    case "rops":
      return m.authorName ?? TEAM;
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
}: {
  messages: ThreadMessage[];
  viewer: "author" | "staff";
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
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
