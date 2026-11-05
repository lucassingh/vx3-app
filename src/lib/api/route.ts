import type { ApiErrorBody, Paginated } from "@/lib/api/types";

/**
 * Helpers de las rutas de la API: los usan las simuladas (src/mocks/domains) y las
 * reales (src/lib/api/real-routes.ts), así un dominio cambia de una a otra sin
 * tocar el contrato.
 */

/**
 * Grupos de captura del patrón, en orden. Hoy cada patrón tiene a lo sumo uno y
 * ninguno es opcional, así que el primero está garantizado cuando el handler lo
 * declara; cualquier otro hay que chequearlo.
 */
export type RouteParams = readonly [string, ...string[]];

export type RouteContext = {
  url: URL;
  params: RouteParams;
  request: Request;
  /** Quién pide, en las rutas reales: lo guardan las que registran lo que hizo una persona. */
  actorId?: string | null;
};

/** Los parámetros de una ruta, a partir del match de su patrón. */
export function routeParams(match: RegExpMatchArray): RouteParams {
  return match.slice(1) as unknown as RouteParams;
}

export type Route = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  pattern: RegExp;
  handler: (context: RouteContext) => Response | Promise<Response>;
};

export function errorResponse(status: number, message: string) {
  const body: ApiErrorBody = { error: { status, message } };
  return Response.json(body, { status });
}

export function readInt(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** Pagina con `?page=` y `?pageSize=`; una página fuera de rango va a la última. */
export function paginate<T>(rows: T[], url: URL, defaultPageSize = 10): Paginated<T> {
  const pageSize = readInt(url.searchParams.get("pageSize"), defaultPageSize, 100);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(readInt(url.searchParams.get("page"), 1), totalPages);
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: rows.length,
    totalPages,
  };
}

/** Body JSON de un POST/PATCH; `{}` si viene vacío o mal formado. */
export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
  try {
    return ((await request.json()) ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}
