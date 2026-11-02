import {
  Banknote,
  CheckCircle2,
  Megaphone,
  MessagesSquare,
  Percent,
  Send,
  Target,
  Wallet,
} from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
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
import { SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { AnuncioFila, PeriodoPauta, SemaforoAnuncio } from "@/lib/api/types";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  formatRatio,
  formatRelativeTime,
  formatUsd,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/components/clientas/shared";
import { MontoDialog } from "./monto-dialog";
import { PausarButton } from "./pausar-button";

export function readPeriodo(params: SearchParams): PeriodoPauta {
  return param(params, "dias") === "14" ? 14 : 7;
}

export const SEMAFORO: Record<SemaforoAnuncio, { label: string; variant: "success" | "primary" | "warning" | "danger" }> = {
  escalar: { label: "Escalar", variant: "success" },
  mantener: { label: "Mantener", variant: "primary" },
  revisar: { label: "Revisar", variant: "warning" },
  apagar: { label: "Apagar", variant: "danger" },
};

/** Color del RM respecto del equilibrio (1,00) y de un objetivo sano (1,50). */
export function rmClass(rm: number | null) {
  if (rm === null) return "text-muted-foreground";
  if (rm >= 1.5) return "text-success";
  if (rm >= 1) return "text-foreground";
  return "text-danger";
}

/* ---- Indicadores ----------------------------------------------------------- */

export async function PautaKpis({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const periodo = readPeriodo(await searchParams);
  const kpis = await api.pauta.kpis(periodo);
  return (
    <KpiGrid
      items={kpis}
      columns={5}
      label={`Indicadores de la pauta de los últimos ${periodo} días`}
      icons={{ gasto: Wallet, pedidos: Megaphone, margen: Banknote, rm: Target, cierre: Percent }}
    />
  );
}

export function PautaKpisSkeleton() {
  return <KpiGridSkeleton count={5} columns={5} />;
}

/* ---- Tabla de anuncios ----------------------------------------------------- */

const COLUMNS = [
  "Anuncio",
  "Gasto",
  "Conversaciones",
  "Pedidos",
  "Cierre",
  "Margen",
  "RM",
  "Ganancia",
  "Recompra 90 d",
  "Recomendación",
];
const NUMERIC = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

function AnunciosFrame({ periodo, children }: { periodo?: PeriodoPauta; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Anuncios</CardTitle>
          <CardDescription>
            {periodo ? `Últimos ${periodo} días · ` : ""}pedidos verificados en DUX y margen línea por línea con el costo real
          </CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

function AnuncioRow({ anuncio }: { anuncio: AnuncioFila }) {
  const semaforo = SEMAFORO[anuncio.semaforo];
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {anuncio.sku && anuncio.producto ? (
            <ProductThumb sku={anuncio.sku} colors={anuncio.producto.colores} size="md" />
          ) : (
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-muted">
              <Megaphone className="size-4 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="max-w-64 truncate font-medium">{anuncio.nombre}</p>
              {anuncio.estado === "pausado" && <Badge variant="neutral">Pausado</Badge>}
              {anuncio.legado && <Badge variant="outline">Legado</Badge>}
            </div>
            <p className="max-w-72 truncate text-xs text-muted-foreground">
              {anuncio.campana} · {anuncio.formato} · {anuncio.zona}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <p className="font-medium tabular-nums">{formatUsd(anuncio.gastoUsd)}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{formatCurrencyCompact(anuncio.gastoArs)}</p>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(anuncio.conversaciones)}</TableCell>
      <TableCell className="text-right tabular-nums">{anuncio.pedidos}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {anuncio.tasaCierre === null ? "—" : formatPercent(anuncio.tasaCierre)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(anuncio.margen)}</TableCell>
      <TableCell className="text-right">
        <p className={cn("font-semibold tabular-nums", rmClass(anuncio.rm))}>
          {anuncio.rm === null ? "—" : formatRatio(anuncio.rm)}
        </p>
        {anuncio.muestraChica && <p className="whitespace-nowrap text-[11px] text-muted-foreground">muestra chica</p>}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", anuncio.ganancia < 0 && "text-danger")}>
        {formatCurrency(anuncio.ganancia)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {anuncio.valorRecompra90d > 0 ? formatCurrencyCompact(anuncio.valorRecompra90d) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={semaforo.variant} dot>
          {semaforo.label}
        </Badge>
        <p className="mt-1 w-56 text-pretty text-xs text-muted-foreground">{anuncio.motivo}</p>
      </TableCell>
      <TableCell className="text-right">
        <PausarButton id={anuncio.id} nombre={anuncio.nombre} conjunto={anuncio.conjunto} estado={anuncio.estado} />
      </TableCell>
    </TableRow>
  );
}

export async function AnunciosCard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const periodo = readPeriodo(await searchParams);
  const anuncios = await api.pauta.anuncios(periodo);
  const conGasto = anuncios.filter((anuncio) => !anuncio.legado);
  const sum = (key: "gastoUsd" | "gastoArs" | "conversaciones" | "pedidos" | "margen" | "ganancia" | "valorRecompra90d") =>
    conGasto.reduce((total, anuncio) => total + anuncio[key], 0);
  const rmTotal = sum("gastoArs") > 0 ? sum("margen") / sum("gastoArs") : null;

  return (
    <AnunciosFrame periodo={periodo}>
      <Table className="min-w-7xl">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column, index) => (
              <TableHead key={column} className={cn(NUMERIC.has(index) && "text-right")}>
                {column}
              </TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anuncios.map((anuncio) => (
            <AnuncioRow key={anuncio.id} anuncio={anuncio} />
          ))}
          <TableRow className="bg-muted/50 font-medium">
            <TableCell>
              Total de la pauta
              <span className="block text-xs font-normal text-muted-foreground">Sin los anuncios legado</span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatUsd(sum("gastoUsd"))}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(sum("conversaciones"))}</TableCell>
            <TableCell className="text-right tabular-nums">{sum("pedidos")}</TableCell>
            <TableCell className="text-right tabular-nums">
              {sum("conversaciones") > 0 ? formatPercent(sum("pedidos") / sum("conversaciones")) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(sum("margen"))}</TableCell>
            <TableCell className={cn("text-right font-semibold tabular-nums", rmClass(rmTotal))}>
              {rmTotal === null ? "—" : formatRatio(rmTotal)}
            </TableCell>
            <TableCell className={cn("text-right tabular-nums", sum("ganancia") < 0 && "text-danger")}>
              {formatCurrency(sum("ganancia"))}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrencyCompact(sum("valorRecompra90d"))}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    </AnunciosFrame>
  );
}

export function AnunciosCardSkeleton() {
  return (
    <AnunciosFrame>
      <LoadingLabel>Cargando anuncios…</LoadingLabel>
      <TableSkeleton columns={[...COLUMNS, ""]} rows={8} className="min-w-7xl" />
    </AnunciosFrame>
  );
}

/* ---- Criterio de atribución ------------------------------------------------ */

function AtribucionFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Criterio de atribución</CardTitle>
          <CardDescription>El que Elías ya validó en sus scripts (RN-110)</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4">{children}</CardContent>
    </Card>
  );
}

