import { describe, expect, it } from "vitest";
import { armarCatalogo, leerDato, type CatalogoArmado, type ProductoArmado } from "./armar";
import { BLOQUES, casosDeRevision, distancia, esLaMismaMarca, type BloqueDeRevision } from "./revision";
import { evaluarCatalogo, type CodigoDelEspejo, type EvaluacionDelProducto } from "./salud";

const HOY = "2026-11-04";

function producto(codigo: string, cambios: Partial<ProductoArmado> = {}): ProductoArmado {
  return {
    codigo,
    nombre: `Producto ${codigo}`,
    esCombo: false,
    rubro: "LESS",
    subrubro: null,
    marca: leerDato("Linda Luna"),
    proveedor: leerDato("BETHY"),
    tela: leerDato("ALGODON"),
    colores: null,
    talles: null,
    atributos: {},
    largoCm: 25,
    anchoCm: 15,
    altoCm: 10,
    pesoKg: 0.25,
    problemasDeEnvio: [],
    enSheet: true,
    enDux: true,
    filaDelSheet: 57,
    skuDeVenta: null,
    enDuxDice: { rubro: "LESS", subrubro: null, marca: "LINDA LUNA", proveedor: "BETHY" },
    tieneFotoEnDux: false,
    creadoEl: "2025-01-15",
    presentaciones: [
      { codigo, tipo: "prenda", cantidad: null, enDux: true },
      { codigo: `${codigo}-6`, tipo: "pack", cantidad: 6, enDux: true },
    ],
    fotos: [{ driveId: "a", nombre: `${codigo}.jpg`, posicion: 0, ancho: null, alto: null }],
    ...cambios,
  };
}

const VACIO: Omit<CatalogoArmado, "productos"> = {
  filasBorradas: [],
  filasConPackViejo: [],
  filasSinCodigo: [],
  codigosRepetidos: [],
  fotosSueltas: [],
  videos: 0,
  fotosIa: 0,
};

const espejoDe = (codigo: string, bulto: Partial<CodigoDelEspejo> = {}, prenda: Partial<CodigoDelEspejo> = {}) =>
  new Map<string, CodigoDelEspejo>([
    [codigo, { stock: 12, precioCentavos: 0, costoCentavos: 500_000, ...prenda }],
    [`${codigo}-6`, { stock: 2, precioCentavos: 1_000_000, costoCentavos: 300_000, ...bulto }],
  ]);

function casos(
  p: ProductoArmado,
  {
    espejo = espejoDe(p.codigo),
    armado = {},
    historicosDecididos = new Set<string>(),
  }: {
    espejo?: Map<string, CodigoDelEspejo>;
    armado?: Partial<CatalogoArmado>;
    historicosDecididos?: Set<string>;
  } = {},
) {
  const evaluaciones: Map<string, EvaluacionDelProducto> = evaluarCatalogo({
    productos: [p],
    ventas: new Map(),
    espejo,
    hoy: HOY,
  });
  return casosDeRevision({
    armado: { ...VACIO, productos: [p], ...armado },
    evaluaciones,
    espejo,
    historicosDecididos,
  });
}

const bloques = (lista: { block: BloqueDeRevision }[]) => lista.map(({ block }) => block);

describe("un producto activo completo", () => {
  it("no tiene nada para revisar", () => {
    expect(casos(producto("LN1"))).toEqual([]);
  });
});

