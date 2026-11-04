import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { ExternalServiceError } from "@/lib/errors";
import { arrancarHistorialDux, arrancarSincronizacionDux } from "./arrancar-dux";
import { sincronizarDux, traerHistorialDux } from "./dux-sync";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
const erp = vi.hoisted(() => ({
  items: (async () => ({ items: [], total: 0, hayMas: false })) as () => Promise<unknown>,
  comprobantes: (async () => ({ comprobantes: [], total: 0, hayMas: false })) as () => Promise<unknown>,
  clientas: (async () => ({ clientas: [], hayMas: false })) as () => Promise<unknown>,
}));
const workflow = vi.hoisted(() => ({ start: vi.fn() }));

vi.mock("workflow/api", () => workflow);
vi.mock("@/integrations/dux", () => ({
  sucursalesDux: () => [1, 2],
  erpGateway: async () => ({
    listarItems: () => erp.items(),
    listarComprobantes: () => erp.comprobantes(),
    listarClientas: () => erp.clientas(),
  }),
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;
const corridas = () => db.syncRun.findMany({ orderBy: { startedAt: "asc" } });

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "qa");
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  await db.syncLock.deleteMany();
  await db.syncRun.deleteMany();
  await db.customer.deleteMany();
  await db.duxCustomer.deleteMany();
  erp.items = async () => ({ items: [], total: 0, hayMas: false });
  erp.comprobantes = async () => ({ comprobantes: [], total: 0, hayMas: false });
  erp.clientas = async () => ({ clientas: [], hayMas: false });
  workflow.start.mockReset();
  workflow.start.mockResolvedValue({ runId: "wrun_01" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.syncLock.deleteMany();
  await db.syncRun.deleteMany();
  await db.$disconnect();
});

describe("sincronizarDux", () => {
  it("corre las tres lecturas en orden, con su origen, y suelta el bloqueo", async () => {
    const { bloqueo } = await arrancarYTomarLlave();

    const resultado = await sincronizarDux(ORIGEN, bloqueo);

    expect(resultado).toEqual({ items: "ok", ventas: "ok", clientas: "ok" });
    const filas = await corridas();
    expect(filas.map(({ operation }) => operation)).toEqual(["items", "ventas", "clientas", "fichas"]);
    expect(filas.every(({ trigger, triggeredBy }) => trigger === "manual" && triggeredBy === "Prueba")).toBe(true);
    expect(await db.syncLock.count()).toBe(0);
  });

  it("arma las fichas con lo que leyó, y lo registra", async () => {
    const { bloqueo } = await arrancarYTomarLlave();
    erp.clientas = async () => ({
      clientas: [
        {
          id: 1,
          nombre: "NOMBRE REAL",
          nombrePila: null,
          telefono: "+5491144445555",
          email: null,
          provincia: null,
          localidad: null,
          habilitada: true,
          creadaEl: null,
        },
        {
          id: 2,
          nombre: "SIN TELEFONO",
          nombrePila: null,
          telefono: null,
          email: null,
          provincia: null,
          localidad: null,
          habilitada: true,
          creadaEl: null,
        },
      ],
      hayMas: false,
    });

    await sincronizarDux(ORIGEN, bloqueo);

    expect(await db.customer.count()).toBe(1);
    expect((await corridas()).at(-1)).toMatchObject({
      operation: "fichas",
      status: "ok",
      calls: 0,
      records: 1,
      detail: "Clientas: 1. Nuevas: 1. Cambiadas: 0. Fichas sin teléfono: 1.",
    });
  });

  it("una lectura que no pudo leer no frena a las demás", async () => {
    const { bloqueo } = await arrancarYTomarLlave();
    erp.comprobantes = async () => {
      throw new ExternalServiceError("DUX", "DUX no respondió bien.");
    };

    expect(await sincronizarDux(ORIGEN, bloqueo)).toEqual({ items: "ok", ventas: "error", clientas: "ok" });
    expect(await db.syncLock.count()).toBe(0);
  });

  it("si algo revienta, suelta el bloqueo y no deja nada en curso", async () => {
    const { bloqueo } = await arrancarYTomarLlave();
    erp.comprobantes = async () => {
      throw new TypeError("algo inesperado");
    };

    await expect(sincronizarDux(ORIGEN, bloqueo)).rejects.toThrow("algo inesperado");

    expect(await db.syncLock.count()).toBe(0);
    const filas = await corridas();
    expect(filas.find(({ operation }) => operation === "ventas")).toMatchObject({
      status: "error",
      detail: "La corrida se cortó antes de terminar.",
    });
    expect(filas.some(({ operation }) => operation === "clientas")).toBe(false);
  });
});

describe("arrancar", () => {
  it("toma el bloqueo y lanza el Workflow con su llave", async () => {
    expect(await arrancarSincronizacionDux(ORIGEN)).toEqual({ arrancada: true, runId: "wrun_01" });

    const [funcion, argumentos] = workflow.start.mock.calls[0] as [unknown, [typeof ORIGEN, string]];
    expect(funcion).toBe(sincronizarDux);
    expect(argumentos[0]).toEqual(ORIGEN);
    expect(argumentos[1]).toBe((await db.syncLock.findUniqueOrThrow({ where: { integration: "dux" } })).holder);
  });

  it("con una corrida en curso no lanza otra", async () => {
    await arrancarSincronizacionDux(ORIGEN);

    expect(await arrancarSincronizacionDux(ORIGEN)).toEqual({ arrancada: false });

    expect(workflow.start).toHaveBeenCalledOnce();
  });

  it("de dos pedidos simultáneos, lanza uno solo", async () => {
    const resultados = await Promise.all([arrancarSincronizacionDux(ORIGEN), arrancarSincronizacionDux(ORIGEN)]);

    expect(resultados.filter(({ arrancada }) => arrancada)).toHaveLength(1);
    expect(workflow.start).toHaveBeenCalledOnce();
  });

  it("si no se pudo lanzar, suelta el bloqueo: la próxima no queda trabada", async () => {
    workflow.start.mockRejectedValueOnce(new Error("no arrancó"));

    await expect(arrancarSincronizacionDux(ORIGEN)).rejects.toThrow("no arrancó");

    expect(await db.syncLock.count()).toBe(0);
    expect(await arrancarSincronizacionDux(ORIGEN)).toMatchObject({ arrancada: true });
  });

  it("el historial tampoco corre a la vez que una sincronización", async () => {
    await arrancarSincronizacionDux(ORIGEN);

    expect(await arrancarHistorialDux(ORIGEN)).toEqual({ arrancada: false });
  });

  it("el historial usa el mismo bloqueo, y lo suelta al terminar", async () => {
    await arrancarHistorialDux(ORIGEN);
    const [funcion, argumentos] = workflow.start.mock.calls[0] as [unknown, [typeof ORIGEN, string]];
    expect(funcion).toBe(traerHistorialDux);

    await traerHistorialDux(ORIGEN, argumentos[1]);

    expect(await db.syncLock.count()).toBe(0);
    expect(await arrancarSincronizacionDux(ORIGEN)).toMatchObject({ arrancada: true });
  });
});

/** Toma el bloqueo como lo hace un arranque real, y devuelve la llave que recibió el Workflow. */
async function arrancarYTomarLlave() {
  await arrancarSincronizacionDux(ORIGEN);
  const [, argumentos] = workflow.start.mock.calls.at(-1) as [unknown, [typeof ORIGEN, string]];
  return { bloqueo: argumentos[1] };
}
