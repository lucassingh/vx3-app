import { describe, expect, it, vi } from "vitest";
import { cabeceraDePrueba, createDuxEscritura, destinoDeEscritura, type PedidoDeItem } from "./escritura";

const PEDIDO: PedidoDeItem = {
  cod_item: "LN 999",
  item: "CORPIÑO DE PRUEBA - UNIDAD",
  tipo_producto: "SIMPLE",
  id_personal: 1,
  id_moneda: 1,
  id_unidad_medida: 1,
  porc_iva: 0,
  costo_compra: 1_000,
  sucursales_habilitadas: [{ id_sucursal: 1 }, { id_sucursal: 2 }],
};

const CONFIG = { baseUrl: "https://dux.prueba/rest", token: "token-de-prueba-7c1e" };

function armar(ambiente: string | undefined, prueba: string | undefined, respuesta: Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => respuesta);
  const cliente = createDuxEscritura(CONFIG, {
    limite: { turno: vi.fn(async () => {}), postergar: vi.fn(async () => {}) },
    ambiente,
    prueba,
    fetch: fetch as unknown as typeof globalThis.fetch,
    esperar: async () => {},
  });
  return { cliente, fetch };
}

const creado = () => new Response(JSON.stringify({ datos: { cod_item: "LN999", item: "X" } }), { status: 201 });

describe("el candado", () => {
  it("en producción escribe en la empresa real, sin cabecera de prueba", () => {
    expect(destinoDeEscritura("production", "X-Prueba: si")).toEqual({ real: true, cabecera: {} });
  });

  it.each([
    ["qa", undefined],
    ["development", undefined],
    [undefined, undefined],
    ["qa", "sin-separador"],
    ["qa", ": sin nombre"],
    ["qa", "X-Prueba:"],
  ])("en %s, con %s, no escribe", (ambiente, prueba) => {
    expect(() => destinoDeEscritura(ambiente, prueba)).toThrow("Fuera de producción no se escribe en DUX");
  });

  it("una preview nunca escribe, aunque tenga la cabecera", () => {
    expect(() => destinoDeEscritura("preview", "X-Prueba: si")).toThrow("Fuera de producción");
  });

  it("en QA escribe solo en el conjunto de datos de prueba", () => {
    expect(destinoDeEscritura("qa", "X-Prueba: si")).toEqual({ real: false, cabecera: { "X-Prueba": "si" } });
  });

  it("sin candado abierto, ni siquiera se puede armar el cliente", () => {
    expect(() => armar("qa", undefined, creado())).toThrow("Fuera de producción");
  });
});

describe("cabeceraDePrueba", () => {
  it("el valor puede tener dos puntos", () => {
    expect(cabeceraDePrueba("X-Prueba: a:b")).toEqual({ "X-Prueba": "a:b" });
  });

  it("sin texto, no hay", () => {
    expect(cabeceraDePrueba(undefined)).toBeNull();
  });
});

describe("crear y actualizar", () => {
  it("crea con POST, y manda la cabecera de prueba", async () => {
    const { cliente, fetch } = armar("qa", "X-Prueba: si", creado());

    await cliente.crearItem(PEDIDO);

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://dux.prueba/rest/v2/items");
    expect(init).toMatchObject({
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.token}`, "X-Prueba": "si", "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual(PEDIDO);
  });

  it("actualiza con PUT, con el código en la ruta y escapado", async () => {
    const { cliente, fetch } = armar(
      "production",
      undefined,
      new Response(JSON.stringify({ datos: {} }), { status: 200 }),
    );

    await cliente.actualizarItem(PEDIDO);

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://dux.prueba/rest/v2/items/LN%20999");
    expect(init?.method).toBe("PUT");
  });

  it("si DUX rechaza el pedido, dice el campo y el problema, sin el valor", async () => {
    const rechazo = new Response(
      JSON.stringify({
        error: {
          codigo: "ERROR_VALIDACION",
          mensaje: "Datos inválidos.",
          detalle: [{ campo: "cod_marca", problema: "no existe", valor: "DATO SECRETO" }],
        },
      }),
      { status: 400 },
    );
    const { cliente } = armar("production", undefined, rechazo);

    const error = await cliente.crearItem(PEDIDO).catch((e: Error) => e);

    expect((error as Error).message).toBe("DUX rechazó el pedido: Datos inválidos (cod_marca: no existe).");
    expect((error as Error).message).not.toContain("DATO SECRETO");
  });
});
