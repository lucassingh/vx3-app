import { PageBody, PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/*
 * Presets de skeleton para las estructuras típicas de un dashboard. Combinalos
 * para que el estado de carga tenga la misma forma que el contenido final.
 * Regla: el texto fijo (títulos, encabezados) se muestra real; solo los datos
 * van como skeleton.
 */

/** Anchos fijos (no aleatorios) para que server y cliente rendericen igual. */
const widths = ["w-11/12", "w-4/5", "w-3/5", "w-2/3", "w-3/4"];

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/5" : widths[index % widths.length])}
        />
      ))}
    </div>
  );
}

/** Card genérica: título, bajada y contenido. */
export function CardSkeleton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children ?? <SkeletonText />}</CardContent>
    </Card>
  );
}

/** Grilla de KPIs: etiqueta, valor y variación. */
export function StatGridSkeleton({
  count = 4,
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-3 h-3.5 w-40" />
        </Card>
      ))}
    </div>
  );
}

/** Gráfico de columnas. */
export function ChartSkeleton({ bars = 30, className }: { bars?: number; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-60 items-end gap-2 pl-8", className)}>
      {Array.from({ length: bars }, (_, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-b-none"
          style={{ height: `${30 + ((index * 37) % 60)}%` }}
        />
      ))}
    </div>
  );
}

/** Lista de barras horizontales con etiqueta y valor. */
export function BarListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-1.5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Tabla: muestra los encabezados reales y filas de carga. La primera columna
 * lleva avatar y dos líneas; la última, un botón.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  className,
}: {
  columns: string[];
  rows?: number;
  /** Mismas clases que la tabla real (ej. su ancho mínimo). */
  className?: string;
}) {
  return (
    <Table aria-hidden className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column, index) => (
            <TableHead key={`${column}-${index}`}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={row}>
            {columns.map((column, index) => (
              <TableCell key={`${column}-${index}`}>
                {index === 0 ? (
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ) : index === columns.length - 1 && column === "" ? (
                  <Skeleton className="ml-auto h-8 w-16" />
                ) : (
                  <Skeleton className={cn("h-3.5", index % 2 ? "w-20" : "w-28")} />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Pantalla completa: header + KPIs + card. La usa (dashboard)/loading.tsx. */
export function PageSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando pantalla…</LoadingLabel>
      <PageHeaderSkeleton />
      <PageBody>
        <StatGridSkeleton />
        <CardSkeleton>
          <SkeletonText lines={5} />
        </CardSkeleton>
      </PageBody>
    </>
  );
}
