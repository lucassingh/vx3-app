import "server-only";
import { getDb } from "@/db/client";
import { OLVIDO_MS } from "./auth/throttle";

/**
 * Limpieza diaria de la base (workflow de mantenimiento, src/workflows/). Cada
 * función es idempotente: correrla dos veces borra lo mismo que una.
 */

/**
 * Contadores de intentos de login que ya no cuentan: sin fallos en el último
 * día (throttle.ts los olvida) y sin un bloqueo vigente.
 */
export async function borrarIntentosVencidos(ahora = new Date()) {
  const { count } = await getDb().loginThrottle.deleteMany({
    where: {
      updatedAt: { lt: new Date(ahora.getTime() - OLVIDO_MS) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: ahora } }],
    },
  });
  return count;
}

/** Sesiones vencidas: Better Auth ya no las acepta, pero quedan en la tabla. */
export async function borrarSesionesVencidas(ahora = new Date()) {
  const { count } = await getDb().session.deleteMany({ where: { expiresAt: { lt: ahora } } });
  return count;
}
