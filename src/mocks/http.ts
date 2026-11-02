import type { ApiErrorBody, Paginated } from "@/lib/api/types";

/** Helpers compartidos por las rutas de cada dominio (src/mocks/domains). */

export type RouteContext = { url: URL; params: string[]; request: Request };

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
