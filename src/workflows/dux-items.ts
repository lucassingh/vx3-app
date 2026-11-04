import { erpGateway, POR_PAGINA_DUX } from "@/integrations/dux";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { guardarItems, marcarAusentes, type ResultadoDePagina } from "@/modules/inventory/espejo-items";
import { abrirCorrida, cerrarCorrida, type OrigenDeCorrida } from "@/modules/platform/sync-runs";

/**
 * Barrido de productos, stock y precios (`solucion_doc/06` §6): un paso por página,
 * así una que falla no obliga a repetir las demás. Son unas 50 páginas, menos de un
 * minuto a 4 por segundo.
 *
 * Lo que falla de DUX vuelve como resultado: el cliente ya lo reintentó, y sumarle los
 * reintentos del paso solo alargaría la espera. El Workflow reintenta lo inesperado.
 */
export async function barrerItemsDux(origen: OrigenDeCorrida) {
  "use workflow";

  const corrida = await abrirBarrido(origen);
  const suma = { leidos: 0, nuevos: 0, cambiados: 0, llamadas: 0 };
  const fallidas: { offset: number; motivo: string }[] = [];
  let total: number | null = null;

  for (let offset = 0; ; offset += POR_PAGINA_DUX) {
    const pagina = await barrerPagina(corrida.inicio, offset);
    suma.llamadas += pagina.llamadas;
    if (pagina.ok) {
      total = pagina.total;
      suma.leidos += pagina.nuevos + pagina.cambiados + pagina.sinCambios;
      suma.nuevos += pagina.nuevos;
      suma.cambiados += pagina.cambiados;
    } else {
      fallidas.push({ offset, motivo: pagina.motivo });
    }
    // Si falló la primera, no se sabe cuántas hay: no tiene sentido seguir a ciegas.
    const hayMas: boolean = pagina.ok ? pagina.hayMas : total !== null && offset + POR_PAGINA_DUX < total;
    if (!hayMas) break;
  }

  return cerrarBarrido(corrida, suma, fallidas);
}

export async function abrirBarrido(origen: OrigenDeCorrida) {
  "use step";

  const { id, inicio } = await abrirCorrida("dux", "items", origen);
  return { id, inicio: inicio.toISOString() };
}

type PaginaBarrida =
  | ({ ok: true; llamadas: number; total: number; hayMas: boolean } & ResultadoDePagina)
  | { ok: false; llamadas: number; motivo: string };

export async function barrerPagina(inicio: string, offset: number): Promise<PaginaBarrida> {
  "use step";

  let llamadas = 0;
  let pagina;
  try {
    const gateway = await erpGateway({ alIntentar: () => llamadas++ });
    pagina = await gateway.listarItems(offset);
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ offset, code: error.code }, "barrido de DUX: falló una página");
    return { ok: false, llamadas, motivo: error.message };
  }
  const resultado = await guardarItems(pagina.items, new Date(inicio));
  return { ok: true, llamadas, total: pagina.total, hayMas: pagina.hayMas, ...resultado };
}

export async function cerrarBarrido(
  corrida: { id: string; inicio: string },
  { leidos, nuevos, cambiados, llamadas }: { leidos: number; nuevos: number; cambiados: number; llamadas: number },
  fallidas: { offset: number; motivo: string }[],
) {
  "use step";

  const n = (valor: number) => formatNumber(valor);
  if (fallidas.length > 0) {
    // Una lectura incompleta no prueba que algo haya desaparecido: no se marca nada como ausente.
    const status = leidos > 0 ? "con_errores" : "error";
    const detail = `Leídos ${n(leidos)} items; fallaron ${n(fallidas.length)} ${fallidas.length === 1 ? "página" : "páginas"}. ${fallidas[0]!.motivo}`;
    await cerrarCorrida(corrida.id, { status, calls: llamadas, records: leidos, detail });
    logger.warn({ corrida: corrida.id, leidos, fallidas: fallidas.length }, "barrido de DUX con errores");
    return { status, leidos, nuevos, cambiados, ausentes: 0 };
  }

  const ausentes = await marcarAusentes(new Date(corrida.inicio));
  const detail = `${n(leidos)} items: ${n(nuevos)} nuevos, ${n(cambiados)} cambiados, ${n(ausentes)} ya no aparecen.`;
  await cerrarCorrida(corrida.id, { status: "ok", calls: llamadas, records: leidos, detail });
  logger.info({ corrida: corrida.id, leidos, nuevos, cambiados, ausentes, llamadas }, "barrido de DUX terminado");
  return { status: "ok" as const, leidos, nuevos, cambiados, ausentes };
}
