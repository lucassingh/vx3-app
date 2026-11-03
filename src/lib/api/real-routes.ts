import type { ApiDomain } from "./domains";
import type { Route } from "./route";

/**
 * Implementaciones reales de cada dominio, con el mismo contrato que su mock
 * (src/mocks/domains). Un dominio entra acá cuando su integración está lista
 * (el primero, con DUX, en la fase 1.4) y se activa con API_REAL_DOMAINS.
 */
export const realRoutes: Partial<Record<ApiDomain, Route[]>> = {};
