import { Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/lib/logger";
import { createDuxClient, LIMITES_DUX } from "./client";
import fixtureFacturas from "./fixtures/facturas.json";
import fixtureItems from "./fixtures/items.json";

const TOKEN = "token-de-prueba-7c1e";
const CONFIG = { baseUrl: "https://dux.prueba/rest", token: TOKEN, idEmpresa: 9432, idSucursal: 1 };
const FACTURAS = { results: [], paging: { total: 0 } };

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

let lineas: string[] = [];

function armar(respuestas: Response[]) {
  const pendientes = [...respuestas];
  const fetch = vi.fn(async () => {
    const siguiente = pendientes.shift();
    if (!siguiente) throw new Error("No hay más respuestas de prueba");
    return siguiente;
  });
  const limite = () => ({ turno: vi.fn(async () => {}), postergar: vi.fn(async () => {}) });
  const limites = { v1: limite(), v2: limite() };
  const log = createLogger(
    new Writable({
      write(chunk, _encoding, listo) {
        lineas.push(String(chunk));
        listo();
      },
    }),
    "debug",
  );
  const cliente = createDuxClient(CONFIG, {
    limites,
    esperasMs: [1, 1],
    fetch: fetch as unknown as typeof globalThis.fetch,
    esperar: async () => {},
    log,
  });
  const pedido = (n: number) =>
    fetch.mock.calls[n] as unknown as [string, RequestInit & { headers: Record<string, string> }];
  return { cliente, fetch, limites, pedido };
}

beforeEach(() => {
  lineas = [];
});

describe("listarItems", () => {
  it("lee la v2 con Bearer y su límite", async () => {
    const { cliente, pedido, limites } = armar([json(fixtureItems)]);

    const pagina = await cliente.listarItems(100);

    expect(pedido(0)[0]).toBe("https://dux.prueba/rest/v2/items?offset=100&limit=50");
    expect(pedido(0)[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(limites.v2.turno).toHaveBeenCalledOnce();
    expect(limites.v1.turno).not.toHaveBeenCalled();
    expect(pagina.paginacion).toEqual({ total: 2488, hay_mas: true });
  });

  it("acepta lo que DUX manda de verdad: sin rubro, sin marca, con espacio en el código y con variantes", async () => {
    const { cliente } = armar([json(fixtureItems)]);

    const { datos } = await cliente.listarItems(0);

    expect(datos.find((item) => item.cod_item === "COMBO32")?.rubro).toBeNull();
    expect(datos.find((item) => item.cod_item === "LN 25")).toBeDefined();
    expect(datos.find((item) => item.cod_item === "MTNU3")?.stock).toHaveLength(2);
  });

  it("no deja entrar el teléfono del proveedor", async () => {
    const { cliente } = armar([json(fixtureItems)]);

    const { datos } = await cliente.listarItems(0);

    expect(JSON.stringify(datos)).not.toContain("cel");
    expect(datos.find((item) => item.proveedor)?.proveedor).toEqual({
      id_proveedor: expect.any(Number),
      proveedor: "PROVEEDOR DE PRUEBA",
    });
  });

  it("si cambia la forma, falla claro, dice qué campo y no reintenta", async () => {
    const item = { ...fixtureItems.datos[0], costo: "1000" };
    const { cliente, fetch } = armar([json({ ...fixtureItems, datos: [item] })]);

    await expect(cliente.listarItems(0)).rejects.toThrow(/forma que no esperábamos en \/v2\/items: datos\.0\.costo/);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reintenta el 400 'Formato desconocido' de un request válido", async () => {
    const { cliente, fetch } = armar([
      json({ error: { mensaje: "Formato desconocido" }, id_solicitud: "req_1" }, 400),
      json(fixtureItems),
    ]);

    expect((await cliente.listarItems(0)).datos).toHaveLength(fixtureItems.datos.length);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(lineas.join("")).toContain("req_1");
  });
});

describe("listarFacturas", () => {
  const PEDIDO = { sucursal: 2, desde: "2026-10-01", hasta: "2026-10-31", offset: 50 };

  it("lee la v1, con el token solo, el ID de empresa y su límite", async () => {
    const { cliente, pedido, limites } = armar([json(fixtureFacturas)]);

    const { results } = await cliente.listarFacturas(PEDIDO);

    expect(pedido(0)[0]).toBe(
      "https://dux.prueba/rest/facturas?idEmpresa=9432&idSucursal=2&fechaDesde=2026-10-01&fechaHasta=2026-10-31&offset=50&limit=50",
    );
    expect(pedido(0)[1].headers.Authorization).toBe(TOKEN);
    expect(limites.v1.turno).toHaveBeenCalledOnce();
    expect(limites.v2.turno).not.toHaveBeenCalled();
    expect(results).toHaveLength(3);
  });

  it("reintenta el 200 con 'Formato desconocido', como pasó en la lectura de 12 meses", async () => {
    const { cliente, fetch } = armar([json({ message: "Formato desconocido." }), json(fixtureFacturas)]);

    expect((await cliente.listarFacturas(PEDIDO)).results).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("no deja pasar el nombre ni el CUIT de la clienta", async () => {
    const { cliente } = armar([json(fixtureFacturas)]);

    const { results } = await cliente.listarFacturas(PEDIDO);

    expect(JSON.stringify(results)).not.toContain("PRIVADO");
    expect(JSON.stringify(results)).not.toContain("27301112229");
  });

  it("una línea sin costo o con un número roto falla claro y sin reintentar", async () => {
    const rota = structuredClone(fixtureFacturas);
    rota.results[0]!.detalles![0]!.precio_uni = "no-es-un-numero";
    const { cliente, fetch } = armar([json(rota)]);

    await expect(cliente.listarFacturas(PEDIDO)).rejects.toThrow(/results\.0\.detalles\.0\.precio_uni/);
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("probarConexion", () => {
  it("prueba la v2 y la v1, cada una con su autenticación y su límite", async () => {
    const { cliente, pedido, limites } = armar([json(fixtureItems), json(FACTURAS)]);

    expect(await cliente.probarConexion()).toEqual({ items: 2488 });

    expect(pedido(0)[0]).toContain("/v2/items?offset=0&limit=1");
    expect(pedido(1)[0]).toContain("/facturas?idEmpresa=9432&idSucursal=1");
    expect(pedido(1)[1].headers.Authorization).toBe(TOKEN);
    expect(limites.v2.turno).toHaveBeenCalledOnce();
    expect(limites.v1.turno).toHaveBeenCalledOnce();
  });

  it("detecta el ID de empresa equivocado, aunque DUX responda 200", async () => {
    const { cliente } = armar([json(fixtureItems), json({ message: "Empresa no encontrada." })]);

    await expect(cliente.probarConexion()).rejects.toThrow(/DUX_ID_EMPRESA/);
  });

  it("un token rechazado no se reintenta y lo dice", async () => {
    const { cliente, fetch } = armar([json({}, 401)]);

    await expect(cliente.probarConexion()).rejects.toThrow(/rechazó el token/);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("agotados los reintentos de 'Formato desconocido', da un error que se entiende", async () => {
    const formato = () => json({ message: "Formato desconocido." });
    const { cliente } = armar([json(fixtureItems), formato(), formato(), formato()]);

    await expect(cliente.probarConexion()).rejects.toThrow(/DUX no respondió bien después de 3 intentos/);
  });
});

describe("seguridad", () => {
  it("el token no aparece en ningún log ni error", async () => {
    const { cliente } = armar([json({}, 500), json({}, 500), json({ eco: TOKEN }, 401)]);

    const error = await cliente.listarItems(0).catch((e: unknown) => e);

    expect(lineas.length).toBeGreaterThan(0);
    expect(lineas.join("") + String(error)).not.toContain(TOKEN);
  });

  it("los límites son los medidos: la v2 a 4 por segundo y la v1 cada 5,5 s", () => {
    expect(LIMITES_DUX.v2.intervaloMs).toBe(250);
    expect(LIMITES_DUX.v1.intervaloMs).toBe(5_500);
  });
});
