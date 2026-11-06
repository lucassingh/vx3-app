import { describe, expect, it } from "vitest";
import {
  armarCatalogo,
  leerDato,
  type ArchivoDeLaCarpeta,
  type FilaDelSheet,
  type ItemDeDux,
  type ProductoArmado,
} from "./armar";
import { leerCodigo } from "./codigos";

let numeroDeFila = 1;

function fila(sku: string, cambios: Record<string, string> = {}, crudo: Record<string, unknown> = {}): FilaDelSheet {
  numeroDeFila += 1;
  return {
    fila: numeroDeFila,
    visto: { SKU: sku, "Nombre de DUX": `Nombre del Sheet de ${sku}`, categoria_tn: "LESS", ...cambios },
    crudo: { peso: 0.25, largo: 25, ancho: 15, alto: 10, ...crudo },
  };
}

function item(codigo: string, rubro = "LESS", cambios: Partial<ItemDeDux> = {}): ItemDeDux {
  const { tipo, base, cantidad } = leerCodigo(codigo, rubro);
  return {
    codigo,
    nombre: `Nombre de DUX de ${codigo}`,
    tipo,
    base,
    cantidad,
    rubro,
    subrubro: null,
    marca: null,
    proveedor: null,
    creadoEl: "2025-01-15",
    tieneFoto: false,
    ...cambios,
  };
}

const foto = (nombre: string, cambios: Partial<ArchivoDeLaCarpeta> = {}): ArchivoDeLaCarpeta => ({
  driveId: `id-${nombre}`,
  nombre,
  mimeType: "image/jpeg",
  md5: `md5-${nombre}`,
  ancho: 1600,
  alto: 1600,
  ...cambios,
});

const armar = (filas: FilaDelSheet[] = [], items: ItemDeDux[] = [], archivos: ArchivoDeLaCarpeta[] = []) =>
  armarCatalogo({ filas, items, archivos });

const unico = (catalogo: { productos: ProductoArmado[] }, codigo: string) => {
  const producto = catalogo.productos.find((p) => p.codigo === codigo);
  if (!producto) throw new Error(`No se armó ${codigo}`);
  return producto;
};

describe("la identidad del producto", () => {
  it("la prenda y sus packs son un producto, con una presentación cada uno", () => {
    const catalogo = armar([fila("LN25")], [item("LN25"), item("LN25-6"), item("LN25-12")]);

    expect(catalogo.productos).toHaveLength(1);
    expect(unico(catalogo, "LN25").presentaciones).toEqual([
      { codigo: "LN25", tipo: "prenda", cantidad: null, enDux: true },
      { codigo: "LN25-12", tipo: "pack", cantidad: 12, enDux: true },
      { codigo: "LN25-6", tipo: "pack", cantidad: 6, enDux: true },
    ]);
  });

  it("las variantes son productos distintos: MSU2-1 no es MSU2-4", () => {
    const catalogo = armar([], [item("MSU2-1", "MEDIAS"), item("MSU2-1-12", "MEDIAS"), item("MSU2-4", "MEDIAS")]);

    expect(catalogo.productos.map(({ codigo }) => codigo)).toEqual(["MSU2-1", "MSU2-4"]);
    expect(unico(catalogo, "MSU2-1").presentaciones.map(({ codigo }) => codigo)).toEqual(["MSU2-1", "MSU2-1-12"]);
    expect(unico(catalogo, "MSU2-4").presentaciones.map(({ codigo }) => codigo)).toEqual(["MSU2-4"]);
  });

  it("el -3 es una presentación normal, en cualquier rubro", () => {
    const catalogo = armar([], [item("MEN1", "MALLAS"), item("MEN1-3", "MALLAS")]);

    expect(unico(catalogo, "MEN1").presentaciones).toContainEqual({
      codigo: "MEN1-3",
      tipo: "pack",
      cantidad: 3,
      enDux: true,
    });
  });

  it("un combo no se descompone", () => {
    const catalogo = armar([fila("COMBO7", { categoria_tn: "COMBOS" })], [item("COMBO7", "COMBOS")]);

    expect(unico(catalogo, "COMBO7")).toMatchObject({ esCombo: true });
    expect(catalogo.productos).toHaveLength(1);
  });

  it("lo que no es mercadería no es un producto", () => {
    const catalogo = armar([fila("CF"), fila("ENVIO1")], [item("CF"), item("EMBALAJE1"), item("FLETE")]);

    expect(catalogo.productos).toEqual([]);
  });

  it("un producto solo en DUX o solo en el Sheet también existe, y dice dónde está", () => {
    const catalogo = armar([fila("LN1")], [item("LN2")]);

    expect(unico(catalogo, "LN1")).toMatchObject({ enSheet: true, enDux: false });
    expect(unico(catalogo, "LN2")).toMatchObject({
      enSheet: false,
      enDux: true,
      problemasDeEnvio: ["no está en el Sheet"],
    });
  });

  it("un código con espacios en DUX se une con el del Sheet", () => {
    const catalogo = armar([fila("LN25")], [item("LN 25")]);

    expect(catalogo.productos).toHaveLength(1);
    expect(unico(catalogo, "LN25")).toMatchObject({ enSheet: true, enDux: true });
  });
});

