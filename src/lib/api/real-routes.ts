import type { Segmento, StockEstado } from "@/lib/api/types";
import {
  clientasUnificadas,
  coberturaDeClientas,
  fichaDeClienta,
  listarClientas,
  segmentosDeClientas,
} from "@/modules/customers/consultas";
import { espejoDeStock, estadoDelEspejo, kpisDelEspejo, rubrosDelEspejo } from "@/modules/inventory/espejo-stock";
import type { ApiDomain } from "./domains";
import { errorResponse, readInt, type Route } from "./route";

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

const SEGMENTOS: Segmento[] = ["nueva", "activa", "top", "en_riesgo", "dormida"];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Las fichas (1.5). La recompra sigue simulada hasta el 1.5.6: como las clientas reales
 * tienen UUID, lo de "/clientas/recompra" y un ID de las pantallas simuladas siguen de largo.
 */
const clientas: Route[] = [
  {
    method: "GET",
    pattern: /^\/clientas$/,
    handler: async ({ url }) => {
      const segmento = url.searchParams.get("segmento") as Segmento | null;
      const pagina = await listarClientas({
        q: url.searchParams.get("q") ?? undefined,
        segmento: segmento && SEGMENTOS.includes(segmento) ? segmento : undefined,
        page: readInt(url.searchParams.get("page"), 1),
        pageSize: readInt(url.searchParams.get("pageSize"), 8, 100),
      });
      return Response.json(pagina);
    },
  },
  {
    method: "GET",
    pattern: /^\/clientas\/segmentos$/,
    handler: async () => Response.json(await segmentosDeClientas()),
  },
  {
    method: "GET",
    pattern: /^\/clientas\/cobertura$/,
    handler: async () => Response.json(await coberturaDeClientas()),
  },
  {
    method: "GET",
    pattern: /^\/clientas\/duplicados$/,
    handler: async () => Response.json(await clientasUnificadas()),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/clientas/(${UUID})$`),
    handler: async ({ params: [id] }) => {
      const ficha = await fichaDeClienta(id);
      return ficha ? Response.json(ficha) : errorResponse(404, "No existe esa clienta.");
    },
  },
];

/**
 * Implementaciones reales de cada dominio, con el mismo contrato que su mock
 * (src/mocks/domains). Se activan con API_REAL_DOMAINS, y lo que un dominio todavía no
 * tiene acá sigue saliendo de la API simulada (dispatch.ts).
 */
export const realRoutes: Partial<Record<ApiDomain, Route[]>> = { stock, clientas };
