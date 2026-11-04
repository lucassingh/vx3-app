import { dispatchApiRequest } from "@/lib/api/dispatch";
import { getSessionUser } from "@/modules/platform/auth/session";

/**
 * API de la app para el navegador: /api/v1/*. El despachador pide sesión (el
 * proxy no cubre /api), valida el permiso del área y manda cada dominio a su
 * implementación simulada o real.
 */
async function handler(request: Request) {
  return dispatchApiRequest(request, { user: await getSessionUser() });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
