import { tiendaNube } from "@/integrations/tiendanube";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { guardarLecturaDeLaTienda } from "@/modules/catalog/lectura-tienda";
import { credencialEnmascarada } from "@/modules/platform/credentials/service";
import { abrirCorrida, cerrarCorrida, type OrigenDeCorrida } from "@/modules/platform/sync-runs";

export const OPERACION_DE_LA_TIENDA = "lectura";

/**
 * Lo que hay publicado en la tienda, para el control final. Solo lee, y son unos 8 pedidos. Sin el
 * token cargado no hace nada: ese ambiente todavía no está conectado. Si falla, queda la foto anterior.
 */
export async function leerTiendaNube(origen: OrigenDeCorrida) {
  "use step";

  if (!(await credencialEnmascarada("tiendanube"))) return { status: "omitida" as const };

  const { id } = await abrirCorrida("tiendanube", OPERACION_DE_LA_TIENDA, origen);
  let llamadas = 0;
  try {
    const cliente = await tiendaNube({ alIntentar: () => llamadas++ });
    const categorias = await cliente.listarCategorias();
    const productos = await cliente.listarProductos();
    const resumen = await guardarLecturaDeLaTienda(productos, categorias, new Date());
    const fuera = resumen.fueraDeLasSecciones;
    await cerrarCorrida(id, {
      status: "ok",
      calls: llamadas,
      records: resumen.productos,
      detail: `Productos: ${formatNumber(resumen.productos)}, ${formatNumber(resumen.visibles)} visibles. Fuera de las secciones: ${formatNumber(fuera)}.`,
    });
    return { status: "ok" as const };
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ code: error.code }, "Tienda Nube: falló la lectura");
    await cerrarCorrida(id, {
      status: "error",
      calls: llamadas,
      records: 0,
      detail: `${error.message} Queda la lectura anterior.`,
    });
    return { status: "error" as const };
  }
}
