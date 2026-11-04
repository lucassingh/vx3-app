import type { StockEstado } from "@/lib/api/types";
import { espejoDeStock, estadoDelEspejo, kpisDelEspejo, rubrosDelEspejo } from "@/modules/inventory/espejo-stock";
import type { ApiDomain } from "./domains";
import type { Route } from "./route";

const ESTADOS: StockEstado[] = ["agotado", "critico", "ok", "sobrestock", "sin_rotacion"];

/** El espejo de DUX (1.4). Margen, compras y proveedores siguen simulados hasta sus PR. */
const stock: Route[] = [
  { method: "GET", pattern: /^\/stock\/sync$/, handler: async () => Response.json(await estadoDelEspejo()) },
  { method: "GET", pattern: /^\/stock\/kpis$/, handler: async () => Response.json(await kpisDelEspejo()) },
  { method: "GET", pattern: /^\/stock\/rubros$/, handler: async () => Response.json(await rubrosDelEspejo()) },
  {
    method: "GET",
    pattern: /^\/stock\/espejo$/,
    handler: async ({ url }) => {
      const estado = url.searchParams.get("estado") as StockEstado | null;
      const filas = await espejoDeStock({
        q: url.searchParams.get("q") ?? undefined,
        rubro: url.searchParams.get("rubro") ?? undefined,
        estado: estado && ESTADOS.includes(estado) ? estado : undefined,
      });
      return Response.json(filas);
    },
  },
];

/**
 * Implementaciones reales de cada dominio, con el mismo contrato que su mock
 * (src/mocks/domains). Se activan con API_REAL_DOMAINS, y lo que un dominio todavía no
 * tiene acá sigue saliendo de la API simulada (dispatch.ts).
 */
export const realRoutes: Partial<Record<ApiDomain, Route[]>> = { stock };
