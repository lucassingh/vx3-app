import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { ExternalServiceError } from "@/lib/errors";
import type { ErpComprobante, ErpLinea } from "@/modules/inventory/erp-gateway";
import { VENTA_VALIDA } from "@/modules/inventory/ventas";
import { leerVentasDux, traerHistorialDeVentasDux } from "./dux-ventas";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
type Pedido = { sucursal: number; desde: string; hasta: string; offset: number };
const erp = vi.hoisted(() => ({
  responder: (async () => ({ comprobantes: [], total: 0, hayMas: false })) as (pedido: Pedido) => Promise<unknown>,
  pedidos: [] as Pedido[],
  armar: (() => undefined) as () => void,
  sucursales: (() => [1, 2]) as () => number[],
}));

vi.mock("@/integrations/dux", () => ({
  POR_PAGINA_DUX: 50,
  sucursalesDux: () => erp.sucursales(),
  erpGateway: async ({ alIntentar }: { alIntentar?: () => void } = {}) => {
    erp.armar();
    return {
      listarComprobantes: async (pedido: Pedido) => {
        erp.pedidos.push(pedido);
        alIntentar?.();
        return erp.responder(pedido);
      },
    };
  },
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;

const linea = (cambios: Partial<ErpLinea> = {}): ErpLinea => ({
  codigo: "HB2-6",
  nombre: "BOXER - MEDIA DOCENA",
  cantidad: 2,
  precioCentavos: 1_300_000,
  descuentoPct: 0,
  ivaPct: 0,
  costoCentavos: 990_000,
  ...cambios,
});

const comprobante = (id: number, cambios: Partial<ErpComprobante> = {}): ErpComprobante => ({
  id,
  sucursal: 1,
  tipo: "COMPROBANTE_VENTA",
  letra: "X",
  puntoDeVenta: "2",
  numero: id,
  fecha: "2026-11-03",
  clienteId: 501,
  pedido: null,
  totalCentavos: 2_600_000,
  anulado: false,
  lineas: [linea()],
  ...cambios,
});

/** Lo mismo para cualquier pedido de la sucursal 1; la 2 no vendió nada. */
function responderCon(...comprobantes: ErpComprobante[]) {
  erp.responder = async ({ sucursal }) => {
    const propios = sucursal === 1 ? comprobantes : [];
    return { comprobantes: propios, total: propios.length, hayMas: false };
  };
}

const factura = (duxId: number) =>
  db.duxInvoice.findUniqueOrThrow({ where: { duxId }, include: { items: { orderBy: { line: "asc" } } } });
const ultimaCorrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

beforeEach(async () => {
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
  erp.pedidos = [];
  erp.armar = () => undefined;
  erp.sucursales = () => [1, 2];
});

afterAll(async () => {
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
  await db.$disconnect();
});

describe("lectura normal de ventas", () => {
  it("lee las dos sucursales, los últimos 35 días, y registra la corrida", async () => {
    responderCon(comprobante(1));

    expect(await leerVentasDux(ORIGEN)).toEqual({ status: "ok" });

    expect(erp.pedidos.map(({ sucursal }) => sucursal)).toEqual([1, 2]);
    const { desde, hasta } = erp.pedidos[0]!;
    expect((Date.parse(hasta) - Date.parse(desde)) / 86_400_000).toBe(35);
    expect(await ultimaCorrida()).toMatchObject({
      operation: "ventas",
      status: "ok",
      calls: 2,
      records: 1,
      detail: "Comprobantes leídos: 1. Nuevos: 1. Cambiados: 0.",
    });
  });

  it("guarda el comprobante y sus líneas, con los montos en centavos", async () => {
    responderCon(
      comprobante(1, {
        lineas: [linea(), linea({ codigo: "ENVIO1", nombre: "ENVIO", precioCentavos: 430_050, costoCentavos: 0 })],
      }),
    );

    await leerVentasDux(ORIGEN);

    const guardado = await factura(1);
    expect(guardado).toMatchObject({ branchId: 1, totalCents: 2_600_000n, customerDuxId: 501, cancelled: false });
    expect(guardado.issuedOn.toISOString().slice(0, 10)).toBe("2026-11-03");
    expect(guardado.items).toHaveLength(2);
    expect(guardado.items[0]).toMatchObject({ line: 0, kind: "pack", baseCode: "HB2", packQuantity: 6 });
    expect(guardado.items[1]).toMatchObject({ line: 1, kind: "no_producto", unitPriceCents: 430_050n });
  });

  it("guarda anuladas y notas de crédito marcadas, y el filtro de venta válida las deja afuera", async () => {
    responderCon(
      comprobante(1),
      comprobante(2, { anulado: true }),
      comprobante(3, { tipo: "NOTA_CREDITO", lineas: [] }),
    );

    await leerVentasDux(ORIGEN);

    expect(await db.duxInvoice.count()).toBe(3);
    const validas = await db.duxInvoice.findMany({ where: VENTA_VALIDA, select: { duxId: true } });
    expect(validas.map(({ duxId }) => duxId)).toEqual([1]);
  });

  it("releer sin cambios no toca nada", async () => {
    responderCon(comprobante(1));
    await leerVentasDux(ORIGEN);
    const antes = await factura(1);

    await leerVentasDux(ORIGEN);

    const despues = await factura(1);
    expect(despues.changedAt).toEqual(antes.changedAt);
    expect(despues.items[0]!.id).toBe(antes.items[0]!.id);
    expect((await ultimaCorrida()).detail).toBe("Comprobantes leídos: 1. Nuevos: 0. Cambiados: 0.");
  });

  it("ve una anulación tardía, que es para lo que relee", async () => {
    responderCon(comprobante(1));
    await leerVentasDux(ORIGEN);

    responderCon(comprobante(1, { anulado: true }));
    await leerVentasDux(ORIGEN);

    expect(await factura(1)).toMatchObject({ cancelled: true });
    expect((await ultimaCorrida()).detail).toBe("Comprobantes leídos: 1. Nuevos: 0. Cambiados: 1.");
  });

  it("si cambian las líneas, las reemplaza sin duplicar", async () => {
    responderCon(comprobante(1, { lineas: [linea(), linea({ codigo: "HB2-12" })] }));
    await leerVentasDux(ORIGEN);

    responderCon(comprobante(1, { lineas: [linea({ codigo: "HB8-6" })] }));
    await leerVentasDux(ORIGEN);

    const { items } = await factura(1);
    expect(items.map(({ code }) => code)).toEqual(["HB8-6"]);
  });

  it("recorre las páginas de cada sucursal", async () => {
    erp.responder = async ({ offset }) => ({
      comprobantes: [comprobante(offset + 1)],
      total: 120,
      hayMas: offset < 100,
    });

    await leerVentasDux(ORIGEN);

    expect(erp.pedidos.map(({ sucursal, offset }) => `${sucursal}:${offset}`)).toEqual([
      "1:0",
      "1:50",
      "1:100",
      "2:0",
      "2:50",
      "2:100",
    ]);
  });

  it("si falla una página sigue con las demás y queda con errores", async () => {
    erp.responder = async ({ sucursal, offset }) => {
      if (sucursal === 1 && offset === 50) throw new ExternalServiceError("DUX", "DUX no respondió bien.");
      return { comprobantes: [comprobante(sucursal * 1000 + offset)], total: 120, hayMas: offset < 100 };
    };

    expect(await leerVentasDux(ORIGEN)).toEqual({ status: "con_errores" });

    expect(await db.duxInvoice.count()).toBe(5);
    expect(await ultimaCorrida()).toMatchObject({
      status: "con_errores",
      detail: expect.stringContaining("Comprobantes leídos: 5. Errores: 1."),
    });
  });

  it("si falla todo, queda en error y lo dice", async () => {
    erp.responder = async () => {
      throw new ExternalServiceError("DUX", "DUX rechazó el token: revisá que esté bien cargado.");
    };

    expect(await leerVentasDux(ORIGEN)).toEqual({ status: "error" });
    expect((await ultimaCorrida()).detail).toContain("rechazó el token");
  });
});

describe("lectura normal de ventas, sin poder arrancar", () => {
  it("sin token, queda en error y lo dice, sin pedirle nada a DUX", async () => {
    erp.armar = () => {
      throw new ExternalServiceError("DUX", "Todavía no se cargó el token de DUX.");
    };

    expect(await leerVentasDux(ORIGEN)).toEqual({ status: "error" });

    expect(erp.pedidos).toHaveLength(0);
    expect((await ultimaCorrida()).detail).toContain("Todavía no se cargó el token");
  });

  it("sin las sucursales en el ambiente, queda en error y lo dice", async () => {
    erp.sucursales = () => {
      throw new ExternalServiceError(
        "DUX",
        "Faltan DUX_ID_SUCURSAL_ECOMMERCE o DUX_ID_SUCURSAL_LOCAL en este ambiente.",
      );
    };

    expect(await leerVentasDux(ORIGEN)).toEqual({ status: "error" });

    expect(await ultimaCorrida()).toMatchObject({ status: "error", detail: expect.stringContaining("Faltan DUX_ID") });
  });
});

describe("cómo lee cada línea", () => {
  const leerLinea = async (fecha: string, cambios: Partial<ErpLinea>) => {
    responderCon(comprobante(1, { fecha, lineas: [linea(cambios)] }));
    await leerVentasDux(ORIGEN);
    return (await factura(1)).items[0]!;
  };

  it("antes del corte del 10/10, un código sin guion era el bulto: lo dice el nombre", async () => {
    expect(await leerLinea("2026-10-05", { codigo: "LN25", nombre: "LESS - MEDIA DOCENA" })).toMatchObject({
      kind: "prenda",
      baseCode: "LN25",
      packQuantity: 6,
    });
  });

  it("después del corte, un código sin guion es la prenda, aunque el nombre esté mal", async () => {
    expect(await leerLinea("2026-10-20", { codigo: "CJATN57", nombre: "CONJUNTO - MEDIA DOCENA" })).toMatchObject({
      kind: "prenda",
      packQuantity: null,
    });
  });

  it("el 10/10 todavía era el código viejo; desde el 11/10, la prenda", async () => {
    const bulto = { codigo: "LN25", nombre: "LESS - MEDIA DOCENA" };

    expect(await leerLinea("2026-10-10", bulto)).toMatchObject({ packQuantity: 6 });
    await db.duxInvoice.deleteMany();
    expect(await leerLinea("2026-10-11", bulto)).toMatchObject({ packQuantity: null });
  });

  it("un pack viejo vendido después del corte también se lee por su nombre", async () => {
    expect(await leerLinea("2026-10-20", { codigo: "MSM2-2DOCENAS", nombre: "SOQUETE - DOS DOCENAS" })).toMatchObject({
      kind: "pack_viejo",
      packQuantity: 24,
    });
  });

  it("lee los packs viejos, que ya no están en DUX, por su nombre", async () => {
    expect(await leerLinea("2026-10-08", { codigo: "MSM2-2DOCENAS", nombre: "SOQUETE - DOS DOCENAS" })).toMatchObject({
      kind: "pack_viejo",
      baseCode: "MSM2",
      packQuantity: 24,
    });
  });

  it("usa el rubro del espejo, por código normalizado: el -24 solo existe en medias", async () => {
    await db.duxItem.create({
      data: {
        id: newId(),
        code: "SOQ1-24",
        normalizedCode: "SOQ1-24",
        kind: "pack",
        baseCode: "SOQ1",
        name: "SOQUETE - DOS DOCENAS",
        category: "MEDIAS",
        costCents: 0n,
        prices: [],
        stockReal: 0,
        stockReserved: 0,
        stockAvailable: 0,
        enabled: true,
        createdOn: new Date(),
        contentHash: "x",
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        changedAt: new Date(),
      },
    });

    expect(await leerLinea("2026-11-01", { codigo: "soq1-24", nombre: "SOQUETE - DOS DOCENAS" })).toMatchObject({
      kind: "pack",
      baseCode: "SOQ1",
      packQuantity: 24,
    });
  });
});

describe("historial de ventas", () => {
  it("trae cada mes completo de cada sucursal", async () => {
    responderCon();

    expect(await traerHistorialDeVentasDux(ORIGEN, 2)).toEqual({ tramos: 4, fallidos: 0, leidos: 0 });

    expect(erp.pedidos).toHaveLength(4);
    expect(erp.pedidos[0]!.desde.endsWith("-01")).toBe(true);
    const corridas = await db.syncRun.findMany({ where: { operation: { startsWith: "ventas_historial:" } } });
    expect(corridas).toHaveLength(4);
    expect(corridas.every(({ status }) => status === "ok")).toBe(true);
  });

  it("volver a lanzarlo no repite lo que ya trajo", async () => {
    responderCon(comprobante(1));
    await traerHistorialDeVentasDux(ORIGEN, 2);
    erp.pedidos = [];

    expect(await traerHistorialDeVentasDux(ORIGEN, 2)).toEqual({ tramos: 0, fallidos: 0, leidos: 0 });

    expect(erp.pedidos).toHaveLength(0);
  });

  it("si se corta, retoma solo desde lo que faltó", async () => {
    let fallando = true;
    erp.responder = async ({ sucursal, desde }) => {
      if (fallando && sucursal === 2) throw new ExternalServiceError("DUX", "DUX no respondió bien.");
      return { comprobantes: [comprobante(Number(desde.replaceAll("-", "")) + sucursal)], total: 1, hayMas: false };
    };

    expect(await traerHistorialDeVentasDux(ORIGEN, 2)).toMatchObject({ tramos: 4, fallidos: 2 });
    expect(await db.duxInvoice.count()).toBe(2);

    fallando = false;
    erp.pedidos = [];
    expect(await traerHistorialDeVentasDux(ORIGEN, 2)).toEqual({ tramos: 2, fallidos: 0, leidos: 2 });

    expect(erp.pedidos.every(({ sucursal }) => sucursal === 2)).toBe(true);
    expect(await db.duxInvoice.count()).toBe(4);
  });
});
