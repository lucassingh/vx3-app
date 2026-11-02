import { ChevronLeft, ChevronRight, CircleCheck, Clock, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EstadoPedidoBadge, OrigenBadge } from "@/components/kit/badges";
import { EmptyState } from "@/components/kit/empty-state";
import { Meter } from "@/components/kit/meter";
import { SearchField, UrlSearch } from "@/components/kit/url-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AsyncWidget } from "@/components/views/async-widget";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { toQueryString } from "@/lib/api/http";
import type { Canal, EstadoPedido, PedidoTrabado } from "@/lib/api/types";
import { CANAL, ESTADO_PEDIDO, ESTADOS_PEDIDO_ORDEN, MEDIO_PAGO, TRANSPORTE, ZONA } from "@/lib/domain";
import { formatCurrency, formatNumber, formatRelativeTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PedidoDetalle } from "./pedido-detalle";
import { SidePanel } from "./side-panel";
import { UrlSelect, UrlSelectFallback } from "./url-select";

type SearchParams = Record<string, string | string[] | undefined>;

const BASE = "/pedidos/bandeja";
const PAGE_SIZE = 8;
const COLUMNS = ["Pedido", "Clienta", "Canal", "Bultos", "Total", "Envío y pago", "Estado"];
const ESTADOS_FILTRO: EstadoPedido[] = [...ESTADOS_PEDIDO_ORDEN, "devuelto", "anulado"];

const canalOptions = (Object.keys(CANAL) as Canal[]).map((value) => ({ value, label: CANAL[value].label }));

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/* ---- Tabla ---------------------------------------------------------------- */

export function PedidosCard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center pb-4">
        <div>
          <CardTitle>Todos los pedidos</CardTitle>
          <CardDescription>Bot, vidriera, local y Tienda Nube, buscados por número, nunca por nombre</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Suspense fallback={<UrlSelectFallback label="Filtrar por canal" allLabel="Todos los canales" />}>
            <UrlSelect param="canal" label="Filtrar por canal" allLabel="Todos los canales" options={canalOptions} />
          </Suspense>
          <Suspense fallback={<SearchField disabled aria-label="Buscar pedidos" placeholder="Número, clienta o teléfono" />}>
            <UrlSearch label="Buscar pedidos" placeholder="Número, clienta o teléfono" />
          </Suspense>
        </div>
      </CardHeader>

      <AsyncWidget
        title="los pedidos"
        className="rounded-none border-x-0 border-b-0 shadow-none"
        fallback={<PedidosTablaSkeleton />}
      >
        <PedidosTabla searchParams={searchParams} />
      </AsyncWidget>
    </Card>
  );
}

