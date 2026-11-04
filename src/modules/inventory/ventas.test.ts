import { describe, expect, it } from "vitest";
import { esVentaValida, mesesCompletos, subtotalCentavos } from "./ventas";

describe("esVentaValida", () => {
  it("cuenta una venta común", () => {
    expect(esVentaValida({ tipo: "COMPROBANTE_VENTA", anulado: false })).toBe(true);
    expect(esVentaValida({ tipo: "FACTURA", anulado: false })).toBe(true);
  });

  it("no cuenta las anuladas", () => {
    expect(esVentaValida({ tipo: "COMPROBANTE_VENTA", anulado: true })).toBe(false);
  });

  it("no cuenta las notas de crédito, que vienen con total positivo", () => {
    expect(esVentaValida({ tipo: "NOTA_CREDITO", anulado: false })).toBe(false);
    expect(esVentaValida({ tipo: "NOTA_CREDITO_A", anulado: false })).toBe(false);
  });
});

describe("subtotalCentavos", () => {
  it("multiplica cantidad por precio", () => {
    expect(subtotalCentavos({ cantidad: 2, precioCentavos: 2_150_000, descuentoPct: 0 })).toBe(4_300_000);
  });

  it("aplica el descuento", () => {
    expect(subtotalCentavos({ cantidad: 2, precioCentavos: 2_150_000, descuentoPct: 10 })).toBe(3_870_000);
  });

  it("redondea al centavo", () => {
    expect(subtotalCentavos({ cantidad: 3, precioCentavos: 333, descuentoPct: 12.5 })).toBe(874);
  });
});

describe("mesesCompletos", () => {
  it("devuelve los últimos meses completos, sin el mes en curso", () => {
    const meses = mesesCompletos("2026-11-04", 12);

    expect(meses).toHaveLength(12);
    expect(meses[0]).toEqual({ mes: "2025-11", desde: "2025-11-01", hasta: "2025-11-30" });
    expect(meses.at(-1)).toEqual({ mes: "2026-10", desde: "2026-10-01", hasta: "2026-10-31" });
  });

  it("respeta el fin de cada mes, también en año bisiesto, y cruza el año", () => {
    expect(mesesCompletos("2028-03-15", 1)[0]).toEqual({ mes: "2028-02", desde: "2028-02-01", hasta: "2028-02-29" });
    expect(mesesCompletos("2027-01-02", 1)[0]).toEqual({ mes: "2026-12", desde: "2026-12-01", hasta: "2026-12-31" });
  });
});
