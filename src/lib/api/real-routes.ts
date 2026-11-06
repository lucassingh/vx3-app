import type { RecompraEstado, Segmento, StockEstado } from "@/lib/api/types";
import {
  casosDeUnBloque,
  decisionesDeRevision,
  facetasDelCatalogo,
  fichaDelProducto,
  kpisDelCatalogo,
  listarProductos,
  parecidosDelAlta,
  resumenDeRevision,
} from "@/modules/catalog/consultas";
import { listarBorradores, opcionesDeAlta } from "@/modules/catalog/alta-consultas";
import { leerQueryDelCatalogo } from "@/modules/catalog/filtros";
import {
  clientasUnificadas,
  coberturaDeClientas,
  fichaDeClienta,
  listarClientas,
  segmentosDeClientas,
} from "@/modules/customers/consultas";
import {
  listaDeRecompra,
  marcarRecompra,
  RecompraNoCorresponde,
  resultadosDeRecompra,
} from "@/modules/customers/recompra";
import { espejoDeStock, estadoDelEspejo, kpisDelEspejo, rubrosDelEspejo } from "@/modules/inventory/espejo-stock";
import type { ApiDomain } from "./domains";
import { errorResponse, readInt, readJson, type Route } from "./route";

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
const ESTADOS_RECOMPRA: RecompraEstado[] = ["pendiente", "contactada", "respondio", "pospuesta"];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Las fichas y la recompra (1.5). Las clientas reales tienen UUID: un ID de las pantallas
 * que siguen simuladas va de largo a la API simulada.
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
  { method: "GET", pattern: /^\/clientas\/recompra$/, handler: async () => Response.json(await listaDeRecompra()) },
  {
    method: "GET",
    pattern: /^\/clientas\/recompra\/resultados$/,
    handler: async () => Response.json(await resultadosDeRecompra()),
  },
  {
    method: "PATCH",
    pattern: new RegExp(`^/clientas/recompra/(${UUID})$`),
    handler: async ({ params: [id], request, actorId }) => {
      const { estado, mensaje } = await readJson<{ estado: RecompraEstado; mensaje: string }>(request);
      if (!estado || !ESTADOS_RECOMPRA.includes(estado)) return errorResponse(400, "Estado inválido.");
      try {
        const marcada = await marcarRecompra(
          id,
          { estado, mensaje: typeof mensaje === "string" && mensaje.trim() ? mensaje.trim() : undefined },
          actorId ?? null,
        );
        return marcada ? Response.json(marcada) : errorResponse(404, "No existe esa clienta.");
      } catch (error) {
        if (error instanceof RecompraNoCorresponde) return errorResponse(409, error.message);
        throw error;
      }
    },
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

const queryDelCatalogo = (url: URL) => leerQueryDelCatalogo((nombre) => url.searchParams.get(nombre));

/** El catálogo armado desde el Sheet, Drive y DUX (1.8). El alta, los combos y el control final siguen simulados. */
const catalogo: Route[] = [
  {
    method: "GET",
    pattern: /^\/catalogo\/alta\/opciones$/,
    handler: async () => Response.json(await opcionesDeAlta()),
  },
  {
    method: "GET",
    pattern: /^\/catalogo\/alta\/borradores$/,
    handler: async () => Response.json(await listarBorradores()),
  },
  {
    method: "GET",
    pattern: /^\/catalogo\/alta\/parecidos$/,
    handler: async ({ url }) =>
      Response.json(
        await parecidosDelAlta({
          q: url.searchParams.get("q") ?? "",
          rubro: url.searchParams.get("rubro") ?? undefined,
          subrubro: url.searchParams.get("subrubro") ?? undefined,
        }),
      ),
  },
  { method: "GET", pattern: /^\/catalogo\/revision$/, handler: async () => Response.json(await resumenDeRevision()) },
  {
    method: "GET",
    pattern: /^\/catalogo\/revision\/casos$/,
    handler: async ({ url }) =>
      Response.json(
        await casosDeUnBloque({
          bloque: url.searchParams.get("bloque") ?? "",
          page: readInt(url.searchParams.get("page"), 1),
          pageSize: readInt(url.searchParams.get("pageSize"), 20, 100),
        }),
      ),
  },
  {
    method: "GET",
    pattern: /^\/catalogo\/revision\/decisiones$/,
    handler: async () => Response.json(await decisionesDeRevision()),
  },
  { method: "GET", pattern: /^\/catalogo\/kpis$/, handler: async () => Response.json(await kpisDelCatalogo()) },
  {
    method: "GET",
    pattern: /^\/catalogo\/facetas$/,
    handler: async ({ url }) => Response.json(await facetasDelCatalogo(queryDelCatalogo(url))),
  },
  {
    method: "GET",
    pattern: /^\/catalogo\/productos$/,
    handler: async ({ url }) =>
      Response.json(
        await listarProductos({
          ...queryDelCatalogo(url),
          page: readInt(url.searchParams.get("page"), 1),
          pageSize: readInt(url.searchParams.get("pageSize"), 24, 100),
        }),
      ),
  },
  {
    method: "GET",
    pattern: /^\/catalogo\/productos\/([^/]+)$/,
    handler: async ({ params: [sku] }) => {
      const ficha = await fichaDelProducto(decodeURIComponent(sku));
      return ficha ? Response.json(ficha) : errorResponse(404, `No existe el producto ${decodeURIComponent(sku)}.`);
    },
  },
];

/**
 * Implementaciones reales de cada dominio, con el mismo contrato que su mock
 * (src/mocks/domains). Se activan con API_REAL_DOMAINS, y lo que un dominio todavía no
 * tiene acá sigue saliendo de la API simulada (dispatch.ts).
 */
export const realRoutes: Partial<Record<ApiDomain, Route[]>> = { stock, clientas, catalogo };
