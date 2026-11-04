import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { MAXIMO_FILAS_ESPEJO, type StockFila } from "@/lib/api/contracts/stock";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import type { DuxItemKind } from "@/generated/prisma/client";
import { espejoDeStock, estadoDelEspejo, kpisDelEspejo, rubrosDelEspejo } from "./espejo-stock";

const db = getDb();
const ADMIN = { role: "admin" } as const;
const pedir = (ruta: string) => new Request(`http://app.local/api/v1${ruta}`);

let serie = 0;

type Item = {
  code: string;
  kind?: DuxItemKind;
  baseCode?: string;
  packQuantity?: number | null;
  name?: string;
  category?: string | null;
  real?: number;
  reservado?: number;
  disponible?: number;
  present?: boolean;
};

const item = ({
  code,
  kind = "prenda",
  baseCode = code,
  packQuantity = null,
  name = `${code} - UNIDAD`,
  category = "HOMBRE",
  real = 0,
  reservado = 0,
  disponible = 0,
  present = true,
}: Item) =>
  db.duxItem.create({
    data: {
      id: newId(),
      code,
      normalizedCode: code,
      kind,
      baseCode,
      packQuantity,
      name,
      category,
      costCents: 0n,
      prices: [],
      stockReal: real,
      stockReserved: reservado,
      stockAvailable: disponible,
      enabled: true,
      present,
      createdOn: new Date(),
      contentHash: "x",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      changedAt: new Date(),
    },
  });

/** Un comprobante con una línea, de hace unos días. */
async function venta(
  linea: { code: string; kind: DuxItemKind; baseCode: string; packQuantity: number | null; quantity: number },
  { type = "COMPROBANTE_VENTA", cancelled = false, haceDias = 3 } = {},
) {
  serie += 1;
  const fecha = new Date(Date.now() - haceDias * 86_400_000);
  await db.duxInvoice.create({
    data: {
      id: newId(),
      duxId: serie,
      branchId: 1,
      type,
      letter: "X",
      pointOfSale: "2",
      number: serie,
      issuedOn: fecha,
      totalCents: 0n,
      cancelled,
      contentHash: "x",
      firstSeenAt: new Date(),
      changedAt: new Date(),
      items: {
        create: {
          id: newId(),
          line: 0,
          name: "Línea",
          unitPriceCents: 0n,
          discountPct: 0,
          vatPct: 0,
          costCents: 0n,
          ...linea,
        },
      },
    },
  });
}

const hb2 = async () => {
  await item({ code: "HB2", real: 94, reservado: 13, disponible: 81 });
  // Lo que dice DUX de los packs: un derivado de la prenda, que no se usa para el cálculo.
  await item({ code: "HB2-6", kind: "pack", baseCode: "HB2", packQuantity: 6, real: 13.5, disponible: 13.5 });
  await item({ code: "HB2-12", kind: "pack", baseCode: "HB2", packQuantity: 12, real: 6.75, disponible: 6.75 });
};
const fila = async (sku: string): Promise<StockFila> => (await espejoDeStock()).find((f) => f.sku === sku)!;

