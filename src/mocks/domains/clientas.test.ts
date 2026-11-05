import { beforeEach, describe, expect, it } from "vitest";
import type { ListaDeRecompra, FichaClienta, Paginated, ClientaFila, DuplicadoClienta } from "@/lib/api/types";
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

  it("lista las fichas unificadas", async () => {
    const { body } = await call<DuplicadoClienta[]>("/clientas/duplicados");
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]?.registros.length).toBeGreaterThan(1);
  });

  it("dice cuánto de la venta está identificado", async () => {
    const { status } = await call("/clientas/cobertura");
    expect(status).toBe(200);
  });

  it("marca una clienta de la recompra como contactada", async () => {
    const { body: lista } = await call<ListaDeRecompra>("/clientas/recompra");
    const pendiente = lista.hoy.find((item) => item.estado === "pendiente")!;
    const { body } = await call<{ estado: string }>(`/clientas/recompra/${pendiente.id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "contactada" }),
    });
    expect(body.estado).toBe("contactada");
  });
});
