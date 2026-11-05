import type { Segmento } from "@/lib/api/types";
import { normalizarCodigo, type TipoDeCodigo } from "@/modules/catalog/codigos";
import { subtotalCentavos } from "@/modules/inventory/ventas";

/**
 * Qué compró cada clienta y en qué segmento cae (RF-M12-03). Sin base ni red.
 * Una clienta sin compras no tiene métricas ni segmento: no se sabe si dejó de comprar.
 */

/** Se cambian acá hasta que llegue el editor de reglas (1.10). Aprobados por Elías el 04/11. */
export const VALORES_DE_SEGMENTOS = {
  dormidaDias: 120,
  enRiesgoDias: 60,
  enRiesgoCiclos: 1.5,
  enRiesgoMinimoDias: 30,
  nuevaDias: 45,
  topPorcentaje: 10,
};

const MARGEN_CF = 0.5475;
const DIAS_12_MESES = 365;
const DIA_MS = 86_400_000;

export type LineaDeCompra = {
  tipo: TipoDeCodigo;
  codigo: string;
  cantidad: number;
  precioCentavos: number;
  descuentoPct: number;
  costoCentavos: number;
};

export type ComprobanteDeClienta = {
  /** "2026-11-03" */
  fecha: string;
  totalCentavos: number;
  lineas: LineaDeCompra[];
};

export type MetricasDeClienta = {
  compras: number;
  totalCentavos: number;
  margenCentavos: number;
  margen12mCentavos: number;
  primeraCompra: string;
  ultimaCompra: string;
  /** Mediana de los días entre compras: una compra rara no la mueve. Null con menos de dos. */
  cicloDias: number | null;
};

const diasEntre = (desde: string, hasta: string) => (Date.parse(hasta) - Date.parse(desde)) / DIA_MS;

/**
 * Línea por línea, con el costo que DUX congeló en la venta (RN-92). Vale para los dos
 * lados del corte del 10/10: precio y costo son los de lo vendido, prenda o bulto.
 *
 * CF tiene un costo ficticio y va con su margen fijo; envío, embalaje y flete dejan 0 a
 * propósito (RN-104). Una línea sin costo no suma, y tampoco una con un costo que llega
 * al precio: es un costo mal cargado, no una pérdida. CAN12 figuró con 17.600 hasta
 * julio de 2026 y después con 8.800, siempre al mismo precio de 13.500.
 */
export function margenDeLinea(linea: LineaDeCompra): number {
  const venta = subtotalCentavos(linea);
  if (linea.tipo === "no_producto") {
    return normalizarCodigo(linea.codigo) === "CF" ? Math.round(venta * MARGEN_CF) : 0;
  }
  if (linea.costoCentavos <= 0 || linea.costoCentavos >= linea.precioCentavos) return 0;
  return venta - Math.round(linea.cantidad * linea.costoCentavos);
}

function mediana(valores: number[]): number {
  const orden = valores.toSorted((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2;
}

/** Recibe solo ventas válidas. Los comprobantes del mismo día son una compra. */
export function calcularMetricas(comprobantes: ComprobanteDeClienta[], hoy: string): MetricasDeClienta | null {
  const dias = [...new Set(comprobantes.map(({ fecha }) => fecha))].toSorted();
  const primeraCompra = dias[0];
  const ultimaCompra = dias.at(-1);
  if (primeraCompra === undefined || ultimaCompra === undefined) return null;

  const margenDe = ({ lineas }: ComprobanteDeClienta) => lineas.reduce((suma, l) => suma + margenDeLinea(l), 0);
  const sumar = (lista: ComprobanteDeClienta[]) => lista.reduce((suma, c) => suma + margenDe(c), 0);
  const entreCompras = dias.slice(1).map((dia, indice) => diasEntre(dias[indice]!, dia));

  return {
    compras: dias.length,
    totalCentavos: comprobantes.reduce((suma, { totalCentavos }) => suma + totalCentavos, 0),
    margenCentavos: sumar(comprobantes),
    margen12mCentavos: sumar(comprobantes.filter(({ fecha }) => diasEntre(fecha, hoy) <= DIAS_12_MESES)),
    primeraCompra,
    ultimaCompra,
    cicloDias: entreCompras.length > 0 ? mediana(entreCompras) : null,
  };
}

/**
 * El margen desde el que una clienta es Top: el 10 % con más margen entre las que
 * compraron en los últimos 12 meses. Los empates entran todos, y sin margen no hay Top.
 */
export function umbralTop(clientas: MetricasDeClienta[], hoy: string): number {
  const margenes = clientas
    .filter(({ ultimaCompra }) => diasEntre(ultimaCompra, hoy) <= DIAS_12_MESES)
    .map(({ margen12mCentavos }) => margen12mCentavos)
    .toSorted((a, b) => b - a);
  const puesto = Math.ceil((margenes.length * VALORES_DE_SEGMENTOS.topPorcentaje) / 100);
  return Math.max(margenes[puesto - 1] ?? Number.POSITIVE_INFINITY, 1);
}

/** Se evalúan en este orden, y gana el primero que cumple. Una dormida que dejó mucho margen sigue siendo dormida. */
export function elegirSegmento(metricas: MetricasDeClienta, umbral: number, hoy: string): Segmento {
  const { dormidaDias, enRiesgoDias, enRiesgoCiclos, enRiesgoMinimoDias, nuevaDias } = VALORES_DE_SEGMENTOS;
  const { compras, ultimaCompra, cicloDias, margen12mCentavos } = metricas;
  const sinComprar = diasEntre(ultimaCompra, hoy);

  if (sinComprar > dormidaDias) return "dormida";
  if (sinComprar > enRiesgoDias) return "en_riesgo";
  if (cicloDias !== null && sinComprar > enRiesgoCiclos * cicloDias && sinComprar >= enRiesgoMinimoDias) {
    return "en_riesgo";
  }
  if (compras === 1 && sinComprar <= nuevaDias) return "nueva";
  if (margen12mCentavos >= umbral) return "top";
  return "activa";
}
