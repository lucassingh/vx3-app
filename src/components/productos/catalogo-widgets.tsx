import { Archive, Boxes, PackageSearch, PackageX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { param, Pagination, type SearchParams } from "@/components/clientas/shared";
import { EmptyState } from "@/components/kit/empty-state";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonText } from "@/components/views/skeletons";
import { toQueryString } from "@/lib/api/http";
import { api } from "@/lib/api/server";
import type { CatalogoFila } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { leerQueryDelCatalogo } from "@/modules/catalog/filtros";
import { CatalogoFiltros, CatalogoFiltrosFallback } from "./catalogo-filtros";
import { FotoDeProducto } from "./foto-de-producto";
import { VIGENCIA } from "./labels";

const BASE = "/productos/catalogo";
const POR_PAGINA = 24;

const queryDe = (params: SearchParams) => leerQueryDelCatalogo((nombre) => param(params, nombre));

/** La misma URL, con estos cambios: los filtros, la vista y la página se conservan. */
function hrefCon(params: SearchParams, cambios: Record<string, string | number | undefined>) {
  const actuales = Object.fromEntries(Object.keys(params).map((nombre) => [nombre, param(params, nombre)]));
  return `${BASE}${toQueryString({ ...actuales, ...cambios })}`;
}

/* ---- Indicadores ---------------------------------------------------------- */

export async function CatalogoKpis() {
  const kpis = await api.catalogo.kpis();
  return (
    <KpiGrid
      items={kpis}
      label="Estado del catálogo"
      icons={{ productos: PackageSearch, activos: Boxes, agotados: PackageX, historicos: Archive }}
    />
  );
}

export function CatalogoKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Productos ------------------------------------------------------------ */

export function VigenciaBadge({ producto }: { producto: Pick<CatalogoFila, "vigencia" | "deTemporada"> }) {
  const { label, tone } = VIGENCIA[producto.vigencia];
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={tone}>{label}</Badge>
      {producto.deTemporada && producto.vigencia === "agotado" && <Badge variant="accent">De temporada</Badge>}
    </span>
  );
}

function SaludBadge({ producto }: { producto: CatalogoFila }) {
  if (producto.listoParaVender) {
    return (
      <Badge variant="success" dot>
        Listo para vender
      </Badge>
    );
  }
  const bloquean = producto.faltantes.filter(({ bloquea }) => bloquea);
  const [primero] = bloquean;
  return (
    <Badge variant="warning" dot title={bloquean.map(({ dato }) => dato).join(" · ")}>
      {primero ? `Falta: ${primero.dato.toLowerCase()}` : "Le falta algo"}
      {bloquean.length > 1 && ` +${bloquean.length - 1}`}
    </Badge>
  );
}

function Bulto({ producto }: { producto: CatalogoFila }) {
  if (!producto.bulto) return <span className="text-muted-foreground">Sin bulto en DUX</span>;
  return (
    <>
      <span className="font-semibold text-foreground tabular-nums">{formatCurrency(producto.bulto.precio)}</span> ·{" "}
      {producto.bulto.label.toLowerCase()}
    </>
  );
}

function ProductoTile({ producto, href }: { producto: CatalogoFila; href: string }) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        // Son 24 por página: prefetchear cada ficha son 24 pedidos que casi nadie usa.
        prefetch={false}
        className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-card transition-[border-color,box-shadow,scale] duration-150 ease-snappy hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
      >
        <span className="block overflow-hidden border-b border-border">
          <FotoDeProducto
            url={producto.foto}
            sku={producto.sku}
            colores={producto.colores}
            className="rounded-none border-0 transition-transform duration-300 ease-snappy group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </span>
        <span className="flex flex-1 flex-col gap-2 p-3.5">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{producto.sku}</span>
            {producto.vigencia !== "activo" && <VigenciaBadge producto={producto} />}
          </span>
          <span className="line-clamp-3 text-sm leading-snug font-medium">{producto.nombre}</span>
          <span className="text-[13px] text-muted-foreground">
            <Bulto producto={producto} />
          </span>
          <span className="text-xs text-muted-foreground">
            {formatNumber(producto.bultosDisponibles)} {producto.bultosDisponibles === 1 ? "bulto" : "bultos"}{" "}
            disponibles
          </span>
          <span className="mt-auto pt-1">
            <SaludBadge producto={producto} />
          </span>
        </span>
      </Link>
    </li>
  );
}

const COLUMNAS = ["Producto", "Rubro", "Bulto", "Disponible", "Estado", "Para vender"];

