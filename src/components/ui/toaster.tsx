"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/hooks/use-theme";

/**
 * Contenedor de toasts, montado una vez en el root layout. Usa los tokens del
 * tema; los ajustes finos de estilo están en globals.css. Para disparar avisos:
 * `import { toast } from "@/lib/toast"`.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme ?? "light"}
      position="bottom-right"
      containerAriaLabel="Avisos"
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        error: <CircleAlert className="size-4 text-danger" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        info: <Info className="size-4 text-muted-foreground" />,
        loading: <LoaderCircle className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
    />
  );
}
