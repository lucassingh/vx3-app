import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "@/mocks/db";
import { toQueryString } from "./http";
import { api } from "./server";

// connection() solo existe dentro de un request de Next.
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

vi.mock("@/modules/platform/auth/session", async () => {
  const { usuarioDePrueba } = await import("@/test/users");
  return { getSessionUser: async () => usuarioDePrueba("admin") };
});

// Un dominio real de prueba: el dashboard, con una sola ruta.
vi.mock("./real-routes", () => ({
  realRoutes: {
    dashboard: [
      {
        method: "GET",
        pattern: /^\/dashboard\/kpis$/,
        handler: ({ request }: { request: Request }) =>
          Response.json([{ id: "real", label: request.headers.get("Accept"), value: 1, format: "number" }]),
      },
    ],
  },
}));

beforeEach(() => {
  resetDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("api (servidor)", () => {
  it("por defecto todos los dominios usan la API simulada, en el mismo proceso y sin red", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const kpis = await api.dashboard.kpis();

    expect(kpis.map((kpi) => kpi.id)).toContain("facturacion");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un dominio en API_REAL_DOMAINS usa su implementación real, con los headers por defecto", async () => {
    vi.stubEnv("API_REAL_DOMAINS", "dashboard");

    const kpis = await api.dashboard.kpis();

    expect(kpis).toEqual([{ id: "real", label: "application/json", value: 1, format: "number" }]);
  });

  it("los dominios que no figuran siguen simulados aunque haya otros reales", async () => {
    vi.stubEnv("API_REAL_DOMAINS", "dashboard");

    const caja = await api.cobros.caja();

    expect(caja.cuentas.length).toBeGreaterThan(0);
  });

  it("un dominio real sin la ruta pedida sigue con la API simulada", async () => {
    vi.stubEnv("API_REAL_DOMAINS", "dashboard");

    await expect(api.dashboard.ventas(7)).resolves.toBeDefined();
  });
});

describe("toQueryString", () => {
  it("omite valores vacíos", () => {
    expect(toQueryString({ q: "", page: 2, status: undefined })).toBe("?page=2");
    expect(toQueryString({})).toBe("");
  });
});
