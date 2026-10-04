"use client";

import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";

export function PrintButton({ label }: { label?: string }) {
  const t = useTranslations("cases.print");
  return (
    <Button
      type="button"
      className="h-auto min-h-12 max-w-full px-5 text-base whitespace-normal"
      onClick={() => window.print()}
    >
      <PrinterIcon aria-hidden="true" />
      {label ?? t("print")}
    </Button>
  );
}
