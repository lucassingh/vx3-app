import { beforeEach, describe, expect, it } from "vitest";
import type { AnuncioFila, ApiErrorBody, AtribucionEstado, Kpi } from "@/lib/api/types";
import { resetDb } from "../db";
import { handleMockRequest, MOCK_API_PREFIX } from "../router";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

beforeEach(() => {
  resetDb();
});

describe("pauta", () => {
  it("los 7 días suman 18 pedidos verificados, 1.034 conversaciones y un RM de 1,29", async () => {
    const { body } = await call<Kpi[]>("/pauta/kpis?dias=7");
    const byId = Object.fromEntries(body.map((kpi) => [kpi.id, kpi.value]));
    expect(byId.pedidos).toBe(18);
    expect(byId.gasto).toBe(180);
    expect(byId.rm).toBeCloseTo(1.29, 2);
    expect(byId.cierre).toBeCloseTo(18 / 1_034, 5);
  });

  it("la atribución cuadra exacto con lo facturado y separa el legado", async () => {
    const { body } = await call<AtribucionEstado>("/pauta/atribucion?dias=14");
    expect(body.atribuido).toBe(body.facturado);
    expect(body.pedidosLegado).toBe(1);
  });

  it("pausa un anuncio y frena al quinto cambio en la hora del mismo conjunto", async () => {
    const pausar = (estado: string) =>
      call<ApiErrorBody>("/pauta/anuncios/a-07/estado", { method: "POST", body: JSON.stringify({ estado }) });

    // "Interior · revendedoras" ya tiene un cambio hace 25 minutos.
    expect((await pausar("pausado")).status).toBe(200);
    const { body: anuncios } = await call<AnuncioFila[]>("/pauta/anuncios");
    expect(anuncios.find((anuncio) => anuncio.id === "a-07")?.estado).toBe("pausado");

    expect((await pausar("activo")).status).toBe(200);
    expect((await pausar("pausado")).status).toBe(200);
    expect((await pausar("activo")).status).toBe(429);
  });
});
