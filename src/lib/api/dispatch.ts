import "server-only";

import { serverEnv } from "@/env";
import { handleMockRequest } from "@/mocks/router";
import { API_PREFIX, domainOf, type ApiDomain } from "./domains";
import { realRoutes as rutasReales } from "./real-routes";
import { errorResponse, routeParams, type Route } from "./route";

type Opciones = {
  realDomains?: readonly ApiDomain[];
  realRoutes?: Partial<Record<ApiDomain, Route[]>>;
};

/** Dominios configurados como reales (API_REAL_DOMAINS). Los demás usan la API simulada. */
export function realDomains(): readonly ApiDomain[] {
  return serverEnv().API_REAL_DOMAINS;
}

/**
 * Atiende un request de la API (/api/v1/<dominio>/…). Si el dominio está en
 * API_REAL_DOMAINS va a su implementación real; si no, a la API simulada. Lo usan
 * el endpoint del navegador y, en el mismo proceso, los Server Components.
 */
export async function dispatchApiRequest(request: Request, opciones: Opciones = {}): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(API_PREFIX.length) || "/";
  const dominio = domainOf(path);
  const reales = opciones.realDomains ?? realDomains();
  if (!dominio || !reales.includes(dominio)) return handleMockRequest(request, path);

  const rutas = (opciones.realRoutes ?? rutasReales)[dominio] ?? [];
  if (rutas.length === 0) {
    return errorResponse(
      501,
      `El dominio ${dominio} está configurado como real (API_REAL_DOMAINS) pero todavía no tiene implementación.`,
    );
  }
  for (const route of rutas) {
    const match = route.method === request.method ? path.match(route.pattern) : null;
    if (match) return route.handler({ url, params: routeParams(match), request });
  }
  return errorResponse(404, `No existe ${request.method} ${path} en la API de ${dominio}.`);
}
