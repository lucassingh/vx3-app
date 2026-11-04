import { logger } from "@/lib/logger";
import { borrarIntentosVencidos, borrarSesionesVencidas } from "@/modules/platform/maintenance";

/**
 * Mantenimiento diario. Lo arranca Vercel Cron por /api/cron/mantenimiento y
 * corre como Workflow: cada paso se reintenta solo si falla, y la corrida se ve
 * paso por paso en Vercel Observability.
 */
export async function mantenimientoDiario() {
  "use workflow";

  const intentos = await limpiarIntentosDeLogin();
  const sesiones = await limpiarSesiones();
  return { intentos, sesiones };
}

export async function limpiarIntentosDeLogin() {
  "use step";

  const borrados = await borrarIntentosVencidos();
  logger.info({ borrados }, "mantenimiento: intentos de login vencidos");
  return borrados;
}

export async function limpiarSesiones() {
  "use step";

  const borradas = await borrarSesionesVencidas();
  logger.info({ borradas }, "mantenimiento: sesiones vencidas");
  return borradas;
}
