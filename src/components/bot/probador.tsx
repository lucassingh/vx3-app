"use client";

import { Bot, FlaskConical, LoaderCircle, SendHorizontal, Wrench } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api/browser";
import type { BotPrueba } from "@/lib/api/types";
import { toast } from "@/lib/toast";

type Turno = { id: number; mensaje: string; prueba: BotPrueba | null };

const SUGERENCIAS = [
  "¿Tenés el conjunto en talle 100?",
  "¿Cuánto sale la media docena?",
  "¿Lo mandan a Rosario?",
  "Si llevo 6, ¿me hacés descuento?",
];

/** Chat de prueba: se usa antes de publicar una versión (RF-M3-07). No le escribe a ninguna clienta. */
export function Probador({ nombre }: { nombre: string }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turnos]);

  const probar = (mensaje: string) => {
    const value = mensaje.trim();
    if (!value || pending) return;
    nextId.current += 1;
    const id = nextId.current;
    setTurnos((list) => [...list, { id, mensaje: value, prueba: null }]);
    setTexto("");
    startTransition(async () => {
      try {
        const prueba = await api.bot.probar(value);
        setTurnos((list) => list.map((turno) => (turno.id === id ? { ...turno, prueba } : turno)));
      } catch {
        setTurnos((list) => list.filter((turno) => turno.id !== id));
        toast.error("El probador no respondió", { action: { label: "Reintentar", onClick: () => probar(value) } });
      }
    });
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical aria-hidden className="size-4 text-muted-foreground" />
            Probador
          </CardTitle>
          <CardDescription>Probá el borrador como si fueras una clienta. No sale nada por WhatsApp.</CardDescription>
        </div>
      </CardHeader>

      <div
        ref={logRef}
        role="log"
        aria-label="Chat de prueba"
        className="scrollbar-thin h-80 space-y-3 overflow-y-auto border-y border-border bg-canvas/60 px-4 py-4"
      >
        <BotBubble nombre={nombre} texto={`¡Hola! Soy ${nombre}. Escribime como si fueras una clienta y te muestro qué respondería.`} />
        {turnos.map((turno) => (
          <div key={turno.id} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {turno.mensaje}
              </p>
            </div>
            {turno.prueba ? (
              <div className="space-y-2">
                <BotBubble nombre={nombre} texto={turno.prueba.respuesta} />
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {turno.prueba.herramientas.map((herramienta) => (
                    <span
                      key={herramienta.nombre + herramienta.detalle}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px]"
                      title={herramienta.detalle}
                    >
                      <Wrench aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                      <code className="font-mono">{herramienta.nombre}</code>
                      <span className="sr-only">: {herramienta.detalle}</span>
                    </span>
                  ))}
                  {turno.prueba.derivaria && <Badge variant="warning" dot>Derivaría a una persona</Badge>}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                Pensando la respuesta…
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mensajes de ejemplo">
          {SUGERENCIAS.map((sugerencia) => (
            <button
              key={sugerencia}
              type="button"
              onClick={() => probar(sugerencia)}
              disabled={pending}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {sugerencia}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            probar(texto);
          }}
        >
          <Label htmlFor="probador-mensaje" className="sr-only">
            Mensaje de prueba
          </Label>
          <Input
            id="probador-mensaje"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Escribí como una clienta…"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={!texto.trim() || pending} aria-label="Probar mensaje">
            <SendHorizontal />
          </Button>
        </form>
      </div>
    </Card>
  );
}

function BotBubble({ nombre, texto }: { nombre: string; texto: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-primary/10 px-3.5 py-2 text-sm leading-relaxed">
        <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Bot aria-hidden className="size-3" />
          {nombre}
        </p>
        {texto}
      </div>
    </div>
  );
}
