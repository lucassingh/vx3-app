import { MOCK_API_PREFIX } from "./constants";
import { routes as bot } from "./domains/bot";
import { routes as catalogo } from "./domains/catalogo";
import { routes as clientas } from "./domains/clientas";
import { routes as cobros } from "./domains/cobros";
import { routes as conversaciones } from "./domains/conversaciones";
import { routes as dashboard } from "./domains/dashboard";
import { routes as envios } from "./domains/envios";
import { routes as notifications } from "./domains/notifications";
import { routes as pauta } from "./domains/pauta";
import { routes as pedidos } from "./domains/pedidos";
import { routes as plataforma } from "./domains/plataforma";
import { routes as postventa } from "./domains/postventa";
import { routes as stock } from "./domains/stock";
import { routes as vidriera } from "./domains/vidriera";
import { errorResponse, type Route } from "./http";

export { MOCK_API_PREFIX };

/**
 * Router de la API simulada. Lo usan el Route Handler (/api/mock/*, para el
 * navegador) y lib/api/server.ts (en proceso, para Server Components).
 * Cada dominio declara sus rutas en src/mocks/domains/<dominio>.ts.
 *
 * Variables de entorno:
 *   MOCK_API_DELAY_MS      latencia base en ms (default 350, con ±30 % de variación)
 *   MOCK_API_FAILURE_RATE  probabilidad de 0 a 1 de responder 503 (default 0)
 */
const routes: Route[] = [
  ...dashboard,
  ...notifications,
  ...conversaciones,
  ...bot,
  ...vidriera,
  ...clientas,
  ...pauta,
  ...pedidos,
  ...envios,
  ...cobros,
  ...postventa,
  ...catalogo,
  ...stock,
  ...plataforma,
];

function simulateLatency() {
  const base = Number(process.env.MOCK_API_DELAY_MS ?? 350);
  if (!Number.isFinite(base) || base <= 0) return Promise.resolve();
  const jitter = base * 0.3 * (Math.random() * 2 - 1);
  return new Promise((resolve) => setTimeout(resolve, Math.round(base + jitter)));
}

function shouldFail() {
  const rate = Number(process.env.MOCK_API_FAILURE_RATE ?? 0);
  return Number.isFinite(rate) && rate > 0 && Math.random() < rate;
}

export async function handleMockRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(MOCK_API_PREFIX.length) || "/";

  await simulateLatency();
  if (shouldFail()) {
    return errorResponse(503, "La API simulada falló a propósito (MOCK_API_FAILURE_RATE).");
  }

  for (const route of routes) {
    const match = route.method === request.method ? path.match(route.pattern) : null;
    if (match) return route.handler({ url, params: match.slice(1), request });
  }
  return errorResponse(404, `No existe ${request.method} ${path} en la API simulada.`);
}
