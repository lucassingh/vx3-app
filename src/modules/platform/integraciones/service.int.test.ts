import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { guardarCredencial } from "../credentials/service";
import { soltarBloqueo, tomarBloqueo } from "../sync-runs";
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
  await db.syncLock.deleteMany();
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

  it("avisa si hay una corrida en curso, desde que se la pide y hasta que termina", async () => {
    await conToken();
    await tresBien();
    expect((await dux()).sincronizando).toBe(false);

    const llave = await tomarBloqueo("dux", 60_000);

    const integracion = await dux();
    expect(integracion.estado).toBe("ok");
    expect(integracion.sincronizando).toBe(true);
    expect(integracion.detalle).toContain("Hay una sincronización en curso.");

    await soltarBloqueo("dux", llave!);
    expect((await dux()).sincronizando).toBe(false);
  });

  it("un bloqueo vencido no cuenta: esa corrida murió", async () => {
    await conToken();
    await tomarBloqueo("dux", 60_000);
    await db.syncLock.updateMany({ data: { expiresAt: new Date(Date.now() - 3_600_000) } });

    expect((await dux()).sincronizando).toBe(false);
  });

  it("las fichas no cuentan para el estado: no le piden nada a DUX", async () => {
    await conToken();
    await tresBien();
    await corrida("fichas", { status: "error", startedAt: new Date() });

    expect((await dux()).estado).toBe("ok");
  });

  it("el historial no cuenta para el estado", async () => {
    await conToken();
    await tresBien();
    await corrida("ventas_historial:2026-10:1", { status: "error", startedAt: new Date() });

    expect((await dux()).estado).toBe("ok");
  });

  it("lo que no está conectado aparece pendiente, con su PR y sin datos", async () => {
    const conectadas = ["dux", "google", "tiendanube"];
    const pendientes = (await listarIntegraciones()).filter(({ id }) => !conectadas.includes(id));

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

describe("Tienda Nube", () => {
  const tienda = async () => (await listarIntegraciones()).find(({ id }) => id === "tiendanube");
  const conToken = () => guardarCredencial("tiendanube", "token-de-tienda-nube", { id: USUARIO, label: "Prueba" });
  const lectura = (cambios: Parameters<typeof corrida>[1] = {}) =>
    corrida("lectura", { integration: "tiendanube", ...cambios });
  const producto = (id: bigint, section: string | null) => ({
    id,
    sku: `S${id}-6`,
    name: "x",
    published: true,
    section,
    categoryIds: [],
    imageCount: 1,
    priceCents: 100n,
    readAt: new Date(),
  });

  afterEach(async () => {
    await db.storeProduct.deleteMany();
  });

  it("sin token, dice que falta y no muestra datos", async () => {
    expect(await tienda()).toMatchObject({
      estado: "pendiente",
      detalle: expect.stringContaining("Falta cargar el token"),
      metricas: [],
    });
  });

  it("con el token y sin leer, dice qué hacer", async () => {
    await conToken();

    expect(await tienda()).toMatchObject({ estado: "pendiente", detalle: expect.stringContaining("Leer la tienda") });
  });

  it("con todo en una sección, funciona, y muestra lo que leyó", async () => {
    await conToken();
    await lectura();
    await db.storeProduct.createMany({ data: [producto(1n, "MUJER"), producto(2n, "HOMBRE")] });

    expect(await tienda()).toMatchObject({
      estado: "ok",
      metricas: expect.arrayContaining([
        { label: "Productos", value: "2" },
        { label: "Fuera de las secciones", value: "0" },
      ]),
    });
  });

  it("un producto fuera de las secciones se avisa: no aparece en ningún menú", async () => {
    await conToken();
    await lectura();
    await db.storeProduct.createMany({ data: [producto(1n, null)] });

    expect(await tienda()).toMatchObject({
      estado: "degradado",
      detalle: "Hay 1 producto fuera de las secciones: no aparece en el menú de la tienda.",
    });
  });

  it("si falló la última lectura, lo dice", async () => {
    await conToken();
    await lectura({ status: "error", detail: "Tienda Nube rechazó el token." });

    expect(await tienda()).toMatchObject({ estado: "caido", detalle: "Tienda Nube rechazó el token." });
  });

  it("el registro la nombra", async () => {
    await lectura();

    expect((await registroDeSincronizaciones())[0]).toMatchObject({
      integracion: "Tienda Nube",
      operacion: "Lectura de la tienda",
    });
  });
});

describe("Google", () => {
  const google = async () => (await listarIntegraciones()).find(({ id }) => id === "google")!;
  const conClave = () =>
    guardarCredencial("google", '{"client_email":"a@b.c"}', { id: USUARIO, label: "Admin de Prueba" });
  const importacion = (cambios: Record<string, unknown> = {}) =>
    corrida("catalogo", { integration: "google", detail: "Productos: 2.", ...cambios });

  it("sin clave está pendiente, sin datos", async () => {
    expect(await google()).toMatchObject({ estado: "pendiente", metricas: [], ultimoSync: null, credencial: null });
  });

  it("con clave y sin importar, dice qué hacer", async () => {
    await conClave();

    expect(await google()).toMatchObject({
      estado: "pendiente",
      detalle: expect.stringContaining("Reimportar"),
      sincronizando: false,
    });
  });

  it("con una importación buena, está al día y muestra lo que hay", async () => {
    await conClave();
    const { finishedAt } = await importacion();

    const integracion = await google();

    expect(integracion).toMatchObject({ estado: "ok", ultimoSync: finishedAt!.toISOString() });
    expect(integracion.metricas.map(({ label }) => label)).toEqual([
      "Productos",
      "En las tres fuentes",
      "Filas del Sheet",
      "Archivos de Drive",
    ]);
  });

  it("si la última falló, lo dice, y el último sync sigue siendo el bueno", async () => {
    await conClave();
    const { finishedAt } = await importacion({
      startedAt: new Date(Date.now() - 120_000),
      finishedAt: new Date(Date.now() - 100_000),
    });
    await importacion({ status: "error", detail: "Google no respondió. El catálogo sigue como estaba." });

    expect(await google()).toMatchObject({
      estado: "caido",
      detalle: "Google no respondió. El catálogo sigue como estaba.",
      ultimoSync: finishedAt!.toISOString(),
    });
  });

  it("avisa si hay una importación en curso", async () => {
    await conClave();
    await tomarBloqueo("google", 60_000);

    expect(await google()).toMatchObject({
      sincronizando: true,
      detalle: expect.stringContaining("Hay una importación en curso."),
    });
  });

  it("no se mezcla con DUX", async () => {
    await conToken();
    await tresBien();
    await importacion({ status: "error" });

    expect((await dux()).estado).toBe("ok");
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

  it("nombra la importación del catálogo", async () => {
    await corrida("catalogo", { integration: "google" });

    expect(await registroDeSincronizaciones()).toMatchObject([
      { integracion: "Google", operacion: "Importación del catálogo" },
    ]);
  });

  it("nombra el armado de las fichas", async () => {
    await corrida("fichas");

    const [fila] = await registroDeSincronizaciones();

    expect(fila?.operacion).toBe("Fichas de clientas");
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
