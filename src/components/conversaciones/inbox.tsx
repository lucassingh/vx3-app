"use client";

import {
  ArrowLeft,
  Bot,
  CircleCheck,
  Megaphone,
  MessageCircle,
  PanelRight,
  Repeat,
  Store,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SearchField } from "@/components/kit/url-search";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { Conversacion, LineaWhatsapp, NuevoMensaje, PlantillaWhatsapp, RespuestaRapida } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { cn, normalizeText } from "@/lib/utils";
import { Composer } from "./composer";
import { FichaPanel } from "./ficha-panel";
import { ESTADO_CONVERSACION, ETAPA_CONVERSACION, FILTROS, LINEA, type FiltroBandeja } from "./labels";
import { MessageItem } from "./message-item";
import { TakeDialog } from "./take-dialog";
import { toConversacionView, type ConversacionView, type MensajeView } from "./view";

/** Usuario que opera la bandeja (el de la sesión). */
const YO = "Elías";

const frameClass = "h-[min(54rem,calc(100dvh-7.5rem))] min-h-[34rem]";

function matches(filtro: FiltroBandeja, conversacion: ConversacionView) {
  switch (filtro) {
    case "sin_responder":
      return conversacion.sinLeer > 0;
    case "derivadas":
      return conversacion.estado === "esperando";
    case "mias":
      return conversacion.asignadaA === YO;
    case "con_pedido":
      return conversacion.pedidoAbiertoId !== null;
    case "con_reclamo":
      return conversacion.reclamoAbierto;
    default:
      return true;
  }
}

type InboxProps = {
  initial: ConversacionView[];
  respuestasRapidas: RespuestaRapida[];
  plantillas: PlantillaWhatsapp[];
  motivosToma: string[];
};

/**
 * Bandeja de conversaciones (M11): lista, chat y ficha de la clienta. Las
 * acciones se aplican al instante y se confirman contra la API; si falla, se
 * revierte y se ofrece reintentar.
 */
