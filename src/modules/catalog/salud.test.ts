import { describe, expect, it } from "vitest";
import type { ProductoArmado } from "./armar";
import { leerDato } from "./armar";
import { codigoDelBulto, evaluarCatalogo, type CodigoDelEspejo, type VentaDelProducto } from "./salud";

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
    filaDelSheet: 2,
    skuDeVenta: null,
    enDuxDice: { rubro: null, subrubro: null, marca: null, proveedor: null },
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

const conPrecio = (codigo: string, cambios: Partial<CodigoDelEspejo> = {}): [string, CodigoDelEspejo][] => [
  [codigo, { stock: 0, precioCentavos: 0, costoCentavos: 500_000, ...cambios }],
  [`${codigo}-6`, { stock: 0, precioCentavos: 1_000_000, costoCentavos: 3_000_000 }],
];

function evaluar(
  p: ProductoArmado,
  { venta, espejo }: { venta?: VentaDelProducto; espejo?: Partial<CodigoDelEspejo> } = {},
) {
  const evaluacion = evaluarCatalogo({
    productos: [p],
    ventas: new Map(venta ? [[p.codigo, venta]] : []),
    espejo: new Map(conPrecio(p.codigo, espejo)),
    hoy: HOY,
  }).get(p.codigo);
  if (!evaluacion) throw new Error("Sin evaluación");
  return evaluacion;
}

const vendio = (ultimaVenta: string, centavos90 = 0): VentaDelProducto => ({ ultimaVenta, centavos90 });

describe("el estado del producto", () => {
  it.each([
    ["vendió en los últimos 90 días", {}, { venta: vendio("2026-10-01", 100) }, "activo"],
    ["tiene stock", {}, { espejo: { stock: 6 } }, "activo"],
    ["es nuevo: se creó hace menos de 90 días", { creadoEl: "2026-09-01" }, {}, "activo"],
    ["no está en DUX: todavía no se puede decir", { enDux: false, creadoEl: null }, {}, "activo"],
    ["sin stock, vendió hace 2 meses", {}, { venta: vendio("2026-09-01") }, "agotado"],
    ["sin stock, vendió justo en el mes del corte", {}, { venta: vendio("2026-05-01") }, "agotado"],
    ["sin stock, vendió el mes anterior al corte", {}, { venta: vendio("2026-04-30") }, "historico"],
    ["sin stock, sin ventas en el año", {}, {}, "historico"],
    ["el stock negativo no es stock", {}, { espejo: { stock: -3 } }, "historico"],
  ] as const)("%s", (_, cambios, datos, esperado) => {
    expect(evaluar(producto("LN1", cambios), datos).estado).toBe(esperado);
  });

  it("creado justo hace 90 días todavía es nuevo", () => {
    expect(evaluar(producto("LN1", { creadoEl: "2026-08-06" })).estado).toBe("activo");
    expect(evaluar(producto("LN1", { creadoEl: "2026-08-05" })).estado).toBe("historico");
  });

  it.each(["MALLAS", "INVIERNO", "PIJAMA"])("%s vendida hace un año no es histórico: vuelve sola", (rubro) => {
    const evaluacion = evaluar(producto("LN1", { rubro }), { venta: vendio("2025-12-01") });

    expect(evaluacion).toMatchObject({ estado: "agotado", deTemporada: true });
  });

  it("una malla sin ventas en el año sí es histórico", () => {
    expect(evaluar(producto("LN1", { rubro: "MALLAS" }))).toMatchObject({ estado: "historico", deTemporada: true });
  });

  it("una malla con stock es activa, y sigue siendo de temporada", () => {
    expect(evaluar(producto("LN1", { rubro: "MALLAS" }), { espejo: { stock: 12 } })).toMatchObject({
      estado: "activo",
      deTemporada: true,
    });
  });

  it("lo que no es de temporada no vuelve solo", () => {
    expect(evaluar(producto("LN1"), { venta: vendio("2025-12-01") })).toMatchObject({
      estado: "historico",
      deTemporada: false,
    });
  });

  it("un combo mira su propio stock", () => {
    const combo = producto("COMBO7", {
      esCombo: true,
      rubro: "COMBOS",
      presentaciones: [{ codigo: "COMBO7", tipo: "combo", cantidad: null, enDux: true }],
    });

    expect(evaluar(combo, { espejo: { stock: 5 } }).estado).toBe("activo");
    expect(evaluar(combo).estado).toBe("historico");
  });

  it("sin prenda, el stock sale de sus packs", () => {
    const soloPacks = producto("LN1", {
      presentaciones: [{ codigo: "LN1-6", tipo: "pack", cantidad: 6, enDux: true }],
    });
    const estado = (stock: number) =>
      evaluarCatalogo({
        productos: [soloPacks],
        ventas: new Map(),
        espejo: new Map([["LN1-6", { stock, precioCentavos: 1, costoCentavos: 1 }]]),
        hoy: HOY,
      }).get("LN1")?.estado;

    expect(estado(1)).toBe("activo");
    expect(estado(0)).toBe("historico");
  });
});

