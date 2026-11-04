import "server-only";

import { connection } from "next/server";
import { getSessionUser } from "@/modules/platform/auth/session";
import { dispatchApiRequest } from "./dispatch";
import { API_PREFIX } from "./domains";
import { createApi } from "./endpoints";
import { parseResponse, withDefaults } from "./http";

/**
 * API para Server Components, Route Handlers y Server Actions. Es la misma API que
 * usa el navegador (/api/v1), atendida en el mismo proceso, sin salto de red: cada
 * dominio va a su implementación simulada o real según API_REAL_DOMAINS.
 * `connection()` hace que se consulte en cada request. Valida el permiso del usuario
 * de la sesión igual que el endpoint del navegador.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await connection();
  const response = await dispatchApiRequest(new Request(`http://app.local${API_PREFIX}${path}`, withDefaults(init)), {
    user: await getSessionUser(),
  });
  return parseResponse<T>(response);
}

export const api = createApi(request);