describe("lo que se corrige en el Sheet", () => {
  it("activo sin fila", () => {
    const [caso] = casos(
      producto("LN1", {
        enSheet: false,
        filaDelSheet: null,
        problemasDeEnvio: ["no está en el Sheet"],
        tela: leerDato(""),
        marca: leerDato(""),
        proveedor: leerDato(""),
      }),
    );

    expect(caso).toMatchObject({ block: "sin_fila", key: "LN1", baseCode: "LN1", fixIn: "sheet", sheetRow: null });
  });

  it("peso y medidas: dice cuáles, y en qué fila", () => {
    const [caso] = casos(producto("LN1", { problemasDeEnvio: ["sin peso", "alto imposible: 300"] }));

    expect(caso).toMatchObject({
      block: "envio",
      description: "Sin peso y alto imposible: 300.",
      fixIn: "sheet",
      sheetRow: 57,
    });
  });

  it("rubro distinto", () => {
    const lista = casos(
      producto("LN1", { enDuxDice: { rubro: "CORPIÑOS", subrubro: null, marca: "LINDA LUNA", proveedor: "BETHY" } }),
    );

    expect(lista).toMatchObject([{ block: "rubro_distinto", description: "El Sheet dice LESS y DUX, CORPIÑOS." }]);
  });

  it("marca distinta, pero no otra escritura", () => {
    const conMarcaEnDux = (marca: string) =>
      casos(producto("LN1", { enDuxDice: { rubro: "LESS", subrubro: null, marca, proveedor: "BETHY" } }));

    expect(bloques(conMarcaEnDux("LE VICTORIA S"))).toEqual(["marca_distinta"]);
    expect(conMarcaEnDux("LINDA LUNA")).toEqual([]);
    expect(conMarcaEnDux("LINDALUNA")).toEqual([]);
  });

  it("un proveedor distinto nunca es un caso: un producto puede venir de varios (RN-128)", () => {
    expect(
      casos(producto("LN1", { enDuxDice: { rubro: "LESS", subrubro: null, marca: "LINDA LUNA", proveedor: "OTRO" } })),
    ).toEqual([]);
  });

  it("los nombres no se comparan", () => {
    expect(casos(producto("LN1", { nombre: "Cualquier otro nombre" }))).toEqual([]);
  });

  it("lo que falta se junta en un caso por producto, y propone lo de DUX", () => {
    const lista = casos(
      producto("LN1", {
        tela: leerDato(""),
        marca: leerDato(""),
        proveedor: leerDato(""),
        enDuxDice: { rubro: "LESS", subrubro: null, marca: "BEATRIZ", proveedor: "BETHY" },
      }),
    );

    expect(lista).toMatchObject([
      {
        block: "atributos",
        description: "Falta tela, marca y proveedor. DUX dice: marca BEATRIZ y proveedor BETHY.",
      },
    ]);
  });

  it("una marca de relleno en DUX no se propone", () => {
    const [caso] = casos(
      producto("LN1", {
        marca: leerDato(""),
        enDuxDice: { rubro: "LESS", subrubro: null, marca: "SIN MARCA", proveedor: "BETHY" },
      }),
    );

    expect(caso?.description).toBe("Falta marca.");
  });

  it("NO HAY DATO y NO APLICA no son casos: la lista se puede vaciar (RN-124)", () => {
    expect(casos(producto("LN1", { tela: leerDato("NO HAY DATO"), marca: leerDato("NO APLICA") }))).toEqual([]);
  });

  it("los combos no piden tela, marca ni proveedor", () => {
    const combo = producto("COMBO7", {
      esCombo: true,
      rubro: "COMBOS",
      tela: leerDato(""),
      marca: leerDato(""),
      proveedor: leerDato(""),
      enDuxDice: { rubro: "COMBOS", subrubro: null, marca: null, proveedor: null },
      presentaciones: [{ codigo: "COMBO7", tipo: "combo", cantidad: null, enDux: true }],
    });

    expect(
      casos(combo, {
        espejo: new Map([["COMBO7", { stock: 5, precioCentavos: 100, costoCentavos: 50 }]]),
      }),
    ).toEqual([]);
  });
});