async function PedidosTabla({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = param(params.q) ?? "";
  const canal = param(params.canal) as Canal | undefined;
  const estado = param(params.estado) as EstadoPedido | undefined;
  const result = await api.pedidos.list({ q, canal, estado, page: Number(params.page) || 1, pageSize: PAGE_SIZE });

  const href = (overrides: Record<string, string | number | undefined>) =>
    `${BASE}${toQueryString({ q: q || undefined, canal, estado, ...overrides })}`;
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);

  const tabs = [
    { value: undefined, label: "Todos", count: result.totalSinEstado },
    ...ESTADOS_FILTRO.filter((item) => result.conteos[item]).map((item) => ({
      value: item,
      label: ESTADO_PEDIDO[item].label,
      count: result.conteos[item] ?? 0,
    })),
  ];

  return (
    <>
      <nav aria-label="Filtrar por estado" className="scrollbar-thin flex gap-1.5 overflow-x-auto border-t border-border px-5 py-3">
        {tabs.map((tab) => {
          const active = tab.value === estado || (!tab.value && !estado);
          return (
            <Link
              key={tab.label}
              href={href({ estado: tab.value, page: undefined })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                active
                  ? "border-transparent bg-primary/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="tabular-nums text-muted-foreground">{tab.count}</span>
            </Link>
          );
        })}
      </nav>

      <p aria-live="polite" className="sr-only">
        {q ? `${result.total} pedidos para “${q}”` : ""}
      </p>

      <Table className="min-w-5xl">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column} className={cn(column === "Total" && "text-right")}>
                {column}
              </TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.data.map((pedido) => {
            const CanalIcon = CANAL[pedido.canal].icon;
            return (
              <TableRow key={pedido.id}>
                <TableCell>
                  <p className="font-mono text-[13px] font-medium">{pedido.id}</p>
                  <p className="text-xs text-muted-foreground first-letter:uppercase">
                    <time dateTime={pedido.creadoAt}>{formatRelativeTime(pedido.creadoAt)}</time>
                  </p>
                </TableCell>
                <TableCell>
                  <p className="max-w-44 truncate font-medium">{pedido.clienta.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {pedido.clienta.localidad} · {ZONA[pedido.clienta.zona].short}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <CanalIcon aria-hidden className="size-3.5 text-muted-foreground" />
                    {CANAL[pedido.canal].label}
                  </span>
                  <span className="mt-1 flex">
                    <OrigenBadge origen={pedido.origen} />
                  </span>
                </TableCell>
                <TableCell>
                  <p className="tabular-nums">{pedido.bultos} {pedido.bultos === 1 ? "bulto" : "bultos"}</p>
                  <p className="max-w-48 truncate font-mono text-[11px] text-muted-foreground">{pedido.resumen}</p>
                </TableCell>
                <TableCell className="text-right">
                  <p className="font-medium tabular-nums">{formatCurrency(pedido.total)}</p>
                  {pedido.faltaParaMinimo > 0 && (
                    <p className="text-xs text-warning">Bajo el mínimo</p>
                  )}
                </TableCell>
                <TableCell>
                  <p className="max-w-44 truncate">{TRANSPORTE[pedido.transporte]}</p>
                  <p className="text-xs text-muted-foreground">{MEDIO_PAGO[pedido.pago]}</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <EstadoPedidoBadge estado={pedido.estado} />
                    {pedido.trabado && <span className="text-xs text-warning">Trabado</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <SidePanel
                    trigger="Ver"
                    triggerLabel={`Ver el pedido ${pedido.id}`}
                    title={`Pedido ${pedido.id}`}
                    description={`${pedido.clienta.nombre} · ${formatCurrency(pedido.total)}`}
                  >
                    <PedidoDetalle pedido={pedido} />
                  </SidePanel>
                </TableCell>
              </TableRow>
            );
          })}
          {result.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1}>
                <EmptyState
                  title="No hay pedidos con estos filtros"
                  description={q ? `Nada coincide con “${q}”. Probá con el número de pedido o el teléfono.` : "Cambiá el estado o el canal."}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <nav
        aria-label="Paginación de pedidos"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"
      >
        <p className="text-[13px] text-muted-foreground">
          Mostrando{" "}
          <span className="font-medium text-foreground tabular-nums">
            {from}–{to}
          </span>{" "}
          de <span className="font-medium text-foreground tabular-nums">{formatNumber(result.total)}</span>
        </p>
        <div className="flex items-center gap-2">
          <PageLink href={href({ page: result.page - 1 > 1 ? result.page - 1 : undefined })} disabled={result.page <= 1}>
            <ChevronLeft />
            Anterior
          </PageLink>
          <PageLink href={href({ page: result.page + 1 })} disabled={result.page >= result.totalPages}>
            Siguiente
            <ChevronRight />
          </PageLink>
        </div>
      </nav>
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} scroll={false}>
        {children}
      </Link>
    </Button>
  );
}

function PedidosTablaSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando pedidos…</LoadingLabel>
      <div className="flex gap-1.5 border-t border-border px-5 py-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <TableSkeleton columns={[...COLUMNS, ""]} rows={PAGE_SIZE} className="min-w-5xl" />
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-44" />
      </div>
    </>
  );
}

/* ---- Trabados (RN-70 a RN-77) --------------------------------------------- */