describe("la prioridad", () => {
  const productos = ["LN1", "LN2", "LN3", "LN4", "LN5"].map((codigo) => producto(codigo));
  const conVentas = (montos: Record<string, number>) =>
    evaluarCatalogo({
      productos,
      ventas: new Map(Object.entries(montos).map(([codigo, monto]) => [codigo, vendio("2026-10-01", monto)])),
      espejo: new Map(),
      hoy: HOY,
    });

  it("A hasta cubrir el 80 % de la venta, B lo demás que vendió y C el resto", () => {
    const evaluacion = conVentas({ LN1: 300, LN2: 500, LN3: 100, LN4: 100 });

    expect(["LN1", "LN2", "LN3", "LN4", "LN5"].map((codigo) => evaluacion.get(codigo)?.prioridad)).toEqual([
      "A",
      "A",
      "B",
      "B",
      "C",
    ]);
  });

  it("el producto que cruza el 80 % también es A", () => {
    expect(conVentas({ LN1: 700, LN2: 200, LN3: 100 }).get("LN2")?.prioridad).toBe("A");
  });

  it("el puesto es por ventas, y sin ventas no hay puesto", () => {
    const evaluacion = conVentas({ LN1: 300, LN2: 500 });

    expect(evaluacion.get("LN2")?.ranking).toBe(1);
    expect(evaluacion.get("LN1")?.ranking).toBe(2);
    expect(evaluacion.get("LN3")?.ranking).toBeNull();
  });

  it("un empate se ordena por código", () => {
    const evaluacion = conVentas({ LN2: 100, LN1: 100 });

    expect(evaluacion.get("LN1")?.ranking).toBe(1);
    expect(evaluacion.get("LN2")?.ranking).toBe(2);
  });

  it("sin ventas, todos son C", () => {
    expect(conVentas({}).get("LN1")?.prioridad).toBe("C");
  });

  it("una venta del año que no entra en los 90 días no da prioridad, pero queda su fecha", () => {
    expect(conVentas({ LN1: 0 }).get("LN1")).toMatchObject({
      prioridad: "C",
      ranking: null,
      ultimaVenta: "2026-10-01",
    });
  });
});

describe("el bulto", () => {
  const packs = (codigo: string, ...cantidades: number[]) => [
    { codigo, tipo: "prenda" as const, cantidad: null, enDux: true },
    ...cantidades.map((cantidad) => ({
      codigo: `${codigo}-${cantidad}`,
      tipo: "pack" as const,
      cantidad,
      enDux: true,
    })),
  ];

  it.each([
    ["en lencería, el -6", "LESS", [3, 6, 12], "LN1-6"],
    ["en medias, el -12", "MEDIAS", [3, 6, 12, 24], "LN1-12"],
    ["en medias deportivas, el -12", "MEDIAS DEPORTIVAS", [6, 12], "LN1-12"],
    ["un -12 de lencería no reemplaza al -6", "LESS", [12], null],
    ["medias sin docena no tienen bulto", "MEDIAS", [6], null],
  ])("%s", (_, rubro, cantidades, esperado) => {
    expect(codigoDelBulto(producto("LN1", { rubro, presentaciones: packs("LN1", ...cantidades) }))).toBe(esperado);
  });

  it("un combo es su propio bulto", () => {
    const presentaciones = [{ codigo: "COMBO7", tipo: "combo" as const, cantidad: null, enDux: true }];

    expect(codigoDelBulto(producto("COMBO7", { esCombo: true, presentaciones }))).toBe("COMBO7");
  });

  it("sku_venta manda sobre el rubro", () => {
    expect(codigoDelBulto(producto("LN1", { skuDeVenta: "LN1-12", presentaciones: packs("LN1", 6, 12) }))).toBe(
      "LN1-12",
    );
  });
});

