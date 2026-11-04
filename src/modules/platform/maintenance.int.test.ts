import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { limpiarIntentosDeLogin, limpiarSesiones } from "@/workflows/mantenimiento";

// Sin el compilador de workflow, "use step" no hace nada: los pasos se prueban como funciones.
const db = getDb();
const HORA = 60 * 60 * 1000;
const prefijo = `test:mantenimiento-${Date.now()}`;

afterAll(async () => {
  await db.loginThrottle.deleteMany({ where: { key: { startsWith: prefijo } } });
  await db.$disconnect();
});

async function intento(key: string, horasDesdeElUltimo: number, bloqueadoPorHoras: number | null) {
  const ahora = Date.now();
  await db.$executeRaw`
    INSERT INTO login_throttles (key, failures, window_started_at, lockouts, locked_until, updated_at)
    VALUES (${key}, 1, ${new Date(ahora - horasDesdeElUltimo * HORA)}, 1,
      ${bloqueadoPorHoras === null ? null : new Date(ahora + bloqueadoPorHoras * HORA)},
      ${new Date(ahora - horasDesdeElUltimo * HORA)})`;
}

describe("mantenimiento diario", () => {
  it("borra los intentos de login viejos y deja los recientes y los bloqueos vigentes", async () => {
    await intento(`${prefijo}:viejo`, 30, null);
    await intento(`${prefijo}:viejo-con-bloqueo-vencido`, 30, -5);
    await intento(`${prefijo}:reciente`, 2, null);
    await intento(`${prefijo}:bloqueado`, 30, 1);

    expect(await limpiarIntentosDeLogin()).toBeGreaterThanOrEqual(2);

    const quedan = await db.loginThrottle.findMany({ where: { key: { startsWith: prefijo } }, select: { key: true } });
    expect(quedan.map(({ key }) => key).sort()).toEqual([`${prefijo}:bloqueado`, `${prefijo}:reciente`]);
  });

  it("borra las sesiones vencidas y deja las vigentes", async () => {
    const user = await db.user.create({
      data: { id: newId(), name: "Mantenimiento", email: `${prefijo}@vx3.test`, role: "solo_lectura" },
    });
    const sesion = (token: string, horas: number) => ({
      id: newId(),
      token: `${prefijo}-${token}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + horas * HORA),
    });
    await db.session.createMany({ data: [sesion("vencida", -1), sesion("vigente", 24)] });

    try {
      expect(await limpiarSesiones()).toBeGreaterThanOrEqual(1);
      const quedan = await db.session.findMany({ where: { userId: user.id }, select: { token: true } });
      expect(quedan).toEqual([{ token: `${prefijo}-vigente` }]);

      expect(await limpiarSesiones()).toBe(0);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });
});
