"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

export function PrintButton({ label = "Drukuj" }: { label?: string }) {
  return (
    <Button
      type="button"
      className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
      onClick={() => window.print()}
    >
      <PrinterIcon aria-hidden="true" />
      {label}
    </Button>
  );
}
