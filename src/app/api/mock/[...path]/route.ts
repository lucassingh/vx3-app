import { isMockApi } from "@/lib/api/config";
import type { ApiErrorBody } from "@/lib/api/types";
import { handleMockRequest } from "@/mocks/router";

/**
 * API simulada para el navegador: /api/mock/*. Delega en src/mocks/router.ts.
 * Con NEXT_PUBLIC_API_MOCK=false responde 404 (ver src/lib/api/config.ts).
 */
async function handler(request: Request) {
  if (!isMockApi()) {
    const body: ApiErrorBody = {
      error: { status: 404, message: "La API simulada está desactivada (NEXT_PUBLIC_API_MOCK=false)." },
    };
    return Response.json(body, { status: 404 });
  }
  return handleMockRequest(request);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
