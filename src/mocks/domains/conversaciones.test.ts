// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, BandejaConversaciones, BotPrueba, Conversacion, VidrieraResumen } from "@/lib/api/types";
import { resetDb } from "../db";
import { handleMockRequest, MOCK_API_PREFIX } from "../router";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

const post = (body: object) => ({ method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  resetDb();
});

describe("conversaciones", () => {
  it("tomar una conversación aparta al bot y registra el motivo", async () => {
    const { body } = await call<Conversacion>("/conversaciones/cv-01/tomar", post({ motivo: "Pedido grande" }));
    expect(body).toMatchObject({ estado: "persona", asignadaA: "Elías", motivo: "Pedido grande" });
    expect(body.mensajes.at(-1)).toMatchObject({ tipo: "sistema", evento: "toma" });
  });

  it("fuera de la ventana de 24 h solo acepta plantillas aprobadas", async () => {
    const bandeja = await call<BandejaConversaciones>("/conversaciones");
    const soledad = bandeja.body.conversaciones.find((item) => item.id === "cv-08");
    expect(soledad?.ventanaHasta).toBeNull();

    const texto = await call<ApiErrorBody>("/conversaciones/cv-08/mensajes", post({ tipo: "texto", texto: "Hola!" }));
    expect(texto.status).toBe(409);

    const plantilla = await call<Conversacion>(
      "/conversaciones/cv-08/mensajes",
      post({ tipo: "plantilla", texto: "", plantillaId: "pl-1" }),
    );
    expect(plantilla.body.mensajes.at(-1)).toMatchObject({ tipo: "texto", plantilla: "seguimiento_consulta" });
  });

  it("dice cuánto falta para el mínimo con el monto del pedido de la semilla", async () => {
    const { body } = await call<BandejaConversaciones>("/conversaciones");
    const gisela = body.conversaciones.find((item) => item.id === "cv-03");
    const textos = gisela?.mensajes.flatMap((mensaje) => (mensaje.tipo === "texto" ? [mensaje.texto] : []));
    expect(textos?.some((texto) => /faltan \$\s?21\.700/.test(texto))).toBe(true);
  });
});

describe("bot y vidriera", () => {
  it("el probador deriva cuando piden un descuento", async () => {
    const { body } = await call<BotPrueba>("/bot/probar", post({ mensaje: "Si llevo 6 me hacés descuento?" }));
    expect(body.derivaria).toBe(true);
  });

  it("ocultar una colección queda guardado", async () => {
    await call("/vidriera/colecciones/col-reel", { method: "PATCH", body: JSON.stringify({ activa: false }) });
    const { body } = await call<VidrieraResumen>("/vidriera");
    expect(body.colecciones.find((item) => item.id === "col-reel")?.activa).toBe(false);
  });
});
