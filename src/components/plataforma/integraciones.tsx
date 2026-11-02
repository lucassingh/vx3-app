import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
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
import type { SyncLogEntry } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { IntegracionCard, ProbarTodas } from "./integracion-card";
import { cuando } from "./shared";

/* ---- Resumen ---------------------------------------------------------------- */

export async function IntegracionesResumen() {
  const integraciones = await api.plataforma.integraciones.list();
  const ok = integraciones.filter((item) => item.estado === "ok");
  const avisos = integraciones.filter((item) => item.estado === "degradado" || item.estado === "caido");
  const pendientes = integraciones.filter((item) => item.estado === "pendiente");

  return (
    <KpiGrid
      columns={3}
      label="Estado de las integraciones"
      icons={{ ok: CircleCheck, avisos: TriangleAlert, pendientes: Clock }}
      items={[
        { id: "ok", label: "Funcionando", value: ok.length, format: "number", hint: `de ${integraciones.length} conexiones` },
        {
          id: "avisos",
          label: "Con demoras o caídas",
          value: avisos.length,
          format: "number",
          hint: avisos.length ? avisos.map((item) => item.nombre).join(" · ") : "Todo al día",
        },
        {
          id: "pendientes",
          label: "Pendientes",
          value: pendientes.length,
          format: "number",
          hint: pendientes.length ? pendientes.map((item) => item.nombre).join(" · ") : "Ninguna",
        },
      ]}
    />
  );
}

export function IntegracionesResumenSkeleton() {
  return <KpiGridSkeleton count={3} columns={3} />;
}

/** Acción del header: necesita la lista para probar todas. Si la API falla, queda deshabilitada. */
export async function ProbarTodasLoader() {
  const integraciones = await api.plataforma.integraciones.list().catch(() => []);
  return (
    <ProbarTodas
      integraciones={integraciones
        .filter((item) => !item.importa)
        .map(({ id, nombre }) => ({ id, nombre }))}
    />
  );
}

/* ---- Tarjetas --------------------------------------------------------------- */

const gridClass = "grid gap-6 md:grid-cols-2 2xl:grid-cols-3";

export async function IntegracionesGrid() {
  const integraciones = await api.plataforma.integraciones.list();

  return (
    <section aria-label="Integraciones" className={gridClass}>
      {integraciones.map((integracion) => (
        <IntegracionCard
          key={integracion.id}
          integracion={integracion}
          labels={{
            ultimoSync: integracion.ultimoSync ? cuando(integracion.ultimoSync) : "Nunca",
            credencial: integracion.credencial
              ? `${integracion.credencial.cargadaPor} · ${cuando(integracion.credencial.cargadaEn)}`
              : null,
          }}
        />
      ))}
    </section>
  );
}

export function IntegracionesGridSkeleton() {
  return (
    <div className={gridClass}>
      <LoadingLabel>Cargando integraciones…</LoadingLabel>
      {Array.from({ length: 6 }, (_, index) => (
        <CardSkeleton key={index}>
          <SkeletonText lines={5} />
        </CardSkeleton>
      ))}
    </div>
  );
}

/* ---- Log -------------------------------------------------------------------- */

const RESULTADO: Record<SyncLogEntry["resultado"], { label: string; variant: "success" | "warning" | "danger" }> = {
  ok: { label: "OK", variant: "success" },
  reintento: { label: "Reintentado", variant: "warning" },
  error: { label: "Error", variant: "danger" },
};

const LOG_COLUMNS = ["Operación", "Resultado", "Detalle", "Duración", "Cuándo"];

const duracion = (ms: number) =>
  ms < 1_000 ? `${formatNumber(ms)} ms` : `${formatNumber(ms / 1_000, { maximumFractionDigits: 1 })} s`;

function LogFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Registro de sincronizaciones</CardTitle>
          <CardDescription>
            Las últimas operaciones con cada sistema. Lo que falla se reintenta solo, con una referencia propia para no duplicar.
          </CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function SyncLog() {
  const log = await api.plataforma.integraciones.log();

  return (
    <LogFrame>
      <Table className="min-w-3xl">
        <TableHeader>
          <TableRow>
            {LOG_COLUMNS.map((column, index) => (
              <TableHead key={column} className={index === 3 ? "text-right" : undefined}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {log.map((entrada) => (
            <TableRow key={entrada.id}>
              <TableCell>
                <p className="font-medium">{entrada.operacion}</p>
                <p className="text-xs text-muted-foreground">{entrada.integracion}</p>
              </TableCell>
              <TableCell>
                <Badge variant={RESULTADO[entrada.resultado].variant} dot>
                  {RESULTADO[entrada.resultado].label}
                </Badge>
              </TableCell>
              <TableCell className="max-w-80 text-muted-foreground">{entrada.detalle}</TableCell>
              <TableCell className="text-right tabular-nums">{duracion(entrada.duracionMs)}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground first-letter:uppercase">
                <time dateTime={entrada.en}>{cuando(entrada.en)}</time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </LogFrame>
  );
}

export function SyncLogSkeleton() {
  return (
    <LogFrame>
      <LoadingLabel>Cargando el registro…</LoadingLabel>
      <TableSkeleton columns={LOG_COLUMNS} rows={6} className="min-w-3xl" />
    </LogFrame>
  );
}
