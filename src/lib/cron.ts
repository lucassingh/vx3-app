import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron llama a las rutas de /api/cron con `Authorization: Bearer
 * <CRON_SECRET>`. Sin el secreto configurado no pasa nadie.
 */
export function cronAutorizado(request: Request, secreto: string | undefined) {
  if (!secreto) return false;
  const recibido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