describe("sku_nuevo", () => {
  it("manda sobre SKU: la fila 522 es COMBO7, no COMBO8", () => {
    const catalogo = armar(
      [fila("COMBO8", { sku_nuevo: "COMBO7", categoria_tn: "COMBOS" })],
      [item("COMBO7", "COMBOS")],
    );

    expect(catalogo.productos.map(({ codigo }) => codigo)).toEqual(["COMBO7"]);
    expect(unico(catalogo, "COMBO7").enSheet).toBe(true);
  });

  it("BORRAR saca la fila, y dice cuál fue", () => {
    const borrada = fila("COMBO7", { sku_nuevo: "BORRAR", categoria_tn: "COMBOS" });
    const buena = fila("COMBO8", { sku_nuevo: "COMBO7", categoria_tn: "COMBOS" });

    const catalogo = armar([borrada, buena]);

    expect(catalogo.filasBorradas).toEqual([borrada.fila]);
    expect(catalogo.codigosRepetidos).toEqual([]);
    expect(unico(catalogo, "COMBO7").filaDelSheet).toBe(buena.fila);
  });

  it("borrar no distingue mayúsculas", () => {
    expect(armar([fila("LN1", { sku_nuevo: "borrar" })]).productos).toEqual([]);
  });

  it("una fila de pack entra como presentación, y los datos salen de la fila de la prenda", () => {
    const pack = fila("DSN11", { sku_nuevo: "DSN11-3", tela: "De la fila del pack" });
    const prenda = fila("DSN11", { tela: "De la fila de la prenda" });

    const catalogo = armar([pack, prenda], [item("DSN11"), item("DSN11-3")]);

    expect(catalogo.codigosRepetidos).toEqual([]);
    expect(unico(catalogo, "DSN11")).toMatchObject({
      filaDelSheet: prenda.fila,
      tela: { valor: "De la fila de la prenda" },
    });
  });

  it("un pack viejo con su sku_nuevo entra al producto", () => {
    const catalogo = armar(
      [fila("MSH1-2DOCENAS", { sku_nuevo: "MSH1-24", categoria_tn: "MEDIAS" })],
      [item("MSH1", "MEDIAS")],
    );

    expect(catalogo.filasConPackViejo).toEqual([]);
    expect(unico(catalogo, "MSH1").presentaciones.map(({ codigo }) => codigo)).toContain("MSH1-24");
  });
});

