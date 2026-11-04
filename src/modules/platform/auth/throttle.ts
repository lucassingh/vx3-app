import "server-only";
import { getDb } from "@/db/client";

/**
 * Límite de intentos de login (tecnica_doc §6.1, fuerza bruta). Cuenta los
 * fallidos por usuario (5 en 15 minutos) y por IP (20: en la oficina todos
 * salen por la misma). Al pasarse, bloquea 15 minutos; cada bloqueo seguido
 * duplica la espera, hasta 24 horas. Un ingreso correcto limpia el contador
 * del usuario. Vive en la base porque en Vercel cada request puede caer en
 * otra instancia.
 */

const MINUTO = 60 * 1000;
const VENTANA_MS = 15 * MINUTO;
const BLOQUEO_BASE_MS = 15 * MINUTO;
const BLOQUEO_MAXIMO_MS = 24 * 60 * MINUTO;
/** Si pasó un día sin fallos, la espera vuelve a empezar de 15 minutos. */
export const OLVIDO_MS = 24 * 60 * MINUTO;

export const LIMITE = { user: 5, ip: 20 } as const;

export type EstadoIntentos = {
  failures: number;
  windowStartedAt: Date;
  lockouts: number;
  lockedUntil: Date | null;
  updatedAt: Date;
};

/** Cómo queda el contador después de un intento fallido. */
export function aplicarFallo(previo: EstadoIntentos | null, limite: number, ahora: Date): EstadoIntentos {
  const olvidado = !previo || ahora.getTime() - previo.updatedAt.getTime() > OLVIDO_MS;
  const lockouts = olvidado ? 0 : previo.lockouts;
  const ventanaVigente = previo && !olvidado && ahora.getTime() - previo.windowStartedAt.getTime() < VENTANA_MS;
  const failures = ventanaVigente ? previo.failures + 1 : 1;
  const windowStartedAt = ventanaVigente ? previo.windowStartedAt : ahora;

  if (failures < limite) {
    return { failures, windowStartedAt, lockouts, lockedUntil: previo?.lockedUntil ?? null, updatedAt: ahora };
  }
  const espera = Math.min(BLOQUEO_BASE_MS * 2 ** lockouts, BLOQUEO_MAXIMO_MS);
  return {
    failures: 0,
    windowStartedAt: ahora,
    lockouts: lockouts + 1,
    lockedUntil: new Date(ahora.getTime() + espera),
    updatedAt: ahora,
  };
}

export function clavesDeIntento(identifier: string, ip: string) {
  return { user: `user:${identifier.trim().toLowerCase()}`, ip: `ip:${ip}` };
}

/** La IP del cliente: Vercel la pone primera en x-forwarded-for. */
export function ipDelCliente(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "desconocida";
}

/** Hasta cuándo está bloqueada alguna de las claves, o null si ninguna. */
export async function bloqueadoHasta(claves: string[], ahora = new Date()): Promise<Date | null> {
  const filas = await getDb().loginThrottle.findMany({
    where: { key: { in: claves }, lockedUntil: { gt: ahora } },
    select: { lockedUntil: true },
  });
  const hasta = filas.map((fila) => fila.lockedUntil?.getTime() ?? 0);
  return hasta.length > 0 ? new Date(Math.max(...hasta)) : null;
}

/** Registra un fallo; devuelve hasta cuándo queda bloqueada la clave si este fallo la bloqueó. */
export async function registrarFallo(clave: string, limite: number, ahora = new Date()): Promise<Date | null> {
  const db = getDb();
  const previo = await db.loginThrottle.findUnique({ where: { key: clave } });
  const nuevo = aplicarFallo(previo, limite, ahora);
  await db.loginThrottle.upsert({ where: { key: clave }, create: { key: clave, ...nuevo }, update: nuevo });
  // Solo al bloquear el contador vuelve a 0.
  return nuevo.failures === 0 ? nuevo.lockedUntil : null;
}

export async function registrarExito(clave: string) {
  await getDb().loginThrottle.deleteMany({ where: { key: clave } });
}

/** "15 minutos", "1 hora", "2 horas". */
export function esperaLegible(hasta: Date, ahora = new Date()) {
  const minutos = Math.max(1, Math.ceil((hasta.getTime() - ahora.getTime()) / MINUTO));
  if (minutos < 60) return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
  const horas = Math.ceil(minutos / 60);
  return horas === 1 ? "1 hora" : `${horas} horas`;
}