const limpiar = async () => {
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
};

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("espejoDeStock", () => {
  it("una fila por producto, con los números de la prenda y no los del pack", async () => {
    await hb2();

    const filas = await espejoDeStock();

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      sku: "HB2",
      nombre: "HB2 - UNIDAD",
      rubro: "HOMBRE",
      colores: [],
      stockPrendas: 94,
      reservadoPrendas: 13,
      disponiblePrendas: 81,
      disponibleBultos: 13,
      equivalencia: "81 prendas = 13 medias docenas y 3 sueltas",
    });
  });

  it("en medias, el bulto es la docena", async () => {
    await item({ code: "MSU2-1", category: "MEDIAS", real: 25, disponible: 25 });
    await item({ code: "MSU2-1-6", kind: "pack", baseCode: "MSU2-1", packQuantity: 6, category: "MEDIAS" });
    await item({ code: "MSU2-1-12", kind: "pack", baseCode: "MSU2-1", packQuantity: 12, category: "MEDIAS" });

    expect(await fila("MSU2-1")).toMatchObject({
      bultoLabel: "Docena",
      equivalencia: "25 prendas = 2 docenas y 1 suelta",
    });
  });

  it("muestra los combos sin descomponerlos, y deja afuera lo que no es mercadería y lo que ya no está", async () => {
    await item({ code: "COMBO32", kind: "combo", category: null, real: 3, disponible: 3 });
    await item({ code: "ENVIO1", kind: "no_producto", real: 9, disponible: 9 });
    await item({ code: "VIEJO", present: false, real: 9, disponible: 9 });

    const filas = await espejoDeStock();

    expect(filas.map(({ sku }) => sku)).toEqual(["COMBO32"]);
    expect(filas[0]).toMatchObject({ rubro: "COMBOS", equivalencia: "3 combos" });
  });

  it("suma las ventas de todas las presentaciones, en prendas", async () => {
    await hb2();
    await venta({ code: "HB2", kind: "prenda", baseCode: "HB2", packQuantity: null, quantity: 6 });
    await venta({ code: "HB2-6", kind: "pack", baseCode: "HB2", packQuantity: 6, quantity: 2 });
    await venta({ code: "HB2-12", kind: "pack", baseCode: "HB2", packQuantity: 12, quantity: 1 });

    // 6 + 12 + 12 = 30 prendas en 30 días: una por día, y hay 81 disponibles.
    expect(await fila("HB2")).toMatchObject({ ventas30dBultos: 5, diasStock: 81, estado: "sobrestock" });
  });

  it("cruza el corte del 10/10: un pack viejo suma a su producto", async () => {
    await hb2();
    await venta({ code: "HB2-1DOCENA", kind: "pack_viejo", baseCode: "HB2", packQuantity: 12, quantity: 1 });

    expect((await fila("HB2")).ventas30dBultos).toBe(2);
  });

  it("no cuenta anuladas, notas de crédito ni lo vendido hace más de 30 días", async () => {
    await hb2();
    const linea = { code: "HB2-6", kind: "pack", baseCode: "HB2", packQuantity: 6, quantity: 10 } as const;
    await venta(linea, { cancelled: true });
    await venta(linea, { type: "NOTA_CREDITO" });
    await venta(linea, { haceDias: 40 });

    expect(await fila("HB2")).toMatchObject({ ventas30dBultos: 0, diasStock: null, estado: "sin_rotacion" });
  });

  it("primero lo agotado que se vende; lo agotado que nadie compra, al final", async () => {
    await item({ code: "NADIE" });
    await item({ code: "BIEN", real: 60, disponible: 60 });
    await item({ code: "URGENTE" });
    await venta({ code: "URGENTE", kind: "prenda", baseCode: "URGENTE", packQuantity: null, quantity: 3 });
    await venta({ code: "BIEN", kind: "prenda", baseCode: "BIEN", packQuantity: null, quantity: 60 });

    expect((await espejoDeStock()).map(({ sku }) => sku)).toEqual(["URGENTE", "BIEN", "NADIE"]);
  });

  it("filtra por texto, sin importar tildes ni mayúsculas, por rubro y por estado", async () => {
    await item({ code: "A1", name: "CORPIÑO ALGODÓN", category: "CORPIÑOS", real: 9, disponible: 9 });
    await item({ code: "B2", name: "SOQUETE", category: "MEDIAS" });

    const skus = async (query: Parameters<typeof espejoDeStock>[0]) =>
      (await espejoDeStock(query)).map(({ sku }) => sku);

    expect(await skus({ q: "algodon" })).toEqual(["A1"]);
    expect(await skus({ q: "b2" })).toEqual(["B2"]);
    expect(await skus({ rubro: "MEDIAS" })).toEqual(["B2"]);
    expect(await skus({ estado: "agotado" })).toEqual(["B2"]);
    expect(await skus({ q: "nada" })).toEqual([]);
  });

  it(`corta en ${MAXIMO_FILAS_ESPEJO} filas: son más de mil y hay buscador`, async () => {
    const cuantas = MAXIMO_FILAS_ESPEJO + 5;
    await db.duxItem.createMany({
      data: Array.from({ length: cuantas }, (_, i) => ({
        id: newId(),
        code: `P${i}`,
        normalizedCode: `P${i}`,
        kind: "prenda" as const,
        baseCode: `P${i}`,
        name: `P${i}`,
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
      })),
    });

    expect(await espejoDeStock()).toHaveLength(MAXIMO_FILAS_ESPEJO);
    // Los indicadores cuentan todo, no lo que entra en la tabla.
    expect((await kpisDelEspejo()).find(({ id }) => id === "skus")?.value).toBe(cuantas);
  });
});

