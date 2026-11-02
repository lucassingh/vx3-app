"use client";

import { ArrowUpRight, Calculator, LifeBuoy, MapPin, Megaphone, Phone, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { EstadoPedidoBadge, SegmentoBadge } from "@/components/kit/badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { TRANSPORTE, ZONA } from "@/lib/domain";
import { toast } from "@/lib/toast";
import type { ConversacionView } from "./view";

const ORIGEN_CLIENTA = {
  anuncio: "Anuncio",
  organico: "Orgánico",
  local: "El local",
  tiendanube: "Tienda Nube",
} as const;

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-[13px]">{children}</dd>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <p className="text-[15px] font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Ficha de la clienta al costado del chat (RF-M11-02) y acciones desde el chat (RF-M11-06). */
export function FichaPanel({ conversacion }: { conversacion: ConversacionView }) {
  const { clienta, ficha, fichaLabels } = conversacion;
  const nombre = clienta.nombre.split(" ")[0];
  const desde = ficha.clientaDesdeDias === 0 ? "Primera compra hoy" : `Clienta hace ${ficha.clientaDesdeDias} días`;

  return (
    <div className="space-y-6 p-5">
      <div className="flex items-center gap-3">
        <Avatar name={clienta.nombre} className="size-11 text-sm" />
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{clienta.nombre}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <SegmentoBadge segmento={ficha.segmento} />
            <span className="text-xs text-muted-foreground">{desde}</span>
          </div>
        </div>
      </div>

      <dl className="space-y-3">
        <Row icon={Phone} label="Teléfono (identidad de la clienta)">
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{clienta.telefono}</span>
            <CopyButton
              value={clienta.telefono}
              label={`Copiar el teléfono de ${clienta.nombre}`}
              successMessage="Teléfono copiado"
            />
          </span>
        </Row>
        <Row icon={MapPin} label="Localidad">
          {ficha.localidad}, {ficha.provincia} · CP {ficha.cp}
        </Row>
        <Row icon={Truck} label="Zona de envío">
          {ZONA[ficha.zona].label}
        </Row>
        <Row icon={Megaphone} label="Llegó por">
          {ORIGEN_CLIENTA[ficha.origen.tipo]}
          {ficha.origen.anuncio && <span className="block text-muted-foreground">{ficha.origen.anuncio}</span>}
        </Row>
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Últimos 30 días" value={fichaLabels.total30d} />
        <Stat label="Ticket promedio" value={fichaLabels.ticketPromedio} />
        <Stat label="Pedidos en total" value={String(ficha.pedidosHistoricos)} />
        <Stat label="Comprado en total" value={fichaLabels.totalComprado} />
      </div>

      <section aria-labelledby="ficha-pedidos" className="space-y-2.5">
        <h3 id="ficha-pedidos" className="text-[13px] font-semibold">
          Pedidos recientes
        </h3>
        {ficha.pedidos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No tiene pedidos en los últimos días.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {ficha.pedidos.map((pedido) => (
              <li key={pedido.id} className="space-y-1.5 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium">{pedido.id}</span>
                  <EstadoPedidoBadge estado={pedido.estado} />
                </div>
                <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate first-letter:uppercase">
                    {fichaLabels.pedidos[pedido.id]?.fecha} · {TRANSPORTE[pedido.transporte]}
                  </span>
                  <span className="shrink-0 font-medium text-foreground tabular-nums">
                    {fichaLabels.pedidos[pedido.id]?.total}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ficha-reclamos" className="space-y-2.5">
        <h3 id="ficha-reclamos" className="text-[13px] font-semibold">
          Reclamos
        </h3>
        {ficha.reclamos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Sin reclamos.</p>
        ) : (
          <ul className="space-y-2">
            {ficha.reclamos.map((reclamo) => (
              <li key={reclamo.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{reclamo.id}</span> · {reclamo.tipo}
                </span>
                <Badge variant={reclamo.estado === "abierto" ? "warning" : "success"} dot>
                  {reclamo.estado === "abierto" ? "Abierto" : "Resuelto"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Acciones" className="grid gap-2">
        <Button
          variant="outline"
          onClick={() =>
            toast.success("Pedido en borrador", {
              description: `Se abrió un pedido para ${nombre} con su zona y su lista mayorista.`,
            })
          }
        >
          <Plus />
          Crear pedido
        </Button>
        <Button variant="outline" asChild>
          <Link href="/envios/cotizador">
            <Calculator />
            Cotizar envío
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.success("Reclamo abierto", {
              description: `Quedó vinculado a ${nombre} y a su último pedido. Lo ve Lucía en Post-venta.`,
            })
          }
        >
          <LifeBuoy />
          Abrir reclamo
        </Button>
        <Button variant="ghost" size="sm" asChild className="justify-self-start">
          <Link href="/clientas/fichas">
            Ver la ficha completa
            <ArrowUpRight />
          </Link>
        </Button>
      </section>
    </div>
  );
}