describe("lo que se corrige en DUX", () => {
  it("sin costo", () => {
    expect(casos(producto("LN1"), { espejo: espejoDe("LN1", {}, { costoCentavos: 0 }) })).toMatchObject([
      { block: "precio_costo", description: "No tiene costo.", fixIn: "dux" },
    ]);
  });

  it("sin precio en el bulto", () => {
    expect(casos(producto("LN1"), { espejo: espejoDe("LN1", { precioCentavos: 0 }) })).toMatchObject([
      { block: "precio_costo", description: "LN1-6 no tiene precio mayorista." },
    ]);
  });

  it("un costo que no es menor que el precio, como MTNU3, sin mostrar los montos", () => {
    const [caso] = casos(producto("LN1"), { espejo: espejoDe("LN1", { costoCentavos: 13_200_000 }) });

    expect(caso).toMatchObject({ block: "precio_costo", description: "El costo de LN1-6 no es menor que su precio." });
  });

  it("COMBO1 tiene poco margen a propósito (RN-122)", () => {
    const combo = producto("COMBO1", {
      esCombo: true,
      rubro: "COMBOS",
      enDuxDice: { rubro: "COMBOS", subrubro: null, marca: null, proveedor: null },
      presentaciones: [{ codigo: "COMBO1", tipo: "combo", cantidad: null, enDux: true }],
    });

    expect(
      casos(combo, {
        espejo: new Map([["COMBO1", { stock: 5, precioCentavos: 100, costoCentavos: 200 }]]),
      }),
    ).toEqual([]);
  });

  it("sin el bulto de su rubro", () => {
    const sinBulto = producto("LN1", {
      presentaciones: [
        { codigo: "LN1", tipo: "prenda", cantidad: null, enDux: true },
        { codigo: "LN1-12", tipo: "pack", cantidad: 12, enDux: true },
      ],
    });

    const lista = casos(sinBulto, {
      espejo: new Map([["LN1", { stock: 12, precioCentavos: 0, costoCentavos: 500_000 }]]),
    });

    expect(lista).toMatchObject([{ block: "precio_costo", description: "No tiene el bulto de su rubro en DUX." }]);
  });
});

describe("lo que se corrige en Drive", () => {
  it("sin ninguna foto", () => {
    expect(casos(producto("LN1", { fotos: [] }))).toMatchObject([{ block: "sin_foto", fixIn: "drive" }]);
  });

  it("solo con la de DUX, que no frena la venta", () => {
    expect(casos(producto("LN1", { fotos: [], tieneFotoEnDux: true }))).toMatchObject([
      { block: "foto_solo_dux", fixIn: "drive" },
    ]);
  });
});

describe("los códigos que no cierran", () => {
  const conFilas = (armado: Partial<CatalogoArmado>) => casos(producto("LN1"), { armado });

  it("repetidos, packs viejos y filas sin SKU, cada uno con su llave", () => {
    expect(
      conFilas({
        codigosRepetidos: [{ codigo: "VG35", filas: [12, 40] }],
        filasConPackViejo: [{ fila: 947, codigo: "HB2-1DOCENA" }],
        filasSinCodigo: [1090],
      }),
    ).toMatchObject([
      {
        block: "codigos",
        key: "repetido:VG35",
        sheetRow: 12,
        description: "VG35 está en las filas 12 y 40.",
        fixIn: "sheet",
      },
      { block: "codigos", key: "pack_viejo:947", sheetRow: 947 },
      { block: "codigos", key: "sin_codigo:1090", sheetRow: 1090 },
    ]);
  });
});

describe("las fotos sueltas", () => {
  const CATALOGO = armarCatalogo({
    filas: [],
    items: [],
    archivos: [],
  });

  it("se deciden en la app, y sugieren el código a una letra de distancia", () => {
    const lista = casos(producto("CJATN60"), {
      armado: {
        ...CATALOGO,
        productos: [producto("CJATN60")],
        fotosSueltas: [{ driveId: "abc", nombre: "CJSTN60-1.jpg", raiz: "CJSTN60" }],
      },
    });

    expect(lista).toMatchObject([
      {
        block: "fotos_sueltas",
        key: "abc",
        baseCode: null,
        fixIn: "app",
        details: { nombre: "CJSTN60-1.jpg", sugerencias: ["CJATN60"] },
      },
    ]);
  });

  it("si hay varios códigos parecidos, es una duda: no sugiere ninguno", () => {
    const productos = [producto("CAJ1"), producto("CAJ2")];
    const espejo = new Map([...espejoDe("CAJ1"), ...espejoDe("CAJ2")]);

    const [caso] = casosDeRevision({
      armado: { ...VACIO, productos, fotosSueltas: [{ driveId: "abc", nombre: "CAJ7.jpg", raiz: "CAJ7" }] },
      evaluaciones: evaluarCatalogo({ productos, ventas: new Map(), espejo, hoy: HOY }),
      espejo,
      historicosDecididos: new Set(),
    });

    expect(caso?.details.sugerencias).toEqual([]);
  });

  it("un nombre que no se parece a nada no sugiere nada", () => {
    const [caso] = casos(producto("LN1"), {
      armado: { fotosSueltas: [{ driveId: "abc", nombre: "IMG_0702.JPG", raiz: "IMG_0702" }] },
    });

    expect(caso?.details.sugerencias).toEqual([]);
  });
});

