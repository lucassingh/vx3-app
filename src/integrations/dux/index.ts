import "server-only";
import { serverEnv } from "@/env";
import { ExternalServiceError } from "@/lib/errors";
import { limiteCompartido } from "@/lib/rate-limit";
import { leerCredencial } from "@/modules/platform/credentials/service";
import type { ErpGateway } from "@/modules/inventory/erp-gateway";
import { createDuxClient, LIMITES_DUX } from "./client";
import { createDuxEscritura } from "./escritura";
import { aErpComprobante, aErpItem, aPaginaDeClientas } from "./mapeo";
import { POR_PAGINA_DUX } from "./paginas";

const URL_POR_DEFECTO = "https://erp.duxsoftware.com.ar/WSERP/rest/services";

type Opciones = { esperasMs?: readonly number[]; alIntentar?: () => void };

/** El cliente de DUX de este ambiente, con el token guardado y el límite compartido. */
export async function duxClient({ esperasMs, alIntentar }: Opciones = {}) {
  const env = serverEnv();
  const { DUX_ID_EMPRESA: idEmpresa, DUX_ID_SUCURSAL_ECOMMERCE: idSucursal } = env;
  if (!idEmpresa || !idSucursal) {
    throw new ExternalServiceError("DUX", "Faltan DUX_ID_EMPRESA o DUX_ID_SUCURSAL_ECOMMERCE en este ambiente.");
  }
  const token = await leerCredencial("dux");
  if (!token) throw new ExternalServiceError("DUX", "Todavía no se cargó el token de DUX.");

  return createDuxClient(
    { baseUrl: env.DUX_API_URL ?? URL_POR_DEFECTO, token, idEmpresa, idSucursal },
    {
      esperasMs,
      alIntentar,
      limites: {
        v1: limiteCompartido(LIMITES_DUX.v1.clave, LIMITES_DUX.v1.intervaloMs),
        v2: limiteCompartido(LIMITES_DUX.v2.clave, LIMITES_DUX.v2.intervaloMs),
      },
    },
  );
}

/** Lo único que escribe en DUX. Fuera de producción falla, salvo con el conjunto de datos de prueba. */
export async function duxEscritura({ alIntentar }: Pick<Opciones, "alIntentar"> = {}) {
  const env = serverEnv();
  const token = await leerCredencial("dux");
  if (!token) throw new ExternalServiceError("DUX", "Todavía no se cargó el token de DUX.");
  return createDuxEscritura(
    { baseUrl: env.DUX_API_URL ?? URL_POR_DEFECTO, token },
    {
      alIntentar,
      ambiente: process.env.APP_ENV,
      prueba: env.DUX_CABECERA_DE_PRUEBA,
      limite: limiteCompartido(LIMITES_DUX.v2.clave, LIMITES_DUX.v2.intervaloMs),
    },
  );
}

/** Las dos sucursales que venden, e-commerce y local. No necesita el token. */
export function sucursalesDux(): number[] {
  const { DUX_ID_SUCURSAL_ECOMMERCE: ecommerce, DUX_ID_SUCURSAL_LOCAL: local } = serverEnv();
  if (!ecommerce || !local) {
    throw new ExternalServiceError("DUX", "Faltan DUX_ID_SUCURSAL_ECOMMERCE o DUX_ID_SUCURSAL_LOCAL en este ambiente.");
  }
  return [ecommerce, local];
}

/** DUX como lo ve el dominio. */
export async function erpGateway(opciones: Opciones = {}): Promise<ErpGateway> {
  const cliente = await duxClient(opciones);
  return {
    listarClientas: async (offset) => aPaginaDeClientas(await cliente.listarClientes(offset), POR_PAGINA_DUX),
    listarComprobantes: async (pedido) => {
      const { results, paging } = await cliente.listarFacturas(pedido);
      return {
        comprobantes: results.map((factura) => aErpComprobante(factura, pedido.sucursal)),
        total: paging?.total ?? pedido.offset + results.length,
        // Una página incompleta es la última: `paging.total` no siempre viene.
        hayMas: results.length === POR_PAGINA_DUX && pedido.offset + POR_PAGINA_DUX < (paging?.total ?? Infinity),
      };
    },
    listarItems: async (offset) => {
      const { datos, paginacion } = await cliente.listarItems(offset);
      return { items: datos.map(aErpItem), total: paginacion.total, hayMas: paginacion.hay_mas };
    },
  };
}
