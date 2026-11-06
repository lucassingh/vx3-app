import { describe, expect, it } from "vitest";
import {
  aFormatoDeNombre,
  losMasParecidos,
  nombreDelProducto,
  prefijoDeCodigo,
  prefijoDelSubrubro,
  presentacionesDelAlta,
  problemasDelNombre,
  proximoCodigo,
} from "./alta";

describe("prefijoDeCodigo", () => {
  it.each([
    ["CJATN62-6", "CJATN"],
    ["MSU2-1-12", "MSU"],
    ["LN 25", "LN"],
    ["23", null],
    ["23-6", null],
  ])("%s: %s", (codigo, esperado) => {
    expect(prefijoDeCodigo(codigo)).toBe(esperado);
  });
});

describe("prefijoDelSubrubro", () => {
  const productos = [
    { rubro: "HOMBRE", subrubro: "BOXER", codigo: "HB1" },
    { rubro: "HOMBRE", subrubro: "BOXER", codigo: "HB2" },
    { rubro: "HOMBRE", subrubro: "BOXER", codigo: "XB9" },
    { rubro: "HOMBRE", subrubro: "SLIP", codigo: "HS1" },
    { rubro: "CORPIÑOS", subrubro: "CORPIÑO ARMADO GRANDE", codigo: "23" },
    { rubro: "VEDETINA", subrubro: "GRANDE", codigo: "VN31" },
    { rubro: "VEDETINA", subrubro: "GRANDE", codigo: "VCG7" },
  ];

  it("toma el que usa la mayoría de sus productos", () => {
    expect(prefijoDelSubrubro("HOMBRE", "BOXER", productos)).toBe("HB");
  });

  it("la tabla de Elías manda sobre lo que hay cargado", () => {
    expect(prefijoDelSubrubro("VEDETINA", "GRANDE", productos)).toBe("VG");
    expect(prefijoDelSubrubro("CORPIÑOS", "CORPIÑO ARMADO GRANDE", productos)).toBe("CAG");
  });

  it("un subrubro nuevo de la tabla ya tiene el suyo, aunque esté vacío", () => {
    expect(prefijoDelSubrubro("CORPIÑOS", "TOP SEGUNDA PIEL GRANDE", [])).toBe("CTSPG");
  });

  it("no distingue mayúsculas ni tildes", () => {
    expect(prefijoDelSubrubro("corpiños", "top deportivo normal", [])).toBe("CTDN");
    expect(prefijoDelSubrubro("Hombre", "Boxer", productos)).toBe("HB");
  });

  it("un subrubro sin prefijo devuelve null: lo define VX3", () => {
    expect(prefijoDelSubrubro("HOMBRE", "BERMUDA", productos)).toBeNull();
  });

  it("un código sin letras no cuenta como prefijo", () => {
    expect(prefijoDelSubrubro("OTRO", "NUEVO", [{ rubro: "OTRO", subrubro: "NUEVO", codigo: "23" }])).toBeNull();
  });
});

describe("proximoCodigo", () => {
  it("es el siguiente libre: si el último es MSH24, sigue MSH25", () => {
    expect(proximoCodigo("MSH", ["MSH1", "MSH24", "MSH3"])).toBe("MSH25");
  });

  it("cuenta los packs y las variantes", () => {
    expect(proximoCodigo("CJATN", ["CJATN62-6"])).toBe("CJATN63");
    expect(proximoCodigo("MSU", ["MSU2-1-12"])).toBe("MSU3");
  });

  it("no se confunde con otro prefijo que empieza igual", () => {
    expect(proximoCodigo("CJA", ["CJA7", "CJATN62", "CJACTN9"])).toBe("CJA8");
    expect(proximoCodigo("LN", ["LN5", "LNX99"])).toBe("LN6");
  });

  it("un código con espacios también cuenta", () => {
    expect(proximoCodigo("LN", ["LN 25"])).toBe("LN26");
  });

  it("un prefijo sin códigos arranca en 1", () => {
    expect(proximoCodigo("CTSPG", [])).toBe("CTSPG1");
  });
});

