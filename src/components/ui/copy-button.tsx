"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  /** Nombre accesible del botón. */
  label?: string;
  /** Título del aviso al copiar. */
  successMessage?: string;
  className?: string;
};

/** Copia un texto al portapapeles y lo confirma con un toast. */
export function CopyButton({
  value,
  label = "Copiar",
  successMessage = "Copiado al portapapeles",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const pendingTimer = timer;
    return () => clearTimeout(pendingTimer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage, { description: value });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar", { description: "Copialo manualmente." });
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={copy}
      aria-label={label}
      className={cn(copied && "text-success hover:text-success", className)}
    >
      <Icon aria-hidden />
    </Button>
  );
}
