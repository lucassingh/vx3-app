import type { CatalogoAltaInput } from "@/lib/api/contracts/catalogo";
import type { CeldaXls } from "@/lib/xls";
import { normalizeText } from "@/lib/utils";
import { presentacionesDelAlta, type PresentacionDelAlta } from "./alta";

/**
 * Lo que se le manda a DUX por un producto nuevo, por la API o en los tres `.xls`. Sin base ni red:
 * los precios salen siempre del costo, nunca de lo que mande el navegador (RN-11, RN-126).
 */

/** Sale del Hub: el IVA va en 0 y la moneda es pesos (`alta_dux.py`). */
const IVA = 0;
export const ID_DE_PESOS = 1;

const LISTA_MAYORISTA = "MAYORISTA EF/TR";
const LISTA_LOCAL = "LOCAL EF/TR";

const dosDecimales = (valor: number) => Math.round(valor * 100) / 100;

export const presentacionesDe = (input: CatalogoAltaInput): PresentacionDelAlta[] =>
  presentacionesDelAlta({
    sku: input.sku,
    rubro: input.rubro,
    nombre: input.nombre,
    costoDocena: input.costoDocena,
    opcionales: input.opcionales,
  });

/** DUX puede guardar un nombre con otros espacios o mayúsculas: eso no lo hace otro producto. */
export const mismoNombre = (a: string, b: string) => {
  const limpiar = (texto: string) => normalizeText(texto).replace(/\s+/g, " ").trim();
  return limpiar(a) === limpiar(b);
};

/* ---- La API ---------------------------------------------------------------- */

/** Lo que DUX pide por ID. Sale de sus listas, no del formulario. */
export type IdsDeDux = {
  rubro: number;
  subrubro: number;
  proveedor: number;
  /** El código de la marca, que en muchas no es su nombre. Sin marca, no va. */
  marca: string | null;
  listas: Record<string, number>;
  personal: number;
  unidadDeMedida: number;
  sucursales: readonly number[];
};

/**
 * Un pedido por presentación, con la prenda primero: los packs la nombran como su componente.
 * La foto va en la prenda y en todos sus packs (RN-123). El costo de un pack lo recalcula DUX
 * sumando sus componentes, pero la API lo pide.
 */
export function pedidosDeDux(input: CatalogoAltaInput, ids: IdsDeDux, imagenUrl: string | null) {
  return presentacionesDe(input).map((presentacion) => {
    const esPack = presentacion.tipo === "COMPUESTO";
    return {
      cod_item: presentacion.codigo,
      item: presentacion.nombre,
      tipo_producto: presentacion.tipo,
      id_personal: ids.personal,
      id_moneda: ID_DE_PESOS,
      id_unidad_medida: ids.unidadDeMedida,
      porc_iva: IVA,
      costo_compra: dosDecimales(presentacion.costo),
      sucursales_habilitadas: ids.sucursales.map((id_sucursal) => ({ id_sucursal })),
      id_rubro: ids.rubro,
      id_sub_rubro: ids.subrubro,
      id_proveedor: ids.proveedor,
      acepta_stock_negativo: false,
      ...(ids.marca ? { cod_marca: ids.marca } : {}),
      ...(imagenUrl ? { imagen_url: imagenUrl } : {}),
      // Una lista que no está en `precios` es lo que deja a la prenda fuera del mayorista (RN-95).
      precios: presentacion.listas.map((lista) => {
        const id_lista_precio = ids.listas[lista];
        if (id_lista_precio === undefined) throw new Error(`Falta el ID de la lista ${lista}.`);
        return { id_lista_precio, id_moneda: ID_DE_PESOS, valor: presentacion.precio };
      }),
      ...(esPack ? { kit_item: [{ cod_kit: input.sku, ctd: presentacion.prendas }] } : {}),
    };
  });
}

/* ---- Los tres .xls --------------------------------------------------------- */

