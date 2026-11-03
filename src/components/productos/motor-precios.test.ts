// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calcularPresentaciones, ceilTo, precioBulto } from "./motor-precios";

const precios = (familia: "lenceria" | "medias", costoDocena: number) =>
  Object.fromEntries(calcularPresentaciones(familia, "MSU2", costoDocena).map((item) => [item.codigo, item.precio]));

describe("motor de precios", () => {
  it("RN-10 a RN-12: lencería, prenda × 2,21, media docena × 1,30 y docena × 1,1765", () => {
    expect(precios("lenceria", 120_000)).toEqual({ MSU2: 22_100, "MSU2-6": 78_000, "MSU2-12": 141_200 });
  });

  it("medias: pack de 3 × 2,21, pack de 6 × 1,8182 y docena × 1,30", () => {
    expect(precios("medias", 40_000)).toEqual({ "MSU2-3": 22_100, "MSU2-6": 36_400, "MSU2-12": 52_000 });
  });

  it("RN-13: un precio exacto no sube $100 por un error de coma flotante", () => {
    expect(200_000 * 1.1765).toBeGreaterThan(235_300);
    expect(precios("lenceria", 200_000)["MSU2-12"]).toBe(235_300);
    expect(ceilTo(40_000 * 1.5475, 100)).toBe(61_900);
  });

  it("el bulto mayorista es la media docena en lencería y la docena en medias", () => {
    expect(precioBulto("lenceria", 120_000)).toMatchObject({ codigo: "SKU-6", precio: 78_000 });
    expect(precioBulto("medias", 40_000)).toMatchObject({ codigo: "SKU-12", precio: 52_000 });
  });
});
