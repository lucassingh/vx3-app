import "server-only";
import { getDb } from "@/db/client";

/**
 * Límite de tasa compartido entre instancias (`tecnica.md` §4.3): en Vercel corren
 * varias a la vez y cada una, por su cuenta, pasaría el límite de la cuenta del
 * proveedor. El próximo turno libre vive en Postgres: reservarlo es una sola
 * sentencia, que la fila serializa, así que dos instancias nunca toman el mismo.
 */

export type LimiteDeTasa = {
  /** Espera hasta que le toque. */
  turno: () => Promise<void>;
  /** Nadie sale antes de `ms`: el proveedor pidió esperar (Retry-After). */
  postergar: (ms: number) => Promise<void>;
};

/** Reserva el próximo turno y devuelve cuántos ms faltan para que llegue. */
export async function reservarTurno(clave: string, intervaloMs: number): Promise<number> {
  const [fila] = await getDb().$queryRaw<{ espera_ms: number }[]>`
    INSERT INTO rate_limits (key, next_slot_at)
    VALUES (${clave}, clock_timestamp() + make_interval(secs => ${intervaloMs}::float8 / 1000))
    ON CONFLICT (key) DO UPDATE
      SET next_slot_at = GREATEST(rate_limits.next_slot_at, clock_timestamp())
        + make_interval(secs => ${intervaloMs}::float8 / 1000)
    RETURNING GREATEST(
      EXTRACT(EPOCH FROM (next_slot_at - clock_timestamp())) * 1000 - ${intervaloMs}::float8,
      0
    )::float8 AS espera_ms`;
  return fila?.espera_ms ?? 0;
}

export function limiteCompartido(clave: string, intervaloMs: number): LimiteDeTasa {
  return {
    turno: async () => {
      const espera = await reservarTurno(clave, intervaloMs);
      if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
    },
    postergar: async (ms) => {
      await getDb().$executeRaw`
        INSERT INTO rate_limits (key, next_slot_at)
        VALUES (${clave}, clock_timestamp() + make_interval(secs => ${ms}::float8 / 1000))
        ON CONFLICT (key) DO UPDATE
          SET next_slot_at = GREATEST(
            rate_limits.next_slot_at,
            clock_timestamp() + make_interval(secs => ${ms}::float8 / 1000)
          )`;
    },
  };
}
