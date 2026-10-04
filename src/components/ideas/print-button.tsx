"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

/** „Drukuj" for a server page (the label comes from the page's messages). */
export function PrintButton({ label, variant = "default" }: { label: string; variant?: "default" | "outline" }) {
  return (
    <Button type="button" variant={variant} onClick={() => window.print()}>
      <PrinterIcon aria-hidden="true" />
      {label}
    </Button>
  );
}
