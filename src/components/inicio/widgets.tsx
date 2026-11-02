import {
  ArrowUpRight,
  Clock,
  HandCoins,
  MessagesSquare,
  Repeat,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { BarList } from "@/components/kit/bar-list";
import { ColumnChart, type ChartBar } from "@/components/kit/column-chart";
import { EstadoPedidoBadge, SegmentoBadge } from "@/components/kit/badges";
import { Funnel } from "@/components/kit/funnel";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarListSkeleton,
  ChartSkeleton,
  SkeletonText,
  TableSkeleton,
} from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { CorteHorario, DailyPoint } from "@/lib/api/types";
import { niceMax } from "@/lib/chart";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatMetric,
  formatPercent,
  formatRatio,
  formatUsd,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---- Resultado de la semana (Manual v4, P-15) ------------------------------- */

export async function InicioKpis() {
  const kpis = await api.dashboard.kpis();
  return (
    <KpiGrid
      items={kpis}
      columns={5}
      label="Resultado de la semana"
      icons={{
        facturacion: TrendingUp,
        cobrado: HandCoins,
        pedidos: ShoppingBag,
        conversaciones: MessagesSquare,
        cierre: Target,
      }}
    />
  );
}

export function InicioKpisSkeleton() {
  return <KpiGridSkeleton count={5} columns={5} />;
}

/* ---- Causas de la semana (Manual v4, P-15) ---------------------------------- */

const ESTADO_CAUSA = {
  ok: { label: "En orden", variant: "success" },
  atencion: { label: "Revisar", variant: "warning" },
  alerta: { label: "Urgente", variant: "danger" },
} as const;

const causasGrid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5";

function CausasFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Lo que explica los números</CardTitle>
          <CardDescription>
            Indicadores de causa de la semana. Cada uno lleva a la pantalla donde se resuelve.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function CausasCard() {
  const causas = await api.dashboard.causas();
  return (
    <CausasFrame>
      <ul className={causasGrid}>
        {causas.map((causa) => {
          const estado = ESTADO_CAUSA[causa.estado];
          return (
            <li key={causa.id} className="flex flex-col rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-muted-foreground">{causa.label}</p>
                <Badge variant={estado.variant} className="shrink-0">
                  {estado.label}
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-semibold leading-none tracking-tight tabular-nums">
                {formatMetric(causa.value, causa.format)}
              </p>
              <p className="mt-2 flex-1 text-xs text-muted-foreground">{causa.detalle}</p>
              <Button variant="outline" size="sm" asChild className="mt-4 self-start">
                <Link href={causa.href}>
                  {causa.accion}
                  <ArrowUpRight />
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </CausasFrame>
  );
}

export function CausasCardSkeleton() {
  return (
    <CausasFrame>
      <LoadingLabel>Cargando los indicadores de causa…</LoadingLabel>
      <div className={causasGrid}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border p-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    </CausasFrame>
  );
}

/* ---- Ventas por día --------------------------------------------------------- */

function toBars(points: DailyPoint[]): ChartBar[] {
  const last = points.length - 1;
  return points.map((point, index) => ({
    value: point.value,
    valueLabel: formatCurrency(point.value),
    label:
      index === last
        ? "Hoy, hasta ahora"
        : index === last - 1
          ? "Ayer"
          : formatDate(point.date, { weekday: "long", day: "numeric", month: "long" }),
    axisLabel: index === last ? "Hoy" : formatDate(point.date, { day: "numeric", month: "short" }),
  }));
}

function VentasFrame({ total, children }: { total: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Ventas</CardTitle>
          <CardDescription>Facturado por día en todos los canales · últimos 30 días</CardDescription>
        </div>
        <div className="text-right">
          {total}
          <p className="text-xs text-muted-foreground">en el período</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-6">{children}</CardContent>
    </Card>
  );
}

export async function VentasCard() {
  const points = await api.dashboard.ventas(30);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const max = niceMax(Math.max(...points.map((point) => point.value)));

  return (
    <VentasFrame
      total={<p className="text-xl font-semibold leading-6 tracking-tight tabular-nums">{formatCurrencyCompact(total)}</p>}
    >
      <ColumnChart
        bars={toBars(points)}
        max={max}
        ticks={[formatCurrencyCompact(max), formatCurrencyCompact(max / 2), "0"]}
        description="Ventas por día"
      />
    </VentasFrame>
  );
}

export function VentasCardSkeleton() {
  return (
    <VentasFrame total={<Skeleton className="ml-auto h-6 w-16" />}>
      <LoadingLabel>Cargando ventas…</LoadingLabel>
      <ChartSkeleton bars={30} />
    </VentasFrame>
  );
}

/* ---- Ventas por canal ------------------------------------------------------- */

function CanalesFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Por canal</CardTitle>
          <CardDescription>Ventas de los últimos 7 días</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function CanalesCard() {
  const canales = await api.dashboard.canales();
  const total = canales.reduce((sum, item) => sum + item.value, 0);

  return (
    <CanalesFrame>
      <BarList
        items={canales.map((canal) => ({
          id: canal.id,
          label: canal.label,
          value: canal.value,
          valueLabel: formatCurrencyCompact(canal.value),
          detail: formatPercent(canal.value / total, { maximumFractionDigits: 0 }),
        }))}
      />
      <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">
        Total de la semana{" "}
        <span className="font-medium text-foreground tabular-nums">{formatCurrency(total)}</span>
      </p>
    </CanalesFrame>
  );
}

export function CanalesCardSkeleton() {
  return (
    <CanalesFrame>
      <LoadingLabel>Cargando canales…</LoadingLabel>
      <BarListSkeleton rows={4} />
    </CanalesFrame>
  );
}

/* ---- Embudo ----------------------------------------------------------------- */

function EmbudoFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Embudo de la semana</CardTitle>
          <CardDescription>De la conversación al despacho en los últimos 7 días, con la conversión de cada paso</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/conversaciones">
            Ver conversaciones
            <ArrowUpRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function EmbudoCard() {
  const pasos = await api.dashboard.embudo();
  return (
    <EmbudoFrame>
      <Funnel steps={pasos} />
    </EmbudoFrame>
  );
}

export function EmbudoCardSkeleton() {
  return (
    <EmbudoFrame>
      <LoadingLabel>Cargando embudo…</LoadingLabel>
      <BarListSkeleton rows={7} />
    </EmbudoFrame>
  );
}

/* ---- Operación de hoy ------------------------------------------------------- */

const corteTone: Record<CorteHorario["estado"], { label: string; variant: "success" | "warning" | "neutral" }> = {
  a_tiempo: { label: "A tiempo", variant: "success" },
  proximo: { label: "Se acerca", variant: "warning" },
  cerrado: { label: "Cerrado", variant: "neutral" },
};

function OperacionFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Operación de hoy</CardTitle>
          <CardDescription>Pedidos del día por estado y cortes de despacho</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-5">{children}</CardContent>
    </Card>
  );
}

export async function OperacionCard() {
  const operacion = await api.dashboard.operacion();

  return (
    <OperacionFrame>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {operacion.porEstado.map(({ estado, cantidad }) => (
          <li key={estado} className="flex items-center justify-between gap-2">
            <EstadoPedidoBadge estado={estado} />
            <span className="text-sm font-semibold tabular-nums">{cantidad}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/pedidos/facturacion"
          className="rounded-lg border border-border bg-muted/50 p-3 transition-colors hover:bg-muted"
        >
          <p className="text-2xl font-semibold tabular-nums">{operacion.listosParaFacturar}</p>
          <p className="text-xs text-muted-foreground">listos para facturar</p>
        </Link>
        <Link
          href="/pedidos/bandeja"
          className="rounded-lg border border-border bg-muted/50 p-3 transition-colors hover:bg-muted"
        >
          <p className={cn("text-2xl font-semibold tabular-nums", operacion.trabados > 0 && "text-warning")}>
            {operacion.trabados}
          </p>
          <p className="text-xs text-muted-foreground">trabados hace más de 2 h</p>
        </Link>
      </div>

      <ul className="mt-5 space-y-2.5 border-t border-border pt-4">
        {operacion.cortes.map((corte) => (
          <li key={corte.id} className="flex items-center gap-3 text-sm">
            <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {corte.label} <span className="text-muted-foreground tabular-nums">· {corte.hora}</span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {corte.pendientes} {corte.pendientes === 1 ? "pedido" : "pedidos"}
            </span>
            <Badge variant={corteTone[corte.estado].variant}>{corteTone[corte.estado].label}</Badge>
          </li>
        ))}
      </ul>
    </OperacionFrame>
  );
}

export function OperacionCardSkeleton() {
  return (
    <OperacionFrame>
      <LoadingLabel>Cargando operación…</LoadingLabel>
      <SkeletonText lines={6} />
    </OperacionFrame>
  );
}

/* ---- Top anuncios ----------------------------------------------------------- */

const semaforoBadge = {
  escalar: { label: "Escalar", variant: "success" },
  mantener: { label: "Mantener", variant: "primary" },
  revisar: { label: "Revisar", variant: "warning" },
  apagar: { label: "Apagar", variant: "danger" },
} as const;

const ANUNCIO_COLUMNS = ["Anuncio", "Gasto", "Pedidos", "RM"];

function AnunciosFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Mejores anuncios por RM</CardTitle>
          <CardDescription>Margen real de las ventas verificadas ÷ gasto · 7 días</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/pauta/anuncios">
            Ver pauta
            <ArrowUpRight />
          </Link>
        </Button>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function TopAnunciosCard() {
  const anuncios = await api.dashboard.topAnuncios();

  return (
    <AnunciosFrame>
      <Table className="min-w-lg">
        <TableHeader>
          <TableRow>
            {ANUNCIO_COLUMNS.map((column, index) => (
              <TableHead key={column} className={cn(index > 0 && "text-right")}>
                {column}
              </TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Semáforo</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anuncios.map((anuncio) => (
            <TableRow key={anuncio.id}>
              <TableCell>
                <p className="max-w-56 truncate font-medium">{anuncio.nombre}</p>
                <p className="text-xs text-muted-foreground">Margen {formatCurrency(anuncio.margen)}</p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatUsd(anuncio.gastoUsd)}</TableCell>
              <TableCell className="text-right tabular-nums">{anuncio.pedidos}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {anuncio.rm === null ? "—" : formatRatio(anuncio.rm)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={semaforoBadge[anuncio.semaforo].variant} dot>
                  {semaforoBadge[anuncio.semaforo].label}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AnunciosFrame>
  );
}

export function TopAnunciosCardSkeleton() {
  return (
    <AnunciosFrame>
      <LoadingLabel>Cargando anuncios…</LoadingLabel>
      <TableSkeleton columns={[...ANUNCIO_COLUMNS, ""]} rows={5} className="min-w-lg" />
    </AnunciosFrame>
  );
}

/* ---- Para reactivar hoy ----------------------------------------------------- */

function ReactivarFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Para reactivar hoy</CardTitle>
          <CardDescription>Clientas que se pasaron de su ciclo de compra</CardDescription>
        </div>
        <Button size="sm" asChild>
          <Link href="/clientas/recompra">
            <Repeat />
            Recompra del día
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pt-3">{children}</CardContent>
    </Card>
  );
}

export async function ReactivarCard() {
  const clientas = await api.dashboard.reactivar();

  return (
    <ReactivarFrame>
      <ul className="divide-y divide-border">
        {clientas.map((clienta) => (
          <li key={clienta.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{clienta.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">{clienta.motivo}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm tabular-nums">{formatCurrencyCompact(clienta.totalComprado)}</p>
              <p className="text-xs text-muted-foreground">comprado</p>
            </div>
            <SegmentoBadge segmento={clienta.segmento} />
          </li>
        ))}
      </ul>
    </ReactivarFrame>
  );
}

export function ReactivarCardSkeleton() {
  return (
    <ReactivarFrame>
      <LoadingLabel>Cargando clientas…</LoadingLabel>
      <SkeletonText lines={5} />
    </ReactivarFrame>
  );
}
