import "server-only";
import { z } from "zod";
import { ConflictError, ExternalServiceError } from "@/lib/errors";
import { createHttpClient, type HttpClientOptions, type RespuestaHttp, type Veredicto } from "@/lib/http-client";
import type { LimiteDeTasa } from "@/lib/rate-limit";

/**
 * Tienda Nube (`VX3_Hub_subida_TiendaNube_para_Lucas_2026-11-05.md`). Leer es libre; escribir, solo
 * en producción: hay una sola tienda, sin ambiente de prueba (decisión 1 de la 1.9).
 */

export const URL_DE_TIENDA_NUBE = "https://api.tiendanube.com/v1";

/** El más lento de los dos ritmos que usa el Hub: 300 ms entre productos y 360 entre fotos. */
export const LIMITE_DE_TIENDA_NUBE = { clave: "tiendanube", intervaloMs: 360 };

/** Tienda Nube pide un contacto en el User-Agent: alcanza con la dirección de la tienda. */
const USER_AGENT = "VX3 App (https://www.ventasportres.com.ar)";

const POR_PAGINA = 200;

const nombreSchema = z.record(z.string(), z.string().nullable());

const categoriaSchema = z.object({
  id: z.number(),
  parent: z.number().nullable(),
  name: nombreSchema,
  /** Las 27 raíces ocultas son sobras de los incidentes de septiembre: algunas se llaman igual que una visible. */
  visibility: z.string().nullish(),
});

const productoSchema = z.object({
  id: z.number(),
  name: nombreSchema.optional(),
  published: z.boolean(),
  categories: z.array(z.object({ id: z.number() })).default([]),
  images: z.array(z.object({ id: z.number() })).default([]),
  variants: z
    .array(z.object({ id: z.number().optional(), sku: z.string().nullable(), price: z.string().nullable() }))
    .default([]),
});

export type CategoriaDeLaTienda = z.output<typeof categoriaSchema>;
export type ProductoDeLaTienda = z.output<typeof productoSchema>;

export type PedidoDeProducto = {
  name: { es: string };
  description: { es: string };
  published: boolean;
  categories: number[];
  variants: { sku: string; price: string; weight?: number; width?: number; height?: number; depth?: number }[];
};

/** El mensaje que da Tienda Nube, si lo da: el 422 de una foto no explica mucho. */
function motivoDe(cuerpo: unknown): string {
  if (cuerpo && typeof cuerpo === "object") {
    const { description, message } = cuerpo as { description?: unknown; message?: unknown };
    if (typeof description === "string") return description;
    if (typeof message === "string") return message;
    const campos = Object.entries(cuerpo).filter(([campo]) => campo !== "code");
    if (campos.length > 0) return campos.map(([campo, valor]) => `${campo}: ${JSON.stringify(valor)}`).join(", ");
  }
  return "sin más detalle";
}

/** Un 404 no es un error acá: es la respuesta de un SKU que no está, o de una página que no existe. */
export function clasificarRespuestaDeTienda({ status, cuerpo }: RespuestaHttp): Veredicto {
  if ((status >= 200 && status < 300) || status === 404) return { tipo: "ok" };
  if (status === 401 || status === 403) return { tipo: "error", mensaje: "Tienda Nube rechazó el token." };
  if (status === 429 || status >= 500) return { tipo: "reintentar", motivo: `HTTP ${status}` };
  return { tipo: "error", mensaje: `Tienda Nube rechazó el pedido: ${motivoDe(cuerpo)}.` };
}

type Dependencias = { limite: LimiteDeTasa } & Pick<
  HttpClientOptions,
  "fetch" | "esperar" | "log" | "alIntentar" | "esperasMs" | "timeoutMs"
>;

function http(config: { storeId: number; token: string }, { limite, ...dependencias }: Dependencias) {
  return createHttpClient({
    servicio: "Tienda Nube",
    baseUrl: `${URL_DE_TIENDA_NUBE}/${config.storeId}`,
    clasificar: clasificarRespuestaDeTienda,
    headers: { Authentication: `bearer ${config.token}`, "User-Agent": USER_AGENT },
    limite,
    ...dependencias,
  });
}

function validar<T extends z.ZodType>(esquema: T, cuerpo: unknown, ruta: string): z.output<T> {
  const resultado = esquema.safeParse(cuerpo);
  if (!resultado.success) {
    throw new ExternalServiceError("Tienda Nube", `Tienda Nube respondió algo inesperado en ${ruta.split("?")[0]}.`);
  }
  return resultado.data;
}

