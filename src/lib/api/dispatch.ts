import "server-only";

import { serverEnv } from "@/env";
import { handleMockRequest } from "@/mocks/router";
import { areaDeApi } from "@/modules/platform/access";
import type { SessionUser } from "@/modules/platform/auth/session";
import { can } from "@/modules/platform/permissions";
import { API_PREFIX, domainOf, type ApiDomain } from "./domains";
import { realRoutes as rutasReales } from "./real-routes";
import { errorResponse, routeParams, type Route } from "./route";

type Opciones = {
  /** Quién pide: sin usuario, 401. */
  user: Pick<SessionUser, "role"> | null;
  realDomains?: readonly ApiDomain[];
  realRoutes?: Partial<Record<ApiDomain, Route[]>>;
};

/** Dominios configurados como reales (API_REAL_DOMAINS). Los demás usan la API simulada. */
export function realDomains(): readonly ApiDomain[] {
  return serverEnv().API_REAL_DOMAINS;
}

/**
 * Atiende un request de la API (/api/v1/<dominio>/…). Primero valida que el
 * usuario pueda ver (GET) o editar (lo demás) el área de esa ruta
 * (src/modules/platform/access.ts); después, si el dominio está en
 * API_REAL_DOMAINS y tiene esa ruta, va a su implementación real; todo lo demás,
 * a la API simulada. Lo usan el endpoint del navegador y, en el mismo proceso, los
 * Server Components.
 */
export async function dispatchApiRequest(request: Request, opciones: Opciones): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(API_PREFIX.length) || "/";

  if (!opciones.user) return errorResponse(401, "La sesión venció: volvé a entrar.");
  const area = areaDeApi(path);
  const accion = request.method === "GET" ? "ver" : "editar";
  if (area && !can(opciones.user.role, `${area}.${accion}`)) {
    return errorResponse(403, `Tu rol no tiene permiso para ${accion} esto. Si lo necesitás, pedíselo a un admin.`);
  }

  const dominio = domainOf(path);
  const reales = opciones.realDomains ?? realDomains();
  if (!dominio || !reales.includes(dominio)) return handleMockRequest(request, path);

  const rutas = (opciones.realRoutes ?? rutasReales)[dominio] ?? [];
  for (const route of rutas) {
    const match = route.method === request.method ? path.match(route.pattern) : null;
    if (match) return route.handler({ url, params: routeParams(match), request });
  }
  return handleMockRequest(request, path);
}
