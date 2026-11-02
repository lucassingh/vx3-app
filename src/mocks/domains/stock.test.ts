// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { MargenControl, Recepcion, StockFila } from "@/lib/api/types";
import { resetDb } from "../db";
import { handleMockRequest, MOCK_API_PREFIX } from "../router";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

beforeEach(() => {
  resetDb();
});

describe("stock", () => {
  it("muestra el disponible en bultos con la equivalencia en prendas", async () => {
    const { body } = await call<StockFila[]>("/stock/espejo?q=CJATN14");
    // 84 prendas reales − 12 reservadas = 72 = 12 medias docenas.
    expect(body[0]).toMatchObject({ disponiblePrendas: 72, disponibleBultos: 12, equivalencia: "72 prendas = 12 medias docenas" });
  });

  it("corregir el precio saca al producto de la lista de bajo el piso", async () => {
    const corregido = await call<{ precio: number }>("/stock/margen/CAN12/corregir", { method: "POST" });
    expect(corregido.body.precio).toBe(12_300);

    const { body } = await call<MargenControl>("/stock/margen");
    expect(body.bajoPiso.map((item) => item.sku)).not.toContain("CAN12");
  });

  it("la recepción la tiene que firmar otra persona (RN-37)", async () => {
    const { body: recepcion } = await call<Recepcion>("/stock/recepcion");
    const carga = (firmadoPor: string) => ({
      method: "POST",
      body: JSON.stringify({ firmadoPor, renglones: recepcion.renglones.map((r) => ({ id: r.id, contadoBultos: r.contadoBultos, costoDocenaNuevo: r.costoDocenaNuevo })) }),
    });

    expect((await call("/stock/recepcion/cargar", carga("Juan"))).status).toBe(422);
    expect((await call("/stock/recepcion/cargar", carga("Leo"))).status).toBe(200);
    expect((await call("/stock/recepcion/cargar", carga("Leo"))).status).toBe(409);
  });
});
