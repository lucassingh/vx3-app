import { erpGateway, sucursalesDux } from "@/integrations/dux";
import { POR_PAGINA_DUX } from "@/integrations/dux/paginas";
import { getDb } from "@/db/client";
import { businessTime } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { guardarComprobantes, type ResultadoDeVentas } from "@/modules/inventory/espejo-ventas";
import { mesesCompletos, type MesDeHistorial } from "@/modules/inventory/ventas";
import { abrirCorrida, cerrarCorrida, type OrigenDeCorrida } from "@/modules/platform/sync-runs";

/**
 * Ventas de DUX, por la v1: es la única versión que trae los ítems. Un request cada
 * 5,5 s, y el límite lo comparten los scripts de Elías y el Hub.
 *
 * Hay dos lecturas. La normal relee los últimos días, porque una factura puede anularse
 * después. El historial se dispara a mano una vez, mes a mes: cada mes queda registrado,
 * y volver a lanzarlo solo trae los que faltan.
 */

const DIAS_A_RELEER = 35;
const PREFIJO_HISTORIAL = "ventas_historial";

type Suma = { leidos: number; nuevos: number; cambiados: number; llamadas: number; fallidas: string[] };

/** Recorre un rango de una sucursal, un paso por página. Si falla la primera, no sabe cuántas hay y frena. */
async function leerRango(sucursal: number, desde: string, hasta: string, suma: Suma) {
  let total: number | null = null;
  for (let offset = 0; ; offset += POR_PAGINA_DUX) {
    const pagina = await leerPaginaDeVentas(sucursal, desde, hasta, offset);
    suma.llamadas += pagina.llamadas;
    if (pagina.ok) {
      total = pagina.total;
      suma.leidos += pagina.nuevos + pagina.cambiados + pagina.sinCambios;
      suma.nuevos += pagina.nuevos;
      suma.cambiados += pagina.cambiados;
    } else {
      suma.fallidas.push(pagina.motivo);
    }
    const hayMas: boolean = pagina.ok ? pagina.hayMas : total !== null && offset + POR_PAGINA_DUX < total;
    if (!hayMas) return;
  }
}

const sumaVacia = (): Suma => ({ leidos: 0, nuevos: 0, cambiados: 0, llamadas: 0, fallidas: [] });

/** La lectura normal: los últimos 35 días de las dos sucursales. */
export async function leerVentasDux(origen: OrigenDeCorrida) {
  "use workflow";

  const { corrida, sucursales, motivo, desde, hasta } = await abrirLecturaDeVentas(origen);
  const suma = sumaVacia();
  if (motivo) suma.fallidas.push(motivo);
  for (const sucursal of sucursales) await leerRango(sucursal, desde, hasta, suma);
  return cerrarLecturaDeVentas(corrida, suma);
}

/** El historial: cada mes completo de cada sucursal, salteando los que ya se trajeron. */
export async function traerHistorialDeVentasDux(origen: OrigenDeCorrida, meses = 12) {
  "use workflow";

  const tramos = await tramosPendientes(meses);
  const resumen = { tramos: tramos.length, fallidos: 0, leidos: 0 };
  for (const tramo of tramos) {
    const corrida = await abrirTramo(origen, tramo);
    const suma = sumaVacia();
    await leerRango(tramo.sucursal, tramo.desde, tramo.hasta, suma);
    const { status } = await cerrarLecturaDeVentas(corrida, suma);
    resumen.leidos += suma.leidos;
    if (status !== "ok") resumen.fallidos += 1;
  }
  return resumen;
}

type PaginaDeVentas =
  | ({ ok: true; llamadas: number; total: number; hayMas: boolean } & ResultadoDeVentas)
  | { ok: false; llamadas: number; motivo: string };

export async function leerPaginaDeVentas(
  sucursal: number,
  desde: string,
  hasta: string,
  offset: number,
): Promise<PaginaDeVentas> {
  "use step";

  let llamadas = 0;
  let pagina;
  try {
    const gateway = await erpGateway({ alIntentar: () => llamadas++ });
    pagina = await gateway.listarComprobantes({ sucursal, desde, hasta, offset });
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ sucursal, desde, offset, code: error.code }, "ventas de DUX: falló una página");
    return { ok: false, llamadas, motivo: error.message };
  }
  const resultado = await guardarComprobantes(pagina.comprobantes, new Date());
  return { ok: true, llamadas, total: pagina.total, hayMas: pagina.hayMas, ...resultado };
}

export async function abrirLecturaDeVentas(origen: OrigenDeCorrida) {
  "use step";

  const hoy = businessTime.today();
  const { id } = await abrirCorrida("dux", "ventas", origen);
  const lectura = { corrida: { id }, desde: businessTime.addDays(hoy, -DIAS_A_RELEER), hasta: hoy };
  try {
    return { ...lectura, sucursales: sucursalesDux(), motivo: null };
  } catch (error) {
    // Un ambiente mal configurado tiene que verse en el panel, como cualquier otra corrida fallida.
    if (!isAppError(error)) throw error;
    return { ...lectura, sucursales: [], motivo: error.message };
  }
}

type Tramo = MesDeHistorial & { sucursal: number; operacion: string };

export async function tramosPendientes(meses: number): Promise<Tramo[]> {
  "use step";

  const hechos = await getDb().syncRun.findMany({
    where: { integration: "dux", operation: { startsWith: `${PREFIJO_HISTORIAL}:` }, status: "ok" },
    select: { operation: true },
  });
  const yaLeidos = new Set(hechos.map(({ operation }) => operation));
  return mesesCompletos(businessTime.today(), meses)
    .flatMap((mes) =>
      sucursalesDux().map((sucursal) => ({
        ...mes,
        sucursal,
        operacion: `${PREFIJO_HISTORIAL}:${mes.mes}:${sucursal}`,
      })),
    )
    .filter(({ operacion }) => !yaLeidos.has(operacion));
}

export async function abrirTramo(origen: OrigenDeCorrida, tramo: Tramo) {
  "use step";

  const { id } = await abrirCorrida("dux", tramo.operacion, origen);
  return { id };
}

export async function cerrarLecturaDeVentas(corrida: { id: string }, suma: Suma) {
  "use step";

  const { leidos, nuevos, cambiados, llamadas, fallidas } = suma;
  const n = (valor: number) => formatNumber(valor);
  if (fallidas.length > 0) {
    const status = leidos > 0 ? ("con_errores" as const) : ("error" as const);
    const detail = `Comprobantes leídos: ${n(leidos)}. Errores: ${n(fallidas.length)}. ${fallidas[0]}`;
    await cerrarCorrida(corrida.id, { status, calls: llamadas, records: leidos, detail });
    logger.warn({ corrida: corrida.id, leidos, fallidas: fallidas.length }, "ventas de DUX con errores");
    return { status };
  }
  const detail = `Comprobantes leídos: ${n(leidos)}. Nuevos: ${n(nuevos)}. Cambiados: ${n(cambiados)}.`;
  await cerrarCorrida(corrida.id, { status: "ok", calls: llamadas, records: leidos, detail });
  logger.info({ corrida: corrida.id, leidos, nuevos, cambiados, llamadas }, "ventas de DUX leídas");
  return { status: "ok" as const };
}
