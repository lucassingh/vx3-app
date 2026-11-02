import { ArrowRight, History, ListChecks, TriangleAlert } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { EmptyState } from "@/components/kit/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { formatDate } from "@/lib/format";
import { ReglasEditor, type ReglaLabels } from "./reglas-editor";
import { CodeTag, cuando } from "./shared";

/* ---- Resumen ---------------------------------------------------------------- */

export async function ReglasResumen() {
  const [reglas, historial] = await Promise.all([
    api.plataforma.reglas.list(),
    api.plataforma.reglas.historial(),
  ]);
  const aConfirmar = reglas.filter((regla) => regla.aConfirmar || regla.nota).length;
  const ultimo = historial[0];

  return (
    <KpiGrid
      columns={3}
      label="Resumen de las reglas"
      icons={{ total: ListChecks, confirmar: TriangleAlert, cambios: History }}
      items={[
        {
          id: "total",
          label: "Reglas configurables",
          value: reglas.length,
          format: "number",
          hint: "Las lee el bot y cada módulo: ninguna está en el código",
        },
        {
          id: "confirmar",
          label: "Valores a confirmar con VX3",
          value: aConfirmar,
          format: "number",
          hint: "Tarifa diferencial (Q-90) y tabla de zonas (Q-40)",
        },
        {
          id: "cambios",
          label: "Cambios en los últimos 30 días",
          value: historial.length,
          format: "number",
          hint: ultimo ? `El último, ${cuando(ultimo.en)} por ${ultimo.por}` : "Sin cambios todavía",
        },
      ]}
    />
  );
}

export function ReglasResumenSkeleton() {
  return <KpiGridSkeleton count={3} columns={3} />;
}

/* ---- Editor ----------------------------------------------------------------- */

export async function ReglasEditorCard() {
  const reglas = await api.plataforma.reglas.list();
  const labels: ReglaLabels = Object.fromEntries(
    reglas.map((regla) => [
      regla.id,
      {
        ultimo: `${cuando(regla.actualizadoEn)} · ${regla.actualizadoPor}`,
        vigencia: formatDate(regla.vigenciaDesde, { day: "numeric", month: "short" }),
      },
    ]),
  );
  return <ReglasEditor initialReglas={reglas} initialLabels={labels} />;
}

export function ReglasEditorSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingLabel>Cargando reglas…</LoadingLabel>
      <Skeleton className="h-9 w-full max-w-3xl rounded-lg" />
      <CardSkeleton>
        <SkeletonText lines={8} />
      </CardSkeleton>
    </div>
  );
}

/* ---- Historial -------------------------------------------------------------- */

const COLUMNS = ["Regla", "Cambio", "Quién", "Cuándo"];

function HistorialFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card id="historial" className="scroll-mt-20 overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Historial de cambios</CardTitle>
          <CardDescription>Cada cambio queda con el valor anterior, el nuevo y quién lo hizo</CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function HistorialReglas() {
  const historial = await api.plataforma.reglas.historial();

  return (
    <HistorialFrame>
      {historial.length === 0 ? (
        <EmptyState icon={History} title="Todavía no hay cambios" />
      ) : (
        <Table className="min-w-2xl">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {historial.map((cambio) => (
              <TableRow key={cambio.id}>
                <TableCell>
                  <p className="font-medium">{cambio.nombre}</p>
                  <CodeTag className="mt-1">{cambio.codigo}</CodeTag>
                </TableCell>
                <TableCell>
                  <span className="inline-flex flex-wrap items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground">
                      <span className="sr-only">Antes: </span>
                      {cambio.antes}
                    </span>
                    <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      <span className="sr-only">Después: </span>
                      {cambio.despues}
                    </span>
                  </span>
                </TableCell>
                <TableCell>{cambio.por}</TableCell>
                <TableCell className="text-muted-foreground first-letter:uppercase">
                  <time dateTime={cambio.en}>{cuando(cambio.en)}</time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </HistorialFrame>
  );
}

export function HistorialReglasSkeleton() {
  return (
    <HistorialFrame>
      <LoadingLabel>Cargando historial…</LoadingLabel>
      <TableSkeleton columns={COLUMNS} rows={5} className="min-w-2xl" />
    </HistorialFrame>
  );
}
