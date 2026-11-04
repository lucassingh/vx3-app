import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditoriaCategoria, AuditoriaEntry } from "@/lib/api/types";
import { isRole, ROLE_INFO } from "../permissions";

/**
 * Registro de auditoría (RF-M0-03): quién hizo qué, sobre qué, cuándo, con el
 * antes y el después. Se escribe desde las acciones (defineAction le da a cada
 * handler un `audit()` con el usuario y el ID del request ya puestos) y se lee
 * en Configuración → Usuarios y roles y en Mi perfil.
 *
 * Nunca guarda contraseñas, tokens ni cookies: sanitize() los oculta aunque
 * alguien los pase por error.
 */

export type AuditEntry = {
  actor: { id: string | null; label: string };
  /** "usuario.rol", "acceso.entrada"… (ver DESCRIPCION). */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
};

const OCULTOS = /^(password|newpassword|currentpassword|passwordtemporal|token|cookie|authorization|secret)$/i;

export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, OCULTOS.test(key) ? "[oculto]" : sanitize(inner)]),
    );
  }
  return value;
}

function json(value: Record<string, unknown> | null | undefined) {
  return value ? (sanitize(value) as Prisma.InputJsonValue) : undefined;
}

export async function record(entry: AuditEntry): Promise<void> {
  await getDb().auditLog.create({
    data: {
      id: newId(),
      actorId: entry.actor.id,
      actorLabel: entry.actor.label,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: json(entry.before),
      after: json(entry.after),
      requestId: entry.requestId ?? null,
    },
  });
}

/* ---- Lectura ------------------------------------------------------------------- */

type Datos = Record<string, unknown>;

const texto = (datos: Datos | null, campo: string) => {
  const valor = datos?.[campo];
  return typeof valor === "string" ? valor : "";
};
const rol = (datos: Datos | null) => {
  const valor = datos?.rol;
  return isRole(valor) ? ROLE_INFO[valor].nombre : undefined;
};

/** Cómo se lee cada acción en el registro. */
const DESCRIPCION: Record<
  string,
  { categoria: AuditoriaCategoria; texto: (antes: Datos | null, despues: Datos | null) => string }
> = {
  "acceso.entrada": { categoria: "accesos", texto: () => "Entró a la app" },
  "acceso.salida": { categoria: "accesos", texto: () => "Salió de la app" },
  "acceso.fallido": {
    categoria: "accesos",
    texto: (_, d) => `Intento de ingreso fallido como “${texto(d, "identificador")}”`,
  },
  "acceso.bloqueo": {
    categoria: "accesos",
    texto: (_, d) => `Se bloqueó el ingreso de “${texto(d, "identificador")}” por intentos fallidos`,
  },
  "password.cambio": { categoria: "accesos", texto: () => "Cambió su contraseña" },
  "usuario.creado": {
    categoria: "accesos",
    texto: (_, d) => `Creó el usuario de ${texto(d, "nombre")} (${rol(d) ?? "sin rol"})`,
  },
  "usuario.rol": { categoria: "accesos", texto: (_, d) => `Cambió el rol de ${texto(d, "nombre")}` },
  "usuario.desactivado": { categoria: "accesos", texto: (_, d) => `Desactivó a ${texto(d, "nombre")}` },
  "usuario.reactivado": { categoria: "accesos", texto: (_, d) => `Reactivó a ${texto(d, "nombre")}` },
  "usuario.sesiones_cerradas": {
    categoria: "accesos",
    texto: (_, d) => `Cerró las sesiones de ${texto(d, "nombre")}`,
  },
  "credencial.cargada": { categoria: "accesos", texto: (_, d) => `Cargó la credencial de ${texto(d, "integracion")}` },
  "usuario.password_reseteada": {
    categoria: "accesos",
    texto: (_, d) => `Reseteó la contraseña de ${texto(d, "nombre")}`,
  },
};

export function aEntrada(fila: {
  id: string;
  occurredAt: Date;
  actorId: string | null;
  actorLabel: string;
  action: string;
  before: unknown;
  after: unknown;
}): AuditoriaEntry {
  const antes = (fila.before ?? null) as Datos | null;
  const despues = (fila.after ?? null) as Datos | null;
  const descripcion = DESCRIPCION[fila.action];
  // En un cambio de rol, el antes y el después son el rol.
  const conRoles = fila.action === "usuario.rol";
  return {
    id: fila.id,
    usuarioId: fila.actorId ?? "",
    usuario: fila.actorLabel,
    categoria: descripcion?.categoria ?? "accesos",
    accion: descripcion?.texto(antes, despues) ?? fila.action,
    antes: conRoles ? rol(antes) : undefined,
    despues: conRoles ? rol(despues) : undefined,
    en: fila.occurredAt.toISOString(),
  };
}

/** Lo último del registro; con `actorId`, solo lo que hizo esa persona. */
export async function listar({ actorId, limite = 50 }: { actorId?: string; limite?: number } = {}) {
  const filas = await getDb().auditLog.findMany({
    where: actorId ? { actorId } : undefined,
    orderBy: { occurredAt: "desc" },
    take: limite,
  });
  return filas.map(aEntrada);
}
