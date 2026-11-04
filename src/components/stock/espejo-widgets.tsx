import { Boxes, Lock, PackageSearch, RefreshCw, TriangleAlert, Warehouse } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { StockEstado } from "@/lib/api/types";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DiferenciasList } from "./diferencias-list";
import { ESTADO_STOCK } from "./labels";
import { StockFiltros, StockFiltrosFallback } from "./stock-filtros";

type SearchParams = Record<string, string | string[] | undefined>;

/* ---- Sincronización con DUX ----------------------------------------------- */

function SyncFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <RefreshCw aria-hidden className="size-5" />
      </span>
      {children}
    </Card>
  );
}

export async function SyncCard() {
  const sync = await api.stock.sync();
  return (
    <SyncFrame>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight">
          Espejo de DUX
          <Badge variant="success" dot>
            Al día
          </Badge>
        </h2>
        <p className="text-[13px] text-muted-foreground">
          DUX no avisa los cambios: la app lo lee cada {sync.intervaloMin} minutos y nunca escribe stock a mano. Entra
          por las compras y sale por las facturas, siempre por API.
        </p>
      </div>
      <dl className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-1 text-sm sm:text-right">
        <div>
          <dt className="text-xs text-muted-foreground">Última lectura</dt>
          <dd className="font-medium first-letter:uppercase">
            <time dateTime={sync.ultimaLectura}>{formatRelativeTime(sync.ultimaLectura)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Códigos</dt>
          <dd className="font-medium tabular-nums">
            {formatNumber(sync.codigos)} en {sync.llamadas} llamadas
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Errores 24 h</dt>
          <dd className="font-medium tabular-nums">{sync.errores24h}</dd>
        </div>
      </dl>
    </SyncFrame>
  );
}

export function SyncCardSkeleton() {
  return (
    <SyncFrame>
      <LoadingLabel>Cargando el estado de la sincronización…</LoadingLabel>
      <div className="flex-1">
        <SkeletonText lines={2} />
      </div>
      <Skeleton className="h-10 w-64" />
    </SyncFrame>
  );
}

/* ---- Indicadores ------------------------------------------------------------ */

export async function StockKpis() {
  const kpis = await api.stock.kpis();
  return (
    <KpiGrid
      items={kpis}
      label="Indicadores de stock"
      icons={{ skus: PackageSearch, bultos: Boxes, reservado: Lock, critico: TriangleAlert }}
    />
  );
}

export function StockKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Tabla del espejo ------------------------------------------------------- */

const COLUMNS = ["Producto", "Real", "Reservado", "Disponible", "Vendido 30 días", "Días de stock", "Estado"];
const NUMERIC = new Set(["Real", "Reservado", "Disponible", "Vendido 30 días", "Días de stock"]);
const ESTADOS = Object.keys(ESTADO_STOCK) as StockEstado[];

export async function StockTabla({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const estado = get("estado") as StockEstado | undefined;
  const filas = await api.stock.espejo({
    q: get("q"),
    rubro: get("rubro"),
    estado: estado && ESTADOS.includes(estado) ? estado : undefined,
  });

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={Warehouse}
        title="No hay productos con esos filtros"
        description="Probá con otro rubro o estado."
      />
    );
  }

  return (
    <Table className="min-w-4xl">
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column} className={cn(NUMERIC.has(column) && "text-right")}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => {
          const estadoFila = ESTADO_STOCK[fila.estado];
          return (
            <TableRow key={fila.sku}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <ProductThumb sku={fila.sku} colors={fila.colores} size="sm" />
                  <div className="min-w-0">
                    <p className="max-w-72 truncate font-medium">{fila.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{fila.sku}</span> · {fila.rubro}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(fila.stockPrendas)}
                <span className="block text-xs text-muted-foreground">prendas</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fila.reservadoPrendas > 0 ? (
                  formatNumber(fila.reservadoPrendas)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="font-semibold">{formatNumber(fila.disponibleBultos)}</span>{" "}
                <span className="text-muted-foreground">{fila.disponibleBultos === 1 ? "bulto" : "bultos"}</span>
                <span className="block text-xs text-muted-foreground">{fila.equivalencia}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(fila.ventas30dBultos)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {fila.diasStock === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${formatNumber(fila.diasStock)} días`
                )}
              </TableCell>
              <TableCell>
                <Badge variant={estadoFila.tone} dot>
                  {estadoFila.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function StockTablaSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando el stock…</LoadingLabel>
      <TableSkeleton columns={COLUMNS} rows={8} className="min-w-4xl" />
    </>
  );
}

export async function StockTablaCard({ children }: { children: React.ReactNode }) {
  const facetas = await api.catalogo.facetas();
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center pb-4">
        <div>
          <CardTitle>Stock por producto</CardTitle>
          <CardDescription>
            Disponible = real − reservado, en bultos mayoristas. Primero lo que necesita atención
          </CardDescription>
        </div>
        <Suspense fallback={<StockFiltrosFallback />}>
          <StockFiltros rubros={facetas.rubros} />
        </Suspense>
      </CardHeader>
      {children}
    </Card>
  );
}

export function StockTablaCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center pb-4">
        <div>
          <CardTitle>Stock por producto</CardTitle>
          <CardDescription>
            Disponible = real − reservado, en bultos mayoristas. Primero lo que necesita atención
          </CardDescription>
        </div>
        <StockFiltrosFallback />
      </CardHeader>
      <StockTablaSkeleton />
    </Card>
  );
}

/* ---- Diferencias en góndola -------------------------------------------------- */

function DiferenciasFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Diferencias en góndola</CardTitle>
          <CardDescription>
            Lo que figura en DUX y no está cuando se arma un pedido. Así se va sanando el stock que se multiplicó el
            10/10
          </CardDescription>
        </div>
      </CardHeader>
      <div className="border-t border-border">{children}</div>
    </Card>
  );
}

export async function DiferenciasCard() {
  const diferencias = await api.stock.diferencias();
  return (
    <DiferenciasFrame>
      <DiferenciasList items={diferencias.map((item) => ({ ...item, cuando: formatRelativeTime(item.detectadoAt) }))} />
    </DiferenciasFrame>
  );
}

export function DiferenciasCardSkeleton() {
  return (
    <DiferenciasFrame>
      <LoadingLabel>Cargando diferencias…</LoadingLabel>
      <div className="p-5">
        <SkeletonText lines={4} />
      </div>
    </DiferenciasFrame>
  );
}
