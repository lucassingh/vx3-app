import { describe, expect, it } from "vitest";
import fixtureFacturas from "./fixtures/facturas.json";
import fixtureItems from "./fixtures/items.json";
import { aErpComprobante, aErpItem, fechaDeDux } from "./mapeo";
import { duxItemSchema, duxPaginaFacturasSchema, type DuxItem } from "./schemas";

const delFixture = (codigo: string): DuxItem =>
  duxItemSchema.parse(fixtureItems.datos.find((item) => item.cod_item === codigo));

describe("aErpItem", () => {
  it("traduce un item con todos sus datos", () => {
    expect(aErpItem(delFixture("HB2"))).toMatchObject({
      codigo: "HB2",
      rubro: "HOMBRE",
      marca: expect.any(String),
      proveedorId: expect.any(Number),
      proveedor: "PROVEEDOR DE PRUEBA",
      costoCentavos: 100_000,
      creadoEl: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("los montos quedan en centavos, en las 5 listas", () => {
    const { precios } = aErpItem(delFixture("HB2"));

    expect(precios).toHaveLength(5);
    expect(precios[0]).toEqual({ listaId: expect.any(Number), lista: expect.any(String), centavos: 200_000 });
  });

  it("un costo con centavos no pierde precisión", () => {
    const item: DuxItem = { ...delFixture("HB2"), costo: 1083.33 };
    expect(aErpItem(item).costoCentavos).toBe(108_333);
  });

  it("acepta lo que puede venir vacío", () => {
    const combo = aErpItem(delFixture("COMBO32"));

    expect(combo.rubro).toBeNull();
    expect(combo.proveedor).toBeNull();
    expect(combo.proveedorId).toBeNull();
  });

  it("suma el stock de las variantes", () => {
    const base = delFixture("HB2").stock[0]!;
    const item: DuxItem = {
      ...delFixture("MTNU3"),
      stock: [
        { ...base, stock_real: 3, stock_reservado: 1, stock_disponible: 2 },
        { ...base, stock_real: 4, stock_reservado: 0, stock_disponible: 4 },
      ],
    };

    expect(aErpItem(item)).toMatchObject({ stockReal: 7, stockReservado: 1, stockDisponible: 6 });
  });

  it("conserva los decimales del stock de un pack, sin ruido de coma flotante", () => {
    const base = delFixture("HB2").stock[0]!;
    const conDecimales: DuxItem = {
      ...delFixture("HB2-6"),
      stock: [{ ...base, stock_real: 46.58333333, stock_reservado: 0, stock_disponible: 46.58333333 }],
    };
    const conRuido: DuxItem = {
      ...delFixture("HB2-6"),
      stock: [
        { ...base, stock_real: 0.1, stock_reservado: 0, stock_disponible: 0 },
        { ...base, stock_real: 0.2, stock_reservado: 0, stock_disponible: 0 },
      ],
    };

    expect(aErpItem(conDecimales).stockReal).toBe(46.58333333);
    expect(aErpItem(conRuido).stockReal).toBe(0.3);
  });
});

describe("fechaDeDux", () => {
  it.each([
    ["Nov 3, 2026 3:00:00 AM", "2026-11-03"],
    ["Jan 31, 2026 3:00:00 AM", "2026-01-31"],
    ["Dec 1, 2025 11:59:59 PM", "2025-12-01"],
  ])("%s es %s", (texto, fecha) => {
    expect(fechaDeDux(texto)).toBe(fecha);
  });

  it("si no la entiende, lo dice en vez de inventar una", () => {
    expect(() => fechaDeDux("Foo 3, 2026")).toThrow(/fecha que no esperábamos/);
  });
});

describe("aErpComprobante", () => {
  const { results } = duxPaginaFacturasSchema.parse(fixtureFacturas);

  it("lee los números que la v1 manda como texto, en centavos", () => {
    const comprobante = aErpComprobante(results[0]!, 1);

    expect(comprobante).toMatchObject({
      id: 1001,
      sucursal: 1,
      tipo: "COMPROBANTE_VENTA",
      fecha: "2026-11-03",
      clienteId: 501,
      pedido: "1500",
      totalCentavos: 16_840_000,
      anulado: false,
    });
    expect(comprobante.lineas[0]).toEqual({
      codigo: "CJTSN20-6",
      nombre: "CONJUNTO DE PRUEBA - MEDIA DOCENA",
      cantidad: 2,
      precioCentavos: 2_150_000,
      descuentoPct: 10,
      ivaPct: 0,
      costoCentavos: 1_650_000,
    });
    expect(comprobante.lineas[1]?.precioCentavos).toBe(430_050);
  });

  it("no deja entrar el nombre, el CUIT ni el documento de la clienta", () => {
    const texto = JSON.stringify(aErpComprobante(results[0]!, 1));

    expect(texto).not.toContain("PRIVADO");
    expect(texto).not.toContain("27301112229");
    expect(texto).not.toContain("30111222");
    expect(texto).not.toContain("privada");
  });

  it("deja afuera una línea sin código y lee como no anulada la que no lo dice", () => {
    const [base] = results;
    const linea = { ...base!.detalles![0]!, cod_item: null };

    const comprobante = aErpComprobante({ ...base!, anulada: null, detalles: [linea] }, 1);

    expect(comprobante.lineas).toEqual([]);
    expect(comprobante.anulado).toBe(false);
  });

  it("una nota de crédito sin detalle y una anulada", () => {
    expect(aErpComprobante(results[1]!, 1)).toMatchObject({ tipo: "NOTA_CREDITO", lineas: [], pedido: null });
    expect(aErpComprobante(results[2]!, 1)).toMatchObject({ anulado: true });
  });
});
