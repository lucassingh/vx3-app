import { describe, expect, it } from "vitest";
import { coloresDe, facetasDe, leerQueryDelCatalogo, pasaLosFiltros, type ProductoFiltrable } from "./filtros";

const producto = (cambios: Partial<ProductoFiltrable> = {}): ProductoFiltrable => ({
  rubro: "LESS",
  subrubro: "TALLES NORMALES",
  marca: "Linda Luna",
  tela: "ALGODON",
  talle: "M A XL",
  colores: ["NEGRO", "BLANCO"],
  proveedor: "BETHY",
  vigencia: "activo",
  listo: true,
  texto: "ln25 ln25-6 less linda luna",
  ...cambios,
});

describe("coloresDe", () => {
  it.each([
    ["BLANCO, NEGRO Y BEIGE", ["BLANCO", "NEGRO", "BEIGE"]],
    ["negro/blanco", ["NEGRO", "BLANCO"]],
    ["ROJO + AZUL", ["ROJO", "AZUL"]],
    ["NEGRO, NEGRO", ["NEGRO"]],
    ["SURTIDOS", ["SURTIDOS"]],
    ["", []],
    [null, []],
  ])("%s", (texto, esperado) => {
    expect(coloresDe(texto)).toEqual(esperado);
  });

  it("una palabra que tiene una Y adentro no se parte", () => {
    expect(coloresDe("YEMA")).toEqual(["YEMA"]);
  });
});

describe("pasaLosFiltros", () => {
  it("por defecto, los históricos no aparecen", () => {
    expect(pasaLosFiltros(producto({ vigencia: "historico" }), {})).toBe(false);
    expect(pasaLosFiltros(producto({ vigencia: "agotado" }), {})).toBe(true);
  });

  it("un histórico se encuentra buscándolo, o eligiendo el estado", () => {
    const historico = producto({ vigencia: "historico" });

    expect(pasaLosFiltros(historico, { q: "ln25" })).toBe(true);
    expect(pasaLosFiltros(historico, { estado: "historico" })).toBe(true);
  });

  it("el estado filtra aunque haya búsqueda", () => {
    expect(pasaLosFiltros(producto({ vigencia: "historico" }), { q: "ln25", estado: "activo" })).toBe(false);
  });

  it("busca todas las palabras, en cualquier orden, sin tildes ni mayúsculas", () => {
    expect(pasaLosFiltros(producto(), { q: "LÍNDA ln25" })).toBe(true);
    expect(pasaLosFiltros(producto(), { q: "linda corset" })).toBe(false);
  });

  it("encuentra un código de pack", () => {
    expect(pasaLosFiltros(producto(), { q: "LN25-6" })).toBe(true);
  });

  it.each([
    ["rubro", "less"],
    ["subrubro", "talles normales"],
    ["marca", "linda luna"],
    ["tela", "algodón"],
    ["talle", "m a xl"],
    ["color", "negro"],
    ["proveedor", "bethy"],
  ])("filtra por %s, sin mirar tildes ni mayúsculas", (faceta, valor) => {
    expect(pasaLosFiltros(producto(), { [faceta]: valor })).toBe(true);
    expect(pasaLosFiltros(producto(), { [faceta]: "otra cosa" })).toBe(false);
  });

  it("un producto sin el dato no pasa ese filtro", () => {
    expect(pasaLosFiltros(producto({ marca: null }), { marca: "linda luna" })).toBe(false);
  });

  it("filtra por salud", () => {
    expect(pasaLosFiltros(producto(), { salud: "listo" })).toBe(true);
    expect(pasaLosFiltros(producto(), { salud: "no_listo" })).toBe(false);
  });

  it("combina los filtros", () => {
    expect(pasaLosFiltros(producto(), { rubro: "less", color: "blanco", estado: "activo" })).toBe(true);
    expect(pasaLosFiltros(producto(), { rubro: "less", color: "rojo" })).toBe(false);
  });
});

describe("facetasDe", () => {
  const productos = [
    producto(),
    producto({ tela: "ALGODÓN", rubro: "CORPIÑOS", subrubro: "ARMADO", colores: ["NEGRO"] }),
    producto({ tela: "ALGODON", rubro: "CORPIÑOS", subrubro: "ARMADO", marca: null }),
    producto({ tela: "ENCAJE", rubro: "LESS", vigencia: "historico", marca: "Vieja" }),
  ];

  it("cuenta por opción, sin los históricos, y en orden", () => {
    expect(facetasDe(productos, {}).rubros).toEqual([
      { valor: "corpinos", etiqueta: "CORPIÑOS", productos: 2 },
      { valor: "less", etiqueta: "LESS", productos: 1 },
    ]);
  });

  it("une lo que se escribe distinto, con la forma más usada", () => {
    expect(facetasDe(productos, {}).telas).toEqual([{ valor: "algodon", etiqueta: "ALGODON", productos: 3 }]);
  });

  it("no ofrece lo que solo tienen los históricos, salvo que se los pida", () => {
    expect(facetasDe(productos, {}).marcas.map(({ etiqueta }) => etiqueta)).toEqual(["Linda Luna"]);
    expect(facetasDe(productos, { estado: "historico" }).marcas.map(({ etiqueta }) => etiqueta)).toEqual(["Vieja"]);
  });

  it("los colores se cuentan uno por uno", () => {
    expect(facetasDe(productos, {}).colores).toEqual([
      { valor: "blanco", etiqueta: "BLANCO", productos: 2 },
      { valor: "negro", etiqueta: "NEGRO", productos: 3 },
    ]);
  });

  it("las demás facetas se ajustan al filtro elegido", () => {
    expect(facetasDe(productos, { rubro: "corpinos" }).subrubros).toEqual([
      { valor: "armado", etiqueta: "ARMADO", productos: 2 },
    ]);
  });

  it("una faceta no se filtra a sí misma: se puede cambiar de opción", () => {
    expect(facetasDe(productos, { rubro: "corpinos" }).rubros.map(({ valor }) => valor)).toEqual(["corpinos", "less"]);
  });

  it("lo elegido sigue en la lista aunque ya no tenga productos", () => {
    expect(facetasDe(productos, { rubro: "corpinos", subrubro: "talles normales" }).subrubros).toContainEqual({
      valor: "talles normales",
      etiqueta: "TALLES NORMALES",
      productos: 0,
    });
  });
});

describe("leerQueryDelCatalogo", () => {
  const leer = (parametros: Record<string, string>) => leerQueryDelCatalogo((parametro) => parametros[parametro]);

  it("lee los filtros", () => {
    expect(leer({ q: " ln25 ", rubro: "less", estado: "agotado", salud: "listo" })).toMatchObject({
      q: "ln25",
      rubro: "less",
      estado: "agotado",
      salud: "listo",
    });
  });

  it("ignora un estado o una salud que no existen", () => {
    expect(leer({ estado: "borrador", salud: "regular" })).toMatchObject({ estado: undefined, salud: undefined });
  });

  it("un filtro vacío no filtra", () => {
    expect(leer({ rubro: " " }).rubro).toBeUndefined();
  });
});
