"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

export function PrintButton({ label = "Drukuj" }: { label?: string }) {
  return (
    <Button
      type="button"
      className="min-h-12 px-5 text-base"
      onClick={() => window.print()}
    >
      <PrinterIcon aria-hidden="true" />
      {label}
    </Button>
  );
}
