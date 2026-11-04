import "server-only";
import pino, { type DestinationStream, type Logger } from "pino";
import { serverEnv } from "@/env";

/**
 * Logs estructurados: una línea JSON por evento, con el ID del request o de la
 * ejecución para seguir un caso de punta a punta (`logger.child({ requestId })`).
 * Reemplaza a console.log en todo el servidor.
 *
 * Sin datos personales: los campos de abajo se ocultan aunque alguien los pase
 * por error. Lo que se loguea son IDs, códigos, tiempos y conteos.
 */

export type { Logger };

const OCULTOS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "email",
  "telefono",
  "phone",
  "cuit",
  "dni",
  "direccion",
  "address",
];

/** Cada campo, suelto o un nivel adentro (headers.authorization, clienta.email). */
const REDACT_PATHS = OCULTOS.flatMap((campo) => [campo, `*.${campo}`]);

function defaultLevel() {
  const { LOG_LEVEL, NODE_ENV } = serverEnv();
  if (LOG_LEVEL) return LOG_LEVEL;
  if (NODE_ENV === "test") return "silent";
  return NODE_ENV === "production" ? "info" : "debug";
}

export function createLogger(destination?: DestinationStream, level = defaultLevel()) {
  return pino(
    {
      level,
      base: { app: "vx3" },
      redact: { paths: REDACT_PATHS, censor: "[oculto]" },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    },
    destination,
  );
}

export const logger = createLogger();
