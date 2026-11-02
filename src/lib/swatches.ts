import { normalizeText } from "@/lib/utils";

/**
 * Colores de producto (curva_colores del catálogo) → muestra visual. Es dato
 * del producto, no del tema: por eso vive acá y no en theme.css.
 */
const SWATCHES: Record<string, string> = {
  blanco: "#f6f3ee",
  negro: "#1d1b1a",
  beige: "#d9c3a3",
  rosa: "#eaa7b8",
  "rosa viejo": "#c48f8c",
  "rosa claro": "#f3c9d3",
  "rosa fuerte": "#df4f80",
  "rosado malva": "#c99aa6",
  azul: "#34548f",
  "azul marino": "#1f2f55",
  celeste: "#8fc3e8",
  bordo: "#6e1f2e",
  rojo: "#c8323c",
  "rojo vino": "#6d1f2a",
  verde: "#3f7d4f",
  "verde oliva": "#6b7442",
  "verde menta": "#a6dcc4",
  gris: "#9a9a9e",
  lila: "#c3a6d8",
  violeta: "#7d55a8",
  fucsia: "#d63384",
  salmon: "#f0a58a",
  amarillo: "#f2d06b",
  marron: "#7a5236",
  terracota: "#b5603f",
};

/** Estampados y surtidos: se muestran como un degradé multicolor. */
const PATTERN = "conic-gradient(#eaa7b8, #f2d06b, #8fc3e8, #a6dcc4, #c3a6d8, #eaa7b8)";

export function swatchFor(color: string) {
  return SWATCHES[normalizeText(color.trim())] ?? PATTERN;
}
