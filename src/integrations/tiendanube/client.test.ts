import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@/lib/logger";
import { clasificarRespuestaDeTienda, createTiendaNubeClient, createTiendaNubeEscritura } from "./client";

const CONFIG = { storeId: 1234, token: "token-de-prueba-tn" };
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

const dependencias = (fetch: unknown) => ({
  fetch: fetch as typeof globalThis.fetch,
  limite: { turno: vi.fn(async () => {}), postergar: vi.fn(async () => {}) },
  esperasMs: [1],
  esperar: async () => {},
  log: createLogger(new Writable({ write: (_c, _e, listo) => listo() }), "debug"),
});

const armar = (...respuestas: Response[]) => {
  const pendientes = [...respuestas];
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
    const siguiente = pendientes.shift();
    if (!siguiente) throw new Error("No hay más respuestas de prueba");
    return siguiente;
  });
};

const PRODUCTO = {
  id: 7,
  published: false,
  categories: [{ id: 1 }],
  images: [],
  variants: [{ sku: "LN1-6", price: "0.00" }],
};

const categorias = (cuantas: number, desde = 0) =>
  Array.from({ length: cuantas }, (_, i) => ({ id: desde + i, parent: 0, name: { es: `C${desde + i}` } }));

describe("leer", () => {
  it("manda el token y el contacto que pide Tienda Nube", async () => {
    const fetch = armar(json([]));

    await createTiendaNubeClient(CONFIG, dependencias(fetch)).listarCategorias();

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toContain("/v1/1234/categories");
    expect(init?.headers).toMatchObject({
      Authentication: "bearer token-de-prueba-tn",
      "User-Agent": expect.stringContaining("ventasportres.com"),
    });
  });

  it("recorre todas las páginas: sin paginar, faltan categorías y se duplican", async () => {
    const fetch = armar(json(categorias(200)), json(categorias(3, 200)));

    const filas = await createTiendaNubeClient(CONFIG, dependencias(fetch)).listarCategorias();

    expect(filas).toHaveLength(203);
    expect(fetch.mock.calls.map(([url]) => /[?&]page=(\d+)/.exec(url)?.[1])).toEqual(["1", "2"]);
  });

  it("pide si la categoría está oculta: hay raíces con el mismo nombre", async () => {
    const fetch = armar(json([]));

    await createTiendaNubeClient(CONFIG, dependencias(fetch)).listarCategorias();

    expect(fetch.mock.calls[0]?.[0]).toContain("visibility");
  });

  it("una página llena justo al final: el 404 de la siguiente es el fin, no un error", async () => {
    const fetch = armar(json(categorias(200)), json({ code: 404, description: "Last page is 1" }, 404));

    expect(await createTiendaNubeClient(CONFIG, dependencias(fetch)).listarCategorias()).toHaveLength(200);
  });

  it("un SKU que no está es null", async () => {
    const fetch = armar(json({ code: 404, description: "does not exist" }, 404));

    expect(await createTiendaNubeClient(CONFIG, dependencias(fetch)).buscarPorSku("ZZ1-6")).toBeNull();
  });

  it("busca por SKU, sin que un carácter raro cambie la ruta", async () => {
    const fetch = armar(json(PRODUCTO));

    const producto = await createTiendaNubeClient(CONFIG, dependencias(fetch)).buscarPorSku("LN/1-6");

    expect(producto?.id).toBe(7);
    expect(fetch.mock.calls[0]?.[0]).toContain("/products/sku/LN%2F1-6");
  });

  it("una respuesta con otra forma lo dice, en vez de seguir con datos rotos", async () => {
    const fetch = armar(json({ id: "no es un número" }));

    await expect(createTiendaNubeClient(CONFIG, dependencias(fetch)).buscarPorSku("LN1-6")).rejects.toThrow(
      "respondió algo inesperado",
    );
  });

  it("si Tienda Nube no responde, reintenta", async () => {
    const fetch = armar(json({}, 503), json(PRODUCTO));

    expect((await createTiendaNubeClient(CONFIG, dependencias(fetch)).buscarPorSku("LN1-6"))?.id).toBe(7);
  });

  it("un token rechazado lo dice sin reintentar", async () => {
    const fetch = armar(json({}, 401));

    await expect(createTiendaNubeClient(CONFIG, dependencias(fetch)).buscarPorSku("LN1-6")).rejects.toThrow(
      "Tienda Nube rechazó el token.",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("clasificarRespuestaDeTienda", () => {
  it.each([
    [{ description: "Bad image" }, "Tienda Nube rechazó el pedido: Bad image."],
    [{ message: "Invalid" }, "Tienda Nube rechazó el pedido: Invalid."],
    [{ code: 422, name: ["is required"] }, 'Tienda Nube rechazó el pedido: name: ["is required"].'],
    [null, "Tienda Nube rechazó el pedido: sin más detalle."],
  ])("un 422 dice lo que dijo la tienda: %j", (cuerpo, mensaje) => {
    expect(clasificarRespuestaDeTienda({ status: 422, cuerpo })).toEqual({ tipo: "error", mensaje });
  });
});

describe("escribir", () => {
  const produccion = (fetch: unknown) => ({ ...dependencias(fetch), ambiente: "production" });

  it.each(["local", "qa", "preview", undefined])("en %s no se puede ni armar el cliente", (ambiente) => {
    const fetch = armar();

    expect(() => createTiendaNubeEscritura(CONFIG, { ...dependencias(fetch), ambiente })).toThrow(
      "Fuera de producción no se escribe en Tienda Nube",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("crea el producto con lo que se le pasa", async () => {
    const fetch = armar(json(PRODUCTO, 201));
    const pedido = {
      name: { es: "X" },
      description: { es: "" },
      published: false,
      categories: [1],
      variants: [{ sku: "LN1-6", price: "0" }],
    };

    const creado = await createTiendaNubeEscritura(CONFIG, produccion(fetch)).crearProducto(pedido);

    expect(creado.id).toBe(7);
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual(pedido);
  });

  it("si la red se corta, no reintenta: no se sabe si quedó hecho", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("sin red");
    });

    await expect(
      createTiendaNubeEscritura(CONFIG, produccion(fetch)).agregarFoto(7, { src: "https://x/y.jpg", position: 1 }),
    ).rejects.toThrow("no se sabe si quedó hecho");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("una foto rechazada lo dice", async () => {
    const fetch = armar(json({ description: "Unable to download image" }, 422));

    await expect(
      createTiendaNubeEscritura(CONFIG, produccion(fetch)).agregarFoto(7, { src: "https://x/y.jpg", position: 1 }),
    ).rejects.toThrow("Unable to download image");
  });

  it("editar manda solo lo que cambia", async () => {
    const fetch = armar(json(PRODUCTO), json({}));
    const escritura = createTiendaNubeEscritura(CONFIG, produccion(fetch));

    await escritura.actualizarDescripcion(7, "Marca: X.");
    await escritura.actualizarVariante(7, 9, { weight: 1, width: 2, height: 3, depth: 4 });

    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ id: 7, description: { es: "Marca: X." } });
    expect(fetch.mock.calls[1]?.[0]).toContain("/products/7/variants/9");
    expect(JSON.parse(fetch.mock.calls[1]?.[1]?.body as string)).toEqual({ weight: 1, width: 2, height: 3, depth: 4 });
  });

  it("mostrar un producto que ya no está lo dice", async () => {
    const fetch = armar(json({}, 404));

    await expect(createTiendaNubeEscritura(CONFIG, produccion(fetch)).mostrarProducto(7)).rejects.toThrow(
      "ya no está en la tienda",
    );
  });

  it("mostrar manda solo eso: el resto del producto no se toca", async () => {
    const fetch = armar(json(PRODUCTO));

    await createTiendaNubeEscritura(CONFIG, produccion(fetch)).mostrarProducto(7);

    expect(fetch.mock.calls[0]?.[0]).toContain("/products/7");
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ id: 7, published: true });
  });
});
