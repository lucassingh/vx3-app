import { SEGMENTO } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { recalcularClientas } from "@/modules/customers/fichas";
import { abrirCorrida, cerrarCorrida, soltarBloqueo, type OrigenDeCorrida } from "@/modules/platform/sync-runs";
import { importarCatalogoTrasDux } from "./catalogo";
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

  let resumen;
  try {
    const { status: items } = await barrerItemsDux(origen);
    const { status: ventas } = await leerVentasDux(origen);
    const { status: clientas } = await leerClientasDux(origen);
    await recalcularFichasDux(origen);
    resumen = { items, ventas, clientas };
  } finally {
    await soltarBloqueoDux(bloqueo);
  }
  // Necesita lo que DUX acaba de traer. Si falla, lo de DUX ya quedó hecho.
  await importarCatalogoTrasDux(origen);
  return resumen;
}

/** Se dispara a mano y una sola vez: usa el límite de la v1 que comparten los scripts de VX3. */
export async function traerHistorialDux(origen: OrigenDeCorrida, bloqueo: string) {
  "use workflow";

  try {
    const resumen = await traerHistorialDeVentasDux(origen);
    await recalcularFichasDux(origen);
    return resumen;
  } finally {
    await soltarBloqueoDux(bloqueo);
  }
}

/** Sale del espejo: se recalcula con lo que haya, aunque alguna lectura haya fallado. No le pide nada a DUX. */
export async function recalcularFichasDux(origen: OrigenDeCorrida) {
  "use step";

  const { id } = await abrirCorrida("dux", "fichas", origen);
  const { clientas, nuevas, cambiadas, sinTelefono, sinCompras, segmentos } = await recalcularClientas(new Date());
  const n = (valor: number) => formatNumber(valor);
  const porSegmento = (["dormida", "en_riesgo", "nueva", "top", "activa"] as const)
    .map((segmento) => `${SEGMENTO[segmento].label.toLowerCase()} ${n(segmentos[segmento])}`)
    .join(", ");
  await cerrarCorrida(id, {
    status: "ok",
    calls: 0,
    records: clientas,
    detail: `Clientas: ${n(clientas)}. Nuevas: ${n(nuevas)}. Cambiadas: ${n(cambiadas)}. Fichas sin teléfono: ${n(sinTelefono)}. Segmentos: ${porSegmento}. Sin compras: ${n(sinCompras)}.`,
  });
}

export async function soltarBloqueoDux(bloqueo: string) {
  "use step";

  await soltarBloqueo("dux", bloqueo);
}
