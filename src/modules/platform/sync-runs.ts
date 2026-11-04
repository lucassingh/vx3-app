import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { SyncRunStatus } from "@/generated/prisma/client";

/**
 * Corridas de sincronización: lo que muestra el panel de integraciones (RF-M0-04).
 * El detalle lo lee una persona, y nunca lleva datos personales.
 */

export type OrigenDeCorrida = { trigger: "cron" | "manual"; triggeredBy?: string | null };

export async function abrirCorrida(integration: string, operation: string, origen: OrigenDeCorrida) {
  const inicio = new Date();
  const { id } = await getDb().syncRun.create({
    data: {
      id: newId(),
      integration,
      operation,
      status: "en_curso",
      trigger: origen.trigger,
      triggeredBy: origen.triggeredBy ?? null,
      startedAt: inicio,
    },
    select: { id: true },
  });
  return { id, inicio };
}

export async function cerrarCorrida(
  id: string,
  resultado: { status: Exclude<SyncRunStatus, "en_curso">; calls: number; records: number; detail: string },
) {
  await getDb().syncRun.update({ where: { id }, data: { ...resultado, finishedAt: new Date() } });
}

/** Con el bloqueo tomado o recién soltado, ninguna corrida puede estar andando: las abiertas quedaron colgadas. */
async function cerrarColgadas(integration: string) {
  await getDb().syncRun.updateMany({
    where: { integration, status: "en_curso" },
    data: { status: "error", finishedAt: new Date(), detail: "La corrida se cortó antes de terminar." },
  });
}

/**
 * Una sola sentencia, que la fila serializa: de dos pedidos simultáneos gana uno solo,
 * y si el bloqueo venció, lo toma el que llega. Devuelve la llave para soltarlo, o null
 * si está tomado.
 */
export async function tomarBloqueo(integration: string, duracionMs: number): Promise<string | null> {
  const holder = newId();
  const [fila] = await getDb().$queryRaw<{ holder: string }[]>`
    INSERT INTO sync_locks (integration, holder, expires_at)
    VALUES (${integration}, ${holder}, clock_timestamp() + make_interval(secs => ${duracionMs}::float8 / 1000))
    ON CONFLICT (integration) DO UPDATE
      SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
      WHERE sync_locks.expires_at < clock_timestamp()
    RETURNING holder`;
  if (!fila) return null;
  await cerrarColgadas(integration);
  return holder;
}

/** Se toma antes de lanzar el Workflow: dice que hay una corrida apenas alguien la pide. */
export async function hayCorridaEnCurso(integration: string): Promise<boolean> {
  const bloqueo = await getDb().syncLock.findUnique({ where: { integration }, select: { expiresAt: true } });
  return bloqueo !== null && bloqueo.expiresAt > new Date();
}

/** Si venció y ya lo tomó otra corrida, no le toca nada: ni su bloqueo ni sus corridas abiertas. */
export async function soltarBloqueo(integration: string, holder: string) {
  const { count } = await getDb().syncLock.deleteMany({ where: { integration, holder } });
  if (count > 0) await cerrarColgadas(integration);
}
