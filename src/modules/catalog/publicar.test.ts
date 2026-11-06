import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CatalogoAltaInput } from "@/lib/api/contracts/catalogo";
import { escribirXls } from "@/lib/xls";
import { ARCHIVOS_DE_IMPORTACION, hojasDeImportacion, mismoNombre, pedidosDeDux, type IdsDeDux } from "./publicar";

const LISTAS = { "MAYORISTA EF/TR": 71695, "LOCAL EF/TR": 71697 };

const IDS: IdsDeDux = {
  rubro: 1,
  subrubro: 10,
  proveedor: 7,
  marca: "NAND",
  listas: LISTAS,
  personal: 15401272,
  unidadDeMedida: 3,
  sucursales: [1, 2],
};

const base: CatalogoAltaInput = {
  sku: "",
  rubro: "",
  subrubro: "",
  nombre: "",
  prenda: "",
  color: "",
  copa: "",
  marca: "",
  proveedorId: "7",
  tela: "",
  colores: [],
  talles: "",
  atributos: {},
  opcionales: {},
  costoDocena: 0,
  pesoBultoKg: 0,
  medidasCm: [0, 0, 0],
  fotos: [],
};

/** Los mismos datos con los que se generaron los archivos de referencia, con el código del Hub. */
const CASOS_DEL_HUB: Record<string, { input: CatalogoAltaInput; proveedor: string }> = {
  lenceria: {
    proveedor: "FABRICANTE, PRUEBA",
    input: {
      ...base,
      sku: "ZZTEST1",
      nombre: "TOP SEGUNDA PIEL TIRA ANCHA ÑANDÚ - CURVA DE TALLES M A 2XL - COLORES BASICOS",
      rubro: "CORPIÑOS",
      subrubro: "TOP SEGUNDA PIEL NORMAL",
      marca: "ÑANDÚ",
      costoDocena: 48_000,
    },
  },
  "lenceria-docena": {
    proveedor: "",
    input: {
      ...base,
      sku: "ZZTEST2",
      nombre: "LESS ALGODON - CURVA DE TALLES M A XL - NEGRO",
      rubro: "LESS",
      subrubro: "TALLES NORMALES",
      costoDocena: 25_000,
      opcionales: { docena: true },
    },
  },
  medias: {
    proveedor: "FABRICANTE, PRUEBA",
    input: {
      ...base,
      sku: "ZZTEST3",
      nombre: "SOQUETE HOMBRE ALGODON - TALLE UNICO - COLORES SURTIDOS",
      rubro: "MEDIAS",
      subrubro: "SOQUETES HOMBRE",
      marca: "UOMO",
      costoDocena: 11_000,
    },
  },
};

const LENCERIA = CASOS_DEL_HUB.lenceria!.input;
const MEDIAS = CASOS_DEL_HUB.medias!.input;

describe("los .xls salen iguales a los del Hub", () => {
  const CARPETA = path.join(process.cwd(), "src/integrations/dux/fixtures/hub");

  describe.each(Object.keys(CASOS_DEL_HUB))("%s", (caso) => {
    it.each(ARCHIVOS_DE_IMPORTACION)("%s", (archivo) => {
      const { input, proveedor } = CASOS_DEL_HUB[caso]!;
      const { columnas, filas } = hojasDeImportacion(input, { proveedor, listas: LISTAS })[archivo];

      const generado = Buffer.from(escribirXls(columnas, filas));

      const esperado = readFileSync(path.join(CARPETA, `hub-${caso}-${archivo}.xls`));
      expect(generado.equals(esperado)).toBe(true);
    });
  });

  it("sin el ID de una lista no arma el archivo: cargaría el precio en otra", () => {
    expect(() => hojasDeImportacion(LENCERIA, { proveedor: "", listas: { "LOCAL EF/TR": 71697 } })).toThrow(
      "Falta el ID de la lista MAYORISTA EF/TR.",
    );
  });
});

