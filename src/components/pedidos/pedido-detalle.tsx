import { MessagesSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { EstadoPedidoBadge, OrigenBadge } from "@/components/kit/badges";
import { Meter } from "@/components/kit/meter";
import { Button } from "@/components/ui/button";
import type { PedidoBandeja } from "@/lib/api/types";
import { BANCO, CANAL, ESTADO_PEDIDO, MEDIO_PAGO, TRANSPORTE, ZONA } from "@/lib/domain";
import { formatCurrency, formatNumber, formatRelativeTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const MINIMO = 45_000;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

/** Detalle de un pedido para el panel lateral. Server Component: todo llega formateado. */
export function PedidoDetalle({ pedido }: { pedido: PedidoBandeja }) {
  const canal = CANAL[pedido.canal];
  const CanalIcon = canal.icon;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <EstadoPedidoBadge estado={pedido.estado} />
        <OrigenBadge origen={pedido.origen} />
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CanalIcon aria-hidden className="size-3.5" />
          {canal.label}
        </span>
      </div>
      {pedido.anuncio && (
        <p className="-mt-3 text-[13px] text-muted-foreground">
          Vino del anuncio <span className="font-medium text-foreground">{pedido.anuncio}</span>
        </p>
      )}
      {pedido.nota && (
        <p className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-[13px] text-foreground">
          {pedido.nota}
        </p>
      )}

      <Section title="Clienta">
        <div className="space-y-1">
          <p className="text-sm font-medium">{pedido.clienta.nombre}</p>
          <p className="text-[13px] text-muted-foreground">
            {pedido.clienta.telefono} · {pedido.clienta.localidad} · CP {pedido.clienta.cp} ·{" "}
            {ZONA[pedido.clienta.zona].label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/conversaciones">
              <MessagesSquare />
              Ver la conversación
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/clientas/fichas">
              <UserRound />
              Ver la ficha
            </Link>
          </Button>
        </div>
      </Section>

      <Section title="Mercadería">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {pedido.lineas.map((linea) => (
            <li key={linea.codigo} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{linea.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{linea.codigo}</span> · {linea.presentacion} ×{linea.bultos} ·{" "}
                  {formatCurrency(linea.precioUnitario)} c/u
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">{formatCurrency(linea.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5">
          <Row label="Mercadería">{formatCurrency(pedido.mercaderia)}</Row>
          <Row label="Embalaje">{formatCurrency(pedido.embalaje)}</Row>
          <Row label="Envío">{pedido.envio > 0 ? formatCurrency(pedido.envio) : "—"}</Row>
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2 text-sm font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(pedido.total)}</dd>
          </div>
        </dl>
        {pedido.faltaParaMinimo > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/60 p-3">
            <p className="text-[13px]">
              Faltan <span className="font-semibold">{formatCurrency(pedido.faltaParaMinimo)}</span> para el
              mínimo de {formatCurrency(MINIMO)}. Se pide un complementario por la diferencia, no un pedido nuevo.
            </p>
            <Meter
              value={pedido.mercaderia}
              max={MINIMO}
              label="Avance al mínimo"
              valueText={`${formatCurrency(pedido.mercaderia)} de ${formatCurrency(MINIMO)}`}
              tone="warning"
            />
          </div>
        )}
      </Section>

      <Section title="Envío y pago">
        <dl className="space-y-1.5">
          <Row label="Transporte">{TRANSPORTE[pedido.transporte]}</Row>
          <Row label="Peso">{formatNumber(pedido.pesoKg)} kg</Row>
          <Row label="Pago">
            {MEDIO_PAGO[pedido.pago]}
            {pedido.banco && ` · ${BANCO[pedido.banco]}`}
          </Row>
          <Row label="Comprobante">{pedido.factura ?? "Sin facturar"}</Row>
        </dl>
      </Section>

      <Section title="Recorrido">
        <ol className="relative ml-1.5 space-y-3 border-l border-border pl-5">
          {pedido.pasos.map((paso) => (
            <li key={paso.estado} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[1.6875rem] top-1 size-2.5 rounded-full border-2 border-surface",
                  paso.actual ? "bg-primary ring-4 ring-primary/15" : paso.hecho ? "bg-primary/60" : "bg-border-strong",
                )}
              />
              <p className={cn("text-sm", paso.actual ? "font-medium" : !paso.hecho && "text-muted-foreground")}>
                {ESTADO_PEDIDO[paso.estado].label}
                {paso.actual && <span className="sr-only"> (estado actual)</span>}
              </p>
              {paso.at && (
                <p className="text-xs text-muted-foreground first-letter:uppercase">
                  <time dateTime={paso.at}>
                    {formatRelativeTime(paso.at)} · {formatTime(paso.at)}
                  </time>
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
