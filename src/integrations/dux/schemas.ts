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
});

export type DuxItem = z.output<typeof duxItemSchema>;

const paginaDe = <T extends z.ZodType>(fila: T) =>
  z.object({
    datos: z.array(fila),
    paginacion: z.object({ total: z.number(), hay_mas: z.boolean() }).optional(),
  });

/** Lo que la escritura necesita por ID. De un proveedor y de una persona no entra nada más que el nombre. */
export const duxRubrosSchema = paginaDe(z.object({ id_rubro: z.number(), rubro: z.string() }));
export const duxSubRubrosSchema = paginaDe(
  z.object({ id_rubro: z.number(), id_sub_rubro: z.number(), sub_rubro: z.string() }),
);
export const duxProveedoresSchema = paginaDe(
  z.object({ id_proveedor: z.number(), proveedor: z.string(), habilitado: z.boolean().optional() }),
);
export const duxListasSchema = paginaDe(
  z.object({ id_lista_precio_venta: z.number(), lista_precio_venta: z.string(), habilitado: z.boolean().optional() }),
);
export const duxMonedasSchema = paginaDe(z.object({ id_moneda: z.number(), moneda: z.string() }));
export const duxPersonalesSchema = paginaDe(
  z.object({ id_personal: z.number(), apellido_razon_social: z.string().nullable(), nombre: z.string().nullable() }),
);
export const duxSucursalesSchema = paginaDe(z.object({ id_sucursal: z.number(), sucursal: z.string() }));
/** `/v2/stock` también trae los inhabilitados: un código usado no se reusa nunca (RN-03). */
export const duxStockSchema = paginaDe(z.object({ cod_item: z.string(), habilitado: z.boolean().optional() }));

export const duxPaginaItemsSchema = z.object({
  datos: z.array(duxItemSchema),
  paginacion: z.object({ total: z.number(), hay_mas: z.boolean() }),
});

/** La v1 manda los números como texto: "168400.0". */
const decimal = z
  .union([z.string(), z.number()])
  .transform(Number)
  .refine((valor) => Number.isFinite(valor), "no es un número");

const duxLineaSchema = z.object({
  cod_item: z.string().nullish(),
  item: z.string().nullish(),
  ctd: decimal,
  precio_uni: decimal,
  porc_desc: decimal,
  porc_iva: decimal,
  costo: decimal,
});

/**
 * Un comprobante de la v1 de /facturas. Trae también el nombre, el CUIT y el documento
 * de la clienta: no se piden acá, así que no entran a la app.
 */
export const duxFacturaSchema = z.object({
  id: z.number(),
  id_cliente: z.number().nullish(),
  nro_pto_vta: z.string(),
  tipo_comp: z.string(),
  letra_comp: z.string(),
  nro_comp: z.number().nullish(),
  fecha_comp: z.string().regex(/^[A-Z][a-z]{2} \d{1,2}, \d{4}/, "no es una fecha de DUX"),
  nro_pedido: z.string().nullish(),
  total: decimal,
  anulada: z.string().nullish(),
  detalles: z.array(duxLineaSchema).nullish(),
});

export type DuxFactura = z.output<typeof duxFacturaSchema>;

export const duxPaginaFacturasSchema = z.object({
  results: z.array(duxFacturaSchema),
  paging: z.object({ total: z.number() }).nullish(),
});

/**
 * Una clienta de la v2 de /clientes. Trae también el documento y los domicilios: no se
 * piden acá, así que no entran a la app. La `paginacion` tampoco, porque en esta ruta
 * miente: dice 50 y que no hay más en todas las páginas.
 */
export const duxClienteSchema = z.object({
  id_cliente: z.number(),
  full_name: z.string(),
  nombre: z.string().nullish(),
  email: z.string().nullish(),
  provincia: z.string().nullish(),
  localidad: z.string().nullish(),
  telefono: z.string().nullish(),
  cel: z.string().nullish(),
  fecha_creacion: z.string().nullish(),
  habilitado: z.boolean(),
});

export type DuxCliente = z.output<typeof duxClienteSchema>;

export const duxPaginaClientesSchema = z.object({ datos: z.array(duxClienteSchema) });
