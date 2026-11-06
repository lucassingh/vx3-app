"use client";

import { ExternalLink, LoaderCircle, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FotoDeProducto } from "@/components/productos/foto-de-producto";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/browser";
import type { CatalogoParecido } from "@/lib/api/types";
import { VIGENCIA } from "./labels";

const ESPERA_MS = 350;
const MINIMO_DE_LETRAS = 3;

type Resultado = { clave: string; filas: CatalogoParecido[] | null };

/**
 * Antes de crear, lo que ya existe y se parece: lo mismo con otros colores no lleva SKU nuevo
 * (RN-04), y un histórico vuelve con el suyo (RN-125). Va debajo del campo que se está escribiendo.
 */
export function AltaParecidos({ busqueda, rubro, subrubro }: { busqueda: string; rubro: string; subrubro: string }) {
  const q = busqueda.trim();
  const buscable = q.length >= MINIMO_DE_LETRAS;
  const clave = `${q}|${rubro}|${subrubro}`;
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!buscable) return;
    let vigente = true;
    const espera = setTimeout(() => {
      api.catalogo.altaParecidos({ q, rubro: rubro || undefined, subrubro: subrubro || undefined }).then(
        (filas) => {
          if (vigente) setResultado({ clave, filas });
        },
        () => {
          if (vigente) setResultado({ clave, filas: null });
        },
      );
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [buscable, clave, q, rubro, subrubro]);

  const buscando = buscable && resultado?.clave !== clave;
  const filas = buscable && !buscando ? resultado?.filas : undefined;
  const hayHistorico = filas?.some(({ vigencia }) => vigencia === "historico");

  return (
    <section
      aria-label="Productos parecidos en el catálogo"
      aria-live="polite"
      className="space-y-3 rounded-lg border border-border bg-muted/40 p-3.5 sm:col-span-2"
    >
      <h3 className="flex items-center gap-2 text-[13px] font-medium">
        {buscando ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <SearchCheck aria-hidden className="size-4 text-muted-foreground" />
        )}
        Antes de crear, mirá si ya existe
      </h3>

      {!buscable && (
        <p className="text-xs text-muted-foreground">
          Escribí la prenda y acá aparecen los parecidos de todo el catálogo, con los históricos.
        </p>
      )}
      {buscando && <p className="text-xs text-muted-foreground">Buscando en el catálogo…</p>}
      {filas === null && (
        <p className="text-xs text-muted-foreground">No se pudo buscar. Probá de nuevo en un momento.</p>
      )}
      {filas?.length === 0 && <p className="text-xs text-muted-foreground">No hay nada parecido en el catálogo.</p>}

      {filas && filas.length > 0 && (
        <>
          <ul className="grid gap-1 sm:grid-cols-2">
            {filas.map((producto) => {
              const { label, tone } = VIGENCIA[producto.vigencia];
              return (
                <li key={producto.sku}>
                  <Link
                    href={`/productos/catalogo?producto=${encodeURIComponent(producto.sku)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <FotoDeProducto url={producto.foto} sku={producto.sku} colores={producto.colores} tamano="sm" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">{producto.sku}</span>
                        <Badge variant={tone}>{label}</Badge>
                        <ExternalLink aria-hidden className="ml-auto size-3 shrink-0 text-muted-foreground" />
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{producto.nombre}</span>
                      <span className="sr-only">(se abre en otra pestaña)</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Si es el mismo con otros colores, no lleva SKU nuevo: se suman las fotos y se ajusta el color.
            {hayHistorico && " Un histórico no se da de alta de nuevo: al entrar mercadería vuelve con su mismo SKU."}
          </p>
        </>
      )}
    </section>
  );
}
