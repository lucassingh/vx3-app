import { beforeEach, describe, expect, it } from "vitest";
import type { ClientaParaRecompra, FichaClienta, Paginated, ClientaFila, DuplicadoClienta } from "@/lib/api/types";
import { resetDb } from "../db";
import { handleMockRequest, MOCK_API_PREFIX } from "../router";
import { normalizarTelefono } from "./clientas";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

beforeEach(() => {
  resetDb();
});

describe("clientas", () => {
  it("normaliza el teléfono a los últimos 10 dígitos, con y sin 54 y 9 (RN-90)", () => {
    expect(normalizarTelefono("+54 9 11 5832-4410")).toBe("1158324410");
    expect(normalizarTelefono("5491158324410")).toBe("1158324410");
    expect(normalizarTelefono("011 5832-4410")).toBe("1158324410");
  });

  it("busca por teléfono y filtra por segmento", async () => {
    const porTelefono = await call<Paginated<ClientaFila>>("/clientas?q=5832");
    expect(porTelefono.body.data.map((clienta) => clienta.nombre)).toEqual(["Romina Gaitán"]);

    const enRiesgo = await call<Paginated<ClientaFila>>("/clientas?segmento=en_riesgo&pageSize=50");
    expect(enRiesgo.body.data.every((clienta) => clienta.segmento === "en_riesgo")).toBe(true);
  });

  it("arma la ficha con los pedidos de la clienta y su anuncio de origen", async () => {
    const { body } = await call<FichaClienta>("/clientas/c-01");
    expect(body.anuncioOrigen?.sku).toBe("CJATN14");
    expect(body.eventos.some((evento) => evento.titulo === "Pedido V-1043")).toBe(true);
  });

  it("fusiona un duplicado y lo saca de la lista", async () => {
    const before = await call<DuplicadoClienta[]>("/clientas/duplicados");
    const first = before.body[0]!;
    expect((await call(`/clientas/duplicados/${first.id}/fusionar`, { method: "POST" })).status).toBe(200);
    const after = await call<DuplicadoClienta[]>("/clientas/duplicados");
    expect(after.body.map((item) => item.id)).not.toContain(first.id);
  });

  it("marca una clienta de la recompra como contactada", async () => {
    const { body: lista } = await call<ClientaParaRecompra[]>("/clientas/recompra");
    const pendiente = lista.find((item) => item.estado === "pendiente")!;
    const { body } = await call<ClientaParaRecompra>(`/clientas/recompra/${pendiente.id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "contactada" }),
    });
    expect(body.estado).toBe("contactada");
  });
});