describe("lo que le falta", () => {
  const faltantes = (p: ProductoArmado, espejo: Partial<CodigoDelEspejo> = {}) => evaluar(p, { espejo }).faltantes;

  it("un producto completo está listo y no le falta nada", () => {
    expect(evaluar(producto("LN1"))).toMatchObject({ faltantes: [], listoParaVender: true });
  });

  it("sin precio en el bulto, no se puede vender", () => {
    const p = producto("LN1");
    const evaluacion = evaluarCatalogo({
      productos: [p],
      ventas: new Map(),
      espejo: new Map([
        ["LN1", { stock: 0, precioCentavos: 900_000, costoCentavos: 1 }],
        ["LN1-6", { stock: 0, precioCentavos: 0, costoCentavos: 1 }],
      ]),
      hoy: HOY,
    }).get("LN1");

    expect(evaluacion).toMatchObject({ faltantes: [{ dato: "precio", situacion: "falta" }], listoParaVender: false });
  });

  it("sin costo, sin envío y sin foto, tampoco", () => {
    const p = producto("LN1", { problemasDeEnvio: ["sin peso"], fotos: [] });

    expect(evaluar(p, { espejo: { costoCentavos: 0 } })).toMatchObject({
      faltantes: [
        { dato: "costo", situacion: "falta" },
        { dato: "envio", situacion: "falta" },
        { dato: "foto", situacion: "falta" },
      ],
      listoParaVender: false,
    });
  });

  it("la foto de DUX alcanza para vender", () => {
    expect(faltantes(producto("LN1", { fotos: [], tieneFotoEnDux: true }))).toEqual([]);
  });

  it("tela, marca y proveedor son deseables: faltan, pero no bloquean", () => {
    const p = producto("LN1", { tela: leerDato(""), marca: leerDato(""), proveedor: leerDato("") });

    expect(evaluar(p)).toMatchObject({
      faltantes: [
        { dato: "tela", situacion: "falta" },
        { dato: "marca", situacion: "falta" },
        { dato: "proveedor", situacion: "falta" },
      ],
      listoParaVender: true,
    });
  });

  it("NO HAY DATO se distingue de lo que falta cargar", () => {
    expect(faltantes(producto("LN1", { tela: leerDato("NO HAY DATO") }))).toEqual([
      { dato: "tela", situacion: "no_hay_dato" },
    ]);
  });

  it("NO APLICA y VARIAS no son faltantes", () => {
    expect(faltantes(producto("LN1", { marca: leerDato("NO APLICA"), tela: leerDato("NO APLICA") }))).toEqual([]);
    expect(faltantes(producto("LN1", { marca: leerDato("VARIAS") }))).toEqual([]);
  });

  it("un combo no tiene tela, marca ni proveedor propios", () => {
    const combo = producto("COMBO7", {
      esCombo: true,
      rubro: "COMBOS",
      tela: leerDato(""),
      marca: leerDato(""),
      proveedor: leerDato(""),
      presentaciones: [{ codigo: "COMBO7", tipo: "combo", cantidad: null, enDux: true }],
    });
    const evaluacion = evaluarCatalogo({
      productos: [combo],
      ventas: new Map(),
      espejo: new Map([["COMBO7", { stock: 0, precioCentavos: 100, costoCentavos: 50 }]]),
      hoy: HOY,
    }).get("COMBO7");

    expect(evaluacion?.faltantes).toEqual([]);
  });

  it("solo en DUX: falta la fila del Sheet, y sin envío no se vende", () => {
    const soloDux = producto("LN1", {
      enSheet: false,
      filaDelSheet: null,
      problemasDeEnvio: ["no está en el Sheet"],
      tela: leerDato(""),
      marca: leerDato(""),
      proveedor: leerDato(""),
    });

    expect(evaluar(soloDux)).toMatchObject({
      faltantes: [
        { dato: "envio", situacion: "falta" },
        { dato: "sheet", situacion: "falta" },
      ],
      listoParaVender: false,
    });
  });
});
