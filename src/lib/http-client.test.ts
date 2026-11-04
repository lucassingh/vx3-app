import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ExternalServiceError } from "./errors";
import { createHttpClient, type HttpClientOptions } from "./http-client";
import { createLogger } from "./logger";

const SECRETO = "token-secreto-de-prueba";

function respuesta(status: number, cuerpo: unknown = { ok: true }, headers?: Record<string, string>) {
  return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status, headers });
}

function armar(respuestas: (Response | Error)[], opciones: Partial<HttpClientOptions> = {}) {
  const pendientes = [...respuestas];
  const fetch = vi.fn(async () => {
    const siguiente = pendientes.shift();
    if (!siguiente) throw new Error("No hay más respuestas de prueba");
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  });
  const esperar = vi.fn(async () => {});
  const limite = { turno: vi.fn(async () => {}), postergar: vi.fn(async () => {}) };
  const lineas: string[] = [];
  const log = createLogger(
    new Writable({
      write(chunk, _encoding, listo) {
        lineas.push(String(chunk));
        listo();
      },
    }),
    "debug",
  );
  const cliente = createHttpClient({
    servicio: "Prueba",
    baseUrl: "https://api.prueba",
    headers: { Authorization: SECRETO },
    esperasMs: [10, 20],
    fetch: fetch as unknown as typeof globalThis.fetch,
    esperar,
    limite,
    log,
    ...opciones,
  });
  return { cliente, fetch, esperar, limite, lineas };
}

describe("createHttpClient", () => {
  it("devuelve el cuerpo leído y manda los headers con un User-Agent propio", async () => {
    const { cliente, fetch } = armar([respuesta(200, { a: 1 })]);

    expect(await cliente.get("/ruta?x=1")).toEqual({ status: 200, cuerpo: { a: 1 } });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.prueba/ruta?x=1");
    expect(init.headers).toMatchObject({ Authorization: SECRETO, "User-Agent": expect.stringMatching(/^vx3-app\//) });
  });

  it("un cuerpo que no es JSON llega como texto", async () => {
    const { cliente } = armar([respuesta(200, "<html>")]);
    expect((await cliente.get("/ruta")).cuerpo).toBe("<html>");
  });

  it("reintenta los 429 y los 5xx con la espera configurada, y respeta el límite en cada intento", async () => {
    const { cliente, esperar, limite } = armar([respuesta(503), respuesta(429), respuesta(200)]);

    expect((await cliente.get("/ruta")).status).toBe(200);

    expect(esperar.mock.calls).toEqual([[10], [20]]);
    expect(limite.turno).toHaveBeenCalledTimes(3);
  });

  it("con Retry-After espera lo que pide el proveedor y frena a las demás instancias", async () => {
    const { cliente, esperar, limite } = armar([respuesta(429, {}, { "Retry-After": "7" }), respuesta(200)]);

    await cliente.get("/ruta");

    expect(esperar).toHaveBeenCalledWith(7_000);
    expect(limite.postergar).toHaveBeenCalledWith(7_000);
  });

  it("nunca espera menos que la espera configurada, aunque Retry-After sea menor", async () => {
    const { cliente, esperar } = armar([respuesta(503, {}, { "Retry-After": "0" }), respuesta(200)]);

    await cliente.get("/ruta");

    expect(esperar).toHaveBeenCalledWith(10);
  });

  it("reintenta si se cae la red o vence el timeout", async () => {
    const timeout = Object.assign(new Error("agotado"), { name: "TimeoutError" });
    const { cliente, fetch } = armar([new TypeError("fetch failed"), timeout, respuesta(200)]);

    expect((await cliente.get("/ruta")).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("agotados los reintentos da un error que se entiende", async () => {
    const { cliente, fetch } = armar([respuesta(500), respuesta(500), respuesta(500)]);

    const error = await cliente.get("/ruta").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).message).toMatch(/Prueba no respondió bien después de 3 intentos/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("no reintenta lo que no tiene arreglo", async () => {
    const { cliente, fetch, esperar } = armar([respuesta(401)]);

    await expect(cliente.get("/ruta")).rejects.toThrow(/HTTP 401/);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(esperar).not.toHaveBeenCalled();
  });

  it("cada proveedor decide cómo leer sus respuestas", async () => {
    const clasificar: HttpClientOptions["clasificar"] = ({ cuerpo }) =>
      (cuerpo as { falla?: boolean }).falla ? { tipo: "reintentar", motivo: "falla disfrazada" } : { tipo: "ok" };
    const { cliente, fetch } = armar([respuesta(200, { falla: true }), respuesta(200, { falla: false })], {
      clasificar,
    });

    expect((await cliente.get("/ruta")).cuerpo).toEqual({ falla: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("el token no aparece en los logs ni en los errores, y el cuerpo tampoco", async () => {
    const { cliente, lineas } = armar([
      respuesta(500, { cliente: "Nombre Privado" }),
      respuesta(500),
      respuesta(401, { eco: SECRETO }),
    ]);

    const error = await cliente.get("/ruta").catch((e: unknown) => e);
    const todo = lineas.join("") + String(error);

    expect(lineas.length).toBeGreaterThan(0);
    expect(todo).not.toContain(SECRETO);
    expect(todo).not.toContain("Nombre Privado");
  });
});
