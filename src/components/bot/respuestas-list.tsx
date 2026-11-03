"use client";

import { Bot, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";
import type { RespuestaBot } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type RespuestaView = RespuestaBot & { hace: string; recorridoNombre: string };

/** Visor de respuestas del bot (RF-M3-08): marcar una como mala la suma al set de evaluación. */
export function RespuestasList({ initial }: { initial: RespuestaView[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  const calificar = (id: string, calificacion: "buena" | "mala") => {
    const previous = items.find((item) => item.id === id);
    if (!previous) return;
    const next = previous.calificacion === calificacion ? null : calificacion;
    if (next === null) return;

    setItems((list) => list.map((item) => (item.id === id ? { ...item, calificacion: next } : item)));
    startTransition(async () => {
      try {
        await api.bot.calificar(id, next);
        toast.success(next === "mala" ? "Marcada como mala" : "Marcada como buena", {
          description:
            next === "mala"
              ? "Entra al set de evaluación: cada cambio del bot se prueba contra ella."
              : "Queda como ejemplo de respuesta correcta.",
        });
      } catch {
        setItems((list) => list.map((item) => (item.id === id ? previous : item)));
        toast.error("No se pudo guardar la calificación", {
          action: { label: "Reintentar", onClick: () => calificar(id, calificacion) },
        });
      }
    });
  };

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <span className="font-medium">{item.clienta.nombre}</span>
            <Badge variant="outline">
              {item.recorrido} · {item.recorridoNombre}
            </Badge>
            {item.derivo ? (
              <Badge variant="warning" dot>
                Derivó: {item.motivoDerivacion}
              </Badge>
            ) : (
              <Badge variant="success" dot>
                Resolvió solo
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground first-letter:uppercase">{item.hace}</span>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <p className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed">
              <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Clienta</span>
              {item.mensajeClienta}
            </p>
            <p className="rounded-lg bg-primary/8 px-3 py-2 text-[13px] leading-relaxed">
              <span className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Bot aria-hidden className="size-3" />
                Respuesta del bot
              </span>
              {item.respuesta}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="sr-only">Herramientas que usó:</span>
            {item.herramientas.map((herramienta) => (
              <span
                key={`${herramienta.nombre}-${herramienta.detalle}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs"
              >
                <Wrench aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                <code className="font-mono text-[11px] font-medium">{herramienta.nombre}</code>
                <span className="truncate text-muted-foreground">{herramienta.detalle}</span>
              </span>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/conversaciones">Ver conversación</Link>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Marcar como buena la respuesta a ${item.clienta.nombre}`}
                aria-pressed={item.calificacion === "buena"}
                onClick={() => calificar(item.id, "buena")}
                className={cn(
                  item.calificacion === "buena" && "border-success/50 bg-success/10 text-success hover:bg-success/15",
                )}
              >
                <ThumbsUp />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={item.calificacion === "mala"}
                onClick={() => calificar(item.id, "mala")}
                className={cn(
                  item.calificacion === "mala" && "border-danger/50 bg-danger/10 text-danger hover:bg-danger/15",
                )}
              >
                <ThumbsDown />
                {item.calificacion === "mala" ? "Marcada como mala" : "Marcar como mala"}
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
