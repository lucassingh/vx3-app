import { generateKeyPairSync, verify } from "node:crypto";
import { Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { clasificarRespuestaGoogle, createGoogleClient, pedirTokenDeGoogle, urlDeMiniatura } from "./client";
import { leerCuentaDeServicio } from "./cuenta";

const TOKEN = "token-de-prueba-7c1e";
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

let lineas: string[] = [];

function armar(respuestas: Response[]) {
  const pendientes = [...respuestas];
  const fetch = vi.fn(async () => {
    const siguiente = pendientes.shift();
    if (!siguiente) throw new Error("No hay más respuestas de prueba");
    return siguiente;
  });
  const log = createLogger(
    new Writable({
      write(chunk, _encoding, listo) {
        lineas.push(String(chunk));
        listo();
      },
    }),
    "debug",
  );
  const cliente = createGoogleClient(TOKEN, {
    esperasMs: [1, 1],
    fetch: fetch as unknown as typeof globalThis.fetch,
    esperar: async () => {},
    log,
  });
  const url = (llamada: number) => String((fetch.mock.calls[llamada] as unknown as [string])[0]);
  return { cliente, fetch, url };
}

beforeEach(() => {
  lineas = [];
});

describe("leerCuentaDeServicio", () => {
  const cuenta = {
    client_email: "lectura@prueba.iam.gserviceaccount.com",
    private_key: "clave",
    token_uri: "https://oauth.prueba/token",
  };

  it("lee el JSON de la cuenta", () => {
    expect(leerCuentaDeServicio(JSON.stringify({ ...cuenta, type: "service_account" }))).toEqual(cuenta);
  });

  it.each([
    ["no es JSON", "un-token-cualquiera"],
    ["le falta la clave", JSON.stringify({ ...cuenta, private_key: undefined })],
    ["el mail no es un mail", JSON.stringify({ ...cuenta, client_email: "lectura" })],
  ])("%s: null", (_, valor) => {
    expect(leerCuentaDeServicio(valor)).toBeNull();
  });
});

describe("pedirTokenDeGoogle", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const cuenta = {
    client_email: "lectura@prueba.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    token_uri: "https://oauth.prueba/token",
  };

  it("firma el pedido con la clave, y solo pide permisos de lectura", async () => {
    const fetch = vi.fn(async () => json({ access_token: "abc" }));

    const token = await pedirTokenDeGoogle(cuenta, {
      fetch: fetch as unknown as typeof globalThis.fetch,
      ahora: () => 1_800_000_000_000,
    });

    expect(token).toBe("abc");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(cuenta.token_uri);
    const assertion = new URLSearchParams(String(init.body)).get("assertion") ?? "";
    const [cabecera, datos, firma] = assertion.split(".") as [string, string, string];
    expect(verify("RSA-SHA256", Buffer.from(`${cabecera}.${datos}`), publicKey, Buffer.from(firma, "base64url"))).toBe(
      true,
    );
    const contenido = JSON.parse(Buffer.from(datos, "base64url").toString());
    expect(contenido).toMatchObject({
      iss: cuenta.client_email,
      aud: cuenta.token_uri,
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(contenido.scope.split(" ").every((permiso: string) => permiso.endsWith(".readonly"))).toBe(true);
  });

  it("si Google rechaza la clave, lo dice", async () => {
    const fetch = vi.fn(async () => json({ error: "invalid_grant", error_description: "Invalid JWT" }, 400));

    await expect(pedirTokenDeGoogle(cuenta, { fetch: fetch as unknown as typeof globalThis.fetch })).rejects.toThrow(
      /no aceptó la clave.*Invalid JWT/,
    );
  });

  it("una clave rota da un error para una persona, sin repetirla", async () => {
    const error = await pedirTokenDeGoogle({ ...cuenta, private_key: "no-es-una-clave" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as Error).message).toMatch(/no es válida/);
    expect((error as Error).message).not.toContain("no-es-una-clave");
  });

  it("sin red, un error para una persona", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(pedirTokenDeGoogle(cuenta, { fetch: fetch as unknown as typeof globalThis.fetch })).rejects.toThrow(
      /no respondió/,
    );
  });
});

describe("clasificarRespuestaGoogle", () => {
  const error = (status: number, message: string, reason?: string) => ({
    status,
    cuerpo: { error: { message, errors: reason ? [{ reason }] : undefined } },
  });

  it.each([
    ["500", error(500, "Internal")],
    ["503, el que tarda minutos", error(503, "The service is currently unavailable.")],
    ["429", error(429, "Quota")],
    ["403 por límite de uso", error(403, "Rate", "userRateLimitExceeded")],
  ])("reintenta: %s", (_, respuesta) => {
    expect(clasificarRespuestaGoogle(respuesta).tipo).toBe("reintentar");
  });

  it("un 404 dice lo que hay que revisar", () => {
    expect(clasificarRespuestaGoogle(error(404, "File not found"))).toMatchObject({
      tipo: "error",
      mensaje: expect.stringMatching(/no está compartido con la cuenta/),
    });
  });

  it("un 403 de permisos no se reintenta, y dice el motivo de Google", () => {
    expect(clasificarRespuestaGoogle(error(403, "The caller does not have permission", "forbidden"))).toEqual({
      tipo: "error",
      mensaje: "Google respondió: The caller does not have permission",
    });
  });

  it("sin cuerpo reconocible, el código", () => {
    expect(clasificarRespuestaGoogle({ status: 400, cuerpo: "<html>" })).toMatchObject({
      mensaje: expect.stringContaining("HTTP 400"),
    });
  });
});

describe("createGoogleClient", () => {
  it("verificar dice si la cuenta puede editar", async () => {
    const { cliente, url } = armar([
      json({
        name: "Catálogo",
        mimeType: "application/vnd.google-apps.spreadsheet",
        modifiedTime: "2026-11-03T19:03:14Z",
        capabilities: { canEdit: true },
      }),
    ]);

    expect(await cliente.verificar("sheet-1")).toEqual({
      nombre: "Catálogo",
      mimeType: "application/vnd.google-apps.spreadsheet",
      modificado: "2026-11-03T19:03:14Z",
      puedeEditar: true,
    });
    expect(url(0)).toContain("/files/sheet-1?");
  });

  it("lee todas las pestañas en dos pedidos, con lo que ve el equipo y el valor crudo", async () => {
    const { cliente, fetch, url } = armar([
      json({ sheets: [{ properties: { title: "CatalogoDetalle" } }, { properties: { title: "_ref's" } }] }),
      json({
        valueRanges: [
          {
            values: [
              ["SKU", "peso"],
              ["LN25", "1,5"],
            ],
          },
          {},
        ],
      }),
      json({
        valueRanges: [
          {
            values: [
              ["SKU", "peso"],
              ["LN25", 1.5],
            ],
          },
          {},
        ],
      }),
    ]);

    const pestanas = await cliente.leerPlanilla("sheet-1");

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(url(1)).toContain("valueRenderOption=FORMATTED_VALUE");
    expect(url(1)).toContain(`ranges=${encodeURIComponent("'_ref''s'")}`);
    expect(url(2)).toContain("valueRenderOption=UNFORMATTED_VALUE");
    expect(pestanas).toEqual([
      {
        titulo: "CatalogoDetalle",
        visto: [
          ["SKU", "peso"],
          ["LN25", "1,5"],
        ],
        crudo: [
          ["SKU", "peso"],
          ["LN25", 1.5],
        ],
      },
      { titulo: "_ref's", visto: [], crudo: [] },
    ]);
  });

  it("recorre la carpeta con sus páginas y subcarpetas, con la ruta de cada archivo", async () => {
    const foto = (id: string, name: string) => ({
      id,
      name,
      mimeType: "image/jpeg",
      size: "453051",
      md5Checksum: "abc",
      imageMediaMetadata: { width: 1600, height: 1600 },
    });
    const { cliente, fetch, url } = armar([
      json({
        nextPageToken: "pagina-2",
        files: [foto("f1", "LN25-1.jpg"), { id: "c1", name: "Mallas", mimeType: "application/vnd.google-apps.folder" }],
      }),
      json({ files: [foto("f2", "LN25-2.jpg")] }),
      json({ files: [foto("f3", "MA1-1.jpg")] }),
    ]);

    const archivos = await cliente.leerCarpeta("raiz", "Repositorio Fotos");

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(url(1)).toContain("pageToken=pagina-2");
    expect(decodeURIComponent(url(2)).replaceAll("+", " ")).toContain("'c1' in parents");
    expect(archivos.map(({ nombre, ruta }) => [nombre, ruta])).toEqual([
      ["LN25-1.jpg", "Repositorio Fotos"],
      ["LN25-2.jpg", "Repositorio Fotos"],
      ["MA1-1.jpg", "Repositorio Fotos/Mallas"],
    ]);
    expect(archivos[0]).toMatchObject({ bytes: 453_051, md5: "abc", ancho: 1600, alto: 1600 });
  });

  it("reintenta cuando el Sheet responde 503, y sigue", async () => {
    const { cliente, fetch } = armar([
      json({ error: { message: "The service is currently unavailable." } }, 503),
      json({ name: "Catálogo", mimeType: "x" }),
    ]);

    expect((await cliente.verificar("sheet-1")).nombre).toBe("Catálogo");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("si Google cambia la forma de la respuesta, lo dice", async () => {
    const { cliente } = armar([json({ otra: "cosa" })]);

    await expect(cliente.verificar("sheet-1")).rejects.toThrow(/forma que no esperábamos/);
  });

  it("nunca escribe el token en los logs", async () => {
    const { cliente } = armar([
      json({ error: { message: "x" } }, 503),
      json({ error: { message: "x" } }, 503),
      json({ error: { message: "x" } }, 503),
    ]);

    await expect(cliente.verificar("sheet-1")).rejects.toThrow();

    expect(lineas.join("")).not.toContain(TOKEN);
    expect(lineas.length).toBeGreaterThan(0);
  });

  it("manda el token a Google, y no a la miniatura de una foto", async () => {
    const { cliente, fetch } = armar([
      json({ name: "x", mimeType: "y" }),
      new Response("foto", { status: 200, headers: { "content-type": "image/jpeg" } }),
    ]);

    await cliente.verificar("sheet-1");
    await cliente.fotoEsPublica("f1");

    const [, conToken] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const [urlFoto, sinToken] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.stringify(conToken.headers)).toContain(TOKEN);
    expect(urlFoto).toBe(urlDeMiniatura("f1"));
    expect(JSON.stringify(sinToken.headers ?? {})).not.toContain(TOKEN);
  });

  it.each([
    ["una imagen: es pública", new Response("foto", { status: 200, headers: { "content-type": "image/jpeg" } }), true],
    [
      "la página de login: no lo es",
      new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
      false,
    ],
    ["un error: no lo es", new Response("", { status: 403 }), false],
  ])("fotoEsPublica con %s", async (_, respuesta, esperado) => {
    const { cliente } = armar([respuesta]);

    expect(await cliente.fotoEsPublica("f1")).toBe(esperado);
  });

  it("fotoEsPublica sin red: no lo es", async () => {
    const { cliente } = armar([]);

    expect(await cliente.fotoEsPublica("f1")).toBe(false);
  });

  it("unaFoto busca solo imágenes", async () => {
    const { cliente, url } = armar([json({ files: [{ id: "f1", name: "a.jpg", mimeType: "image/jpeg" }] })]);

    expect(await cliente.unaFoto("raiz")).toBe("f1");
    expect(decodeURIComponent(url(0)).replaceAll("+", " ")).toContain("mimeType contains 'image/'");
  });
});
