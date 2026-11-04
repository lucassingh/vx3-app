import { describe, expect, it } from "vitest";
import { clasificarRespuestaDux } from "./respuesta";

const leer = (status: number, cuerpo: unknown) => clasificarRespuestaDux({ status, cuerpo });

describe("clasificarRespuestaDux", () => {
  it("con datos, es una respuesta buena: v2 y v1", () => {
    expect(leer(200, { datos: [], paginacion: {} })).toEqual({ tipo: "ok" });
    expect(leer(200, { results: [], paging: {} })).toEqual({ tipo: "ok" });
  });

  it("reintenta el 200 con 'Formato desconocido' de la v1 (S-1 y cruce del 04/11)", () => {
    expect(leer(200, { message: "Formato desconocido." })).toMatchObject({
      tipo: "reintentar",
      motivo: "Formato desconocido.",
    });
  });

  it("reintenta el 400 con 'Formato desconocido' de la v2, a un request válido", () => {
    expect(leer(400, { error: { codigo: "X", mensaje: "Formato desconocido" }, id_solicitud: "req_1" })).toEqual({
      tipo: "reintentar",
      motivo: "Formato desconocido",
      contexto: { idSolicitud: "req_1" },
    });
  });

  it("un 200 con un ID de empresa equivocado no se confunde con éxito ni se reintenta", () => {
    expect(leer(200, { message: "Empresa no encontrada." })).toMatchObject({
      tipo: "error",
      mensaje: expect.stringContaining("DUX_ID_EMPRESA"),
    });
  });

  it("un 200 sin datos y con otro mensaje se reintenta", () => {
    expect(leer(200, { message: "Algo pasó." })).toMatchObject({ tipo: "reintentar", motivo: "Algo pasó." });
    expect(leer(200, "<html>mantenimiento</html>")).toMatchObject({ tipo: "reintentar" });
  });

  it("reintenta 429 y 5xx", () => {
    expect(leer(429, {})).toMatchObject({ tipo: "reintentar" });
    expect(leer(503, "Service Unavailable")).toMatchObject({ tipo: "reintentar" });
  });

  it("no reintenta token o permiso rechazado", () => {
    expect(leer(401, {})).toMatchObject({ tipo: "error", mensaje: expect.stringContaining("token") });
    expect(leer(403, "cloudflare")).toMatchObject({ tipo: "error", mensaje: expect.stringContaining("403") });
  });

  it("otro 4xx trae el mensaje de DUX y el ID de la solicitud para el log", () => {
    expect(
      leer(400, { error: { mensaje: "Falta el parámetro requerido 'fecha_desde'." }, id_solicitud: "req_2" }),
    ).toEqual({
      tipo: "error",
      mensaje: "DUX rechazó el pedido: Falta el parámetro requerido 'fecha_desde'.",
      contexto: { idSolicitud: "req_2" },
    });
    expect(leer(404, {})).toMatchObject({ tipo: "error", mensaje: expect.stringContaining("HTTP 404") });
  });
});