/** Los títulos exactos de los modelos que baja DUX: el Hub los validó en una importación real. */
const COLUMNAS_DE_PRODUCTOS = [
  "CODIGO",
  "COD BARRA",
  "PRODUCTO",
  "PORCENTAJE IVA",
  "STOCK MINIMO",
  "STOCK IDEAL",
  "CANTIDAD DISPONIBLE",
  "RUBRO",
  "SUB RUBRO",
  "PROVEEDOR",
  "UNIDAD MEDIDA",
  "ACEPTA STOCK NEGATIVO",
  "STOCKEABLE",
  "COSTO",
  "IMPUESTO INTERNO",
  "MARCA",
  "MONEDA",
  "UTILIZA VARIANTES",
  "TIPO DE PRODUCTO",
  "DESCRIPCION",
  "FECHA VENCIMIENTO",
  "CODIGO EXTERNO",
  "TRAZABLE",
  "NUMERO TRAZABLE",
  "DISPONIBLE PARA",
  "HABILITADO",
  "INDICA CTD BULTOS",
  "UNIDADES POR BULTO",
];

const COLUMNAS_DE_COMPUESTOS = ["CODIGO COMPUESTO", "CODIGO COMPONENTE", "CANTIDAD"];

export type HojaDeImportacion = { columnas: string[]; filas: CeldaXls[][] };

/** Lo que el `.xls` necesita con nombre, no con ID. */
export type NombresDeDux = { proveedor: string; listas: Record<string, number> };

export const ARCHIVOS_DE_IMPORTACION = ["1_productos", "2_compuestos", "3_precios"] as const;
export type ArchivoDeImportacion = (typeof ARCHIVOS_DE_IMPORTACION)[number];

/** Se importan en este orden: la opción de DUX que va con cada uno se muestra en la pantalla. */
export function hojasDeImportacion(
  input: CatalogoAltaInput,
  { proveedor, listas }: NombresDeDux,
): Record<ArchivoDeImportacion, HojaDeImportacion> {
  const presentaciones = presentacionesDe(input);

  const productos = presentaciones.map(({ codigo, nombre, tipo, costo }) => {
    const esPrenda = tipo === "SIMPLE";
    const fila: Record<string, CeldaXls> = {
      CODIGO: codigo,
      PRODUCTO: nombre,
      "PORCENTAJE IVA": IVA,
      RUBRO: input.rubro,
      "SUB RUBRO": input.subrubro,
      // El costo y el proveedor van solo en la prenda: el costo de un combo lo calcula DUX.
      PROVEEDOR: esPrenda ? proveedor : "",
      "UNIDAD MEDIDA": "UNIDAD",
      "ACEPTA STOCK NEGATIVO": "N",
      STOCKEABLE: "S",
      COSTO: esPrenda ? dosDecimales(costo) : "",
      "IMPUESTO INTERNO": 0,
      MARCA: input.marca,
      MONEDA: "PESOS",
      "UTILIZA VARIANTES": "N",
      "TIPO DE PRODUCTO": esPrenda ? "SIMPLE" : "COMBO",
      TRAZABLE: "N",
      "DISPONIBLE PARA": "TODOS",
      HABILITADO: "S",
      "INDICA CTD BULTOS": "N",
    };
    return COLUMNAS_DE_PRODUCTOS.map((columna) => fila[columna] ?? "");
  });

  const columnaDe = (lista: string) => {
    const id = listas[lista];
    if (id === undefined) throw new Error(`Falta el ID de la lista ${lista}.`);
    return `${lista} (ID. ${id})`;
  };

  return {
    "1_productos": { columnas: COLUMNAS_DE_PRODUCTOS, filas: productos },
    "2_compuestos": {
      columnas: COLUMNAS_DE_COMPUESTOS,
      filas: presentaciones
        .filter(({ tipo }) => tipo === "COMPUESTO")
        .map(({ codigo, prendas }) => [codigo, input.sku, prendas]),
    },
    "3_precios": {
      columnas: ["CODIGO", columnaDe(LISTA_LOCAL), columnaDe(LISTA_MAYORISTA)],
      filas: presentaciones
        // La prenda de medias no se vende suelta: no va a ninguna lista.
        .filter(({ listas: delProducto }) => delProducto.length > 0)
        .map(({ codigo, precio, listas: delProducto }) => [
          codigo,
          delProducto.includes(LISTA_LOCAL) ? precio : "",
          delProducto.includes(LISTA_MAYORISTA) ? precio : "",
        ]),
    },
  };
}
