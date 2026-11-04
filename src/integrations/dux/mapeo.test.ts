import { describe, expect, it } from "vitest";
import fixtureItems from "./fixtures/items.json";
import { aErpItem } from "./mapeo";
import { duxItemSchema, type DuxItem } from "./schemas";

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
