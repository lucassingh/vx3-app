import { start } from "workflow/api";
import { soltarBloqueo, tomarBloqueo, type OrigenDeCorrida } from "@/modules/platform/sync-runs";
import { sincronizarDux, traerHistorialDux } from "./dux-sync";

/**
 * Por acá pasa todo lo que lanza una lectura de DUX, para que nunca haya dos a la vez.
 * El bloqueo se suelta al terminar; estos plazos son solo por si el Workflow muere antes.
 */
const MINUTO_MS = 60_000;
const VENCE_SINCRONIZACION_MS = 30 * MINUTO_MS;
/** Unos 15 minutos a 5,5 s por request, más las esperas si DUX falla. */
const VENCE_HISTORIAL_MS = 120 * MINUTO_MS;

export type Arranque = { arrancada: true; runId: string } | { arrancada: false };

async function arrancar(
  duracionMs: number,
  lanzar: (bloqueo: string) => Promise<{ runId: string }>,
): Promise<Arranque> {
  const bloqueo = await tomarBloqueo("dux", duracionMs);
  if (!bloqueo) return { arrancada: false };
  try {
    const { runId } = await lanzar(bloqueo);
    return { arrancada: true, runId };
  } catch (error) {
    await soltarBloqueo("dux", bloqueo);
    throw error;
  }
}

export function arrancarSincronizacionDux(origen: OrigenDeCorrida) {
  return arrancar(VENCE_SINCRONIZACION_MS, (bloqueo) => start(sincronizarDux, [origen, bloqueo]));
}

export function arrancarHistorialDux(origen: OrigenDeCorrida) {
  return arrancar(VENCE_HISTORIAL_MS, (bloqueo) => start(traerHistorialDux, [origen, bloqueo]));
}
