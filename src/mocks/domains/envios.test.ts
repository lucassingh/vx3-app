// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { CotizacionEnvio, GrupoDespacho } from "@/lib/api/types";
import { resetDb } from "../db";
import { armarCajas, routes } from "./envios";

async function call<T>(method: string, path: string, body?: unknown) {
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

describe("cotizador", () => {
  it("arma varias cajas cuando el pedido no entra en una y respeta los 25 kg", () => {
    const cajas = armarCajas([{ sku: "IRTM6", bultos: 20 }]);
    expect(cajas.length).toBeGreaterThan(1);
    expect(cajas.every((caja) => caja.pesoKg <= 25)).toBe(true);
  });

  it("en AMBA recomienda la mensajería y deja Vía Cargo fuera", async () => {
    const cotizacion = await call<CotizacionEnvio>("POST", "/envios/cotizar", {
      cp: "1824",
      items: [{ sku: "CJATN14", bultos: 2 }],
      modoCorreo: "domicilio",
      simularFalla: false,
    });
    expect(cotizacion.destino).toMatchObject({ valido: true, zona: "amba_1" });
    expect(cotizacion.opciones.find((opcion) => opcion.id === "mensajeria")).toMatchObject({
      recomendada: true,
      precio: 4_500,
    });
    expect(cotizacion.opciones.find((opcion) => opcion.id === "via_cargo")?.disponible).toBe(false);
    expect(cotizacion.id).toMatch(/^C-\d+$/);
  });

  it("si MiCorreo no responde cotiza con la tabla de respaldo y lo marca como estimado", async () => {
    const cotizacion = await call<CotizacionEnvio>("POST", "/envios/cotizar", {
      cp: "2000",
      items: [{ sku: "VN16", bultos: 3 }],
      modoCorreo: "domicilio",
      simularFalla: true,
    });
    expect(cotizacion.fuente).toBe("respaldo");
    expect(cotizacion.opciones.find((opcion) => opcion.id === "correo")).toMatchObject({ estimada: true });
    expect(cotizacion.opciones.find((opcion) => opcion.id === "mensajeria")?.disponible).toBe(false);
  });
});

describe("despacho", () => {
  it("valida el CP contra la localidad y sube los envíos armados a Zupply", async () => {
    const grupos = await call<GrupoDespacho[]>("GET", "/envios/despacho");
    const correo = grupos.find((grupo) => grupo.transporte === "correo")!;
    expect(correo.envios.find((envio) => envio.pedidoId === "V-1051")?.cpValido).toBe(false);

    await call("POST", "/envios/despacho/mensajeria");
    const despues = await call<GrupoDespacho[]>("GET", "/envios/despacho");
    const mensajeria = despues.find((grupo) => grupo.transporte === "mensajeria")!;
    expect(mensajeria.accion.hecho).toBe(true);
    expect(
      mensajeria.envios
        .filter((envio) => envio.estado === "subido")
        .every((envio) => envio.etiqueta?.startsWith("ZP-")),
    ).toBe(true);
  });
});
