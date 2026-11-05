import { describe, expect, it } from "vitest";
import {
  calcularMetricas,
  elegirSegmento,
  margenDeLinea,
  umbralTop,
  type LineaDeCompra,
  type MetricasDeClienta,
} from "./metricas";

const HOY = "2026-11-05";

const linea = (cambios: Partial<LineaDeCompra> = {}): LineaDeCompra => ({
  tipo: "prenda",
  codigo: "LN25",
  cantidad: 1,
  precioCentavos: 10_000,
  descuentoPct: 0,
  costoCentavos: 7_500,
  ...cambios,
});

const comprobante = (fecha: string, lineas: LineaDeCompra[] = [linea()], totalCentavos = 10_000) => ({
  fecha,
  totalCentavos,
  lineas,
});

const metricas = (cambios: Partial<MetricasDeClienta> = {}): MetricasDeClienta => ({
  compras: 2,
  totalCentavos: 20_000,
  margenCentavos: 5_000,
  margen12mCentavos: 5_000,
  primeraCompra: "2026-01-01",
  ultimaCompra: "2026-10-30",
  cicloDias: 60,
  ...cambios,
});

/** La última compra, hace tantos días. */
const haceDias = (dias: number) => new Date(Date.parse(HOY) - dias * 86_400_000).toISOString().slice(0, 10);

describe("margenDeLinea", () => {
  it("es la venta menos el costo, por la cantidad", () => {
    expect(margenDeLinea(linea({ cantidad: 2 }))).toBe(5_000);
  });

  it("el descuento baja la venta, no el costo", () => {
    expect(margenDeLinea(linea({ descuentoPct: 10 }))).toBe(1_500);
  });

  it("lo regalado con 100 % de descuento es una pérdida real", () => {
    expect(margenDeLinea(linea({ descuentoPct: 100 }))).toBe(-7_500);
  });

  it("vale igual a los dos lados del corte: un bulto antes y un -6 después dejan lo mismo", () => {
    const bultoSinGuion = linea({ codigo: "LN25", precioCentavos: 60_000, costoCentavos: 45_000 });
    const packConGuion = linea({ tipo: "pack", codigo: "LN25-6", precioCentavos: 60_000, costoCentavos: 45_000 });
    expect(margenDeLinea(bultoSinGuion)).toBe(15_000);
    expect(margenDeLinea(packConGuion)).toBe(15_000);
  });

  it("CF deja 54,75 % de la venta, sin mirar su costo ficticio", () => {
    expect(margenDeLinea(linea({ tipo: "no_producto", codigo: "CF", costoCentavos: 99_999 }))).toBe(5_475);
  });

  it.each(["ENVIO1", "EMBALAJE1", "FLETE"])("%s deja 0 aunque traiga costo", (codigo) => {
    expect(margenDeLinea(linea({ tipo: "no_producto", codigo, costoCentavos: 2_000 }))).toBe(0);
  });

  it("una línea sin costo no suma", () => {
    expect(margenDeLinea(linea({ costoCentavos: 0 }))).toBe(0);
  });

  it("un costo que llega al precio no es una pérdida: no suma", () => {
    expect(margenDeLinea(linea({ costoCentavos: 10_000 }))).toBe(0);
    expect(margenDeLinea(linea({ costoCentavos: 17_600 }))).toBe(0);
  });
});

describe("calcularMetricas", () => {
  it("sin compras no hay métricas", () => {
    expect(calcularMetricas([], HOY)).toBeNull();
  });

  it("los comprobantes del mismo día son una compra, y suman todos", () => {
    const resultado = calcularMetricas([comprobante("2026-10-01"), comprobante("2026-10-01")], HOY);
    expect(resultado).toMatchObject({
      compras: 1,
      totalCentavos: 20_000,
      margenCentavos: 5_000,
      primeraCompra: "2026-10-01",
      ultimaCompra: "2026-10-01",
      cicloDias: null,
    });
  });

  it("el total es el del comprobante, con el envío que pagó", () => {
    const envio = linea({ tipo: "no_producto", codigo: "ENVIO1", precioCentavos: 3_000 });
    const resultado = calcularMetricas([comprobante("2026-10-01", [linea(), envio], 13_000)], HOY);
    expect(resultado).toMatchObject({ totalCentavos: 13_000, margenCentavos: 2_500 });
  });

  it("el ciclo es la mediana: una compra rara no lo mueve", () => {
    const fechas = ["2026-01-01", "2026-01-11", "2026-01-21", "2026-07-20", "2026-07-30"];
    const resultado = calcularMetricas(
      fechas.map((fecha) => comprobante(fecha)),
      HOY,
    );
    expect(resultado?.cicloDias).toBe(10);
  });

  it("con una cantidad par de intervalos, es el promedio de los dos del medio", () => {
    const fechas = ["2026-01-01", "2026-01-11", "2026-01-31"];
    const resultado = calcularMetricas(
      fechas.map((fecha) => comprobante(fecha)),
      HOY,
    );
    expect(resultado?.cicloDias).toBe(15);
  });

  it("no importa en qué orden lleguen los comprobantes", () => {
    const resultado = calcularMetricas([comprobante("2026-10-20"), comprobante("2026-10-01")], HOY);
    expect(resultado).toMatchObject({ primeraCompra: "2026-10-01", ultimaCompra: "2026-10-20", cicloDias: 19 });
  });

  it("el margen de 12 meses deja afuera lo anterior; el total, no", () => {
    const resultado = calcularMetricas([comprobante("2025-11-04"), comprobante("2025-11-05")], HOY);
    expect(resultado).toMatchObject({ margenCentavos: 5_000, margen12mCentavos: 2_500 });
  });
});