export function createTiendaNubeClient(config: { storeId: number; token: string }, dependencias: Dependencias) {
  const cliente = http(config, dependencias);

  /** Sin `per_page`, las categorías llegan a la mitad: es lo que llenó la tienda de duplicadas en septiembre. */
  const todas = async <T extends z.ZodType>(esquema: T, ruta: string): Promise<z.output<T>[]> => {
    const filas: z.output<T>[] = [];
    for (let pagina = 1; ; pagina++) {
      const completa = `${ruta}${ruta.includes("?") ? "&" : "?"}per_page=${POR_PAGINA}&page=${pagina}`;
      const { status, cuerpo } = await cliente.get(completa);
      // Pasada la última, Tienda Nube responde 404 en vez de una lista vacía.
      if (status === 404) return filas;
      const parte = validar(z.array(esquema), cuerpo, completa);
      filas.push(...parte);
      if (parte.length < POR_PAGINA) return filas;
    }
  };

  return {
    listarCategorias: () => todas(categoriaSchema, "/categories?fields=id,name,parent,visibility"),
    listarProductos: () => todas(productoSchema, "/products?fields=id,name,published,variants,categories,images"),

    /** El cruce es siempre por SKU, nunca por nombre: los nombres cambian. */
    async buscarPorSku(sku: string): Promise<ProductoDeLaTienda | null> {
      const ruta = `/products/sku/${encodeURIComponent(sku)}`;
      const { status, cuerpo } = await cliente.get(ruta);
      return status === 404 ? null : validar(productoSchema, cuerpo, ruta);
    },

    async producto(id: number): Promise<ProductoDeLaTienda> {
      const ruta = `/products/${id}`;
      const { status, cuerpo } = await cliente.get(ruta);
      if (status === 404) throw new ExternalServiceError("Tienda Nube", `El producto ${id} ya no está en la tienda.`);
      return validar(productoSchema, cuerpo, ruta);
    },

    async probarConexion(): Promise<{ nombre: string }> {
      const { cuerpo } = await cliente.get("/store?fields=name");
      const { name } = validar(z.object({ name: nombreSchema }), cuerpo, "/store");
      return { nombre: Object.values(name).find(Boolean) ?? "" };
    },
  };
}

/** En producción se escribe. En cualquier otro lado se arma el pedido y se muestra, sin mandarlo. */
export function destinoDeLaTienda(ambiente: string | undefined): void {
  if (ambiente !== "production") {
    throw new ConflictError(
      "Fuera de producción no se escribe en Tienda Nube: hay una sola tienda, la de verdad. Se puede ver el pedido que se mandaría.",
    );
  }
}

/** Lo único que escribe en la tienda. Sin pasar por acá, la app no tiene cómo tocarla. */
export function createTiendaNubeEscritura(
  config: { storeId: number; token: string },
  { ambiente, ...dependencias }: Dependencias & { ambiente: string | undefined },
) {
  destinoDeLaTienda(ambiente);
  const cliente = http(config, dependencias);

  const exigir = ({ status }: RespuestaHttp, id: number) => {
    if (status === 404) throw new ExternalServiceError("Tienda Nube", `El producto ${id} ya no está en la tienda.`);
  };

  return {
    async crearProducto(pedido: PedidoDeProducto): Promise<ProductoDeLaTienda> {
      const { status, cuerpo } = await cliente.escribir("POST", "/products", pedido);
      if (status === 404) throw new ExternalServiceError("Tienda Nube", "Tienda Nube no encontró esta tienda.");
      return validar(productoSchema, cuerpo, "/products");
    },

    /** Tienda Nube baja la foto de esa dirección: tiene que ser pública. */
    async agregarFoto(id: number, foto: { src: string; position: number }): Promise<void> {
      exigir(await cliente.escribir("POST", `/products/${id}/images`, foto), id);
    },

    async actualizarDescripcion(id: number, descripcion: string): Promise<void> {
      exigir(await cliente.escribir("PUT", `/products/${id}`, { id, description: { es: descripcion } }), id);
    },

    async actualizarVariante(
      id: number,
      variante: number,
      medidas: { weight: number; width: number; height: number; depth: number },
    ): Promise<void> {
      exigir(await cliente.escribir("PUT", `/products/${id}/variants/${variante}`, medidas), id);
    },

    /** Solo cambia lo que se manda. */
    async mostrarProducto(id: number): Promise<void> {
      exigir(await cliente.escribir("PUT", `/products/${id}`, { id, published: true }), id);
    },
  };
}
