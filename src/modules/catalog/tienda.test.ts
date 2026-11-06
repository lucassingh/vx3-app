import { describe, expect, it } from "vitest";
import type { CatalogoAltaInput } from "@/lib/api/contracts/catalogo";
import {
  bultoDe,
  categoriaDeLaRuta,
  descripcionDeLaTienda,
  pedidoDeProducto,
  rutaDeCategoria,
  seccionDeLaCategoria,
  type CategoriaParaBuscar,
} from "./tienda";

const INPUT: CatalogoAltaInput = {
  sku: "CTSPN20",
  rubro: "CORPIÑOS",
  subrubro: "TOP SEGUNDA PIEL NORMAL",
  nombre: "TOP SEGUNDA PIEL TIRA ANCHA - CURVA DE TALLES M A 2XL - COLORES BASICOS",
  prenda: "TOP SEGUNDA PIEL TIRA ANCHA",
  color: "COLORES BASICOS",
  copa: "",
  marca: "AITANA",
  proveedorId: "7",
  tela: "ALGODON",
  colores: ["NEGRO", "BLANCO"],
  talles: "M A 2XL",
  atributos: {},
  opcionales: { tres: true, docena: true },
  costoDocena: 48_000,
  pesoBultoKg: 0.7,
  medidasCm: [32, 18, 9],
  fotos: [],
};

describe("rutaDeCategoria", () => {
  it.each([
    ["CORPIÑOS", "TOP SEGUNDA PIEL NORMAL", ["MUJER", "CORPIÑOS"]],
    ["CONJUNTOS DE LENCERIA", "ARMADO LESS NORMAL", ["MUJER", "CONJUNTOS DE LENCERIA"]],
    ["LESS", "TALLES NORMALES", ["MUJER", "LESS", "TALLES NORMALES"]],
    ["VEDETINA", "GRANDE", ["MUJER", "VEDETINA", "GRANDE"]],
    ["UNIVERSALES", "UNIVERSAL GRANDE", ["MUJER", "UNIVERSALES", "UNIVERSAL GRANDE"]],
    ["CONJUNTO DEPORTIVO", "TOP Y LESS NORMAL", ["MUJER", "CONJUNTO DEPORTIVO"]],
    ["DEPORTIVO", "BIKER NORMAL", ["MUJER", "DEPORTIVO"]],
    ["CULOTES", "NORMAL", ["MUJER", "CULOTES"]],
    ["BOXER MUJER", "NORMAL", ["MUJER", "BOXER MUJER"]],
    ["BODY", "ENCAJE", ["MUJER", "BODY"]],
    ["MALLAS", "BIKINI Y SHORT GRANDE", ["MUJER", "MALLAS"]],
    ["REDUCTORES/ FAJAS", "CUALQUIERA", ["MUJER", "REDUCTORES/ FAJAS"]],
    ["HOMBRE", "BOXER", ["HOMBRE", "BOXER"]],
    ["NIÑOS", "MASCULINOS BOXER", ["NIÑOS", "MASCULINOS BOXER"]],
    ["PIJAMA", "VERANO MUJER", ["PIJAMA", "VERANO MUJER"]],
    ["MEDIAS", "SOQUETES HOMBRE", ["MEDIAS", "SOQUETES HOMBRE"]],
    ["MEDIAS DEPORTIVAS", "TENIS", ["MEDIAS DEPORTIVAS", "TENIS"]],
    ["COMBOS", "LENCERIA", ["COMBOS", "LENCERIA"]],
  ])("%s › %s", (rubro, subrubro, ruta) => {
    expect(rutaDeCategoria(rubro, subrubro)).toEqual(ruta);
  });

  it("CORSET se funde en Corpiños, sin importar el subrubro", () => {
    expect(rutaDeCategoria("CORSET", "LO QUE SEA")).toEqual(["MUJER", "CORPIÑOS", "CORSET"]);
  });

  it.each([
    ["REMERA TERMICA MUJER", ["MUJER", "INVIERNO", "REMERA TERMICA MUJER"]],
    ["PANTYS", ["MUJER", "INVIERNO", "PANTYS"]],
    ["REMERA TERMICA HOMBRE", ["HOMBRE"]],
    ["CONJUNTO TERMICO HOMBRE", ["HOMBRE"]],
    ["CALZA TERMICA NIÑO", ["NIÑOS"]],
  ])("INVIERNO se reparte por subrubro: %s", (subrubro, ruta) => {
    expect(rutaDeCategoria("INVIERNO", subrubro)).toEqual(ruta);
  });

  it("no le importan las mayúsculas ni los espacios de más", () => {
    expect(rutaDeCategoria(" corpiños ", "x")).toEqual(["MUJER", "CORPIÑOS"]);
  });

  it("un rubro sin regla frena: nunca crea una categoría suelta (RN-102)", () => {
    expect(rutaDeCategoria("RUBRO NUEVO", "X")).toBeNull();
  });

  it("un subrubro de invierno sin regla, también", () => {
    expect(rutaDeCategoria("INVIERNO", "GORROS")).toBeNull();
  });
});

