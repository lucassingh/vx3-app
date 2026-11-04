import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { ExternalServiceError } from "@/lib/errors";
import type { ErpItem, PaginaDeItems } from "@/modules/inventory/erp-gateway";
import { barrerItemsDux } from "./dux-items";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
const paginas = vi.hoisted(() => ({
  responder: (async () => {
    throw new Error("Sin respuesta de prueba");
  }) as (offset: number) => Promise<unknown>,
  pedidas: [] as number[],
}));

vi.mock("@/integrations/dux", () => ({
  erpGateway: async ({ alIntentar }: { alIntentar?: () => void }) => ({
    listarItems: async (offset: number) => {
      paginas.pedidas.push(offset);
      alIntentar?.();
      return paginas.responder(offset);
    },
  }),
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;

function item(codigo: string, cambios: Partial<ErpItem> = {}): ErpItem {
  return {
    codigo,
    nombre: `Producto ${codigo}`,
    rubro: "LESS",
    subrubro: null,
    marca: null,
    proveedorId: null,
    proveedor: null,
    costoCentavos: 100_000,
    precios: [{ listaId: 71695, lista: "MAYORISTA EF/TR", centavos: 200_000 }],
    stockReal: 10,
    stockReservado: 0,
    stockDisponible: 10,
    habilitado: true,
    codigoExterno: null,
    imagenUrl: null,
    creadoEl: "2026-01-15",
    ...cambios,
  };
}

/** Las páginas de una corrida: cada una con sus items. */
function responderCon(...contenido: ErpItem[][]) {
  // Como en DUX: páginas de 50, aunque acá traigan menos, para que los offsets cierren con el total.
  const total = (contenido.length - 1) * 50 + (contenido.at(-1)?.length ?? 0);
  paginas.responder = async (offset) => {
    const indice = offset / 50;
    const pagina: PaginaDeItems = { items: contenido[indice] ?? [], total, hayMas: indice < contenido.length - 1 };
    return pagina;
  };
}

const fila = (code: string) => db.duxItem.findUniqueOrThrow({ where: { code } });
const ultimaCorrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

beforeEach(async () => {
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
  paginas.pedidas = [];
});

afterAll(async () => {
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
  await db.$disconnect();
});

describe("barrido de productos, stock y precios", () => {
  it("guarda lo que dice el ERP, con el código leído", async () => {
    responderCon([
      item("MSU2-1-12", { rubro: "MEDIAS" }),
      item("HB2-6", { rubro: "HOMBRE" }),
      item("COMBO1", { rubro: "COMBOS" }),
      item("ENVIO1", { rubro: "ENVIOS Y EMBALAJE" }),
      item("LN 25"),
    ]);

    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ status: "ok", leidos: 5, nuevos: 5 });

    expect(await fila("MSU2-1-12")).toMatchObject({ kind: "pack", baseCode: "MSU2-1", packQuantity: 12 });
    expect(await fila("HB2-6")).toMatchObject({ kind: "pack", baseCode: "HB2", packQuantity: 6 });
    expect(await fila("COMBO1")).toMatchObject({ kind: "combo", baseCode: "COMBO1", packQuantity: null });
    expect(await fila("ENVIO1")).toMatchObject({ kind: "no_producto" });
    expect(await fila("LN 25")).toMatchObject({ normalizedCode: "LN25", baseCode: "LN25", kind: "prenda" });
  });

  it("guarda precios en centavos y la fecha sin correrse de día", async () => {
    responderCon([item("HB2")]);
    await barrerItemsDux(ORIGEN);

    const { costCents, prices, createdOn } = await fila("HB2");
    expect(costCents).toBe(100_000n);
    expect(prices).toEqual([{ listId: 71695, list: "MAYORISTA EF/TR", cents: 200_000 }]);
    expect(createdOn.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("el stock de un pack conserva sus 8 decimales", async () => {
    responderCon([item("MTNU1-12", { rubro: "MEDIAS", stockReal: 46.58333333, stockDisponible: 46.58333333 })]);
    await barrerItemsDux(ORIGEN);

    expect((await fila("MTNU1-12")).stockReal.toFixed(8)).toBe("46.58333333");
  });

  it("recorre todas las páginas y registra la corrida", async () => {
    responderCon([item("A1"), item("A2")], [item("B1")], [item("C1")]);

    await barrerItemsDux(ORIGEN);

    expect(paginas.pedidas).toEqual([0, 50, 100]);
    expect(await ultimaCorrida()).toMatchObject({
      integration: "dux",
      operation: "items",
      status: "ok",
      trigger: "manual",
      triggeredBy: "Prueba",
      calls: 3,
      records: 4,
      detail: "4 items: 4 nuevos, 0 cambiados, 0 ya no aparecen.",
      finishedAt: expect.any(Date),
    });
  });

  it("repetirlo sin cambios en el ERP no duplica ni toca nada", async () => {
    responderCon([item("A1"), item("A2")]);
    await barrerItemsDux(ORIGEN);
    const antes = await fila("A1");

    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ status: "ok", leidos: 2, nuevos: 0, cambiados: 0 });

    const despues = await fila("A1");
    expect(await db.duxItem.count()).toBe(2);
    expect(despues.changedAt).toEqual(antes.changedAt);
    expect(despues.firstSeenAt).toEqual(antes.firstSeenAt);
    expect(despues.lastSeenAt.getTime()).toBeGreaterThan(antes.lastSeenAt.getTime());
  });

  it("si algo cambió, actualiza solo eso", async () => {
    responderCon([item("A1"), item("A2")]);
    await barrerItemsDux(ORIGEN);
    const quieto = await fila("A2");
    const antes = await fila("A1");

    responderCon([item("A1", { stockReal: 3, stockDisponible: 3 }), item("A2")]);
    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ cambiados: 1, nuevos: 0 });

    const despues = await fila("A1");
    expect(Number(despues.stockReal)).toBe(3);
    expect(despues.firstSeenAt).toEqual(antes.firstSeenAt);
    expect(despues.changedAt.getTime()).toBeGreaterThan(antes.changedAt.getTime());
    expect((await fila("A2")).changedAt).toEqual(quieto.changedAt);
  });

  it("lo que deja de aparecer se marca sin borrarse, y si vuelve se recupera", async () => {
    responderCon([item("A1"), item("A2")]);
    await barrerItemsDux(ORIGEN);
    const original = await fila("A2");

    responderCon([item("A1")]);
    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ ausentes: 1 });
    expect(await fila("A2")).toMatchObject({ present: false });
    expect((await ultimaCorrida()).detail).toContain("1 ya no aparecen");

    responderCon([item("A1"), item("A2")]);
    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ cambiados: 1, ausentes: 0 });
    const recuperado = await fila("A2");
    expect(recuperado.present).toBe(true);
    expect(recuperado.firstSeenAt).toEqual(original.firstSeenAt);
  });

  it("si falla una página sigue con las demás, queda con errores y no marca nada como ausente", async () => {
    responderCon([item("A1")], [item("B1")], [item("C1")]);
    await barrerItemsDux(ORIGEN);

    const lectura = paginas.responder;
    paginas.responder = async (offset) => {
      if (offset === 50) throw new ExternalServiceError("DUX", "DUX no respondió bien después de 4 intentos.");
      if (offset === 100) return { items: [item("C1", { stockReal: 1 })], total: 101, hayMas: false };
      return lectura(offset);
    };

    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ status: "con_errores", leidos: 2, ausentes: 0 });

    // B1 no se pudo leer: no hay ninguna prueba de que haya desaparecido.
    expect(await fila("B1")).toMatchObject({ present: true });
    expect(Number((await fila("C1")).stockReal)).toBe(1);
    expect(await ultimaCorrida()).toMatchObject({
      status: "con_errores",
      records: 2,
      detail: expect.stringContaining("fallaron 1 página"),
    });
  });

  it("si falla la primera página, frena: no sabe cuántas hay", async () => {
    responderCon([item("A1")]);
    await barrerItemsDux(ORIGEN);

    paginas.pedidas = [];
    paginas.responder = async () => {
      throw new ExternalServiceError("DUX", "DUX rechazó el token: revisá que esté bien cargado.");
    };

    expect(await barrerItemsDux(ORIGEN)).toMatchObject({ status: "error", leidos: 0 });

    expect(paginas.pedidas).toEqual([0]);
    expect(await fila("A1")).toMatchObject({ present: true });
    expect(await ultimaCorrida()).toMatchObject({
      status: "error",
      detail: expect.stringContaining("rechazó el token"),
    });
  });

  it("lo inesperado no se disimula: lo reintenta el Workflow", async () => {
    paginas.responder = async () => {
      throw new TypeError("se rompió otra cosa");
    };

    await expect(barrerItemsDux(ORIGEN)).rejects.toThrow("se rompió otra cosa");
  });
});
