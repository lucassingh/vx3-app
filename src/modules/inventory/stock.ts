import type { Kpi, StockEstado, StockFila } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { esMedias } from "@/modules/catalog/codigos";

/**
 * Cómo se lee el stock de un producto (RF-M2-01). Sin base ni red.
 *
 * Todo se calcula desde la prenda: el stock de un pack en DUX es un derivado que ya
 * descuenta lo reservado de la prenda (`HB2` 94/13/81, `HB2-6` 13,5 = 81 ÷ 6).
 */

type Bulto = { label: string; singular: string; plural: string; prendas: number };

const PRENDA: Bulto = { label: "Prenda", singular: "prenda", plural: "prendas", prendas: 1 };
const COMBO: Bulto = { label: "Combo", singular: "combo", plural: "combos", prendas: 1 };

/** El bulto mayorista: el -6 en lencería y el -12 en medias, donde el -6 es minorista (RN-115). */
export function bultoDe(rubro: string, packs: number[]): Bulto {
  const medias = esMedias(rubro);
  const mayorista = medias ? 12 : 6;
  const prendas = packs.includes(mayorista) ? mayorista : Math.min(...packs);
  if (!Number.isFinite(prendas)) return PRENDA;
  if (prendas === 12) return { label: "Docena", singular: "docena", plural: "docenas", prendas };
  if (prendas === 6 && !medias)
    return { label: "Media docena", singular: "media docena", plural: "medias docenas", prendas };
  return { label: `Pack de ${prendas}`, singular: `pack de ${prendas}`, plural: `packs de ${prendas}`, prendas };
}

function equivalencia(disponible: number, bultos: number, bulto: Bulto): string {
  const unidad = (cantidad: number, { singular, plural }: Bulto) =>
    `${formatNumber(cantidad)} ${cantidad === 1 ? singular : plural}`;
  if (bulto.prendas === 1) return unidad(disponible, bulto);
  const sueltas = disponible - bultos * bulto.prendas;
  const resto = sueltas > 0 ? ` y ${formatNumber(sueltas)} ${sueltas === 1 ? "suelta" : "sueltas"}` : "";
  return `${unidad(disponible, PRENDA)} = ${unidad(bultos, bulto)}${resto}`;
}

const DIAS_CRITICO = 7;
const DIAS_SOBRESTOCK = 60;

export type ProductoDeStock = {
  sku: string;
  nombre: string;
  rubro: string;
  esCombo: boolean;
  /** Unidades de cada pack que tiene en el ERP. */
  packs: number[];
  real: number;
  reservado: number;
  disponible: number;
  /** Prendas vendidas en 30 días, sumando todas sus presentaciones y los códigos de antes del 10/10. */
  ventasPrendas: number;
};

export function filaDeProducto(producto: ProductoDeStock): StockFila {
  const bulto = producto.esCombo ? COMBO : bultoDe(producto.rubro, producto.packs);
  const disponiblePrendas = Math.max(0, producto.disponible);
  const disponibleBultos = Math.floor(disponiblePrendas / bulto.prendas);
  const diasStock = producto.ventasPrendas > 0 ? Math.round(disponiblePrendas / (producto.ventasPrendas / 30)) : null;

  const estado: StockEstado =
    disponibleBultos === 0
      ? "agotado"
      : diasStock === null
        ? "sin_rotacion"
        : diasStock < DIAS_CRITICO
          ? "critico"
          : diasStock > DIAS_SOBRESTOCK
            ? "sobrestock"
            : "ok";

  return {
    sku: producto.sku,
    nombre: producto.nombre,
    rubro: producto.rubro,
    // Los colores llegan con el catálogo maestro (1.8): DUX no los tiene.
    colores: [],
    bultoLabel: bulto.label,
    prendasPorBulto: bulto.prendas,
    stockPrendas: producto.real,
    reservadoPrendas: producto.reservado,
    disponiblePrendas,
    disponibleBultos,
    equivalencia: equivalencia(disponiblePrendas, disponibleBultos, bulto),
    ventas30dBultos: Math.round(producto.ventasPrendas / bulto.prendas),
    diasStock,
    estado,
  };
}

/**
 * Primero lo que necesita atención. Un agotado que se vende es lo más urgente; uno que
 * nadie compra, lo último: son unos 800 de 1.100, y arriba taparían todo lo demás.
 */
function prioridad({ estado, ventas30dBultos }: StockFila): number {
  if (estado === "agotado") return ventas30dBultos > 0 ? 0 : 5;
  return { critico: 1, sobrestock: 2, ok: 3, sin_rotacion: 4 }[estado];
}

export function ordenarPorAtencion(filas: StockFila[]): StockFila[] {
  return filas.toSorted(
    (a, b) =>
      prioridad(a) - prioridad(b) || b.ventas30dBultos - a.ventas30dBultos || a.nombre.localeCompare(b.nombre, "es"),
  );
}

export function kpisDeStock(filas: StockFila[], codigos: number): Kpi[] {
  const sumar = (valor: (fila: StockFila) => number) => filas.reduce((suma, fila) => suma + valor(fila), 0);
  return [
    {
      id: "skus",
      label: "Productos leídos de DUX",
      value: filas.length,
      format: "number",
      hint: `${formatNumber(codigos)} códigos con sus packs`,
    },
    {
      id: "bultos",
      label: "Bultos disponibles",
      value: sumar((fila) => fila.disponibleBultos),
      format: "number",
      hint: "Real menos reservado, en bultos mayoristas",
    },
    {
      id: "reservado",
      label: "Reservado",
      value: sumar((fila) => fila.reservadoPrendas),
      format: "number",
      hint: "Prendas reservadas en DUX",
    },
    {
      id: "critico",
      label: "Stock crítico o sin bulto",
      value: filas.filter(
        ({ estado, ventas30dBultos }) => estado === "critico" || (estado === "agotado" && ventas30dBultos > 0),
      ).length,
      format: "number",
      hint: "Lo que se está vendiendo y no alcanza",
    },
  ];
}
