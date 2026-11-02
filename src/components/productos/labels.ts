import type { CatalogoEstado } from "@/lib/api/types";
import type { BadgeTone } from "@/lib/domain";

export const ESTADO_PRODUCTO: Record<CatalogoEstado, { label: string; tone: BadgeTone }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  listo: { label: "Listo", tone: "accent" },
  publicado: { label: "Publicado", tone: "success" },
  pausado: { label: "Pausado", tone: "warning" },
};

export const CANALES_PUBLICACION = [
  { key: "dux", label: "DUX" },
  { key: "tiendaNube", label: "Tienda Nube" },
  { key: "meta", label: "Meta" },
] as const;
