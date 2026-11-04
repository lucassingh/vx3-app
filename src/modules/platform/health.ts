import "server-only";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";

/**
 * Estado de la app para los deploys y el monitor de disponibilidad
 * (/api/health). No dice nada sensible: la versión, el commit, el ambiente y,
 * si se pide, si la base contesta y en cuánto.
 */

const LIMITE_BASE_MS = 5_000;

export type Salud = {
  ok: boolean;
  version: string;
  commit: string;
  ambiente: string;
  base?: { ok: boolean; ms: number };
};

/** Los fija el build (next.config.ts): en local no están. */
export function datosDelBuild() {
  return {
    version: process.env.APP_VERSION ?? "0.0.0",
    commit: process.env.APP_COMMIT ?? "local",
    ambiente: process.env.APP_ENV ?? "local",
  };
}

async function pingDeLaBase() {
  await getDb().$queryRaw`SELECT 1`;
}

function conLimite(tarea: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`la base no contestó en ${ms} ms`)), ms);
  });
  return Promise.race([tarea, limite]).finally(() => clearTimeout(timer));
}

export async function revisarSalud({
  conBase,
  ping = pingDeLaBase,
}: {
  conBase: boolean;
  ping?: () => Promise<unknown>;
}): Promise<Salud> {
  const build = datosDelBuild();
  if (!conBase) return { ok: true, ...build };

  const inicio = performance.now();
  const ok = await conLimite(ping(), LIMITE_BASE_MS).then(
    () => true,
    (error: unknown) => {
      logger.error({ err: error }, "el chequeo de salud no llegó a la base");
      return false;
    },
  );
  return { ok, ...build, base: { ok, ms: Math.round(performance.now() - inicio) } };
}
