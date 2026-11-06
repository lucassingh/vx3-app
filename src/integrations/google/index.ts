import "server-only";
import { serverEnv } from "@/env";
import { ExternalServiceError } from "@/lib/errors";
import { leerCredencial } from "@/modules/platform/credentials/service";
import { createGoogleClient, pedirTokenDeGoogle } from "./client";
import { leerCuentaDeServicio } from "./cuenta";

type Opciones = Parameters<typeof createGoogleClient>[1];

/** El cliente de Google de este ambiente, con la clave guardada. */
export async function googleClient(opciones: Opciones = {}) {
  const valor = await leerCredencial("google");
  if (!valor) throw new ExternalServiceError("Google", "Todavía no se cargó la clave de la cuenta de servicio.");
  const cuenta = leerCuentaDeServicio(valor);
  if (!cuenta)
    throw new ExternalServiceError("Google", "La clave guardada no es de una cuenta de servicio: cargala de nuevo.");
  return createGoogleClient(await pedirTokenDeGoogle(cuenta, { fetch: opciones.fetch }), opciones);
}

/** De dónde sale el catálogo hasta el pase. */
export function fuentesDelCatalogo(): { sheetId: string; carpetaId: string } {
  const { GOOGLE_SHEET_ID: sheetId, GOOGLE_FOTOS_CARPETA_ID: carpetaId } = serverEnv();
  if (!sheetId || !carpetaId) {
    throw new ExternalServiceError("Google", "Faltan GOOGLE_SHEET_ID o GOOGLE_FOTOS_CARPETA_ID en este ambiente.");
  }
  return { sheetId, carpetaId };
}
