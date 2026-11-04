import { describe, expect, it } from "vitest";
import { estadoDeDux, type UltimaCorrida } from "./estado";

const AHORA = new Date("2026-11-04T12:00:00Z");
const HACE_UNA_HORA = new Date("2026-11-04T11:00:00Z");

const corrida = (operation: string, cambios: Partial<UltimaCorrida> = {}): UltimaCorrida => ({
  operation,
  status: "ok",
  finishedAt: HACE_UNA_HORA,
  detail: "Bien.",
  ...cambios,
});
const TODAS_OK = [corrida("items"), corrida("ventas"), corrida("clientas")];

const estado = (ultimas: UltimaCorrida[], tieneCredencial = true) =>
  estadoDeDux({ tieneCredencial, ultimas, ahora: AHORA });

describe("estadoDeDux", () => {
  it("sin el token está pendiente, y dice qué hacer", () => {
    expect(estado([], false)).toEqual({
      estado: "pendiente",
      motivo: "Todavía no se cargó el token: cargalo para empezar a sincronizar.",
    });
  });

  it("con el token y sin ninguna corrida también está pendiente: no inventa que anda", () => {
    expect(estado([]).estado).toBe("pendiente");
  });

  it("con las tres lecturas bien y al día, funciona", () => {
    expect(estado(TODAS_OK).estado).toBe("ok");
  });

  it("si una lectura tuvo errores, está degradado y dice cuál y por qué", () => {
    const ultimas = [corrida("items"), corrida("ventas", { status: "con_errores", detail: "Faltó una página." })];

    expect(estado([...ultimas, corrida("clientas")])).toEqual({
      estado: "degradado",
      motivo: "Ventas: Faltó una página.",
    });
  });

  it("si falla una sola lectura del todo, está degradado: el resto sigue andando", () => {
    expect(estado([corrida("items"), corrida("ventas", { status: "error" }), corrida("clientas")]).estado).toBe(
      "degradado",
    );
  });

  it("si fallan las tres del todo, está caído, con el motivo", () => {
    const motivo = "DUX rechazó el token: revisá que esté bien cargado.";
    const ultimas = ["items", "ventas", "clientas"].map((op) => corrida(op, { status: "error", detail: motivo }));

    expect(estado(ultimas)).toEqual({ estado: "caido", motivo: `Productos, stock y precios: ${motivo}` });
  });

  it("si fallan las tres pero alguna leyó algo, no está caído", () => {
    const ultimas = [
      corrida("items", { status: "error" }),
      corrida("ventas", { status: "con_errores" }),
      corrida("clientas", { status: "error" }),
    ];

    expect(estado(ultimas).estado).toBe("degradado");
  });

  it("una lectura que nunca corrió no pasa por buena", () => {
    expect(estado([corrida("items"), corrida("ventas")])).toEqual({
      estado: "degradado",
      motivo: "Clientas: todavía no se leyó.",
    });
  });

  it("todo bien pero viejo está degradado: el cron pudo haber dejado de correr", () => {
    const hace30 = new Date("2026-11-03T06:00:00Z");
    const ultimas = ["items", "ventas", "clientas"].map((op) => corrida(op, { finishedAt: hace30 }));

    expect(estado(ultimas)).toEqual({
      estado: "degradado",
      motivo: "La última sincronización terminó hace 30 horas.",
    });
  });

  it("un día justo todavía está al día: la corrida es diaria", () => {
    const hace25 = new Date("2026-11-03T11:00:00Z");
    const ultimas = ["items", "ventas", "clientas"].map((op) => corrida(op, { finishedAt: hace25 }));

    expect(estado(ultimas).estado).toBe("ok");
  });
});
