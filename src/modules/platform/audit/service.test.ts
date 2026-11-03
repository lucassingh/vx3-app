import { describe, expect, it } from "vitest";
import { aEntrada, sanitize } from "./service";

const fila = (action: string, before: unknown = null, after: unknown = null) => ({
  id: "a-1",
  occurredAt: new Date("2026-11-03T13:00:00Z"),
  actorId: "u-1",
  actorLabel: "Elías Llaury",
  action,
  before,
  after,
});

describe("sanitize", () => {
  it("oculta contraseñas, tokens y cookies a cualquier profundidad", () => {
    expect(
      sanitize({
        nombre: "Leo",
        password: "x",
        passwordTemporal: "k7Pm-x2Qa",
        headers: { cookie: "vx3.session_token=abc", accept: "json" },
        sesiones: [{ token: "t1", ip: "1.2.3.4" }],
      }),
    ).toEqual({
      nombre: "Leo",
      password: "[oculto]",
      passwordTemporal: "[oculto]",
      headers: { cookie: "[oculto]", accept: "json" },
      sesiones: [{ token: "[oculto]", ip: "1.2.3.4" }],
    });
  });

  it("deja igual lo que no es un objeto", () => {
    expect(sanitize("texto")).toBe("texto");
    expect(sanitize(null)).toBeNull();
    expect(sanitize(3)).toBe(3);
  });
});

describe("cómo se lee cada acción", () => {
  it("un cambio de rol muestra el rol de antes y el de después", () => {
    expect(
      aEntrada(fila("usuario.rol", { nombre: "Lucía", rol: "postventa" }, { nombre: "Lucía", rol: "compras" })),
    ).toEqual({
      id: "a-1",
      usuarioId: "u-1",
      usuario: "Elías Llaury",
      categoria: "accesos",
      accion: "Cambió el rol de Lucía",
      antes: "Post-venta",
      despues: "Compras",
      en: "2026-11-03T13:00:00.000Z",
    });
  });

  it("cada acción de acceso y de usuarios tiene su texto", () => {
    expect(aEntrada(fila("usuario.creado", null, { nombre: "Leo", rol: "operaciones" })).accion).toBe(
      "Creó el usuario de Leo (Operaciones)",
    );
    expect(aEntrada(fila("acceso.fallido", null, { identificador: "leo", ip: "1.2.3.4" })).accion).toBe(
      "Intento de ingreso fallido como “leo”",
    );
    expect(aEntrada(fila("usuario.password_reseteada", null, { nombre: "Sofi" })).accion).toBe(
      "Reseteó la contraseña de Sofi",
    );
  });

  it("una acción que todavía no tiene texto se muestra con su código", () => {
    expect(aEntrada({ ...fila("stock.ajuste"), actorId: null })).toMatchObject({
      accion: "stock.ajuste",
      usuarioId: "",
    });
  });
});