describe("filas que no cierran", () => {
  it("un pack viejo sin sku_nuevo queda afuera, y dice cuál", () => {
    const vieja = fila("HB2-1DOCENA");

    const catalogo = armar([vieja]);

    expect(catalogo.productos).toEqual([]);
    expect(catalogo.filasConPackViejo).toEqual([{ fila: vieja.fila, codigo: "HB2-1DOCENA" }]);
  });

  it("una fila sin SKU no arma un producto sin código, y dice cuál", () => {
    const sinCodigo = fila("");

    const catalogo = armar([sinCodigo]);

    expect(catalogo.productos).toEqual([]);
    expect(catalogo.filasSinCodigo).toEqual([sinCodigo.fila]);
  });

  it("un código en dos filas: vale la primera, y queda para revisar", () => {
    const primera = fila("VG35", { tela: "Primera" });
    const segunda = fila("VG35", { tela: "Segunda" });

    const catalogo = armar([primera, segunda]);

    expect(catalogo.codigosRepetidos).toEqual([{ codigo: "VG35", filas: [primera.fila, segunda.fila] }]);
    expect(unico(catalogo, "VG35").tela.valor).toBe("Primera");
  });
});

describe("el dueño de cada dato", () => {
  const catalogo = armar(
    [
      fila("LN25", {
        "Nombre de DUX": "Nombre viejo del Sheet",
        categoria_tn: "LESS",
        subcategoria_tn: "TALLES NORMALES",
        marca_comercial: "Linda Luna",
        Proveedor: "BETHY",
        tela: "ALGODON",
        curva_colores: "ROSA, NEGRO",
        curva_talles: "M A 2XL",
        copa: "B",
        encaje: "SI",
      }),
    ],
    [
      item("LN25", "CORPIÑOS", {
        nombre: "Nombre nuevo de DUX",
        subrubro: "OTRO",
        marca: "OTRA",
        proveedor: "OTRO PROVEEDOR",
      }),
    ],
  );
  const producto = unico(catalogo, "LN25");

  it("el nombre lo da DUX, aunque el Sheet diga otro", () => {
    expect(producto.nombre).toBe("Nombre nuevo de DUX");
  });

  it("rubro, subrubro, marca, proveedor, tela, talles y colores los da el Sheet", () => {
    expect(producto).toMatchObject({
      rubro: "LESS",
      subrubro: "TALLES NORMALES",
      marca: { valor: "Linda Luna", situacion: "ok" },
      proveedor: { valor: "BETHY", situacion: "ok" },
      tela: { valor: "ALGODON", situacion: "ok" },
      talles: "M A 2XL",
      colores: "ROSA, NEGRO",
    });
  });

  it("guarda lo que dice DUX, para ver si se contradicen", () => {
    expect(producto.enDuxDice).toEqual({
      rubro: "CORPIÑOS",
      subrubro: "OTRO",
      marca: "OTRA",
      proveedor: "OTRO PROVEEDOR",
    });
  });

  it("los atributos son solo los que tienen dato", () => {
    expect(producto.atributos).toEqual({ copa: "B", encaje: "SI" });
  });

  it("sin rubro en el Sheet, vale el de DUX; sin fila, el nombre también", () => {
    const soloDux = armar([], [item("LN9", "CORPIÑOS", { subrubro: "ARMADO" })]);

    expect(unico(soloDux, "LN9")).toMatchObject({
      rubro: "CORPIÑOS",
      subrubro: "ARMADO",
      nombre: "Nombre de DUX de LN9",
    });
  });

  it("solo en el Sheet, el nombre sale de ahí", () => {
    expect(unico(armar([fila("LN7")]), "LN7").nombre).toBe("Nombre del Sheet de LN7");
  });

  it.each([
    ["CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100 - UNIDAD"],
    ["CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100 - MEDIA DOCENA"],
    ["CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100 - UNA DOCENA"],
    ["CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100 - DOS DOCENAS"],
    ["CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100 - PACK DE 3"],
    ["CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100"],
  ])("el producto se nombra sin la cantidad: %s", (nombre) => {
    expect(unico(armar([], [item("LN3-6", "LESS", { nombre })]), "LN3").nombre).toBe(
      "CORPIÑO ARMADO LINDA LUNA - CURVA DE TALLES 85 A 100",
    );
  });

  it("solo saca la cantidad del final", () => {
    const nombre = "PACK DE 6 MEDIAS - UNIDAD - COLOR ROSA";

    expect(unico(armar([], [item("LN3", "LESS", { nombre })]), "LN3").nombre).toBe(nombre);
  });

  it("la fecha es la de la prenda, aunque un pack sea más viejo", () => {
    const conFechas = armar(
      [],
      [item("LN3-6", "LESS", { creadoEl: "2024-01-01" }), item("LN3", "LESS", { creadoEl: "2025-03-01" })],
    );

    expect(unico(conFechas, "LN3").creadoEl).toBe("2025-03-01");
  });

  it("sin prenda, la fecha es la del pack más viejo", () => {
    const soloPacks = armar(
      [],
      [item("LN3-12", "LESS", { creadoEl: "2026-10-08" }), item("LN3-6", "LESS", { creadoEl: "2025-03-01" })],
    );

    expect(unico(soloPacks, "LN3").creadoEl).toBe("2025-03-01");
  });

  it("sku_venta se lee si aparece, y hoy no está en el Sheet", () => {
    expect(unico(armar([fila("LN3", { sku_venta: "ln 3-12" })]), "LN3").skuDeVenta).toBe("LN3-12");
    expect(unico(armar([fila("LN3")]), "LN3").skuDeVenta).toBeNull();
  });

  it("el nombre de la prenda gana al de sus packs", () => {
    const conFechas = armar(
      [],
      [
        item("LN3-6", "LESS", { creadoEl: "2026-10-08" }),
        item("LN3", "LESS", { creadoEl: "2025-03-01", nombre: "La prenda" }),
      ],
    );

    expect(unico(conFechas, "LN3")).toMatchObject({ nombre: "La prenda", creadoEl: "2025-03-01" });
  });
});

