"use client";

import { Bot, Clock, FileText, SendHorizontal, StickyNote, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NuevoMensaje, PlantillaWhatsapp, RespuestaRapida } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { ConversacionView } from "./view";

type Modo = "responder" | "nota";

/**
 * Respuesta, nota interna o plantilla. Fuera de la ventana de 24 h, Meta solo
 * permite plantillas aprobadas (RF-M11-04).
 */
export function Composer({
  conversacion,
  respuestasRapidas,
  plantillas,
  onSend,
}: {
  conversacion: ConversacionView;
  respuestasRapidas: RespuestaRapida[];
  plantillas: PlantillaWhatsapp[];
  onSend: (mensaje: NuevoMensaje) => void;
}) {
  const [modo, setModo] = useState<Modo>("responder");
  const [texto, setTexto] = useState("");
  const [plantillaId, setPlantillaId] = useState(plantillas[0]?.id ?? "");

  const cerrada = conversacion.estado === "cerrada";
  const soloPlantillas = modo === "responder" && !conversacion.ventana.abierta && !cerrada;
  const nombre = conversacion.clienta.nombre.split(" ")[0];

  const submit = () => {
    const value = texto.trim();
    if (!value) return;
    onSend({ tipo: modo === "nota" ? "nota" : "texto", texto: value });
    setTexto("");
  };

  return (
    <div className="space-y-2.5 border-t border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Tipo de mensaje" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
          {(
            [
              { id: "responder", label: "Responder", icon: SendHorizontal },
              { id: "nota", label: "Nota interna", icon: StickyNote },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => setModo(id)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-card"
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            conversacion.ventana.abierta ? "text-success" : "text-warning",
          )}
        >
          <Clock aria-hidden className="size-3.5" />
          {conversacion.ventana.label}
        </span>
      </div>

      {modo === "responder" && cerrada && (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
          La conversación está cerrada. Si {nombre} vuelve a escribir, se reabre sola.
        </p>
      )}

      {modo === "responder" && !cerrada && conversacion.estado !== "persona" && conversacion.ventana.abierta && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bot aria-hidden className="size-3.5 shrink-0" />
          {conversacion.estado === "bot"
            ? "El bot está atendiendo. Si respondés, tomás la conversación y el bot se aparta."
            : "Está esperando a una persona. Al responder, la tomás vos."}
        </p>
      )}

      {soloPlantillas && (
        <form
          className="space-y-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            const plantilla = plantillas.find((item) => item.id === plantillaId);
            if (plantilla) onSend({ tipo: "plantilla", texto: plantilla.texto, plantillaId });
          }}
        >
          <p className="text-[13px] text-muted-foreground">
            Pasaron más de 24 h desde el último mensaje de {nombre}: Meta solo permite plantillas aprobadas. Las de marketing tienen costo por mensaje.
          </p>
          <fieldset className="grid gap-2">
            <legend className="sr-only">Plantilla aprobada</legend>
            {plantillas.map((plantilla) => (
              <label
                key={plantilla.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2 text-[13px] transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/8 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="radio"
                  name="plantilla"
                  value={plantilla.id}
                  checked={plantillaId === plantilla.id}
                  onChange={() => setPlantillaId(plantilla.id)}
                  className="mt-1 size-3.5 accent-primary"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-medium">
                    {plantilla.nombre}
                    <Badge variant={plantilla.categoria === "marketing" ? "warning" : "neutral"}>
                      {plantilla.categoria === "marketing" ? "Marketing" : "Utilidad"}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {plantilla.texto.replaceAll("{{nombre}}", nombre)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              <FileText />
              Enviar plantilla
            </Button>
          </div>
        </form>
      )}

      {(modo === "nota" || (!soloPlantillas && !cerrada)) && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Label htmlFor={`composer-${conversacion.id}`} className="sr-only">
            {modo === "nota" ? "Nota interna" : `Mensaje para ${nombre}`}
          </Label>
          <Textarea
            id={`composer-${conversacion.id}`}
            value={texto}
            rows={2}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={modo === "nota" ? "Escribí una nota para el equipo (la clienta no la ve)…" : `Escribile a ${nombre}…`}
            className={cn("min-h-16 resize-none", modo === "nota" && "border-warning/50 bg-warning/5")}
          />
          <div className="flex items-center justify-between gap-2">
            {modo === "responder" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <Zap />
                    Respuestas rápidas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-72">
                  <DropdownMenuLabel>Respuestas aprobadas</DropdownMenuLabel>
                  {respuestasRapidas.map((respuesta) => (
                    <DropdownMenuItem
                      key={respuesta.id}
                      className="h-auto flex-col items-start gap-0.5 py-2"
                      onSelect={() => setTexto(respuesta.texto)}
                    >
                      <span className="font-medium">{respuesta.titulo}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{respuesta.texto}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-xs text-muted-foreground">Enter para guardar · Shift + Enter para otra línea</span>
            )}
            <Button type="submit" size="sm" disabled={!texto.trim()}>
              {modo === "nota" ? <StickyNote /> : <SendHorizontal />}
              {modo === "nota" ? "Guardar nota" : "Enviar"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