describe("categoriaDeLaRuta", () => {
  const CATEGORIAS: CategoriaParaBuscar[] = [
    { id: 1, parent: 0, name: { es: "MUJER" } },
    { id: 2, parent: 1, name: { es: "CORPIÑOS" } },
    // Una de las raíces ocultas de los incidentes de septiembre.
    { id: 3, parent: 0, name: { es: "CORPIÑOS" } },
    { id: 4, parent: 1, name: { es_AR: "Less" } },
    { id: 5, parent: 4, name: { es: "TALLES NORMALES" } },
    { id: 6, parent: null, name: { es: "HOMBRE" } },
    { id: 8, parent: 0, name: { es: "MEDIAS" }, visibility: "visible" },
    { id: 9, parent: 0, name: { es: "MEDIAS" }, visibility: "hidden" },
    { id: 10, parent: 0, name: { es: "MEDIAS" }, visibility: "hidden" },
  ];

  it("recorre los niveles, por nombre y por padre", () => {
    expect(categoriaDeLaRuta(["MUJER", "LESS", "TALLES NORMALES"], CATEGORIAS)).toEqual({ id: 5 });
  });

  it("no cae en la raíz oculta con el mismo nombre", () => {
    expect(categoriaDeLaRuta(["MUJER", "CORPIÑOS"], CATEGORIAS)).toEqual({ id: 2 });
  });

  it("entre raíces con el mismo nombre, la visible: en la tienda hay 3 MEDIAS", () => {
    expect(categoriaDeLaRuta(["MEDIAS"], CATEGORIAS)).toEqual({ id: 8 });
  });

  it("la raíz puede venir con el padre en 0 o en null", () => {
    expect(categoriaDeLaRuta(["HOMBRE"], CATEGORIAS)).toEqual({ id: 6 });
  });

  it("lee el nombre en cualquier idioma, sin distinguir mayúsculas", () => {
    expect(categoriaDeLaRuta(["MUJER", "LESS"], CATEGORIAS)).toEqual({ id: 4 });
  });

  it("si falta un nivel, dice cuál, y no la crea", () => {
    expect(categoriaDeLaRuta(["MUJER", "LESS", "TALLES GRANDES"], CATEGORIAS)).toEqual({
      falta: "Falta la categoría MUJER › LESS › TALLES GRANDES en la tienda: la crea VX3.",
    });
  });

  it("si hay dos iguales en el mismo nivel, frena en vez de elegir una", () => {
    const repetidas = [...CATEGORIAS, { id: 7, parent: 0, name: { es: "MUJER" } }];

    expect(categoriaDeLaRuta(["MUJER", "LESS"], repetidas)).toEqual({ falta: "Hay 2 categorías MUJER en la tienda." });
  });
});

