import { describe, expect, it, vi } from "vitest";
import { mockRoutes } from "@/mocks/router";
import { dispatchApiRequest } from "./dispatch";
import { API_DOMAINS, API_PREFIX, domainOf } from "./domains";

const ADMIN = { role: "admin" } as const;

const pedir = (path: string, method = "GET") => new Request(`http://app.local${API_PREFIX}${path}`, { method });

describe("domainOf", () => {
  it("toma el primer segmento de la ruta", () => {
    expect(domainOf("/cobros/caja?x=1")).toBe("cobros");
    expect(domainOf("/notifications")).toBe("notifications");
    expect(domainOf("/ventas")).toBeNull();
    expect(domainOf("/")).toBeNull();
  });

  it("cada ruta del mock pertenece a un dominio conocido", () => {
    const sinDominio = mockRoutes
      .map((route) => route.pattern.source.match(/^\^\\\/([a-z-]+)/)?.[1] ?? route.pattern.source)
      .filter((segmento) => !(API_DOMAINS as readonly string[]).includes(segmento));
    expect(sinDominio).toEqual([]);
  });
});

describe("dispatchApiRequest", () => {
  it("manda a la API simulada lo que no es real", async () => {
    const response = await dispatchApiRequest(pedir("/cobros/caja"), { user: ADMIN, realDomains: [] });
    expect(response.status).toBe(200);
  });

  it("manda a la implementación real lo que figura como real, con los parámetros de la ruta", async () => {
    const response = await dispatchApiRequest(pedir("/stock/items/MSU2-1"), {
      user: ADMIN,
      realDomains: ["stock"],
      realRoutes: {
        stock: [
          {
            method: "GET",
            pattern: /^\/stock\/items\/([^/]+)$/,
            handler: ({ params: [sku] }) => Response.json({ sku }),
          },
        ],
      },
    });
    expect(await response.json()).toEqual({ sku: "MSU2-1" });
  });

  it("lo que un dominio real todavía no tiene sigue saliendo de la API simulada", async () => {
    const llamada = vi.fn(() => Response.json({ real: true }));
    const response = await dispatchApiRequest(pedir("/stock/proveedores"), {
      user: ADMIN,
      realDomains: ["stock"],
      realRoutes: { stock: [{ method: "GET", pattern: /^\/stock\/sync$/, handler: llamada }] },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.any(Array));
    expect(llamada).not.toHaveBeenCalled();
  });

  it("un dominio real sin ninguna ruta todavía sale entero de la API simulada", async () => {
    const response = await dispatchApiRequest(pedir("/stock/proveedores"), {
      user: ADMIN,
      realDomains: ["stock"],
      realRoutes: {},
    });

    expect(response.status).toBe(200);
  });

  it("la ruta real solo atiende su método: otro método va a la API simulada", async () => {
    const llamada = vi.fn(() => Response.json({ real: true }));
    const response = await dispatchApiRequest(pedir("/stock/kpis"), {
      user: ADMIN,
      realDomains: ["stock"],
      realRoutes: { stock: [{ method: "POST", pattern: /^\/stock\/kpis$/, handler: llamada }] },
    });

    expect(response.status).toBe(200);
    expect(llamada).not.toHaveBeenCalled();
  });

  it("una ruta que no existe en ninguna responde 404", async () => {
    const response = await dispatchApiRequest(pedir("/stock/no-existe"), {
      user: ADMIN,
      realDomains: ["stock"],
      realRoutes: {},
    });

    expect(response.status).toBe(404);
  });

  it("una ruta desconocida va al mock, que responde 404", async () => {
    const response = await dispatchApiRequest(pedir("/ventas"), { user: ADMIN, realDomains: ["stock"] });
    expect(response.status).toBe(404);
  });
});

describe("dispatchApiRequest: sesión y permisos", () => {
  it("sin usuario responde 401", async () => {
    const response = await dispatchApiRequest(pedir("/dashboard/kpis"), { user: null, realDomains: [] });
    expect(response.status).toBe(401);
  });

  it("un rol sin acceso al área recibe 403, aunque el dominio sea simulado", async () => {
    const response = await dispatchApiRequest(pedir("/pauta/anuncios"), {
      user: { role: "postventa" },
      realDomains: [],
    });
    expect(response.status).toBe(403);
  });

  it("ver alcanza para GET pero no para escribir", async () => {
    const lectura = { role: "solo_lectura" } as const;
    expect((await dispatchApiRequest(pedir("/cobros/caja"), { user: lectura, realDomains: [] })).status).toBe(200);
    const escritura = await dispatchApiRequest(pedir("/cobros/caja/saldos", "POST"), {
      user: lectura,
      realDomains: [],
    });
    expect(escritura.status).toBe(403);
  });

  it("lo que no pertenece a un área (inicio, perfil) lo usa cualquiera con sesión", async () => {
    const response = await dispatchApiRequest(pedir("/dashboard/kpis"), { user: { role: "compras" }, realDomains: [] });
    expect(response.status).toBe(200);
  });
});
