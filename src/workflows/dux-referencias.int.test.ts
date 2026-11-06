import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { ExternalServiceError } from "@/lib/errors";
import type { ErpReferencias } from "@/modules/inventory/erp-gateway";
import { leerReferenciasDux } from "./dux-referencias";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
const erp = vi.hoisted(() => ({
  responder: (async () => ({})) as () => Promise<unknown>,
}));

vi.mock("@/integrations/dux", () => ({
  erpGateway: async ({ alIntentar }: { alIntentar?: () => void } = {}) => ({
    listarReferencias: async () => {
      alIntentar?.();
      return erp.responder();
    },
  }),
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;
const corrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

const REFERENCIAS: ErpReferencias = {
  rubros: [{ id: 1, nombre: "HOMBRE" }],
  subrubros: [{ id: 10, rubroId: 1, nombre: "BOXER" }],
  proveedores: [{ id: 7, nombre: "BETHY", habilitado: true }],
  listas: [{ id: 71695, nombre: "MAYORISTA EF/TR", habilitado: true }],
};

const limpiar = async () => {
  await db.duxReference.deleteMany();
  await db.syncRun.deleteMany();
};

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("leerReferenciasDux", () => {
  it("guarda las cuatro listas con su ID, y registra la corrida", async () => {
    erp.responder = async () => REFERENCIAS;

    expect(await leerReferenciasDux(ORIGEN)).toEqual({ status: "ok" });

    expect(await db.duxReference.count()).toBe(4);
    expect(await db.duxReference.findFirst({ where: { kind: "subrubro" } })).toMatchObject({
      duxId: 10,
      parentId: 1,
      name: "BOXER",
    });
    expect(await corrida()).toMatchObject({
      integration: "dux",
      operation: "referencias",
      status: "ok",
      records: 4,
      detail: "Rubros: 1. Subrubros: 1. Proveedores: 1. Listas: 1.",
    });
  });

  it("si DUX falla, quedan las de la lectura anterior, y lo dice", async () => {
    erp.responder = async () => REFERENCIAS;
    await leerReferenciasDux(ORIGEN);
    erp.responder = async () => {
      throw new ExternalServiceError("DUX", "DUX no respondió.");
    };

    expect(await leerReferenciasDux(ORIGEN)).toEqual({ status: "error" });

    expect(await db.duxReference.count()).toBe(4);
    expect((await corrida()).detail).toBe("DUX no respondió. Quedan las de la lectura anterior.");
  });

  it("un error que no es de DUX no se disimula", async () => {
    erp.responder = async () => {
      throw new Error("Se rompió otra cosa");
    };

    await expect(leerReferenciasDux(ORIGEN)).rejects.toThrow("Se rompió otra cosa");
  });
});