describe("el nombre", () => {
  it("sigue la estructura de Elías", () => {
    expect(
      nombreDelProducto({
        prenda: "Top segunda piel tira ancha",
        marca: "Vicblack",
        talles: "M a 2XL",
        color: "Colores básicos",
      }),
    ).toBe("TOP SEGUNDA PIEL TIRA ANCHA VICBLACK - CURVA DE TALLES M A 2XL - COLORES BASICOS");
  });

  it("la copa va en su propia parte, después de los talles", () => {
    expect(
      nombreDelProducto({ prenda: "CORPIÑO ARMADO", marca: "SOFI", talles: "85 A 100", copa: "B", color: "NEGRO" }),
    ).toBe("CORPIÑO ARMADO SOFI - CURVA DE TALLES 85 A 100 - COPA B - NEGRO");
  });

  it("sin marca, no deja un hueco", () => {
    expect(nombreDelProducto({ prenda: "BOXER", marca: null, talles: "M/L", color: "SURTIDOS" })).toBe(
      "BOXER - TALLE M/L - SURTIDOS",
    );
  });

  it.each([
    ["M A 2XL", "CURVA DE TALLES M A 2XL"],
    ["M/L Y XL/2XL", "CURVA DE TALLES M/L Y XL/2XL"],
    ["L/XL", "TALLE L/XL"],
    ["TALLE UNICO 35 A 40", "TALLE UNICO 35 A 40"],
    ["talle 2 a 8 años", "TALLE 2 A 8 AÑOS"],
    ["CURVA DE TALLES 85 A 100", "CURVA DE TALLES 85 A 100"],
  ])("los talles %s se escriben %s", (talles, esperado) => {
    expect(nombreDelProducto({ prenda: "X", talles, color: "NEGRO" })).toBe(`X - ${esperado} - NEGRO`);
  });

  it.each([
    ["corpiño  básico", "CORPIÑO BASICO"],
    ["Algodón", "ALGODON"],
    ["M A XXL", "M A 2XL"],
    ["XXXL y XXXXL", "3XL Y 4XL"],
    ["NIÑO", "NIÑO"],
  ])("%s queda %s", (texto, esperado) => {
    expect(aFormatoDeNombre(texto)).toBe(esperado);
  });

  it("dice lo que no va en el nombre", () => {
    expect(problemasDelNombre("BOXER PROMO $ 5000 ENVIO GRATIS")).toEqual([
      "El nombre no lleva precios.",
      'El nombre no lleva "PROMO".',
      "El nombre no lleva envíos.",
    ]);
    expect(problemasDelNombre("BOXER SMART SEXY - TALLE M/L - NEGRO")).toEqual([]);
  });
});

describe("las presentaciones", () => {
  const de = (rubro: string, opcionales = {}, costoDocena = 120_000) =>
    presentacionesDelAlta({ sku: "XX1", rubro, nombre: "PRODUCTO", costoDocena, opcionales });

  it("lencería: la prenda y la media docena", () => {
    expect(de("LESS")).toMatchObject([
      {
        codigo: "XX1",
        nombre: "PRODUCTO - UNIDAD",
        tipo: "SIMPLE",
        precio: 22_100,
        listas: ["LOCAL EF/TR"],
        esBulto: false,
      },
      {
        codigo: "XX1-6",
        nombre: "PRODUCTO - MEDIA DOCENA",
        tipo: "COMPUESTO",
        precio: 78_000,
        listas: ["MAYORISTA EF/TR", "LOCAL EF/TR"],
        esBulto: true,
      },
    ]);
  });

  it("lencería: la docena y el pack de 3 son opcionales", () => {
    const codigos = de("MALLAS", { docena: true, tres: true }).map(({ codigo }) => codigo);

    expect(codigos.toSorted()).toEqual(["XX1", "XX1-12", "XX1-3", "XX1-6"]);
  });

  it("el pack de 3 de lencería va por 1,30, como los que hay en DUX", () => {
    expect(de("MALLAS", { tres: true }).find(({ codigo }) => codigo === "XX1-3")).toMatchObject({
      nombre: "PRODUCTO - PACK DE 3",
      precio: 39_000,
      listas: ["MAYORISTA EF/TR", "LOCAL EF/TR"],
      esBulto: false,
    });
  });

  it("medias: la prenda existe, sin lista ni precio, y el bulto es la docena", () => {
    expect(de("MEDIAS", {}, 40_000)).toMatchObject([
      { codigo: "XX1", nombre: "PRODUCTO - UNIDAD", tipo: "SIMPLE", precio: 0, listas: [], esBulto: false },
      { codigo: "XX1-3", nombre: "PRODUCTO - PACK DE 3", precio: 22_100, listas: ["LOCAL EF/TR"] },
      { codigo: "XX1-6", nombre: "PRODUCTO - PACK DE 6", precio: 36_400, listas: ["LOCAL EF/TR"] },
      { codigo: "XX1-12", nombre: "PRODUCTO - UNA DOCENA", precio: 52_000, esBulto: true },
    ]);
  });

  it("medias: las dos docenas son opcionales, por 1,1765", () => {
    expect(de("MEDIAS DEPORTIVAS", { dosDocenas: true }, 40_000).at(-1)).toMatchObject({
      codigo: "XX1-24",
      nombre: "PRODUCTO - DOS DOCENAS",
      precio: 94_200,
      listas: ["MAYORISTA EF/TR", "LOCAL EF/TR"],
    });
  });
});