describe("umbralTop", () => {
  const conMargen = (margenes: number[], ultimaCompra = "2026-10-30") =>
    margenes.map((margen12mCentavos) => metricas({ margen12mCentavos, ultimaCompra }));

  it("es el margen del puesto que cierra el 10 %", () => {
    const margenes = Array.from({ length: 20 }, (_, indice) => (indice + 1) * 100);
    expect(umbralTop(conMargen(margenes), HOY)).toBe(1_900);
  });

  it("redondea para arriba: con pocas clientas hay una Top", () => {
    expect(umbralTop(conMargen([100, 300, 200]), HOY)).toBe(300);
  });

  it("las que no compraron en 12 meses no cuentan para el 10 %", () => {
    const viejas = conMargen(
      Array.from({ length: 30 }, () => 0),
      "2025-01-01",
    );
    expect(umbralTop([...viejas, ...conMargen([100, 300, 200])], HOY)).toBe(300);
  });

  it("sin margen no hay Top", () => {
    expect(umbralTop(conMargen([0, -500]), HOY)).toBe(1);
  });

  it("sin clientas, nadie llega", () => {
    expect(umbralTop([], HOY)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("elegirSegmento", () => {
  const UMBRAL = 100_000;

  it.each<[string, Partial<MetricasDeClienta>, ReturnType<typeof elegirSegmento>]>([
    ["121 días: dormida", { ultimaCompra: haceDias(121) }, "dormida"],
    ["120 días justos: todavía no es dormida", { ultimaCompra: haceDias(120) }, "en_riesgo"],
    ["61 días: en riesgo", { ultimaCompra: haceDias(61), cicloDias: 90 }, "en_riesgo"],
    ["60 días justos, dentro de su ciclo: activa", { ultimaCompra: haceDias(60), cicloDias: 90 }, "activa"],
    ["se pasó 1,5 veces de su ciclo: en riesgo", { ultimaCompra: haceDias(31), cicloDias: 20 }, "en_riesgo"],
    ["1,5 veces justas de su ciclo: activa", { ultimaCompra: haceDias(30), cicloDias: 20 }, "activa"],
    ["se pasó, pero hace menos de 30 días: activa", { ultimaCompra: haceDias(29), cicloDias: 10 }, "activa"],
    ["30 días justos pasado su ciclo: en riesgo", { ultimaCompra: haceDias(30), cicloDias: 10 }, "en_riesgo"],
    ["una compra, hace 45: nueva", { compras: 1, cicloDias: null, ultimaCompra: haceDias(45) }, "nueva"],
    ["una compra, hace 46: activa", { compras: 1, cicloDias: null, ultimaCompra: haceDias(46) }, "activa"],
    ["una compra, hace 61: en riesgo", { compras: 1, cicloDias: null, ultimaCompra: haceDias(61) }, "en_riesgo"],
    ["llega al umbral: top", { ultimaCompra: haceDias(5), margen12mCentavos: UMBRAL }, "top"],
    ["no llega al umbral: activa", { ultimaCompra: haceDias(5), margen12mCentavos: UMBRAL - 1 }, "activa"],
  ])("%s", (_, cambios, esperado) => {
    expect(elegirSegmento(metricas(cambios), UMBRAL, HOY)).toBe(esperado);
  });

  it.each<[string, Partial<MetricasDeClienta>, ReturnType<typeof elegirSegmento>]>([
    ["dormida le gana a top", { ultimaCompra: haceDias(200) }, "dormida"],
    ["en riesgo le gana a top", { ultimaCompra: haceDias(90) }, "en_riesgo"],
    ["nueva le gana a top", { compras: 1, cicloDias: null, ultimaCompra: haceDias(10) }, "nueva"],
  ])("precedencia: %s", (_, cambios, esperado) => {
    expect(elegirSegmento(metricas({ margen12mCentavos: UMBRAL * 5, ...cambios }), UMBRAL, HOY)).toBe(esperado);
  });
});