describe("los históricos y los agotados", () => {
  const sinStock = (codigo = "LN1") => espejoDe(codigo, { stock: 0 }, { stock: 0 });

  it("un histórico sin decidir queda para confirmar, y nada más: sale del resto de la revisión", () => {
    const lista = casos(producto("LN1", { fotos: [], tela: leerDato("") }), { espejo: sinStock() });

    expect(lista).toMatchObject([
      { block: "historicos", key: "LN1", fixIn: "app", description: "Sin stock y sin ventas en el último año." },
    ]);
  });

  it("una vez decidido, no vuelve", () => {
    expect(casos(producto("LN1"), { espejo: sinStock(), historicosDecididos: new Set(["LN1"]) })).toEqual([]);
  });

  it("dice cuándo se vendió por última vez", () => {
    const p = producto("LN1");
    const espejo = sinStock();
    const evaluaciones = evaluarCatalogo({
      productos: [p],
      ventas: new Map([["LN1", { centavos90: 0, ultimaVenta: "2026-03-12" }]]),
      espejo,
      hoy: HOY,
    });

    const [caso] = casosDeRevision({
      armado: { ...VACIO, productos: [p] },
      evaluaciones,
      espejo,
      historicosDecididos: new Set(),
    });

    expect(caso?.description).toBe("Sin stock. Última venta: 12/03/2026.");
  });

  it("a un agotado no se le pide nada: entra cuando vuelve a tener stock", () => {
    const p = producto("LN1", { fotos: [], tela: leerDato("") });
    const espejo = sinStock();
    const evaluaciones = evaluarCatalogo({
      productos: [p],
      ventas: new Map([["LN1", { centavos90: 0, ultimaVenta: "2026-09-01" }]]),
      espejo,
      hoy: HOY,
    });

    expect(evaluaciones.get("LN1")?.estado).toBe("agotado");
    expect(
      casosDeRevision({
        armado: { ...VACIO, productos: [p] },
        evaluaciones,
        espejo,
        historicosDecididos: new Set(),
      }),
    ).toEqual([]);
  });
});

describe("la prioridad", () => {
  it("cada caso lleva la prioridad y el puesto de su producto, para ordenar por ventas", () => {
    const p = producto("LN1", { problemasDeEnvio: ["sin peso"] });
    const espejo = espejoDe("LN1");
    const evaluaciones = evaluarCatalogo({
      productos: [p],
      ventas: new Map([["LN1", { centavos90: 100, ultimaVenta: "2026-10-01" }]]),
      espejo,
      hoy: HOY,
    });

    expect(
      casosDeRevision({
        armado: { ...VACIO, productos: [p] },
        evaluaciones,
        espejo,
        historicosDecididos: new Set(),
      }),
    ).toMatchObject([{ priority: "A", salesRank: 1 }]);
  });
});

describe("esLaMismaMarca", () => {
  it.each([
    ["Dlirio", "DELIRIO"],
    ["WOVISINI", "WOVISNI"],
    ["Le victoria", "LE VICTORIA S"],
    ["Victoria Secret", "VICTORIA S SECRET"],
    ["Tommy Hilfiger", "TOMMY"],
    ["SÓCKMARK", "sockmark"],
  ])("%s y %s, sí", (a, b) => {
    expect(esLaMismaMarca(a, b)).toBe(true);
  });

  it.each([
    ["Linda Luna", "LE VICTORIA S"],
    ["Condeza", "Dlirio"],
  ])("%s y %s, no", (a, b) => {
    expect(esLaMismaMarca(a, b)).toBe(false);
  });
});

describe("distancia", () => {
  it.each([
    ["CJSTN60", "CJATN60", 1],
    ["LN25", "LN25", 0],
    ["AB", "BA", 1],
    ["", "AB", 2],
  ])("%s y %s: %i", (a, b, esperado) => {
    expect(distancia(a, b)).toBe(esperado);
  });
});

describe("BLOQUES", () => {
  it("no repite identificadores", () => {
    expect(new Set(BLOQUES.map(({ id }) => id)).size).toBe(BLOQUES.length);
  });
});
