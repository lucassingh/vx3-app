"use client";

import {
  Check,
  Clock,
  FileCheck2,
  MessageCircle,
  PartyPopper,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { SegmentoBadge } from "@/components/kit/badges";
import { EmptyState } from "@/components/kit/empty-state";
import { Meter } from "@/components/kit/meter";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { ClientaParaRecompra, RecompraEstado, RecompraTipo } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Item de la lista con los textos ya formateados en el servidor. */
export type RecompraItemView = ClientaParaRecompra & {
  totalTexto: string;
  ultimoPedidoTexto: string;
  ultimoPedidoDetalle: string;
};

type Filtro = "todas" | RecompraTipo;

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "en_riesgo", label: "En riesgo" },
  { value: "reposicion", label: "Les toca reponer" },
  { value: "dormida", label: "Dormidas" },
];

const ESTADO_BADGE: Record<RecompraEstado, { label: string; variant: "neutral" | "success" | "outline" }> = {
  pendiente: { label: "Pendiente", variant: "outline" },
  contactada: { label: "Contactada", variant: "success" },
  pospuesta: { label: "Pospuesta", variant: "neutral" },
};

export function RecompraLista({ initialItems }: { initialItems: RecompraItemView[] }) {
  const [items, setItems] = useState(initialItems);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const contactadas = items.filter((item) => item.estado === "contactada").length;
  const patch = (id: string, values: Partial<RecompraItemView>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...values } : item)));

  const cambiarEstado = async (item: RecompraItemView, estado: RecompraEstado, avisar = true) => {
    const anterior = item.estado;
    const nombre = item.nombre.split(" ")[0];
    patch(item.id, { estado });
    try {
      await api.clientas.marcarRecompra(item.id, { estado, mensaje: item.mensaje });
      if (!avisar) return;
      const deshacer = { label: "Deshacer", onClick: () => cambiarEstado({ ...item, estado }, anterior, false) };
      if (estado === "contactada") toast.success(`${nombre} quedó como contactada`, { action: deshacer });
      if (estado === "pospuesta") toast.success(`${nombre} vuelve mañana a la lista`, { action: deshacer });
    } catch {
      patch(item.id, { estado: anterior });
      toast.error(`No se pudo actualizar a ${nombre}`, {
        description: "Revisá la conexión e intentá de nuevo.",
        action: { label: "Reintentar", onClick: () => cambiarEstado(item, estado, avisar) },
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Para contactar hoy</CardTitle>
          <CardDescription>
            Se arma sola cada mañana: clientas en riesgo, dormidas y las que les toca reponer según su ciclo.
          </CardDescription>
        </div>
        <div className="w-full space-y-2 sm:w-60">
          <p aria-live="polite" className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{contactadas}</span> de{" "}
            <span className="tabular-nums">{items.length}</span> contactadas
          </p>
          <Meter
            value={contactadas}
            max={items.length}
            tone="success"
            label="Avance de la lista de hoy"
            valueText={`${contactadas} de ${items.length} contactadas`}
          />
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <Tabs value={filtro} onValueChange={(value) => setFiltro(value as Filtro)}>
          <TabsList aria-label="Filtrar la lista">
            {FILTROS.map(({ value, label }) => {
              const count = value === "todas" ? items.length : items.filter((item) => item.tipo === value).length;
              return (
                <TabsTrigger key={value} value={value}>
                  {label}
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {FILTROS.map(({ value }) => {
            const visibles = value === "todas" ? items : items.filter((item) => item.tipo === value);
            return (
              <TabsContent key={value} value={value} className="mt-5 space-y-4">
                {visibles.length === 0 ? (
                  <EmptyState icon={PartyPopper} title="Nadie en este grupo hoy" />
                ) : (
                  visibles.map((item) => (
                    <RecompraItem
                      key={item.id}
                      item={item}
                      onMensaje={(mensaje) => patch(item.id, { mensaje })}
                      onEstado={(estado) => cambiarEstado(item, estado)}
                    />
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RecompraItem({
  item,
  onMensaje,
  onEstado,
}: {
  item: RecompraItemView;
  onMensaje: (mensaje: string) => void;
  onEstado: (estado: RecompraEstado) => void;
}) {
  const titleId = `recompra-${item.id}`;
  const mensajeId = `mensaje-${item.id}`;
  const hintId = `mensaje-hint-${item.id}`;
  const estado = ESTADO_BADGE[item.estado];
  const waHref = `https://wa.me/${item.telefonoWa}?text=${encodeURIComponent(item.mensaje)}`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border border-border p-4 transition-[background-color,border-color,opacity] duration-200 sm:p-5",
        item.estado === "contactada" && "border-success/30 bg-success/5",
        item.estado === "pospuesta" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={item.nombre} className="size-9" />
          <div className="min-w-0">
            <h3 id={titleId} className="truncate text-[15px] font-semibold tracking-tight">
              {item.nombre}
            </h3>
            <p className="truncate text-xs tabular-nums text-muted-foreground">{item.telefono}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentoBadge segmento={item.segmento} />
          <Badge variant={estado.variant}>{estado.label}</Badge>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium">{item.motivo}</p>
      {item.nota && (
        <p role="note" className="mt-2 flex items-start gap-2 rounded-lg bg-warning/12 px-3 py-2 text-[13px]">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          {item.nota}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Último pedido</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{item.ultimoPedidoTexto}</dd>
              <dd className="truncate text-xs text-muted-foreground">{item.ultimoPedidoDetalle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total comprado</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{item.totalTexto}</dd>
            </div>
          </dl>
          <div>
            <p className="text-[13px] text-muted-foreground">Suele comprar</p>
            <ul className="mt-2 space-y-2">
              {item.skus.slice(0, 3).map((producto) => (
                <li key={producto.sku} className="flex items-center gap-2.5">
                  <ProductThumb sku={producto.sku} colors={producto.colores} size="sm" />
                  <span className="min-w-0 truncate text-[13px]">{producto.nombre}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={mensajeId}>Mensaje sugerido</Label>
          <Textarea
            id={mensajeId}
            rows={4}
            value={item.mensaje}
            onChange={(event) => onMensaje(event.target.value)}
            aria-describedby={hintId}
          />
          <p id={hintId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            {item.ventanaAbierta ? (
              <>
                <MessageCircle aria-hidden className="mt-px size-3.5 shrink-0 text-success" />
                Escribió en las últimas 24 h: el mensaje sale como texto libre.
              </>
            ) : (
              <>
                <FileCheck2 aria-hidden className="mt-px size-3.5 shrink-0" />
                Pasaron más de 24 h desde su último mensaje: desde la app sale como plantilla aprobada por
                Meta, con costo por mensaje.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button size="sm" asChild>
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle />
            Abrir en WhatsApp
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        </Button>
        {item.estado === "contactada" ? (
          <Button variant="outline" size="sm" onClick={() => onEstado("pendiente")}>
            <Undo2 />
            Volver a pendiente
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onEstado("contactada")}>
            <Check />
            Marcar como contactada
          </Button>
        )}
        {item.estado === "pospuesta" ? (
          <Button variant="ghost" size="sm" onClick={() => onEstado("pendiente")}>
            <Undo2 />
            Volver a la lista
          </Button>
        ) : (
          item.estado === "pendiente" && (
            <Button variant="ghost" size="sm" onClick={() => onEstado("pospuesta")}>
              <Clock />
              Posponer a mañana
            </Button>
          )
        )}
      </div>
    </article>
  );
}
