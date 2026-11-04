import { describe, expect, it, vi } from "vitest";
import { aplicarUsuarios, sentenciaDeUsuario, sentenciasDePermisos } from "./roles";

describe("usuarios de la base", () => {
  it("no acepta una contraseña corta o con caracteres que romperían la sentencia", () => {
    expect(() => sentenciaDeUsuario("app", "corta")).toThrow(/24 caracteres/);
    expect(() => sentenciaDeUsuario("app", "x".repeat(30) + "'; DROP ROLE app; --")).toThrow();
  });

  it("crea el usuario o le cambia la contraseña si ya existe", () => {
    const sentencia = sentenciaDeUsuario("readonly", "a".repeat(32));
    expect(sentencia).toContain(`ALTER ROLE "readonly" WITH LOGIN PASSWORD '${"a".repeat(32)}'`);
    expect(sentencia).toContain(`CREATE ROLE "readonly" WITH LOGIN PASSWORD '${"a".repeat(32)}'`);
  });

  it("da permisos para las tablas futuras del dueño", () => {
    const sentencias = sentenciasDePermisos("neondb_owner");
    expect(sentencias).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE "neondb_owner" IN SCHEMA public GRANT SELECT ON TABLES TO readonly',
    );
    expect(sentencias.some((sentencia) => /GRANT .*(CREATE|TRUNCATE)/.test(sentencia))).toBe(false);
  });

  it("si falta un usuario y no vino su contraseña, no aplica nada a medias", async () => {
    const consulta = vi.fn(async (texto: string) => (texto.includes("'readonly'") ? [] : [{ "?column?": 1 }]));

    await expect(aplicarUsuarios(consulta, { dueño: "neondb_owner" })).rejects.toThrow(/readonly no existe/);
    expect(consulta.mock.calls.some(([texto]) => texto.startsWith("GRANT"))).toBe(false);
  });
});
