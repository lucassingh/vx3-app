import { describe, expect, it } from "vitest";
import { leerPestana, PESTANA_DEL_CATALOGO } from "./fuentes";

const ENCABEZADOS = [
  "SKU",
  "Nombre de DUX",
  "marca_comercial",
  "pack",
  "curva_colores",
  "curva_talles",
  "copa",
  "encaje",
  "push_up",
  "aro",
  "elastico",
  "tipo_bretel",
  "gancho_espalda",
  "tela",
  "otros_detalles",
  "largo",
  "ancho",
  "alto",
  "peso",
  "categoria_tn",
  "subcategoria_tn",
  "Proveedor",
  "costo_docena",
];

const pestana = (encabezados: string[], ...filas: string[][]) => ({
  titulo: PESTANA_DEL_CATALOGO,
  visto: [encabezados, ...filas],
  crudo: [encabezados, ...filas],
});

describe("leerPestana", () => {
  it("cada fila lleva su número del Sheet, con el valor visto y el crudo por encabezado", () => {
    const lectura = leerPestana([
      {
        titulo: PESTANA_DEL_CATALOGO,
        visto: [ENCABEZADOS, ["LN1", " Corpiño "]],
        crudo: [ENCABEZADOS, ["LN1", "Corpiño"]],
      },
    ]);

    expect(lectura).toMatchObject({
      ok: true,
      filas: [{ fila: 2, visto: { SKU: "LN1", "Nombre de DUX": "Corpiño" }, crudo: { SKU: "LN1", peso: null } }],
    });
  });

  it("el Sheet recorta las celdas vacías del final: se completan", () => {
    const lectura = leerPestana([pestana(ENCABEZADOS, ["LN1"])]);

    expect(lectura).toMatchObject({ ok: true, filas: [{ visto: { Proveedor: "" }, crudo: { Proveedor: null } }] });
  });

  it("una fila en blanco no cuenta, pero no corre los números", () => {
    const lectura = leerPestana([pestana(ENCABEZADOS, ["LN1"], ["", " "], ["LN2"])]);

    expect(lectura).toMatchObject({ ok: true, filas: [{ fila: 2 }, { fila: 4 }] });
  });

  it("sku_nuevo y sku_venta se leen si existen", () => {
    const lectura = leerPestana([pestana([...ENCABEZADOS, "sku_nuevo"], ["LN1"])]);

    expect(lectura).toMatchObject({ ok: true, filas: [{ visto: { sku_nuevo: "" } }] });
  });

  it("una columna que no se usa puede cambiar", () => {
    expect(
      leerPestana([
        pestana(
          ENCABEZADOS.filter((e) => e !== "pack"),
          ["LN1"],
        ),
      ]),
    ).toMatchObject({ ok: true });
  });

  it("si una columna que se usa cambió de nombre, frena y dice cuál", () => {
    const renombrada = ENCABEZADOS.map((e) => (e === "tela" ? "Tela" : e));

    expect(leerPestana([pestana(renombrada, ["LN1"])])).toEqual({
      ok: false,
      motivo: "En el Sheet falta o cambió de nombre: tela.",
    });
  });

  it("sin la pestaña, frena", () => {
    expect(leerPestana([{ titulo: "Otra", visto: [], crudo: [] }])).toEqual({
      ok: false,
      motivo: "El Sheet no tiene la pestaña CatalogoDetalle.",
    });
  });

  it("sin filas, frena: no es un catálogo vacío", () => {
    expect(leerPestana([pestana(ENCABEZADOS)])).toEqual({ ok: false, motivo: "El Sheet volvió sin filas." });
  });
});
