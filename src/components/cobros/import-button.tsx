"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

/** Importa un archivo (extracto del banco, export de Zupply) y lo confirma con un aviso. */
export function ImportButton({
  label,
  accept = ".csv,.xls,.xlsx",
  successTitle,
  successDescription,
  variant = "outline",
}: {
  label: string;
  accept?: string;
  successTitle: string;
  successDescription: string;
  variant?: "outline" | "primary";
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          toast.success(successTitle, { description: `${file.name} · ${successDescription}` });
          event.target.value = "";
        }}
      />
      <Button variant={variant} size="sm" onClick={() => input.current?.click()}>
        <Upload />
        {label}
      </Button>
    </>
  );
}
