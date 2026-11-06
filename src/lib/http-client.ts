import "server-only";
import { siteConfig } from "@/config/site";
import { ExternalServiceError } from "./errors";
import { type Logger, logger as loggerBase } from "./logger";
import type { LimiteDeTasa } from "./rate-limit";

/**
 * Cliente HTTP de las integraciones (`tecnica.md` §7): límite de tasa, reintentos
 * con espera solo en lo reintentable, `Retry-After`, timeout y log de cada
 * problema. Leer se reintenta solo; escribir, no (ver `escribir`).
 *
 * Nunca loguea los headers ni el cuerpo: el token va en los headers, y el cuerpo
 * puede traer datos personales.
 */

export type RespuestaHttp = { status: number; cuerpo: unknown };

export type Veredicto =
  | { tipo: "ok" }
  | { tipo: "reintentar"; motivo: string; contexto?: Record<string, unknown> }
  /** No sirve reintentar. El mensaje es para la persona que usa la app. */
  | { tipo: "error"; mensaje: string; contexto?: Record<string, unknown> };

export type HttpClientOptions = {
  /** "DUX": para los mensajes y los logs. */
  servicio: string;
  baseUrl: string;
  headers?: Record<string, string>;
  limite?: LimiteDeTasa;
  /** Espera antes de cada reintento, en ms: cuántos elementos tiene es cuántas veces se reintenta. */
  esperasMs?: readonly number[];
  timeoutMs?: number;
  /** Los proveedores responden errores de muchas formas: cada uno decide cómo leer los suyos. */
  clasificar?: (respuesta: RespuestaHttp) => Veredicto;
  /** Se llama en cada intento, reintentos incluidos: es la cuenta real de llamadas al proveedor. */
  alIntentar?: () => void;
  fetch?: typeof globalThis.fetch;
  esperar?: (ms: number) => Promise<void>;
  log?: Logger;
};

const ESPERAS_POR_DEFECTO = [2_000, 5_000, 15_000];

function clasificarPorDefecto({ status }: RespuestaHttp): Veredicto {
  if (status >= 200 && status < 300) return { tipo: "ok" };
  if (status === 429 || status >= 500) return { tipo: "reintentar", motivo: `HTTP ${status}` };
  return { tipo: "error", mensaje: `Respondió HTTP ${status}.` };
}

/** Retry-After viene en segundos o como fecha. */
function retryAfterMs(valor: string | null, ahora = Date.now()): number | null {
  if (!valor) return null;
  const segundos = Number(valor);
  if (Number.isFinite(segundos)) return Math.max(0, segundos * 1_000);
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? null : Math.max(0, fecha - ahora);
}

function leerCuerpo(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export function createHttpClient({
  servicio,
  baseUrl,
  headers,
  limite,
  esperasMs = ESPERAS_POR_DEFECTO,
  timeoutMs = 60_000,
  clasificar = clasificarPorDefecto,
  alIntentar,
  fetch: fetchHttp = globalThis.fetch,
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = loggerBase,
}: HttpClientOptions) {
  const userAgent = `vx3-app/${siteConfig.version.replace(/^v/, "")}`;

  return {
    async get(ruta: string): Promise<RespuestaHttp> {
      const registro = log.child({ servicio, ruta });

      for (let intento = 0; ; intento++) {
        await limite?.turno();
        alIntentar?.();
        const inicio = performance.now();
        let motivo: string;
        let contexto: Record<string, unknown> | undefined;
        let pedirEspera: number | null = null;

        try {
          const res = await fetchHttp(`${baseUrl}${ruta}`, {
            headers: { Accept: "application/json", "User-Agent": userAgent, ...headers },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const respuesta = { status: res.status, cuerpo: leerCuerpo(await res.text()) };
          const veredicto = clasificar(respuesta);
          const ms = Math.round(performance.now() - inicio);

          if (veredicto.tipo === "ok") return respuesta;
          if (veredicto.tipo === "error") {
            registro.warn({ status: res.status, ms, ...veredicto.contexto }, veredicto.mensaje);
            throw new ExternalServiceError(servicio, veredicto.mensaje);
          }
          motivo = veredicto.motivo;
          contexto = { status: res.status, ms, ...veredicto.contexto };
          pedirEspera = retryAfterMs(res.headers.get("retry-after"));
        } catch (error) {
          if (error instanceof ExternalServiceError) throw error;
          // Red caída o timeout: el fetch no llegó a dar una respuesta.
          motivo = error instanceof Error ? error.name : "error de red";
        }

        const espera = esperasMs[intento];
        if (espera === undefined) {
          registro.error({ ...contexto, motivo, intentos: intento + 1 }, "se agotaron los reintentos");
          throw new ExternalServiceError(
            servicio,
            `${servicio} no respondió bien después de ${intento + 1} ${intento ? "intentos" : "intento"}. Probá de nuevo en unos minutos.`,
          );
        }

        const hasta = Math.max(espera, pedirEspera ?? 0);
        registro.warn({ ...contexto, motivo, intento: intento + 1, esperaMs: hasta }, "reintento");
        // Lo que pide el proveedor vale para todas las instancias, no solo para esta.
        if (pedirEspera) await limite?.postergar(pedirEspera);
        await esperar(hasta);
      }
    },

    /**
     * Sin reintentos: si se corta la red o responde mal, no se sabe si el cambio quedó hecho, y
     * repetirlo puede duplicarlo. Quien llama mira antes de volver a intentar. Solo se repite un
     * 429, porque ese pedido no se procesó.
     */
    async escribir(metodo: "POST" | "PUT", ruta: string, cuerpo: unknown): Promise<RespuestaHttp> {
      const registro = log.child({ servicio, ruta, metodo });
      const sinConfirmar = `${servicio} no confirmó el cambio, y no se sabe si quedó hecho. Revisalo antes de volver a intentar.`;

      for (let intento = 0; ; intento++) {
        await limite?.turno();
        alIntentar?.();
        let res: Response;
        try {
          res = await fetchHttp(`${baseUrl}${ruta}`, {
            method: metodo,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": userAgent,
              ...headers,
            },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (error) {
          registro.error({ motivo: error instanceof Error ? error.name : "error de red" }, "escritura sin respuesta");
          throw new ExternalServiceError(servicio, sinConfirmar);
        }

        const espera = esperasMs[intento];
        if (res.status === 429 && espera !== undefined) {
          const pedirEspera = retryAfterMs(res.headers.get("retry-after"));
          registro.warn({ status: 429, intento: intento + 1 }, "escritura postergada");
          if (pedirEspera) await limite?.postergar(pedirEspera);
          await esperar(Math.max(espera, pedirEspera ?? 0));
          continue;
        }

        const respuesta = { status: res.status, cuerpo: leerCuerpo(await res.text()) };
        const veredicto = clasificar(respuesta);
        if (veredicto.tipo === "ok") return respuesta;
        if (veredicto.tipo === "error") {
          registro.warn({ status: res.status, ...veredicto.contexto }, veredicto.mensaje);
          throw new ExternalServiceError(servicio, veredicto.mensaje);
        }
        registro.error(
          { status: res.status, motivo: veredicto.motivo, ...veredicto.contexto },
          "escritura sin confirmar",
        );
        throw new ExternalServiceError(servicio, sinConfirmar);
      }
    },
  };
}