export function Inbox({ initial, respuestasRapidas, plantillas, motivosToma }: InboxProps) {
  const [items, setItems] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? null);
  const [filtro, setFiltro] = useState<FiltroBandeja>("todas");
  const [linea, setLinea] = useState<LineaWhatsapp | "todas">("todas");
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<"list" | "chat">("list");
  const [fichaOpen, setFichaOpen] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [, startTransition] = useTransition();

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const visibles = useMemo(() => {
    const term = normalizeText(query.trim());
    return items.filter(
      (item) =>
        matches(filtro, item) &&
        (linea === "todas" || item.linea === linea) &&
        (!term ||
          normalizeText(
            `${item.clienta.nombre} ${item.clienta.telefono} ${item.pedidoAbiertoId ?? ""} ${item.ultimo.texto}`,
          ).includes(term)),
    );
  }, [items, filtro, linea, query]);

  const counts = useMemo(
    () => Object.fromEntries(FILTROS.map(({ id }) => [id, items.filter((item) => matches(id, item)).length])),
    [items],
  );

  const replace = (next: ConversacionView) =>
    setItems((list) => list.map((item) => (item.id === next.id ? next : item)));

  /**
   * Aplica el cambio al instante, lo confirma con la API y, si falla, vuelve
   * al estado anterior.
   */
  const mutate = (
    id: string,
    optimistic: (conversacion: ConversacionView) => ConversacionView,
    call: () => Promise<Conversacion>,
    messages: { success?: string; description?: string; error: string },
  ) => {
    const previous = items.find((item) => item.id === id);
    if (!previous) return;
    replace(optimistic(previous));

    startTransition(async () => {
      try {
        const updated = await call();
        replace(toConversacionView(updated, Date.now()));
        if (messages.success) toast.success(messages.success, { description: messages.description });
      } catch (error) {
        replace(previous);
        toast.error(messages.error, {
          description: error instanceof Error ? error.message : "Revisá la conexión e intentá de nuevo.",
          action: { label: "Reintentar", onClick: () => mutate(id, optimistic, call, messages) },
        });
      }
    });
  };

  const systemMessage = (texto: string): MensajeView => ({
    id: `tmp-${Date.now()}`,
    tipo: "sistema",
    evento: "toma",
    texto,
    enviadoEn: new Date().toISOString(),
    hora: "ahora",
  });

  const select = (id: string) => {
    setSelectedId(id);
    setPane("chat");
    const conversacion = items.find((item) => item.id === id);
    if (conversacion && conversacion.sinLeer > 0) {
      replace({ ...conversacion, sinLeer: 0 });
      api.conversaciones.leer(id).catch(() => replace(conversacion));
    }
  };

  const tomar = (motivo: string) => {
    if (!selected) return;
    mutate(
      selected.id,
      (c) => ({
        ...c,
        estado: "persona",
        asignadaA: YO,
        motivo,
        mensajes: [...c.mensajes, systemMessage(`${YO} tomó la conversación · el bot se apartó`)],
      }),
      () => api.conversaciones.tomar(selected.id, motivo),
      {
        success: "Tomaste la conversación",
        description: "El bot se apartó. Cuando termines, devolvela o cerrala.",
        error: "No se pudo tomar la conversación",
      },
    );
  };

  const devolver = () => {
    if (!selected) return;
    mutate(
      selected.id,
      (c) => ({
        ...c,
        estado: "bot",
        asignadaA: null,
        mensajes: [...c.mensajes, systemMessage(`${YO} devolvió la conversación al bot`)],
      }),
      () => api.conversaciones.devolver(selected.id),
      { success: "Conversación devuelta al bot", error: "No se pudo devolver la conversación" },
    );
  };

  const cerrar = () => {
    if (!selected) return;
    mutate(
      selected.id,
      (c) => ({
        ...c,
        estado: "cerrada",
        sinLeer: 0,
        mensajes: [...c.mensajes, systemMessage(`${YO} cerró la conversación`)],
      }),
      () => api.conversaciones.cerrar(selected.id),
      {
        success: "Conversación cerrada",
        description: "Si la clienta vuelve a escribir, se reabre sola.",
        error: "No se pudo cerrar la conversación",
      },
    );
  };

  const enviar = (mensaje: NuevoMensaje) => {
    if (!selected) return;
    const temp: MensajeView =
      mensaje.tipo === "nota"
        ? {
            id: `tmp-${Date.now()}`,
            tipo: "nota",
            autorNombre: YO,
            texto: mensaje.texto,
            enviadoEn: new Date().toISOString(),
            hora: "ahora",
          }
        : {
            id: `tmp-${Date.now()}`,
            tipo: "texto",
            autor: "persona",
            autorNombre: YO,
            texto: mensaje.texto.replaceAll("{{nombre}}", selected.clienta.nombre.split(" ")[0]),
            plantilla:
              mensaje.tipo === "plantilla" ? plantillas.find((p) => p.id === mensaje.plantillaId)?.nombre : undefined,
            enviadoEn: new Date().toISOString(),
            hora: "ahora",
          };
    const takes = mensaje.tipo === "texto" && selected.estado !== "persona";

    mutate(
      selected.id,
      (c) => ({
        ...c,
        ...(takes && { estado: "persona" as const, asignadaA: YO }),
        sinLeer: mensaje.tipo === "nota" ? c.sinLeer : 0,
        mensajes: [...c.mensajes, temp],
        ultimo: {
          texto: mensaje.tipo === "nota" ? `Nota interna: ${temp.texto}` : temp.texto,
          hace: "ahora",
          deClienta: false,
        },
      }),
      () => api.conversaciones.enviar(selected.id, mensaje),
      {
        success:
          mensaje.tipo === "nota" ? "Nota guardada" : takes ? "Mensaje enviado · tomaste la conversación" : undefined,
        error: mensaje.tipo === "nota" ? "No se pudo guardar la nota" : "No se pudo enviar el mensaje",
      },
    );
  };

  return (
    <>
      <Card
        className={cn(
          "grid overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_20rem]",
          frameClass,
        )}
      >
        <section
          aria-label="Lista de conversaciones"
          className={cn("flex min-h-0 flex-col border-border lg:border-r", pane === "chat" && "hidden lg:flex")}
        >
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex gap-2">
              <SearchField
                className="relative min-w-0 flex-1"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Clienta, teléfono o pedido"
                aria-label="Buscar conversaciones"
              />
              <label htmlFor="inbox-linea" className="sr-only">
                Línea de WhatsApp
              </label>
              <NativeSelect
                id="inbox-linea"
                value={linea}
                onChange={(event) => setLinea(event.target.value as LineaWhatsapp | "todas")}
                className="w-28 shrink-0"
              >
                <option value="todas">Todas</option>
                <option value="ventas">Ventas</option>
                <option value="local">Local</option>
              </NativeSelect>
            </div>
            <div
              role="group"
              aria-label="Filtrar conversaciones"
              className="-mx-1 flex scrollbar-thin gap-1.5 overflow-x-auto px-1 pb-0.5"
            >
              {FILTROS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filtro === id}
                  onClick={() => setFiltro(id)}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-foreground"
                >
                  {label}
                  <span className="tabular-nums opacity-70">{counts[id]}</span>
                </button>
              ))}
            </div>
          </div>

          <p aria-live="polite" className="sr-only">
            {visibles.length} conversaciones
          </p>
          <ul className="min-h-0 flex-1 scrollbar-thin divide-y divide-border overflow-y-auto">
            {visibles.map((item) => (
              <li key={item.id}>
                <ConversationRow
                  conversacion={item}
                  selected={item.id === selectedId}
                  onSelect={() => select(item.id)}
                />
              </li>
            ))}
            {visibles.length === 0 && (
              <li className="px-6 py-12 text-center text-sm text-muted-foreground">
                No hay conversaciones con este filtro.
              </li>
            )}
          </ul>
        </section>

        <section
          aria-label="Conversación"
          className={cn("flex min-h-0 min-w-0 flex-col", pane === "list" && "hidden lg:flex")}
        >
          {selected ? (
            <ChatPanel
              key={selected.id}
              conversacion={selected}
              respuestasRapidas={respuestasRapidas}
              plantillas={plantillas}
              onBack={() => setPane("list")}
              onTake={() => setTakeOpen(true)}
              onReturn={devolver}
              onClose={cerrar}
              onShowFicha={() => setFichaOpen(true)}
              onSend={enviar}
            />
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Elegí una conversación de la lista.
            </div>
          )}
        </section>

        <aside
          aria-label="Ficha de la clienta"
          className="hidden min-h-0 scrollbar-thin overflow-y-auto border-l border-border xl:block"
        >
          {selected && <FichaPanel conversacion={selected} />}
        </aside>
      </Card>

      {selected && (
        <>
          <TakeDialog
            open={takeOpen}
            onOpenChange={setTakeOpen}
            motivos={motivosToma}
            clienta={selected.clienta.nombre}
            onConfirm={tomar}
          />
          <Dialog open={fichaOpen} onOpenChange={setFichaOpen}>
            <DialogContent variant="side" aria-describedby={undefined} className="overflow-y-auto xl:hidden">
              <DialogTitle className="sr-only">Ficha de {selected.clienta.nombre}</DialogTitle>
              <FichaPanel conversacion={selected} />
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}

function ConversationRow({
  conversacion,
  selected,
  onSelect,
}: {
  conversacion: ConversacionView;
  selected: boolean;
  onSelect: () => void;
}) {
  const estado = ESTADO_CONVERSACION[conversacion.estado];
  const LineIcon = conversacion.linea === "local" ? Store : MessageCircle;
  const OrigenIcon =
    conversacion.origen.tipo === "anuncio" ? Megaphone : conversacion.origen.tipo === "recompra" ? Repeat : Users;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:-outline-offset-2 aria-[current=true]:bg-primary/8"
    >
      <span className="relative shrink-0">
        <Avatar name={conversacion.clienta.nombre} className="size-9" />
        <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-surface ring-1 ring-border">
          <LineIcon aria-hidden className="size-2.5 text-muted-foreground" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", conversacion.sinLeer > 0 ? "font-semibold" : "font-medium")}>
            {conversacion.clienta.nombre}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground first-letter:uppercase">
            {conversacion.ultimo.hace}
          </span>
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[13px]",
            conversacion.sinLeer > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {conversacion.ultimo.texto}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <Badge variant={estado.tone} dot>
            {estado.label}
          </Badge>
          <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
            <OrigenIcon aria-hidden className="size-3 shrink-0" />
            {ETAPA_CONVERSACION[conversacion.etapa]}
          </span>
        </span>
      </span>
      {conversacion.sinLeer > 0 && (
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {conversacion.sinLeer}
          <span className="sr-only"> sin leer</span>
        </span>
      )}
    </button>
  );
}

