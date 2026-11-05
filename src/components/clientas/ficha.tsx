import {
  Banknote,
  CheckCircle2,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { EstadoPedidoBadge, SegmentoBadge } from "@/components/kit/badges";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { AsyncWidget } from "@/components/views/async-widget";
import { SkeletonText } from "@/components/views/skeletons";
import { realDomains } from "@/lib/api/dispatch";
import type { ApiDomain } from "@/lib/api/domains";
import { api } from "@/lib/api/server";
import { toQueryString } from "@/lib/api/http";
import type { FichaEventoTipo } from "@/lib/api/types";
import { ZONA } from "@/lib/domain";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FichaDialog } from "./ficha-dialog";
import { param, type SearchParams } from "./shared";

const eventoIcon: Record<FichaEventoTipo, LucideIcon> = {
  pedido: ShoppingBag,
  conversacion: MessageCircle,
  envio: Truck,
  cobro: Banknote,
  reclamo: LifeBuoy,
};

const eventoTone: Record<FichaEventoTipo, string> = {
  pedido: "bg-primary/10 text-primary",
  conversacion: "bg-muted text-muted-foreground",
  envio: "bg-accent/10 text-foreground",
  cobro: "bg-success/10 text-success",
  reclamo: "bg-warning/12 text-warning",
};

/** Abre la ficha si la URL trae `?clienta=`. */
export async function FichaFromParams({
  searchParams,
  basePath,
}: {
  searchParams: Promise<SearchParams>;
  basePath: string;
}) {
  const params = await searchParams;
  const id = param(params, "clienta");
  if (!id) return null;

  const closeHref = `${basePath}${toQueryString({
    q: param(params, "q"),
    segmento: param(params, "segmento"),
    page: param(params, "page"),
  })}`;

  return (
    <FichaDialog key={id} closeHref={closeHref}>
      <AsyncWidget title="la ficha" className="m-5" fallback={<FichaSkeleton />}>
        <FichaContent id={id} />
      </AsyncWidget>
    </FichaDialog>
  );
}

/** Una clienta real no existe en una pantalla simulada, ni al revés: el enlace no llevaría a ningún lado. */
function enlazaCon(dominio: ApiDomain) {
  const reales = realDomains();
  return reales.includes(dominio) === reales.includes("clientas");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

async function FichaContent({ id }: { id: string }) {
  const ficha = await api.clientas.get(id);
  const lugar = [
    [ficha.localidad, ficha.provincia].filter(Boolean).join(", "),
    ficha.cp && `CP ${ficha.cp}`,
    ficha.zona && ZONA[ficha.zona].label,
  ]
    .filter(Boolean)
    .join(" · ");
  const verPedidos = enlazaCon("pedidos");
  const verConversacion = enlazaCon("conversaciones");
  const stats = [
    { label: "Compras", value: String(ficha.pedidos) },
    { label: "Total comprado", value: formatCurrency(ficha.totalComprado) },
    { label: "Ticket promedio", value: formatCurrency(ficha.ticketPromedio) },
    { label: "Valor de vida (margen)", value: formatCurrency(ficha.margen) },
  ];

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar name={ficha.nombre} className="size-11 text-sm" />
          <div className="min-w-0">
            <DialogTitle className="truncate">{ficha.nombre}</DialogTitle>
            <p className="truncate text-[13px] text-muted-foreground">{lugar || "Sin datos de localidad"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {ficha.segmento && <SegmentoBadge segmento={ficha.segmento} />}
          <span className="text-xs text-muted-foreground">
            {ficha.primeraCompraDias === null
              ? "Sin compras en el historial leído"
              : `Clienta desde hace ${formatNumber(ficha.primeraCompraDias)} días`}
            {ficha.cicloDias ? ` · compra cada ${formatNumber(ficha.cicloDias)} días` : ""}
          </span>
        </div>
      </DialogHeader>

      <DialogBody className="space-y-6">
        <dl className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <Section title="Identidad">
          <p className="text-[13px] text-pretty text-muted-foreground">
            Teléfono normalizado{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {ficha.telefonoNormalizado}
            </code>
            : une su historial en todos los sistemas, aunque cada uno lo guarde distinto.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {ficha.identidades.map((identidad, index) => (
              <li key={`${identidad.sistema}-${index}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
                <span className="w-24 shrink-0 font-medium">{identidad.sistema}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs">{identidad.valor}</span>
                  <span className="block truncate text-xs text-muted-foreground">{identidad.detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Cómo llegó">
          {ficha.anuncioOrigen ? (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-foreground">
                <Megaphone aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium">{ficha.anuncioOrigen.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {ficha.anuncioOrigen.campana}. Su recompra suma al valor de vida de ese anuncio.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm">{ficha.origenLabel}</p>
          )}
        </Section>

        {ficha.skusFrecuentes.length > 0 && (
          <Section title="Suele comprar">
            <ul className="space-y-2">
              {ficha.skusFrecuentes.map((producto) => (
                <li key={producto.sku} className="flex items-center gap-3">
                  <ProductThumb sku={producto.sku} colors={producto.colores} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{producto.nombre}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {producto.veces} {producto.veces === 1 ? "compra" : "compras"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Historial">
          {ficha.eventos.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Todavía no hay nada registrado.</p>
          )}
          <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-4 before:w-px before:bg-border">
            {ficha.eventos.map((evento) => {
              const Icon = eventoIcon[evento.tipo];
              return (
                <li key={evento.id} className="relative flex gap-3">
                  <span
                    className={cn(
                      "relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface",
                      eventoTone[evento.tipo],
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium">{evento.titulo}</p>
                      {evento.estado && <EstadoPedidoBadge estado={evento.estado} />}
                    </div>
                    <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">{evento.detalle}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      <time dateTime={evento.fecha} className="first-letter:uppercase">
                        {formatRelativeTime(evento.fecha)}
                      </time>
                      {evento.monto !== undefined && (
                        <span className="font-medium text-foreground tabular-nums">{formatCurrency(evento.monto)}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      </DialogBody>

      {(verPedidos || verConversacion) && (
        <DialogFooter>
          {verPedidos && (
            <Button variant="outline" asChild>
              <Link href={`/pedidos/bandeja${toQueryString({ q: ficha.nombre })}`}>
                <ShoppingBag />
                Ver pedidos
              </Link>
            </Button>
          )}
          {verConversacion && (
            <Button asChild>
              <Link href={`/conversaciones${toQueryString({ clienta: ficha.id })}`}>
                <MessagesSquare />
                Abrir conversación
              </Link>
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}

function FichaSkeleton() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">Ficha de la clienta</DialogTitle>
        <LoadingLabel>Cargando la ficha…</LoadingLabel>
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </DialogHeader>
      <DialogBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
        <SkeletonText lines={4} />
        <SkeletonText lines={6} />
      </DialogBody>
    </>
  );
}
