import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { connection } from "next/server";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { formatNumber } from "@/lib/format";
import { usaCredencial, type IntegracionConCredencial } from "@/modules/platform/credentials/integraciones";
import {
  listarIntegraciones,
  registroDeSincronizaciones,
  type FilaDelRegistro,
} from "@/modules/platform/integraciones/service";
import { IntegracionCard, ProbarTodas } from "./integracion-card";
import { cuando } from "./shared";

/* ---- Resumen ---------------------------------------------------------------- */

export async function IntegracionesResumen() {
  // Con cacheComponents, sin esto Next intentaría resolverlo en el build.
  await connection();
  const integraciones = await listarIntegraciones();
  const ok = integraciones.filter((item) => item.estado === "ok");
  const avisos = integraciones.filter((item) => item.estado === "degradado" || item.estado === "caido");
  const pendientes = integraciones.filter((item) => item.estado === "pendiente");

  return (
    <KpiGrid
      columns={3}
      label="Estado de las integraciones"
      icons={{ ok: CircleCheck, avisos: TriangleAlert, pendientes: Clock }}
      items={[
        {
          id: "ok",
          label: "Funcionando",
          value: ok.length,
          format: "number",
          hint: `de ${integraciones.length} conexiones`,
        },
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
          hint: pendientes.length ? "Todavía sin conectar" : "Ninguna",
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
  await connection();
  const integraciones = await listarIntegraciones().catch(() => []);
  const conectadas = integraciones.flatMap(({ id, nombre }) =>
    usaCredencial(id) ? [{ id: id as IntegracionConCredencial, nombre }] : [],
  );
  return <ProbarTodas integraciones={conectadas} />;
}

/* ---- Tarjetas --------------------------------------------------------------- */

const gridClass = "grid gap-6 md:grid-cols-2 2xl:grid-cols-3";

export async function IntegracionesGrid() {
  await connection();
  const integraciones = await listarIntegraciones();

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

const RESULTADO: Record<
  FilaDelRegistro["resultado"],
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  ok: { label: "OK", variant: "success" },
  con_errores: { label: "Con errores", variant: "warning" },
  error: { label: "Error", variant: "danger" },
  en_curso: { label: "En curso", variant: "neutral" },
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
            Las últimas lecturas de cada sistema: qué trajeron, cuánto tardaron y quién las lanzó.
          </CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function SyncLog() {
  await connection();
  const log = await registroDeSincronizaciones();

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
          {log.length === 0 && (
            <TableRow>
              <TableCell colSpan={LOG_COLUMNS.length} className="py-8 text-center text-muted-foreground">
                Todavía no hay sincronizaciones.
              </TableCell>
            </TableRow>
          )}
          {log.map((entrada) => (
            <TableRow key={entrada.id}>
              <TableCell>
                <p className="font-medium">{entrada.operacion}</p>
                <p className="text-xs text-muted-foreground">
                  {entrada.integracion} · {entrada.origen}
                </p>
              </TableCell>
              <TableCell>
                <Badge variant={RESULTADO[entrada.resultado].variant} dot>
                  {RESULTADO[entrada.resultado].label}
                </Badge>
              </TableCell>
              <TableCell className="max-w-80 text-muted-foreground">{entrada.detalle}</TableCell>
              <TableCell className="text-right tabular-nums">
                {entrada.duracionMs === null ? "—" : duracion(entrada.duracionMs)}
              </TableCell>
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