describe("leerDato", () => {
  it.each([
    ["Linda Luna", { valor: "Linda Luna", situacion: "ok" }],
    ["  VARIAS ", { valor: "VARIAS", situacion: "ok" }],
    ["", { valor: null, situacion: "falta" }],
    ["   ", { valor: null, situacion: "falta" }],
    [undefined, { valor: null, situacion: "falta" }],
    ["NO APLICA", { valor: null, situacion: "no_aplica" }],
    ["no aplica", { valor: null, situacion: "no_aplica" }],
    ["No hay dato", { valor: null, situacion: "no_hay_dato" }],
  ])("%s", (texto, esperado) => {
    expect(leerDato(texto)).toEqual(esperado);
  });
});

describe("peso y medidas", () => {
  it("salen del valor crudo, en kg y en cm", () => {
    expect(unico(armar([fila("LN1", {}, { peso: 0.65, largo: 25, ancho: 15, alto: 10 })]), "LN1")).toMatchObject({
      pesoKg: 0.65,
      largoCm: 25,
      anchoCm: 15,
      altoCm: 10,
      problemasDeEnvio: [],
    });
  });

  it("un número escrito como texto se lee igual", () => {
    expect(unico(armar([fila("LN1", {}, { peso: "0,25" })]), "LN1").pesoKg).toBe(0.25);
  });

  it.each([
    [{ peso: "" }, "sin peso"],
    [{ peso: 0 }, "peso en 0"],
    [{ peso: "mucho" }, "peso inválido: mucho"],
    [{ largo: undefined }, "sin largo"],
    [{ alto: 300 }, "alto imposible: 300"],
    [{ peso: 250 }, "peso imposible: 250"],
  ])("%j: %s", (crudo, problema) => {
    const producto = unico(armar([fila("LN1", {}, crudo)]), "LN1");

    expect(producto.problemasDeEnvio).toEqual([problema]);
  });
});

