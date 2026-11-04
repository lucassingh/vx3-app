import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { getAuth } from "./auth";

const db = getDb();
const sufijo = Date.now();
const emailDePrueba = (nombre: string) => `${nombre}+${sufijo}@vx3.test`;

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: `+${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

/** "vx3.session_token=…; Path=/; …" → "vx3.session_token=…", para mandarla como cookie. */
function cookieDeSesion(headers: Headers) {
  const setCookie = headers.get("set-cookie") ?? "";
  const match = /((?:__Secure-)?vx3\.session_token=[^;]+)/.exec(setCookie);
  if (!match?.[1]) throw new Error(`No vino la cookie de sesión: ${setCookie}`);
  return new Headers({ cookie: match[1] });
}

describe("Better Auth con Prisma", () => {
  it("crea un usuario, entra, lee la sesión y sale", async () => {
    const auth = getAuth();
    const email = emailDePrueba("operaciones");
    const password = "una contraseña bien larga";

    await auth.api.createUser({ body: { email, name: "Prueba Operaciones", password, role: "operaciones" } });

    const cuenta = await db.account.findFirst({ where: { user: { email } } });
    expect(cuenta?.providerId).toBe("credential");
    expect(cuenta?.password).toBeTruthy();
    expect(cuenta?.password).not.toContain(password);

    const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const conCookie = cookieDeSesion(headers);

    const sesion = await auth.api.getSession({ headers: conCookie });
    expect(sesion?.user).toMatchObject({ email, role: "operaciones", mustChangePassword: false });
    expect(sesion?.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);

    await auth.api.signOut({ headers: conCookie });
    expect(await auth.api.getSession({ headers: conCookie })).toBeNull();
  });

  it("rechaza una contraseña equivocada", async () => {
    const auth = getAuth();
    const email = emailDePrueba("rechazo");
    await auth.api.createUser({ body: { email, name: "Prueba Rechazo", password: "la contraseña correcta" } });

    await expect(auth.api.signInEmail({ body: { email, password: "otra contraseña larga" } })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("cambiar la contraseña cierra las otras sesiones y la vieja deja de andar", async () => {
    const auth = getAuth();
    const email = emailDePrueba("cambio");
    const vieja = "la contraseña temporal";
    const nueva = "la contraseña nueva y mía";
    await auth.api.createUser({ body: { email, name: "Prueba Cambio", password: vieja } });

    const enLaCompu = cookieDeSesion(
      (await auth.api.signInEmail({ body: { email, password: vieja }, returnHeaders: true })).headers,
    );
    const enElCelular = cookieDeSesion(
      (await auth.api.signInEmail({ body: { email, password: vieja }, returnHeaders: true })).headers,
    );

    await auth.api.changePassword({
      body: { currentPassword: vieja, newPassword: nueva, revokeOtherSessions: true },
      headers: enLaCompu,
    });

    expect(await auth.api.getSession({ headers: enElCelular })).toBeNull();
    await expect(auth.api.signInEmail({ body: { email, password: vieja } })).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(auth.api.signInEmail({ body: { email, password: nueva } })).resolves.toHaveProperty("user");
  });

  it("npm run auth:create-admin crea un admin con una contraseña temporal que hay que cambiar", async () => {
    const email = emailDePrueba("admin");
    const resultado = spawnSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--conditions=react-server",
        "scripts/create-admin.ts",
        "--email",
        email,
        "--nombre",
        "Prueba Admin",
        "--usuario",
        `admin${sufijo}`,
      ],
      { encoding: "utf8", env: process.env, timeout: 60_000 },
    );

    expect(resultado.status, resultado.stderr).toBe(0);
    const password = /^\s{2}(\S{4}-\S{4}-\S{4}-\S{4})$/m.exec(resultado.stdout)?.[1];
    expect(password).toBeDefined();

    const { user } = await getAuth().api.signInUsername({ body: { username: `admin${sufijo}`, password: password! } });
    expect(user).toMatchObject({ email, role: "admin", mustChangePassword: true });
  });
});
