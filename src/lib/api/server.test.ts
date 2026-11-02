// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "@/mocks/db";
import { toQueryString } from "./http";
import { api } from "./server";

// connection() solo existe dentro de un request de Next.
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

beforeEach(() => {
  resetDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("api (servidor)", () => {
  it("con NEXT_PUBLIC_API_MOCK=true resuelve contra la API simulada, sin red", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "true");
    vi.stubEnv("API_URL", "https://api.example.com/v1");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const kpis = await api.dashboard.kpis();

    expect(kpis.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sin la variable, el mock queda activo por defecto", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await api.dashboard.kpis();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("con NEXT_PUBLIC_API_MOCK=false llama a API_URL con headers JSON", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "false");
    vi.stubEnv("API_URL", "https://api.example.com/v1");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await api.dashboard.ventas(7);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/v1/dashboard/ventas?days=7");
    expect(new Headers(init?.headers).get("Accept")).toBe("application/json");
  });

  it("con el mock apagado y sin API_URL avisa qué falta", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "false");
    vi.stubEnv("API_URL", "");

    await expect(api.dashboard.kpis()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: expect.stringMatching(/API_URL/),
    });
  });

  it("convierte las respuestas de error en ApiError", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "false");
    vi.stubEnv("API_URL", "https://api.example.com/v1");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: { status: 404, message: "No existe" } }, { status: 404 }),
    );

    await expect(api.dashboard.kpis()).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "No existe",
    });
  });
});

describe("toQueryString", () => {
  it("omite valores vacíos", () => {
    expect(toQueryString({ q: "", page: 2, status: undefined })).toBe("?page=2");
    expect(toQueryString({})).toBe("");
  });
});