describe("las fotos", () => {
  const conFotos = (...archivos: ArchivoDeLaCarpeta[]) => armar([fila("LN25")], [], archivos);

  it("el nombre lleva al producto, con la principal primero y las demás por su número", () => {
    const catalogo = conFotos(foto("LN25-2.jpg"), foto("LN25.jpg"), foto("LN25-10.jpg"), foto("LN25-1.jpg"));

    expect(unico(catalogo, "LN25").fotos.map(({ nombre, posicion }) => [nombre, posicion])).toEqual([
      ["LN25.jpg", 0],
      ["LN25-1.jpg", 1],
      ["LN25-2.jpg", 2],
      ["LN25-10.jpg", 3],
    ]);
  });

  it.each([
    ["sin extensión", "LN25-1"],
    ['con "JPG" pegado', "LN25-1JPG"],
    ["con guion al final", "LN25-"],
    ["con copia", "LN25-1 - copia.jpg"],
    ["con espacios", "LN 25-1.jpg"],
    ["en minúsculas", "ln25-1.jpeg"],
    ["heic", "LN25-1.heic"],
  ])("entiende un nombre %s", (_, nombre) => {
    expect(unico(conFotos(foto(nombre)), "LN25").fotos).toHaveLength(1);
  });

  it("la misma imagen dos veces cuenta una", () => {
    const catalogo = conFotos(foto("LN25-1.jpg", { md5: "igual" }), foto("LN25-1 - copia.jpg", { md5: "igual" }));

    expect(unico(catalogo, "LN25").fotos).toHaveLength(1);
  });

  it("los .IA no son fotos del producto", () => {
    const catalogo = conFotos(foto("LN25.IA.jpg"), foto("LN25.IA-1.jpg"), foto("LN25.jpg"));

    expect(unico(catalogo, "LN25").fotos.map(({ nombre }) => nombre)).toEqual(["LN25.jpg"]);
    expect(catalogo.fotosIa).toBe(2);
    expect(catalogo.fotosSueltas).toEqual([]);
  });

  it("un video se cuenta aparte", () => {
    const catalogo = conFotos(foto("LN25.mp4", { mimeType: "video/mp4" }));

    expect(unico(catalogo, "LN25").fotos).toEqual([]);
    expect(catalogo.videos).toBe(1);
  });

  it("MSU2-1 es la principal de la variante, no la foto 1 de MSU2", () => {
    const catalogo = armar(
      [],
      [item("MSU2", "MEDIAS"), item("MSU2-1", "MEDIAS")],
      [foto("MSU2-1.jpg"), foto("MSU2-1-3.jpg")],
    );

    expect(unico(catalogo, "MSU2-1").fotos).toHaveLength(2);
    expect(unico(catalogo, "MSU2").fotos).toEqual([]);
  });

  it("sin variante, -1 es el número de foto", () => {
    expect(unico(armar([], [item("MSU2", "MEDIAS")], [foto("MSU2-1.jpg")]), "MSU2").fotos).toHaveLength(1);
  });

  it("una foto de un código que no existe queda suelta", () => {
    const catalogo = conFotos(foto("CJSTN62-1.jpg"));

    expect(catalogo.fotosSueltas).toEqual([{ driveId: "id-CJSTN62-1.jpg", nombre: "CJSTN62-1.jpg", raiz: "CJSTN62" }]);
  });

  it("una decisión asigna una foto suelta a un producto, y sobrevive a la importación", () => {
    const suelta = foto("CJSTN62-1.jpg");

    const catalogo = armarCatalogo({
      filas: [fila("LN25")],
      items: [],
      archivos: [suelta],
      decisiones: { fotos: new Map([[suelta.driveId, "LN25"]]) },
    });

    expect(catalogo.fotosSueltas).toEqual([]);
    expect(unico(catalogo, "LN25").fotos).toHaveLength(1);
  });

  it("una decisión descarta una foto", () => {
    const suelta = foto("CJSTN62-1.jpg");

    const catalogo = armarCatalogo({
      filas: [],
      items: [],
      archivos: [suelta],
      decisiones: { fotos: new Map([[suelta.driveId, null]]) },
    });

    expect(catalogo.fotosSueltas).toEqual([]);
  });

  it("si el producto de una decisión ya no existe, la foto vuelve a quedar suelta", () => {
    const suelta = foto("CJSTN62-1.jpg");

    const catalogo = armarCatalogo({
      filas: [],
      items: [],
      archivos: [suelta],
      decisiones: { fotos: new Map([[suelta.driveId, "NOEXISTE1"]]) },
    });

    expect(catalogo.fotosSueltas).toHaveLength(1);
  });

  it("dice si DUX tiene foto, para cuando Drive no tenga", () => {
    expect(unico(armar([], [item("LN1", "LESS", { tieneFoto: true })]), "LN1").tieneFotoEnDux).toBe(true);
  });
});
