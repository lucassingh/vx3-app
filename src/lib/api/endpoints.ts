import { botEndpoints } from "./contracts/bot";
import { catalogoEndpoints } from "./contracts/catalogo";
import { clientasEndpoints } from "./contracts/clientas";
import { cobrosEndpoints } from "./contracts/cobros";
import { conversacionesEndpoints } from "./contracts/conversaciones";
import { dashboardEndpoints } from "./contracts/dashboard";
import { enviosEndpoints } from "./contracts/envios";
import { pautaEndpoints } from "./contracts/pauta";
import { pedidosEndpoints } from "./contracts/pedidos";
import { plataformaEndpoints } from "./contracts/plataforma";
import { postventaEndpoints } from "./contracts/postventa";
import { stockEndpoints } from "./contracts/stock";
import { vidrieraEndpoints } from "./contracts/vidriera";
import type { ApiRequest } from "./http";
import type { Notification } from "./types";

/**
 * Endpoints de la API, definidos una sola vez. `server.ts` y `browser.ts` los
 * exponen con el transporte que corresponde a cada entorno. Cada módulo
 * declara los suyos en contracts/<dominio>.ts.
 */
export function createApi(request: ApiRequest) {
  return {
    dashboard: dashboardEndpoints(request),
    notifications: {
      list: () => request<Notification[]>("/notifications"),
      markAllRead: () =>
        request<{ updated: number }>("/notifications/read-all", { method: "POST" }),
    },
    conversaciones: conversacionesEndpoints(request),
    bot: botEndpoints(request),
    vidriera: vidrieraEndpoints(request),
    clientas: clientasEndpoints(request),
    pauta: pautaEndpoints(request),
    pedidos: pedidosEndpoints(request),
    envios: enviosEndpoints(request),
    cobros: cobrosEndpoints(request),
    postventa: postventaEndpoints(request),
    catalogo: catalogoEndpoints(request),
    stock: stockEndpoints(request),
    plataforma: plataformaEndpoints(request),
  };
}

export type Api = ReturnType<typeof createApi>;
