import { erpGateway } from "@/integrations/dux";
import { POR_PAGINA_DUX } from "@/integrations/dux/paginas";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { hayQueAnonimizar } from "@/modules/customers/anonimizar";
import { guardarClientas, type ResultadoDeClientas } from "@/modules/customers/espejo-clientas";
import { abrirCorrida, cerrarCorrida, type OrigenDeCorrida } from "@/modules/platform/sync-runs";

/**
 * Clientas de DUX, por la v2 (`/v2/clientes`). Dos trampas de esa ruta:
 *
 * - El total miente: dice 50 y que no hay más en todas las páginas, así que se lee
 *   hasta una página incompleta. Una página que falla corta la lectura, porque no se
 *   sabe cuántas faltan, y la próxima corrida las vuelve a leer todas.
 * - Las filas no tienen un orden fijo: en los cortes de página, DUX repite unas y
 *   saltea otras, siempre las mismas (3 de 3.137, medido el 04/11). Cuántas filas tiene
 *   la lista sí es confiable: si se vieron menos IDs que filas, faltan, y se vuelve a
 *   pasar con los cortes en otro lugar.
 */

const INICIOS_DE_PASADA = [0, 25, 10];

type Avance = { vistas: Set<number>; filas: number; nuevas: number; cambiadas: number; llamadas: number };

/** Devuelve el motivo si se tuvo que cortar. */
async function leerPasada(inicio: number, avance: Avance): Promise<string | null> {
  let ultimoId: number | null = null;
  for (let offset = inicio; ; offset += POR_PAGINA_DUX) {
    const pagina = await leerPaginaDeClientas(offset);
    avance.llamadas += pagina.llamadas;
    if (!pagina.ok) return pagina.motivo;
    // Es lo único que frena una vuelta sin fin si DUX empezara a repetir la misma página.
    const ultimo: number | null = pagina.ids.at(-1) ?? null;
    if (ultimo !== null && ultimo === ultimoId) return "DUX repitió una página de clientas: se cortó la lectura.";
    ultimoId = ultimo;
    for (const id of pagina.ids) avance.vistas.add(id);
    if (inicio === 0) avance.filas += pagina.ids.length;
    avance.nuevas += pagina.nuevas;
    avance.cambiadas += pagina.cambiadas;
    if (!pagina.hayMas) return null;
  }
}

export async function leerClientasDux(origen: OrigenDeCorrida) {
  "use workflow";

  const corrida = await abrirLecturaDeClientas(origen);
  const avance: Avance = { vistas: new Set(), filas: 0, nuevas: 0, cambiadas: 0, llamadas: 0 };
  let motivo: string | null = null;
  for (const inicio of INICIOS_DE_PASADA) {
    motivo = await leerPasada(inicio, avance);
    if (motivo || avance.vistas.size >= avance.filas) break;
  }
  const faltan = avance.filas - avance.vistas.size;
  if (!motivo && faltan > 0) motivo = `DUX salteó ${faltan} de ${avance.filas} filas al paginar: faltan esas clientas.`;

  const { nuevas, cambiadas, llamadas } = avance;
  return cerrarLecturaDeClientas(corrida, { leidas: avance.vistas.size, nuevas, cambiadas, llamadas }, motivo);
}

export async function abrirLecturaDeClientas(origen: OrigenDeCorrida) {
  "use step";

  const { id } = await abrirCorrida("dux", "clientas", origen);
  return { id };
}

type PaginaDeClientas =
  | ({ ok: true; llamadas: number; hayMas: boolean; ids: number[] } & ResultadoDeClientas)
  | { ok: false; llamadas: number; motivo: string };

export async function leerPaginaDeClientas(offset: number): Promise<PaginaDeClientas> {
  "use step";

  let llamadas = 0;
  let pagina;
  try {
    const gateway = await erpGateway({ alIntentar: () => llamadas++ });
    pagina = await gateway.listarClientas(offset);
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ offset, code: error.code }, "clientas de DUX: falló una página");
    return { ok: false, llamadas, motivo: error.message };
  }
  const resultado = await guardarClientas(pagina.clientas, new Date());
  return { ok: true, llamadas, hayMas: pagina.hayMas, ids: pagina.clientas.map(({ id }) => id), ...resultado };
}

export async function cerrarLecturaDeClientas(
  corrida: { id: string },
  { leidas, nuevas, cambiadas, llamadas }: { leidas: number; nuevas: number; cambiadas: number; llamadas: number },
  motivo: string | null,
) {
  "use step";

  const n = (valor: number) => formatNumber(valor);
  // Tiene que verse en el panel: en producción, esto no debería decirlo nunca.
  const aviso = hayQueAnonimizar() ? " Anonimizadas: este ambiente no es producción." : "";
  if (motivo) {
    const status = leidas > 0 ? ("con_errores" as const) : ("error" as const);
    const detail = `Clientas leídas: ${n(leidas)}. ${motivo}${aviso}`;
    await cerrarCorrida(corrida.id, { status, calls: llamadas, records: leidas, detail });
    logger.warn({ corrida: corrida.id, leidas }, "clientas de DUX con errores");
    return { status };
  }
  const detail = `Clientas leídas: ${n(leidas)}. Nuevas: ${n(nuevas)}. Cambiadas: ${n(cambiadas)}.${aviso}`;
  await cerrarCorrida(corrida.id, { status: "ok", calls: llamadas, records: leidas, detail });
  logger.info({ corrida: corrida.id, leidas, nuevas, cambiadas, llamadas }, "clientas de DUX leídas");
  return { status: "ok" as const };
}
