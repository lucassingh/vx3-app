import { soltarBloqueo } from "@/modules/platform/sync-runs";
import type { OrigenDeCorrida } from "@/modules/platform/sync-runs";
import { barrerItemsDux } from "./dux-items";
import { leerClientasDux } from "./dux-clientas";
import { leerVentasDux, traerHistorialDeVentasDux } from "./dux-ventas";

/**
 * La sincronización completa con DUX (`solucion_doc/06` §6). Cada lectura registra su
 * propia corrida, y lo que falla de DUX vuelve como resultado: una que no pudo leer no
 * frena a las demás. Si aun así algo revienta, el bloqueo se suelta igual.
 */
export async function sincronizarDux(origen: OrigenDeCorrida, bloqueo: string) {
  "use workflow";

  try {
    const { status: items } = await barrerItemsDux(origen);
    const { status: ventas } = await leerVentasDux(origen);
    const { status: clientas } = await leerClientasDux(origen);
    return { items, ventas, clientas };
  } finally {
    await soltarBloqueoDux(bloqueo);
  }
}

/** Se dispara a mano y una sola vez: usa el límite de la v1 que comparten los scripts de VX3. */
export async function traerHistorialDux(origen: OrigenDeCorrida, bloqueo: string) {
  "use workflow";

  try {
    return await traerHistorialDeVentasDux(origen);
  } finally {
    await soltarBloqueoDux(bloqueo);
  }
}

export async function soltarBloqueoDux(bloqueo: string) {
  "use step";

  await soltarBloqueo("dux", bloqueo);
}
