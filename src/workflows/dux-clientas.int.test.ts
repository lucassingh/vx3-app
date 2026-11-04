import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { ExternalServiceError } from "@/lib/errors";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import { leerClientasDux } from "./dux-clientas";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
const erp = vi.hoisted(() => ({
  responder: (async () => ({ clientas: [], hayMas: false })) as (offset: number) => Promise<unknown>,
  pedidos: [] as number[],
  armar: (() => undefined) as () => void,
}));

vi.mock("@/integrations/dux", () => ({
  POR_PAGINA_DUX: 50,
  erpGateway: async ({ alIntentar }: { alIntentar?: () => void } = {}) => {
    erp.armar();
    return {
      listarClientas: async (offset: number) => {
        erp.pedidos.push(offset);
        alIntentar?.();
        return erp.responder(offset);
      },
    };
  },
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;
const AVISO = " Anonimizadas: este ambiente no es producción.";

const clienta = (id: number, cambios: Partial<ErpClienta> = {}): ErpClienta => ({
  id,
  nombre: "NOMBRE REAL",
  telefono: "+5491144445555",
  email: "real@correo.com",
  provincia: "Buenos Aires",
  localidad: "Localidad Real",
  habilitada: true,
  creadaEl: "2026-01-15",
  ...cambios,
});

const responderCon = (...clientas: ErpClienta[]) => {
  erp.responder = async () => ({ clientas, hayMas: false });
};
const fila = (duxId: number) => db.duxCustomer.findUniqueOrThrow({ where: { duxId } });
const corrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "qa");
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  await db.duxCustomer.deleteMany();
  await db.syncRun.deleteMany();
  erp.pedidos = [];
  erp.armar = () => undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.duxCustomer.deleteMany();
  await db.syncRun.deleteMany();
  await db.$disconnect();
});

describe("corte de la paginación", () => {
  it("lee todas las páginas, no solo las primeras 50, y registra la corrida", async () => {
    erp.responder = async (offset) => {
      const cantidad = offset < 100 ? 50 : 20;
      return {
        clientas: Array.from({ length: cantidad }, (_, i) => clienta(offset + i + 1)),
        hayMas: cantidad === 50,
      };
    };

    expect(await leerClientasDux(ORIGEN)).toEqual({ status: "ok" });

    expect(erp.pedidos).toEqual([0, 50, 100]);
    expect(await db.duxCustomer.count()).toBe(120);
    expect(await corrida()).toMatchObject({
      operation: "clientas",
      status: "ok",
      calls: 3,
      records: 120,
      detail: `Clientas leídas: 120. Nuevas: 120. Cambiadas: 0.${AVISO}`,
    });
  });

  it("una página vacía también termina, si la anterior justo estaba llena", async () => {
    erp.responder = async (offset) =>
      offset === 0
        ? { clientas: Array.from({ length: 50 }, (_, i) => clienta(i + 1)), hayMas: true }
        : { clientas: [], hayMas: false };

    expect(await leerClientasDux(ORIGEN)).toEqual({ status: "ok" });

    expect(erp.pedidos).toEqual([0, 50]);
  });

  describe("cuando DUX repite y saltea filas en los cortes, como hace con el orden que tiene", () => {
    const lista = Array.from({ length: 120 }, (_, i) => clienta(i + 1));
    /** La fila 51 no llega nunca con estos cortes: en su lugar viene repetida la 50. */
    const conCorteMalo = (offset: number) => {
      const pagina = lista.slice(offset, offset + 50);
      if (offset === 50) pagina[0] = lista[49]!;
      return { clientas: pagina, hayMas: pagina.length === 50 };
    };

    it("vuelve a pasar con los cortes en otro lugar, y encuentra la que faltaba", async () => {
      erp.responder = async (offset) => conCorteMalo(offset);

      expect(await leerClientasDux(ORIGEN)).toEqual({ status: "ok" });

      expect(erp.pedidos).toEqual([0, 50, 100, 25, 75]);
      expect(await db.duxCustomer.count()).toBe(120);
      expect(await corrida()).toMatchObject({ calls: 5, records: 120 });
      expect((await corrida()).detail).toContain("Clientas leídas: 120. Nuevas: 120.");
    });

    it("con todo visto en la primera pasada, no gasta una segunda", async () => {
      erp.responder = async (offset) => {
        const pagina = lista.slice(offset, offset + 50);
        return { clientas: pagina, hayMas: pagina.length === 50 };
      };

      await leerClientasDux(ORIGEN);

      expect(erp.pedidos).toEqual([0, 50, 100]);
    });

    it("si después de tres pasadas sigue faltando, frena, y dice cuántas", async () => {
      erp.responder = async (offset) => {
        const pagina = lista.slice(offset, offset + 50).map((fila) => (fila.id === 51 ? lista[49]! : fila));
        return { clientas: pagina, hayMas: pagina.length === 50 };
      };

      expect(await leerClientasDux(ORIGEN)).toEqual({ status: "con_errores" });

      expect(erp.pedidos).toEqual([0, 50, 100, 25, 75, 10, 60, 110]);
      expect(await db.duxCustomer.count()).toBe(119);
      expect((await corrida()).detail).toContain("DUX salteó 1 de 120 filas");
    });
  });

  it("si DUX repite la misma página, frena y lo dice", async () => {
    const llena = Array.from({ length: 50 }, (_, i) => clienta(i + 1));
    erp.responder = async () => ({ clientas: llena, hayMas: true });

    expect(await leerClientasDux(ORIGEN)).toEqual({ status: "con_errores" });

    expect(erp.pedidos).toEqual([0, 50]);
    expect((await corrida()).detail).toContain("repitió una página");
  });

  it("si falla una página, frena, conserva lo leído y queda con errores", async () => {
    erp.responder = async (offset) => {
      if (offset === 50) throw new ExternalServiceError("DUX", "DUX no respondió bien.");
      return { clientas: Array.from({ length: 50 }, (_, i) => clienta(i + 1)), hayMas: true };
    };

    expect(await leerClientasDux(ORIGEN)).toEqual({ status: "con_errores" });

    expect(erp.pedidos).toEqual([0, 50]);
    expect(await db.duxCustomer.count()).toBe(50);
    expect((await corrida()).detail).toBe(`Clientas leídas: 50. DUX no respondió bien.${AVISO}`);
  });

  it("sin token, queda en error y lo dice, sin pedirle nada a DUX", async () => {
    erp.armar = () => {
      throw new ExternalServiceError("DUX", "Todavía no se cargó el token de DUX.");
    };

    expect(await leerClientasDux(ORIGEN)).toEqual({ status: "error" });

    expect(erp.pedidos).toEqual([]);
    expect((await corrida()).detail).toContain("Todavía no se cargó el token");
  });
});

