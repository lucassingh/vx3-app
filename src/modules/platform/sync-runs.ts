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
