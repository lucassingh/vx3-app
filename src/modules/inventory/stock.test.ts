import { describe, expect, it } from "vitest";
import type { StockFila } from "@/lib/api/types";
import { bultoDe, filaDeProducto, kpisDeStock, ordenarPorAtencion, type ProductoDeStock } from "./stock";

const producto = (cambios: Partial<ProductoDeStock> = {}): ProductoDeStock => ({
  sku: "HB2",
  nombre: "BOXER - UNIDAD",
  rubro: "HOMBRE",
  esCombo: false,
  packs: [6, 12],
  real: 94,
  reservado: 13,
  disponible: 81,
  ventasPrendas: 0,
  ...cambios,
});

describe("bultoDe", () => {
  it("en lencería es la media docena, aunque tenga docena", () => {
    expect(bultoDe("HOMBRE", [6, 12])).toMatchObject({ label: "Media docena", prendas: 6 });
  });

  it("en medias es la docena: el -6 es minorista", () => {
    expect(bultoDe("MEDIAS", [3, 6, 12])).toMatchObject({ label: "Docena", prendas: 12 });
    expect(bultoDe("MEDIAS DEPORTIVAS", [3, 6, 12, 24])).toMatchObject({ prendas: 12 });
  });

  it("si no tiene el mayorista, el pack más chico que tenga", () => {
    expect(bultoDe("MEDIAS", [3, 6])).toMatchObject({ label: "Pack de 3", prendas: 3 });
  });

  it("sin packs, se cuenta por prenda", () => {
    expect(bultoDe("LESS", [])).toMatchObject({ label: "Prenda", prendas: 1 });
  });
});

describe("filaDeProducto: equivalencia entre prendas y bultos", () => {
  it("el caso del contrato", () => {
    expect(filaDeProducto(producto({ disponible: 47 })).equivalencia).toBe("47 prendas = 7 medias docenas y 5 sueltas");
  });

  it("HB2 como lo dice DUX: se calcula desde la prenda, con los mismos números", () => {
    expect(filaDeProducto(producto())).toMatchObject({
      stockPrendas: 94,
      reservadoPrendas: 13,
      disponiblePrendas: 81,
      disponibleBultos: 13,
      prendasPorBulto: 6,
      equivalencia: "81 prendas = 13 medias docenas y 3 sueltas",
    });
  });

  it("en medias cuenta docenas", () => {
    const fila = filaDeProducto(producto({ rubro: "MEDIAS", packs: [3, 6, 12], disponible: 25 }));

    expect(fila.equivalencia).toBe("25 prendas = 2 docenas y 1 suelta");
    expect(fila.disponibleBultos).toBe(2);
  });

  it("habla en singular cuando corresponde, y no menciona sueltas si no hay", () => {
    expect(filaDeProducto(producto({ disponible: 6 })).equivalencia).toBe("6 prendas = 1 media docena");
    expect(filaDeProducto(producto({ disponible: 1 })).equivalencia).toBe("1 prenda = 0 medias docenas y 1 suelta");
  });

  it("sin packs no inventa un bulto", () => {
    expect(filaDeProducto(producto({ packs: [], disponible: 5 })).equivalencia).toBe("5 prendas");
  });

  it("un combo se cuenta por combo, sin descomponerlo", () => {
    expect(filaDeProducto(producto({ esCombo: true, packs: [], disponible: 3 }))).toMatchObject({
      bultoLabel: "Combo",
      prendasPorBulto: 1,
      disponibleBultos: 3,
      equivalencia: "3 combos",
    });
  });

  it("un disponible negativo se muestra en cero", () => {
    expect(filaDeProducto(producto({ disponible: -4 }))).toMatchObject({ disponiblePrendas: 0, disponibleBultos: 0 });
  });

  it("los colores quedan vacíos hasta el catálogo maestro", () => {
    expect(filaDeProducto(producto()).colores).toEqual([]);
  });
});

describe("filaDeProducto: ventas y estado", () => {
  it("pasa las ventas a bultos y calcula cuántos días alcanza", () => {
    expect(filaDeProducto(producto({ disponible: 60, ventasPrendas: 60 }))).toMatchObject({
      ventas30dBultos: 10,
      diasStock: 30,
      estado: "ok",
    });
  });

  it.each([
    ["sin un bulto completo, agotado", { disponible: 5, ventasPrendas: 60 }, "agotado"],
    ["sin ventas, sin rotación", { disponible: 60, ventasPrendas: 0 }, "sin_rotacion"],
    ["menos de una semana, crítico", { disponible: 12, ventasPrendas: 60 }, "critico"],
    ["más de dos meses, sobrestock", { disponible: 600, ventasPrendas: 60 }, "sobrestock"],
  ] as const)("%s", (_nombre, cambios, estado) => {
    expect(filaDeProducto(producto(cambios)).estado).toBe(estado);
  });

  it("sin ventas, no hay días de stock", () => {
    expect(filaDeProducto(producto()).diasStock).toBeNull();
  });
});

describe("ordenarPorAtencion", () => {
  const fila = (nombre: string, estado: StockFila["estado"], ventas30dBultos = 1) =>
    ({ nombre, estado, ventas30dBultos }) as StockFila;

  it("primero lo agotado que se vende; lo agotado que nadie compra, al final", () => {
    const orden = ordenarPorAtencion([
      fila("sin ventas", "agotado", 0),
      fila("rotación", "sin_rotacion", 0),
      fila("bien", "ok"),
      fila("mucho", "sobrestock"),
      fila("poco", "critico"),
      fila("se vende", "agotado", 3),
    ]);

    expect(orden.map(({ nombre }) => nombre)).toEqual(["se vende", "poco", "mucho", "bien", "rotación", "sin ventas"]);
  });

  it("dentro de cada grupo, primero lo que más se vende", () => {
    const orden = ordenarPorAtencion([fila("a", "critico", 1), fila("b", "critico", 9)]);

    expect(orden.map(({ nombre }) => nombre)).toEqual(["b", "a"]);
  });
});

describe("kpisDeStock", () => {
  it("suma lo real y no cuenta como problema lo que nadie compra", () => {
    const filas = [
      filaDeProducto(producto({ disponible: 60, reservado: 2, ventasPrendas: 60 })),
      filaDeProducto(producto({ disponible: 0, reservado: 1, ventasPrendas: 60 })),
      filaDeProducto(producto({ disponible: 0, reservado: 0, ventasPrendas: 0 })),
    ];

    const kpis = kpisDeStock(filas, 7);

    expect(kpis.find(({ id }) => id === "skus")).toMatchObject({ value: 3, hint: "7 códigos con sus packs" });
    expect(kpis.find(({ id }) => id === "bultos")?.value).toBe(10);
    expect(kpis.find(({ id }) => id === "reservado")?.value).toBe(3);
    expect(kpis.find(({ id }) => id === "critico")?.value).toBe(1);
  });
});