export async function AtribucionCard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const periodo = readPeriodo(await searchParams);
  const a = await api.pauta.atribucion(periodo);
  const cuadra = a.atribuido === a.facturado;
  const reglas = [
    "Último clic a un anuncio dentro de los 30 días previos al pedido.",
    "Un clic que ya terminó en compra no se reutiliza: la recompra sin clic nuevo es orgánica.",
    "Solo cuentan los pedidos facturados, y el monto sale de DUX.",
    `Los anuncios legado (sin gasto en el período) van aparte: ${a.pedidosLegado} ${a.pedidosLegado === 1 ? "pedido" : "pedidos"}.`,
  ];

  return (
    <AtribucionFrame>
      <ul className="space-y-2.5">
        {reglas.map((regla) => (
          <li key={regla} className="flex gap-2.5 text-[13px]">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            <span className="text-pretty">{regla}</span>
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "mt-5 rounded-lg border p-3 text-[13px]",
          cuadra ? "border-success/30 bg-success/8" : "border-danger/30 bg-danger/8",
        )}
      >
        <p className="font-medium">
          {cuadra ? "Reconciliación exacta" : "La atribución no cuadra: el informe no se emite"}
        </p>
        <p className="mt-1 tabular-nums text-muted-foreground">
          Atribuido <span className="font-medium text-foreground">{formatCurrency(a.atribuido)}</span> · facturado en DUX{" "}
          <span className="font-medium text-foreground">{formatCurrency(a.facturado)}</span> · diferencia{" "}
          <span className="font-medium text-foreground">{formatCurrency(a.atribuido - a.facturado)}</span>
        </p>
      </div>
      <p className="mt-3 text-pretty text-xs text-muted-foreground">
        Byos decía {a.pedidosSegunByos} pedidos de pauta en este período; los verificados son {a.pedidosVerificados}.
      </p>
    </AtribucionFrame>
  );
}

