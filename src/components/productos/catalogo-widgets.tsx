import { CircleAlert, CircleCheck, Copy, PackageSearch, ShieldCheck, Tag, Bot } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { CatalogoEstado, CatalogoProducto, CatalogoQuery } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CatalogoFiltros, CatalogoFiltrosFallback } from "./catalogo-filtros";
import { CANALES_PUBLICACION, ESTADO_PRODUCTO } from "./labels";
import { ProductoDetalle } from "./producto-detalle";

type SearchParams = Record<string, string | string[] | undefined>;

/* ---- Indicadores de saneamiento ------------------------------------------ */

export async function CatalogoKpis() {
  const kpis = await api.catalogo.kpis();
  return (
    <KpiGrid
      items={kpis}
      label="Salud del catálogo"
      icons={{ productos: PackageSearch, completos: Bot, repetidos: Copy, "sin-marca": Tag }}
    />
  );
}

export function CatalogoKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Control final automático (RF-M1-09) --------------------------------- */

function ControlFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            Control final automático
          </CardTitle>
          <CardDescription>
            El checklist de 2 minutos que hoy se hace a mano después de cada alta, corriendo solo sobre todo el catálogo
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function ControlFinalCard() {
  const checks = await api.catalogo.control();

  return (
    <ControlFrame>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => {
          const ok = check.fallas.length === 0;
          const Icon = ok ? CircleCheck : CircleAlert;
          return (
            <li key={check.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", ok ? "text-success" : "text-warning")} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {check.regla} · {check.revisados} revisados ·{" "}
                    <span className={cn("font-medium", ok ? "text-success" : "text-warning")}>
                      {ok ? "Todo en orden" : `${check.fallas.length} para corregir`}
                    </span>
                  </p>
                  {!ok && (
                    <ul className="flex flex-wrap gap-1.5 pt-1.5">
                      {check.fallas.slice(0, 4).map((falla) => (
                        <li key={falla.sku}>
                          <Badge variant="warning" title={falla.detalle}>
                            <span className="font-mono">{falla.sku}</span>
                          </Badge>
                        </li>
                      ))}
                      {check.fallas.length > 4 && (
                        <li className="text-xs text-muted-foreground">y {check.fallas.length - 4} más</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </ControlFrame>
  );
}

export function ControlFinalCardSkeleton() {
  return (
    <ControlFrame>
      <LoadingLabel>Cargando el control final…</LoadingLabel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-lg border border-border p-4">
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    </ControlFrame>
  );
}

/* ---- Productos ------------------------------------------------------------ */

const ESTADOS = Object.keys(ESTADO_PRODUCTO) as CatalogoEstado[];

function queryDe(params: SearchParams): CatalogoQuery {
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const estado = get("estado") as CatalogoEstado | undefined;
  const salud = get("salud");
  return {
    q: get("q"),
    rubro: get("rubro"),
    marca: get("marca"),
    proveedor: get("proveedor"),
    estado: estado && ESTADOS.includes(estado) ? estado : undefined,
    salud: salud === "completo" || salud === "con_faltantes" ? salud : undefined,
  };
}

function SaludBadge({ producto }: { producto: CatalogoProducto }) {
  if (producto.completoParaBot) {
    return (
      <Badge variant="success" dot>
        Completo
      </Badge>
    );
  }
  const [primero] = producto.faltantes;
  const label = primero
    ? primero.startsWith("SKU repetido")
      ? "SKU repetido"
      : `Falta: ${primero.toLowerCase()}`
    : "Sin publicar";
  return (
    <Badge
      variant={primero?.startsWith("SKU repetido") ? "danger" : "warning"}
      dot
      title={producto.faltantes.join(" · ")}
    >
      {label}
      {producto.faltantes.length > 1 && ` +${producto.faltantes.length - 1}`}
    </Badge>
  );
}

function Publicado({ producto }: { producto: CatalogoProducto }) {
  return (
    <span className="flex flex-wrap gap-1">
      {CANALES_PUBLICACION.map(({ key, label }) => {
        const ok = producto.publicado[key];
        return (
          <span
            key={key}
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-medium",
              ok ? "bg-success/10 text-success" : "bg-muted text-muted-foreground line-through",
            )}
          >
            {label}
            <span className="sr-only">{ok ? " publicado" : " sin publicar"}</span>
          </span>
        );
      })}
    </span>
  );
}

function ProductoTile({ producto }: { producto: CatalogoProducto }) {
  const estado = ESTADO_PRODUCTO[producto.estado];
  return (
    <li>
      <ProductoDetalle producto={producto}>
        <button
          type="button"
          className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-card transition-[border-color,box-shadow,scale] duration-150 ease-snappy hover:border-border-strong active:scale-[0.99]"
        >
          <ProductThumb
            sku={producto.sku}
            colors={producto.colores}
            size="lg"
            className="rounded-none border-0 border-b"
          />
          <span className="flex flex-1 flex-col gap-2 p-3.5">
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{producto.sku}</span>
              <Badge variant={estado.tone}>{estado.label}</Badge>
            </span>
            <span className="line-clamp-2 text-sm leading-snug font-medium">{producto.nombre}</span>
            <span className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(producto.bulto.precio)}
              </span>{" "}
              · {producto.bulto.label.toLowerCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(producto.bultosDisponibles)} bultos disponibles
            </span>
            <span className="mt-auto flex flex-col gap-2 pt-1">
              <Publicado producto={producto} />
              <SaludBadge producto={producto} />
            </span>
          </span>
        </button>
      </ProductoDetalle>
    </li>
  );
}

const LIST_COLUMNS = ["Producto", "Rubro", "Bulto", "Disponible", "Publicado", "Salud"];

export async function CatalogoProductos({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = queryDe(params);
  const productos = await api.catalogo.productos(query);
  const vista = params.vista === "lista" ? "lista" : "grilla";
  const filtrado = Object.values(query).some(Boolean);

  if (productos.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No hay productos con esos filtros"
        description="Probá con otro rubro, marca o estado, o borrá la búsqueda."
      />
    );
  }

  return (
    <>
      <p aria-live="polite" className="px-5 pb-3 text-[13px] text-muted-foreground">
        {productos.length} {productos.length === 1 ? "producto" : "productos"}
        {filtrado ? " con los filtros aplicados" : ""} · tocá uno para ver su ficha completa
      </p>
      {vista === "grilla" ? (
        <ul className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {productos.map((producto) => (
            <ProductoTile key={producto.sku} producto={producto} />
          ))}
        </ul>
      ) : (
        <Table className="min-w-3xl">
          <TableHeader>
            <TableRow>
              {LIST_COLUMNS.map((column) => (
                <TableHead key={column} className={cn((column === "Bulto" || column === "Disponible") && "text-right")}>
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((producto) => (
              <TableRow key={producto.sku}>
                <TableCell>
                  <ProductoDetalle producto={producto}>
                    <button type="button" className="flex items-center gap-3 rounded-lg text-left">
                      <ProductThumb sku={producto.sku} colors={producto.colores} size="sm" />
                      <span className="min-w-0">
                        <span className="block max-w-72 truncate font-medium hover:underline">{producto.nombre}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{producto.sku}</span>
                      </span>
                    </button>
                  </ProductoDetalle>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {producto.rubro}
                  <span className="block text-xs">{producto.subrubro}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(producto.bulto.precio)}
                  <span className="block text-xs text-muted-foreground">{producto.bulto.codigo}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(producto.bultosDisponibles)}</TableCell>
                <TableCell>
                  <Publicado producto={producto} />
                </TableCell>
                <TableCell>
                  <SaludBadge producto={producto} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

export function CatalogoProductosSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando productos…</LoadingLabel>
      <div className="px-5 pb-3">
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-border">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3.5">
              <SkeletonText lines={3} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Card de productos: filtros en la URL y la grilla o la lista. */
export async function CatalogoProductosCard({ children }: { children: React.ReactNode }) {
  const facetas = await api.catalogo.facetas();
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="w-full">
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Fuente única del contenido: lo que va a DUX, Tienda Nube, la vidriera, el bot y Meta
          </CardDescription>
        </div>
        <Suspense fallback={<CatalogoFiltrosFallback />}>
          <CatalogoFiltros facetas={facetas} />
        </Suspense>
      </CardHeader>
      {children}
    </Card>
  );
}

export function CatalogoProductosCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="w-full">
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Fuente única del contenido: lo que va a DUX, Tienda Nube, la vidriera, el bot y Meta
          </CardDescription>
        </div>
        <CatalogoFiltrosFallback />
      </CardHeader>
      <CatalogoProductosSkeleton />
    </Card>
  );
}