describe("kpisDelEspejo y rubrosDelEspejo", () => {
  it("cuenta productos y códigos reales", async () => {
    await hb2();

    expect((await kpisDelEspejo()).find(({ id }) => id === "skus")).toMatchObject({
      value: 1,
      hint: "3 códigos con sus packs",
    });
  });

  it("los rubros son los de DUX, sin repetir y en orden", async () => {
    await item({ code: "A", category: "VEDETINA" });
    await item({ code: "B", category: "CORPIÑOS" });
    await item({ code: "C", category: "CORPIÑOS" });
    await item({ code: "D", category: null });

    expect(await rubrosDelEspejo()).toEqual(["CORPIÑOS", "Sin rubro", "VEDETINA"]);
  });
});

describe("estadoDelEspejo", () => {
  const corrida = (cambios: Record<string, unknown> = {}) =>
    db.syncRun.create({
      data: {
        id: newId(),
        integration: "dux",
        operation: "items",
        status: "ok",
        trigger: "cron",
        startedAt: new Date(Date.now() - 60_000),
        finishedAt: new Date(Date.now() - 10_000),
        calls: 50,
        records: 2488,
        ...cambios,
      },
    });

  it("sin ninguna lectura lo dice, y no está al día", async () => {
    expect(await estadoDelEspejo()).toMatchObject({ ultimaLectura: null, alDia: false, codigos: 0, errores24h: 0 });
  });

  it("con una lectura reciente, muestra sus números reales", async () => {
    await corrida();

    expect(await estadoDelEspejo()).toMatchObject({ alDia: true, llamadas: 50, codigos: 2488, duracionS: 50 });
  });

  it("una lectura vieja no está al día", async () => {
    const vieja = new Date(Date.now() - 30 * 3_600_000);
    await corrida({ startedAt: vieja, finishedAt: vieja });

    expect((await estadoDelEspejo()).alDia).toBe(false);
  });

  it("una lectura con errores no está al día, y se cuenta", async () => {
    await corrida({ status: "con_errores" });

    expect(await estadoDelEspejo()).toMatchObject({ alDia: false, errores24h: 1, codigos: 2488 });
  });

  it("no cuenta los errores de hace más de un día", async () => {
    await corrida();
    const vieja = new Date(Date.now() - 30 * 3_600_000);
    await corrida({ status: "error", startedAt: vieja, finishedAt: vieja });

    expect((await estadoDelEspejo()).errores24h).toBe(0);
  });
});

describe("a través del despachador, con stock como dominio real", () => {
  const opciones = { user: ADMIN, realDomains: ["stock"] as const };

  it("/stock/espejo sale de la base", async () => {
    await hb2();

    const filas = (await (await dispatchApiRequest(pedir("/stock/espejo?q=hb2"), opciones)).json()) as StockFila[];

    expect(filas.map(({ sku }) => sku)).toEqual(["HB2"]);
  });

  it("un estado desconocido en la URL se ignora, como en la API simulada", async () => {
    await hb2();

    const filas = (await (await dispatchApiRequest(pedir("/stock/espejo?estado=x"), opciones)).json()) as StockFila[];

    expect(filas).toHaveLength(1);
  });

  it("lo que todavía no es real sigue saliendo de la API simulada", async () => {
    const respuesta = await dispatchApiRequest(pedir("/stock/proveedores"), opciones);

    expect(respuesta.status).toBe(200);
    expect(((await respuesta.json()) as unknown[]).length).toBeGreaterThan(0);
  });
});
