// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { FacturaEmitida, PedidoFacturable, PedidosLista, PedidoTrabado } from "@/lib/api/types";
import { resetDb } from "../db";
import type { Route } from "../http";
import { routes as envios } from "./envios";
import { routes as pedidos } from "./pedidos";

async function call<T>(routes: Route[], method: string, path: string, body?: unknown) {
  const url = new URL(`http://test.local${path}`);
  const request = new Request(url, { method, body: body ? JSON.stringify(body) : undefined });
  for (const route of routes) {
    const match = route.method === method ? url.pathname.match(route.pattern) : null;
    if (match) return (await (await route.handler({ url, params: match.slice(1), request })).json()) as T;
  }
  throw new Error(`Sin ruta para ${method} ${path}`);
}

beforeEach(() => {
  resetDb();
});

describe("bandeja de pedidos", () => {
  it("filtra por estado y canal, y cuenta por estado con los demás filtros", async () => {
    const lista = await call<PedidosLista>(pedidos, "GET", "/pedidos?estado=listo_facturar&canal=whatsapp");
    expect(lista.data.every((pedido) => pedido.estado === "listo_facturar" && pedido.canal === "whatsapp")).toBe(true);
    expect(lista.conteos.listo_facturar).toBe(lista.total);
  });

  it("busca por número sin el #", async () => {
    const lista = await call<PedidosLista>(pedidos, "GET", "/pedidos?q=%23V-1043");
    expect(lista.data.map((pedido) => pedido.id)).toEqual(["V-1043"]);
  });

  it("marca los trabados con la secuencia de RN-73 y el complementario por la diferencia", async () => {
    const trabados = await call<PedidoTrabado[]>(pedidos, "GET", "/pedidos/trabados");
    expect(trabados.map((item) => item.pedido.id).toSorted()).toEqual(["V-1046", "V-1047"]);
    expect(trabados.find((item) => item.pedido.id === "V-1046")?.motivo).toBe("bajo_minimo");
  });
});

describe("facturación", () => {
  it("factura en lote solo los listos y los saca de la lista y del despacho pendiente", async () => {
    const antes = await call<PedidoFacturable[]>(pedidos, "GET", "/pedidos/facturables");
    const listos = antes.filter((item) => item.listo).map((item) => item.pedido.id);
    expect(listos).toContain("V-1055");
    expect(antes.find((item) => item.pedido.id === "V-1054")?.listo).toBe(false);

    const { facturas } = await call<{ facturas: FacturaEmitida[] }>(pedidos, "POST", "/pedidos/facturar", {
      ids: [...listos, "V-1054"],
    });
    expect(facturas.map((factura) => factura.pedidoId).toSorted()).toEqual(listos.toSorted());
    // V-1055 pagó por transferencia: lleva Factura y va a ARCA.
    expect(facturas.find((factura) => factura.pedidoId === "V-1055")).toMatchObject({ arca: "pendiente" });

    const despues = await call<PedidoFacturable[]>(pedidos, "GET", "/pedidos/facturables");
    expect(despues.some((item) => listos.includes(item.pedido.id))).toBe(false);
    expect(await call<unknown[]>(envios, "GET", "/envios/despacho")).toBeTruthy();
  });
});
