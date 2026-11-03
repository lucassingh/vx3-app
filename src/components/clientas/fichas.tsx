import { Suspense } from "react";
import Link from "next/link";
import { Megaphone, Store, UserRound, ShoppingBag } from "lucide-react";
import { SegmentoBadge } from "@/components/kit/badges";
import { Meter } from "@/components/kit/meter";
import { SearchField, UrlSearch } from "@/components/kit/url-search";
import { EmptyState } from "@/components/kit/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AsyncWidget } from "@/components/views/async-widget";
import { TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { toQueryString } from "@/lib/api/http";
import type { OrigenClientaTipo, Segmento } from "@/lib/api/types";
import { SEGMENTO, ZONA } from "@/lib/domain";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { diasLabel, Pagination, param, type SearchParams } from "./shared";

const BASE = "/clientas/fichas";
const PAGE_SIZE = 8;
const SEGMENTOS = Object.keys(SEGMENTO) as Segmento[];

function readSegmento(params: SearchParams) {
  const value = param(params, "segmento");
  return value && (SEGMENTOS as string[]).includes(value) ? (value as Segmento) : undefined;
}

/* ---- Resumen por segmento (también filtra la tabla) ------------------------ */

export async function SegmentosResumen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, segmentos] = await Promise.all([searchParams, api.clientas.segmentos()]);
  const activo = readSegmento(params);
  const q = param(params, "q");

  return (
    <section aria-label="Clientas por segmento" className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {segmentos.map((item) => {
        const selected = activo === item.segmento;
        const href = `${BASE}${toQueryString({ q, segmento: selected ? undefined : item.segmento })}`;
        return (
          <Link
            key={item.segmento}
            href={href}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "group rounded-xl border border-border bg-surface p-5 shadow-card transition-[background-color,border-color,box-shadow] duration-150 hover:bg-muted/40",
              selected && "border-primary/60 ring-[3px] ring-primary/15",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <SegmentoBadge segmento={item.segmento} />
              <span className="text-xs text-muted-foreground">{selected ? "Filtrando" : "Filtrar"}</span>
            </div>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
                {item.clientas}
              </span>
              <span className="text-[13px] text-muted-foreground">{item.clientas === 1 ? "clienta" : "clientas"}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {formatPercent(item.participacion, { maximumFractionDigits: 0 })}
              </span>{" "}
              del margen · {formatCurrencyCompact(item.margen)}
            </p>
            <Meter
              className="mt-2"
              value={item.participacion}
              label={`Parte del margen de las clientas ${SEGMENTO[item.segmento].label.toLowerCase()}`}
              valueText={formatPercent(item.participacion, { maximumFractionDigits: 0 })}
            />
            <p className="mt-3 text-xs text-pretty text-muted-foreground">{SEGMENTO[item.segmento].description}</p>
          </Link>
        );
      })}
    </section>
  );
}

export function SegmentosResumenSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
      <LoadingLabel>Cargando segmentos…</LoadingLabel>
      {Array.from({ length: 5 }, (_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="mt-4 h-7 w-14" />
          <Skeleton className="mt-3 h-3.5 w-32" />
          <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-3 h-3 w-40" />
        </Card>
      ))}
    </div>
  );
}

/* ---- Tabla de clientas ------------------------------------------------------ */

const COLUMNS = ["Clienta", "Localidad", "Segmento", "Origen", "Pedidos", "Total comprado", "Última compra", "Ciclo"];

const origenIcon: Record<OrigenClientaTipo, typeof Megaphone> = {
  anuncio: Megaphone,
  organico: UserRound,
  local: Store,
  tiendanube: ShoppingBag,
};

export function ClientasCard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center pb-4">
        <div>
          <CardTitle>Todas las clientas</CardTitle>
          <CardDescription>Una ficha por teléfono normalizado, con lo que compró en cada canal</CardDescription>
        </div>
        <Suspense fallback={<SearchField disabled aria-label="Buscar clientas" />}>
          <UrlSearch label="Buscar clientas" placeholder="Nombre, teléfono o localidad" />
        </Suspense>
      </CardHeader>

      <AsyncWidget
        title="las clientas"
        className="rounded-none border-x-0 border-b-0 shadow-none"
        fallback={<ClientasTableSkeleton />}
      >
        <ClientasTable searchParams={searchParams} />
      </AsyncWidget>
    </Card>
  );
}

async function ClientasTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = param(params, "q");
  const segmento = readSegmento(params);
  const page = Number(param(params, "page")) || 1;
  const result = await api.clientas.list({ q, segmento, page, pageSize: PAGE_SIZE });

  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);
  const href = (extra: Record<string, string | number | undefined>) =>
    `${BASE}${toQueryString({ q, segmento, page: result.page > 1 ? result.page : undefined, ...extra })}`;
  const pageHref = (target: number) =>
    `${BASE}${toQueryString({ q, segmento, page: target > 1 ? target : undefined })}`;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {q || segmento ? `${result.total} clientas encontradas` : ""}
      </p>

      {segmento && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-5 py-2.5 text-[13px]">
          <span className="text-muted-foreground">Segmento:</span>
          <SegmentoBadge segmento={segmento} />
          <Link
            href={`${BASE}${toQueryString({ q })}`}
            scroll={false}
            className="ml-auto rounded font-medium text-foreground underline-offset-4 hover:underline"
          >
            Quitar filtro
          </Link>
        </div>
      )}

      <Table className="min-w-5xl">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column, index) => (
              <TableHead key={column} className={cn((index === 4 || index === 5) && "text-right")}>
                {column}
              </TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.data.map((clienta) => {
            const OrigenIcon = origenIcon[clienta.origen];
            return (
              <TableRow key={clienta.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={clienta.nombre} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{clienta.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">{clienta.telefono}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="truncate">{clienta.localidad}</p>
                  <p className="text-xs text-muted-foreground">{ZONA[clienta.zona].label}</p>
                </TableCell>
                <TableCell>
                  <SegmentoBadge segmento={clienta.segmento} />
                </TableCell>
                <TableCell>
                  <span className="flex max-w-52 items-center gap-1.5 text-[13px]">
                    <OrigenIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{clienta.origenLabel}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(clienta.pedidos)}</TableCell>
                <TableCell className="text-right">
                  <p className="font-medium tabular-nums">{formatCurrency(clienta.totalComprado)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Margen {formatCurrencyCompact(clienta.margen)}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {diasLabel(clienta.ultimaCompraDias)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {clienta.cicloDias ? `Cada ${clienta.cicloDias} días` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={href({ clienta: clienta.id })} scroll={false}>
                      Ver ficha<span className="sr-only"> de {clienta.nombre}</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {result.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1}>
                <EmptyState
                  title="No hay clientas con ese filtro"
                  description={q ? `Nada coincide con “${q}”. Probá con el teléfono o la localidad.` : undefined}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        label="Paginación de clientas"
        from={from}
        to={to}
        total={result.total}
        prevHref={result.page > 1 ? pageHref(result.page - 1) : null}
        nextHref={result.page < result.totalPages ? pageHref(result.page + 1) : null}
      />
    </>
  );
}

function ClientasTableSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando clientas…</LoadingLabel>
      <TableSkeleton columns={[...COLUMNS, ""]} rows={PAGE_SIZE} className="min-w-5xl" />
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-44" />
      </div>
    </>
  );
}
