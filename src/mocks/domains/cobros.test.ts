// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CajaDelDia,
  ConciliacionResumen,
  ContraentregaResumen,
  CuentaCaja,
  PostventaResumen,
  ReclamoTranstech,
} from "@/lib/api/types";
import { resetDb } from "../db";
import { routeParams, type Route } from "../http";
import { routes as cobros } from "./cobros";
import { routes as postventa } from "./postventa";

async function call<T>(routes: Route[], method: string, path: string, body?: unknown) {
  const url = new URL(`http://test.local${path}`);
  const request = new Request(url, { method, body: body ? JSON.stringify(body) : undefined });
  for (const route of routes) {
    const match = route.method === method ? url.pathname.match(route.pattern) : null;
    if (match) {
      const response = await route.handler({ url, params: routeParams(match), request });
      return { status: response.status, body: (await response.json()) as T };
    }
  }
  throw new Error(`Sin ruta para ${method} ${path}`);
}

beforeEach(() => {
  resetDb();
});

describe("contraentrega", () => {
  it("los 17 casos suman exacto la plata en la calle del último corte, por grupo", async () => {
    const { body } = await call<ContraentregaResumen>(cobros, "GET", "/cobros/contraentrega");
    const suma = (grupo: string) =>
      body.casos.filter((caso) => caso.grupo === grupo).reduce((sum, caso) => sum + caso.monto, 0);

    expect(body.casos).toHaveLength(17);
    expect(suma("entregado_sin_rendir")).toBe(body.totales.entregadosSinRendir.monto);
    expect(suma("en_camino")).toBe(body.totales.enCamino.monto);
    expect(suma("ausente")).toBe(body.totales.ausentes.monto);
    expect(body.totales.total).toBe(1_002_000);
  });

  it("el reclamo semanal incluye solo los casos tipificados", async () => {
    const { body } = await call<ReclamoTranstech>(cobros, "GET", "/cobros/contraentrega/reclamo");
    expect(body.porTipo.reduce((sum, item) => sum + item.casos, 0)).toBe(body.casos);
    expect(body.mensaje).toMatch(/^Hola Federico/);
  });
});

describe("conciliación", () => {
  it("confirmar los de puntaje alto los saca de pendientes", async () => {
    const { body: confirmadas } = await call<{ confirmadas: number }>(
      cobros,
      "POST",
      "/cobros/conciliacion/confirmar-altos",
    );
    expect(confirmadas.confirmadas).toBe(3);

    const { body } = await call<ConciliacionResumen>(cobros, "GET", "/cobros/conciliacion");
    const pendientes = body.propuestas.filter((item) => item.estado === "propuesta");
    expect(pendientes.every((item) => item.puntaje < 90)).toBe(true);
  });
});

describe("post-venta", () => {
  it("aplica la excepción del video de apertura y exige el origen al resolver", async () => {
    const { body } = await call<PostventaResumen>(postventa, "GET", "/postventa");
    // Johana compró más de $ 100.000 en el pedido y Brenda más de $ 150.000 en 30 días:
    // no hace falta el video (RN-52). Antonella no llega a ninguno de los dos umbrales.
    expect(body.reclamos.find((reclamo) => reclamo.id === "R-0230")?.evidencia.requiereVideo).toBe(false);
    expect(body.reclamos.find((reclamo) => reclamo.id === "R-0231")?.evidencia.requiereVideo).toBe(false);
    expect(body.reclamos.find((reclamo) => reclamo.id === "R-0225")?.evidencia.requiereVideo).toBe(true);

    const sinOrigen = await call(postventa, "POST", "/postventa/R-0231/resolver", {});
    expect(sinOrigen.status).toBe(422);
    const ok = await call(postventa, "POST", "/postventa/R-0231/resolver", { origen: "armado" });
    expect(ok.status).toBe(200);
  });
});

describe("caja del día", () => {
  const suma = (items: { monto: number }[]) => items.reduce((total, item) => total + item.monto, 0);

  it("lo que queda para mercadería es lo disponible, menos lo que vence hoy y la reserva", async () => {
    const { body } = await call<CajaDelDia>(cobros, "GET", "/cobros/caja");
    expect(body.cuentas.map((cuenta) => cuenta.id)).toEqual([
      "santander",
      "supervielle",
      "provincia",
      "nacion",
      "efectivo",
    ]);
    expect(body.disponible).toBe(body.cuentas.reduce((total, cuenta) => total + cuenta.saldo, 0));
    expect(body.compromisosHoy.every((item) => item.vence === body.fecha)).toBe(true);
    expect(body.proximos.every((item) => item.vence > body.fecha)).toBe(true);
    expect(body.reserva).toBe(Math.max(0, suma(body.proximos) - body.ingresosEsperados));
    expect(body.capacidadCompra).toBe(body.disponible - suma(body.compromisosHoy) - body.reserva);
  });

  it("corregir un saldo lo deja como cargado a mano y rehace la cuenta", async () => {
    const antes = (await call<CajaDelDia>(cobros, "GET", "/cobros/caja")).body;
    const { status, body } = await call<CuentaCaja>(cobros, "POST", "/cobros/caja/cuentas/provincia", {
      saldo: 512_000,
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ saldo: 512_000, origen: "manual" });

    const despues = (await call<CajaDelDia>(cobros, "GET", "/cobros/caja")).body;
    expect(despues.disponible - antes.disponible).toBe(200_000);
    expect(despues.capacidadCompra - antes.capacidadCompra).toBe(200_000);
  });

  it("rechaza un saldo negativo y una cuenta que no existe", async () => {
    expect((await call(cobros, "POST", "/cobros/caja/cuentas/provincia", { saldo: -5 })).status).toBe(422);
    expect((await call(cobros, "POST", "/cobros/caja/cuentas/macro", { saldo: 1 })).status).toBe(404);
  });
});
