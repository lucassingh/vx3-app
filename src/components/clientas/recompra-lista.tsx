"use client";

import { Check, CheckCheck, Clock, MessageCircle, PartyPopper, Reply, TriangleAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { SegmentoBadge } from "@/components/kit/badges";
import { EmptyState } from "@/components/kit/empty-state";
import { Meter } from "@/components/kit/meter";
import { ProductThumb } from "@/components/kit/product-thumb";
import { SearchField } from "@/components/kit/url-search";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { ClientaParaRecompra, RecompraEsperando, RecompraEstado, RecompraTipo } from "@/lib/api/types";
import { formatNumber, primerNombre } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn, normalizeText } from "@/lib/utils";
import { faltaCompletar } from "@/modules/customers/secuencia";

/** Item de la lista con los textos ya formateados en el servidor. */
export type RecompraItemView = ClientaParaRecompra & {
  totalTexto: string;
  ultimoPedidoTexto: string;
  ultimoPedidoDetalle: string;
};

type Filtro = "todas" | RecompraTipo | "esperando";

const FILTROS: { value: "todas" | RecompraTipo; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "recompra", label: "Recompra" },
  { value: "reactivacion", label: "Reactivación" },
];

const ESTADO_BADGE: Record<RecompraEstado, { label: string; variant: "neutral" | "success" | "outline" }> = {
  pendiente: { label: "Pendiente", variant: "outline" },
  contactada: { label: "Contactada", variant: "success" },
  respondio: { label: "Respondió", variant: "success" },
  pospuesta: { label: "Pospuesta", variant: "neutral" },
};