export function AtribucionCardSkeleton() {
  return (
    <AtribucionFrame>
      <LoadingLabel>Cargando la atribución…</LoadingLabel>
      <SkeletonText lines={5} />
    </AtribucionFrame>
  );
}

/* ---- Tipo de cambio y Conversions API ---------------------------------------- */

function ConfigFrame({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex-1 pt-4">{children}</CardContent>
    </Card>
  );
}

export async function TipoCambioCard() {
  const { tipoCambio } = await api.pauta.config();

  return (
    <ConfigFrame
      title="Tipo de cambio"
      description="Meta cobra en dólares (RN-111)"
      action={<MontoDialog target={{ kind: "tipo-cambio" }} initialValue={tipoCambio.valor} triggerLabel="Actualizar" />}
    >
      <p className="flex items-baseline gap-1.5">
        <span className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
          {formatCurrency(tipoCambio.valor)}
        </span>
        <span className="text-[13px] text-muted-foreground">por dólar</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Lo actualizó {tipoCambio.actualizadoPor}{" "}
        <time dateTime={tipoCambio.actualizadoEl}>{formatRelativeTime(tipoCambio.actualizadoEl)}</time>
      </p>
      <ul className="mt-4 divide-y divide-border border-t border-border">
        {tipoCambio.historial.map((item) => (
          <li key={item.el} className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="font-medium tabular-nums">{formatCurrency(item.valor)}</span>
            <span className="truncate text-xs text-muted-foreground">
              {item.por} · <time dateTime={item.el}>{formatRelativeTime(item.el)}</time>
            </span>
          </li>
        ))}
      </ul>
    </ConfigFrame>
  );
}

export async function ConversionesCard() {
  const { conversiones } = await api.pauta.config();
  const activo = conversiones.estado === "activo";

  return (
    <ConfigFrame
      title="Ventas devueltas a Meta"
      description="Conversions API para mensajes (RF-M9-06)"
      action={
        <Badge variant={activo ? "success" : "warning"} dot>
          {activo ? "Activo" : "Pendiente"}
        </Badge>
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Send aria-hidden className="size-4" />
        </span>
        <p className="text-pretty text-[13px]">
          <span className="font-semibold tabular-nums">{conversiones.eventos7d} compras</span> enviadas en los últimos 7
          días, con el <code className="rounded bg-muted px-1 font-mono text-xs">ctwa_clid</code> de cada conversación y
          deduplicadas por número de pedido ({conversiones.deduplicados7d} reintentos descartados).
        </p>
      </div>
      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Último envío</dt>
          <dd>
            <time dateTime={conversiones.ultimoEnvio} className="first-letter:uppercase">
              {formatRelativeTime(conversiones.ultimoEnvio)}
            </time>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Permiso de Meta</dt>
          <dd className="truncate font-mono text-xs">{conversiones.permiso}</dd>
        </div>
      </dl>
      <p className="mt-4 flex gap-2 text-pretty text-xs text-muted-foreground">
        <MessagesSquare aria-hidden className="mt-px size-3.5 shrink-0" />
        Antes Meta recibía valor de conversión 0 en todos los anuncios: optimizaba para conseguir conversaciones, no
        compras.
      </p>
    </ConfigFrame>
  );
}

export function ConfigCardSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <LoadingLabel>Cargando…</LoadingLabel>
        <SkeletonText lines={4} />
      </CardContent>
    </Card>
  );
}
