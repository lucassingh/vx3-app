import { MOCK_API_PREFIX } from "@/mocks/constants";
import { isMockApi } from "./config";
import { createApi } from "./endpoints";
import { ApiError, parseResponse, withDefaults } from "./http";

/**
 * API para Client Components. Con el mock activo llama a la API simulada
 * servida en /api/mock; con el mock apagado, a `NEXT_PUBLIC_API_URL`.
 */
function baseUrl() {
  if (isMockApi()) return MOCK_API_PREFIX;
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(
      500,
      "Falta NEXT_PUBLIC_API_URL: con NEXT_PUBLIC_API_MOCK=false hay que definir la URL de la API real.",
    );
  }
  return url;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(await fetch(`${baseUrl()}${path}`, withDefaults(init)));
}

export const api = createApi(request);