describe("seccionDeLaCategoria", () => {
  const MAPA = new Map<number, CategoriaParaBuscar>([
    [1, { id: 1, parent: 0, name: { es: "MUJER" } }],
    [2, { id: 2, parent: 1, name: { es: "LESS" } }],
    [3, { id: 3, parent: 2, name: { es: "TALLES GRANDES" } }],
    [4, { id: 4, parent: 0, name: { es: "CORPIÑOS" } }],
    [5, { id: 5, parent: 6, name: { es: "A" } }],
    [6, { id: 6, parent: 5, name: { es: "B" } }],
  ]);

  it("sube hasta la raíz", () => {
    expect(seccionDeLaCategoria(3, MAPA)).toBe("MUJER");
  });

  it("una raíz que no es de las 7 no es una sección", () => {
    expect(seccionDeLaCategoria(4, MAPA)).toBeNull();
  });

  it("una raíz oculta con el nombre de una sección, tampoco", () => {
    const conOculta = new Map<number, CategoriaParaBuscar>([
      [7, { id: 7, parent: 0, name: { es: "MEDIAS" }, visibility: "hidden" }],
    ]);

    expect(seccionDeLaCategoria(7, conOculta)).toBeNull();
  });

  it("una categoría que no existe tampoco", () => {
    expect(seccionDeLaCategoria(99, MAPA)).toBeNull();
  });

  it("no se cuelga si los datos dan una vuelta", () => {
    expect(seccionDeLaCategoria(5, MAPA)).toBeNull();
  });
});

describe("el bulto", () => {
  it("en lencería es el -6, aunque tenga -3 y -12", () => {
    expect(bultoDe(INPUT)).toMatchObject({ codigo: "CTSPN20-6", label: "Media docena" });
  });

  it("en medias es el -12", () => {
    expect(bultoDe({ ...INPUT, rubro: "MEDIAS", sku: "MSH1" })).toMatchObject({ codigo: "MSH1-12" });
  });
});

describe("descripcionDeLaTienda", () => {
  it("lleva los datos en orden, y el Pack sale del bulto", () => {
    expect(
      descripcionDeLaTienda({
        ...INPUT,
        copa: "B",
        atributos: { elastico: "ANCHO", tipo_bretel: "Regulable fino", otros_detalles: "Con puntilla" },
      }),
    ).toBe(
      "Marca: AITANA. Pack: Media docena. Colores: NEGRO, BLANCO. Talles: M A 2XL. Tela: ALGODON. Copa: B. Elástico: ANCHO. Bretel: Regulable fino. Con puntilla.",
    );
  });

  it.each(["", "NO", "SI", "SÍ", "No corresponde", "NO APLICA", "N/A", "-", "NO HAY DATO", "NO TIENE", "  "])(
    "saltea “%s”",
    (valor) => {
      const texto = descripcionDeLaTienda({ ...INPUT, tela: valor, atributos: { encaje: valor } });

      expect(texto).not.toContain("Tela:");
      expect(texto).not.toContain("Encaje:");
    },
  );
});

describe("pedidoDeProducto", () => {
  it("una sola variante, el bulto, oculto y a precio 0: el precio lo pone DUX", () => {
    expect(pedidoDeProducto(INPUT, 40773512)).toEqual({
      name: { es: `${INPUT.nombre} - MEDIA DOCENA` },
      description: { es: expect.stringContaining("Marca: AITANA.") },
      published: false,
      categories: [40773512],
      variants: [{ sku: "CTSPN20-6", price: "0", weight: 0.7, width: 18, height: 9, depth: 32 }],
    });
  });

  it("en medias, el nombre dice la docena", () => {
    const pedido = pedidoDeProducto({ ...INPUT, rubro: "MEDIAS", sku: "MSH1" }, 1);

    expect(pedido.name.es).toBe(`${INPUT.nombre} - UNA DOCENA`);
    expect(pedido.variants[0]?.sku).toBe("MSH1-12");
  });

  it("lo que falta no se manda", () => {
    const { variants } = pedidoDeProducto({ ...INPUT, pesoBultoKg: 0, medidasCm: [0, 0, 0] }, 1);

    expect(variants).toEqual([{ sku: "CTSPN20-6", price: "0" }]);
  });
});