describe("fuera de producción", () => {
  it("no queda ningún dato real en la base", async () => {
    responderCon(clienta(7));

    await leerClientasDux(ORIGEN);

    const texto = JSON.stringify(await fila(7), (_, valor) => (typeof valor === "bigint" ? String(valor) : valor));
    expect(texto).not.toContain("REAL");
    expect(texto).not.toContain("Real");
    expect(texto).not.toContain("real@");
    expect(texto).not.toContain("44445555");
    expect(await fila(7)).toMatchObject({
      name: "Clienta 7",
      email: "clienta-7@anonimizada.invalid",
      province: "Buenos Aires",
      city: null,
      enabled: true,
      phone: expect.stringMatching(/^00\d{8}$/),
      normalizedPhone: expect.stringMatching(/^00\d{8}$/),
    });
  });

  it("un ambiente sin nombre también se anonimiza", async () => {
    vi.stubEnv("APP_ENV", "");
    responderCon(clienta(7));

    await leerClientasDux(ORIGEN);

    expect(await fila(7)).toMatchObject({ name: "Clienta 7" });
  });

  it("sin la clave no guarda nada, antes que guardar un dato real", async () => {
    vi.stubEnv("CREDENTIALS_KEY", "");
    responderCon(clienta(7));

    await expect(leerClientasDux(ORIGEN)).rejects.toThrow(/CREDENTIALS_KEY/);

    expect(await db.duxCustomer.count()).toBe(0);
  });

  it("dos formatos del mismo número dan el mismo teléfono", async () => {
    responderCon(clienta(1, { telefono: "+5491144445555" }), clienta(2, { telefono: "11-44445555" }));

    await leerClientasDux(ORIGEN);

    expect((await fila(1)).normalizedPhone).toBe((await fila(2)).normalizedPhone);
  });

  it("releer sin cambios no toca nada", async () => {
    responderCon(clienta(7));
    await leerClientasDux(ORIGEN);
    const antes = await fila(7);

    await leerClientasDux(ORIGEN);

    expect((await fila(7)).changedAt).toEqual(antes.changedAt);
    expect((await corrida()).detail).toBe(`Clientas leídas: 1. Nuevas: 0. Cambiadas: 0.${AVISO}`);
  });

  it("ve que cambió un dato, sin guardarlo", async () => {
    responderCon(clienta(7));
    await leerClientasDux(ORIGEN);
    const antes = await fila(7);

    responderCon(clienta(7, { telefono: "1155556666", habilitada: false }));
    await leerClientasDux(ORIGEN);

    const despues = await fila(7);
    expect(despues.phone).not.toBe(antes.phone);
    expect(despues.phone).not.toContain("55556666");
    expect(despues.enabled).toBe(false);
    expect((await corrida()).detail).toContain("Cambiadas: 1.");
  });
});

describe("en producción", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENV", "production");
  });

  it("entran los datos reales, con el teléfono normalizado y sin el aviso", async () => {
    responderCon(clienta(7));

    await leerClientasDux(ORIGEN);

    expect(await fila(7)).toMatchObject({
      name: "NOMBRE REAL",
      phone: "+5491144445555",
      normalizedPhone: "1144445555",
      email: "real@correo.com",
      city: "Localidad Real",
    });
    expect((await corrida()).detail).toBe("Clientas leídas: 1. Nuevas: 1. Cambiadas: 0.");
  });

  it("dos formatos del mismo número dan el mismo teléfono", async () => {
    responderCon(clienta(1, { telefono: "+5491144445555" }), clienta(2, { telefono: "11-44445555" }));

    await leerClientasDux(ORIGEN);

    expect((await fila(1)).normalizedPhone).toBe("1144445555");
    expect((await fila(2)).normalizedPhone).toBe("1144445555");
  });
});
