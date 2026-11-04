import "server-only";
import type { z } from "zod";
import { businessTime } from "@/lib/dates";
import { ExternalServiceError } from "@/lib/errors";
import { createHttpClient, type HttpClientOptions } from "@/lib/http-client";
import type { LimiteDeTasa } from "@/lib/rate-limit";
import type { PedidoDeComprobantes } from "@/modules/inventory/erp-gateway";
import { clasificarRespuestaDux } from "./respuesta";
import { duxPaginaClientesSchema, duxPaginaFacturasSchema, duxPaginaItemsSchema } from "./schemas";

/**
 * Adaptador de la API de DUX (`solucion_doc/04` §1, `tecnica.md` §7). Solo lee: no
 * tiene ningún método que escriba, así que fuera de producción no puede tocar la
 * empresa real.
 *
 * Usa las dos versiones. La v2 (Bearer, 5 por segundo) lee el catálogo; la v1 (el
 * token solo, un request cada 5,5 s) es la única que trae las ventas con sus ítems.
 */

export const LIMITES_DUX = { v2: { clave: "dux:v2", intervaloMs: 250 }, v1: { clave: "dux:v1", intervaloMs: 5_500 } };

/** 200 con "Formato desconocido" se arregló en todas las pruebas con la primera espera. */
const ESPERAS_MS = [5_000, 15_000, 30_000];
export const POR_PAGINA = 50;

export type DuxConfig = {
  baseUrl: string;
  token: string;
  idEmpresa: number;
  idSucursal: number;
};

type Dependencias = {
  limites: { v1: LimiteDeTasa; v2: LimiteDeTasa };
  esperasMs?: readonly number[];
} & Pick<HttpClientOptions, "fetch" | "esperar" | "log" | "alIntentar">;

function validar<S extends z.ZodType>(esquema: S, cuerpo: unknown, ruta: string): z.output<S> {
  const resultado = esquema.safeParse(cuerpo);
  if (resultado.success) return resultado.data;
  // Sin el valor: el detalle de Zod puede repetir datos de la respuesta.
  const campos = resultado.error.issues.slice(0, 5).map((issue) => issue.path.join("."));
  throw new ExternalServiceError(
    "DUX",
    `DUX respondió con una forma que no esperábamos en ${ruta.split("?")[0]}: ${campos.join(", ")}. No se guardó nada.`,
  );
}

export function createDuxClient(config: DuxConfig, { limites, esperasMs = ESPERAS_MS, ...dependencias }: Dependencias) {
  const base = {
    servicio: "DUX",
    baseUrl: config.baseUrl,
    clasificar: clasificarRespuestaDux,
    esperasMs,
    ...dependencias,
  };
  const v2 = createHttpClient({ ...base, headers: { Authorization: `Bearer ${config.token}` }, limite: limites.v2 });
  const v1 = createHttpClient({ ...base, headers: { Authorization: config.token }, limite: limites.v1 });

  const listarItems = async (offset: number, limit = POR_PAGINA) => {
    const ruta = `/v2/items?offset=${offset}&limit=${limit}`;
    return validar(duxPaginaItemsSchema, (await v2.get(ruta)).cuerpo, ruta);
  };

  const listarFacturas = async ({ sucursal, desde, hasta, offset }: PedidoDeComprobantes) => {
    const parametros = new URLSearchParams({
      idEmpresa: String(config.idEmpresa),
      idSucursal: String(sucursal),
      fechaDesde: desde,
      fechaHasta: hasta,
      offset: String(offset),
      limit: String(POR_PAGINA),
    });
    const ruta = `/facturas?${parametros}`;
    return validar(duxPaginaFacturasSchema, (await v1.get(ruta)).cuerpo, ruta);
  };

  const listarClientes = async (offset: number) => {
    const ruta = `/v2/clientes?offset=${offset}&limit=${POR_PAGINA}`;
    return validar(duxPaginaClientesSchema, (await v2.get(ruta)).cuerpo, ruta);
  };

  return {
    listarItems,
    listarFacturas,
    listarClientes,

    /**
     * Prueba las dos versiones, porque fallan por motivos distintos: la v1 es la única
     * que usa el ID de empresa. Son dos requests.
     */
    async probarConexion() {
      const { paginacion } = await listarItems(0, 1);
      const hoy = businessTime.today();
      const parametros = new URLSearchParams({
        idEmpresa: String(config.idEmpresa),
        idSucursal: String(config.idSucursal),
        fechaDesde: hoy,
        fechaHasta: hoy,
        offset: "0",
        limit: "1",
      });
      const ruta = `/facturas?${parametros}`;
      validar(duxPaginaFacturasSchema, (await v1.get(ruta)).cuerpo, ruta);
      return { items: paginacion.total };
    },
  };
}

export type DuxClient = ReturnType<typeof createDuxClient>;
