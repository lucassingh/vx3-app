import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { getAuth } from "../auth/auth";
import { cargarCredencial, probarIntegracion, sincronizarIntegracion } from "./actions";
import { credencialEnmascarada, leerCredencial } from "./service";

// Las acciones leen la sesión de los headers del request: acá, los del usuario de prueba.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
const workflow = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("workflow/api", () => workflow);

const db = getDb();
const sufijo = Date.now();
const email = (nombre: string) => `${nombre}+cred${sufijo}@vx3.test`;
const PASSWORD = "contraseña del usuario de prueba";
const TOKEN = "token-de-prueba-7c1e";
const OTRO_TOKEN = "otro-token-de-prueba-9f2a";

async function entrar(correo: string) {
  const { headers } = await getAuth().api.signInEmail({
    body: { email: correo, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = /((?:__Secure-)?vx3\.session_token=[^;]+)/.exec(headers.get("set-cookie") ?? "")?.[1];
  if (!cookie) throw new Error("No vino la cookie de sesión");
  return new Headers({ cookie });
}

let admin = new Headers();
let operaciones = new Headers();

beforeAll(async () => {
  const crear = (nombre: string, role: "admin" | "operaciones") =>
    getAuth().api.createUser({ body: { email: email(nombre), name: `Prueba ${nombre}`, password: PASSWORD, role } });
  await crear("admin", "admin");
  await crear("operaciones", "operaciones");
  admin = await entrar(email("admin"));
  operaciones = await entrar(email("operaciones"));
});

beforeEach(async () => {
  vi.stubEnv("CREDENTIALS_KEY", randomBytes(32).toString("base64url"));
  vi.stubEnv("APP_ENV", "qa");
  await db.integrationCredential.deleteMany();
  request.headers = admin;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.integrationCredential.deleteMany();
  await db.user.deleteMany({ where: { email: { endsWith: `+cred${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

describe("cargar una credencial", () => {
  it("guarda el valor cifrado y devuelve solo la máscara", async () => {
    expect(await cargarCredencial({ integracion: "dux", valor: `  ${TOKEN}  ` })).toEqual({
      ok: true,
      data: { mascara: "••••7c1e" },
    });

    const fila = await db.integrationCredential.findUnique({ where: { integration: "dux" } });
    expect(JSON.stringify(fila)).not.toContain(TOKEN);
    expect(await leerCredencial("dux")).toBe(TOKEN);
    expect(await credencialEnmascarada("dux")).toMatchObject({ mascara: "••••7c1e", cargadaPor: "Prueba admin" });
  });

  it("deja el cambio en la auditoría, sin el valor", async () => {
    await cargarCredencial({ integracion: "dux", valor: TOKEN });
    await cargarCredencial({ integracion: "dux", valor: OTRO_TOKEN });

    const registro = await db.auditLog.findFirst({
      where: { action: "credencial.cargada", entityId: "dux" },
      orderBy: { occurredAt: "desc" },
    });
    expect(registro).toMatchObject({
      actorLabel: "Prueba admin",
      before: { mascara: "••••7c1e" },
      after: { integracion: "DUX", mascara: "••••9f2a" },
    });
    expect(JSON.stringify(registro)).not.toContain(TOKEN);
    expect(JSON.stringify(registro)).not.toContain(OTRO_TOKEN);
  });

  it("reemplazarla deja una sola fila, con el valor nuevo", async () => {
    await cargarCredencial({ integracion: "dux", valor: TOKEN });
    await cargarCredencial({ integracion: "dux", valor: OTRO_TOKEN });

    expect(await db.integrationCredential.count({ where: { integration: "dux" } })).toBe(1);
    expect(await leerCredencial("dux")).toBe(OTRO_TOKEN);
  });

  it("un rol sin permiso no puede cargarla", async () => {
    request.headers = operaciones;

    expect(await cargarCredencial({ integracion: "dux", valor: TOKEN })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await db.integrationCredential.count()).toBe(0);
  });

  it("rechaza un valor demasiado corto, sin repetirlo en el error", async () => {
    const result = await cargarCredencial({ integracion: "dux", valor: "abc" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(JSON.stringify(result)).not.toContain('abc"');
    expect(await db.integrationCredential.count()).toBe(0);
  });

  it("sin clave maestra lo dice claro y no guarda nada", async () => {
    vi.stubEnv("CREDENTIALS_KEY", "");

    expect(await cargarCredencial({ integracion: "dux", valor: TOKEN })).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("CREDENTIALS_KEY") },
    });
    expect(await db.integrationCredential.count()).toBe(0);
  });
});

describe("sincronizar", () => {
  beforeEach(async () => {
    await db.syncLock.deleteMany();
    workflow.start.mockReset();
    workflow.start.mockResolvedValue({ runId: "wrun_01" });
  });

  it("un admin la lanza, y queda como corrida manual a su nombre", async () => {
    expect(await sincronizarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: true,
      data: { runId: "wrun_01" },
    });

    const [, [origen]] = workflow.start.mock.calls[0] as [unknown, [unknown]];
    expect(origen).toEqual({ trigger: "manual", triggeredBy: "Prueba admin" });
    await db.syncLock.deleteMany();
  });

  it("con una corrida en curso avisa, y no lanza otra", async () => {
    await sincronizarIntegracion({ integracion: "dux" });

    expect(await sincronizarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("en curso") },
    });
    expect(workflow.start).toHaveBeenCalledOnce();
    await db.syncLock.deleteMany();
  });

  it("un rol sin permiso no puede lanzarla", async () => {
    request.headers = operaciones;

    expect(await sincronizarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(workflow.start).not.toHaveBeenCalled();
  });
});

describe("probar la conexión", () => {
  beforeEach(() => {
    vi.stubEnv("DUX_ID_EMPRESA", "9432");
    vi.stubEnv("DUX_ID_SUCURSAL_ECOMMERCE", "1");
  });

  it("sin token, lo dice como resultado de la prueba y no llama a DUX", async () => {
    const fetchDux = vi.spyOn(globalThis, "fetch");

    expect(await probarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: true,
      data: { ok: false, mensaje: expect.stringContaining("Todavía no se cargó el token") },
    });
    expect(fetchDux.mock.calls.filter(([url]) => String(url).includes("duxsoftware"))).toHaveLength(0);
    fetchDux.mockRestore();
  });

  it("sin clave maestra en el ambiente, como en una preview, no puede conectarse", async () => {
    await cargarCredencial({ integracion: "dux", valor: TOKEN });
    vi.stubEnv("CREDENTIALS_KEY", "");

    expect(await probarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: true,
      data: { ok: false, mensaje: expect.stringContaining("CREDENTIALS_KEY") },
    });
  });

  it("una preview no se conecta, aunque vea la clave: comparte las variables con QA", async () => {
    await cargarCredencial({ integracion: "dux", valor: TOKEN });
    vi.stubEnv("APP_ENV", "preview");

    expect(await probarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: true,
      data: { ok: false, mensaje: expect.stringContaining("CREDENTIALS_KEY") },
    });
  });

  it("un rol sin permiso no puede probarla", async () => {
    request.headers = operaciones;

    expect(await probarIntegracion({ integracion: "dux" })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});

describe("leer una credencial", () => {
  it("sin cargar da null", async () => {
    expect(await leerCredencial("dux")).toBeNull();
    expect(await credencialEnmascarada("dux")).toBeNull();
  });

  it("si cambió la clave maestra pide volver a cargarla", async () => {
    await cargarCredencial({ integracion: "dux", valor: TOKEN });
    vi.stubEnv("CREDENTIALS_KEY", randomBytes(32).toString("base64url"));

    await expect(leerCredencial("dux")).rejects.toThrow(/Volvé a cargarla/);
  });
});
