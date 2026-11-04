import { z } from "zod";

/**
 * Forma de las respuestas de DUX. Lo que no se pide acá no entra a la app: de cada
 * proveedor quedan el ID y el nombre, sin su teléfono ni su mail.
 */

const nombrado = z.object({ id: z.number(), nombre: z.string() });

export const duxItemSchema = z.object({
  cod_item: z.string(),
  item: z.string(),
  rubro: nombrado.nullable(),
  sub_rubro: nombrado.nullable(),
  marca: z.object({ codigo_marca: z.string(), marca: z.string() }).nullable(),
  proveedor: z.object({ id_proveedor: z.number(), proveedor: z.string() }).nullable(),
  costo: z.number(),
  porc_iva: z.number(),
  precios: z.array(z.object({ id: z.number(), nombre: z.string(), precio: z.number() })),
  stock: z.array(
    z.object({
      id: z.number(),
      nombre: z.string(),
      stock_real: z.number(),
      stock_reservado: z.number(),
      stock_disponible: z.number(),
      talle: z.string().nullable(),
      color: z.string().nullable(),
    }),
  ),
  habilitado: z.boolean(),
  codigo_externo: z.string().nullable(),
  fecha_creacion: z.string(),
  imagen_url: z.string().nullable(),
  ctd_unidades_por_bulto: z.number(),
});

export type DuxItem = z.output<typeof duxItemSchema>;

export const duxPaginaItemsSchema = z.object({
  datos: z.array(duxItemSchema),
  paginacion: z.object({ total: z.number(), hay_mas: z.boolean() }),
});

/** La v1 de /facturas. El detalle de cada comprobante se valida con la lectura de ventas. */
export const duxPaginaFacturasSchema = z.object({
  results: z.array(z.unknown()),
  paging: z.object({ total: z.number() }).nullish(),
});
