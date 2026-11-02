"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import { catchError, type ErrorInfo } from "next/error";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WidgetErrorProps = {
  /** Qué se intentó cargar, en minúscula: "los indicadores". */
  title: string;
  className?: string;
};

function WidgetError({ title, className }: WidgetErrorProps, { error, retry }: ErrorInfo) {
  return (
    <Card
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-danger/10 text-danger">
        <CircleAlert aria-hidden className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">No pudimos cargar {title}</p>
        <p className="text-sm text-muted-foreground">
          Puede ser un problema momentáneo. Probá de nuevo.
        </p>
        {process.env.NODE_ENV === "development" && error instanceof Error && (
          <p className="pt-1 font-mono text-xs text-muted-foreground">{error.message}</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        <RotateCw />
        Reintentar
      </Button>
    </Card>
  );
}

/** Error boundary por bloque: si un widget falla, el resto de la pantalla sigue andando. */
export const WidgetBoundary = catchError(WidgetError);

type AsyncWidgetProps = WidgetErrorProps & {
  /** Skeleton con la misma forma que el widget, para que nada salte al cargar. */
  fallback: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Envoltorio estándar para un Server Component que pide datos:
 * muestra el skeleton mientras carga y un error con "Reintentar" si falla.
 *
 *   <AsyncWidget title="los indicadores" fallback={<StatCardsSkeleton />}>
 *     <StatCards />
 *   </AsyncWidget>
 */
export function AsyncWidget({ title, className, fallback, children }: AsyncWidgetProps) {
  return (
    <WidgetBoundary title={title} className={className}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </WidgetBoundary>
  );
}