export function RecompraLista({
  initialItems,
  initialEsperando,
  enCola,
  tope,
}: {
  initialItems: RecompraItemView[];
  initialEsperando: RecompraEsperando[];
  enCola: number;
  tope: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [esperando, setEsperando] = useState(initialEsperando);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const hechas = items.filter(({ estado }) => estado === "contactada" || estado === "respondio").length;
  const patch = (id: string, values: Partial<RecompraItemView>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...values } : item)));

  const cambiarEstado = async (item: RecompraItemView, estado: RecompraEstado, avisar = true) => {
    const anterior = item.estado;
    const nombre = primerNombre(item.nombre);
    patch(item.id, { estado });
    try {
      await api.clientas.marcarRecompra(item.id, { estado, mensaje: item.mensaje });
      if (!avisar) return;
      const deshacer = { label: "Deshacer", onClick: () => cambiarEstado({ ...item, estado }, anterior, false) };
      if (estado === "contactada") toast.success(`${nombre} quedó como contactada`, { action: deshacer });
      if (estado === "respondio") toast.success(`${nombre} sale de la secuencia`, { action: deshacer });
      if (estado === "pospuesta") toast.success(`${nombre} vuelve mañana a la lista`, { action: deshacer });
    } catch {
      patch(item.id, { estado: anterior });
      toast.error(`No se pudo actualizar a ${nombre}`, {
        description: "Revisá la conexión e intentá de nuevo.",
        action: { label: "Reintentar", onClick: () => cambiarEstado(item, estado, avisar) },
      });
    }
  };

  const marcarRespuesta = async (espera: RecompraEsperando, estado: RecompraEsperando["estado"]) => {
    const nombre = primerNombre(espera.nombre);
    const cambiar = (nuevo: RecompraEsperando["estado"]) =>
      setEsperando((current) => current.map((entry) => (entry.id === espera.id ? { ...entry, estado: nuevo } : entry)));
    cambiar(estado);
    try {
      await api.clientas.marcarRecompra(espera.id, { estado });
      if (estado === "respondio") toast.success(`${nombre} sale de la secuencia`);
    } catch {
      cambiar(espera.estado);
      toast.error(`No se pudo actualizar a ${nombre}`, {
        description: "Revisá la conexión e intentá de nuevo.",
        action: { label: "Reintentar", onClick: () => marcarRespuesta(espera, estado) },
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Para contactar hoy</CardTitle>
          <CardDescription>
            Hasta {tope} por día, primero las que más margen dejan. La app no manda nada: cada mensaje se escribe a mano
            desde WhatsApp.
            {enCola > 0 && ` A otras ${formatNumber(enCola)} les toca y esperan lugar en los próximos días.`}
          </CardDescription>
        </div>
        <div className="w-full space-y-2 sm:w-60">
          <p aria-live="polite" className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{hechas}</span> de{" "}
            <span className="tabular-nums">{items.length}</span> contactadas
          </p>
          <Meter
            value={hechas}
            max={Math.max(items.length, 1)}
            tone="success"
            label="Avance de la lista de hoy"
            valueText={`${hechas} de ${items.length} contactadas`}
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
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="esperando">
              Esperan respuesta
              <span className="text-muted-foreground tabular-nums">
                {esperando.filter(({ estado }) => estado === "contactada").length}
              </span>
            </TabsTrigger>
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

          <TabsContent value="esperando" className="mt-5">
            <Esperando items={esperando} onRespuesta={marcarRespuesta} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Esperando({
  items,
  onRespuesta,
}: {
  items: RecompraEsperando[];
  onRespuesta: (item: RecompraEsperando, estado: RecompraEsperando["estado"]) => void;
}) {
  const [buscado, setBuscado] = useState("");
  const texto = normalizeText(buscado.trim());
  const digitos = texto.replace(/\D/g, "");
  const visibles = items.filter(
    ({ nombre, telefono }) =>
      !texto ||
      normalizeText(nombre).includes(texto) ||
      (digitos.length >= 3 && telefono.replace(/\D/g, "").includes(digitos)),
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCheck}
        title="Nadie esperando respuesta"
        description="Las contactadas de la última semana aparecen acá, para marcar a las que respondan."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-pretty text-muted-foreground">
        Las contactadas de la última semana. Si te responde, marcala: sale de la secuencia y queda para atenderla vos.
      </p>
      <SearchField
        value={buscado}
        onChange={(event) => setBuscado(event.target.value)}
        aria-label="Buscar entre las contactadas"
        placeholder="Nombre o teléfono"
      />
      <ul className="divide-y divide-border rounded-xl border border-border">
        {visibles.map((item) => (
          <li key={`${item.id}-${item.contactadaHaceDias}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={item.nombre} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.nombre}</p>
              <p className="truncate text-xs text-muted-foreground tabular-nums">
                {item.telefono} · {item.etapaLabel} · hace {item.contactadaHaceDias}{" "}
                {item.contactadaHaceDias === 1 ? "día" : "días"}
              </p>
            </div>
            {item.estado === "respondio" ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">Respondió</Badge>
                <Button variant="ghost" size="sm" onClick={() => onRespuesta(item, "contactada")}>
                  <Undo2 />
                  Deshacer<span className="sr-only"> la respuesta de {item.nombre}</span>
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onRespuesta(item, "respondio")}>
                <Reply />
                Respondió<span className="sr-only"> {item.nombre}</span>
              </Button>
            )}
          </li>
        ))}
        {visibles.length === 0 && (
          <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">
            Ninguna coincide con esa búsqueda.
          </li>
        )}
      </ul>
    </div>
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
  const incompleto = faltaCompletar(item.mensaje);
  const waHref = `https://wa.me/${item.telefonoWa}?text=${encodeURIComponent(item.mensaje)}`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border border-border p-4 transition-[background-color,border-color,opacity] duration-200 sm:p-5",
        (item.estado === "contactada" || item.estado === "respondio") && "border-success/30 bg-success/5",
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
            <p className="truncate text-xs text-muted-foreground tabular-nums">{item.telefono}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.segmento && <SegmentoBadge segmento={item.segmento} />}
          <Badge variant={estado.variant}>{estado.label}</Badge>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium">{item.etapaLabel}</p>
      <p className="text-[13px] text-muted-foreground">{item.motivo}</p>
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
              <dt className="text-muted-foreground">Última compra</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{item.ultimoPedidoTexto}</dd>
              <dd className="truncate text-xs text-muted-foreground">{item.ultimoPedidoDetalle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total comprado</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{item.totalTexto}</dd>
            </div>
          </dl>
          {item.skus.length > 0 && (
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
          )}
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
          <p id={hintId} className="text-xs text-muted-foreground">
            {incompleto
              ? "Falta completar lo que está entre corchetes: hasta entonces no se puede mandar."
              : "Se abre WhatsApp con este texto, y lo mandás vos."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {incompleto ? (
          <Button size="sm" disabled aria-describedby={hintId}>
            <MessageCircle />
            Abrir en WhatsApp
          </Button>
        ) : (
          <Button size="sm" asChild>
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Abrir en WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Button>
        )}
        {item.estado === "pendiente" && (
          <Button variant="outline" size="sm" onClick={() => onEstado("contactada")}>
            <Check />
            Marcar como contactada
          </Button>
        )}
        {item.estado === "contactada" && (
          <>
            <Button variant="outline" size="sm" onClick={() => onEstado("respondio")}>
              <Reply />
              Respondió
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEstado("pendiente")}>
              <Undo2 />
              Volver a pendiente
            </Button>
          </>
        )}
        {item.estado === "respondio" && (
          <Button variant="ghost" size="sm" onClick={() => onEstado("contactada")}>
            <Undo2 />
            No respondió
          </Button>
        )}
        {item.estado === "pendiente" && (
          <Button variant="ghost" size="sm" onClick={() => onEstado("pospuesta")}>
            <Clock />
            Posponer a mañana
          </Button>
        )}
        {item.estado === "pospuesta" && (
          <Button variant="ghost" size="sm" onClick={() => onEstado("pendiente")}>
            <Undo2 />
            Volver a la lista
          </Button>
        )}
      </div>
    </article>
  );
}
