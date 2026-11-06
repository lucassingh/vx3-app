import { erpGateway } from "@/integrations/dux";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { guardarCodigosUsados } from "@/modules/catalog/alta-consultas";
import { abrirCorrida, cerrarCorrida, type OrigenDeCorrida } from "@/modules/platform/sync-runs";

/**
 * Todos los códigos que existen en DUX, inhabilitados incluidos, para no reusar nunca un número
 * (RN-03). `/v2/items` no trae los inhabilitados; `/v2/stock`, sí. Son unas 57 páginas, y si una
 * falla se corta: lo que ya se leyó queda, y la próxima corrida lee el resto.
 */
export async function leerCodigosDux(origen: OrigenDeCorrida) {
  "use workflow";

  const corrida = await abrirLecturaDeCodigos(origen);
  const suma = { leidos: 0, nuevos: 0, llamadas: 0 };
  let motivo: string | null = null;

  for (let offset = 0; ; offset += 50) {
    const pagina = await leerPaginaDeCodigos(offset);
    suma.llamadas += pagina.llamadas;
    if (!pagina.ok) {
      motivo = pagina.motivo;
      break;
    }
    suma.leidos += pagina.leidos;
    suma.nuevos += pagina.nuevos;
    if (!pagina.hayMas) break;
  }

  return cerrarLecturaDeCodigos(corrida, suma, motivo);
}

export async function abrirLecturaDeCodigos(origen: OrigenDeCorrida) {
  "use step";

  const { id } = await abrirCorrida("dux", "codigos", origen);
  return { id };
}

type PaginaDeCodigos =
  | { ok: true; llamadas: number; leidos: number; nuevos: number; hayMas: boolean }
  | { ok: false; llamadas: number; motivo: string };

export async function leerPaginaDeCodigos(offset: number): Promise<PaginaDeCodigos> {
  "use step";

  let llamadas = 0;
  let pagina;
  try {
    const gateway = await erpGateway({ alIntentar: () => llamadas++ });
    pagina = await gateway.listarCodigos(offset);
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ offset, code: error.code }, "códigos de DUX: falló una página");
    return { ok: false, llamadas, motivo: error.message };
  }
  const nuevos = await guardarCodigosUsados(pagina.codigos, new Date());
  return { ok: true, llamadas, leidos: pagina.codigos.length, nuevos, hayMas: pagina.hayMas };
}

export async function cerrarLecturaDeCodigos(
  corrida: { id: string },
  { leidos, nuevos, llamadas }: { leidos: number; nuevos: number; llamadas: number },
  motivo: string | null,
) {
  "use step";

  const n = (valor: number) => formatNumber(valor);
  const detalle = `Códigos leídos: ${n(leidos)}. Nuevos: ${n(nuevos)}.`;
  const status = !motivo ? "ok" : leidos > 0 ? "con_errores" : "error";
  await cerrarCorrida(corrida.id, {
    status,
    calls: llamadas,
    records: leidos,
    detail: motivo ? `${detalle} ${motivo}` : detalle,
  });
  return { status };
}
