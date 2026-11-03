import { CalendarRange, Coins, TrendingUp, Wallet } from "lucide-react";
import { ColumnChart, type ChartBar } from "@/components/kit/column-chart";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Meter } from "@/components/kit/meter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartSkeleton, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { CampanaPresupuesto, Kpi } from "@/lib/api/types";
import { niceMax } from "@/lib/chart";
import { formatCurrency, formatDate, formatPercent, formatRatio, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { rmClass } from "./anuncios";
import { MontoDialog } from "./monto-dialog";

const signed = (value: number) =>
  formatPercent(value, { signDisplay: "exceptZero", maximumFractionDigits: 0 }).replace("-", "−");

/** Lectura del desvío proyectado contra lo planificado. */
function desvioBadge(desvio: number) {
  if (desvio > 0.1) return { label: "Se pasa", variant: "warning" as const };
  if (desvio < -0.15) return { label: "Queda corto", variant: "neutral" as const };
  return { label: "En línea", variant: "success" as const };
}

/** Tono del RM: sobre 1,5 sano, sobre 1 en equilibrio, debajo pierde plata. */
function rmTone(rm: number | null) {
  if (rm === null) return "danger" as const;
  if (rm >= 1.5) return "success" as const;
  if (rm >= 1) return "primary" as const;
  return rm >= 0.5 ? ("warning" as const) : ("danger" as const);
}

/* ---- Indicadores del mes --------------------------------------------------- */

export async function PresupuestoKpis() {
  const mes = await api.pauta.presupuesto();
  const presupuesto = mes.campanas.reduce((sum, campana) => sum + campana.presupuestoUsd, 0);
  const gastado = mes.campanas.reduce((sum, campana) => sum + campana.gastadoUsd, 0);
  const proyeccion = mes.campanas.reduce((sum, campana) => sum + campana.proyeccionUsd, 0);
  const desvio = presupuesto > 0 ? (proyeccion - presupuesto) / presupuesto : 0;

  const kpis: Kpi[] = [
    {
      id: "presupuesto",
      label: "Presupuesto del mes",
      value: presupuesto,
      format: "usd",
      hint: `Planificado para ${mes.mes}`,
    },
    {
      id: "gastado",
      label: `Gastado al día ${mes.dia}`,
      value: gastado,
      format: "usd",
      hint: `${formatPercent(gastado / presupuesto, { maximumFractionDigits: 0 })} del presupuesto, con ${formatPercent(mes.dia / mes.diasDelMes, { maximumFractionDigits: 0 })} del mes`,
    },
    {
      id: "proyeccion",
      label: "Proyección a fin de mes",
      value: proyeccion,
      format: "usd",
      hint: `${signed(desvio)} contra lo planificado`,
    },
    {
      id: "pesos",
      label: "Gastado en pesos",
      value: gastado * mes.tipoCambio,
      format: "currency",
      hint: `A ${formatCurrency(mes.tipoCambio)} por dólar`,
    },
  ];

  return (
    <KpiGrid
      items={kpis}
      label="Presupuesto del mes"
      icons={{ presupuesto: Wallet, gastado: Coins, proyeccion: TrendingUp, pesos: CalendarRange }}
    />
  );
}

export function PresupuestoKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Campañas -------------------------------------------------------------- */

const COLUMNS = ["Campaña", "Presupuesto", "Gastado", "Proyección", "Desvío", "RM · 7 días"];

function CampanasFrame({ mes, children }: { mes?: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Campañas</CardTitle>
          <CardDescription>
            Lo planificado contra lo gastado{mes ? ` en ${mes}` : ""}, y cuánto margen deja cada peso
          </CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

function CampanaRow({ campana }: { campana: CampanaPresupuesto }) {
  const avance = campana.presupuestoUsd > 0 ? campana.gastadoUsd / campana.presupuestoUsd : 0;
  const badge = desvioBadge(campana.desvio);
  const rmMax = 2.5;

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{campana.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {campana.objetivo} · {campana.anuncios} {campana.anuncios === 1 ? "anuncio activo" : "anuncios activos"}
        </p>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatUsd(campana.presupuestoUsd)}</TableCell>
      <TableCell>
        <div className="ml-auto w-36 space-y-1.5">
          <p className="flex justify-between text-[13px] tabular-nums">
            <span className="font-medium">{formatUsd(campana.gastadoUsd)}</span>
            <span className="text-muted-foreground">{formatPercent(avance, { maximumFractionDigits: 0 })}</span>
          </p>
          <Meter
            value={Math.min(avance, 1)}
            tone={avance > 1 ? "warning" : "primary"}
            label={`Gastado de ${campana.nombre}`}
            valueText={`${formatUsd(campana.gastadoUsd)} de ${formatUsd(campana.presupuestoUsd)}`}
          />
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatUsd(campana.proyeccionUsd)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <span className="text-[13px] text-muted-foreground tabular-nums">{signed(campana.desvio)}</span>
          <Badge variant={badge.variant} dot>
            {badge.label}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="ml-auto w-32 space-y-1.5">
          <p className={cn("text-right text-[13px] font-semibold tabular-nums", rmClass(campana.rm))}>
            {campana.rm === null ? "—" : formatRatio(campana.rm)}
            <span className="ml-1.5 font-normal text-muted-foreground">
              {campana.pedidos7d} {campana.pedidos7d === 1 ? "pedido" : "pedidos"}
            </span>
          </p>
          <Meter
            value={Math.min(campana.rm ?? 0, rmMax)}
            max={rmMax}
            tone={rmTone(campana.rm)}
            label={`RM de ${campana.nombre}`}
            valueText={campana.rm === null ? "Sin gasto" : `RM ${formatRatio(campana.rm)}`}
          />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <MontoDialog
          target={{ kind: "presupuesto", campanaId: campana.id, campana: campana.nombre }}
          initialValue={campana.presupuestoUsd}
          triggerLabel="Editar"
          triggerAriaLabel={`Editar el presupuesto de ${campana.nombre}`}
          triggerVariant="ghost"
        />
      </TableCell>
    </TableRow>
  );
}

export async function CampanasCard() {
  const mes = await api.pauta.presupuesto();

  return (
    <CampanasFrame mes={mes.mes}>
      <Table className="min-w-5xl">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column, index) => (
              <TableHead key={column} className={cn(index > 0 && "text-right")}>
                {column}
              </TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mes.campanas.map((campana) => (
            <CampanaRow key={campana.id} campana={campana} />
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        El RM es el margen real de las ventas verificadas dividido por el gasto en pesos. 1,00 es el equilibrio.
      </p>
    </CampanasFrame>
  );
}

export function CampanasCardSkeleton() {
  return (
    <CampanasFrame>
      <LoadingLabel>Cargando campañas…</LoadingLabel>
      <TableSkeleton columns={[...COLUMNS, ""]} rows={4} className="min-w-5xl" />
    </CampanasFrame>
  );
}

/* ---- Gasto diario ---------------------------------------------------------- */

function GastoFrame({ total, children }: { total: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Gasto diario</CardTitle>
          <CardDescription>Todas las campañas, en dólares · mes en curso</CardDescription>
        </div>
        <div className="text-right">
          {total}
          <p className="text-xs text-muted-foreground">promedio por día</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-6">{children}</CardContent>
    </Card>
  );
}

export async function GastoDiarioCard() {
  const mes = await api.pauta.presupuesto();
  const puntos = mes.gastoDiario;
  const last = puntos.length - 1;
  const completos = puntos.slice(0, -1);
  const promedio =
    completos.length > 0
      ? completos.reduce((sum, point) => sum + point.value, 0) / completos.length
      : (puntos[0]?.value ?? 0);
  const max = niceMax(Math.max(1, ...puntos.map((point) => point.value)));

  const bars: ChartBar[] = puntos.map((point, index) => ({
    value: point.value,
    valueLabel: formatUsd(point.value),
    label:
      index === last ? "Hoy, hasta ahora" : formatDate(point.date, { weekday: "long", day: "numeric", month: "long" }),
    axisLabel: index === last ? "Hoy" : formatDate(point.date, { day: "numeric", month: "short" }),
  }));

  return (
    <GastoFrame
      total={<p className="text-xl leading-6 font-semibold tracking-tight tabular-nums">{formatUsd(promedio)}</p>}
    >
      <ColumnChart
        bars={bars}
        max={max}
        ticks={[formatUsd(max), formatUsd(max / 2), "0"]}
        description="Gasto por día"
      />
    </GastoFrame>
  );
}

export function GastoDiarioCardSkeleton() {
  return (
    <GastoFrame total={<Skeleton className="ml-auto h-6 w-14" />}>
      <LoadingLabel>Cargando el gasto diario…</LoadingLabel>
      <ChartSkeleton bars={28} />
    </GastoFrame>
  );
}
