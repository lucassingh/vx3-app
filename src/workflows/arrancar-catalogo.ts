import { start } from "workflow/api";
import { BLOQUEO_DEL_CATALOGO } from "@/modules/catalog/importar";
import { soltarBloqueo, tomarBloqueo, type OrigenDeCorrida } from "@/modules/platform/sync-runs";
import type { Arranque } from "./arrancar-dux";
import { importarCatalogo, VENCE_IMPORTACION_MS } from "./catalogo";

/** El botón "Reimportar". El bloqueo se toma antes de lanzarla: nunca hay dos a la vez. */
export async function arrancarImportacionDelCatalogo(origen: OrigenDeCorrida): Promise<Arranque> {
  const bloqueo = await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_IMPORTACION_MS);
  if (!bloqueo) return { arrancada: false };
  try {
    const { runId } = await start(importarCatalogo, [origen, bloqueo]);
    return { arrancada: true, runId };
  } catch (error) {
    await soltarBloqueo(BLOQUEO_DEL_CATALOGO, bloqueo);
    throw error;
  }
}

/** El botón del corte: la misma importación, que al terminar bien marca el corte. */
export async function arrancarElCorte(origen: OrigenDeCorrida): Promise<Arranque> {
  const bloqueo = await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_IMPORTACION_MS);
  if (!bloqueo) return { arrancada: false };
  try {
    const { runId } = await start(importarCatalogo, [origen, bloqueo, true]);
    return { arrancada: true, runId };
  } catch (error) {
    await soltarBloqueo(BLOQUEO_DEL_CATALOGO, bloqueo);
    throw error;
  }
}
