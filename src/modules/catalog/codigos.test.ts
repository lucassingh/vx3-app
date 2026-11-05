import { describe, expect, it } from "vitest";
import { esMedias, leerCodigo, normalizarCodigo, unidadesDelNombre } from "./codigos";

const LENCERIA = "LESS";
const MEDIAS = "MEDIAS";

describe("leerCodigo", () => {
  // Casi todos, códigos reales de DUX del cruce del 04/11. FLETE no tiene items hoy, pero RN-104 lo nombra.
  it.each([
    // Lencería: la prenda, media docena y docena.
    ["HB2", "HOMBRE", "prenda", "HB2", null],
    ["HB2-6", "HOMBRE", "pack", "HB2", 6],
    ["HB2-12", "HOMBRE", "pack", "HB2", 12],
    // Medias: packs chicos, docena y dos docenas.
    ["MSU2", MEDIAS, "prenda", "MSU2", null],
    ["MSU2-3", MEDIAS, "pack", "MSU2", 3],
    ["MSU2-6", MEDIAS, "pack", "MSU2", 6],
    ["MSU2-12", MEDIAS, "pack", "MSU2", 12],
    ["MSM2-24", MEDIAS, "pack", "MSM2", 24],
    ["MSN1-12", "MEDIAS DEPORTIVAS", "pack", "MSN1", 12],
    // Variantes: el número es parte de la identidad, salvo el último si es cantidad.
    ["MSU2-1", MEDIAS, "prenda", "MSU2-1", null],
    ["MSU2-4", MEDIAS, "prenda", "MSU2-4", null],
    ["MSU2-1-12", MEDIAS, "pack", "MSU2-1", 12],
    // Códigos sin letras.
    ["23", "CORPIÑOS", "prenda", "23", null],
    ["23-12", "CORPIÑOS", "pack", "23", 12],
    // Combos: no se descomponen, tengan o no rubro.
    ["COMBO1", "COMBOS", "combo", "COMBO1", null],
    ["COMBO32", null, "combo", "COMBO32", null],
    // No es mercadería.
    ["CF", "CONSUMIDOR FINAL", "no_producto", "CF", null],
    ["ENVIO5", "ENVIOS Y EMBALAJE", "no_producto", "ENVIO5", null],
    ["EMBALAJE1", "ENVIOS Y EMBALAJE", "no_producto", "EMBALAJE1", null],
    ["FLETE2", null, "no_producto", "FLETE2", null],
    // Packs armados a mano antes del corte: los lee las ventas viejas.
    ["MSM2-2DOCENAS", MEDIAS, "pack_viejo", "MSM2", null],
    ["HB2-1DOCENA", "HOMBRE", "pack_viejo", "HB2", null],
    ["HB8-UNA DOCENA", "HOMBRE", "pack_viejo", "HB8", null],
  ] as const)("%s en %s es %s de %s", (codigo, rubro, tipo, base, cantidad) => {
    expect(leerCodigo(codigo, rubro)).toMatchObject({ tipo, base, cantidad });
  });

  it("el -3 es una cantidad normal en cualquier rubro (Elías, 04/11)", () => {
    expect(leerCodigo("X1-3", MEDIAS)).toMatchObject({ tipo: "pack", base: "X1", cantidad: 3 });
    expect(leerCodigo("DSN10-3", "DEPORTIVO")).toMatchObject({ tipo: "pack", base: "DSN10", cantidad: 3 });
    expect(leerCodigo("MEN1-3", "MALLAS")).toMatchObject({ tipo: "pack", base: "MEN1", cantidad: 3 });
  });

  it("un sufijo que no es cantidad queda como parte de la identidad", () => {
    expect(leerCodigo("LN5-2", LENCERIA)).toMatchObject({ tipo: "prenda", base: "LN5-2", cantidad: null });
    expect(leerCodigo("LN5-A", LENCERIA)).toMatchObject({ tipo: "prenda", base: "LN5-A", cantidad: null });
  });

  it("escribe el código igual en todas las fuentes, con espacios y en minúsculas", () => {
    expect(leerCodigo("LN 25", LENCERIA)).toMatchObject({ normalizado: "LN25", base: "LN25", tipo: "prenda" });
    expect(leerCodigo("LN 25-6", LENCERIA)).toMatchObject({ normalizado: "LN25-6", base: "LN25", cantidad: 6 });
    expect(leerCodigo("combo42", null)).toMatchObject({ tipo: "combo", base: "COMBO42" });
  });

  it("sin rubro se lee como lencería", () => {
    expect(leerCodigo("X1-6", null)).toMatchObject({ tipo: "pack", cantidad: 6 });
    expect(leerCodigo("X1-24", undefined)).toMatchObject({ tipo: "prenda" });
  });

  it("un código que empieza como otra cosa no se confunde", () => {
    expect(leerCodigo("CFX1", LENCERIA)).toMatchObject({ tipo: "prenda" });
  });
});

describe("normalizarCodigo", () => {
  it("saca espacios y pasa a mayúsculas", () => {
    expect(normalizarCodigo(" ln 25-6 ")).toBe("LN25-6");
  });
});

describe("esMedias", () => {
  it("reconoce los dos rubros de medias, con o sin mayúsculas", () => {
    expect(esMedias("MEDIAS")).toBe(true);
    expect(esMedias("Medias Deportivas")).toBe(true);
    expect(esMedias("LESS")).toBe(false);
    expect(esMedias(null)).toBe(false);
  });
});

describe("unidadesDelNombre", () => {
  it.each([
    ["CONJUNTO ARMADO TRES PIEZA CONDEZA - MEDIA DOCENA", 6],
    ["VEDETINA DE ALGODON LINDA LUNA TIPO MORLEY - MEDIA DOCENTA", 6],
    ["LESS - MEDAID DOCENA", 6],
    ["MEDIA LARGA - 1/2 DOCENA", 6],
    ["SOQUETE 1/4 ADIDAS - UNA DOCENA", 12],
    ["MEDIAS ESCOLARES - UNA DOENA", 12],
    ["MEDIAS AMANECER SOQUETE MUJER - DOS DOCENAS", 24],
    ["MEDIAS TENIS (3/4) - UNIDAD", 1],
    ["corpiño - media docena", 6],
  ])("%s son %i", (nombre, unidades) => {
    expect(unidadesDelNombre(nombre)).toBe(unidades);
  });

  it("si el nombre no lo dice, da null", () => {
    expect(unidadesDelNombre("VEDETINA LINDA LUNA ENCAJE - CURVA TALLES XL A 3XL")).toBeNull();
    expect(unidadesDelNombre("MEDIA TENIS 3/4")).toBeNull();
  });
});
