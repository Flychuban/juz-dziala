import * as React from "react";
import { cn } from "cn";

/**
 * Table — hairline rows, a surface-coloured header and tabular figures.
 * Cells wrap (no forced nowrap) so a table reflows at 360 px; the container
 * scrolls horizontally only when a table genuinely cannot fit. Give every
 * data table a <TableCaption>. Use `className="text-right"` on numeric cells.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="border-hairline relative w-full overflow-x-auto rounded-md border"
    >
      <table
        data-slot="table"
        className={cn(
          "tabular w-full caption-top border-collapse text-base",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-surface [&_tr]:border-hairline [&_tr]:border-b",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-hairline bg-surface border-t font-semibold [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-hairline hover:bg-surface has-aria-expanded:bg-surface data-[state=selected]:bg-accent border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground px-4 py-3 text-left align-bottom text-[0.9375rem] leading-snug font-semibold [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-top leading-snug [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        "border-hairline text-foreground border-b px-4 py-3 text-left font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