describe("pedidosDeDux", () => {
  it("la prenda va primero, y es la única SIMPLE", () => {
    const pedidos = pedidosDeDux(LENCERIA, IDS, null);

    expect(pedidos.map(({ cod_item, tipo_producto }) => [cod_item, tipo_producto])).toEqual([
      ["ZZTEST1", "SIMPLE"],
      ["ZZTEST1-6", "COMPUESTO"],
    ]);
  });

  it("los packs nombran a la prenda como su componente, con su cantidad", () => {
    const [prenda, ...packs] = pedidosDeDux(MEDIAS, IDS, null);

    expect(prenda).not.toHaveProperty("kit_item");
    expect(packs.map(({ kit_item }) => kit_item)).toEqual([
      [{ cod_kit: "ZZTEST3", ctd: 3 }],
      [{ cod_kit: "ZZTEST3", ctd: 6 }],
      [{ cod_kit: "ZZTEST3", ctd: 12 }],
    ]);
  });

  it("los precios salen del costo, por lista, y la prenda queda fuera del mayorista (RN-95)", () => {
    const [prenda, bulto] = pedidosDeDux(LENCERIA, IDS, null);

    expect(prenda?.precios).toEqual([{ id_lista_precio: 71697, id_moneda: 1, valor: 8_900 }]);
    expect(bulto?.precios).toEqual([
      { id_lista_precio: 71695, id_moneda: 1, valor: 31_200 },
      { id_lista_precio: 71697, id_moneda: 1, valor: 31_200 },
    ]);
  });

  it("la prenda de medias no va a ninguna lista: existe solo como componente", () => {
    const [prenda] = pedidosDeDux(MEDIAS, IDS, null);

    expect(prenda?.precios).toEqual([]);
  });

  it("el costo va con dos decimales, en cada presentación", () => {
    const pedidos = pedidosDeDux({ ...LENCERIA, costoDocena: 25_000 }, IDS, null);

    expect(pedidos.map(({ costo_compra }) => costo_compra)).toEqual([2_083.33, 12_500]);
  });

  it("la foto principal va en la prenda y en todos sus packs (RN-123)", () => {
    const pedidos = pedidosDeDux(MEDIAS, IDS, "https://x/foto.jpg");

    expect(pedidos.map(({ imagen_url }) => imagen_url)).toEqual(Array(4).fill("https://x/foto.jpg"));
  });

  it("sin foto ni marca, esos campos no van", () => {
    const [prenda] = pedidosDeDux(LENCERIA, { ...IDS, marca: null }, null);

    expect(prenda).not.toHaveProperty("imagen_url");
    expect(prenda).not.toHaveProperty("cod_marca");
  });

  it("lleva lo que la API exige, con los ID de DUX", () => {
    const [prenda] = pedidosDeDux(LENCERIA, IDS, null);

    expect(prenda).toMatchObject({
      id_personal: 15401272,
      id_moneda: 1,
      id_unidad_medida: 3,
      porc_iva: 0,
      sucursales_habilitadas: [{ id_sucursal: 1 }, { id_sucursal: 2 }],
      id_rubro: 1,
      id_sub_rubro: 10,
      id_proveedor: 7,
      cod_marca: "NAND",
      acepta_stock_negativo: false,
    });
  });

  it("sin el ID de una lista no arma el pedido", () => {
    expect(() => pedidosDeDux(LENCERIA, { ...IDS, listas: { "LOCAL EF/TR": 71697 } }, null)).toThrow(
      "Falta el ID de la lista MAYORISTA EF/TR.",
    );
  });
});

describe("mismoNombre", () => {
  it.each([
    ["TOP - NEGRO", "TOP - NEGRO"],
    ["top - negro", "TOP - NEGRO"],
    ["TOP  -  NEGRO ", "TOP - NEGRO"],
    ["CORPIÑO", "CORPINO"],
  ])("%s es lo mismo que %s", (a, b) => {
    expect(mismoNombre(a, b)).toBe(true);
  });

  it("otro texto es otro producto", () => {
    expect(mismoNombre("TOP - NEGRO", "TOP - BLANCO")).toBe(false);
  });
});
