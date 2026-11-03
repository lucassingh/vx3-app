import { describe, expect, it } from "vitest";
import { mockRoutes } from "@/mocks/router";
import { dispatchApiRequest } from "./dispatch";
import { API_DOMAINS, API_PREFIX, domainOf } from "./domains";

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
    const response = await dispatchApiRequest(pedir("/cobros/caja"), { realDomains: [] });
    expect(response.status).toBe(200);
  });

  it("manda a la implementación real lo que figura como real, con los parámetros de la ruta", async () => {
    const response = await dispatchApiRequest(pedir("/stock/items/MSU2-1"), {
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

  it("un dominio real sin implementación responde 501", async () => {
    const response = await dispatchApiRequest(pedir("/stock/espejo"), { realDomains: ["stock"], realRoutes: {} });
    expect(response.status).toBe(501);
  });

  it("una ruta desconocida va al mock, que responde 404", async () => {
    const response = await dispatchApiRequest(pedir("/ventas"), { realDomains: ["stock"] });
    expect(response.status).toBe(404);
  });
});
