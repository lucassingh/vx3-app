import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { serverEnv } from "@/env";
import type { CredencialEnmascarada } from "@/lib/api/types";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { cifrar, descifrar, enmascarar } from "./crypto";
import { type IntegracionConCredencial, NOMBRE_INTEGRACION } from "./integraciones";

/**
 * Credenciales de las cuentas del cliente (RF-M0-06). El valor solo existe
 * descifrado en el servidor y solo para usarlo: al navegador y a la auditoría
 * llega la máscara. Los cambios los registra la acción (actions.ts).
 */

function claveMaestra(): Buffer {
  // Las previews comparten las variables de Vercel con QA, y no se conectan a DUX (`fase-1.4`, decisión 2).
  const clave = process.env.APP_ENV === "preview" ? undefined : serverEnv().CREDENTIALS_KEY;
  if (!clave) {
    throw new AppError(
      "INTERNAL",
      "Falta la clave maestra (CREDENTIALS_KEY) en este ambiente: no se pueden guardar ni leer credenciales.",
    );
  }
  return Buffer.from(clave, "base64url");
}

export async function guardarCredencial(
  integracion: IntegracionConCredencial,
  valor: string,
  actor: { id: string; label: string },
): Promise<{ mascara: string; anterior: string | null }> {
  const clave = claveMaestra();
  const db = getDb();
  const mascara = enmascarar(valor);
  const previa = await db.integrationCredential.findUnique({ where: { integration: integracion } });
  const datos = {
    encrypted: cifrar(valor, clave, integracion),
    mask: mascara,
    loadedById: actor.id,
    loadedByLabel: actor.label,
    loadedAt: new Date(),
  };
  await db.integrationCredential.upsert({
    where: { integration: integracion },
    create: { id: newId(), integration: integracion, ...datos },
    update: datos,
  });
  return { mascara, anterior: previa?.mask ?? null };
}

/** El valor para llamar a la integración; null si todavía no se cargó. */
export async function leerCredencial(integracion: IntegracionConCredencial): Promise<string | null> {
  const fila = await getDb().integrationCredential.findUnique({ where: { integration: integracion } });
  if (!fila) return null;
  const clave = claveMaestra();
  try {
    return descifrar(fila.encrypted, clave, integracion);
  } catch (error) {
    logger.error({ err: error, integracion }, "no se pudo descifrar una credencial");
    throw new AppError(
      "INTERNAL",
      `No se pudo leer la credencial de ${NOMBRE_INTEGRACION[integracion]}: la clave maestra cambió o el dato se dañó. Volvé a cargarla.`,
    );
  }
}

/** Lo que se puede mostrar de una credencial. */
export async function credencialEnmascarada(
  integracion: IntegracionConCredencial,
): Promise<CredencialEnmascarada | null> {
  const fila = await getDb().integrationCredential.findUnique({ where: { integration: integracion } });
  if (!fila) return null;
  return { mascara: fila.mask, cargadaPor: fila.loadedByLabel, cargadaEn: fila.loadedAt.toISOString() };
}