describe("losMasParecidos", () => {
  const producto = (sku: string, texto: string, subrubro = "NORMAL", rubro = "CORPIÑOS") => ({
    sku,
    texto,
    rubro,
    subrubro,
  });
  const skus = (filas: { sku: string }[]) => filas.map(({ sku }) => sku);

  it("encuentra al que solo difiere en un detalle: no hace falta que estén todas las palabras", () => {
    const productos = [producto("CTSPN1", "ctspn1 top segunda piel tira fina"), producto("LN1", "ln1 less algodon")];

    expect(skus(losMasParecidos(productos, { q: "TOP SEGUNDA PIEL TIRA ANCHA" }))).toEqual(["CTSPN1"]);
  });

  it("una sola palabra en común no alcanza: casi todo es un top o lleva algodón", () => {
    const productos = [producto("CTSPN1", "ctspn1 top segunda piel")];

    expect(losMasParecidos(productos, { q: "TOP ALGODON" })).toEqual([]);
  });

  it("si escribió una sola palabra, con esa alcanza", () => {
    const productos = [producto("CTSPN1", "ctspn1 top segunda piel"), producto("LN1", "ln1 less")];

    expect(skus(losMasParecidos(productos, { q: "top" }))).toEqual(["CTSPN1"]);
  });

  it("no cuenta las palabras que no distinguen, ni le importan las tildes", () => {
    const productos = [producto("A", "a less con de la"), producto("B", "b corpino de algodon")];

    expect(skus(losMasParecidos(productos, { q: "CORPIÑO CON ALGODÓN" }))).toEqual(["B"]);
    expect(losMasParecidos(productos, { q: "con de la" })).toEqual([]);
  });

  it("los que comparten más palabras van primero; a igual puntaje, los del mismo subrubro", () => {
    const productos = [
      producto("OTRO", "otro top segunda", "GRANDE"),
      producto("MISMO", "mismo top segunda", "NORMAL"),
      producto("MAS", "mas top segunda piel", "GRANDE"),
    ];

    expect(skus(losMasParecidos(productos, { q: "top segunda piel", rubro: "CORPIÑOS", subrubro: "NORMAL" }))).toEqual([
      "MAS",
      "MISMO",
      "OTRO",
    ]);
  });

  it("un subrubro con el mismo nombre en otro rubro no cuenta como el mismo", () => {
    const productos = [
      producto("OTRO", "otro top segunda", "NORMAL", "CULOTES"),
      producto("MISMO", "mismo top segunda", "NORMAL", "CORPIÑOS"),
    ];

    expect(skus(losMasParecidos(productos, { q: "top segunda", rubro: "CORPIÑOS", subrubro: "NORMAL" }))).toEqual([
      "MISMO",
      "OTRO",
    ]);
  });

  it("trae como mucho cinco, en el orden en que venían", () => {
    const productos = Array.from({ length: 8 }, (_, i) => producto(`P${i}`, "top segunda"));

    expect(skus(losMasParecidos(productos, { q: "top segunda" }))).toEqual(["P0", "P1", "P2", "P3", "P4"]);
  });
});
