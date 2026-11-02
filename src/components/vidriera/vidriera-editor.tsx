"use client";

import { ArrowDown, ArrowUp, Eye, Globe, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/browser";
import type { VidrieraAcceso, VidrieraColeccion, VidrieraDestacado } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type DestacadoView = VidrieraDestacado & { precioLabel: string; vistasLabel: string };
export type ColeccionView = VidrieraColeccion & { visitasLabel: string };

const ACCESOS: { id: VidrieraAcceso; titulo: string; descripcion: string; icon: typeof Globe }[] = [
  {
    id: "publico",
    titulo: "Catálogo público",
    descripcion: "Cualquiera ve productos y precios mayoristas, también desde la bio de Instagram.",
    icon: Globe,
  },
  {
    id: "con_codigo",
    titulo: "Precios con código",
    descripcion: "Los precios se ven solo con el link del bot o con un código que llega por WhatsApp.",
    icon: KeyRound,
  },
];

/**
 * Lo que los socios editan de la vidriera sin tocar código ni DUX (RF-M4-08):
 * orden y visibilidad de las colecciones, destacados y acceso a los precios.
 */
export function VidrieraEditor({
  colecciones: initialColecciones,
  destacados: initialDestacados,
  acceso: initialAcceso,
}: {
  colecciones: ColeccionView[];
  destacados: DestacadoView[];
  acceso: VidrieraAcceso;
}) {
  const [colecciones, setColecciones] = useState(initialColecciones);
  const [destacados, setDestacados] = useState(initialDestacados);
  const [acceso, setAcceso] = useState(initialAcceso);
  const [, startTransition] = useTransition();

  /** Aplica el cambio al instante; si la API falla, vuelve atrás y avisa. */
  const run = (revert: () => void, call: () => Promise<unknown>, success: string, description?: string) => {
    startTransition(async () => {
      try {
        await call();
        toast.success(success, { description });
      } catch {
        revert();
        toast.error("No se pudo guardar el cambio", { description: "Revisá la conexión e intentá de nuevo." });
      }
    });
  };

  const mover = (index: number, delta: -1 | 1) => {
    const destino = index + delta;
    if (destino < 0 || destino >= colecciones.length) return;
    const previo = colecciones;
    const nuevo = [...colecciones];
    [nuevo[index], nuevo[destino]] = [nuevo[destino], nuevo[index]];
    setColecciones(nuevo);
    run(
      () => setColecciones(previo),
      () => api.vidriera.ordenarColecciones(nuevo.map((item) => item.id)),
      "Orden actualizado",
      `“${nuevo[destino].nombre}” quedó en el lugar ${destino + 1}.`,
    );
  };

  const toggleColeccion = (id: string, activa: boolean) => {
    const previo = colecciones;
    setColecciones((list) => list.map((item) => (item.id === id ? { ...item, activa } : item)));
    const nombre = colecciones.find((item) => item.id === id)?.nombre ?? "";
    run(
      () => setColecciones(previo),
      () => api.vidriera.actualizarColeccion(id, { activa }),
      activa ? "Colección visible" : "Colección oculta",
      `“${nombre}” ${activa ? "ya aparece" : "ya no aparece"} en la vidriera.`,
    );
  };

  const toggleDestacado = (sku: string, activo: boolean) => {
    const previo = destacados;
    setDestacados((list) => list.map((item) => (item.sku === sku ? { ...item, activo } : item)));
    run(
      () => setDestacados(previo),
      () => api.vidriera.actualizarDestacado(sku, { activo }),
      activo ? `${sku} destacado` : `${sku} sin destacar`,
    );
  };

  const cambiarAcceso = (nuevo: VidrieraAcceso) => {
    const previo = acceso;
    setAcceso(nuevo);
    run(
      () => setAcceso(previo),
      () => api.vidriera.cambiarAcceso(nuevo),
      nuevo === "publico" ? "La vidriera es pública" : "Precios solo con código",
      "Es una decisión a confirmar con los socios: se puede cambiar cuando quieran.",
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div>
            <CardTitle>Colecciones</CardTitle>
            <CardDescription>El orden en que se ven en la portada. Se ordenan y se ocultan sin tocar DUX.</CardDescription>
          </div>
        </CardHeader>
        <ol className="divide-y divide-border border-t border-border">
          {colecciones.map((coleccion, index) => (
            <li key={coleccion.id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className={cn("min-w-0 flex-1", !coleccion.activa && "opacity-60")}>
                <p className="truncate text-sm font-medium">{coleccion.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {coleccion.descripcion} · {coleccion.productos} productos
                </p>
              </div>
              <span className="hidden shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground sm:inline-flex">
                <Eye aria-hidden className="size-3.5" />
                {coleccion.visitasLabel}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Subir “${coleccion.nombre}”`}
                  disabled={index === 0}
                  onClick={() => mover(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Bajar “${coleccion.nombre}”`}
                  disabled={index === colecciones.length - 1}
                  onClick={() => mover(index, 1)}
                >
                  <ArrowDown />
                </Button>
              </div>
              <Switch
                aria-label={`Mostrar “${coleccion.nombre}” en la vidriera`}
                checked={coleccion.activa}
                onCheckedChange={(activa) => toggleColeccion(coleccion.id, activa)}
              />
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Destacados de la portada</CardTitle>
            <CardDescription>Precio de la lista MAYORISTA EF/TR y stock disponible de DUX, menos lo reservado</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {destacados.map((item) => (
              <li
                key={item.sku}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 transition-colors",
                  item.activo ? "border-border" : "border-dashed border-border-strong bg-muted/30",
                )}
              >
                <ProductThumb sku={item.sku} colors={item.colores} size="md" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.presentacion} · <span className="font-semibold text-foreground tabular-nums">{item.precioLabel}</span>
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {item.vistasLabel} vistas · {item.stockBultos} bultos
                    </span>
                    <Switch
                      aria-label={`Destacar ${item.nombre}`}
                      checked={item.activo}
                      onCheckedChange={(activo) => toggleDestacado(item.sku, activo)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Quién ve los precios</CardTitle>
            <CardDescription>Los links que manda el bot identifican a la clienta: entra sin registrarse</CardDescription>
          </div>
          <Badge variant="warning" dot>
            A definir con los socios
          </Badge>
        </CardHeader>
        <CardContent className="pt-5">
          <fieldset>
            <legend className="sr-only">Acceso a la vidriera</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ACCESOS.map(({ id, titulo, descripcion, icon: Icon }) => (
                <Label
                  key={id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 font-normal leading-normal transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/8 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
                >
                  <input
                    type="radio"
                    name="acceso"
                    value={id}
                    checked={acceso === id}
                    onChange={() => cambiarAcceso(id)}
                    className="peer sr-only"
                  />
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">{titulo}</span>
                    <span className="block text-[13px] text-muted-foreground">{descripcion}</span>
                  </span>
                </Label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>
    </>
  );
}
