// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiErrorBody, DailyPoint, IndicadorCausa, Kpi, Notification, OperacionHoy } from "@/lib/api/types";
import { resetDb } from "./db";
import { handleMockRequest, MOCK_API_PREFIX } from "./router";
import { anuncios, clientas, DAY, detalleDe, getPedido, getProducto, pedidos, presentacionesDe } from "./seed";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

beforeEach(() => {
  resetDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("semilla", () => {
  it("calcula los precios piso con los coeficientes de RN-11 (caso del instructivo)", () => {
    // Costo docena $ 22.000 → media docena $ 14.300 y prenda $ 4.100.
    const precios = presentacionesDe({ ...getProducto("CAN9"), costoDocena: 22_000 });
    expect(precios.bulto).toMatchObject({ codigo: "CAN9-6", precio: 14_300 });
    expect(precios.lista.find((item) => item.codigo === "CAN9")?.precio).toBe(4_100);
  });

  it("dice cuánto falta para el mínimo de $ 45.000 (RN-77)", () => {
    expect(detalleDe(getPedido("V-1046")).faltaParaMinimo).toBe(21_700);
    expect(detalleDe(getPedido("V-1055")).faltaParaMinimo).toBe(0);
  });

  it("todo pedido confirmado llega al mínimo, salvo V-1057 (tarifa diferencial, Q-9B)", () => {
    const bajoMinimo = pedidos
      .filter((pedido) => !["armandose", "anulado"].includes(pedido.estado))
      .filter((pedido) => detalleDe(pedido).faltaParaMinimo > 0)
      .map((pedido) => pedido.id);
    expect(bajoMinimo).toEqual(["V-1057"]);
  });

  it("una clienta en riesgo o dormida no tiene compras dentro de su ciclo", () => {
    const comprasRecientes = new Map<string, number>();
    for (const pedido of pedidos) {
      if (["armandose", "pendiente_pago", "anulado"].includes(pedido.estado)) continue;
      const dias = Math.floor(pedido.creadoHaceMin / DAY);
      comprasRecientes.set(pedido.clientaId, Math.min(comprasRecientes.get(pedido.clientaId) ?? dias, dias));
    }
    const contradicciones = clientas
      .filter((clienta) => clienta.segmento === "en_riesgo" || clienta.segmento === "dormida")
      .filter((clienta) => comprasRecientes.has(clienta.id))
      .map((clienta) => clienta.id);
    expect(contradicciones).toEqual([]);
  });

  it("suma 1.034 conversaciones de pauta y 18 pedidos verificados", () => {
    expect(anuncios.reduce((sum, anuncio) => sum + anuncio.conversaciones7d, 0)).toBe(1_034);
    expect(anuncios.reduce((sum, anuncio) => sum + anuncio.pedidos7d, 0)).toBe(18);
  });
});

describe("dashboard", () => {
  it("GET /dashboard/kpis devuelve los cinco indicadores de resultado de P-15", async () => {
    const { body } = await call<Kpi[]>("/dashboard/kpis");
    expect(body.map((kpi) => kpi.id)).toEqual(["facturacion", "cobrado", "pedidos", "conversaciones", "cierre"]);
    const valor = (id: string) => body.find((kpi) => kpi.id === id)?.value ?? NaN;
    expect(valor("cobrado")).toBe(valor("facturacion") - 1_002_000);
    expect(valor("cierre")).toBeCloseTo(valor("pedidos") / valor("conversaciones"));
  });

  it("GET /dashboard/causas devuelve los cinco indicadores de causa, cada uno con su pantalla", async () => {
    const { body } = await call<IndicadorCausa[]>("/dashboard/causas");
    expect(body.map((causa) => causa.id)).toEqual([
      "bajo-piso",
      "cobros-viejos",
      "reclamos",
      "costo-pedido",
      "errores-bot",
    ]);
    expect(body.find((causa) => causa.id === "bajo-piso")).toMatchObject({ value: 3, estado: "alerta" });
    expect(body.every((causa) => causa.href.startsWith("/"))).toBe(true);
  });

  it("GET /dashboard/ventas devuelve los días pedidos y termina hoy", async () => {
    const { body } = await call<DailyPoint[]>("/dashboard/ventas?days=7");
    expect(body).toHaveLength(7);
    expect(body.at(-1)?.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("GET /dashboard/operacion cuenta los pedidos de hoy por estado", async () => {
    const { body } = await call<OperacionHoy>("/dashboard/operacion");
    const listos = body.porEstado.find((item) => item.estado === "listo_facturar");
    expect(listos?.cantidad).toBe(body.listosParaFacturar);
    expect(body.cortes.map((corte) => corte.hora)).toEqual(["12:00", "17:30", "18:30"]);
  });
});

describe("alertas", () => {
  it("POST /notifications/read-all marca todo como leído", async () => {
    const before = await call<Notification[]>("/notifications");
    const unread = before.body.filter((item) => !item.read).length;

    const { body } = await call<{ updated: number }>("/notifications/read-all", { method: "POST" });
    expect(body.updated).toBe(unread);

    const after = await call<Notification[]>("/notifications");
    expect(after.body.every((item) => item.read)).toBe(true);
  });
});

describe("errores", () => {
  it("responde 404 en rutas o métodos desconocidos", async () => {
    expect((await call("/no-existe")).status).toBe(404);
    expect((await call("/dashboard/kpis", { method: "DELETE" })).status).toBe(404);
  });

  it("simula fallas con MOCK_API_FAILURE_RATE", async () => {
    vi.stubEnv("MOCK_API_FAILURE_RATE", "1");
    const { status, body } = await call<ApiErrorBody>("/dashboard/kpis");
    expect(status).toBe(503);
    expect(body.error.status).toBe(503);
  });
});
