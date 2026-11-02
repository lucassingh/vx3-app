import type { ApiErrorBody } from "./types";

/** Firma común de los transportes (servidor, navegador, tests). */
export type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** `{ q: "a", page: 2, empty: undefined }` → `"?q=a&page=2"`. */
export function toQueryString(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Headers JSON, auth y timeout por defecto para cada request. */
export function withDefaults(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // Para una API real con sesión, agregá acá el token:
  // headers.set("Authorization", `Bearer ${token}`);

  return {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  };
}

export async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const message = body?.error?.message ?? (response.statusText || "Error de la API");
    throw new ApiError(response.status, message, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
