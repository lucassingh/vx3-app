import { erpGateway } from "@/integrations/dux";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { guardarReferencias } from "@/modules/catalog/alta-consultas";
import { abrirCorrida, cerrarCorrida, type OrigenDeCorrida } from "@/modules/platform/sync-runs";

/**
 * Rubros, subrubros, proveedores y listas de DUX, con su ID: es lo que ofrece el alta, y lo que pide
 * DUX al crear un producto. Son unos 10 pedidos. Si alguno falla, quedan las de la corrida anterior.
 */
export async function leerReferenciasDux(origen: OrigenDeCorrida) {
  "use step";

  const { id } = await abrirCorrida("dux", "referencias", origen);
  let llamadas = 0;
  try {
    const gateway = await erpGateway({ alIntentar: () => llamadas++ });
    const referencias = await gateway.listarReferencias();
    const guardadas = await guardarReferencias(referencias, new Date());
    await cerrarCorrida(id, {
      status: "ok",
      calls: llamadas,
      records: guardadas,
      detail: `Rubros: ${formatNumber(referencias.rubros.length)}. Subrubros: ${formatNumber(referencias.subrubros.length)}. Proveedores: ${formatNumber(referencias.proveedores.length)}. Listas: ${formatNumber(referencias.listas.length)}.`,
    });
    return { status: "ok" as const };
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ code: error.code }, "referencias de DUX: falló la lectura");
    await cerrarCorrida(id, {
      status: "error",
      calls: llamadas,
      records: 0,
      detail: `${error.message} Quedan las de la lectura anterior.`,
    });
    return { status: "error" as const };
  }
}
