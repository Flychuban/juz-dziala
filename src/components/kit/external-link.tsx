import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * ExternalLink — a link that opens in a new tab and says so: a visible icon
 * plus „(otwiera się w nowej karcie)" for screen readers.
 *
 * @param href       Absolute URL.
 * @param showIcon   Hide the icon when the context already makes it obvious.
 */
export function ExternalLink({
  href,
  children,
  className,
  showIcon = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  const t = useTranslations("common.kit");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "underline decoration-1 underline-offset-4 hover:decoration-2",
        className,
      )}
    >
      {children}
      {showIcon ? (
        <ExternalLinkIcon
          aria-hidden="true"
          className="ml-1 inline-block size-[0.9em] -translate-y-px align-middle"
        />
      ) : null}
      <span className="sr-only"> {t("newTab")}</span>
    </a>
  );
}
