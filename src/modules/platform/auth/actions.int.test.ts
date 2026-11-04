import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { signIn } from "./actions";
import { getAuth } from "./auth";

// El login lee la IP de los headers del request y escribe la cookie con cookies().
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const db = getDb();
const sufijo = Date.now();
const email = `limite+${sufijo}@vx3.test`;
const password = "la contraseña correcta";

beforeAll(async () => {
  await getAuth().api.createUser({ body: { email, name: "Prueba Límite", password } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: `+${sufijo}@vx3.test` } } });
  await db.loginThrottle.deleteMany({ where: { key: { contains: String(sufijo) } } });
  await db.$disconnect();
});

describe("límite de intentos en el login", () => {
  it("al quinto fallo bloquea, y bloqueado rechaza aunque la contraseña sea correcta", async () => {
    request.headers = new Headers({ "x-forwarded-for": `10.${sufijo % 250}.0.1` });

    for (let intento = 1; intento <= 4; intento++) {
      expect(await signIn({ identifier: email, password: "una equivocada" })).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
    }
    expect(await signIn({ identifier: email, password: "una equivocada" })).toMatchObject({
      ok: false,
      error: { code: "TOO_MANY_REQUESTS", message: expect.stringContaining("15 minutos") },
    });
    expect(await signIn({ identifier: email, password })).toMatchObject({
      ok: false,
      error: { code: "TOO_MANY_REQUESTS" },
    });

    const registro = await db.auditLog.findMany({
      where: { entityType: "login", after: { path: ["identificador"], equals: email } },
      orderBy: { occurredAt: "asc" },
    });
    expect(registro.map((fila) => fila.action)).toEqual([...Array(4).fill("acceso.fallido"), "acceso.bloqueo"]);
  });

  it("pasada la espera vuelve a dejar entrar, y entrar limpia el contador", async () => {
    await db.loginThrottle.update({
      where: { key: `user:${email}` },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    expect(await signIn({ identifier: email, password })).toMatchObject({ ok: true, data: { name: "Prueba Límite" } });
    expect(await db.loginThrottle.findUnique({ where: { key: `user:${email}` } })).toBeNull();
    const usuario = await db.user.findUnique({ where: { email } });
    expect(usuario?.lastLoginAt).toBeInstanceOf(Date);
    expect(await db.auditLog.findFirst({ where: { action: "acceso.entrada", actorId: usuario?.id } })).not.toBeNull();
  });
});
