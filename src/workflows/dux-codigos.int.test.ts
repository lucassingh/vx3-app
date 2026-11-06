import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { ExternalServiceError } from "@/lib/errors";
import { codigoSugerido } from "@/modules/catalog/alta-consultas";
import { leerCodigosDux } from "./dux-codigos";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
const erp = vi.hoisted(() => ({
  responder: (async () => ({ codigos: [], hayMas: false })) as (offset: number) => Promise<unknown>,
}));

vi.mock("@/integrations/dux", () => ({
  erpGateway: async ({ alIntentar }: { alIntentar?: () => void } = {}) => ({
    listarCodigos: async (offset: number) => {
      alIntentar?.();
      return erp.responder(offset);
    },
  }),
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;
const corrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

const itemDeDux = (code: string, category: string, subcategory: string, cambios: Record<string, unknown> = {}) => ({
  id: newId(),
  code,
  normalizedCode: code,
  kind: code.includes("-") ? ("pack" as const) : ("prenda" as const),
  baseCode: code.split("-")[0]!,
  packQuantity: code.includes("-") ? Number(code.split("-")[1]) : null,
  name: code,
  category,
  subcategory,
  costCents: 0n,
  prices: [],
  stockReal: "0",
  stockReserved: "0",
  stockAvailable: "0",
  enabled: true,
  createdOn: new Date("2025-01-15T00:00:00Z"),
  contentHash: code,
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  changedAt: new Date(),
  ...cambios,
});

const limpiar = async () => {
  await db.duxUsedCode.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
};

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("leerCodigosDux", () => {
  it("lee todas las páginas, y registra la corrida", async () => {
    erp.responder = async (offset) =>
      offset === 0 ? { codigos: ["LN1", "LN1-6"], hayMas: true } : { codigos: ["VIEJO9"], hayMas: false };

    expect(await leerCodigosDux(ORIGEN)).toEqual({ status: "ok" });

    expect(await db.duxUsedCode.count()).toBe(3);
    expect(await corrida()).toMatchObject({
      integration: "dux",
      operation: "codigos",
      status: "ok",
      calls: 2,
      records: 3,
      detail: "Códigos leídos: 3. Nuevos: 3.",
    });
  });

  it("repetirla no duplica nada, y un código no se olvida aunque deje de venir", async () => {
    erp.responder = async () => ({ codigos: ["LN1", "VIEJO9"], hayMas: false });
    await leerCodigosDux(ORIGEN);

    erp.responder = async () => ({ codigos: ["LN1"], hayMas: false });
    await leerCodigosDux(ORIGEN);

    expect(await db.duxUsedCode.count()).toBe(2);
    expect((await corrida()).detail).toBe("Códigos leídos: 1. Nuevos: 0.");
  });

  it("escribe el código normalizado para poder buscarlo", async () => {
    erp.responder = async () => ({ codigos: ["LN 25"], hayMas: false });

    await leerCodigosDux(ORIGEN);

    expect(await db.duxUsedCode.findUniqueOrThrow({ where: { code: "LN 25" } })).toMatchObject({
      normalizedCode: "LN25",
    });
  });

  it("si una página falla, lo dice, y lo leído queda", async () => {
    erp.responder = async (offset) => {
      if (offset === 0) return { codigos: ["LN1"], hayMas: true };
      throw new ExternalServiceError("DUX", "DUX no respondió.");
    };

    expect(await leerCodigosDux(ORIGEN)).toEqual({ status: "con_errores" });

    expect(await db.duxUsedCode.count()).toBe(1);
    expect((await corrida()).detail).toBe("Códigos leídos: 1. Nuevos: 1. DUX no respondió.");
  });

  it("si falla la primera, es un error", async () => {
    erp.responder = async () => {
      throw new ExternalServiceError("DUX", "DUX no respondió.");
    };

    expect(await leerCodigosDux(ORIGEN)).toEqual({ status: "error" });
  });
});

describe("codigoSugerido", () => {
  it("cuenta lo inhabilitado: un número usado no se reusa", async () => {
    await db.duxItem.create({ data: itemDeDux("HB5", "HOMBRE", "BOXER") });
    await db.duxUsedCode.create({ data: { code: "HB9-6", normalizedCode: "HB9-6", firstSeenAt: new Date() } });

    expect(await codigoSugerido("HOMBRE", "BOXER")).toEqual({ prefijo: "HB", codigo: "HB10" });
  });

  it("cuenta lo que se vendió, aunque ya no esté en ningún lado", async () => {
    await db.duxItem.create({ data: itemDeDux("HB5", "HOMBRE", "BOXER") });
    await db.duxInvoice.create({
      data: {
        id: newId(),
        duxId: 1,
        branchId: 1,
        type: "COMPROBANTE_VENTA",
        letter: "B",
        pointOfSale: "1",
        issuedOn: new Date("2026-01-15T00:00:00Z"),
        totalCents: 100n,
        cancelled: false,
        contentHash: "x",
        firstSeenAt: new Date(),
        changedAt: new Date(),
        items: {
          create: {
            id: newId(),
            line: 1,
            code: "HB77",
            kind: "prenda",
            baseCode: "HB77",
            name: "x",
            quantity: "1",
            unitPriceCents: 100n,
            discountPct: "0",
            vatPct: "0",
            costCents: 50n,
          },
        },
      },
    });

    expect((await codigoSugerido("HOMBRE", "BOXER"))?.codigo).toBe("HB78");
  });

  it("la tabla de Elías manda, y un prefijo vacío arranca en 1", async () => {
    expect(await codigoSugerido("CORPIÑOS", "TOP SEGUNDA PIEL GRANDE")).toEqual({ prefijo: "CTSPG", codigo: "CTSPG1" });
  });

  it("un subrubro sin prefijo devuelve null", async () => {
    expect(await codigoSugerido("HOMBRE", "BERMUDA")).toBeNull();
  });
});