function ChatPanel({
  conversacion,
  respuestasRapidas,
  plantillas,
  onBack,
  onTake,
  onReturn,
  onClose,
  onShowFicha,
  onSend,
}: {
  conversacion: ConversacionView;
  respuestasRapidas: RespuestaRapida[];
  plantillas: PlantillaWhatsapp[];
  onBack: () => void;
  onTake: () => void;
  onReturn: () => void;
  onClose: () => void;
  onShowFicha: () => void;
  onSend: (mensaje: NuevoMensaje) => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const estado = ESTADO_CONVERSACION[conversacion.estado];
  const origen =
    conversacion.origen.tipo === "anuncio"
      ? `Anuncio: ${conversacion.origen.anuncio}`
      : conversacion.origen.tipo === "recompra"
        ? "Recompra, sin clic a un anuncio"
        : "Orgánico";

  // Al abrir la conversación o llegar un mensaje, se va al final.
  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [conversacion.mensajes.length]);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Volver a la lista">
          <ArrowLeft />
        </Button>
        <Avatar name={conversacion.clienta.nombre} className="hidden size-9 sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] leading-5 font-semibold tracking-tight">{conversacion.clienta.nombre}</h2>
          <p className="truncate text-xs text-muted-foreground">
            <span className="tabular-nums">{conversacion.clienta.telefono}</span> · {LINEA[conversacion.linea]}
            {conversacion.asignadaA && ` · ${conversacion.asignadaA}`}
          </p>
        </div>
        <Badge variant={estado.tone} dot className="hidden sm:inline-flex">
          {estado.label}
        </Badge>
        <div className="flex shrink-0 items-center gap-1.5">
          {(conversacion.estado === "bot" || conversacion.estado === "esperando") && (
            <Button size="sm" onClick={onTake}>
              <UserCheck />
              <span className="hidden sm:inline">Tomar</span>
              <span className="sr-only sm:hidden">Tomar conversación</span>
            </Button>
          )}
          {conversacion.estado === "persona" && (
            <Button variant="outline" size="sm" onClick={onReturn}>
              <Bot />
              <span className="hidden sm:inline">Devolver al bot</span>
              <span className="sr-only sm:hidden">Devolver al bot</span>
            </Button>
          )}
          {conversacion.estado !== "cerrada" && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar conversación">
              <CircleCheck />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className="xl:hidden"
            onClick={onShowFicha}
            aria-label="Ver la ficha de la clienta"
          >
            <PanelRight />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
        <span>
          Etapa: <span className="font-medium text-foreground">{ETAPA_CONVERSACION[conversacion.etapa]}</span>
        </span>
        <span className="truncate">{origen}</span>
        {conversacion.motivo && conversacion.estado !== "bot" && (
          <span className="truncate">
            Motivo: <span className="text-foreground">{conversacion.motivo}</span>
          </span>
        )}
        {conversacion.pedidoAbiertoId && (
          <span>
            Pedido: <span className="font-mono font-medium text-foreground">{conversacion.pedidoAbiertoId}</span>
          </span>
        )}
      </div>

      <div
        ref={logRef}
        role="log"
        aria-label={`Mensajes con ${conversacion.clienta.nombre}`}
        className="min-h-0 flex-1 scrollbar-thin space-y-3 overflow-y-auto bg-canvas/60 px-3 py-5 sm:px-5"
      >
        {conversacion.mensajes.map((mensaje) => (
          <MessageItem key={mensaje.id} mensaje={mensaje} />
        ))}
      </div>

      <Composer
        conversacion={conversacion}
        respuestasRapidas={respuestasRapidas}
        plantillas={plantillas}
        onSend={onSend}
      />
    </>
  );
}
