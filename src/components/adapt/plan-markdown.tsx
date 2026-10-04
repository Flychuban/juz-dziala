"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "~/lib/utils";

/**
 * The Ramowy Plan Wdrożenia rendered from Markdown with the site's type
 * scale (no typography plugin). Re-renders as the stream grows. Headings
 * start at h2 inside the page: the plan's own `#` title becomes an h2 and
 * its sections h3, under the page's single h1.
 */
const makeComponents = (labels: {
  table: string;
  newWindow: string;
}): Components => ({
  h1: ({ children }) => (
    <h2 className="font-display text-2xl leading-tight font-bold tracking-tight md:text-3xl print:text-[18pt]">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="font-display border-hairline mt-10 border-t pt-6 text-xl leading-tight font-bold tracking-tight md:text-2xl print:mt-6 print:break-after-avoid print:pt-3 print:text-[14pt]">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-display mt-6 text-lg font-bold print:break-after-avoid">
      {children}
    </h4>
  ),
  h4: ({ children }) => <h5 className="mt-4 font-bold">{children}</h5>,
  p: ({ children }) => <p className="mt-3 max-w-[72ch]">{children}</p>,
  ul: ({ children }) => (
    <ul className="marker:text-primary mt-3 max-w-[72ch] list-disc space-y-1.5 pl-6">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="marker:text-primary mt-3 max-w-[72ch] list-decimal space-y-1.5 pl-6">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-primary bg-surface mt-3 max-w-[72ch] border-l-4 px-4 py-2 print:bg-transparent [&>p]:mt-2 [&>p:first-child]:mt-0">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    // A wide table scrolls sideways on a phone: the region takes focus so
    // the keyboard can scroll it too (WCAG 2.1.1).
    <div
      role="region"
      aria-label={labels.table}
      tabIndex={0}
      className="border-hairline mt-4 overflow-x-auto rounded-md border print:overflow-visible"
    >
      <table className="tabular w-full border-collapse text-left text-[0.9375rem] print:text-[10pt]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
  tr: ({ children }) => (
    <tr className="border-hairline border-b last:border-0 print:break-inside-avoid">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th scope="col" className="px-3 py-2 align-top font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
  hr: () => <hr className="border-hairline my-8" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer nofollow"
      className="text-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
    >
      {children}
      <span className="sr-only"> {labels.newWindow}</span>
    </a>
  ),
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
});

export function PlanMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const t = useTranslations("adapt.markdown");
  const table = t("table");
  const newWindow = t("newWindow");
  const components = useMemo(
    () => makeComponents({ table, newWindow }),
    [table, newWindow],
  );
  return (
    <div className={cn("text-base leading-relaxed", className)}>
      {/* The plan text is client-supplied (the Middleman sends it): untrusted.
          No images (no tracking pixels or remote loads); raw HTML is never
          rendered (react-markdown default) and link URLs are sanitised. */}
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
        disallowedElements={["img"]}
        unwrapDisallowed
      >
        {markdown}
      </Markdown>
    </div>
  );
}