export function TrabadosSection() {
  return (
    <section aria-labelledby="trabados-title" className="space-y-3">
      <div>
        <h2 id="trabados-title" className="text-[15px] font-semibold tracking-tight">
          Pedidos trabados
        </h2>
        <p className="text-[13px] text-muted-foreground">
          El bot sigue la secuencia solo: un mensaje por vez, una palanca por mensaje, y a las 24 h se anula y se
          libera la reserva. Nunca llega a DUX un pedido que no se confirmó.
        </p>
      </div>
      <AsyncWidget
        title="los pedidos trabados"
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton>
              <SkeletonText lines={6} />
            </CardSkeleton>
            <CardSkeleton>
              <SkeletonText lines={6} />
            </CardSkeleton>
          </div>
        }
      >
        <TrabadosGrid />
      </AsyncWidget>
    </section>
  );
}

async function TrabadosGrid() {
  const trabados = await api.pedidos.trabados();
  if (trabados.length === 0) {
    return (
      <Card>
        <EmptyState icon={CircleCheck} title="No hay pedidos trabados" description="Todos los pedidos armándose tuvieron respuesta." />
      </Card>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {trabados.map((trabado) => (
        <TrabadoCard key={trabado.pedido.id} trabado={trabado} />
      ))}
    </div>
  );
}

function TrabadoCard({ trabado }: { trabado: PedidoTrabado }) {
  const { pedido } = trabado;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{pedido.id}</span>
            <span className="font-normal text-muted-foreground">·</span>
            <span className="truncate">{pedido.clienta.nombre}</span>
          </CardTitle>
          <CardDescription>
            {formatCurrency(pedido.total)} · {pedido.resumen}
          </CardDescription>
        </div>
        <Badge variant="warning" dot>
          {trabado.motivo === "bajo_minimo" ? "Bajo el mínimo" : "Sin respuesta"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <ol className="space-y-2">
          {trabado.pasos.map((paso) => (
            <li key={paso.id} className="flex items-center gap-2.5 text-sm">
              {paso.estado === "hecho" ? (
                <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
              ) : (
                <Clock
                  aria-hidden
                  className={cn("size-4 shrink-0", paso.estado === "proximo" ? "text-primary" : "text-muted-foreground")}
                />
              )}
              <span className={cn("min-w-0 flex-1", paso.estado === "pendiente" && "text-muted-foreground")}>
                {paso.label}
                <span className="sr-only">
                  {paso.estado === "hecho" ? " (hecho)" : paso.estado === "proximo" ? " (próximo)" : " (pendiente)"}
                </span>
              </span>
              {paso.at ? (
                <time dateTime={paso.at} className="text-xs tabular-nums text-muted-foreground">
                  {formatTime(paso.at)}
                </time>
              ) : paso.estado === "proximo" ? (
                <span className="text-xs font-medium text-primary">Próximo</span>
              ) : null}
            </li>
          ))}
        </ol>

        {pedido.faltaParaMinimo > 0 && (
          <div className="space-y-1.5">
            <p className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">Mercadería {formatCurrency(pedido.mercaderia)}</span>
              <span className="font-medium">Faltan {formatCurrency(pedido.faltaParaMinimo)}</span>
            </p>
            <Meter
              value={pedido.mercaderia}
              max={pedido.mercaderia + pedido.faltaParaMinimo}
              label="Avance al mínimo de compra"
              valueText={`${formatCurrency(pedido.mercaderia)} de ${formatCurrency(pedido.mercaderia + pedido.faltaParaMinimo)}`}
              tone="warning"
            />
          </div>
        )}

        <figure className="space-y-1.5">
          <figcaption className="text-xs text-muted-foreground">
            Último mensaje del bot{trabado.palanca ? ` · palanca “${trabado.palanca}”` : ""}
          </figcaption>
          <blockquote className="rounded-xl rounded-tl-sm bg-primary/8 px-3.5 py-2.5 text-[13px] leading-relaxed">
            {trabado.ultimoMensaje}
          </blockquote>
        </figure>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/conversaciones">
              <MessagesSquare />
              Abrir la conversación
            </Link>
          </Button>
          <SidePanel
            trigger="Ver el pedido"
            triggerLabel={`Ver el pedido ${pedido.id}`}
            title={`Pedido ${pedido.id}`}
            description={`${pedido.clienta.nombre} · ${formatCurrency(pedido.total)}`}
            variant="ghost"
          >
            <PedidoDetalle pedido={pedido} />
          </SidePanel>
        </div>
      </CardContent>
    </Card>
  );
}
