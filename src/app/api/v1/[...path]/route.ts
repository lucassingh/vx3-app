import { cookies } from "next/headers";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import { errorResponse } from "@/lib/api/route";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * API de la app para el navegador: /api/v1/*. Pide sesión, porque el proxy no
 * cubre /api, y delega en el despachador, que manda cada dominio a su
 * implementación simulada o real.
 */
async function handler(request: Request) {
  const cookieStore = await cookies();
  if (!(await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value))) {
    return errorResponse(401, "La sesión venció: volvé a entrar.");
  }
  return dispatchApiRequest(request);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
