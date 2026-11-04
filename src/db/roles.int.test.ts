import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { aplicarUsuarios, type Consulta } from "./roles";

// Corre en la branch efímera de npm run test:int: las contraseñas nuevas no tocan develop.
const directa = process.env.DATABASE_URL_UNPOOLED ?? "";
const comoDueño = conexion(directa);

function conexion(url: string) {
  const sql = neon(url);
  return ((texto: string) => sql.query(texto)) as Consulta;
}

function como(usuario: string, password: string) {
  const url = new URL(directa);
  url.username = usuario;
  url.password = password;
  return conexion(url.toString());
}

const passwords = { app: randomBytes(24).toString("base64url"), readonly: randomBytes(24).toString("base64url") };
const app = como("app", passwords.app);
const readonly = como("readonly", passwords.readonly);
const throttle = `test:roles-${Date.now()}`;

beforeAll(async () => {
  const [fila] = await comoDueño("SELECT current_user AS dueño");
  await aplicarUsuarios(comoDueño, { dueño: String(fila?.dueño), passwords });
});

describe("usuarios de la base", () => {
  it("app lee y escribe datos", async () => {
    await app(`INSERT INTO login_throttles (key, window_started_at, updated_at) VALUES ('${throttle}', now(), now())`);
    await app(`UPDATE login_throttles SET failures = 1 WHERE key = '${throttle}'`);
    expect(await app(`SELECT failures FROM login_throttles WHERE key = '${throttle}'`)).toEqual([{ failures: 1 }]);
    await app(`DELETE FROM login_throttles WHERE key = '${throttle}'`);
  });

  it("app no puede borrar, vaciar ni cambiar una tabla, ni crear una", async () => {
    await expect(app("DROP TABLE login_throttles")).rejects.toThrow(/must be owner/);
    await expect(app("ALTER TABLE login_throttles ADD COLUMN x int")).rejects.toThrow(/must be owner/);
    await expect(app("TRUNCATE login_throttles")).rejects.toThrow(/permission denied/);
    await expect(app("CREATE TABLE intrusa (id int)")).rejects.toThrow(/permission denied for schema public/);
  });

  it("app agrega a la auditoría pero no la cambia ni la borra", async () => {
    await expect(app("UPDATE audit_logs SET action = 'x' WHERE false")).rejects.toThrow(/permission denied/);
    await expect(app("DELETE FROM audit_logs WHERE false")).rejects.toThrow(/permission denied/);
    await expect(app("DELETE FROM _prisma_migrations WHERE false")).rejects.toThrow(/permission denied/);
  });

  it("readonly lee pero no escribe", async () => {
    await expect(readonly("SELECT count(*) FROM users")).resolves.toHaveLength(1);
    await expect(
      readonly(`INSERT INTO login_throttles (key, window_started_at, updated_at) VALUES ('${throttle}', now(), now())`),
    ).rejects.toThrow(/permission denied/);
    await expect(readonly("DROP TABLE login_throttles")).rejects.toThrow(/must be owner/);
  });

  it("las tablas que crea una migración después ya nacen con los permisos", async () => {
    const tabla = `roles_test_${Date.now()}`;
    await comoDueño(`CREATE TABLE ${tabla} (id serial PRIMARY KEY, valor text)`);
    try {
      await app(`INSERT INTO ${tabla} (valor) VALUES ('nueva')`);
      expect(await readonly(`SELECT valor FROM ${tabla}`)).toEqual([{ valor: "nueva" }]);
      await expect(readonly(`DELETE FROM ${tabla}`)).rejects.toThrow(/permission denied/);
    } finally {
      await comoDueño(`DROP TABLE ${tabla}`);
    }
  });

  it("volver a aplicarlo no cambia nada ni falla", async () => {
    const [fila] = await comoDueño("SELECT current_user AS dueño");
    await aplicarUsuarios(comoDueño, { dueño: String(fila?.dueño) });
    await expect(app("SELECT 1 AS ok")).resolves.toEqual([{ ok: 1 }]);
  });
});
