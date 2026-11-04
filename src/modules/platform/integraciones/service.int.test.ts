import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { guardarCredencial } from "../credentials/service";
import { listarIntegraciones, registroDeSincronizaciones } from "./service";

const db = getDb();
const USUARIO = newId();

const corrida = (operation: string, cambios: Record<string, unknown> = {}) =>
  db.syncRun.create({
    data: {
      id: newId(),
      integration: "dux",
      operation,
      status: "ok",
      trigger: "cron",
      startedAt: new Date(Date.now() - 60_000),
      finishedAt: new Date(Date.now() - 30_000),
      calls: 10,
      records: 5,
      detail: "Bien.",
      ...cambios,
    },
  });
const tresBien = async () => {
  for (const operacion of ["items", "ventas", "clientas"]) await corrida(operacion);
};
const dux = async () => (await listarIntegraciones()).find(({ id }) => id === "dux")!;
const conToken = () => guardarCredencial("dux", "token-de-prueba-7c1e", { id: USUARIO, label: "Admin de Prueba" });

const limpiar = async () => {
  await db.syncRun.deleteMany();
  await db.integrationCredential.deleteMany();
  await db.user.deleteMany({ where: { id: USUARIO } });
};

beforeEach(async () => {
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  await limpiar();
  await db.user.create({
    data: {
      id: USUARIO,
      name: "Admin de Prueba",
      email: `${USUARIO}@prueba.local`,
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("listarIntegraciones", () => {
  it("sin credencial cargada, DUX está pendiente y no inventa nada", async () => {
    expect(await dux()).toMatchObject({
      estado: "pendiente",
      detalle: "Todavía no se cargó el token: cargalo para empezar a sincronizar.",
      ultimoSync: null,
      credencial: null,
    });
  });

  it("con todo bien, muestra el estado, la credencial y las métricas reales", async () => {
    await conToken();
    await tresBien();

    const integracion = await dux();

    expect(integracion.estado).toBe("ok");
    expect(integracion.credencial).toMatchObject({ mascara: "••••7c1e", cargadaPor: "Admin de Prueba" });
    expect(integracion.ultimoSync).not.toBeNull();
    expect(integracion.metricas.map(({ label }) => label)).toEqual([
      "Productos",
      "Comprobantes",
      "Clientas",
      "Llamadas hoy",
    ]);
    expect(integracion.metricas.at(-1)?.value).toBe("30");
  });

  it("toma la última corrida de cada lectura: si se recuperó, está bien", async () => {
    await conToken();
    await corrida("items", { status: "error", detail: "Falló.", startedAt: new Date(Date.now() - 7_200_000) });
    await tresBien();

    expect((await dux()).estado).toBe("ok");
  });

  it("si la última falló, lo dice con el motivo", async () => {
    await conToken();
    await tresBien();
    await corrida("ventas", { status: "error", detail: "DUX no respondió bien.", startedAt: new Date() });

    expect(await dux()).toMatchObject({ estado: "degradado", detalle: "Ventas: DUX no respondió bien." });
  });

  it("el último sync es el último que trajo algo, no el que falló", async () => {
    await conToken();
    const bien = await corrida("items");
    await corrida("ventas", { status: "error", detail: "Falló.", startedAt: new Date(), finishedAt: new Date() });

    expect((await dux()).ultimoSync).toBe(bien.finishedAt?.toISOString());
  });

  it("avisa si hay una corrida en curso", async () => {
    await conToken();
    await tresBien();
    await corrida("items", { status: "en_curso", finishedAt: null, startedAt: new Date() });

    const integracion = await dux();

    expect(integracion.estado).toBe("ok");
    expect(integracion.detalle).toContain("Hay una sincronización en curso.");
  });

  it("el historial no cuenta para el estado", async () => {
    await conToken();
    await tresBien();
    await corrida("ventas_historial:2026-10:1", { status: "error", startedAt: new Date() });

    expect((await dux()).estado).toBe("ok");
  });

  it("lo que no está conectado aparece pendiente, con su PR y sin datos", async () => {
    const pendientes = (await listarIntegraciones()).filter(({ id }) => id !== "dux");

    expect(pendientes.length).toBeGreaterThan(0);
    for (const integracion of pendientes) {
      expect(integracion.estado).toBe("pendiente");
      expect(integracion.detalle).toMatch(/PR \d+\.\d+\.$/);
      expect(integracion.ultimoSync).toBeNull();
      expect(integracion.metricas).toEqual([]);
      expect(integracion.credencial).toBeNull();
    }
  });
});

describe("registroDeSincronizaciones", () => {
  it("devuelve las corridas reales, de la más nueva a la más vieja", async () => {
    await corrida("items", { startedAt: new Date(Date.now() - 60_000), finishedAt: new Date(Date.now() - 30_000) });
    await corrida("clientas", {
      trigger: "manual",
      triggeredBy: "Lucas",
      status: "en_curso",
      startedAt: new Date(),
      finishedAt: null,
    });

    const [nueva, vieja] = await registroDeSincronizaciones();

    expect(nueva).toMatchObject({
      integracion: "DUX",
      operacion: "Clientas",
      origen: "Lucas",
      resultado: "en_curso",
      duracionMs: null,
    });
    expect(vieja).toMatchObject({ operacion: "Productos, stock y precios", origen: "automática", resultado: "ok" });
    expect(vieja?.duracionMs).toBeGreaterThan(0);
  });

  it("nombra cada mes del historial", async () => {
    await corrida("ventas_historial:2026-10:1");

    const [fila] = await registroDeSincronizaciones();

    expect(fila?.operacion).toBe("Historial de ventas · 2026-10 · sucursal 1");
  });

  it("sin corridas, está vacío", async () => {
    expect(await registroDeSincronizaciones()).toEqual([]);
  });
});
