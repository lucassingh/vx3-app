"use server";

/**
 * PROVISORIO (30/10): el botón "Probar DUX" del Inicio llama a esta acción para
 * ver qué devuelve la API real. El token queda en el servidor; el navegador
 * recibe solo la respuesta.
 *
 * Un request por consulta, y siempre 5,5 s entre uno y otro aunque se apriete
 * el botón seguido: el límite es por cuenta y lo comparten los scripts de Elías
 * y el Hub.
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { serverEnv } from "@/env";

const MIN_GAP_MS = 5_500;
const USER_AGENT = "vx3-app/0.1 (desarrollo local)";

export type DuxProbeKey = "stock" | "items" | "facturas";

export type DuxProbeResult = {
  label: string;
  /** Ruta y parámetros, sin el token. */
  request: string;
  status: number | null;
  ms: number;
  body: unknown;
};

export type DuxProbeResponse = { ok: true; result: DuxProbeResult } | { ok: false; message: string };

type Probe = { label: string; path: string; authorization: string };

// Cola de requests a DUX de este proceso: uno por vez y con MIN_GAP_MS entre cada uno.
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await task();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function probeDux(key: DuxProbeKey): Promise<DuxProbeResponse> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, message: "La prueba de DUX solo anda en desarrollo local." };
  }
  const cookieStore = await cookies();
  if (!(await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value))) {
    return { ok: false, message: "La sesión venció: volvé a entrar." };
  }

  const {
    DUX_API_URL: baseUrl,
    DUX_TOKEN: token,
    DUX_ID_EMPRESA: idEmpresa,
    DUX_ID_SUCURSAL_ECOMMERCE: idSucursal,
    DUX_ID_DEPOSITO: idDeposito,
  } = serverEnv();
  if (!baseUrl || !token || !idEmpresa || !idSucursal || (key === "stock" && !idDeposito)) {
    return {
      ok: false,
      message: "Faltan variables DUX_* en .env.local. Después de cargarlas, reiniciá npm run dev.",
    };
  }

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const facturas = new URLSearchParams({
    idEmpresa: String(idEmpresa),
    idSucursal: String(idSucursal),
    fechaDesde: localDate(weekAgo),
    fechaHasta: localDate(today),
    offset: "0",
    limit: "3",
  });

  // Solo estas consultas: el cliente elige una clave, nunca la ruta.
  const probes: Record<DuxProbeKey, Probe> = {
    // La v2 es la que va a usar la app (solucion_doc/04 §1.1), con "Bearer".
    // Pide id_deposito o cod_item (sin ninguno responde 400). 50 es el máximo
    // por página y cuesta el mismo request que 3.
    stock: {
      label: "Stock (v2, depósito Temperley)",
      path: `/v2/stock?${new URLSearchParams({ id_deposito: String(idDeposito ?? ""), offset: "0", limit: "50" })}`,
      authorization: `Bearer ${token}`,
    },
    items: {
      label: "Items (v2)",
      path: "/v2/items?offset=0&limit=3",
      authorization: `Bearer ${token}`,
    },
    // La v1 es la que usa el Hub, con el token sin "Bearer".
    facturas: {
      label: "Facturas de los últimos 7 días (v1, sucursal ecommerce)",
      path: `/facturas?${facturas}`,
      authorization: token,
    },
  };

  const probe = probes[key];
  if (!probe) return { ok: false, message: `Consulta desconocida: ${key}` };
  return { ok: true, result: await throttled(() => runProbe(baseUrl, probe)) };
}

async function runProbe(baseUrl: string, { label, path, authorization }: Probe): Promise<DuxProbeResult> {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: authorization,
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 2_000);
    }
    return { label, request: path, status: res.status, ms: Date.now() - startedAt, body };
  } catch (error) {
    return {
      label,
      request: path,
      status: null,
      ms: Date.now() - startedAt,
      body: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

/** YYYY-MM-DD en hora local (toISOString pasaría a UTC y de noche daría mañana). */
function localDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
