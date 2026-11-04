import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { abrirCorrida, soltarBloqueo, tomarBloqueo } from "./sync-runs";

const db = getDb();
const HORA = 3_600_000;

beforeEach(async () => {
  await db.syncLock.deleteMany();
  await db.syncRun.deleteMany();
});

afterAll(async () => {
  await db.syncLock.deleteMany();
  await db.syncRun.deleteMany();
  await db.$disconnect();
});

const vencer = () =>
  db.syncLock.updateMany({ where: { integration: "dux" }, data: { expiresAt: new Date(Date.now() - 1000) } });

describe("bloqueo de corridas", () => {
  it("de varios pedidos simultáneos, gana uno solo", async () => {
    const pedidos = await Promise.all(Array.from({ length: 8 }, () => tomarBloqueo("dux", HORA)));

    expect(pedidos.filter(Boolean)).toHaveLength(1);
  });

  it("tomado, no se puede volver a tomar; suelto, sí", async () => {
    const llave = await tomarBloqueo("dux", HORA);
    expect(await tomarBloqueo("dux", HORA)).toBeNull();

    await soltarBloqueo("dux", llave!);

    expect(await tomarBloqueo("dux", HORA)).not.toBeNull();
  });

  it("cada integración tiene el suyo", async () => {
    expect(await tomarBloqueo("dux", HORA)).not.toBeNull();
    expect(await tomarBloqueo("tiendanube", HORA)).not.toBeNull();
  });

  it("si un Workflow murió sin soltarlo, vence y no traba para siempre", async () => {
    await tomarBloqueo("dux", HORA);
    await vencer();

    expect(await tomarBloqueo("dux", HORA)).not.toBeNull();
  });

  it("al tomarlo, cierra lo que quedó colgado de una corrida que murió", async () => {
    await tomarBloqueo("dux", HORA);
    const { id } = await abrirCorrida("dux", "items", { trigger: "cron" });
    await vencer();

    await tomarBloqueo("dux", HORA);

    const corrida = await db.syncRun.findUniqueOrThrow({ where: { id } });
    expect(corrida.status).toBe("error");
    expect(corrida.detail).toBe("La corrida se cortó antes de terminar.");
    expect(corrida.finishedAt).not.toBeNull();
  });

  it("al soltarlo, cierra lo que quedó abierto si algo reventó", async () => {
    const llave = await tomarBloqueo("dux", HORA);
    const { id } = await abrirCorrida("dux", "ventas", { trigger: "cron" });

    await soltarBloqueo("dux", llave!);

    expect((await db.syncRun.findUniqueOrThrow({ where: { id } })).status).toBe("error");
  });

  it("una corrida vieja que termina tarde no toca a la nueva", async () => {
    const vieja = await tomarBloqueo("dux", HORA);
    await vencer();
    await tomarBloqueo("dux", HORA);
    const { id } = await abrirCorrida("dux", "items", { trigger: "cron" });

    await soltarBloqueo("dux", vieja!);

    expect(await tomarBloqueo("dux", HORA)).toBeNull();
    expect((await db.syncRun.findUniqueOrThrow({ where: { id } })).status).toBe("en_curso");
  });

  it("no cierra las corridas de otra integración", async () => {
    const { id } = await abrirCorrida("tiendanube", "items", { trigger: "cron" });

    await tomarBloqueo("dux", HORA);

    expect((await db.syncRun.findUniqueOrThrow({ where: { id } })).status).toBe("en_curso");
  });
});
