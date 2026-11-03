/**
 * Dominios de la API, uno por módulo. Cada uno es simulado o real por separado:
 * los que figuran en API_REAL_DOMAINS usan su implementación real y el resto,
 * la API simulada (src/lib/api/dispatch.ts).
 */
export const API_DOMAINS = [
  "dashboard",
  "notifications",
  "conversaciones",
  "bot",
  "vidriera",
  "clientas",
  "pauta",
  "pedidos",
  "envios",
  "cobros",
  "postventa",
  "catalogo",
  "stock",
  "plataforma",
] as const;

export type ApiDomain = (typeof API_DOMAINS)[number];

/** Endpoint único de la API dentro de la app (src/app/api/v1). */
export const API_PREFIX = "/api/v1";

/** El dominio de una ruta de la API: "/cobros/caja?x=1" → "cobros". */
export function domainOf(path: string): ApiDomain | null {
  const segmento = path.split("?")[0]?.split("/")[1] ?? "";
  return (API_DOMAINS as readonly string[]).includes(segmento) ? (segmento as ApiDomain) : null;
}
