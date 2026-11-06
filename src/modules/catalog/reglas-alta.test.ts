import { describe, expect, it } from "vitest";
import { avisosDeAlta, erroresDeAlta } from "./reglas-alta";

const BUENO = {
  sku: "LN200",
  rubro: "LESS",
  subrubro: "TALLES NORMALES",
  nombre: "LESS ALGODON - CURVA DE TALLES M A XL - NEGRO",
  costoDocena: 60_000,
  colores: ["NEGRO"],
  talles: "M A XL",
  pesoBultoKg: 0.25,
  medidasCm: [25, 15, 10] as [number, number, number],
};

const campos = (
  entrada: Partial<typeof BUENO>,
  ...resto: Parameters<typeof erroresDeAlta> extends [unknown, ...infer R] ? R : never
) => erroresDeAlta({ ...BUENO, ...entrada }, ...resto).map(({ mensaje }) => mensaje);

describe("lo que bloquea el alta (RN-98)", () => {
  it("un alta completa pasa", () => {
    expect(campos({}, [])).toEqual([]);
  });

  it.each([
    ["", "Falta el SKU."],
    ["COMBO9", "Un SKU de alta no puede empezar con COMBO."],
    ["LN2-1DOCENA", "El SKU no puede contener “DOCENA”."],
    ["LN200-6", "El SKU base no puede terminar en -3, -6, -12 ni -24: se confunde con un pack."],
    ["LN200-3", "El SKU base no puede terminar en -3, -6, -12 ni -24: se confunde con un pack."],
  ])("el SKU %s no pasa", (sku, mensaje) => {
    expect(campos({ sku }, [])).toEqual([mensaje]);
  });

  it("un código que ya existe no pasa, y dice qué hacer", () => {
    expect(campos({ sku: "ln200" }, ["LN200"])[0]).toContain("LN200 ya existe en DUX");
    expect(campos({ sku: "ln200" }, ["LN200"])[0]).toContain("editalo");
  });

  it("un código usado no se reusa aunque esté inhabilitado", () => {
    expect(campos({}, [], { codigosUsados: ["LN200-6"] })[0]).toContain("Ese número ya se usó");
  });

  it("el par rubro y subrubro tiene que existir en DUX", () => {
    const subrubrosDeDux = [{ rubro: "LESS", subrubro: "TALLES GRANDES" }];

    expect(campos({}, [], { subrubrosDeDux })[0]).toContain("no existe en DUX");
    expect(campos({ subrubro: "Talles Grandes" }, [], { subrubrosDeDux })).toEqual([]);
  });

  it("un costo en cero no pasa", () => {
    expect(campos({ costoDocena: 0 }, [])).toEqual(["El costo de la docena tiene que ser mayor a $ 0."]);
  });

  it("peso y medidas son obligatorios (RN-84)", () => {
    expect(campos({ pesoBultoKg: 0 }, [])[0]).toContain("peso del bulto es obligatorio");
    expect(campos({ pesoBultoKg: 250 }, [])[0]).toContain("parece estar en gramos");
    expect(campos({ medidasCm: [25, 0, 10] }, [])[0]).toContain("obligatorios");
  });

  it("lo que no va en el nombre no pasa (RN-127)", () => {
    expect(campos({ nombre: "LESS PROMO" }, [])).toEqual(['El nombre no lleva "PROMO".']);
  });
});

describe("lo que solo avisa", () => {
  const avisos = (entrada: Partial<typeof BUENO> & { marca?: string; tela?: string }, prefijo?: string) =>
    avisosDeAlta({ ...BUENO, marca: "Linda Luna", tela: "ALGODON", ...entrada }, ["Linda Luna"], prefijo).map(
      ({ mensaje }) => mensaje,
    );

  it("con todo en orden, nada", () => {
    expect(avisos({}, "LN")).toEqual([]);
  });

  it("un código que no sigue el prefijo del subrubro", () => {
    expect(avisos({ sku: "XY5" }, "LN")[0]).toBe("XY5 no sigue el prefijo de este subrubro, que es LN.");
  });

  it("una marca que no existe en DUX: primero se crea allá", () => {
    expect(avisos({ marca: "Otra" })[0]).toContain("no existe en DUX");
  });
});
