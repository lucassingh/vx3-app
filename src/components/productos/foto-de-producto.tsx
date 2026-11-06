"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductThumb } from "@/components/kit/product-thumb";
import { cn } from "@/lib/utils";

const TAMANO = {
  sm: "size-9 rounded-lg",
  lg: "aspect-square w-full rounded-xl",
} as const;

/** Las fotos subidas en la app pueden pesar 10 MB: a diferencia de las de Drive, nadie más las achica. */
const EN_LA_APP = {
  sm: { ancho: 72, sizes: "36px" },
  lg: { ancho: 640, sizes: "(min-width: 1024px) 20rem, 50vw" },
} as const;

const esSubidaEnLaApp = (url: string) => /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(url);

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

  if (esSubidaEnLaApp(url)) {
    const { ancho, sizes } = EN_LA_APP[tamano];
    return (
      <Image
        src={url}
        alt={`Foto de ${sku}`}
        width={ancho}
        height={ancho}
        sizes={sizes}
        onError={() => setFallo(true)}
        className={cn("bg-muted object-cover", TAMANO[tamano], className)}
      />
    );
  }

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
