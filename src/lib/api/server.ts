import "server-only";

import { connection } from "next/server";
import { handleMockRequest, MOCK_API_PREFIX } from "@/mocks/router";
import { isMockApi } from "./config";
import { createApi } from "./endpoints";
import { ApiError, parseResponse, withDefaults } from "./http";

/**
 * API para Server Components, Route Handlers y Server Actions.
 *
 * - Con el mock activo (`NEXT_PUBLIC_API_MOCK`, ver config.ts): usa la API
 *   simulada en el mismo proceso, sin salto de red. `connection()` hace que se
 *   consulte en cada request, igual que un fetch real.
 * - Con el mock apagado: hace fetch a `API_URL`.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (isMockApi()) {
    await connection();
    const mockRequest = new Request(`http://mock.local${MOCK_API_PREFIX}${path}`, withDefaults(init));
    return parseResponse<T>(await handleMockRequest(mockRequest));
  }

  const baseUrl = process.env.API_URL;
  if (!baseUrl) {
    throw new ApiError(500, "Falta API_URL: con NEXT_PUBLIC_API_MOCK=false hay que definir la URL de la API real.");
  }
  return parseResponse<T>(await fetch(`${baseUrl}${path}`, withDefaults(init)));
}

export const api = createApi(request);