export async function CatalogoProductos({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = queryDe(params);
  const pedida = Number(param(params, "page") ?? 1);
  const page = Number.isInteger(pedida) && pedida > 0 ? pedida : 1;
  const resultado = await api.catalogo.productos({ ...query, page, pageSize: POR_PAGINA });
  const vista = param(params, "vista") === "lista" ? "lista" : "grilla";
  const filtrado = Object.values(query).some(Boolean);

  if (resultado.total === 0) {
    return filtrado ? (
      <EmptyState
        icon={PackageSearch}
        title="No hay productos con esos filtros"
        description="Probá con otro filtro, o borrá la búsqueda."
      />
    ) : (
      <EmptyState
        icon={PackageSearch}
        title="Todavía no se importó el catálogo"
        description="Se importa en Integraciones, con el botón Reimportar de Google."
      />
    );
  }

  const desde = (resultado.page - 1) * resultado.pageSize + 1;
  const hasta = desde + resultado.data.length - 1;
  const fichaDe = (sku: string) => hrefCon(params, { producto: sku });

  return (
    <>
      <p aria-live="polite" className="px-5 pb-3 text-[13px] text-muted-foreground">
        {formatNumber(resultado.total)} {resultado.total === 1 ? "producto" : "productos"}
        {filtrado ? " con los filtros aplicados" : " activos y agotados, los más vendidos primero"}. Tocá uno para ver
        su ficha.
      </p>
      {vista === "grilla" ? (
        <ul className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {resultado.data.map((producto) => (
            <ProductoTile key={producto.sku} producto={producto} href={fichaDe(producto.sku)} />
          ))}
        </ul>
      ) : (
        <Table className="min-w-3xl">
          <TableHeader>
            <TableRow>
              {COLUMNAS.map((columna) => (
                <TableHead
                  key={columna}
                  className={cn((columna === "Bulto" || columna === "Disponible") && "text-right")}
                >
                  {columna}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultado.data.map((producto) => (
              <TableRow key={producto.sku}>
                <TableCell>
                  <Link
                    href={fichaDe(producto.sku)}
                    scroll={false}
                    prefetch={false}
                    className="flex items-center gap-3 rounded-lg"
                  >
                    <FotoDeProducto url={producto.foto} sku={producto.sku} colores={producto.colores} tamano="sm" />
                    <span className="min-w-0">
                      <span className="block max-w-72 truncate font-medium hover:underline">{producto.nombre}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{producto.sku}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {producto.rubro ?? "Sin rubro"}
                  <span className="block text-xs">{producto.subrubro}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {producto.bulto ? formatCurrency(producto.bulto.precio) : "—"}
                  <span className="block text-xs text-muted-foreground">{producto.bulto?.codigo}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(producto.bultosDisponibles)}</TableCell>
                <TableCell>
                  <VigenciaBadge producto={producto} />
                </TableCell>
                <TableCell>
                  <SaludBadge producto={producto} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination
        label="Paginación de productos"
        from={desde}
        to={hasta}
        total={resultado.total}
        prevHref={resultado.page > 1 ? hrefCon(params, { page: resultado.page - 1 }) : null}
        nextHref={resultado.page < resultado.totalPages ? hrefCon(params, { page: resultado.page + 1 }) : null}
      />
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

function ProductosHeader({ children }: { children: React.ReactNode }) {
  return (
    <CardHeader className="pb-4">
      <div className="w-full">
        <CardTitle>Productos</CardTitle>
        <CardDescription>
          Se arma cada noche desde el Sheet, Drive y DUX. Los datos se corrigen ahí: la ficha dice dónde.
        </CardDescription>
      </div>
      {children}
    </CardHeader>
  );
}

/** Card de productos: filtros en la URL y la grilla o la lista. */
export async function CatalogoProductosCard({
  searchParams,
  children,
}: {
  searchParams: Promise<SearchParams>;
  children: React.ReactNode;
}) {
  const facetas = await api.catalogo.facetas(queryDe(await searchParams));
  return (
    <Card className="overflow-hidden">
      <ProductosHeader>
        <Suspense fallback={<CatalogoFiltrosFallback />}>
          <CatalogoFiltros facetas={facetas} />
        </Suspense>
      </ProductosHeader>
      {children}
    </Card>
  );
}

export function CatalogoProductosCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <ProductosHeader>
        <CatalogoFiltrosFallback />
      </ProductosHeader>
      <CatalogoProductosSkeleton />
    </Card>
  );
}
