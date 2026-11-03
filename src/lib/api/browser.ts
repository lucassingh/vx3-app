import { API_PREFIX } from "./domains";
import { createApi } from "./endpoints";
import { parseResponse, withDefaults } from "./http";

/**
 * API para Client Components: el endpoint /api/v1 de la app, que decide en el
 * servidor si cada dominio es simulado o real (API_REAL_DOMAINS).
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(await fetch(`${API_PREFIX}${path}`, withDefaults(init)));
}

export const api = createApi(request);
