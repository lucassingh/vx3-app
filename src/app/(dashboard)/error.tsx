"use client";

import { RotateCw } from "lucide-react";
import { PageBody } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

/** Error inesperado en una pantalla (los widgets tienen su propio boundary). */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <PageBody className="grid min-h-[calc(100dvh-3.5rem)] place-items-center">
      <div role="alert" className="max-w-md text-center">
        <p className="font-mono text-sm text-muted-foreground">Error</p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">
          Algo salió mal al cargar esta pantalla
        </h1>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">
          Probá de nuevo en unos segundos. Si el problema sigue, compartí este código con
          soporte: <span className="font-mono">{error.digest ?? "sin código"}</span>
        </p>
        <Button className="mt-6" onClick={() => retry()}>
          <RotateCw />
          Reintentar
        </Button>
      </div>
    </PageBody>
  );
}
