import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { getAuth } from "../auth/auth";
import {
  cambiarRol,
  cerrarSesiones,
  crearUsuario,
  desactivarUsuario,
  reactivarUsuario,
  resetearPassword,
} from "./actions";

// Las acciones leen la sesión de los headers del request: acá, los del admin de prueba.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

const db = getDb();
const sufijo = Date.now();
const email = (nombre: string) => `${nombre}+${sufijo}@vx3.test`;

async function entrar(correo: string, password: string) {
  const { headers } = await getAuth().api.signInEmail({ body: { email: correo, password }, returnHeaders: true });
  const cookie = /((?:__Secure-)?vx3\.session_token=[^;]+)/.exec(headers.get("set-cookie") ?? "")?.[1];
  if (!cookie) throw new Error("No vino la cookie de sesión");
  return new Headers({ cookie });
}

let adminId = "";

beforeAll(async () => {
  const password = "contraseña del admin de prueba";
  const { user } = await getAuth().api.createUser({
    body: { email: email("admin"), name: "Admin Prueba", password, role: "admin" },
  });
  adminId = user.id;
  request.headers = await entrar(email("admin"), password);
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: `+${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

async function crear(nombre: string, rol: "operaciones" | "postventa" = "operaciones") {
  const result = await crearUsuario({ nombre: `Prueba ${nombre}`, email: email(nombre), usuario: "", rol });
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

describe("gestión de usuarios", () => {
  it("crea un usuario con contraseña temporal que hay que cambiar", async () => {
    const { id, passwordTemporal } = await crear("leo");

    const { user } = await getAuth().api.signInEmail({ body: { email: email("leo"), password: passwordTemporal } });
    expect(user).toMatchObject({ id, role: "operaciones", mustChangePassword: true });
    expect(await crearUsuario({ nombre: "Otro Leo", email: email("leo"), rol: "compras" })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("cambia el rol, pero no el propio", async () => {
    const { id } = await crear("lucia", "postventa");

    expect(await cambiarRol({ userId: id, rol: "compras" })).toEqual({ ok: true, data: null });
    expect((await db.user.findUnique({ where: { id } }))?.role).toBe("compras");
    // Queda en el registro, a nombre del admin, con el antes y el después.
    expect(await db.auditLog.findFirst({ where: { action: "usuario.rol", entityId: id } })).toMatchObject({
      actorId: adminId,
      actorLabel: "Admin Prueba",
      before: { nombre: "Prueba lucia", rol: "postventa" },
      after: { nombre: "Prueba lucia", rol: "compras" },
      requestId: expect.any(String),
    });
    expect(await cambiarRol({ userId: adminId, rol: "solo_lectura" })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("desactivar bloquea el ingreso y cierra las sesiones; reactivar lo devuelve", async () => {
    const { id, passwordTemporal } = await crear("juan");
    const suSesion = await entrar(email("juan"), passwordTemporal);

    expect((await desactivarUsuario({ userId: id })).ok).toBe(true);
    expect(await getAuth().api.getSession({ headers: suSesion })).toBeNull();
    await expect(entrar(email("juan"), passwordTemporal)).rejects.toMatchObject({ statusCode: 403 });

    expect((await reactivarUsuario({ userId: id })).ok).toBe(true);
    await expect(entrar(email("juan"), passwordTemporal)).resolves.toBeInstanceOf(Headers);

    expect(await desactivarUsuario({ userId: adminId })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("cerrar sesiones lo saca de todos los dispositivos, pero puede volver a entrar", async () => {
    const { id, passwordTemporal } = await crear("ana");
    const enLaCompu = await entrar(email("ana"), passwordTemporal);
    const enElCelular = await entrar(email("ana"), passwordTemporal);

    expect((await cerrarSesiones({ userId: id })).ok).toBe(true);
    expect(await getAuth().api.getSession({ headers: enLaCompu })).toBeNull();
    expect(await getAuth().api.getSession({ headers: enElCelular })).toBeNull();
    await expect(entrar(email("ana"), passwordTemporal)).resolves.toBeInstanceOf(Headers);
  });

  it("resetear la contraseña invalida la anterior y pide cambiarla", async () => {
    const { id, passwordTemporal: primera } = await crear("sofi");
    await db.user.update({ where: { id }, data: { mustChangePassword: false } });

    const result = await resetearPassword({ userId: id });
    if (!result.ok) throw new Error(result.error.message);

    await expect(entrar(email("sofi"), primera)).rejects.toMatchObject({ statusCode: 401 });
    const { user } = await getAuth().api.signInEmail({
      body: { email: email("sofi"), password: result.data.passwordTemporal },
    });
    expect(user).toMatchObject({ mustChangePassword: true });

    // El registro nunca guarda la contraseña temporal.
    const registro = await db.auditLog.findFirst({ where: { action: "usuario.password_reseteada", entityId: id } });
    expect(registro?.after).toEqual({ nombre: "Prueba sofi" });
    expect(JSON.stringify(registro)).not.toContain(result.data.passwordTemporal);
  });

  it("alguien que no es admin no puede hacer nada de esto", async () => {
    const { passwordTemporal } = await crear("marta", "postventa");
    const comoAdmin = request.headers;
    request.headers = await entrar(email("marta"), passwordTemporal);
    try {
      expect(await crearUsuario({ nombre: "Intruso", email: email("intruso"), rol: "admin" })).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
      expect(await desactivarUsuario({ userId: adminId })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    } finally {
      request.headers = comoAdmin;
    }
  });
});
