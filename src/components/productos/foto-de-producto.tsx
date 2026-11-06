"use client";

import { useState } from "react";
import { ProductThumb } from "@/components/kit/product-thumb";
import { cn } from "@/lib/utils";

const TAMANO = {
  sm: "size-9 rounded-lg",
  lg: "aspect-square w-full rounded-xl",
} as const;

/**
 * La foto del producto, servida directo por Drive o DUX. Si no hay, o si no carga (la carpeta se
 * cerró, Google no responde), queda la miniatura con los colores: nunca una imagen rota.
 */
export function FotoDeProducto({
  url,
  sku,
  colores,
  tamano = "lg",
  className,
}: {
  url: string | null;
  sku: string;
  colores: string[];
  tamano?: keyof typeof TAMANO;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) return <ProductThumb sku={sku} colors={colores} size={tamano} className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Son unas 2.300, y las sirve Drive: pasarlas por el optimizador no suma nada.
    <img
      src={url}
      alt={`Foto de ${sku}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className={cn("bg-muted object-cover", TAMANO[tamano], className)}
    />
  );
}
