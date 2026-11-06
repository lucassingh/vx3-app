"use client";

import { upload } from "@vercel/blob/client";
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_PREFIX } from "@/lib/api/domains";
import type { FotoSubida } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { descartarFotosSubidas } from "@/modules/catalog/actions";
import {
  claveParaSubir,
  FOTO_MAX_MB,
  FOTOS_POR_PRODUCTO,
  moverFoto,
  problemaDeLaFoto,
  TIPOS_DE_FOTO,
} from "@/modules/catalog/fotos";

type Subiendo = { id: string; nombre: string; progreso: number };
type Rechazada = { id: string; nombre: string; motivo: string };

/** Sin poder abrirla acá, tampoco la van a poder mostrar los demás: un archivo con otra extensión, o roto. */
async function medir(archivo: File): Promise<{ ancho: number; alto: number } | null> {
  try {
    const imagen = await createImageBitmap(archivo);
    const medidas = { ancho: imagen.width, alto: imagen.height };
    imagen.close();
    return medidas;
  } catch {
    return null;
  }
}

/**
 * Las fotos nuevas de un producto (RN-08). Suben directo al store, de a una, en el orden en que se
 * eligieron. La primera es la principal. Quedan con el borrador recién cuando se lo guarda.
 */
export function AltaFotos({
  fotos,
  mediaUrl,
  puedeEditar,
  alCambiar,
}: {
  fotos: FotoSubida[];
  /** Null: este ambiente no tiene store. */
  mediaUrl: string | null;
  puedeEditar: boolean;
  alCambiar: (cambio: (actuales: FotoSubida[]) => FotoSubida[]) => void;
}) {
  const uid = useId();
  const [subiendo, setSubiendo] = useState<Subiendo[]>([]);
  const [rechazadas, setRechazadas] = useState<Rechazada[]>([]);
  const [encima, setEncima] = useState(false);

  const lugar = FOTOS_POR_PRODUCTO - fotos.length - subiendo.length;

  const subirUna = async (archivo: File, id: string, rechazar: (motivo: string) => void) => {
    const medidas = await medir(archivo);
    if (!medidas) {
      rechazar("No se pudo abrir: probá exportarla de nuevo como JPG.");
      return;
    }
    try {
      const { pathname } = await upload(claveParaSubir(archivo.name), archivo, {
        access: "public",
        handleUploadUrl: `${API_PREFIX}/catalogo/alta/fotos`,
        contentType: archivo.type,
        onUploadProgress: ({ percentage }) =>
          setSubiendo((actuales) =>
            actuales.map((item) => (item.id === id ? { ...item, progreso: Math.round(percentage) } : item)),
          ),
      });
      alCambiar((actuales) => [...actuales, { clave: pathname, nombre: archivo.name, ...medidas }]);
    } catch {
      rechazar("No se pudo subir. Probá de nuevo.");
    }
  };

  const elegir = async (archivos: File[]) => {
    const rechazos: Rechazada[] = [];
    const aSubir: { archivo: File; id: string }[] = [];
    for (const archivo of archivos) {
      const id = crypto.randomUUID();
      const problema = problemaDeLaFoto(archivo);
      if (problema) rechazos.push({ id, nombre: archivo.name, motivo: problema });
      else if (aSubir.length >= lugar)
        rechazos.push({ id, nombre: archivo.name, motivo: `Ya hay ${FOTOS_POR_PRODUCTO}, el máximo por producto.` });
      else aSubir.push({ archivo, id });
    }
    setRechazadas(rechazos);
    setSubiendo((actuales) => [
      ...actuales,
      ...aSubir.map(({ archivo, id }) => ({ id, nombre: archivo.name, progreso: 0 })),
    ]);

    for (const { archivo, id } of aSubir) {
      await subirUna(archivo, id, (motivo) =>
        setRechazadas((actuales) => [...actuales, { id, nombre: archivo.name, motivo }]),
      );
      setSubiendo((actuales) => actuales.filter((item) => item.id !== id));
    }
  };

  const quitar = ({ clave }: FotoSubida) => {
    alCambiar((actuales) => actuales.filter((foto) => foto.clave !== clave));
    // Si está en un borrador guardado no se borra todavía: se va cuando se guarde sin ella.
    void descartarFotosSubidas({ claves: [clave] });
  };

  const mover = (indice: number, destino: number) => alCambiar((actuales) => moverFoto(actuales, indice, destino));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Fotos</CardTitle>
          <CardDescription>
            La primera es la principal. Hasta {FOTOS_POR_PRODUCTO}, en JPG, PNG o WebP, de hasta {FOTO_MAX_MB} MB cada
            una. Quedan cuando guardás el borrador
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {!mediaUrl ? (
          <p className="text-sm text-muted-foreground">Este ambiente todavía no tiene dónde guardar fotos.</p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fotos.map((foto, indice) => (
                <li key={foto.clave} className="min-w-0 space-y-2">
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Recién subida, y son pocas: pasarla por el optimizador solo la demora. */}
                    <img
                      src={`${mediaUrl}/${foto.clave}`}
                      alt={`Foto ${indice + 1}: ${foto.nombre}`}
                      className="size-full object-cover"
                    />
                    {indice === 0 && (
                      <Badge className="text-background absolute top-2 left-2 border-transparent bg-foreground">
                        Principal
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={foto.nombre}>
                    {foto.nombre}
                  </p>
                  {puedeEditar && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Hacer principal ${foto.nombre}`}
                        title="Hacer principal"
                        disabled={indice === 0}
                        onClick={() => mover(indice, 0)}
                      >
                        <Star />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Mover antes ${foto.nombre}`}
                        title="Mover antes"
                        disabled={indice === 0}
                        onClick={() => mover(indice, indice - 1)}
                      >
                        <ArrowLeft />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Mover después ${foto.nombre}`}
                        title="Mover después"
                        disabled={indice === fotos.length - 1}
                        onClick={() => mover(indice, indice + 1)}
                      >
                        <ArrowRight />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="ml-auto"
                        aria-label={`Quitar ${foto.nombre}`}
                        title="Quitar"
                        onClick={() => quitar(foto)}
                      >
                        <X />
                      </Button>
                    </div>
                  )}
                </li>
              ))}

              {subiendo.map(({ id, nombre, progreso }) => (
                <li key={id} className="min-w-0 space-y-2">
                  <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-border-strong bg-canvas/60">
                    <LoaderCircle aria-hidden className="size-6 animate-spin text-muted-foreground" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{nombre}</p>
                  <div
                    role="progressbar"
                    aria-label={`Subiendo ${nombre}`}
                    aria-valuenow={progreso}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${progreso}%` }} />
                  </div>
                </li>
              ))}

              {puedeEditar && lugar > 0 && (
                <li>
                  <label
                    htmlFor={`${uid}-archivos`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setEncima(true);
                    }}
                    onDragLeave={() => setEncima(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setEncima(false);
                      void elegir([...event.dataTransfer.files]);
                    }}
                    className={cn(
                      "flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                      encima ? "border-primary bg-primary/5" : "border-border-strong bg-canvas/60 hover:bg-muted",
                    )}
                  >
                    <input
                      id={`${uid}-archivos`}
                      type="file"
                      multiple
                      accept={TIPOS_DE_FOTO.join(",")}
                      className="sr-only"
                      aria-label="Elegir fotos para subir"
                      onChange={(event) => {
                        void elegir([...(event.target.files ?? [])]);
                        event.target.value = "";
                      }}
                    />
                    <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
                    <span className="px-2 text-xs text-muted-foreground">Elegí o arrastrá las fotos</span>
                  </label>
                </li>
              )}
            </ul>

            {rechazadas.length > 0 && (
              <ul role="alert" className="space-y-1">
                {rechazadas.map(({ id, nombre, motivo }) => (
                  <li key={id} className="text-xs font-medium text-danger">
                    {nombre}: {motivo}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
