import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { escribirXls } from "./xls";

/**
 * Generados con el código del Hub (`modules/alta_dux.py`) y `xlwt`, con datos inventados. DUX aceptó
 * esos archivos: que los nuestros den exactamente los mismos bytes es lo que se puede probar sin
 * crear en DUX productos que después no se borran.
 */
const CARPETA = path.join(process.cwd(), "src/integrations/dux/fixtures/hub");
const casos = readdirSync(CARPETA)
  .filter((archivo) => archivo.endsWith(".xls"))
  .map((archivo) => archivo.replace(/\.xls$/, ""));

const leer = (caso: string) =>
  JSON.parse(readFileSync(path.join(CARPETA, `${caso}.json`), "utf8")) as {
    cols: string[];
    filas: Record<string, string | number>[];
  };

describe("escribirXls", () => {
  it("hay casos de referencia", () => {
    expect(casos.length).toBeGreaterThanOrEqual(12);
  });

  it.each(casos)("%s sale igual, byte por byte, que el del Hub", (caso) => {
    const { cols, filas } = leer(caso);
    const esperado = readFileSync(path.join(CARPETA, `${caso}.xls`));

    const generado = Buffer.from(
      escribirXls(
        cols,
        filas.map((fila) => cols.map((columna) => fila[columna])),
      ),
    );

    expect(generado.length).toBe(esperado.length);
    expect(generado.equals(esperado)).toBe(true);
  });

  it("una celda vacía no se escribe: es lo que deja a un producto fuera de una lista", () => {
    const conVacia = Buffer.from(escribirXls(["A", "B"], [["x", ""]]));
    const conNull = Buffer.from(escribirXls(["A", "B"], [["x", null]]));
    const sinCelda = Buffer.from(escribirXls(["A", "B"], [["x"]]));

    expect(conVacia.equals(sinCelda)).toBe(true);
    expect(conNull.equals(sinCelda)).toBe(true);
  });

  it("el cero sí se escribe: es el IVA de todos los productos", () => {
    const conCero = Buffer.from(escribirXls(["A"], [[0]]));
    const sinCero = Buffer.from(escribirXls(["A"], [[null]]));

    expect(conCero.equals(sinCero)).toBe(false);
  });

  it("con demasiado texto lo dice, en vez de escribir un archivo que DUX no lee", () => {
    const filas = Array.from({ length: 200 }, (_, i) => [`${i}`.padEnd(100, "x")]);

    expect(() => escribirXls(["A"], filas)).toThrow("Demasiado texto");
  });
});
