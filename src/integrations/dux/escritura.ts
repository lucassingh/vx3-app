import "server-only";
import { ConflictError } from "@/lib/errors";
import { createHttpClient, type HttpClientOptions } from "@/lib/http-client";
import type { LimiteDeTasa } from "@/lib/rate-limit";
import { clasificarRespuestaDux } from "./respuesta";

/**
 * Lo único que escribe en DUX. Vive aparte del cliente de lectura para que el candado no se
 * pueda saltear: sin pasar por acá, la app no tiene cómo tocar la empresa real.
 *
 * DUX no borra ni deshabilita productos por API, y un código no se puede cambiar ni reusar:
 * lo que se crea queda para siempre. Por eso, fuera de producción solo se escribe en el
 * conjunto de datos de prueba, si está configurado.
 */

export type PedidoDePrecio = { id_lista_precio: number; id_moneda: number; tipo_valor?: string; valor: number };

/** El contrato de `POST /v2/items`, con lo que usa VX3. `cod_kit` y `tipo_valor` no están definidos en su documentación. */
export type PedidoDeItem = {
  cod_item: string;
  item: string;
  tipo_producto: "SIMPLE" | "COMPUESTO";
  id_personal: number;
  id_moneda: number;
  id_unidad_medida: number;
  porc_iva: number;
  costo_compra: number;
  sucursales_habilitadas: { id_sucursal: number }[];
  id_rubro?: number;
  id_sub_rubro?: number;
  cod_marca?: string;
  id_proveedor?: number;
  descripcion?: string;
  imagen_url?: string;
  acepta_stock_negativo?: boolean;
  precios?: PedidoDePrecio[];
  kit_item?: { cod_kit: string; ctd: number }[];
};

/** `Nombre: valor`, como lo pide DUX. Sin esto, fuera de producción no se escribe. */
export function cabeceraDePrueba(texto: string | undefined): Record<string, string> | null {
  const separador = texto?.indexOf(":") ?? -1;
  if (!texto || separador <= 0) return null;
  const [nombre, valor] = [texto.slice(0, separador).trim(), texto.slice(separador + 1).trim()];
  return nombre && valor ? { [nombre]: valor } : null;
}

/**
 * El candado. En producción se escribe en la empresa real. Una preview nunca escribe, y QA y local
 * solo con el conjunto de datos de prueba.
 */
export function destinoDeEscritura(
  ambiente: string | undefined,
  prueba: string | undefined,
): { real: true; cabecera: Record<string, string> } | { real: false; cabecera: Record<string, string> } {
  if (ambiente === "production") return { real: true, cabecera: {} };
  const cabecera = ambiente === "preview" ? null : cabeceraDePrueba(prueba);
  if (!cabecera) {
    throw new ConflictError(
      "Fuera de producción no se escribe en DUX: lo que se crea ahí no se puede borrar. Hace falta el conjunto de datos de prueba.",
    );
  }
  return { real: false, cabecera };
}

type Dependencias = { limite: LimiteDeTasa; ambiente: string | undefined; prueba: string | undefined } & Pick<
  HttpClientOptions,
  "fetch" | "esperar" | "log" | "alIntentar" | "esperasMs"
>;

export function createDuxEscritura(
  config: { baseUrl: string; token: string },
  { limite, ambiente, prueba, ...dependencias }: Dependencias,
) {
  const { cabecera } = destinoDeEscritura(ambiente, prueba);
  const v2 = createHttpClient({
    servicio: "DUX",
    baseUrl: config.baseUrl,
    clasificar: clasificarRespuestaDux,
    headers: { Authorization: `Bearer ${config.token}`, ...cabecera },
    limite,
    ...dependencias,
  });

  return {
    /** 201 con `{ datos: { cod_item, item } }`. Un código repetido vuelve como error de DUX, sin duplicar. */
    crearItem: (pedido: PedidoDeItem) => v2.escribir("POST", "/v2/items", pedido),

    /** La documentación no dice si borra lo que no se manda: siempre va el pedido completo (`04` §1.3). */
    actualizarItem: (pedido: PedidoDeItem) =>
      v2.escribir("PUT", `/v2/items/${encodeURIComponent(pedido.cod_item)}`, pedido),
  };
}
